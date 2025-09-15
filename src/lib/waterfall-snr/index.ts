export interface WaterfallConfig {
  sampleRate: number;
  fftSize: number;
  frameRate: number;
  historyDuration: number; // seconds
  frequencyRange?: [number, number]; // Hz, defaults to full range
  colorScheme: 'classic' | 'thermal' | 'monochrome' | 'green';
  dynamicRange: number; // dB
  noiseFloorOffset: number; // dB
}

export interface SpectrumSample {
  timestamp: number;
  frequencyData: Float32Array; // Power spectral density in dBm
  frequencies: Float32Array; // Frequency bins in Hz
  noiseFloor: number; // dB
  peakSignals: SignalPeak[];
}

export interface SignalPeak {
  frequency: number; // Hz
  power: number; // dBm
  snr: number; // dB
  bandwidth: number; // Hz
}

export interface WaterfallDisplaySettings {
  centerFrequency: number;
  spanFrequency: number;
  paused: boolean;
  zoom: number;
  colorIntensity: number;
}

export class WaterfallAnalyzer {
  private config: WaterfallConfig;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrame: number | null = null;

  private spectralHistory: SpectrumSample[] = [];
  private noiseFloorEstimate: number = -90; // dBm
  private callbacks: Set<(sample: SpectrumSample) => void> = new Set();

  constructor(config: WaterfallConfig) {
    this.config = {
      frameRate: 30,
      historyDuration: 60,
      colorScheme: 'classic',
      dynamicRange: 60,
      noiseFloorOffset: 10,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Create audio context and analyser
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = 0.1;
      this.analyser.minDecibels = -100;
      this.analyser.maxDecibels = -10;

      // Connect audio input to analyser
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

    } catch (error) {
      throw new Error(`Failed to initialize waterfall analyzer: ${error}`);
    }
  }

  start(): void {
    if (!this.analyser || this.animationFrame) return;

    const processFrame = () => {
      const sample = this.captureSpectrum();
      if (sample) {
        this.addToHistory(sample);
        this.notifyCallbacks(sample);
      }

      this.animationFrame = requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.callbacks.clear();
    this.spectralHistory = [];
  }

  onSpectrumUpdate(callback: (sample: SpectrumSample) => void): void {
    this.callbacks.add(callback);
  }

  offSpectrumUpdate(callback: (sample: SpectrumSample) => void): void {
    this.callbacks.delete(callback);
  }

  private captureSpectrum(): SpectrumSample | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const freqData = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(freqData);

    // Calculate frequency bins
    const frequencies = new Float32Array(bufferLength);
    const nyquist = this.config.sampleRate / 2;
    for (let i = 0; i < bufferLength; i++) {
      frequencies[i] = (i * nyquist) / bufferLength;
    }

    // Filter to frequency range if specified
    let filteredFreqs = frequencies;
    let filteredData = freqData;

    if (this.config.frequencyRange) {
      const [minFreq, maxFreq] = this.config.frequencyRange;
      const startIdx = Math.floor((minFreq * bufferLength) / nyquist);
      const endIdx = Math.floor((maxFreq * bufferLength) / nyquist);

      filteredFreqs = frequencies.slice(startIdx, endIdx);
      filteredData = freqData.slice(startIdx, endIdx);
    }

    // Estimate noise floor (median of lower 25% of spectrum)
    const sortedData = Array.from(filteredData).sort((a, b) => a - b);
    const noiseFloor = sortedData[Math.floor(sortedData.length * 0.25)];
    this.updateNoiseFloor(noiseFloor);

    // Detect signal peaks
    const peaks = this.detectSignalPeaks(filteredFreqs, filteredData, this.noiseFloorEstimate);

    return {
      timestamp: Date.now(),
      frequencyData: filteredData,
      frequencies: filteredFreqs,
      noiseFloor: this.noiseFloorEstimate,
      peakSignals: peaks
    };
  }

  private updateNoiseFloor(currentFloor: number): void {
    // Exponential moving average for noise floor estimation
    const alpha = 0.01; // Slow adaptation
    this.noiseFloorEstimate = alpha * currentFloor + (1 - alpha) * this.noiseFloorEstimate;
  }

