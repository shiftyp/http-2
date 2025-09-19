/**
 * Spectrum Data Model
 * Represents processed spectrum analysis results
 */

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  phases: Float32Array;
  timestamp: number;
  centerFrequency: number;
  sampleRate: number;
  noiseFloor: number;
  peakPower: number;
  fftSize: number;
  processing?: ProcessingMetadata;
  calibration?: CalibrationData;
}

export interface ProcessingMetadata {
  windowFunction: WindowFunction;
  averagingFactor: number;
  overlapRatio: number;
  processingTime: number; // ms
  algorithm: string;
  version: string;
}

export type WindowFunction = 'HANN' | 'HAMMING' | 'BLACKMAN' | 'RECTANGULAR' | 'KAISER' | 'GAUSSIAN';

export interface CalibrationData {
  calibrationTimestamp: number;
  referenceLevel: number; // dBm
  frequencyCorrection: number; // Hz
  gainCorrection: Float32Array; // dB per bin
  phaseCorrection: Float32Array; // radians per bin
  temperatureAtCalibration: number; // °C
}

export interface SpectrumBand {
  name: string;
  startFrequency: number; // Hz
  endFrequency: number; // Hz
  allocation: BandAllocation;
  privileges: OperatingPrivileges;
}

export interface BandAllocation {
  primary: string[];
  secondary: string[];
  footnotes: string[];
  region: number; // ITU region
}

export interface OperatingPrivileges {
  cw: boolean;
  phone: boolean;
  digital: boolean;
  image: boolean;
  powerLimit: number; // watts
  bandwidthLimit: number; // Hz
}

export interface SpectrumMask {
  frequencies: Float32Array;
  limits: Float32Array; // dBm
  type: MaskType;
  regulation: string;
}

export type MaskType = 'EMISSION' | 'SPURIOUS' | 'OOB' | 'OCCUPIED_BANDWIDTH';

export const HAM_BANDS: SpectrumBand[] = [
  {
    name: '160m',
    startFrequency: 1800000,
    endFrequency: 2000000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: ['BROADCASTING'],
      footnotes: ['US1'],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: false,
      powerLimit: 1500,
      bandwidthLimit: 2800
    }
  },
  {
    name: '80m',
    startFrequency: 3500000,
    endFrequency: 4000000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: ['BROADCASTING'],
      footnotes: ['US3'],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: false,
      powerLimit: 1500,
      bandwidthLimit: 2800
    }
  },
  {
    name: '40m',
    startFrequency: 7000000,
    endFrequency: 7300000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: ['BROADCASTING'],
      footnotes: ['US7'],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: false,
      powerLimit: 1500,
      bandwidthLimit: 2800
    }
  },
  {
    name: '20m',
    startFrequency: 14000000,
    endFrequency: 14350000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: [],
      footnotes: [],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: false,
      powerLimit: 1500,
      bandwidthLimit: 2800
    }
  },
  {
    name: '15m',
    startFrequency: 21000000,
    endFrequency: 21450000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: [],
      footnotes: [],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: false,
      powerLimit: 1500,
      bandwidthLimit: 2800
    }
  },
  {
    name: '10m',
    startFrequency: 28000000,
    endFrequency: 29700000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: [],
      footnotes: [],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: false,
      powerLimit: 1500,
      bandwidthLimit: 2800
    }
  },
  {
    name: '2m',
    startFrequency: 144000000,
    endFrequency: 148000000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: [],
      footnotes: [],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: true,
      powerLimit: 1500,
      bandwidthLimit: 100000
    }
  },
  {
    name: '70cm',
    startFrequency: 420000000,
    endFrequency: 450000000,
    allocation: {
      primary: ['AMATEUR'],
      secondary: ['RADIOLOCATION'],
      footnotes: ['US431'],
      region: 2
    },
    privileges: {
      cw: true,
      phone: true,
      digital: true,
      image: true,
      powerLimit: 1500,
      bandwidthLimit: 100000
    }
  }
];