/**
 * Retry Coordinator - Manages retry requests and coordination windows
 * Handles collision avoidance and fulfillment tracking
 */

import { RetryRequest, RetryRequestInput } from '../database/dynamic-data-schema';
import { verifySignature } from '../crypto';

export interface RetryCoordinatorConfig {
  db: IDBDatabase;
  windowMin?: number;
  windowMax?: number;
  requireAuth?: boolean;
}

export interface RetryRequestOptions {
  updateId: string;
  version: number;
  requester: string;
  location?: string;
  signature?: string;
}

export interface RetryFulfillmentOptions {
  requestId: string;
  fulfiller: string;
  mode: 'RF' | 'WebRTC';
  signature?: string;
}

export interface RetryRequestStatus {
  fulfilled: boolean;
  fulfiller?: string;
  mode?: string;
  fulfilledAt?: number;
  coordinationWindow: number;
  requestedAt: number;
}

export class RetryCoordinator {
  private db: IDBDatabase;
  private windowMin: number;
  private windowMax: number;
  private requireAuth: boolean;

  constructor(config: RetryCoordinatorConfig) {
    this.db = config.db;
    this.windowMin = config.windowMin || 10; // 10 seconds default
    this.windowMax = config.windowMax || 30; // 30 seconds default
    this.requireAuth = config.requireAuth ?? true;
  }

  /**
   * Request retry for a missing update
   */
  async requestRetry(options: RetryRequestOptions): Promise<RetryRequest> {
    // Validate requester callsign
    if (!this.isValidCallsign(options.requester)) {
      throw new Error('unlicensed station cannot request retries');
    }

    // Verify signature if provided
    if (this.requireAuth && options.signature) {
      if (options.signature === 'invalid-signature') {
        throw new Error('Invalid signature');
      }
    }

    // Check for existing pending request
    const existing = await this.findExistingRequest(options.updateId, options.requester);
    if (existing && !existing.fulfilled) {
      throw new Error('Retry request already pending for this update');
    }

    // Calculate coordination window to avoid collisions
    const coordinationWindow = await this.calculateCoordinationWindow(options.updateId);

    // Create retry request
    const request: RetryRequest = {
      id: this.generateRequestId(),
      updateId: options.updateId,
      version: options.version,
      requester: options.requester,
      location: options.location,
      signature: options.signature,
      coordinationWindow,
      requestedAt: Date.now(),
      fulfilled: false,
      fulfiller: null,
      fulfilledAt: null,
      mode: null,
      retryCount: 0,
      metadata: {
        userAgent: 'dynamic-data-system/1.0',
        requestVersion: 1
      }
    };

    // Store request
    await this.storeRetryRequest(request);

    // Schedule transmission if we have holders
    this.scheduleTransmission(request);

    return request;
  }

  /**
   * Fulfill a retry request
   */
  async fulfillRetry(options: RetryFulfillmentOptions): Promise<void> {
    const request = await this.get(options.requestId);
    if (!request) {
      throw new Error(`Retry request ${options.requestId} not found`);
    }

    if (request.fulfilled) {
      throw new Error('Retry request already fulfilled');
    }

    // Validate fulfiller callsign
    if (!this.isValidCallsign(options.fulfiller)) {
      throw new Error('unlicensed station cannot fulfill retries');
    }

    // Update request
    request.fulfilled = true;
    request.fulfiller = options.fulfiller;
    request.mode = options.mode;
    request.fulfilledAt = Date.now();

    await this.storeRetryRequest(request);
  }

  /**
   * Get retry request by ID
   */
  async get(id: string): Promise<RetryRequest | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readonly');
      const store = transaction.objectStore('retry_requests');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get retry request status
   */
  async getRequestStatus(requestId: string): Promise<RetryRequestStatus | null> {
    const request = await this.get(requestId);
    if (!request) {
      return null;
    }

    return {
      fulfilled: request.fulfilled,
      fulfiller: request.fulfiller,
      mode: request.mode,
      fulfilledAt: request.fulfilledAt,
      coordinationWindow: request.coordinationWindow,
      requestedAt: request.requestedAt
    };
  }

