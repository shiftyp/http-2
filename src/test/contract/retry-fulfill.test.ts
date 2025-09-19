/**
 * Contract Test: Retry Fulfillment API
 * Endpoint: POST /api/retry/{id}/fulfill
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('POST /api/retry/{id}/fulfill - Mark Retry Fulfilled', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let requestId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    // Create update and retry request
    const updateResponse = await request(app)
      .post('/api/updates')
      .send({
        category: 'weather',
        priority: 3,
        data: Buffer.from('Weather').toString('base64'),
        subscribers: ['KB2DEF'],
        originator: 'KA1ABC',
        signature: await signData('update', keyPair.privateKey)
      });

    const retryResponse = await request(app)
      .post('/api/retry')
      .send({
        updateId: updateResponse.body.id,
        version: 1,
        requester: 'KD4JKL',
        signature: await signData('retry', keyPair.privateKey)
      });
    requestId = retryResponse.body.requestId;
  });

  it('should mark retry as fulfilled', async () => {
    await request(app)
      .post(`/api/retry/${requestId}/fulfill`)
      .send({
        fulfiller: 'KB2DEF',
        mode: 'RF',
        signature: await signData(`fulfill:${requestId}`, keyPair.privateKey)
      })
      .expect(200);

    // Verify fulfilled status
    const status = await request(app)
      .get(`/api/retry/${requestId}`);
    
    expect(status.body.fulfilled).toBe(true);
    expect(status.body.fulfiller).toBe('KB2DEF');
    expect(status.body.mode).toBe('RF');
  });

  it('should reject duplicate fulfillment', async () => {
    await request(app)
      .post(`/api/retry/${requestId}/fulfill`)
      .send({
        fulfiller: 'KC3GHI',
        mode: 'WebRTC',
        signature: await signData('duplicate', keyPair.privateKey)
      })
      .expect(409);
  });
});
