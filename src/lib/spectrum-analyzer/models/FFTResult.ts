/**
 * FFT Result Data Model
 * Raw FFT computation results with metadata
 */

export interface FFTResult {
  real: Float32Array;
  imaginary: Float32Array;
  magnitudes: Float32Array;
  phases: Float32Array;
  size: number;
  sampleRate: number;
  windowFunction: WindowFunction;
  timestamp: number;
  processing: FFTProcessingInfo;
}

export interface FFTProcessingInfo {
  algorithm: FFTAlgorithm;
  processingTime: number; // microseconds
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  accuracy: number; // estimation accuracy
  overflow: boolean;
  optimizations: OptimizationFlags;
}

export type FFTAlgorithm = 'RADIX2' | 'RADIX4' | 'MIXED_RADIX' | 'CHIRP_Z' | 'WFTA' | 'WEBASSEMBLY';

export interface OptimizationFlags {
  simdEnabled: boolean;
  multiThreaded: boolean;
  gpuAccelerated: boolean;
  inPlace: boolean;
  bitReversed: boolean;
}

export type WindowFunction = 'HANN' | 'HAMMING' | 'BLACKMAN' | 'RECTANGULAR' | 'KAISER' | 'GAUSSIAN' | 'TUKEY';

export interface WindowParameters {
  function: WindowFunction;
  parameter?: number; // For Kaiser (beta), Tukey (alpha), etc.
  coherentGain: number;
  processingGain: number;
  noiseBandwidth: number;
}

export interface FFTConfiguration {
  size: number;
  overlap: number; // 0.0 to 1.0
  window: WindowParameters;
  zeropadding: number; // factor
  decimation: number;
  preEmphasis: boolean;
  dcRemoval: boolean;
}

export interface SpectralAnalysis {
  spectralCentroid: number; // Hz
  spectralSpread: number; // Hz
  spectralSkewness: number;
  spectralKurtosis: number;
  spectralRolloff: number; // Hz
  spectralFlatness: number;
  spectralFlux: number;
  fundamentalFrequency?: number; // Hz
  harmonics?: HarmonicAnalysis[];
}

export interface HarmonicAnalysis {
  frequency: number; // Hz
  magnitude: number; // dB
  phase: number; // radians
  order: number;
  thd: number; // Total Harmonic Distortion
}

export interface FFTPerformanceMetrics {
  throughput: number; // samples/second
  latency: number; // milliseconds
  efficiency: number; // FLOPS/cycle
  powerConsumption: number; // watts
  temperature: number; // °C
  memoryBandwidth: number; // MB/s
}

export const WINDOW_CHARACTERISTICS = {
  RECTANGULAR: {
    coherentGain: 1.0,
    processingGain: 1.0,
    noiseBandwidth: 1.0,
    mainlobeWidth: 2,
    sidelobeLevel: -13.3
  },
  HANN: {
    coherentGain: 0.5,
    processingGain: 0.375,
    noiseBandwidth: 1.5,
    mainlobeWidth: 4,
    sidelobeLevel: -31.5
  },
  HAMMING: {
    coherentGain: 0.54,
    processingGain: 0.397,
    noiseBandwidth: 1.36,
    mainlobeWidth: 4,
    sidelobeLevel: -42.7
  },
  BLACKMAN: {
    coherentGain: 0.42,
    processingGain: 0.283,
    noiseBandwidth: 1.73,
    mainlobeWidth: 6,
    sidelobeLevel: -58.1
  },
  KAISER: {
    coherentGain: 0.4, // varies with beta
    processingGain: 0.32, // varies with beta
    noiseBandwidth: 1.8, // varies with beta
    mainlobeWidth: 6, // varies with beta
    sidelobeLevel: -60 // varies with beta
  }
} as const;

export const DEFAULT_FFT_CONFIG: FFTConfiguration = {
  size: 2048,
  overlap: 0.5,
  window: {
    function: 'HANN',
    coherentGain: 0.5,
    processingGain: 0.375,
    noiseBandwidth: 1.5
  },
  zeropadding: 1,
  decimation: 1,
  preEmphasis: false,
  dcRemoval: true
};