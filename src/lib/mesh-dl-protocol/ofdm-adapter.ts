/**
 * OFDM Mesh Download Protocol Adapter (T032)
 * 
 * Integration between OFDM modem and mesh download protocol
 * for BitTorrent-style content distribution over parallel carriers.
 */

import { OFDMModem } from '../ofdm-modem/index.js';
import { ParallelChunkManager } from '../parallel-chunk-manager/index.js';
import { CarrierHealthMonitor } from '../carrier-health-monitor/index.js';
import { OFDMAudioInterface } from '../ofdm-modem/audio-interface.js';
import { ofdmPersistence } from '../database/ofdm-persistence.js';
import type { ChunkMetadata, ChunkRequest, ChunkResponse } from './types.js';
import type { TransmissionRecord } from '../database/ofdm-persistence.js';

export interface OFDMAdapterOptions {
  modem?: OFDMModem;
  audioInterface?: OFDMAudioInterface;
  enablePersistence?: boolean;
  maxParallelChunks?: number;
  retryAttempts?: number;
  adaptiveModulation?: boolean;
}

export interface TransmissionProgress {
  transmissionId: string;
  chunksTotal: number;
  chunksCompleted: number;
  bytesTotal: number;
  bytesTransmitted: number;
  carriersActive: number;
  averageThroughput: number;
  estimatedTimeRemaining: number;
  errors: number;
}

/**
 * OFDM Adapter for Mesh Download Protocol
 */
export class OFDMAdapter {
  private modem: OFDMModem;
  private chunkManager: ParallelChunkManager;
  private healthMonitor: CarrierHealthMonitor;
  private audioInterface: OFDMAudioInterface | null;
  private options: Required<OFDMAdapterOptions>;
  private activeTransmissions = new Map<string, TransmissionProgress>();
  private chunkQueue = new Map<string, ChunkMetadata[]>();
  private receivedChunks = new Map<string, Uint8Array>();
  private listeners = new Map<string, Set<Function>>();

  constructor(options: OFDMAdapterOptions = {}) {
    this.modem = options.modem || new OFDMModem();
    this.chunkManager = new ParallelChunkManager();
    this.healthMonitor = new CarrierHealthMonitor();
    this.audioInterface = options.audioInterface || null;
    
    this.options = {
      modem: this.modem,
      audioInterface: this.audioInterface || undefined,
      enablePersistence: options.enablePersistence ?? true,
      maxParallelChunks: options.maxParallelChunks || 48,
      retryAttempts: options.retryAttempts || 3,
      adaptiveModulation: options.adaptiveModulation ?? true
    };
  }

  /**
   * Initialize OFDM adapter
   */
  async initialize(): Promise<void> {
    // Initialize modem
    await this.modem.initialize();
    
    // Initialize chunk manager with modem
    this.chunkManager.initialize(this.modem);
    
    // Initialize health monitor
    this.healthMonitor.initialize(this.modem);
    
    // Initialize persistence if enabled
    if (this.options.enablePersistence) {
      await ofdmPersistence.initialize();
    }
    
    // Initialize audio interface if provided
    if (this.audioInterface) {
      await this.audioInterface.initialize();
    }
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle chunk completion
    this.chunkManager.on('chunkComplete', (chunkId: string) => {
      this.handleChunkComplete(chunkId);
    });
    
    // Handle chunk failure
    this.chunkManager.on('chunkFailed', (chunkId: string, error: Error) => {
      this.handleChunkFailed(chunkId, error);
    });
    
    // Handle carrier health changes
    this.healthMonitor.on('carrierHealthChange', (carrierId: number) => {
      this.handleCarrierHealthChange(carrierId);
    });
    
    // Handle modem events
    this.modem.on('symbolReceived', (symbol: any) => {
      this.handleSymbolReceived(symbol);
    });
  }

  /**
   * Request chunks from the mesh network
   */
  async requestChunks(request: ChunkRequest): Promise<string> {
    const transmissionId = this.generateTransmissionId();
    
    // Create transmission record
    const transmission: TransmissionProgress = {
      transmissionId,
      chunksTotal: request.chunks.length,
      chunksCompleted: 0,
      bytesTotal: request.chunks.reduce((sum, c) => sum + (c.size || 0), 0),
      bytesTransmitted: 0,
      carriersActive: 0,
      averageThroughput: 0,
      estimatedTimeRemaining: Infinity,
      errors: 0
    };
    
    this.activeTransmissions.set(transmissionId, transmission);
    this.chunkQueue.set(transmissionId, request.chunks);
    
    // Record in persistence
    if (this.options.enablePersistence) {
      await ofdmPersistence.recordTransmission({
        id: transmissionId,
        startTime: new Date(),
        status: 'active',
        totalBytes: transmission.bytesTotal,
        bytesTransmitted: 0,
        carriers: [],
        averageThroughput: 0,
        peakThroughput: 0,
        retransmissions: 0,
        metadata: request.metadata
      });
    }
    
    // Allocate chunks to carriers
    await this.allocateChunksToCarriers(transmissionId, request.chunks);
    
    // Start transmission if audio interface available
    if (this.audioInterface) {
      await this.startAudioTransmission(transmissionId);
    }
    
    return transmissionId;
  }

