/**
 * Noise Profile Data Model
 * Characterizes noise floor and interference patterns
 */

export interface NoiseProfile {
  averageLevel: number; // dBm
  variance: number;
  distribution: NoiseDistribution;
  frequencyProfile: Float32Array;
  temporalProfile: TemporalNoiseProfile;
  sources: NoiseSource[];
  statistics: NoiseStatistics;
}

export interface NoiseDistribution {
  type: DistributionType;
  parameters: DistributionParameters;
  goodnessOfFit: number;
}

export type DistributionType = 'GAUSSIAN' | 'RAYLEIGH' | 'RICE' | 'EXPONENTIAL' | 'UNIFORM' | 'IMPULSIVE';

export interface DistributionParameters {
  mean?: number;
  variance?: number;
  alpha?: number;
  beta?: number;
  lambda?: number;
  k?: number; // Rice factor
}

export interface TemporalNoiseProfile {
  shortTermVariance: number; // over 1ms
  mediumTermVariance: number; // over 100ms
  longTermVariance: number; // over 10s
  periodicComponents: PeriodicNoise[];
  impulsiveEvents: ImpulsiveNoise[];
}

export interface PeriodicNoise {
  frequency: number; // Hz
  amplitude: number; // dB
  phase: number; // radians
  confidence: number;
  source: string;
}

export interface ImpulsiveNoise {
  timestamp: number;
  duration: number; // ms
  amplitude: number; // dB above noise floor
  bandwidth: number; // Hz
  repetitionRate?: number; // Hz
}

export interface NoiseSource {
  type: NoiseSourceType;
  frequency: number; // Hz
  strength: number; // dB
  identification: string;
  location?: GeographicLocation;
  mitigation?: MitigationStrategy;
}

export type NoiseSourceType =
  | 'THERMAL'
  | 'ATMOSPHERIC'
  | 'GALACTIC'
  | 'SOLAR'
  | 'POWER_LINE'
  | 'SWITCHING'
  | 'DIGITAL'
  | 'IGNITION'
  | 'FLUORESCENT'
  | 'MICROWAVE'
  | 'UNKNOWN';

export interface GeographicLocation {
  latitude: number;
  longitude: number;
  distance: number; // km
  azimuth: number; // degrees
}

export interface MitigationStrategy {
  method: MitigationMethod;
  effectiveness: number; // dB reduction
  implemented: boolean;
  cost: number;
}

export type MitigationMethod =
  | 'FILTERING'
  | 'NULLING'
  | 'BLANKING'
  | 'SHIELDING'
  | 'RELOCATION'
  | 'TIME_GATING'
  | 'NONE';

export interface NoiseStatistics {
  measurementDuration: number; // seconds
  sampleCount: number;
  updateTimestamp: number;
  confidence: number;
  calibrationStatus: CalibrationStatus;
  temperatureCompensation: TemperatureCompensation;
}

export interface CalibrationStatus {
  lastCalibration: number; // timestamp
  calibrationSource: string;
  accuracy: number; // dB
  drift: number; // dB/hour
  nextCalibrationDue: number; // timestamp
}

export interface TemperatureCompensation {
  enabled: boolean;
  coefficient: number; // dB/°C
  referenceTemperature: number; // °C
  currentTemperature: number; // °C
  compensationApplied: number; // dB
}

export const DEFAULT_NOISE_PROFILE: NoiseProfile = {
  averageLevel: -100, // dBm
  variance: 0.5,
  distribution: {
    type: 'GAUSSIAN',
    parameters: {
      mean: -100,
      variance: 0.5
    },
    goodnessOfFit: 0.95
  },
  frequencyProfile: new Float32Array(0),
  temporalProfile: {
    shortTermVariance: 0.1,
    mediumTermVariance: 0.3,
    longTermVariance: 1.0,
    periodicComponents: [],
    impulsiveEvents: []
  },
  sources: [
    {
      type: 'THERMAL',
      frequency: 0,
      strength: -100,
      identification: 'Receiver thermal noise'
    }
  ],
  statistics: {
    measurementDuration: 0,
    sampleCount: 0,
    updateTimestamp: 0,
    confidence: 0,
    calibrationStatus: {
      lastCalibration: 0,
      calibrationSource: 'Factory',
      accuracy: 1.0,
      drift: 0.1,
      nextCalibrationDue: 0
    },
    temperatureCompensation: {
      enabled: false,
      coefficient: 0.02,
      referenceTemperature: 25,
      currentTemperature: 25,
      compensationApplied: 0
    }
  }
};