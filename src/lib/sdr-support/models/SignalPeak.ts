/**
 * SignalPeak Model
 * Detected signal in spectrum data
 */

import { SignalType, SignalQuality } from './SpectrumData';

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

  /** Peak duration in seconds (if tracked over time) */
  duration?: number;

  /** Peak index in FFT data */
  fftIndex: number;

  /** Signal quality metrics */
  quality: SignalQuality;

  /** Additional analysis data */
  analysis?: SignalAnalysis;

  /** Tracking information */
  tracking?: SignalTracking;
}

export interface SignalAnalysis {
  /** Spectral characteristics */
  spectralFeatures: SpectralFeatures;

  /** Modulation analysis */
  modulation?: ModulationAnalysis;

  /** Signal classification confidence */
  classificationConfidence: number;

  /** Potential callsign (if detected) */
  detectedCallsign?: string;

  /** Content type (if decoded) */
  contentType?: ContentType;

  /** Decoded data (if available) */
  decodedData?: Uint8Array;

  /** Error correction status */
  errorCorrectionStatus?: ErrorCorrectionStatus;
}

export interface SpectralFeatures {
  /** Center frequency accuracy */
  centerFrequencyAccuracy: number;

  /** Bandwidth measurement accuracy */
  bandwidthAccuracy: number;

  /** Spectral purity (lack of spurious signals) */
  spectralPurity: number;

  /** Roll-off characteristics */
  rollOff: {
    leftSlope: number;   // dB/Hz
    rightSlope: number;  // dB/Hz
    asymmetry: number;   // Difference between slopes
  };

  /** Frequency stability over time */
  frequencyStability: number;

  /** Power stability over time */
  powerStability: number;

  /** Harmonic content */
  harmonicDistortion: number;

  /** Intermodulation products */
  intermodulationLevel: number;
}

export interface ModulationAnalysis {
  /** Detected modulation type */
  modulationType: ModulationType;

  /** Symbol rate (for digital signals) */
  symbolRate?: number;

  /** Deviation (for FM signals) in Hz */
  deviation?: number;

  /** Modulation index */
  modulationIndex?: number;

  /** Constellation diagram data (for digital) */
  constellation?: ConstellationPoint[];

  /** Eye diagram quality (for digital) */
  eyeDiagramQuality?: number;

  /** Carrier recovery quality */
  carrierRecoveryQuality?: number;

  /** Clock recovery quality */
  clockRecoveryQuality?: number;
}

export interface ConstellationPoint {
  /** In-phase component */
  i: number;

  /** Quadrature component */
  q: number;

  /** Symbol timestamp */
  timestamp: number;

  /** Error vector magnitude */
  evm: number;
}

export interface SignalTracking {
  /** Unique tracking ID */
  trackingId: string;

  /** First detection timestamp */
  firstDetected: Date;

  /** Last update timestamp */
  lastUpdated: Date;

  /** Signal start time */
  startTime?: Date;

  /** Signal end time */
  endTime?: Date;

  /** Total duration in seconds */
  totalDuration: number;

  /** Frequency history */
  frequencyHistory: Array<{
    timestamp: Date;
    frequency: number;
    drift: number; // Hz/s
  }>;

  /** Power history */
  powerHistory: Array<{
    timestamp: Date;
    power: number;
    trend: 'rising' | 'falling' | 'stable';
  }>;

  /** Detection count */
  detectionCount: number;

  /** Tracking confidence */
  trackingConfidence: number;

  /** Movement pattern */
  movementPattern?: MovementPattern;
}

export enum ModulationType {
  CW = 'CW',
  AM = 'AM',
  FM = 'FM',
  PM = 'PM',
  SSB_USB = 'SSB_USB',
  SSB_LSB = 'SSB_LSB',
  BPSK = 'BPSK',
  QPSK = 'QPSK',
  QAM16 = 'QAM16',
  QAM64 = 'QAM64',
  FSK = 'FSK',
  GMSK = 'GMSK',
  OFDM = 'OFDM',
  UNKNOWN = 'UNKNOWN'
}

