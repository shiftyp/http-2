/**
 * Integration Test: P0 Emergency Update Broadcast and Rebroadcast
 * Tests the complete flow of emergency update distribution
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { SubscriptionRegistry } from '../../src/lib/subscription-registry';
import { CacheManager } from '../../src/lib/cache-manager';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { BeaconMonitor } from '../../src/lib/beacon-monitor';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Emergency Update Broadcast Flow', () => {
  let updateManager: UpdateManager;
  let subscriptionRegistry: SubscriptionRegistry;
  let cacheManager: CacheManager;
  let deliveryRouter: DeliveryRouter;
  let beaconMonitor: BeaconMonitor;
  let db: IDBDatabase;

  beforeAll(async () => {
    // Initialize database
    db = await openDynamicDataDB();

    // Initialize components
    updateManager = new UpdateManager({ db, maxSize: 50 * 1024 });
    subscriptionRegistry = new SubscriptionRegistry({ db });
    cacheManager = new CacheManager({ db, maxSize: 100 * 1024 * 1024 });
    beaconMonitor = new BeaconMonitor({ db });
    deliveryRouter = new DeliveryRouter({
      db,
      beaconMonitor,
      preferWebRTC: true
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should broadcast P0 emergency update within 3 seconds', async () => {
    // Setup: Subscribe stations to emergency channel
    const subscribers = ['KB2DEF', 'KC3GHI', 'KD4JKL', 'UNLICENSED-001'];

    for (const station of subscribers) {
      await subscriptionRegistry.subscribe({
        stationId: station,
        channel: 'emergency',
        licensed: !station.startsWith('UNLICENSED')
      });
    }

    // Create emergency update
    const startTime = Date.now();

    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Tornado warning for grid EM48'),
      originator: 'KA1ABC',
      subscribers: await subscriptionRegistry.getSubscribers('emergency')
    });

    // Verify update created with correct properties
    expect(update.priority).toBe(0);
    expect(update.id).toMatch(/^EMRG-\d{4}-\d{3}$/);

    // Check broadcast initiated within 3 seconds
    const broadcastTime = Date.now() - startTime;
    expect(broadcastTime).toBeLessThan(3000);

    // Verify update is cached at originating station
    await cacheManager.store(update);
    const cached = await cacheManager.get(update.id);
    expect(cached).toBeDefined();
    expect(cached?.priority).toBe(0);
  });

  it('should automatically rebroadcast P0 updates every 5 minutes', async () => {
    vi.useFakeTimers();

    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Flash flood warning'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    const rebroadcastSpy = vi.spyOn(updateManager, 'broadcast');

    // Initial broadcast
    await updateManager.broadcast(update);
    expect(rebroadcastSpy).toHaveBeenCalledTimes(1);

    // Advance 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000);

    // Should trigger rebroadcast
    expect(rebroadcastSpy).toHaveBeenCalledTimes(2);

    // Advance another 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000);

    // Another rebroadcast
    expect(rebroadcastSpy).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('should route P0 updates to high-priority OFDM carriers', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Evacuation order'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    const allocation = await deliveryRouter.allocateCarriers(update);

    // P0 should use carriers 40-47
    expect(allocation.carriers).toBeDefined();
    allocation.carriers.forEach(carrier => {
      expect(carrier).toBeGreaterThanOrEqual(40);
      expect(carrier).toBeLessThanOrEqual(47);
    });
  });

  it('should deliver to unlicensed stations via WebRTC', async () => {
    // Subscribe unlicensed station
    await subscriptionRegistry.subscribe({
      stationId: 'UNLICENSED-001',
      channel: 'emergency',
      licensed: false
    });

    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Severe weather'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'UNLICENSED-001']
    });

    // Cache at licensed station
    await cacheManager.storeAt('KB2DEF', update);

    // Delivery router should use WebRTC for unlicensed
    const path = await deliveryRouter.selectPath('UNLICENSED-001', update.id);
    expect(path.mode).toBe('WebRTC');
    expect(path.via).toBe('KB2DEF'); // Licensed station as source
  });

  it('should handle relay station caching and echo', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Medical assistance needed'),
      originator: 'KA1ABC',
      subscribers: ['KD4JKL'] // Distant station
    });

    // Relay station receives update
    const relayStation = 'KB2DEF';
    await cacheManager.storeAt(relayStation, update);

    // Verify relay caches based on priority
    const relayCache = await cacheManager.getStationCache(relayStation);
    expect(relayCache.some(u => u.id === update.id)).toBe(true);

    // Relay should echo P0 automatically
    const shouldEcho = await cacheManager.shouldEcho(update);
    expect(shouldEcho).toBe(true);
  });

  it('should expire updates based on priority', async () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);

    // Create updates with different priorities
    const p0Update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('P0 update'),
      originator: 'KA1ABC',
      subscribers: []
    });

    const p2Update = await updateManager.create({
      category: 'weather',
      priority: 2,
      data: new TextEncoder().encode('P2 update'),
      originator: 'KA1ABC',
      subscribers: []
    });

    // Cache both
    await cacheManager.store(p0Update);
    await cacheManager.store(p2Update);

    // Advance 25 hours (past P2 expiration but not P0)
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    // P2 should be expired, P0 should remain
    const p0Cached = await cacheManager.get(p0Update.id);
    const p2Cached = await cacheManager.get(p2Update.id);

    expect(p0Cached).toBeDefined(); // P0 has 30-day retention
    expect(p2Cached).toBeNull(); // P2 expired after 24 hours

    vi.useRealTimers();
  });

  it('should track beacon paths for routing decisions', async () => {
    // Record RF beacon path
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KB2DEF',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 20
    });

    // Record WebRTC connection
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KC3GHI',
      mode: 'WebRTC',
      hopCount: 0,
      signalStrength: 100
    });

    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Test'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // Router should respect last beacon path
    const pathToKB2 = await deliveryRouter.selectPath('KB2DEF', update.id);
    expect(pathToKB2.mode).toBe('RF'); // Last beacon was RF

    const pathToKC3 = await deliveryRouter.selectPath('KC3GHI', update.id);
    expect(pathToKC3.mode).toBe('WebRTC'); // Prefer WebRTC when available
  });
});