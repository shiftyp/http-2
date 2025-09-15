/**
 * WaterfallDisplay Model
 * Real-time waterfall visualization data for spectrum monitoring
 */

import { SpectrumData, SignalPeak } from './SpectrumData';

export interface WaterfallDisplay {
  /** Waterfall display identifier */
  id: string;

  /** Source SDR device ID */
  deviceId: string;

  /** Center frequency in Hz */
  centerFrequency: number;

  /** Display bandwidth in Hz */
  bandwidth: number;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  lastUpdated: Date;

  /** Waterfall data buffer */
  waterfallData: WaterfallBuffer;

  /** Current spectrum line */
  currentSpectrum: Float32Array;

  /** Display configuration */
  displayConfig: WaterfallDisplayConfig;

  /** Color mapping settings */
  colorMap: ColorMapSettings;

  /** Signal overlays */
  signalOverlays: SignalOverlay[];

  /** Zoom and pan state */
  viewState: WaterfallViewState;

  /** Performance metrics */
  performance: WaterfallPerformance;
}

export interface WaterfallBuffer {
  /** FFT data lines (time x frequency) */
  data: Float32Array[];

  /** Maximum buffer size (number of lines) */
  maxLines: number;

  /** Current buffer position (circular) */
  position: number;

  /** Buffer is full flag */
  isFull: boolean;

  /** Time span of buffer in seconds */
  timeSpan: number;

  /** Frequency resolution in Hz per bin */
  frequencyResolution: number;

  /** Time resolution in seconds per line */
  timeResolution: number;

  /** Data compression settings */
  compression: BufferCompression;
}

export interface WaterfallDisplayConfig {
  /** Display width in pixels */
  width: number;

  /** Display height in pixels */
  height: number;

  /** Time span to display in seconds */
  timeSpan: number;

  /** Update rate in Hz */
  updateRate: number;

  /** Intensity scaling */
  intensityScale: IntensityScale;

  /** Grid overlay settings */
  gridSettings: GridSettings;

  /** Frequency markers */
  frequencyMarkers: FrequencyMarker[];

  /** Auto-scaling enabled */
  autoScale: boolean;

  /** Persistence settings */
  persistence: PersistenceSettings;
}

export interface ColorMapSettings {
  /** Color map type */
  type: ColorMapType;

  /** Minimum power level in dB */
  minPower: number;

  /** Maximum power level in dB */
  maxPower: number;

  /** Gamma correction factor */
  gamma: number;

  /** Custom color palette */
  customPalette?: ColorPalette;

  /** Transparency settings */
  transparency: TransparencySettings;

  /** Contrast enhancement */
  contrast: number;

  /** Brightness adjustment */
  brightness: number;
}

export interface SignalOverlay {
  /** Overlay identifier */
  id: string;

  /** Associated signal peak */
  signalPeak: SignalPeak;

  /** Overlay type */
  type: OverlayType;

  /** Display properties */
  display: OverlayDisplay;

  /** Time tracking */
  timeTracking: TimeTracking;

  /** Annotation */
  annotation?: string;

  /** Visibility flag */
  visible: boolean;
}

export interface WaterfallViewState {
  /** Horizontal zoom factor */
  zoomX: number;

  /** Vertical zoom factor */
  zoomY: number;

  /** Horizontal pan offset in Hz */
  panX: number;

  /** Vertical pan offset in seconds */
  panY: number;

  /** Selected frequency range */
  selectedRange?: FrequencySelection;

  /** Cursor position */
  cursorPosition?: CursorPosition;

  /** Measurement tools */
  measurements: Measurement[];
}

export interface WaterfallPerformance {
  /** Update rate achieved in Hz */
  actualUpdateRate: number;

  /** Frame processing time in ms */
  processingTime: number;

  /** Render time in ms */
  renderTime: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Buffer utilization (0-1) */
  bufferUtilization: number;

  /** Dropped frames count */
  droppedFrames: number;

