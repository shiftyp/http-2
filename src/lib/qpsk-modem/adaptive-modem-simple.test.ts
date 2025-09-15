import { describe, it, expect } from 'vitest';
import { AdaptiveModem } from './adaptive-modem';

describe('AdaptiveModem - Simple Tests', () => {
  it('should initialize correctly', () => {
    const modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: true
    });

    const status = modem.getStatus();
    expect(status.modulation).toBe('QPSK');
    expect(status.dataRate).toBe(4800);
    expect(status.bitsPerSymbol).toBe(2);
  });

  it('should select modulation based on SNR', () => {
    const modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: true
    });

    // Test private method via bracket notation
    const selectMod = (modem as any).selectModulation.bind(modem);

    // Low SNR should select BPSK
    let scheme = selectMod(-1);
    expect(scheme.name).toBe('BPSK');

    // Medium SNR should select QPSK
    scheme = selectMod(5);
    expect(scheme.name).toBe('QPSK');

    // High SNR should select higher order modulation
    scheme = selectMod(15);
    expect(scheme.name).toBe('16-QAM');
  });

  it('should add and validate CRC correctly', () => {
    const modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: false
    });

    const data = new Uint8Array([0x01, 0x02, 0x03]);

    // Test private methods
    const addCRC = (modem as any).addCRC32.bind(modem);
    const validateCRC = (modem as any).validateCRC32.bind(modem);

    const withCRC = addCRC(data);
    expect(withCRC.length).toBe(data.length + 4);

    const isValid = validateCRC(withCRC);
    expect(isValid).toBe(true);

    // Corrupt data
    withCRC[0] = 0xFF;
    const isInvalid = validateCRC(withCRC);
    expect(isInvalid).toBe(false);
  });

  it('should modulate and demodulate simple data', async () => {
    const modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: false
    });

    // Very small test data to avoid complex Reed-Solomon issues
    const testData = new Uint8Array([0x42]);

    // Just test modulation/demodulation without full transmit/receive
    const modulate = (modem as any).modulate.bind(modem);
    const demodulate = (modem as any).demodulate.bind(modem);

    const signal = modulate(testData);
    expect(signal).toBeInstanceOf(Float32Array);
    expect(signal.length).toBeGreaterThan(0);

    const demodulated = demodulate(signal);
    expect(demodulated[0]).toBe(testData[0]);
  });

  it('should handle Reed-Solomon encoding/decoding', async () => {
    const modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: false
    });

    const testData = new Uint8Array([0x11, 0x22, 0x33]);

    // Test Reed-Solomon methods
    const encodeRS = (modem as any).encodeRS.bind(modem);
    const decodeRS = (modem as any).decodeRS.bind(modem);

    const encoded = await encodeRS(testData);
    expect(encoded.length).toBeGreaterThan(testData.length);

    const decoded = await decodeRS(encoded);
    expect(decoded).toEqual(testData);
  });
});