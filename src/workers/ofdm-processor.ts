/**
 * OFDM Processor Web Worker
 *
 * Offloads computationally intensive OFDM processing to a dedicated worker thread
 * to prevent blocking the main UI thread.
 */

import { FFTLoader } from '../lib/ofdm-modem/wasm/fft-loader.js';

interface ProcessorMessage {
  type: 'init' | 'modulate' | 'demodulate' | 'estimate-snr' | 'process-chunk';
  id: string;
  data?: any;
}

interface ProcessorResponse {
  type: 'ready' | 'result' | 'error';
  id: string;
  data?: any;
  error?: string;
}

class OFDMProcessor {
  private fftLoader: FFTLoader;
  private initialized: boolean = false;
  private fftSize: number = 64; // 48 data + 16 guard
  private numCarriers: number = 48;
  private pilotIndices: number[] = [];

  constructor() {
    this.fftLoader = new FFTLoader();
    this.initializePilotIndices();
  }

  /**
   * Initialize pilot carrier indices
   */
  private initializePilotIndices(): void {
    // Pilots at every 6th carrier
    for (let i = 0; i < this.numCarriers; i += 6) {
      this.pilotIndices.push(i);
    }
  }

  /**
   * Initialize processor
   */
  async initialize(): Promise<void> {
    try {
      await this.fftLoader.load();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize OFDM processor: ${error}`);
    }
  }

  /**
   * Modulate data to OFDM symbol
   */
  modulate(data: Uint8Array, modulation: string = 'QPSK'): Float32Array {
    if (!this.initialized) {
      throw new Error('Processor not initialized');
    }

    // Convert data to symbols
    const symbols = this.dataToSymbols(data, modulation);

    // Map symbols to carriers
    const carriers = new Float32Array(this.fftSize * 2); // Real and imag
    const real = new Float32Array(this.fftSize);
    const imag = new Float32Array(this.fftSize);

    // Place symbols on carriers
    let symbolIndex = 0;
    for (let i = 0; i < this.numCarriers; i++) {
      if (!this.pilotIndices.includes(i) && symbolIndex < symbols.length / 2) {
        real[i] = symbols[symbolIndex * 2];
        imag[i] = symbols[symbolIndex * 2 + 1];
        symbolIndex++;
      } else if (this.pilotIndices.includes(i)) {
        // Insert pilot
        real[i] = i % 12 === 0 ? 1 : -1;
        imag[i] = 0;
      }
    }

    // Perform IFFT to create time-domain signal
    this.fftLoader.ifft(real, imag);

    // Add cyclic prefix (copy last 25% to beginning)
    const cpLength = Math.floor(this.fftSize * 0.25);
    const output = new Float32Array((this.fftSize + cpLength) * 2);

    // Copy cyclic prefix
    for (let i = 0; i < cpLength; i++) {
      output[i * 2] = real[this.fftSize - cpLength + i];
      output[i * 2 + 1] = imag[this.fftSize - cpLength + i];
    }

    // Copy main symbol
    for (let i = 0; i < this.fftSize; i++) {
      output[(cpLength + i) * 2] = real[i];
      output[(cpLength + i) * 2 + 1] = imag[i];
    }

    return output;
  }

  /**
   * Demodulate OFDM symbol to data
   */
  demodulate(signal: Float32Array, modulation: string = 'QPSK'): Uint8Array {
    if (!this.initialized) {
      throw new Error('Processor not initialized');
    }

    // Remove cyclic prefix
    const cpLength = Math.floor(this.fftSize * 0.25);
    const real = new Float32Array(this.fftSize);
    const imag = new Float32Array(this.fftSize);

    for (let i = 0; i < this.fftSize; i++) {
      real[i] = signal[(cpLength + i) * 2];
      imag[i] = signal[(cpLength + i) * 2 + 1];
    }

    // Perform FFT to get frequency-domain symbols
    this.fftLoader.fft(real, imag);

    // Extract data symbols (skip pilots)
    const symbols: number[] = [];
    for (let i = 0; i < this.numCarriers; i++) {
      if (!this.pilotIndices.includes(i)) {
        symbols.push(real[i], imag[i]);
      }
    }

    // Convert symbols to data
    return this.symbolsToData(new Float32Array(symbols), modulation);
  }

  /**
   * Convert data bytes to modulation symbols
   */
  private dataToSymbols(data: Uint8Array, modulation: string): Float32Array {
    const bitsPerSymbol = this.getBitsPerSymbol(modulation);
    const numSymbols = Math.ceil((data.length * 8) / bitsPerSymbol);
    const symbols = new Float32Array(numSymbols * 2); // Real and imag

    let bitIndex = 0;
    for (let i = 0; i < numSymbols; i++) {
      let value = 0;

      // Extract bits for this symbol
      for (let b = 0; b < bitsPerSymbol; b++) {
        if (bitIndex < data.length * 8) {
          const byteIndex = Math.floor(bitIndex / 8);
          const bitOffset = 7 - (bitIndex % 8);
          const bit = (data[byteIndex] >> bitOffset) & 1;
          value = (value << 1) | bit;
          bitIndex++;
        }
      }

      // Map to constellation point
      const point = this.mapToConstellation(value, modulation);
      symbols[i * 2] = point.real;
      symbols[i * 2 + 1] = point.imag;
    }

    return symbols;
  }

  /**
   * Convert modulation symbols to data bytes
   */
  private symbolsToData(symbols: Float32Array, modulation: string): Uint8Array {
    const bitsPerSymbol = this.getBitsPerSymbol(modulation);
    const numBits = (symbols.length / 2) * bitsPerSymbol;
    const data = new Uint8Array(Math.ceil(numBits / 8));

    let bitIndex = 0;
    for (let i = 0; i < symbols.length / 2; i++) {
      const real = symbols[i * 2];
      const imag = symbols[i * 2 + 1];

      // Demap from constellation
      const value = this.demapFromConstellation({ real, imag }, modulation);

      // Store bits
      for (let b = bitsPerSymbol - 1; b >= 0; b--) {
        if (bitIndex < data.length * 8) {
          const byteIndex = Math.floor(bitIndex / 8);
          const bitOffset = 7 - (bitIndex % 8);
          const bit = (value >> b) & 1;

          if (bit) {
            data[byteIndex] |= (1 << bitOffset);
          }
          bitIndex++;
        }
      }
    }

    return data;
  }

  /**
   * Get bits per symbol for modulation type
   */
  private getBitsPerSymbol(modulation: string): number {
    switch (modulation) {
      case 'BPSK': return 1;
      case 'QPSK': return 2;
      case '8PSK': return 3;
      case '16QAM': return 4;
      case '64QAM': return 6;
      default: return 2; // Default to QPSK
    }
  }

  /**
   * Map value to constellation point
   */
  private mapToConstellation(value: number, modulation: string): { real: number; imag: number } {
    const scale = 1 / Math.sqrt(2); // Normalize power

    switch (modulation) {
      case 'BPSK':
        return { real: value === 0 ? -1 : 1, imag: 0 };

      case 'QPSK': {
        const map = [
          { real: -scale, imag: -scale },
          { real: -scale, imag: scale },
          { real: scale, imag: -scale },
          { real: scale, imag: scale }
        ];
        return map[value % 4];
      }

      case '16QAM': {
        const d = 1 / Math.sqrt(10);
        const real = ((value >> 2) & 3) * 2 - 3;
        const imag = (value & 3) * 2 - 3;
        return { real: real * d, imag: imag * d };
      }

      default:
        return { real: 0, imag: 0 };
    }
  }

  /**
   * Demap constellation point to value
   */
  private demapFromConstellation(point: { real: number; imag: number }, modulation: string): number {
    switch (modulation) {
      case 'BPSK':
        return point.real < 0 ? 0 : 1;

      case 'QPSK': {
        let value = 0;
        if (point.real >= 0) value |= 2;
        if (point.imag >= 0) value |= 1;
        return value;
      }

      case '16QAM': {
        const d = 1 / Math.sqrt(10);
        const realBits = Math.round((point.real / d + 3) / 2) & 3;
        const imagBits = Math.round((point.imag / d + 3) / 2) & 3;
        return (realBits << 2) | imagBits;
      }

      default:
        return 0;
    }
  }

  /**
   * Estimate SNR from received signal
   */
  estimateSNR(signal: Float32Array): number {
    // Remove cyclic prefix
    const cpLength = Math.floor(this.fftSize * 0.25);
    const real = new Float32Array(this.fftSize);
    const imag = new Float32Array(this.fftSize);

    for (let i = 0; i < this.fftSize; i++) {
      real[i] = signal[(cpLength + i) * 2];
      imag[i] = signal[(cpLength + i) * 2 + 1];
    }

    // FFT to frequency domain
    this.fftLoader.fft(real, imag);

    // Estimate SNR from pilots
    let signalPower = 0;
    let noisePower = 0;

    for (const pilotIndex of this.pilotIndices) {
      const expectedReal = pilotIndex % 12 === 0 ? 1 : -1;
      const expectedImag = 0;

      // Signal power
      signalPower += expectedReal * expectedReal + expectedImag * expectedImag;

      // Error (noise) power
      const errorReal = real[pilotIndex] - expectedReal;
      const errorImag = imag[pilotIndex] - expectedImag;
      noisePower += errorReal * errorReal + errorImag * errorImag;
    }

    if (noisePower < 1e-10) {
      return 40; // Very high SNR
    }

    return 10 * Math.log10(signalPower / noisePower);
  }

  /**
   * Process BitTorrent chunk for parallel transmission
   */
  processChunk(chunkData: Uint8Array, carrierId: number): Float32Array {
    // Segment chunk for specific carrier
    const segmentSize = Math.floor(chunkData.length / this.numCarriers);
    const start = carrierId * segmentSize;
    const end = Math.min(start + segmentSize, chunkData.length);
    const segment = chunkData.slice(start, end);

    // Modulate segment
    return this.modulate(segment, 'QPSK');
  }
}

// Worker message handler
const processor = new OFDMProcessor();

self.addEventListener('message', async (event: MessageEvent<ProcessorMessage>) => {
  const { type, id, data } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'init':
        await processor.initialize();
        result = { status: 'initialized' };
        break;

      case 'modulate':
        result = processor.modulate(data.input, data.modulation);
        break;

      case 'demodulate':
        result = processor.demodulate(data.signal, data.modulation);
        break;

      case 'estimate-snr':
        result = processor.estimateSNR(data.signal);
        break;

      case 'process-chunk':
        result = processor.processChunk(data.chunk, data.carrierId);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: ProcessorResponse = {
      type: 'result',
      id,
      data: result
    };

    self.postMessage(response);

  } catch (error) {
    const response: ProcessorResponse = {
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error)
    };

    self.postMessage(response);
  }
});

// Notify main thread that worker is ready
self.postMessage({ type: 'ready', id: 'init', data: null });