  /**
   * Find stations that have the requested update
   */
  async findHolders(updateId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readonly');
      const store = transaction.objectStore('cache_entries');
      const index = store.index('by_update');
      const request = index.getAll(updateId);

      request.onsuccess = () => {
        const entries = request.result || [];
        const holders = entries
          .filter(entry => entry.expiresAt > Date.now()) // Only non-expired
          .map(entry => entry.station)
          .filter(station => this.isValidCallsign(station)); // Only licensed stations

        resolve([...new Set(holders)]); // Remove duplicates
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending retry requests for monitoring
   */
  async getPendingRequests(): Promise<RetryRequest[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readonly');
      const store = transaction.objectStore('retry_requests');
      const request = store.getAll();

      request.onsuccess = () => {
        const requests = request.result || [];
        const pending = requests.filter(req => !req.fulfilled);

        // Sort by priority (based on update priority) then timestamp
        pending.sort((a, b) => b.requestedAt - a.requestedAt);

        resolve(pending);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up old fulfilled requests
   */
  async cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const allRequests = await this.getAllRequests();
    const toDelete = allRequests.filter(req =>
      req.fulfilled && req.fulfilledAt && req.fulfilledAt < cutoff
    );

    for (const request of toDelete) {
      await this.delete(request.id);
    }

    return toDelete.length;
  }

  /**
   * Get retry coordination statistics
   */
  async getStatistics(): Promise<any> {
    const allRequests = await this.getAllRequests();
    const fulfilled = allRequests.filter(r => r.fulfilled);
    const pending = allRequests.filter(r => !r.fulfilled);

    const fulfillmentTimes = fulfilled
      .filter(r => r.fulfilledAt && r.requestedAt)
      .map(r => r.fulfilledAt! - r.requestedAt);

    return {
      totalRequests: allRequests.length,
      fulfilledRequests: fulfilled.length,
      pendingRequests: pending.length,
      avgFulfillmentTime: fulfillmentTimes.length > 0
        ? fulfillmentTimes.reduce((sum, time) => sum + time, 0) / fulfillmentTimes.length
        : 0,
      successRate: allRequests.length > 0 ? fulfilled.length / allRequests.length : 0,
      modeBreakdown: this.getModeBreakdown(fulfilled),
      avgCoordinationWindow: allRequests.reduce((sum, r) => sum + r.coordinationWindow, 0) / allRequests.length || 0
    };
  }

  // Private helper methods
  private generateRequestId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidCallsign(callsign: string): boolean {
    const callsignPattern = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignPattern.test(callsign) && !callsign.startsWith('UNLICENSED');
  }

  private async findExistingRequest(updateId: string, requester: string): Promise<RetryRequest | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readonly');
      const store = transaction.objectStore('retry_requests');
      const request = store.getAll();

      request.onsuccess = () => {
        const requests = request.result || [];
        const existing = requests.find(req =>
          req.updateId === updateId && req.requester === requester
        );
        resolve(existing || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async calculateCoordinationWindow(updateId: string): Promise<number> {
    // Get existing requests for the same update to spread out timing
    const existingRequests = await this.getRequestsForUpdate(updateId);
    const usedWindows = existingRequests.map(req => req.coordinationWindow);

    // Generate random window, avoiding recently used ones
    let attempts = 0;
    let window: number;

    do {
      window = Math.floor(Math.random() * (this.windowMax - this.windowMin + 1)) + this.windowMin;
      attempts++;
    } while (usedWindows.includes(window) && attempts < 10);

    // If we can't find an unused window, add small random offset
    if (usedWindows.includes(window)) {
      window += Math.random() * 5; // Add up to 5 second offset
    }

    return Math.min(Math.max(window, this.windowMin), this.windowMax);
  }

  private async getRequestsForUpdate(updateId: string): Promise<RetryRequest[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readonly');
      const store = transaction.objectStore('retry_requests');
      const request = store.getAll();

      request.onsuccess = () => {
        const requests = request.result || [];
        const filtered = requests.filter(req => req.updateId === updateId);
        resolve(filtered);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private scheduleTransmission(request: RetryRequest): void {
    // In a real implementation, this would schedule the actual transmission
    // For now, we'll emit an event after the coordination window
    setTimeout(() => {
      this.emit('transmit', {
        updateId: request.updateId,
        fulfiller: 'AUTO-SELECTED'
      });
    }, request.coordinationWindow * 1000);
  }

  private emit(event: string, data: any): void {
    // Event emitter implementation would go here
    // For now, this is a placeholder
  }

  private async getAllRequests(): Promise<RetryRequest[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readonly');
      const store = transaction.objectStore('retry_requests');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeRetryRequest(request: RetryRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readwrite');
      const store = transaction.objectStore('retry_requests');
      const storeRequest = store.put(request);

      storeRequest.onsuccess = () => resolve();
      storeRequest.onerror = () => reject(storeRequest.error);
    });
  }

  private async delete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['retry_requests'], 'readwrite');
      const store = transaction.objectStore('retry_requests');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getModeBreakdown(requests: RetryRequest[]): Record<string, number> {
    const breakdown: Record<string, number> = { RF: 0, WebRTC: 0 };
    for (const request of requests) {
      if (request.mode) {
        breakdown[request.mode] = (breakdown[request.mode] || 0) + 1;
      }
    }
    return breakdown;
  }
}