export enum ContentType {
  VOICE = 'VOICE',
  DATA = 'DATA',
  CW_TEXT = 'CW_TEXT',
  DIGITAL_PROTOCOL = 'DIGITAL_PROTOCOL',
  HTTP_OVER_RADIO = 'HTTP_OVER_RADIO',
  MESH_PROTOCOL = 'MESH_PROTOCOL',
  EMERGENCY = 'EMERGENCY',
  BEACON = 'BEACON',
  TELEMETRY = 'TELEMETRY',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorCorrectionStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NO_ERRORS = 'NO_ERRORS',
  CORRECTED = 'CORRECTED',
  UNCORRECTABLE = 'UNCORRECTABLE',
  CHECKSUM_FAILED = 'CHECKSUM_FAILED'
}

export enum MovementPattern {
  STATIONARY = 'STATIONARY',
  DRIFTING_UP = 'DRIFTING_UP',
  DRIFTING_DOWN = 'DRIFTING_DOWN',
  OSCILLATING = 'OSCILLATING',
  JUMPING = 'JUMPING',
  IRREGULAR = 'IRREGULAR'
}

/**
 * Signal peak analysis utilities
 */
export class SignalPeakAnalyzer {
  /**
   * Analyzes a signal peak for detailed characteristics
   */
  static analyzeSignalPeak(
    peak: SignalPeak,
    fftData: Float32Array,
    sampleRate: number,
    centerFrequency: number,
    bandwidth: number
  ): SignalAnalysis {
    const spectralFeatures = this.analyzeSpectralFeatures(
      peak,
      fftData,
      sampleRate,
      centerFrequency,
      bandwidth
    );

    const modulation = this.analyzeModulation(peak, spectralFeatures);

    return {
      spectralFeatures,
      modulation,
      classificationConfidence: this.calculateClassificationConfidence(peak, spectralFeatures),
      detectedCallsign: this.extractCallsign(peak),
      contentType: this.classifyContent(peak, modulation),
      errorCorrectionStatus: ErrorCorrectionStatus.NOT_APPLICABLE
    };
  }

  /**
   * Analyzes spectral characteristics of a signal peak
   */
  private static analyzeSpectralFeatures(
    peak: SignalPeak,
    fftData: Float32Array,
    sampleRate: number,
    centerFrequency: number,
    bandwidth: number
  ): SpectralFeatures {
    const binWidth = bandwidth / fftData.length;
    const peakBin = peak.fftIndex;

    // Analyze roll-off characteristics
    const rollOff = this.analyzeRollOff(fftData, peakBin, binWidth);

    // Calculate spectral purity (ratio of main lobe to side lobes)
    const spectralPurity = this.calculateSpectralPurity(fftData, peakBin);

    return {
      centerFrequencyAccuracy: this.calculateFrequencyAccuracy(peak, fftData),
      bandwidthAccuracy: this.calculateBandwidthAccuracy(peak, fftData, binWidth),
      spectralPurity,
      rollOff,
      frequencyStability: 0.95, // Would be calculated from history
      powerStability: 0.90,     // Would be calculated from history
      harmonicDistortion: this.calculateHarmonicDistortion(fftData, peakBin),
      intermodulationLevel: this.calculateIntermodulationLevel(fftData, peakBin)
    };
  }

