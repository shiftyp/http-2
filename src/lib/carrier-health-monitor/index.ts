/**
 * Carrier Health Monitor for OFDM System
 *
 * Monitors and manages the health of OFDM subcarriers with
 * SNR estimation, adaptive modulation, and carrier control.
 */

import { OFDMModem } from '../ofdm-modem/index.js';

export interface CarrierHealth {
  id: number;
  snr: number; // Signal-to-Noise Ratio in dB
  ber: number; // Bit Error Rate
  powerLevel: number; // Relative power 0-1
  modulation: ModulationType;
  capacity: number; // bits per symbol
  enabled: boolean;
  lastUpdate: number;
  history: HealthSample[];
}

export interface HealthSample {
  timestamp: number;
  snr: number;
  ber: number;
  successRate: number;
}

export type ModulationType = 'BPSK' | 'QPSK' | '8PSK' | '16QAM' | '64QAM';

export interface MonitorConfig {
  sampleInterval: number; // ms
  historySize: number;
  snrThresholds: {
    BPSK: number;
    QPSK: number;
    '8PSK': number;
    '16QAM': number;
    '64QAM': number;
  };
  minSNR: number; // Minimum SNR to keep carrier enabled
  adaptiveModulation: boolean;
}

export class CarrierHealthMonitor {
  private carriers: Map<number, CarrierHealth> = new Map();
  private modem: OFDMModem | null = null;
  private config: MonitorConfig;
  private monitorInterval: NodeJS.Timeout | null = null;
  private pilotCarriers: Set<number> = new Set();

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      sampleInterval: 100,
      historySize: 100,
      snrThresholds: {
        BPSK: 3,    // 3 dB for BPSK
        QPSK: 7,    // 7 dB for QPSK
        '8PSK': 10, // 10 dB for 8PSK
        '16QAM': 14, // 14 dB for 16QAM
        '64QAM': 20  // 20 dB for 64QAM
      },
      minSNR: 3,
      adaptiveModulation: true,
      ...config
    };

    // Initialize pilot carriers (every 6th carrier)
    for (let i = 0; i < 48; i += 6) {
      this.pilotCarriers.add(i);
    }
  }

  /**
   * Initialize with OFDM modem
   */
  initialize(modem: OFDMModem): void {
    this.modem = modem;
    this.initializeCarriers();
    this.startMonitoring();
  }

  /**
   * Initialize carrier health tracking
   */
  private initializeCarriers(): void {
    if (!this.modem) return;

    const numCarriers = 48; // OFDM standard

    for (let i = 0; i < numCarriers; i++) {
      const isPilot = this.pilotCarriers.has(i);

      const health: CarrierHealth = {
        id: i,
        snr: isPilot ? 30 : 15, // Pilots have better SNR
        ber: 0,
        powerLevel: 1.0,
        modulation: 'QPSK',
        capacity: 2, // bits per symbol for QPSK
        enabled: true,
        lastUpdate: Date.now(),
        history: []
      };

      this.carriers.set(i, health);
    }
  }

  /**
   * Start health monitoring
   */
  private startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(() => {
      this.updateCarrierHealth();
    }, this.config.sampleInterval);
  }

  /**
   * Update health metrics for all carriers
   */
  private updateCarrierHealth(): void {
    if (!this.modem) return;

    const carrierStatus = this.modem.getCarrierStatus();

    for (const [id, health] of this.carriers.entries()) {
      if (id < carrierStatus.length) {
        const status = carrierStatus[id];

        // Update SNR with some noise simulation
        const snrVariation = (Math.random() - 0.5) * 2; // ±1 dB variation
        health.snr = Math.max(0, status.snr + snrVariation);

        // Calculate BER based on SNR and modulation
        health.ber = this.calculateBER(health.snr, health.modulation);

        // Update power level based on SNR
        health.powerLevel = this.calculateOptimalPower(health.snr);

        // Adaptive modulation
        if (this.config.adaptiveModulation) {
          const newModulation = this.selectOptimalModulation(health.snr);
          if (newModulation !== health.modulation) {
            this.changeModulation(id, newModulation);
          }
        }

        // Check if carrier should be disabled
        if (health.snr < this.config.minSNR && !this.pilotCarriers.has(id)) {
          health.enabled = false;
        } else {
          health.enabled = true;
        }

        // Add to history
        this.addHealthSample(health);

        health.lastUpdate = Date.now();
      }
    }
  }

  /**
   * Calculate Bit Error Rate based on SNR and modulation
   */
  private calculateBER(snr: number, modulation: ModulationType): number {
    // Simplified BER calculation (actual would use Q-function)
    const snrLinear = Math.pow(10, snr / 10);

    switch (modulation) {
      case 'BPSK':
        return 0.5 * Math.exp(-snrLinear);
      case 'QPSK':
        return 0.5 * Math.exp(-snrLinear / 2);
      case '8PSK':
        return 0.5 * Math.exp(-snrLinear / 3);
      case '16QAM':
        return 0.375 * Math.exp(-snrLinear / 5);
      case '64QAM':
        return 0.4375 * Math.exp(-snrLinear / 7);
      default:
        return 0.1;
    }
  }

  /**
   * Select optimal modulation based on SNR
   */
  private selectOptimalModulation(snr: number): ModulationType {
    const thresholds = this.config.snrThresholds;

    if (snr >= thresholds['64QAM']) return '64QAM';
    if (snr >= thresholds['16QAM']) return '16QAM';
    if (snr >= thresholds['8PSK']) return '8PSK';
    if (snr >= thresholds.QPSK) return 'QPSK';
    return 'BPSK';
  }

  /**
   * Calculate optimal power level based on SNR
   */
  private calculateOptimalPower(snr: number): number {
    // Reduce power if SNR is good, increase if poor
    if (snr > 25) return 0.7;
    if (snr > 20) return 0.8;
    if (snr > 15) return 0.9;
    if (snr > 10) return 1.0;
    return 1.0; // Max power for poor SNR
  }

  /**
   * Change carrier modulation
   */
  private changeModulation(carrierId: number, modulation: ModulationType): void {
    const health = this.carriers.get(carrierId);
    if (!health) return;

    health.modulation = modulation;
    health.capacity = this.getModulationCapacity(modulation);

    // Notify modem of modulation change
    if (this.modem) {
      this.modem.setCarrierModulation(carrierId, modulation);
    }
  }

  /**
   * Get bits per symbol for modulation type
   */
  private getModulationCapacity(modulation: ModulationType): number {
    switch (modulation) {
      case 'BPSK': return 1;
      case 'QPSK': return 2;
      case '8PSK': return 3;
      case '16QAM': return 4;
      case '64QAM': return 6;
      default: return 2;
    }
  }

  /**
   * Add health sample to history
   */
  private addHealthSample(health: CarrierHealth): void {
    const sample: HealthSample = {
      timestamp: Date.now(),
      snr: health.snr,
      ber: health.ber,
      successRate: 1 - health.ber
    };

    health.history.push(sample);

    // Maintain history size
    if (health.history.length > this.config.historySize) {
      health.history.shift();
    }
  }

  /**
   * Get carrier health status
   */
  getCarrierHealth(carrierId: number): CarrierHealth | undefined {
    return this.carriers.get(carrierId);
  }

  /**
   * Get all carrier health statuses
   */
  getAllCarrierHealth(): CarrierHealth[] {
    return Array.from(this.carriers.values());
  }

  /**
   * Get healthy carriers (above minimum SNR)
   */
  getHealthyCarriers(): number[] {
    return Array.from(this.carriers.entries())
      .filter(([_, health]) => health.enabled && health.snr >= this.config.minSNR)
      .map(([id, _]) => id);
  }

  /**
   * Enable/disable carrier
   */
  setCarrierEnabled(carrierId: number, enabled: boolean): void {
    const health = this.carriers.get(carrierId);
    if (health && !this.pilotCarriers.has(carrierId)) {
      health.enabled = enabled;

      if (this.modem) {
        this.modem.setCarrierEnabled(carrierId, enabled);
      }
    }
  }

  /**
   * Force carrier modulation
   */
  forceCarrierModulation(carrierId: number, modulation: ModulationType): void {
    this.changeModulation(carrierId, modulation);
  }

  /**
   * Get average SNR across all carriers
   */
  getAverageSNR(): number {
    let totalSNR = 0;
    let count = 0;

    for (const health of this.carriers.values()) {
      if (health.enabled) {
        totalSNR += health.snr;
        count++;
      }
    }

    return count > 0 ? totalSNR / count : 0;
  }

  /**
   * Get system capacity in bits per symbol
   */
  getSystemCapacity(): number {
    let totalCapacity = 0;

    for (const health of this.carriers.values()) {
      if (health.enabled) {
        totalCapacity += health.capacity;
      }
    }

    return totalCapacity;
  }

  /**
   * Get carrier statistics
   */
  getStatistics(): {
    totalCarriers: number;
    enabledCarriers: number;
    averageSNR: number;
    averageBER: number;
    systemCapacity: number;
    modulationDistribution: Record<ModulationType, number>;
  } {
    const stats = {
      totalCarriers: this.carriers.size,
      enabledCarriers: 0,
      averageSNR: 0,
      averageBER: 0,
      systemCapacity: 0,
      modulationDistribution: {
        'BPSK': 0,
        'QPSK': 0,
        '8PSK': 0,
        '16QAM': 0,
        '64QAM': 0
      } as Record<ModulationType, number>
    };

    let snrSum = 0;
    let berSum = 0;

    for (const health of this.carriers.values()) {
      if (health.enabled) {
        stats.enabledCarriers++;
        snrSum += health.snr;
        berSum += health.ber;
        stats.systemCapacity += health.capacity;
        stats.modulationDistribution[health.modulation]++;
      }
    }

    if (stats.enabledCarriers > 0) {
      stats.averageSNR = snrSum / stats.enabledCarriers;
      stats.averageBER = berSum / stats.enabledCarriers;
    }

    return stats;
  }

  /**
   * Get carrier trend (improving/degrading)
   */
  getCarrierTrend(carrierId: number): 'improving' | 'stable' | 'degrading' {
    const health = this.carriers.get(carrierId);
    if (!health || health.history.length < 10) return 'stable';

    const recent = health.history.slice(-10);
    const older = health.history.slice(-20, -10);

    if (older.length === 0) return 'stable';

    const recentAvgSNR = recent.reduce((sum, s) => sum + s.snr, 0) / recent.length;
    const olderAvgSNR = older.reduce((sum, s) => sum + s.snr, 0) / older.length;

    const diff = recentAvgSNR - olderAvgSNR;

    if (diff > 1) return 'improving';
    if (diff < -1) return 'degrading';
    return 'stable';
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Reset monitor
   */
  reset(): void {
    this.stop();
    this.carriers.clear();
    if (this.modem) {
      this.initializeCarriers();
      this.startMonitoring();
    }
  }
}

export { CarrierHealthMonitor as default };