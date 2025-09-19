/**
 * Spectrum Analyzer Library - Main Entry Point
 * High-performance FFT processing and spectrum analysis
 */

export { FFTProcessor } from './FFTProcessor.js';
export { NoiseEstimator } from './NoiseEstimator.js';
export { PowerCalculator } from './PowerCalculator.js';

// Import for internal use
import { FFTProcessor } from './FFTProcessor.js';
import { NoiseEstimator } from './NoiseEstimator.js';
import { PowerCalculator } from './PowerCalculator.js';

// Data Models
export type { NoiseProfile } from './models/NoiseProfile.js';
export type { SpectrumData } from './models/SpectrumData.js';
export type { FFTResult } from './models/FFTResult.js';

/**
 * Main Spectrum Analyzer Class
 * Processes IQ data and generates spectrum information
 */
export class SpectrumAnalyzer {
  private fftProcessor: FFTProcessor;
  private noiseEstimator: NoiseEstimator;
  private powerCalculator: PowerCalculator;
  private isInitialized = false;

  constructor() {
    this.fftProcessor = new FFTProcessor();
    this.noiseEstimator = new NoiseEstimator();
    this.powerCalculator = new PowerCalculator();
  }

  /**
   * Initialize the spectrum analyzer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.fftProcessor.initialize();
    await this.noiseEstimator.initialize();
    this.isInitialized = true;
  }

  /**
   * Process IQ samples and generate spectrum data
   */
  async processIQSamples(
    iqData: Float32Array,
    sampleRate: number,
    centerFrequency: number
  ): Promise<SpectrumData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate input data
    if (!iqData || iqData.length === 0) {
      throw new Error('Invalid IQ data: empty or null array');
    }

    if (iqData.length % 2 !== 0) {
      throw new Error('Invalid IQ data: array length must be even (I/Q pairs)');
    }

    // Check for NaN values
    for (let i = 0; i < iqData.length; i++) {
      if (isNaN(iqData[i])) {
        throw new Error('Invalid IQ data: contains NaN values');
      }
    }

    // Configure FFT size based on input data
    const actualSize = Math.min(iqData.length / 2, 4096);
    this.fftProcessor.configure({ size: actualSize });

    // Perform FFT
    const fftResult = await this.fftProcessor.computeFFT(iqData);

    // Calculate power spectrum
    const powerSpectrum = this.powerCalculator.computePowerSpectrum(fftResult);

    // Estimate noise floor
    const noiseProfile = await this.noiseEstimator.estimateNoise(powerSpectrum);

    // Generate frequency bins
    const frequencies = this.generateFrequencyBins(
      centerFrequency,
      sampleRate,
      fftResult.size
    );

    return {
      frequencies,
      magnitudes: powerSpectrum,
      phases: fftResult.phases,
      timestamp: Date.now(),
      centerFrequency,
      sampleRate,
      noiseFloor: noiseProfile.averageLevel,
      peakPower: Math.max(...powerSpectrum),
      fftSize: fftResult.size
    };
  }

  /**
   * Generate frequency bins for display
   */
  private generateFrequencyBins(
    centerFreq: number,
    sampleRate: number,
    fftSize: number
  ): Float32Array {
    const frequencies = new Float32Array(fftSize);
    const binWidth = sampleRate / fftSize;

    for (let i = 0; i < fftSize; i++) {
      // Convert bin index to frequency
      const freq = (i - fftSize / 2) * binWidth + centerFreq;
      frequencies[i] = freq;
    }

    return frequencies;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.fftProcessor.cleanup();
    this.isInitialized = false;
  }
}

/**
 * Spectrum analyzer configuration
 */
export interface SpectrumAnalyzerConfig {
  fftSize: number;
  windowFunction: 'hann' | 'hamming' | 'blackman' | 'rectangular';
  overlapRatio: number;
  averagingFactor: number;
  noiseEstimationPeriod: number;
}

export const DEFAULT_SPECTRUM_CONFIG: SpectrumAnalyzerConfig = {
  fftSize: 2048,
  windowFunction: 'hann',
  overlapRatio: 0.5,
  averagingFactor: 0.1,
  noiseEstimationPeriod: 1000 // ms
};