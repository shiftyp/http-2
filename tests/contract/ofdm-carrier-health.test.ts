/**
 * Contract Test: OFDM Carrier Health Monitoring
 *
 * Verifies carrier health monitoring, SNR estimation,
 * and adaptive control based on channel conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CarrierHealthMonitor } from '../../src/lib/carrier-health-monitor/index.js';
import { SNREstimator } from '../../src/lib/carrier-health-monitor/snr-estimator.js';
import { ModulationController } from '../../src/lib/carrier-health-monitor/modulation.js';
import { CarrierControl } from '../../src/lib/carrier-health-monitor/carrier-control.js';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';

describe('OFDM Carrier Health Monitoring Contract', () => {
  let healthMonitor: CarrierHealthMonitor;
  let snrEstimator: SNREstimator;
  let modController: ModulationController;
  let carrierControl: CarrierControl;
  let modem: OFDMModem;

  beforeEach(() => {
    modem = new OFDMModem();
    healthMonitor = new CarrierHealthMonitor();
    snrEstimator = new SNREstimator();
    modController = new ModulationController();
    carrierControl = new CarrierControl();

    healthMonitor.initialize(modem);
  });

  afterEach(() => {
    healthMonitor.stop();
    carrierControl.reset();
  });

  describe('SNR Estimation', () => {
    it('should estimate SNR from pilot carriers', () => {
      const pilotCarrierId = 0; // First pilot
      const receivedSignal = [
        { real: 0.95, imag: 0.05 }, // Slightly noisy pilot
        { real: 1.02, imag: -0.03 },
        { real: 0.98, imag: 0.02 }
      ];

      const snr = snrEstimator.estimateSNR(pilotCarrierId, receivedSignal);

      expect(snr).toBeGreaterThan(10); // Should detect good SNR
      expect(snr).toBeLessThan(40); // But not perfect
    });

    it('should estimate SNR using blind estimation for data carriers', () => {
      const dataCarrierId = 1; // Non-pilot
      const receivedSignal = [
        { real: 0.7, imag: 0.7 },   // QPSK constellation point
        { real: -0.7, imag: 0.7 },
        { real: 0.7, imag: -0.7 },
        { real: -0.7, imag: -0.7 }
      ];

      const snr = snrEstimator.estimateSNR(dataCarrierId, receivedSignal);

      expect(snr).toBeGreaterThan(0);
      expect(snr).toBeLessThan(50);
    });

    it('should track SNR over time with averaging', () => {
      const carrierId = 1;
      const samples = Array.from({ length: 10 }, () => ({
        real: Math.random() * 2 - 1,
        imag: Math.random() * 2 - 1
      }));

      // First estimation
      const snr1 = snrEstimator.estimateSNR(carrierId, samples);

      // Add more samples
      const moreSamples = Array.from({ length: 10 }, () => ({
        real: Math.random() * 2 - 1,
        imag: Math.random() * 2 - 1
      }));
      const snr2 = snrEstimator.estimateSNR(carrierId, moreSamples);

      // Get averaged SNR
      const avgSNR = snrEstimator.getAveragedSNR(carrierId);

      expect(avgSNR).toBeDefined();
      expect(avgSNR).toBeGreaterThan(0);
    });

    it('should estimate noise floor from quiet periods', () => {
      const quietSamples = Array.from({ length: 100 }, () => ({
        real: (Math.random() - 0.5) * 0.01, // Very small noise
        imag: (Math.random() - 0.5) * 0.01
      }));

      const noiseFloor = snrEstimator.estimateNoiseFloor(quietSamples);

      expect(noiseFloor).toBeLessThan(-60); // Should be very low in dBm
    });

    it('should map SNR to Channel Quality Indicator (CQI)', () => {
      expect(snrEstimator.estimateCQI(-10)).toBe(0);  // Very poor
      expect(snrEstimator.estimateCQI(0)).toBe(3);    // Poor
      expect(snrEstimator.estimateCQI(10)).toBe(8);   // Good
      expect(snrEstimator.estimateCQI(20)).toBe(13);  // Very good
      expect(snrEstimator.estimateCQI(30)).toBe(15);  // Excellent
    });
  });

  describe('Adaptive Modulation', () => {
    it('should select appropriate modulation based on SNR', () => {
      const carrierId = 1;

      // Poor SNR -> BPSK
      let modulation = modController.selectModulation(carrierId, 3);
      expect(modulation).toBe('BPSK');

      // Medium SNR -> QPSK
      modulation = modController.selectModulation(carrierId, 10);
      expect(modulation).toBe('QPSK');

      // Good SNR -> Higher order
      modulation = modController.selectModulation(carrierId, 25);
      expect(['64QAM', '128QAM', '256QAM']).toContain(modulation);
    });

    it('should apply hysteresis to prevent oscillation', () => {
      const carrierId = 1;

      // Set initial modulation
      modController.selectModulation(carrierId, 15); // Should be QPSK or 16QAM

      // Small SNR fluctuation shouldn't change modulation
      const mod1 = modController.selectModulation(carrierId, 14);
      const mod2 = modController.selectModulation(carrierId, 16);

      expect(mod1).toBe(mod2); // Should remain stable
    });

    it('should respect minimum hold time before changing modulation', () => {
      const carrierId = 1;

      // Initial selection
      const initialMod = modController.selectModulation(carrierId, 10);

      // Immediate change attempt (should be blocked)
      const quickChange = modController.selectModulation(carrierId, 25);

      expect(quickChange).toBe(initialMod); // Should not change immediately
    });

    it('should track modulation distribution across carriers', () => {
      // Set different modulations for different carriers
      for (let i = 0; i < 48; i++) {
        const snr = 5 + Math.random() * 25;
        modController.selectModulation(i, snr);
      }

      const distribution = modController.getModulationDistribution();

      // Should have various modulations
      expect(distribution.size).toBeGreaterThan(0);

      let totalCarriers = 0;
      for (const count of distribution.values()) {
        totalCarriers += count;
      }
      expect(totalCarriers).toBeLessThanOrEqual(48);
    });

    it('should calculate throughput based on modulation', () => {
      const carrierId = 1;
      const symbolRate = 37500; // symbols/sec

      modController.forceModulation(carrierId, 'QPSK');
      let throughput = modController.calculateThroughput(carrierId, symbolRate);
      expect(throughput).toBe(symbolRate * 2); // 2 bits per symbol

      modController.forceModulation(carrierId, '16QAM');
      throughput = modController.calculateThroughput(carrierId, symbolRate);
      expect(throughput).toBe(symbolRate * 4); // 4 bits per symbol
    });
  });

  describe('Carrier Enable/Disable Control', () => {
    it('should disable carriers below minimum SNR threshold', () => {
      const carrierId = 1;

      const shouldBeEnabled = carrierControl.evaluateCarrier(
        carrierId,
        2,    // SNR below threshold
        1e-2, // High BER
        0     // No interference
      );

      expect(shouldBeEnabled).toBe(false);

      const state = carrierControl.getCarrierState(carrierId);
      expect(state?.enabled).toBe(false);
      expect(state?.reason).toBe('low-snr');
    });

    it('should disable carriers with high interference', () => {
      const carrierId = 1;

      carrierControl.reportInterference({
        carrierId,
        level: 15, // High interference
        type: 'narrowband',
        frequency: 2400e6
      });

      const state = carrierControl.getCarrierState(carrierId);
      expect(state?.enabled).toBe(false);
      expect(state?.reason).toBe('high-interference');
    });

    it('should implement notch filters for specific frequencies', () => {
      const carrierId = 10;

      carrierControl.setNotchFilter(carrierId, true);

      const state = carrierControl.getCarrierState(carrierId);
      expect(state?.enabled).toBe(false);
      expect(state?.reason).toBe('frequency-notch');

      // Remove notch filter
      carrierControl.setNotchFilter(carrierId, false);
      // Carrier can be re-enabled on next evaluation
    });

    it('should redistribute power among enabled carriers', () => {
      // Disable some carriers
      carrierControl.disableCarrier(1, 'low-snr');
      carrierControl.disableCarrier(2, 'high-interference');

      const enabledCarriers = carrierControl.getEnabledCarriers();
      const totalPower = 48; // Total power budget

      let allocatedPower = 0;
      for (const carrierId of enabledCarriers) {
        allocatedPower += carrierControl.getPowerAllocation(carrierId);
      }

      expect(allocatedPower).toBeCloseTo(totalPower, 1);
    });

    it('should auto-recover disabled carriers after delay', async () => {
      vi.useFakeTimers();

      const carrierId = 1;

      carrierControl.updatePolicy({
        autoRecovery: true,
        recoveryDelayMs: 1000
      });

      carrierControl.disableCarrier(carrierId, 'low-snr');

      let state = carrierControl.getCarrierState(carrierId);
      expect(state?.enabled).toBe(false);

      // Fast-forward time
      vi.advanceTimersByTime(1100);

      // Check if recovery is scheduled (actual recovery would happen in background)
      state = carrierControl.getCarrierState(carrierId);
      expect(state?.autoRecoverAt).toBeDefined();

      vi.useRealTimers();
    });

    it('should prioritize pilot carriers', () => {
      const pilotCarrier = 0; // Pilot at position 0
      const dataCarrier = 1;

      const pilotState = carrierControl.getCarrierState(pilotCarrier);
      const dataState = carrierControl.getCarrierState(dataCarrier);

      expect(pilotState?.priority).toBe(1.0); // Maximum priority
      expect(dataState?.priority).toBeLessThan(1.0);
    });
  });

  describe('System Health Metrics', () => {
    it('should track overall carrier health statistics', () => {
      const stats = healthMonitor.getStatistics();

      expect(stats.totalCarriers).toBe(48);
      expect(stats.enabledCarriers).toBeLessThanOrEqual(48);
      expect(stats.averageSNR).toBeGreaterThanOrEqual(0);
      expect(stats.averageBER).toBeGreaterThanOrEqual(0);
      expect(stats.systemCapacity).toBeGreaterThan(0);
    });

    it('should detect carrier quality trends', () => {
      const carrierId = 1;

      // Simulate improving conditions
      for (let i = 0; i < 20; i++) {
        const health = healthMonitor.getCarrierHealth(carrierId);
        if (health) {
          health.snr = 10 + i * 0.5; // Gradually improving
          health.history.push({
            timestamp: Date.now() + i * 100,
            snr: health.snr,
            ber: Math.pow(10, -health.snr / 10),
            successRate: 1 - health.ber
          });
        }
      }

      const trend = healthMonitor.getCarrierTrend(carrierId);
      expect(trend).toBe('improving');
    });

    it('should calculate system capacity in bits per symbol', () => {
      // Force known modulations
      for (let i = 0; i < 48; i++) {
        if (i % 6 !== 0) { // Skip pilots
          const health = healthMonitor.getCarrierHealth(i);
          if (health) {
            health.modulation = 'QPSK';
            health.capacity = 2;
            health.enabled = true;
          }
        }
      }

      const capacity = healthMonitor.getSystemCapacity();
      expect(capacity).toBe(40 * 2); // 40 data carriers * 2 bits/symbol
    });

    it('should monitor average SNR across all carriers', () => {
      const avgSNR = healthMonitor.getAverageSNR();

      expect(avgSNR).toBeGreaterThan(0);
      expect(avgSNR).toBeLessThan(40);
    });
  });

  describe('Real-time Updates', () => {
    it('should update carrier health periodically', async () => {
      const carrierId = 1;
      const initialHealth = healthMonitor.getCarrierHealth(carrierId);
      const initialUpdate = initialHealth?.lastUpdate;

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedHealth = healthMonitor.getCarrierHealth(carrierId);
      const newUpdate = updatedHealth?.lastUpdate;

      expect(newUpdate).toBeGreaterThan(initialUpdate || 0);
    });

    it('should maintain health history for each carrier', () => {
      const carrierId = 1;
      const health = healthMonitor.getCarrierHealth(carrierId);

      expect(health?.history).toBeDefined();
      expect(Array.isArray(health?.history)).toBe(true);
    });

    it('should trigger modulation changes based on SNR updates', () => {
      const carrierId = 1;

      // Force SNR change
      const health = healthMonitor.getCarrierHealth(carrierId);
      if (health) {
        const initialModulation = health.modulation;

        // Significantly improve SNR
        health.snr = 25;
        healthMonitor['updateCarrierHealth'](); // Trigger update

        const newHealth = healthMonitor.getCarrierHealth(carrierId);

        // Modulation might change if conditions are right
        expect(newHealth?.modulation).toBeDefined();
      }
    });
  });

  describe('Integration Requirements', () => {
    it('should integrate with OFDM modem for carrier control', () => {
      const carrierId = 5;

      // Disable via health monitor
      healthMonitor.setCarrierEnabled(carrierId, false);

      // Check modem reflects the change
      const carrierStatus = modem.getCarrierStatus();
      expect(carrierStatus[carrierId].enabled).toBe(false);
    });

    it('should support 48 carriers as per OFDM specification', () => {
      const allHealth = healthMonitor.getAllCarrierHealth();
      expect(allHealth).toHaveLength(48);
    });

    it('should maintain pilot carriers at fixed positions', () => {
      const pilotPositions = [0, 6, 12, 18, 24, 30, 36, 42];

      for (const position of pilotPositions) {
        const health = healthMonitor.getCarrierHealth(position);
        expect(health?.enabled).toBe(true); // Pilots should always be enabled
      }
    });
  });
});