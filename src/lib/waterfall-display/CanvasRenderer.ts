/**
 * Canvas Renderer
 * 2D Canvas fallback renderer for waterfall display
 */

import type { DisplayBuffer } from './models/DisplayBuffer.js';
import type { WaterfallConfiguration } from './models/WaterfallConfiguration.js';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private config: WaterfallConfiguration | null = null;
  private imageData: ImageData | null = null;
  private colorLUT: Uint8Array | null = null;
  private isInitialized = false;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Unable to get 2D canvas context');
    }

    this.ctx = ctx;
    this.isInitialized = true;
  }

  async configure(config: WaterfallConfiguration): Promise<void> {
    if (!this.isInitialized || !this.canvas || !this.ctx) {
      throw new Error('Canvas renderer not initialized');
    }

    this.config = config;

    // Resize canvas if needed
    if (this.canvas.width !== config.width || this.canvas.height !== config.height) {
      this.canvas.width = config.width;
      this.canvas.height = config.height;
    }

    // Create image data buffer
    this.imageData = this.ctx.createImageData(config.width, config.height);

    // Generate color lookup table
    this.generateColorLUT(config);
  }

  private generateColorLUT(config: WaterfallConfiguration): void {
    const lutSize = 256;
    this.colorLUT = new Uint8Array(lutSize * 4); // RGBA

    const range = config.maxDb - config.minDb;

    for (let i = 0; i < lutSize; i++) {
      const value = config.minDb + (i / (lutSize - 1)) * range;
      const normalizedValue = (value - config.minDb) / range;

      // Apply colormap
      const color = this.getColorFromMap(normalizedValue, config.colormap);

      this.colorLUT[i * 4] = color[0];     // R
      this.colorLUT[i * 4 + 1] = color[1]; // G
      this.colorLUT[i * 4 + 2] = color[2]; // B
      this.colorLUT[i * 4 + 3] = 255;      // A
    }
  }

  private getColorFromMap(value: number, colormap: string): [number, number, number] {
    // Clamp value to [0, 1]
    const t = Math.max(0, Math.min(1, value));

    switch (colormap) {
      case 'viridis':
        return this.viridisColor(t);
      case 'plasma':
        return this.plasmaColor(t);
      case 'jet':
        return this.jetColor(t);
      case 'grayscale':
        return this.grayscaleColor(t);
      case 'turbo':
        return this.turboColor(t);
      case 'inferno':
        return this.infernoColor(t);
      case 'magma':
        return this.magmaColor(t);
      case 'cividis':
        return this.cividisColor(t);
      default:
        return this.viridisColor(t);
    }
  }

  private viridisColor(t: number): [number, number, number] {
    const r = Math.max(0, Math.min(255, Math.round(255 * (0.267 + t * (1.246 * t * t - 2.162 * t + 1.165)))));
    const g = Math.max(0, Math.min(255, Math.round(255 * (0.005 + t * (2.810 * t * t - 3.200 * t + 1.058)))));
    const b = Math.max(0, Math.min(255, Math.round(255 * (0.329 + t * (2.449 * t * t - 5.359 * t + 2.268)))));
    return [r, g, b];
  }

  private plasmaColor(t: number): [number, number, number] {
    const r = Math.max(0, Math.min(255, Math.round(255 * (0.050 + t * (2.330 * t * t - 1.120 * t + 0.580)))));
    const g = Math.max(0, Math.min(255, Math.round(255 * (0.020 + t * t * (2.910 - 1.460 * t)))));
    const b = Math.max(0, Math.min(255, Math.round(255 * (0.580 + t * (-2.940 + t * (7.240 - 5.670 * t))))));
    return [r, g, b];
  }

  private jetColor(t: number): [number, number, number] {
    let r = 0, g = 0, b = 0;

    if (t < 0.125) {
      b = 0.5 + 4 * t;
    } else if (t < 0.375) {
      b = 1;
      g = 4 * (t - 0.125);
    } else if (t < 0.625) {
      b = 1 - 4 * (t - 0.375);
      g = 1;
      r = 4 * (t - 0.375);
    } else if (t < 0.875) {
      g = 1 - 4 * (t - 0.625);
      r = 1;
    } else {
      r = 1 - 4 * (t - 0.875);
    }

    return [
      Math.round(255 * Math.max(0, Math.min(1, r))),
      Math.round(255 * Math.max(0, Math.min(1, g))),
      Math.round(255 * Math.max(0, Math.min(1, b)))
    ];
  }

  private grayscaleColor(t: number): [number, number, number] {
    const intensity = Math.round(255 * t);
    return [intensity, intensity, intensity];
  }

  private turboColor(t: number): [number, number, number] {
    const r = Math.max(0, Math.min(1, 0.19 + t * (2.97 * t * t - 4.23 * t + 1.94)));
    const g = Math.max(0, Math.min(1, 0.09 + t * (6.15 * t * t - 8.45 * t + 2.45)));
    const b = Math.max(0, Math.min(1, 0.47 + t * (1.38 * t * t - 4.72 * t + 2.28)));
    return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
  }

  private infernoColor(t: number): [number, number, number] {
    const r = Math.max(0, Math.min(1, -0.002 + t * (3.648 * t * t - 2.653 * t + 0.849)));
    const g = Math.max(0, Math.min(1, 0.015 + t * t * (2.490 - 1.168 * t)));
    const b = Math.max(0, Math.min(1, 0.420 + t * (-2.332 + t * (4.321 - 2.395 * t))));
    return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
  }

  private magmaColor(t: number): [number, number, number] {
    const r = Math.max(0, Math.min(1, -0.015 + t * (3.554 * t * t - 2.456 * t + 0.774)));
    const g = Math.max(0, Math.min(1, 0.021 + t * t * (2.378 - 1.168 * t)));
    const b = Math.max(0, Math.min(1, 0.495 + t * (-1.970 + t * (2.895 - 1.648 * t))));
    return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
  }

  private cividisColor(t: number): [number, number, number] {
    const r = Math.max(0, Math.min(1, 0.000 + t * (1.145 * t * t - 0.456 * t + 0.361)));
    const g = Math.max(0, Math.min(1, 0.126 + t * (0.925 * t * t - 0.562 * t + 0.559)));
    const b = Math.max(0, Math.min(1, 0.304 + t * (0.637 * t * t - 1.037 * t + 0.722)));
    return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
  }

  async render(displayBuffer: DisplayBuffer): Promise<boolean> {
    if (!this.isInitialized || !this.ctx || !this.imageData || !this.colorLUT || !this.config) {
      return false;
    }

    try {
      const { width, height } = displayBuffer;
      const data = displayBuffer.data;
      const pixels = this.imageData.data;
      const minDb = this.config.minDb;
      const maxDb = this.config.maxDb;
      const range = maxDb - minDb;

      // Convert spectrum data to color pixels
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dataIndex = y * width + x;
          const pixelIndex = dataIndex * 4;

          // Get spectrum value and normalize to [0, 255]
          const spectrumValue = data[dataIndex];
          const normalizedValue = Math.max(0, Math.min(255,
            Math.round(255 * (spectrumValue - minDb) / range)
          ));

          // Get color from lookup table
          const colorIndex = normalizedValue * 4;
          pixels[pixelIndex] = this.colorLUT[colorIndex];     // R
          pixels[pixelIndex + 1] = this.colorLUT[colorIndex + 1]; // G
          pixels[pixelIndex + 2] = this.colorLUT[colorIndex + 2]; // B
          pixels[pixelIndex + 3] = this.colorLUT[colorIndex + 3]; // A
        }
      }

      // Draw to canvas
      this.ctx.putImageData(this.imageData, 0, 0);

      return true;
    } catch (error) {
      console.error('Canvas rendering failed:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    this.canvas = null;
    this.ctx = null;
    this.config = null;
    this.imageData = null;
    this.colorLUT = null;
    this.isInitialized = false;
  }
}