  /** Performance metrics timestamp */
  timestamp: Date;
}

export interface BufferCompression {
  /** Compression enabled */
  enabled: boolean;

  /** Compression type */
  type: CompressionType;

  /** Compression ratio achieved */
  ratio: number;

  /** Dynamic range reduction */
  dynamicRangeReduction: number;

  /** Lossy compression settings */
  lossySettings?: LossyCompressionSettings;
}

export interface IntensityScale {
  /** Scale type */
  type: ScaleType;

  /** Minimum dB value */
  minDb: number;

  /** Maximum dB value */
  maxDb: number;

  /** Reference level in dBm */
  referenceLevel: number;

  /** Logarithmic scaling factor */
  logScale?: number;
}

export interface GridSettings {
  /** Grid enabled */
  enabled: boolean;

  /** Major grid line interval in Hz */
  majorFrequencyInterval: number;

  /** Minor grid line interval in Hz */
  minorFrequencyInterval: number;

  /** Major time grid interval in seconds */
  majorTimeInterval: number;

  /** Minor time grid interval in seconds */
  minorTimeInterval: number;

  /** Grid colors */
  colors: GridColors;

  /** Grid transparency */
  transparency: number;
}

export interface FrequencyMarker {
  /** Marker frequency in Hz */
  frequency: number;

  /** Marker label */
  label: string;

  /** Marker color */
  color: string;

  /** Line style */
  lineStyle: LineStyle;

  /** Marker type */
  type: MarkerType;

  /** Visibility flag */
  visible: boolean;
}

export interface PersistenceSettings {
  /** Persistence enabled */
  enabled: boolean;

  /** Decay rate (0-1) */
  decayRate: number;

  /** Persistence time in seconds */
  persistenceTime: number;

  /** Peak hold enabled */
  peakHold: boolean;

  /** Average mode enabled */
  averageMode: boolean;
}

export interface ColorPalette {
  /** Color stops (0-1 range) */
  stops: ColorStop[];

  /** Interpolation method */
  interpolation: InterpolationMethod;
}

export interface TransparencySettings {
  /** Background transparency */
  background: number;

  /** Signal transparency */
  signal: number;

  /** Overlay transparency */
  overlay: number;
}

export interface OverlayDisplay {
  /** Overlay color */
  color: string;

  /** Line width */
  lineWidth: number;

  /** Fill enabled */
  filled: boolean;

  /** Blink rate in Hz */
  blinkRate?: number;

  /** Label display */
  showLabel: boolean;
}

export interface TimeTracking {
  /** First detection time */
  firstSeen: Date;

  /** Last update time */
  lastSeen: Date;

  /** Signal duration in seconds */
  duration: number;

  /** Movement history */
  frequencyHistory: FrequencyPoint[];

  /** Tracking enabled */
  trackingEnabled: boolean;
}

export interface FrequencySelection {
  /** Start frequency in Hz */
  startFrequency: number;

  /** End frequency in Hz */
  endFrequency: number;

  /** Selection timestamp */
  timestamp: Date;

  /** Selection purpose */
  purpose: SelectionPurpose;
}

export interface CursorPosition {
  /** Frequency at cursor in Hz */
  frequency: number;

  /** Time at cursor */
  time: Date;

  /** Power at cursor in dB */
  power: number;

  /** Display coordinates */
  displayX: number;

  /** Display coordinates */
  displayY: number;
}

export interface Measurement {
  /** Measurement ID */
  id: string;

  /** Measurement type */
  type: MeasurementType;

  /** Start point */
  startPoint: MeasurementPoint;

  /** End point */
  endPoint?: MeasurementPoint;

  /** Calculated values */
  values: MeasurementValues;

  /** Display properties */
  display: MeasurementDisplay;
}

export interface LossyCompressionSettings {
  /** Quantization bits */
  quantizationBits: number;

  /** Noise floor threshold */
  noiseFloorThreshold: number;

