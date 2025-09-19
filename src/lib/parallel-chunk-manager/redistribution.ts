/**
 * Chunk Redistribution Handler for OFDM
 *
 * Handles dynamic redistribution of chunks when carriers
 * fail or experience degraded quality.
 */

export interface RedistributionEvent {
  type: 'carrier-failed' | 'quality-degraded' | 'timeout' | 'peer-lost';
  carrierId?: number;
  chunkId: string;
  timestamp: number;
  reason: string;
}

export interface RedistributionStrategy {
  maxRetries: number;
  timeoutMs: number;
  qualityThreshold: number;
  loadBalancing: boolean;
}

export class RedistributionHandler {
  private pendingRedistributions: Map<string, RedistributionEvent> = new Map();
  private redistributionHistory: RedistributionEvent[] = [];
  private carrierLoads: Map<number, number> = new Map();
  private strategy: RedistributionStrategy;

  constructor(strategy: Partial<RedistributionStrategy> = {}) {
    this.strategy = {
      maxRetries: 3,
      timeoutMs: 5000,
      qualityThreshold: 10, // Minimum SNR in dB
      loadBalancing: true,
      ...strategy
    };
  }

  /**
   * Handle carrier failure event
   */
  handleCarrierFailure(
    carrierId: number,
    affectedChunks: string[],
    availableCarriers: number[]
  ): Map<string, number> {
    const redistributions = new Map<string, number>();

    for (const chunkId of affectedChunks) {
      const event: RedistributionEvent = {
        type: 'carrier-failed',
        carrierId,
        chunkId,
        timestamp: Date.now(),
        reason: `Carrier ${carrierId} failed`
      };

      this.recordEvent(event);

      // Find best alternative carrier
      const newCarrier = this.selectAlternativeCarrier(
        chunkId,
        availableCarriers,
        carrierId
      );

      if (newCarrier !== -1) {
        redistributions.set(chunkId, newCarrier);
        this.updateCarrierLoad(newCarrier, 1);
      } else {
        // Queue for later redistribution
        this.pendingRedistributions.set(chunkId, event);
      }
    }

    return redistributions;
  }

  /**
   * Handle quality degradation event
   */
  handleQualityDegradation(
    carrierId: number,
    currentSNR: number,
    chunkId: string,
    availableCarriers: Array<{ id: number; snr: number }>
  ): number | null {
    if (currentSNR >= this.strategy.qualityThreshold) {
      return null; // Quality still acceptable
    }

    const event: RedistributionEvent = {
      type: 'quality-degraded',
      carrierId,
      chunkId,
      timestamp: Date.now(),
      reason: `SNR dropped to ${currentSNR.toFixed(1)} dB`
    };

    this.recordEvent(event);

    // Find carrier with better quality
    const betterCarriers = availableCarriers
      .filter(c => c.snr > currentSNR + 3) // At least 3dB better
      .sort((a, b) => b.snr - a.snr);

    if (betterCarriers.length > 0) {
      const selected = this.strategy.loadBalancing
        ? this.selectLoadBalanced(betterCarriers)
        : betterCarriers[0].id;

      this.updateCarrierLoad(selected, 1);
      this.updateCarrierLoad(carrierId, -1);

      return selected;
    }

    return null;
  }

  /**
   * Handle transmission timeout
   */
  handleTimeout(
    chunkId: string,
    carrierId: number,
    elapsedMs: number,
    availableCarriers: number[]
  ): number | null {
    const event: RedistributionEvent = {
      type: 'timeout',
      carrierId,
      chunkId,
      timestamp: Date.now(),
      reason: `Timeout after ${elapsedMs}ms`
    };

    this.recordEvent(event);

    // Check retry count
    const retryCount = this.getRetryCount(chunkId);
    if (retryCount >= this.strategy.maxRetries) {
      console.error(`Chunk ${chunkId} exceeded max retries`);
      return null;
    }

    // Select different carrier for retry
    const alternativeCarrier = this.selectAlternativeCarrier(
      chunkId,
      availableCarriers,
      carrierId
    );

    if (alternativeCarrier !== -1) {
      this.updateCarrierLoad(alternativeCarrier, 1);
      this.updateCarrierLoad(carrierId, -1);
      return alternativeCarrier;
    }

    return null;
  }

  /**
   * Handle peer loss event
   */
  handlePeerLoss(
    peerId: string,
    affectedChunks: string[],
    alternativePeers: Map<string, string[]>
  ): Map<string, string> {
    const redistributions = new Map<string, string>();

    for (const chunkId of affectedChunks) {
      const event: RedistributionEvent = {
        type: 'peer-lost',
        chunkId,
        timestamp: Date.now(),
        reason: `Peer ${peerId} disconnected`
      };

      this.recordEvent(event);

      // Find alternative peer with chunk
      const alternatives = alternativePeers.get(chunkId) || [];
      if (alternatives.length > 0) {
        // Select peer with least load or best connection
        const selectedPeer = alternatives[0]; // Simplified selection
        redistributions.set(chunkId, selectedPeer);
      } else {
        this.pendingRedistributions.set(chunkId, event);
      }
    }

    return redistributions;
  }

