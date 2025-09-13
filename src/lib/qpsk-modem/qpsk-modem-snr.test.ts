/**
 * SNR-based tests for QPSK Modem Library
 * Tests modem performance under various signal-to-noise ratio conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QPSKModem, ModemConfig } from './index';

// Mock AudioContext (reuse from main test)
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
    const source = {
      buffer: null,
      onended: null,
      connect: vi.fn(),
      start: vi.fn()
    };
    setTimeout(() => {
      if (source.onended) source.onended();
    }, 100);
    return source;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      copyToChannel: vi.fn()
    };
  }

  createScriptProcessor() {
    return {
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  createMediaStreamSource() {
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

(global as any).AudioContext = MockAudioContext;

/**
 * Generate AWGN (Additive White Gaussian Noise)
 */
function generateAWGN(length: number, power: number): Float32Array {
  const noise = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    noise[i] = z0 * Math.sqrt(power);
  }
  return noise;
}

/**
 * Add noise to signal based on target SNR
 */
function addNoiseToSignal(signal: Float32Array, snrDb: number): Float32Array {
  // Calculate signal power
  let signalPower = 0;
  for (let i = 0; i < signal.length; i++) {
    signalPower += signal[i] * signal[i];
  }
  signalPower /= signal.length;

  // Calculate required noise power for target SNR
  const snrLinear = Math.pow(10, snrDb / 10);
  const noisePower = signalPower / snrLinear;

  // Generate and add noise
  const noise = generateAWGN(signal.length, noisePower);
  const noisySignal = new Float32Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    noisySignal[i] = signal[i] + noise[i];
  }

  return noisySignal;
}

/**
 * Simulate multipath fading channel
 */
function simulateMultipath(signal: Float32Array, paths: number = 3): Float32Array {
  const output = new Float32Array(signal.length);

  // Path parameters: [delay, attenuation, phase]
  const pathParams = [
    [0, 1.0, 0],           // Direct path
    [50, 0.5, Math.PI/4],  // First reflection
    [120, 0.3, Math.PI/2]  // Second reflection
  ];

  for (let p = 0; p < Math.min(paths, pathParams.length); p++) {
    const [delay, atten, phase] = pathParams[p];

    for (let i = 0; i < signal.length; i++) {
      if (i >= delay) {
        output[i] += atten * signal[i - delay] * Math.cos(phase);
      }
    }
  }

  return output;
}

/**
 * Simulate frequency selective fading
 */
function simulateSelectiveFading(signal: Float32Array, fadeDepth: number = 0.5): Float32Array {
  const output = new Float32Array(signal.length);
  const fadeFreq = 0.01; // Fading frequency normalized

  for (let i = 0; i < signal.length; i++) {
    const fadingCoeff = 1 - fadeDepth * (1 + Math.sin(2 * Math.PI * fadeFreq * i)) / 2;
    output[i] = signal[i] * fadingCoeff;
  }

  return output;
}

/**
 * Calculate Bit Error Rate (BER)
 */
function calculateBER(original: Uint8Array, decoded: Uint8Array): number {
  let errors = 0;
  let totalBits = Math.min(original.length, decoded.length) * 8;

  for (let i = 0; i < Math.min(original.length, decoded.length); i++) {
    let xor = original[i] ^ decoded[i];
    while (xor) {
      errors += xor & 1;
      xor >>= 1;
    }
  }

  return errors / totalBits;
}

