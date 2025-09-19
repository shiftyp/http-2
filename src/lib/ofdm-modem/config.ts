/**
 * OFDM Configuration Module (T019)
 * 
 * Centralized configuration management for OFDM modem parameters,
 * adaptive mode selection, and performance optimization settings.
 */

export type ModulationType = 'BPSK' | 'QPSK' | '16QAM' | '64QAM' | '256QAM';
export type CodingRate = '1/2' | '2/3' | '3/4' | '5/6' | '7/8';
export type GuardInterval = '1/4' | '1/8' | '1/16' | '1/32';
export type ChannelBandwidth = 2800 | 3000 | 6000 | 12000; // Hz

export interface OFDMParameters {
  // Core OFDM parameters
  fftSize: number;                    // FFT size (64, 128, 256, 512)
  numSubcarriers: number;             // Active data subcarriers
  subcarrierSpacing: number;          // Hz between subcarriers
  symbolDuration: number;             // Total symbol time (ms)
  guardInterval: GuardInterval;       // Cyclic prefix ratio
  pilotPattern: 'comb' | 'block' | 'scattered';
  pilotSpacing: number;               // Pilot tone spacing
  
  // Modulation and coding
  modulation: ModulationType;
  codingRate: CodingRate;
  interleaverDepth: number;           // Interleaver depth in symbols
  scramblerSeed: number;              // PN sequence seed
  
  // Channel parameters
  channelBandwidth: ChannelBandwidth;
  centerFrequency: number;            // Hz
  sampleRate: number;                 // Samples per second
  maxDopplerShift: number;            // Maximum Doppler frequency (Hz)
  delaySpread: number;                // RMS delay spread (ms)
}

export interface AdaptiveConfig {
  enableAdaptation: boolean;
  snrThresholds: Map<ModulationType, number>; // SNR thresholds for mode switching
  targetBER: number;                  // Target bit error rate
  adaptationPeriod: number;           // Symbols between adaptations
  minModulation: ModulationType;      // Minimum allowed modulation
  maxModulation: ModulationType;      // Maximum allowed modulation
  hysteresis: number;                 // dB hysteresis for mode switching
}

export interface PowerConfig {
  txPower: number;                    // Transmit power (dBm)
  papr: number;                       // Peak-to-average power ratio (dB)
  backoff: number;                    // Power amplifier backoff (dB)
  agcTarget: number;                  // AGC target level (dBFS)
  agcSpeed: 'fast' | 'medium' | 'slow';
}

export interface TimingConfig {
  syncThreshold: number;              // Correlation threshold for sync
  syncWindow: number;                 // Search window size (samples)
  frequencyOffsetTolerance: number;  // Max frequency offset (Hz)
  timingOffsetTolerance: number;     // Max timing offset (samples)
  trackingMode: 'coarse' | 'fine' | 'both';
}

export interface PerformanceMetrics {
  throughput: number;                 // Current throughput (bps)
  spectralEfficiency: number;         // bits/s/Hz
  ber: number;                        // Bit error rate
  per: number;                        // Packet error rate
  snr: number;                        // Signal-to-noise ratio (dB)
  evm: number;                        // Error vector magnitude (%)
  papr: number;                       // Current PAPR (dB)
  latency: number;                    // End-to-end latency (ms)
}

/**
 * OFDM Configuration Manager
 */
export class OFDMConfig {
  private params: OFDMParameters;
  private adaptive: AdaptiveConfig;
  private power: PowerConfig;
  private timing: TimingConfig;
  private metrics: PerformanceMetrics;
  private profiles: Map<string, Partial<OFDMParameters>>;
  
  constructor(bandwidth: ChannelBandwidth = 2800) {
    this.params = this.getDefaultParameters(bandwidth);
    this.adaptive = this.getDefaultAdaptiveConfig();
    this.power = this.getDefaultPowerConfig();
    this.timing = this.getDefaultTimingConfig();
    this.metrics = this.initializeMetrics();
    this.profiles = this.initializeProfiles();
  }
  
