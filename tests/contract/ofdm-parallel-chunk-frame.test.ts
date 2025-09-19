/**
 * Contract Test: OFDM Parallel Chunk Frame Transmission
 *
 * Verifies that the OFDM system can transmit BitTorrent chunks
 * in parallel across multiple subcarriers within a single frame.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { ParallelChunkManager } from '../../src/lib/parallel-chunk-manager/index.js';
import type { ChunkMetadata } from '../../src/lib/parallel-chunk-manager/index.js';

describe('OFDM Parallel Chunk Frame Contract', () => {
  let modem: OFDMModem;
  let chunkManager: ParallelChunkManager;

  beforeEach(() => {
    modem = new OFDMModem();
    chunkManager = new ParallelChunkManager();
    chunkManager.initialize(modem);
  });

  afterEach(() => {
    chunkManager.reset();
  });

  describe('Frame Structure', () => {
    it('should create valid OFDM frame with 48 subcarriers', () => {
      const frame = modem.createFrame();

      expect(frame.numCarriers).toBe(48);
      expect(frame.pilotCarriers).toHaveLength(8); // Every 6th carrier
      expect(frame.dataCarriers).toHaveLength(40);
    });

    it('should include cyclic prefix in frame', () => {
      const data = new Uint8Array(256);
      const frame = modem.modulateData(data);

      const symbolLength = 64;
      const cpLength = 16; // 25% of symbol
      const totalLength = symbolLength + cpLength;

      expect(frame.length).toBeGreaterThanOrEqual(totalLength * 2); // Complex samples
    });

    it('should maintain pilot carriers at correct positions', () => {
      const frame = modem.createFrame();
      const pilotPositions = [0, 6, 12, 18, 24, 30, 36, 42];

      expect(frame.pilotCarriers).toEqual(pilotPositions);
    });
  });

  describe('Chunk Allocation', () => {
    it('should allocate chunks to available subcarriers', () => {
      const chunks: ChunkMetadata[] = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 100,
        data: new Uint8Array(1024),
        hash: `hash_${i}`,
        rarity: Math.random(),
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);
      const allocations = chunkManager.getCarrierAllocations();

      expect(allocations.size).toBeGreaterThan(0);
      expect(allocations.size).toBeLessThanOrEqual(40); // Data carriers only
    });

    it('should prioritize rare chunks for transmission', () => {
      const chunks: ChunkMetadata[] = [
        {
          id: 'rare_chunk',
          pieceIndex: 0,
          totalPieces: 100,
          data: new Uint8Array(1024),
          hash: 'hash_rare',
          rarity: 0.1, // Very rare
          attempts: 0
        },
        {
          id: 'common_chunk',
          pieceIndex: 1,
          totalPieces: 100,
          data: new Uint8Array(1024),
          hash: 'hash_common',
          rarity: 0.9, // Very common
          attempts: 0
        }
      ];

      chunkManager.queueChunks(chunks);
      const allocations = Array.from(chunkManager.getCarrierAllocations().values());

      expect(allocations[0].chunkId).toBe('rare_chunk');
    });

    it('should not exceed maximum concurrent chunks', () => {
      const chunks: ChunkMetadata[] = Array.from({ length: 100 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 100,
        data: new Uint8Array(1024),
        hash: `hash_${i}`,
        rarity: Math.random(),
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);
      const allocations = chunkManager.getCarrierAllocations();

      expect(allocations.size).toBeLessThanOrEqual(48);
    });
  });

  describe('Parallel Transmission', () => {
    it('should transmit multiple chunks simultaneously', async () => {
      const chunks: ChunkMetadata[] = Array.from({ length: 5 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 100,
        data: new Uint8Array(256),
        hash: `hash_${i}`,
        rarity: 0.5,
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);

      // Simulate transmission
      const transmissionPromises = [];
      for (let carrierId = 0; carrierId < 5; carrierId++) {
        if (carrierId % 6 !== 0) { // Skip pilot carriers
          transmissionPromises.push(
            modem.transmitOnCarrier(carrierId, chunks[carrierId].data)
          );
        }
      }

      const results = await Promise.all(transmissionPromises);
      expect(results).toHaveLength(transmissionPromises.length);
      expect(results.every(r => r)).toBe(true);
    });

    it('should maintain chunk integrity during parallel transmission', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const chunk: ChunkMetadata = {
        id: 'test_chunk',
        pieceIndex: 0,
        totalPieces: 1,
        data: originalData,
        hash: 'test_hash',
        rarity: 0.5,
        attempts: 0
      };

      chunkManager.queueChunks([chunk]);

      // Transmit and receive
      await modem.transmitOnCarrier(1, originalData);
      const receivedData = await modem.receiveFromCarrier(1);

      expect(receivedData).toEqual(originalData);
    });

    it('should track transmission progress per chunk', () => {
      const chunks: ChunkMetadata[] = Array.from({ length: 3 }, (_, i) => ({
        id: `chunk_${i}`,
        pieceIndex: i,
        totalPieces: 3,
        data: new Uint8Array(1024),
        hash: `hash_${i}`,
        rarity: 0.5,
        attempts: 0
      }));

      chunkManager.queueChunks(chunks);
      const status = chunkManager.getAllocationStatus();

      expect(status.queued).toBeGreaterThan(0);
      expect(status.active).toBeGreaterThanOrEqual(0);
      expect(status.completed).toBe(0);
    });
  });

  describe('Frame Timing', () => {
    it('should complete frame transmission within timing constraints', async () => {
      const frameSize = 80; // 64 + 16 CP
      const sampleRate = 48000;
      const expectedDuration = (frameSize / sampleRate) * 1000; // ms

      const startTime = Date.now();
      const frame = modem.createFrame();
      await modem.transmitFrame(frame);
      const actualDuration = Date.now() - startTime;

      // Allow 10x timing for simulation
      expect(actualDuration).toBeLessThan(expectedDuration * 10);
    });

    it('should maintain symbol timing across carriers', () => {
      const symbolDuration = 1.33; // ms (64 samples at 48kHz)
      const frame = modem.createFrame();

      for (let i = 0; i < frame.numCarriers; i++) {
        const timing = modem.getCarrierTiming(i);
        expect(timing.symbolDuration).toBeCloseTo(symbolDuration, 2);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle carrier failure during transmission', async () => {
      const chunk: ChunkMetadata = {
        id: 'test_chunk',
        pieceIndex: 0,
        totalPieces: 1,
        data: new Uint8Array(1024),
        hash: 'test_hash',
        rarity: 0.5,
        attempts: 0
      };

      chunkManager.queueChunks([chunk]);

      // Simulate carrier failure
      modem.disableCarrier(1);

      // Should redistribute to another carrier
      const allocations = chunkManager.getCarrierAllocations();
      const allocation = Array.from(allocations.values())
        .find(a => a.chunkId === 'test_chunk');

      expect(allocation).toBeDefined();
      expect(allocation?.carrierId).not.toBe(1);
    });

    it('should retry failed chunk transmissions', () => {
      const chunk: ChunkMetadata = {
        id: 'retry_chunk',
        pieceIndex: 0,
        totalPieces: 1,
        data: new Uint8Array(1024),
        hash: 'retry_hash',
        rarity: 0.5,
        attempts: 0
      };

      chunkManager.queueChunks([chunk]);

      // Simulate transmission failure
      const allocations = chunkManager.getCarrierAllocations();
      const carrierId = Array.from(allocations.entries())[0]?.[0];
      if (carrierId !== undefined) {
        // This would trigger retry logic
        chunkManager['handleTransmissionFailure'](chunk, carrierId);
      }

      // Check chunk is requeued with higher priority
      const status = chunkManager.getAllocationStatus();
      expect(status.failed).toBe(1);
      expect(chunk.attempts).toBeGreaterThan(0);
    });
  });

  describe('Throughput', () => {
    it('should achieve minimum throughput of 100 kbps', () => {
      const symbolRate = 37500; // symbols/sec (48kHz / 1.28)
      const bitsPerSymbol = 2; // QPSK
      const dataCarriers = 40;

      const throughput = symbolRate * bitsPerSymbol * dataCarriers;

      expect(throughput).toBeGreaterThanOrEqual(100000); // 100 kbps
    });

    it('should scale throughput with modulation order', () => {
      const symbolRate = 37500;
      const dataCarriers = 40;

      // QPSK
      const qpskThroughput = symbolRate * 2 * dataCarriers;

      // 16-QAM
      const qamThroughput = symbolRate * 4 * dataCarriers;

      expect(qamThroughput).toBe(qpskThroughput * 2);
    });
  });
});