/**
 * Contract Test: Update Delta API
 * Endpoint: GET /api/updates/{id}/delta
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('GET /api/updates/{id}/delta - Version Delta', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let updateId: string;
  let versions: any[] = [];

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create initial update
    const v1Data = {
      category: 'weather',
      priority: 3,
      data: Buffer.from(JSON.stringify({
        temperature: 72,
        humidity: 45,
        conditions: 'sunny'
      })).toString('base64'),
      subscribers: ['KB2DEF', 'KC3GHI'],
      originator: 'KA1ABC',
      signature: await signData('v1', keyPair.privateKey)
    };

    const v1Response = await request(app)
      .post('/api/updates')
      .send(v1Data);

    updateId = v1Response.body.id;
    versions.push(v1Response.body);

    // Create version 2 - temperature change
    const v2Data = {
      ...v1Data,
      data: Buffer.from(JSON.stringify({
        temperature: 75,
        humidity: 45,
        conditions: 'sunny'
      })).toString('base64'),
      signature: await signData('v2', keyPair.privateKey)
    };

    const v2Response = await request(app)
      .put(`/api/updates/${updateId}`)
      .send(v2Data);
    versions.push(v2Response.body);

    // Create version 3 - conditions change
    const v3Data = {
      ...v1Data,
      data: Buffer.from(JSON.stringify({
        temperature: 75,
        humidity: 50,
        conditions: 'partly cloudy',
        windSpeed: 10
      })).toString('base64'),
      signature: await signData('v3', keyPair.privateKey)
    };

    const v3Response = await request(app)
      .put(`/api/updates/${updateId}`)
      .send(v3Data);
    versions.push(v3Response.body);
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should return delta between two versions', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .query({ fromVersion: 1, toVersion: 2 })
      .expect(200);

    expect(response.body).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      operations: expect.any(Array)
    });

    // Check delta operations
    const ops = response.body.operations;
    expect(ops.length).toBeGreaterThan(0);

    // Should have temperature change
    const tempChange = ops.find((op: any) =>
      op.path === '/temperature' && op.op === 'replace'
    );
    expect(tempChange).toBeDefined();
    expect(tempChange.value).toBe(75);
  });

  it('should return delta from version to latest', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .query({ fromVersion: 1 })
      .expect(200);

    expect(response.body).toMatchObject({
      fromVersion: 1,
      toVersion: 3, // Latest version
      operations: expect.any(Array)
    });

    const ops = response.body.operations;

    // Should include all changes from v1 to v3
    const additions = ops.filter((op: any) => op.op === 'add');
    const replacements = ops.filter((op: any) => op.op === 'replace');

    expect(additions.length).toBeGreaterThan(0); // windSpeed added
    expect(replacements.length).toBeGreaterThan(0); // temperature, humidity, conditions changed
  });

  it('should return empty delta for same version', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .query({ fromVersion: 2, toVersion: 2 })
      .expect(200);

    expect(response.body).toMatchObject({
      fromVersion: 2,
      toVersion: 2,
      operations: []
    });
  });

  it('should handle complex nested changes', async () => {
    // Create update with nested structure
    const nestedData = {
      category: 'emergency',
      priority: 0,
      data: Buffer.from(JSON.stringify({
        alert: {
          type: 'tornado',
          severity: 'warning',
          areas: ['EM48', 'EM49'],
          details: {
            windSpeed: 150,
            direction: 'NE'
          }
        }
      })).toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: await signData('nested1', keyPair.privateKey)
    };

    const createResponse = await request(app)
      .post('/api/updates')
      .send(nestedData);

    const nestedId = createResponse.body.id;

    // Update with nested changes
    const nestedUpdate = {
      ...nestedData,
      data: Buffer.from(JSON.stringify({
        alert: {
          type: 'tornado',
          severity: 'watch', // Changed
          areas: ['EM48', 'EM49', 'EM50'], // Added
          details: {
            windSpeed: 175, // Changed
            direction: 'NE',
            estimatedTime: '14:30' // Added
          }
        }
      })).toString('base64'),
      signature: await signData('nested2', keyPair.privateKey)
    };

    await request(app)
      .put(`/api/updates/${nestedId}`)
      .send(nestedUpdate);

    const response = await request(app)
      .get(`/api/updates/${nestedId}/delta`)
      .query({ fromVersion: 1, toVersion: 2 })
      .expect(200);

    const ops = response.body.operations;

    // Check for nested path operations
    const severityOp = ops.find((op: any) => op.path === '/alert/severity');
    expect(severityOp).toBeDefined();
    expect(severityOp.op).toBe('replace');
    expect(severityOp.value).toBe('watch');

    const areaOp = ops.find((op: any) => op.path === '/alert/areas/2');
    expect(areaOp).toBeDefined();
    expect(areaOp.op).toBe('add');
    expect(areaOp.value).toBe('EM50');

    const timeOp = ops.find((op: any) => op.path === '/alert/details/estimatedTime');
    expect(timeOp).toBeDefined();
    expect(timeOp.op).toBe('add');
  });

  it('should return 404 for non-existent update', async () => {
    await request(app)
      .get('/api/updates/EMRG-9999-999/delta')
      .query({ fromVersion: 1 })
      .expect(404)
      .expect(res => {
        expect(res.body.error).toContain('not found');
      });
  });

  it('should return 404 for non-existent version', async () => {
    await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .query({ fromVersion: 99 })
      .expect(404)
      .expect(res => {
        expect(res.body.error).toContain('Version not found');
      });
  });

  it('should validate version parameters', async () => {
    // Invalid fromVersion
    await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .query({ fromVersion: 'abc' })
      .expect(400);

    // Missing fromVersion
    await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .expect(400);

    // fromVersion > toVersion
    await request(app)
      .get(`/api/updates/${updateId}/delta`)
      .query({ fromVersion: 3, toVersion: 1 })
      .expect(400)
      .expect(res => {
        expect(res.body.error).toContain('fromVersion must be less than toVersion');
      });
  });

  it('should optimize delta for bandwidth efficiency', async () => {
    // Create large update
    const largeData = {
      items: Array(100).fill(null).map((_, i) => ({
        id: i,
        value: `item-${i}`,
        status: 'active'
      }))
    };

    const createData = {
      category: 'routine',
      priority: 5,
      data: Buffer.from(JSON.stringify(largeData)).toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: await signData('large1', keyPair.privateKey)
    };

    const createResponse = await request(app)
      .post('/api/updates')
      .send(createData);

    const largeId = createResponse.body.id;

    // Make small change
    largeData.items[50].status = 'inactive';

    const updateData = {
      ...createData,
      data: Buffer.from(JSON.stringify(largeData)).toString('base64'),
      signature: await signData('large2', keyPair.privateKey)
    };

    await request(app)
      .put(`/api/updates/${largeId}`)
      .send(updateData);

    const response = await request(app)
      .get(`/api/updates/${largeId}/delta`)
      .query({ fromVersion: 1, toVersion: 2 })
      .expect(200);

    // Delta should be much smaller than full update
    const deltaSize = JSON.stringify(response.body.operations).length;
    const fullSize = JSON.stringify(largeData).length;

    expect(deltaSize).toBeLessThan(fullSize * 0.1); // Delta should be <10% of full size
  });

  it('should handle deletion operations', async () => {
    const v1 = {
      category: 'routine',
      priority: 5,
      data: Buffer.from(JSON.stringify({
        a: 1,
        b: 2,
        c: 3
      })).toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: await signData('del1', keyPair.privateKey)
    };

    const createResponse = await request(app)
      .post('/api/updates')
      .send(v1);

    const delId = createResponse.body.id;

    // Remove property b
    const v2 = {
      ...v1,
      data: Buffer.from(JSON.stringify({
        a: 1,
        c: 3
      })).toString('base64'),
      signature: await signData('del2', keyPair.privateKey)
    };

    await request(app)
      .put(`/api/updates/${delId}`)
      .send(v2);

    const response = await request(app)
      .get(`/api/updates/${delId}/delta`)
      .query({ fromVersion: 1, toVersion: 2 })
      .expect(200);

    const removeOp = response.body.operations.find((op: any) =>
      op.op === 'remove' && op.path === '/b'
    );
    expect(removeOp).toBeDefined();
  });
});