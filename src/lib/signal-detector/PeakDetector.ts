/**
 * Peak Detector
 * Detects spectral peaks using configurable algorithms
 */

import type { DetectionParameters } from './models/DetectionParameters.js';

export interface PeakDetectionResult {
  index: number;
  magnitude: number;
  prominence: number;
  width: number;
  leftBase: number;
  rightBase: number;
}

export class PeakDetector {
  private isInitialized = false;
  private parameters: DetectionParameters['analysis']['peakDetection'];

  constructor() {
    this.parameters = {
      minHeight: 6,
      minDistance: 10,
      prominence: 3,
      width: 2,
      maxPeaks: 50
    };
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  findPeaks(spectrum: Float32Array, options?: Partial<typeof this.parameters>): PeakDetectionResult[] {
    if (!this.isInitialized) return [];

    const params = { ...this.parameters, ...options };
    const peaks: PeakDetectionResult[] = [];

    // Find local maxima
    const localMaxima = this.findLocalMaxima(spectrum, params.minDistance);

    // Filter by height
    const heightFiltered = localMaxima.filter(peak =>
      spectrum[peak] >= params.minHeight
    );

    // Calculate prominence for each peak
    for (const peakIndex of heightFiltered) {
      const prominence = this.calculateProminence(spectrum, peakIndex);

      if (prominence >= params.prominence) {
        const width = this.calculateWidth(spectrum, peakIndex, params.width);
        const { leftBase, rightBase } = this.findPeakBases(spectrum, peakIndex);

        peaks.push({
          index: peakIndex,
          magnitude: spectrum[peakIndex],
          prominence,
          width,
          leftBase,
          rightBase
        });
      }
    }

    // Sort by magnitude (strongest first)
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    // Limit number of peaks
    return peaks.slice(0, params.maxPeaks);
  }

  private findLocalMaxima(spectrum: Float32Array, minDistance: number): number[] {
    const maxima: number[] = [];

    for (let i = 1; i < spectrum.length - 1; i++) {
      // Check if current point is a local maximum
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
        // Check minimum distance constraint
        const tooClose = maxima.some(existing =>
          Math.abs(existing - i) < minDistance
        );

        if (!tooClose) {
          maxima.push(i);
        } else {
          // If too close to existing peak, keep the stronger one
          const closeExisting = maxima.find(existing =>
            Math.abs(existing - i) < minDistance
          );

          if (closeExisting !== undefined && spectrum[i] > spectrum[closeExisting]) {
            const index = maxima.indexOf(closeExisting);
            maxima[index] = i;
          }
        }
      }
    }

    return maxima;
  }

  private calculateProminence(spectrum: Float32Array, peakIndex: number): number {
    const peakHeight = spectrum[peakIndex];

    // Find the highest point to the left
    let leftMax = -Infinity;
    for (let i = 0; i < peakIndex; i++) {
      leftMax = Math.max(leftMax, spectrum[i]);
    }

    // Find the highest point to the right
    let rightMax = -Infinity;
    for (let i = peakIndex + 1; i < spectrum.length; i++) {
      rightMax = Math.max(rightMax, spectrum[i]);
    }

    // Find the minimum saddle point
    const leftSaddle = this.findSaddlePoint(spectrum, 0, peakIndex, leftMax);
    const rightSaddle = this.findSaddlePoint(spectrum, peakIndex, spectrum.length, rightMax);

    // Prominence is the height above the higher saddle point
    const saddleHeight = Math.max(leftSaddle, rightSaddle);
    return peakHeight - saddleHeight;
  }

  private findSaddlePoint(spectrum: Float32Array, start: number, end: number, maxHeight: number): number {
    let minHeight = maxHeight;

    for (let i = start; i < end; i++) {
      minHeight = Math.min(minHeight, spectrum[i]);
    }

    return minHeight;
  }

  private calculateWidth(spectrum: Float32Array, peakIndex: number, relativeHeight: number): number {
    const peakHeight = spectrum[peakIndex];
    const targetHeight = peakHeight - relativeHeight;

    // Find left edge
    let leftEdge = peakIndex;
    while (leftEdge > 0 && spectrum[leftEdge] > targetHeight) {
      leftEdge--;
    }

    // Find right edge
    let rightEdge = peakIndex;
    while (rightEdge < spectrum.length - 1 && spectrum[rightEdge] > targetHeight) {
      rightEdge++;
    }

    return rightEdge - leftEdge;
  }

  private findPeakBases(spectrum: Float32Array, peakIndex: number): { leftBase: number; rightBase: number } {
    // Find left base (lowest point going left until another peak or edge)
    let leftBase = peakIndex;
    let leftMin = spectrum[peakIndex];

    for (let i = peakIndex - 1; i >= 0; i--) {
      if (spectrum[i] < leftMin) {
        leftMin = spectrum[i];
        leftBase = i;
      }

      // Stop if we encounter a rising trend (approaching another peak)
      if (i > 0 && spectrum[i] > spectrum[i - 1] && spectrum[i] > leftMin + 3) {
        break;
      }
    }

    // Find right base
    let rightBase = peakIndex;
    let rightMin = spectrum[peakIndex];

    for (let i = peakIndex + 1; i < spectrum.length; i++) {
      if (spectrum[i] < rightMin) {
        rightMin = spectrum[i];
        rightBase = i;
      }

      // Stop if we encounter a rising trend
      if (i < spectrum.length - 1 && spectrum[i] > spectrum[i + 1] && spectrum[i] > rightMin + 3) {
        break;
      }
    }

    return { leftBase, rightBase };
  }

  findZeroCrossings(signal: Float32Array): number[] {
    const crossings: number[] = [];

    for (let i = 1; i < signal.length; i++) {
      if ((signal[i - 1] >= 0 && signal[i] < 0) || (signal[i - 1] < 0 && signal[i] >= 0)) {
        crossings.push(i);
      }
    }

    return crossings;
  }

  findSpectralCentroid(spectrum: Float32Array, frequencies: Float32Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const magnitude = Math.pow(10, spectrum[i] / 20); // Convert dB to linear
      weightedSum += frequencies[i] * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  findSpectralRolloff(spectrum: Float32Array, frequencies: Float32Array, percentage: number = 0.85): number {
    // Find frequency below which specified percentage of spectral energy lies
    const linearSpectrum = spectrum.map(db => Math.pow(10, db / 20));
    const totalEnergy = linearSpectrum.reduce((sum, val) => sum + val * val, 0);
    const targetEnergy = totalEnergy * percentage;

    let accumulatedEnergy = 0;
    for (let i = 0; i < linearSpectrum.length; i++) {
      accumulatedEnergy += linearSpectrum[i] * linearSpectrum[i];
      if (accumulatedEnergy >= targetEnergy) {
        return frequencies[i];
      }
    }

    return frequencies[frequencies.length - 1];
  }

  updateParameters(params: Partial<DetectionParameters>): void {
    if (params.analysis?.peakDetection) {
      this.parameters = { ...this.parameters, ...params.analysis.peakDetection };
    }
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}