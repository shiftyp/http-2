/**
 * Adaptive Modulation Controller for OFDM
 *
 * Dynamically adjusts modulation schemes per carrier based on
 * channel conditions to maximize throughput while maintaining reliability.
 */

export type ModulationScheme = 'BPSK' | 'QPSK' | '8PSK' | '16QAM' | '32QAM' | '64QAM' | '128QAM' | '256QAM';

export interface ModulationProfile {
  scheme: ModulationScheme;
  bitsPerSymbol: number;
  requiredSNR: number; // Minimum SNR in dB
  targetBER: number;   // Target bit error rate
  powerOffset: number; // Power adjustment in dB
}

export interface AdaptationParameters {
  targetBER: number;
  marginDB: number; // Safety margin
  hysteresisDB: number; // Prevent oscillation
  adaptationRate: number; // 0-1, how quickly to adapt
  minHoldTime: number; // Minimum time before changing modulation
}

export class ModulationController {
  private profiles: Map<ModulationScheme, ModulationProfile>;
  private carrierModulation: Map<number, ModulationScheme> = new Map();
  private lastChangeTime: Map<number, number> = new Map();
  private snrHistory: Map<number, number[]> = new Map();
  private parameters: AdaptationParameters;

  constructor(parameters: Partial<AdaptationParameters> = {}) {
    this.parameters = {
      targetBER: 1e-5,
      marginDB: 3,
      hysteresisDB: 2,
      adaptationRate: 0.7,
      minHoldTime: 1000, // 1 second
      ...parameters
    };

    this.profiles = this.initializeProfiles();
  }

  /**
   * Initialize modulation profiles
   */
  private initializeProfiles(): Map<ModulationScheme, ModulationProfile> {
    const profiles = new Map<ModulationScheme, ModulationProfile>();

    // Define modulation profiles with required SNR for target BER
    profiles.set('BPSK', {
      scheme: 'BPSK',
      bitsPerSymbol: 1,
      requiredSNR: 4,
      targetBER: 1e-5,
      powerOffset: 0
    });

    profiles.set('QPSK', {
      scheme: 'QPSK',
      bitsPerSymbol: 2,
      requiredSNR: 7,
      targetBER: 1e-5,
      powerOffset: 0
    });

    profiles.set('8PSK', {
      scheme: '8PSK',
      bitsPerSymbol: 3,
      requiredSNR: 10,
      targetBER: 1e-5,
      powerOffset: 1
    });

    profiles.set('16QAM', {
      scheme: '16QAM',
      bitsPerSymbol: 4,
      requiredSNR: 14,
      targetBER: 1e-5,
      powerOffset: 1
    });

    profiles.set('32QAM', {
      scheme: '32QAM',
      bitsPerSymbol: 5,
      requiredSNR: 17,
      targetBER: 1e-5,
      powerOffset: 2
    });

    profiles.set('64QAM', {
      scheme: '64QAM',
      bitsPerSymbol: 6,
      requiredSNR: 20,
      targetBER: 1e-5,
      powerOffset: 2
    });

    profiles.set('128QAM', {
      scheme: '128QAM',
      bitsPerSymbol: 7,
      requiredSNR: 24,
      targetBER: 1e-5,
      powerOffset: 3
    });

    profiles.set('256QAM', {
      scheme: '256QAM',
      bitsPerSymbol: 8,
      requiredSNR: 28,
      targetBER: 1e-5,
      powerOffset: 3
    });

    return profiles;
  }

  /**
   * Select optimal modulation for given SNR
   */
  selectModulation(carrierId: number, currentSNR: number): ModulationScheme {
    // Update SNR history
    this.updateSNRHistory(carrierId, currentSNR);

    // Get averaged SNR to reduce fluctuations
    const avgSNR = this.getAveragedSNR(carrierId);

    // Get current modulation
    const currentMod = this.carrierModulation.get(carrierId) || 'QPSK';

    // Check if we should hold current modulation
    if (!this.shouldAdapt(carrierId)) {
      return currentMod;
    }

    // Find best modulation for current conditions
    const targetMod = this.findBestModulation(avgSNR);

    // Apply hysteresis to prevent oscillation
    if (this.shouldChangeModulation(currentMod, targetMod, avgSNR)) {
      this.carrierModulation.set(carrierId, targetMod);
      this.lastChangeTime.set(carrierId, Date.now());
      return targetMod;
    }

    return currentMod;
  }

  /**
   * Find best modulation scheme for given SNR
   */
  private findBestModulation(snr: number): ModulationScheme {
    const margin = this.parameters.marginDB;
    let bestScheme: ModulationScheme = 'BPSK';
    let maxBits = 0;

    // Find highest order modulation that meets SNR requirement
    for (const [scheme, profile] of this.profiles.entries()) {
      if (snr >= profile.requiredSNR + margin) {
        if (profile.bitsPerSymbol > maxBits) {
          maxBits = profile.bitsPerSymbol;
          bestScheme = scheme;
        }
      }
    }

    return bestScheme;
  }

