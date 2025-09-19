/**
 * OFDM Audio Interface (T029)
 * 
 * Integration between OFDM modem and Web Audio API for
 * real-time signal processing and transmission.
 */

import { OFDMModem } from './index.js';
import type { OFDMSymbol, OFDMConfiguration } from './index.js';

export interface AudioInterfaceOptions {
  sampleRate?: number;
  bufferSize?: number;
  inputDevice?: string;
  outputDevice?: string;
  gain?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
}

export interface AudioStreamStats {
  inputLevel: number;
  outputLevel: number;
  clipping: boolean;
  latency: number;
  bufferUnderruns: number;
  sampleRate: number;
}

/**
 * OFDM Audio Interface
 */
export class OFDMAudioInterface {
  private modem: OFDMModem;
  private audioContext: AudioContext | null = null;
  private inputStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private options: Required<AudioInterfaceOptions>;
  private stats: AudioStreamStats;
  private transmitBuffer: Float32Array[] = [];
  private receiveBuffer: Float32Array[] = [];
  private isTransmitting = false;
  private isReceiving = false;

  constructor(modem: OFDMModem, options: AudioInterfaceOptions = {}) {
    this.modem = modem;
    this.options = {
      sampleRate: options.sampleRate || 48000,
      bufferSize: options.bufferSize || 4096,
      inputDevice: options.inputDevice || 'default',
      outputDevice: options.outputDevice || 'default',
      gain: options.gain || 1.0,
      noiseSuppression: options.noiseSuppression ?? true,
      echoCancellation: options.echoCancellation ?? true
    };
    
    this.stats = {
      inputLevel: 0,
      outputLevel: 0,
      clipping: false,
      latency: 0,
      bufferUnderruns: 0,
      sampleRate: this.options.sampleRate
    };
  }