  /** Signal preservation threshold */
  signalThreshold: number;
}

export interface GridColors {
  /** Major grid line color */
  major: string;

  /** Minor grid line color */
  minor: string;

  /** Axis color */
  axis: string;

  /** Label color */
  label: string;
}

export interface ColorStop {
  /** Position (0-1) */
  position: number;

  /** Color value */
  color: string;

  /** Alpha channel */
  alpha?: number;
}

export interface FrequencyPoint {
  /** Frequency in Hz */
  frequency: number;

  /** Timestamp */
  timestamp: Date;

  /** Signal strength */
  strength: number;
}

export interface MeasurementPoint {
  /** Frequency in Hz */
  frequency: number;

  /** Time */
  time: Date;

  /** Power in dB */
  power: number;
}

export interface MeasurementValues {
  /** Frequency difference in Hz */
  frequencyDelta?: number;

  /** Time difference in seconds */
  timeDelta?: number;

  /** Power difference in dB */
  powerDelta?: number;

  /** Bandwidth in Hz */
  bandwidth?: number;

  /** Center frequency in Hz */
  centerFrequency?: number;
}

export interface MeasurementDisplay {
  /** Line color */
  color: string;

  /** Line style */
  lineStyle: LineStyle;

  /** Show values */
  showValues: boolean;

  /** Label position */
  labelPosition: LabelPosition;
}

export enum ColorMapType {
  VIRIDIS = 'VIRIDIS',
  PLASMA = 'PLASMA',
  INFERNO = 'INFERNO',
  TURBO = 'TURBO',
  RAINBOW = 'RAINBOW',
  GRAYSCALE = 'GRAYSCALE',
  CUSTOM = 'CUSTOM'
}

export enum OverlayType {
  SIGNAL_MARKER = 'SIGNAL_MARKER',
  FREQUENCY_BAND = 'FREQUENCY_BAND',
  SIGNAL_TRACK = 'SIGNAL_TRACK',
  ANNOTATION = 'ANNOTATION',
  MEASUREMENT = 'MEASUREMENT'
}

export enum CompressionType {
  NONE = 'NONE',
  RLE = 'RLE',
  DEFLATE = 'DEFLATE',
  QUANTIZATION = 'QUANTIZATION',
  ADAPTIVE = 'ADAPTIVE'
}

export enum ScaleType {
  LINEAR = 'LINEAR',
  LOGARITHMIC = 'LOGARITHMIC',
  SQRT = 'SQRT',
  CUSTOM = 'CUSTOM'
}

export enum LineStyle {
  SOLID = 'SOLID',
  DASHED = 'DASHED',
  DOTTED = 'DOTTED',
  DASH_DOT = 'DASH_DOT'
}

export enum MarkerType {
  FREQUENCY = 'FREQUENCY',
  BAND_EDGE = 'BAND_EDGE',
  CHANNEL = 'CHANNEL',
  REFERENCE = 'REFERENCE',
  CUSTOM = 'CUSTOM'
}

export enum InterpolationMethod {
  LINEAR = 'LINEAR',
  CUBIC = 'CUBIC',
  NEAREST = 'NEAREST'
}

export enum SelectionPurpose {
  MEASUREMENT = 'MEASUREMENT',
  ZOOM = 'ZOOM',
  SIGNAL_ANALYSIS = 'SIGNAL_ANALYSIS',
  FREQUENCY_MONITORING = 'FREQUENCY_MONITORING'
}

export enum MeasurementType {
  FREQUENCY_DELTA = 'FREQUENCY_DELTA',
  TIME_DELTA = 'TIME_DELTA',
  POWER_DELTA = 'POWER_DELTA',
  BANDWIDTH = 'BANDWIDTH',
  SIGNAL_STRENGTH = 'SIGNAL_STRENGTH'
}

export enum LabelPosition {
  TOP_LEFT = 'TOP_LEFT',
  TOP_RIGHT = 'TOP_RIGHT',
  BOTTOM_LEFT = 'BOTTOM_LEFT',
  BOTTOM_RIGHT = 'BOTTOM_RIGHT',
  CENTER = 'CENTER'
}