  /**
   * Select alternative carrier avoiding failed one
   */
  private selectAlternativeCarrier(
    chunkId: string,
    availableCarriers: number[],
    avoidCarrier: number
  ): number {
    const candidates = availableCarriers.filter(c => c !== avoidCarrier);

    if (candidates.length === 0) {
      return -1;
    }

    if (this.strategy.loadBalancing) {
      // Select least loaded carrier
      let minLoad = Infinity;
      let selected = -1;

      for (const carrier of candidates) {
        const load = this.carrierLoads.get(carrier) || 0;
        if (load < minLoad) {
          minLoad = load;
          selected = carrier;
        }
      }

      return selected;
    } else {
      // Random selection
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  /**
   * Select carrier with load balancing
   */
  private selectLoadBalanced(carriers: Array<{ id: number; snr: number }>): number {
    // Score based on quality and current load
    let bestScore = -Infinity;
    let selected = carriers[0].id;

    for (const carrier of carriers) {
      const load = this.carrierLoads.get(carrier.id) || 0;
      const qualityScore = carrier.snr / 30; // Normalize SNR
      const loadScore = 1 / (1 + load); // Lower load = higher score
      const combinedScore = qualityScore * 0.6 + loadScore * 0.4;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        selected = carrier.id;
      }
    }

    return selected;
  }

  /**
   * Update carrier load tracking
   */
  private updateCarrierLoad(carrierId: number, delta: number): void {
    const current = this.carrierLoads.get(carrierId) || 0;
    const newLoad = Math.max(0, current + delta);

    if (newLoad === 0) {
      this.carrierLoads.delete(carrierId);
    } else {
      this.carrierLoads.set(carrierId, newLoad);
    }
  }

  /**
   * Record redistribution event
   */
  private recordEvent(event: RedistributionEvent): void {
    this.redistributionHistory.push(event);

    // Keep last 1000 events
    if (this.redistributionHistory.length > 1000) {
      this.redistributionHistory = this.redistributionHistory.slice(-1000);
    }
  }

  /**
   * Get retry count for chunk
   */
  private getRetryCount(chunkId: string): number {
    return this.redistributionHistory
      .filter(e => e.chunkId === chunkId)
      .length;
  }

  /**
   * Process pending redistributions
   */
  processPending(availableCarriers: number[]): Map<string, number> {
    const redistributions = new Map<string, number>();
    const processed: string[] = [];

    for (const [chunkId, event] of this.pendingRedistributions.entries()) {
      const age = Date.now() - event.timestamp;

      // Skip if too old
      if (age > this.strategy.timeoutMs * 2) {
        processed.push(chunkId);
        continue;
      }

      // Try to redistribute
      const carrier = this.selectAlternativeCarrier(
        chunkId,
        availableCarriers,
        event.carrierId || -1
      );

      if (carrier !== -1) {
        redistributions.set(chunkId, carrier);
        this.updateCarrierLoad(carrier, 1);
        processed.push(chunkId);
      }
    }

    // Remove processed items
    for (const chunkId of processed) {
      this.pendingRedistributions.delete(chunkId);
    }

    return redistributions;
  }

  /**
   * Get redistribution statistics
   */
  getStatistics(): {
    totalEvents: number;
    byType: Record<string, number>;
    avgRetries: number;
    pendingCount: number;
    carrierUtilization: Map<number, number>;
  } {
    const byType: Record<string, number> = {
      'carrier-failed': 0,
      'quality-degraded': 0,
      'timeout': 0,
      'peer-lost': 0
    };

    const chunkRetries = new Map<string, number>();

    for (const event of this.redistributionHistory) {
      byType[event.type]++;
      chunkRetries.set(
        event.chunkId,
        (chunkRetries.get(event.chunkId) || 0) + 1
      );
    }

    const totalRetries = Array.from(chunkRetries.values()).reduce((a, b) => a + b, 0);
    const avgRetries = chunkRetries.size > 0 ? totalRetries / chunkRetries.size : 0;

    return {
      totalEvents: this.redistributionHistory.length,
      byType,
      avgRetries,
      pendingCount: this.pendingRedistributions.size,
      carrierUtilization: new Map(this.carrierLoads)
    };
  }

  /**
   * Update strategy
   */
  updateStrategy(updates: Partial<RedistributionStrategy>): void {
    this.strategy = { ...this.strategy, ...updates };
  }

  /**
   * Clear history and pending
   */
  reset(): void {
    this.pendingRedistributions.clear();
    this.redistributionHistory = [];
    this.carrierLoads.clear();
  }
}

export { RedistributionHandler as default };