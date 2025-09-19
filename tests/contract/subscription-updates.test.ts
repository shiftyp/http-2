/**
 * Contract Test: Subscription Pending Updates API
 * Endpoint: GET /api/subscriptions/{id}/updates
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('GET /api/subscriptions/{id}/updates - Pending Updates', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let subscriptionId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create subscription
    const subResponse = await request(app)
      .post('/api/subscriptions')
      .send({
        stationId: 'KA1ABC',
        channel: 'emergency',
        signature: await signData('KA1ABC:emergency', keyPair.privateKey)
      });
    subscriptionId = subResponse.body.id;

    // Create matching updates
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/updates')
        .send({
          category: 'emergency',
          priority: i === 0 ? 0 : 1,
          data: Buffer.from(`Update ${i}`).toString('base64'),
          subscribers: ['KA1ABC'],
          originator: 'KB2DEF',
          signature: await signData(`update${i}`, keyPair.privateKey)
        });
    }
  });

  it('should return pending updates for subscription', async () => {
    const response = await request(app)
      .get(`/api/subscriptions/${subscriptionId}/updates`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(3);

    response.body.forEach((update: any) => {
      expect(update).toHaveProperty('updateId');
      expect(update).toHaveProperty('version');
      expect(update).toHaveProperty('priority');
      expect(update).toHaveProperty('size');
      expect(update).toHaveProperty('etag');
    });
  });

  it('should filter by time range', async () => {
    const since = new Date(Date.now() - 60000).toISOString();
    const response = await request(app)
      .get(`/api/subscriptions/${subscriptionId}/updates`)
      .query({ since })
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
  });
});
