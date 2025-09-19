/**
 * Contract Test: Retry Status API
 * Endpoint: GET /api/retry/{id}
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('GET /api/retry/{id} - Retry Request Status', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let requestId: string;
  let updateId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create update
    const updateResponse = await request(app)
      .post('/api/updates')
      .send({
        category: 'emergency',
        priority: 0,
        data: Buffer.from('Test').toString('base64'),
        subscribers: ['KB2DEF'],
        originator: 'KA1ABC',
        signature: await signData('update', keyPair.privateKey)
      });
    updateId = updateResponse.body.id;

    // Create retry request
    const retryResponse = await request(app)
      .post('/api/retry')
      .send({
        updateId,
        version: 1,
        requester: 'KC3GHI',
        signature: await signData(`${updateId}:1:KC3GHI`, keyPair.privateKey)
      });
    requestId = retryResponse.body.requestId;
  });

  it('should return retry request status', async () => {
    const response = await request(app)
      .get(`/api/retry/${requestId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: requestId,
      updateId,
      version: 1,
      requester: 'KC3GHI',
      fulfilled: false
    });
  });

  it('should return 404 for non-existent request', async () => {
    await request(app)
      .get('/api/retry/invalid-uuid')
      .expect(404);
  });
});
