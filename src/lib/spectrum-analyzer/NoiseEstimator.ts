/**
 * Noise Estimator
 * Estimates noise floor and characterizes interference patterns
 */

import type { NoiseProfile } from './models/NoiseProfile.js';

export class NoiseEstimator {
  private isInitialized = false;
  private historySize = 100;
  private powerHistory: Float32Array[] = [];
  private currentProfile: NoiseProfile | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.powerHistory = [];
    this.currentProfile = this.createDefaultProfile();
    this.isInitialized = true;
  }

  private createDefaultProfile(): NoiseProfile {
    return {
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
        updateTimestamp: Date.now(),
        confidence: 0.5,
        calibrationStatus: {
          lastCalibration: Date.now(),
          calibrationSource: 'Factory',
          accuracy: 1.0,
          drift: 0.1,
          nextCalibrationDue: Date.now() + 86400000 // 24 hours
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
  }

  async estimateNoise(powerSpectrum: Float32Array): Promise<NoiseProfile> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Add to history
    this.addToHistory(powerSpectrum);

    // Calculate noise floor using percentile method
    const noiseFloor = this.calculateNoiseFloor(powerSpectrum);

    // Update noise profile
    this.updateNoiseProfile(powerSpectrum, noiseFloor);

    return this.currentProfile!;
  }

  private addToHistory(powerSpectrum: Float32Array): void {
    // Add new spectrum to history
    this.powerHistory.push(new Float32Array(powerSpectrum));

    // Maintain history size
    if (this.powerHistory.length > this.historySize) {
      this.powerHistory.shift();
    }
  }

  private calculateNoiseFloor(powerSpectrum: Float32Array): number {
    // Use 10th percentile as noise floor estimate
    const sorted = Array.from(powerSpectrum).sort((a, b) => a - b);
    const percentileIndex = Math.floor(sorted.length * 0.1);
    return sorted[percentileIndex];
  }

  private updateNoiseProfile(powerSpectrum: Float32Array, noiseFloor: number): void {
    if (!this.currentProfile) return;

    const alpha = 0.1; // Exponential averaging factor

    // Update average level
    this.currentProfile.averageLevel = this.currentProfile.averageLevel * (1 - alpha) + noiseFloor * alpha;

    // Calculate variance
    let variance = 0;
    for (let i = 0; i < powerSpectrum.length; i++) {
      const diff = powerSpectrum[i] - this.currentProfile.averageLevel;
      variance += diff * diff;
    }
    variance /= powerSpectrum.length;
    this.currentProfile.variance = this.currentProfile.variance * (1 - alpha) + variance * alpha;

    // Update frequency profile
    if (this.currentProfile.frequencyProfile.length !== powerSpectrum.length) {
      this.currentProfile.frequencyProfile = new Float32Array(powerSpectrum);
    } else {
      // Exponential averaging of frequency profile
      for (let i = 0; i < powerSpectrum.length; i++) {
        this.currentProfile.frequencyProfile[i] =
          this.currentProfile.frequencyProfile[i] * (1 - alpha) + powerSpectrum[i] * alpha;
      }
    }

    // Update temporal characteristics
    this.updateTemporalProfile(powerSpectrum);

    // Detect noise sources
    this.detectNoiseSources(powerSpectrum);

    // Update statistics
    this.updateStatistics();
  }

  private updateTemporalProfile(powerSpectrum: Float32Array): void {
    if (!this.currentProfile || this.powerHistory.length < 2) return;

    const current = powerSpectrum;
    const previous = this.powerHistory[this.powerHistory.length - 2];

    // Calculate short-term variance (frame-to-frame)
    let shortTermVar = 0;
    for (let i = 0; i < current.length; i++) {
      const diff = current[i] - previous[i];
      shortTermVar += diff * diff;
    }
    shortTermVar /= current.length;

    const alpha = 0.1;
    this.currentProfile.temporalProfile.shortTermVariance =
      this.currentProfile.temporalProfile.shortTermVariance * (1 - alpha) + shortTermVar * alpha;

    // Detect impulsive events
    if (shortTermVar > this.currentProfile.temporalProfile.shortTermVariance * 5) {
      this.currentProfile.temporalProfile.impulsiveEvents.push({
        timestamp: Date.now(),
        duration: 1, // Assume 1ms duration for single sample
        amplitude: Math.sqrt(shortTermVar),
        bandwidth: current.length // Full bandwidth
      });

      // Keep only recent events (last 10 seconds)
      const cutoffTime = Date.now() - 10000;
      this.currentProfile.temporalProfile.impulsiveEvents =
        this.currentProfile.temporalProfile.impulsiveEvents.filter(event => event.timestamp > cutoffTime);
    }
  }

  private detectNoiseSources(powerSpectrum: Float32Array): void {
    if (!this.currentProfile) return;

    // Reset detected sources
    this.currentProfile.sources = [
      {
        type: 'THERMAL',
        frequency: 0,
        strength: this.currentProfile.averageLevel,
        identification: 'Receiver thermal noise'
      }
    ];

    // Detect power line harmonics (60 Hz and harmonics)
    const powerLineFrequencies = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600];
    for (const freq of powerLineFrequencies) {
      // This would require frequency information to map bins to frequencies
      // For now, just add as a potential source
      if (Math.random() > 0.9) { // Placeholder detection logic
        this.currentProfile.sources.push({
          type: 'POWER_LINE',
          frequency: freq,
          strength: this.currentProfile.averageLevel + 10,
          identification: `Power line ${freq} Hz harmonic`
        });
      }
    }

    // Detect switching noise (broadband spikes)
    const maxPower = Math.max(...powerSpectrum);
    if (maxPower > this.currentProfile.averageLevel + 20) {
      this.currentProfile.sources.push({
        type: 'SWITCHING',
        frequency: 0, // Broadband
        strength: maxPower,
        identification: 'Switching power supply noise'
      });
    }

    // Detect digital noise (regular patterns)
    if (this.detectPeriodicPattern(powerSpectrum)) {
      this.currentProfile.sources.push({
        type: 'DIGITAL',
        frequency: 0, // Would calculate from pattern
        strength: this.currentProfile.averageLevel + 5,
        identification: 'Digital device interference'
      });
    }
  }

  private detectPeriodicPattern(powerSpectrum: Float32Array): boolean {
    // Simplified periodic pattern detection
    // Look for regular spikes in the spectrum
    const threshold = this.currentProfile!.averageLevel + 10;
    let spikeCount = 0;

    for (let i = 0; i < powerSpectrum.length; i++) {
      if (powerSpectrum[i] > threshold) {
        spikeCount++;
      }
    }

    // If more than 5% of bins are above threshold, consider it periodic
    return (spikeCount / powerSpectrum.length) > 0.05;
  }

  private updateStatistics(): void {
    if (!this.currentProfile) return;

    this.currentProfile.statistics.sampleCount++;
    this.currentProfile.statistics.updateTimestamp = Date.now();

    // Update confidence based on sample count
    const maxConfidence = 0.95;
    const samples = this.currentProfile.statistics.sampleCount;
    this.currentProfile.statistics.confidence = Math.min(maxConfidence, samples / 1000);

    // Update measurement duration
    const firstMeasurement = this.currentProfile.statistics.updateTimestamp - (samples - 1) * 33; // Assume 30 FPS
    this.currentProfile.statistics.measurementDuration = (Date.now() - firstMeasurement) / 1000;
  }

  getNoiseFloor(): number {
    return this.currentProfile?.averageLevel || -100;
  }

  getNoiseVariance(): number {
    return this.currentProfile?.variance || 0.5;
  }

  getConfidence(): number {
    return this.currentProfile?.statistics.confidence || 0;
  }

  async cleanup(): Promise<void> {
    this.powerHistory = [];
    this.currentProfile = null;
    this.isInitialized = false;
  }
}