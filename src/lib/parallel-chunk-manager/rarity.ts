/**
 * Rarity-based Prioritization for BitTorrent Chunks
 *
 * Implements rarity scoring and prioritization for efficient
 * swarm participation in OFDM parallel transmission.
 */

export interface PeerAvailability {
  peerId: string;
  availableChunks: Set<number>;
  lastSeen: number;
  reliability: number; // 0-1
}

export interface RarityScore {
  chunkId: number;
  rarity: number; // 0-1, lower = rarer
  availability: number; // Number of peers with chunk
  priority: number; // Calculated priority
}

export class RarityManager {
  private peerAvailability: Map<string, PeerAvailability> = new Map();
  private chunkRarity: Map<number, RarityScore> = new Map();
  private localChunks: Set<number> = new Set();
  private totalChunks: number;
  private updateInterval: number = 5000; // 5 seconds

  constructor(totalChunks: number) {
    this.totalChunks = totalChunks;
    this.startPeriodicUpdate();
  }

  /**
   * Update peer availability information
   */
  updatePeerAvailability(peerId: string, availableChunks: number[]): void {
    const peer: PeerAvailability = {
      peerId,
      availableChunks: new Set(availableChunks),
      lastSeen: Date.now(),
      reliability: this.calculatePeerReliability(peerId)
    };

    this.peerAvailability.set(peerId, peer);
    this.recalculateRarity();
  }

  /**
   * Mark chunks as locally available
   */
  markLocalChunks(chunkIds: number[]): void {
    for (const id of chunkIds) {
      this.localChunks.add(id);
    }
    this.recalculateRarity();
  }

  /**
   * Recalculate rarity scores for all chunks
   */
  private recalculateRarity(): void {
    // Count availability for each chunk
    const chunkCounts = new Map<number, number>();

    for (let i = 0; i < this.totalChunks; i++) {
      chunkCounts.set(i, 0);
    }

    // Count peers that have each chunk
    for (const peer of this.peerAvailability.values()) {
      // Only count recently seen, reliable peers
      if (this.isPeerActive(peer)) {
        for (const chunkId of peer.availableChunks) {
          chunkCounts.set(chunkId, (chunkCounts.get(chunkId) || 0) + 1);
        }
      }
    }

    // Calculate rarity scores
    const activePeers = this.getActivePeerCount();
    for (const [chunkId, count] of chunkCounts.entries()) {
      const rarity = activePeers > 0 ? count / activePeers : 0;

      const score: RarityScore = {
        chunkId,
        rarity,
        availability: count,
        priority: this.calculatePriority(rarity, chunkId)
      };

      this.chunkRarity.set(chunkId, score);
    }
  }

  /**
   * Calculate priority based on rarity and other factors
   */
  private calculatePriority(rarity: number, chunkId: number): number {
    // Base priority from rarity (rarer = higher priority)
    let priority = 1 - rarity;

    // Boost priority for missing local chunks
    if (!this.localChunks.has(chunkId)) {
      priority *= 1.5;
    }

    // Sequential bonus (prefer chunks near what we have)
    const sequentialBonus = this.getSequentialBonus(chunkId);
    priority += sequentialBonus * 0.2;

    // Endgame mode: prioritize last few chunks
    const completionRatio = this.localChunks.size / this.totalChunks;
    if (completionRatio > 0.9) {
      priority *= 2;
    }

    return Math.min(1, priority);
  }

  /**
   * Get bonus for sequential chunks
   */
  private getSequentialBonus(chunkId: number): number {
    // Check if adjacent chunks are available
    const hasPrevious = chunkId > 0 && this.localChunks.has(chunkId - 1);
    const hasNext = chunkId < this.totalChunks - 1 && this.localChunks.has(chunkId + 1);

    if (hasPrevious || hasNext) {
      return 0.5;
    }

    // Check for nearby chunks (within 5)
    let nearbyCount = 0;
    for (let i = Math.max(0, chunkId - 5); i <= Math.min(this.totalChunks - 1, chunkId + 5); i++) {
      if (this.localChunks.has(i)) {
        nearbyCount++;
      }
    }

    return nearbyCount / 10;
  }

