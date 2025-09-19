/**
 * Integration Test: Delta Synchronization for Bandwidth Optimization
 * Tests incremental sync and compression for efficient RF transmission
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { DeltaSync } from '../../src/lib/delta-sync';
import { CompressionManager } from '../../src/lib/compression-manager';
import { CacheManager } from '../../src/lib/cache-manager';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Delta Synchronization for Bandwidth Optimization', () => {
  let updateManager: UpdateManager;
  let deltaSync: DeltaSync;
  let compressionManager: CompressionManager;
  let cacheManager: CacheManager;
  let deliveryRouter: DeliveryRouter;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    compressionManager = new CompressionManager({ algorithm: 'lz77', level: 6 });
    deltaSync = new DeltaSync({ db, compressionManager });
    cacheManager = new CacheManager({ db });
    deliveryRouter = new DeliveryRouter({
      db,
      deltaSync,
      compressionManager,
      preferDeltas: true
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should generate delta patches for incremental updates', async () => {
    // Create base document
    const baseData = JSON.stringify({
      weather: {
        temperature: 72,
        humidity: 65,
        pressure: 30.15,
        conditions: 'Clear'
      },
      timestamp: '2025-01-15T10:00:00Z'
    });

    const baseUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode(baseData),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Create modified version
    const modifiedData = JSON.stringify({
      weather: {
        temperature: 75, // Changed
        humidity: 65,
        pressure: 30.15,
        conditions: 'Partly Cloudy' // Changed
      },
      timestamp: '2025-01-15T10:15:00Z' // Changed
    });

    const modifiedUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode(modifiedData),
      originator: 'KA1ABC'
    });

    // Generate delta
    const delta = await deltaSync.generateDelta(baseUpdate.id, 1, modifiedUpdate.version);

    expect(delta.patches).toHaveLength(3); // Three changes
    expect(delta.originalSize).toBe(modifiedData.length);
    expect(delta.deltaSize).toBeLessThan(delta.originalSize);
    expect(delta.compressionRatio).toBeGreaterThan(0.5); // At least 50% compression
  });

  it('should apply delta patches to reconstruct updates', async () => {
    const originalText = 'The quick brown fox jumps over the lazy dog. ' +
                        'This is a test of delta compression. ' +
                        'Multiple lines of text for testing purposes.';

    const baseUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode(originalText),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Modified version with small changes
    const modifiedText = originalText
      .replace('quick brown', 'fast red')
      .replace('lazy dog', 'sleeping cat')
      .replace('testing purposes', 'compression testing');

    const modifiedUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode(modifiedText),
      originator: 'KA1ABC'
    });

    // Generate and apply delta
    const delta = await deltaSync.generateDelta(baseUpdate.id, 1, modifiedUpdate.version);
    const reconstructed = await deltaSync.applyDelta(baseUpdate.data, delta);

    expect(new TextDecoder().decode(reconstructed)).toBe(modifiedText);
    expect(delta.deltaSize).toBeLessThan(originalText.length * 0.3); // Significant compression
  });

  it('should handle binary data delta compression', async () => {
    // Create binary data (simulated image metadata)
    const baseData = new Uint8Array(1024);
    for (let i = 0; i < baseData.length; i++) {
      baseData[i] = i % 256; // Pattern for testing
    }

    const baseUpdate = await updateManager.create({
      category: 'routine',
      priority: 4,
      data: baseData,
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Modify small portion of binary data
    const modifiedData = new Uint8Array(baseData);
    for (let i = 100; i < 120; i++) {
      modifiedData[i] = 255; // Change 20 bytes
    }

    const modifiedUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: modifiedData,
      originator: 'KA1ABC'
    });

    // Generate binary delta
    const delta = await deltaSync.generateDelta(baseUpdate.id, 1, modifiedUpdate.version);
    expect(delta.deltaSize).toBeLessThan(100); // Should be very small for 20-byte change
    expect(delta.compressionRatio).toBeGreaterThan(0.9); // Excellent compression

    // Verify reconstruction
    const reconstructed = await deltaSync.applyDelta(baseData, delta);
    expect(reconstructed).toEqual(modifiedData);
  });

  it('should optimize transmission with delta prioritization', async () => {
    // Create large base document
    const baseContent = {
      emergencyContacts: new Array(100).fill(0).map((_, i) => ({
        callsign: `K${i}ABC`,
        frequency: 146.520 + i * 0.025,
        location: `Grid ${i}`
      })),
      lastUpdate: '2025-01-15T10:00:00Z'
    };

    const baseUpdate = await updateManager.create({
      category: 'emergency',
      priority: 1,
      data: new TextEncoder().encode(JSON.stringify(baseContent)),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // Small but critical update (add one emergency contact)
    const updatedContent = { ...baseContent };
    updatedContent.emergencyContacts.push({
      callsign: 'EMERGENCY-COORD',
      frequency: 146.520,
      location: 'EOC'
    });
    updatedContent.lastUpdate = '2025-01-15T10:30:00Z';

    const criticalUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      priority: 0, // Critical update
      data: new TextEncoder().encode(JSON.stringify(updatedContent)),
      originator: 'KA1ABC'
    });

    // Route with delta optimization
    const routing = await deliveryRouter.routeUpdate(criticalUpdate.id);

    // Should use delta transmission for bandwidth efficiency
    expect(routing.useDelta).toBe(true);
    expect(routing.deltaSize).toBeLessThan(200); // Small delta for one contact
    expect(routing.fullSize).toBeGreaterThan(2000); // Much larger full document

    // Critical priority should still get fast delivery
    expect(routing.transmissionMode).toBe('OFDM');
    expect(routing.ofdmCarriers).toContain(47); // High-priority carrier
  });

  it('should handle delta chain compression for multiple versions', async () => {
    const baseText = 'Initial document content for delta chain testing.';

    const baseUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode(baseText),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Create chain of 5 incremental updates
    let currentVersion = 1;
    const versions = [baseUpdate];

    for (let i = 1; i <= 5; i++) {
      const modifiedText = baseText + ` Version ${i} addition.`;
      const newUpdate = await updateManager.createVersion({
        baseId: baseUpdate.id,
        baseVersion: currentVersion,
        data: new TextEncoder().encode(modifiedText),
        originator: 'KA1ABC'
      });
      versions.push(newUpdate);
      currentVersion = newUpdate.version;
    }

    // Generate delta chain from v1 to v6
    const deltaChain = await deltaSync.generateDeltaChain(
      baseUpdate.id,
      1,
      versions[5].version
    );

    expect(deltaChain.deltas).toHaveLength(5);
    expect(deltaChain.totalDeltaSize).toBeLessThan(deltaChain.fullSize * 0.5);

    // Verify chain reconstruction
    const reconstructed = await deltaSync.applyDeltaChain(baseUpdate.data, deltaChain);
    expect(new TextDecoder().decode(reconstructed)).toContain('Version 5 addition');
  });

  it('should handle delta sync with missing intermediate versions', async () => {
    const baseUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Weather v1'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // Create v2 and v4, but v3 is missing
    const v2 = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Weather v2'),
      originator: 'KA1ABC'
    });

    const v4 = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 3, // v3 missing!
      data: new TextEncoder().encode('Weather v4'),
      originator: 'KA1ABC'
    });

    // KB2DEF has v1, wants v4, but v3 is missing
    await cacheManager.storeAt('KB2DEF', baseUpdate);

    // Should detect missing version and request full sync
    const syncPlan = await deltaSync.planSync('KB2DEF', v4.id);
    expect(syncPlan.strategy).toBe('full_sync');
    expect(syncPlan.missingVersions).toContain(3);
    expect(syncPlan.reason).toContain('missing intermediate version');
  });

  it('should optimize for RF bandwidth constraints', async () => {
    // Large document that would exceed RF bandwidth
    const largeContent = new Array(1000).fill(0).map(i =>
      `Line ${i}: This is a substantial amount of content that would consume significant bandwidth if transmitted in full.`
    ).join('\n');

    const baseUpdate = await updateManager.create({
      category: 'routine',
      priority: 4,
      data: new TextEncoder().encode(largeContent),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Small modification
    const modifiedContent = largeContent.replace('Line 500:', 'Line 500 MODIFIED:');
    const modifiedUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode(modifiedContent),
      originator: 'KA1ABC'
    });

    // Route considering RF bandwidth (2.8 kHz constraint)
    const routing = await deliveryRouter.routeUpdate(modifiedUpdate.id, {
      maxBandwidth: 2800,
      maxTransmissionTime: 30 // 30 seconds max
    });

    expect(routing.useDelta).toBe(true);
    expect(routing.estimatedTransmissionTime).toBeLessThan(30);
    expect(routing.deltaSize).toBeLessThan(100); // Very small delta
  });

  it('should provide delta sync statistics and efficiency metrics', async () => {
    // Generate various delta operations
    for (let i = 0; i < 10; i++) {
      const base = await updateManager.create({
        category: 'routine',
        priority: 5,
        data: new TextEncoder().encode(`Base document ${i} with substantial content.`),
        originator: 'KA1ABC',
        subscribers: ['KB2DEF']
      });

      const modified = await updateManager.createVersion({
        baseId: base.id,
        baseVersion: 1,
        data: new TextEncoder().encode(`Modified document ${i} with changes.`),
        originator: 'KA1ABC'
      });

      await deltaSync.generateDelta(base.id, 1, modified.version);
    }

    const stats = await deltaSync.getStatistics();
    expect(stats).toMatchObject({
      totalDeltas: 10,
      avgCompressionRatio: expect.any(Number),
      bandwidthSaved: expect.any(Number),
      avgDeltaSize: expect.any(Number),
      avgFullSize: expect.any(Number),
      timeSaved: expect.any(Number)
    });

    expect(stats.totalDeltas).toBe(10);
    expect(stats.avgCompressionRatio).toBeGreaterThan(0);
    expect(stats.bandwidthSaved).toBeGreaterThan(0);
  });

  it('should handle concurrent delta generation and application', async () => {
    const baseUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Concurrent test base content'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL']
    });

    // Multiple stations request deltas concurrently
    const deltaPromises = [];
    for (let i = 0; i < 5; i++) {
      const modified = await updateManager.createVersion({
        baseId: baseUpdate.id,
        baseVersion: 1,
        data: new TextEncoder().encode(`Concurrent version ${i}`),
        originator: 'KA1ABC'
      });

      deltaPromises.push(deltaSync.generateDelta(baseUpdate.id, 1, modified.version));
    }

    const deltas = await Promise.all(deltaPromises);

    // All deltas should be generated successfully
    expect(deltas).toHaveLength(5);
    deltas.forEach(delta => {
      expect(delta.deltaSize).toBeGreaterThan(0);
      expect(delta.compressionRatio).toBeGreaterThan(0);
    });

    // Should handle concurrent application as well
    const applications = deltas.map(delta =>
      deltaSync.applyDelta(baseUpdate.data, delta)
    );

    const results = await Promise.all(applications);
    expect(results).toHaveLength(5);
  });
});