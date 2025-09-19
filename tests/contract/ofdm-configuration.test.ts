/**
 * Contract Test: OFDM Configuration
 *
 * Verifies OFDM system configuration including FFT size,
 * cyclic prefix, pilot patterns, and transmission parameters.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OFDMModem } from '../../src/lib/ofdm-modem/index.js';
import { OFDMSchema } from '../../src/lib/database/ofdm-schema.js';

describe('OFDM Configuration Contract', () => {
  let modem: OFDMModem;
  let schema: OFDMSchema;

  beforeEach(async () => {
    modem = new OFDMModem();
    schema = new OFDMSchema();
    await schema.initialize();
  });

  afterEach(() => {
    schema.close();
  });

  describe('System Parameters', () => {
    it('should use 64-point FFT with 48 data carriers', () => {
      const config = modem.getConfiguration();

      expect(config.fftSize).toBe(64);
      expect(config.numCarriers).toBe(48);
      expect(config.numDataCarriers).toBe(40); // 48 - 8 pilots
      expect(config.numPilotCarriers).toBe(8);
    });

    it('should configure cyclic prefix as 25% of symbol length', () => {
      const config = modem.getConfiguration();

      expect(config.cyclicPrefixRatio).toBe(0.25);
      expect(config.cyclicPrefixLength).toBe(16); // 64 * 0.25
      expect(config.totalSymbolLength).toBe(80); // 64 + 16
    });

    it('should support configurable sample rate', () => {
      modem.setSampleRate(48000);
      expect(modem.getSampleRate()).toBe(48000);

      modem.setSampleRate(96000);
      expect(modem.getSampleRate()).toBe(96000);
    });

    it('should calculate symbol duration based on sample rate', () => {
      modem.setSampleRate(48000);
      const config = modem.getConfiguration();

      const symbolDuration = config.totalSymbolLength / modem.getSampleRate();
      expect(symbolDuration).toBeCloseTo(80 / 48000, 6); // ~1.67ms
    });

    it('should configure guard bands at spectrum edges', () => {
      const config = modem.getConfiguration();

      expect(config.lowerGuardBand).toBeGreaterThan(0);
      expect(config.upperGuardBand).toBeGreaterThan(0);
      expect(config.dcNullCarrier).toBe(true); // DC carrier nulled
    });
  });

  describe('Pilot Configuration', () => {
    it('should place pilots at regular intervals', () => {
      const pilots = modem.getPilotCarriers();

      expect(pilots).toEqual([0, 6, 12, 18, 24, 30, 36, 42]);

      // Check spacing
      for (let i = 1; i < pilots.length; i++) {
        expect(pilots[i] - pilots[i-1]).toBe(6);
      }
    });

    it('should use known pilot symbols', () => {
      const pilotSymbols = modem.getPilotSymbols();

      expect(pilotSymbols).toHaveLength(8);

      // Check pilot values (BPSK: +1 or -1)
      for (const symbol of pilotSymbols) {
        expect(Math.abs(symbol.real)).toBe(1);
        expect(symbol.imag).toBe(0);
      }
    });

    it('should support pilot power boosting', () => {
      const config = modem.getConfiguration();

      expect(config.pilotPowerBoost).toBeGreaterThanOrEqual(0);
      expect(config.pilotPowerBoost).toBeLessThanOrEqual(3); // Max 3dB boost
    });
  });

  describe('Modulation Profiles', () => {
    it('should define standard modulation schemes', () => {
      const profiles = modem.getModulationProfiles();

      expect(profiles).toHaveProperty('BPSK');
      expect(profiles).toHaveProperty('QPSK');
      expect(profiles).toHaveProperty('16QAM');
      expect(profiles).toHaveProperty('64QAM');
    });

    it('should specify constellation mappings', () => {
      const profiles = modem.getModulationProfiles();

      expect(profiles.BPSK.bitsPerSymbol).toBe(1);
      expect(profiles.QPSK.bitsPerSymbol).toBe(2);
      expect(profiles['16QAM'].bitsPerSymbol).toBe(4);
      expect(profiles['64QAM'].bitsPerSymbol).toBe(6);
    });

    it('should include SNR requirements for each modulation', () => {
      const profiles = modem.getModulationProfiles();

      expect(profiles.BPSK.minSNR).toBeLessThan(profiles.QPSK.minSNR);
      expect(profiles.QPSK.minSNR).toBeLessThan(profiles['16QAM'].minSNR);
      expect(profiles['16QAM'].minSNR).toBeLessThan(profiles['64QAM'].minSNR);
    });
  });

  describe('Transmission Modes', () => {
    it('should support normal and robust transmission modes', () => {
      const modes = modem.getTransmissionModes();

      expect(modes).toContain('normal');
      expect(modes).toContain('robust');
      expect(modes).toContain('high-throughput');
    });

    it('should configure FEC coding rates', () => {
      modem.setTransmissionMode('normal');
      let config = modem.getConfiguration();
      expect(config.codingRate).toBe(0.75); // 3/4 rate

      modem.setTransmissionMode('robust');
      config = modem.getConfiguration();
      expect(config.codingRate).toBe(0.5); // 1/2 rate

      modem.setTransmissionMode('high-throughput');
      config = modem.getConfiguration();
      expect(config.codingRate).toBe(0.875); // 7/8 rate
    });

    it('should adjust interleaving depth based on mode', () => {
      modem.setTransmissionMode('normal');
      let config = modem.getConfiguration();
      expect(config.interleaverDepth).toBe(4);

      modem.setTransmissionMode('robust');
      config = modem.getConfiguration();
      expect(config.interleaverDepth).toBe(8);
    });
  });

  describe('Channel Bandwidth Configuration', () => {
    it('should support 2.8 kHz channel bandwidth', () => {
      const config = modem.getConfiguration();

      expect(config.channelBandwidth).toBe(2800); // Hz
      expect(config.subcarrierSpacing).toBeCloseTo(2800 / 64, 1); // ~43.75 Hz
    });

    it('should calculate occupied bandwidth correctly', () => {
      const config = modem.getConfiguration();

      const occupiedBandwidth = config.numCarriers * config.subcarrierSpacing;
      expect(occupiedBandwidth).toBeLessThanOrEqual(2800);
      expect(occupiedBandwidth).toBeGreaterThan(2000); // Should use most of it
    });

    it('should support bandwidth scaling for different modes', () => {
      // Normal mode
      modem.setBandwidthMode('normal');
      expect(modem.getConfiguration().channelBandwidth).toBe(2800);

      // Wide mode (if supported)
      modem.setBandwidthMode('wide');
      expect(modem.getConfiguration().channelBandwidth).toBe(5600);

      // Narrow mode
      modem.setBandwidthMode('narrow');
      expect(modem.getConfiguration().channelBandwidth).toBe(1400);
    });
  });

  describe('Power Control Configuration', () => {
    it('should configure total transmit power', () => {
      const config = modem.getConfiguration();

      expect(config.totalPower).toBeGreaterThan(0);
      expect(config.totalPower).toBeLessThanOrEqual(100); // 100W max for amateur radio
    });

    it('should support per-carrier power control', () => {
      const carrierPowers = modem.getCarrierPowerLevels();

      expect(carrierPowers).toHaveLength(48);

      // Check power distribution
      const totalPower = carrierPowers.reduce((sum, p) => sum + p, 0);
      expect(totalPower).toBeCloseTo(modem.getConfiguration().totalPower, 1);
    });

    it('should implement water-filling power allocation', () => {
      // Set carrier SNRs
      const snrs = Array.from({ length: 48 }, () => 10 + Math.random() * 20);
      modem.setCarrierSNRs(snrs);

      // Apply water-filling
      modem.applyWaterFilling();
      const powers = modem.getCarrierPowerLevels();

      // Lower SNR carriers should get more power
      for (let i = 0; i < 47; i++) {
        if (snrs[i] < snrs[i + 1]) {
          expect(powers[i]).toBeGreaterThanOrEqual(powers[i + 1]);
        }
      }
    });
  });

  describe('Timing and Synchronization', () => {
    it('should configure frame timing parameters', () => {
      const config = modem.getConfiguration();

      expect(config.frameLength).toBeGreaterThan(0);
      expect(config.symbolsPerFrame).toBeGreaterThan(0);
      expect(config.frameDuration).toBeGreaterThan(0);
    });

    it('should include preamble for synchronization', () => {
      const preamble = modem.getPreambleSequence();

      expect(preamble).toBeDefined();
      expect(preamble.length).toBeGreaterThan(0);

      // Check preamble properties (should have good autocorrelation)
      const autocorr = modem.calculateAutocorrelation(preamble);
      expect(autocorr[0]).toBeGreaterThan(autocorr[1] * 10); // Sharp peak
    });

    it('should support timing offset correction', () => {
      const maxOffset = modem.getMaxTimingOffset();
      const resolution = modem.getTimingResolution();

      expect(maxOffset).toBeGreaterThan(0);
      expect(resolution).toBeGreaterThan(0);
      expect(resolution).toBeLessThan(1); // Sub-sample resolution
    });
  });

  describe('Configuration Persistence', () => {
    it('should save configuration to database', async () => {
      const config = {
        fftSize: 64,
        cyclicPrefixRatio: 0.25,
        sampleRate: 48000,
        channelBandwidth: 2800
      };

      await schema.saveConfig('ofdm_config', config);
      const loaded = await schema.getConfig('ofdm_config');

      expect(loaded).toEqual(config);
    });

    it('should save modulation profiles to database', async () => {
      const profiles = modem.getModulationProfiles();

      for (const [name, profile] of Object.entries(profiles)) {
        await schema.saveConfig(`modulation_${name}`, profile);
      }

      const loadedQPSK = await schema.getConfig('modulation_QPSK');
      expect(loadedQPSK).toBeDefined();
      expect(loadedQPSK.bitsPerSymbol).toBe(2);
    });

    it('should track configuration changes', async () => {
      await schema.saveConfig('sample_rate', 48000);

      // Change configuration
      await new Promise(resolve => setTimeout(resolve, 10));
      await schema.saveConfig('sample_rate', 96000);

      const value = await schema.getConfig('sample_rate');
      expect(value).toBe(96000);
    });
  });

  describe('Compliance and Standards', () => {
    it('should comply with 2.8 kHz bandwidth limit', () => {
      const config = modem.getConfiguration();
      const actualBandwidth = modem.calculateOccupiedBandwidth();

      expect(actualBandwidth).toBeLessThanOrEqual(2800);
    });

    it('should support FCC Part 97 emission designators', () => {
      const emissions = modem.getEmissionDesignators();

      expect(emissions).toContain('2K80J2D'); // 2.8kHz digital
      expect(emissions).toContain('2K80G1D'); // 2.8kHz phase modulation
    });

    it('should implement spurious emission limits', () => {
      const spuriousLimit = modem.getSpuriousEmissionLimit();

      expect(spuriousLimit).toBeLessThanOrEqual(-43); // dBc
    });

    it('should support required symbol rates for efficiency', () => {
      const config = modem.getConfiguration();
      const symbolRate = modem.getSampleRate() / config.totalSymbolLength;

      // Should achieve at least 30k symbols/sec for 100+ kbps
      expect(symbolRate).toBeGreaterThanOrEqual(30000);
    });
  });

  describe('Adaptive Configuration', () => {
    it('should adjust parameters based on channel conditions', () => {
      // Simulate poor channel
      modem.setChannelQuality('poor');
      let config = modem.getConfiguration();
      expect(config.codingRate).toBeLessThanOrEqual(0.5); // More FEC

      // Simulate good channel
      modem.setChannelQuality('excellent');
      config = modem.getConfiguration();
      expect(config.codingRate).toBeGreaterThanOrEqual(0.75); // Less FEC
    });

    it('should optimize for throughput or reliability', () => {
      modem.setOptimizationGoal('throughput');
      let config = modem.getConfiguration();
      expect(config.interleaverDepth).toBeLessThanOrEqual(4);

      modem.setOptimizationGoal('reliability');
      config = modem.getConfiguration();
      expect(config.interleaverDepth).toBeGreaterThanOrEqual(8);
    });

    it('should support dynamic reconfiguration', async () => {
      const initialConfig = modem.getConfiguration();

      // Change configuration
      modem.updateConfiguration({
        cyclicPrefixRatio: 0.125,
        codingRate: 0.875
      });

      const newConfig = modem.getConfiguration();

      expect(newConfig.cyclicPrefixRatio).toBe(0.125);
      expect(newConfig.codingRate).toBe(0.875);
      expect(newConfig.fftSize).toBe(initialConfig.fftSize); // Unchanged
    });
  });
});