  /**
   * Get default OFDM parameters for given bandwidth
   */
  private getDefaultParameters(bandwidth: ChannelBandwidth): OFDMParameters {
    switch (bandwidth) {
      case 2800:
        // Narrow-band HF configuration
        return {
          fftSize: 64,
          numSubcarriers: 48,
          subcarrierSpacing: 43.75, // 2800 Hz / 64
          symbolDuration: 22.86,    // 1 / 43.75 Hz
          guardInterval: '1/4',
          pilotPattern: 'comb',
          pilotSpacing: 6,
          modulation: 'QPSK',
          codingRate: '3/4',
          interleaverDepth: 10,
          scramblerSeed: 0x1021,
          channelBandwidth: bandwidth,
          centerFrequency: 0,
          sampleRate: 8000,
          maxDopplerShift: 10,
          delaySpread: 5
        };
        
      case 3000:
        // Standard 3 kHz SSB bandwidth
        return {
          fftSize: 128,
          numSubcarriers: 96,
          subcarrierSpacing: 23.44, // 3000 Hz / 128
          symbolDuration: 42.67,
          guardInterval: '1/8',
          pilotPattern: 'scattered',
          pilotSpacing: 8,
          modulation: '16QAM',
          codingRate: '3/4',
          interleaverDepth: 15,
          scramblerSeed: 0x1021,
          channelBandwidth: bandwidth,
          centerFrequency: 0,
          sampleRate: 8000,
          maxDopplerShift: 10,
          delaySpread: 3
        };
        
      case 6000:
        // Wide-band configuration
        return {
          fftSize: 256,
          numSubcarriers: 200,
          subcarrierSpacing: 23.44, // 6000 Hz / 256
          symbolDuration: 42.67,
          guardInterval: '1/16',
          pilotPattern: 'scattered',
          pilotSpacing: 12,
          modulation: '64QAM',
          codingRate: '5/6',
          interleaverDepth: 20,
          scramblerSeed: 0x1021,
          channelBandwidth: bandwidth,
          centerFrequency: 0,
          sampleRate: 16000,
          maxDopplerShift: 20,
          delaySpread: 2
        };
        
      case 12000:
        // Ultra-wide configuration
        return {
          fftSize: 512,
          numSubcarriers: 400,
          subcarrierSpacing: 23.44, // 12000 Hz / 512
          symbolDuration: 42.67,
          guardInterval: '1/32',
          pilotPattern: 'scattered',
          pilotSpacing: 16,
          modulation: '256QAM',
          codingRate: '7/8',
          interleaverDepth: 25,
          scramblerSeed: 0x1021,
          channelBandwidth: bandwidth,
          centerFrequency: 0,
          sampleRate: 32000,
          maxDopplerShift: 30,
          delaySpread: 1
        };
        
      default:
        return this.getDefaultParameters(2800);
    }
  }
  
  /**
   * Get default adaptive configuration
   */
  private getDefaultAdaptiveConfig(): AdaptiveConfig {
    const snrThresholds = new Map<ModulationType, number>([
      ['BPSK', 5],     // 5 dB for BPSK
      ['QPSK', 10],    // 10 dB for QPSK
      ['16QAM', 15],   // 15 dB for 16QAM
      ['64QAM', 20],   // 20 dB for 64QAM
      ['256QAM', 25]   // 25 dB for 256QAM
    ]);
    
    return {
      enableAdaptation: true,
      snrThresholds,
      targetBER: 1e-5,
      adaptationPeriod: 100,
      minModulation: 'BPSK',
      maxModulation: '64QAM',
      hysteresis: 2
    };
  }
  
  /**
   * Get default power configuration
   */
  private getDefaultPowerConfig(): PowerConfig {
    return {
      txPower: 0,      // 0 dBm default
      papr: 10,        // 10 dB typical for OFDM
      backoff: 3,      // 3 dB PA backoff
      agcTarget: -20,  // -20 dBFS target
      agcSpeed: 'medium'
    };
  }
  
