/**
 * Media Codecs Library
 * 
 * Efficient media compression for narrow-band transmission
 * with progressive loading and radio-optimized encoding.
 */

import { JPEGEncoder } from './jpeg.js';
import { OpusEncoder } from './opus.js';
import { WebMEncoder } from './webm.js';
import { PDFEncoder } from './pdf.js';

export interface MediaCodec<T = any> {
  encode(data: T, options?: any): Promise<Uint8Array>;
  decode(data: Uint8Array, options?: any): Promise<T>;
  getMediaType(): string;
  estimateSize(data: T, options?: any): number;
}

export interface EncodingOptions {
  quality?: number;      // 0-100 quality level
  progressive?: boolean; // Enable progressive encoding
  maxSize?: number;     // Maximum output size in bytes
  chunkSize?: number;   // Chunk size for streaming
}

export interface CodecMetrics {
  originalSize: number;
  encodedSize: number;
  compressionRatio: number;
  encodingTime: number;
  quality: number;
}

/**
 * Media Codec Registry
 */
export class MediaCodecRegistry {
  private codecs = new Map<string, MediaCodec>();
  private metrics = new Map<string, CodecMetrics[]>();

  constructor() {
    // Register default codecs
    this.register('image/jpeg', new JPEGEncoder());
    this.register('audio/opus', new OpusEncoder());
    this.register('video/webm', new WebMEncoder());
    this.register('application/pdf', new PDFEncoder());
  }

  /**
   * Register a codec
   */
  register(mimeType: string, codec: MediaCodec): void {
    this.codecs.set(mimeType, codec);
  }

  /**
   * Get codec for MIME type
   */
  getCodec(mimeType: string): MediaCodec | undefined {
    return this.codecs.get(mimeType);
  }

  /**
   * Encode media with appropriate codec
   */
  async encode(
    data: any,
    mimeType: string,
    options?: EncodingOptions
  ): Promise<Uint8Array> {
    const codec = this.getCodec(mimeType);
    if (!codec) {
      throw new Error(`No codec registered for ${mimeType}`);
    }

    const startTime = Date.now();
    const originalSize = this.estimateOriginalSize(data);

    const encoded = await codec.encode(data, options);

    // Record metrics
    const metrics: CodecMetrics = {
      originalSize,
      encodedSize: encoded.length,
      compressionRatio: originalSize / encoded.length,
      encodingTime: Date.now() - startTime,
      quality: options?.quality || 100
    };

    this.recordMetrics(mimeType, metrics);

    return encoded;
  }

  /**
   * Decode media
   */
  async decode(
    data: Uint8Array,
    mimeType: string,
    options?: any
  ): Promise<any> {
    const codec = this.getCodec(mimeType);
    if (!codec) {
      throw new Error(`No codec registered for ${mimeType}`);
    }

    return codec.decode(data, options);
  }

  /**
   * Get optimal quality setting for size constraint
   */
  getOptimalQuality(
    mimeType: string,
    originalSize: number,
    maxSize: number
  ): number {
    const history = this.metrics.get(mimeType) || [];
    
    if (history.length === 0) {
      // Start with conservative estimate
      return Math.min(80, (maxSize / originalSize) * 100);
    }

    // Use historical data to predict quality
    const targetRatio = maxSize / originalSize;
    
    // Find closest historical ratio
    let bestQuality = 80;
    let bestDiff = Infinity;

    for (const metric of history) {
      const ratio = metric.encodedSize / metric.originalSize;
      const diff = Math.abs(ratio - targetRatio);
      
      if (diff < bestDiff) {
        bestDiff = diff;
        bestQuality = metric.quality;
      }
    }

    return bestQuality;
  }

  /**
   * Estimate original size
   */
  private estimateOriginalSize(data: any): number {
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return data.byteLength;
    }
    if (data instanceof Blob) {
      return data.size;
    }
    if (typeof data === 'string') {
      return new TextEncoder().encode(data).length;
    }
    // Rough estimate for objects
    return JSON.stringify(data).length;
  }

  /**
   * Record metrics for optimization
   */
  private recordMetrics(mimeType: string, metrics: CodecMetrics): void {
    if (!this.metrics.has(mimeType)) {
      this.metrics.set(mimeType, []);
    }

    const history = this.metrics.get(mimeType)!;
    history.push(metrics);

    // Keep last 100 entries
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get compression statistics
   */
  getStats(mimeType?: string): Map<string, CodecMetrics[]> {
    if (mimeType) {
      const stats = new Map<string, CodecMetrics[]>();
      const metrics = this.metrics.get(mimeType);
      if (metrics) {
        stats.set(mimeType, metrics);
      }
      return stats;
    }
    return new Map(this.metrics);
  }
}

// Export singleton instance
export const mediaCodecs = new MediaCodecRegistry();

// Export codec implementations
export { JPEGEncoder } from './jpeg.js';
export { OpusEncoder } from './opus.js';
export { WebMEncoder } from './webm.js';
export { PDFEncoder } from './pdf.js';

// Export types
export type { MediaCodec, EncodingOptions, CodecMetrics };