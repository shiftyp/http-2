/**
 * Integration Test: Unlicensed Station Reception via WebRTC
 * Tests WebRTC-only data reception for unlicensed stations
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { SubscriptionManager } from '../../src/lib/subscription-manager';
import { WebRTCTransport } from '../../src/lib/webrtc-transport';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { CacheManager } from '../../src/lib/cache-manager';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Unlicensed Station Reception via WebRTC', () => {
  let updateManager: UpdateManager;
  let subscriptionManager: SubscriptionManager;
  let webrtcTransport: WebRTCTransport;
  let deliveryRouter: DeliveryRouter;
  let cacheManager: CacheManager;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    subscriptionManager = new SubscriptionManager({ db });
    cacheManager = new CacheManager({ db });
    webrtcTransport = new WebRTCTransport({
      signalingServer: 'ws://localhost:8080',
      enforceCallsignAuth: true
    });
    deliveryRouter = new DeliveryRouter({
      db,
      webrtcTransport,
      allowUnlicensedReception: true
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should allow unlicensed station to subscribe to emergency updates', async () => {
    // Unlicensed station creates subscription (no callsign)
    const subscription = await subscriptionManager.create({
      subscriber: 'UNLICENSED-001',
      categories: ['emergency', 'weather'],
      priorities: [0, 1, 2, 3],
      maxSize: 10240,
      callsign: null // Unlicensed
    });

    expect(subscription.id).toBeDefined();
    expect(subscription.subscriber).toBe('UNLICENSED-001');
    expect(subscription.transmitCapable).toBe(false);
  });

  it('should reject unlicensed station attempting to create updates', async () => {
    await expect(
      updateManager.create({
        category: 'emergency',
        priority: 0,
        data: new TextEncoder().encode('Unauthorized update'),
        originator: 'UNLICENSED-001', // No valid callsign
        subscribers: ['KB2DEF']
      })
    ).rejects.toThrow('unlicensed station cannot originate updates');
  });

  it('should route emergency updates to unlicensed stations via WebRTC', async () => {
    // Licensed station creates emergency update
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Evacuation order for Zone A'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'UNLICENSED-001', 'UNLICENSED-002']
    });

    // Licensed stations have update cached
    await cacheManager.storeAt('KA1ABC', update);
    await cacheManager.storeAt('KB2DEF', update);

    // WebRTC connections established
    await webrtcTransport.establishConnection('KA1ABC', 'UNLICENSED-001');
    await webrtcTransport.establishConnection('KB2DEF', 'UNLICENSED-002');

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Unlicensed stations should receive via WebRTC
    const unlicensed1 = routing.targets.find(t => t.station === 'UNLICENSED-001');
    expect(unlicensed1.mode).toBe('WebRTC');
    expect(unlicensed1.sourceStation).toBe('KA1ABC');
    expect(unlicensed1.canRetransmit).toBe(false);

    const unlicensed2 = routing.targets.find(t => t.station === 'UNLICENSED-002');
    expect(unlicensed2.mode).toBe('WebRTC');
    expect(unlicensed2.sourceStation).toBe('KB2DEF');
    expect(unlicensed2.canRetransmit).toBe(false);
  });

  it('should handle WebRTC relay through licensed intermediate stations', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Severe weather warning'),
      originator: 'KA1ABC',
      subscribers: ['UNLICENSED-REMOTE']
    });

    // Direct connection not available to unlicensed station
    // But relay path exists: KA1ABC -> KB2DEF -> UNLICENSED-REMOTE
    await cacheManager.storeAt('KA1ABC', update);
    await cacheManager.storeAt('KB2DEF', update);

    await webrtcTransport.establishConnection('KA1ABC', 'KB2DEF');
    await webrtcTransport.establishConnection('KB2DEF', 'UNLICENSED-REMOTE');

    const routing = await deliveryRouter.routeUpdate(update.id);
    const unlicensedTarget = routing.targets.find(t => t.station === 'UNLICENSED-REMOTE');

    expect(unlicensedTarget.mode).toBe('WebRTC');
    expect(unlicensedTarget.hops).toEqual(['KA1ABC', 'KB2DEF', 'UNLICENSED-REMOTE']);
    expect(unlicensedTarget.relayStation).toBe('KB2DEF');
  });

  it('should authenticate licensed stations in WebRTC connections', async () => {
    const update = await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new TextEncoder().encode('Safety bulletin'),
      originator: 'KA1ABC',
      subscribers: ['UNLICENSED-001']
    });

    // Valid licensed station connection
    const validConnection = await webrtcTransport.establishConnection(
      'KA1ABC',
      'UNLICENSED-001',
      { requireCallsignAuth: true }
    );
    expect(validConnection.authenticated).toBe(true);

    // Invalid/unlicensed attempting to pose as licensed
    await expect(
      webrtcTransport.establishConnection(
        'FAKE-CALLSIGN',
        'UNLICENSED-001',
        { requireCallsignAuth: true }
      )
    ).rejects.toThrow('invalid callsign authentication');
  });

  it('should handle unlicensed station subscription updates', async () => {
    // Create subscription for unlicensed station
    const subscription = await subscriptionManager.create({
      subscriber: 'UNLICENSED-001',
      categories: ['emergency', 'weather', 'safety'],
      priorities: [0, 1, 2, 3],
      maxSize: 5120,
      callsign: null
    });

    // Create multiple updates matching subscription
    const updates = [];
    for (let i = 0; i < 3; i++) {
      const update = await updateManager.create({
        category: i === 0 ? 'emergency' : i === 1 ? 'weather' : 'safety',
        priority: i,
        data: new TextEncoder().encode(`Update ${i}`),
        originator: 'KA1ABC',
        subscribers: []
      });
      updates.push(update);
    }

    // Check pending updates for unlicensed station
    const pending = await subscriptionManager.getPendingUpdates('UNLICENSED-001');
    expect(pending).toHaveLength(3);
    expect(pending.every(u => u.deliveryMode === 'WebRTC')).toBe(true);
  });

  it('should enforce size limits for unlicensed stations', async () => {
    // Small size limit subscription
    await subscriptionManager.create({
      subscriber: 'UNLICENSED-SMALL',
      categories: ['routine'],
      priorities: [4, 5],
      maxSize: 1024, // 1KB limit
      callsign: null
    });

    // Large update that exceeds limit
    const largeUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new Uint8Array(2048).fill(1), // 2KB
      originator: 'KA1ABC',
      subscribers: []
    });

    const routing = await deliveryRouter.routeUpdate(largeUpdate.id);
    const unlicensedTarget = routing.targets.find(t => t.station === 'UNLICENSED-SMALL');
    expect(unlicensedTarget).toBeUndefined(); // Filtered out

    // Small update within limit
    const smallUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new Uint8Array(512).fill(1), // 512 bytes
      originator: 'KA1ABC',
      subscribers: []
    });

    const smallRouting = await deliveryRouter.routeUpdate(smallUpdate.id);
    const smallTarget = smallRouting.targets.find(t => t.station === 'UNLICENSED-SMALL');
    expect(smallTarget).toBeDefined();
  });

  it('should handle WebRTC connection failures gracefully', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Connection test'),
      originator: 'KA1ABC',
      subscribers: ['UNLICENSED-001']
    });

    // Simulate WebRTC connection failure
    const connectionSpy = vi.spyOn(webrtcTransport, 'sendData');
    connectionSpy.mockRejectedValue(new Error('WebRTC connection lost'));

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Should mark delivery as failed but not attempt RF fallback
    expect(routing.targets[0].status).toBe('failed');
    expect(routing.targets[0].failureReason).toContain('WebRTC');
    expect(routing.targets[0].fallbackMode).toBeUndefined(); // No RF fallback for unlicensed
  });

  it('should track unlicensed station activity for statistics', async () => {
    // Generate some activity
    for (let i = 0; i < 5; i++) {
      const update = await updateManager.create({
        category: 'weather',
        priority: 3,
        data: new TextEncoder().encode(`Weather ${i}`),
        originator: 'KA1ABC',
        subscribers: [`UNLICENSED-${i}`]
      });

      await webrtcTransport.establishConnection('KA1ABC', `UNLICENSED-${i}`);
      await deliveryRouter.routeUpdate(update.id);
    }

    const stats = await deliveryRouter.getUnlicensedStationStats();
    expect(stats).toMatchObject({
      totalUnlicensedStations: expect.any(Number),
      activeConnections: expect.any(Number),
      dataDelivered: expect.any(Number),
      avgConnectionTime: expect.any(Number),
      deliverySuccessRate: expect.any(Number)
    });

    expect(stats.totalUnlicensedStations).toBe(5);
    expect(stats.activeConnections).toBeGreaterThan(0);
  });

  it('should handle mixed licensed/unlicensed subscriber lists', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Mixed subscriber test'),
      originator: 'KA1ABC',
      subscribers: [
        'KB2DEF',        // Licensed - can use RF or WebRTC
        'KC3GHI',        // Licensed - can use RF or WebRTC
        'UNLICENSED-001', // Unlicensed - WebRTC only
        'UNLICENSED-002'  // Unlicensed - WebRTC only
      ]
    });

    // Set up various connection types
    await webrtcTransport.establishConnection('KA1ABC', 'KB2DEF');
    await webrtcTransport.establishConnection('KA1ABC', 'UNLICENSED-001');
    await webrtcTransport.establishConnection('KB2DEF', 'UNLICENSED-002');

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Licensed stations can use WebRTC or RF
    const licensed1 = routing.targets.find(t => t.station === 'KB2DEF');
    expect(['WebRTC', 'RF']).toContain(licensed1.mode);

    const licensed2 = routing.targets.find(t => t.station === 'KC3GHI');
    expect(['WebRTC', 'RF']).toContain(licensed2.mode);

    // Unlicensed stations must use WebRTC
    const unlicensed1 = routing.targets.find(t => t.station === 'UNLICENSED-001');
    expect(unlicensed1.mode).toBe('WebRTC');

    const unlicensed2 = routing.targets.find(t => t.station === 'UNLICENSED-002');
    expect(unlicensed2.mode).toBe('WebRTC');
  });
});