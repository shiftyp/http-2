/**
 * Contract Test: Subscription Creation API
 * Endpoint: POST /api/subscriptions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('POST /api/subscriptions - Create Subscription', () => {
  let app: any;
  let keyPair: CryptoKeyPair;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should create subscription for licensed station', async () => {
    const subscriptionData = {
      stationId: 'KA1ABC',
      channel: 'emergency.missing_person',
      signature: await signData('KA1ABC:emergency.missing_person', keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/subscriptions')
      .send(subscriptionData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      stationId: 'KA1ABC',
      channel: 'emergency.missing_person',
      created: expect.any(String),
      active: true
    });
  });

  it('should create subscription for unlicensed station (receive-only)', async () => {
    const subscriptionData = {
      stationId: 'UNLICENSED-001',
      channel: 'weather.alerts'
      // No signature required for unlicensed
    };

    const response = await request(app)
      .post('/api/subscriptions')
      .send(subscriptionData)
      .expect(201);

    expect(response.body).toMatchObject({
      stationId: 'UNLICENSED-001',
      channel: 'weather.alerts',
      active: true
    });
  });

  it('should prevent duplicate subscriptions', async () => {
    const subscriptionData = {
      stationId: 'KB2DEF',
      channel: 'emergency.alerts',
      signature: await signData('KB2DEF:emergency.alerts', keyPair.privateKey)
    };

    // First subscription
    await request(app)
      .post('/api/subscriptions')
      .send(subscriptionData)
      .expect(201);

    // Duplicate attempt
    await request(app)
      .post('/api/subscriptions')
      .send(subscriptionData)
      .expect(409)
      .expect(res => {
        expect(res.body.error).toContain('already exists');
      });
  });

  it('should validate channel format', async () => {
    const invalidChannels = [
      '',
      'invalid channel',
      'too.many.levels.in.channel',
      '123.numeric'
    ];

    for (const channel of invalidChannels) {
      const subscriptionData = {
        stationId: 'KA1ABC',
        channel,
        signature: 'signature'
      };

      await request(app)
        .post('/api/subscriptions')
        .send(subscriptionData)
        .expect(400);
    }
  });

  it('should support all update categories as channels', async () => {
    const categories = [
      'emergency',
      'emergency.missing_person',
      'safety',
      'weather',
      'weather.alerts',
      'traffic',
      'status',
      'routine'
    ];

    for (const channel of categories) {
      const subscriptionData = {
        stationId: `K${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        channel,
        signature: await signData(channel, keyPair.privateKey)
      };

      const response = await request(app)
        .post('/api/subscriptions')
        .send(subscriptionData);

      expect([201, 409]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.channel).toBe(channel);
      }
    }
  });

  it('should track licensed vs unlicensed status', async () => {
    // Licensed station
    const licensed = {
      stationId: 'KC3GHI',
      channel: 'emergency',
      signature: await signData('KC3GHI:emergency', keyPair.privateKey)
    };

    const response1 = await request(app)
      .post('/api/subscriptions')
      .send(licensed)
      .expect(201);

    expect(response1.body.licensed).toBe(true);

    // Unlicensed station
    const unlicensed = {
      stationId: 'UNLICENSED-002',
      channel: 'weather'
    };

    const response2 = await request(app)
      .post('/api/subscriptions')
      .send(unlicensed)
      .expect(201);

    expect(response2.body.licensed).toBe(false);
  });
});