  /**
   * Allocate chunks to OFDM carriers
   */
  private async allocateChunksToCarriers(
    transmissionId: string,
    chunks: ChunkMetadata[]
  ): Promise<void> {
    const config = this.modem.getConfiguration();
    const availableCarriers = await this.getAvailableCarriers();
    
    // Convert chunks to format expected by chunk manager
    const chunkData = chunks.map((chunk, index) => ({
      id: `${transmissionId}_chunk_${index}`,
      pieceIndex: chunk.index || index,
      totalPieces: chunks.length,
      data: new Uint8Array(chunk.size || 256), // Placeholder data
      hash: chunk.hash || '',
      rarity: chunk.rarity || 0.5,
      attempts: 0,
      metadata: {
        transmissionId,
        originalId: chunk.id,
        ...chunk.metadata
      }
    }));
    
    // Queue chunks for parallel transmission
    this.chunkManager.queueChunks(chunkData);
    
    // Update transmission progress
    const transmission = this.activeTransmissions.get(transmissionId);
    if (transmission) {
      transmission.carriersActive = availableCarriers.length;
    }
  }

  /**
   * Get available carriers based on health
   */
  private async getAvailableCarriers(): Promise<number[]> {
    const config = this.modem.getConfiguration();
    const carriers: number[] = [];
    
    for (let i = 0; i < config.numCarriers; i++) {
      // Skip pilot carriers
      if (config.pilotCarriers.includes(i)) continue;
      
      const health = this.healthMonitor.getCarrierHealth(i);
      
      // Only use carriers with good SNR
      if (health.enabled && health.snr > 10) {
        carriers.push(i);
        
        // Apply adaptive modulation if enabled
        if (this.options.adaptiveModulation) {
          const modulation = this.selectModulation(health.snr);
          this.modem.setCarrierModulation(i, modulation);
        }
      }
    }
    
    return carriers.slice(0, this.options.maxParallelChunks);
  }

  /**
   * Select modulation based on SNR
   */
  private selectModulation(snr: number): string {
    if (snr > 25) return '256QAM';
    if (snr > 20) return '128QAM';
    if (snr > 18) return '64QAM';
    if (snr > 15) return '16QAM';
    if (snr > 12) return '8PSK';
    if (snr > 10) return 'QPSK';
    return 'BPSK';
  }

  /**
   * Start audio transmission
   */
  private async startAudioTransmission(transmissionId: string): Promise<void> {
    if (!this.audioInterface) return;
    
    const chunks = this.chunkQueue.get(transmissionId);
    if (!chunks) return;
    
    // Prepare transmission data
    const transmissionData = this.prepareTransmissionData(chunks);
    
    // Start transmitting
    await this.audioInterface.startTransmit(transmissionData);
  }

  /**
   * Prepare transmission data
   */
  private prepareTransmissionData(chunks: ChunkMetadata[]): Uint8Array {
    // Create header with chunk count and metadata
    const header = new Uint8Array(64);
    const view = new DataView(header.buffer);
    
    view.setUint32(0, chunks.length, true); // Chunk count
    view.setUint32(4, Date.now(), true);    // Timestamp
    
    // Combine chunks data
    const totalSize = chunks.reduce((sum, c) => sum + (c.size || 0), 0);
    const data = new Uint8Array(header.length + totalSize);
    
    data.set(header, 0);
    let offset = header.length;
    
    // Add chunk data (placeholder for now)
    for (const chunk of chunks) {
      const chunkSize = chunk.size || 0;
      const chunkData = new Uint8Array(chunkSize);
      // In real implementation, would load actual chunk data
      data.set(chunkData, offset);
      offset += chunkSize;
    }
    
    return data;
  }