  /**
   * Get prioritized list of chunks to download
   */
  getPrioritizedChunks(limit: number = 48): number[] {
    const missingChunks = [];

    for (const [chunkId, score] of this.chunkRarity.entries()) {
      if (!this.localChunks.has(chunkId)) {
        missingChunks.push({ id: chunkId, ...score });
      }
    }

    // Sort by priority (highest first)
    missingChunks.sort((a, b) => b.priority - a.priority);

    return missingChunks.slice(0, limit).map(c => c.id);
  }

  /**
   * Get rarity distribution statistics
   */
  getRarityDistribution(): {
    rare: number;      // < 0.2 availability
    uncommon: number;  // 0.2-0.5
    common: number;    // 0.5-0.8
    veryCommon: number; // > 0.8
  } {
    const distribution = {
      rare: 0,
      uncommon: 0,
      common: 0,
      veryCommon: 0
    };

    for (const score of this.chunkRarity.values()) {
      if (score.rarity < 0.2) distribution.rare++;
      else if (score.rarity < 0.5) distribution.uncommon++;
      else if (score.rarity < 0.8) distribution.common++;
      else distribution.veryCommon++;
    }

    return distribution;
  }

  /**
   * Calculate peer reliability based on history
   */
  private calculatePeerReliability(peerId: string): number {
    const existing = this.peerAvailability.get(peerId);
    if (!existing) return 0.5; // Default for new peers

    // Simple reliability based on how long peer has been active
    const activeTime = Date.now() - existing.lastSeen;
    const reliability = Math.min(1, activeTime / (60 * 60 * 1000)); // Max after 1 hour

    return reliability;
  }

  /**
   * Check if peer is currently active
   */
  private isPeerActive(peer: PeerAvailability): boolean {
    const maxAge = 30000; // 30 seconds
    return Date.now() - peer.lastSeen < maxAge && peer.reliability > 0.3;
  }

  /**
   * Get count of active peers
   */
  private getActivePeerCount(): number {
    return Array.from(this.peerAvailability.values())
      .filter(peer => this.isPeerActive(peer)).length;
  }

  /**
   * Remove inactive peers
   */
  private pruneInactivePeers(): void {
    const maxAge = 60000; // 1 minute
    const now = Date.now();

    for (const [peerId, peer] of this.peerAvailability.entries()) {
      if (now - peer.lastSeen > maxAge) {
        this.peerAvailability.delete(peerId);
      }
    }
  }

  /**
   * Start periodic rarity updates
   */
  private startPeriodicUpdate(): void {
    setInterval(() => {
      this.pruneInactivePeers();
      this.recalculateRarity();
    }, this.updateInterval);
  }

  /**
   * Get chunk rarity score
   */
  getChunkRarity(chunkId: number): RarityScore | undefined {
    return this.chunkRarity.get(chunkId);
  }

  /**
   * Get swarm health metrics
   */
  getSwarmHealth(): {
    totalPeers: number;
    activePeers: number;
    averageAvailability: number;
    completionRatio: number;
    healthScore: number; // 0-1
  } {
    const totalPeers = this.peerAvailability.size;
    const activePeers = this.getActivePeerCount();

    let totalAvailability = 0;
    for (const peer of this.peerAvailability.values()) {
      if (this.isPeerActive(peer)) {
        totalAvailability += peer.availableChunks.size / this.totalChunks;
      }
    }

    const averageAvailability = activePeers > 0 ? totalAvailability / activePeers : 0;
    const completionRatio = this.localChunks.size / this.totalChunks;

    // Health score based on multiple factors
    const peerScore = Math.min(1, activePeers / 10); // Good with 10+ peers
    const availabilityScore = averageAvailability;
    const completionScore = completionRatio;

    const healthScore = (peerScore * 0.3 + availabilityScore * 0.3 + completionScore * 0.4);

    return {
      totalPeers,
      activePeers,
      averageAvailability,
      completionRatio,
      healthScore
    };
  }

  /**
   * Reset rarity manager
   */
  reset(): void {
    this.peerAvailability.clear();
    this.chunkRarity.clear();
    this.localChunks.clear();
  }
}

export { RarityManager as default };