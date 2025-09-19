/**
 * Content Cache Library
 * Manages cached content with priority tiers and spectrum discovery
 */

export { ContentCache } from './ContentCache.js';
export { ChunkStore } from './ChunkStore.js';

// Data Models
export type { CachedContent } from './models/CachedContent.js';
export type { CacheStrategy } from './models/CacheStrategy.js';
export type { StorageQuota } from './models/StorageQuota.js';

/**
 * Content Cache Configuration
 */
export interface ContentCacheConfig {
  maxSize: number; // bytes
  tierPriorities: number[];
  compressionEnabled: boolean;
  autoEviction: boolean;
  spectrumDiscovery: boolean;
  syncInterval: number; // seconds
}

export const DEFAULT_CACHE_CONFIG: ContentCacheConfig = {
  maxSize: 1024 * 1024 * 1024, // 1GB server cache
  tierPriorities: [0, 1, 2, 3, 4, 5], // P0-P5 priority tiers
  compressionEnabled: true,
  autoEviction: true,
  spectrumDiscovery: true,
  syncInterval: 300 // 5 minutes
};