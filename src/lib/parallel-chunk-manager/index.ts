/**
 * Parallel Chunk Manager for OFDM Transmission
 *
 * Manages allocation of BitTorrent chunks to OFDM subcarriers for
 * parallel transmission with rarity-based prioritization.
 */

import { OFDMModem } from '../ofdm-modem/index.js';

export interface ChunkMetadata {
  id: string;
  pieceIndex: number;
  totalPieces: number;
  data: Uint8Array;
  hash: string;
  rarity: number; // 0-1, lower = rarer = higher priority
  attempts: number;
  lastAttempt?: number;
}

export interface SubcarrierAllocation {
  carrierId: number;
  chunkId: string;
  startTime: number;
  estimatedDuration: number;
  quality: number; // SNR-based quality metric
  status: 'pending' | 'transmitting' | 'completed' | 'failed';
}

export interface PipelineConfig {
  maxConcurrentChunks: number;
  retryAttempts: number;
  rarityThreshold: number; // Prioritize chunks below this rarity
  pipelineDepth: number; // Number of chunks to queue ahead
}

export class ParallelChunkManager {
  private chunkQueue: Map<string, ChunkMetadata> = new Map();
  private allocations: Map<number, SubcarrierAllocation> = new Map();
  private completedChunks: Set<string> = new Set();
  private failedChunks: Map<string, number> = new Map();
  private config: PipelineConfig;
  private modem: OFDMModem | null = null;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      maxConcurrentChunks: 48, // Max OFDM carriers
      retryAttempts: 3,
      rarityThreshold: 0.3,
      pipelineDepth: 96, // 2x carriers for pipelining
      ...config
    };
  }

  /**
   * Initialize with OFDM modem
   */
  initialize(modem: OFDMModem): void {
    this.modem = modem;
    this.setupCarrierMonitoring();
  }

  /**
   * Add chunks to transmission queue
   */
  queueChunks(chunks: ChunkMetadata[]): void {
    // Sort by rarity (rarest first)
    const sortedChunks = chunks.sort((a, b) => a.rarity - b.rarity);

    for (const chunk of sortedChunks) {
      if (!this.completedChunks.has(chunk.id)) {
        this.chunkQueue.set(chunk.id, chunk);
      }
    }

    this.allocateChunksToCarriers();
  }

  /**
   * Allocate chunks to available OFDM subcarriers
   */
  private allocateChunksToCarriers(): void {
    if (!this.modem) return;

    const availableCarriers = this.getAvailableCarriers();
    const pendingChunks = this.getPrioritizedChunks();

    for (let i = 0; i < Math.min(availableCarriers.length, pendingChunks.length); i++) {
      const carrier = availableCarriers[i];
      const chunk = pendingChunks[i];

      const allocation: SubcarrierAllocation = {
        carrierId: carrier.id,
        chunkId: chunk.id,
        startTime: Date.now(),
        estimatedDuration: this.estimateTransmissionTime(chunk, carrier),
        quality: carrier.quality,
        status: 'pending'
      };

      this.allocations.set(carrier.id, allocation);
      this.startChunkTransmission(chunk, carrier);
    }
  }

  /**
   * Get available carriers sorted by quality
   */
  private getAvailableCarriers(): Array<{ id: number; quality: number }> {
    if (!this.modem) return [];

    const carriers = [];
    const carrierStatus = this.modem.getCarrierStatus();

    for (let i = 0; i < carrierStatus.length; i++) {
      if (!this.allocations.has(i) || this.allocations.get(i)?.status === 'completed') {
        // Skip pilot carriers
        if (!this.isPilotCarrier(i)) {
          carriers.push({
            id: i,
            quality: carrierStatus[i].snr
          });
        }
      }
    }

    return carriers.sort((a, b) => b.quality - a.quality);
  }

  /**
   * Get prioritized chunks for transmission
   */
  private getPrioritizedChunks(): ChunkMetadata[] {
    const chunks = Array.from(this.chunkQueue.values());

    // Priority: rarity, then retry count, then age
    return chunks.sort((a, b) => {
      // Rarest first
      if (a.rarity !== b.rarity) {
        return a.rarity - b.rarity;
      }

      // Fewer attempts first
      if (a.attempts !== b.attempts) {
        return a.attempts - b.attempts;
      }

      // Older first
      return (a.lastAttempt || 0) - (b.lastAttempt || 0);
    }).slice(0, this.config.pipelineDepth);
  }

  /**
   * Start transmitting chunk on carrier
   */
  private async startChunkTransmission(chunk: ChunkMetadata, carrier: { id: number; quality: number }): Promise<void> {
    if (!this.modem) return;

    const allocation = this.allocations.get(carrier.id);
    if (!allocation) return;

    allocation.status = 'transmitting';
    chunk.attempts++;
    chunk.lastAttempt = Date.now();

    try {
      // Transmit chunk data on specific carrier
      await this.modem.transmitOnCarrier(carrier.id, chunk.data);

      allocation.status = 'completed';
      this.completedChunks.add(chunk.id);
      this.chunkQueue.delete(chunk.id);

      // Immediately allocate next chunk to this carrier
      this.allocateChunksToCarriers();

    } catch (error) {
      allocation.status = 'failed';
      this.handleTransmissionFailure(chunk, carrier.id);
    }
  }

  /**
   * Handle transmission failure and redistribution
   */
  private handleTransmissionFailure(chunk: ChunkMetadata, carrierId: number): void {
    const failCount = (this.failedChunks.get(chunk.id) || 0) + 1;
    this.failedChunks.set(chunk.id, failCount);

    if (failCount < this.config.retryAttempts) {
      // Re-queue with increased priority
      chunk.rarity = Math.max(0, chunk.rarity - 0.1);
      this.chunkQueue.set(chunk.id, chunk);
    } else {
      console.error(`Chunk ${chunk.id} failed after ${failCount} attempts`);
    }

    // Free up carrier for next chunk
    this.allocations.delete(carrierId);
    this.allocateChunksToCarriers();
  }

  /**
   * Setup carrier health monitoring
   */
  private setupCarrierMonitoring(): void {
    if (!this.modem) return;

    // Monitor carrier health every 100ms
    setInterval(() => {
      this.checkCarrierHealth();
    }, 100);
  }

  /**
   * Check carrier health and redistribute if needed
   */
  private checkCarrierHealth(): void {
    if (!this.modem) return;

    const carrierStatus = this.modem.getCarrierStatus();

    for (const [carrierId, allocation] of this.allocations.entries()) {
      if (allocation.status === 'transmitting') {
        const carrier = carrierStatus[carrierId];

        // If carrier quality dropped significantly, redistribute
        if (carrier && carrier.snr < allocation.quality * 0.5) {
          this.redistributeChunk(allocation);
        }
      }
    }
  }

  /**
   * Redistribute chunk to healthier carrier
   */
  private redistributeChunk(allocation: SubcarrierAllocation): void {
    const chunk = Array.from(this.chunkQueue.values()).find(c => c.id === allocation.chunkId);
    if (!chunk) return;

    // Mark current allocation as failed
    allocation.status = 'failed';
    this.allocations.delete(allocation.carrierId);

    // Re-queue chunk with higher priority
    chunk.rarity = Math.max(0, chunk.rarity - 0.05);
    this.handleTransmissionFailure(chunk, allocation.carrierId);
  }

  /**
   * Check if carrier is reserved for pilot tones
   */
  private isPilotCarrier(carrierId: number): boolean {
    // Reserve every 6th carrier for pilots (8 pilots out of 48)
    return carrierId % 6 === 0;
  }

  /**
   * Estimate transmission time for chunk on carrier
   */
  private estimateTransmissionTime(chunk: ChunkMetadata, carrier: { quality: number }): number {
    // Estimate based on chunk size and carrier quality
    const baseTime = (chunk.data.length * 8) / 2400; // 2400 bps base rate
    const qualityFactor = Math.max(0.5, Math.min(2, carrier.quality / 20));
    return baseTime / qualityFactor;
  }

  /**
   * Get current allocation status
   */
  getAllocationStatus(): {
    active: number;
    completed: number;
    failed: number;
    queued: number;
    throughput: number;
  } {
    const active = Array.from(this.allocations.values())
      .filter(a => a.status === 'transmitting').length;

    const completed = this.completedChunks.size;
    const failed = this.failedChunks.size;
    const queued = this.chunkQueue.size;

    // Calculate throughput in chunks/second
    const recentCompletions = Array.from(this.allocations.values())
      .filter(a => a.status === 'completed' && Date.now() - a.startTime < 1000).length;

    return {
      active,
      completed,
      failed,
      queued,
      throughput: recentCompletions
    };
  }

  /**
   * Get per-carrier allocation details
   */
  getCarrierAllocations(): Map<number, SubcarrierAllocation> {
    return new Map(this.allocations);
  }

  /**
   * Clear all allocations and reset
   */
  reset(): void {
    this.chunkQueue.clear();
    this.allocations.clear();
    this.completedChunks.clear();
    this.failedChunks.clear();
  }
}

export { ParallelChunkManager as default };