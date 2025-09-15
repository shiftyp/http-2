/**
 * FrequencyRange Model
 * Specific frequency band configuration for monitoring
 */

import { AmateurRadioBand, MonitoringPurpose } from './MonitoringConfiguration';

export interface FrequencyRange {
  /** Center frequency in Hz */
  centerFrequency: number;

  /** Monitoring bandwidth in Hz */
  bandwidth: number;

  /** Amateur radio band designation */
  band: AmateurRadioBand;

  /** Monitoring purpose */
  purpose: MonitoringPurpose;

  /** Enable automatic content decoding */
  decodingEnabled: boolean;

  /** Processing priority within device (1-10) */
  priority: number;

  /** Range-specific configuration */
  configuration?: FrequencyRangeConfiguration;

  /** Range statistics */
  statistics?: FrequencyRangeStatistics;
}

export interface FrequencyRangeConfiguration {
  /** FFT size for this range */
  fftSize?: number;

  /** Window function for spectrum analysis */
  windowFunction?: WindowFunction;

  /** Overlap percentage for FFT processing */
  overlapPercentage?: number;

  /** Gain setting specific to this range */
  gain?: number;

  /** Squelch threshold in dB */
  squelchThreshold?: number;

  /** Audio output enabled */
  audioOutput?: boolean;

  /** Recording enabled */
  recordingEnabled?: boolean;

  /** Maximum recording duration in seconds */
  maxRecordingDuration?: number;
}

export interface FrequencyRangeStatistics {
  /** Total monitoring time in seconds */
  totalMonitoringTime: number;

  /** Number of signals detected */
  signalsDetected: number;

  /** Number of successful decodes */
  successfulDecodes: number;

  /** Average signal strength in dB */
  averageSignalStrength: number;

  /** Average SNR in dB */
  averageSnr: number;

  /** Noise floor in dB */
  noiseFloor: number;

  /** Last activity timestamp */
  lastActivity?: Date;

  /** Most active callsigns */
  topCallsigns: Array<{
    callsign: string;
    transmissionCount: number;
    lastSeen: Date;
  }>;

  /** Band activity by hour */
  hourlyActivity: number[]; // 24 hours

  /** Content chunks discovered */
  chunksDiscovered: number;

  /** Cache hit rate for this range */
  cacheHitRate: number;
}

export enum WindowFunction {
  RECTANGULAR = 'rectangular',
  HAMMING = 'hamming',
  BLACKMAN = 'blackman',
  BLACKMAN_HARRIS = 'blackman_harris',
  KAISER = 'kaiser',
  HANN = 'hann'
}

/**
 * Frequency range validation and utilities
 */
export class FrequencyRangeValidator {
  /**
   * Validates a frequency range configuration
   */
  static validate(range: FrequencyRange): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (range.centerFrequency <= 0) {
      errors.push('Center frequency must be positive');
    }

    if (range.bandwidth <= 0) {
      errors.push('Bandwidth must be positive');
    }

    if (range.priority < 1 || range.priority > 10) {
      errors.push('Priority must be between 1 and 10');
    }

    // Validate frequency is within amateur radio bands
    if (!this.isValidAmateurFrequency(range.centerFrequency, range.band)) {
      errors.push(
        `Frequency ${range.centerFrequency} Hz is not valid for band ${range.band}`
      );
    }

    // Validate frequency doesn't exceed band boundaries
    const bandLimits = this.getBandLimits(range.band);
    if (bandLimits) {
      const minFreq = range.centerFrequency - range.bandwidth / 2;
      const maxFreq = range.centerFrequency + range.bandwidth / 2;

      if (minFreq < bandLimits.min) {
        errors.push(
          `Lower frequency ${minFreq} Hz exceeds ${range.band} band minimum ${bandLimits.min} Hz`
        );
      }

      if (maxFreq > bandLimits.max) {
        errors.push(
          `Upper frequency ${maxFreq} Hz exceeds ${range.band} band maximum ${bandLimits.max} Hz`
        );
      }
    }

