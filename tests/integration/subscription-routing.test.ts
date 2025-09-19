/**
 * Integration Test: Subscription Routing with OFDM Priority
 * Tests priority-based carrier allocation and WebRTC distribution
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { SubscriptionManager } from '../../src/lib/subscription-manager';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { OFDMModem } from '../../src/lib/ofdm-modem';
import { WebRTCTransport } from '../../src/lib/webrtc-transport';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Subscription Routing with OFDM Priority', () => {
  let updateManager: UpdateManager;
  let subscriptionManager: SubscriptionManager;
  let deliveryRouter: DeliveryRouter;
  let ofdmModem: OFDMModem;
  let webrtcTransport: WebRTCTransport;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    subscriptionManager = new SubscriptionManager({ db });
    ofdmModem = new OFDMModem({ carriers: 48, bandwidth: 2800 });
    webrtcTransport = new WebRTCTransport({ signalingServer: 'ws://localhost:8080' });
    deliveryRouter = new DeliveryRouter({
      db,
      ofdmModem,
      webrtcTransport
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should allocate high-priority carriers for P0/P1 updates', async () => {
    // Create P0 emergency update
    const emergencyUpdate = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('EMERGENCY: Building collapse at Main & 5th'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL']
    });

    // Create subscription for emergency updates
    await subscriptionManager.create({
      subscriber: 'KB2DEF',
      categories: ['emergency'],
      priorities: [0, 1],
      maxSize: 10240,
      callsign: 'KB2DEF'
    });

    // Route update and check carrier allocation
    const routing = await deliveryRouter.routeUpdate(emergencyUpdate.id);

    // P0 should get carriers 40-47 (highest priority carriers)
    expect(routing.ofdmCarriers).toEqual([40, 41, 42, 43, 44, 45, 46, 47]);
    expect(routing.transmissionMode).toBe('OFDM');
    expect(routing.priority).toBe(0);
  });

  it('should distribute to subscribers based on last known path', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Severe thunderstorm warning'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // KB2DEF last heard via RF
    await deliveryRouter.recordPath({
      station: 'KB2DEF',
      mode: 'RF',
      lastHeard: Date.now() - 60000, // 1 minute ago
      signalStrength: 15
    });

    // KC3GHI has WebRTC connection
    await webrtcTransport.establishConnection('KA1ABC', 'KC3GHI');

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Should route via RF to KB2DEF (respects last path)
    expect(routing.targets.find(t => t.station === 'KB2DEF').mode).toBe('RF');

    // Should route via WebRTC to KC3GHI
    expect(routing.targets.find(t => t.station === 'KC3GHI').mode).toBe('WebRTC');
  });

  it('should handle subscription filtering by priority and category', async () => {
    // Create weather-only subscription
    const weatherSub = await subscriptionManager.create({
      subscriber: 'KD4JKL',
      categories: ['weather'],
      priorities: [2, 3, 4],
      maxSize: 5120,
      callsign: 'KD4JKL'
    });

    // Create safety subscription (different priorities)
    const safetySub = await subscriptionManager.create({
      subscriber: 'KE5MNO',
      categories: ['safety', 'emergency'],
      priorities: [0, 1],
      maxSize: 10240,
      callsign: 'KE5MNO'
    });

    // Create weather update (P3)
    const weatherUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Temperature rising'),
      originator: 'KA1ABC',
      subscribers: []
    });

    // Create emergency update (P0)
    const emergencyUpdate = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Evacuation order'),
      originator: 'KA1ABC',
      subscribers: []
    });

    // Route weather update
    const weatherRouting = await deliveryRouter.routeUpdate(weatherUpdate.id);
    expect(weatherRouting.targets.find(t => t.station === 'KD4JKL')).toBeDefined();
    expect(weatherRouting.targets.find(t => t.station === 'KE5MNO')).toBeUndefined();

    // Route emergency update
    const emergencyRouting = await deliveryRouter.routeUpdate(emergencyUpdate.id);
    expect(emergencyRouting.targets.find(t => t.station === 'KE5MNO')).toBeDefined();
    expect(emergencyRouting.targets.find(t => t.station === 'KD4JKL')).toBeUndefined();
  });

  it('should queue updates when OFDM carriers are busy', async () => {
    // Fill all high-priority carriers with P0 updates
    const p0Updates = [];
    for (let i = 0; i < 8; i++) {
      const update = await updateManager.create({
        category: 'emergency',
        priority: 0,
        data: new TextEncoder().encode(`Emergency ${i}`),
        originator: 'KA1ABC',
        subscribers: ['KB2DEF']
      });
      p0Updates.push(update);
    }

    // Route all P0 updates (should occupy carriers 40-47)
    for (const update of p0Updates) {
      await deliveryRouter.routeUpdate(update.id);
    }

    // Create another P0 update
    const queuedUpdate = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Queued emergency'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Should be queued since carriers are busy
    const routing = await deliveryRouter.routeUpdate(queuedUpdate.id);
    expect(routing.status).toBe('queued');
    expect(routing.estimatedDelay).toBeGreaterThan(0);
  });

  it('should handle unlicensed station WebRTC-only routing', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency bulletin'),
      originator: 'KA1ABC',
      subscribers: ['UNLICENSED-001']
    });

    // Unlicensed station subscription
    await subscriptionManager.create({
      subscriber: 'UNLICENSED-001',
      categories: ['emergency'],
      priorities: [0, 1, 2],
      maxSize: 10240,
      callsign: null // Unlicensed
    });

    // Licensed relay station has WebRTC
    await webrtcTransport.establishConnection('KA1ABC', 'KB2DEF');
    await webrtcTransport.establishConnection('KB2DEF', 'UNLICENSED-001');

    const routing = await deliveryRouter.routeUpdate(update.id);

    // Should route via WebRTC through licensed station
    const unlicensedTarget = routing.targets.find(t => t.station === 'UNLICENSED-001');
    expect(unlicensedTarget.mode).toBe('WebRTC');
    expect(unlicensedTarget.via).toBe('KB2DEF'); // Relayed through licensed station
    expect(unlicensedTarget.canRetransmit).toBe(false);
  });

  it('should respect size limits in subscriptions', async () => {
    // Create subscription with 2KB limit
    await subscriptionManager.create({
      subscriber: 'KF6PQR',
      categories: ['routine'],
      priorities: [4, 5],
      maxSize: 2048,
      callsign: 'KF6PQR'
    });

    // Create large update (5KB)
    const largeUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new Uint8Array(5 * 1024).fill(1),
      originator: 'KA1ABC',
      subscribers: []
    });

    // Should be filtered out due to size
    const routing = await deliveryRouter.routeUpdate(largeUpdate.id);
    expect(routing.targets.find(t => t.station === 'KF6PQR')).toBeUndefined();

    // Create small update (1KB)
    const smallUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new Uint8Array(1024).fill(1),
      originator: 'KA1ABC',
      subscribers: []
    });

    // Should be included
    const smallRouting = await deliveryRouter.routeUpdate(smallUpdate.id);
    expect(smallRouting.targets.find(t => t.station === 'KF6PQR')).toBeDefined();
  });

  it('should provide routing statistics and carrier utilization', async () => {
    // Create multiple updates with different priorities
    const updates = [];
    for (let priority = 0; priority < 6; priority++) {
      const update = await updateManager.create({
        category: priority === 0 ? 'emergency' : 'routine',
        priority,
        data: new TextEncoder().encode(`P${priority} update`),
        originator: 'KA1ABC',
        subscribers: ['KB2DEF']
      });
      updates.push(update);
      await deliveryRouter.routeUpdate(update.id);
    }

    const stats = await deliveryRouter.getRoutingStatistics();
    expect(stats).toMatchObject({
      activeCarriers: expect.any(Number),
      queuedUpdates: expect.any(Number),
      priorityBreakdown: expect.objectContaining({
        0: expect.any(Number),
        1: expect.any(Number)
      }),
      carrierUtilization: expect.any(Number),
      avgDeliveryTime: expect.any(Number)
    });

    expect(stats.activeCarriers).toBeLessThanOrEqual(48);
    expect(stats.carrierUtilization).toBeGreaterThan(0);
  });
});