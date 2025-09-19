/**
 * SNR Estimator for OFDM Carriers
 *
 * Estimates Signal-to-Noise Ratio for each OFDM subcarrier
 * using pilot tones and received signal analysis.
 */

export interface SignalSample {
  real: number;
  imag: number;
  timestamp: number;
}

export interface NoiseEstimate {
  power: number;
  variance: number;
  spectralDensity: number;
}

export class SNREstimator {
  private pilotSymbols: Map<number, Complex> = new Map();
  private sampleBuffer: Map<number, SignalSample[]> = new Map();
  private noiseFloor: number = -100; // dBm
  private bufferSize: number = 100;

  constructor() {
    this.initializePilotSymbols();
  }

  /**
   * Initialize known pilot symbols
   */
  private initializePilotSymbols(): void {
    // Standard OFDM pilot pattern (every 6th carrier)
    for (let i = 0; i < 48; i += 6) {
      // Use BPSK pilots for simplicity
      const symbol: Complex = {
        real: i % 12 === 0 ? 1 : -1,
        imag: 0
      };
      this.pilotSymbols.set(i, symbol);
    }
  }

  /**
   * Estimate SNR from received signal
   */
  estimateSNR(
    carrierId: number,
    receivedSignal: Complex[],
    knownSymbol?: Complex
  ): number {
    if (this.pilotSymbols.has(carrierId)) {
      // Use pilot-based estimation
      return this.estimateFromPilot(carrierId, receivedSignal);
    } else if (knownSymbol) {
      // Use data-aided estimation
      return this.estimateFromKnownSymbol(receivedSignal, knownSymbol);
    } else {
      // Use blind estimation
      return this.estimateBlind(carrierId, receivedSignal);
    }
  }

  /**
   * Estimate SNR using pilot carriers
   */
  private estimateFromPilot(carrierId: number, received: Complex[]): number {
    const pilot = this.pilotSymbols.get(carrierId)!;

    let signalPower = 0;
    let noisePower = 0;

    for (const sample of received) {
      // Calculate error vector
      const errorReal = sample.real - pilot.real;
      const errorImag = sample.imag - pilot.imag;

      // Signal power (expected pilot power)
      signalPower += pilot.real * pilot.real + pilot.imag * pilot.imag;

      // Noise power (error power)
      noisePower += errorReal * errorReal + errorImag * errorImag;
    }

    signalPower /= received.length;
    noisePower /= received.length;

    // Prevent division by zero
    if (noisePower < 1e-10) {
      return 40; // Very high SNR
    }

    // Calculate SNR in dB
    return 10 * Math.log10(signalPower / noisePower);
  }

  /**
   * Estimate SNR using known data symbols
   */
  private estimateFromKnownSymbol(received: Complex[], known: Complex): number {
    let signalPower = 0;
    let totalPower = 0;

    for (const sample of received) {
      // Total received power
      totalPower += sample.real * sample.real + sample.imag * sample.imag;

      // Correlate with known symbol
      const correlation = sample.real * known.real + sample.imag * known.imag;
      signalPower += correlation;
    }

    signalPower = Math.abs(signalPower) / received.length;
    totalPower /= received.length;

    const noisePower = totalPower - signalPower;

    if (noisePower < 1e-10) {
      return 40;
    }

    return 10 * Math.log10(signalPower / noisePower);
  }

  /**
   * Blind SNR estimation using signal statistics
   */
  private estimateBlind(carrierId: number, received: Complex[]): number {
    // Store samples for averaging
    this.updateSampleBuffer(carrierId, received);

    // Calculate signal statistics
    const stats = this.calculateSignalStatistics(received);

    // Estimate signal and noise power using M2M4 method
    const m2 = stats.secondMoment;
    const m4 = stats.fourthMoment;

    // For QPSK/QAM signals
    const kurtosis = m4 / (m2 * m2);

    // Theoretical kurtosis for different modulations
    let theoreticalKurtosis = 2; // QPSK default

    // Estimate signal power
    const signalPower = m2;

    // Estimate noise power from kurtosis excess
    const kurtosisExcess = kurtosis - theoreticalKurtosis;
    const noisePower = Math.abs(signalPower * kurtosisExcess / 2);

    if (noisePower < 1e-10) {
      return 30; // High SNR
    }

    return 10 * Math.log10(signalPower / noisePower);
  }

