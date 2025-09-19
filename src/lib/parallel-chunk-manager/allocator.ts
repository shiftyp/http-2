/**
 * Chunk-to-Subcarrier Allocator
 *
 * Optimizes allocation of BitTorrent chunks to OFDM subcarriers
 * based on carrier quality and chunk priority.
 */

export interface CarrierMetrics {
  id: number;
  snr: number;
  ber: number; // Bit error rate
  capacity: number; // bits per symbol
  utilization: number; // 0-1
}

export interface AllocationStrategy {
  type: 'quality-first' | 'load-balanced' | 'priority-weighted';
  qualityThreshold: number;
  loadFactor: number;
}

export class ChunkAllocator {
  private strategy: AllocationStrategy;
  private carrierHistory: Map<number, CarrierMetrics[]> = new Map();

  constructor(strategy: AllocationStrategy = {
    type: 'priority-weighted',
    qualityThreshold: 10, // Minimum SNR in dB
    loadFactor: 0.8 // Target utilization
  }) {
    this.strategy = strategy;
  }

  /**
   * Allocate chunks to carriers optimally
   */
  allocate(
    chunks: Array<{ id: string; priority: number; size: number }>,
    carriers: CarrierMetrics[]
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    switch (this.strategy.type) {
      case 'quality-first':
        return this.allocateQualityFirst(chunks, carriers);
      case 'load-balanced':
        return this.allocateLoadBalanced(chunks, carriers);
      case 'priority-weighted':
        return this.allocatePriorityWeighted(chunks, carriers);
      default:
        return allocations;
    }
  }

  /**
   * Quality-first allocation: Best carriers get chunks first
   */
  private allocateQualityFirst(
    chunks: Array<{ id: string; priority: number; size: number }>,
    carriers: CarrierMetrics[]
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    // Sort carriers by quality (SNR)
    const sortedCarriers = [...carriers]
      .filter(c => c.snr >= this.strategy.qualityThreshold)
      .sort((a, b) => b.snr - a.snr);

    // Sort chunks by priority
    const sortedChunks = [...chunks].sort((a, b) => b.priority - a.priority);

    // Allocate high-priority chunks to best carriers
    for (let i = 0; i < Math.min(sortedChunks.length, sortedCarriers.length); i++) {
      allocations.set(sortedChunks[i].id, sortedCarriers[i].id);
    }

    return allocations;
  }

  /**
   * Load-balanced allocation: Distribute evenly across carriers
   */
  private allocateLoadBalanced(
    chunks: Array<{ id: string; priority: number; size: number }>,
    carriers: CarrierMetrics[]
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    // Filter viable carriers
    const viableCarriers = carriers.filter(c =>
      c.snr >= this.strategy.qualityThreshold &&
      c.utilization < this.strategy.loadFactor
    );

    if (viableCarriers.length === 0) return allocations;

    // Round-robin allocation
    let carrierIndex = 0;
    for (const chunk of chunks) {
      const carrier = viableCarriers[carrierIndex % viableCarriers.length];
      allocations.set(chunk.id, carrier.id);
      carrierIndex++;
    }

    return allocations;
  }

  /**
   * Priority-weighted allocation: Match chunk priority with carrier quality
   */
  private allocatePriorityWeighted(
    chunks: Array<{ id: string; priority: number; size: number }>,
    carriers: CarrierMetrics[]
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    // Score carriers based on multiple factors
    const scoredCarriers = carriers.map(carrier => ({
      ...carrier,
      score: this.calculateCarrierScore(carrier)
    })).filter(c => c.score > 0).sort((a, b) => b.score - a.score);

    // Sort chunks by priority
    const sortedChunks = [...chunks].sort((a, b) => b.priority - a.priority);

    // Match high-priority chunks with high-score carriers
    const availableCarriers = [...scoredCarriers];

    for (const chunk of sortedChunks) {
      if (availableCarriers.length === 0) break;

      // Find best carrier for chunk based on size and priority
      const carrierIndex = this.findBestCarrierIndex(chunk, availableCarriers);
      if (carrierIndex >= 0) {
        const carrier = availableCarriers[carrierIndex];
        allocations.set(chunk.id, carrier.id);

        // Update carrier utilization
        carrier.utilization = Math.min(1, carrier.utilization + (chunk.size / carrier.capacity));

        // Remove if fully utilized
        if (carrier.utilization >= this.strategy.loadFactor) {
          availableCarriers.splice(carrierIndex, 1);
        }
      }
    }

    return allocations;
  }

  /**
   * Calculate carrier score based on quality metrics
   */
  private calculateCarrierScore(carrier: CarrierMetrics): number {
    if (carrier.snr < this.strategy.qualityThreshold) return 0;

    // Weighted scoring: SNR (40%), BER (30%), Capacity (20%), Utilization (10%)
    const snrScore = Math.min(1, carrier.snr / 30) * 0.4;
    const berScore = Math.max(0, 1 - carrier.ber * 1000) * 0.3;
    const capacityScore = (carrier.capacity / 6) * 0.2; // 6 bits max for 64-QAM
    const utilizationScore = Math.max(0, 1 - carrier.utilization) * 0.1;

    return snrScore + berScore + capacityScore + utilizationScore;
  }

  /**
   * Find best carrier index for chunk
   */
  private findBestCarrierIndex(
    chunk: { priority: number; size: number },
    carriers: Array<CarrierMetrics & { score: number }>
  ): number {
    // For high-priority chunks, use best available carrier
    if (chunk.priority > 0.8) {
      return 0; // Best carrier
    }

    // For medium priority, find carrier with matching capacity
    const targetCapacity = chunk.size / 1000; // Rough estimate
    let bestIndex = 0;
    let bestMatch = Infinity;

    for (let i = 0; i < carriers.length; i++) {
      const capacityDiff = Math.abs(carriers[i].capacity - targetCapacity);
      if (capacityDiff < bestMatch) {
        bestMatch = capacityDiff;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  /**
   * Update carrier history for adaptive allocation
   */
  updateCarrierHistory(carrierId: number, metrics: CarrierMetrics): void {
    if (!this.carrierHistory.has(carrierId)) {
      this.carrierHistory.set(carrierId, []);
    }

    const history = this.carrierHistory.get(carrierId)!;
    history.push(metrics);

    // Keep last 100 samples
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get carrier reliability score based on history
   */
  getCarrierReliability(carrierId: number): number {
    const history = this.carrierHistory.get(carrierId);
    if (!history || history.length < 10) return 0.5; // Default reliability

    // Calculate stability over time
    let totalScore = 0;
    for (let i = 1; i < history.length; i++) {
      const snrChange = Math.abs(history[i].snr - history[i-1].snr);
      const stabilityScore = Math.max(0, 1 - snrChange / 10);
      totalScore += stabilityScore;
    }

    return totalScore / (history.length - 1);
  }

  /**
   * Update allocation strategy
   */
  updateStrategy(strategy: Partial<AllocationStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }

  /**
   * Get allocation statistics
   */
  getStatistics(): {
    totalAllocations: number;
    avgCarrierScore: number;
    strategyType: string;
  } {
    const allMetrics = Array.from(this.carrierHistory.values()).flat();
    const avgScore = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + this.calculateCarrierScore(m), 0) / allMetrics.length
      : 0;

    return {
      totalAllocations: this.carrierHistory.size,
      avgCarrierScore: avgScore,
      strategyType: this.strategy.type
    };
  }
}

export { ChunkAllocator as default };