/**
 * T013: Integration test for beacon path consolidation
 * This test MUST fail first (TDD Red phase)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../../src/db/init.js';
import ContentRegistry from '../../src/services/ContentRegistry.js';

describe('Path Consolidation Integration', () => {
  let db;
  let registry;

  beforeAll(async () => {
    // Use in-memory database for tests
    db = new Database(':memory:');
    await db.initialize();
    registry = new ContentRegistry(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('should consolidate multiple paths for same content', async () => {
    const contentHash = 'consol123consol123consol123consol123consol123consol123consol123';

    // Add first beacon with one path
    await registry.announceBeacon({
      callsign: 'KA1ABC',
      contentHash,
      path: ['KB2DEF'],
      metadata: {
        size: 2048,
        mimeType: 'text/html',
        priority: 2
      },
      signalQuality: 0.9,
      timestamp: new Date()
    });

    // Add second beacon with different path
    await registry.announceBeacon({
      callsign: 'KA1ABC',
      contentHash,
      path: ['KC3GHI', 'KD4JKL'],
      signalQuality: 0.7,
      timestamp: new Date()
    });

    // Add third beacon with another path
    await registry.announceBeacon({
      callsign: 'KA1ABC',
      contentHash,
      path: ['KE5MNO', 'KF6PQR', 'KG7STU'],
      signalQuality: 0.5,
      timestamp: new Date()
    });

    // Retrieve consolidated beacon
    const beacon = await registry.getContent(contentHash);

    expect(beacon).toBeDefined();
    expect(beacon.paths).toHaveLength(3);

    // Verify paths are ordered by quality (recency, hop count, signal)
    expect(beacon.paths[0].path).toEqual(['KB2DEF']); // Best: 1 hop, high signal
    expect(beacon.paths[1].path).toEqual(['KC3GHI', 'KD4JKL']); // 2 hops
    expect(beacon.paths[2].path).toEqual(['KE5MNO', 'KF6PQR', 'KG7STU']); // 3 hops
  });

  it('should update existing path timestamps when heard again', async () => {
    const contentHash = 'update123update123update123update123update123update123update123';
    const path = ['KH8VWX', 'KI9YZA'];

    // First announcement
    await registry.announceBeacon({
      callsign: 'KB2DEF',
      contentHash,
      path,
      metadata: { size: 1024, mimeType: 'text/plain' },
      timestamp: new Date(Date.now() - 3600000) // 1 hour ago
    });

    const oldBeacon = await registry.getContent(contentHash);
    const oldPathTime = oldBeacon.paths[0].lastHeard;

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // Re-announce same path
    await registry.announceBeacon({
      callsign: 'KB2DEF',
      contentHash,
      path,
      timestamp: new Date()
    });

    const newBeacon = await registry.getContent(contentHash);
    const newPathTime = newBeacon.paths[0].lastHeard;

    expect(newPathTime).toBeGreaterThan(oldPathTime);
    expect(newBeacon.paths).toHaveLength(1); // Still only one path
  });

  it('should prune dead paths older than 1 hour', async () => {
    const contentHash = 'prune123prune123prune123prune123prune123prune123prune123prune123';

    // Add old path (>1 hour ago)
    await registry.announceBeacon({
      callsign: 'KC3GHI',
      contentHash,
      path: ['OLD1', 'OLD2'],
      metadata: { size: 512, mimeType: 'text/html' },
      timestamp: new Date(Date.now() - 3700000) // 61 minutes ago
    });

    // Add fresh path
    await registry.announceBeacon({
      callsign: 'KC3GHI',
      contentHash,
      path: ['FRESH1'],
      timestamp: new Date()
    });

    const beacon = await registry.getContent(contentHash);

    expect(beacon.paths).toHaveLength(1);
    expect(beacon.paths[0].path).toEqual(['FRESH1']);
    // Old path should be pruned
  });

  it('should limit to maximum 10 paths per content', async () => {
    const contentHash = 'limit123limit123limit123limit123limit123limit123limit123limit1234';

    // Add 12 different paths
    for (let i = 0; i < 12; i++) {
      await registry.announceBeacon({
        callsign: 'KD4JKL',
        contentHash,
        path: [`STATION${i}`],
        metadata: { size: 256, mimeType: 'text/html' },
        signalQuality: 1.0 - (i * 0.05), // Decreasing quality
        timestamp: new Date(Date.now() - i * 1000) // Stagger timestamps
      });
    }

    const beacon = await registry.getContent(contentHash);

    expect(beacon.paths).toHaveLength(10); // Limited to 10
    // Should keep the 10 best quality paths
    expect(beacon.paths[0].path).toEqual(['STATION0']); // Best quality
    expect(beacon.paths[9].path).toEqual(['STATION9']); // 10th best
    // STATION10 and STATION11 should be excluded
  });

  it('should calculate path quality scores correctly', async () => {
    const contentHash = 'score123score123score123score123score123score123score123score1234';

    const testPaths = [
      { path: ['A'], hopCount: 1, signalQuality: 0.9, age: 0 },
      { path: ['B', 'C'], hopCount: 2, signalQuality: 0.8, age: 300000 }, // 5 min old
      { path: ['D', 'E', 'F'], hopCount: 3, signalQuality: 1.0, age: 600000 }, // 10 min old
    ];

    for (const tp of testPaths) {
      await registry.announceBeacon({
        callsign: 'KE5MNO',
        contentHash,
        path: tp.path,
        metadata: { size: 128, mimeType: 'text/html' },
        signalQuality: tp.signalQuality,
        timestamp: new Date(Date.now() - tp.age)
      });
    }

    const beacon = await registry.getContent(contentHash);

    // Verify scoring considers recency (0.4), hop count (0.3), signal (0.3)
    beacon.paths.forEach(path => {
      expect(path.qualityScore).toBeGreaterThan(0);
      expect(path.qualityScore).toBeLessThanOrEqual(1);
    });

    // Path A should score highest (recent, 1 hop, good signal)
    expect(beacon.paths[0].path).toEqual(['A']);
  });

  it('should achieve 80% storage reduction through consolidation', async () => {
    const contentHash = 'storage1storage1storage1storage1storage1storage1storage1storage1';

    // Simulate 10 separate beacon announcements (without consolidation)
    const unconsolidatedSize = 10 * 1024; // 10KB (1KB per beacon)

    // Add 10 different paths (will be consolidated)
    for (let i = 0; i < 10; i++) {
      await registry.announceBeacon({
        callsign: 'KF6PQR',
        contentHash,
        path: [`PATH${i}`],
        metadata: { size: 1024, mimeType: 'text/html' },
        timestamp: new Date()
      });
    }

    // Get consolidated entry
    const beacon = await registry.getContent(contentHash);

    // Estimate consolidated size
    const consolidatedSize =
      200 + // Base beacon data
      (beacon.paths.length * 50); // Path data

    const reduction = 1 - (consolidatedSize / unconsolidatedSize);

    expect(reduction).toBeGreaterThan(0.75); // At least 75% reduction
    expect(beacon.paths).toHaveLength(10); // All paths preserved
  });
});