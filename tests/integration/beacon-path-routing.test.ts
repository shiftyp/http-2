/**
 * Integration Test: Beacon Path Routing Intelligence
 * Tests RF beacon monitoring and intelligent path selection
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { BeaconMonitor } from '../../src/lib/beacon-monitor';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { WebRTCTransport } from '../../src/lib/webrtc-transport';
import { PathSelector } from '../../src/lib/path-selector';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Beacon Path Routing Intelligence', () => {
  let updateManager: UpdateManager;
  let beaconMonitor: BeaconMonitor;
  let deliveryRouter: DeliveryRouter;
  let webrtcTransport: WebRTCTransport;
  let pathSelector: PathSelector;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    beaconMonitor = new BeaconMonitor({ db, beaconInterval: 30000 });
    webrtcTransport = new WebRTCTransport({ signalingServer: 'ws://localhost:8080' });
    pathSelector = new PathSelector({ db, preferRFOnLastBeacon: true });
    deliveryRouter = new DeliveryRouter({
      db,
      beaconMonitor,
      webrtcTransport,
      pathSelector
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should prefer RF path when station was last heard via RF beacon', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency test'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Record recent RF beacon (2 minutes ago)
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KB2DEF',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 18,
      lastHeard: now - (2 * 60 * 1000),
      frequency: 14.230,
      bandwidth: 2800
    });

    // WebRTC connection also available
    await webrtcTransport.establishConnection('KA1ABC', 'KB2DEF');

    const path = await pathSelector.selectPath('KB2DEF', update.id);
    expect(path.mode).toBe('RF'); // Should prefer RF due to recent beacon

    vi.useRealTimers();
  });

  it('should fall back to WebRTC when RF beacon is stale', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Weather update'),
      originator: 'KA1ABC',
      subscribers: ['KC3GHI']
    });

    // Old RF beacon (10 minutes ago - stale)
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KC3GHI',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 15,
      lastHeard: now - (10 * 60 * 1000),
      frequency: 14.230
    });

    // Fresh WebRTC connection
    await webrtcTransport.establishConnection('KA1ABC', 'KC3GHI');

    const path = await pathSelector.selectPath('KC3GHI', update.id);
    expect(path.mode).toBe('WebRTC'); // Should prefer fresh WebRTC over stale RF

    vi.useRealTimers();
  });

  it('should monitor signal quality trends for path optimization', async () => {
    vi.useFakeTimers();
    const now = Date.now();

    // Record declining signal quality over time
    const signalHistory = [25, 22, 18, 15, 12]; // Degrading signal
    for (let i = 0; i < signalHistory.length; i++) {
      vi.setSystemTime(now - ((signalHistory.length - i) * 60 * 1000));

      await beaconMonitor.recordPath({
        originStation: 'KA1ABC',
        targetStation: 'KD4JKL',
        mode: 'RF',
        hopCount: 1,
        signalStrength: signalHistory[i],
        lastHeard: Date.now(),
        frequency: 14.230
      });
    }

    vi.setSystemTime(now);

    const update = await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new TextEncoder().encode('Signal quality test'),
      originator: 'KA1ABC',
      subscribers: ['KD4JKL']
    });

    // WebRTC available as backup
    await webrtcTransport.establishConnection('KA1ABC', 'KD4JKL');

    const path = await pathSelector.selectPath('KD4JKL', update.id);

    // Should consider signal trend and prefer WebRTC due to degrading RF
    expect(path.mode).toBe('WebRTC');
    expect(path.reason).toContain('degrading signal quality');

    vi.useRealTimers();
  });

  it('should handle frequency band propagation characteristics', async () => {
    const update = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode('Band test'),
      originator: 'KA1ABC',
      subscribers: ['KE5MNO']
    });

    // Record paths on different bands
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KE5MNO',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 20,
      lastHeard: Date.now() - 60000,
      frequency: 7.230, // 40m band - good for night
      bandwidth: 2800
    });

    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KE5MNO',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 15,
      lastHeard: Date.now() - 30000,
      frequency: 14.230, // 20m band - good for day
      bandwidth: 2800
    });

    // Time of day should influence band selection
    const path = await pathSelector.selectPath('KE5MNO', update.id);
    expect(path.mode).toBe('RF');
    expect([7.230, 14.230]).toContain(path.frequency);
  });

  it('should coordinate multi-hop beacon routing', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Multi-hop emergency'),
      originator: 'KA1ABC',
      subscribers: ['KG7STU'] // Distant station
    });

    // Record beacon chain: KA1ABC -> KB2DEF -> KC3GHI -> KG7STU
    const beaconChain = [
      { from: 'KA1ABC', to: 'KB2DEF', signal: 25, hops: 1 },
      { from: 'KB2DEF', to: 'KC3GHI', signal: 20, hops: 1 },
      { from: 'KC3GHI', to: 'KG7STU', signal: 18, hops: 1 }
    ];

    for (const beacon of beaconChain) {
      await beaconMonitor.recordPath({
        originStation: beacon.from,
        targetStation: beacon.to,
        mode: 'RF',
        hopCount: beacon.hops,
        signalStrength: beacon.signal,
        lastHeard: Date.now() - 30000,
        frequency: 14.230
      });
    }

    const path = await pathSelector.selectPath('KG7STU', update.id);
    expect(path.mode).toBe('RF');
    expect(path.hops).toEqual(['KA1ABC', 'KB2DEF', 'KC3GHI', 'KG7STU']);
    expect(path.totalHops).toBe(3);
  });

  it('should handle beacon collision detection and avoidance', async () => {
    // Multiple stations reporting to same target
    const targetStation = 'KH8VWX';
    const sources = ['KA1ABC', 'KB2DEF', 'KC3GHI'];

    for (const source of sources) {
      await beaconMonitor.recordPath({
        originStation: source,
        targetStation: targetStation,
        mode: 'RF',
        hopCount: 1,
        signalStrength: 20,
        lastHeard: Date.now() - 60000,
        frequency: 14.230
      });
    }

    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Collision test'),
      originator: 'KA1ABC',
      subscribers: [targetStation]
    });

    // Should detect potential beacon collision
    const routing = await deliveryRouter.routeUpdate(update.id);
    const target = routing.targets.find(t => t.station === targetStation);

    // Should stagger transmission to avoid collision
    expect(target.transmissionDelay).toBeGreaterThan(0);
    expect(target.collisionAvoidance).toBe(true);
  });

  it('should track beacon quality metrics over time', async () => {
    vi.useFakeTimers();
    const now = Date.now();

    // Record various beacon qualities over 24 hours
    const timeSlots = 24; // Hourly measurements
    for (let hour = 0; hour < timeSlots; hour++) {
      vi.setSystemTime(now - ((timeSlots - hour) * 60 * 60 * 1000));

      // Simulate day/night propagation changes
      const isDaytime = hour >= 6 && hour <= 18;
      const baseSignal = isDaytime ? 15 : 25; // Better night propagation on 40m
      const variance = Math.random() * 10 - 5; // ±5 dB variance

      await beaconMonitor.recordPath({
        originStation: 'KA1ABC',
        targetStation: 'KI9YZA',
        mode: 'RF',
        hopCount: 1,
        signalStrength: Math.max(5, baseSignal + variance),
        lastHeard: Date.now(),
        frequency: 7.230 // 40m
      });
    }

    vi.setSystemTime(now);

    const metrics = await beaconMonitor.getQualityMetrics('KA1ABC', 'KI9YZA');
    expect(metrics).toMatchObject({
      avgSignalStrength: expect.any(Number),
      signalVariance: expect.any(Number),
      reliabilityScore: expect.any(Number),
      dayNightPattern: expect.any(Object),
      bestTimeSlots: expect.any(Array)
    });

    expect(metrics.avgSignalStrength).toBeGreaterThan(10);
    expect(metrics.reliabilityScore).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('should adapt to changing propagation conditions', async () => {
    vi.useFakeTimers();
    const now = Date.now();

    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Propagation test'),
      originator: 'KA1ABC',
      subscribers: ['KJ0BCD']
    });

    // Record good 20m conditions initially
    vi.setSystemTime(now - 5 * 60 * 1000);
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KJ0BCD',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 25,
      lastHeard: Date.now(),
      frequency: 14.230 // 20m
    });

    // Conditions deteriorate (solar flare simulation)
    vi.setSystemTime(now - 2 * 60 * 1000);
    await beaconMonitor.recordPath({
      originStation: 'KA1ABC',
      targetStation: 'KJ0BCD',
      mode: 'RF',
      hopCount: 1,
      signalStrength: 8, // Poor conditions
      lastHeard: Date.now(),
      frequency: 14.230
    });

    vi.setSystemTime(now);

    // Should adapt and prefer WebRTC
    await webrtcTransport.establishConnection('KA1ABC', 'KJ0BCD');
    const path = await pathSelector.selectPath('KJ0BCD', update.id);

    expect(path.mode).toBe('WebRTC');
    expect(path.reason).toContain('poor propagation conditions');

    vi.useRealTimers();
  });

  it('should provide beacon statistics and coverage maps', async () => {
    // Generate beacon data for coverage analysis
    const stations = ['KB2DEF', 'KC3GHI', 'KD4JKL', 'KE5MNO'];
    const frequencies = [7.230, 14.230, 21.230, 28.230];

    for (const station of stations) {
      for (const freq of frequencies) {
        await beaconMonitor.recordPath({
          originStation: 'KA1ABC',
          targetStation: station,
          mode: 'RF',
          hopCount: 1,
          signalStrength: 15 + Math.random() * 15, // 15-30 dB
          lastHeard: Date.now() - Math.random() * 300000, // Last 5 minutes
          frequency: freq,
          bandwidth: 2800
        });
      }
    }

    const coverage = await beaconMonitor.getCoverageStatistics();
    expect(coverage).toMatchObject({
      totalStations: expect.any(Number),
      bandCoverage: expect.any(Object),
      avgSignalStrength: expect.any(Number),
      coverageRadius: expect.any(Number),
      bestBands: expect.any(Array),
      reachabilityMatrix: expect.any(Object)
    });

    expect(coverage.totalStations).toBe(stations.length);
    expect(Object.keys(coverage.bandCoverage)).toHaveLength(frequencies.length);
  });
});