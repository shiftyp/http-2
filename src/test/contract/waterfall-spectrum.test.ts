/**
 * Contract Test: Waterfall Spectrum API
 * Tests real-time spectrum data processing and visualization
 *
 * CRITICAL: These tests MUST FAIL initially (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpectrumAnalyzer } from '../../lib/spectrum-analyzer/index.js';
import { WaterfallRenderer } from '../../lib/waterfall-display/WaterfallRenderer.js';
import type { SpectrumData, WaterfallConfiguration } from '../../lib/waterfall-display/index.js';

describe('Waterfall Spectrum API Contracts', () => {
  let spectrumAnalyzer: SpectrumAnalyzer;
  let waterfallRenderer: WaterfallRenderer;

  beforeEach(async () => {
    spectrumAnalyzer = new SpectrumAnalyzer();
    // Force canvas renderer for test environment
    waterfallRenderer = new WaterfallRenderer(true);

    await spectrumAnalyzer.initialize();
    await waterfallRenderer.initialize();
  });

  afterEach(async () => {
    await spectrumAnalyzer.cleanup();
    await waterfallRenderer.cleanup();
  });

  describe('Spectrum Data Processing Contract', () => {
    it('should process IQ samples and generate spectrum data', async () => {
      // This test MUST FAIL initially
      const mockIQData = new Float32Array(4096);

      // Generate test signal at 1 kHz
      for (let i = 0; i < mockIQData.length; i += 2) {
        const t = i / 2 / 48000; // Sample time
        mockIQData[i] = Math.cos(2 * Math.PI * 1000 * t);     // I component
        mockIQData[i + 1] = Math.sin(2 * Math.PI * 1000 * t); // Q component
      }

      const spectrumData = await spectrumAnalyzer.processIQSamples(
        mockIQData,
        48000, // Sample rate
        14639000 // Center frequency (20m band)
      );

      expect(spectrumData).toBeDefined();
      expect(spectrumData.frequencies).toBeInstanceOf(Float32Array);
      expect(spectrumData.magnitudes).toBeInstanceOf(Float32Array);
      expect(spectrumData.frequencies.length).toBe(spectrumData.magnitudes.length);
      expect(spectrumData.centerFrequency).toBe(14639000);
      expect(spectrumData.sampleRate).toBe(48000);
      expect(spectrumData.timestamp).toBeGreaterThan(0);
    });

    it('should calculate noise floor accurately', async () => {
      // This test MUST FAIL initially
      const noiseData = new Float32Array(2048);

      // Generate white noise
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() - 0.5) * 0.1;
      }

      const spectrumData = await spectrumAnalyzer.processIQSamples(
        noiseData,
        48000,
        14639000
      );

      expect(spectrumData.noiseFloor).toBeDefined();
      expect(spectrumData.noiseFloor).toBeLessThan(-40); // Should be below -40 dBm
      expect(spectrumData.noiseFloor).toBeGreaterThan(-120); // Should be above -120 dBm
    });

    it('should handle different FFT sizes', async () => {
      // This test MUST FAIL initially
      const testSizes = [512, 1024, 2048, 4096];

      for (const fftSize of testSizes) {
        const iqData = new Float32Array(fftSize * 2);
        iqData.fill(0.1);

        const spectrum = await spectrumAnalyzer.processIQSamples(iqData, 48000, 14639000);

        expect(spectrum.fftSize).toBe(fftSize);
        expect(spectrum.frequencies.length).toBe(fftSize);
        expect(spectrum.magnitudes.length).toBe(fftSize);
      }
    });

    it('should apply window functions correctly', async () => {
      // This test MUST FAIL initially
      const iqData = new Float32Array(2048);

      // Generate sinusoidal signal at bin 100 (better for window function testing)
      const signalBin = 100;
      const sampleRate = 48000;
      const freq = (signalBin * sampleRate) / 1024; // Target frequency

      for (let i = 0; i < 1024; i++) {
        const phase = 2 * Math.PI * freq * i / sampleRate;
        iqData[i * 2] = Math.cos(phase);     // I component
        iqData[i * 2 + 1] = Math.sin(phase); // Q component
      }

      // Test with Hann window
      const spectrum = await spectrumAnalyzer.processIQSamples(iqData, sampleRate, 14639000);

      // Window function should reduce spectral leakage
      // Find peak in spectrum (should be around center due to FFT shift)
      let peakIndex = 0;
      let peakLevel = spectrum.magnitudes[0];
      for (let i = 1; i < spectrum.magnitudes.length; i++) {
        if (spectrum.magnitudes[i] > peakLevel) {
          peakLevel = spectrum.magnitudes[i];
          peakIndex = i;
        }
      }

      // Compare peak to side lobes (far from peak)
      const sidelobeStart = Math.max(0, peakIndex - 400);
      const sidelobeEnd = Math.min(spectrum.magnitudes.length, peakIndex + 400);
      const sidelobeLevel = Math.max(
        ...spectrum.magnitudes.slice(0, sidelobeStart),
        ...spectrum.magnitudes.slice(sidelobeEnd)
      );

      expect(peakLevel).toBeGreaterThan(sidelobeLevel);
      expect(peakLevel - sidelobeLevel).toBeGreaterThan(20); // At least 20 dB dynamic range
    });
  });

  describe('Waterfall Rendering Contract', () => {
    it('should render spectrum data to waterfall display', async () => {
      // This test MUST FAIL initially
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;

      const config: WaterfallConfiguration = {
        width: 1024,
        height: 512,
        fftSize: 2048,
        colormap: 'viridis',
        minDb: -120,
        maxDb: -20,
        updateRate: 30
      };

      await waterfallRenderer.setCanvas(canvas);
      await waterfallRenderer.configure(config);

      // Generate test spectrum data
      const spectrum: SpectrumData = {
        frequencies: new Float32Array(2048),
        magnitudes: new Float32Array(2048),
        phases: new Float32Array(2048),
        timestamp: Date.now(),
        centerFrequency: 14639000,
        sampleRate: 48000,
        noiseFloor: -100,
        peakPower: -50,
        fftSize: 2048
      };

      // Fill with test data
      for (let i = 0; i < 2048; i++) {
        spectrum.frequencies[i] = 14639000 + (i - 1024) * 48000 / 2048;
        spectrum.magnitudes[i] = -100 + Math.random() * 50;
      }

      const rendered = await waterfallRenderer.renderSpectrum(spectrum);
      expect(rendered).toBe(true);

      // Note: JSDOM doesn't fully support putImageData, so we can't test pixel data
      // but successful rendering return value indicates the render pipeline works
      expect(rendered).toBe(true);
    });

    it('should maintain 30 FPS update rate', async () => {
      // This test MUST FAIL initially
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;

      await waterfallRenderer.setCanvas(canvas);

      let frameCount = 0;
      const startTime = performance.now();

      // Generate spectrum updates
      const updatePromises: Promise<boolean>[] = [];

      for (let frame = 0; frame < 30; frame++) {
        const spectrum: SpectrumData = {
          frequencies: new Float32Array(1024),
          magnitudes: new Float32Array(1024),
          phases: new Float32Array(1024),
          timestamp: Date.now(),
          centerFrequency: 14639000,
          sampleRate: 48000,
          noiseFloor: -100,
          peakPower: -50,
          fftSize: 1024
        };

        // Fill with varying test data
        for (let i = 0; i < 1024; i++) {
          spectrum.magnitudes[i] = -100 + Math.sin(i * frame * 0.01) * 30;
        }

        updatePromises.push(waterfallRenderer.renderSpectrum(spectrum));
      }

      await Promise.all(updatePromises);
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;

      const fps = (30 * 1000) / elapsedTime;
      expect(fps).toBeGreaterThanOrEqual(25); // Allow some tolerance
    });

    it('should handle colormap changes', async () => {
      // This test MUST FAIL initially
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;

      await waterfallRenderer.setCanvas(canvas);

      const colormaps = ['viridis', 'plasma', 'jet', 'grayscale'] as const;

      for (const colormap of colormaps) {
        const config: WaterfallConfiguration = {
          width: 256,
          height: 256,
          fftSize: 256,
          colormap,
          minDb: -100,
          maxDb: -20,
          updateRate: 30
        };

        await waterfallRenderer.configure(config);

        // Render test spectrum
        const spectrum: SpectrumData = {
          frequencies: new Float32Array(256),
          magnitudes: new Float32Array(256),
          phases: new Float32Array(256),
          timestamp: Date.now(),
          centerFrequency: 14639000,
          sampleRate: 48000,
          noiseFloor: -100,
          peakPower: -20,
          fftSize: 256
        };

        // Create gradient test pattern
        for (let i = 0; i < 256; i++) {
          spectrum.magnitudes[i] = -100 + (i / 256) * 80;
        }

        const rendered = await waterfallRenderer.renderSpectrum(spectrum);
        expect(rendered).toBe(true);

        // Just verify the rendering was successful (JSDOM canvas limitations)
        expect(rendered).toBe(true);
      }
    });
  });

  describe('Performance Contract', () => {
    it('should process FFT in under 50ms', async () => {
      // This test MUST FAIL initially
      const iqData = new Float32Array(8192); // 4K samples
      iqData.fill(0.1);

      const startTime = performance.now();
      const spectrum = await spectrumAnalyzer.processIQSamples(iqData, 96000, 14639000);
      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(50); // <50ms requirement
      expect(spectrum).toBeDefined();
    });

    it('should handle memory efficiently during long runs', async () => {
      // This test MUST FAIL initially
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      await waterfallRenderer.setCanvas(canvas);

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Render 100 frames
      for (let i = 0; i < 100; i++) {
        const spectrum: SpectrumData = {
          frequencies: new Float32Array(1024),
          magnitudes: new Float32Array(1024),
          phases: new Float32Array(1024),
          timestamp: Date.now(),
          centerFrequency: 14639000,
          sampleRate: 48000,
          noiseFloor: -100,
          peakPower: -50,
          fftSize: 1024
        };

        spectrum.magnitudes.fill(-80 + Math.random() * 20);
        await waterfallRenderer.renderSpectrum(spectrum);
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not leak more than 5MB during test
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });

    it('should support real-time streaming', async () => {
      // This test MUST FAIL initially
      let framesRendered = 0;
      const targetFrames = 60; // 2 seconds at 30 FPS

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      await waterfallRenderer.setCanvas(canvas);

      const startTime = Date.now();

      // Simulate real-time spectrum streaming
      const streamPromise = new Promise<void>((resolve) => {
        const renderFrame = async () => {
          if (framesRendered >= targetFrames) {
            resolve();
            return;
          }

          const spectrum: SpectrumData = {
            frequencies: new Float32Array(1024),
            magnitudes: new Float32Array(1024),
            phases: new Float32Array(1024),
            timestamp: Date.now(),
            centerFrequency: 14639000,
            sampleRate: 48000,
            noiseFloor: -100,
            peakPower: -40,
            fftSize: 1024
          };

          // Simulate changing spectrum
          for (let i = 0; i < 1024; i++) {
            spectrum.magnitudes[i] = -100 + Math.sin(i * 0.01 + framesRendered * 0.1) * 30;
          }

          await waterfallRenderer.renderSpectrum(spectrum);
          framesRendered++;

          // Schedule next frame
          setTimeout(renderFrame, 1000 / 30); // 30 FPS
        };

        renderFrame();
      });

      await streamPromise;

      const endTime = Date.now();
      const actualFps = (framesRendered * 1000) / (endTime - startTime);

      expect(framesRendered).toBe(targetFrames);
      expect(actualFps).toBeGreaterThanOrEqual(25); // Should maintain near 30 FPS
    });
  });

  describe('Error Handling Contract', () => {
    it('should handle invalid input data gracefully', async () => {
      // This test MUST FAIL initially
      const invalidIQData = new Float32Array(0); // Empty array

      await expect(spectrumAnalyzer.processIQSamples(invalidIQData, 48000, 14639000))
        .rejects.toThrow();

      // Test with NaN values
      const nanData = new Float32Array(1024);
      nanData.fill(NaN);

      await expect(spectrumAnalyzer.processIQSamples(nanData, 48000, 14639000))
        .rejects.toThrow();
    });

    it('should handle canvas context loss', async () => {
      // This test MUST FAIL initially
      const canvas = document.createElement('canvas');
      await waterfallRenderer.setCanvas(canvas);

      // Simulate context loss
      const ctx = canvas.getContext('2d');
      (ctx as any).isContextLost = () => true;

      const spectrum: SpectrumData = {
        frequencies: new Float32Array(1024),
        magnitudes: new Float32Array(1024),
        phases: new Float32Array(1024),
        timestamp: Date.now(),
        centerFrequency: 14639000,
        sampleRate: 48000,
        noiseFloor: -100,
        peakPower: -50,
        fftSize: 1024
      };

      // Should handle context loss gracefully
      const result = await waterfallRenderer.renderSpectrum(spectrum);
      expect(result).toBe(false); // Should fail gracefully
    });

    it('should recover from rendering errors', async () => {
      // This test MUST FAIL initially
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      await waterfallRenderer.setCanvas(canvas);

      // Configure waterfall first
      const config: WaterfallConfiguration = {
        width: 1024,
        height: 512,
        fftSize: 1024,
        colormap: 'viridis',
        minDb: -120,
        maxDb: -20,
        updateRate: 30
      };
      await waterfallRenderer.configure(config);

      // First, render successfully
      const validSpectrum: SpectrumData = {
        frequencies: new Float32Array(1024),
        magnitudes: new Float32Array(1024),
        phases: new Float32Array(1024),
        timestamp: Date.now(),
        centerFrequency: 14639000,
        sampleRate: 48000,
        noiseFloor: -100,
        peakPower: -50,
        fftSize: 1024
      };

      // Fill with test data
      for (let i = 0; i < 1024; i++) {
        validSpectrum.magnitudes[i] = -100 + Math.random() * 50;
      }

      let success = await waterfallRenderer.renderSpectrum(validSpectrum);
      expect(success).toBe(true);

      // Then, try to render invalid data
      const invalidSpectrum = {
        ...validSpectrum,
        magnitudes: new Float32Array(0) // Invalid size
      };

      success = await waterfallRenderer.renderSpectrum(invalidSpectrum);
      expect(success).toBe(false);

      // Should recover and render valid data again
      success = await waterfallRenderer.renderSpectrum(validSpectrum);
      expect(success).toBe(true);
    });
  });
});