  private detectSignalPeaks(frequencies: Float32Array, data: Float32Array, noiseFloor: number): SignalPeak[] {
    const peaks: SignalPeak[] = [];
    const threshold = noiseFloor + this.config.noiseFloorOffset;

    // Simple peak detection algorithm
    for (let i = 1; i < data.length - 1; i++) {
      const current = data[i];
      const prev = data[i - 1];
      const next = data[i + 1];

      // Check if this is a local maximum above threshold
      if (current > prev && current > next && current > threshold) {
        const frequency = frequencies[i];
        const power = current;
        const snr = current - noiseFloor;

        // Estimate bandwidth (width at -3dB point)
        let leftIdx = i, rightIdx = i;
        const halfPower = current - 3;

        while (leftIdx > 0 && data[leftIdx] > halfPower) leftIdx--;
        while (rightIdx < data.length - 1 && data[rightIdx] > halfPower) rightIdx++;

        const bandwidth = frequencies[rightIdx] - frequencies[leftIdx];

        peaks.push({
          frequency,
          power,
          snr,
          bandwidth
        });
      }
    }

    // Sort by SNR (strongest first) and limit to top signals
    return peaks.sort((a, b) => b.snr - a.snr).slice(0, 10);
  }

  private addToHistory(sample: SpectrumSample): void {
    this.spectralHistory.push(sample);

    // Trim history to configured duration
    const maxSamples = this.config.historyDuration * this.config.frameRate;
    if (this.spectralHistory.length > maxSamples) {
      this.spectralHistory = this.spectralHistory.slice(-maxSamples);
    }
  }

  private notifyCallbacks(sample: SpectrumSample): void {
    this.callbacks.forEach(callback => {
      try {
        callback(sample);
      } catch (error) {
        console.error('Error in waterfall callback:', error);
      }
    });
  }

  getSpectralHistory(): SpectrumSample[] {
    return [...this.spectralHistory];
  }

  getCurrentSpectrum(): SpectrumSample | null {
    return this.spectralHistory[this.spectralHistory.length - 1] || null;
  }

  exportData(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify({
        config: this.config,
        history: this.spectralHistory,
        exportTime: new Date().toISOString()
      }, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'frequency', 'power', 'noiseFloor'];
    let csv = headers.join(',') + '\n';

    for (const sample of this.spectralHistory) {
      for (let i = 0; i < sample.frequencies.length; i++) {
        csv += [
          sample.timestamp,
          sample.frequencies[i].toFixed(2),
          sample.frequencyData[i].toFixed(2),
          sample.noiseFloor.toFixed(2)
        ].join(',') + '\n';
      }
    }

    return csv;
  }
}

