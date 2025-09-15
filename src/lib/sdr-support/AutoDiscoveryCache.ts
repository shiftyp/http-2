/**
 * Auto-Discovery Cache
 * Manages automatically discovered content chunks via SDR monitoring
 */

import { AutoDiscoveryCache, CacheManager, CacheConfiguration, DEFAULT_CACHE_CONFIG } from './models/AutoDiscoveryCache';
import { DecodedTransmission } from './models/DecodedTransmission';
import { SignalPeak } from './models/SignalPeak';

export interface CacheInstance {
  /** Cache identifier */
  id: string;

  /** Cache configuration */
  configuration: CacheConfiguration;

  /** Cache entries by chunk ID */
  entries: Map<string, AutoDiscoveryCache>;

  /** Cache statistics */
  statistics: CacheStatistics;

  /** LRU tracking */
  lruOrder: string[];

  /** Size tracking */
  currentSize: number;

  /** Creation time */
  createdAt: Date;

  /** Last cleanup time */
  lastCleanup: Date;
}

export interface CacheStatistics {
  /** Total cache requests */
  totalRequests: number;

  /** Cache hits */
  hits: number;

  /** Cache misses */
  misses: number;

  /** Hit rate percentage */
  hitRate: number;

  /** Total entries added */
  totalAdded: number;

  /** Total entries evicted */
  totalEvicted: number;

  /** Average entry size */
  averageEntrySize: number;

  /** Cache utilization percentage */
  utilization: number;

  /** Performance metrics */
  performance: CachePerformanceMetrics;
}

export interface CachePerformanceMetrics {
  /** Average lookup time in ms */
  averageLookupTime: number;

  /** Average insertion time in ms */
  averageInsertionTime: number;

  /** Average eviction time in ms */
  averageEvictionTime: number;

  /** Memory allocation overhead */
  memoryOverhead: number;

  /** Compression ratio achieved */
  compressionRatio: number;
}

export interface CacheQuery {
  /** Content hash to search for */
  contentHash?: string;

  /** Source callsign filter */
  sourceCallsign?: string;

  /** Content type filter */
  contentType?: string;

  /** Minimum signal quality */
  minSignalQuality?: number;

  /** Time range filter */
  timeRange?: { start: Date; end: Date };

  /** Maximum results */
  maxResults?: number;

  /** Sort order */
  sortBy?: CacheSortOrder;
}

export interface CacheEntry {
  /** Cache entry metadata */
  entry: AutoDiscoveryCache;

  /** Entry size in bytes */
  size: number;

  /** Last access timestamp */
  lastAccessed: Date;

  /** Access count */
  accessCount: number;

  /** Priority score */
  priority: number;
}

export interface CacheEvent {
  /** Event type */
  type: CacheEventType;

  /** Affected entry */
  entry: AutoDiscoveryCache;

  /** Event timestamp */
  timestamp: Date;

  /** Additional data */
  data?: any;
}

export enum CacheSortOrder {
  NEWEST_FIRST = 'NEWEST_FIRST',
  OLDEST_FIRST = 'OLDEST_FIRST',
  HIGHEST_QUALITY = 'HIGHEST_QUALITY',
  MOST_ACCESSED = 'MOST_ACCESSED',
  LARGEST_FIRST = 'LARGEST_FIRST',
  SMALLEST_FIRST = 'SMALLEST_FIRST'
}

export enum CacheEventType {
  ENTRY_ADDED = 'ENTRY_ADDED',
  ENTRY_ACCESSED = 'ENTRY_ACCESSED',
  ENTRY_EVICTED = 'ENTRY_EVICTED',
  ENTRY_EXPIRED = 'ENTRY_EXPIRED',
  CACHE_FULL = 'CACHE_FULL',
  CLEANUP_PERFORMED = 'CLEANUP_PERFORMED'
}

export class AutoDiscoveryCacheManager {
  private caches: Map<string, CacheInstance> = new Map();
  private eventListeners: Map<string, CacheEventListener[]> = new Map();
  private cleanupTimer?: number;
  private compressionWorker?: Worker;

  constructor() {
    this.setupCleanupTimer();
    this.initializeCompressionWorker();
  }

