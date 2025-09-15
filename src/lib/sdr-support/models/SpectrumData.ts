/**
 * SpectrumData Model
 * Real-time spectrum analysis data
 */

export interface SpectrumData {
  /** Source SDR device ID */
  deviceId: string;

  /** Center frequency in Hz */
  centerFrequency: number;

  /** Bandwidth in Hz */
  bandwidth: number;

  /** Data timestamp */
  timestamp: Date;

  /** FFT magnitude data (power spectrum) */
  fftData: Float32Array;

  /** Detected signal peaks */
  signalPeaks: SignalPeak[];

  /** Calculated noise floor in dB */
  noiseFloor: number;

  /** Average power across the spectrum in dB */
  averagePower: number;

  /** Maximum power in the spectrum in dB */
  maxPower: number;

  /** Spectrum analysis metadata */
  metadata: SpectrumMetadata;
}

export interface SignalPeak {
  /** Peak frequency in Hz */
  frequency: number;

  /** Peak power in dB */
  power: number;

  /** Estimated signal bandwidth in Hz */
  bandwidth: number;

  /** Signal-to-noise ratio in dB */
  snr: number;

  /** Detection confidence (0-1) */
  confidence: number;

  /** Detected signal type */
  signalType: SignalType;

  /** Peak duration in seconds */
  duration?: number;

  /** Peak index in FFT data */
  fftIndex: number;

  /** Quality metrics */
  quality: SignalQuality;
}

export interface SignalQuality {
  /** Signal-to-noise ratio in dB */
  snr: number;

  /** Received signal strength indicator in dB */
  rssi: number;

  /** Actual received frequency in Hz */
  frequency: number;

  /** Frequency offset from expected in Hz */
  frequencyOffset?: number;

  /** Symbol error rate (0-1) */
  symbolErrorRate?: number;

  /** Phase jitter in degrees */
  phaseJitter?: number;

  /** Signal stability metric (0-1) */
  stability?: number;
}

export interface SpectrumMetadata {
  /** FFT size used for analysis */
  fftSize: number;

  /** Window function applied */
  windowFunction: string;

  /** Overlap percentage */
  overlapPercentage: number;

  /** Sample rate in Hz */
  sampleRate: number;

  /** Resolution bandwidth in Hz */
  resolutionBandwidth: number;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Number of averages */
  averageCount: number;

  /** Calibration applied */
  calibrated: boolean;

  /** Temperature compensation applied */
  temperatureCompensated: boolean;
}

export enum SignalType {
  QPSK = 'QPSK',
  BPSK = 'BPSK',
  FSK = 'FSK',
  CW = 'CW',
  FM = 'FM',
  AM = 'AM',
  SSB_USB = 'SSB_USB',
  SSB_LSB = 'SSB_LSB',
  DIGITAL = 'DIGITAL',
  NOISE = 'NOISE',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Spectrum data processing utilities
 */
export class SpectrumDataProcessor {
  /**
   * Converts linear power values to dB
   */
  static linearToDb(linearValue: number, referenceLevel: number = 1.0): number {
    return 20 * Math.log10(Math.max(linearValue, 1e-12) / referenceLevel);
  }

  /**
   * Converts dB values to linear power
   */
  static dbToLinear(dbValue: number, referenceLevel: number = 1.0): number {
    return referenceLevel * Math.pow(10, dbValue / 20);
  }

  /**
   * Calculates noise floor from spectrum data
   */
  static calculateNoiseFloor(fftData: Float32Array, percentile: number = 10): number {
    const sortedData = Array.from(fftData).sort((a, b) => a - b);
    const index = Math.floor(sortedData.length * percentile / 100);
    return this.linearToDb(sortedData[index]);
  }

  /**
   * Detects signal peaks in spectrum data
   */
  static detectPeaks(
    fftData: Float32Array,
    noiseFloor: number,
    centerFrequency: number,
    bandwidth: number,
    threshold: number = 10 // dB above noise floor
  ): SignalPeak[] {
    const peaks: SignalPeak[] = [];
    const binWidth = bandwidth / fftData.length;
    const startFreq = centerFrequency - bandwidth / 2;

    // Convert threshold to linear
    const noiseFloorLinear = this.dbToLinear(noiseFloor);
    const thresholdLinear = this.dbToLinear(noiseFloor + threshold);

    for (let i = 1; i < fftData.length - 1; i++) {
      const current = fftData[i];
      const prev = fftData[i - 1];
      const next = fftData[i + 1];

      // Check if this is a local maximum above threshold
      if (current > prev && current > next && current > thresholdLinear) {
        const frequency = startFreq + i * binWidth;
        const powerDb = this.linearToDb(current);
        const snr = powerDb - noiseFloor;

        // Estimate signal bandwidth by finding -3dB points
        const estimatedBandwidth = this.estimateSignalBandwidth(fftData, i, current, binWidth);

        // Classify signal type based on characteristics
        const signalType = this.classifySignalType(fftData, i, estimatedBandwidth, binWidth);

        // Calculate confidence based on SNR and peak sharpness
        const confidence = Math.min(1.0, Math.max(0.0, (snr - 3) / 20));

        const peak: SignalPeak = {
          frequency,
          power: powerDb,
          bandwidth: estimatedBandwidth,
          snr,
          confidence,
          signalType,
          fftIndex: i,
          quality: {
            snr,
            rssi: powerDb,
            frequency,
            stability: this.calculateStability(fftData, i)
          }
        };

        peaks.push(peak);
      }
    }

    // Sort peaks by power (strongest first)
    return peaks.sort((a, b) => b.power - a.power);
  }

