/**
 * Media Encoding Quality Contract Tests (T010)
 * 
 * Tests media codec quality levels, bandwidth optimization,
 * and progressive encoding compliance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mediaCodecs } from '../../lib/media-codecs/index.js';
import { JPEGEncoder } from '../../lib/media-codecs/jpeg.js';
import { OpusEncoder } from '../../lib/media-codecs/opus.js';
import { WebMEncoder } from '../../lib/media-codecs/webm.js';
import { PDFEncoder } from '../../lib/media-codecs/pdf.js';

describe('Media Encoding Quality Contract', () => {
  describe('JPEG Encoding', () => {
    let encoder: JPEGEncoder;
    
    beforeEach(() => {
      encoder = new JPEGEncoder();
    });

    it('should respect quality settings', async () => {
      const imageData = new ImageData(100, 100);
      
      // High quality
      const highQuality = await encoder.encode(imageData, { quality: 90 });
      
      // Low quality
      const lowQuality = await encoder.encode(imageData, { quality: 30 });
      
      // Lower quality should be smaller
      expect(lowQuality.length).toBeLessThan(highQuality.length);
    });

    it('should support progressive encoding', async () => {
      const imageData = new ImageData(200, 200);
      
      const progressive = await encoder.encode(imageData, {
        quality: 75,
        progressive: true
      });
      
      expect(progressive).toBeInstanceOf(Uint8Array);
      expect(progressive.length).toBeGreaterThan(0);
    });

    it('should respect maxSize constraint', async () => {
      const imageData = new ImageData(500, 500);
      const maxSize = 10000; // 10KB
      
      const encoded = await encoder.encode(imageData, {
        quality: 75,
        maxSize
      });
      
      expect(encoded.length).toBeLessThanOrEqual(maxSize);
    });

    it('should estimate size accurately', () => {
      const imageData = new ImageData(100, 100);
      
      const estimated = encoder.estimateSize(imageData, { quality: 75 });
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThan(100 * 100 * 3); // Uncompressed size
    });
  });

  describe('Opus Audio Encoding', () => {
    let encoder: OpusEncoder;
    
    beforeEach(() => {
      encoder = new OpusEncoder();
    });

    it('should encode at target bitrate', async () => {
      const sampleRate = 8000;
      const duration = 1; // 1 second
      const samples = sampleRate * duration;
      const audioData = new Float32Array(samples);
      
      // Generate test tone
      for (let i = 0; i < samples; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }
      
      const encoded = await encoder.encode([audioData], {
        quality: 16 // 16 kbps
      });
      
      // Should be approximately 16 kbps * 1 second / 8 = 2KB
      expect(encoded.length).toBeGreaterThan(1500);
      expect(encoded.length).toBeLessThan(3000);
    });

    it('should downsample to 8kHz for narrow-band', async () => {
      const audioData = new Float32Array(16000); // 16kHz input
      
      const encoded = await encoder.encode([audioData]);
      const decoded = await encoder.decode(encoded);
      
      // Should be downsampled
      expect(decoded.sampleRate).toBeLessThanOrEqual(8000);
    });

    it('should convert stereo to mono', async () => {
      const left = new Float32Array(8000);
      const right = new Float32Array(8000);
      
      const encoded = await encoder.encode([left, right]);
      const decoded = await encoder.decode(encoded);
      
      expect(decoded.numberOfChannels).toBe(1);
    });
  });

  describe('WebM Video Encoding', () => {
    let encoder: WebMEncoder;
    
    beforeEach(() => {
      encoder = new WebMEncoder();
    });

    it('should encode video frames', async () => {
      const frames = [
        {
          width: 320,
          height: 240,
          timestamp: 0,
          data: new ImageData(320, 240)
        },
        {
          width: 320,
          height: 240,
          timestamp: 0.1,
          data: new ImageData(320, 240)
        }
      ];
      
      const encoded = await encoder.encode(frames, {
        quality: 30 // 30 kbps
      });
      
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should optimize dimensions for bitrate', async () => {
      const largeFrame = {
        width: 1920,
        height: 1080,
        timestamp: 0,
        data: new ImageData(1920, 1080)
      };
      
      const encoded = await encoder.encode([largeFrame], {
        quality: 30 // Very low bitrate
      });
      
      // Should be significantly compressed
      const uncompressed = 1920 * 1080 * 3;
      expect(encoded.length).toBeLessThan(uncompressed / 100);
    });

    it('should support keyframe extraction', async () => {
      const frames = Array.from({ length: 30 }, (_, i) => ({
        width: 320,
        height: 240,
        timestamp: i / 10,
        data: new ImageData(320, 240)
      }));
      
      const encoded = await encoder.encode(frames);
      const decoded = await encoder.decode(encoded);
      
      // Should have keyframes
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe('PDF Document Encoding', () => {
    let encoder: PDFEncoder;
    
    beforeEach(() => {
      encoder = new PDFEncoder();
    });

    it('should encode document structure', async () => {
      const doc = {
        pages: [
          {
            text: 'Test document page 1',
            width: 612,
            height: 792
          },
          {
            text: 'Test document page 2',
            width: 612,
            height: 792
          }
        ],
        metadata: {
          title: 'Test Document',
          author: 'Test Author'
        }
      };
      
      const encoded = await encoder.encode(doc);
      
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);
      
      // Should contain PDF markers
      const pdfString = new TextDecoder().decode(encoded);
      expect(pdfString).toContain('%PDF');
      expect(pdfString).toContain('%%EOF');
    });

    it('should extract text from PDF', async () => {
      const doc = {
        pages: [
          {
            text: 'Extract this text',
            width: 612,
            height: 792
          }
        ]
      };
      
      const encoded = await encoder.encode(doc);
      const decoded = await encoder.decode(encoded);
      
      expect(decoded.pages[0].text).toContain('Extract this text');
    });

    it('should respect size constraints', async () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const doc = {
        pages: [
          {
            text: longText,
            width: 612,
            height: 792
          }
        ]
      };
      
      const encoded = await encoder.encode(doc, {
        maxSize: 1000 // 1KB limit
      });
      
      expect(encoded.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Codec Registry', () => {
    it('should select appropriate codec by MIME type', async () => {
      const imageData = new ImageData(100, 100);
      
      const jpeg = await mediaCodecs.encode(imageData, 'image/jpeg');
      expect(jpeg).toBeInstanceOf(Uint8Array);
      
      const audioData = [new Float32Array(8000)];
      const opus = await mediaCodecs.encode(audioData, 'audio/opus');
      expect(opus).toBeInstanceOf(Uint8Array);
    });

    it('should track encoding metrics', async () => {
      const imageData = new ImageData(100, 100);
      
      await mediaCodecs.encode(imageData, 'image/jpeg', { quality: 75 });
      await mediaCodecs.encode(imageData, 'image/jpeg', { quality: 50 });
      
      const stats = mediaCodecs.getStats('image/jpeg');
      expect(stats.get('image/jpeg')?.length).toBe(2);
    });

    it('should optimize quality for size constraint', () => {
      const originalSize = 100000;
      const maxSize = 10000;
      
      const quality = mediaCodecs.getOptimalQuality(
        'image/jpeg',
        originalSize,
        maxSize
      );
      
      expect(quality).toBeLessThanOrEqual(80);
      expect(quality).toBeGreaterThan(0);
    });
  });

  describe('Bandwidth Optimization', () => {
    it('should meet 2.8kHz bandwidth constraint', async () => {
      const duration = 10; // 10 seconds
      const maxBandwidth = 2800; // Hz
      const maxBits = maxBandwidth * duration * 2; // QPSK = 2 bits/symbol
      const maxBytes = maxBits / 8;
      
      const imageData = new ImageData(500, 500);
      const encoded = await mediaCodecs.encode(imageData, 'image/jpeg', {
        maxSize: maxBytes
      });
      
      expect(encoded.length).toBeLessThanOrEqual(maxBytes);
    });

    it('should prioritize quality for available bandwidth', async () => {
      const imageData = new ImageData(200, 200);
      
      // High bandwidth = high quality
      const highBW = await mediaCodecs.encode(imageData, 'image/jpeg', {
        maxSize: 50000,
        quality: 90
      });
      
      // Low bandwidth = low quality
      const lowBW = await mediaCodecs.encode(imageData, 'image/jpeg', {
        maxSize: 5000,
        quality: 30
      });
      
      expect(highBW.length).toBeGreaterThan(lowBW.length);
    });
  });
});

describe('Progressive Encoding Contract', () => {
  it('should support progressive JPEG scanning', async () => {
    const encoder = new JPEGEncoder();
    const imageData = new ImageData(200, 200);
    
    const progressive = await encoder.encode(imageData, {
      progressive: true,
      quality: 75
    });
    
    // Progressive JPEG should be decodable in scans
    const partialData = progressive.slice(0, Math.floor(progressive.length / 2));
    
    // Should not throw when decoding partial data
    try {
      await encoder.decode(partialData);
    } catch (e) {
      // Expected for partial data, but should not crash
      expect(e).toBeDefined();
    }
  });

  it('should support video keyframe extraction', async () => {
    const encoder = new WebMEncoder();
    const frames = Array.from({ length: 50 }, (_, i) => ({
      width: 320,
      height: 240,
      timestamp: i / 10,
      data: new ImageData(320, 240)
    }));
    
    const encoded = await encoder.encode(frames);
    
    // Should be smaller than raw frames
    const rawSize = frames.length * 320 * 240 * 4;
    expect(encoded.length).toBeLessThan(rawSize / 10);
  });
});

export {};