/**
 * Waterfall display management utilities
 */
export class WaterfallDisplayManager {
  /**
   * Creates a new waterfall display
   */
  static createDisplay(
    deviceId: string,
    centerFrequency: number,
    bandwidth: number,
    config: Partial<WaterfallDisplayConfig> = {}
  ): WaterfallDisplay {
    const id = this.generateDisplayId(deviceId, centerFrequency);
    const now = new Date();

    const defaultConfig: WaterfallDisplayConfig = {
      width: 1024,
      height: 512,
      timeSpan: 60, // 60 seconds
      updateRate: 10, // 10 Hz
      intensityScale: {
        type: ScaleType.LOGARITHMIC,
        minDb: -120,
        maxDb: -20,
        referenceLevel: -30
      },
      gridSettings: {
        enabled: true,
        majorFrequencyInterval: 100000, // 100 kHz
        minorFrequencyInterval: 25000,  // 25 kHz
        majorTimeInterval: 10, // 10 seconds
        minorTimeInterval: 2,  // 2 seconds
        colors: {
          major: '#404040',
          minor: '#202020',
          axis: '#808080',
          label: '#C0C0C0'
        },
        transparency: 0.7
      },
      frequencyMarkers: [],
      autoScale: true,
      persistence: {
        enabled: false,
        decayRate: 0.1,
        persistenceTime: 5,
        peakHold: false,
        averageMode: false
      }
    };

    const displayConfig = { ...defaultConfig, ...config };
    const bufferLines = Math.ceil(displayConfig.timeSpan * displayConfig.updateRate);

    return {
      id,
      deviceId,
      centerFrequency,
      bandwidth,
      createdAt: now,
      lastUpdated: now,
      waterfallData: {
        data: [],
        maxLines: bufferLines,
        position: 0,
        isFull: false,
        timeSpan: displayConfig.timeSpan,
        frequencyResolution: bandwidth / 1024, // Default FFT size
        timeResolution: 1 / displayConfig.updateRate,
        compression: {
          enabled: false,
          type: CompressionType.NONE,
          ratio: 1.0,
          dynamicRangeReduction: 0
        }
      },
      currentSpectrum: new Float32Array(1024),
      displayConfig,
      colorMap: {
        type: ColorMapType.VIRIDIS,
        minPower: displayConfig.intensityScale.minDb,
        maxPower: displayConfig.intensityScale.maxDb,
        gamma: 1.0,
        transparency: {
          background: 0.0,
          signal: 1.0,
          overlay: 0.8
        },
        contrast: 1.0,
        brightness: 0.0
      },
      signalOverlays: [],
      viewState: {
        zoomX: 1.0,
        zoomY: 1.0,
        panX: 0,
        panY: 0,
        measurements: []
      },
      performance: {
        actualUpdateRate: 0,
        processingTime: 0,
        renderTime: 0,
        memoryUsage: 0,
        bufferUtilization: 0,
        droppedFrames: 0,
        timestamp: now
      }
    };
  }

  /**
   * Adds spectrum data to waterfall
   */
  static addSpectrumData(display: WaterfallDisplay, spectrumData: SpectrumData): void {
    // Validate spectrum data compatibility
    if (Math.abs(spectrumData.centerFrequency - display.centerFrequency) > 1000) {
      throw new Error('Spectrum data frequency mismatch');
    }

    if (Math.abs(spectrumData.bandwidth - display.bandwidth) > spectrumData.bandwidth * 0.1) {
      throw new Error('Spectrum data bandwidth mismatch');
    }

    // Copy current spectrum
    display.currentSpectrum.set(spectrumData.fftData);

    // Add to waterfall buffer
    const buffer = display.waterfallData;
    const dataLine = new Float32Array(spectrumData.fftData);

    if (buffer.data.length < buffer.maxLines) {
      // Buffer not full yet
      buffer.data.push(dataLine);
    } else {
      // Circular buffer - replace oldest data
      buffer.data[buffer.position] = dataLine;
      buffer.isFull = true;
    }

    buffer.position = (buffer.position + 1) % buffer.maxLines;
    display.lastUpdated = spectrumData.timestamp;

    // Update signal overlays
    this.updateSignalOverlays(display, spectrumData.signalPeaks);

    // Update performance metrics
    this.updatePerformanceMetrics(display);
  }