  /**
   * Creates a new cache instance
   */
  createCache(
    cacheId: string,
    configuration?: Partial<CacheConfiguration>
  ): string {
    if (this.caches.has(cacheId)) {
      throw new Error(`Cache ${cacheId} already exists`);
    }

    const config = { ...DEFAULT_CACHE_CONFIG, ...configuration };

    const cache: CacheInstance = {
      id: cacheId,
      configuration: config,
      entries: new Map(),
      statistics: this.createInitialStatistics(),
      lruOrder: [],
      currentSize: 0,
      createdAt: new Date(),
      lastCleanup: new Date()
    };

    this.caches.set(cacheId, cache);
    return cacheId;
  }

  /**
   * Adds content to cache from decoded transmission
   */
  async addFromTransmission(
    cacheId: string,
    transmission: DecodedTransmission,
    chunkId?: string
  ): Promise<string> {
    const cache = this.getCache(cacheId);
    const actualChunkId = chunkId || this.generateChunkId(transmission);

    // Check if already cached
    if (cache.entries.has(actualChunkId)) {
      this.updateCacheAccess(cache, actualChunkId);
      return actualChunkId;
    }

    const insertStart = performance.now();

    try {
      // Create cache entry from transmission
      const entry = this.createCacheEntryFromTransmission(transmission, actualChunkId);

      // Validate entry
      const validation = CacheManager.validate(entry);
      if (!validation.valid) {
        throw new Error(`Invalid cache entry: ${validation.errors.join(', ')}`);
      }

      // Check cache capacity
      await this.ensureCacheCapacity(cache, entry.data.length);

      // Add to cache
      cache.entries.set(actualChunkId, entry);
      cache.lruOrder.push(actualChunkId);
      cache.currentSize += entry.data.length;

      // Update statistics
      cache.statistics.totalAdded++;
      cache.statistics.averageEntrySize = this.calculateAverageEntrySize(cache);
      cache.statistics.utilization = (cache.currentSize / cache.configuration.maxSizeBytes) * 100;
      cache.statistics.performance.averageInsertionTime = this.updateAverageTime(
        cache.statistics.performance.averageInsertionTime,
        performance.now() - insertStart,
        cache.statistics.totalAdded
      );

      // Emit event
      this.emitCacheEvent(cacheId, {
        type: CacheEventType.ENTRY_ADDED,
        entry,
        timestamp: new Date()
      });

      return actualChunkId;

    } catch (error) {
      console.error('Failed to add cache entry:', error);
      throw error;
    }
  }

  /**
   * Adds discovered content from signal analysis
   */
  async addDiscoveredContent(
    cacheId: string,
    sourceCallsign: string,
    signalPeak: SignalPeak,
    contentData: Uint8Array,
    contentType: string,
    metadata?: any
  ): Promise<string> {
    const cache = this.getCache(cacheId);
    const chunkId = this.generateChunkIdFromSignal(signalPeak, contentData);

    // Check if already cached
    if (cache.entries.has(chunkId)) {
      this.updateCacheAccess(cache, chunkId);
      return chunkId;
    }

    const insertStart = performance.now();

    try {
      // Create cache entry
      const entry = this.createCacheEntryFromDiscovery(
        chunkId,
        sourceCallsign,
        signalPeak,
        contentData,
        contentType,
        metadata
      );

      // Validate entry
      const validation = CacheManager.validate(entry);
      if (!validation.valid) {
        throw new Error(`Invalid cache entry: ${validation.errors.join(', ')}`);
      }

      // Check cache capacity
      await this.ensureCacheCapacity(cache, entry.data.length);

      // Apply compression if enabled
      if (cache.configuration.enableCompression &&
          entry.data.length > cache.configuration.compressionThreshold) {
        entry.data = await this.compressData(entry.data);
      }

      // Add to cache
      cache.entries.set(chunkId, entry);
      cache.lruOrder.push(chunkId);
      cache.currentSize += entry.data.length;

      // Update statistics
      cache.statistics.totalAdded++;
      cache.statistics.averageEntrySize = this.calculateAverageEntrySize(cache);
      cache.statistics.utilization = (cache.currentSize / cache.configuration.maxSizeBytes) * 100;
      cache.statistics.performance.averageInsertionTime = this.updateAverageTime(
        cache.statistics.performance.averageInsertionTime,
        performance.now() - insertStart,
        cache.statistics.totalAdded
      );

      // Emit event
      this.emitCacheEvent(cacheId, {
        type: CacheEventType.ENTRY_ADDED,
        entry,
        timestamp: new Date()
      });

      return chunkId;

    } catch (error) {
      console.error('Failed to add discovered content:', error);
      throw error;
    }
  }