  /**
   * Handle chunk completion
   */
  private async handleChunkComplete(chunkId: string): Promise<void> {
    // Extract transmission ID from chunk ID
    const transmissionId = chunkId.split('_chunk_')[0];
    const transmission = this.activeTransmissions.get(transmissionId);
    
    if (transmission) {
      transmission.chunksCompleted++;
      transmission.bytesTransmitted += 256; // Update with actual size
      
      // Calculate throughput
      const elapsed = Date.now() / 1000; // Would track actual start time
      transmission.averageThroughput = transmission.bytesTransmitted / elapsed;
      
      // Estimate remaining time
      const remaining = transmission.bytesTotal - transmission.bytesTransmitted;
      transmission.estimatedTimeRemaining = remaining / transmission.averageThroughput;
      
      // Check if transmission complete
      if (transmission.chunksCompleted >= transmission.chunksTotal) {
        await this.completeTransmission(transmissionId);
      }
      
      // Emit progress event
      this.emit('progress', transmission);
    }
    
    // Record in persistence
    if (this.options.enablePersistence) {
      const allocation = this.chunkManager.getChunkAllocation(chunkId);
      if (allocation) {
        await ofdmPersistence.recordChunkHistory(allocation, allocation.carrierId || 0);
      }
    }
  }

  /**
   * Handle chunk failure
   */
  private async handleChunkFailed(chunkId: string, error: Error): Promise<void> {
    const transmissionId = chunkId.split('_chunk_')[0];
    const transmission = this.activeTransmissions.get(transmissionId);
    
    if (transmission) {
      transmission.errors++;
      
      // Retry if under limit
      const allocation = this.chunkManager.getChunkAllocation(chunkId);
      if (allocation && allocation.attempts < this.options.retryAttempts) {
        // Re-queue chunk
        this.chunkManager.retryChunk(chunkId);
      } else {
        // Mark chunk as permanently failed
        this.emit('chunkFailed', { transmissionId, chunkId, error });
      }
    }
  }

  /**
   * Handle carrier health change
   */
  private async handleCarrierHealthChange(carrierId: number): Promise<void> {
    const health = this.healthMonitor.getCarrierHealth(carrierId);
    
    // Record metrics if persistence enabled
    if (this.options.enablePersistence) {
      await ofdmPersistence.recordCarrierMetrics([health]);
    }
    
    // Reallocate chunks if carrier failed
    if (!health.enabled || health.snr < 10) {
      const affectedChunks = this.chunkManager.getCarrierChunks(carrierId);
      
      for (const chunkId of affectedChunks) {
        // Find new carrier for chunk
        const availableCarriers = await this.getAvailableCarriers();
        if (availableCarriers.length > 0) {
          const newCarrier = availableCarriers[0];
          this.chunkManager.reallocateChunk(chunkId, newCarrier);
        }
      }
    }
    
    // Update modulation if adaptive enabled
    if (this.options.adaptiveModulation && health.enabled) {
      const modulation = this.selectModulation(health.snr);
      this.modem.setCarrierModulation(carrierId, modulation);
    }
  }

  /**
   * Handle received symbol
   */
  private handleSymbolReceived(symbol: any): void {
    // Process received OFDM symbol
    const decoded = this.modem.demodulateSymbol(symbol);
    
    // Extract chunk data from subcarriers
    for (const subcarrier of decoded.subcarriers) {
      const chunkId = this.extractChunkId(subcarrier);
      if (chunkId) {
        const data = this.extractChunkData(subcarrier);
        this.handleReceivedChunk(chunkId, data);
      }
    }
  }

  /**
   * Extract chunk ID from subcarrier
   */
  private extractChunkId(subcarrier: any): string | null {
    // In real implementation, would decode chunk ID from subcarrier data
    return null;
  }

  /**
   * Extract chunk data from subcarrier
   */
  private extractChunkData(subcarrier: any): Uint8Array {
    // In real implementation, would decode actual data
    return new Uint8Array(256);
  }

  /**
   * Handle received chunk
   */
  private handleReceivedChunk(chunkId: string, data: Uint8Array): void {
    this.receivedChunks.set(chunkId, data);
    
    // Emit chunk received event
    this.emit('chunkReceived', { chunkId, data });
    
    // Check if all chunks received for a transmission
    this.checkTransmissionComplete();
  }

  /**
   * Check if transmission is complete
   */
  private checkTransmissionComplete(): void {
    for (const [transmissionId, chunks] of this.chunkQueue) {
      const received = chunks.every((chunk, index) => {
        const chunkId = `${transmissionId}_chunk_${index}`;
        return this.receivedChunks.has(chunkId);
      });
      
      if (received) {
        this.assembleTransmission(transmissionId);
      }
    }
  }

