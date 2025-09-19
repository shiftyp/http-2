/**
 * Integration Test: WebRTC Fallback When RF Unavailable
 * Tests automatic fallback to WebRTC for update delivery
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { BeaconMonitor } from '../../src/lib/beacon-monitor';
import { CacheManager } from '../../src/lib/cache-manager';
import { WebRTCTransport } from '../../src/lib/webrtc-transport';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('WebRTC Fallback When RF Unavailable', () => {
  let updateManager: UpdateManager;
  let deliveryRouter: DeliveryRouter;
  let beaconMonitor: BeaconMonitor;
  let cacheManager: CacheManager;
  let webrtcTransport: WebRTCTransport;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    beaconMonitor = new BeaconMonitor({ db });
    cacheManager = new CacheManager({ db });
    webrtcTransport = new WebRTCTransport({ signalingServer: 'ws://localhost:8080' });
    deliveryRouter = new DeliveryRouter({
      db,
      beaconMonitor,
      webrtcTransport,
      preferWebRTC: true
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should prefer WebRTC when available to reduce RF pressure', async () => {
    const update = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode('Routine update'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Both RF and WebRTC available
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KB2DEF',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 15
    });

    await webrtcTransport.establishConnection('KA1ABC', 'KB2DEF');

    const path = await deliveryRouter.selectPath('KB2DEF', update.id);
    expect(path.mode).toBe('WebRTC'); // Should prefer WebRTC
  });

  it('should fall back to RF when WebRTC connection fails', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Weather update'),
      originator: 'KA1ABC',
      subscribers: ['KC3GHI']
    });

    // Record RF beacon
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KC3GHI',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 20
    });

    // Simulate WebRTC failure
    const connectSpy = vi.spyOn(webrtcTransport, 'establishConnection');
    connectSpy.mockRejectedValue(new Error('Connection failed'));

    const path = await deliveryRouter.selectPath('KC3GHI', update.id);
    expect(path.mode).toBe('RF'); // Falls back to RF
  });

  it('should respect RF beacon path when it was last heard', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency'),
      originator: 'KA1ABC',
      subscribers: ['KD4JKL']
    });

    // Last beacon was RF
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KD4JKL',
      mode: 'RF',
      hopCount: 2,
      signalStrength: 10,
      lastHeard: Date.now()
    });

    // Even with WebRTC available
    await webrtcTransport.establishConnection('KA1ABC', 'KD4JKL');

    const path = await deliveryRouter.selectPath('KD4JKL', update.id);
    expect(path.mode).toBe('RF'); // Respects last beacon path
  });

  it('should handle unlicensed station WebRTC reception', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency for all'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'UNLICENSED-001']
    });

    // Licensed station has the update
    await cacheManager.storeAt('KB2DEF', update);

    // Unlicensed station can only receive via WebRTC
    const path = await deliveryRouter.selectPath('UNLICENSED-001', update.id);
    expect(path.mode).toBe('WebRTC');
    expect(path.via).toBe('KB2DEF'); // From licensed station
    expect(path.canTransmit).toBe(false); // Cannot retransmit
  });

  it('should handle WebRTC negotiation for update transfer', async () => {
    const update = await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new TextEncoder().encode('Safety bulletin'),
      originator: 'KA1ABC',
      subscribers: ['KE5MNO']
    });

    // Simulate WebRTC negotiation
    const offer = await webrtcTransport.createOffer('KA1ABC', 'KE5MNO');
    expect(offer).toBeDefined();
    expect(offer.type).toBe('offer');

    const answer = await webrtcTransport.createAnswer('KE5MNO', offer);
    expect(answer).toBeDefined();
    expect(answer.type).toBe('answer');

    // Complete connection
    await webrtcTransport.setRemoteDescription('KA1ABC', answer);

    // Transfer update
    const transferred = await webrtcTransport.sendData(update, 'KE5MNO');
    expect(transferred).toBe(true);
  });

  it('should detect stale WebRTC connections', async () => {
    vi.useFakeTimers();

    const update = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode('Test'),
      originator: 'KA1ABC',
      subscribers: ['KF6PQR']
    });

    // Establish WebRTC connection
    await webrtcTransport.establishConnection('KA1ABC', 'KF6PQR');

    // Connection is fresh
    let path = await deliveryRouter.selectPath('KF6PQR', update.id);
    expect(path.mode).toBe('WebRTC');

    // Advance time to make connection stale (5+ minutes)
    vi.advanceTimersByTime(6 * 60 * 1000);

    // Now record RF beacon
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KF6PQR',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 25
    });

    // Should prefer RF over stale WebRTC
    path = await deliveryRouter.selectPath('KF6PQR', update.id);
    expect(path.mode).toBe('RF');

    vi.useRealTimers();
  });

  it('should handle multi-hop WebRTC relay for distant stations', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Regional weather'),
      originator: 'KA1ABC',
      subscribers: ['KG7STU'] // Distant station
    });

    // Direct connection not available
    // But relay path exists: KA1ABC -> KB2DEF -> KG7STU
    await cacheManager.storeAt('KB2DEF', update);

    await webrtcTransport.establishConnection('KA1ABC', 'KB2DEF');
    await webrtcTransport.establishConnection('KB2DEF', 'KG7STU');

    const path = await deliveryRouter.selectPath('KG7STU', update.id);
    expect(path.mode).toBe('WebRTC');
    expect(path.hops).toEqual(['KA1ABC', 'KB2DEF', 'KG7STU']);
  });
});