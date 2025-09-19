/**
 * Contract Test: Update Holders API
 * Endpoint: GET /api/updates/{id}/holders
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('GET /api/updates/{id}/holders - Find Update Holders', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let updateId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create a test update
    const updateData = {
      category: 'emergency',
      priority: 0,
      data: Buffer.from('Test emergency for holders').toString('base64'),
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL', 'UNLICENSED-001'],
      originator: 'KA1ABC',
      signature: await signData('test', keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/updates')
      .send(updateData);

    updateId = response.body.id;

    // Register some holders
    const holders = [
      { stationId: 'KB2DEF', licensed: true, available: true },
      { stationId: 'KC3GHI', licensed: true, available: true },
      { stationId: 'KD4JKL', licensed: true, available: false }, // Offline
      { stationId: 'UNLICENSED-001', licensed: false, available: true }
    ];

    for (const holder of holders) {
      await request(app)
        .post(`/api/updates/${updateId}/holders`)
        .send(holder);
    }
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should return all holders for an update', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/holders`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(4);

    response.body.forEach((holder: any) => {
      expect(holder).toHaveProperty('stationId');
      expect(holder).toHaveProperty('receivedAt');
      expect(holder).toHaveProperty('licensed');
      expect(holder).toHaveProperty('available');
    });

    // Check specific holders are present
    const stationIds = response.body.map((h: any) => h.stationId);
    expect(stationIds).toContain('KB2DEF');
    expect(stationIds).toContain('KC3GHI');
    expect(stationIds).toContain('KD4JKL');
    expect(stationIds).toContain('UNLICENSED-001');
  });

  it('should filter holders by licensed status', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/holders`)
      .query({ licensed: true })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(3); // Only licensed stations

    response.body.forEach((holder: any) => {
      expect(holder.licensed).toBe(true);
      expect(holder.stationId).not.toMatch(/^UNLICENSED/);
    });
  });

  it('should filter holders by availability', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/holders`)
      .query({ available: true })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(3); // KB2DEF, KC3GHI, UNLICENSED-001

    response.body.forEach((holder: any) => {
      expect(holder.available).toBe(true);
    });

    // KD4JKL should not be included (offline)
    const stationIds = response.body.map((h: any) => h.stationId);
    expect(stationIds).not.toContain('KD4JKL');
  });

  it('should return licensed and available holders for retry requests', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/holders`)
      .query({ licensed: true, available: true })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(2); // KB2DEF and KC3GHI

    response.body.forEach((holder: any) => {
      expect(holder.licensed).toBe(true);
      expect(holder.available).toBe(true);
      expect(['KB2DEF', 'KC3GHI']).toContain(holder.stationId);
    });
  });

  it('should return 404 for non-existent update', async () => {
    await request(app)
      .get('/api/updates/EMRG-9999-999/holders')
      .expect(404)
      .expect(res => {
        expect(res.body.error).toContain('not found');
      });
  });

  it('should track when holders received the update', async () => {
    const response = await request(app)
      .get(`/api/updates/${updateId}/holders`)
      .expect(200);

    response.body.forEach((holder: any) => {
      expect(holder.receivedAt).toBeDefined();
      const receivedTime = new Date(holder.receivedAt);
      expect(receivedTime.getTime()).toBeLessThanOrEqual(Date.now());
      expect(receivedTime.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });
  });

  it('should return empty array for update with no holders', async () => {
    // Create new update with no holders
    const updateData = {
      category: 'routine',
      priority: 5,
      data: Buffer.from('No holders yet').toString('base64'),
      subscribers: ['KE5MNO'],
      originator: 'KA1ABC',
      signature: await signData('noholders', keyPair.privateKey)
    };

    const createResponse = await request(app)
      .post('/api/updates')
      .send(updateData);

    const response = await request(app)
      .get(`/api/updates/${createResponse.body.id}/holders`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(0);
  });

  it('should allow registering as a holder', async () => {
    // Create new update
    const updateData = {
      category: 'weather',
      priority: 3,
      data: Buffer.from('Weather update').toString('base64'),
      subscribers: ['KF6PQR'],
      originator: 'KA1ABC',
      signature: await signData('weather', keyPair.privateKey)
    };

    const createResponse = await request(app)
      .post('/api/updates')
      .send(updateData);

    const newUpdateId = createResponse.body.id;

    // Register as holder
    await request(app)
      .post(`/api/updates/${newUpdateId}/holders`)
      .send({
        stationId: 'KF6PQR',
        licensed: true,
        available: true
      })
      .expect(201);

    // Verify registration
    const response = await request(app)
      .get(`/api/updates/${newUpdateId}/holders`)
      .expect(200);

    expect(response.body.length).toBe(1);
    expect(response.body[0].stationId).toBe('KF6PQR');
  });

  it('should prevent duplicate holder registrations', async () => {
    // Try to register KB2DEF again
    await request(app)
      .post(`/api/updates/${updateId}/holders`)
      .send({
        stationId: 'KB2DEF',
        licensed: true,
        available: true
      })
      .expect(409)
      .expect(res => {
        expect(res.body.error).toContain('already registered');
      });
  });

  it('should update holder availability status', async () => {
    // Update KD4JKL from offline to online
    await request(app)
      .put(`/api/updates/${updateId}/holders/KD4JKL`)
      .send({
        available: true
      })
      .expect(200);

    // Verify update
    const response = await request(app)
      .get(`/api/updates/${updateId}/holders`)
      .query({ stationId: 'KD4JKL' })
      .expect(200);

    const kd4jkl = response.body.find((h: any) => h.stationId === 'KD4JKL');
    expect(kd4jkl.available).toBe(true);
  });
});