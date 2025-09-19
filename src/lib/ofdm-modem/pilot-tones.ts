/**
 * OFDM Pilot Tones Module (T016)
 * 
 * Pilot tone insertion and extraction for channel estimation,
 * synchronization, and carrier recovery in OFDM systems.
 */

export interface PilotTone {
  index: number;      // Subcarrier index
  amplitude: number;  // Pilot amplitude
  phase: number;      // Pilot phase
  sequence: number[]; // Pilot sequence for this tone
}

export interface PilotConfiguration {
  pilotCarriers: number[];     // Indices of pilot subcarriers
  pilotSpacing: number;        // Spacing between pilots
  pilotPower: number;          // Relative pilot power
  sequenceType: 'zadoff-chu' | 'cazac' | 'prbs' | 'constant';
  sequenceLength: number;
}

export interface ChannelEstimate {
  magnitude: Float32Array;
  phase: Float32Array;
  snr: number;
  coherenceBandwidth: number;
  coherenceTime: number;
}

/**
 * Pilot Tone Manager for OFDM systems
 */
export class PilotToneManager {
  private config: PilotConfiguration;
  private pilotSequences: Map<number, number[]>;
  private channelEstimates: Map<number, ChannelEstimate>;
  private pilotHistory: Map<number, Float32Array[]>;
  private readonly DEFAULT_PILOT_SPACING = 6;
  private readonly DEFAULT_PILOT_POWER = 1.4142; // sqrt(2) for 3dB boost

  constructor(config?: Partial<PilotConfiguration>) {
    this.config = {
      pilotCarriers: config?.pilotCarriers || [0, 6, 12, 18, 24, 30, 36, 42],
      pilotSpacing: config?.pilotSpacing || this.DEFAULT_PILOT_SPACING,
      pilotPower: config?.pilotPower || this.DEFAULT_PILOT_POWER,
      sequenceType: config?.sequenceType || 'zadoff-chu',
      sequenceLength: config?.sequenceLength || 127
    };

    this.pilotSequences = new Map();
    this.channelEstimates = new Map();
    this.pilotHistory = new Map();

    this.initializePilotSequences();
  }

  /**
   * Initialize pilot sequences for each pilot carrier
   */
  private initializePilotSequences(): void {
    for (const carrierIndex of this.config.pilotCarriers) {
      const sequence = this.generatePilotSequence(
        carrierIndex,
        this.config.sequenceLength,
        this.config.sequenceType
      );
      this.pilotSequences.set(carrierIndex, sequence);
      this.pilotHistory.set(carrierIndex, []);
    }
  }

  /**
   * Generate pilot sequence based on type
   */
  private generatePilotSequence(
    carrierIndex: number,
    length: number,
    type: string
  ): number[] {
    switch (type) {
      case 'zadoff-chu':
        return this.generateZadoffChuSequence(carrierIndex, length);
      case 'cazac':
        return this.generateCAZACSequence(carrierIndex, length);
      case 'prbs':
        return this.generatePRBSSequence(carrierIndex, length);
      case 'constant':
        return Array(length).fill(1);
      default:
        return Array(length).fill(1);
    }
  }

  /**
   * Generate Zadoff-Chu sequence (constant amplitude, zero autocorrelation)
   */
  private generateZadoffChuSequence(root: number, length: number): number[] {
    const sequence: number[] = [];
    const u = this.findCoprime(root + 1, length); // Root index

    for (let n = 0; n < length; n++) {
      const phase = -Math.PI * u * n * (n + 1) / length;
      // Store as real values representing complex phase
      sequence.push(Math.cos(phase), Math.sin(phase));
    }

    return sequence;
  }

  /**
   * Generate CAZAC (Constant Amplitude Zero AutoCorrelation) sequence
   */
  private generateCAZACSequence(seed: number, length: number): number[] {
    const sequence: number[] = [];
    const m = this.findCoprime(seed + 1, length);

    for (let n = 0; n < length; n++) {
      const phase = 2 * Math.PI * m * n * n / length;
      sequence.push(Math.cos(phase), Math.sin(phase));
    }

    return sequence;
  }

