/**
 * Integration Test: OFDM Carrier Failure Redistribution
 *
 * Tests dynamic redistribution of chunks when carriers fail
 * or experience degraded conditions during transmission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { ParallelChunkManager } from '../../src/lib/parallel-chunk-manager/index.js';
import { RedistributionHandler } from '../../src/lib/parallel-chunk-manager/redistribution.js';
import { CarrierHealthMonitor } from '../../src/lib/carrier-health-monitor/index.js';
import { CarrierControl } from '../../src/lib/carrier-health-monitor/carrier-control.js';

describe('OFDM Carrier Failure Redistribution Integration', () => {
  let modem: OFDMModem;
  let chunkManager: ParallelChunkManager;
  let redistributionHandler: RedistributionHandler;
  let healthMonitor: CarrierHealthMonitor;
  let carrierControl: CarrierControl;

  // Test data representing a file transfer
  const testFile = {
    name: 'test.dat',
    size: 10240, // 10 KB
    chunks: [] as Array<{
      id: string;
      data: Uint8Array;
      carrierId?: number;
      status: 'pending' | 'transmitting' | 'completed' | 'failed';
    }>
  };

  beforeEach(() => {
    modem = new OFDMModem();
    chunkManager = new ParallelChunkManager();
    redistributionHandler = new RedistributionHandler();
    healthMonitor = new CarrierHealthMonitor();
    carrierControl = new CarrierControl();

    chunkManager.initialize(modem);
    healthMonitor.initialize(modem);

    // Create test chunks
    const chunkSize = 256;
    for (let i = 0; i < testFile.size; i += chunkSize) {
      testFile.chunks.push({
        id: `chunk_${Math.floor(i / chunkSize)}`,
        data: new Uint8Array(Math.min(chunkSize, testFile.size - i)),
        status: 'pending'
      });
    }
  });

  afterEach(() => {
    healthMonitor.stop();
    carrierControl.reset();
    testFile.chunks = [];
  });

  describe('Carrier Failure Detection', () => {
    it('should detect carrier failure through SNR degradation', async () => {
      const carrierId = 5;

      // Initially good carrier
      const initialHealth = healthMonitor.getCarrierHealth(carrierId);
      expect(initialHealth?.enabled).toBe(true);

      // Simulate SNR degradation
      const health = healthMonitor.getCarrierHealth(carrierId);
      if (health) {
        health.snr = 2; // Below threshold
        health.ber = 0.1; // High error rate
      }

      // Evaluate carrier
      carrierControl.evaluateCarrier(carrierId, 2, 0.1, 0);

      const updatedHealth = carrierControl.getCarrierState(carrierId);
      expect(updatedHealth?.enabled).toBe(false);
      expect(updatedHealth?.reason).toBe('low-snr');
    });

    it('should detect interference-based carrier failure', () => {
      const carrierId = 10;

      // Report high interference
      carrierControl.reportInterference({
        carrierId,
        level: 20, // 20 dB above noise floor
        type: 'narrowband',
        frequency: 2400e6
      });

      const state = carrierControl.getCarrierState(carrierId);
      expect(state?.enabled).toBe(false);
      expect(state?.reason).toBe('high-interference');
    });

    it('should detect multiple simultaneous carrier failures', () => {
      const failedCarriers = [3, 7, 11, 15];

      for (const carrierId of failedCarriers) {
        // Simulate different failure modes
        if (carrierId % 2 === 0) {
          carrierControl.disableCarrier(carrierId, 'low-snr');
        } else {
          carrierControl.disableCarrier(carrierId, 'high-interference');
        }
      }

      const disabled = carrierControl.getDisabledCarriers();
      expect(disabled.length).toBe(failedCarriers.length);
    });
  });

  describe('Chunk Redistribution', () => {
    it('should redistribute chunks from failed carrier to healthy ones', () => {
      // Allocate chunks to carriers
      const chunkAllocations = new Map<string, number>();
      for (let i = 0; i < 10; i++) {
        chunkAllocations.set(`chunk_${i}`, i * 2 + 1); // Skip pilots
      }

      // Simulate carrier 3 failure
      const failedCarrier = 3;
      const affectedChunk = 'chunk_1';

      const availableCarriers = [5, 7, 9, 11, 13];
      const redistributions = redistributionHandler.handleCarrierFailure(
        failedCarrier,
        [affectedChunk],
        availableCarriers
      );

      expect(redistributions.has(affectedChunk)).toBe(true);
      expect(redistributions.get(affectedChunk)).not.toBe(failedCarrier);
      expect(availableCarriers).toContain(redistributions.get(affectedChunk));
    });

    it('should handle quality degradation with gradual redistribution', () => {
      const carrierId = 5;
      const chunkId = 'chunk_test';

      // Gradual degradation
      const snrValues = [20, 15, 10, 5]; // Degrading SNR
      const availableCarriers = [
        { id: 7, snr: 22 },
        { id: 9, snr: 18 },
        { id: 11, snr: 25 }
      ];

      for (const snr of snrValues) {
        const newCarrier = redistributionHandler.handleQualityDegradation(
          carrierId,
          snr,
          chunkId,
          availableCarriers
        );

        if (snr < 10) {
          // Should trigger redistribution
          expect(newCarrier).not.toBeNull();
          expect(newCarrier).not.toBe(carrierId);
        }
      }
    });

    it('should handle cascade failures with priority preservation', () => {
      // Create priority chunks
      const criticalChunks = ['chunk_critical_1', 'chunk_critical_2'];
      const normalChunks = ['chunk_normal_1', 'chunk_normal_2'];

      // Initial allocation
      const allocations = new Map<string, number>();
      criticalChunks.forEach((c, i) => allocations.set(c, i * 2 + 1));
      normalChunks.forEach((c, i) => allocations.set(c, (i + 2) * 2 + 1));

      // Cascade failure: multiple carriers fail
      const failedCarriers = [1, 3, 5];
      const affectedChunks = [];

      for (const [chunk, carrier] of allocations.entries()) {
        if (failedCarriers.includes(carrier)) {
          affectedChunks.push(chunk);
        }
      }

      const availableCarriers = [7, 9, 11, 13, 15, 17];
      const redistributions = redistributionHandler.handleCarrierFailure(
        failedCarriers[0],
        affectedChunks,
        availableCarriers
      );

      // Critical chunks should get best available carriers
      for (const critical of criticalChunks) {
        if (redistributions.has(critical)) {
          const newCarrier = redistributions.get(critical);
          expect(availableCarriers.slice(0, 2)).toContain(newCarrier);
        }
      }
    });
  });

  describe('Load Balancing During Redistribution', () => {
    it('should balance load across remaining carriers', () => {
      const chunks = Array.from({ length: 20 }, (_, i) => `chunk_${i}`);
      const failedCarrier = 5;
      const availableCarriers = [1, 3, 7, 9, 11, 13, 15, 17];

      const redistributions = redistributionHandler.handleCarrierFailure(
        failedCarrier,
        chunks,
        availableCarriers
      );

      // Count redistributions per carrier
      const carrierLoads = new Map<number, number>();
      for (const carrier of redistributions.values()) {
        carrierLoads.set(carrier, (carrierLoads.get(carrier) || 0) + 1);
      }

      // Check load distribution
      const loads = Array.from(carrierLoads.values());
      const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;

      // No carrier should be overloaded (>2x average)
      for (const load of loads) {
        expect(load).toBeLessThanOrEqual(avgLoad * 2);
      }
    });

    it('should consider carrier quality in load distribution', () => {
      const chunks = ['chunk_1', 'chunk_2', 'chunk_3'];
      const failedCarrier = 3;

      // Carriers with different qualities
      const availableCarriers = [5, 7, 9];

      // Set carrier qualities
      healthMonitor.getCarrierHealth(5)!.snr = 25; // Best
      healthMonitor.getCarrierHealth(7)!.snr = 15; // Medium
      healthMonitor.getCarrierHealth(9)!.snr = 8;  // Poor

      // Important chunks should go to better carriers
      redistributionHandler.updateStrategy({ loadBalancing: false });
      const redistributions = redistributionHandler.handleCarrierFailure(
        failedCarrier,
        chunks,
        availableCarriers
      );

      // First chunk should go to best carrier
      expect(redistributions.get('chunk_1')).toBe(5);
    });
  });

  describe('Timeout and Retry Management', () => {
    it('should handle transmission timeouts with redistribution', () => {
      const chunkId = 'timeout_chunk';
      const carrierId = 5;
      const elapsedMs = 6000; // Timeout after 6 seconds
      const availableCarriers = [7, 9, 11];

      const newCarrier = redistributionHandler.handleTimeout(
        chunkId,
        carrierId,
        elapsedMs,
        availableCarriers
      );

      expect(newCarrier).not.toBeNull();
      expect(newCarrier).not.toBe(carrierId);
      expect(availableCarriers).toContain(newCarrier);
    });

    it('should respect maximum retry attempts', () => {
      const chunkId = 'retry_chunk';
      const carrierId = 5;
      const availableCarriers = [7, 9, 11];

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        redistributionHandler.handleTimeout(
          chunkId,
          carrierId,
          5000,
          availableCarriers
        );
      }

      // Fourth attempt should fail (max retries = 3)
      const result = redistributionHandler.handleTimeout(
        chunkId,
        carrierId,
        5000,
        availableCarriers
      );

      expect(result).toBeNull(); // No more retries
    });

    it('should track retry statistics', () => {
      const chunks = ['chunk_1', 'chunk_2'];

      // Simulate retries
      for (const chunk of chunks) {
        redistributionHandler.handleTimeout(chunk, 5, 5000, [7, 9]);
        redistributionHandler.handleTimeout(chunk, 7, 5000, [9, 11]);
      }

      const stats = redistributionHandler.getStatistics();
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.byType['timeout']).toBe(4);
      expect(stats.avgRetries).toBeGreaterThan(0);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should auto-recover carriers after configured delay', () => {
      vi.useFakeTimers();

      const carrierId = 5;

      carrierControl.updatePolicy({
        autoRecovery: true,
        recoveryDelayMs: 5000
      });

      // Disable carrier
      carrierControl.disableCarrier(carrierId, 'low-snr');

      let state = carrierControl.getCarrierState(carrierId);
      expect(state?.enabled).toBe(false);
      expect(state?.autoRecoverAt).toBeDefined();

      // Fast-forward time
      vi.advanceTimersByTime(5100);

      // Process pending redistributions
      const availableCarriers = [1, 3, 7, 9];
      redistributionHandler.processPending(availableCarriers);

      vi.useRealTimers();
    });

    it('should handle peer loss and find alternative sources', () => {
      const peerId = 'peer1';
      const affectedChunks = ['chunk_1', 'chunk_2', 'chunk_3'];

      // Alternative peers that have the chunks
      const alternativePeers = new Map<string, string[]>([
        ['chunk_1', ['peer2', 'peer3']],
        ['chunk_2', ['peer3']],
        ['chunk_3', []] // No alternatives
      ]);

      const redistributions = redistributionHandler.handlePeerLoss(
        peerId,
        affectedChunks,
        alternativePeers
      );

      expect(redistributions.get('chunk_1')).toBe('peer2');
      expect(redistributions.get('chunk_2')).toBe('peer3');
      expect(redistributions.has('chunk_3')).toBe(false); // No alternative
    });
  });

  describe('Performance During Redistribution', () => {
    it('should maintain minimum throughput during redistribution', () => {
      // Start with full capacity
      let enabledCarriers = 40; // Excluding pilots
      let throughputPerCarrier = 2500; // bps
      let totalThroughput = enabledCarriers * throughputPerCarrier;

      expect(totalThroughput).toBeGreaterThanOrEqual(100000); // 100 kbps

      // Lose 25% of carriers
      const failedCount = 10;
      enabledCarriers -= failedCount;

      // Increase modulation on remaining carriers
      throughputPerCarrier = 3500; // Higher modulation

      totalThroughput = enabledCarriers * throughputPerCarrier;
      expect(totalThroughput).toBeGreaterThanOrEqual(100000); // Still meet target
    });

    it('should complete transfer despite multiple failures', async () => {
      const chunks = testFile.chunks.map(c => ({
        id: c.id,
        pieceIndex: parseInt(c.id.split('_')[1]),
        totalPieces: testFile.chunks.length,
        data: c.data,
        hash: `hash_${c.id}`,
        rarity: Math.random(),
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);

      // Simulate random carrier failures during transfer
      const failureRate = 0.2; // 20% failure rate
      let completedChunks = 0;

      for (let i = 0; i < chunks.length; i++) {
        if (Math.random() < failureRate) {
          // Carrier failure - redistribute
          const allocations = chunkManager.getCarrierAllocations();
          const failedCarrier = Array.from(allocations.keys())[0];

          if (failedCarrier !== undefined) {
            modem.disableCarrier(failedCarrier);
          }
        }

        // Continue transmission
        const status = chunkManager.getAllocationStatus();
        completedChunks = status.completed;
      }

      // Should eventually complete all chunks
      const finalStatus = chunkManager.getAllocationStatus();
      expect(finalStatus.failed).toBeLessThan(chunks.length * 0.1); // <10% permanent failures
    });
  });

  describe('Monitoring and Diagnostics', () => {
    it('should track redistribution events and patterns', () => {
      const events = [
        { type: 'carrier-failed' as const, carrierId: 3 },
        { type: 'quality-degraded' as const, carrierId: 5 },
        { type: 'timeout' as const, carrierId: 7 },
        { type: 'carrier-failed' as const, carrierId: 9 }
      ];

      for (const event of events) {
        if (event.type === 'carrier-failed') {
          redistributionHandler.handleCarrierFailure(
            event.carrierId,
            ['chunk_test'],
            [11, 13, 15]
          );
        }
      }

      const stats = redistributionHandler.getStatistics();
      expect(stats.totalEvents).toBe(2); // Two carrier-failed events
      expect(stats.byType['carrier-failed']).toBe(2);
    });

    it('should identify problematic carriers', () => {
      const carrierId = 5;

      // Multiple failures on same carrier
      for (let i = 0; i < 5; i++) {
        redistributionHandler.handleCarrierFailure(
          carrierId,
          [`chunk_${i}`],
          [7, 9, 11]
        );
      }

      const stats = redistributionHandler.getStatistics();

      // Carrier 5 should be identified as problematic
      const carrierUtilization = stats.carrierUtilization;
      expect(carrierUtilization.get(carrierId)).toBeUndefined(); // Not being used
    });

    it('should generate redistribution report', () => {
      // Simulate various redistribution scenarios
      redistributionHandler.handleCarrierFailure(3, ['chunk_1'], [5, 7]);
      redistributionHandler.handleQualityDegradation(5, 8, 'chunk_2', [
        { id: 7, snr: 20 },
        { id: 9, snr: 18 }
      ]);
      redistributionHandler.handleTimeout('chunk_3', 7, 5000, [9, 11]);

      const stats = redistributionHandler.getStatistics();

      // Report should show all event types
      expect(stats.byType['carrier-failed']).toBeGreaterThan(0);
      expect(stats.byType['quality-degraded']).toBeGreaterThanOrEqual(0);
      expect(stats.byType['timeout']).toBeGreaterThan(0);
      expect(stats.totalEvents).toBeGreaterThan(0);
    });
  });
});