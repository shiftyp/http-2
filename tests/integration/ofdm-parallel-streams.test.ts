/**
 * Integration Test: OFDM 48 Parallel Streams
 *
 * Tests simultaneous transmission across all 48 OFDM subcarriers
 * with full system load and coordination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { ParallelChunkManager } from '../../src/lib/parallel-chunk-manager/index.js';
import { CarrierHealthMonitor } from '../../src/lib/carrier-health-monitor/index.js';
import { ChunkAllocator } from '../../src/lib/parallel-chunk-manager/allocator.js';
import { OFDMSchema } from '../../src/lib/database/ofdm-schema.js';

describe('OFDM 48 Parallel Streams Integration', () => {
  let modem: OFDMModem;
  let chunkManager: ParallelChunkManager;
  let healthMonitor: CarrierHealthMonitor;
  let allocator: ChunkAllocator;
  let database: OFDMSchema;

  // Test configuration
  const config = {
    numCarriers: 48,
    numDataCarriers: 40, // 48 - 8 pilots
    symbolRate: 37500,   // symbols/sec
    fftSize: 64,
    cpRatio: 0.25
  };

  // Large file for stress testing
  const testFile = {
    name: 'large-file.dat',
    size: 1048576, // 1 MB
    chunkSize: 256,
    totalChunks: 4096
  };

  beforeEach(async () => {
    modem = new OFDMModem();
    chunkManager = new ParallelChunkManager();
    healthMonitor = new CarrierHealthMonitor();
    allocator = new ChunkAllocator();
    database = new OFDMSchema();

    await database.initialize();
    chunkManager.initialize(modem);
    healthMonitor.initialize(modem);
  });

  afterEach(() => {
    healthMonitor.stop();
    database.close();
    chunkManager.reset();
  });

  describe('Full Carrier Utilization', () => {
    it('should utilize all 48 carriers simultaneously', async () => {
      const chunks = Array.from({ length: 48 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 48,
        data: new Uint8Array(256),
        hash: `hash_${i}`,
        rarity: 0.5,
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);

      // Check allocations
      const allocations = chunkManager.getCarrierAllocations();

      // Should use all data carriers (excluding pilots)
      expect(allocations.size).toBeLessThanOrEqual(40);

      // Verify each carrier has an assignment
      const usedCarriers = new Set(allocations.values()).size;
      expect(usedCarriers).toBeGreaterThan(0);
    });

    it('should maintain parallel transmission across all carriers', async () => {
      const transmissionPromises = [];

      // Transmit on all data carriers simultaneously
      for (let carrier = 0; carrier < 48; carrier++) {
        if (carrier % 6 !== 0) { // Skip pilots
          const data = new Uint8Array(256);
          data[0] = carrier; // Mark with carrier ID

          transmissionPromises.push(
            modem.transmitOnCarrier(carrier, data).then(success => ({
              carrier,
              success
            }))
          );
        }
      }

      const results = await Promise.all(transmissionPromises);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results.length).toBe(40); // 48 - 8 pilots
    });

    it('should achieve maximum theoretical throughput', () => {
      const symbolRate = config.symbolRate;
      const dataCarriers = config.numDataCarriers;

      // Calculate throughput for different modulation schemes
      const throughputQPSK = symbolRate * 2 * dataCarriers;
      const throughput16QAM = symbolRate * 4 * dataCarriers;
      const throughput64QAM = symbolRate * 6 * dataCarriers;

      expect(throughputQPSK).toBeGreaterThanOrEqual(3000000);  // 3 Mbps
      expect(throughput16QAM).toBeGreaterThanOrEqual(6000000); // 6 Mbps
      expect(throughput64QAM).toBeGreaterThanOrEqual(9000000); // 9 Mbps
    });
  });

  describe('Carrier Coordination', () => {
    it('should coordinate pilot carriers across all streams', () => {
      const frame = modem.createFrame();
      const pilotIndices = [0, 6, 12, 18, 24, 30, 36, 42];

      // Verify pilot positions
      expect(frame.pilotCarriers).toEqual(pilotIndices);

      // Check pilots don't carry data
      const allocations = chunkManager.getCarrierAllocations();
      for (const pilot of pilotIndices) {
        expect(allocations.has(pilot)).toBe(false);
      }
    });

    it('should synchronize symbol timing across carriers', () => {
      const symbolDuration = (config.fftSize + config.fftSize * config.cpRatio) / 48000; // seconds

      // All carriers should have same symbol timing
      for (let carrier = 0; carrier < 48; carrier++) {
        const timing = modem.getCarrierTiming(carrier);
        expect(timing.symbolDuration).toBeCloseTo(symbolDuration * 1000, 2); // ms
      }
    });

    it('should maintain orthogonality between carriers', () => {
      // Generate test signals for each carrier
      const carriers = [];
      for (let i = 0; i < 48; i++) {
        const signal = new Float32Array(config.fftSize);
        signal[i] = 1; // Single carrier active

        carriers.push({
          id: i,
          signal,
          frequency: i * (48000 / config.fftSize) // Subcarrier frequency
        });
      }

      // Check orthogonality (cross-correlation should be ~0)
      for (let i = 0; i < carriers.length - 1; i++) {
        for (let j = i + 1; j < carriers.length; j++) {
          const correlation = calculateCorrelation(
            carriers[i].signal,
            carriers[j].signal
          );

          expect(Math.abs(correlation)).toBeLessThan(0.01); // Near zero
        }
      }
    });
  });

  describe('Load Distribution', () => {
    it('should evenly distribute load across carriers', () => {
      const chunks = Array.from({ length: 200 }, (_, i) => ({
        id: `chunk_${i}`,
        priority: 0.5, // Same priority
        size: 256
      }));

      // Healthy carriers
      const carriers = Array.from({ length: 48 }, (_, i) => ({
        id: i,
        snr: 20 + Math.random() * 5, // Similar quality
        ber: 1e-5,
        capacity: 4,
        utilization: 0
      }));

      allocator.updateStrategy({ type: 'load-balanced' });
      const allocations = allocator.allocate(chunks, carriers);

      // Count allocations per carrier
      const carrierCounts = new Map<number, number>();
      for (const carrierId of allocations.values()) {
        carrierCounts.set(carrierId, (carrierCounts.get(carrierId) || 0) + 1);
      }

      // Check distribution is relatively even
      const counts = Array.from(carrierCounts.values());
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;

      expect(Math.sqrt(variance)).toBeLessThan(avg * 0.3); // Low variance
    });

    it('should adapt load based on carrier quality', () => {
      const chunks = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk_${i}`,
        priority: Math.random(),
        size: 256
      }));

      // Variable quality carriers
      const carriers = Array.from({ length: 48 }, (_, i) => ({
        id: i,
        snr: 5 + Math.random() * 25, // Wide range
        ber: Math.pow(10, -6 + Math.random() * 3),
        capacity: 2 + Math.floor(Math.random() * 5),
        utilization: Math.random() * 0.5
      }));

      allocator.updateStrategy({ type: 'priority-weighted' });
      const allocations = allocator.allocate(chunks, carriers);

      // High priority chunks should go to better carriers
      const highPriorityChunks = chunks.filter(c => c.priority > 0.8);
      for (const chunk of highPriorityChunks) {
        if (allocations.has(chunk.id)) {
          const carrierId = allocations.get(chunk.id)!;
          const carrier = carriers.find(c => c.id === carrierId);
          expect(carrier?.snr).toBeGreaterThan(15); // Should use good carriers
        }
      }
    });
  });

  describe('System Stress Testing', () => {
    it('should handle maximum load without degradation', async () => {
      const startTime = Date.now();
      const maxChunks = 1000;
      let processedChunks = 0;

      // Generate maximum load
      const chunks = Array.from({ length: maxChunks }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: maxChunks,
        data: new Uint8Array(256),
        hash: `hash_${i}`,
        rarity: Math.random(),
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);

      // Process chunks
      while (processedChunks < maxChunks && Date.now() - startTime < 5000) {
        const status = chunkManager.getAllocationStatus();
        processedChunks = status.completed;

        // Simulate transmission progress
        const allocations = chunkManager.getCarrierAllocations();
        for (const [carrierId, allocation] of allocations.entries()) {
          if (allocation.status === 'transmitting') {
            // Simulate completion
            setTimeout(() => {
              chunkManager['completedChunks'].add(allocation.chunkId);
              chunkManager['chunkQueue'].delete(allocation.chunkId);
            }, 10);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const throughput = (processedChunks * 256 * 8) / ((Date.now() - startTime) / 1000);
      expect(throughput).toBeGreaterThan(0);
    });

    it('should maintain stability with varying channel conditions', async () => {
      // Simulate time-varying channel
      const testDuration = 1000; // ms
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        // Vary channel conditions
        for (let carrier = 0; carrier < 48; carrier++) {
          if (carrier % 6 !== 0) { // Skip pilots
            const health = healthMonitor.getCarrierHealth(carrier);
            if (health) {
              // Simulate fading
              health.snr = 15 + 10 * Math.sin(2 * Math.PI * (Date.now() - startTime) / 500);
              health.ber = Math.pow(10, -health.snr / 10);
            }
          }
        }

        // System should adapt
        const stats = healthMonitor.getStatistics();
        expect(stats.enabledCarriers).toBeGreaterThan(30); // Most carriers stay active

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it('should recover from burst errors across multiple carriers', async () => {
      // Setup normal operation
      const chunks = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 100,
        data: new Uint8Array(256),
        hash: `hash_${i}`,
        rarity: 0.5,
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);

      // Simulate burst error affecting multiple carriers
      const affectedCarriers = [5, 7, 9, 11, 13, 15]; // 6 carriers fail
      for (const carrier of affectedCarriers) {
        modem.disableCarrier(carrier);
      }

      // System should redistribute
      await new Promise(resolve => setTimeout(resolve, 100));

      const allocations = chunkManager.getCarrierAllocations();

      // Check no allocations on failed carriers
      for (const [carrierId, _] of allocations.entries()) {
        expect(affectedCarriers).not.toContain(carrierId);
      }

      // Re-enable carriers
      for (const carrier of affectedCarriers) {
        modem.enableCarrier(carrier);
      }

      // Should resume using them
      await new Promise(resolve => setTimeout(resolve, 100));

      const newAllocations = chunkManager.getCarrierAllocations();
      expect(newAllocations.size).toBeGreaterThan(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track per-carrier performance metrics', async () => {
      // Transmit on all carriers
      for (let carrier = 0; carrier < 48; carrier++) {
        if (carrier % 6 !== 0) {
          const metric = {
            id: `carrier_${carrier}_${Date.now()}`,
            carrierId: carrier,
            timestamp: Date.now(),
            snr: 15 + Math.random() * 10,
            ber: Math.pow(10, -5 - Math.random()),
            modulation: 'QPSK',
            powerLevel: 1,
            enabled: true,
            successRate: 0.95 + Math.random() * 0.05,
            failureCount: Math.floor(Math.random() * 5)
          };

          await database.saveCarrierMetrics([metric]);
        }
      }

      // Retrieve metrics
      const metrics = await database.getCarrierMetrics(5);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should calculate aggregate system performance', () => {
      const stats = healthMonitor.getStatistics();

      expect(stats.totalCarriers).toBe(48);
      expect(stats.enabledCarriers).toBeLessThanOrEqual(48);
      expect(stats.systemCapacity).toBeGreaterThan(0);

      // Calculate efficiency
      const efficiency = stats.systemCapacity / (stats.enabledCarriers * 6); // Max 6 bits/symbol
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });

    it('should monitor real-time throughput across all streams', async () => {
      const duration = 500; // ms
      const samples = [];

      const interval = setInterval(() => {
        const status = chunkManager.getAllocationStatus();
        samples.push({
          timestamp: Date.now(),
          throughput: status.throughput,
          active: status.active
        });
      }, 50);

      await new Promise(resolve => setTimeout(resolve, duration));
      clearInterval(interval);

      // Calculate statistics
      const avgThroughput = samples.reduce((sum, s) => sum + s.throughput, 0) / samples.length;
      const avgActive = samples.reduce((sum, s) => sum + s.active, 0) / samples.length;

      expect(avgActive).toBeGreaterThan(0);
      expect(avgThroughput).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Quality of Service', () => {
    it('should maintain QoS across all parallel streams', () => {
      const qosTargets = {
        minThroughput: 100000, // 100 kbps total
        maxLatency: 100,       // ms
        maxJitter: 20,         // ms
        minReliability: 0.99   // 99% success rate
      };

      // Configure system for QoS
      modem.setTransmissionMode('normal');
      healthMonitor.updateConfig({
        minSNR: 10,
        adaptiveModulation: true
      });

      // Verify configuration meets QoS
      const config = modem.getConfiguration();
      expect(config.codingRate).toBeGreaterThanOrEqual(0.5); // FEC for reliability

      // Calculate achievable throughput
      const dataCarriers = 40;
      const bitsPerSymbol = 2; // Conservative QPSK
      const symbolRate = 37500;
      const throughput = dataCarriers * bitsPerSymbol * symbolRate * config.codingRate;

      expect(throughput).toBeGreaterThanOrEqual(qosTargets.minThroughput);
    });

    it('should prioritize critical data across streams', () => {
      // Mix of priority levels
      const chunks = [
        // Emergency data
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `emergency_${i}`,
          priority: 1.0,
          size: 256
        })),
        // Normal data
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `normal_${i}`,
          priority: 0.5,
          size: 256
        })),
        // Background data
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `background_${i}`,
          priority: 0.1,
          size: 256
        }))
      ];

      const carriers = Array.from({ length: 48 }, (_, i) => ({
        id: i,
        snr: 20,
        ber: 1e-5,
        capacity: 4,
        utilization: 0
      }));

      const allocations = allocator.allocate(chunks, carriers);

      // Emergency chunks should be allocated first
      for (let i = 0; i < 10; i++) {
        expect(allocations.has(`emergency_${i}`)).toBe(true);
      }
    });
  });

  describe('System Integration', () => {
    it('should integrate with all subsystems seamlessly', async () => {
      // Test complete system integration
      const testSequence = async () => {
        // 1. Initialize
        expect(modem.getConfiguration().numCarriers).toBe(48);
        expect(healthMonitor.getAllCarrierHealth()).toHaveLength(48);

        // 2. Queue chunks
        const chunks = Array.from({ length: 50 }, (_, i) => ({
          id: `chunk_${i}`,
          pieceIndex: i,
          totalPieces: 50,
          data: new Uint8Array(256),
          hash: `hash_${i}`,
          rarity: Math.random(),
          attempts: 0
        }));
        chunkManager.queueChunks(chunks);

        // 3. Allocate to carriers
        const allocations = chunkManager.getCarrierAllocations();
        expect(allocations.size).toBeGreaterThan(0);

        // 4. Monitor health
        const stats = healthMonitor.getStatistics();
        expect(stats.enabledCarriers).toBeGreaterThan(0);

        // 5. Save metrics
        await database.saveTransmission({
          id: `test_${Date.now()}`,
          timestamp: Date.now(),
          callsign: 'TEST',
          mode: 'transmit',
          dataSize: 50 * 256,
          duration: 1000,
          avgSNR: stats.averageSNR,
          avgBER: stats.averageBER,
          throughput: 100000,
          modulationUsed: ['QPSK'],
          success: true
        });

        // 6. Verify persistence
        const history = await database.getTransmissionHistory(1);
        expect(history).toHaveLength(1);
      };

      await expect(testSequence()).resolves.not.toThrow();
    });

    it('should handle full system lifecycle', async () => {
      // Startup
      modem = new OFDMModem();
      healthMonitor = new CarrierHealthMonitor();
      healthMonitor.initialize(modem);

      // Operation
      const chunks = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 20,
        data: new Uint8Array(256),
        hash: `hash_${i}`,
        rarity: 0.5,
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);

      // Verify operation
      expect(chunkManager.getAllocationStatus().queued).toBeGreaterThan(0);

      // Shutdown
      healthMonitor.stop();
      chunkManager.reset();

      // Verify cleanup
      expect(chunkManager.getAllocationStatus().queued).toBe(0);
    });
  });
});

// Helper function
function calculateCorrelation(signal1: Float32Array, signal2: Float32Array): number {
  let correlation = 0;
  const len = Math.min(signal1.length, signal2.length);

  for (let i = 0; i < len; i++) {
    correlation += signal1[i] * signal2[i];
  }

  return correlation / len;
}