  /**
   * Updates signal overlays with current peaks
   */
  private static updateSignalOverlays(display: WaterfallDisplay, signalPeaks: SignalPeak[]): void {
    const now = new Date();

    // Update existing overlays
    for (const overlay of display.signalOverlays) {
      const matchingPeak = signalPeaks.find(peak =>
        Math.abs(peak.frequency - overlay.signalPeak.frequency) < overlay.signalPeak.bandwidth / 2
      );

      if (matchingPeak) {
        // Update existing overlay
        overlay.signalPeak = matchingPeak;
        overlay.timeTracking.lastSeen = now;
        overlay.timeTracking.duration = now.getTime() - overlay.timeTracking.firstSeen.getTime();

        // Add to frequency history
        overlay.timeTracking.frequencyHistory.push({
          frequency: matchingPeak.frequency,
          timestamp: now,
          strength: matchingPeak.power
        });

        // Limit history size
        if (overlay.timeTracking.frequencyHistory.length > 1000) {
          overlay.timeTracking.frequencyHistory.shift();
        }
      }
    }

    // Add new overlays for new signals
    for (const peak of signalPeaks) {
      const existingOverlay = display.signalOverlays.find(overlay =>
        Math.abs(peak.frequency - overlay.signalPeak.frequency) < peak.bandwidth / 2
      );

      if (!existingOverlay && peak.confidence > 0.5) {
        const newOverlay: SignalOverlay = {
          id: this.generateOverlayId(peak),
          signalPeak: peak,
          type: OverlayType.SIGNAL_MARKER,
          display: {
            color: this.getSignalColor(peak.signalType),
            lineWidth: 2,
            filled: false,
            showLabel: true
          },
          timeTracking: {
            firstSeen: now,
            lastSeen: now,
            duration: 0,
            frequencyHistory: [{
              frequency: peak.frequency,
              timestamp: now,
              strength: peak.power
            }],
            trackingEnabled: true
          },
          visible: true
        };

        display.signalOverlays.push(newOverlay);
      }
    }

    // Remove old overlays (not seen for 10 seconds)
    const tenSecondsAgo = new Date(now.getTime() - 10000);
    display.signalOverlays = display.signalOverlays.filter(overlay =>
      overlay.timeTracking.lastSeen > tenSecondsAgo
    );
  }

  /**
   * Updates performance metrics
   */
  private static updatePerformanceMetrics(display: WaterfallDisplay): void {
    const now = new Date();
    const timeSinceLastUpdate = now.getTime() - display.performance.timestamp.getTime();

    if (timeSinceLastUpdate > 0) {
      display.performance.actualUpdateRate = 1000 / timeSinceLastUpdate;
    }

    display.performance.bufferUtilization = display.waterfallData.isFull ?
      1.0 : display.waterfallData.data.length / display.waterfallData.maxLines;

    // Estimate memory usage
    const bytesPerSample = 4; // Float32
    const samplesPerLine = display.currentSpectrum.length;
    display.performance.memoryUsage =
      display.waterfallData.data.length * samplesPerLine * bytesPerSample;

    display.performance.timestamp = now;
  }

  /**
   * Generates display ID
   */
  private static generateDisplayId(deviceId: string, frequency: number): string {
    const freqMHz = Math.round(frequency / 1000000 * 100) / 100;
    return `waterfall-${deviceId}-${freqMHz}MHz-${Date.now()}`;
  }

