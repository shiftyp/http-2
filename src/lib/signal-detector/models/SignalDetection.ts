/**
 * Signal Detection Data Model
 * Represents detected signals in spectrum data
 */

export interface SignalDetection {
  id: string;
  frequency: number;
  magnitude: number;
  snr: number;
  bandwidth: number;
  timestamp: number;
  confidence: number;
  signalType: string;
  characteristics: SignalCharacteristics;
  location?: GeographicLocation;
  modulation?: ModulationParameters;
}

export interface SignalCharacteristics {
  centerFrequency: number;
  peakMagnitude: number;
  estimatedBandwidth: number;
  signalToNoiseRatio: number;
  detectionThreshold: number;
  qualityScore: number;
  stability?: number;
  doppler?: DopplerParameters;
}

export interface ModulationParameters {
  type: ModulationType;
  symbolRate?: number;
  carrierOffset?: number;
  phaseNoise?: number;
  frequencyError?: number;
  constellation?: ConstellationPoint[];
}

export type ModulationType =
  | 'CW'
  | 'AM'
  | 'FM'
  | 'SSB'
  | 'QPSK'
  | 'PSK31'
  | 'FT8'
  | 'FT4'
  | 'RTTY'
  | 'PACKET'
  | 'DIGITAL'
  | 'UNKNOWN';

export interface ConstellationPoint {
  i: number;
  q: number;
  symbol: number;
}

export interface DopplerParameters {
  shift: number; // Hz
  rate: number; // Hz/s
  confidence: number;
}

export interface GeographicLocation {
  latitude?: number;
  longitude?: number;
  maidenhead?: string;
  distance?: number;
  azimuth?: number;
  elevation?: number;
}

export interface DetectionStatistics {
  totalDetections: number;
  uniqueSignals: number;
  averageSnr: number;
  strongSignals: number;
  weakSignals: number;
  falsePositiveRate: number;
  detectionLatency: number;
}

export const SIGNAL_TYPE_PRIORITIES = {
  'EMERGENCY': 0,
  'FT8': 1,
  'FT4': 2,
  'PSK31': 3,
  'RTTY': 4,
  'CW': 5,
  'SSB': 6,
  'AM': 7,
  'FM': 8,
  'DIGITAL': 9,
  'PACKET': 10,
  'UNKNOWN': 99
} as const;