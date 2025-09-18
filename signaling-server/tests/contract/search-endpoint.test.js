/**
 * T008: Contract test for GET /api/content/search
 * This test MUST fail first (TDD Red phase)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

describe('GET /api/content/search', () => {
  let app;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app.js');
    app = await createApp();
  });

  beforeEach(async () => {
    // Seed test data
    await request(app)
      .post('/api/content/announce')
      .send({
        callsign: 'KA1ABC',
        signature: 'sig',
        contentHash: 'search123search123search123search123search123search123search12345',
        path: ['KB2DEF'],
        metadata: {
          url: '/test/page',
          size: 1024,
          mimeType: 'text/html',
          priority: 2
        },
        timestamp: new Date().toISOString()
      });
  });

  it('should search by content hash', async () => {
    const response = await request(app)
      .get('/api/content/search')
      .query({ hash: 'search123search123search123search123search123search123search12345' })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toHaveProperty('contentHash');
    expect(response.body[0]).toHaveProperty('paths');
  });

  it('should search by callsign', async () => {
    const response = await request(app)
      .get('/api/content/search')
      .query({ callsign: 'KA1ABC' })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
    expect(response.body[0].callsign).toBe('KA1ABC');
  });

  it('should search by priority tier', async () => {
    const response = await request(app)
      .get('/api/content/search')
      .query({ priority: 2 })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    response.body.forEach(item => {
      expect(item.priorityTier).toBeLessThanOrEqual(2);
    });
  });

  it('should return empty array for no matches', async () => {
    const response = await request(app)
      .get('/api/content/search')
      .query({ hash: 'nonexistent000nonexistent000nonexistent000nonexistent000nonexist' })
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should support combined filters', async () => {
    const response = await request(app)
      .get('/api/content/search')
      .query({
        callsign: 'KA1ABC',
        priority: 3
      })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    response.body.forEach(item => {
      expect(item.callsign).toBe('KA1ABC');
      expect(item.priorityTier).toBeLessThanOrEqual(3);
    });
  });

  it('should validate query parameters', async () => {
    await request(app)
      .get('/api/content/search')
      .query({ priority: 'invalid' })
      .expect(400);

    await request(app)
      .get('/api/content/search')
      .query({ hash: 'not-64-chars' })
      .expect(400);
  });

  it('should respect performance targets (<100ms)', async () => {
    const start = Date.now();

    await request(app)
      .get('/api/content/search')
      .query({ hash: 'search123search123search123search123search123search123search12345' })
      .expect(200);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});