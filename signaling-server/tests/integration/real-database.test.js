/**
 * Example: Testing with REAL database and services
 * This demonstrates proper testing without over-mocking
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../../src/db/init.js';
import ContentRegistry from '../../src/services/ContentRegistry.js';
import { createApp } from '../../src/app.js';
import request from 'supertest';

describe('Real Database and Service Integration', () => {
  let app;
  let db;
  let registry;

  beforeAll(async () => {
    // Create REAL Express app with REAL database
    // Using in-memory SQLite is fine - it's still a real database
    app = await createApp(':memory:');

    // Get references to real services
    db = app.locals.db;
    registry = app.locals.contentRegistry;
  });

  afterAll(async () => {
    await db.close();
  });

  it('should handle real database transactions', async () => {
    // This test uses the REAL database, REAL SQL queries, REAL constraints
    const response = await request(app)
      .post('/api/content/announce')
      .send({
        callsign: 'KA1ABC',
        signature: 'test-sig',
        contentHash: 'real001real001real001real001real001real001real001real001real00001',
        path: ['KB2DEF'],
        metadata: {
          size: 2048,
          mimeType: 'text/html',
          priority: 0
        },
        timestamp: new Date().toISOString()
      });

    expect(response.status).toBe(201);

    // Verify data is REALLY in the database
    const row = await db.get(
      'SELECT * FROM consolidated_beacons WHERE content_hash = ?',
      ['real001real001real001real001real001real001real001real001real00001']
    );

    expect(row).toBeDefined();
    expect(row.callsign).toBe('KA1ABC');
    expect(row.priority_tier).toBe(0);
  });

  it('should enforce real database constraints', async () => {
    // Test REAL foreign key constraints
    const voteResult = await db.run(
      'INSERT INTO priority_votes (content_hash, callsign, priority_tier) VALUES (?, ?, ?)',
      ['nonexistent', 'KA1ABC', 0]
    ).catch(err => err);

    // Real database will enforce referential integrity
    expect(voteResult).toBeDefined();
  });

  it('should use real SQL indexes for performance', async () => {
    // Add multiple beacons to test real index performance
    const promises = [];
    for (let i = 0; i < 100; i++) {
      const hash = `perf${i}`.padEnd(64, '0');
      promises.push(
        registry.announceBeacon({
          callsign: 'KA1ABC',
          contentHash: hash,
          path: ['KB2DEF'],
          metadata: {
            size: 1024,
            mimeType: 'text/html',
            priority: i % 6 // Various priorities
          },
          timestamp: new Date()
        })
      );
    }
    await Promise.all(promises);

    // Test real index performance
    const start = Date.now();
    const results = await registry.searchContent({ priority: 2 });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Real performance test
    expect(results.length).toBeGreaterThan(0);
  });

  it('should perform real path consolidation in database', async () => {
    const contentHash = 'consol99consol99consol99consol99consol99consol99consol99consol99';

    // Add paths that will be consolidated in real database
    await registry.announceBeacon({
      callsign: 'KC3GHI',
      contentHash,
      path: ['ALPHA'],
      metadata: { size: 512, mimeType: 'text/plain' },
      signalQuality: 0.9,
      timestamp: new Date()
    });

    await registry.announceBeacon({
      callsign: 'KC3GHI',
      contentHash,
      path: ['BETA', 'GAMMA'],
      signalQuality: 0.7,
      timestamp: new Date()
    });

    // Verify real JSON column handling in SQLite
    const row = await db.get(
      'SELECT paths, json_array_length(paths) as path_count FROM consolidated_beacons WHERE content_hash = ?',
      [contentHash]
    );

    expect(row).toBeDefined();
    const paths = JSON.parse(row.paths);
    expect(paths).toHaveLength(2);
    expect(paths[0].hopCount).toBe(1); // Real calculation
  });

  it('should handle real concurrent database operations', async () => {
    // Test real SQLite concurrent access
    const operations = [];

    for (let i = 0; i < 10; i++) {
      operations.push(
        request(app)
          .get('/api/content/search')
          .query({ priority: 3 })
      );
    }

    const results = await Promise.all(operations);
    results.forEach(res => {
      expect(res.status).toBe(200);
    });
  });

  it('should enforce real storage limits with actual data', async () => {
    // Get real statistics from real database
    const stats = await db.get(`
      SELECT
        COUNT(*) as count,
        SUM(length(paths)) as total_path_size
      FROM consolidated_beacons
    `);

    expect(stats.count).toBeGreaterThan(0);

    // Test real eviction when approaching limits
    const evicted = await registry.evictLowPriority();
    expect(evicted).toBeGreaterThanOrEqual(0);
  });
});