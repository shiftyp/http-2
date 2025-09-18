/**
 * T009: Contract test for POST /api/content/batch
 * This test MUST fail first (TDD Red phase)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('POST /api/content/batch', () => {
  let app;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js');
    app = await createApp();

    // Seed test data
    const testBeacons = [
      { contentHash: 'batch001batch001batch001batch001batch001batch001batch001batch001' },
      { contentHash: 'batch002batch002batch002batch002batch002batch002batch002batch002' },
      { contentHash: 'batch003batch003batch003batch003batch003batch003batch003batch003' }
    ];

    for (const beacon of testBeacons) {
      await request(app)
        .post('/api/content/announce')
        .send({
          callsign: 'KA1ABC',
          signature: 'sig',
          contentHash: beacon.contentHash,
          path: ['KB2DEF'],
          metadata: { size: 1024, mimeType: 'text/html' },
          timestamp: new Date().toISOString()
        });
    }
  });

  it('should batch query multiple content hashes', async () => {
    const response = await request(app)
      .post('/api/content/batch')
      .send({
        hashes: [
          'batch001batch001batch001batch001batch001batch001batch001batch001',
          'batch002batch002batch002batch002batch002batch002batch002batch002',
          'nonexistent456nonexistent456nonexistent456nonexistent456nonexist'
        ]
      })
      .expect(200);

    expect(response.body).toHaveProperty('batch001batch001batch001batch001batch001batch001batch001batch001');
    expect(response.body).toHaveProperty('batch002batch002batch002batch002batch002batch002batch002batch002');
    expect(response.body.nonexistent456nonexistent456nonexistent456nonexistent456nonexist).toBeNull();
  });

  it('should enforce maximum batch size of 100', async () => {
    const hashes = Array(101).fill(0).map((_, i) =>
      `hash${i}`.padEnd(64, '0')
    );

    await request(app)
      .post('/api/content/batch')
      .send({ hashes })
      .expect(400);
  });

  it('should validate hash format', async () => {
    await request(app)
      .post('/api/content/batch')
      .send({
        hashes: ['invalid-hash', 'another-invalid']
      })
      .expect(400);
  });

  it('should return empty object for empty array', async () => {
    const response = await request(app)
      .post('/api/content/batch')
      .send({ hashes: [] })
      .expect(200);

    expect(response.body).toEqual({});
  });

  it('should handle duplicate hashes in request', async () => {
    const hash = 'batch001batch001batch001batch001batch001batch001batch001batch001';

    const response = await request(app)
      .post('/api/content/batch')
      .send({
        hashes: [hash, hash, hash]
      })
      .expect(200);

    expect(Object.keys(response.body)).toHaveLength(1);
    expect(response.body[hash]).toBeDefined();
  });
});