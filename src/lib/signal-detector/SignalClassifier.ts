/**
 * Signal Classifier
 * Classifies detected signals by modulation type and characteristics
 */

import type { ModulationType } from './models/SignalDetection.js';

export interface ClassificationResult {
  type: ModulationType;
  confidence: number;
  characteristics: SignalCharacteristics;
}

export interface SignalCharacteristics {
  bandwidth: number;
  symbolRate?: number;
  carrierOffset?: number;
  modulationIndex?: number;
  spectrumShape: string;
  temporalPattern: string;
}

export class SignalClassifier {
  private isInitialized = false;
  private models = new Map<string, any>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize expert system rules
    this.initializeExpertSystem();

    this.isInitialized = true;
  }

  private initializeExpertSystem(): void {
    // Simple rule-based classification system
    // In a real implementation, this would load trained ML models
    this.models.set('expert_rules', {
      classifyByBandwidth: (bandwidth: number): Partial<ClassificationResult> => {
        if (bandwidth < 50) return { type: 'CW', confidence: 0.8 };
        if (bandwidth < 500) return { type: 'PSK31', confidence: 0.7 };
        if (bandwidth < 3000) return { type: 'SSB', confidence: 0.6 };
        if (bandwidth < 6000) return { type: 'AM', confidence: 0.5 };
        if (bandwidth < 15000) return { type: 'FM', confidence: 0.4 };
        return { type: 'DIGITAL', confidence: 0.3 };
      },

      classifyBySpectralShape: (spectrum: Float32Array): Partial<ClassificationResult> => {
        const spectralFeatures = this.extractSpectralFeatures(spectrum);

        // CW - very narrow peak
        if (spectralFeatures.peakiness > 0.9 && spectralFeatures.bandwidth < 10) {
          return { type: 'CW', confidence: 0.9 };
        }

        // SSB - asymmetric spectrum
        if (spectralFeatures.asymmetry > 0.3 && spectralFeatures.bandwidth < 3000) {
          return { type: 'SSB', confidence: 0.8 };
        }

        // AM - symmetric with carrier
        if (Math.abs(spectralFeatures.asymmetry) < 0.1 && spectralFeatures.carrierPresent) {
          return { type: 'AM', confidence: 0.7 };
        }

        // FM - wider, symmetric
        if (spectralFeatures.bandwidth > 5000 && Math.abs(spectralFeatures.asymmetry) < 0.2) {
          return { type: 'FM', confidence: 0.6 };
        }

        // Digital - structured spectrum
        if (spectralFeatures.periodicity > 0.5) {
          return { type: 'DIGITAL', confidence: 0.5 };
        }

        return { type: 'UNKNOWN', confidence: 0.1 };
      }
    });
  }

  async classifySignal(spectrum: Float32Array, frequency: number): Promise<ClassificationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Extract features from spectrum
    const spectralFeatures = this.extractSpectralFeatures(spectrum);
    const bandwidth = this.estimateBandwidth(spectrum);

    // Apply expert system rules
    const expertRules = this.models.get('expert_rules');
    const bandwidthResult = expertRules.classifyByBandwidth(bandwidth);
    const spectralResult = expertRules.classifyBySpectralShape(spectrum);

    // Combine results with weighted confidence
    let finalType: ModulationType = 'UNKNOWN';
    let finalConfidence = 0;

    if (spectralResult.confidence && spectralResult.confidence > (bandwidthResult.confidence || 0)) {
      finalType = spectralResult.type || 'UNKNOWN';
      finalConfidence = spectralResult.confidence;
    } else if (bandwidthResult.confidence) {
      finalType = bandwidthResult.type || 'UNKNOWN';
      finalConfidence = bandwidthResult.confidence;
    }

    // Frequency-based adjustments
    finalConfidence = this.adjustConfidenceByFrequency(finalType, frequency, finalConfidence);

    // Apply additional heuristics
    const adjustedResult = this.applyHeuristics(finalType, spectralFeatures, finalConfidence);

    return {
      type: adjustedResult.type,
      confidence: Math.min(adjustedResult.confidence, 1.0),
      characteristics: {
        bandwidth,
        spectrumShape: this.describeSpectralShape(spectralFeatures),
        temporalPattern: 'CONTINUOUS', // Would require time-domain analysis
        symbolRate: this.estimateSymbolRate(finalType, bandwidth),
        carrierOffset: spectralFeatures.carrierOffset,
        modulationIndex: spectralFeatures.modulationIndex
      }
    };
  }

  private extractSpectralFeatures(spectrum: Float32Array): any {
    const features = {
      peakiness: 0,
      asymmetry: 0,
      bandwidth: 0,
      carrierPresent: false,
      periodicity: 0,
      carrierOffset: 0,
      modulationIndex: 0
    };

    // Find peak
    let peakIndex = 0;
    let peakValue = -Infinity;
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > peakValue) {
        peakValue = spectrum[i];
        peakIndex = i;
      }
    }

    // Calculate peakiness (ratio of peak to average)
    const average = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
    features.peakiness = (peakValue - average) / (peakValue + 1e-6);

    // Calculate asymmetry around peak
    const leftSum = spectrum.slice(0, peakIndex).reduce((sum, val) => sum + val, 0);
    const rightSum = spectrum.slice(peakIndex + 1).reduce((sum, val) => sum + val, 0);
    const leftAvg = leftSum / peakIndex;
    const rightAvg = rightSum / (spectrum.length - peakIndex - 1);
    features.asymmetry = (rightAvg - leftAvg) / (rightAvg + leftAvg + 1e-6);

    // Estimate bandwidth (3dB below peak)
    const threshold = peakValue - 3;
    let leftEdge = peakIndex;
    let rightEdge = peakIndex;

    while (leftEdge > 0 && spectrum[leftEdge] > threshold) leftEdge--;
    while (rightEdge < spectrum.length - 1 && spectrum[rightEdge] > threshold) rightEdge++;

    features.bandwidth = rightEdge - leftEdge;

    // Check for carrier presence (strong peak relative to sidebands)
    const sidebandsAvg = (leftAvg + rightAvg) / 2;
    features.carrierPresent = (peakValue - sidebandsAvg) > 6; // 6 dB above sidebands

    // Estimate carrier offset from center
    features.carrierOffset = peakIndex - spectrum.length / 2;

    // Simple periodicity check (for digital signals)
    features.periodicity = this.calculatePeriodicity(spectrum);

    return features;
  }

  private calculatePeriodicity(spectrum: Float32Array): number {
    // Look for regular patterns in the spectrum (simplified)
    let maxCorrelation = 0;

    for (let lag = 2; lag < spectrum.length / 4; lag++) {
      let correlation = 0;
      const samples = spectrum.length - lag;

      for (let i = 0; i < samples; i++) {
        correlation += spectrum[i] * spectrum[i + lag];
      }

      correlation /= samples;
      maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
    }

    return maxCorrelation / (spectrum.reduce((sum, val) => sum + val * val, 0) / spectrum.length);
  }

  private estimateBandwidth(spectrum: Float32Array): number {
    // Estimate occupied bandwidth (99% power containment)
    const linearSpectrum = spectrum.map(db => Math.pow(10, db / 10));
    const totalPower = linearSpectrum.reduce((sum, val) => sum + val, 0);
    const targetPower = totalPower * 0.99;

    // Find center of energy
    let weightedSum = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      weightedSum += i * linearSpectrum[i];
    }
    const centerIndex = Math.round(weightedSum / totalPower);

    // Expand from center until 99% power is captured
    let accumulatedPower = linearSpectrum[centerIndex];
    let leftIndex = centerIndex;
    let rightIndex = centerIndex;

    while (accumulatedPower < targetPower && (leftIndex > 0 || rightIndex < spectrum.length - 1)) {
      const leftPower = leftIndex > 0 ? linearSpectrum[leftIndex - 1] : 0;
      const rightPower = rightIndex < spectrum.length - 1 ? linearSpectrum[rightIndex + 1] : 0;

      if (leftPower > rightPower && leftIndex > 0) {
        leftIndex--;
        accumulatedPower += leftPower;
      } else if (rightIndex < spectrum.length - 1) {
        rightIndex++;
        accumulatedPower += rightPower;
      } else if (leftIndex > 0) {
        leftIndex--;
        accumulatedPower += leftPower;
      } else {
        break;
      }
    }

    return rightIndex - leftIndex + 1; // Return in bins
  }

  private adjustConfidenceByFrequency(type: ModulationType, frequency: number, confidence: number): number {
    // Adjust confidence based on typical frequency usage patterns
    const frequencyMHz = frequency / 1000000;

    switch (type) {
      case 'CW':
        // CW more common on HF bands
        if (frequencyMHz >= 3 && frequencyMHz <= 30) return confidence * 1.2;
        break;

      case 'SSB':
        // SSB very common on HF
        if (frequencyMHz >= 3 && frequencyMHz <= 30) return confidence * 1.3;
        break;

      case 'FM':
        // FM more common on VHF/UHF
        if (frequencyMHz >= 144 || (frequencyMHz >= 28 && frequencyMHz <= 29.7)) {
          return confidence * 1.2;
        }
        break;

      case 'DIGITAL':
        // Digital modes increasingly common across all bands
        return confidence * 1.1;
        break;
    }

    return confidence;
  }

  private applyHeuristics(type: ModulationType, features: any, confidence: number): ClassificationResult {
    // Apply additional classification heuristics

    // Very narrow bandwidth is almost certainly CW
    if (features.bandwidth < 3 && features.peakiness > 0.8) {
      return { type: 'CW', confidence: Math.max(confidence, 0.9), characteristics: {} as any };
    }

    // Strong carrier with symmetric sidebands suggests AM
    if (features.carrierPresent && Math.abs(features.asymmetry) < 0.1 && features.bandwidth < 6000) {
      return { type: 'AM', confidence: Math.max(confidence, 0.7), characteristics: {} as any };
    }

    // Asymmetric spectrum in voice bandwidth suggests SSB
    if (Math.abs(features.asymmetry) > 0.3 && features.bandwidth > 100 && features.bandwidth < 3000) {
      return { type: 'SSB', confidence: Math.max(confidence, 0.8), characteristics: {} as any };
    }

    return { type, confidence, characteristics: {} as any };
  }

  private describeSpectralShape(features: any): string {
    if (features.peakiness > 0.8) return 'NARROW_PEAK';
    if (Math.abs(features.asymmetry) > 0.3) return 'ASYMMETRIC';
    if (features.carrierPresent) return 'CARRIER_WITH_SIDEBANDS';
    if (features.periodicity > 0.5) return 'STRUCTURED';
    return 'BROADBAND';
  }

  private estimateSymbolRate(type: ModulationType, bandwidth: number): number | undefined {
    switch (type) {
      case 'PSK31':
        return 31.25; // baud
      case 'RTTY':
        return 45.45; // baud
      case 'FT8':
        return 6.25; // baud
      case 'FT4':
        return 20.83; // baud
      case 'DIGITAL':
        // Estimate based on bandwidth (rough approximation)
        return bandwidth * 0.8; // Conservative estimate
      default:
        return undefined;
    }
  }

  async cleanup(): Promise<void> {
    this.models.clear();
    this.isInitialized = false;
  }
}