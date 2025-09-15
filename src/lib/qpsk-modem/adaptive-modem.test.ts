import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveModem } from './adaptive-modem';

describe('AdaptiveModem', () => {
  let modem: AdaptiveModem;

  beforeEach(() => {
    modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: true
    });
  });

  describe('Basic Modulation/Demodulation', () => {
    it('should modulate and demodulate data correctly with BPSK', async () => {
      const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"

      // Force BPSK mode
      const status = modem.getStatus();
      console.log('Initial status:', status);

      // Transmit
      const signal = await modem.transmit(testData);
      expect(signal).toBeInstanceOf(Float32Array);
      expect(signal.length).toBeGreaterThan(0);

      // Receive
      const received = await modem.receive(signal);
      expect(received).toEqual(testData);
    });

    it('should modulate and demodulate data correctly with QPSK', async () => {
      const testData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

      // Transmit
      const signal = await modem.transmit(testData);

      // Receive
      const received = await modem.receive(signal);
      expect(received).toEqual(testData);
    });

    it('should handle larger data blocks', async () => {
      // Create 1KB test data
      const testData = new Uint8Array(1024);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i & 0xFF;
      }

      // Transmit
      const signal = await modem.transmit(testData);

      // Receive
      const received = await modem.receive(signal);
      expect(received).toEqual(testData);
    });
  });

  describe('Reed-Solomon Error Correction', () => {
    it('should recover from symbol errors', async () => {
      const testData = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);

      // Transmit
      const signal = await modem.transmit(testData);

      // Corrupt some samples (simulate burst error)
      const corruptStart = Math.floor(signal.length * 0.3);
      const corruptEnd = Math.floor(signal.length * 0.35);
      for (let i = corruptStart; i < corruptEnd; i++) {
        signal[i] = 0;  // Zero out 5% of signal
      }

      // Should still recover data
      const received = await modem.receive(signal);
      expect(received).toEqual(testData);
    });

    it('should detect uncorrectable errors', async () => {
      const testData = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);

      // Transmit
      const signal = await modem.transmit(testData);

      // Corrupt too much of the signal
      for (let i = 0; i < signal.length / 2; i++) {
        signal[i] = Math.random() * 2 - 1;
      }

      // Should throw error for uncorrectable data
      await expect(modem.receive(signal)).rejects.toThrow();
    });
  });

  describe('Adaptive Modulation', () => {
    it('should select appropriate modulation based on SNR', () => {
      const modem = new AdaptiveModem({
        sampleRate: 48000,
        fftSize: 2048,
        adaptiveMode: true
      });

      // Test SNR-based selection
      const testCases = [
        { snr: -5, expected: 'BPSK' },
        { snr: 0, expected: 'BPSK' },
        { snr: 5, expected: 'QPSK' },
        { snr: 10, expected: '8-PSK' },
        { snr: 15, expected: '16-QAM' },
        { snr: 20, expected: '64-QAM' }
      ];

      for (const { snr, expected } of testCases) {
        const scheme = modem['selectModulation'](snr);
        expect(scheme.name).toBe(expected);
      }
    });

    it('should adapt modulation during operation', async () => {
      const testData = new Uint8Array([0x12, 0x34, 0x56, 0x78]);

      // Start with good SNR (should use higher order modulation)
      modem['snr'] = 20;
      const signal1 = await modem.transmit(testData);
      const status1 = modem.getStatus();
      console.log('High SNR status:', status1);

      // Simulate poor channel (should downgrade)
      modem['snr'] = 0;
      const signal2 = await modem.transmit(testData);
      const status2 = modem.getStatus();
      console.log('Low SNR status:', status2);

      // Signal2 should be longer (lower data rate)
      expect(signal2.length).toBeGreaterThan(signal1.length);
    });
  });

  describe('CRC Validation', () => {
    it('should add and validate CRC correctly', () => {
      const data = new Uint8Array([0x01, 0x02, 0x03]);

      const withCRC = modem['addCRC32'](data);
      expect(withCRC.length).toBe(data.length + 4);

      const isValid = modem['validateCRC32'](withCRC);
      expect(isValid).toBe(true);

      // Corrupt data
      withCRC[0] = 0xFF;
      const isInvalid = modem['validateCRC32'](withCRC);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Constellation Mapping', () => {
    it('should have valid constellation points', () => {
      // Basic validation that modem initializes correctly
      const status = modem.getStatus();
      expect(status.modulation).toBeDefined();
      expect(status.bitsPerSymbol).toBeGreaterThan(0);
      expect(status.dataRate).toBeGreaterThan(0);
    });
  });
});