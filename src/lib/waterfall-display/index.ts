/**
 * Waterfall Display Library - Main Entry Point
 * Real-time spectrum visualization with WebGL acceleration
 */

export { WaterfallRenderer } from './WaterfallRenderer.js';
export { SpectrumAnalyzer } from '../spectrum-analyzer/index.js';
export { SignalDetector } from '../signal-detector/index.js';
export { ColorMapper } from './ColorMapper.js';
export { CanvasRenderer } from './CanvasRenderer.js';

// Data Models
export type { SpectrumSample } from './models/SpectrumSample.js';
export type { WaterfallConfiguration } from './models/WaterfallConfiguration.js';
export type { DisplayBuffer } from './models/DisplayBuffer.js';
export type { SignalDetection } from '../signal-detector/models/SignalDetection.js';
export type { NoiseProfile } from '../spectrum-analyzer/models/NoiseProfile.js';
export type { SpectrumData } from '../spectrum-analyzer/models/SpectrumData.js';
export type { FFTResult } from '../spectrum-analyzer/models/FFTResult.js';

// WebGL Components
export { WebGLWaterfallRenderer } from './WebGLWaterfallRenderer.js';
export { OffscreenCanvasRenderer } from './OffscreenCanvasRenderer.js';

/**
 * Waterfall Display Configuration
 */
export interface WaterfallDisplayConfig {
  width: number;
  height: number;
  fftSize: number;
  updateRate: number; // FPS
  colormap: 'viridis' | 'plasma' | 'jet' | 'grayscale';
  minDb: number;
  maxDb: number;
  enableWebGL: boolean;
  enableAntiAliasing: boolean;
  enableScrolling: boolean;
  waterlineHeight: number;
}

/**
 * Default waterfall configuration optimized for ham radio
 */
export const DEFAULT_WATERFALL_CONFIG: WaterfallDisplayConfig = {
  width: 1024,
  height: 512,
  fftSize: 2048,
  updateRate: 30, // 30 FPS
  colormap: 'viridis',
  minDb: -120,
  maxDb: -20,
  enableWebGL: true,
  enableAntiAliasing: true,
  enableScrolling: true,
  waterlineHeight: 100
};

/**
 * Performance metrics for waterfall display
 */
export interface WaterfallPerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  gpuMemoryUsage: number;
  droppedFrames: number;
  renderTime: number;
}