  /**
   * Check if modulation should be changed (with hysteresis)
   */
  private shouldChangeModulation(
    current: ModulationScheme,
    target: ModulationScheme,
    snr: number
  ): boolean {
    const currentProfile = this.profiles.get(current)!;
    const targetProfile = this.profiles.get(target)!;

    // If upgrading, need SNR above threshold + hysteresis
    if (targetProfile.bitsPerSymbol > currentProfile.bitsPerSymbol) {
      return snr >= targetProfile.requiredSNR + this.parameters.marginDB + this.parameters.hysteresisDB;
    }

    // If downgrading, need SNR below threshold - hysteresis
    if (targetProfile.bitsPerSymbol < currentProfile.bitsPerSymbol) {
      return snr < currentProfile.requiredSNR + this.parameters.marginDB - this.parameters.hysteresisDB;
    }

    return false;
  }

  /**
   * Check if enough time has passed to adapt
   */
  private shouldAdapt(carrierId: number): boolean {
    const lastChange = this.lastChangeTime.get(carrierId) || 0;
    return Date.now() - lastChange >= this.parameters.minHoldTime;
  }

  /**
   * Update SNR history for averaging
   */
  private updateSNRHistory(carrierId: number, snr: number): void {
    if (!this.snrHistory.has(carrierId)) {
      this.snrHistory.set(carrierId, []);
    }

    const history = this.snrHistory.get(carrierId)!;
    history.push(snr);

    // Keep last 10 samples
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Get averaged SNR with exponential weighting
   */
  private getAveragedSNR(carrierId: number): number {
    const history = this.snrHistory.get(carrierId);
    if (!history || history.length === 0) {
      return 0;
    }

    // Exponential weighted average
    const alpha = this.parameters.adaptationRate;
    let avg = history[0];

    for (let i = 1; i < history.length; i++) {
      avg = alpha * history[i] + (1 - alpha) * avg;
    }

    return avg;
  }

  /**
   * Get modulation efficiency (bits/symbol)
   */
  getEfficiency(scheme: ModulationScheme): number {
    return this.profiles.get(scheme)?.bitsPerSymbol || 0;
  }

  /**
   * Calculate throughput for carrier
   */
  calculateThroughput(
    carrierId: number,
    symbolRate: number,
    packetErrorRate: number = 0
  ): number {
    const modulation = this.carrierModulation.get(carrierId) || 'QPSK';
    const profile = this.profiles.get(modulation)!;

    // Throughput = symbol_rate * bits_per_symbol * (1 - PER)
    return symbolRate * profile.bitsPerSymbol * (1 - packetErrorRate);
  }

  /**
   * Get total system capacity
   */
  getSystemCapacity(symbolRate: number): number {
    let totalCapacity = 0;

    for (const [_, modulation] of this.carrierModulation.entries()) {
      const profile = this.profiles.get(modulation)!;
      totalCapacity += symbolRate * profile.bitsPerSymbol;
    }

    return totalCapacity;
  }

  /**
   * Get power offset for modulation
   */
  getPowerOffset(scheme: ModulationScheme): number {
    return this.profiles.get(scheme)?.powerOffset || 0;
  }

  /**
   * Get modulation distribution
   */
  getModulationDistribution(): Map<ModulationScheme, number> {
    const distribution = new Map<ModulationScheme, number>();

    for (const scheme of this.profiles.keys()) {
      distribution.set(scheme, 0);
    }

    for (const modulation of this.carrierModulation.values()) {
      distribution.set(modulation, (distribution.get(modulation) || 0) + 1);
    }

    return distribution;
  }

  /**
   * Force modulation for testing
   */
  forceModulation(carrierId: number, scheme: ModulationScheme): void {
    this.carrierModulation.set(carrierId, scheme);
    this.lastChangeTime.set(carrierId, Date.now());
  }

  /**
   * Get modulation statistics
   */
  getStatistics(): {
    averageEfficiency: number;
    totalCarriers: number;
    distributionByScheme: Map<ModulationScheme, number>;
    averageChangesPerMinute: number;
  } {
    let totalEfficiency = 0;
    const distribution = this.getModulationDistribution();

    for (const [scheme, count] of distribution.entries()) {
      totalEfficiency += this.getEfficiency(scheme) * count;
    }

    const averageEfficiency = this.carrierModulation.size > 0
      ? totalEfficiency / this.carrierModulation.size
      : 0;

    // Calculate change rate
    const now = Date.now();
    const recentChanges = Array.from(this.lastChangeTime.values())
      .filter(time => now - time < 60000).length;

    return {
      averageEfficiency,
      totalCarriers: this.carrierModulation.size,
      distributionByScheme: distribution,
      averageChangesPerMinute: recentChanges
    };
  }

  /**
   * Update adaptation parameters
   */
  updateParameters(updates: Partial<AdaptationParameters>): void {
    this.parameters = { ...this.parameters, ...updates };
  }

  /**
   * Reset controller
   */
  reset(): void {
    this.carrierModulation.clear();
    this.lastChangeTime.clear();
    this.snrHistory.clear();
  }
}

export { ModulationController as default };