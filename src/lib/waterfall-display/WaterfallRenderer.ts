/**
 * Waterfall Renderer
 * High-performance waterfall display with WebGL acceleration
 */

import type { SpectrumData } from '../spectrum-analyzer/models/SpectrumData.js';
import type { WaterfallConfiguration } from './models/WaterfallConfiguration.js';
import type { DisplayBuffer } from './models/DisplayBuffer.js';
import { ColorMapper } from './ColorMapper.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { WebGLWaterfallRenderer } from './WebGLWaterfallRenderer.js';

export class WaterfallRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private config: WaterfallConfiguration | null = null;
  private colorMapper: ColorMapper;
  private canvasRenderer: CanvasRenderer | null = null;
  private webglRenderer: WebGLWaterfallRenderer | null = null;
  private useWebGL = true;
  private isInitialized = false;
  private displayBuffer: DisplayBuffer | null = null;
  private renderStats = {
    frameCount: 0,
    lastFrameTime: 0,
    fps: 0,
    renderTime: 0
  };

  constructor(forceCanvas = false) {
    this.colorMapper = new ColorMapper();
    this.useWebGL = !forceCanvas;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.colorMapper.initialize();
    this.isInitialized = true;
  }

  async setCanvas(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.canvas = canvas;

    // Try WebGL first, fallback to Canvas 2D
    try {
      if (this.useWebGL) {
        this.webglRenderer = new WebGLWaterfallRenderer();
        await this.webglRenderer.initialize(canvas);
      }
    } catch (error) {
      this.useWebGL = false;
      this.webglRenderer = null;
    }

    // Always initialize canvas renderer as fallback
    if (!this.useWebGL || !this.webglRenderer) {
      this.canvasRenderer = new CanvasRenderer();
      await this.canvasRenderer.initialize(canvas);
    }
  }

  async configure(config: WaterfallConfiguration): Promise<void> {
    this.config = {
      ...config,
      enableScrolling: config.enableScrolling ?? true,
      scrollDirection: config.scrollDirection ?? 'down'
    };

    // Update colormap
    await this.colorMapper.setColormap(this.config.colormap);

    // Configure active renderer
    if (this.webglRenderer) {
      await this.webglRenderer.configure(this.config);
    } else if (this.canvasRenderer) {
      await this.canvasRenderer.configure(this.config);
    }

    // Initialize display buffer
    this.displayBuffer = {
      width: config.width,
      height: config.height,
      data: new Float32Array(config.width * config.height),
      metadata: {
        timestamp: Date.now(),
        sequenceNumber: 0,
        sampleRate: 48000,
        centerFrequency: 14070000,
        frequencySpan: 48000,
        timeSpan: config.height / config.updateRate,
        dataFormat: 'DECIBEL',
        compression: {
          enabled: false,
          algorithm: 'NONE',
          ratio: 1.0,
          lossless: true,
          quality: 1.0
        }
      },
      rendering: {
        colormap: {
          name: config.colormap,
          data: await this.colorMapper.getColormapData(config.colormap),
          size: 256,
          gamma: 1.0,
          invert: false
        },
        scaling: {
          minValue: config.minDb,
          maxValue: config.maxDb,
          scaling: 'LINEAR',
          autoScale: false,
          clipping: true
        },
        viewport: {
          x: 0,
          y: 0,
          width: config.width,
          height: config.height,
          zoom: 1.0,
          panX: 0,
          panY: 0
        }
      },
      history: {
        capacity: config.height,
        current: 0,
        lines: [],
        statistics: {
          totalLines: 0,
          averagePower: new Float32Array(config.width),
          peakPower: new Float32Array(config.width),
          minPower: new Float32Array(config.width),
          variance: new Float32Array(config.width),
          updateRate: config.updateRate
        },
        persistence: {
          enabled: false,
          decayRate: 0.1,
          threshold: config.minDb,
          colorMultiplier: 1.0,
          maxAge: 100
        }
      }
    };
  }

  async renderSpectrum(spectrum: SpectrumData): Promise<boolean> {
    if (!this.config || !this.displayBuffer) {
      return false;
    }

    // Validate spectrum data
    if (!spectrum || !spectrum.magnitudes || spectrum.magnitudes.length === 0) {
      return false;
    }

    if (spectrum.fftSize && spectrum.magnitudes.length !== spectrum.fftSize) {
      return false;
    }

    const startTime = performance.now();

    try {
      // Update display buffer with new spectrum data
      this.updateDisplayBuffer(spectrum);

      // Render using active renderer
      let success = false;
      if (this.webglRenderer) {
        success = await this.webglRenderer.render(this.displayBuffer);
      } else if (this.canvasRenderer) {
        success = await this.canvasRenderer.render(this.displayBuffer);
      } else {
        // If no renderer is available, return false
        return false;
      }

      // Update render statistics
      this.updateRenderStats(startTime);

      return success;
    } catch (error) {
      console.error('Waterfall rendering failed:', error);
      return false;
    }
  }

  private updateDisplayBuffer(spectrum: SpectrumData): void {
    if (!this.displayBuffer || !this.config) return;

    // Scroll existing data up
    if (this.config.enableScrolling && this.config.scrollDirection === 'down') {
      const { width, height } = this.displayBuffer;
      const data = this.displayBuffer.data;

      // Move all lines up by one
      for (let y = 0; y < height - 1; y++) {
        const sourceOffset = (y + 1) * width;
        const destOffset = y * width;
        data.set(data.subarray(sourceOffset, sourceOffset + width), destOffset);
      }

      // Add new spectrum data to bottom line
      const bottomLineOffset = (height - 1) * width;
      for (let x = 0; x < width && x < spectrum.magnitudes.length; x++) {
        data[bottomLineOffset + x] = spectrum.magnitudes[x];
      }
    }

    // Update metadata
    this.displayBuffer.metadata.timestamp = spectrum.timestamp;
    this.displayBuffer.metadata.sequenceNumber++;
    this.displayBuffer.metadata.centerFrequency = spectrum.centerFrequency;
    this.displayBuffer.metadata.sampleRate = spectrum.sampleRate;

    // Update history statistics
    const history = this.displayBuffer.history;
    history.statistics.totalLines++;

    // Add new line to history
    if (history.lines.length >= history.capacity) {
      history.lines.shift(); // Remove oldest
    }

    history.lines.push({
      data: new Float32Array(spectrum.magnitudes),
      timestamp: spectrum.timestamp,
      metadata: {
        centerFrequency: spectrum.centerFrequency,
        sampleRate: spectrum.sampleRate,
        noiseFloor: spectrum.noiseFloor,
        peakPower: spectrum.peakPower,
        signalCount: 0, // Would be calculated by signal detector
        quality: 1.0
      }
    });

    // Update running statistics
    this.updateHistoryStatistics(spectrum);
  }

  private updateHistoryStatistics(spectrum: SpectrumData): void {
    if (!this.displayBuffer) return;

    const stats = this.displayBuffer.history.statistics;
    const alpha = 0.1; // Exponential averaging factor

    // Update average power
    for (let i = 0; i < spectrum.magnitudes.length; i++) {
      if (i < stats.averagePower.length) {
        stats.averagePower[i] = stats.averagePower[i] * (1 - alpha) + spectrum.magnitudes[i] * alpha;
        stats.peakPower[i] = Math.max(stats.peakPower[i], spectrum.magnitudes[i]);
        stats.minPower[i] = Math.min(stats.minPower[i], spectrum.magnitudes[i]);

        // Update variance estimate
        const diff = spectrum.magnitudes[i] - stats.averagePower[i];
        stats.variance[i] = stats.variance[i] * (1 - alpha) + diff * diff * alpha;
      }
    }
  }

  private updateRenderStats(startTime: number): void {
    const now = performance.now();
    this.renderStats.renderTime = now - startTime;
    this.renderStats.frameCount++;

    // Calculate FPS every second
    if (now - this.renderStats.lastFrameTime > 1000) {
      this.renderStats.fps = this.renderStats.frameCount;
      this.renderStats.frameCount = 0;
      this.renderStats.lastFrameTime = now;
    }
  }

  getPerformanceMetrics() {
    return {
      fps: this.renderStats.fps,
      frameTime: this.renderStats.renderTime,
      memoryUsage: this.displayBuffer ?
        (this.displayBuffer.data.byteLength +
         this.displayBuffer.history.lines.reduce((sum, line) => sum + line.data.byteLength, 0)) / 1024 / 1024 : 0,
      gpuMemoryUsage: this.webglRenderer ? 0 : 0, // Would be calculated by WebGL renderer
      droppedFrames: 0, // Would be tracked based on target frame rate
      renderTime: this.renderStats.renderTime
    };
  }

  async cleanup(): Promise<void> {
    if (this.webglRenderer) {
      await this.webglRenderer.cleanup();
      this.webglRenderer = null;
    }

    if (this.canvasRenderer) {
      await this.canvasRenderer.cleanup();
      this.canvasRenderer = null;
    }

    this.canvas = null;
    this.config = null;
    this.displayBuffer = null;
    this.isInitialized = false;
  }
}