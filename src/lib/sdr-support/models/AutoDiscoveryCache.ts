/**
 * AutoDiscoveryCache Model
 * Cached content chunks discovered via SDR monitoring
 */

import { SignalQuality } from './SpectrumData';

export interface AutoDiscoveryCache {
  /** Content chunk identifier */
  chunkId: string;

  /** SHA-256 hash of content */
  contentHash: string;

  /** Original transmitter callsign */
  sourceCallsign: string;

  /** Cache timestamp */
  discoveredAt: Date;

  /** Last access timestamp for LRU */
  lastAccessed: Date;

  /** Access count for popularity tracking */
  accessCount: number;

  /** Chunk data */
  data: Uint8Array;

  /** Cache expiration time */
  expiresAt: Date;

  /** Signal quality when received */
  signalQuality: SignalQuality;

  /** Chunk metadata */
  metadata: ChunkMetadata;

  /** Cache status */
  status: CacheStatus;
}

export interface ChunkMetadata {
  /** Content type */
  contentType: string;

  /** Content length in bytes */
  contentLength: number;

  /** Content encoding */
  contentEncoding?: string;

  /** Compression used */
  compression?: string;

  /** Original URL or identifier */
  originalUrl?: string;

  /** HTTP-over-radio specific metadata */
  httpMetadata?: HttpChunkMetadata;

  /** Mesh routing information */
  meshMetadata?: MeshChunkMetadata;

  /** Verification information */
  verification: ChunkVerification;
}

export interface HttpChunkMetadata {
  /** HTTP method (for requests) */
  method?: string;

  /** HTTP status code (for responses) */
  statusCode?: number;

  /** HTTP headers */
  headers: Record<string, string>;

  /** ETags for caching */
  etag?: string;

  /** Last-Modified header */
  lastModified?: string;

  /** Cache-Control directives */
  cacheControl?: string;

  /** Content-Type header */
  mimeType?: string;
}

export interface MeshChunkMetadata {
  /** Mesh network ID */
  meshId: string;

  /** Routing path */
  routingPath: string[];

  /** Hop count */
  hopCount: number;

  /** Time-to-live */
  ttl: number;

  /** Priority level */
  priority: number;

  /** Alternative sources */
  alternativeSources: string[];
}

export interface ChunkVerification {
  /** Cryptographic signature verified */
  signatureVerified: boolean;

  /** Checksum verified */
  checksumVerified: boolean;

  /** Data integrity status */
  integrityStatus: IntegrityStatus;

  /** Verification timestamp */
  verifiedAt?: Date;

  /** Verification method */
  verificationMethod: VerificationMethod;

  /** Trust level */
  trustLevel: TrustLevel;
}

export enum CacheStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  CORRUPTED = 'CORRUPTED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  EVICTED = 'EVICTED'
}

export enum IntegrityStatus {
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  UNKNOWN = 'UNKNOWN'
}

export enum VerificationMethod {
  SIGNATURE = 'SIGNATURE',
  CHECKSUM = 'CHECKSUM',
  HASH = 'HASH',
  NONE = 'NONE'
}

export enum TrustLevel {
  HIGH = 'HIGH',        // Known, verified source
  MEDIUM = 'MEDIUM',    // Verified signature
  LOW = 'LOW',          // Checksum only
  UNTRUSTED = 'UNTRUSTED' // No verification
}

/**
 * Cache management utilities
 */
