/**
 * Color Mapper
 * Generates colormap data for waterfall display
 */

import type { ColormapType } from './models/WaterfallConfiguration.js';

export class ColorMapper {
  private colormaps = new Map<string, Uint8Array>();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Generate built-in colormaps
    this.generateViridis();
    this.generatePlasma();
    this.generateJet();
    this.generateGrayscale();
    this.generateTurbo();
    this.generateInferno();
    this.generateMagma();
    this.generateCividis();

    this.isInitialized = true;
  }

  async setColormap(type: ColormapType): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Colormap data is already generated during initialization
    if (!this.colormaps.has(type)) {
      console.warn(`Colormap ${type} not found, using viridis`);
    }
  }

  async getColormapData(type: ColormapType): Promise<Uint8Array> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.colormaps.get(type) || this.colormaps.get('viridis')!;
  }

  private generateViridis(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Viridis colormap approximation
      const r = Math.max(0, Math.min(255, Math.round(255 * (0.267 + t * (1.246 * t * t - 2.162 * t + 1.165)))));
      const g = Math.max(0, Math.min(255, Math.round(255 * (0.005 + t * (2.810 * t * t - 3.200 * t + 1.058)))));
      const b = Math.max(0, Math.min(255, Math.round(255 * (0.329 + t * (2.449 * t * t - 5.359 * t + 2.268)))));

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('viridis', data);
  }

  private generatePlasma(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Plasma colormap approximation
      const r = Math.max(0, Math.min(255, Math.round(255 * (0.050 + t * (2.330 * t * t - 1.120 * t + 0.580)))));
      const g = Math.max(0, Math.min(255, Math.round(255 * (0.020 + t * t * (2.910 - 1.460 * t)))));
      const b = Math.max(0, Math.min(255, Math.round(255 * (0.580 + t * (-2.940 + t * (7.240 - 5.670 * t))))));

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('plasma', data);
  }

  private generateJet(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Jet colormap
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

      data[i * 4] = Math.round(255 * Math.max(0, Math.min(1, r)));
      data[i * 4 + 1] = Math.round(255 * Math.max(0, Math.min(1, g)));
      data[i * 4 + 2] = Math.round(255 * Math.max(0, Math.min(1, b)));
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('jet', data);
  }

  private generateGrayscale(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const intensity = i;

      data[i * 4] = intensity;
      data[i * 4 + 1] = intensity;
      data[i * 4 + 2] = intensity;
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('grayscale', data);
  }

  private generateTurbo(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Turbo colormap approximation
      const r = Math.max(0, Math.min(1, 0.19 + t * (2.97 * t * t - 4.23 * t + 1.94)));
      const g = Math.max(0, Math.min(1, 0.09 + t * (6.15 * t * t - 8.45 * t + 2.45)));
      const b = Math.max(0, Math.min(1, 0.47 + t * (1.38 * t * t - 4.72 * t + 2.28)));

      data[i * 4] = Math.round(255 * r);
      data[i * 4 + 1] = Math.round(255 * g);
      data[i * 4 + 2] = Math.round(255 * b);
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('turbo', data);
  }

  private generateInferno(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Inferno colormap approximation
      const r = Math.max(0, Math.min(1, -0.002 + t * (3.648 * t * t - 2.653 * t + 0.849)));
      const g = Math.max(0, Math.min(1, 0.015 + t * t * (2.490 - 1.168 * t)));
      const b = Math.max(0, Math.min(1, 0.420 + t * (-2.332 + t * (4.321 - 2.395 * t))));

      data[i * 4] = Math.round(255 * r);
      data[i * 4 + 1] = Math.round(255 * g);
      data[i * 4 + 2] = Math.round(255 * b);
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('inferno', data);
  }

  private generateMagma(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Magma colormap approximation
      const r = Math.max(0, Math.min(1, -0.015 + t * (3.554 * t * t - 2.456 * t + 0.774)));
      const g = Math.max(0, Math.min(1, 0.021 + t * t * (2.378 - 1.168 * t)));
      const b = Math.max(0, Math.min(1, 0.495 + t * (-1.970 + t * (2.895 - 1.648 * t))));

      data[i * 4] = Math.round(255 * r);
      data[i * 4 + 1] = Math.round(255 * g);
      data[i * 4 + 2] = Math.round(255 * b);
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('magma', data);
  }

  private generateCividis(): void {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Cividis colormap approximation (colorblind-friendly)
      const r = Math.max(0, Math.min(1, 0.000 + t * (1.145 * t * t - 0.456 * t + 0.361)));
      const g = Math.max(0, Math.min(1, 0.126 + t * (0.925 * t * t - 0.562 * t + 0.559)));
      const b = Math.max(0, Math.min(1, 0.304 + t * (0.637 * t * t - 1.037 * t + 0.722)));

      data[i * 4] = Math.round(255 * r);
      data[i * 4 + 1] = Math.round(255 * g);
      data[i * 4 + 2] = Math.round(255 * b);
      data[i * 4 + 3] = 255; // Alpha
    }

    this.colormaps.set('cividis', data);
  }

  getAvailableColormaps(): ColormapType[] {
    return ['viridis', 'plasma', 'jet', 'grayscale', 'turbo', 'inferno', 'magma', 'cividis'];
  }
}