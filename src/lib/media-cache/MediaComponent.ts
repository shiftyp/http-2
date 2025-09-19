/**
 * MediaComponent Model (T016)
 * 
 * Data model for media components stored in cache,
 * representing files with metadata and transmission state.
 */

export type MediaType = 'image' | 'audio' | 'video' | 'document';
export type TransmissionMode = 'RF' | 'WebRTC' | 'Hybrid';
export type CompressionLevel = 'none' | 'low' | 'medium' | 'high' | 'maximum';

export interface MediaMetadata {
  // Common metadata
  filename: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  checksum?: string;
  created?: Date;
  modified?: Date;
  
  // Media-specific metadata
  width?: number;
  height?: number;
  duration?: number; // seconds
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  pages?: number; // for documents
  
  // User metadata
  title?: string;
  description?: string;
  author?: string;
  tags?: string[];
  location?: {
    lat: number;
    lng: number;
    altitude?: number;
  };
  
  // Technical metadata
  codec?: string;
  colorSpace?: string;
  compression?: string;
  quality?: number;
  progressive?: boolean;
  
  // Radio-specific metadata
  callsign?: string;
  qth?: string;
  frequency?: number;
  mode?: string;
  power?: number;
}

export interface CacheInfo {
  cached: boolean;
  cacheKey: string;
  cacheExpiry?: Date;
  cacheSize?: number;
  lastAccessed?: Date;
  accessCount: number;
  priority: number; // 0-100, higher = keep longer
}

export interface CompressionInfo {
  algorithm: string;
  level: CompressionLevel;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  quality?: number;
  progressive?: boolean;
  duration?: number; // compression time in ms
}

export interface TransmissionInfo {
  mode: TransmissionMode;
  status: 'pending' | 'queued' | 'transmitting' | 'completed' | 'failed';
  progress?: number; // 0-100
  bytesTransmitted?: number;
  totalBytes?: number;
  startedAt?: Date;
  completedAt?: Date;
  destination?: string;
  priority: number; // 0-4 (emergency, high, normal, low, background)
  estimatedTime?: number; // seconds
  actualTime?: number; // seconds
  retries?: number;
  maxRetries?: number;
  lastError?: string;
  chunkInfo?: {
    total: number;
    transmitted: number;
    failed: number;
    size: number;
  };
}

export interface VariantInfo {
  type: 'thumbnail' | 'preview' | 'compressed' | 'keyframe';
  url: string;
  size: number;
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
}

/**
 * Main MediaComponent interface
 */
export interface MediaComponent {
  // Identifiers
  id: string;
  url: string;
  filename: string;
  
  // Core properties
  type: MediaType;
  mimeType: string;
  size: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
  uploadedAt?: Date;
  
  // Content and metadata
  metadata: MediaMetadata;
  
  // Caching information
  cache: CacheInfo;
  
  // Compression details
  compression?: CompressionInfo;
  
  // Transmission tracking
  transmission?: TransmissionInfo;
  
  // Alternative versions
  variants?: VariantInfo[];
  
  // FCC compliance
  fccCompliant: boolean;
  contentWarnings?: string[];
  
  // Bandwidth optimization
  bandwidthOptimized: boolean;
  targetBandwidth?: number; // bytes
  
  // Access control
  public: boolean;
  permissions?: {
    read: string[]; // callsigns
    write: string[];
    transmit: string[];
  };
}

/**
 * Media component factory functions
 */
export class MediaComponentFactory {
  /**
   * Create a new MediaComponent from uploaded file
   */
  static fromUpload(
    file: File | Blob,
    filename: string,
    metadata: Partial<MediaMetadata> = {}
  ): MediaComponent {
    const id = this.generateId();
    const type = this.detectType(file.type);
    
    return {
      id,
      url: `/media/${id}`,
      filename,
      type,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date(),
      uploadedAt: new Date(),
      metadata: {
        filename,
        mimeType: file.type,
        size: file.size,
        created: new Date(),
        ...metadata
      },
      cache: {
        cached: false,
        cacheKey: `media:${id}`,
        accessCount: 0,
        priority: 50
      },
      fccCompliant: this.checkFCCCompliance(file.type, metadata),
      bandwidthOptimized: false,
      public: true
    };
  }
  
  /**
   * Create thumbnail variant
   */
  static createThumbnail(
    original: MediaComponent,
    thumbnailBlob: Blob,
    dimensions: { width: number; height: number }
  ): VariantInfo {
    return {
      type: 'thumbnail',
      url: `/media/thumb-${original.id}`,
      size: thumbnailBlob.size,
      width: dimensions.width,
      height: dimensions.height,
      format: 'jpeg',
      quality: 60
    };
  }
  
