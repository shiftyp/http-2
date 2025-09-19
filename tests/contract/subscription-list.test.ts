/**
 * Contract Test: Subscription List API
 * Endpoint: GET /api/subscriptions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('GET /api/subscriptions - List Subscriptions', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let createdSubscriptions: any[] = [];

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create test subscriptions
    const testData = [
      { stationId: 'KA1ABC', channel: 'emergency', licensed: true },
      { stationId: 'KA1ABC', channel: 'weather', licensed: true },
      { stationId: 'KB2DEF', channel: 'emergency', licensed: true },
      { stationId: 'KC3GHI', channel: 'weather.alerts', licensed: true },
      { stationId: 'UNLICENSED-001', channel: 'emergency', licensed: false },
      { stationId: 'UNLICENSED-001', channel: 'weather', licensed: false }
    ];

    for (const item of testData) {
      const subData: any = {
        stationId: item.stationId,
        channel: item.channel
      };

      if (item.licensed) {
        subData.signature = await signData(`${item.stationId}:${item.channel}`, keyPair.privateKey);
      }

      const response = await request(app)
        .post('/api/subscriptions')
        .send(subData);

      if (response.status === 201) {
        createdSubscriptions.push(response.body);
      }
    }
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should list all subscriptions without filters', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(6);

    response.body.forEach((sub: any) => {
      expect(sub).toHaveProperty('id');
      expect(sub).toHaveProperty('stationId');
      expect(sub).toHaveProperty('channel');
      expect(sub).toHaveProperty('created');
      expect(sub).toHaveProperty('active');
      expect(sub).toHaveProperty('licensed');
    });
  });

  it('should filter subscriptions by station', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .query({ stationId: 'KA1ABC' })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(2);

    response.body.forEach((sub: any) => {
      expect(sub.stationId).toBe('KA1ABC');
    });

    const channels = response.body.map((s: any) => s.channel);
    expect(channels).toContain('emergency');
    expect(channels).toContain('weather');
  });

  it('should filter subscriptions by channel', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .query({ channel: 'emergency' })
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(3); // KA1ABC, KB2DEF, UNLICENSED-001

    response.body.forEach((sub: any) => {
      expect(sub.channel).toBe('emergency');
    });
  });

  it('should filter subscriptions by active status', async () => {
    // First, deactivate a subscription
    const subToDeactivate = createdSubscriptions[0];
    await request(app)
      .delete(`/api/subscriptions/${subToDeactivate.id}`)
      .send({ signature: await signData('delete', keyPair.privateKey) });

    const response = await request(app)
      .get('/api/subscriptions')
      .query({ active: true })
      .expect(200);

    response.body.forEach((sub: any) => {
      expect(sub.active).toBe(true);
    });

    // Check that deactivated subscription is not included
    const hasDeactivated = response.body.some((s: any) => s.id === subToDeactivate.id);
    expect(hasDeactivated).toBe(false);
  });

  it('should filter by licensed status', async () => {
    // Get licensed subscriptions
    const licensedResponse = await request(app)
      .get('/api/subscriptions')
      .query({ licensed: true })
      .expect(200);

    licensedResponse.body.forEach((sub: any) => {
      expect(sub.licensed).toBe(true);
      expect(sub.stationId).not.toMatch(/^UNLICENSED/);
    });

    // Get unlicensed subscriptions
    const unlicensedResponse = await request(app)
      .get('/api/subscriptions')
      .query({ licensed: false })
      .expect(200);

    unlicensedResponse.body.forEach((sub: any) => {
      expect(sub.licensed).toBe(false);
      expect(sub.stationId).toMatch(/^UNLICENSED/);
    });
  });

  it('should support multiple filters', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .query({
        channel: 'weather',
        licensed: true
      })
      .expect(200);

    response.body.forEach((sub: any) => {
      expect(sub.channel).toMatch(/^weather/);
      expect(sub.licensed).toBe(true);
    });
  });

  it('should support channel prefix matching', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .query({ channel: 'weather.*' })
      .expect(200);

    response.body.forEach((sub: any) => {
      expect(sub.channel).toMatch(/^weather/);
    });

    // Should include both 'weather' and 'weather.alerts'
    const channels = response.body.map((s: any) => s.channel);
    expect(channels).toContain('weather');
    expect(channels).toContain('weather.alerts');
  });

  it('should paginate results', async () => {
    // Get first page
    const page1 = await request(app)
      .get('/api/subscriptions')
      .query({ limit: 3, offset: 0 })
      .expect(200);

    expect(page1.body.length).toBeLessThanOrEqual(3);

    // Get second page
    const page2 = await request(app)
      .get('/api/subscriptions')
      .query({ limit: 3, offset: 3 })
      .expect(200);

    // Verify no overlap
    const page1Ids = page1.body.map((s: any) => s.id);
    const page2Ids = page2.body.map((s: any) => s.id);
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('should sort by creation time (newest first)', async () => {
    const response = await request(app)
      .get('/api/subscriptions')
      .expect(200);

    for (let i = 1; i < response.body.length; i++) {
      const prev = new Date(response.body[i - 1].created);
      const curr = new Date(response.body[i].created);
      expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
    }
  });

  it('should return subscriber count by channel', async () => {
    const response = await request(app)
      .get('/api/subscriptions/stats')
      .expect(200);

    expect(response.body).toHaveProperty('channels');
    expect(response.body.channels).toBeInstanceOf(Object);

    // Check emergency channel has multiple subscribers
    expect(response.body.channels.emergency).toBeGreaterThanOrEqual(2);
  });
});