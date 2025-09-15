/**
 * SDRCapabilities Model
 * Device-specific capabilities and limitations
 */

export interface SDRCapabilities {
  /** Minimum tunable frequency in Hz */
  minFrequency: number;

  /** Maximum tunable frequency in Hz */
  maxFrequency: number;

  /** Maximum simultaneous bandwidth in Hz */
  maxBandwidth: number;

  /** Supported sample rates in Hz */
  sampleRates: number[];

  /** Gain control range */
  gainRange: {
    min: number;
    max: number;
  };

  /** Device supports transmit capability */
  hasFullDuplex: boolean;

  /** Device has multiple receive channels */
  hasDiversityRx: boolean;

  /** Additional device-specific features */
  features?: SDRFeatures;
}

export interface SDRFeatures {
  /** Hardware-based frequency correction */
  hasFrequencyCorrection?: boolean;

  /** Built-in bias tee for LNA power */
  hasBiasTee?: boolean;

  /** Direct sampling mode support */
  hasDirectSampling?: boolean;

  /** Hardware AGC support */
  hasHardwareAGC?: boolean;

  /** Temperature compensation */
  hasTemperatureCompensation?: boolean;

  /** External reference clock input */
  hasExternalReference?: boolean;

  /** GPS disciplining support */
  hasGPSDisciplining?: boolean;

  /** Multiple antenna inputs */
  antennaInputs?: number;

  /** Supported tuner chips */
  tunerChips?: string[];

  /** USB interface version */
  usbVersion?: string;
}

/**
 * Pre-defined capabilities for known SDR devices
 */
export class SDRCapabilitiesPresets {
  /**
   * RTL-SDR (RTL2832U + R820T2) capabilities
   */
  static RTL_SDR: SDRCapabilities = {
    minFrequency: 24000000,      // 24 MHz
    maxFrequency: 1766000000,    // 1766 MHz
    maxBandwidth: 2400000,       // 2.4 MHz
    sampleRates: [
      250000,   // 250 kS/s
      1024000,  // 1.024 MS/s
      1536000,  // 1.536 MS/s
      1920000,  // 1.92 MS/s
      2048000,  // 2.048 MS/s
      2400000   // 2.4 MS/s
    ],
    gainRange: {
      min: 0,
      max: 49.6
    },
    hasFullDuplex: false,
    hasDiversityRx: false,
    features: {
      hasFrequencyCorrection: true,
      hasBiasTee: false,
      hasDirectSampling: true,
      hasHardwareAGC: true,
      antennaInputs: 1,
      tunerChips: ['R820T2', 'R828D', 'FC0013'],
      usbVersion: '2.0'
    }
  };

  /**
   * HackRF One capabilities
   */
  static HACKRF: SDRCapabilities = {
    minFrequency: 1000000,       // 1 MHz
    maxFrequency: 6000000000,    // 6 GHz
    maxBandwidth: 20000000,      // 20 MHz
    sampleRates: [
      2000000,   // 2 MS/s
      4000000,   // 4 MS/s
      8000000,   // 8 MS/s
      10000000,  // 10 MS/s
      15000000,  // 15 MS/s
      20000000   // 20 MS/s
    ],
    gainRange: {
      min: 0,
      max: 62
    },
    hasFullDuplex: true,
    hasDiversityRx: false,
    features: {
      hasFrequencyCorrection: false,
      hasBiasTee: false,
      hasDirectSampling: false,
      hasHardwareAGC: false,
      antennaInputs: 1,
      tunerChips: ['MAX2837'],
      usbVersion: '2.0'
    }
  };

  /**
   * LimeSDR capabilities
   */
  static LIMESDR: SDRCapabilities = {
    minFrequency: 100000,        // 100 kHz
    maxFrequency: 3800000000,    // 3.8 GHz
    maxBandwidth: 61440000,      // 61.44 MHz
    sampleRates: [
      2000000,   // 2 MS/s
      4000000,   // 4 MS/s
      8000000,   // 8 MS/s
      16000000,  // 16 MS/s
      32000000,  // 32 MS/s
      61440000   // 61.44 MS/s
    ],
    gainRange: {
      min: 0,
      max: 70
    },
    hasFullDuplex: true,
    hasDiversityRx: true,
    features: {
      hasFrequencyCorrection: true,
      hasBiasTee: false,
      hasDirectSampling: false,
      hasHardwareAGC: false,
      hasTemperatureCompensation: true,
      hasExternalReference: true,
      hasGPSDisciplining: false,
      antennaInputs: 2,
      tunerChips: ['LMS7002M'],
      usbVersion: '3.0'
    }
  };

