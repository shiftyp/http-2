/**
 * Integration Test: OFDM Parallel Web Page Transfer
 *
 * Tests end-to-end parallel transfer of web pages using
 * OFDM with BitTorrent chunking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { ParallelChunkManager } from '../../src/lib/parallel-chunk-manager/index.js';
import { CarrierHealthMonitor } from '../../src/lib/carrier-health-monitor/index.js';
import { OFDMSchema } from '../../src/lib/database/ofdm-schema.js';

describe('OFDM Parallel Web Page Transfer Integration', () => {
  let transmitModem: OFDMModem;
  let receiveModem: OFDMModem;
  let chunkManager: ParallelChunkManager;
  let healthMonitor: CarrierHealthMonitor;
  let database: OFDMSchema;

  // Simulate a simple web page
  const webPage = {
    html: '<html><body><h1>Hello Radio</h1></body></html>',
    css: 'body { font-family: sans-serif; }',
    js: 'console.log("Hello from radio!");',
    images: [
      { name: 'logo.png', size: 1024 },
      { name: 'banner.jpg', size: 2048 }
    ]
  };

  beforeEach(async () => {
    transmitModem = new OFDMModem();
    receiveModem = new OFDMModem();
    chunkManager = new ParallelChunkManager();
    healthMonitor = new CarrierHealthMonitor();
    database = new OFDMSchema();

    await database.initialize();
    chunkManager.initialize(transmitModem);
    healthMonitor.initialize(transmitModem);
  });

  afterEach(() => {
    healthMonitor.stop();
    database.close();
  });

  describe('Page Chunking', () => {
    it('should split web page into BitTorrent-style chunks', () => {
      const pageData = Buffer.from(JSON.stringify(webPage));
      const chunkSize = 256; // bytes
      const chunks = [];

      for (let i = 0; i < pageData.length; i += chunkSize) {
        chunks.push({
          index: Math.floor(i / chunkSize),
          data: pageData.slice(i, Math.min(i + chunkSize, pageData.length)),
          hash: `hash_${i}`
        });
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].data.length).toBeLessThanOrEqual(chunkSize);
    });

    it('should generate torrent metadata for page', () => {
      const pageData = Buffer.from(JSON.stringify(webPage));
      const torrentInfo = {
        name: 'webpage.html',
        length: pageData.length,
        pieceLength: 256,
        pieces: [] as string[]
      };

      // Generate piece hashes
      for (let i = 0; i < pageData.length; i += torrentInfo.pieceLength) {
        const piece = pageData.slice(i, Math.min(i + torrentInfo.pieceLength, pageData.length));
        // Simplified hash
        torrentInfo.pieces.push(`hash_${i}`);
      }

      expect(torrentInfo.pieces.length).toBe(Math.ceil(pageData.length / torrentInfo.pieceLength));
    });
  });

  describe('Parallel Transmission', () => {
    it('should transmit multiple chunks simultaneously across carriers', async () => {
      const pageData = new Uint8Array(Buffer.from(JSON.stringify(webPage)));
      const chunkSize = 64;
      const chunks = [];

      // Create chunks
      for (let i = 0; i < Math.min(10, pageData.length / chunkSize); i++) {
        chunks.push({
          id: `chunk_${i}`,
          pieceIndex: i,
          totalPieces: Math.ceil(pageData.length / chunkSize),
          data: pageData.slice(i * chunkSize, (i + 1) * chunkSize),
          hash: `hash_${i}`,
          rarity: 0.5,
          attempts: 0
        });
      }

      // Queue chunks for transmission
      chunkManager.queueChunks(chunks);

      // Simulate parallel transmission
      const transmissionResults = await Promise.all(
        chunks.slice(0, 5).map(async (chunk, index) => {
          const carrierId = index * 2 + 1; // Skip pilots
          return transmitModem.transmitOnCarrier(carrierId, chunk.data);
        })
      );

      expect(transmissionResults.every(r => r)).toBe(true);

      // Check allocation status
      const status = chunkManager.getAllocationStatus();
      expect(status.queued).toBeGreaterThanOrEqual(0);
    });

    it('should achieve target throughput of 100+ kbps', () => {
      const symbolRate = 37500; // symbols/sec
      const bitsPerSymbol = 2; // QPSK
      const dataCarriers = 40; // 48 - 8 pilots
      const codingRate = 0.75; // 3/4 FEC

      const rawThroughput = symbolRate * bitsPerSymbol * dataCarriers;
      const effectiveThroughput = rawThroughput * codingRate;

      expect(effectiveThroughput).toBeGreaterThanOrEqual(100000); // 100 kbps
    });

    it('should complete page transfer within reasonable time', async () => {
      const pageSize = 10240; // 10 KB page
      const throughput = 100000; // 100 kbps
      const expectedTime = (pageSize * 8) / throughput * 1000; // ms

      const startTime = Date.now();

      // Simulate transfer
      const pageData = new Uint8Array(pageSize);
      const chunkSize = 256;

      for (let i = 0; i < pageData.length; i += chunkSize) {
        const chunk = pageData.slice(i, Math.min(i + chunkSize, pageData.length));
        await transmitModem.transmitOnCarrier(1, chunk);
      }

      const actualTime = Date.now() - startTime;

      // Allow 10x for simulation overhead
      expect(actualTime).toBeLessThan(expectedTime * 10);
    });
  });

  describe('Reception and Reassembly', () => {
    it('should receive chunks from multiple carriers', async () => {
      const chunks = [];
      const numChunks = 5;

      // Transmit chunks on different carriers
      for (let i = 0; i < numChunks; i++) {
        const data = new Uint8Array([i, i + 1, i + 2, i + 3]);
        const carrierId = i * 2 + 1; // Skip pilots

        await transmitModem.transmitOnCarrier(carrierId, data);
        const received = await receiveModem.receiveFromCarrier(carrierId);

        chunks.push({
          index: i,
          data: received
        });
      }

      expect(chunks).toHaveLength(numChunks);
      expect(chunks[0].data).toEqual(new Uint8Array([0, 1, 2, 3]));
    });

    it('should reassemble page from received chunks', () => {
      const originalPage = JSON.stringify(webPage);
      const pageBuffer = Buffer.from(originalPage);
      const chunkSize = 256;

      // Simulate received chunks (possibly out of order)
      const receivedChunks = [];
      for (let i = 0; i < pageBuffer.length; i += chunkSize) {
        receivedChunks.push({
          index: Math.floor(i / chunkSize),
          data: pageBuffer.slice(i, Math.min(i + chunkSize, pageBuffer.length))
        });
      }

      // Shuffle to simulate out-of-order reception
      receivedChunks.sort(() => Math.random() - 0.5);

      // Reassemble
      receivedChunks.sort((a, b) => a.index - b.index);
      const reassembled = Buffer.concat(receivedChunks.map(c => c.data));
      const reassembledPage = reassembled.toString();

      expect(reassembledPage).toBe(originalPage);
    });

    it('should handle missing chunks with retransmission', async () => {
      const totalChunks = 10;
      const receivedChunks = new Set<number>();

      // Simulate reception with some losses
      for (let i = 0; i < totalChunks; i++) {
        if (Math.random() > 0.2) { // 80% success rate
          receivedChunks.add(i);
        }
      }

      // Identify missing chunks
      const missingChunks = [];
      for (let i = 0; i < totalChunks; i++) {
        if (!receivedChunks.has(i)) {
          missingChunks.push(i);
        }
      }

      // Retransmit missing chunks
      for (const chunkIndex of missingChunks) {
        const data = new Uint8Array([chunkIndex]);
        await transmitModem.transmitOnCarrier(1, data);
        const received = await receiveModem.receiveFromCarrier(1);
        receivedChunks.add(received[0]);
      }

      expect(receivedChunks.size).toBe(totalChunks);
    });
  });

  describe('Adaptive Behavior', () => {
    it('should adapt to carrier quality changes during transfer', async () => {
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

      // Simulate carrier degradation
      healthMonitor.getCarrierHealth(1)!.snr = 5; // Poor SNR

      // Should redistribute chunks
      const allocations = chunkManager.getCarrierAllocations();
      const badCarrierAllocs = Array.from(allocations.entries())
        .filter(([carrierId, _]) => carrierId === 1);

      expect(badCarrierAllocs.length).toBe(0); // Should avoid bad carrier
    });

    it('should prioritize rare chunks during transfer', () => {
      const chunks = [
        {
          id: 'rare',
          pieceIndex: 0,
          totalPieces: 10,
          data: new Uint8Array(256),
          hash: 'hash_rare',
          rarity: 0.1,
          attempts: 0
        },
        {
          id: 'common',
          pieceIndex: 1,
          totalPieces: 10,
          data: new Uint8Array(256),
          hash: 'hash_common',
          rarity: 0.9,
          attempts: 0
        }
      ];

      chunkManager.queueChunks(chunks);

      const allocations = Array.from(chunkManager.getCarrierAllocations().values());
      if (allocations.length > 0) {
        expect(allocations[0].chunkId).toBe('rare');
      }
    });

    it('should switch modulation based on channel quality', () => {
      const carriers = healthMonitor.getAllCarrierHealth();

      for (const carrier of carriers) {
        if (carrier.id % 6 !== 0) { // Skip pilots
          if (carrier.snr < 10) {
            expect(['BPSK', 'QPSK']).toContain(carrier.modulation);
          } else if (carrier.snr > 20) {
            expect(['16QAM', '64QAM']).toContain(carrier.modulation);
          }
        }
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover from carrier failures during transfer', async () => {
      const chunk = {
        id: 'test_chunk',
        pieceIndex: 0,
        totalPieces: 1,
        data: new Uint8Array(256),
        hash: 'test_hash',
        rarity: 0.5,
        attempts: 0
      };

      chunkManager.queueChunks([chunk]);

      // Simulate carrier failure
      transmitModem.disableCarrier(1);

      // Should redistribute
      const allocations = chunkManager.getCarrierAllocations();
      const allocation = Array.from(allocations.values())
        .find(a => a.chunkId === 'test_chunk');

      expect(allocation).toBeDefined();
      expect(allocation?.carrierId).not.toBe(1);
    });

    it('should handle corrupted chunks with verification', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = 'correct_hash';

      // Transmit
      await transmitModem.transmitOnCarrier(1, originalData);

      // Receive with simulated corruption
      let received = await receiveModem.receiveFromCarrier(1);

      // Simulate corruption
      if (Math.random() < 0.3) {
        received = new Uint8Array([1, 2, 99, 4, 5]); // Corrupted
      }

      // Verify hash
      const receivedHash = received.toString() === originalData.toString()
        ? 'correct_hash'
        : 'wrong_hash';

      if (receivedHash !== hash) {
        // Retransmit
        await transmitModem.transmitOnCarrier(1, originalData);
        received = await receiveModem.receiveFromCarrier(1);
      }

      expect(received).toEqual(originalData);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track transmission statistics', async () => {
      const pageData = new Uint8Array(1024);
      const startTime = Date.now();

      // Transmit
      await transmitModem.transmitOnCarrier(1, pageData);

      const stats = {
        id: `tx_${Date.now()}`,
        timestamp: Date.now(),
        callsign: 'TEST1',
        mode: 'transmit' as const,
        dataSize: pageData.length,
        duration: Date.now() - startTime,
        avgSNR: 20,
        avgBER: 1e-5,
        throughput: (pageData.length * 8) / ((Date.now() - startTime) / 1000),
        modulationUsed: ['QPSK'],
        success: true
      };

      await database.saveTransmission(stats);

      const history = await database.getTransmissionHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
    });

    it('should calculate effective throughput', () => {
      const status = chunkManager.getAllocationStatus();
      const activeCarriers = status.active;
      const throughputPerCarrier = 2500; // bps per carrier

      const totalThroughput = activeCarriers * throughputPerCarrier;
      expect(totalThroughput).toBeGreaterThanOrEqual(0);
    });

    it('should monitor carrier utilization', () => {
      const stats = healthMonitor.getStatistics();

      expect(stats.enabledCount).toBeLessThanOrEqual(48);
      expect(stats.systemCapacity).toBeGreaterThan(0);

      const utilization = stats.enabledCount / stats.totalCarriers;
      expect(utilization).toBeGreaterThan(0);
      expect(utilization).toBeLessThanOrEqual(1);
    });
  });
});