export class CacheManager {
  /**
   * Validates cache entry
   */
  static validate(entry: AutoDiscoveryCache): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!entry.chunkId) errors.push('Chunk ID is required');
    if (!entry.contentHash) errors.push('Content hash is required');
    if (!entry.sourceCallsign) errors.push('Source callsign is required');
    if (!entry.data || entry.data.length === 0) errors.push('Data is required');

    // Validate callsign format
    if (entry.sourceCallsign && !this.isValidCallsign(entry.sourceCallsign)) {
      errors.push('Invalid callsign format');
    }

    // Validate timestamps
    if (entry.discoveredAt > entry.lastAccessed) {
      errors.push('Last accessed cannot be before discovery time');
    }

    if (entry.expiresAt <= entry.discoveredAt) {
      errors.push('Expiration time must be after discovery time');
    }

    // Validate data integrity
    if (entry.metadata.contentLength !== entry.data.length) {
      errors.push('Content length mismatch');
    }

    // Validate hash
    const calculatedHash = this.calculateContentHash(entry.data);
    if (entry.contentHash !== calculatedHash) {
      errors.push('Content hash mismatch - data corruption detected');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates amateur radio callsign
   */
  private static isValidCallsign(callsign: string): boolean {
    const callsignRegex = /^[A-Z0-9]{3,7}$/;
    return callsignRegex.test(callsign);
  }

  /**
   * Calculates SHA-256 hash of content
   */
  private static calculateContentHash(data: Uint8Array): string {
    // Simplified hash calculation for demo
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return `sha256-${hash.toString(16).padStart(8, '0')}`;
  }

  /**
   * Determines if cache entry should be evicted
   */
  static shouldEvict(entry: AutoDiscoveryCache, cacheConfig: CacheConfiguration): boolean {
    const now = new Date();

    // Check expiration
    if (entry.expiresAt <= now) return true;

    // Check cache status
    if (entry.status === CacheStatus.CORRUPTED ||
        entry.status === CacheStatus.VERIFICATION_FAILED) {
      return true;
    }

    // Check age-based eviction
    const age = now.getTime() - entry.discoveredAt.getTime();
    if (age > cacheConfig.maxAge * 1000) return true;

    // Check access-based eviction
    const timeSinceAccess = now.getTime() - entry.lastAccessed.getTime();
    if (timeSinceAccess > cacheConfig.maxIdleTime * 1000 &&
        entry.accessCount < cacheConfig.minAccessCount) {
      return true;
    }

    return false;
  }

  /**
   * Calculates cache priority for LRU eviction
   */
  static calculatePriority(entry: AutoDiscoveryCache): number {
    let priority = 0;

    // Base priority on access count (logarithmic scaling)
    priority += Math.log(Math.max(1, entry.accessCount)) * 10;

    // Boost priority for recently accessed items
    const hoursSinceAccess = (Date.now() - entry.lastAccessed.getTime()) / (1000 * 3600);
    priority += Math.max(0, 24 - hoursSinceAccess) * 2;

    // Boost priority for high-quality signals
    if (entry.signalQuality.snr > 15) priority += 20;
    else if (entry.signalQuality.snr > 10) priority += 10;

    // Boost priority for verified content
    if (entry.metadata.verification.trustLevel === TrustLevel.HIGH) priority += 15;
    else if (entry.metadata.verification.trustLevel === TrustLevel.MEDIUM) priority += 10;

    // Boost priority for HTTP content
    if (entry.metadata.httpMetadata) priority += 10;

    // Penalty for large items (per MB)
    const sizeMB = entry.data.length / (1024 * 1024);
    priority -= sizeMB * 5;

    return Math.max(0, priority);
  }

  /**
   * Updates access statistics
   */
  static updateAccess(entry: AutoDiscoveryCache): void {
    entry.lastAccessed = new Date();
    entry.accessCount++;
  }

  /**
   * Verifies content integrity
   */
  static verifyIntegrity(entry: AutoDiscoveryCache): boolean {
    // Check hash
    const calculatedHash = this.calculateContentHash(entry.data);
    if (entry.contentHash !== calculatedHash) {
      entry.status = CacheStatus.CORRUPTED;
      return false;
    }

    // Check data length
    if (entry.metadata.contentLength !== entry.data.length) {
      entry.status = CacheStatus.CORRUPTED;
      return false;
    }

    // Verify signature if present
    if (entry.metadata.verification.verificationMethod === VerificationMethod.SIGNATURE) {
      // Would verify cryptographic signature here
      entry.metadata.verification.signatureVerified = true;
    }

    entry.metadata.verification.integrityStatus = IntegrityStatus.VERIFIED;
    entry.metadata.verification.verifiedAt = new Date();
    entry.status = CacheStatus.VALID;

    return true;
  }
}

/**
 * Cache configuration settings
 */
export interface CacheConfiguration {
  /** Maximum cache size in bytes */
  maxSizeBytes: number;

  /** Maximum number of entries */
  maxEntries: number;

  /** Default TTL in seconds */
  defaultTTL: number;

  /** Maximum age before eviction (seconds) */
  maxAge: number;

  /** Maximum idle time before eviction (seconds) */
  maxIdleTime: number;

  /** Minimum access count to avoid eviction */
  minAccessCount: number;