  /**
   * Analyzes roll-off characteristics around a peak
   */
  private static analyzeRollOff(
    fftData: Float32Array,
    peakBin: number,
    binWidth: number
  ): { leftSlope: number; rightSlope: number; asymmetry: number } {
    const peakValue = fftData[peakBin];
    const halfPower = peakValue / Math.sqrt(2);

    // Find left slope
    let leftBin = peakBin;
    while (leftBin > 0 && fftData[leftBin] > halfPower) {
      leftBin--;
    }

    let leftSlope = 0;
    if (leftBin < peakBin - 1) {
      const deltaFreq = (peakBin - leftBin) * binWidth;
      const deltaPower = 20 * Math.log10(peakValue / fftData[leftBin]);
      leftSlope = deltaPower / deltaFreq;
    }

    // Find right slope
    let rightBin = peakBin;
    while (rightBin < fftData.length - 1 && fftData[rightBin] > halfPower) {
      rightBin++;
    }

    let rightSlope = 0;
    if (rightBin > peakBin + 1) {
      const deltaFreq = (rightBin - peakBin) * binWidth;
      const deltaPower = 20 * Math.log10(peakValue / fftData[rightBin]);
      rightSlope = deltaPower / deltaFreq;
    }

    return {
      leftSlope,
      rightSlope,
      asymmetry: Math.abs(leftSlope - rightSlope)
    };
  }

  /**
   * Calculates spectral purity metric
   */
  private static calculateSpectralPurity(fftData: Float32Array, peakBin: number): number {
    const peakValue = fftData[peakBin];
    const windowSize = 10; // Look at ±10 bins around peak

    let mainLobeEnergy = 0;
    let totalEnergy = 0;

    // Calculate main lobe energy
    for (let i = Math.max(0, peakBin - windowSize);
         i <= Math.min(fftData.length - 1, peakBin + windowSize);
         i++) {
      mainLobeEnergy += fftData[i] * fftData[i];
    }

    // Calculate total energy
    for (let i = 0; i < fftData.length; i++) {
      totalEnergy += fftData[i] * fftData[i];
    }

    return totalEnergy > 0 ? mainLobeEnergy / totalEnergy : 0;
  }

  /**
   * Analyzes modulation characteristics
   */
  private static analyzeModulation(
    peak: SignalPeak,
    spectral: SpectralFeatures
  ): ModulationAnalysis {
    let modulationType = ModulationType.UNKNOWN;

    // Simple classification based on spectral characteristics
    if (peak.bandwidth < 100) {
      modulationType = ModulationType.CW;
    } else if (peak.bandwidth < 3000) {
      if (spectral.spectralPurity > 0.8) {
        modulationType = ModulationType.QPSK;
      } else {
        modulationType = ModulationType.BPSK;
      }
    } else if (peak.bandwidth < 15000) {
      if (spectral.rollOff.asymmetry < 0.1) {
        modulationType = ModulationType.FM;
      } else {
        modulationType = ModulationType.SSB_USB;
      }
    } else {
      modulationType = ModulationType.FM;
    }

    return {
      modulationType,
      symbolRate: this.estimateSymbolRate(peak, modulationType),
      deviation: this.estimateDeviation(peak, modulationType),
      modulationIndex: this.estimateModulationIndex(peak, modulationType),
      eyeDiagramQuality: 0.8, // Would require demodulated data
      carrierRecoveryQuality: 0.85,
      clockRecoveryQuality: 0.80
    };
  }

  /**
   * Estimates symbol rate for digital signals
   */
  private static estimateSymbolRate(peak: SignalPeak, modType: ModulationType): number | undefined {
    if (modType === ModulationType.QPSK || modType === ModulationType.BPSK) {
      // For QPSK/BPSK, symbol rate is roughly bandwidth / 2
      return peak.bandwidth / 2;
    }
    return undefined;
  }

  /**
   * Estimates frequency deviation for FM signals
   */
  private static estimateDeviation(peak: SignalPeak, modType: ModulationType): number | undefined {
    if (modType === ModulationType.FM) {
      // Carson's rule: BW = 2(deviation + max_modulating_freq)
      // Assuming 3kHz max modulating frequency for voice
      return (peak.bandwidth - 6000) / 2;
    }
    return undefined;
  }

  /**
   * Estimates modulation index
   */
  private static estimateModulationIndex(peak: SignalPeak, modType: ModulationType): number | undefined {
    if (modType === ModulationType.FM) {
      const deviation = this.estimateDeviation(peak, modType);
      if (deviation) {
        return deviation / 3000; // Assuming 3kHz max modulating frequency
      }
    }
    return undefined;
  }

