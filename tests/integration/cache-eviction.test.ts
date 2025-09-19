/**
 * Integration Test: Cache Eviction with Priority Rules
 * Tests cache management under storage pressure
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { CacheManager } from '../../src/lib/cache-manager';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Cache Eviction with Priority Rules', () => {
  let updateManager: UpdateManager;
  let cacheManager: CacheManager;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    // Small cache for testing eviction
    cacheManager = new CacheManager({
      db,
      maxSize: 200 * 1024, // 200KB
      evictionPolicy: 'priority-lru'
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should evict lowest priority updates first when cache is full', async () => {
    // Fill cache with various priority updates
    const updates = [];

    // P0 Emergency - 50KB
    updates.push(await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new Uint8Array(50 * 1024).fill(1),
      originator: 'KA1ABC',
      subscribers: []
    }));

    // P1 Safety - 50KB
    updates.push(await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new Uint8Array(50 * 1024).fill(2),
      originator: 'KA1ABC',
      subscribers: []
    }));

    // P3 Weather - 50KB
    updates.push(await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new Uint8Array(50 * 1024).fill(3),
      originator: 'KA1ABC',
      subscribers: []
    }));

    // P5 Routine - 50KB
    updates.push(await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new Uint8Array(50 * 1024).fill(4),
      originator: 'KA1ABC',
      subscribers: []
    }));

    // Store all (total 200KB, at capacity)
    for (const update of updates) {
      await cacheManager.store(update);
    }

    // Try to add new P2 update (50KB) - should trigger eviction
    const newUpdate = await updateManager.create({
      category: 'operational',
      priority: 2,
      data: new Uint8Array(50 * 1024).fill(5),
      originator: 'KA1ABC',
      subscribers: []
    });

    await cacheManager.store(newUpdate);

    // P5 should be evicted (lowest priority)
    const p5Cached = await cacheManager.get(updates[3].id);
    expect(p5Cached).toBeNull();

    // P0, P1, P2 should remain
    const p0Cached = await cacheManager.get(updates[0].id);
    expect(p0Cached).toBeDefined();

    const p1Cached = await cacheManager.get(updates[1].id);
    expect(p1Cached).toBeDefined();

    const p2Cached = await cacheManager.get(newUpdate.id);
    expect(p2Cached).toBeDefined();
  });

  it('should evict by LRU within same priority', async () => {
    // Clear cache
    await cacheManager.clear();

    // Create multiple P3 updates
    const p3Updates = [];
    for (let i = 0; i < 4; i++) {
      const update = await updateManager.create({
        category: 'weather',
        priority: 3,
        data: new Uint8Array(50 * 1024).fill(i),
        originator: 'KA1ABC',
        subscribers: []
      });
      p3Updates.push(update);
      await cacheManager.store(update);
    }

    // Access first and third updates (make them recently used)
    await cacheManager.get(p3Updates[0].id);
    await cacheManager.get(p3Updates[2].id);

    // Add new update to trigger eviction
    const newUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new Uint8Array(50 * 1024).fill(99),
      originator: 'KA1ABC',
      subscribers: []
    });
    await cacheManager.store(newUpdate);

    // Second update should be evicted (least recently used)
    const cached1 = await cacheManager.get(p3Updates[1].id);
    expect(cached1).toBeNull();

    // Others should remain
    const cached0 = await cacheManager.get(p3Updates[0].id);
    expect(cached0).toBeDefined();

    const cached2 = await cacheManager.get(p3Updates[2].id);
    expect(cached2).toBeDefined();
  });

  it('should never evict P0/P1 unless expired', async () => {
    vi.useFakeTimers();
    await cacheManager.clear();

    // Create P0 emergency update
    const p0Update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new Uint8Array(100 * 1024).fill(1),
      originator: 'KA1ABC',
      subscribers: []
    });
    await cacheManager.store(p0Update);

    // Try to fill cache with lower priority updates
    for (let i = 0; i < 10; i++) {
      const update = await updateManager.create({
        category: 'routine',
        priority: 5,
        data: new Uint8Array(20 * 1024).fill(i),
        originator: 'KA1ABC',
        subscribers: []
      });
      await cacheManager.store(update);
    }

    // P0 should still be cached
    let cached = await cacheManager.get(p0Update.id);
    expect(cached).toBeDefined();

    // Advance time past P0 expiration (30 days)
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

    // Now P0 can be evicted
    await cacheManager.runEviction();
    cached = await cacheManager.get(p0Update.id);
    expect(cached).toBeNull();

    vi.useRealTimers();
  });

  it('should handle expiration by priority tier', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    await cacheManager.clear();

    // Create updates with different priorities
    const updates = [
      { priority: 0, expHours: 30 * 24 },  // 30 days
      { priority: 1, expHours: 7 * 24 },   // 7 days
      { priority: 2, expHours: 24 },       // 24 hours
      { priority: 3, expHours: 1 },        // 1 hour
      { priority: 5, expHours: 1 }         // 1 hour
    ];

    const created = [];
    for (const { priority, expHours } of updates) {
      const update = await updateManager.create({
        category: priority === 0 ? 'emergency' : 'routine',
        priority,
        data: new TextEncoder().encode(`P${priority} update`),
        originator: 'KA1ABC',
        subscribers: []
      });
      await cacheManager.store(update);
      created.push({ update, expHours });
    }

    // Advance 2 hours
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    await cacheManager.runEviction();

    // P3 and P5 should be expired
    expect(await cacheManager.get(created[3].update.id)).toBeNull();
    expect(await cacheManager.get(created[4].update.id)).toBeNull();

    // Others should remain
    expect(await cacheManager.get(created[0].update.id)).toBeDefined();
    expect(await cacheManager.get(created[1].update.id)).toBeDefined();
    expect(await cacheManager.get(created[2].update.id)).toBeDefined();

    vi.useRealTimers();
  });

  it('should provide cache statistics', async () => {
    await cacheManager.clear();

    // Add various updates
    const updates = [];
    for (let priority of [0, 1, 3, 5]) {
      const update = await updateManager.create({
        category: priority === 0 ? 'emergency' : 'routine',
        priority,
        data: new Uint8Array(25 * 1024).fill(priority),
        originator: 'KA1ABC',
        subscribers: []
      });
      updates.push(update);
      await cacheManager.store(update);
    }

    const stats = await cacheManager.getStatistics();
    expect(stats).toMatchObject({
      totalSize: 100 * 1024, // 4 * 25KB
      usedSize: 100 * 1024,
      freeSpace: 100 * 1024, // 200KB - 100KB
      updateCount: 4,
      priorityBreakdown: {
        0: 1,
        1: 1,
        3: 1,
        5: 1
      },
      evictionCount: 0
    });
  });

  it('should evict efficiently under pressure', async () => {
    await cacheManager.clear();

    // Rapidly add many updates
    const startTime = Date.now();

    for (let i = 0; i < 50; i++) {
      const update = await updateManager.create({
        category: 'routine',
        priority: Math.floor(Math.random() * 6),
        data: new Uint8Array(10 * 1024).fill(i),
        originator: 'KA1ABC',
        subscribers: []
      });
      await cacheManager.store(update);
    }

    const duration = Date.now() - startTime;

    // Should handle rapid additions efficiently
    expect(duration).toBeLessThan(5000); // Under 5 seconds

    // Cache should not exceed limit
    const stats = await cacheManager.getStatistics();
    expect(stats.usedSize).toBeLessThanOrEqual(200 * 1024);

    // Should have evicted many updates
    expect(stats.evictionCount).toBeGreaterThan(0);
  });
});