  /**
   * PlutoSDR capabilities
   */
  static PLUTOSDR: SDRCapabilities = {
    minFrequency: 325000000,     // 325 MHz
    maxFrequency: 3800000000,    // 3.8 GHz
    maxBandwidth: 56000000,      // 56 MHz
    sampleRates: [
      520833,    // 520.833 kS/s
      1041667,   // 1.041667 MS/s
      2083333,   // 2.083333 MS/s
      4166667,   // 4.166667 MS/s
      8333333,   // 8.333333 MS/s
      16666667,  // 16.666667 MS/s
      33333333,  // 33.333333 MS/s
      56000000   // 56 MS/s
    ],
    gainRange: {
      min: 0,
      max: 77
    },
    hasFullDuplex: true,
    hasDiversityRx: false,
    features: {
      hasFrequencyCorrection: true,
      hasBiasTee: false,
      hasDirectSampling: false,
      hasHardwareAGC: true,
      hasTemperatureCompensation: true,
      hasExternalReference: true,
      hasGPSDisciplining: false,
      antennaInputs: 1,
      tunerChips: ['AD9363'],
      usbVersion: '2.0'
    }
  };

  /**
   * SDRplay RSP1A capabilities
   */
  static SDRPLAY: SDRCapabilities = {
    minFrequency: 1000,          // 1 kHz
    maxFrequency: 2000000000,    // 2 GHz
    maxBandwidth: 8000000,       // 8 MHz
    sampleRates: [
      250000,    // 250 kS/s
      500000,    // 500 kS/s
      1000000,   // 1 MS/s
      2000000,   // 2 MS/s
      4000000,   // 4 MS/s
      6000000,   // 6 MS/s
      8000000    // 8 MS/s
    ],
    gainRange: {
      min: 0,
      max: 59
    },
    hasFullDuplex: false,
    hasDiversityRx: false,
    features: {
      hasFrequencyCorrection: true,
      hasBiasTee: true,
      hasDirectSampling: false,
      hasHardwareAGC: true,
      hasTemperatureCompensation: false,
      hasExternalReference: false,
      antennaInputs: 1,
      tunerChips: ['MSi2500'],
      usbVersion: '2.0'
    }
  };

  /**
   * Gets capabilities for a specific device type
   */
  static getCapabilities(deviceType: string): SDRCapabilities {
    switch (deviceType.toUpperCase()) {
      case 'RTL_SDR':
        return { ...this.RTL_SDR };
      case 'HACKRF':
        return { ...this.HACKRF };
      case 'LIMESDR':
        return { ...this.LIMESDR };
      case 'PLUTOSDR':
        return { ...this.PLUTOSDR };
      case 'SDRPLAY':
        return { ...this.SDRPLAY };
      default:
        throw new Error(`Unknown SDR device type: ${deviceType}`);
    }
  }

