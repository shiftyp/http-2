/**
 * Waterfall Display Component
 * Real-time waterfall visualization for spectrum monitoring
 */

import { WaterfallDisplay, WaterfallDisplayManager, DEFAULT_WATERFALL_CONFIG } from './models/WaterfallDisplay';
import { SpectrumData } from './models/SpectrumData';
import { SignalPeak } from './models/SignalPeak';

export interface WaterfallRenderer {
  /** Canvas element for rendering */
  canvas: HTMLCanvasElement;

  /** 2D rendering context */
  context: CanvasRenderingContext2D;

  /** Image data buffer */
  imageData: ImageData;

  /** Pixel buffer for direct manipulation */
  pixelBuffer: Uint8ClampedArray;

  /** Render settings */
  renderSettings: RenderSettings;

  /** Animation frame ID */
  animationFrame?: number;
}

export interface RenderSettings {
  /** Render scale factor */
  scale: number;

  /** Smoothing enabled */
  smoothing: boolean;

  /** Render quality */
  quality: RenderQuality;

  /** Frame rate limit */
  frameRateLimit: number;

  /** Anti-aliasing */
  antiAliasing: boolean;

  /** Buffer strategy */
  bufferStrategy: BufferStrategy;
}

export interface WaterfallControls {
  /** Zoom controls */
  zoom: ZoomControls;

  /** Pan controls */
  pan: PanControls;

  /** Color controls */
  color: ColorControls;

  /** Measurement tools */
  measurement: MeasurementControls;

  /** Display controls */
  display: DisplayControls;
}

export interface ZoomControls {
  /** Horizontal zoom factor */
  zoomX: number;

  /** Vertical zoom factor */
  zoomY: number;

  /** Zoom center X */
  centerX: number;

  /** Zoom center Y */
  centerY: number;

