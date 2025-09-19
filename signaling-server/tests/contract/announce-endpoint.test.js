/**
 * T007: Contract test for POST /api/content/announce
 * This test MUST fail first (TDD Red phase)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

describe('POST /api/content/announce', () => {
  let app;

  beforeAll(async () => {
    // This will fail initially as app doesn't exist yet
    const { createApp } = await import('../../src/app.js');
    app = await createApp();
  });

  it('should accept valid beacon announcement', async () => {
    const beaconUpdate = {
      callsign: 'KA1ABC',
      signature: 'test-signature',
      contentHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
      path: ['KB2DEF'],
      metadata: {
        url: '/emergency/evacuation',
        size: 2048,
        mimeType: 'text/html',
        priority: 0
      },
      signalQuality: 0.85,
      timestamp: new Date().toISOString()
    };

    const response = await request(app)
      .post('/api/content/announce')
      .send(beaconUpdate)
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('contentHash', beaconUpdate.contentHash);
    expect(response.body).toHaveProperty('consolidated');
    expect(response.body).toHaveProperty('pathCount');
  });

  it('should consolidate duplicate beacons', async () => {
    const contentHash = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd';

    // First beacon
    await request(app)
      .post('/api/content/announce')
      .send({
        callsign: 'KA1ABC',
        signature: 'sig1',
        contentHash,
        path: ['KB2DEF'],
        metadata: { size: 2048, mimeType: 'text/html' },
        timestamp: new Date().toISOString()
      })
      .expect(201);

    // Second beacon with different path
    const response = await request(app)
      .post('/api/content/announce')
      .send({
        callsign: 'KA1ABC',
        signature: 'sig2',
        contentHash,
        path: ['KC3GHI', 'KD4JKL'],
        timestamp: new Date().toISOString()
      })
      .expect(201);

    expect(response.body.consolidated).toBe(true);
    expect(response.body.pathCount).toBeGreaterThanOrEqual(2);
  });

  it('should validate required fields', async () => {
    const invalidBeacon = {
      callsign: 'INVALID',
      contentHash: 'not-a-valid-hash'
    };

    await request(app)
      .post('/api/content/announce')
      .send(invalidBeacon)
      .expect(400);
  });

  it('should enforce rate limiting', async () => {
    const beacon = {
      callsign: 'KE5MNO',
      signature: 'sig',
      contentHash: 'a'.repeat(64), // Valid 64-character hash
      path: ['KF6PQR'],
      timestamp: new Date().toISOString()
    };

    // Send 11 requests (limit is 10/minute)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/content/announce')
        .send({ ...beacon, contentHash: ('b'.repeat(63) + i).padStart(64, '0') })
        .expect(201);
    }

    // 11th request should be rate limited
    await request(app)
      .post('/api/content/announce')
      .send({ ...beacon, contentHash: 'c'.repeat(64) })
      .expect(429);
  });

  it('should authenticate station signature', async () => {
    const beacon = {
      callsign: 'KG7STU',
      signature: 'invalid-signature',
      contentHash: 'auth123auth123auth123auth123auth123auth123auth123auth123auth12345',
      path: ['KH8VWX'],
      timestamp: new Date().toISOString()
    };

    await request(app)
      .post('/api/content/announce')
      .send(beacon)
      .expect(401);
  });
});