  /**
   * Create compressed variant
   */
  static createCompressed(
    original: MediaComponent,
    compressedBlob: Blob,
    compressionInfo: CompressionInfo
  ): MediaComponent {
    const compressed = { ...original };
    compressed.id = this.generateId();
    compressed.url = `/media/${compressed.id}`;
    compressed.size = compressedBlob.size;
    compressed.compression = compressionInfo;
    compressed.bandwidthOptimized = true;
    compressed.updatedAt = new Date();
    
    return compressed;
  }
  
  /**
   * Generate unique media ID
   */
  private static generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `media_${timestamp}_${random}`;
  }
  
  /**
   * Detect media type from MIME type
   */
  private static detectType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'document';
    return 'document';
  }
  
  /**
   * Check FCC Part 97 compliance
   */
  private static checkFCCCompliance(
    mimeType: string,
    metadata: Partial<MediaMetadata>
  ): boolean {
    // Music files are prohibited in amateur radio
    const musicTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav',
      'audio/flac', 'audio/aac', 'audio/ogg'
    ];
    
    if (musicTypes.includes(mimeType)) {
      return false;
    }
    
    // Check for copyrighted content indicators
    const prohibitedTags = ['music', 'song', 'album', 'artist', 'copyrighted'];
    const tags = metadata.tags || [];
    
    return !tags.some(tag => 
      prohibitedTags.includes(tag.toLowerCase())
    );
  }
}

/**
 * Media component utilities
 */
export class MediaComponentUtils {
  /**
   * Calculate transmission time estimate
   */
  static estimateTransmissionTime(
    component: MediaComponent,
    dataRate: number = 1200 // bps
  ): number {
    const totalBits = component.size * 8;
    return Math.ceil(totalBits / dataRate);
  }
  
  /**
   * Check if component needs compression
   */
  static needsCompression(
    component: MediaComponent,
    maxSize: number = 2048 // 2KB default for radio
  ): boolean {
    return component.size > maxSize && !component.bandwidthOptimized;
  }
  
  /**
   * Get optimal compression level for target size
   */
  static getOptimalCompressionLevel(
    currentSize: number,
    targetSize: number
  ): CompressionLevel {
    const ratio = targetSize / currentSize;
    
    if (ratio > 0.8) return 'low';
    if (ratio > 0.5) return 'medium';
    if (ratio > 0.3) return 'high';
    return 'maximum';
  }
  
  /**
   * Calculate cache priority based on usage
   */
  static calculateCachePriority(
    component: MediaComponent,
    factors: {
      accessFrequency: number;
      recency: number;
      size: number;
      type: MediaType;
    }
  ): number {
    let priority = 50; // Base priority
    
    // Boost for frequent access
    priority += Math.min(factors.accessFrequency * 10, 30);
    
    // Boost for recent access
    priority += Math.min(factors.recency * 20, 20);
    
    // Penalty for large files
    priority -= Math.min(factors.size / 1024, 10); // 1 point per KB
    
    // Type-based adjustments
    const typeBoosts = {
      image: 5,
      document: 10,
      audio: 0,
      video: -5
    };
    priority += typeBoosts[factors.type] || 0;
    
    return Math.max(0, Math.min(100, priority));
  }
  
  /**
   * Generate cache key
   */
  static generateCacheKey(component: MediaComponent): string {
    const hash = component.metadata.checksum || component.id;
    return `media:${component.type}:${hash}:${component.size}`;
  }
  
  /**
   * Check if component is suitable for transmission mode
   */
  static isSuitableForMode(
    component: MediaComponent,
    mode: TransmissionMode
  ): boolean {
    switch (mode) {
      case 'RF':
        // RF mode has strict size and compliance requirements
        return component.fccCompliant && 
               component.size <= 5 * 1024 * 1024; // 5MB max
      
      case 'WebRTC':
        // WebRTC can handle larger files
        return component.size <= 100 * 1024 * 1024; // 100MB max
      
      case 'Hybrid':
        // Hybrid mode is flexible
        return true;
      
      default:
        return false;
    }
  }
  
  /**
   * Format file size for display
   */
  static formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }
  
  /**
   * Get component summary for UI
   */
  static getSummary(component: MediaComponent): {
    displayName: string;
    size: string;
    type: string;
    status: string;
    progress?: number;
  } {
    return {
      displayName: component.metadata.title || component.filename,
      size: this.formatSize(component.size),
      type: component.type.toUpperCase(),
      status: component.transmission?.status || 'ready',
      progress: component.transmission?.progress
    };
  }
}

export default MediaComponent;