  /**
   * Estimates signal bandwidth from peak data
   */
  private static estimateSignalBandwidth(
    fftData: Float32Array,
    peakIndex: number,
    peakValue: number,
    binWidth: number
  ): number {
    const halfPower = peakValue / Math.sqrt(2); // -3dB point

    // Find left -3dB point
    let leftIndex = peakIndex;
    while (leftIndex > 0 && fftData[leftIndex] > halfPower) {
      leftIndex--;
    }

    // Find right -3dB point
    let rightIndex = peakIndex;
    while (rightIndex < fftData.length - 1 && fftData[rightIndex] > halfPower) {
      rightIndex++;
    }

    return (rightIndex - leftIndex) * binWidth;
  }

  /**
   * Classifies signal type based on spectral characteristics
   */
  private static classifySignalType(
    fftData: Float32Array,
    peakIndex: number,
    bandwidth: number,
    binWidth: number
  ): SignalType {
    // Simple classification based on bandwidth and shape
    const binsInBandwidth = Math.round(bandwidth / binWidth);

    if (binsInBandwidth <= 1) {
      return SignalType.CW;
    } else if (binsInBandwidth <= 10) {
      // Narrow bandwidth - likely digital
      if (this.hasSymmetricSpectrum(fftData, peakIndex, binsInBandwidth)) {
        return SignalType.QPSK;
      } else {
        return SignalType.DIGITAL;
      }
    } else if (binsInBandwidth <= 50) {
      // Medium bandwidth - could be SSB or narrow FM
      return SignalType.SSB_USB; // Default assumption
    } else {
      // Wide bandwidth - likely FM
      return SignalType.FM;
    }
  }

  /**
   * Checks if spectrum around peak is symmetric (indicates QPSK/BPSK)
   */
  private static hasSymmetricSpectrum(
    fftData: Float32Array,
    peakIndex: number,
    bandwidthBins: number
  ): boolean {
    const halfBandwidth = Math.floor(bandwidthBins / 2);
    let symmetryScore = 0;

    for (let i = 1; i <= halfBandwidth; i++) {
      const leftIndex = peakIndex - i;
      const rightIndex = peakIndex + i;

      if (leftIndex >= 0 && rightIndex < fftData.length) {
        const leftValue = fftData[leftIndex];
        const rightValue = fftData[rightIndex];
        const difference = Math.abs(leftValue - rightValue);
        const average = (leftValue + rightValue) / 2;

        if (average > 0) {
          symmetryScore += 1 - (difference / average);
        }
      }
    }

    return symmetryScore / halfBandwidth > 0.7; // 70% symmetry threshold
  }

  /**
   * Calculates signal stability metric
   */
  private static calculateStability(fftData: Float32Array, peakIndex: number): number {
    // Calculate local variance around the peak
    const windowSize = 5;
    const start = Math.max(0, peakIndex - windowSize);
    const end = Math.min(fftData.length, peakIndex + windowSize + 1);

    let sum = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      sum += fftData[i];
      count++;
    }

    const mean = sum / count;
    let variance = 0;

    for (let i = start; i < end; i++) {
      variance += Math.pow(fftData[i] - mean, 2);
    }

    variance /= count;
    const coefficient = Math.sqrt(variance) / mean;

    // Return stability as 1 - coefficient of variation (clamped 0-1)
    return Math.max(0, Math.min(1, 1 - coefficient));
  }

  /**
   * Applies spectral averaging to reduce noise
   */
  static applySpectralAveraging(
    spectrumHistory: SpectrumData[],
    averageCount: number
  ): Float32Array | null {
    if (spectrumHistory.length === 0) return null;

    const recentSpectra = spectrumHistory.slice(-averageCount);
    const fftSize = recentSpectra[0].fftData.length;
    const averaged = new Float32Array(fftSize);

    // Verify all spectra have the same size
    if (recentSpectra.some(spectrum => spectrum.fftData.length !== fftSize)) {
      throw new Error('All spectra must have the same FFT size for averaging');
    }

    // Average the FFT data
    for (let bin = 0; bin < fftSize; bin++) {
      let sum = 0;
      for (const spectrum of recentSpectra) {
        sum += spectrum.fftData[bin];
      }
      averaged[bin] = sum / recentSpectra.length;
    }

    return averaged;
  }

