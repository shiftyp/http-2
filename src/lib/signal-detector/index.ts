/**
 * Signal Detector Library - Main Entry Point
 * Advanced signal detection and analysis for spectrum monitoring
 */

export { SNRCalculator } from './SNRCalculator.js';
export { PeakDetector } from './PeakDetector.js';
export { SignalClassifier } from './SignalClassifier.js';
export { ThresholdDetector } from './ThresholdDetector.js';

// Import for internal use
import { SNRCalculator } from './SNRCalculator.js';
import { PeakDetector } from './PeakDetector.js';
import { SignalClassifier } from './SignalClassifier.js';
import { ThresholdDetector } from './ThresholdDetector.js';

// Data Models
export type { SignalDetection } from './models/SignalDetection.js';
export type { SignalCharacteristics } from './models/SignalCharacteristics.js';
export type { DetectionParameters } from './models/DetectionParameters.js';

/**
 * Main Signal Detector Class
 * Identifies and characterizes signals in spectrum data
 */
export class SignalDetector {
  private snrCalculator: SNRCalculator;
  private peakDetector: PeakDetector;
  private signalClassifier: SignalClassifier;
  private thresholdDetector: ThresholdDetector;
  private isInitialized = false;

  constructor() {
    this.snrCalculator = new SNRCalculator();
    this.peakDetector = new PeakDetector();
    this.signalClassifier = new SignalClassifier();
    this.thresholdDetector = new ThresholdDetector();
  }

  /**
   * Initialize the signal detector
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.signalClassifier.initialize();
    this.isInitialized = true;
  }

  /**
   * Detect signals in spectrum data
   */
  async detectSignals(
    spectrum: Float32Array,
    frequencies: Float32Array,
    noiseFloor: number
  ): Promise<SignalDetection[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Find signal peaks above threshold
    const peaks = this.peakDetector.findPeaks(spectrum, {
      minHeight: noiseFloor + 6, // 6 dB above noise floor
      minDistance: 10, // Minimum separation between peaks
      prominence: 3   // Minimum prominence
    });

    const detections: SignalDetection[] = [];

    for (const peak of peaks) {
      // Calculate SNR
      const snr = this.snrCalculator.calculateSNR(
        spectrum,
        peak.index,
        noiseFloor
      );

      // Estimate signal bandwidth
      const bandwidth = this.estimateSignalBandwidth(
        spectrum,
        peak.index,
        noiseFloor
      );

      // Classify signal type
      const classification = await this.signalClassifier.classifySignal(
        spectrum.slice(peak.index - 50, peak.index + 50),
        frequencies[peak.index]
      );

      const detection: SignalDetection = {
        id: `signal-${Date.now()}-${peak.index}`,
        frequency: frequencies[peak.index],
        magnitude: spectrum[peak.index],
        snr,
        bandwidth,
        timestamp: Date.now(),
        confidence: classification.confidence,
        signalType: classification.type,
        characteristics: {
          centerFrequency: frequencies[peak.index],
          peakMagnitude: spectrum[peak.index],
          estimatedBandwidth: bandwidth,
          signalToNoiseRatio: snr,
          detectionThreshold: noiseFloor + 6,
          qualityScore: this.calculateQualityScore(snr, classification.confidence)
        }
      };

      detections.push(detection);
    }

    // Sort by signal strength
    return detections.sort((a, b) => b.magnitude - a.magnitude);
  }

  /**
   * Estimate signal bandwidth using -3dB method
   */
  private estimateSignalBandwidth(
    spectrum: Float32Array,
    peakIndex: number,
    noiseFloor: number
  ): number {
    const peakLevel = spectrum[peakIndex];
    const threshold = peakLevel - 3; // -3 dB from peak

    // Find left edge
    let leftEdge = peakIndex;
    while (leftEdge > 0 && spectrum[leftEdge] > threshold) {
      leftEdge--;
    }

    // Find right edge
    let rightEdge = peakIndex;
    while (rightEdge < spectrum.length - 1 && spectrum[rightEdge] > threshold) {
      rightEdge++;
    }

    // Convert bin difference to frequency bandwidth
    // This would need actual frequency spacing information
    const binWidth = 1; // Placeholder - should be sampleRate / fftSize
    return (rightEdge - leftEdge) * binWidth;
  }

  /**
   * Calculate overall signal quality score
   */
  private calculateQualityScore(snr: number, confidence: number): number {
    // Combine SNR and classification confidence
    const snrScore = Math.min(snr / 20, 1); // Normalize SNR (20 dB = 1.0)
    const combinedScore = (snrScore * 0.7) + (confidence * 0.3);
    return Math.min(Math.max(combinedScore, 0), 1);
  }

  /**
   * Set detection parameters
   */
  setDetectionParameters(params: Partial<DetectionParameters>): void {
    this.thresholdDetector.updateParameters(params);
    this.peakDetector.updateParameters(params);
  }

  /**
   * Get current detection statistics
   */
  getDetectionStatistics(): {
    totalDetections: number;
    averageSnr: number;
    strongSignals: number;
    weakSignals: number;
  } {
    // This would track statistics over time
    return {
      totalDetections: 0,
      averageSnr: 0,
      strongSignals: 0,
      weakSignals: 0
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}

/**
 * Signal detection configuration
 */
export interface SignalDetectionConfig {
  minSnr: number;
  minBandwidth: number;
  maxBandwidth: number;
  detectionThreshold: number;
  enableClassification: boolean;
  classificationModel: string;
}

export const DEFAULT_DETECTION_CONFIG: SignalDetectionConfig = {
  minSnr: 6, // dB
  minBandwidth: 100, // Hz
  maxBandwidth: 200000, // Hz
  detectionThreshold: -80, // dBm
  enableClassification: true,
  classificationModel: 'default'
};