  /**
   * Calculates classification confidence
   */
  private static calculateClassificationConfidence(
    peak: SignalPeak,
    spectral: SpectralFeatures
  ): number {
    let confidence = peak.confidence;

    // Boost confidence for strong signals
    if (peak.snr > 20) confidence *= 1.2;

    // Boost confidence for clean spectral characteristics
    if (spectral.spectralPurity > 0.8) confidence *= 1.1;

    // Reduce confidence for weak signals
    if (peak.snr < 6) confidence *= 0.8;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Attempts to extract callsign from signal characteristics
   */
  private static extractCallsign(peak: SignalPeak): string | undefined {
    // This would require actual demodulation and decoding
    // For now, return undefined
    return undefined;
  }

  /**
   * Classifies content type based on signal characteristics
   */
  private static classifyContent(
    peak: SignalPeak,
    modulation?: ModulationAnalysis
  ): ContentType {
    if (!modulation) return ContentType.UNKNOWN;

    switch (modulation.modulationType) {
      case ModulationType.CW:
        return ContentType.CW_TEXT;
      case ModulationType.QPSK:
      case ModulationType.BPSK:
        // Could be HTTP-over-radio or other digital protocol
        return peak.bandwidth > 2000 ? ContentType.HTTP_OVER_RADIO : ContentType.DIGITAL_PROTOCOL;
      case ModulationType.FM:
      case ModulationType.AM:
        return ContentType.VOICE;
      case ModulationType.SSB_USB:
      case ModulationType.SSB_LSB:
        return ContentType.VOICE;
      default:
        return ContentType.UNKNOWN;
    }
  }

  /**
   * Calculates frequency accuracy metric
   */
  private static calculateFrequencyAccuracy(peak: SignalPeak, fftData: Float32Array): number {
    // Use interpolation around peak to get sub-bin accuracy
    const peakBin = peak.fftIndex;

    if (peakBin > 0 && peakBin < fftData.length - 1) {
      const y1 = fftData[peakBin - 1];
      const y2 = fftData[peakBin];
      const y3 = fftData[peakBin + 1];

      // Parabolic interpolation
      const a = (y1 - 2 * y2 + y3) / 2;
      const b = (y3 - y1) / 2;

      if (Math.abs(a) > 1e-12) {
        const interpolatedOffset = -b / (2 * a);
        return Math.abs(interpolatedOffset) < 0.5 ? 1.0 - Math.abs(interpolatedOffset) : 0.5;
      }
    }

    return 0.8; // Default accuracy for exact bin match
  }

  /**
   * Calculates bandwidth measurement accuracy
   */
  private static calculateBandwidthAccuracy(
    peak: SignalPeak,
    fftData: Float32Array,
    binWidth: number
  ): number {
    // Accuracy depends on how well-defined the signal edges are
    const peakValue = fftData[peak.fftIndex];
    const halfPower = peakValue / Math.sqrt(2);

    let edgeSharpness = 0;
    let edgeCount = 0;

    // Check left edge
    for (let i = peak.fftIndex - 1; i >= 0; i--) {
      if (fftData[i] <= halfPower) {
        if (i < peak.fftIndex - 1) {
          const slope = (fftData[i + 1] - fftData[i]) / binWidth;
          edgeSharpness += Math.abs(slope);
          edgeCount++;
        }
        break;
      }
    }

    // Check right edge
    for (let i = peak.fftIndex + 1; i < fftData.length; i++) {
      if (fftData[i] <= halfPower) {
        if (i > peak.fftIndex + 1) {
          const slope = (fftData[i - 1] - fftData[i]) / binWidth;
          edgeSharpness += Math.abs(slope);
          edgeCount++;
        }
        break;
      }
    }

    // Normalize edge sharpness (sharper edges = better accuracy)
    const averageEdgeSharpness = edgeCount > 0 ? edgeSharpness / edgeCount : 0;
    return Math.min(1.0, averageEdgeSharpness / 1e6); // Scale factor may need adjustment
  }

  /**
   * Calculates harmonic distortion level
   */
  private static calculateHarmonicDistortion(fftData: Float32Array, peakBin: number): number {
    // Look for harmonics at 2x, 3x, 4x the fundamental frequency
    const fundamental = fftData[peakBin];
    let harmonicPower = 0;

    for (let harmonic = 2; harmonic <= 4; harmonic++) {
      const harmonicBin = peakBin * harmonic;
      if (harmonicBin < fftData.length) {
        harmonicPower += fftData[harmonicBin] * fftData[harmonicBin];
      }
    }

    const fundamentalPower = fundamental * fundamental;
    return fundamentalPower > 0 ? Math.sqrt(harmonicPower / fundamentalPower) : 0;
  }

  /**
   * Calculates intermodulation level
   */
  private static calculateIntermodulationLevel(fftData: Float32Array, peakBin: number): number {
    // Look for intermodulation products around the main signal
    const peakValue = fftData[peakBin];
    const windowSize = 20;
    let imProducts = 0;
    let count = 0;

    for (let i = Math.max(0, peakBin - windowSize);
         i <= Math.min(fftData.length - 1, peakBin + windowSize);
         i++) {
      if (i !== peakBin) {
        // Look for local maxima that could be IM products
        if (i > 0 && i < fftData.length - 1 &&
            fftData[i] > fftData[i - 1] && fftData[i] > fftData[i + 1]) {
          imProducts += fftData[i];
          count++;
        }
      }
    }

    return count > 0 ? (imProducts / count) / peakValue : 0;
  }
}

/**
 * Signal tracking utilities
 */
export class SignalTracker {
  private static trackingHistory: Map<string, SignalTracking> = new Map();

