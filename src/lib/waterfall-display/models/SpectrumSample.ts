/**
 * Spectrum Sample Data Model
 * Represents a single spectrum measurement with timing and metadata
 */

import type { SignalDetection } from '../../signal-detector/models/SignalDetection.js';

export interface SpectrumSample {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  phases: Float32Array;
  timestamp: number;
  centerFrequency: number;
  sampleRate: number;
  noiseFloor: number;
  peakPower: number;
  fftSize: number;
  signalDetections?: SignalDetection[];
  qualityMetrics?: SpectrumQualityMetrics;
}


export interface SpectrumQualityMetrics {
  dynamicRange: number;
  spectralPurity: number;
  noiseVariance: number;
  dcOffset: number;
  imageRejection: number;
  spuriousFreeRange: number;
}

export interface SpectrumStatistics {
  sampleCount: number;
  averagePower: number;
  peakToPeakVariation: number;
  frequencyStability: number;
  temperatureDrift: number;
  lastCalibration: number;
}

export const DEFAULT_SPECTRUM_QUALITY: SpectrumQualityMetrics = {
  dynamicRange: 60, // dB
  spectralPurity: -60, // dBc
  noiseVariance: 0.1,
  dcOffset: 0.001,
  imageRejection: 40, // dB
  spuriousFreeRange: 70 // dB
};