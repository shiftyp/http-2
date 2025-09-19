/**
 * Contract Test: Retry Request Protocol
 * Endpoint: POST /api/retry
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('POST /api/retry - Request Update Retry', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let updateId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create a test update first
    const updateData = {
      category: 'emergency',
      priority: 0,
      data: Buffer.from('Test emergency').toString('base64'),
      subscribers: ['KB2DEF', 'KC3GHI'],
      originator: 'KA1ABC',
      signature: await signData('test', keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/updates')
      .send(updateData);

    updateId = response.body.id;
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should accept retry request from licensed station', async () => {
    const retryData = {
      updateId,
      version: 1,
      requester: 'KD4JKL',
      signature: await signData(`${updateId}:1:KD4JKL`, keyPair.privateKey),
      location: 'EM48'
    };

    const response = await request(app)
      .post('/api/retry')
      .send(retryData)
      .expect(202);

    expect(response.body).toMatchObject({
      requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      updateId,
      coordinationWindow: expect.any(Number),
      holders: expect.any(Array)
    });

    // Coordination window should be 10-30 seconds
    expect(response.body.coordinationWindow).toBeGreaterThanOrEqual(10);
    expect(response.body.coordinationWindow).toBeLessThanOrEqual(30);
  });

  it('should reject retry request without valid signature', async () => {
    const retryData = {
      updateId,
      version: 1,
      requester: 'KD4JKL',
      signature: 'invalid-signature'
    };

    await request(app)
      .post('/api/retry')
      .send(retryData)
      .expect(401)
      .expect(res => {
        expect(res.body.error).toContain('Invalid signature');
      });
  });

  it('should reject retry request from unlicensed station', async () => {
    const retryData = {
      updateId,
      version: 1,
      requester: 'UNLICENSED-001',
      signature: await signData('retry', keyPair.privateKey)
    };

    await request(app)
      .post('/api/retry')
      .send(retryData)
      .expect(401)
      .expect(res => {
        expect(res.body.error).toContain('unlicensed station');
      });
  });

  it('should return list of holders who have the update', async () => {
    // First, register some holders
    await request(app)
      .post(`/api/updates/${updateId}/holders`)
      .send({
        stationId: 'KB2DEF',
        licensed: true
      });

    await request(app)
      .post(`/api/updates/${updateId}/holders`)
      .send({
        stationId: 'KC3GHI',
        licensed: true
      });

    const retryData = {
      updateId,
      version: 1,
      requester: 'KD4JKL',
      signature: await signData(`${updateId}:1:KD4JKL`, keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/retry')
      .send(retryData)
      .expect(202);

    expect(response.body.holders).toContain('KB2DEF');
    expect(response.body.holders).toContain('KC3GHI');
  });

  it('should handle coordination window timing', async () => {
    const requests = [];

    // Multiple stations request same update
    for (let i = 0; i < 3; i++) {
      const retryData = {
        updateId,
        version: 1,
        requester: `K${i}ABC`,
        signature: await signData(`${updateId}:1:K${i}ABC`, keyPair.privateKey)
      };

      const response = await request(app)
        .post('/api/retry')
        .send(retryData)
        .expect(202);

      requests.push(response.body);
    }

    // All should get coordination windows
    requests.forEach(req => {
      expect(req.coordinationWindow).toBeGreaterThanOrEqual(10);
      expect(req.coordinationWindow).toBeLessThanOrEqual(30);
    });

    // Windows should be different to avoid collisions
    const windows = requests.map(r => r.coordinationWindow);
    const uniqueWindows = new Set(windows);
    expect(uniqueWindows.size).toBeGreaterThan(1);
  });

  it('should return 404 for non-existent update', async () => {
    const retryData = {
      updateId: 'EMRG-9999-999',
      version: 1,
      requester: 'KD4JKL',
      signature: await signData('nonexistent', keyPair.privateKey)
    };

    await request(app)
      .post('/api/retry')
      .send(retryData)
      .expect(404)
      .expect(res => {
        expect(res.body.error).toContain('not found');
      });
  });

  it('should rate limit retry requests', async () => {
    const retryData = {
      updateId,
      version: 1,
      requester: 'KE5MNO',
      signature: await signData(`${updateId}:1:KE5MNO`, keyPair.privateKey)
    };

    // Make many rapid requests
    const promises = [];
    for (let i = 0; i < 15; i++) {
      promises.push(
        request(app)
          .post('/api/retry')
          .send({...retryData, signature: await signData(`retry${i}`, keyPair.privateKey)})
      );
    }

    const responses = await Promise.all(promises);
    const rateLimited = responses.some(r => r.status === 429);
    expect(rateLimited).toBe(true);
  });

  it('should include location for geographic routing', async () => {
    const retryData = {
      updateId,
      version: 1,
      requester: 'KF6PQR',
      signature: await signData(`${updateId}:1:KF6PQR`, keyPair.privateKey),
      location: 'DM04' // Grid square
    };

    const response = await request(app)
      .post('/api/retry')
      .send(retryData)
      .expect(202);

    // System should use location for finding nearest holders
    expect(response.body.holders).toBeDefined();
  });
});