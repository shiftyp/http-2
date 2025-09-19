/**
 * Integration Test: Multi-Station Delivery Coordination
 * Tests coordinated delivery across multiple stations with mesh routing
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { MeshRouter } from '../../src/lib/mesh-router';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { CacheManager } from '../../src/lib/cache-manager';
import { BeaconMonitor } from '../../src/lib/beacon-monitor';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Multi-Station Delivery Coordination', () => {
  let updateManager: UpdateManager;
  let meshRouter: MeshRouter;
  let deliveryRouter: DeliveryRouter;
  let cacheManager: CacheManager;
  let beaconMonitor: BeaconMonitor;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    meshRouter = new MeshRouter({ db, callsign: 'KA1ABC' });
    beaconMonitor = new BeaconMonitor({ db });
    cacheManager = new CacheManager({ db });
    deliveryRouter = new DeliveryRouter({
      db,
      meshRouter,
      beaconMonitor,
      cacheManager
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should coordinate delivery across mesh network topology', async () => {
    // Create mesh topology: KA1ABC -> KB2DEF -> KC3GHI -> KD4JKL
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KB2DEF',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 20,
      lastHeard: Date.now()
    });

    await beaconMonitor.recordPath({
      originStation: 'KB2DEF',
      targetStation: 'KC3GHI',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 15,
      lastHeard: Date.now()
    });

    await beaconMonitor.recordPath({
      originStation: 'KC3GHI',
      targetStation: 'KD4JKL',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 18,
      lastHeard: Date.now()
    });

    // Create update for distant station
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency: Multi-hop required'),
      originator: 'KA1ABC',
      subscribers: ['KD4JKL']
    });

    // Route should find 3-hop path
    const routing = await deliveryRouter.routeUpdate(update.id);
    expect(routing.targets[0].hops).toEqual(['KA1ABC', 'KB2DEF', 'KC3GHI', 'KD4JKL']);
    expect(routing.targets[0].hopCount).toBe(3);
  });

  it('should handle store-and-forward with intermediate caching', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Regional weather update'),
      originator: 'KA1ABC',
      subscribers: ['KC3GHI', 'KD4JKL', 'KE5MNO']
    });

    // Simulate KB2DEF receiving and caching the update
    await cacheManager.storeAt('KB2DEF', update);

    // KB2DEF becomes a relay point for other stations
    await beaconMonitor.recordPath({
      originStation: 'KB2DEF',
      targetStation: 'KC3GHI',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 22
    });

    await beaconMonitor.recordPath({
      originStation: 'KB2DEF',
      targetStation: 'KD4JKL',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 19
    });

    // Route from cached location
    const routing = await deliveryRouter.findBestSource(update.id, 'KC3GHI');
    expect(routing.sourceStation).toBe('KB2DEF'); // Should use cached copy
    expect(routing.hopCount).toBe(1); // Direct from cache
  });

  it('should coordinate simultaneous delivery to multiple subscribers', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Evacuation notice for grid square EM48'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL', 'KE5MNO', 'KF6PQR']
    });

    // Set up various paths to subscribers
    const paths = [
      { target: 'KB2DEF', mode: 'RF', hops: 1, signal: 25 },
      { target: 'KC3GHI', mode: 'WebRTC', hops: 1, signal: 30 },
      { target: 'KD4JKL', mode: 'RF', hops: 2, signal: 15 },
      { target: 'KE5MNO', mode: 'WebRTC', hops: 1, signal: 28 },
      { target: 'KF6PQR', mode: 'RF', hops: 3, signal: 12 }
    ];

    for (const path of paths) {
      await beaconMonitor.recordPath({
        originStation: 'KA1ABC',
        targetStation: path.target,
        mode: path.mode,
        hopCount: path.hops,
        signalStrength: path.signal,
        lastHeard: Date.now()
      });
    }

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Should have routes to all 5 subscribers
    expect(routing.targets).toHaveLength(5);

    // Should prefer direct routes when available
    const directTargets = routing.targets.filter(t => t.hopCount === 1);
    expect(directTargets).toHaveLength(3); // KB2DEF, KC3GHI, KE5MNO

    // Should coordinate timing to avoid collisions
    const transmitTimes = routing.targets.map(t => t.scheduledTime);
    const uniqueTimes = new Set(transmitTimes);
    expect(uniqueTimes.size).toBeGreaterThan(1); // Staggered transmission
  });

  it('should handle partial delivery failure and retry coordination', async () => {
    const update = await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new TextEncoder().encode('Safety bulletin'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL']
    });

    // Simulate successful delivery to KB2DEF only
    await deliveryRouter.markDeliveryComplete(update.id, 'KB2DEF', true);
    await deliveryRouter.markDeliveryComplete(update.id, 'KC3GHI', false);
    await deliveryRouter.markDeliveryComplete(update.id, 'KD4JKL', false);

    // Check delivery status
    const status = await deliveryRouter.getDeliveryStatus(update.id);
    expect(status.successful).toEqual(['KB2DEF']);
    expect(status.failed).toEqual(['KC3GHI', 'KD4JKL']);
    expect(status.pending).toEqual([]);

    // Retry failed deliveries
    const retryRouting = await deliveryRouter.retryFailedDeliveries(update.id);
    expect(retryRouting.targets).toHaveLength(2);
    expect(retryRouting.targets.map(t => t.station)).toEqual(['KC3GHI', 'KD4JKL']);
  });

  it('should handle mesh network partitioning and healing', async () => {
    vi.useFakeTimers();

    const update = await updateManager.create({
      category: 'routine',
      priority: 4,
      data: new TextEncoder().encode('Network test'),
      originator: 'KA1ABC',
      subscribers: ['KD4JKL']
    });

    // Initial path: KA1ABC -> KB2DEF -> KC3GHI -> KD4JKL
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KB2DEF',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 20
    });

    await beaconMonitor.recordPath({
      originStation: 'KB2DEF',
      targetStation: 'KC3GHI',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 15
    });

    await beaconMonitor.recordPath({
      originStation: 'KC3GHI',
      targetStation: 'KD4JKL',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 18
    });

    let routing = await deliveryRouter.routeUpdate(update.id);
    expect(routing.targets[0].hopCount).toBe(3);

    // Simulate link failure (KC3GHI goes offline)
    vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

    // New direct path discovered: KA1ABC -> KD4JKL
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KD4JKL',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 12,
      lastHeard: Date.now()
    });

    // Should use new direct path
    routing = await deliveryRouter.routeUpdate(update.id);
    expect(routing.targets[0].hopCount).toBe(1);
    expect(routing.targets[0].hops).toEqual(['KA1ABC', 'KD4JKL']);

    vi.useRealTimers();
  });

  it('should balance load across multiple relay stations', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Weather distribution test'),
      originator: 'KA1ABC',
      subscribers: ['KG7STU', 'KH8VWX', 'KI9YZA', 'KJ0BCD']
    });

    // Multiple relay paths available
    const relays = ['KB2DEF', 'KC3GHI', 'KD4JKL'];
    const targets = ['KG7STU', 'KH8VWX', 'KI9YZA', 'KJ0BCD'];

    // Each relay can reach different targets
    for (const relay of relays) {
      await beaconMonitor.recordPath({
        originStation: 'KA1ABC',
        targetStation: relay,
        mode: 'RF',
        hopCount: 1,
        signalStrength: 20
      });

      for (const target of targets) {
        await beaconMonitor.recordPath({
          originStation: relay,
          targetStation: target,
          mode: 'RF',
          hopCount: 1,
          signalStrength: 18
        });
      }
    }

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Should distribute load across relays
    const relayUsage = {};
    routing.targets.forEach(target => {
      const relay = target.hops[1]; // Second hop is the relay
      relayUsage[relay] = (relayUsage[relay] || 0) + 1;
    });

    // Load should be distributed (no single relay handling all)
    const maxLoad = Math.max(...Object.values(relayUsage));
    expect(maxLoad).toBeLessThan(targets.length); // Not all targets via one relay
  });

  it('should provide mesh network statistics and health metrics', async () => {
    // Create some traffic across the mesh
    for (let i = 0; i < 10; i++) {
      const update = await updateManager.create({
        category: 'routine',
        priority: 5,
        data: new TextEncoder().encode(`Test ${i}`),
        originator: 'KA1ABC',
        subscribers: [`K${i}TEST`]
      });
      await deliveryRouter.routeUpdate(update.id);
    }

    const meshStats = await deliveryRouter.getMeshStatistics();
    expect(meshStats).toMatchObject({
      activeNodes: expect.any(Number),
      totalPaths: expect.any(Number),
      avgHopCount: expect.any(Number),
      networkPartitions: expect.any(Number),
      deliverySuccessRate: expect.any(Number),
      avgDeliveryLatency: expect.any(Number),
      pathQualityDistribution: expect.any(Object)
    });

    expect(meshStats.activeNodes).toBeGreaterThan(0);
    expect(meshStats.deliverySuccessRate).toBeGreaterThanOrEqual(0);
    expect(meshStats.deliverySuccessRate).toBeLessThanOrEqual(1);
  });
});