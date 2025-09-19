/**
 * Threshold Detector
 * Adaptive threshold detection for signal presence
 */

import type { DetectionParameters } from './models/DetectionParameters.js';

export class ThresholdDetector {
  private isInitialized = false;
  private parameters: DetectionParameters['threshold'];
  private adaptiveThreshold = -90; // dBm
  private noiseHistory: number[] = [];
  private historySize = 100;

  constructor() {
    this.parameters = {
      snrThreshold: 6,
      magnitudeThreshold: -90,
      adaptiveThreshold: true,
      thresholdMargin: 3,
      noiseFloorTracking: true,
      falseAlarmRate: 0.01
    };
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  detect(spectrum: Float32Array, noiseFloor: number): boolean[] {
    if (!this.isInitialized) return new Array(spectrum.length).fill(false);

    const detections = new Array(spectrum.length).fill(false);

    // Update adaptive threshold
    if (this.parameters.adaptiveThreshold) {
      this.updateAdaptiveThreshold(spectrum, noiseFloor);
    }

    const effectiveThreshold = this.parameters.adaptiveThreshold
      ? this.adaptiveThreshold + this.parameters.thresholdMargin
      : this.parameters.magnitudeThreshold;

    // Apply threshold detection
    for (let i = 0; i < spectrum.length; i++) {
      detections[i] = spectrum[i] > effectiveThreshold;
    }

    // Apply SNR threshold if noise floor tracking is enabled
    if (this.parameters.noiseFloorTracking) {
      for (let i = 0; i < spectrum.length; i++) {
        if (detections[i]) {
          const snr = spectrum[i] - noiseFloor;
          if (snr < this.parameters.snrThreshold) {
            detections[i] = false;
          }
        }
      }
    }

    // Apply CFAR (Constant False Alarm Rate) if specified
    if (this.parameters.falseAlarmRate < 1.0) {
      this.applyCFAR(spectrum, detections, this.parameters.falseAlarmRate);
    }

    return detections;
  }

  private updateAdaptiveThreshold(spectrum: Float32Array, noiseFloor: number): void {
    // Update noise floor history
    this.noiseHistory.push(noiseFloor);
    if (this.noiseHistory.length > this.historySize) {
      this.noiseHistory.shift();
    }

    // Calculate adaptive threshold based on noise statistics
    if (this.noiseHistory.length > 10) {
      const mean = this.noiseHistory.reduce((sum, val) => sum + val, 0) / this.noiseHistory.length;
      const variance = this.noiseHistory.reduce((sum, val) => sum + (val - mean) ** 2, 0) / this.noiseHistory.length;
      const stdDev = Math.sqrt(variance);

      // Set threshold to mean + 2*sigma for ~97.7% confidence
      this.adaptiveThreshold = mean + 2 * stdDev;
    } else {
      // Fall back to current noise floor + margin
      this.adaptiveThreshold = noiseFloor + this.parameters.thresholdMargin;
    }
  }

  private applyCFAR(spectrum: Float32Array, detections: boolean[], targetFAR: number): void {
    // Constant False Alarm Rate detection
    // Calculate threshold that would give desired FAR

    // Count current detections
    const currentDetections = detections.filter(d => d).length;
    const currentFAR = currentDetections / spectrum.length;

    if (currentFAR > targetFAR) {
      // Too many false alarms, raise threshold
      const sortedSpectrum = Array.from(spectrum).sort((a, b) => b - a);
      const thresholdIndex = Math.floor(targetFAR * sortedSpectrum.length);
      const cfarThreshold = sortedSpectrum[thresholdIndex];

      // Apply stricter threshold
      for (let i = 0; i < spectrum.length; i++) {
        if (detections[i] && spectrum[i] < cfarThreshold) {
          detections[i] = false;
        }
      }
    }
  }

  detectEdges(spectrum: Float32Array): { rising: number[]; falling: number[] } {
    const rising: number[] = [];
    const falling: number[] = [];

    const threshold = this.adaptiveThreshold;

    for (let i = 1; i < spectrum.length; i++) {
      const prev = spectrum[i - 1];
      const curr = spectrum[i];

      // Rising edge: previous below threshold, current above
      if (prev <= threshold && curr > threshold) {
        rising.push(i);
      }

      // Falling edge: previous above threshold, current below
      if (prev > threshold && curr <= threshold) {
        falling.push(i);
      }
    }

    return { rising, falling };
  }

  detectBursts(spectrum: Float32Array, minDuration: number = 3): Array<{ start: number; end: number; peak: number }> {
    const detections = this.detect(spectrum, this.adaptiveThreshold - 10);
    const bursts: Array<{ start: number; end: number; peak: number }> = [];

    let burstStart = -1;
    let burstPeak = -Infinity;
    let burstPeakIndex = -1;

    for (let i = 0; i < detections.length; i++) {
      if (detections[i]) {
        if (burstStart === -1) {
          // Start of new burst
          burstStart = i;
          burstPeak = spectrum[i];
          burstPeakIndex = i;
        } else {
          // Continue burst, update peak if necessary
          if (spectrum[i] > burstPeak) {
            burstPeak = spectrum[i];
            burstPeakIndex = i;
          }
        }
      } else {
        if (burstStart !== -1) {
          // End of burst
          const duration = i - burstStart;
          if (duration >= minDuration) {
            bursts.push({
              start: burstStart,
              end: i - 1,
              peak: burstPeakIndex
            });
          }
          burstStart = -1;
        }
      }
    }

    // Handle burst that continues to end of spectrum
    if (burstStart !== -1) {
      const duration = spectrum.length - burstStart;
      if (duration >= minDuration) {
        bursts.push({
          start: burstStart,
          end: spectrum.length - 1,
          peak: burstPeakIndex
        });
      }
    }

    return bursts;
  }

  calculateDetectionStatistics(detections: boolean[]): {
    detectionRate: number;
    falseAlarmRate: number;
    threshold: number;
  } {
    const totalSamples = detections.length;
    const detectedSamples = detections.filter(d => d).length;

    return {
      detectionRate: detectedSamples / totalSamples,
      falseAlarmRate: this.parameters.falseAlarmRate, // Would be measured in practice
      threshold: this.adaptiveThreshold
    };
  }

  setThreshold(threshold: number): void {
    this.parameters.magnitudeThreshold = threshold;
    this.adaptiveThreshold = threshold;
  }

  getThreshold(): number {
    return this.parameters.adaptiveThreshold ? this.adaptiveThreshold : this.parameters.magnitudeThreshold;
  }

  updateParameters(params: Partial<DetectionParameters>): void {
    if (params.threshold) {
      this.parameters = { ...this.parameters, ...params.threshold };
    }
  }

  async cleanup(): Promise<void> {
    this.noiseHistory = [];
    this.isInitialized = false;
  }
}