  /**
   * Generates overlay ID
   */
  private static generateOverlayId(peak: SignalPeak): string {
    const freqKHz = Math.round(peak.frequency / 1000);
    return `overlay-${freqKHz}kHz-${Date.now()}`;
  }

  /**
   * Gets color for signal type
   */
  private static getSignalColor(signalType: any): string {
    // Import would be circular, so use basic color mapping
    const colorMap: Record<string, string> = {
      'QPSK': '#FF6B6B',
      'BPSK': '#4ECDC4',
      'FSK': '#45B7D1',
      'CW': '#96CEB4',
      'FM': '#FFEAA7',
      'AM': '#DDA0DD',
      'SSB_USB': '#98D8C8',
      'SSB_LSB': '#F7DC6F',
      'DIGITAL': '#BB8FCE',
      'UNKNOWN': '#BDC3C7'
    };

    return colorMap[signalType] || '#BDC3C7';
  }

  /**
   * Validates waterfall display
   */
  static validate(display: WaterfallDisplay): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!display.id) errors.push('Display ID is required');
    if (!display.deviceId) errors.push('Device ID is required');
    if (display.centerFrequency <= 0) errors.push('Center frequency must be positive');
    if (display.bandwidth <= 0) errors.push('Bandwidth must be positive');

    // Validate buffer
    if (display.waterfallData.maxLines <= 0) {
      errors.push('Buffer max lines must be positive');
    }

    if (display.waterfallData.timeResolution <= 0) {
      errors.push('Time resolution must be positive');
    }

    // Validate display config
    if (display.displayConfig.width <= 0 || display.displayConfig.height <= 0) {
      errors.push('Display dimensions must be positive');
    }

    if (display.displayConfig.updateRate <= 0) {
      errors.push('Update rate must be positive');
    }

    // Validate color map
    if (display.colorMap.minPower >= display.colorMap.maxPower) {
      errors.push('Color map min power must be less than max power');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Optimizes waterfall performance
   */
  static optimizePerformance(display: WaterfallDisplay): WaterfallDisplay {
    const optimized = { ...display };

    // Enable compression if memory usage is high
    if (optimized.performance.memoryUsage > 50 * 1024 * 1024) { // 50MB
      optimized.waterfallData.compression.enabled = true;
      optimized.waterfallData.compression.type = CompressionType.QUANTIZATION;
    }

    // Reduce buffer size if frame rate is low
    if (optimized.performance.actualUpdateRate < optimized.displayConfig.updateRate * 0.8) {
      optimized.waterfallData.maxLines = Math.floor(optimized.waterfallData.maxLines * 0.8);
    }

    // Adjust display config for performance
    if (optimized.performance.renderTime > 50) { // 50ms render time
      optimized.displayConfig.width = Math.min(optimized.displayConfig.width, 1024);
      optimized.displayConfig.height = Math.min(optimized.displayConfig.height, 512);
    }

    return optimized;
  }
}

/**
 * Default waterfall display configuration
 */
export const DEFAULT_WATERFALL_CONFIG: WaterfallDisplayConfig = {
  width: 1024,
  height: 512,
  timeSpan: 60,
  updateRate: 10,
  intensityScale: {
    type: ScaleType.LOGARITHMIC,
    minDb: -120,
    maxDb: -20,
    referenceLevel: -30
  },
  gridSettings: {
    enabled: true,
    majorFrequencyInterval: 100000,
    minorFrequencyInterval: 25000,
    majorTimeInterval: 10,
    minorTimeInterval: 2,
    colors: {
      major: '#404040',
      minor: '#202020',
      axis: '#808080',
      label: '#C0C0C0'
    },
    transparency: 0.7
  },
  frequencyMarkers: [],
  autoScale: true,
  persistence: {
    enabled: false,
    decayRate: 0.1,
    persistenceTime: 5,
    peakHold: false,
    averageMode: false
  }
};

export default WaterfallDisplay;