  /**
   * Generate Pseudo-Random Binary Sequence
   */
  private generatePRBSSequence(seed: number, length: number): number[] {
    const sequence: number[] = [];
    let lfsr = seed || 0x7F; // 7-bit LFSR

    for (let i = 0; i < length; i++) {
      // LFSR with taps at positions 7 and 6 (for 7-bit LFSR)
      const bit = ((lfsr >> 6) ^ (lfsr >> 5)) & 1;
      lfsr = ((lfsr << 1) | bit) & 0x7F;
      
      // Map to BPSK: 0 -> -1, 1 -> +1
      sequence.push(bit ? 1 : -1, 0); // Real, Imaginary
    }

    return sequence;
  }

  /**
   * Find coprime number for sequence generation
   */
  private findCoprime(start: number, target: number): number {
    for (let n = start; n < target; n++) {
      if (this.gcd(n, target) === 1) {
        return n;
      }
    }
    return start;
  }

  /**
   * Greatest Common Divisor
   */
  private gcd(a: number, b: number): number {
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
   * Insert pilot tones into OFDM symbol
   */
  insertPilotTones(
    symbol: Complex[],
    symbolIndex: number
  ): Complex[] {
    const symbolWithPilots = [...symbol];

    for (const [carrierIndex, sequence] of this.pilotSequences) {
      if (carrierIndex < symbolWithPilots.length) {
        // Get pilot value for current symbol
        const sequenceIndex = (symbolIndex * 2) % sequence.length;
        const pilotReal = sequence[sequenceIndex] * this.config.pilotPower;
        const pilotImag = sequence[sequenceIndex + 1] * this.config.pilotPower;

        // Insert pilot at carrier position
        symbolWithPilots[carrierIndex] = {
          real: pilotReal,
          imag: pilotImag
        };
      }
    }

    return symbolWithPilots;
  }

  /**
   * Extract pilot tones from received symbol
   */
  extractPilotTones(
    receivedSymbol: Complex[],
    symbolIndex: number
  ): Map<number, Complex> {
    const extractedPilots = new Map<number, Complex>();

    for (const carrierIndex of this.config.pilotCarriers) {
      if (carrierIndex < receivedSymbol.length) {
        extractedPilots.set(carrierIndex, {
          real: receivedSymbol[carrierIndex].real,
          imag: receivedSymbol[carrierIndex].imag
        });

        // Store in history for channel tracking
        this.updatePilotHistory(carrierIndex, receivedSymbol[carrierIndex]);
      }
    }

    return extractedPilots;
  }

  /**
   * Estimate channel response using pilot tones
   */
  estimateChannel(
    receivedPilots: Map<number, Complex>,
    symbolIndex: number
  ): ChannelEstimate {
    const numCarriers = Math.max(...this.config.pilotCarriers) + 1;
    const magnitude = new Float32Array(numCarriers);
    const phase = new Float32Array(numCarriers);
    let totalSNR = 0;
    let pilotCount = 0;

    // Process each pilot
    for (const [carrierIndex, receivedPilot] of receivedPilots) {
      const sequence = this.pilotSequences.get(carrierIndex);
      if (!sequence) continue;

      // Get expected pilot
      const sequenceIndex = (symbolIndex * 2) % sequence.length;
      const expectedReal = sequence[sequenceIndex] * this.config.pilotPower;
      const expectedImag = sequence[sequenceIndex + 1] * this.config.pilotPower;

      // Calculate channel response H = Y/X
      const denominator = expectedReal * expectedReal + expectedImag * expectedImag;
      if (denominator > 0) {
        const hReal = (receivedPilot.real * expectedReal + receivedPilot.imag * expectedImag) / denominator;
        const hImag = (receivedPilot.imag * expectedReal - receivedPilot.real * expectedImag) / denominator;

        magnitude[carrierIndex] = Math.sqrt(hReal * hReal + hImag * hImag);
        phase[carrierIndex] = Math.atan2(hImag, hReal);

        // Estimate SNR from pilot
        const noise = this.estimatePilotNoise(carrierIndex, receivedPilot);
        const signal = magnitude[carrierIndex] * magnitude[carrierIndex];
        const snr = signal / (noise + 1e-10);
        totalSNR += 10 * Math.log10(snr);
        pilotCount++;
      }
    }

    // Interpolate channel response for data carriers
    this.interpolateChannel(magnitude, phase, receivedPilots);

    // Calculate channel statistics
    const averageSNR = pilotCount > 0 ? totalSNR / pilotCount : 0;
    const coherenceBW = this.estimateCoherenceBandwidth(magnitude);
    const coherenceTime = this.estimateCoherenceTime(carrierIndex);

    const estimate: ChannelEstimate = {
      magnitude,
      phase,
      snr: averageSNR,
      coherenceBandwidth: coherenceBW,
      coherenceTime: coherenceTime
    };

    // Store estimate
    this.channelEstimates.set(symbolIndex, estimate);

    return estimate;
  }

  /**
   * Interpolate channel response between pilots
   */
  private interpolateChannel(
    magnitude: Float32Array,
    phase: Float32Array,
    pilots: Map<number, Complex>
  ): void {
    const pilotIndices = Array.from(pilots.keys()).sort((a, b) => a - b);

    for (let i = 0; i < pilotIndices.length - 1; i++) {
      const startIdx = pilotIndices[i];
      const endIdx = pilotIndices[i + 1];
      const startMag = magnitude[startIdx];
      const endMag = magnitude[endIdx];
      const startPhase = phase[startIdx];
      const endPhase = phase[endIdx];

      // Linear interpolation between pilots
      for (let j = startIdx + 1; j < endIdx; j++) {
        const alpha = (j - startIdx) / (endIdx - startIdx);
        magnitude[j] = startMag + alpha * (endMag - startMag);
        
        // Phase unwrapping for interpolation
        let phaseDiff = endPhase - startPhase;
        while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
        while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
        
        phase[j] = startPhase + alpha * phaseDiff;
      }
    }

    // Extrapolate edges
    if (pilotIndices.length > 0) {
      const firstPilot = pilotIndices[0];
      const lastPilot = pilotIndices[pilotIndices.length - 1];

      for (let i = 0; i < firstPilot; i++) {
        magnitude[i] = magnitude[firstPilot];
        phase[i] = phase[firstPilot];
      }

      for (let i = lastPilot + 1; i < magnitude.length; i++) {
        magnitude[i] = magnitude[lastPilot];
        phase[i] = phase[lastPilot];
      }
    }
  }

  /**
   * Update pilot history for tracking
   */
  private updatePilotHistory(carrierIndex: number, pilot: Complex): void {
    const history = this.pilotHistory.get(carrierIndex) || [];
    const values = new Float32Array(2);
    values[0] = pilot.real;
    values[1] = pilot.imag;
    
    history.push(values);
    
    // Keep last 100 samples
    if (history.length > 100) {
      history.shift();
    }
    
    this.pilotHistory.set(carrierIndex, history);
  }

  /**
   * Estimate noise from pilot history
   */
  private estimatePilotNoise(carrierIndex: number, currentPilot: Complex): number {
    const history = this.pilotHistory.get(carrierIndex);
    if (!history || history.length < 2) {
      return 0.01; // Default noise floor
    }

    // Calculate variance from history
    let sumReal = 0, sumImag = 0;
    let sumSqReal = 0, sumSqImag = 0;

    for (const sample of history) {
      sumReal += sample[0];
      sumImag += sample[1];
      sumSqReal += sample[0] * sample[0];
      sumSqImag += sample[1] * sample[1];
    }

    const n = history.length;
    const meanReal = sumReal / n;
    const meanImag = sumImag / n;
    const varReal = (sumSqReal / n) - (meanReal * meanReal);
    const varImag = (sumSqImag / n) - (meanImag * meanImag);

    return Math.sqrt(varReal + varImag);
  }

  /**
   * Estimate coherence bandwidth from channel response
   */
  private estimateCoherenceBandwidth(magnitude: Float32Array): number {
    // Find correlation across frequency
    let correlation = 0;
    let count = 0;

    for (let lag = 1; lag < magnitude.length / 2; lag++) {
      let sum = 0;
      let validPairs = 0;

      for (let i = 0; i < magnitude.length - lag; i++) {
        if (magnitude[i] > 0 && magnitude[i + lag] > 0) {
          sum += magnitude[i] * magnitude[i + lag];
          validPairs++;
        }
      }

      if (validPairs > 0) {
        const lagCorrelation = sum / validPairs;
        if (lagCorrelation < 0.5) {
          // Found coherence bandwidth (where correlation drops below 0.5)
          return lag * (2800 / magnitude.length); // Convert to Hz
        }
      }
    }

    return 2800; // Full bandwidth if highly correlated
  }

  /**
   * Estimate coherence time from pilot history
   */
  private estimateCoherenceTime(carrierIndex: number): number {
    const history = this.pilotHistory.get(carrierIndex);
    if (!history || history.length < 10) {
      return 1000; // Default 1 second
    }

    // Find time correlation
    const recentSamples = history.slice(-20);
    let maxChange = 0;

    for (let i = 1; i < recentSamples.length; i++) {
      const deltaReal = recentSamples[i][0] - recentSamples[i-1][0];
      const deltaImag = recentSamples[i][1] - recentSamples[i-1][1];
      const change = Math.sqrt(deltaReal * deltaReal + deltaImag * deltaImag);
      maxChange = Math.max(maxChange, change);
    }

    // Estimate coherence time from rate of change
    if (maxChange > 0) {
      return 1000 / (maxChange * 10); // Convert to ms
    }

    return 1000;
  }

  /**
   * Apply channel equalization using pilot estimates
   */
  equalizeSymbol(
    receivedSymbol: Complex[],
    channelEstimate: ChannelEstimate
  ): Complex[] {
    const equalized: Complex[] = [];

    for (let i = 0; i < receivedSymbol.length; i++) {
      if (this.config.pilotCarriers.includes(i)) {
        // Skip pilot carriers
        equalized.push({ real: 0, imag: 0 });
      } else {
        // Apply channel compensation
        const mag = channelEstimate.magnitude[i];
        const phase = channelEstimate.phase[i];

        if (mag > 0.01) { // Avoid division by very small numbers
          // H* / |H|^2 compensation
          const conjReal = Math.cos(-phase) / mag;
          const conjImag = Math.sin(-phase) / mag;

          const eqReal = receivedSymbol[i].real * conjReal - receivedSymbol[i].imag * conjImag;
          const eqImag = receivedSymbol[i].real * conjImag + receivedSymbol[i].imag * conjReal;

          equalized.push({ real: eqReal, imag: eqImag });
        } else {
          equalized.push({ real: 0, imag: 0 });
        }
      }
    }

    return equalized;
  }

  /**
   * Get pilot configuration
   */
  getConfiguration(): PilotConfiguration {
    return { ...this.config };
  }

  /**
   * Update pilot configuration
   */
  updateConfiguration(config: Partial<PilotConfiguration>): void {
    this.config = { ...this.config, ...config };
    this.initializePilotSequences();
  }

  /**
   * Get channel statistics
   */
  getChannelStatistics(): {
    averageSNR: number;
    averageCoherenceBandwidth: number;
    averageCoherenceTime: number;
    pilotPowerRatio: number;
  } {
    const estimates = Array.from(this.channelEstimates.values());
    
    if (estimates.length === 0) {
      return {
        averageSNR: 0,
        averageCoherenceBandwidth: 0,
        averageCoherenceTime: 0,
        pilotPowerRatio: 0
      };
    }

    const avgSNR = estimates.reduce((sum, e) => sum + e.snr, 0) / estimates.length;
    const avgBW = estimates.reduce((sum, e) => sum + e.coherenceBandwidth, 0) / estimates.length;
    const avgTime = estimates.reduce((sum, e) => sum + e.coherenceTime, 0) / estimates.length;
    const pilotRatio = this.config.pilotCarriers.length / 48; // Assuming 48 total carriers

    return {
      averageSNR: avgSNR,
      averageCoherenceBandwidth: avgBW,
      averageCoherenceTime: avgTime,
      pilotPowerRatio: pilotRatio
    };
  }

  /**
   * Reset pilot tracking
   */
  reset(): void {
    this.channelEstimates.clear();
    this.pilotHistory.clear();
    this.initializePilotSequences();
  }
}

// Type definitions
interface Complex {
  real: number;
  imag: number;
}

export default PilotToneManager;