  /**
   * Validates if capabilities are reasonable for the device type
   */
  static validateCapabilities(
    deviceType: string,
    capabilities: SDRCapabilities
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const reference = this.getCapabilities(deviceType);

    // Check frequency range
    if (capabilities.minFrequency > reference.minFrequency * 1.1) {
      warnings.push(
        `Minimum frequency ${capabilities.minFrequency} Hz seems high for ${deviceType}`
      );
    }

    if (capabilities.maxFrequency < reference.maxFrequency * 0.9) {
      warnings.push(
        `Maximum frequency ${capabilities.maxFrequency} Hz seems low for ${deviceType}`
      );
    }

    // Check bandwidth
    if (capabilities.maxBandwidth < reference.maxBandwidth * 0.8) {
      warnings.push(
        `Maximum bandwidth ${capabilities.maxBandwidth} Hz seems low for ${deviceType}`
      );
    }

    // Check sample rates
    const hasCommonRates = capabilities.sampleRates.some(rate =>
      reference.sampleRates.includes(rate)
    );
    if (!hasCommonRates) {
      warnings.push(`Sample rates don't match expected values for ${deviceType}`);
    }

    // Check gain range
    if (capabilities.gainRange.max < reference.gainRange.max * 0.8) {
      warnings.push(
        `Maximum gain ${capabilities.gainRange.max} dB seems low for ${deviceType}`
      );
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}

/**
 * Utility functions for SDR capabilities
 */
export class SDRCapabilitiesUtils {
  /**
   * Finds the best sample rate for a given bandwidth requirement
   */
  static findOptimalSampleRate(
    capabilities: SDRCapabilities,
    targetBandwidth: number,
    margin: number = 1.2
  ): number {
    const minRequiredRate = targetBandwidth * margin;

    const suitableRates = capabilities.sampleRates
      .filter(rate => rate >= minRequiredRate)
      .sort((a, b) => a - b);

    return suitableRates[0] || capabilities.sampleRates[capabilities.sampleRates.length - 1];
  }

  /**
   * Calculates the effective resolution bandwidth for a given configuration
   */
  static calculateResolutionBandwidth(
    sampleRate: number,
    fftSize: number,
    windowFunction: 'rectangular' | 'hamming' | 'blackman' = 'hamming'
  ): number {
    let windowCorrection = 1.0;

    switch (windowFunction) {
      case 'hamming':
        windowCorrection = 1.36;
        break;
      case 'blackman':
        windowCorrection = 1.73;
        break;
      case 'rectangular':
      default:
        windowCorrection = 1.0;
        break;
    }

    return (sampleRate / fftSize) * windowCorrection;
  }

  /**
   * Estimates the dynamic range for a given configuration
   */
  static estimateDynamicRange(
    capabilities: SDRCapabilities,
    sampleRate: number,
    gain: number
  ): number {
    // Base dynamic range depends on device type
    let baseDynamicRange = 50; // dB, conservative estimate

    if (capabilities.features?.tunerChips) {
      const tuner = capabilities.features.tunerChips[0];
      switch (tuner) {
        case 'R820T2':
        case 'R828D':
          baseDynamicRange = 55;
          break;
        case 'MAX2837':
          baseDynamicRange = 65;
          break;
        case 'LMS7002M':
          baseDynamicRange = 75;
          break;
        case 'AD9363':
          baseDynamicRange = 80;
          break;
        case 'MSi2500':
          baseDynamicRange = 60;
          break;
      }
    }

    // Adjust for sample rate (higher rates generally mean better dynamic range)
    const sampleRateBonus = Math.log10(sampleRate / 1000000) * 3; // +3dB per decade

    // Adjust for gain (moderate gain usually optimal)
    const optimalGain = (capabilities.gainRange.min + capabilities.gainRange.max) / 2;
    const gainPenalty = Math.abs(gain - optimalGain) * 0.1; // -0.1dB per dB from optimal

    return Math.max(30, baseDynamicRange + sampleRateBonus - gainPenalty);
  }

  /**
   * Checks if two capability sets are compatible for dual-device operation
   */
  static areCompatible(caps1: SDRCapabilities, caps2: SDRCapabilities): boolean {
    // Check for overlapping frequency ranges
    const freq1Range = { min: caps1.minFrequency, max: caps1.maxFrequency };
    const freq2Range = { min: caps2.minFrequency, max: caps2.maxFrequency };

    const freqOverlap = Math.max(0,
      Math.min(freq1Range.max, freq2Range.max) -
      Math.max(freq1Range.min, freq2Range.min)
    );

    // Check for common sample rates
    const commonSampleRates = caps1.sampleRates.filter(rate =>
      caps2.sampleRates.includes(rate)
    );

    return freqOverlap > 0 && commonSampleRates.length > 0;
  }

  /**
   * Merges capabilities for multi-device configurations
   */
  static mergCapabilities(capabilities: SDRCapabilities[]): SDRCapabilities {
    if (capabilities.length === 0) {
      throw new Error('At least one capability set required');
    }

    if (capabilities.length === 1) {
      return { ...capabilities[0] };
    }

    return {
      minFrequency: Math.min(...capabilities.map(c => c.minFrequency)),
      maxFrequency: Math.max(...capabilities.map(c => c.maxFrequency)),
      maxBandwidth: Math.max(...capabilities.map(c => c.maxBandwidth)),
      sampleRates: [...new Set(capabilities.flatMap(c => c.sampleRates))].sort((a, b) => a - b),
      gainRange: {
        min: Math.min(...capabilities.map(c => c.gainRange.min)),
        max: Math.max(...capabilities.map(c => c.gainRange.max))
      },
      hasFullDuplex: capabilities.some(c => c.hasFullDuplex),
      hasDiversityRx: capabilities.some(c => c.hasDiversityRx),
      features: {
        hasFrequencyCorrection: capabilities.some(c => c.features?.hasFrequencyCorrection),
        hasBiasTee: capabilities.some(c => c.features?.hasBiasTee),
        hasDirectSampling: capabilities.some(c => c.features?.hasDirectSampling),
        hasHardwareAGC: capabilities.some(c => c.features?.hasHardwareAGC),
        hasTemperatureCompensation: capabilities.some(c => c.features?.hasTemperatureCompensation),
        hasExternalReference: capabilities.some(c => c.features?.hasExternalReference),
        hasGPSDisciplining: capabilities.some(c => c.features?.hasGPSDisciplining),
        antennaInputs: capabilities.reduce((sum, c) => sum + (c.features?.antennaInputs || 1), 0),
        tunerChips: [...new Set(capabilities.flatMap(c => c.features?.tunerChips || []))],
        usbVersion: capabilities.map(c => c.features?.usbVersion).find(v => v === '3.0') || '2.0'
      }
    };
  }
}

export default SDRCapabilities;