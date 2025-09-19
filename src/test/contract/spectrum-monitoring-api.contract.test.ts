/**
 * Contract Test: Spectrum Monitoring API
 * Tests the spectrum analysis and monitoring API contracts
 *
 * CRITICAL: These tests MUST FAIL initially (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { SpectrumData, SignalPeak, FrequencyRange, MonitoringConfiguration } from '../../src/lib/sdr-support';
import { SpectrumMonitor } from '../../src/lib/sdr-support';

describe('Spectrum Monitoring API Contracts', () => {
  let spectrumMonitor: SpectrumMonitor;

  beforeEach(async () => {
    // Initialize spectrum monitor
    spectrumMonitor = new SpectrumMonitor();
    await spectrumMonitor.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await spectrumMonitor.cleanup();
  });

  describe('Monitoring Configuration Contract', () => {
    it('should configure monitoring frequency ranges', async () => {
      // This test MUST FAIL initially
      const config: MonitoringConfiguration = {
        frequencyRanges: [
          { startFreq: 144000000, endFreq: 148000000, name: '2m' },
          { startFreq: 420000000, endFreq: 450000000, name: '70cm' }
        ],
        fftSize: 2048,
        updateRate: 30,
        signalThreshold: -80,
        enableAutoDiscovery: true
      };

      const configured = await spectrumMonitor.setConfiguration(config);
      expect(configured).toBe(true);

      const currentConfig = await spectrumMonitor.getConfiguration();
      expect(currentConfig).toEqual(config);
    });

    it('should validate monitoring configuration', async () => {
      // This test MUST FAIL initially
      const validConfig: MonitoringConfiguration = {
        frequencyRanges: [
          { startFreq: 144000000, endFreq: 148000000, name: '2m' }
        ],
        fftSize: 2048,
        updateRate: 30,
        signalThreshold: -80,
        enableAutoDiscovery: true
      };

      const isValid = spectrumMonitor.validateConfiguration(validConfig);
      expect(isValid).toBe(true);

      // Test invalid configuration
      const invalidConfig = {
        ...validConfig,
        fftSize: 1000 // Not power of 2
      };

      const isInvalid = spectrumMonitor.validateConfiguration(invalidConfig);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Spectrum Analysis Contract', () => {
    it('should start spectrum monitoring', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      const started = await spectrumMonitor.startMonitoring(ranges);
      expect(started).toBe(true);

      const isMonitoring = spectrumMonitor.isMonitoring();
      expect(isMonitoring).toBe(true);
    });

    it('should generate spectrum data', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      await spectrumMonitor.startMonitoring(ranges);

      // Wait for spectrum data
      const spectrumData = await new Promise<SpectrumData>((resolve) => {
        spectrumMonitor.onSpectrumUpdate((data: SpectrumData) => {
          resolve(data);
        });
      });

      expect(spectrumData).toBeDefined();
      expect(spectrumData.frequencies).toBeDefined();
      expect(spectrumData.magnitudes).toBeDefined();
      expect(spectrumData.frequencies.length).toBe(spectrumData.magnitudes.length);
      expect(spectrumData.timestamp).toBeGreaterThan(0);
      expect(spectrumData.centerFrequency).toBe(146000000); // Center of 2m band
    });

    it('should detect signal peaks', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      await spectrumMonitor.startMonitoring(ranges);

      // Wait for signal detection
      const peaks = await new Promise<SignalPeak[]>((resolve) => {
        spectrumMonitor.onSignalDetected((signals: SignalPeak[]) => {
          resolve(signals);
        });
      });

      expect(Array.isArray(peaks)).toBe(true);

      peaks.forEach(peak => {
        expect(peak).toHaveProperty('frequency');
        expect(peak).toHaveProperty('magnitude');
        expect(peak).toHaveProperty('bandwidth');
        expect(peak).toHaveProperty('snr');
        expect(peak).toHaveProperty('timestamp');
        expect(peak.frequency).toBeGreaterThanOrEqual(144000000);
        expect(peak.frequency).toBeLessThanOrEqual(148000000);
      });
    });

    it('should calculate SNR correctly', async () => {
      // This test MUST FAIL initially
      const testSpectrum = new Float32Array([
        -80, -79, -60, -78, -81, -75, -82, -80 // Signal at index 2
      ]);

      const snr = spectrumMonitor.calculateSNR(testSpectrum, 2, 1);
      expect(snr).toBeGreaterThan(15); // Signal should be ~20 dB above noise floor
    });

    it('should stop spectrum monitoring', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      await spectrumMonitor.startMonitoring(ranges);
      const stopped = await spectrumMonitor.stopMonitoring();

      expect(stopped).toBe(true);

      const isMonitoring = spectrumMonitor.isMonitoring();
      expect(isMonitoring).toBe(false);
    });
  });

  describe('Multi-band Monitoring Contract', () => {
    it('should monitor multiple frequency bands simultaneously', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' },
        { startFreq: 420000000, endFreq: 450000000, name: '70cm' },
        { startFreq: 28000000, endFreq: 29700000, name: '10m' }
      ];

      const started = await spectrumMonitor.startMonitoring(ranges);
      expect(started).toBe(true);

      // Verify monitoring all bands
      const monitoredBands = spectrumMonitor.getMonitoredBands();
      expect(monitoredBands).toHaveLength(3);
      expect(monitoredBands.map(b => b.name)).toEqual(['2m', '70cm', '10m']);
    });

    it('should switch between frequency bands efficiently', async () => {
      // This test MUST FAIL initially
      const band1: FrequencyRange = { startFreq: 144000000, endFreq: 148000000, name: '2m' };
      const band2: FrequencyRange = { startFreq: 420000000, endFreq: 450000000, name: '70cm' };

      await spectrumMonitor.startMonitoring([band1]);

      const startTime = Date.now();
      const switched = await spectrumMonitor.switchToBand(band2);
      const switchTime = Date.now() - startTime;

      expect(switched).toBe(true);
      expect(switchTime).toBeLessThan(100); // Should switch in <100ms

      const currentBand = spectrumMonitor.getCurrentBand();
      expect(currentBand).toEqual(band2);
    });

    it('should handle band priority switching', async () => {
      // This test MUST FAIL initially
      const normalBand: FrequencyRange = { startFreq: 144000000, endFreq: 148000000, name: '2m' };
      const emergencyBand: FrequencyRange = {
        startFreq: 146520000,
        endFreq: 146520000,
        name: 'emergency',
        priority: 1 // High priority
      };

      await spectrumMonitor.startMonitoring([normalBand]);

      // Emergency band should take priority
      const emergencyTriggered = await spectrumMonitor.triggerEmergencyMonitoring(emergencyBand);
      expect(emergencyTriggered).toBe(true);

      const currentBand = spectrumMonitor.getCurrentBand();
      expect(currentBand.priority).toBe(1);
    });
  });

  describe('Performance Contract', () => {
    it('should process FFT in under 100ms', async () => {
      // This test MUST FAIL initially
      const testData = new Float32Array(2048);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = Math.sin(2 * Math.PI * i * 100 / testData.length);
      }

      const startTime = performance.now();
      const spectrum = await spectrumMonitor.processFFT(testData);
      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(100); // <100ms requirement
      expect(spectrum).toBeDefined();
      expect(spectrum.length).toBe(testData.length / 2);
    });

    it('should maintain 30 FPS update rate', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      await spectrumMonitor.startMonitoring(ranges);

      let updateCount = 0;
      const startTime = Date.now();

      await new Promise<void>((resolve) => {
        spectrumMonitor.onSpectrumUpdate(() => {
          updateCount++;
          if (updateCount >= 30) {
            resolve();
          }
        });
      });

      const elapsedTime = Date.now() - startTime;
      const fps = (updateCount * 1000) / elapsedTime;

      expect(fps).toBeGreaterThanOrEqual(25); // Allow 5 FPS tolerance
    });

    it('should handle memory efficiently', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      await spectrumMonitor.startMonitoring(ranges);

      // Run for 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not leak more than 10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling Contract', () => {
    it('should handle invalid frequency ranges', async () => {
      // This test MUST FAIL initially
      const invalidRange: FrequencyRange = {
        startFreq: 1000000000, // 1 GHz
        endFreq: 500000000,    // 500 MHz (end < start)
        name: 'invalid'
      };

      await expect(spectrumMonitor.startMonitoring([invalidRange]))
        .rejects.toThrow('Invalid frequency range');
    });

    it('should handle device disconnection gracefully', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      await spectrumMonitor.startMonitoring(ranges);

      // Simulate device disconnection
      spectrumMonitor.simulateDeviceDisconnection();

      // Should handle gracefully and stop monitoring
      const isMonitoring = spectrumMonitor.isMonitoring();
      expect(isMonitoring).toBe(false);
    });

    it('should recover from FFT processing errors', async () => {
      // This test MUST FAIL initially
      const ranges: FrequencyRange[] = [
        { startFreq: 144000000, endFreq: 148000000, name: '2m' }
      ];

      await spectrumMonitor.startMonitoring(ranges);

      // Inject bad data that should cause FFT error
      const badData = new Float32Array(1000); // Wrong size
      badData.fill(NaN);

      // Should not crash, should continue monitoring
      const recovered = await spectrumMonitor.recoverFromError(badData);
      expect(recovered).toBe(true);

      const isMonitoring = spectrumMonitor.isMonitoring();
      expect(isMonitoring).toBe(true);
    });
  });
});