  /**
   * Get default timing configuration
   */
  private getDefaultTimingConfig(): TimingConfig {
    return {
      syncThreshold: 0.7,
      syncWindow: 100,
      frequencyOffsetTolerance: 50,  // ±50 Hz
      timingOffsetTolerance: 10,     // ±10 samples
      trackingMode: 'both'
    };
  }
  
  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      throughput: 0,
      spectralEfficiency: 0,
      ber: 0,
      per: 0,
      snr: 0,
      evm: 0,
      papr: 0,
      latency: 0
    };
  }
  
  /**
   * Initialize configuration profiles
   */
  private initializeProfiles(): Map<string, Partial<OFDMParameters>> {
    return new Map([
      ['low-snr', {
        modulation: 'BPSK',
        codingRate: '1/2',
        guardInterval: '1/4'
      }],
      ['medium-snr', {
        modulation: 'QPSK',
        codingRate: '3/4',
        guardInterval: '1/8'
      }],
      ['high-snr', {
        modulation: '64QAM',
        codingRate: '5/6',
        guardInterval: '1/16'
      }],
      ['mobile', {
        guardInterval: '1/4',
        pilotSpacing: 4,
        maxDopplerShift: 100
      }],
      ['fixed', {
        guardInterval: '1/32',
        pilotSpacing: 16,
        maxDopplerShift: 1
      }]
    ]);
  }
  
  /**
   * Calculate data rate based on current configuration
   */
  calculateDataRate(): number {
    const bitsPerSymbol = this.getBitsPerSymbol(this.params.modulation);
    const codeRate = this.getCodeRate(this.params.codingRate);
    const guardRatio = this.getGuardRatio(this.params.guardInterval);
    
    const symbolRate = 1000 / (this.params.symbolDuration * (1 + guardRatio));
    const dataSubcarriers = this.params.numSubcarriers - 
                           Math.floor(this.params.numSubcarriers / this.params.pilotSpacing);
    
    return Math.floor(symbolRate * dataSubcarriers * bitsPerSymbol * codeRate);
  }
  
  /**
   * Get bits per symbol for modulation type
   */
  private getBitsPerSymbol(modulation: ModulationType): number {
    switch (modulation) {
      case 'BPSK': return 1;
      case 'QPSK': return 2;
      case '16QAM': return 4;
      case '64QAM': return 6;
      case '256QAM': return 8;
    }
  }
  
  /**
   * Get code rate as decimal
   */
  private getCodeRate(rate: CodingRate): number {
    switch (rate) {
      case '1/2': return 0.5;
      case '2/3': return 0.667;
      case '3/4': return 0.75;
      case '5/6': return 0.833;
      case '7/8': return 0.875;
    }
  }
  
  /**
   * Get guard interval ratio
   */
  private getGuardRatio(interval: GuardInterval): number {
    switch (interval) {
      case '1/4': return 0.25;
      case '1/8': return 0.125;
      case '1/16': return 0.0625;
      case '1/32': return 0.03125;
    }
  }
  
  /**
   * Adapt modulation based on SNR
   */
  adaptModulation(snr: number): ModulationType {
    if (!this.adaptive.enableAdaptation) {
      return this.params.modulation;
    }
    
    let selectedModulation = this.adaptive.minModulation;
    
    // Find highest modulation that meets SNR requirement
    for (const [modulation, threshold] of this.adaptive.snrThresholds) {
      if (snr >= threshold + this.adaptive.hysteresis) {
        selectedModulation = modulation;
      } else {
        break;
      }
    }
    
    // Apply min/max constraints
    const modulations: ModulationType[] = ['BPSK', 'QPSK', '16QAM', '64QAM', '256QAM'];
    const minIndex = modulations.indexOf(this.adaptive.minModulation);
    const maxIndex = modulations.indexOf(this.adaptive.maxModulation);
    const selectedIndex = modulations.indexOf(selectedModulation);
    
    if (selectedIndex < minIndex) {
      selectedModulation = this.adaptive.minModulation;
    } else if (selectedIndex > maxIndex) {
      selectedModulation = this.adaptive.maxModulation;
    }
    
    return selectedModulation;
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
    
    // Calculate derived metrics
    if (metrics.throughput !== undefined && this.params.channelBandwidth) {
      this.metrics.spectralEfficiency = metrics.throughput / this.params.channelBandwidth;
    }
    
    // Trigger adaptation if needed
    if (metrics.snr !== undefined && this.adaptive.enableAdaptation) {
      const newModulation = this.adaptModulation(metrics.snr);
      if (newModulation !== this.params.modulation) {
        this.params.modulation = newModulation;
        console.log(`Adapted modulation to ${newModulation} (SNR: ${metrics.snr.toFixed(1)} dB)`);
      }
    }
  }
  
  /**
   * Apply configuration profile
   */
  applyProfile(profileName: string): void {
    const profile = this.profiles.get(profileName);
    if (profile) {
      this.params = { ...this.params, ...profile };
      console.log(`Applied profile: ${profileName}`);
    }
  }
  
  /**
   * Optimize for channel conditions
   */
  optimizeForChannel(delaySpread: number, dopplerShift: number): void {
    // Adjust guard interval based on delay spread
    if (delaySpread > 10) {
      this.params.guardInterval = '1/4';
    } else if (delaySpread > 5) {
      this.params.guardInterval = '1/8';
    } else if (delaySpread > 2) {
      this.params.guardInterval = '1/16';
    } else {
      this.params.guardInterval = '1/32';
    }
    
    // Adjust pilot spacing based on Doppler
    if (dopplerShift > 50) {
      this.params.pilotSpacing = 4;
    } else if (dopplerShift > 20) {
      this.params.pilotSpacing = 8;
    } else if (dopplerShift > 10) {
      this.params.pilotSpacing = 12;
    } else {
      this.params.pilotSpacing = 16;
    }
    
    this.params.maxDopplerShift = dopplerShift;
    this.params.delaySpread = delaySpread;
    
    console.log(`Optimized for channel: CP=${this.params.guardInterval}, pilots=${this.params.pilotSpacing}`);
  }
  
  /**
   * Get configuration for specific layer
   */
  getLayerConfig(layer: 'phy' | 'mac' | 'app'): any {
    switch (layer) {
      case 'phy':
        return {
          fftSize: this.params.fftSize,
          cpLength: Math.floor(this.params.fftSize * this.getGuardRatio(this.params.guardInterval)),
          subcarrierSpacing: this.params.subcarrierSpacing,
          sampleRate: this.params.sampleRate,
          pilotPattern: this.params.pilotPattern,
          pilotSpacing: this.params.pilotSpacing
        };
        
      case 'mac':
        return {
          modulation: this.params.modulation,
          codingRate: this.params.codingRate,
          interleaverDepth: this.params.interleaverDepth,
          dataRate: this.calculateDataRate(),
          symbolDuration: this.params.symbolDuration
        };
        
      case 'app':
        return {
          bandwidth: this.params.channelBandwidth,
          throughput: this.metrics.throughput,
          latency: this.metrics.latency,
          reliability: 1 - this.metrics.per
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Validate configuration
   */
  validate(): string[] {
    const errors: string[] = [];
    
    // Check FFT size is power of 2
    if ((this.params.fftSize & (this.params.fftSize - 1)) !== 0) {
      errors.push('FFT size must be power of 2');
    }
    
    // Check subcarriers don't exceed FFT size
    if (this.params.numSubcarriers >= this.params.fftSize) {
      errors.push('Number of subcarriers must be less than FFT size');
    }
    
    // Check pilot spacing
    if (this.params.pilotSpacing > this.params.numSubcarriers / 4) {
      errors.push('Pilot spacing too large for number of subcarriers');
    }
    
    // Check sample rate vs bandwidth
    if (this.params.sampleRate < this.params.channelBandwidth * 2) {
      errors.push('Sample rate must be at least 2x channel bandwidth (Nyquist)');
    }
    
    // Check symbol duration
    const expectedDuration = 1000 / this.params.subcarrierSpacing;
    if (Math.abs(this.params.symbolDuration - expectedDuration) > 0.1) {
      errors.push('Symbol duration inconsistent with subcarrier spacing');
    }
    
    return errors;
  }
  
  /**
   * Export configuration
   */
  export(): string {
    return JSON.stringify({
      parameters: this.params,
      adaptive: {
        ...this.adaptive,
        snrThresholds: Array.from(this.adaptive.snrThresholds.entries())
      },
      power: this.power,
      timing: this.timing,
      metrics: this.metrics
    }, null, 2);
  }
  
  /**
   * Import configuration
   */
  import(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      
      if (config.parameters) {
        this.params = config.parameters;
      }
      
      if (config.adaptive) {
        this.adaptive = {
          ...config.adaptive,
          snrThresholds: new Map(config.adaptive.snrThresholds)
        };
      }
      
      if (config.power) {
        this.power = config.power;
      }
      
      if (config.timing) {
        this.timing = config.timing;
      }
      
      if (config.metrics) {
        this.metrics = config.metrics;
      }
      
      // Validate imported config
      const errors = this.validate();
      if (errors.length > 0) {
        console.warn('Configuration validation warnings:', errors);
      }
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): {
    parameters: OFDMParameters;
    adaptive: AdaptiveConfig;
    power: PowerConfig;
    timing: TimingConfig;
    metrics: PerformanceMetrics;
  } {
    return {
      parameters: { ...this.params },
      adaptive: {
        ...this.adaptive,
        snrThresholds: new Map(this.adaptive.snrThresholds)
      },
      power: { ...this.power },
      timing: { ...this.timing },
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: {
    parameters?: Partial<OFDMParameters>;
    adaptive?: Partial<AdaptiveConfig>;
    power?: Partial<PowerConfig>;
    timing?: Partial<TimingConfig>;
  }): void {
    if (updates.parameters) {
      this.params = { ...this.params, ...updates.parameters };
    }
    
    if (updates.adaptive) {
      this.adaptive = { ...this.adaptive, ...updates.adaptive };
    }
    
    if (updates.power) {
      this.power = { ...this.power, ...updates.power };
    }
    
    if (updates.timing) {
      this.timing = { ...this.timing, ...updates.timing };
    }
    
    // Validate after update
    const errors = this.validate();
    if (errors.length > 0) {
      console.warn('Configuration validation warnings after update:', errors);
    }
  }
  
  /**
   * Reset to defaults
   */
  reset(bandwidth?: ChannelBandwidth): void {
    const bw = bandwidth || this.params.channelBandwidth;
    this.params = this.getDefaultParameters(bw);
    this.adaptive = this.getDefaultAdaptiveConfig();
    this.power = this.getDefaultPowerConfig();
    this.timing = this.getDefaultTimingConfig();
    this.metrics = this.initializeMetrics();
    
    console.log(`Configuration reset to defaults (bandwidth: ${bw} Hz)`);
  }
  
  /**
   * Get statistics summary
   */
  getStatistics(): string {
    const dataRate = this.calculateDataRate();
    const efficiency = this.metrics.spectralEfficiency || (dataRate / this.params.channelBandwidth);
    const overhead = this.getGuardRatio(this.params.guardInterval) * 100;
    
    return `
OFDM Configuration Statistics:
==============================
Bandwidth: ${this.params.channelBandwidth} Hz
FFT Size: ${this.params.fftSize}
Subcarriers: ${this.params.numSubcarriers}
Modulation: ${this.params.modulation}
Coding Rate: ${this.params.codingRate}
Data Rate: ${dataRate} bps
Spectral Efficiency: ${efficiency.toFixed(2)} bits/s/Hz
Guard Overhead: ${overhead.toFixed(1)}%
Current SNR: ${this.metrics.snr.toFixed(1)} dB
Current BER: ${this.metrics.ber.toExponential(2)}
`;
  }
}

/**
 * Factory function for creating OFDM configurations
 */
export function createOFDMConfig(
  bandwidth: ChannelBandwidth = 2800,
  profile?: string
): OFDMConfig {
  const config = new OFDMConfig(bandwidth);
  
  if (profile) {
    config.applyProfile(profile);
  }
  
  return config;
}

/**
 * Preset configurations for common scenarios
 */
export const OFDMPresets = {
  // Narrow-band HF with high reliability
  HF_RELIABLE: {
    channelBandwidth: 2800 as ChannelBandwidth,
    fftSize: 64,
    modulation: 'QPSK' as ModulationType,
    codingRate: '1/2' as CodingRate,
    guardInterval: '1/4' as GuardInterval
  },
  
  // High throughput for good conditions
  HIGH_THROUGHPUT: {
    channelBandwidth: 6000 as ChannelBandwidth,
    fftSize: 256,
    modulation: '256QAM' as ModulationType,
    codingRate: '7/8' as CodingRate,
    guardInterval: '1/32' as GuardInterval
  },
  
  // Mobile/portable operation
  MOBILE: {
    channelBandwidth: 3000 as ChannelBandwidth,
    fftSize: 128,
    modulation: '16QAM' as ModulationType,
    codingRate: '3/4' as CodingRate,
    guardInterval: '1/8' as GuardInterval
  },
  
  // Emergency/disaster communications
  EMERGENCY: {
    channelBandwidth: 2800 as ChannelBandwidth,
    fftSize: 64,
    modulation: 'BPSK' as ModulationType,
    codingRate: '1/2' as CodingRate,
    guardInterval: '1/4' as GuardInterval
  }
};

export default OFDMConfig;