  /** Zoom limits */
  limits: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface PanControls {
  /** Pan offset X */
  offsetX: number;

  /** Pan offset Y */
  offsetY: number;

  /** Pan velocity */
  velocityX: number;

  /** Pan velocity */
  velocityY: number;

  /** Pan limits */
  limits: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface ColorControls {
  /** Color map selection */
  colorMap: string;

  /** Intensity range */
  intensityRange: { min: number; max: number };

  /** Gamma correction */
  gamma: number;

  /** Contrast adjustment */
  contrast: number;

  /** Brightness adjustment */
  brightness: number;

  /** Custom palette */
  customPalette?: Uint8Array;
}

export interface MeasurementControls {
  /** Active measurement tool */
  activeTool: MeasurementTool;

  /** Measurement results */
  measurements: Measurement[];

  /** Cursor tracking */
  cursorTracking: boolean;

  /** Grid overlay */
  gridOverlay: boolean;

  /** Frequency markers */
  frequencyMarkers: FrequencyMarker[];
}

export interface DisplayControls {
  /** Show signal overlays */
  showSignalOverlays: boolean;

  /** Show grid */
  showGrid: boolean;

  /** Show frequency markers */
  showFrequencyMarkers: boolean;

  /** Show time markers */
  showTimeMarkers: boolean;

  /** Show power scale */
  showPowerScale: boolean;

  /** Full screen mode */
  fullScreen: boolean;
}

export interface Measurement {
  /** Measurement ID */
  id: string;

  /** Measurement type */
  type: MeasurementTool;

  /** Start coordinates */
  start: { x: number; y: number; freq: number; time: Date };

  /** End coordinates */
  end?: { x: number; y: number; freq: number; time: Date };

  /** Calculated values */
  values: MeasurementValues;

  /** Display style */
  style: MeasurementStyle;
}

export interface MeasurementValues {
  /** Frequency difference */
  deltaFrequency?: number;

  /** Time difference */
  deltaTime?: number;

  /** Power at point */
  power?: number;

  /** Bandwidth */
  bandwidth?: number;

  /** Signal strength */
  signalStrength?: number;
}

export interface MeasurementStyle {
  /** Line color */
  color: string;

  /** Line width */
  lineWidth: number;

  /** Line style */
  lineStyle: 'solid' | 'dashed' | 'dotted';

  /** Fill color */
  fillColor?: string;

  /** Text style */
  textStyle: TextStyle;
}

export interface TextStyle {
  /** Font family */
  fontFamily: string;

  /** Font size */
  fontSize: number;

  /** Font color */
  color: string;

  /** Background color */
  backgroundColor?: string;

  /** Text alignment */
  align: 'left' | 'center' | 'right';
}

export interface FrequencyMarker {
  /** Frequency in Hz */
  frequency: number;

  /** Label text */
  label: string;

  /** Marker style */
  style: MarkerStyle;

  /** Visibility */
  visible: boolean;
}

export interface MarkerStyle {
  /** Line color */
  color: string;

  /** Line width */
  lineWidth: number;

  /** Line style */
  lineStyle: 'solid' | 'dashed' | 'dotted';

  /** Label style */
  labelStyle: TextStyle;
}

export enum RenderQuality {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  ULTRA = 'ULTRA'
}

export enum BufferStrategy {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  TRIPLE = 'TRIPLE'
}

export enum MeasurementTool {
  NONE = 'NONE',
  FREQUENCY_DELTA = 'FREQUENCY_DELTA',
  TIME_DELTA = 'TIME_DELTA',
  BANDWIDTH = 'BANDWIDTH',
  POWER_MEASUREMENT = 'POWER_MEASUREMENT',
  SIGNAL_TRACKING = 'SIGNAL_TRACKING'
}

export class WaterfallDisplayComponent {
  private display: WaterfallDisplay;
  private renderer: WaterfallRenderer;
  private controls: WaterfallControls;
  private eventListeners: Map<string, EventListener[]> = new Map();
  private isRendering = false;
  private lastRenderTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    deviceId: string,
    centerFrequency: number,
    bandwidth: number
  ) {
    // Create waterfall display model
    this.display = WaterfallDisplayManager.createDisplay(
      deviceId,
      centerFrequency,
      bandwidth,
      DEFAULT_WATERFALL_CONFIG
    );

    // Initialize renderer
    this.renderer = this.createRenderer(canvas);

    // Initialize controls
    this.controls = this.createDefaultControls();

    // Setup event handlers
    this.setupEventHandlers();

    // Start rendering loop
    this.startRendering();
  }

  /**
   * Updates waterfall with new spectrum data
   */
  updateSpectrum(spectrumData: SpectrumData): void {
    WaterfallDisplayManager.addSpectrumData(this.display, spectrumData);

    // Trigger re-render
    if (!this.isRendering) {
      this.requestRender();
    }
  }

  /**
   * Sets zoom level
   */
  setZoom(zoomX: number, zoomY: number, centerX?: number, centerY?: number): void {
    this.controls.zoom.zoomX = Math.max(
      this.controls.zoom.limits.minX,
      Math.min(this.controls.zoom.limits.maxX, zoomX)
    );

    this.controls.zoom.zoomY = Math.max(
      this.controls.zoom.limits.minY,
      Math.min(this.controls.zoom.limits.maxY, zoomY)
    );

    if (centerX !== undefined) this.controls.zoom.centerX = centerX;
    if (centerY !== undefined) this.controls.zoom.centerY = centerY;

    this.requestRender();
    this.notifyEvent('zoom_changed', { zoomX, zoomY, centerX, centerY });
  }

  /**
   * Sets pan offset
   */
  setPan(offsetX: number, offsetY: number): void {
    this.controls.pan.offsetX = Math.max(
      this.controls.pan.limits.minX,
      Math.min(this.controls.pan.limits.maxX, offsetX)
    );

    this.controls.pan.offsetY = Math.max(
      this.controls.pan.limits.minY,
      Math.min(this.controls.pan.limits.maxY, offsetY)
    );

    this.requestRender();
    this.notifyEvent('pan_changed', { offsetX, offsetY });
  }

  /**
   * Sets color map
   */
  setColorMap(colorMap: string, intensityRange?: { min: number; max: number }): void {
    this.controls.color.colorMap = colorMap;

    if (intensityRange) {
      this.controls.color.intensityRange = intensityRange;
    }

    this.requestRender();
    this.notifyEvent('colormap_changed', { colorMap, intensityRange });
  }

  /**
   * Adds frequency marker
   */
  addFrequencyMarker(frequency: number, label: string, style?: Partial<MarkerStyle>): string {
    const markerId = `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const marker: FrequencyMarker = {
      frequency,
      label,
      style: {
        color: '#FF0000',
        lineWidth: 2,
        lineStyle: 'solid',
        labelStyle: {
          fontFamily: 'Arial',
          fontSize: 12,
          color: '#FFFFFF',
          align: 'center'
        },
        ...style
      },
      visible: true
    };

    this.controls.measurement.frequencyMarkers.push(marker);
    this.requestRender();
    this.notifyEvent('marker_added', { markerId, marker });

    return markerId;
  }

  /**
   * Removes frequency marker
   */
  removeFrequencyMarker(frequency: number): boolean {
    const index = this.controls.measurement.frequencyMarkers.findIndex(
      marker => Math.abs(marker.frequency - frequency) < 1
    );

    if (index >= 0) {
      this.controls.measurement.frequencyMarkers.splice(index, 1);
      this.requestRender();
      this.notifyEvent('marker_removed', { frequency });
      return true;
    }

    return false;
  }

  /**
   * Starts measurement tool
   */
  startMeasurement(tool: MeasurementTool): void {
    this.controls.measurement.activeTool = tool;
    this.notifyEvent('measurement_started', { tool });
  }

  /**
   * Stops measurement tool
   */
  stopMeasurement(): void {
    this.controls.measurement.activeTool = MeasurementTool.NONE;
    this.notifyEvent('measurement_stopped', {});
  }

  /**
   * Gets current cursor position
   */
  getCursorPosition(clientX: number, clientY: number): { frequency: number; time: Date; power: number } | null {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const canvasX = (clientX - rect.left) * this.renderer.renderSettings.scale;
    const canvasY = (clientY - rect.top) * this.renderer.renderSettings.scale;

    // Convert canvas coordinates to frequency/time
    const frequency = this.canvasXToFrequency(canvasX);
    const time = this.canvasYToTime(canvasY);
    const power = this.getCurrentPowerAt(frequency, time);

    return { frequency, time, power };
  }

  /**
   * Exports waterfall as image
   */
  exportAsImage(format: 'png' | 'jpeg' = 'png', quality = 0.9): string {
    return this.renderer.canvas.toDataURL(`image/${format}`, quality);
  }

  /**
   * Gets current display statistics
   */
  getDisplayStatistics(): any {
    return {
      totalLines: this.display.waterfallData.data.length,
      bufferUtilization: this.display.performance.bufferUtilization,
      renderTime: this.display.performance.renderTime,
      memoryUsage: this.display.performance.memoryUsage,
      actualUpdateRate: this.display.performance.actualUpdateRate
    };
  }

  /**
   * Registers event listener
   */
  addEventListener(event: string, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Removes event listener
   */
  removeEventListener(event: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    // Stop rendering
    if (this.renderer.animationFrame) {
      cancelAnimationFrame(this.renderer.animationFrame);
    }

    // Clear event listeners
    this.eventListeners.clear();

    // Clean up canvas
    this.renderer.context.clearRect(
      0, 0,
      this.renderer.canvas.width,
      this.renderer.canvas.height
    );
  }

  // Private methods

  private createRenderer(canvas: HTMLCanvasElement): WaterfallRenderer {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context');
    }

    const imageData = context.createImageData(canvas.width, canvas.height);

    return {
      canvas,
      context,
      imageData,
      pixelBuffer: imageData.data,
      renderSettings: {
        scale: window.devicePixelRatio || 1,
        smoothing: true,
        quality: RenderQuality.HIGH,
        frameRateLimit: 60,
        antiAliasing: true,
        bufferStrategy: BufferStrategy.DOUBLE
      }
    };
  }

  private createDefaultControls(): WaterfallControls {
    return {
      zoom: {
        zoomX: 1.0,
        zoomY: 1.0,
        centerX: 0.5,
        centerY: 0.5,
        limits: { minX: 0.1, maxX: 100, minY: 0.1, maxY: 100 }
      },
      pan: {
        offsetX: 0,
        offsetY: 0,
        velocityX: 0,
        velocityY: 0,
        limits: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }
      },
      color: {
        colorMap: 'VIRIDIS',
        intensityRange: { min: -120, max: -20 },
        gamma: 1.0,
        contrast: 1.0,
        brightness: 0.0
      },
      measurement: {
        activeTool: MeasurementTool.NONE,
        measurements: [],
        cursorTracking: true,
        gridOverlay: true,
        frequencyMarkers: []
      },
      display: {
        showSignalOverlays: true,
        showGrid: true,
        showFrequencyMarkers: true,
        showTimeMarkers: true,
        showPowerScale: true,
        fullScreen: false
      }
    };
  }

  private setupEventHandlers(): void {
    const canvas = this.renderer.canvas;

    // Mouse events
    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    canvas.addEventListener('wheel', this.handleWheel.bind(this));

    // Touch events
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Resize events
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleMouseDown(event: MouseEvent): void {
    // Handle mouse down for measurements and pan
    if (this.controls.measurement.activeTool !== MeasurementTool.NONE) {
      this.startMeasurementAt(event.clientX, event.clientY);
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    // Update cursor tracking
    if (this.controls.measurement.cursorTracking) {
      const position = this.getCursorPosition(event.clientX, event.clientY);
      if (position) {
        this.notifyEvent('cursor_moved', position);
      }
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    // Complete measurement
    if (this.controls.measurement.activeTool !== MeasurementTool.NONE) {
      this.completeMeasurementAt(event.clientX, event.clientY);
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    // Zoom with mouse wheel
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.renderer.canvas.getBoundingClientRect();
    const centerX = (event.clientX - rect.left) / rect.width;
    const centerY = (event.clientY - rect.top) / rect.height;

    this.setZoom(
      this.controls.zoom.zoomX * zoomFactor,
      this.controls.zoom.zoomY * zoomFactor,
      centerX,
      centerY
    );
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    // Handle touch gestures
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    // Handle touch gestures
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    // Handle touch gestures
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Handle keyboard shortcuts
    switch (event.key) {
      case 'Escape':
        this.stopMeasurement();
        break;
      case 'g':
        this.controls.display.showGrid = !this.controls.display.showGrid;
        this.requestRender();
        break;
      case 'm':
        this.controls.display.showFrequencyMarkers = !this.controls.display.showFrequencyMarkers;
        this.requestRender();
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    // Handle key release
  }

  private handleResize(): void {
    // Handle window resize
    this.requestRender();
  }

  private startMeasurementAt(clientX: number, clientY: number): void {
    const position = this.getCursorPosition(clientX, clientY);
    if (position) {
      const measurement: Measurement = {
        id: `measurement-${Date.now()}`,
        type: this.controls.measurement.activeTool,
        start: {
          x: clientX,
          y: clientY,
          freq: position.frequency,
          time: position.time
        },
        values: {},
        style: {
          color: '#FF0000',
          lineWidth: 2,
          lineStyle: 'solid',
          textStyle: {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#FFFFFF',
            align: 'center'
          }
        }
      };

      this.controls.measurement.measurements.push(measurement);
    }
  }

  private completeMeasurementAt(clientX: number, clientY: number): void {
    const activeMeasurement = this.controls.measurement.measurements
      .find(m => !m.end);

    if (activeMeasurement) {
      const position = this.getCursorPosition(clientX, clientY);
      if (position) {
        activeMeasurement.end = {
          x: clientX,
          y: clientY,
          freq: position.frequency,
          time: position.time
        };

        // Calculate measurement values
        this.calculateMeasurementValues(activeMeasurement);
        this.notifyEvent('measurement_completed', activeMeasurement);
      }
    }
  }

  private calculateMeasurementValues(measurement: Measurement): void {
    if (!measurement.end) return;

    switch (measurement.type) {
      case MeasurementTool.FREQUENCY_DELTA:
        measurement.values.deltaFrequency =
          Math.abs(measurement.end.freq - measurement.start.freq);
        break;

      case MeasurementTool.TIME_DELTA:
        measurement.values.deltaTime =
          Math.abs(measurement.end.time.getTime() - measurement.start.time.getTime()) / 1000;
        break;

      case MeasurementTool.BANDWIDTH:
        measurement.values.bandwidth =
          Math.abs(measurement.end.freq - measurement.start.freq);
        break;

      case MeasurementTool.POWER_MEASUREMENT:
        measurement.values.power = this.getCurrentPowerAt(
          measurement.start.freq,
          measurement.start.time
        );
        break;
    }
  }

  private startRendering(): void {
    const render = () => {
      const now = performance.now();
      const deltaTime = now - this.lastRenderTime;

      if (deltaTime >= 1000 / this.renderer.renderSettings.frameRateLimit) {
        this.renderWaterfall();
        this.lastRenderTime = now;
      }

      this.renderer.animationFrame = requestAnimationFrame(render);
    };

    this.renderer.animationFrame = requestAnimationFrame(render);
  }

  private requestRender(): void {
    if (!this.isRendering) {
      this.renderWaterfall();
    }
  }

  private renderWaterfall(): void {
    this.isRendering = true;
    const startTime = performance.now();

    try {
      // Clear canvas
      this.renderer.context.clearRect(
        0, 0,
        this.renderer.canvas.width,
        this.renderer.canvas.height
      );

      // Render waterfall data
      this.renderWaterfallData();

      // Render overlays
      if (this.controls.display.showSignalOverlays) {
        this.renderSignalOverlays();
      }

      if (this.controls.display.showGrid) {
        this.renderGrid();
      }

      if (this.controls.display.showFrequencyMarkers) {
        this.renderFrequencyMarkers();
      }

      // Render measurements
      this.renderMeasurements();

      // Update performance metrics
      this.display.performance.renderTime = performance.now() - startTime;

    } finally {
      this.isRendering = false;
    }
  }

  private renderWaterfallData(): void {
    // Render the actual waterfall spectrum data
    const { canvas, context, imageData, pixelBuffer } = this.renderer;
    const { data: lines } = this.display.waterfallData;

    if (lines.length === 0) return;

    // Clear pixel buffer
    pixelBuffer.fill(0);

    // Render each line of spectrum data
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const y = Math.floor((lineIndex / lines.length) * canvas.height);

      for (let binIndex = 0; binIndex < line.length; binIndex++) {
        const x = Math.floor((binIndex / line.length) * canvas.width);
        const power = line[binIndex];

        // Convert power to color
        const color = this.powerToColor(power);

        // Set pixel
        const pixelIndex = (y * canvas.width + x) * 4;
        pixelBuffer[pixelIndex] = color.r;
        pixelBuffer[pixelIndex + 1] = color.g;
        pixelBuffer[pixelIndex + 2] = color.b;
        pixelBuffer[pixelIndex + 3] = 255; // Alpha
      }
    }

    // Draw image data to canvas
    context.putImageData(imageData, 0, 0);
  }

  private renderSignalOverlays(): void {
    const context = this.renderer.context;

    for (const overlay of this.display.signalOverlays) {
      if (!overlay.visible) continue;

      const x = this.frequencyToCanvasX(overlay.signalPeak.frequency);
      const bandwidth = this.frequencyToCanvasX(overlay.signalPeak.bandwidth) - this.frequencyToCanvasX(0);

      context.strokeStyle = overlay.display.color;
      context.lineWidth = overlay.display.lineWidth;
      context.strokeRect(x - bandwidth / 2, 0, bandwidth, this.renderer.canvas.height);

      if (overlay.display.showLabel) {
        context.fillStyle = overlay.display.color;
        context.font = '12px Arial';
        context.fillText(
          `${(overlay.signalPeak.frequency / 1000).toFixed(1)} kHz`,
          x,
          20
        );
      }
    }
  }

  private renderGrid(): void {
    const context = this.renderer.context;
    const config = this.display.displayConfig.gridSettings;

    if (!config.enabled) return;

    context.strokeStyle = config.colors.minor;
    context.lineWidth = 1;
    context.setLineDash([2, 2]);

    // Vertical frequency grid lines
    const freqStep = config.minorFrequencyInterval;
    const startFreq = this.display.centerFrequency - this.display.bandwidth / 2;
    const endFreq = this.display.centerFrequency + this.display.bandwidth / 2;

    for (let freq = startFreq; freq <= endFreq; freq += freqStep) {
      const x = this.frequencyToCanvasX(freq);
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.renderer.canvas.height);
      context.stroke();
    }

    // Reset line dash
    context.setLineDash([]);
  }

  private renderFrequencyMarkers(): void {
    const context = this.renderer.context;

    for (const marker of this.controls.measurement.frequencyMarkers) {
      if (!marker.visible) continue;

      const x = this.frequencyToCanvasX(marker.frequency);

      context.strokeStyle = marker.style.color;
      context.lineWidth = marker.style.lineWidth;

      if (marker.style.lineStyle === 'dashed') {
        context.setLineDash([5, 5]);
      } else if (marker.style.lineStyle === 'dotted') {
        context.setLineDash([2, 2]);
      }

      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.renderer.canvas.height);
      context.stroke();

      // Draw label
      context.fillStyle = marker.style.labelStyle.color;
      context.font = `${marker.style.labelStyle.fontSize}px ${marker.style.labelStyle.fontFamily}`;
      context.fillText(marker.label, x + 5, 20);

      context.setLineDash([]);
    }
  }

  private renderMeasurements(): void {
    const context = this.renderer.context;

    for (const measurement of this.controls.measurement.measurements) {
      context.strokeStyle = measurement.style.color;
      context.lineWidth = measurement.style.lineWidth;

      if (measurement.style.lineStyle === 'dashed') {
        context.setLineDash([5, 5]);
      } else if (measurement.style.lineStyle === 'dotted') {
        context.setLineDash([2, 2]);
      }

      context.beginPath();
      context.moveTo(measurement.start.x, measurement.start.y);

      if (measurement.end) {
        context.lineTo(measurement.end.x, measurement.end.y);
      }

      context.stroke();
      context.setLineDash([]);

      // Draw measurement values
      if (measurement.end && Object.keys(measurement.values).length > 0) {
        const textX = (measurement.start.x + measurement.end.x) / 2;
        const textY = (measurement.start.y + measurement.end.y) / 2;

        context.fillStyle = measurement.style.textStyle.color;
        context.font = `${measurement.style.textStyle.fontSize}px ${measurement.style.textStyle.fontFamily}`;

        const text = this.formatMeasurementText(measurement);
        context.fillText(text, textX, textY);
      }
    }
  }

  private powerToColor(power: number): { r: number; g: number; b: number } {
    // Simple viridis-like color mapping
    const normalized = Math.max(0, Math.min(1,
      (power - this.controls.color.intensityRange.min) /
      (this.controls.color.intensityRange.max - this.controls.color.intensityRange.min)
    ));

    // Apply gamma correction
    const gamma = Math.pow(normalized, this.controls.color.gamma);

    // Simple color interpolation
    if (gamma < 0.25) {
      return { r: 68, g: 1, b: 84 };
    } else if (gamma < 0.5) {
      return { r: 59, g: 82, b: 139 };
    } else if (gamma < 0.75) {
      return { r: 33, g: 145, b: 140 };
    } else {
      return { r: 94, g: 201, b: 98 };
    }
  }

  private frequencyToCanvasX(frequency: number): number {
    const relativeFreq = (frequency - (this.display.centerFrequency - this.display.bandwidth / 2)) / this.display.bandwidth;
    return relativeFreq * this.renderer.canvas.width;
  }

  private canvasXToFrequency(canvasX: number): number {
    const relativeX = canvasX / this.renderer.canvas.width;
    return this.display.centerFrequency - this.display.bandwidth / 2 + relativeX * this.display.bandwidth;
  }

  private canvasYToTime(canvasY: number): Date {
    const relativeY = canvasY / this.renderer.canvas.height;
    const timespan = this.display.waterfallData.timeSpan * 1000; // Convert to ms
    const timeOffset = relativeY * timespan;
    return new Date(this.display.lastUpdated.getTime() - timeOffset);
  }

  private getCurrentPowerAt(frequency: number, time: Date): number {
    // Get power at specific frequency and time from waterfall data
    // This is a simplified implementation
    return -80 + Math.random() * 60; // -80 to -20 dBm
  }

  private formatMeasurementText(measurement: Measurement): string {
    const values = measurement.values;

    switch (measurement.type) {
      case MeasurementTool.FREQUENCY_DELTA:
        return `Δf: ${(values.deltaFrequency! / 1000).toFixed(1)} kHz`;
      case MeasurementTool.TIME_DELTA:
        return `Δt: ${values.deltaTime!.toFixed(2)} s`;
      case MeasurementTool.BANDWIDTH:
        return `BW: ${(values.bandwidth! / 1000).toFixed(1)} kHz`;
      case MeasurementTool.POWER_MEASUREMENT:
        return `P: ${values.power!.toFixed(1)} dBm`;
      default:
        return '';
    }
  }

  private notifyEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    for (const listener of listeners) {
      try {
        listener(new CustomEvent(event, { detail: data }));
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }
}

export default WaterfallDisplayComponent;