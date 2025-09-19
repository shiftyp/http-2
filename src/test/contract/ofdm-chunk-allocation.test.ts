/**
 * Contract Test: OFDM Chunk-to-Carrier Allocation
 *
 * Verifies that chunks are optimally allocated to OFDM subcarriers
 * based on carrier quality, priority, and load balancing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkAllocator, type CarrierMetrics } from '../../src/lib/parallel-chunk-manager/allocator.js';
import { RarityManager } from '../../src/lib/parallel-chunk-manager/rarity.js';

describe('OFDM Chunk-to-Carrier Allocation Contract', () => {
  let allocator: ChunkAllocator;
  let rarityManager: RarityManager;

  beforeEach(() => {
    allocator = new ChunkAllocator();
    rarityManager = new RarityManager(100); // 100 total chunks
  });

  describe('Allocation Strategies', () => {
    it('should allocate chunks using quality-first strategy', () => {
      allocator.updateStrategy({ type: 'quality-first' });

      const chunks = [
        { id: 'chunk1', priority: 0.9, size: 1024 },
        { id: 'chunk2', priority: 0.5, size: 1024 },
        { id: 'chunk3', priority: 0.1, size: 1024 }
      ];

      const carriers: CarrierMetrics[] = [
        { id: 0, snr: 25, ber: 1e-6, capacity: 6, utilization: 0.1 }, // Best
        { id: 1, snr: 15, ber: 1e-4, capacity: 4, utilization: 0.3 }, // Medium
        { id: 2, snr: 8, ber: 1e-3, capacity: 2, utilization: 0.5 }   // Worst
      ];

      const allocations = allocator.allocate(chunks, carriers);

      // High priority chunks should go to best carriers
      expect(allocations.get('chunk1')).toBe(0); // Best carrier
      expect(allocations.get('chunk2')).toBe(1); // Medium carrier
      expect(allocations.get('chunk3')).toBe(2); // Worst carrier
    });

    it('should allocate chunks using load-balanced strategy', () => {
      allocator.updateStrategy({
        type: 'load-balanced',
        qualityThreshold: 10,
        loadFactor: 0.8
      });

      const chunks = Array.from({ length: 9 }, (_, i) => ({
        id: `chunk${i}`,
        priority: 0.5,
        size: 1024
      }));

      const carriers: CarrierMetrics[] = [
        { id: 0, snr: 20, ber: 1e-5, capacity: 4, utilization: 0.2 },
        { id: 1, snr: 18, ber: 1e-5, capacity: 4, utilization: 0.2 },
        { id: 2, snr: 16, ber: 1e-4, capacity: 4, utilization: 0.2 }
      ];

      const allocations = allocator.allocate(chunks, carriers);

      // Should distribute evenly
      const carrierCounts = new Map<number, number>();
      for (const carrierId of allocations.values()) {
        carrierCounts.set(carrierId, (carrierCounts.get(carrierId) || 0) + 1);
      }

      expect(carrierCounts.get(0)).toBe(3);
      expect(carrierCounts.get(1)).toBe(3);
      expect(carrierCounts.get(2)).toBe(3);
    });

    it('should allocate chunks using priority-weighted strategy', () => {
      allocator.updateStrategy({
        type: 'priority-weighted',
        qualityThreshold: 10
      });

      const chunks = [
        { id: 'critical', priority: 1.0, size: 512 },
        { id: 'high', priority: 0.8, size: 1024 },
        { id: 'medium', priority: 0.5, size: 2048 },
        { id: 'low', priority: 0.2, size: 4096 }
      ];

      const carriers: CarrierMetrics[] = [
        { id: 0, snr: 30, ber: 1e-7, capacity: 6, utilization: 0.0 }, // Excellent
        { id: 1, snr: 22, ber: 1e-6, capacity: 4, utilization: 0.2 }, // Good
        { id: 2, snr: 15, ber: 1e-4, capacity: 2, utilization: 0.4 }, // Fair
        { id: 3, snr: 11, ber: 1e-3, capacity: 2, utilization: 0.6 }  // Poor
      ];

      const allocations = allocator.allocate(chunks, carriers);

      // Critical chunk should get best carrier
      expect(allocations.get('critical')).toBe(0);
      // High priority should get good carrier
      expect(allocations.get('high')).toBe(1);
    });
  });

  describe('Quality Thresholds', () => {
    it('should not allocate to carriers below quality threshold', () => {
      allocator.updateStrategy({
        type: 'quality-first',
        qualityThreshold: 15
      });

      const chunks = [{ id: 'chunk1', priority: 0.5, size: 1024 }];

      const carriers: CarrierMetrics[] = [
        { id: 0, snr: 10, ber: 1e-3, capacity: 2, utilization: 0.1 }, // Below threshold
        { id: 1, snr: 20, ber: 1e-5, capacity: 4, utilization: 0.2 }  // Above threshold
      ];

      const allocations = allocator.allocate(chunks, carriers);

      expect(allocations.get('chunk1')).toBe(1); // Should use carrier 1
      expect(allocations.has('chunk1')).toBe(true);
    });

    it('should respect utilization limits in allocation', () => {
      allocator.updateStrategy({
        type: 'load-balanced',
        loadFactor: 0.7
      });

      const chunks = [
        { id: 'chunk1', priority: 0.5, size: 1024 },
        { id: 'chunk2', priority: 0.5, size: 1024 }
      ];

      const carriers: CarrierMetrics[] = [
        { id: 0, snr: 20, ber: 1e-5, capacity: 4, utilization: 0.8 }, // Over limit
        { id: 1, snr: 18, ber: 1e-5, capacity: 4, utilization: 0.5 }  // Under limit
      ];

      const allocations = allocator.allocate(chunks, carriers);

      // Both should go to carrier 1 since carrier 0 is over limit
      expect(allocations.get('chunk1')).toBe(1);
      expect(allocations.get('chunk2')).toBe(1);
    });
  });

  describe('Rarity-Based Priority', () => {
    it('should prioritize rare chunks for allocation', () => {
      // Update peer availability
      rarityManager.updatePeerAvailability('peer1', [1, 2, 3, 4, 5]);
      rarityManager.updatePeerAvailability('peer2', [2, 3, 4, 5, 6]);
      rarityManager.updatePeerAvailability('peer3', [3, 4, 5, 6, 7]);

      const prioritizedChunks = rarityManager.getPrioritizedChunks(5);

      // Chunk 1 should be rarest (only peer1 has it)
      expect(prioritizedChunks[0]).toBe(1);
    });

    it('should adjust chunk priority based on local availability', () => {
      rarityManager.markLocalChunks([1, 2, 3]);

      rarityManager.updatePeerAvailability('peer1', [4, 5, 6]);
      rarityManager.updatePeerAvailability('peer2', [4, 5, 7]);

      const prioritizedChunks = rarityManager.getPrioritizedChunks(5);

      // Should prioritize chunks we don't have
      expect(prioritizedChunks).not.toContain(1);
      expect(prioritizedChunks).not.toContain(2);
      expect(prioritizedChunks).not.toContain(3);
    });

    it('should track rarity distribution across swarm', () => {
      // Simulate swarm with varying chunk availability
      for (let peer = 0; peer < 10; peer++) {
        const available = Array.from({ length: 50 }, () =>
          Math.floor(Math.random() * 100)
        );
        rarityManager.updatePeerAvailability(`peer${peer}`, available);
      }

      const distribution = rarityManager.getRarityDistribution();

      expect(distribution.rare).toBeGreaterThanOrEqual(0);
      expect(distribution.uncommon).toBeGreaterThanOrEqual(0);
      expect(distribution.common).toBeGreaterThanOrEqual(0);
      expect(distribution.veryCommon).toBeGreaterThanOrEqual(0);

      const total = distribution.rare + distribution.uncommon +
                   distribution.common + distribution.veryCommon;
      expect(total).toBe(100); // All chunks accounted for
    });
  });

  describe('Carrier History and Reliability', () => {
    it('should track carrier performance history', () => {
      const carrier0Metrics: CarrierMetrics = {
        id: 0,
        snr: 20,
        ber: 1e-5,
        capacity: 4,
        utilization: 0.3
      };

      // Update history multiple times
      for (let i = 0; i < 10; i++) {
        allocator.updateCarrierHistory(0, {
          ...carrier0Metrics,
          snr: 20 + (Math.random() - 0.5) * 2 // Small variations
        });
      }

      const reliability = allocator.getCarrierReliability(0);

      expect(reliability).toBeGreaterThan(0);
      expect(reliability).toBeLessThanOrEqual(1);
    });

    it('should prefer reliable carriers for important chunks', () => {
      // Build history for carriers
      for (let i = 0; i < 20; i++) {
        // Carrier 0: Stable
        allocator.updateCarrierHistory(0, {
          id: 0,
          snr: 20 + (Math.random() - 0.5),
          ber: 1e-5,
          capacity: 4,
          utilization: 0.3
        });

        // Carrier 1: Unstable
        allocator.updateCarrierHistory(1, {
          id: 1,
          snr: 15 + (Math.random() - 0.5) * 10, // Large variations
          ber: 1e-4,
          capacity: 4,
          utilization: 0.3
        });
      }

      const reliability0 = allocator.getCarrierReliability(0);
      const reliability1 = allocator.getCarrierReliability(1);

      expect(reliability0).toBeGreaterThan(reliability1);
    });
  });

  describe('Dynamic Reallocation', () => {
    it('should support reallocation when carrier conditions change', () => {
      const chunks = [
        { id: 'chunk1', priority: 0.5, size: 1024 },
        { id: 'chunk2', priority: 0.5, size: 1024 }
      ];

      const carriers1: CarrierMetrics[] = [
        { id: 0, snr: 25, ber: 1e-6, capacity: 4, utilization: 0.2 },
        { id: 1, snr: 10, ber: 1e-3, capacity: 2, utilization: 0.3 }
      ];

      const allocations1 = allocator.allocate(chunks, carriers1);
      expect(allocations1.get('chunk1')).toBe(0); // Good carrier

      // Conditions change
      const carriers2: CarrierMetrics[] = [
        { id: 0, snr: 8, ber: 1e-2, capacity: 2, utilization: 0.8 },  // Degraded
        { id: 1, snr: 22, ber: 1e-5, capacity: 4, utilization: 0.1 }  // Improved
      ];

      const allocations2 = allocator.allocate(chunks, carriers2);
      expect(allocations2.get('chunk1')).toBe(1); // Should switch
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate allocation efficiency', () => {
      const chunks = Array.from({ length: 40 }, (_, i) => ({
        id: `chunk${i}`,
        priority: Math.random(),
        size: 1024 + Math.random() * 3072
      }));

      const carriers: CarrierMetrics[] = Array.from({ length: 48 }, (_, i) => ({
        id: i,
        snr: 10 + Math.random() * 20,
        ber: Math.pow(10, -6 + Math.random() * 3),
        capacity: Math.floor(2 + Math.random() * 4),
        utilization: Math.random() * 0.5
      }));

      const allocations = allocator.allocate(chunks, carriers);

      expect(allocations.size).toBeGreaterThan(0);
      expect(allocations.size).toBeLessThanOrEqual(chunks.length);

      const stats = allocator.getStatistics();
      expect(stats.totalAllocations).toBeGreaterThanOrEqual(0);
      expect(stats.avgCarrierScore).toBeGreaterThanOrEqual(0);
    });

    it('should optimize for maximum throughput', () => {
      allocator.updateStrategy({ type: 'quality-first' });

      const chunks = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk${i}`,
        priority: 0.5 + Math.random() * 0.5,
        size: 1024
      }));

      const carriers: CarrierMetrics[] = Array.from({ length: 48 }, (_, i) => {
        const snr = 5 + Math.random() * 25;
        const capacity = snr > 20 ? 6 : snr > 15 ? 4 : 2;
        return {
          id: i,
          snr,
          ber: Math.pow(10, -snr / 5),
          capacity,
          utilization: 0
        };
      });

      const allocations = allocator.allocate(chunks, carriers);

      // Calculate total capacity
      let totalCapacity = 0;
      for (const carrierId of allocations.values()) {
        const carrier = carriers.find(c => c.id === carrierId);
        if (carrier) {
          totalCapacity += carrier.capacity;
        }
      }

      // Should achieve reasonable capacity utilization
      expect(totalCapacity).toBeGreaterThan(chunks.length * 2); // At least QPSK
    });
  });
});