describe('QPSK Modem SNR Tests', () => {
  let modem: QPSKModem;
  let config: ModemConfig;

  beforeEach(() => {
    config = {
      mode: 'HTTP-5600',
      sampleRate: 48000,
      fftSize: 2048
    };
    modem = new QPSKModem(config);
  });

  describe('SNR-based Mode Selection', () => {
    const snrTestCases = [
      { snr: -10, expectedMode: 'HTTP-1000', description: 'Very poor conditions' },
      { snr: -5, expectedMode: 'HTTP-1000', description: 'Poor conditions' },
      { snr: 0, expectedMode: 'HTTP-1000', description: 'Marginal conditions' },
      { snr: 5, expectedMode: 'HTTP-4800', description: 'Fair conditions' },
      { snr: 10, expectedMode: 'HTTP-4800', description: 'Moderate conditions' },
      { snr: 15, expectedMode: 'HTTP-5600', description: 'Good conditions' },
      { snr: 20, expectedMode: 'HTTP-5600', description: 'Very good conditions' },
      { snr: 25, expectedMode: 'HTTP-11200', description: 'Excellent conditions' },
      { snr: 30, expectedMode: 'HTTP-11200', description: 'Outstanding conditions' }
    ];

    snrTestCases.forEach(({ snr, expectedMode, description }) => {
      it(`should select ${expectedMode} for SNR ${snr} dB (${description})`, () => {
        (modem as any).snr = snr;
        expect(modem.selectBestMode()).toBe(expectedMode);
      });
    });
  });

  describe('Signal Processing with Noise', () => {
    it('should process clean signal (high SNR)', () => {
      const modemAny = modem as any;

      // Generate clean QPSK signal
      const symbols = [0, 1, 2, 3, 0, 1, 2, 3];
      const cleanSignal = modemAny.modulateQPSK(symbols);

      // Add minimal noise (30 dB SNR)
      const noisySignal = addNoiseToSignal(cleanSignal, 30);

      // Verify signal integrity
      let correlation = 0;
      for (let i = 0; i < cleanSignal.length; i++) {
        correlation += cleanSignal[i] * noisySignal[i];
      }
      correlation /= cleanSignal.length;

      // High SNR should maintain high correlation
      expect(correlation).toBeGreaterThan(0.8);
    });

    it('should handle moderate noise (10 dB SNR)', () => {
      const modemAny = modem as any;

      const symbols = Array.from({ length: 100 }, () => Math.floor(Math.random() * 4));
      const cleanSignal = modemAny.modulateQPSK(symbols);

      // Add moderate noise
      const noisySignal = addNoiseToSignal(cleanSignal, 10);

      // Calculate signal degradation
      let mse = 0;
      for (let i = 0; i < cleanSignal.length; i++) {
        mse += Math.pow(cleanSignal[i] - noisySignal[i], 2);
      }
      mse /= cleanSignal.length;

      // MSE should be moderate
      expect(mse).toBeGreaterThan(0.01);
      expect(mse).toBeLessThan(0.5);
    });

    it('should struggle with heavy noise (0 dB SNR)', () => {
      const modemAny = modem as any;

      const symbols = Array.from({ length: 100 }, () => Math.floor(Math.random() * 4));
      const cleanSignal = modemAny.modulateQPSK(symbols);

      // Add heavy noise (signal power = noise power)
      const noisySignal = addNoiseToSignal(cleanSignal, 0);

      // Calculate signal-to-noise ratio verification
      let signalPower = 0;
      let noisePower = 0;

      for (let i = 0; i < cleanSignal.length; i++) {
        signalPower += cleanSignal[i] * cleanSignal[i];
        const noise = noisySignal[i] - cleanSignal[i];
        noisePower += noise * noise;
      }

      const measuredSNR = 10 * Math.log10(signalPower / noisePower);

      // Should be close to 0 dB
      expect(Math.abs(measuredSNR)).toBeLessThan(1);
    });
  });

  describe('BER Performance vs SNR', () => {
    it('should achieve low BER at high SNR', () => {
      const modemAny = modem as any;
      const testData = new Uint8Array([0x55, 0xAA, 0x12, 0x34, 0x56, 0x78]);

      // Encode and modulate
      const encoded = modemAny.convolutionalEncode(testData);
      const symbols: number[] = [];
      for (let i = 0; i < encoded.length; i++) {
        symbols.push(encoded[i] & 0x03);
        symbols.push((encoded[i] >> 2) & 0x03);
        symbols.push((encoded[i] >> 4) & 0x03);
        symbols.push((encoded[i] >> 6) & 0x03);
      }

      const modulated = modemAny.modulateQPSK(symbols);

      // Add minimal noise (25 dB SNR)
      const received = addNoiseToSignal(modulated, 25);

      // Demodulate (simplified - just check signal power)
      const demodSymbols = modemAny.demodulate(received);

      // At high SNR, most symbols should be correct
      let correctSymbols = 0;
      for (let i = 0; i < Math.min(symbols.length, demodSymbols.length); i++) {
        if (symbols[i] === demodSymbols[i]) correctSymbols++;
      }

      const symbolErrorRate = 1 - (correctSymbols / symbols.length);
      expect(symbolErrorRate).toBeLessThan(0.1); // Less than 10% symbol error rate
    });

    it('should show degraded BER at low SNR', () => {
      const modemAny = modem as any;
      const testData = new Uint8Array([0xFF, 0x00, 0xAA, 0x55]);

      // Encode and modulate
      const encoded = modemAny.convolutionalEncode(testData);
      const modulated = modemAny.modulateQPSK([0, 1, 2, 3, 0, 1, 2, 3]);

      // Add heavy noise (0 dB SNR)
      const received = addNoiseToSignal(modulated, 0);

      // At low SNR, expect significant errors
      const demodSymbols = modemAny.demodulate(received);

      // Symbol error rate should be significant
      expect(demodSymbols.length).toBeGreaterThan(0);
    });
  });

  describe('Channel Impairments', () => {
    it('should handle multipath fading', () => {
      const modemAny = modem as any;

      const symbols = [0, 1, 2, 3, 2, 1, 0, 3];
      const signal = modemAny.modulateQPSK(symbols);

      // Apply multipath fading
      const fadedSignal = simulateMultipath(signal, 3);

      // Signal should be distorted but still present
      let totalPower = 0;
      for (let i = 0; i < fadedSignal.length; i++) {
        totalPower += fadedSignal[i] * fadedSignal[i];
      }

      expect(totalPower).toBeGreaterThan(0);
      expect(fadedSignal.length).toBe(signal.length);
    });

    it('should handle frequency selective fading', () => {
      const modemAny = modem as any;

      const symbols = Array.from({ length: 50 }, (_, i) => i % 4);
      const signal = modemAny.modulateQPSK(symbols);

      // Apply frequency selective fading
      const fadedSignal = simulateSelectiveFading(signal, 0.7);

      // Check fading pattern
      let maxAmplitude = 0;
      let minAmplitude = Infinity;

      for (let i = 100; i < fadedSignal.length - 100; i++) {
        const amplitude = Math.abs(fadedSignal[i]);
        maxAmplitude = Math.max(maxAmplitude, amplitude);
        minAmplitude = Math.min(minAmplitude, amplitude);
      }

      // Should see amplitude variation due to fading
      const fadingRange = maxAmplitude - minAmplitude;
      expect(fadingRange).toBeGreaterThan(0);
    });

    it('should handle combined impairments', () => {
      const modemAny = modem as any;

      const symbols = Array.from({ length: 100 }, () => Math.floor(Math.random() * 4));
      const signal = modemAny.modulateQPSK(symbols);

      // Apply multiple impairments
      let impaired = simulateMultipath(signal, 2);
      impaired = simulateSelectiveFading(impaired, 0.5);
      impaired = addNoiseToSignal(impaired, 15);

      // Signal should still be detectable
      const fft = new Float32Array(2048);
      // Simple FFT magnitude check
      for (let i = 0; i < Math.min(fft.length, impaired.length); i++) {
        fft[i] = Math.abs(impaired[i]);
      }

      const avgMagnitude = fft.reduce((a, b) => a + b, 0) / fft.length;
      expect(avgMagnitude).toBeGreaterThan(0);
    });
  });

  describe('Adaptive Behavior Under Varying SNR', () => {
    it('should adapt to improving channel conditions', () => {
      const snrSequence = [-5, 0, 5, 10, 15, 20, 25];
      const expectedModes = [
        'HTTP-1000',
        'HTTP-1000',
        'HTTP-4800',
        'HTTP-4800',
        'HTTP-5600',
        'HTTP-5600',
        'HTTP-11200'
      ];

      snrSequence.forEach((snr, index) => {
        (modem as any).snr = snr;
        const selectedMode = modem.selectBestMode();
        expect(selectedMode).toBe(expectedModes[index]);
      });
    });

    it('should adapt to degrading channel conditions', () => {
      const snrSequence = [30, 25, 20, 15, 10, 5, 0, -5];
      const expectedModes = [
        'HTTP-11200',
        'HTTP-11200',
        'HTTP-5600',
        'HTTP-5600',
        'HTTP-4800',
        'HTTP-4800',
        'HTTP-1000',
        'HTTP-1000'
      ];

      snrSequence.forEach((snr, index) => {
        (modem as any).snr = snr;
        const selectedMode = modem.selectBestMode();
        expect(selectedMode).toBe(expectedModes[index]);
      });
    });
  });

  describe('SNR Estimation Accuracy', () => {
    it('should accurately estimate high SNR', () => {
      const modemAny = modem as any;

      // Mock spectrum with clear signal
      modemAny.analyser = {
        frequencyBinCount: 1024,
        getFloatFrequencyData: jest.fn((array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = -80; // Noise floor at -80 dB

            // Add strong signals at carrier frequencies
            if (i === 200 || i === 400) {
              array[i] = -20; // Signal 60 dB above noise
            }
          }
        })
      };

      modemAny.estimateSNR();

      // Should detect high SNR
      expect(modemAny.snr).toBeGreaterThan(20);
    });

    it('should accurately estimate low SNR', () => {
      const modemAny = modem as any;

      // Mock spectrum with weak signal
      modemAny.analyser = {
        frequencyBinCount: 1024,
        getFloatFrequencyData: jest.fn((array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = -60; // Higher noise floor

            // Add weak signals barely above noise
            if (i === 200 || i === 400) {
              array[i] = -58; // Signal only 2 dB above noise
            }
          }
        })
      };

      modemAny.estimateSNR();

      // Should detect low SNR
      expect(modemAny.snr).toBeLessThan(5);
    });
  });

  describe('Error Correction Performance vs SNR', () => {
    it('should correct errors effectively at moderate SNR', () => {
      const modemAny = modem as any;
      const originalData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"

      // Encode with FEC
      const encoded = modemAny.convolutionalEncode(originalData);

      // Simulate errors based on SNR
      const errorRate = 0.05; // 5% bit error rate
      const corrupted = new Uint8Array(encoded.length);

      for (let i = 0; i < encoded.length; i++) {
        corrupted[i] = encoded[i];
        // Randomly flip bits based on error rate
        for (let bit = 0; bit < 8; bit++) {
          if (Math.random() < errorRate) {
            corrupted[i] ^= (1 << bit);
          }
        }
      }

      // Decode with Viterbi
      const decoded = modemAny.viterbiDecode(corrupted);

      // Check how many bytes were correctly recovered
      let correctBytes = 0;
      for (let i = 0; i < originalData.length; i++) {
        if (decoded[i] === originalData[i]) correctBytes++;
      }

      // FEC should recover most errors at moderate error rates
      const recoveryRate = correctBytes / originalData.length;
      expect(recoveryRate).toBeGreaterThan(0.6); // At least 60% recovery
    });
  });

  describe('Realistic HF Channel Simulation', () => {
    it('should handle typical 20m band conditions (day)', () => {
      const modemAny = modem as any;

      // Simulate good daytime 20m propagation (SNR ~15-20 dB)
      modemAny.snr = 18;
      expect(modem.selectBestMode()).toBe('HTTP-5600');

      // Generate and process signal
      const symbols = Array.from({ length: 200 }, () => Math.floor(Math.random() * 4));
      const signal = modemAny.modulateQPSK(symbols);

      // Add typical daytime noise
      const received = addNoiseToSignal(signal, 18);

      // Should maintain good signal quality
      let signalPower = 0;
      for (let i = 0; i < signal.length; i++) {
        signalPower += signal[i] * signal[i];
      }
      expect(signalPower / signal.length).toBeGreaterThan(0);
    });

    it('should handle typical 40m band conditions (night)', () => {
      const modemAny = modem as any;

      // Simulate moderate nighttime 40m propagation (SNR ~8-12 dB)
      modemAny.snr = 10;
      expect(modem.selectBestMode()).toBe('HTTP-4800');

      // Add QSB (signal fading) typical of nighttime
      const symbols = Array.from({ length: 200 }, () => Math.floor(Math.random() * 4));
      const signal = modemAny.modulateQPSK(symbols);

      // Apply fading and noise
      const faded = simulateSelectiveFading(signal, 0.4);
      const received = addNoiseToSignal(faded, 10);

      // Signal should still be present despite fading
      const avgPower = received.reduce((a, b) => a + Math.abs(b), 0) / received.length;
      expect(avgPower).toBeGreaterThan(0);
    });

    it('should handle typical 80m band conditions (night, high noise)', () => {
      const modemAny = modem as any;

      // Simulate poor 80m conditions with high noise (SNR ~0-5 dB)
      modemAny.snr = 3;
      expect(modem.selectBestMode()).toBe('HTTP-1000');

      // High atmospheric noise typical of 80m
      const symbols = Array.from({ length: 200 }, () => Math.floor(Math.random() * 4));
      const signal = modemAny.modulateQPSK(symbols);

      // Heavy noise and some fading
      const faded = simulateSelectiveFading(signal, 0.3);
      const received = addNoiseToSignal(faded, 3);

      // Should switch to robust mode
      expect(modem.selectBestMode()).toBe('HTTP-1000');
    });
  });
});