    // Validate configuration if present
    if (range.configuration) {
      const configErrors = this.validateConfiguration(range.configuration);
      errors.push(...configErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates frequency range configuration
   */
  private static validateConfiguration(config: FrequencyRangeConfiguration): string[] {
    const errors: string[] = [];

    if (config.fftSize && !this.isPowerOfTwo(config.fftSize)) {
      errors.push('FFT size must be a power of 2');
    }

    if (config.fftSize && (config.fftSize < 64 || config.fftSize > 16384)) {
      errors.push('FFT size must be between 64 and 16384');
    }

    if (config.overlapPercentage && (config.overlapPercentage < 0 || config.overlapPercentage > 90)) {
      errors.push('Overlap percentage must be between 0 and 90');
    }

    if (config.gain && (config.gain < -10 || config.gain > 100)) {
      errors.push('Gain must be between -10 and 100 dB');
    }

    if (config.squelchThreshold && (config.squelchThreshold < -120 || config.squelchThreshold > 0)) {
      errors.push('Squelch threshold must be between -120 and 0 dB');
    }

    if (config.maxRecordingDuration && config.maxRecordingDuration <= 0) {
      errors.push('Maximum recording duration must be positive');
    }

    return errors;
  }

  /**
   * Checks if frequency is valid for the specified amateur radio band
   */
  private static isValidAmateurFrequency(frequency: number, band: AmateurRadioBand): boolean {
    const bandLimits = this.getBandLimits(band);
    return bandLimits ? frequency >= bandLimits.min && frequency <= bandLimits.max : false;
  }

  /**
   * Gets frequency limits for amateur radio bands
   */
  private static getBandLimits(band: AmateurRadioBand): { min: number; max: number } | null {
    const bandRanges = {
      [AmateurRadioBand.BAND_160M]: { min: 1800000, max: 2000000 },
      [AmateurRadioBand.BAND_80M]: { min: 3500000, max: 4000000 },
      [AmateurRadioBand.BAND_40M]: { min: 7000000, max: 7300000 },
      [AmateurRadioBand.BAND_30M]: { min: 10100000, max: 10150000 },
      [AmateurRadioBand.BAND_20M]: { min: 14000000, max: 14350000 },
      [AmateurRadioBand.BAND_17M]: { min: 18068000, max: 18168000 },
      [AmateurRadioBand.BAND_15M]: { min: 21000000, max: 21450000 },
      [AmateurRadioBand.BAND_12M]: { min: 24890000, max: 24990000 },
      [AmateurRadioBand.BAND_10M]: { min: 28000000, max: 29700000 },
      [AmateurRadioBand.BAND_6M]: { min: 50000000, max: 54000000 },
      [AmateurRadioBand.BAND_2M]: { min: 144000000, max: 148000000 },
      [AmateurRadioBand.BAND_70CM]: { min: 420000000, max: 450000000 }
    };

    return bandRanges[band] || null;
  }

  /**
   * Checks if a number is a power of 2
   */
  private static isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }
}

/**
 * Factory for creating frequency ranges
 */
export class FrequencyRangeFactory {
  /**
   * Creates emergency frequency ranges
   */
  static createEmergencyRanges(): FrequencyRange[] {
    return [
      {
        centerFrequency: 3873000,
        bandwidth: 10000,
        band: AmateurRadioBand.BAND_80M,
        purpose: MonitoringPurpose.EMERGENCY,
        decodingEnabled: true,
        priority: 10,
        configuration: {
          fftSize: 1024,
          windowFunction: WindowFunction.HAMMING,
          overlapPercentage: 50,
          squelchThreshold: -90,
          audioOutput: true,
          recordingEnabled: true,
          maxRecordingDuration: 3600
        }
      },
      {
        centerFrequency: 7040000,
        bandwidth: 10000,
        band: AmateurRadioBand.BAND_40M,
        purpose: MonitoringPurpose.EMERGENCY,
        decodingEnabled: true,
        priority: 10,
        configuration: {
          fftSize: 1024,
          windowFunction: WindowFunction.HAMMING,
          overlapPercentage: 50,
          squelchThreshold: -90,
          audioOutput: true,
          recordingEnabled: true,
          maxRecordingDuration: 3600
        }
      },
      {
        centerFrequency: 14300000,
        bandwidth: 10000,
        band: AmateurRadioBand.BAND_20M,
        purpose: MonitoringPurpose.EMERGENCY,
        decodingEnabled: true,
        priority: 10,
        configuration: {
          fftSize: 1024,
          windowFunction: WindowFunction.HAMMING,
          overlapPercentage: 50,
          squelchThreshold: -90,
          audioOutput: true,
          recordingEnabled: true,
          maxRecordingDuration: 3600
        }
      }
    ];
  }

