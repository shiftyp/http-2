/**
 * Power Calculator
 * Calculates power spectrum from FFT results with calibration
 */

import type { FFTResult } from './models/FFTResult.js';

export class PowerCalculator {
  private calibrationGain = 0; // dB
  private referenceImpedance = 50; // ohms
  private isInitialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  computePowerSpectrum(fftResult: FFTResult): Float32Array {
    const { real, imaginary, size } = fftResult;
    const powerSpectrum = new Float32Array(size);

    // Calculate power spectral density
    for (let i = 0; i < size; i++) {
      const realPart = real[i];
      const imagPart = imaginary[i];

      // Calculate magnitude squared (power)
      const powerLinear = realPart * realPart + imagPart * imagPart;

      // Convert to dBm (assuming 50 ohm reference impedance)
      // P(dBm) = 10 * log10(P(watts) * 1000)
      // For FFT: scale by 1/N and apply window correction
      const scaledPower = powerLinear / (size * size);

      // Apply window correction (depends on window function)
      const windowCorrection = this.getWindowCorrection(fftResult.windowFunction);
      const correctedPower = scaledPower / windowCorrection;

      // Convert to dBm
      let powerDbm = 10 * Math.log10(Math.max(correctedPower, 1e-15)) + 30; // +30 to convert watts to milliwatts

      // Apply calibration
      powerDbm += this.calibrationGain;

      powerSpectrum[i] = powerDbm;
    }

    // Apply FFT shift (move DC to center)
    return this.fftShift(powerSpectrum);
  }

  private getWindowCorrection(windowFunction: string): number {
    // Window function correction factors
    switch (windowFunction) {
      case 'RECTANGULAR': return 1.0;
      case 'HANN': return 0.375; // Processing gain
      case 'HAMMING': return 0.397;
      case 'BLACKMAN': return 0.283;
      case 'KAISER': return 0.32; // Approximate for beta=8.6
      case 'GAUSSIAN': return 0.35;
      default: return 0.375; // Default to Hann
    }
  }

  private fftShift(spectrum: Float32Array): Float32Array {
    const size = spectrum.length;
    const shifted = new Float32Array(size);
    const half = Math.floor(size / 2);

    // Move second half to first half
    for (let i = 0; i < half; i++) {
      shifted[i] = spectrum[i + half];
    }

    // Move first half to second half
    for (let i = half; i < size; i++) {
      shifted[i] = spectrum[i - half];
    }

    return shifted;
  }

  computeInstantaneousPower(fftResult: FFTResult): number {
    const { real, imaginary, size } = fftResult;
    let totalPower = 0;

    for (let i = 0; i < size; i++) {
      totalPower += real[i] * real[i] + imaginary[i] * imaginary[i];
    }

    // Scale and convert to dBm
    const scaledPower = totalPower / (size * size);
    const windowCorrection = this.getWindowCorrection(fftResult.windowFunction);
    const correctedPower = scaledPower / windowCorrection;

    return 10 * Math.log10(Math.max(correctedPower, 1e-15)) + 30 + this.calibrationGain;
  }

  computeSpectralDensity(fftResult: FFTResult, sampleRate: number): Float32Array {
    const powerSpectrum = this.computePowerSpectrum(fftResult);
    const binWidth = sampleRate / fftResult.size;

    // Convert power to power spectral density (dBm/Hz)
    const psd = new Float32Array(powerSpectrum.length);
    const binWidthDb = 10 * Math.log10(binWidth);

    for (let i = 0; i < powerSpectrum.length; i++) {
      psd[i] = powerSpectrum[i] - binWidthDb;
    }

    return psd;
  }

  computeOccupiedBandwidth(powerSpectrum: Float32Array, percentage: number = 0.99): number {
    // Calculate occupied bandwidth containing specified percentage of power
    const totalPower = this.calculateTotalPower(powerSpectrum);
    const targetPower = totalPower * percentage;

    let accumulatedPower = 0;
    let startIndex = 0;
    let endIndex = powerSpectrum.length - 1;

    // Find center of mass
    const centerIndex = this.findCenterOfMass(powerSpectrum);

    // Expand outward from center until target power is reached
    let leftIndex = centerIndex;
    let rightIndex = centerIndex;

    while (accumulatedPower < targetPower && (leftIndex > 0 || rightIndex < powerSpectrum.length - 1)) {
      const leftPower = leftIndex > 0 ? this.dbmToLinear(powerSpectrum[leftIndex - 1]) : 0;
      const rightPower = rightIndex < powerSpectrum.length - 1 ? this.dbmToLinear(powerSpectrum[rightIndex + 1]) : 0;

      if (leftPower > rightPower && leftIndex > 0) {
        leftIndex--;
        accumulatedPower += leftPower;
      } else if (rightIndex < powerSpectrum.length - 1) {
        rightIndex++;
        accumulatedPower += rightPower;
      } else if (leftIndex > 0) {
        leftIndex--;
        accumulatedPower += leftPower;
      } else {
        break;
      }
    }

    return rightIndex - leftIndex + 1; // Return bandwidth in bins
  }

  private calculateTotalPower(powerSpectrum: Float32Array): number {
    let totalLinearPower = 0;
    for (let i = 0; i < powerSpectrum.length; i++) {
      totalLinearPower += this.dbmToLinear(powerSpectrum[i]);
    }
    return totalLinearPower;
  }

  private findCenterOfMass(powerSpectrum: Float32Array): number {
    let weightedSum = 0;
    let totalPower = 0;

    for (let i = 0; i < powerSpectrum.length; i++) {
      const linearPower = this.dbmToLinear(powerSpectrum[i]);
      weightedSum += i * linearPower;
      totalPower += linearPower;
    }

    return Math.round(weightedSum / totalPower);
  }

  private dbmToLinear(dbm: number): number {
    return Math.pow(10, (dbm - 30) / 10); // Convert dBm to watts
  }

  private linearToDbm(linear: number): number {
    return 10 * Math.log10(linear) + 30; // Convert watts to dBm
  }

  setCalibration(gainDb: number): void {
    this.calibrationGain = gainDb;
  }

  getCalibration(): number {
    return this.calibrationGain;
  }

  setReferenceImpedance(impedance: number): void {
    this.referenceImpedance = impedance;
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}