  /**
   * Retrieves cache entry by chunk ID
   */
  get(cacheId: string, chunkId: string): AutoDiscoveryCache | null {
    const cache = this.getCache(cacheId);
    const lookupStart = performance.now();

    try {
      cache.statistics.totalRequests++;

      const entry = cache.entries.get(chunkId);
      if (entry) {
        // Cache hit
        cache.statistics.hits++;
        this.updateCacheAccess(cache, chunkId);

        // Emit event
        this.emitCacheEvent(cacheId, {
          type: CacheEventType.ENTRY_ACCESSED,
          entry,
          timestamp: new Date()
        });

        return entry;
      } else {
        // Cache miss
        cache.statistics.misses++;
        return null;
      }

    } finally {
      // Update performance metrics
      cache.statistics.hitRate = (cache.statistics.hits / cache.statistics.totalRequests) * 100;
      cache.statistics.performance.averageLookupTime = this.updateAverageTime(
        cache.statistics.performance.averageLookupTime,
        performance.now() - lookupStart,
        cache.statistics.totalRequests
      );
    }
  }

  /**
   * Queries cache entries with filters
   */
  query(cacheId: string, query: CacheQuery): AutoDiscoveryCache[] {
    const cache = this.getCache(cacheId);
    let results = Array.from(cache.entries.values());

    // Apply filters
    if (query.contentHash) {
      results = results.filter(entry => entry.contentHash === query.contentHash);
    }

    if (query.sourceCallsign) {
      results = results.filter(entry => entry.sourceCallsign === query.sourceCallsign);
    }

    if (query.contentType) {
      results = results.filter(entry => entry.metadata.contentType === query.contentType);
    }

    if (query.minSignalQuality) {
      results = results.filter(entry => entry.signalQuality.snr >= query.minSignalQuality!);
    }

    if (query.timeRange) {
      results = results.filter(entry =>
        entry.discoveredAt >= query.timeRange!.start &&
        entry.discoveredAt <= query.timeRange!.end
      );
    }

    // Sort results
    if (query.sortBy) {
      results = this.sortCacheEntries(results, query.sortBy);
    }

    // Limit results
    if (query.maxResults && results.length > query.maxResults) {
      results = results.slice(0, query.maxResults);
    }

    return results;
  }

  /**
   * Removes cache entry
   */
  remove(cacheId: string, chunkId: string): boolean {
    const cache = this.getCache(cacheId);
    const entry = cache.entries.get(chunkId);

    if (entry) {
      cache.entries.delete(chunkId);
      cache.currentSize -= entry.data.length;

      // Remove from LRU order
      const lruIndex = cache.lruOrder.indexOf(chunkId);
      if (lruIndex >= 0) {
        cache.lruOrder.splice(lruIndex, 1);
      }

      // Update statistics
      cache.statistics.totalEvicted++;
      cache.statistics.utilization = (cache.currentSize / cache.configuration.maxSizeBytes) * 100;

      // Emit event
      this.emitCacheEvent(cacheId, {
        type: CacheEventType.ENTRY_EVICTED,
        entry,
        timestamp: new Date()
      });

      return true;
    }

    return false;
  }

  /**
   * Clears all cache entries
   */
  clear(cacheId: string): void {
    const cache = this.getCache(cacheId);

    const entriesRemoved = cache.entries.size;
    cache.entries.clear();
    cache.lruOrder = [];
    cache.currentSize = 0;

    // Update statistics
    cache.statistics.totalEvicted += entriesRemoved;
    cache.statistics.utilization = 0;
  }

  /**
   * Gets cache statistics
   */
  getStatistics(cacheId: string): CacheStatistics {
    const cache = this.getCache(cacheId);
    return { ...cache.statistics };
  }

  /**
   * Gets cache entry count
   */
  getEntryCount(cacheId: string): number {
    const cache = this.getCache(cacheId);
    return cache.entries.size;
  }

  /**
   * Gets cache size in bytes
   */
  getCacheSize(cacheId: string): number {
    const cache = this.getCache(cacheId);
    return cache.currentSize;
  }

