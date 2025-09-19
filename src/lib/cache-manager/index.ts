/**
 * Cache Manager - Priority-based cache management with eviction policies
 * Handles storage optimization and intelligent cache strategies
 */

import { DynamicUpdate, CacheEntry } from '../database/dynamic-data-schema';

export interface CacheManagerConfig {
  db: IDBDatabase;
  maxSize?: number;
  evictionPolicy?: 'lru' | 'priority-lru' | 'priority-only';
}

export interface CacheStatistics {
  totalSize: number;
  usedSize: number;
  freeSpace: number;
  updateCount: number;
  priorityBreakdown: Record<number, number>;
  evictionCount: number;
}

export class CacheManager {
  private db: IDBDatabase;
  private maxSize: number;
  private evictionPolicy: string;
  private evictionCount: number = 0;

  constructor(config: CacheManagerConfig) {
    this.db = config.db;
    this.maxSize = config.maxSize || 100 * 1024 * 1024; // 100MB default
    this.evictionPolicy = config.evictionPolicy || 'priority-lru';
  }

  /**
   * Store update in cache
   */
  async store(update: DynamicUpdate): Promise<void> {
    // Check if we need to make space
    const currentSize = await this.getCurrentSize();
    const requiredSpace = update.compressedSize;

    if (currentSize + requiredSpace > this.maxSize) {
      await this.evictToMakeSpace(requiredSpace, update.priority);
    }

    // Create cache entry
    const entry: CacheEntry = {
      id: this.generateCacheId(),
      updateId: update.id,
      station: 'LOCAL', // This station's cache
      cachedAt: Date.now(),
      expiresAt: update.expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: update.compressedSize,
      priority: update.priority,
      metadata: {
        compressionAlgorithm: update.compressionAlgorithm,
        originalSize: update.originalSize
      }
    };

    await this.storeCacheEntry(entry);
  }

  /**
   * Store update at specific station (for tracking)
   */
  async storeAt(station: string, update: DynamicUpdate): Promise<void> {
    const entry: CacheEntry = {
      id: this.generateCacheId(),
      updateId: update.id,
      station,
      cachedAt: Date.now(),
      expiresAt: update.expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: update.compressedSize,
      priority: update.priority,
      metadata: {
        compressionAlgorithm: update.compressionAlgorithm,
        originalSize: update.originalSize
      }
    };

    await this.storeCacheEntry(entry);
  }

  /**
   * Get update from cache
   */
  async get(updateId: string): Promise<DynamicUpdate | null> {
    // Update access statistics
    await this.updateAccessStats(updateId);

    // Get the actual update
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readonly');
      const store = transaction.objectStore('updates');
      const request = store.get(updateId);

      request.onsuccess = () => {
        const update = request.result;
        if (update && !this.isExpired(update)) {
          resolve(update);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get stations that have this update cached
   */
  async getHolders(updateId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readonly');
      const store = transaction.objectStore('cache_entries');
      const index = store.index('by_update');
      const request = index.getAll(updateId);

      request.onsuccess = () => {
        const entries = request.result || [];
        const holders = entries
          .filter(entry => !this.isExpired({ expiresAt: entry.expiresAt }))
          .map(entry => entry.station);
        resolve([...new Set(holders)]); // Remove duplicates
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readwrite');
      const store = transaction.objectStore('cache_entries');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Run eviction process manually
   */
  async runEviction(): Promise<number> {
    const entries = await this.getAllCacheEntries();
    const expired = entries.filter(entry => this.isExpired({ expiresAt: entry.expiresAt }));

    // Remove expired entries
    for (const entry of expired) {
      await this.deleteCacheEntry(entry.id);
      this.evictionCount++;
    }

    return expired.length;
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<CacheStatistics> {
    const entries = await this.getAllCacheEntries();
    const activeEntries = entries.filter(entry => !this.isExpired({ expiresAt: entry.expiresAt }));

    const totalSize = activeEntries.reduce((sum, entry) => sum + entry.size, 0);
    const priorityBreakdown: Record<number, number> = {};

    for (let i = 0; i <= 5; i++) {
      priorityBreakdown[i] = activeEntries.filter(entry => entry.priority === i).length;
    }

    return {
      totalSize: this.maxSize,
      usedSize: totalSize,
      freeSpace: this.maxSize - totalSize,
      updateCount: activeEntries.length,
      priorityBreakdown,
      evictionCount: this.evictionCount
    };
  }

  // Private helper methods
  private async evictToMakeSpace(requiredSpace: number, newUpdatePriority: number): Promise<void> {
    let spaceFreed = 0;
    const entries = await this.getAllCacheEntries();

    if (this.evictionPolicy === 'priority-lru') {
      // Sort by priority (higher number = lower priority), then by last access
      entries.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority number = evict first
        }
        return a.lastAccessed - b.lastAccessed; // Older access = evict first
      });
    } else if (this.evictionPolicy === 'priority-only') {
      entries.sort((a, b) => b.priority - a.priority);
    } else { // lru
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    }

    for (const entry of entries) {
      // Never evict P0/P1 unless they're expired
      if ((entry.priority === 0 || entry.priority === 1) && !this.isExpired({ expiresAt: entry.expiresAt })) {
        continue;
      }

      // Don't evict higher priority items for lower priority requests
      if (entry.priority < newUpdatePriority) {
        continue;
      }

      await this.deleteCacheEntry(entry.id);
      spaceFreed += entry.size;
      this.evictionCount++;

      if (spaceFreed >= requiredSpace) {
        break;
      }
    }

    if (spaceFreed < requiredSpace) {
      throw new Error('Unable to free sufficient cache space');
    }
  }

  private async getCurrentSize(): Promise<number> {
    const entries = await this.getAllCacheEntries();
    const activeEntries = entries.filter(entry => !this.isExpired({ expiresAt: entry.expiresAt }));
    return activeEntries.reduce((sum, entry) => sum + entry.size, 0);
  }

  private async updateAccessStats(updateId: string): Promise<void> {
    const transaction = this.db.transaction(['cache_entries'], 'readwrite');
    const store = transaction.objectStore('cache_entries');
    const index = store.index('by_update');
    const request = index.getAll(updateId);

    request.onsuccess = () => {
      const entries = request.result || [];
      const localEntry = entries.find(entry => entry.station === 'LOCAL');

      if (localEntry) {
        localEntry.accessCount++;
        localEntry.lastAccessed = Date.now();
        store.put(localEntry);
      }
    };
  }

  private async getAllCacheEntries(): Promise<CacheEntry[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readonly');
      const store = transaction.objectStore('cache_entries');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeCacheEntry(entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readwrite');
      const store = transaction.objectStore('cache_entries');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteCacheEntry(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readwrite');
      const store = transaction.objectStore('cache_entries');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private generateCacheId(): string {
    return `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isExpired(item: { expiresAt: number }): boolean {
    return Date.now() > item.expiresAt;
  }
}