  /**
   * Updates tracking information for a signal peak
   */
  static updateTracking(peak: SignalPeak): SignalTracking {
    const trackingId = this.generateTrackingId(peak);
    const existing = this.trackingHistory.get(trackingId);
    const now = new Date();

    if (existing) {
      // Update existing tracking
      existing.lastUpdated = now;
      existing.detectionCount++;
      existing.totalDuration = (now.getTime() - existing.firstDetected.getTime()) / 1000;

      // Update frequency history
      existing.frequencyHistory.push({
        timestamp: now,
        frequency: peak.frequency,
        drift: this.calculateFrequencyDrift(existing.frequencyHistory, peak.frequency)
      });

      // Update power history
      existing.powerHistory.push({
        timestamp: now,
        power: peak.power,
        trend: this.calculatePowerTrend(existing.powerHistory, peak.power)
      });

      // Update tracking confidence
      existing.trackingConfidence = this.calculateTrackingConfidence(existing);

      // Analyze movement pattern
      existing.movementPattern = this.analyzeMovementPattern(existing);

      return existing;
    } else {
      // Create new tracking
      const tracking: SignalTracking = {
        trackingId,
        firstDetected: now,
        lastUpdated: now,
        totalDuration: 0,
        frequencyHistory: [{
          timestamp: now,
          frequency: peak.frequency,
          drift: 0
        }],
        powerHistory: [{
          timestamp: now,
          power: peak.power,
          trend: 'stable'
        }],
        detectionCount: 1,
        trackingConfidence: 0.5,
        movementPattern: MovementPattern.STATIONARY
      };

      this.trackingHistory.set(trackingId, tracking);
      return tracking;
    }
  }

  /**
   * Generates a unique tracking ID for a signal
   */
  private static generateTrackingId(peak: SignalPeak): string {
    // Create ID based on frequency and signal characteristics
    const freqMHz = Math.round(peak.frequency / 1000) / 1000; // Round to kHz
    const bwKHz = Math.round(peak.bandwidth / 100) / 10; // Round to 100Hz
    return `${freqMHz}-${bwKHz}-${peak.signalType}`;
  }

