/**
 * Signal Characteristics Data Model
 * Detailed signal analysis and classification data
 */

export interface SignalCharacteristics {
  centerFrequency: number;
  peakMagnitude: number;
  estimatedBandwidth: number;
  signalToNoiseRatio: number;
  detectionThreshold: number;
  qualityScore: number;
  stability?: number;
  doppler?: DopplerParameters;
  spectralShape?: SpectralShape;
  temporalPattern?: TemporalPattern;
}

export interface SpectralShape {
  skewness: number;
  kurtosis: number;
  spectralCentroid: number;
  spectralSpread: number;
  spectralRolloff: number;
  spectralFlatness: number;
  harmonics?: HarmonicAnalysis[];
}

export interface HarmonicAnalysis {
  frequency: number;
  magnitude: number;
  phase: number;
  order: number;
  thd: number; // Total Harmonic Distortion
}

export interface TemporalPattern {
  keying: KeyingPattern;
  pulseDuration: number;
  pulseInterval: number;
  dutyCycle: number;
  timing: TimingAnalysis;
}

export type KeyingPattern = 'CONTINUOUS' | 'KEYED' | 'BURST' | 'PERIODIC' | 'RANDOM';

export interface TimingAnalysis {
  baudRate?: number;
  symbolPeriod?: number;
  preambleLength?: number;
  syncPattern?: number[];
  frameStructure?: FrameStructure;
}

export interface FrameStructure {
  headerLength: number;
  payloadLength: number;
  trailerLength: number;
  errorCorrectionType: string;
  interleavingPattern?: number[];
}

export interface DopplerParameters {
  shift: number; // Hz
  rate: number; // Hz/s
  confidence: number;
  direction?: 'APPROACHING' | 'RECEDING' | 'STATIONARY';
}

export interface QualityMetrics {
  estimationAccuracy: number;
  measurementConfidence: number;
  noiseFloorStability: number;
  calibrationAge: number;
  temperatureStability: number;
}

export const DEFAULT_QUALITY_THRESHOLDS = {
  MIN_SNR: 6, // dB
  MIN_CONFIDENCE: 0.7,
  MAX_FREQUENCY_ERROR: 100, // Hz
  MAX_TIMING_JITTER: 0.1, // symbols
  MIN_STABILITY: 0.9
} as const;