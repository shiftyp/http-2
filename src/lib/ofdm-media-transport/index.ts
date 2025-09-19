/**
 * OFDM Media Transport Library
 * 
 * Optimized media transmission over OFDM carriers with
 * progressive encoding and carrier allocation strategies.
 */

import { OFDMModem } from '../ofdm-modem/index.js';
import { ParallelChunkManager } from '../parallel-chunk-manager/index.js';
import { MediaCodecRegistry } from '../media-codecs/index.js';
import { mediaCache } from '../media-cache/index.js';
import type { EncodingOptions } from '../media-codecs/index.js';

export interface MediaTransmissionRequest {
  id: string;
  url: string;
  mimeType: string;
  data: Uint8Array | Blob;
  priority: number;
  progressive?: boolean;
  metadata?: Record<string, any>;
}

export interface TransmissionOptions {
  maxBandwidth?: number;   // Bytes per second
  quality?: number;         // 0-100 quality level
  progressive?: boolean;    // Enable progressive transmission
  carriers?: number[];      // Specific carriers to use
  redundancy?: number;      // Redundancy factor for FEC
}

export interface TransmissionStats {
  bytesTransmitted: number;
  bytesRemaining: number;
  throughput: number;       // Bytes per second
  progress: number;         // 0-100%
  estimatedTime: number;    // Seconds remaining
  carriers: number;         // Active carriers
  quality: number;          // Current quality level
}

/**
 * OFDM Media Transport
 */
export class OFDMMediaTransport {
  private modem: OFDMModem;
  private chunkManager: ParallelChunkManager;
  private codecRegistry: MediaCodecRegistry;
  private transmissions = new Map<string, MediaTransmission>();
  private carrierAllocations = new Map<number, string>(); // carrier -> transmission ID

  constructor(
    modem: OFDMModem,
    chunkManager: ParallelChunkManager,
    codecRegistry: MediaCodecRegistry
  ) {
    this.modem = modem;
    this.chunkManager = chunkManager;
    this.codecRegistry = codecRegistry;
  }

  /**
   * Initialize transport
   */
  async initialize(): Promise<void> {
    await mediaCache.initialize();
    
    // Set up chunk manager callbacks
    this.chunkManager.on('chunkComplete', (chunkId: string) => {
      this.handleChunkComplete(chunkId);
    });
    
    this.chunkManager.on('chunkFailed', (chunkId: string) => {
      this.handleChunkFailed(chunkId);
    });
  }

  /**
   * Transmit media
   */
  async transmit(
    request: MediaTransmissionRequest,
    options: TransmissionOptions = {}
  ): Promise<string> {
    const {
      quality = 75,
      progressive = true,
      carriers,
      redundancy = 1.2
    } = options;

    // Check cache first
    const cached = await mediaCache.get(request.url);
    if (cached) {
      // Use cached version
      request.data = cached.data;
    }

    // Encode media
    const encoded = await this.encodeMedia(
      request.data,
      request.mimeType,
      quality,
      progressive
    );

    // Create transmission
    const transmission = new MediaTransmission(
      request.id,
      request.url,
      request.mimeType,
      encoded,
      request.priority,
      progressive
    );

    this.transmissions.set(request.id, transmission);

    // Allocate carriers
    const allocatedCarriers = await this.allocateCarriers(
      transmission,
      carriers
    );

    // Create chunks for parallel transmission
    const chunks = this.createMediaChunks(
      transmission,
      allocatedCarriers.length,
      redundancy
    );

    // Queue chunks for transmission
    this.chunkManager.queueChunks(chunks);

    // Start transmission monitoring
    this.startTransmissionMonitoring(transmission);

    return request.id;
  }

  /**
   * Get transmission status
   */
  getTransmissionStatus(transmissionId: string): TransmissionStats | null {
    const transmission = this.transmissions.get(transmissionId);
    if (!transmission) return null;

    return transmission.getStats();
  }

  /**
   * Cancel transmission
   */
  async cancelTransmission(transmissionId: string): Promise<void> {
    const transmission = this.transmissions.get(transmissionId);
    if (!transmission) return;

    // Cancel chunks
    for (const chunkId of transmission.chunkIds) {
      this.chunkManager.cancelChunk(chunkId);
    }

    // Free carriers
    for (const [carrier, id] of this.carrierAllocations) {
      if (id === transmissionId) {
        this.carrierAllocations.delete(carrier);
      }
    }

    this.transmissions.delete(transmissionId);
  }

