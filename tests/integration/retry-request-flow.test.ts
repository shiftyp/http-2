/**
 * Integration Test: Licensed Station Retry Request Flow
 * Tests the complete retry request and fulfillment process
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { UpdateManager } from '../../src/lib/update-manager';
import { RetryCoordinator } from '../../src/lib/retry-coordinator';
import { CacheManager } from '../../src/lib/cache-manager';
import { DeliveryRouter } from '../../src/lib/delivery-router';
import { openDynamicDataDB } from '../../src/lib/database/dynamic-data-schema';

describe('Licensed Station Retry Request Flow', () => {
  let updateManager: UpdateManager;
  let retryCoordinator: RetryCoordinator;
  let cacheManager: CacheManager;
  let deliveryRouter: DeliveryRouter;
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openDynamicDataDB();
    updateManager = new UpdateManager({ db, maxSize: 50 * 1024 });
    retryCoordinator = new RetryCoordinator({ db, windowMin: 10, windowMax: 30 });
    cacheManager = new CacheManager({ db, maxSize: 100 * 1024 * 1024 });
    deliveryRouter = new DeliveryRouter({ db, preferWebRTC: true });
  });

  afterAll(async () => {
    db.close();
  });

  it('should handle complete retry request flow', async () => {
    // Create update that some stations miss
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Emergency alert'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL']
    });

    // Simulate KB2DEF and KC3GHI received it
    await cacheManager.storeAt('KB2DEF', update);
    await cacheManager.storeAt('KC3GHI', update);

    // KD4JKL missed it and requests retry
    const retryRequest = await retryCoordinator.requestRetry({
      updateId: update.id,
      version: 1,
      requester: 'KD4JKL',
      location: 'EM48'
    });

    expect(retryRequest.requestId).toBeDefined();
    expect(retryRequest.coordinationWindow).toBeGreaterThanOrEqual(10);
    expect(retryRequest.coordinationWindow).toBeLessThanOrEqual(30);

    // Should identify holders who can fulfill
    const holders = await retryCoordinator.findHolders(update.id);
    expect(holders).toContain('KB2DEF');
    expect(holders).toContain('KC3GHI');
  });

  it('should coordinate multiple retry requests to avoid collisions', async () => {
    const update = await updateManager.create({
      category: 'weather',
      priority: 3,
      data: new TextEncoder().encode('Weather update'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI', 'KD4JKL', 'KE5MNO']
    });

    // Only KB2DEF has it
    await cacheManager.storeAt('KB2DEF', update);

    // Multiple stations request retry
    const requests = await Promise.all([
      retryCoordinator.requestRetry({
        updateId: update.id,
        version: 1,
        requester: 'KC3GHI'
      }),
      retryCoordinator.requestRetry({
        updateId: update.id,
        version: 1,
        requester: 'KD4JKL'
      }),
      retryCoordinator.requestRetry({
        updateId: update.id,
        version: 1,
        requester: 'KE5MNO'
      })
    ]);

    // Each should get different coordination window
    const windows = requests.map(r => r.coordinationWindow);
    const uniqueWindows = new Set(windows);
    expect(uniqueWindows.size).toBeGreaterThan(1);

    // Windows should be within range
    windows.forEach(w => {
      expect(w).toBeGreaterThanOrEqual(10);
      expect(w).toBeLessThanOrEqual(30);
    });
  });

  it('should authenticate retry requests with ECDSA', async () => {
    const update = await updateManager.create({
      category: 'routine',
      priority: 5,
      data: new TextEncoder().encode('Routine message'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF']
    });

    // Valid signature should succeed
    const validRequest = await retryCoordinator.requestRetry({
      updateId: update.id,
      version: 1,
      requester: 'KB2DEF',
      signature: 'valid-ecdsa-signature' // Would be real ECDSA
    });
    expect(validRequest.requestId).toBeDefined();

    // Invalid signature should fail
    await expect(
      retryCoordinator.requestRetry({
        updateId: update.id,
        version: 1,
        requester: 'KC3GHI',
        signature: 'invalid-signature'
      })
    ).rejects.toThrow('Invalid signature');

    // Unlicensed station should fail
    await expect(
      retryCoordinator.requestRetry({
        updateId: update.id,
        version: 1,
        requester: 'UNLICENSED-001',
        signature: 'any-signature'
      })
    ).rejects.toThrow('unlicensed station');
  });

  it('should mark retry as fulfilled when completed', async () => {
    const update = await updateManager.create({
      category: 'emergency',
      priority: 0,
      data: new TextEncoder().encode('Test'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    await cacheManager.storeAt('KB2DEF', update);

    const request = await retryCoordinator.requestRetry({
      updateId: update.id,
      version: 1,
      requester: 'KC3GHI'
    });

    // KB2DEF fulfills the retry
    await retryCoordinator.fulfillRetry({
      requestId: request.requestId,
      fulfiller: 'KB2DEF',
      mode: 'RF'
    });

    // Check status
    const status = await retryCoordinator.getRequestStatus(request.requestId);
    expect(status.fulfilled).toBe(true);
    expect(status.fulfiller).toBe('KB2DEF');
    expect(status.mode).toBe('RF');
  });

  it('should use coordination window to schedule retransmission', async () => {
    vi.useFakeTimers();

    const update = await updateManager.create({
      category: 'safety',
      priority: 1,
      data: new TextEncoder().encode('Safety alert'),
      originator: 'KA1ABC',
      subscribers: ['KB2DEF', 'KC3GHI']
    });

    await cacheManager.storeAt('KB2DEF', update);

    const request = await retryCoordinator.requestRetry({
      updateId: update.id,
      version: 1,
      requester: 'KC3GHI'
    });

    const transmitSpy = vi.fn();
    retryCoordinator.on('transmit', transmitSpy);

    // Should not transmit immediately
    expect(transmitSpy).not.toHaveBeenCalled();

    // Advance to coordination window
    vi.advanceTimersByTime(request.coordinationWindow * 1000);

    // Should trigger transmission
    expect(transmitSpy).toHaveBeenCalledWith({
      updateId: update.id,
      fulfiller: expect.any(String)
    });

    vi.useRealTimers();
  });
});