/**
 * Media Cache Library
 * 
 * Progressive media caching with IndexedDB storage,
 * partial content support, and bandwidth optimization.
 */

import { openDatabase } from '../database/index.js';

export interface CachedMedia {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  data: Uint8Array;
  chunks?: MediaChunk[];
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
    codec?: string;
  };
  created: Date;
  accessed: Date;
  hits: number;
}

export interface MediaChunk {
  index: number;
  offset: number;
  length: number;
  data: Uint8Array;
  quality?: number; // For progressive encoding
}

export interface CacheOptions {
  maxSize?: number;        // Max cache size in bytes
  maxAge?: number;         // Max age in milliseconds
  progressive?: boolean;   // Enable progressive caching
  prefetch?: boolean;      // Prefetch related media
}

export interface CacheStats {
  totalSize: number;
  itemCount: number;
  hits: number;
  misses: number;
  bandwidth: number; // Bytes saved
}

/**
 * Media Cache Manager
 */
export class MediaCache {
  private db: IDBDatabase | null = null;
  private stats: CacheStats = {
    totalSize: 0,
    itemCount: 0,
    hits: 0,
    misses: 0,
    bandwidth: 0
  };
  private options: Required<CacheOptions>;
  private memCache = new Map<string, CachedMedia>();

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB
      maxAge: options.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
      progressive: options.progressive ?? true,
      prefetch: options.prefetch ?? false
    };
  }

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    this.db = await openDatabase('media-cache', 1, {
      upgrade: (db) => {
        // Media store
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('url', 'url', { unique: true });
          mediaStore.createIndex('accessed', 'accessed');
          mediaStore.createIndex('mimeType', 'mimeType');
        }

        // Chunks store for progressive loading
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', {
            keyPath: ['mediaId', 'index']
          });
          chunkStore.createIndex('mediaId', 'mediaId');
        }
      }
    });

    await this.loadStats();
  }

  /**
   * Store media in cache
   */
  async store(
    url: string,
    data: Uint8Array,
    mimeType: string,
    metadata?: any
  ): Promise<string> {
    const id = this.generateId(url);
    
    // Check size constraints
    if (data.length > this.options.maxSize / 10) {
      // Don't cache items larger than 10% of max cache
      return id;
    }

    // Ensure space
    await this.ensureSpace(data.length);

    const cached: CachedMedia = {
      id,
      url,
      mimeType,
      size: data.length,
      data,
      metadata: metadata || {},
      created: new Date(),
      accessed: new Date(),
      hits: 0
    };

    // Store in IndexedDB
    if (this.db) {
      const tx = this.db.transaction(['media'], 'readwrite');
      await tx.objectStore('media').put(cached);
    }

    // Update memory cache
    this.memCache.set(id, cached);

    // Update stats
    this.stats.totalSize += data.length;
    this.stats.itemCount++;

    return id;
  }

  /**
   * Store media chunk (progressive)
   */
  async storeChunk(
    url: string,
    chunkIndex: number,
    data: Uint8Array,
    offset: number,
    quality?: number
  ): Promise<void> {
    const mediaId = this.generateId(url);
    
    const chunk: MediaChunk = {
      index: chunkIndex,
      offset,
      length: data.length,
      data,
      quality
    };

    if (this.db) {
      const tx = this.db.transaction(['chunks'], 'readwrite');
      await tx.objectStore('chunks').put({
        mediaId,
        ...chunk
      });
    }

    // Update or create media entry
    let media = await this.get(url);
    if (!media) {
      // Create placeholder
      media = {
        id: mediaId,
        url,
        mimeType: 'application/octet-stream',
        size: 0,
        data: new Uint8Array(0),
        chunks: [chunk],
        metadata: {},
        created: new Date(),
        accessed: new Date(),
        hits: 0
      };
    } else {
      media.chunks = media.chunks || [];
      media.chunks.push(chunk);
      media.chunks.sort((a, b) => a.index - b.index);
    }

    // Store updated media
    if (this.db) {
      const tx = this.db.transaction(['media'], 'readwrite');
      await tx.objectStore('media').put(media);
    }
  }

  /**
   * Retrieve media from cache
   */
  async get(url: string): Promise<CachedMedia | null> {
    const id = this.generateId(url);
    
    // Check memory cache first
    if (this.memCache.has(id)) {
      const cached = this.memCache.get(id)!;
      this.recordHit(cached);
      return cached;
    }

    // Check IndexedDB
    if (this.db) {
      const tx = this.db.transaction(['media'], 'readonly');
      const index = tx.objectStore('media').index('url');
      const cached = await index.get(url) as CachedMedia | undefined;
      
      if (cached) {
        // Check age
        const age = Date.now() - cached.created.getTime();
        if (age > this.options.maxAge) {
          await this.remove(url);
          this.stats.misses++;
          return null;
        }

        // Load chunks if progressive
        if (this.options.progressive && (!cached.data || cached.data.length === 0)) {
          cached.data = await this.assembleChunks(id);
        }

        this.memCache.set(id, cached);
        this.recordHit(cached);
        return cached;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Get partial content
   */
  async getRange(
    url: string,
    start: number,
    end: number
  ): Promise<Uint8Array | null> {
    const cached = await this.get(url);
    if (!cached) return null;

    if (cached.data && cached.data.length > 0) {
      // Return range from full data
      return cached.data.slice(start, Math.min(end, cached.data.length));
    }

    // Assemble from chunks
    if (cached.chunks && cached.chunks.length > 0) {
      const result = new Uint8Array(end - start);
      let resultOffset = 0;

      for (const chunk of cached.chunks) {
        if (chunk.offset + chunk.length <= start) continue;
        if (chunk.offset >= end) break;

        const chunkStart = Math.max(0, start - chunk.offset);
        const chunkEnd = Math.min(chunk.length, end - chunk.offset);
        const chunkData = chunk.data.slice(chunkStart, chunkEnd);
        
        result.set(chunkData, resultOffset);
        resultOffset += chunkData.length;
      }

      return result.slice(0, resultOffset);
    }

    return null;
  }

  /**
   * Check if media is cached
   */
  async has(url: string): Promise<boolean> {
    const cached = await this.get(url);
    return cached !== null;
  }

  /**
   * Remove media from cache
   */
  async remove(url: string): Promise<void> {
    const id = this.generateId(url);
    const cached = await this.get(url);
    
    if (cached) {
      // Remove from IndexedDB
      if (this.db) {
        const tx = this.db.transaction(['media', 'chunks'], 'readwrite');
        await tx.objectStore('media').delete(id);
        
        // Remove chunks
        const chunkStore = tx.objectStore('chunks');
        const chunkIndex = chunkStore.index('mediaId');
        const chunks = await chunkIndex.getAllKeys(id);
        for (const key of chunks) {
          await chunkStore.delete(key);
        }
      }

      // Update stats
      this.stats.totalSize -= cached.size;
      this.stats.itemCount--;

      // Remove from memory cache
      this.memCache.delete(id);
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    if (this.db) {
      const tx = this.db.transaction(['media', 'chunks'], 'readwrite');
      await tx.objectStore('media').clear();
      await tx.objectStore('chunks').clear();
    }

    this.memCache.clear();
    this.stats = {
      totalSize: 0,
      itemCount: 0,
      hits: 0,
      misses: 0,
      bandwidth: 0
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Prefetch media
   */
  async prefetch(urls: string[]): Promise<void> {
    if (!this.options.prefetch) return;

    for (const url of urls) {
      if (await this.has(url)) continue;

      // Fetch and cache (placeholder)
      // In real implementation, would fetch from network
      const placeholder = new Uint8Array(0);
      await this.store(url, placeholder, 'application/octet-stream');
    }
  }

  /**
   * Generate cache ID
   */
  private generateId(url: string): string {
    // Simple hash for ID
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `media_${Math.abs(hash)}`;
  }

  /**
   * Record cache hit
   */
  private recordHit(cached: CachedMedia): void {
    cached.hits++;
    cached.accessed = new Date();
    this.stats.hits++;
    this.stats.bandwidth += cached.size;

    // Update in background
    if (this.db) {
      const tx = this.db.transaction(['media'], 'readwrite');
      tx.objectStore('media').put(cached).catch(() => {});
    }
  }

  /**
   * Ensure cache space
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    if (this.stats.totalSize + requiredSize <= this.options.maxSize) {
      return;
    }

    // LRU eviction
    if (this.db) {
      const tx = this.db.transaction(['media'], 'readonly');
      const index = tx.objectStore('media').index('accessed');
      const items = await index.getAll();
      
      // Sort by access time
      items.sort((a, b) => a.accessed.getTime() - b.accessed.getTime());
      
      // Remove oldest items
      for (const item of items) {
        if (this.stats.totalSize + requiredSize <= this.options.maxSize) {
          break;
        }
        await this.remove(item.url);
      }
    }
  }

  /**
   * Assemble chunks
   */
  private async assembleChunks(mediaId: string): Promise<Uint8Array> {
    if (!this.db) return new Uint8Array(0);

    const tx = this.db.transaction(['chunks'], 'readonly');
    const index = tx.objectStore('chunks').index('mediaId');
    const chunks = await index.getAll(mediaId) as MediaChunk[];
    
    if (chunks.length === 0) return new Uint8Array(0);

    // Sort by offset
    chunks.sort((a, b) => a.offset - b.offset);

    // Calculate total size
    const totalSize = chunks[chunks.length - 1].offset + chunks[chunks.length - 1].length;
    const result = new Uint8Array(totalSize);

    // Assemble
    for (const chunk of chunks) {
      result.set(chunk.data, chunk.offset);
    }

    return result;
  }

  /**
   * Load stats from storage
   */
  private async loadStats(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['media'], 'readonly');
    const items = await tx.objectStore('media').getAll() as CachedMedia[];
    
    this.stats.itemCount = items.length;
    this.stats.totalSize = items.reduce((sum, item) => sum + item.size, 0);
  }
}

// Export singleton instance
export const mediaCache = new MediaCache();