  /**
   * Assemble complete transmission
   */
  private async assembleTransmission(transmissionId: string): Promise<void> {
    const chunks = this.chunkQueue.get(transmissionId);
    if (!chunks) return;
    
    // Combine all chunk data
    const assembledData: Uint8Array[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${transmissionId}_chunk_${i}`;
      const data = this.receivedChunks.get(chunkId);
      if (data) {
        assembledData.push(data);
      }
    }
    
    // Create response
    const response: ChunkResponse = {
      transmissionId,
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        data: assembledData[index]
      })),
      complete: true,
      metadata: {
        receivedAt: Date.now(),
        totalChunks: chunks.length
      }
    };
    
    // Emit completion
    this.emit('transmissionComplete', response);
    
    // Cleanup
    this.cleanupTransmission(transmissionId);
  }

  /**
   * Complete transmission
   */
  private async completeTransmission(transmissionId: string): Promise<void> {
    const transmission = this.activeTransmissions.get(transmissionId);
    if (!transmission) return;
    
    // Update persistence
    if (this.options.enablePersistence) {
      await ofdmPersistence.updateTransmission(transmissionId, {
        endTime: new Date(),
        status: 'completed',
        bytesTransmitted: transmission.bytesTransmitted,
        averageThroughput: transmission.averageThroughput
      });
    }
    
    // Stop audio transmission
    if (this.audioInterface) {
      this.audioInterface.stop();
    }
    
    // Emit completion event
    this.emit('transmissionComplete', {
      transmissionId,
      success: true,
      stats: transmission
    });
    
    // Cleanup
    this.cleanupTransmission(transmissionId);
  }

  /**
   * Cleanup transmission
   */
  private cleanupTransmission(transmissionId: string): void {
    this.activeTransmissions.delete(transmissionId);
    this.chunkQueue.delete(transmissionId);
    
    // Clean up received chunks
    const chunks = this.chunkQueue.get(transmissionId);
    if (chunks) {
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${transmissionId}_chunk_${i}`;
        this.receivedChunks.delete(chunkId);
      }
    }
  }

  /**
   * Get transmission progress
   */
  getTransmissionProgress(transmissionId: string): TransmissionProgress | null {
    return this.activeTransmissions.get(transmissionId) || null;
  }

  /**
   * Cancel transmission
   */
  async cancelTransmission(transmissionId: string): Promise<void> {
    const transmission = this.activeTransmissions.get(transmissionId);
    if (!transmission) return;
    
    // Cancel chunks in manager
    const chunks = this.chunkQueue.get(transmissionId);
    if (chunks) {
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${transmissionId}_chunk_${i}`;
        this.chunkManager.cancelChunk(chunkId);
      }
    }
    
    // Update persistence
    if (this.options.enablePersistence) {
      await ofdmPersistence.updateTransmission(transmissionId, {
        endTime: new Date(),
        status: 'failed'
      });
    }
    
    // Stop audio
    if (this.audioInterface) {
      this.audioInterface.stop();
    }
    
    // Cleanup
    this.cleanupTransmission(transmissionId);
    
    // Emit cancellation
    this.emit('transmissionCancelled', { transmissionId });
  }

  /**
   * Generate transmission ID
   */
  private generateTransmissionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event emitter functionality
   */
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    activeTransmissions: number;
    totalChunksQueued: number;
    carrierUtilization: number;
    averageSNR: number;
    throughput: number;
  }> {
    const carriers = await this.getAvailableCarriers();
    const allCarriers = this.modem.getConfiguration().numCarriers;
    
    let totalSNR = 0;
    let totalThroughput = 0;
    let totalChunks = 0;
    
    for (const [_, transmission] of this.activeTransmissions) {
      totalThroughput += transmission.averageThroughput;
      totalChunks += transmission.chunksTotal - transmission.chunksCompleted;
    }
    
    for (let i = 0; i < allCarriers; i++) {
      const health = this.healthMonitor.getCarrierHealth(i);
      totalSNR += health.snr;
    }
    
    return {
      activeTransmissions: this.activeTransmissions.size,
      totalChunksQueued: totalChunks,
      carrierUtilization: carriers.length / allCarriers,
      averageSNR: totalSNR / allCarriers,
      throughput: totalThroughput
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Cancel all active transmissions
    for (const transmissionId of this.activeTransmissions.keys()) {
      await this.cancelTransmission(transmissionId);
    }
    
    // Cleanup audio interface
    if (this.audioInterface) {
      await this.audioInterface.cleanup();
    }
    
    // Close persistence
    if (this.options.enablePersistence) {
      await ofdmPersistence.close();
    }
    
    // Clear listeners
    this.listeners.clear();
  }
}

export default OFDMAdapter;