/**
 * SNR Calculator
 * Calculates signal-to-noise ratio for detected signals
 */

export class SNRCalculator {
  private isInitialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  calculateSNR(spectrum: Float32Array, signalIndex: number, noiseFloor: number): number {
    if (!this.isInitialized || signalIndex < 0 || signalIndex >= spectrum.length) {
      return 0;
    }

    const signalPower = spectrum[signalIndex];

    // Calculate local noise floor around the signal
    const localNoiseFloor = this.calculateLocalNoiseFloor(spectrum, signalIndex);

    // Use the higher of global and local noise floor
    const effectiveNoiseFloor = Math.max(noiseFloor, localNoiseFloor);

    // SNR in dB
    return signalPower - effectiveNoiseFloor;
  }

  private calculateLocalNoiseFloor(spectrum: Float32Array, signalIndex: number, windowSize: number = 20): number {
    const start = Math.max(0, signalIndex - windowSize);
    const end = Math.min(spectrum.length, signalIndex + windowSize);

    // Collect noise samples (excluding the signal peak area)
    const noiseSamples: number[] = [];

    for (let i = start; i < end; i++) {
      // Skip area around the signal peak
      if (Math.abs(i - signalIndex) > 3) {
        noiseSamples.push(spectrum[i]);
      }
    }

    if (noiseSamples.length === 0) {
      return -120; // Default very low noise floor
    }

    // Use median as noise floor estimate (robust against outliers)
    noiseSamples.sort((a, b) => a - b);
    const medianIndex = Math.floor(noiseSamples.length / 2);
    return noiseSamples[medianIndex];
  }

  calculateSNRBandwidth(spectrum: Float32Array, signalIndex: number, noiseFloor: number, bandwidth: number): number {
    if (!this.isInitialized) return 0;

    const binRadius = Math.floor(bandwidth / 2);
    const start = Math.max(0, signalIndex - binRadius);
    const end = Math.min(spectrum.length, signalIndex + binRadius + 1);

    // Calculate signal power within bandwidth
    let signalPower = 0;
    for (let i = start; i < end; i++) {
      const linearPower = Math.pow(10, spectrum[i] / 10);
      signalPower += linearPower;
    }

    // Calculate noise power within the same bandwidth
    const noisePowerLinear = Math.pow(10, noiseFloor / 10) * (end - start);

    // Convert back to dB and calculate SNR
    const signalPowerDb = 10 * Math.log10(signalPower);
    const noisePowerDb = 10 * Math.log10(noisePowerLinear);

    return signalPowerDb - noisePowerDb;
  }

  calculateCNR(spectrum: Float32Array, carrierIndex: number, noiseFloor: number): number {
    // Carrier-to-Noise Ratio (specific for CW and carrier-based signals)
    return this.calculateSNR(spectrum, carrierIndex, noiseFloor);
  }

  calculateSINAD(spectrum: Float32Array, signalIndex: number, bandwidth: number): number {
    // Signal-to-Noise-and-Distortion ratio
    if (!this.isInitialized) return 0;

    const binRadius = Math.floor(bandwidth / 2);
    const start = Math.max(0, signalIndex - binRadius);
    const end = Math.min(spectrum.length, signalIndex + binRadius + 1);

    // Find the peak (fundamental)
    let peakPower = -Infinity;
    let peakIndex = signalIndex;

    for (let i = start; i < end; i++) {
      if (spectrum[i] > peakPower) {
        peakPower = spectrum[i];
        peakIndex = i;
      }
    }

    // Calculate total power (signal + noise + distortion)
    let totalPower = 0;
    for (let i = start; i < end; i++) {
      totalPower += Math.pow(10, spectrum[i] / 10);
    }

    // Estimate signal power (fundamental component)
    const signalBins = 3; // Approximate signal width
    let signalPower = 0;
    for (let i = Math.max(start, peakIndex - signalBins);
         i <= Math.min(end - 1, peakIndex + signalBins); i++) {
      signalPower += Math.pow(10, spectrum[i] / 10);
    }

    // Noise + distortion power
    const nadPower = totalPower - signalPower;

    // SINAD in dB
    return 10 * Math.log10(signalPower / Math.max(nadPower, 1e-15));
  }

  calculateTHD(spectrum: Float32Array, fundamentalIndex: number, harmonicCount: number = 5): number {
    // Total Harmonic Distortion
    if (!this.isInitialized) return 0;

    const fundamentalPower = Math.pow(10, spectrum[fundamentalIndex] / 10);
    let harmonicPower = 0;

    // Find harmonic peaks (approximately at 2f, 3f, 4f, etc.)
    for (let h = 2; h <= harmonicCount + 1; h++) {
      const harmonicIndex = fundamentalIndex * h;
      if (harmonicIndex < spectrum.length) {
        // Look for peak around theoretical harmonic position
        const searchRadius = 2;
        let maxHarmonicPower = 0;

        for (let i = Math.max(0, harmonicIndex - searchRadius);
             i <= Math.min(spectrum.length - 1, harmonicIndex + searchRadius); i++) {
          const power = Math.pow(10, spectrum[i] / 10);
          maxHarmonicPower = Math.max(maxHarmonicPower, power);
        }

        harmonicPower += maxHarmonicPower;
      }
    }

    // THD as ratio of harmonic power to fundamental power
    return 10 * Math.log10(harmonicPower / Math.max(fundamentalPower, 1e-15));
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}