  /**
   * Receive media
   */
  async receive(
    chunks: Uint8Array[],
    mimeType: string,
    metadata?: any
  ): Promise<Blob> {
    // Reassemble chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const assembled = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of chunks) {
      assembled.set(chunk, offset);
      offset += chunk.length;
    }

    // Decode if needed
    const decoded = await this.codecRegistry.decode(assembled, mimeType);
    
    // Cache received media
    const url = metadata?.url || `received_${Date.now()}`;
    await mediaCache.store(url, assembled, mimeType, metadata);

    // Return as Blob
    return new Blob([decoded], { type: mimeType });
  }

  /**
   * Encode media
   */
  private async encodeMedia(
    data: Uint8Array | Blob,
    mimeType: string,
    quality: number,
    progressive: boolean
  ): Promise<Uint8Array> {
    // Convert Blob to Uint8Array if needed
    let inputData: any = data;
    if (data instanceof Blob) {
      const arrayBuffer = await data.arrayBuffer();
      inputData = new Uint8Array(arrayBuffer);
    }

    const options: EncodingOptions = {
      quality,
      progressive,
      maxSize: this.calculateMaxSize()
    };

    return await this.codecRegistry.encode(inputData, mimeType, options);
  }

  /**
   * Allocate carriers
   */
  private async allocateCarriers(
    transmission: MediaTransmission,
    requestedCarriers?: number[]
  ): Promise<number[]> {
    const config = this.modem.getConfiguration();
    const availableCarriers: number[] = [];

    // Get available carriers
    for (let i = 0; i < config.numCarriers; i++) {
      if (config.pilotCarriers.includes(i)) continue;
      if (this.carrierAllocations.has(i)) continue;
      if (requestedCarriers && !requestedCarriers.includes(i)) continue;
      
      const health = this.modem.getCarrierHealth(i);
      if (health.enabled && health.snr > 10) {
        availableCarriers.push(i);
      }
    }

    // Allocate based on priority and size
    const needed = Math.min(
      availableCarriers.length,
      Math.ceil(transmission.data.length / 1000) // Rough estimate
    );

    const allocated = availableCarriers.slice(0, needed);
    
    // Mark as allocated
    for (const carrier of allocated) {
      this.carrierAllocations.set(carrier, transmission.id);
    }

    return allocated;
  }

  /**
   * Create media chunks
   */
  private createMediaChunks(
    transmission: MediaTransmission,
    numCarriers: number,
    redundancy: number
  ): any[] {
    const chunkSize = Math.ceil(transmission.data.length / numCarriers);
    const chunks: any[] = [];

    for (let i = 0; i < numCarriers; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, transmission.data.length);
      const chunkData = transmission.data.slice(start, end);

      // Add redundancy
      const redundantData = this.addRedundancy(chunkData, redundancy);

      const chunkId = `${transmission.id}_chunk_${i}`;
      chunks.push({
        id: chunkId,
        pieceIndex: i,
        totalPieces: numCarriers,
        data: redundantData,
        hash: this.calculateHash(redundantData),
        rarity: transmission.priority,
        attempts: 0,
        metadata: {
          transmissionId: transmission.id,
          mimeType: transmission.mimeType,
          progressive: transmission.progressive
        }
      });

      transmission.chunkIds.push(chunkId);
    }

    return chunks;
  }

  /**
   * Add redundancy for FEC
   */
  private addRedundancy(data: Uint8Array, factor: number): Uint8Array {
    // Simplified Reed-Solomon style redundancy
    const redundantSize = Math.floor(data.length * (factor - 1));
    const result = new Uint8Array(data.length + redundantSize);
    
    // Copy original data
    result.set(data);
    
    // Add parity (simplified XOR)
    for (let i = 0; i < redundantSize; i++) {
      result[data.length + i] = data[i % data.length] ^ 0x55;
    }

    return result;
  }

  /**
   * Calculate hash
   */
  private calculateHash(data: Uint8Array): string {
    // Simple hash for demo
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 100); i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Calculate max size
   */
  private calculateMaxSize(): number {
    const config = this.modem.getConfiguration();
    const dataCarriers = config.numCarriers - config.pilotCarriers.length;
    const bitsPerSymbol = 2; // QPSK baseline
    const symbolRate = config.channelBandwidth / config.numCarriers;
    const dataRate = dataCarriers * bitsPerSymbol * symbolRate;
    
    // Max size for 10 second transmission
    return Math.floor((dataRate * 10) / 8);
  }

  /**
   * Handle chunk complete
   */
  private handleChunkComplete(chunkId: string): void {
    // Find transmission
    for (const transmission of this.transmissions.values()) {
      if (transmission.chunkIds.includes(chunkId)) {
        transmission.markChunkComplete(chunkId);
        
        if (transmission.isComplete()) {
          this.completeTransmission(transmission);
        }
        break;
      }
    }
  }

  /**
   * Handle chunk failed
   */
  private handleChunkFailed(chunkId: string): void {
    // Find transmission
    for (const transmission of this.transmissions.values()) {
      if (transmission.chunkIds.includes(chunkId)) {
        transmission.markChunkFailed(chunkId);
        
        // Retry or reallocate
        this.retryChunk(chunkId);
        break;
      }
    }
  }

  /**
   * Retry chunk
   */
  private retryChunk(chunkId: string): void {
    // Re-queue with higher priority
    // Implementation would fetch chunk data and re-queue
  }

  /**
   * Complete transmission
   */
  private completeTransmission(transmission: MediaTransmission): void {
    // Free carriers
    for (const [carrier, id] of this.carrierAllocations) {
      if (id === transmission.id) {
        this.carrierAllocations.delete(carrier);
      }
    }

    // Cache completed media
    mediaCache.store(
      transmission.url,
      transmission.data,
      transmission.mimeType,
      transmission.metadata
    );

    // Emit completion event
    this.modem.emit('mediaTransmissionComplete', transmission.id);
  }

  /**
   * Start transmission monitoring
   */
  private startTransmissionMonitoring(transmission: MediaTransmission): void {
    const interval = setInterval(() => {
      const stats = transmission.getStats();
      
      if (stats.progress >= 100) {
        clearInterval(interval);
      }
      
      // Emit progress event
      this.modem.emit('mediaTransmissionProgress', {
        id: transmission.id,
        stats
      });
    }, 1000);
  }
}

