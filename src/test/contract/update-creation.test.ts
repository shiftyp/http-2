/**
 * Contract Test: Update Creation API
 * Endpoint: POST /api/updates
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../signaling-server/src/app';
import { generateECDSAKeyPair, signData } from '../../src/lib/crypto';

describe('POST /api/updates - Create Dynamic Update', () => {
  let app: any;
  let keyPair: CryptoKeyPair;

  beforeAll(async () => {
    app = await createApp(':memory:');
    keyPair = await generateECDSAKeyPair();
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should create P0 emergency update with valid signature', async () => {
    const updateData = {
      category: 'emergency',
      priority: 0,
      data: Buffer.from('John Smith found at City Hospital').toString('base64'),
      contentType: 'text/plain',
      compression: 'none',
      subscribers: ['KB2DEF', 'KC3GHI', 'UNLICENSED-001'],
      originator: 'KA1ABC',
      signature: ''
    };

    // Sign the update
    const dataToSign = JSON.stringify({
      category: updateData.category,
      priority: updateData.priority,
      data: updateData.data,
      originator: updateData.originator
    });
    updateData.signature = await signData(dataToSign, keyPair.privateKey);

    const response = await request(app)
      .post('/api/updates')
      .send(updateData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.stringMatching(/^EMRG-\d{4}-\d{3}$/),
      version: 1,
      etag: expect.any(String),
      expires: expect.any(String)
    });

    // Verify expiration is 30 days for P0
    const expires = new Date(response.body.expires);
    const now = new Date();
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('should reject update without valid signature', async () => {
    const updateData = {
      category: 'weather',
      priority: 3,
      data: Buffer.from('Weather alert').toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: 'invalid-signature'
    };

    await request(app)
      .post('/api/updates')
      .send(updateData)
      .expect(401)
      .expect(res => {
        expect(res.body.error).toContain('Invalid signature');
      });
  });

  it('should reject update from unlicensed station', async () => {
    const updateData = {
      category: 'routine',
      priority: 5,
      data: Buffer.from('Test message').toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'UNLICENSED-001',
      signature: 'some-signature'
    };

    await request(app)
      .post('/api/updates')
      .send(updateData)
      .expect(401)
      .expect(res => {
        expect(res.body.error).toContain('unlicensed station');
      });
  });

  it('should reject update exceeding size limit', async () => {
    const largeData = Buffer.alloc(51 * 1024).fill('A'); // 51KB
    const updateData = {
      category: 'routine',
      priority: 5,
      data: largeData.toString('base64'),
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: 'valid-signature'
    };

    await request(app)
      .post('/api/updates')
      .send(updateData)
      .expect(413)
      .expect(res => {
        expect(res.body.error).toContain('size exceeds limit');
      });
  });

  it('should handle multiple priority levels correctly', async () => {
    const priorities = [
      { p: 0, expDays: 30 },
      { p: 1, expDays: 7 },
      { p: 2, expDays: 1 },
      { p: 3, expDays: 1/24 },
    ];

    for (const { p, expDays } of priorities) {
      const updateData = {
        category: p === 0 ? 'emergency' : 'routine',
        priority: p,
        data: Buffer.from(`Priority ${p} update`).toString('base64'),
        subscribers: ['KB2DEF'],
        originator: 'KA1ABC',
        signature: await signData(`p${p}`, keyPair.privateKey)
      };

      const response = await request(app)
        .post('/api/updates')
        .send(updateData)
        .expect(201);

      const expires = new Date(response.body.expires);
      const now = new Date();
      const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(expDays, 0);
    }
  });

  it('should apply compression when specified', async () => {
    const updateData = {
      category: 'weather',
      priority: 3,
      data: Buffer.from('This is a test message for compression').toString('base64'),
      compression: 'lz77',
      subscribers: ['KB2DEF'],
      originator: 'KA1ABC',
      signature: await signData('compressed', keyPair.privateKey)
    };

    const response = await request(app)
      .post('/api/updates')
      .send(updateData)
      .expect(201);

    expect(response.body.id).toBeDefined();
    // Verify the update was stored with compression metadata
  });

  it('should validate callsign format', async () => {
    const invalidCallsigns = ['123ABC', 'TOOLONGCALLSIGN', 'abc', ''];

    for (const callsign of invalidCallsigns) {
      const updateData = {
        category: 'routine',
        priority: 5,
        data: Buffer.from('Test').toString('base64'),
        subscribers: ['KB2DEF'],
        originator: callsign,
        signature: 'signature'
      };

      await request(app)
        .post('/api/updates')
        .send(updateData)
        .expect(400)
        .expect(res => {
          expect(res.body.error).toContain('Invalid');
        });
    }
  });

  it('should generate unique IDs for emergency updates', async () => {
    const ids = new Set();

    for (let i = 0; i < 5; i++) {
      const updateData = {
        category: 'emergency',
        priority: 0,
        data: Buffer.from(`Emergency ${i}`).toString('base64'),
        subscribers: ['KB2DEF'],
        originator: 'KA1ABC',
        signature: await signData(`emrg${i}`, keyPair.privateKey)
      };

      const response = await request(app)
        .post('/api/updates')
        .send(updateData)
        .expect(201);

      expect(ids.has(response.body.id)).toBe(false);
      ids.add(response.body.id);
    }
  });
});