/**
 * Contract Test: Update Query API
 * Endpoint: GET /api/updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('GET /api/updates - Query Updates', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let createdUpdates: any[] = [];

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create test updates with various priorities and categories
    const testData = [
      { category: 'emergency', priority: 0, data: 'Emergency 1' },
      { category: 'emergency', priority: 0, data: 'Emergency 2' },
      { category: 'safety', priority: 1, data: 'Safety alert' },
      { category: 'weather', priority: 3, data: 'Weather update' },
      { category: 'traffic', priority: 4, data: 'Traffic info' },
      { category: 'routine', priority: 5, data: 'Routine message' }
    ];

    for (const item of testData) {
      const updateData = {
        ...item,
        data: Buffer.from(item.data).toString('base64'),
        subscribers: ['KB2DEF', 'KC3GHI'],
        originator: 'KA1ABC',
        signature: await signData(JSON.stringify(item), keyPair.privateKey)
      };

      const response = await request(app)
        .post('/api/updates')
        .send(updateData);

      createdUpdates.push(response.body);
    }
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should list all updates without filters', async () => {
    const response = await request(app)
      .get('/api/updates')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(6);

    // Check structure of returned updates
    response.body.forEach((update: any) => {
      expect(update).toHaveProperty('id');
      expect(update).toHaveProperty('version');
      expect(update).toHaveProperty('priority');
      expect(update).toHaveProperty('category');
      expect(update).toHaveProperty('size');
      expect(update).toHaveProperty('created');
      expect(update).toHaveProperty('expires');
      expect(update).toHaveProperty('etag');
    });
  });

  it('should filter updates by priority', async () => {
    const response = await request(app)
      .get('/api/updates')
      .query({ priority: 0 })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(2); // Two emergency updates

    response.body.forEach((update: any) => {
      expect(update.priority).toBe(0);
      expect(update.category).toBe('emergency');
    });
  });

  it('should filter updates by category', async () => {
    const response = await request(app)
      .get('/api/updates')
      .query({ category: 'weather' })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(1);
    expect(response.body[0].category).toBe('weather');
  });

  it('should filter updates by time range', async () => {
    const since = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

    const response = await request(app)
      .get('/api/updates')
      .query({ since })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);

    response.body.forEach((update: any) => {
      const created = new Date(update.created);
      expect(created.getTime()).toBeGreaterThan(new Date(since).getTime());
    });
  });

  it('should filter updates by subscriber', async () => {
    // Create update with specific subscriber
    const updateData = {
      category: 'routine',
      priority: 5,
      data: Buffer.from('Specific subscriber test').toString('base64'),
      subscribers: ['KD4JKL'],
      originator: 'KA1ABC',
      signature: await signData('specific', keyPair.privateKey)
    };

    await request(app)
      .post('/api/updates')
      .send(updateData);

    const response = await request(app)
      .get('/api/updates')
      .query({ subscriber: 'KD4JKL' })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(1);

    // Should include the update for this specific subscriber
    const hasTargetUpdate = response.body.some((u: any) =>
      u.id && createdUpdates.some(cu => cu.id === u.id)
    );
    expect(hasTargetUpdate).toBe(true);
  });

  it('should combine multiple filters', async () => {
    const response = await request(app)
      .get('/api/updates')
      .query({
        priority: 0,
        category: 'emergency',
        subscriber: 'KB2DEF'
      })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);

    response.body.forEach((update: any) => {
      expect(update.priority).toBe(0);
      expect(update.category).toBe('emergency');
    });
  });

  it('should return updates sorted by creation time (newest first)', async () => {
    const response = await request(app)
      .get('/api/updates')
      .expect(200);

    expect(response.body.length).toBeGreaterThan(1);

    // Check ordering
    for (let i = 1; i < response.body.length; i++) {
      const prev = new Date(response.body[i - 1].created);
      const curr = new Date(response.body[i].created);
      expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
    }
  });

  it('should not include expired updates', async () => {
    // Create an update that expires immediately (for testing)
    const updateData = {
      category: 'routine',
      priority: 5,
      data: Buffer.from('Expires immediately').toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: await signData('expired', keyPair.privateKey),
      expires: new Date(Date.now() - 1000).toISOString() // Already expired
    };

    await request(app)
      .post('/api/updates')
      .send(updateData);

    const response = await request(app)
      .get('/api/updates')
      .query({ includeExpired: false })
      .expect(200);

    // Should not include the expired update
    const hasExpired = response.body.some((u: any) =>
      u.data && Buffer.from(u.data, 'base64').toString() === 'Expires immediately'
    );
    expect(hasExpired).toBe(false);
  });

  it('should respect pagination parameters', async () => {
    // Get first page
    const page1 = await request(app)
      .get('/api/updates')
      .query({ limit: 2, offset: 0 })
      .expect(200);

    expect(page1.body.length).toBeLessThanOrEqual(2);

    // Get second page
    const page2 = await request(app)
      .get('/api/updates')
      .query({ limit: 2, offset: 2 })
      .expect(200);

    expect(page2.body.length).toBeLessThanOrEqual(2);

    // Pages should not overlap
    const page1Ids = page1.body.map((u: any) => u.id);
    const page2Ids = page2.body.map((u: any) => u.id);
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('should validate query parameters', async () => {
    // Invalid priority
    await request(app)
      .get('/api/updates')
      .query({ priority: 99 })
      .expect(400);

    // Invalid category
    await request(app)
      .get('/api/updates')
      .query({ category: 'invalid-category' })
      .expect(400);

    // Invalid date format
    await request(app)
      .get('/api/updates')
      .query({ since: 'not-a-date' })
      .expect(400);
  });
});