/**
 * Media Transmission
 */
class MediaTransmission {
  id: string;
  url: string;
  mimeType: string;
  data: Uint8Array;
  priority: number;
  progressive: boolean;
  chunkIds: string[] = [];
  completedChunks = new Set<string>();
  failedChunks = new Set<string>();
  metadata: Record<string, any> = {};
  startTime: number;
  bytesTransmitted = 0;

  constructor(
    id: string,
    url: string,
    mimeType: string,
    data: Uint8Array,
    priority: number,
    progressive: boolean
  ) {
    this.id = id;
    this.url = url;
    this.mimeType = mimeType;
    this.data = data;
    this.priority = priority;
    this.progressive = progressive;
    this.startTime = Date.now();
  }

  markChunkComplete(chunkId: string): void {
    this.completedChunks.add(chunkId);
    this.failedChunks.delete(chunkId);
    
    // Update bytes transmitted
    const chunkSize = Math.ceil(this.data.length / this.chunkIds.length);
    this.bytesTransmitted += chunkSize;
  }

  markChunkFailed(chunkId: string): void {
    this.failedChunks.add(chunkId);
  }

  isComplete(): boolean {
    return this.completedChunks.size === this.chunkIds.length;
  }

  getStats(): TransmissionStats {
    const progress = (this.completedChunks.size / this.chunkIds.length) * 100;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const throughput = elapsed > 0 ? this.bytesTransmitted / elapsed : 0;
    const bytesRemaining = this.data.length - this.bytesTransmitted;
    const estimatedTime = throughput > 0 ? bytesRemaining / throughput : Infinity;

    return {
      bytesTransmitted: this.bytesTransmitted,
      bytesRemaining,
      throughput,
      progress,
      estimatedTime,
      carriers: this.chunkIds.length,
      quality: 75 // Would be dynamic
    };
  }
}