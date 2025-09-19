/**
 * Contract Test: Retry Coordination Window
 * Tests coordination timing to prevent collisions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('Retry Coordination Window Timing', () => {
  let app: any;
  let keyPair: CryptoKeyPair;
  let updateId: string;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();

    const updateResponse = await request(app)
      .post('/api/updates')
      .send({
        category: 'emergency',
        priority: 0,
        data: Buffer.from('Coordination test').toString('base64'),
        subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL'],
        originator: 'KA1ABC',
        signature: await signData('update', keyPair.privateKey)
      });
    updateId = updateResponse.body.id;
  });

  it('should assign different coordination windows to prevent collisions', async () => {
    const requests = [];

    // Multiple stations request same update
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/api/retry')
        .send({
          updateId,
          version: 1,
          requester: `K${i}XYZ`,
          signature: await signData(`retry${i}`, keyPair.privateKey)
        });
      requests.push(response.body);
    }

    // All should have coordination windows
    requests.forEach(req => {
      expect(req.coordinationWindow).toBeGreaterThanOrEqual(10);
      expect(req.coordinationWindow).toBeLessThanOrEqual(30);
    });

    // Windows should be spread out
    const windows = requests.map(r => r.coordinationWindow);
    const uniqueWindows = new Set(windows);
    expect(uniqueWindows.size).toBeGreaterThan(2); // At least 3 different windows
  });

  it('should respect 10-30 second window range', async () => {
    const responses = [];

    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/api/retry')
        .send({
          updateId,
          version: 1,
          requester: `KE${i}MNO`,
          signature: await signData(`window${i}`, keyPair.privateKey)
        });
      responses.push(response.body.coordinationWindow);
    }

    // All windows must be within range
    responses.forEach(window => {
      expect(window).toBeGreaterThanOrEqual(10);
      expect(window).toBeLessThanOrEqual(30);
    });

    // Should use random backoff
    const hasVariation = new Set(responses).size > responses.length / 2;
    expect(hasVariation).toBe(true);
  });
});
