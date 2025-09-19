/**
 * Detection Parameters Data Model
 * Configuration for signal detection algorithms
 */

export interface DetectionParameters {
  threshold: ThresholdParameters;
  filtering: FilteringParameters;
  analysis: AnalysisParameters;
  classification: ClassificationParameters;
  performance: PerformanceParameters;
}

export interface ThresholdParameters {
  snrThreshold: number; // dB
  magnitudeThreshold: number; // dBm
  adaptiveThreshold: boolean;
  thresholdMargin: number; // dB
  noiseFloorTracking: boolean;
  falseAlarmRate: number;
}

export interface FilteringParameters {
  preFilter: boolean;
  filterType: FilterType;
  cutoffFrequency: number; // Hz
  filterOrder: number;
  notchFilters: NotchFilter[];
  dcRemoval: boolean;
}

export type FilterType = 'LOWPASS' | 'HIGHPASS' | 'BANDPASS' | 'BANDSTOP' | 'NONE';

export interface NotchFilter {
  frequency: number; // Hz
  bandwidth: number; // Hz
  depth: number; // dB
  enabled: boolean;
}

export interface AnalysisParameters {
  fftSize: number;
  windowFunction: WindowFunction;
  overlapRatio: number;
  averagingPeriod: number; // ms
  peakDetection: PeakDetectionParameters;
  bandwidthEstimation: BandwidthEstimationParameters;
}

export type WindowFunction = 'HANN' | 'HAMMING' | 'BLACKMAN' | 'RECTANGULAR' | 'KAISER';

export interface PeakDetectionParameters {
  minHeight: number; // dB above noise floor
  minDistance: number; // bins
  prominence: number; // dB
  width: number; // bins
  maxPeaks: number;
}

export interface BandwidthEstimationParameters {
  method: BandwidthMethod;
  threshold: number; // dB below peak
  minBandwidth: number; // Hz
  maxBandwidth: number; // Hz
}

export type BandwidthMethod = 'THREE_DB' | 'SIX_DB' | 'TEN_DB' | 'TWENTY_DB' | 'NOISE_FLOOR';

export interface ClassificationParameters {
  enabled: boolean;
  algorithms: ClassificationAlgorithm[];
  confidenceThreshold: number;
  retraining: boolean;
  modelPath?: string;
}

export type ClassificationAlgorithm = 'NEURAL_NETWORK' | 'SVM' | 'DECISION_TREE' | 'NAIVE_BAYES' | 'EXPERT_SYSTEM';

export interface PerformanceParameters {
  maxDetectionsPerFrame: number;
  processingTimeout: number; // ms
  memoryLimit: number; // MB
  parallelProcessing: boolean;
  gpuAcceleration: boolean;
}

export const DEFAULT_DETECTION_PARAMETERS: DetectionParameters = {
  threshold: {
    snrThreshold: 6, // dB
    magnitudeThreshold: -90, // dBm
    adaptiveThreshold: true,
    thresholdMargin: 3, // dB
    noiseFloorTracking: true,
    falseAlarmRate: 0.01
  },
  filtering: {
    preFilter: true,
    filterType: 'BANDPASS',
    cutoffFrequency: 3000, // Hz
    filterOrder: 4,
    notchFilters: [
      {
        frequency: 60, // Hz (power line)
        bandwidth: 2,
        depth: 40,
        enabled: true
      }
    ],
    dcRemoval: true
  },
  analysis: {
    fftSize: 2048,
    windowFunction: 'HANN',
    overlapRatio: 0.5,
    averagingPeriod: 100,
    peakDetection: {
      minHeight: 6, // dB above noise floor
      minDistance: 10, // bins
      prominence: 3, // dB
      width: 2, // bins
      maxPeaks: 50
    },
    bandwidthEstimation: {
      method: 'THREE_DB',
      threshold: -3, // dB below peak
      minBandwidth: 10, // Hz
      maxBandwidth: 200000 // Hz
    }
  },
  classification: {
    enabled: true,
    algorithms: ['EXPERT_SYSTEM', 'NEURAL_NETWORK'],
    confidenceThreshold: 0.7,
    retraining: false
  },
  performance: {
    maxDetectionsPerFrame: 100,
    processingTimeout: 50, // ms
    memoryLimit: 100, // MB
    parallelProcessing: true,
    gpuAcceleration: false
  }
};