  /**
   * Validates spectrum data integrity
   */
  static validateSpectrumData(data: SpectrumData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.deviceId) {
      errors.push('Device ID is required');
    }

    if (data.centerFrequency <= 0) {
      errors.push('Center frequency must be positive');
    }

    if (data.bandwidth <= 0) {
      errors.push('Bandwidth must be positive');
    }

    if (!data.fftData || data.fftData.length === 0) {
      errors.push('FFT data is required');
    }

    if (data.fftData && data.fftData.some(value => isNaN(value) || !isFinite(value))) {
      errors.push('FFT data contains invalid values');
    }

    if (!data.timestamp || isNaN(data.timestamp.getTime())) {
      errors.push('Valid timestamp is required');
    }

    // Check if timestamp is too old (more than 10 seconds)
    const age = Date.now() - data.timestamp.getTime();
    if (age > 10000) {
      errors.push(`Spectrum data is too old: ${age}ms`);
    }

    if (!data.metadata) {
      errors.push('Metadata is required');
    }

    if (data.metadata && data.metadata.fftSize !== data.fftData.length) {
      errors.push('FFT size mismatch between metadata and data');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Spectrum data factory for creating test data and examples
 */
export class SpectrumDataFactory {
  /**
   * Creates sample spectrum data for testing
   */
  static createSampleData(
    deviceId: string,
    centerFrequency: number,
    bandwidth: number,
    signalCount: number = 3
  ): SpectrumData {
    const fftSize = 1024;
    const fftData = new Float32Array(fftSize);

    // Generate noise floor
    const noiseFloor = 1e-8; // -80 dB
    for (let i = 0; i < fftSize; i++) {
      fftData[i] = noiseFloor * (0.5 + Math.random());
    }

    // Add simulated signals
    const signals: SignalPeak[] = [];
    for (let s = 0; s < signalCount; s++) {
      const signalFreq = centerFrequency + (Math.random() - 0.5) * bandwidth * 0.8;
      const signalPower = Math.pow(10, (-60 + Math.random() * 40) / 20); // -60 to -20 dB
      const signalBandwidth = 1000 + Math.random() * 5000; // 1-6 kHz

      const binIndex = Math.round((signalFreq - centerFrequency + bandwidth / 2) / bandwidth * fftSize);
      const signalBins = Math.round(signalBandwidth / bandwidth * fftSize);

      // Add signal to spectrum
      for (let i = 0; i < signalBins; i++) {
        const idx = binIndex - Math.floor(signalBins / 2) + i;
        if (idx >= 0 && idx < fftSize) {
          const window = 0.5 + 0.5 * Math.cos(2 * Math.PI * i / signalBins);
          fftData[idx] += signalPower * window;
        }
      }

      signals.push({
        frequency: signalFreq,
        power: SpectrumDataProcessor.linearToDb(signalPower),
        bandwidth: signalBandwidth,
        snr: SpectrumDataProcessor.linearToDb(signalPower) - SpectrumDataProcessor.linearToDb(noiseFloor),
        confidence: 0.8 + Math.random() * 0.2,
        signalType: [SignalType.QPSK, SignalType.CW, SignalType.FM][s % 3],
        fftIndex: binIndex,
        quality: {
          snr: SpectrumDataProcessor.linearToDb(signalPower) - SpectrumDataProcessor.linearToDb(noiseFloor),
          rssi: SpectrumDataProcessor.linearToDb(signalPower),
          frequency: signalFreq,
          stability: 0.8 + Math.random() * 0.2
        }
      });
    }

    const calculatedNoiseFloor = SpectrumDataProcessor.calculateNoiseFloor(fftData);
    const averagePower = SpectrumDataProcessor.linearToDb(
      fftData.reduce((sum, val) => sum + val, 0) / fftData.length
    );
    const maxPower = SpectrumDataProcessor.linearToDb(Math.max(...fftData));

    return {
      deviceId,
      centerFrequency,
      bandwidth,
      timestamp: new Date(),
      fftData,
      signalPeaks: signals,
      noiseFloor: calculatedNoiseFloor,
      averagePower,
      maxPower,
      metadata: {
        fftSize,
        windowFunction: 'hamming',
        overlapPercentage: 50,
        sampleRate: bandwidth * 2,
        resolutionBandwidth: bandwidth / fftSize,
        processingTime: 5 + Math.random() * 10,
        averageCount: 1,
        calibrated: true,
        temperatureCompensated: false
      }
    };
  }
}

export default SpectrumData;