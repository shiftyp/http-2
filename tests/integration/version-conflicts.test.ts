/**
 * Integration Test: Version Conflict Resolution
 * Tests handling of concurrent updates and version conflicts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { VersionManager } from '../../src/lib/version-manager';
import { ConflictResolver } from '../../src/lib/conflict-resolver';
import { CacheManager } from '../../src/lib/cache-manager';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Version Conflict Resolution', () => {
  let updateManager: UpdateManager;
  let versionManager: VersionManager;
  let conflictResolver: ConflictResolver;
  let cacheManager: CacheManager;
  let deliveryRouter: DeliveryRouter;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db });
    versionManager = new VersionManager({ db });
    conflictResolver = new ConflictResolver({ db, strategy: 'timestamp-priority' });
    cacheManager = new CacheManager({ db });
    deliveryRouter = new DeliveryRouter({
      db,
      versionManager,
      conflictResolver
    });
  });

  afterAll(async () => {
    db.close();
  });

  it('should detect version conflicts from concurrent updates', async () => {
    // Create initial update
    const baseUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Initial weather report'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // Simulate two stations modifying concurrently
    const update1 = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Updated by KB2DEF'),
      originator: 'KB2DEF',
      timestamp: Date.now()
    });

    const update2 = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1, // Same base version - conflict!
      data: new TextEncoder().encode('Updated by KC3GHI'),
      originator: 'KC3GHI',
      timestamp: Date.now() + 1000 // 1 second later
    });

    // Detect conflict
    const conflict = await conflictResolver.detectConflict(baseUpdate.id);
    expect(conflict).toBeDefined();
    expect(conflict.conflictingVersions).toEqual([update1.version, update2.version]);
    expect(conflict.type).toBe('concurrent_modification');
  });

  it('should resolve conflicts using timestamp-priority strategy', async () => {
    const baseUpdate = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency base'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Create conflicting versions with different priorities and timestamps
    const lowPriorityUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      priority: 2, // Lower priority
      data: new TextEncoder().encode('Low priority update'),
      originator: 'KB2DEF',
      timestamp: Date.now() + 5000
    });

    const highPriorityUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      priority: 0, // Higher priority
      data: new TextEncoder().encode('High priority update'),
      originator: 'KC3GHI',
      timestamp: Date.now() + 3000
    });

    // Resolve conflict
    const resolution = await conflictResolver.resolveConflict(baseUpdate.id);

    // Higher priority should win regardless of timestamp
    expect(resolution.winningVersion).toBe(highPriorityUpdate.version);
    expect(resolution.strategy).toBe('priority');
    expect(resolution.discardedVersions).toContain(lowPriorityUpdate.version);
  });

  it('should handle three-way merge for compatible changes', async () => {
    const baseUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode(JSON.stringify({
        location: 'Grid Square EM48',
        weather: 'Clear',
        temperature: 72
      })),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // Two compatible modifications
    const weatherUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode(JSON.stringify({
        location: 'Grid Square EM48',
        weather: 'Cloudy', // Changed weather
        temperature: 72
      })),
      originator: 'KB2DEF'
    });

    const tempUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode(JSON.stringify({
        location: 'Grid Square EM48',
        weather: 'Clear',
        temperature: 75 // Changed temperature
      })),
      originator: 'KC3GHI'
    });

    // Attempt three-way merge
    const merge = await conflictResolver.attemptMerge(baseUpdate.id);
    expect(merge.successful).toBe(true);

    const mergedData = JSON.parse(new TextDecoder().decode(merge.mergedData));
    expect(mergedData).toEqual({
      location: 'Grid Square EM48',
      weather: 'Cloudy', // From weatherUpdate
      temperature: 75 // From tempUpdate
    });
  });

  it('should handle version ordering and dependencies', async () => {
    const baseUpdate = await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new TextEncoder().encode('Safety protocol v1'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Create version chain: v1 -> v2 -> v3
    const v2 = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Safety protocol v2'),
      originator: 'KB2DEF'
    });

    const v3 = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: v2.version,
      data: new TextEncoder().encode('Safety protocol v3'),
      originator: 'KC3GHI'
    });

    // Someone tries to update from v1 (creating fork)
    const v2Fork = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1, // Forking from v1, not v3
      data: new TextEncoder().encode('Forked safety protocol'),
      originator: 'KD4JKL'
    });

    // Version tree should be tracked correctly
    const tree = await versionManager.getVersionTree(baseUpdate.id);
    expect(tree.branches).toHaveLength(2); // Main branch and fork
    expect(tree.latestVersions).toContain(v3.version);
    expect(tree.latestVersions).toContain(v2Fork.version);
  });

  it('should handle network partition and reconciliation', async () => {
    vi.useFakeTimers();
    const now = Date.now();

    const baseUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Weather base'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    // Simulate network partition - different sides make updates
    vi.setSystemTime(now + 60000);

    const partitionA = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Partition A update'),
      originator: 'KB2DEF',
      partitionId: 'A' // Simulate isolated network
    });

    const partitionB = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Partition B update'),
      originator: 'KC3GHI',
      partitionId: 'B' // Different isolated network
    });

    // Network heals - reconcile partitions
    vi.setSystemTime(now + 120000);

    const reconciliation = await conflictResolver.reconcilePartitions(
      baseUpdate.id,
      ['A', 'B']
    );

    expect(reconciliation.successful).toBe(true);
    expect(reconciliation.strategy).toBe('vector_clock_merge');
    expect(reconciliation.finalVersion).toBeDefined();

    vi.useRealTimers();
  });

  it('should handle large file diff and patch generation', async () => {
    // Create large base content
    const baseContent = new Array(1000).fill(0).map((_, i) => `Line ${i}: Base content`).join('\n');
    const baseUpdate = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode(baseContent),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Create modified version (change a few lines)
    const modifiedContent = baseContent
      .split('\n')
      .map((line, i) => i === 500 ? 'Line 500: MODIFIED CONTENT' : line)
      .join('\n');

    const modifiedUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode(modifiedContent),
      originator: 'KB2DEF'
    });

    // Generate diff for bandwidth optimization
    const diff = await versionManager.generateDiff(baseUpdate.id, 1, modifiedUpdate.version);
    expect(diff.patches).toHaveLength(1);
    expect(diff.compressionRatio).toBeGreaterThan(0.9); // Should be much smaller
    expect(diff.patches[0].lineNumber).toBe(500);
  });

  it('should detect and handle byzantine updates', async () => {
    const baseUpdate = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Legitimate emergency'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Legitimate update
    const legitUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Legitimate update'),
      originator: 'KB2DEF',
      signature: 'valid-ecdsa-signature'
    });

    // Potentially malicious update (wrong signature)
    const suspiciousUpdate = await updateManager.createVersion({
      baseId: baseUpdate.id,
      baseVersion: 1,
      data: new TextEncoder().encode('Suspicious content'),
      originator: 'FAKE-CALLSIGN',
      signature: 'invalid-signature'
    });

    // Conflict resolution should detect byzantine behavior
    const resolution = await conflictResolver.resolveConflict(baseUpdate.id);
    expect(resolution.byzantineDetected).toBe(true);
    expect(resolution.trustedVersions).toContain(legitUpdate.version);
    expect(resolution.suspiciousVersions).toContain(suspiciousUpdate.version);
  });

  it('should provide conflict statistics and metrics', async () => {
    // Generate various conflict scenarios
    for (let i = 0; i < 5; i++) {
      const base = await updateManager.create({
        category: 'routine',
        priority: 5,
        data: new TextEncoder().encode(`Test ${i}`),
        originator: 'KA1ABC',
        subscribers: ['KB2DEF']
      });

      // Create conflicts
      await updateManager.createVersion({
        baseId: base.id,
        baseVersion: 1,
        data: new TextEncoder().encode(`Version A ${i}`),
        originator: 'KB2DEF'
      });

      await updateManager.createVersion({
        baseId: base.id,
        baseVersion: 1,
        data: new TextEncoder().encode(`Version B ${i}`),
        originator: 'KC3GHI'
      });

      await conflictResolver.resolveConflict(base.id);
    }

    const stats = await conflictResolver.getConflictStatistics();
    expect(stats).toMatchObject({
      totalConflicts: 5,
      resolvedConflicts: 5,
      resolutionStrategies: expect.any(Object),
      avgResolutionTime: expect.any(Number),
      mergeSuccessRate: expect.any(Number),
      byzantineDetections: expect.any(Number)
    });

    expect(stats.totalConflicts).toBe(5);
    expect(stats.resolvedConflicts).toBe(5);
  });

  it('should handle rapid successive version updates', async () => {
    const baseUpdate = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Rapid test base'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Create rapid succession of updates
    const versions = [];
    for (let i = 0; i < 10; i++) {
      const version = await updateManager.createVersion({
        baseId: baseUpdate.id,
        baseVersion: i === 0 ? 1 : versions[i - 1].version,
        data: new TextEncoder().encode(`Rapid update ${i}`),
        originator: 'KB2DEF',
        timestamp: Date.now() + i * 100 // 100ms apart
      });
      versions.push(version);
    }

    // Should maintain version ordering
    const chain = await versionManager.getVersionChain(baseUpdate.id);
    expect(chain).toHaveLength(11); // Base + 10 versions
    expect(chain[chain.length - 1].version).toBe(versions[9].version);

    // Latest version should be the final one
    const latest = await versionManager.getLatestVersion(baseUpdate.id);
    expect(latest.version).toBe(versions[9].version);
  });
});