  /**
   * Creates content discovery frequency ranges
   */
  static createContentDiscoveryRanges(): FrequencyRange[] {
    return [
      {
        centerFrequency: 7085000,
        bandwidth: 10000,
        band: AmateurRadioBand.BAND_40M,
        purpose: MonitoringPurpose.CONTENT_DISCOVERY,
        decodingEnabled: true,
        priority: 5,
        configuration: {
          fftSize: 2048,
          windowFunction: WindowFunction.BLACKMAN,
          overlapPercentage: 75,
          squelchThreshold: -95,
          audioOutput: false,
          recordingEnabled: false
        }
      },
      {
        centerFrequency: 14085000,
        bandwidth: 10000,
        band: AmateurRadioBand.BAND_20M,
        purpose: MonitoringPurpose.CONTENT_DISCOVERY,
        decodingEnabled: true,
        priority: 5,
        configuration: {
          fftSize: 2048,
          windowFunction: WindowFunction.BLACKMAN,
          overlapPercentage: 75,
          squelchThreshold: -95,
          audioOutput: false,
          recordingEnabled: false
        }
      }
    ];
  }

  /**
   * Creates mesh coordination frequency ranges
   */
  static createMeshCoordinationRanges(): FrequencyRange[] {
    return [
      {
        centerFrequency: 7035000,
        bandwidth: 5000,
        band: AmateurRadioBand.BAND_40M,
        purpose: MonitoringPurpose.MESH_COORDINATION,
        decodingEnabled: true,
        priority: 6,
        configuration: {
          fftSize: 1024,
          windowFunction: WindowFunction.HAMMING,
          overlapPercentage: 50,
          squelchThreshold: -85,
          audioOutput: false,
          recordingEnabled: false
        }
      },
      {
        centerFrequency: 14070000,
        bandwidth: 5000,
        band: AmateurRadioBand.BAND_20M,
        purpose: MonitoringPurpose.MESH_COORDINATION,
        decodingEnabled: true,
        priority: 6,
        configuration: {
          fftSize: 1024,
          windowFunction: WindowFunction.HAMMING,
          overlapPercentage: 50,
          squelchThreshold: -85,
          audioOutput: false,
          recordingEnabled: false
        }
      }
    ];
  }
}

/**
 * Utility functions for frequency ranges
 */
export class FrequencyRangeUtils {
  /**
   * Calculates the resolution bandwidth for a frequency range
   */
  static calculateResolutionBandwidth(range: FrequencyRange): number {
    const fftSize = range.configuration?.fftSize || 1024;
    const windowFunction = range.configuration?.windowFunction || WindowFunction.HAMMING;

    let windowCorrection = 1.0;
    switch (windowFunction) {
      case WindowFunction.HAMMING:
        windowCorrection = 1.36;
        break;
      case WindowFunction.BLACKMAN:
        windowCorrection = 1.73;
        break;
      case WindowFunction.BLACKMAN_HARRIS:
        windowCorrection = 1.97;
        break;
      case WindowFunction.KAISER:
        windowCorrection = 1.5; // Approximate, depends on beta
        break;
      case WindowFunction.HANN:
        windowCorrection = 1.5;
        break;
      case WindowFunction.RECTANGULAR:
      default:
        windowCorrection = 1.0;
        break;
    }

    return (range.bandwidth / fftSize) * windowCorrection;
  }