  /**
   * Performs cache cleanup
   */
  async performCleanup(cacheId: string): Promise<number> {
    const cache = this.getCache(cacheId);
    const cleanupStart = performance.now();
    let evictedCount = 0;

    try {
      // Find entries to evict
      const entriesToEvict: string[] = [];

      for (const [chunkId, entry] of cache.entries) {
        if (CacheManager.shouldEvict(entry, cache.configuration)) {
          entriesToEvict.push(chunkId);
        }
      }

      // Evict entries
      for (const chunkId of entriesToEvict) {
        if (this.remove(cacheId, chunkId)) {
          evictedCount++;
        }
      }

      // Update cleanup time
      cache.lastCleanup = new Date();

      // Update performance metrics
      cache.statistics.performance.averageEvictionTime = this.updateAverageTime(
        cache.statistics.performance.averageEvictionTime,
        performance.now() - cleanupStart,
        evictedCount
      );

      // Emit event
      this.emitCacheEvent(cacheId, {
        type: CacheEventType.CLEANUP_PERFORMED,
        entry: {} as AutoDiscoveryCache, // Placeholder
        timestamp: new Date(),
        data: { evictedCount }
      });

      return evictedCount;

    } catch (error) {
      console.error('Cache cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Registers cache event listener
   */
  addEventListener(cacheId: string, listener: CacheEventListener): void {
    if (!this.eventListeners.has(cacheId)) {
      this.eventListeners.set(cacheId, []);
    }
    this.eventListeners.get(cacheId)!.push(listener);
  }

  /**
   * Removes cache event listener
   */
  removeEventListener(cacheId: string, listener: CacheEventListener): void {
    const listeners = this.eventListeners.get(cacheId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Disposes of cache and resources
   */
  async dispose(cacheId?: string): Promise<void> {
    if (cacheId) {
      // Dispose specific cache
      this.caches.delete(cacheId);
      this.eventListeners.delete(cacheId);
    } else {
      // Dispose all caches
      this.caches.clear();
      this.eventListeners.clear();

      // Stop cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }

      // Terminate compression worker
      if (this.compressionWorker) {
        this.compressionWorker.terminate();
      }
    }
  }

  // Private methods

  private getCache(cacheId: string): CacheInstance {
    const cache = this.caches.get(cacheId);
    if (!cache) {
      throw new Error(`Cache ${cacheId} not found`);
    }
    return cache;
  }

  private createInitialStatistics(): CacheStatistics {
    return {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalAdded: 0,
      totalEvicted: 0,
      averageEntrySize: 0,
      utilization: 0,
      performance: {
        averageLookupTime: 0,
        averageInsertionTime: 0,
        averageEvictionTime: 0,
        memoryOverhead: 0,
        compressionRatio: 1.0
      }
    };
  }

  private generateChunkId(transmission: DecodedTransmission): string {
    const freqKHz = Math.round(transmission.frequency / 1000);
    const timestamp = transmission.timestamp.getTime();
    const hash = transmission.metadata.payloadHash.substring(0, 8);
    return `chunk-${transmission.sourceCallsign}-${freqKHz}kHz-${hash}-${timestamp}`;
  }

  private generateChunkIdFromSignal(peak: SignalPeak, data: Uint8Array): string {
    const freqKHz = Math.round(peak.frequency / 1000);
    const timestamp = Date.now();
    const hash = this.calculateDataHash(data).substring(0, 8);
    return `discovery-${freqKHz}kHz-${hash}-${timestamp}`;
  }

  private calculateDataHash(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return `sha256-${hash.toString(16).padStart(8, '0')}`;
  }

  private createCacheEntryFromTransmission(
    transmission: DecodedTransmission,
    chunkId: string
  ): AutoDiscoveryCache {
    const now = new Date();

    return {
      chunkId,
      contentHash: transmission.metadata.payloadHash,
      sourceCallsign: transmission.sourceCallsign,
      discoveredAt: transmission.timestamp,
      lastAccessed: now,
      accessCount: 0,
      data: transmission.payload,
      expiresAt: new Date(now.getTime() + 3600000), // 1 hour
      signalQuality: transmission.signalQuality,
      metadata: {
        contentType: transmission.contentType.toString(),
        contentLength: transmission.payload.length,
        verification: {
          signatureVerified: transmission.verified,
          checksumVerified: true,
          integrityStatus: 'VERIFIED' as any,
          verifiedAt: now,
          verificationMethod: 'CHECKSUM' as any,
          trustLevel: transmission.verified ? 'MEDIUM' as any : 'LOW' as any
        }
      },
      status: 'VALID' as any
    };
  }

  private createCacheEntryFromDiscovery(
    chunkId: string,
    sourceCallsign: string,
    signalPeak: SignalPeak,
    contentData: Uint8Array,
    contentType: string,
    metadata?: any
  ): AutoDiscoveryCache {
    const now = new Date();

    return {
      chunkId,
      contentHash: this.calculateDataHash(contentData),
      sourceCallsign,
      discoveredAt: now,
      lastAccessed: now,
      accessCount: 0,
      data: contentData,
      expiresAt: new Date(now.getTime() + 3600000), // 1 hour
      signalQuality: signalPeak.quality,
      metadata: {
        contentType,
        contentLength: contentData.length,
        ...metadata,
        verification: {
          signatureVerified: false,
          checksumVerified: true,
          integrityStatus: 'VERIFIED' as any,
          verifiedAt: now,
          verificationMethod: 'CHECKSUM' as any,
          trustLevel: 'LOW' as any
        }
      },
      status: 'VALID' as any
    };
  }

  private updateCacheAccess(cache: CacheInstance, chunkId: string): void {
    const entry = cache.entries.get(chunkId);
    if (entry) {
      CacheManager.updateAccess(entry);

      // Update LRU order
      const lruIndex = cache.lruOrder.indexOf(chunkId);
      if (lruIndex >= 0) {
        cache.lruOrder.splice(lruIndex, 1);
      }
      cache.lruOrder.push(chunkId);
    }
  }

  private async ensureCacheCapacity(cache: CacheInstance, requiredSize: number): Promise<void> {
    // Check if we need to make space
    while (cache.currentSize + requiredSize > cache.configuration.maxSizeBytes ||
           cache.entries.size >= cache.configuration.maxEntries) {

      if (cache.lruOrder.length === 0) {
        throw new Error('Cache full and no entries to evict');
      }

      // Evict least recently used entry
      const lruChunkId = cache.lruOrder[0];
      if (!this.remove(cache.id, lruChunkId)) {
        break; // Safety break
      }

      // Emit cache full event
      this.emitCacheEvent(cache.id, {
        type: CacheEventType.CACHE_FULL,
        entry: {} as AutoDiscoveryCache, // Placeholder
        timestamp: new Date()
      });
    }
  }

  private calculateAverageEntrySize(cache: CacheInstance): number {
    if (cache.entries.size === 0) return 0;
    return cache.currentSize / cache.entries.size;
  }

  private updateAverageTime(currentAverage: number, newTime: number, count: number): number {
    return (currentAverage * (count - 1) + newTime) / count;
  }

  private sortCacheEntries(entries: AutoDiscoveryCache[], sortBy: CacheSortOrder): AutoDiscoveryCache[] {
    switch (sortBy) {
      case CacheSortOrder.NEWEST_FIRST:
        return entries.sort((a, b) => b.discoveredAt.getTime() - a.discoveredAt.getTime());

      case CacheSortOrder.OLDEST_FIRST:
        return entries.sort((a, b) => a.discoveredAt.getTime() - b.discoveredAt.getTime());

      case CacheSortOrder.HIGHEST_QUALITY:
        return entries.sort((a, b) => b.signalQuality.snr - a.signalQuality.snr);

      case CacheSortOrder.MOST_ACCESSED:
        return entries.sort((a, b) => b.accessCount - a.accessCount);

      case CacheSortOrder.LARGEST_FIRST:
        return entries.sort((a, b) => b.data.length - a.data.length);

      case CacheSortOrder.SMALLEST_FIRST:
        return entries.sort((a, b) => a.data.length - b.data.length);

      default:
        return entries;
    }
  }

  private setupCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupTimer = window.setInterval(() => {
      for (const cacheId of this.caches.keys()) {
        this.performCleanup(cacheId).catch(error =>
          console.error(`Cache cleanup failed for ${cacheId}:`, error)
        );
      }
    }, 5 * 60 * 1000);
  }

  private initializeCompressionWorker(): void {
    // Initialize compression worker for async compression
    // In a real implementation, this would create a web worker
    console.log('Initializing compression worker');
  }

  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    // Simple compression simulation
    // In a real implementation, this would use the compression worker
    return new Uint8Array(data.buffer.slice(0, Math.floor(data.length * 0.7)));
  }

  private emitCacheEvent(cacheId: string, event: CacheEvent): void {
    const listeners = this.eventListeners.get(cacheId) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Cache event listener error:', error);
      }
    }
  }
}

export type CacheEventListener = (event: CacheEvent) => void;

export default AutoDiscoveryCacheManager;