  /**
   * Calculate signal statistics for blind estimation
   */
  private calculateSignalStatistics(samples: Complex[]): {
    mean: Complex;
    secondMoment: number;
    fourthMoment: number;
  } {
    let meanReal = 0;
    let meanImag = 0;
    let m2 = 0;
    let m4 = 0;

    // Calculate mean
    for (const sample of samples) {
      meanReal += sample.real;
      meanImag += sample.imag;
    }
    meanReal /= samples.length;
    meanImag /= samples.length;

    // Calculate moments
    for (const sample of samples) {
      const centeredReal = sample.real - meanReal;
      const centeredImag = sample.imag - meanImag;
      const magnitude2 = centeredReal * centeredReal + centeredImag * centeredImag;

      m2 += magnitude2;
      m4 += magnitude2 * magnitude2;
    }

    m2 /= samples.length;
    m4 /= samples.length;

    return {
      mean: { real: meanReal, imag: meanImag },
      secondMoment: m2,
      fourthMoment: m4
    };
  }

  /**
   * Estimate noise floor from quiet periods
   */
  estimateNoiseFloor(quietSamples: Complex[]): number {
    let totalPower = 0;

    for (const sample of quietSamples) {
      totalPower += sample.real * sample.real + sample.imag * sample.imag;
    }

    const avgPower = totalPower / quietSamples.length;

    // Convert to dBm (assuming 50 ohm system)
    this.noiseFloor = 10 * Math.log10(avgPower * 1000);

    return this.noiseFloor;
  }

  /**
   * Update sample buffer for averaging
   */
  private updateSampleBuffer(carrierId: number, samples: Complex[]): void {
    if (!this.sampleBuffer.has(carrierId)) {
      this.sampleBuffer.set(carrierId, []);
    }

    const buffer = this.sampleBuffer.get(carrierId)!;

    // Add new samples
    for (const sample of samples) {
      buffer.push({
        real: sample.real,
        imag: sample.imag,
        timestamp: Date.now()
      });
    }

    // Maintain buffer size
    while (buffer.length > this.bufferSize) {
      buffer.shift();
    }
  }

  /**
   * Get averaged SNR estimate over time
   */
  getAveragedSNR(carrierId: number): number {
    const buffer = this.sampleBuffer.get(carrierId);
    if (!buffer || buffer.length === 0) {
      return 0;
    }

    // Convert buffer to Complex array
    const samples: Complex[] = buffer.map(s => ({
      real: s.real,
      imag: s.imag
    }));

    return this.estimateBlind(carrierId, samples);
  }

  /**
   * Estimate channel quality indicator
   */
  estimateCQI(snr: number): number {
    // Map SNR to CQI (0-15 scale)
    if (snr < -6) return 0;
    if (snr < -4) return 1;
    if (snr < -2) return 2;
    if (snr < 0) return 3;
    if (snr < 2) return 4;
    if (snr < 4) return 5;
    if (snr < 6) return 6;
    if (snr < 8) return 7;
    if (snr < 10) return 8;
    if (snr < 12) return 9;
    if (snr < 14) return 10;
    if (snr < 16) return 11;
    if (snr < 18) return 12;
    if (snr < 20) return 13;
    if (snr < 22) return 14;
    return 15;
  }

  /**
   * Reset estimator
   */
  reset(): void {
    this.sampleBuffer.clear();
    this.noiseFloor = -100;
  }
}

// Helper type for complex numbers
interface Complex {
  real: number;
  imag: number;
}

export { SNREstimator as default };