  /**
   * Checks if two frequency ranges overlap
   */
  static checkOverlap(range1: FrequencyRange, range2: FrequencyRange): boolean {
    const range1Min = range1.centerFrequency - range1.bandwidth / 2;
    const range1Max = range1.centerFrequency + range1.bandwidth / 2;
    const range2Min = range2.centerFrequency - range2.bandwidth / 2;
    const range2Max = range2.centerFrequency + range2.bandwidth / 2;

    return range1Min < range2Max && range1Max > range2Min;
  }

  /**
   * Calculates the overlap amount between two ranges
   */
  static calculateOverlapAmount(range1: FrequencyRange, range2: FrequencyRange): number {
    const range1Min = range1.centerFrequency - range1.bandwidth / 2;
    const range1Max = range1.centerFrequency + range1.bandwidth / 2;
    const range2Min = range2.centerFrequency - range2.bandwidth / 2;
    const range2Max = range2.centerFrequency + range2.bandwidth / 2;

    const overlapStart = Math.max(range1Min, range2Min);
    const overlapEnd = Math.min(range1Max, range2Max);

    return Math.max(0, overlapEnd - overlapStart);
  }

  /**
   * Optimizes frequency ranges to minimize overlap
   */
  static optimizeRanges(ranges: FrequencyRange[]): FrequencyRange[] {
    // Sort by priority (highest first), then by center frequency
    const sortedRanges = [...ranges].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.centerFrequency - b.centerFrequency;
    });

    const optimizedRanges: FrequencyRange[] = [];

    for (const range of sortedRanges) {
      let conflictFound = false;

      for (const existing of optimizedRanges) {
        if (this.checkOverlap(range, existing)) {
          // Higher priority range takes precedence
          if (range.priority > existing.priority) {
            // Remove the existing range and add the new one
            const index = optimizedRanges.indexOf(existing);
            optimizedRanges.splice(index, 1);
            optimizedRanges.push(range);
          }
          conflictFound = true;
          break;
        }
      }

      if (!conflictFound) {
        optimizedRanges.push(range);
      }
    }

    return optimizedRanges.sort((a, b) => a.centerFrequency - b.centerFrequency);
  }

  /**
   * Gets the optimal window function for a given purpose
   */
  static getOptimalWindowFunction(purpose: MonitoringPurpose): WindowFunction {
    switch (purpose) {
      case MonitoringPurpose.EMERGENCY:
        return WindowFunction.HAMMING; // Good balance of resolution and leakage
      case MonitoringPurpose.CONTENT_DISCOVERY:
        return WindowFunction.BLACKMAN; // Better sidelobe suppression
      case MonitoringPurpose.MESH_COORDINATION:
        return WindowFunction.HAMMING; // Good general purpose
      case MonitoringPurpose.EXPERIMENTATION:
        return WindowFunction.RECTANGULAR; // Highest resolution
      default:
        return WindowFunction.HAMMING;
    }
  }

  /**
   * Calculates effective noise bandwidth for a window function
   */
  static getEffectiveNoiseBandwidth(windowFunction: WindowFunction): number {
    switch (windowFunction) {
      case WindowFunction.RECTANGULAR:
        return 1.0;
      case WindowFunction.HAMMING:
        return 1.36;
      case WindowFunction.BLACKMAN:
        return 1.73;
      case WindowFunction.BLACKMAN_HARRIS:
        return 1.97;
      case WindowFunction.HANN:
        return 1.5;
      case WindowFunction.KAISER:
        return 1.5; // Approximate
      default:
        return 1.36; // Default to Hamming
    }
  }

  /**
   * Formats frequency range for display
   */
  static formatRange(range: FrequencyRange): string {
    const centerMHz = range.centerFrequency / 1000000;
    const bandwidthKHz = range.bandwidth / 1000;

    return `${centerMHz.toFixed(3)} MHz ±${(bandwidthKHz / 2).toFixed(1)} kHz (${range.band})`;
  }
}

export default FrequencyRange;