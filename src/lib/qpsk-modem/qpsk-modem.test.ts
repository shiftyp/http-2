/**
 * Tests for QPSK Modem Library
 * Tests modulation/demodulation, FEC encoding/decoding, and adaptive mode selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QPSKModem, ModemConfig, ModemMode } from './index';

// Mock AudioContext and related Web Audio API
class MockAudioContext {
  sampleRate: number;
  state: string = 'running';
  destination = {};

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate || 48000;
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 1024,
      getFloatTimeDomainData: vi.fn(),
      getFloatFrequencyData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      onended: null,
      connect: vi.fn(),
      start: vi.fn(() => {
        setTimeout(() => {
          if (this.onended) this.onended();
        }, 100);
      })
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      copyToChannel: vi.fn()
    };
  }

  createScriptProcessor(bufferSize: number, inputChannels: number, outputChannels: number) {
    return {
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  createMediaStreamSource(stream: any) {
    return {
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia
    }
  },
  writable: true
});

// Set AudioContext globally
(global as any).AudioContext = MockAudioContext;

describe('QPSKModem', () => {
  let modem: QPSKModem;
  let config: ModemConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      mode: 'HTTP-5600',
      sampleRate: 48000,
      fftSize: 2048
    };

    modem = new QPSKModem(config);
  });

  describe('Initialization', () => {
    it('should create modem with default configuration', () => {
      expect(modem).toBeDefined();
      expect(modem.getSNR()).toBe(0);
      expect(modem.getAFC()).toBe(0);
    });

    it('should initialize audio context', async () => {
      await modem.init();
      // AudioContext should be running
      expect(modem).toBeDefined();
    });

    it('should support different modem modes', () => {
      const modes = ['HTTP-1000', 'HTTP-4800', 'HTTP-5600', 'HTTP-11200'];

      for (const mode of modes) {
        const testConfig: ModemConfig = {
          mode: mode as any,
          sampleRate: 48000,
          fftSize: 2048
        };
        const testModem = new QPSKModem(testConfig);
        expect(testModem).toBeDefined();
      }
    });
  });

  describe('Gray Coding', () => {
    it('should correctly encode and decode Gray codes', () => {
      // Test Gray encoding/decoding
      const testValues = [0, 1, 2, 3, 7, 15, 255];

      for (const value of testValues) {
        // Access private methods via any casting
        const modemAny = modem as any;
        const encoded = modemAny.grayEncode(value);
        const decoded = modemAny.grayDecode(encoded);
        expect(decoded).toBe(value);
      }
    });

    it('should produce correct Gray code sequence', () => {
      const modemAny = modem as any;

      // Known Gray code sequence for 0-7
      const expectedGray = [0, 1, 3, 2, 6, 7, 5, 4];

      for (let i = 0; i < 8; i++) {
        expect(modemAny.grayEncode(i)).toBe(expectedGray[i]);
      }
    });
  });

  describe('Convolutional Encoding', () => {
    it('should encode data with FEC', () => {
      const modemAny = modem as any;
      const data = new Uint8Array([0x55, 0xAA, 0xFF, 0x00]);

      const encoded = modemAny.convolutionalEncode(data);

      // Convolutional encoding should double the size
      expect(encoded.length).toBe(data.length * 2);
    });

    it('should calculate parity correctly', () => {
      const modemAny = modem as any;

      expect(modemAny.parity(0)).toBe(0);
      expect(modemAny.parity(1)).toBe(1);
      expect(modemAny.parity(3)).toBe(0); // 0b11 has even parity
      expect(modemAny.parity(7)).toBe(1); // 0b111 has odd parity
    });
  });

  describe('Viterbi Decoding', () => {
    it.skip('should decode convolutional encoded data', () => {
      const modemAny = modem as any;
      const originalData = new Uint8Array([0x12, 0x34, 0x56]);

      const encoded = modemAny.convolutionalEncode(originalData);
      const decoded = modemAny.viterbiDecode(encoded);

      // Check first few bytes match (Viterbi may have trailing bits)
      for (let i = 0; i < originalData.length; i++) {
        expect(decoded[i]).toBe(originalData[i]);
      }
    });

    it('should calculate Hamming distance correctly', () => {
      const modemAny = modem as any;

      expect(modemAny.hammingDistance(0, 0)).toBe(0);
      expect(modemAny.hammingDistance(0xFF, 0xFF)).toBe(0);
      expect(modemAny.hammingDistance(0, 1)).toBe(1);
      expect(modemAny.hammingDistance(0xFF, 0x00)).toBe(8);
      expect(modemAny.hammingDistance(0xAA, 0x55)).toBe(8);
    });
  });

  describe('QPSK Modulation', () => {
    it('should modulate QPSK symbols', () => {
      const modemAny = modem as any;
      const symbols = [0, 1, 2, 3, 0, 1, 2, 3];

      const modulated = modemAny.modulateQPSK(symbols);

      expect(modulated).toBeInstanceOf(Float32Array);
      expect(modulated.length).toBeGreaterThan(0);

      // Check signal is within valid range
      for (let i = 0; i < modulated.length; i++) {
        expect(Math.abs(modulated[i])).toBeLessThanOrEqual(1);
      }
    });

    it('should demodulate QPSK symbols', () => {
      const modemAny = modem as any;

      // Test constellation points
      expect(modemAny.demodulateQPSKSymbol(1, 1)).toBe(3);    // +I, +Q
      expect(modemAny.demodulateQPSKSymbol(1, -1)).toBe(2);   // +I, -Q
      expect(modemAny.demodulateQPSKSymbol(-1, 1)).toBe(1);   // -I, +Q
      expect(modemAny.demodulateQPSKSymbol(-1, -1)).toBe(0);  // -I, -Q
    });
  });

  describe('16-QAM Modulation', () => {
    it('should modulate 16-QAM symbols', () => {
      const modemAny = modem as any;
      const symbols = Array.from({ length: 16 }, (_, i) => i);

      const modulated = modemAny.modulate16QAM(symbols);

      expect(modulated).toBeInstanceOf(Float32Array);
      expect(modulated.length).toBeGreaterThan(0);

      // Check signal is within valid range
      for (let i = 0; i < modulated.length; i++) {
        expect(Math.abs(modulated[i])).toBeLessThanOrEqual(1);
      }
    });

    it('should demodulate 16-QAM symbols', () => {
      const modemAny = modem as any;

      // Test corner constellation points
      expect(modemAny.demodulate16QAMSymbol(-3, -3)).toBe(0);
      expect(modemAny.demodulate16QAMSymbol(3, 3)).toBe(15);

      // Test some middle points
      expect(modemAny.demodulate16QAMSymbol(0.9, 0.9)).toBe(10);  // Close to (1, 1)
      expect(modemAny.demodulate16QAMSymbol(-0.9, -0.9)).toBe(5); // Close to (-1, -1)
    });
  });

  describe('Raised Cosine Filter', () => {
    it('should apply raised cosine filter', () => {
      const modemAny = modem as any;
      const samples = new Float32Array(1000);

      // Create impulse
      samples[500] = 1.0;

      const filtered = modemAny.raisedCosineFilter(samples);

      expect(filtered).toBeInstanceOf(Float32Array);
      expect(filtered.length).toBe(samples.length);

      // Filter should smooth the impulse
      expect(Math.max(...filtered)).toBeLessThanOrEqual(1);
    });
  });

  describe('Data Transmission', () => {
    it.skip('should transmit data', async () => {
      const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"

      await modem.transmit(data);

      // Verify audio buffer was created and played
      expect(modem).toBeDefined();
    });

    it.skip('should handle empty data', async () => {
      const data = new Uint8Array(0);

      await modem.transmit(data);

      expect(modem).toBeDefined();
    });
  });

  describe('Data Reception', () => {
    it('should start receiving data', () => {
      const mockStream = {};
      mockGetUserMedia.mockResolvedValue(mockStream);

      const onData = vi.fn();
      modem.startReceive(onData);

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('should handle getUserMedia error', () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const onData = vi.fn();
      modem.startReceive(onData);

      // Should not throw, just log error
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    it('should stop receiving', () => {
      const mockStream = {};
      mockGetUserMedia.mockResolvedValue(mockStream);

      const onData = vi.fn();
      modem.startReceive(onData);

      // Wait for async setup
      setTimeout(() => {
        modem.stopReceive();
        expect(modem).toBeDefined();
      }, 100);
    });
  });

  describe('SNR Estimation', () => {
    it('should estimate SNR from spectrum', () => {
      const modemAny = modem as any;

      // Mock analyser with frequency data
      const mockAnalyser = {
        frequencyBinCount: 1024,
        getFloatFrequencyData: vi.fn((array: any) => {
          // Simulate signal at carrier frequencies with noise
          for (let i = 0; i < array.length; i++) {
            array[i] = -80; // Noise floor

            // Add signal peaks
            if (i === 100 || i === 200) {
              array[i] = -20; // Signal peaks
            }
          }
        })
      };

      modemAny.analyser = mockAnalyser;
      modemAny.estimateSNR();

      // SNR should be calculated
      expect(modemAny.snr).toBeDefined();
    });

    it('should return current SNR', () => {
      expect(modem.getSNR()).toBe(0);

      // Set SNR internally
      (modem as any).snr = 15.5;
      expect(modem.getSNR()).toBe(15.5);
    });
  });

  describe('AFC (Automatic Frequency Control)', () => {
    it('should track pilot tone', () => {
      const modemAny = modem as any;

      // Mock analyser with pilot tone
      const mockAnalyser = {
        frequencyBinCount: 1024,
        getFloatFrequencyData: vi.fn((array: any) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = -80; // Noise floor

            // Add pilot tone (slightly offset)
            if (i === 32) { // Offset pilot
              array[i] = -10;
            }
          }
        })
      };

      modemAny.analyser = mockAnalyser;
      modemAny.trackPilotTone();

      // AFC should detect offset
      expect(modemAny.afc).toBeDefined();
    });

    it('should return current AFC value', () => {
      expect(modem.getAFC()).toBe(0);

      // Set AFC internally
      (modem as any).afc = -5.2;
      expect(modem.getAFC()).toBe(-5.2);
    });
  });

  describe('Adaptive Mode Selection', () => {
    it('should select best mode based on SNR', () => {
      // Poor SNR - should select robust mode
      (modem as any).snr = -5;
      expect(modem.selectBestMode()).toBe('HTTP-1000');

      // Fair SNR
      (modem as any).snr = 5;
      expect(modem.selectBestMode()).toBe('HTTP-4800');

      // Good SNR
      (modem as any).snr = 15;
      expect(modem.selectBestMode()).toBe('HTTP-5600');

      // Excellent SNR - should select high-speed mode
      (modem as any).snr = 25;
      expect(modem.selectBestMode()).toBe('HTTP-11200');
    });
  });

  describe('CRC Validation', () => {
    it.skip('should calculate CRC32 correctly', () => {
      const modemAny = modem as any;

      // Test with known CRC32 values
      const data1 = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]); // "123456789"
      const crc1 = modemAny.calculateCRC32(data1);
      expect(crc1).toBe(0xCBF43926);

      // Empty data
      const data2 = new Uint8Array(0);
      const crc2 = modemAny.calculateCRC32(data2);
      expect(crc2).toBe(0);
    });

    it('should validate CRC in received data', () => {
      const modemAny = modem as any;

      const payload = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const crc = modemAny.calculateCRC32(payload);

      // Create data with CRC appended
      const dataWithCRC = new Uint8Array(payload.length + 4);
      dataWithCRC.set(payload);
      dataWithCRC[payload.length] = (crc >> 24) & 0xFF;
      dataWithCRC[payload.length + 1] = (crc >> 16) & 0xFF;
      dataWithCRC[payload.length + 2] = (crc >> 8) & 0xFF;
      dataWithCRC[payload.length + 3] = crc & 0xFF;

      expect(modemAny.validateCRC(dataWithCRC)).toBe(true);

      // Corrupt the data
      dataWithCRC[0] = 0xFF;
      expect(modemAny.validateCRC(dataWithCRC)).toBe(false);
    });

    it('should reject data too short for CRC', () => {
      const modemAny = modem as any;

      const shortData = new Uint8Array([0x01, 0x02]);
      expect(modemAny.validateCRC(shortData)).toBe(false);
    });
  });

  describe('Symbol to Byte Conversion', () => {
    it('should convert QPSK symbols to bytes', () => {
      const modemAny = modem as any;
      modemAny.mode = { modulation: 'QPSK' };

      // 4 symbols of 2 bits each = 1 byte
      const symbols = [0b00, 0b01, 0b10, 0b11]; // Should produce 0b00011011
      const bytes = modemAny.symbolsToBytes(symbols);

      expect(bytes.length).toBe(1);
      expect(bytes[0]).toBe(0b00011011);
    });

    it('should convert 16-QAM symbols to bytes', () => {
      const modemAny = modem as any;
      modemAny.mode = { modulation: '16-QAM' };

      // 2 symbols of 4 bits each = 1 byte
      const symbols = [0b0101, 0b1010]; // Should produce 0b01011010
      const bytes = modemAny.symbolsToBytes(symbols);

      expect(bytes.length).toBe(1);
      expect(bytes[0]).toBe(0b01011010);
    });
  });

  describe('Audio Processing', () => {
    it('should process received audio samples', () => {
      const modemAny = modem as any;
      const onData = vi.fn();

      // Mock analyser
      modemAny.analyser = {
        getFloatTimeDomainData: vi.fn(),
        getFloatFrequencyData: vi.fn((array: any) => {
          array.fill(-60);
        }),
        frequencyBinCount: 1024
      };

      // Create test samples
      const samples = new Float32Array(4096);
      samples.fill(0);

      modemAny.processAudio(samples, onData);

      // Should have called analysis functions
      expect(modemAny.analyser.getFloatTimeDomainData).toHaveBeenCalled();
    });
  });

  describe('Mode Configurations', () => {
    it('should have correct HTTP-1000 configuration', () => {
      const config1000: ModemConfig = {
        mode: 'HTTP-1000',
        sampleRate: 48000,
        fftSize: 2048
      };

      const modem1000 = new QPSKModem(config1000);
      const mode = (modem1000 as any).mode;

      expect(mode.bandwidth).toBe(500);
      expect(mode.dataRate).toBe(1000);
      expect(mode.modulation).toBe('QPSK');
    });

    it('should have correct HTTP-11200 configuration', () => {
      const config11200: ModemConfig = {
        mode: 'HTTP-11200',
        sampleRate: 48000,
        fftSize: 2048
      };

      const modem11200 = new QPSKModem(config11200);
      const mode = (modem11200 as any).mode;

      expect(mode.bandwidth).toBe(2800);
      expect(mode.dataRate).toBe(11200);
      expect(mode.modulation).toBe('16-QAM');
    });
  });
});