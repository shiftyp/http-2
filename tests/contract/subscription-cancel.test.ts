/**
 * Contract Test: Subscription Cancellation API
 * Endpoint: DELETE /api/subscriptions/{id}
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('DELETE /api/subscriptions/{id} - Cancel Subscription', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let subscriptionId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    const subData = {
      stationId: 'KA1ABC',
      channel: 'emergency',
      signature: await signData('KA1ABC:emergency', keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/subscriptions')
      .send(subData);
    subscriptionId = response.body.id;
  });

  it('should cancel subscription with valid signature', async () => {
    await request(app)
      .delete(`/api/subscriptions/${subscriptionId}`)
      .send({ 
        signature: await signData(`cancel:${subscriptionId}`, keyPair.privateKey) 
      })
      .expect(204);

    // Verify cancelled
    await request(app)
      .get(`/api/subscriptions/${subscriptionId}`)
      .expect(404);
  });

  it('should reject cancellation without signature', async () => {
    const subData = {
      stationId: 'KB2DEF',
      channel: 'weather',
      signature: await signData('KB2DEF:weather', keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/subscriptions')
      .send(subData);

    await request(app)
      .delete(`/api/subscriptions/${response.body.id}`)
      .expect(401);
  });
});
