/**
 * T037: ContentRegistry class for client-side beacon storage
 */

import { openDB, IDBPDatabase } from 'idb';
import { ConsolidatedBeacon, PathRecord, PriorityTier } from './types.js';

export class ContentRegistry {
  private db: IDBPDatabase | null = null;
  private maxStorage: number;
  private syncUrl: string;
  private ws: WebSocket | null = null;

  constructor(config: {
    maxStorage?: number;
    syncUrl?: string;
  } = {}) {
    this.maxStorage = config.maxStorage || 50 * 1024 * 1024; // 50MB default
    this.syncUrl = config.syncUrl || 'ws://localhost:8080';
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    this.db = await openDB('cq-registry', 1, {
      upgrade(db) {
        // Create beacon store
        const beaconStore = db.createObjectStore('beacons', {
          keyPath: 'contentHash'
        });

        // Create indexes
        beaconStore.createIndex('priority-time', ['priorityTier', 'expiresAt']);
        beaconStore.createIndex('callsign', 'callsign');
        beaconStore.createIndex('lastHeard', 'lastHeard');
      }
    });

    // Start expiration timer
    setInterval(() => this.expireContent(), 60000); // Every minute
  }

  /**
   * Connect to WebSocket for sync
   */
  async connect(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.syncUrl);

      this.ws.onopen = () => {
        console.log('Connected to content registry sync');
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = async (event) => {
        await this.handleSyncMessage(event.data);
      };
    });
  }

  /**
   * Handle incoming sync messages
   */
  private async handleSyncMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      if (message.type === 'beacon-update') {
        await this.storeBeacon(message.beacon);
      } else if (message.type === 'batch-update') {
        for (const beacon of message.beacons) {
          await this.storeBeacon(beacon);
        }
      }
    } catch (error) {
      console.error('Sync message error:', error);
    }
  }

  /**
   * Store beacon in IndexedDB
   */
  async storeBeacon(beacon: ConsolidatedBeacon): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Apply client-side TTL (more aggressive than server)
    beacon.expiresAt = this.calculateClientExpiry(beacon.priorityTier);

    const tx = this.db.transaction('beacons', 'readwrite');

    // Check for existing beacon
    const existing = await tx.store.get(beacon.contentHash);

    if (existing) {
      // Merge paths
      beacon.paths = this.consolidatePaths(existing.paths, beacon.paths);
    }

    await tx.store.put(beacon);
    await tx.done;

    // Check storage limits
    await this.enforceStorageLimit();
  }

  /**
   * Calculate client-side expiration (shorter than server)
   */
  private calculateClientExpiry(priorityTier: PriorityTier): Date {
    const now = new Date();
    const ttlHours: Record<PriorityTier, number> = {
      [PriorityTier.P0_Emergency]: 24,     // 24 hours
      [PriorityTier.P1_Infrastructure]: 12, // 12 hours
      [PriorityTier.P2_Logistics]: 6,       // 6 hours
      [PriorityTier.P3_Community]: 12,      // 12 hours
      [PriorityTier.P4_Operational]: 3,     // 3 hours
      [PriorityTier.P5_Routine]: 1          // 1 hour
    };

    const hours = ttlHours[priorityTier] || 1;
    return new Date(now.getTime() + (hours * 3600000));
  }

  /**
   * Consolidate paths from multiple sources
   */
  private consolidatePaths(existing: PathRecord[], incoming: PathRecord[]): PathRecord[] {
    const pathMap = new Map<string, PathRecord>();

    // Add existing paths
    for (const path of existing) {
      const key = path.path.join('-');
      pathMap.set(key, path);
    }

    // Merge incoming paths
    for (const path of incoming) {
      const key = path.path.join('-');
      const existing = pathMap.get(key);

      if (existing && path.lastHeard > existing.lastHeard) {
        pathMap.set(key, path);
      } else if (!existing) {
        pathMap.set(key, path);
      }
    }

    // Sort by quality and limit to 3 paths (client storage optimization)
    return Array.from(pathMap.values())
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, 3);
  }

  /**
   * Query content by priority
   */
  async getByPriority(priority: PriorityTier): Promise<ConsolidatedBeacon[]> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('beacons', 'readonly');
    const index = tx.store.index('priority-time');
    const range = IDBKeyRange.bound([priority, new Date(0)], [priority, new Date(9999999999999)]);

    return index.getAll(range);
  }

  /**
   * Get all content
   */
  async getAll(): Promise<ConsolidatedBeacon[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.getAll('beacons');
  }

  /**
   * Get specific content by hash
   */
  async getContent(contentHash: string): Promise<ConsolidatedBeacon | null> {
    if (!this.db) throw new Error('Database not initialized');

    const beacon = await this.db.get('beacons', contentHash);
    return beacon || null;
  }

  /**
   * Expire old content
   */
  async expireContent(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date();
    const tx = this.db.transaction('beacons', 'readwrite');
    const index = tx.store.index('priority-time');
    let deleted = 0;

    // Use cursor to iterate and delete
    for await (const cursor of index.iterate()) {
      if (cursor.value.expiresAt < now) {
        await cursor.delete();
        deleted++;
      }
    }

    await tx.done;
    return deleted;
  }

  /**
   * Enforce storage limit
   */
  async enforceStorageLimit(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Estimate storage usage
    const usage = await this.estimateUsage();

    if (usage > this.maxStorage * 0.9) {
      // Delete lowest priority, oldest content
      const tx = this.db.transaction('beacons', 'readwrite');
      const index = tx.store.index('priority-time');

      // Delete bottom 20% to make room
      const toDelete = Math.floor((await tx.store.count()) * 0.2);
      let deleted = 0;

      // Iterate in reverse priority order
      for await (const cursor of index.iterate(null, 'prev')) {
        if (deleted >= toDelete) break;
        if (cursor.value.priorityTier >= PriorityTier.P4_Operational) {
          await cursor.delete();
          deleted++;
        }
      }

      await tx.done;
    }
  }

  /**
   * Estimate storage usage
   */
  async estimateUsage(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }

    // Fallback: count entries * average size
    if (!this.db) return 0;
    const count = await this.db.count('beacons');
    return count * 2048; // Assume 2KB average
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    bytesUsed: number;
    maxBytes: number;
    entryCount: number;
    emergencyCount: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const bytesUsed = await this.estimateUsage();
    const entryCount = await this.db.count('beacons');

    // Count emergency content
    const tx = this.db.transaction('beacons', 'readonly');
    const index = tx.store.index('priority-time');
    const emergencyRange = IDBKeyRange.bound(
      [PriorityTier.P0_Emergency, new Date(0)],
      [PriorityTier.P0_Emergency, new Date(9999999999999)]
    );
    const emergencyCount = await index.count(emergencyRange);

    return {
      bytesUsed,
      maxBytes: this.maxStorage,
      entryCount,
      emergencyCount
    };
  }

  /**
   * Clear all content
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.clear('beacons');
  }

  /**
   * Close database and WebSocket
   */
  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default ContentRegistry;