  /**
   * Initialize audio interface
   */
  async initialize(): Promise<void> {
    // Create audio context
    this.audioContext = new AudioContext({
      sampleRate: this.options.sampleRate,
      latencyHint: 'interactive'
    });

    // Get user media
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: this.options.inputDevice,
        sampleRate: this.options.sampleRate,
        echoCancellation: this.options.echoCancellation,
        noiseSuppression: this.options.noiseSuppression,
        autoGainControl: false
      }
    };

    try {
      this.inputStream = await navigator.mediaDevices.getUserMedia(constraints);
      await this.setupAudioNodes();
    } catch (error) {
      throw new Error(`Failed to initialize audio: ${error}`);
    }
  }

  /**
   * Setup audio processing nodes
   */
  private async setupAudioNodes(): Promise<void> {
    if (!this.audioContext || !this.inputStream) {
      throw new Error('Audio context not initialized');
    }

    // Create source from input stream
    this.sourceNode = this.audioContext.createMediaStreamSource(this.inputStream);
    
    // Create script processor for OFDM processing
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.options.bufferSize,
      1, // Mono input
      1  // Mono output
    );

    // Create analyser for signal monitoring
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Create gain node for output control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.options.gain;

    // Setup processing callback
    this.scriptProcessor.onaudioprocess = (event) => {
      this.processAudio(event);
    };

    // Connect nodes
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  /**
   * Process audio samples
   */
  private processAudio(event: AudioProcessingEvent): void {
    const inputData = event.inputBuffer.getChannelData(0);
    const outputData = event.outputBuffer.getChannelData(0);

    // Update signal levels
    this.updateSignalLevels(inputData);

    if (this.isTransmitting) {
      // Transmit mode: modulate data to OFDM
      this.processTransmit(inputData, outputData);
    } else if (this.isReceiving) {
      // Receive mode: demodulate OFDM
      this.processReceive(inputData, outputData);
    } else {
      // Passthrough
      outputData.set(inputData);
    }

    // Check for buffer underruns
    if (event.playbackTime - this.audioContext!.currentTime > 0.05) {
      this.stats.bufferUnderruns++;
    }
  }

  /**
   * Process transmit path
   */
  private processTransmit(input: Float32Array, output: Float32Array): void {
    // Add to transmit buffer
    this.transmitBuffer.push(new Float32Array(input));

    // Check if we have enough samples for an OFDM symbol
    const symbolSamples = this.modem.getConfiguration().fftSize;
    const totalSamples = this.transmitBuffer.reduce((sum, buf) => sum + buf.length, 0);

    if (totalSamples >= symbolSamples) {
      // Combine buffers
      const combined = new Float32Array(totalSamples);
      let offset = 0;
      for (const buf of this.transmitBuffer) {
        combined.set(buf, offset);
        offset += buf.length;
      }

      // Extract symbol worth of samples
      const symbolData = combined.slice(0, symbolSamples);
      
      // Modulate to OFDM
      const modulated = this.modulateOFDM(symbolData);
      
      // Output modulated signal
      const outputLength = Math.min(modulated.length, output.length);
      for (let i = 0; i < outputLength; i++) {
        output[i] = modulated[i] * this.options.gain;
      }

      // Keep remaining samples
      this.transmitBuffer = [combined.slice(symbolSamples)];
    } else {
      // Not enough samples, output silence
      output.fill(0);
    }
  }

  /**
   * Process receive path
   */
  private processReceive(input: Float32Array, output: Float32Array): void {
    // Add to receive buffer
    this.receiveBuffer.push(new Float32Array(input));

    const symbolSamples = this.modem.getConfiguration().fftSize;
    const totalSamples = this.receiveBuffer.reduce((sum, buf) => sum + buf.length, 0);

    if (totalSamples >= symbolSamples) {
      // Combine buffers
      const combined = new Float32Array(totalSamples);
      let offset = 0;
      for (const buf of this.receiveBuffer) {
        combined.set(buf, offset);
        offset += buf.length;
      }

      // Extract symbol
      const symbolData = combined.slice(0, symbolSamples);
      
      // Demodulate OFDM
      const demodulated = this.demodulateOFDM(symbolData);
      
      // Process demodulated data
      this.modem.processReceivedSymbol(demodulated);

      // Keep remaining samples
      this.receiveBuffer = [combined.slice(symbolSamples)];
    }

    // Output monitoring tone or silence
    output.fill(0);
  }

  /**
   * Modulate data to OFDM symbol
   */
  private modulateOFDM(data: Float32Array): Float32Array {
    const config = this.modem.getConfiguration();
    const symbol: OFDMSymbol = {
      subcarriers: [],
      pilotTones: [],
      timestamp: Date.now()
    };

    // Map data to subcarriers
    const dataPerCarrier = Math.floor(data.length / config.numDataCarriers);
    
    for (let i = 0; i < config.numDataCarriers; i++) {
      const carrierData = data.slice(i * dataPerCarrier, (i + 1) * dataPerCarrier);
      
      symbol.subcarriers.push({
        index: i,
        amplitude: this.calculateAmplitude(carrierData),
        phase: this.calculatePhase(carrierData),
        data: carrierData
      });
    }

    // Add pilot tones
    for (const pilotIndex of config.pilotCarriers) {
      symbol.pilotTones.push({
        index: pilotIndex,
        amplitude: 1.0,
        phase: Math.PI / 4 // Known pilot phase
      });
    }

    // Perform IFFT to generate time-domain signal
    return this.modem.generateOFDMSymbol(symbol);
  }

  /**
   * Demodulate OFDM symbol
   */
  private demodulateOFDM(data: Float32Array): any {
    // Perform FFT to get frequency domain
    const fftResult = this.modem.performFFT(data);
    
    // Extract subcarrier data
    const config = this.modem.getConfiguration();
    const subcarriers = [];
    
    for (let i = 0; i < config.numCarriers; i++) {
      if (!config.pilotCarriers.includes(i)) {
        subcarriers.push({
          index: i,
          amplitude: fftResult.magnitudes[i],
          phase: fftResult.phases[i]
        });
      }
    }

    return {
      subcarriers,
      snr: this.estimateSNR(fftResult),
      timestamp: Date.now()
    };
  }

  /**
   * Calculate amplitude from samples
   */
  private calculateAmplitude(samples: Float32Array): number {
    let sum = 0;
    for (const sample of samples) {
      sum += sample * sample;
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Calculate phase from samples
   */
  private calculatePhase(samples: Float32Array): number {
    // Simple phase estimation using Hilbert transform approximation
    let real = 0;
    let imag = 0;
    
    for (let i = 0; i < samples.length; i++) {
      real += samples[i] * Math.cos(2 * Math.PI * i / samples.length);
      imag += samples[i] * Math.sin(2 * Math.PI * i / samples.length);
    }
    
    return Math.atan2(imag, real);
  }

  /**
   * Estimate SNR from FFT result
   */
  private estimateSNR(fftResult: any): number {
    const signal = fftResult.magnitudes.reduce((sum: number, mag: number) => sum + mag * mag, 0);
    const noise = Math.random() * 0.1; // Simplified noise estimation
    return 10 * Math.log10(signal / noise);
  }

  /**
   * Update signal level statistics
   */
  private updateSignalLevels(samples: Float32Array): void {
    let maxLevel = 0;
    let sumSquares = 0;
    
    for (const sample of samples) {
      const absSample = Math.abs(sample);
      maxLevel = Math.max(maxLevel, absSample);
      sumSquares += sample * sample;
    }

    this.stats.inputLevel = Math.sqrt(sumSquares / samples.length);
    this.stats.clipping = maxLevel >= 0.99;
    this.stats.latency = this.audioContext
      ? this.audioContext.baseLatency + this.audioContext.outputLatency
      : 0;
  }

  /**
   * Start transmitting
   */
  async startTransmit(data?: Uint8Array): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    this.isTransmitting = true;
    this.isReceiving = false;
    this.transmitBuffer = [];

    // If data provided, queue for transmission
    if (data) {
      this.queueDataForTransmit(data);
    }
  }

  /**
   * Start receiving
   */
  async startReceive(): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    this.isReceiving = true;
    this.isTransmitting = false;
    this.receiveBuffer = [];
  }

  /**
   * Stop transmission/reception
   */
  stop(): void {
    this.isTransmitting = false;
    this.isReceiving = false;
    this.transmitBuffer = [];
    this.receiveBuffer = [];
  }

  /**
   * Queue data for transmission
   */
  queueDataForTransmit(data: Uint8Array): void {
    // Convert bytes to audio samples
    const samples = new Float32Array(data.length * 8); // 8 samples per byte
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      for (let bit = 0; bit < 8; bit++) {
        samples[i * 8 + bit] = ((byte >> bit) & 1) ? 0.5 : -0.5;
      }
    }

    this.transmitBuffer.push(samples);
  }

  /**
   * Set gain
   */
  setGain(gain: number): void {
    this.options.gain = Math.max(0, Math.min(2, gain));
    if (this.gainNode) {
      this.gainNode.gain.value = this.options.gain;
    }
  }

  /**
   * Get audio statistics
   */
  getStats(): AudioStreamStats {
    return { ...this.stats };
  }

  /**
   * Get spectrum data for visualization
   */
  getSpectrumData(): Uint8Array | null {
    if (!this.analyser) return null;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    return dataArray;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stop();

    if (this.inputStream) {
      this.inputStream.getTracks().forEach(track => track.stop());
      this.inputStream = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export default OFDMAudioInterface;