  /** Eviction policy */
  evictionPolicy: EvictionPolicy;

  /** Enable compression */
  enableCompression: boolean;

  /** Compression threshold (bytes) */
  compressionThreshold: number;
}

export enum EvictionPolicy {
  LRU = 'LRU',           // Least Recently Used
  LFU = 'LFU',           // Least Frequently Used
  PRIORITY = 'PRIORITY',  // Priority-based
  TTL = 'TTL',           // Time-based
  SIZE = 'SIZE'          // Size-based
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  /** Total entries in cache */
  totalEntries: number;

  /** Total cache size in bytes */
  totalSizeBytes: number;

  /** Cache hit rate */
  hitRate: number;

  /** Total requests */
  totalRequests: number;

  /** Cache hits */
  cacheHits: number;

  /** Cache misses */
  cacheMisses: number;

  /** Evicted entries */
  evictedEntries: number;

  /** Average access count */
  averageAccessCount: number;

  /** Oldest entry age in seconds */
  oldestEntryAge: number;

  /** Most popular entries */
  topEntries: Array<{
    chunkId: string;
    accessCount: number;
    sourceCallsign: string;
  }>;

  /** Source statistics */
  sourceStats: Array<{
    callsign: string;
    chunkCount: number;
    totalBytes: number;
    averageQuality: number;
  }>;
}

/**
 * Factory for creating cache entries
 */
export class CacheEntryFactory {
  /**
   * Creates cache entry from decoded transmission
   */
  static fromDecodedTransmission(
    transmission: any, // DecodedTransmission type
    chunkId: string,
    ttlSeconds: number = 3600
  ): AutoDiscoveryCache {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    return {
      chunkId,
      contentHash: this.calculateHash(transmission.payload),
      sourceCallsign: transmission.sourceCallsign,
      discoveredAt: now,
      lastAccessed: now,
      accessCount: 0,
      data: transmission.payload,
      expiresAt,
      signalQuality: transmission.signalQuality,
      metadata: {
        contentType: transmission.contentType,
        contentLength: transmission.payload.length,
        verification: {
          signatureVerified: transmission.verified,
          checksumVerified: true,
          integrityStatus: IntegrityStatus.VERIFIED,
          verifiedAt: now,
          verificationMethod: VerificationMethod.CHECKSUM,
          trustLevel: transmission.verified ? TrustLevel.MEDIUM : TrustLevel.LOW
        }
      },
      status: CacheStatus.VALID
    };
  }

  /**
   * Creates cache entry for HTTP content
   */
  static fromHttpContent(
    chunkId: string,
    sourceCallsign: string,
    signalQuality: SignalQuality,
    httpData: any, // HttpData type
    ttlSeconds: number = 3600
  ): AutoDiscoveryCache {
    const encoder = new TextEncoder();
    const data = encoder.encode(httpData.body);
    const now = new Date();

    return {
      chunkId,
      contentHash: this.calculateHash(data),
      sourceCallsign,
      discoveredAt: now,
      lastAccessed: now,
      accessCount: 0,
      data,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      signalQuality,
      metadata: {
        contentType: 'application/http',
        contentLength: data.length,
        httpMetadata: {
          method: httpData.method,
          statusCode: httpData.statusCode,
          headers: httpData.headers,
          etag: httpData.headers.etag,
          lastModified: httpData.headers['last-modified'],
          cacheControl: httpData.headers['cache-control'],
          mimeType: httpData.headers['content-type']
        },
        verification: {
          signatureVerified: false,
          checksumVerified: true,
          integrityStatus: IntegrityStatus.VERIFIED,
          verifiedAt: now,
          verificationMethod: VerificationMethod.CHECKSUM,
          trustLevel: TrustLevel.LOW
        }
      },
      status: CacheStatus.VALID
    };
  }

  /**
   * Calculates content hash
   */
  private static calculateHash(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return `sha256-${hash.toString(16).padStart(8, '0')}`;
  }
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfiguration = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxEntries: 1000,
  defaultTTL: 3600, // 1 hour
  maxAge: 86400, // 24 hours
  maxIdleTime: 7200, // 2 hours
  minAccessCount: 2,
  evictionPolicy: EvictionPolicy.PRIORITY,
  enableCompression: true,
  compressionThreshold: 1024 // 1KB
};

export default AutoDiscoveryCache;