export class WaterfallRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private settings: WaterfallDisplaySettings;
  private imageData: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement, settings: Partial<WaterfallDisplaySettings> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    this.ctx = ctx;
    this.settings = {
      centerFrequency: 14205000,
      spanFrequency: 3000,
      paused: false,
      zoom: 1,
      colorIntensity: 1,
      ...settings
    };

    this.initializeCanvas();
  }

  private initializeCanvas(): void {
    this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    // Fill with black
    for (let i = 3; i < this.imageData.data.length; i += 4) {
      this.imageData.data[i] = 255; // Alpha
    }
  }

  updateSettings(settings: Partial<WaterfallDisplaySettings>): void {
    Object.assign(this.settings, settings);
  }

  renderSpectrum(sample: SpectrumSample, colorScheme: WaterfallConfig['colorScheme'] = 'classic'): void {
    if (this.settings.paused || !this.imageData) return;

    // Scroll existing image up by one line
    this.scrollImage();

    // Render new spectrum line at the bottom
    this.renderSpectrumLine(sample, colorScheme);

    // Draw frequency labels and grid
    this.drawFrequencyGrid();

    // Draw signal peaks
    this.drawSignalPeaks(sample.peakSignals);

    // Update canvas
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  private scrollImage(): void {
    if (!this.imageData) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const data = this.imageData.data;

    // Move all lines up by one pixel
    for (let y = 1; y < height; y++) {
      const srcRow = y * width * 4;
      const dstRow = (y - 1) * width * 4;

      for (let x = 0; x < width * 4; x++) {
        data[dstRow + x] = data[srcRow + x];
      }
    }

    // Clear the bottom line (will be filled with new data)
    const bottomRow = (height - 1) * width * 4;
    for (let x = 0; x < width * 4; x += 4) {
      data[bottomRow + x] = 0;     // R
      data[bottomRow + x + 1] = 0; // G
      data[bottomRow + x + 2] = 0; // B
      data[bottomRow + x + 3] = 255; // A
    }
  }

  private renderSpectrumLine(sample: SpectrumSample, colorScheme: WaterfallConfig['colorScheme']): void {
    if (!this.imageData) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const data = this.imageData.data;

    // Filter frequencies to display range
    const minFreq = this.settings.centerFrequency - this.settings.spanFrequency / 2;
    const maxFreq = this.settings.centerFrequency + this.settings.spanFrequency / 2;

    for (let x = 0; x < width; x++) {
      // Map pixel to frequency
      const freq = minFreq + (x / width) * this.settings.spanFrequency;

      // Find corresponding power value
      const power = this.interpolatePower(sample, freq);

      // Normalize power to 0-1 range for color mapping
      const normalizedPower = Math.max(0, Math.min(1,
        (power - sample.noiseFloor + 10) / 60 * this.settings.colorIntensity
      ));

      // Get color for this power level
      const color = this.getColor(normalizedPower, colorScheme);

      // Set pixel in bottom row
      const pixelIndex = ((height - 1) * width + x) * 4;
      data[pixelIndex] = color.r;
      data[pixelIndex + 1] = color.g;
      data[pixelIndex + 2] = color.b;
      data[pixelIndex + 3] = 255;
    }
  }

  private interpolatePower(sample: SpectrumSample, frequency: number): number {
    const frequencies = sample.frequencies;
    const powers = sample.frequencyData;

    // Find closest frequency bin
    let closestIdx = 0;
    let minDist = Math.abs(frequencies[0] - frequency);

    for (let i = 1; i < frequencies.length; i++) {
      const dist = Math.abs(frequencies[i] - frequency);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    return powers[closestIdx] || sample.noiseFloor;
  }

  private getColor(intensity: number, scheme: WaterfallConfig['colorScheme']): {r: number, g: number, b: number} {
    intensity = Math.max(0, Math.min(1, intensity));

    switch (scheme) {
      case 'classic':
        // Blue -> Cyan -> Green -> Yellow -> Red
        if (intensity < 0.25) {
          const t = intensity * 4;
          return { r: 0, g: 0, b: Math.floor(255 * (0.5 + t * 0.5)) };
        } else if (intensity < 0.5) {
          const t = (intensity - 0.25) * 4;
          return { r: 0, g: Math.floor(255 * t), b: 255 };
        } else if (intensity < 0.75) {
          const t = (intensity - 0.5) * 4;
          return { r: Math.floor(255 * t), g: 255, b: Math.floor(255 * (1 - t)) };
        } else {
          const t = (intensity - 0.75) * 4;
          return { r: 255, g: Math.floor(255 * (1 - t)), b: 0 };
        }

      case 'thermal':
        // Black -> Red -> Yellow -> White
        if (intensity < 0.33) {
          const t = intensity * 3;
          return { r: Math.floor(255 * t), g: 0, b: 0 };
        } else if (intensity < 0.66) {
          const t = (intensity - 0.33) * 3;
          return { r: 255, g: Math.floor(255 * t), b: 0 };
        } else {
          const t = (intensity - 0.66) * 3;
          return { r: 255, g: 255, b: Math.floor(255 * t) };
        }

      case 'monochrome':
        const gray = Math.floor(255 * intensity);
        return { r: gray, g: gray, b: gray };

      case 'green':
        const green = Math.floor(255 * intensity);
        return { r: 0, g: green, b: 0 };

      default:
        return { r: 0, g: 0, b: 0 };
    }
  }

  private drawFrequencyGrid(): void {
    // Draw frequency labels and grid lines
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.font = '12px monospace';
    this.ctx.lineWidth = 1;

    const minFreq = this.settings.centerFrequency - this.settings.spanFrequency / 2;
    const maxFreq = this.settings.centerFrequency + this.settings.spanFrequency / 2;
    const freqStep = this.settings.spanFrequency / 10; // 10 grid lines

    for (let i = 0; i <= 10; i++) {
      const freq = minFreq + i * freqStep;
      const x = (i / 10) * this.canvas.width;

      // Draw grid line
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();

      // Draw frequency label
      const label = (freq / 1000).toFixed(1) + 'k';
      this.ctx.fillText(label, x + 2, 15);
    }

    this.ctx.restore();
  }

  private drawSignalPeaks(peaks: SignalPeak[]): void {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
    this.ctx.font = '10px monospace';
    this.ctx.lineWidth = 1;

    const minFreq = this.settings.centerFrequency - this.settings.spanFrequency / 2;
    const maxFreq = this.settings.centerFrequency + this.settings.spanFrequency / 2;

    for (const peak of peaks) {
      if (peak.frequency >= minFreq && peak.frequency <= maxFreq) {
        const x = ((peak.frequency - minFreq) / this.settings.spanFrequency) * this.canvas.width;

        // Draw vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(x, this.canvas.height - 20);
        this.ctx.lineTo(x, this.canvas.height - 5);
        this.ctx.stroke();

        // Draw SNR label
        const label = `${peak.snr.toFixed(0)}dB`;
        this.ctx.fillText(label, x - 15, this.canvas.height - 25);
      }
    }

    this.ctx.restore();
  }

  clear(): void {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.initializeCanvas();
  }

  captureImage(): string {
    return this.canvas.toDataURL('image/png');
  }
}