/**
 * Display Buffer Data Model
 * Manages waterfall display data and rendering buffers
 */

export interface DisplayBuffer {
  width: number;
  height: number;
  data: Float32Array;
  metadata: BufferMetadata;
  rendering: RenderingInfo;
  history: HistoryBuffer;
}

export interface BufferMetadata {
  timestamp: number;
  sequenceNumber: number;
  sampleRate: number;
  centerFrequency: number;
  frequencySpan: number;
  timeSpan: number; // seconds
  dataFormat: DataFormat;
  compression: CompressionInfo;
}

export type DataFormat = 'MAGNITUDE' | 'POWER' | 'POWER_DENSITY' | 'VOLTAGE' | 'DECIBEL';

export interface CompressionInfo {
  enabled: boolean;
  algorithm: CompressionAlgorithm;
  ratio: number;
  lossless: boolean;
  quality: number; // 0.0 to 1.0
}

export type CompressionAlgorithm = 'NONE' | 'ZLIB' | 'LZ4' | 'QUANTIZATION' | 'WAVELET';

export interface RenderingInfo {
  textureId?: WebGLTexture;
  bufferObject?: WebGLBuffer;
  vertexArray?: WebGLVertexArrayObject;
  shader?: WebGLProgram;
  colormap: ColormapData;
  scaling: ScalingParameters;
  viewport: ViewportParameters;
}

export interface ColormapData {
  name: string;
  data: Uint8Array; // RGBA values
  size: number;
  gamma: number;
  invert: boolean;
}

export interface ScalingParameters {
  minValue: number;
  maxValue: number;
  scaling: ScalingType;
  autoScale: boolean;
  clipping: boolean;
}

export type ScalingType = 'LINEAR' | 'LOGARITHMIC' | 'SQRT' | 'SQUARE' | 'HISTOGRAM_EQUALIZATION';

export interface ViewportParameters {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface HistoryBuffer {
  capacity: number; // number of lines
  current: number; // current line index
  lines: SpectrumLine[];
  statistics: HistoryStatistics;
  persistence: PersistenceData;
}

export interface SpectrumLine {
  data: Float32Array;
  timestamp: number;
  metadata: LineMetadata;
}

export interface LineMetadata {
  centerFrequency: number;
  sampleRate: number;
  noiseFloor: number;
  peakPower: number;
  signalCount: number;
  quality: number;
}

export interface HistoryStatistics {
  totalLines: number;
  averagePower: Float32Array;
  peakPower: Float32Array;
  minPower: Float32Array;
  variance: Float32Array;
  updateRate: number; // FPS
}

export interface PersistenceData {
  enabled: boolean;
  decayRate: number; // 0.0 to 1.0
  threshold: number; // dB
  colorMultiplier: number;
  maxAge: number; // frames
}

export interface DisplayStatistics {
  frameRate: number; // FPS
  dropRate: number; // percentage
  latency: number; // milliseconds
  memoryUsage: number; // MB
  gpuMemoryUsage: number; // MB
  renderTime: number; // milliseconds
}

export interface BufferConfiguration {
  maxHistory: number; // lines
  updateRate: number; // Hz
  memoryLimit: number; // MB
  compression: boolean;
  persistence: boolean;
  autoCleanup: boolean;
}

export const DEFAULT_DISPLAY_BUFFER: Partial<DisplayBuffer> = {
  width: 1024,
  height: 512,
  metadata: {
    timestamp: 0,
    sequenceNumber: 0,
    sampleRate: 48000,
    centerFrequency: 14070000,
    frequencySpan: 48000,
    timeSpan: 10,
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
      name: 'viridis',
      data: new Uint8Array(0),
      size: 256,
      gamma: 1.0,
      invert: false
    },
    scaling: {
      minValue: -120,
      maxValue: -20,
      scaling: 'LINEAR',
      autoScale: false,
      clipping: true
    },
    viewport: {
      x: 0,
      y: 0,
      width: 1024,
      height: 512,
      zoom: 1.0,
      panX: 0,
      panY: 0
    }
  },
  history: {
    capacity: 512,
    current: 0,
    lines: [],
    statistics: {
      totalLines: 0,
      averagePower: new Float32Array(0),
      peakPower: new Float32Array(0),
      minPower: new Float32Array(0),
      variance: new Float32Array(0),
      updateRate: 30
    },
    persistence: {
      enabled: false,
      decayRate: 0.1,
      threshold: -100,
      colorMultiplier: 1.0,
      maxAge: 100
    }
  }
};

export const DEFAULT_BUFFER_CONFIG: BufferConfiguration = {
  maxHistory: 512,
  updateRate: 30,
  memoryLimit: 100,
  compression: false,
  persistence: false,
  autoCleanup: true
};