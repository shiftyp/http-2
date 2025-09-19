/**
 * Waterfall Display Configuration
 * Controls rendering parameters and display settings
 */

export interface WaterfallConfiguration {
  width: number;
  height: number;
  fftSize: number;
  colormap: ColormapType;
  minDb: number;
  maxDb: number;
  updateRate: number;
  enableScrolling?: boolean;
  scrollDirection?: ScrollDirection;
  enableZoom?: boolean;
  enablePanning?: boolean;
  enableCursor?: boolean;
  cursorConfiguration?: CursorConfiguration;
  gridConfiguration?: GridConfiguration;
  averagingConfiguration?: AveragingConfiguration;
}

export type ColormapType = 'viridis' | 'plasma' | 'jet' | 'grayscale' | 'turbo' | 'inferno' | 'magma' | 'cividis';

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export interface CursorConfiguration {
  enabled: boolean;
  showFrequency: boolean;
  showMagnitude: boolean;
  showTimestamp: boolean;
  color: string;
  lineWidth: number;
  snapToSignals: boolean;
}

export interface GridConfiguration {
  enabled: boolean;
  frequencyGrid: boolean;
  timeGrid: boolean;
  powerGrid: boolean;
  majorGridColor: string;
  minorGridColor: string;
  frequencySpacing: number; // Hz
  timeSpacing: number; // ms
  powerSpacing: number; // dB
}

export interface AveragingConfiguration {
  enabled: boolean;
  method: AveragingMethod;
  factor: number;
  windowSize: number;
  resetOnFrequencyChange: boolean;
}

export type AveragingMethod = 'exponential' | 'linear' | 'peak_hold' | 'min_hold';

export interface DisplayLimits {
  minFrequency: number;
  maxFrequency: number;
  minMagnitude: number;
  maxMagnitude: number;
  maxUpdateRate: number;
  maxFFTSize: number;
}

export const DEFAULT_WATERFALL_CONFIG: WaterfallConfiguration = {
  width: 1024,
  height: 512,
  fftSize: 2048,
  colormap: 'viridis',
  minDb: -120,
  maxDb: -20,
  updateRate: 30,
  enableScrolling: true,
  scrollDirection: 'down',
  enableZoom: true,
  enablePanning: true,
  enableCursor: true,
  cursorConfiguration: {
    enabled: true,
    showFrequency: true,
    showMagnitude: true,
    showTimestamp: false,
    color: '#ffffff',
    lineWidth: 1,
    snapToSignals: false
  },
  gridConfiguration: {
    enabled: true,
    frequencyGrid: true,
    timeGrid: false,
    powerGrid: true,
    majorGridColor: '#666666',
    minorGridColor: '#333333',
    frequencySpacing: 1000000, // 1 MHz
    timeSpacing: 1000, // 1 second
    powerSpacing: 10 // 10 dB
  },
  averagingConfiguration: {
    enabled: false,
    method: 'exponential',
    factor: 0.1,
    windowSize: 10,
    resetOnFrequencyChange: true
  }
};

export const HAM_BAND_DISPLAY_LIMITS: DisplayLimits = {
  minFrequency: 1800000, // 160m band lower edge
  maxFrequency: 1300000000, // 23cm band upper edge
  minMagnitude: -140, // dBm
  maxMagnitude: 20, // dBm
  maxUpdateRate: 60, // FPS
  maxFFTSize: 32768 // Maximum practical FFT size
};