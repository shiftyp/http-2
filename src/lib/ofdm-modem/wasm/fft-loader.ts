/**
 * WebAssembly FFT Loader for OFDM
 *
 * Loads and initializes WebAssembly FFT module for high-performance
 * signal processing in OFDM modulation/demodulation.
 */

export interface FFTModule {
  fft: (real: Float32Array, imag: Float32Array, size: number, inverse: boolean) => void;
  allocateFloat32Array: (size: number) => number;
  freeFloat32Array: (ptr: number) => void;
  getFloat32Array: (ptr: number, size: number) => Float32Array;
  setFloat32Array: (ptr: number, data: Float32Array) => void;
}

export class FFTLoader {
  private module: FFTModule | null = null;
  private wasmInstance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;

  /**
   * Load WebAssembly FFT module
   */
  async load(): Promise<void> {
    try {
      // For now, we'll use a JavaScript FFT implementation
      // In production, this would load an actual WASM module
      this.module = this.createJSFFTModule();
    } catch (error) {
      console.error('Failed to load FFT module:', error);
      throw error;
    }
  }

  /**
   * Create JavaScript FFT implementation as fallback
   */
  private createJSFFTModule(): FFTModule {
    return {
      fft: (real: Float32Array, imag: Float32Array, size: number, inverse: boolean) => {
        this.performFFT(real, imag, size, inverse);
      },
      allocateFloat32Array: (size: number) => {
        // Simulate memory allocation
        return size * 4; // Return fake pointer
      },
      freeFloat32Array: (ptr: number) => {
        // Simulate memory deallocation
      },
      getFloat32Array: (ptr: number, size: number) => {
        return new Float32Array(size);
      },
      setFloat32Array: (ptr: number, data: Float32Array) => {
        // Simulate memory write
      }
    };
  }

  /**
   * Perform FFT using JavaScript implementation
   * Cooley-Tukey radix-2 decimation-in-time FFT
   */
  private performFFT(real: Float32Array, imag: Float32Array, size: number, inverse: boolean): void {
    const n = size;
    const log2n = Math.log2(n);

    if (log2n !== Math.floor(log2n)) {
      throw new Error('FFT size must be a power of 2');
    }

    // Bit reversal
    this.bitReversal(real, imag, n);

    // Cooley-Tukey FFT
    for (let s = 1; s <= log2n; s++) {
      const m = 1 << s;
      const m2 = m >> 1;
      const w = inverse ? 2 * Math.PI / m : -2 * Math.PI / m;

      for (let k = 0; k < n; k += m) {
        for (let j = 0; j < m2; j++) {
          const t = k + j;
          const u = t + m2;

          const angle = w * j;
          const wr = Math.cos(angle);
          const wi = Math.sin(angle);

          const tr = wr * real[u] - wi * imag[u];
          const ti = wr * imag[u] + wi * real[u];

          real[u] = real[t] - tr;
          imag[u] = imag[t] - ti;
          real[t] = real[t] + tr;
          imag[t] = imag[t] + ti;
        }
      }
    }

    // Normalize for inverse FFT
    if (inverse) {
      for (let i = 0; i < n; i++) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }

  /**
   * Bit reversal for FFT
   */
  private bitReversal(real: Float32Array, imag: Float32Array, n: number): void {
    const log2n = Math.log2(n);

    for (let i = 0; i < n; i++) {
      let rev = 0;
      let num = i;

      for (let j = 0; j < log2n; j++) {
        rev = (rev << 1) | (num & 1);
        num >>= 1;
      }

      if (i < rev) {
        // Swap real
        const tempR = real[i];
        real[i] = real[rev];
        real[rev] = tempR;

        // Swap imaginary
        const tempI = imag[i];
        imag[i] = imag[rev];
        imag[rev] = tempI;
      }
    }
  }

  /**
   * Get FFT module
   */
  getModule(): FFTModule | null {
    return this.module;
  }

  /**
   * Perform forward FFT
   */
  fft(real: Float32Array, imag: Float32Array): void {
    if (!this.module) {
      throw new Error('FFT module not loaded');
    }
    this.module.fft(real, imag, real.length, false);
  }

  /**
   * Perform inverse FFT
   */
  ifft(real: Float32Array, imag: Float32Array): void {
    if (!this.module) {
      throw new Error('FFT module not loaded');
    }
    this.module.fft(real, imag, real.length, true);
  }

  /**
   * Calculate power spectrum
   */
  powerSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
    const spectrum = new Float32Array(real.length);

    for (let i = 0; i < real.length; i++) {
      spectrum[i] = real[i] * real[i] + imag[i] * imag[i];
    }

    return spectrum;
  }

  /**
   * Apply window function
   */
  applyWindow(data: Float32Array, windowType: 'hamming' | 'hanning' | 'blackman' = 'hamming'): Float32Array {
    const windowed = new Float32Array(data.length);
    const n = data.length;

    for (let i = 0; i < n; i++) {
      let w = 1;

      switch (windowType) {
        case 'hamming':
          w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
          break;
        case 'hanning':
          w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
          break;
        case 'blackman':
          w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) +
              0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
          break;
      }

      windowed[i] = data[i] * w;
    }

    return windowed;
  }

  /**
   * Unload module and free resources
   */
  unload(): void {
    this.module = null;
    this.wasmInstance = null;
    this.memory = null;
  }
}

export { FFTLoader as default };