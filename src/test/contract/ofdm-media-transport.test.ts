/**
 * OFDM Media Transport Contract Tests (T013)
 * 
 * Tests parallel media transmission over OFDM carriers,
 * progressive delivery, and quality adaptation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OFDMMediaTransport } from '../../lib/ofdm-media-transport/index.js';
import { OFDMModem } from '../../lib/ofdm-modem/index.js';
import { ParallelChunkManager } from '../../lib/parallel-chunk-manager/index.js';
import { MediaCodecRegistry } from '../../lib/media-codecs/index.js';

// Mock dependencies
vi.mock('../../lib/ofdm-modem/index.js');
vi.mock('../../lib/parallel-chunk-manager/index.js');
vi.mock('../../lib/media-codecs/index.js');
vi.mock('../../lib/media-cache/index.js', () => ({
  mediaCache: {
    initialize: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
    store: vi.fn(() => Promise.resolve())
  }
}));

describe('OFDM Media Transport Contract', () => {
  let transport: OFDMMediaTransport;
  let mockModem: any;
  let mockChunkManager: any;
  let mockCodecRegistry: any;
  
  beforeEach(() => {
    // Create mock modem
    mockModem = {
      getConfiguration: vi.fn(() => ({
        numCarriers: 48,
        pilotCarriers: [0, 6, 12, 18, 24, 30, 36, 42],
        channelBandwidth: 2800,
        fftSize: 64,
        numDataCarriers: 40,
        numPilotCarriers: 8
      })),
      getCarrierHealth: vi.fn(() => ({
        enabled: true,
        snr: 20,
        ber: 0.001,
        modulation: 'QPSK'
      })),
      emit: vi.fn(),
      on: vi.fn()
    };
    
    // Create mock chunk manager
    mockChunkManager = {
      queueChunks: vi.fn(),
      cancelChunk: vi.fn(),
      on: vi.fn(),
      getCarrierAllocations: vi.fn(() => new Map()),
      getAllocationStatus: vi.fn(() => ({
        active: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        throughput: 0
      }))
    };
    
    // Create mock codec registry
    mockCodecRegistry = {
      encode: vi.fn((data) => {
        // Return data proportional to input size for load balancing test
        const inputSize = data instanceof Uint8Array ? data.length : data.size || 0;
        const outputSize = Math.max(100, Math.floor(inputSize * 0.8)); // 80% compression ratio
        return Promise.resolve(new Uint8Array(outputSize));
      }),
      decode: vi.fn((data) => Promise.resolve(data)),
      getCodec: vi.fn(() => ({
        encode: vi.fn(() => Promise.resolve(new Uint8Array(100))),
        decode: vi.fn(() => Promise.resolve(new Uint8Array(100)))
      }))
    };
    
    transport = new OFDMMediaTransport(
      mockModem as any,
      mockChunkManager as any,
      mockCodecRegistry as any
    );
  });

  describe('Initialization', () => {
    it('should initialize media transport', async () => {
      await transport.initialize();
      
      expect(mockChunkManager.on).toHaveBeenCalledWith('chunkComplete', expect.any(Function));
      expect(mockChunkManager.on).toHaveBeenCalledWith('chunkFailed', expect.any(Function));
    });
  });

  describe('Media Transmission', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should transmit media over OFDM carriers', async () => {
      const request = {
        id: 'test_transmission',
        url: '/test.jpg',
        mimeType: 'image/jpeg',
        data: new Uint8Array(1000),
        priority: 0.8,
        progressive: true
      };
      
      const transmissionId = await transport.transmit(request);
      
      expect(transmissionId).toBe('test_transmission');
      expect(mockCodecRegistry.encode).toHaveBeenCalledWith(
        request.data,
        request.mimeType,
        expect.any(Object)
      );
      expect(mockChunkManager.queueChunks).toHaveBeenCalled();
    });

    it('should allocate carriers based on availability', async () => {
      const request = {
        id: 'test_2',
        url: '/video.webm',
        mimeType: 'video/webm',
        data: new Uint8Array(10000),
        priority: 1.0
      };
      
      await transport.transmit(request);
      
      // Should check carrier health
      expect(mockModem.getCarrierHealth).toHaveBeenCalled();
      
      // Should queue chunks
      const chunks = mockChunkManager.queueChunks.mock.calls[0][0];
      expect(chunks).toBeInstanceOf(Array);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect carrier allocation options', async () => {
      const request = {
        id: 'test_3',
        url: '/audio.opus',
        mimeType: 'audio/opus',
        data: new Uint8Array(5000),
        priority: 0.5
      };
      
      const options = {
        carriers: [10, 11, 12, 13, 14], // Specific carriers
        quality: 50
      };
      
      await transport.transmit(request, options);
      
      // Should use specified carriers
      const chunks = mockChunkManager.queueChunks.mock.calls[0][0];
      expect(chunks.length).toBeLessThanOrEqual(5);
    });

    it('should add redundancy for error correction', async () => {
      const request = {
        id: 'test_4',
        url: '/important.pdf',
        mimeType: 'application/pdf',
        data: new Uint8Array(100),
        priority: 1.0
      };
      
      const options = {
        redundancy: 1.5 // 50% redundancy
      };
      
      await transport.transmit(request, options);
      
      const chunks = mockChunkManager.queueChunks.mock.calls[0][0];
      const totalSize = chunks.reduce(
        (sum: number, chunk: any) => sum + chunk.data.length,
        0
      );
      
      // Should be larger due to redundancy
      expect(totalSize).toBeGreaterThan(100);
    });
  });

  describe('Progressive Transmission', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should support progressive encoding', async () => {
      const request = {
        id: 'progressive_test',
        url: '/image.jpg',
        mimeType: 'image/jpeg',
        data: new Uint8Array(5000),
        priority: 0.7,
        progressive: true
      };
      
      await transport.transmit(request, { progressive: true });
      
      expect(mockCodecRegistry.encode).toHaveBeenCalledWith(
        expect.anything(),
        'image/jpeg',
        expect.objectContaining({ progressive: true })
      );
    });

    it('should prioritize quality levels', async () => {
      const request = {
        id: 'quality_test',
        url: '/video.webm',
        mimeType: 'video/webm',
        data: new Uint8Array(10000),
        priority: 0.9
      };
      
      await transport.transmit(request, {
        quality: 30,  // Low quality for fast delivery
        progressive: true
      });
      
      expect(mockCodecRegistry.encode).toHaveBeenCalledWith(
        expect.anything(),
        'video/webm',
        expect.objectContaining({ quality: 30 })
      );
    });
  });

  describe('Transmission Status', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should track transmission progress', async () => {
      const request = {
        id: 'status_test',
        url: '/file.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(1000),
        priority: 0.5
      };
      
      await transport.transmit(request);
      
      const status = transport.getTransmissionStatus('status_test');
      
      expect(status).toBeDefined();
      expect(status?.bytesTransmitted).toBe(0);
      expect(status?.bytesRemaining).toBeGreaterThan(0);
      expect(status?.progress).toBe(0);
    });

    it('should update progress on chunk completion', async () => {
      const request = {
        id: 'progress_test',
        url: '/data.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(1000),
        priority: 0.5
      };
      
      await transport.transmit(request);
      
      // Simulate chunk completion
      const chunkCompleteHandler = mockChunkManager.on.mock.calls.find(
        (call: any[]) => call[0] === 'chunkComplete'
      )?.[1];
      
      if (chunkCompleteHandler) {
        chunkCompleteHandler('progress_test_chunk_0');
      }
      
      const status = transport.getTransmissionStatus('progress_test');
      expect(status?.progress).toBeGreaterThan(0);
    });

    it('should emit progress events', async () => {
      const request = {
        id: 'event_test',
        url: '/file.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(500),
        priority: 0.6
      };
      
      await transport.transmit(request);
      
      // Wait for monitoring to emit event
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(mockModem.emit).toHaveBeenCalledWith(
        'mediaTransmissionProgress',
        expect.objectContaining({
          id: 'event_test',
          stats: expect.any(Object)
        })
      );
    });
  });

  describe('Transmission Cancellation', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should cancel active transmission', async () => {
      const request = {
        id: 'cancel_test',
        url: '/large.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(10000),
        priority: 0.5
      };
      
      await transport.transmit(request);
      await transport.cancelTransmission('cancel_test');
      
      expect(mockChunkManager.cancelChunk).toHaveBeenCalled();
      
      const status = transport.getTransmissionStatus('cancel_test');
      expect(status).toBeNull();
    });

    it('should free allocated carriers on cancellation', async () => {
      const request = {
        id: 'free_test',
        url: '/data.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(1000),
        priority: 0.7
      };
      
      await transport.transmit(request);
      await transport.cancelTransmission('free_test');
      
      // Carriers should be freed for reuse
      const request2 = {
        id: 'reuse_test',
        url: '/other.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(1000),
        priority: 0.8
      };
      
      await transport.transmit(request2);
      
      // Should be able to allocate carriers again
      expect(mockChunkManager.queueChunks).toHaveBeenCalledTimes(2);
    });
  });

  describe('Media Reception', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should receive and reassemble media chunks', async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9])
      ];
      
      const blob = await transport.receive(chunks, 'image/jpeg');
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
      
      // Note: blob.arrayBuffer() not available in test environment
      // Just verify blob properties for now
      expect(blob.size).toBe(9);
      expect(blob.type).toBe('image/jpeg');
    });

    it('should decode received media', async () => {
      const encodedChunks = [
        new Uint8Array([255, 216, 255, 224]), // JPEG header
        new Uint8Array([0, 16, 74, 70])
      ];
      
      mockCodecRegistry.decode.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
      
      const blob = await transport.receive(encodedChunks, 'image/jpeg');
      
      expect(mockCodecRegistry.decode).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'image/jpeg'
      );
      expect(blob.type).toBe('image/jpeg');
    });

    it('should cache received media', async () => {
      const { mediaCache } = await import('../../lib/media-cache/index.js');
      const chunks = [new Uint8Array([1, 2, 3])];
      const metadata = { source: 'radio', timestamp: Date.now() };
      
      await transport.receive(chunks, 'audio/opus', metadata);
      
      expect(mediaCache.store).toHaveBeenCalledWith(
        expect.stringContaining('received_'),
        expect.any(Uint8Array),
        'audio/opus',
        metadata
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should handle chunk failures', async () => {
      const request = {
        id: 'fail_test',
        url: '/data.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(500),
        priority: 0.5
      };
      
      await transport.transmit(request);
      
      // Simulate chunk failure
      const chunkFailHandler = mockChunkManager.on.mock.calls.find(
        (call: any[]) => call[0] === 'chunkFailed'
      )?.[1];
      
      if (chunkFailHandler) {
        chunkFailHandler('fail_test_chunk_0');
      }
      
      // Should still track transmission
      const status = transport.getTransmissionStatus('fail_test');
      expect(status).toBeDefined();
    });

    it('should handle unsupported media types', async () => {
      mockCodecRegistry.encode.mockRejectedValue(
        new Error('No codec registered for unknown/type')
      );
      
      const request = {
        id: 'unsupported_test',
        url: '/unknown.xyz',
        mimeType: 'unknown/type',
        data: new Uint8Array(100),
        priority: 0.5
      };
      
      await expect(transport.transmit(request)).rejects.toThrow('No codec');
    });
  });

  describe('Bandwidth Optimization', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('should optimize for 2.8kHz bandwidth', async () => {
      const request = {
        id: 'bandwidth_test',
        url: '/large.jpg',
        mimeType: 'image/jpeg',
        data: new Uint8Array(100000),
        priority: 0.6
      };
      
      await transport.transmit(request, {
        maxBandwidth: 350 // 350 bytes/sec (2.8kbps)
      });
      
      expect(mockCodecRegistry.encode).toHaveBeenCalledWith(
        expect.anything(),
        'image/jpeg',
        expect.objectContaining({
          maxSize: expect.any(Number)
        })
      );
    });

    it('should distribute load across carriers', async () => {
      const request = {
        id: 'distribute_test',
        url: '/data.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(4000),
        priority: 0.7
      };
      
      await transport.transmit(request);
      
      const chunks = mockChunkManager.queueChunks.mock.calls[0][0];
      
      // Should split across multiple carriers
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should be reasonably sized
      chunks.forEach((chunk: any) => {
        expect(chunk.data.length).toBeLessThan(2000);
      });
    });

    it('should prioritize high-priority transmissions', async () => {
      const highPriority = {
        id: 'high_priority',
        url: '/urgent.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(500),
        priority: 1.0
      };
      
      const lowPriority = {
        id: 'low_priority',
        url: '/normal.bin',
        mimeType: 'application/octet-stream',
        data: new Uint8Array(500),
        priority: 0.2
      };
      
      await transport.transmit(highPriority);
      await transport.transmit(lowPriority);
      
      const highChunks = mockChunkManager.queueChunks.mock.calls[0][0];
      const lowChunks = mockChunkManager.queueChunks.mock.calls[1][0];
      
      expect(highChunks[0].rarity).toBe(1.0);
      expect(lowChunks[0].rarity).toBe(0.2);
    });
  });
});

export {};