  /**
   * Calculates frequency drift rate
   */
  private static calculateFrequencyDrift(
    history: Array<{ timestamp: Date; frequency: number; drift: number }>,
    currentFreq: number
  ): number {
    if (history.length < 2) return 0;

    const lastEntry = history[history.length - 1];
    const timeDiff = (Date.now() - lastEntry.timestamp.getTime()) / 1000; // seconds
    const freqDiff = currentFreq - lastEntry.frequency;

    return timeDiff > 0 ? freqDiff / timeDiff : 0; // Hz/s
  }

  /**
   * Calculates power trend
   */
  private static calculatePowerTrend(
    history: Array<{ timestamp: Date; power: number; trend: string }>,
    currentPower: number
  ): 'rising' | 'falling' | 'stable' {
    if (history.length === 0) return 'stable';

    const lastPower = history[history.length - 1].power;
    const diff = currentPower - lastPower;

    if (Math.abs(diff) < 1.0) return 'stable'; // Less than 1dB change
    return diff > 0 ? 'rising' : 'falling';
  }

  /**
   * Calculates tracking confidence based on consistency
   */
  private static calculateTrackingConfidence(tracking: SignalTracking): number {
    let confidence = 0.5;

    // More detections = higher confidence
    confidence += Math.min(0.3, tracking.detectionCount * 0.05);

    // Consistent frequency = higher confidence
    const freqVariance = this.calculateFrequencyVariance(tracking.frequencyHistory);
    confidence += Math.max(0, 0.2 - freqVariance / 1000); // Less variance = higher confidence

    // Longer duration = higher confidence
    confidence += Math.min(0.2, tracking.totalDuration / 300); // Up to 5 minutes

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Calculates frequency variance for consistency measurement
   */
  private static calculateFrequencyVariance(
    history: Array<{ timestamp: Date; frequency: number; drift: number }>
  ): number {
    if (history.length < 2) return 0;

    const frequencies = history.map(h => h.frequency);
    const mean = frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
    const variance = frequencies.reduce((sum, freq) => sum + Math.pow(freq - mean, 2), 0) / frequencies.length;

    return Math.sqrt(variance);
  }

  /**
   * Analyzes movement pattern from tracking history
   */
  private static analyzeMovementPattern(tracking: SignalTracking): MovementPattern {
    if (tracking.frequencyHistory.length < 3) {
      return MovementPattern.STATIONARY;
    }

    const drifts = tracking.frequencyHistory.slice(-10).map(h => h.drift); // Last 10 measurements
    const avgDrift = drifts.reduce((sum, drift) => sum + drift, 0) / drifts.length;
    const driftVariance = drifts.reduce((sum, drift) => sum + Math.pow(drift - avgDrift, 2), 0) / drifts.length;

    if (Math.abs(avgDrift) < 0.1 && Math.sqrt(driftVariance) < 0.5) {
      return MovementPattern.STATIONARY;
    } else if (avgDrift > 1.0) {
      return MovementPattern.DRIFTING_UP;
    } else if (avgDrift < -1.0) {
      return MovementPattern.DRIFTING_DOWN;
    } else if (Math.sqrt(driftVariance) > 2.0) {
      return MovementPattern.IRREGULAR;
    } else {
      return MovementPattern.OSCILLATING;
    }
  }

  /**
   * Gets tracking history for a signal
   */
  static getTrackingHistory(trackingId: string): SignalTracking | undefined {
    return this.trackingHistory.get(trackingId);
  }

  /**
   * Cleans up old tracking entries
   */
  static cleanupOldTracking(maxAge: number = 3600): number {
    const cutoff = Date.now() - maxAge * 1000;
    let cleaned = 0;

    for (const [id, tracking] of this.trackingHistory.entries()) {
      if (tracking.lastUpdated.getTime() < cutoff) {
        this.trackingHistory.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export default SignalPeak;