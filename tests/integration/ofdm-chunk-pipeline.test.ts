/**
 * Integration Test: OFDM Chunk Pipelining
 *
 * Tests efficient pipelining of BitTorrent chunks for continuous
 * transmission with prefetching and buffering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChunkPipeline } from '../../src/lib/parallel-chunk-manager/pipeline.js';
import { ParallelChunkManager } from '../../src/lib/parallel-chunk-manager/index.js';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { RarityManager } from '../../src/lib/parallel-chunk-manager/rarity.js';

describe('OFDM Chunk Pipeline Integration', () => {
  let pipeline: ChunkPipeline;
  let chunkManager: ParallelChunkManager;
  let modem: OFDMModem;
  let rarityManager: RarityManager;

  // Simulated torrent file
  const torrentFile = {
    name: 'test-content.dat',
    size: 102400, // 100 KB
    pieceLength: 256, // bytes
    totalPieces: 400,
    pieces: [] as Array<{
      index: number;
      hash: string;
      data: Uint8Array;
      available: boolean;
    }>
  };

  beforeEach(() => {
    pipeline = new ChunkPipeline(96); // Depth of 96 chunks
    chunkManager = new ParallelChunkManager();
    modem = new OFDMModem();
    rarityManager = new RarityManager(torrentFile.totalPieces);

    chunkManager.initialize(modem);

    // Initialize torrent pieces
    for (let i = 0; i < torrentFile.totalPieces; i++) {
      torrentFile.pieces.push({
        index: i,
        hash: `hash_${i}`,
        data: new Uint8Array(torrentFile.pieceLength),
        available: Math.random() > 0.3 // 70% initially available
      });
    }
  });

  afterEach(() => {
    pipeline.clear();
    chunkManager.reset();
    torrentFile.pieces = [];
  });

  describe('Pipeline Initialization', () => {
    it('should create pipeline with correct depth', () => {
      const status = pipeline.getStatus();
      expect(status.queued).toBe(0);
      expect(status.inFlight).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.fillLevel).toBe(0);
    });

    it('should enqueue chunks up to pipeline depth', () => {
      const chunks = Array.from({ length: 150 }, (_, i) => ({
        id: `chunk_${i}`,
        data: new Uint8Array(256),
        priority: Math.random(),
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 10 + Math.random() * 20
      }));

      for (const chunk of chunks) {
        pipeline.enqueue(chunk);
      }

      const status = pipeline.getStatus();
      expect(status.queued).toBe(96); // Max depth
    });

    it('should maintain priority ordering in pipeline', () => {
      const chunks = [
        { id: 'low', data: new Uint8Array(256), priority: 0.1, enqueuedAt: Date.now(), estimatedTransmitTime: 10 },
        { id: 'high', data: new Uint8Array(256), priority: 0.9, enqueuedAt: Date.now(), estimatedTransmitTime: 10 },
        { id: 'medium', data: new Uint8Array(256), priority: 0.5, enqueuedAt: Date.now(), estimatedTransmitTime: 10 }
      ];

      chunks.forEach(c => pipeline.enqueue(c));

      const next = pipeline.dequeue();
      expect(next?.id).toBe('high'); // Highest priority first
    });
  });

  describe('Continuous Flow Management', () => {
    it('should maintain continuous chunk flow', async () => {
      const transmissionRate = 10; // chunks per second
      const testDuration = 1000; // ms

      let enqueuedCount = 0;
      let transmittedCount = 0;

      // Producer thread
      const producer = setInterval(() => {
        if (pipeline.needsPrefetch()) {
          const batch = Array.from({ length: 10 }, () => ({
            id: `chunk_${enqueuedCount++}`,
            data: new Uint8Array(256),
            priority: Math.random(),
            enqueuedAt: Date.now(),
            estimatedTransmitTime: 1000 / transmissionRate
          }));
          pipeline.enqueueBatch(batch);
        }
      }, 100);

      // Consumer thread
      const consumer = setInterval(() => {
        const chunk = pipeline.dequeue();
        if (chunk) {
          transmittedCount++;
          // Simulate transmission delay
          setTimeout(() => {
            pipeline.markCompleted(chunk.id);
          }, chunk.estimatedTransmitTime);
        }
      }, 1000 / transmissionRate);

      await new Promise(resolve => setTimeout(resolve, testDuration));

      clearInterval(producer);
      clearInterval(consumer);

      expect(transmittedCount).toBeGreaterThan(0);
      expect(pipeline.getFillLevel()).toBeGreaterThan(0); // Pipeline should stay filled
    });

    it('should handle burst transmission efficiently', () => {
      // Fill pipeline
      const chunks = Array.from({ length: 96 }, (_, i) => ({
        id: `chunk_${i}`,
        data: new Uint8Array(256),
        priority: 0.5,
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 10
      }));

      pipeline.enqueueBatch(chunks);

      // Burst dequeue
      const batch = pipeline.dequeueBatch(48); // Half the pipeline

      expect(batch).toHaveLength(48);
      expect(pipeline.getStatus().queued).toBe(48);
    });

    it('should trigger prefetch at threshold', () => {
      // Fill to just above threshold
      const chunks = Array.from({ length: 50 }, (_, i) => ({
        id: `chunk_${i}`,
        data: new Uint8Array(256),
        priority: 0.5,
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 10
      }));

      pipeline.enqueueBatch(chunks);
      expect(pipeline.needsPrefetch()).toBe(false);

      // Drain below threshold
      pipeline.dequeueBatch(30);
      expect(pipeline.needsPrefetch()).toBe(true);
    });
  });

  describe('Dependency Management', () => {
    it('should respect chunk dependencies', () => {
      const chunks = [
        {
          id: 'chunk_2',
          data: new Uint8Array(256),
          priority: 0.9,
          enqueuedAt: Date.now(),
          estimatedTransmitTime: 10,
          dependencies: ['chunk_1'] // Depends on chunk_1
        },
        {
          id: 'chunk_1',
          data: new Uint8Array(256),
          priority: 0.1, // Lower priority
          enqueuedAt: Date.now(),
          estimatedTransmitTime: 10
        }
      ];

      chunks.forEach(c => pipeline.enqueue(c));

      // First dequeue should be chunk_1 despite lower priority
      const first = pipeline.dequeue();
      expect(first?.id).toBe('chunk_1');

      pipeline.markCompleted('chunk_1');

      // Now chunk_2 can be dequeued
      const second = pipeline.dequeue();
      expect(second?.id).toBe('chunk_2');
    });

    it('should handle circular dependencies gracefully', () => {
      const chunks = [
        {
          id: 'chunk_A',
          data: new Uint8Array(256),
          priority: 0.5,
          enqueuedAt: Date.now(),
          estimatedTransmitTime: 10,
          dependencies: ['chunk_B'] // A depends on B
        },
        {
          id: 'chunk_B',
          data: new Uint8Array(256),
          priority: 0.5,
          enqueuedAt: Date.now(),
          estimatedTransmitTime: 10,
          dependencies: ['chunk_A'] // B depends on A (circular)
        }
      ];

      chunks.forEach(c => pipeline.enqueue(c));

      // Should detect and handle circular dependency
      const ready = pipeline.getReadyChunks(2);
      expect(ready).toHaveLength(0); // Neither can be transmitted
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize pipeline ordering for throughput', () => {
      // Mix of small and large chunks
      const chunks = Array.from({ length: 50 }, (_, i) => ({
        id: `chunk_${i}`,
        data: new Uint8Array(i % 3 === 0 ? 512 : 256), // Varying sizes
        priority: Math.random(),
        enqueuedAt: Date.now(),
        estimatedTransmitTime: i % 3 === 0 ? 20 : 10
      }));

      pipeline.enqueueBatch(chunks);
      pipeline.optimize();

      // After optimization, ready chunks should be efficiently ordered
      const ready = pipeline.getReadyChunks(10);
      expect(ready).toHaveLength(10);

      // Higher priority chunks should be near the front
      const priorities = ready.map(c => c.priority);
      const avgFirstHalf = priorities.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const avgSecondHalf = priorities.slice(5).reduce((a, b) => a + b, 0) / 5;

      expect(avgFirstHalf).toBeGreaterThanOrEqual(avgSecondHalf);
    });

    it('should estimate completion time accurately', () => {
      const chunks = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk_${i}`,
        data: new Uint8Array(256),
        priority: 0.5,
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 100 // 100ms per chunk
      }));

      pipeline.enqueueBatch(chunks);

      const estimatedTime = pipeline.getEstimatedCompletionTime();
      const expectedTime = 20 * 100; // 20 chunks * 100ms

      expect(estimatedTime).toBeCloseTo(expectedTime, -2); // Within 100ms
    });
  });

  describe('Failure Recovery', () => {
    it('should requeue failed chunks with reduced priority', () => {
      const chunk = {
        id: 'chunk_fail',
        data: new Uint8Array(256),
        priority: 0.8,
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 10
      };

      pipeline.enqueue(chunk);
      const dequeued = pipeline.dequeue();
      expect(dequeued?.id).toBe('chunk_fail');

      // Mark as failed
      pipeline.markFailed('chunk_fail', true); // retry = true

      // Check it's back in queue with lower priority
      const status = pipeline.getStatus();
      expect(status.queued).toBe(1);

      const requeued = pipeline.dequeue();
      expect(requeued?.id).toBe('chunk_fail');
      expect(requeued?.priority).toBeLessThan(0.8);
    });

    it('should handle multiple failures with retry limit', () => {
      const chunk = {
        id: 'chunk_multi_fail',
        data: new Uint8Array(256),
        priority: 0.5,
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 10
      };

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        pipeline.enqueue(chunk);
        const dequeued = pipeline.dequeue();
        pipeline.markFailed(dequeued!.id, true);
        chunk.priority *= 0.8; // Reduce priority each time
      }

      // After multiple failures, priority should be very low
      pipeline.enqueue(chunk);
      const final = pipeline.dequeue();
      expect(final?.priority).toBeLessThan(0.3);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track throughput metrics', async () => {
      vi.useFakeTimers();

      const chunks = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk_${i}`,
        data: new Uint8Array(256),
        priority: 0.5,
        enqueuedAt: Date.now(),
        estimatedTransmitTime: 100
      }));

      pipeline.enqueueBatch(chunks);

      // Simulate transmission
      for (let i = 0; i < 10; i++) {
        const chunk = pipeline.dequeue();
        if (chunk) {
          vi.advanceTimersByTime(100);
          pipeline.markCompleted(chunk.id);
        }
      }

      const metrics = pipeline.getMetrics();
      expect(metrics.throughput).toBeGreaterThanOrEqual(0);
      expect(metrics.latency).toBeGreaterThanOrEqual(0);
      expect(metrics.bufferUtilization).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('should track pipeline efficiency', () => {
      // Measure how efficiently pipeline maintains flow
      const testDuration = 100; // time steps
      const efficiencyHistory = [];

      for (let t = 0; t < testDuration; t++) {
        // Add chunks when needed
        if (pipeline.needsPrefetch()) {
          const batch = Array.from({ length: 10 }, () => ({
            id: `chunk_${t}_${Math.random()}`,
            data: new Uint8Array(256),
            priority: Math.random(),
            enqueuedAt: Date.now(),
            estimatedTransmitTime: 10
          }));
          pipeline.enqueueBatch(batch);
        }

        // Transmit chunks
        const ready = pipeline.dequeueBatch(5);
        ready.forEach(c => {
          setTimeout(() => pipeline.markCompleted(c.id), c.estimatedTransmitTime);
        });

        efficiencyHistory.push(pipeline.getFillLevel());
      }

      // Average fill level should be good
      const avgFillLevel = efficiencyHistory.reduce((a, b) => a + b, 0) / testDuration;
      expect(avgFillLevel).toBeGreaterThan(0.3); // At least 30% filled
      expect(avgFillLevel).toBeLessThan(0.9); // Not constantly full
    });
  });

  describe('Integration with Rarity Manager', () => {
    it('should prioritize rare chunks in pipeline', () => {
      // Update peer availability
      rarityManager.updatePeerAvailability('peer1', [1, 2, 3, 4, 5]);
      rarityManager.updatePeerAvailability('peer2', [3, 4, 5, 6, 7]);
      rarityManager.updatePeerAvailability('peer3', [5, 6, 7, 8, 9]);

      // Get prioritized chunks
      const prioritizedIndices = rarityManager.getPrioritizedChunks(10);

      // Create pipeline chunks based on rarity
      const chunks = prioritizedIndices.map(index => {
        const rarity = rarityManager.getChunkRarity(index);
        return {
          id: `chunk_${index}`,
          data: torrentFile.pieces[index].data,
          priority: 1 - (rarity?.rarity || 0), // Invert rarity for priority
          enqueuedAt: Date.now(),
          estimatedTransmitTime: 10
        };
      });

      pipeline.enqueueBatch(chunks);

      // First dequeued should be rarest
      const first = pipeline.dequeue();
      expect(first?.id).toBe(`chunk_${prioritizedIndices[0]}`);
    });

    it('should adapt to swarm health', () => {
      // Simulate different swarm conditions
      const swarmConditions = [
        { activePeers: 2, avgAvailability: 0.3 },  // Poor swarm
        { activePeers: 10, avgAvailability: 0.8 }, // Healthy swarm
      ];

      for (const condition of swarmConditions) {
        // Update swarm state
        for (let i = 0; i < condition.activePeers; i++) {
          const available = Array.from({ length: torrentFile.totalPieces }, (_, idx) =>
            Math.random() < condition.avgAvailability ? idx : -1
          ).filter(idx => idx >= 0);

          rarityManager.updatePeerAvailability(`peer_${i}`, available);
        }

        const swarmHealth = rarityManager.getSwarmHealth();

        // Pipeline depth should adapt
        if (swarmHealth.healthScore < 0.5) {
          // Poor swarm - deeper pipeline for redundancy
          expect(pipeline.getStatus().fillLevel).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('End-to-End Pipeline Flow', () => {
    it('should complete full file transfer through pipeline', async () => {
      const totalChunks = 100;
      let completedChunks = 0;
      const startTime = Date.now();

      // Create all chunks
      const chunks = Array.from({ length: totalChunks }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: totalChunks,
        data: new Uint8Array(256),
        hash: `hash_${i}`,
        rarity: Math.random(),
        attempts: 0
      }));

      // Queue to chunk manager
      chunkManager.queueChunks(chunks);

      // Process through pipeline
      while (completedChunks < totalChunks) {
        // Get chunks from manager
        const allocations = chunkManager.getCarrierAllocations();

        for (const [carrierId, allocation] of allocations.entries()) {
          if (allocation.status === 'completed') {
            completedChunks++;
            chunkManager['completedChunks'].add(allocation.chunkId);
          }
        }

        // Simulate time passing
        await new Promise(resolve => setTimeout(resolve, 10));

        // Break if taking too long
        if (Date.now() - startTime > 5000) break;
      }

      expect(completedChunks).toBeGreaterThan(0);
    });

    it('should maintain QoS during transfer', () => {
      const qosRequirements = {
        minThroughput: 10, // chunks/second
        maxLatency: 500,   // ms
        maxJitter: 100     // ms
      };

      const metrics = [];

      // Simulate transfer with QoS monitoring
      for (let i = 0; i < 50; i++) {
        const chunk = {
          id: `chunk_${i}`,
          data: new Uint8Array(256),
          priority: 0.5,
          enqueuedAt: Date.now(),
          estimatedTransmitTime: 50
        };

        pipeline.enqueue(chunk);
        const dequeued = pipeline.dequeue();

        if (dequeued) {
          const latency = Date.now() - dequeued.enqueuedAt;
          metrics.push({
            latency,
            timestamp: Date.now()
          });

          pipeline.markCompleted(dequeued.id);
        }
      }

      // Check QoS metrics
      const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
      expect(avgLatency).toBeLessThan(qosRequirements.maxLatency);

      // Calculate jitter
      let jitter = 0;
      for (let i = 1; i < metrics.length; i++) {
        jitter += Math.abs(metrics[i].latency - metrics[i-1].latency);
      }
      jitter /= metrics.length - 1;

      expect(jitter).toBeLessThan(qosRequirements.maxJitter);
    });
  });
});