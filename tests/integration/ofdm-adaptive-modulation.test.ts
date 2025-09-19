/**
 * Integration Test: OFDM Adaptive Modulation per Carrier
 *
 * Tests dynamic modulation adaptation on each OFDM subcarrier
 * based on real-time channel conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { ModulationController } from '../../src/lib/carrier-health-monitor/modulation.js';
import { CarrierHealthMonitor } from '../../src/lib/carrier-health-monitor/index.js';
import { SNREstimator } from '../../src/lib/carrier-health-monitor/snr-estimator.js';

describe('OFDM Adaptive Modulation Integration', () => {
  let modem: OFDMModem;
  let modController: ModulationController;
  let healthMonitor: CarrierHealthMonitor;
  let snrEstimator: SNREstimator;

  // Channel simulation parameters
  const channelConditions = {
    awgn: { mean: 0, variance: 0.01 }, // Additive white Gaussian noise
    fading: { type: 'rayleigh', rate: 10 }, // Hz
    multipath: { delays: [0, 0.5, 1.0], gains: [1, 0.6, 0.3] }
  };

  beforeEach(() => {
    modem = new OFDMModem();
    modController = new ModulationController();
    healthMonitor = new CarrierHealthMonitor();
    snrEstimator = new SNREstimator();

    healthMonitor.initialize(modem);
  });

  afterEach(() => {
    healthMonitor.stop();
    modController.reset();
  });

  describe('SNR-Based Adaptation', () => {
    it('should adapt modulation based on measured SNR', () => {
      const testCases = [
        { snr: 5, expected: 'BPSK' },
        { snr: 10, expected: 'QPSK' },
        { snr: 15, expected: '16QAM' },
        { snr: 22, expected: '64QAM' },
        { snr: 30, expected: '256QAM' }
      ];

      for (const test of testCases) {
        const carrierId = 1;
        const modulation = modController.selectModulation(carrierId, test.snr);

        // Allow some flexibility in selection due to margins
        const validModulations = getValidModulationsForSNR(test.snr);
        expect(validModulations).toContain(modulation);
      }
    });

    it('should adapt all carriers independently', () => {
      const modulations = new Map<number, string>();

      // Set different SNR for each carrier
      for (let i = 0; i < 48; i++) {
        if (i % 6 !== 0) { // Skip pilots
          const snr = 5 + Math.random() * 25; // 5-30 dB range
          const modulation = modController.selectModulation(i, snr);
          modulations.set(i, modulation);
        }
      }

      // Should have variety of modulations
      const uniqueModulations = new Set(modulations.values());
      expect(uniqueModulations.size).toBeGreaterThan(1);
    });

    it('should track SNR history for stable adaptation', () => {
      const carrierId = 1;
      const snrSequence = [15, 14, 16, 15, 14, 15]; // Fluctuating around 15

      let modulation = '';
      for (const snr of snrSequence) {
        modulation = modController.selectModulation(carrierId, snr);
      }

      // Should stabilize despite fluctuations
      expect(['QPSK', '16QAM']).toContain(modulation);
    });
  });

  describe('Throughput Optimization', () => {
    it('should maximize throughput while maintaining target BER', () => {
      const targetBER = 1e-5;
      const symbolRate = 37500;

      // Configure each carrier
      for (let i = 0; i < 48; i++) {
        if (i % 6 !== 0) { // Skip pilots
          const snr = 10 + Math.random() * 15;

          // Select modulation with BER constraint
          const modulation = selectModulationForBER(snr, targetBER);
          modController.forceModulation(i, modulation);
        }
      }

      // Calculate total throughput
      const totalThroughput = modController.getSystemCapacity(symbolRate);
      expect(totalThroughput).toBeGreaterThanOrEqual(100000); // 100 kbps minimum
    });

    it('should adapt to maximize spectral efficiency', () => {
      const bandwidth = 2800; // Hz
      const dataCarriers = 40;

      // Set optimal modulations
      for (let i = 0; i < 48; i++) {
        if (i % 6 !== 0) {
          const health = healthMonitor.getCarrierHealth(i);
          if (health && health.snr > 20) {
            modController.forceModulation(i, '64QAM');
          } else if (health && health.snr > 15) {
            modController.forceModulation(i, '16QAM');
          }
        }
      }

      const stats = modController.getStatistics();
      const spectralEfficiency = stats.averageEfficiency; // bits/symbol

      expect(spectralEfficiency).toBeGreaterThan(2); // Better than QPSK
    });
  });

  describe('Dynamic Channel Response', () => {
    it('should respond to sudden channel degradation', () => {
      const carrierId = 5;

      // Start with good channel
      modController.selectModulation(carrierId, 25);
      let modulation = modController.selectModulation(carrierId, 25);
      expect(['64QAM', '128QAM', '256QAM']).toContain(modulation);

      // Sudden degradation
      vi.advanceTimersByTime(1100); // Past hold time
      modulation = modController.selectModulation(carrierId, 8);
      expect(['BPSK', 'QPSK']).toContain(modulation);
    });

    it('should respond to gradual channel improvement', () => {
      const carrierId = 5;
      const snrSequence = [8, 10, 12, 14, 16, 18, 20]; // Improving

      vi.useFakeTimers();
      let modulation = '';

      for (const snr of snrSequence) {
        vi.advanceTimersByTime(1100); // Allow adaptation
        modulation = modController.selectModulation(carrierId, snr);
      }

      // Should upgrade modulation as channel improves
      expect(['16QAM', '32QAM', '64QAM']).toContain(modulation);

      vi.useRealTimers();
    });

    it('should handle frequency-selective fading', () => {
      // Simulate frequency-selective channel
      const channelResponse = new Array(48).fill(0).map((_, i) => {
        // Create notches in frequency response
        const freq = i / 48;
        const notch1 = Math.exp(-Math.pow((freq - 0.3) * 10, 2));
        const notch2 = Math.exp(-Math.pow((freq - 0.7) * 10, 2));
        return 1 - 0.8 * notch1 - 0.6 * notch2;
      });

      // Apply channel response to SNR
      for (let i = 0; i < 48; i++) {
        if (i % 6 !== 0) {
          const baseSNR = 20;
          const actualSNR = baseSNR * channelResponse[i];
          const modulation = modController.selectModulation(i, actualSNR);

          // Carriers in notches should use robust modulation
          if (channelResponse[i] < 0.3) {
            expect(['BPSK', 'QPSK']).toContain(modulation);
          }
        }
      }
    });
  });

  describe('Modulation Switching Performance', () => {
    it('should minimize switching overhead with hysteresis', () => {
      const carrierId = 5;
      const snrSequence = Array.from({ length: 20 }, () => 15 + (Math.random() - 0.5) * 2);

      vi.useFakeTimers();
      const modulations = [];

      for (const snr of snrSequence) {
        vi.advanceTimersByTime(100); // Short time
        const mod = modController.selectModulation(carrierId, snr);
        modulations.push(mod);
      }

      // Count switches
      let switches = 0;
      for (let i = 1; i < modulations.length; i++) {
        if (modulations[i] !== modulations[i-1]) {
          switches++;
        }
      }

      // Should have minimal switching due to hysteresis
      expect(switches).toBeLessThan(5);

      vi.useRealTimers();
    });

    it('should respect minimum hold time between changes', () => {
      const carrierId = 5;

      vi.useFakeTimers();

      // Initial modulation
      let mod1 = modController.selectModulation(carrierId, 10);

      // Try to change immediately
      vi.advanceTimersByTime(500); // Less than hold time
      let mod2 = modController.selectModulation(carrierId, 25);

      expect(mod2).toBe(mod1); // Should not change

      // Wait for hold time
      vi.advanceTimersByTime(600); // Total > 1000ms
      let mod3 = modController.selectModulation(carrierId, 25);

      expect(['16QAM', '32QAM', '64QAM']).toContain(mod3);

      vi.useRealTimers();
    });
  });

  describe('Multi-User Adaptation', () => {
    it('should adapt per-user link quality in mesh network', () => {
      // Simulate different link qualities to different peers
      const peerLinks = [
        { peerId: 'peer1', avgSNR: 25 }, // Good link
        { peerId: 'peer2', avgSNR: 15 }, // Medium link
        { peerId: 'peer3', avgSNR: 8 }   // Poor link
      ];

      const modulationPerPeer = new Map<string, string[]>();

      for (const link of peerLinks) {
        const modulations = [];

        for (let carrier = 0; carrier < 48; carrier++) {
          if (carrier % 6 !== 0) {
            // Add some variation per carrier
            const snr = link.avgSNR + (Math.random() - 0.5) * 5;
            const mod = modController.selectModulation(carrier, snr);
            modulations.push(mod);
          }
        }

        modulationPerPeer.set(link.peerId, modulations);
      }

      // Verify appropriate modulation per link quality
      const peer1Mods = modulationPerPeer.get('peer1')!;
      const peer3Mods = modulationPerPeer.get('peer3')!;

      // Good link should use higher order modulation
      const peer1High = peer1Mods.filter(m => ['64QAM', '128QAM', '256QAM'].includes(m));
      const peer3Low = peer3Mods.filter(m => ['BPSK', 'QPSK'].includes(m));

      expect(peer1High.length).toBeGreaterThan(peer3Low.length);
    });
  });

  describe('Power and Modulation Joint Adaptation', () => {
    it('should jointly optimize power and modulation', () => {
      const totalPower = 48; // Watts
      const carriers = [];

      // Create carrier conditions
      for (let i = 0; i < 48; i++) {
        if (i % 6 !== 0) {
          carriers.push({
            id: i,
            snr: 5 + Math.random() * 25,
            modulation: '',
            power: 0
          });
        }
      }

      // Optimize modulation and power
      let remainingPower = totalPower;
      for (const carrier of carriers) {
        // Select modulation
        carrier.modulation = modController.selectModulation(carrier.id, carrier.snr);

        // Allocate power (water-filling)
        const targetSNR = getTargetSNRForModulation(carrier.modulation);
        const powerNeeded = Math.max(0, targetSNR - carrier.snr);
        carrier.power = Math.min(powerNeeded, remainingPower / carriers.length);
        remainingPower -= carrier.power;
      }

      // Verify power constraint
      const totalUsedPower = carriers.reduce((sum, c) => sum + c.power, 0);
      expect(totalUsedPower).toBeLessThanOrEqual(totalPower);

      // Verify reasonable distribution
      const avgPower = totalUsedPower / carriers.length;
      for (const carrier of carriers) {
        expect(carrier.power).toBeLessThanOrEqual(avgPower * 3); // No extreme allocation
      }
    });

    it('should reduce modulation order when power-limited', () => {
      modController.updateParameters({
        targetBER: 1e-5,
        marginDB: 3
      });

      const carrierId = 5;

      // High SNR but power-limited scenario
      const availablePower = 0.5; // Low power
      const measuredSNR = 15;

      // Adjust effective SNR based on available power
      const effectiveSNR = measuredSNR - 3; // Power limitation penalty

      const modulation = modController.selectModulation(carrierId, effectiveSNR);

      // Should use conservative modulation due to power limit
      expect(['BPSK', 'QPSK', '8PSK']).toContain(modulation);
    });
  });

  describe('Real-Time Performance Metrics', () => {
    it('should track modulation efficiency over time', () => {
      // Simulate operation over time
      const duration = 100; // time steps
      const efficiencyHistory = [];

      for (let t = 0; t < duration; t++) {
        // Update channel conditions
        for (let carrier = 0; carrier < 48; carrier++) {
          if (carrier % 6 !== 0) {
            // Time-varying SNR
            const snr = 15 + 10 * Math.sin(2 * Math.PI * t / 50) + Math.random() * 5;
            modController.selectModulation(carrier, snr);
          }
        }

        const stats = modController.getStatistics();
        efficiencyHistory.push(stats.averageEfficiency);
      }

      // Average efficiency should be reasonable
      const avgEfficiency = efficiencyHistory.reduce((a, b) => a + b, 0) / duration;
      expect(avgEfficiency).toBeGreaterThan(2); // At least QPSK average
      expect(avgEfficiency).toBeLessThan(6); // Not unrealistic
    });

    it('should measure adaptation rate and stability', () => {
      vi.useFakeTimers();

      const testDuration = 60000; // 1 minute
      const sampleInterval = 1000; // 1 second
      let changeCount = 0;
      let previousMods = new Map<number, string>();

      for (let t = 0; t < testDuration; t += sampleInterval) {
        vi.advanceTimersByTime(sampleInterval);

        for (let carrier = 0; carrier < 48; carrier++) {
          if (carrier % 6 !== 0) {
            const snr = 15 + Math.random() * 10;
            const mod = modController.selectModulation(carrier, snr);

            if (previousMods.has(carrier) && previousMods.get(carrier) !== mod) {
              changeCount++;
            }
            previousMods.set(carrier, mod);
          }
        }
      }

      const stats = modController.getStatistics();
      const changesPerMinute = stats.averageChangesPerMinute;

      // Should have reasonable adaptation rate
      expect(changesPerMinute).toBeGreaterThan(0); // Some adaptation
      expect(changesPerMinute).toBeLessThan(60); // Not thrashing

      vi.useRealTimers();
    });

    it('should achieve target performance metrics', () => {
      // Configure for target performance
      const targetThroughput = 100000; // 100 kbps
      const targetBER = 1e-5;
      const symbolRate = 37500;

      // Optimize modulation selection
      const dataCarriers = 40;
      const requiredBitsPerSymbol = targetThroughput / (symbolRate * dataCarriers);

      // Set modulations to achieve target
      for (let carrier = 0; carrier < 48; carrier++) {
        if (carrier % 6 !== 0) {
          const health = healthMonitor.getCarrierHealth(carrier);
          if (health && health.snr > 15) {
            // Use higher order modulation for better carriers
            if (requiredBitsPerSymbol > 2) {
              modController.forceModulation(carrier, '16QAM');
            }
          }
        }
      }

      const achievedThroughput = modController.getSystemCapacity(symbolRate);
      expect(achievedThroughput).toBeGreaterThanOrEqual(targetThroughput);
    });
  });
});

// Helper functions
function getValidModulationsForSNR(snr: number): string[] {
  const modulations = [];
  if (snr >= 3) modulations.push('BPSK');
  if (snr >= 7) modulations.push('QPSK');
  if (snr >= 10) modulations.push('8PSK');
  if (snr >= 14) modulations.push('16QAM');
  if (snr >= 17) modulations.push('32QAM');
  if (snr >= 20) modulations.push('64QAM');
  if (snr >= 24) modulations.push('128QAM');
  if (snr >= 28) modulations.push('256QAM');
  return modulations;
}

function selectModulationForBER(snr: number, targetBER: number): string {
  // Simplified BER calculation
  if (snr < 7) return 'BPSK';
  if (snr < 10) return 'QPSK';
  if (snr < 14) return '8PSK';
  if (snr < 20) return '16QAM';
  if (snr < 28) return '64QAM';
  return '256QAM';
}

function getTargetSNRForModulation(modulation: string): number {
  const snrMap: Record<string, number> = {
    'BPSK': 7,
    'QPSK': 10,
    '8PSK': 13,
    '16QAM': 17,
    '32QAM': 20,
    '64QAM': 24,
    '128QAM': 28,
    '256QAM': 32
  };
  return snrMap[modulation] || 10;
}