/**
 * OFDM Cyclic Prefix Module (T017)
 * 
 * Cyclic prefix generation and removal for OFDM symbols
 * to eliminate inter-symbol interference (ISI) and maintain
 * orthogonality between subcarriers.
 */

export interface CyclicPrefixConfig {
  fftSize: number;           // FFT size (e.g., 64, 128, 256)
  cpLength: number;          // Cyclic prefix length in samples
  cpRatio: number;           // CP length as ratio of FFT size (e.g., 1/4, 1/8)
  windowType: 'rectangular' | 'raised-cosine' | 'hamming';
  rolloffFactor: number;     // For raised-cosine window (0-1)
}

export interface SymbolTiming {
  startSample: number;
  endSample: number;
  cpStartSample: number;
  symbolDuration: number;    // In samples
  cpDuration: number;        // In samples
}

export interface ISIMetrics {
  isiPower: number;          // Inter-symbol interference power
  iciPower: number;          // Inter-carrier interference power
  signalPower: number;
  sirRatio: number;          // Signal-to-interference ratio
}

/**
 * Cyclic Prefix Manager for OFDM
 */
export class CyclicPrefixManager {
  private config: CyclicPrefixConfig;
  private window: Float32Array;
  private symbolBuffer: Float32Array[];
  private timingHistory: SymbolTiming[];
  private readonly MAX_HISTORY = 100;

  constructor(config?: Partial<CyclicPrefixConfig>) {
    // Default configuration for 2.8 kHz channel
    this.config = {
      fftSize: config?.fftSize || 64,
      cpLength: config?.cpLength || 16,  // 1/4 of FFT size default
      cpRatio: config?.cpRatio || 0.25,
      windowType: config?.windowType || 'raised-cosine',
      rolloffFactor: config?.rolloffFactor || 0.1
    };

    // Ensure CP length from ratio if not explicitly set
    if (!config?.cpLength && config?.cpRatio) {
      this.config.cpLength = Math.floor(this.config.fftSize * config.cpRatio);
    }

    this.window = this.generateWindow();
    this.symbolBuffer = [];
    this.timingHistory = [];
  }

  /**
   * Generate window function for smooth transitions
   */
  private generateWindow(): Float32Array {
    const totalLength = this.config.fftSize + this.config.cpLength;
    const window = new Float32Array(totalLength);

    switch (this.config.windowType) {
      case 'rectangular':
        window.fill(1.0);
        break;

      case 'raised-cosine':
        this.generateRaisedCosineWindow(window);
        break;

      case 'hamming':
        this.generateHammingWindow(window);
        break;

      default:
        window.fill(1.0);
    }

    return window;
  }

  /**
   * Generate raised-cosine window with rolloff
   */
  private generateRaisedCosineWindow(window: Float32Array): void {
    const rolloffSamples = Math.floor(this.config.cpLength * this.config.rolloffFactor);
    const totalLength = window.length;

    for (let i = 0; i < totalLength; i++) {
      if (i < rolloffSamples) {
        // Rising edge
        const t = i / rolloffSamples;
        window[i] = 0.5 * (1 - Math.cos(Math.PI * t));
      } else if (i >= totalLength - rolloffSamples) {
        // Falling edge
        const t = (totalLength - i - 1) / rolloffSamples;
        window[i] = 0.5 * (1 - Math.cos(Math.PI * t));
      } else {
        // Flat top
        window[i] = 1.0;
      }
    }
  }

  /**
   * Generate Hamming window
   */
  private generateHammingWindow(window: Float32Array): void {
    const N = window.length;
    for (let i = 0; i < N; i++) {
      window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
    }
  }

  /**
   * Add cyclic prefix to OFDM symbol
   */
  addCyclicPrefix(symbol: Float32Array): Float32Array {
    if (symbol.length !== this.config.fftSize) {
      throw new Error(`Symbol length ${symbol.length} does not match FFT size ${this.config.fftSize}`);
    }

    const totalLength = this.config.fftSize + this.config.cpLength;
    const symbolWithCP = new Float32Array(totalLength);

    // Copy the last cpLength samples to the beginning (cyclic prefix)
    const cpStart = this.config.fftSize - this.config.cpLength;
    for (let i = 0; i < this.config.cpLength; i++) {
      symbolWithCP[i] = symbol[cpStart + i];
    }

    // Copy the full symbol after the CP
    symbolWithCP.set(symbol, this.config.cpLength);

    // Apply window
    for (let i = 0; i < totalLength; i++) {
      symbolWithCP[i] *= this.window[i];
    }

    // Store timing information
    const timing: SymbolTiming = {
      startSample: 0,
      endSample: totalLength - 1,
      cpStartSample: 0,
      symbolDuration: totalLength,
      cpDuration: this.config.cpLength
    };
    this.addTimingHistory(timing);

    return symbolWithCP;
  }

  /**
   * Remove cyclic prefix from received symbol
   */
  removeCyclicPrefix(receivedSymbol: Float32Array): Float32Array {
    const expectedLength = this.config.fftSize + this.config.cpLength;
    
    if (receivedSymbol.length < expectedLength) {
      throw new Error(`Received symbol too short: ${receivedSymbol.length} < ${expectedLength}`);
    }

    // Extract the symbol portion (skip CP)
    const symbol = new Float32Array(this.config.fftSize);
    for (let i = 0; i < this.config.fftSize; i++) {
      symbol[i] = receivedSymbol[this.config.cpLength + i];
    }

    // Verify CP integrity (check for ISI)
    const isiMetrics = this.measureISI(receivedSymbol);
    if (isiMetrics.sirRatio < 10) { // Less than 10 dB SIR
      console.warn(`High ISI detected: SIR = ${isiMetrics.sirRatio.toFixed(1)} dB`);
    }

    return symbol;
  }

  /**
   * Add multiple cyclic prefixes for a sequence of symbols
   */
  addCyclicPrefixToSequence(symbols: Float32Array[]): Float32Array {
    const symbolsWithCP: Float32Array[] = [];
    let totalLength = 0;

    // Process each symbol
    for (const symbol of symbols) {
      const withCP = this.addCyclicPrefix(symbol);
      symbolsWithCP.push(withCP);
      totalLength += withCP.length;
    }

    // Concatenate all symbols
    const sequence = new Float32Array(totalLength);
    let offset = 0;
    
    for (const symbolWithCP of symbolsWithCP) {
      sequence.set(symbolWithCP, offset);
      offset += symbolWithCP.length;
    }

    return sequence;
  }

  /**
   * Extract symbols from a sequence with cyclic prefixes
   */
  extractSymbolsFromSequence(
    sequence: Float32Array,
    numSymbols?: number
  ): Float32Array[] {
    const symbols: Float32Array[] = [];
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const maxSymbols = numSymbols || Math.floor(sequence.length / symbolLength);
    
    let offset = 0;
    
    for (let i = 0; i < maxSymbols && offset + symbolLength <= sequence.length; i++) {
      // Extract symbol with CP
      const symbolWithCP = sequence.slice(offset, offset + symbolLength);
      
      // Remove CP
      const symbol = this.removeCyclicPrefix(symbolWithCP);
      symbols.push(symbol);
      
      offset += symbolLength;
    }

    // Store symbols in buffer for analysis
    this.symbolBuffer = this.symbolBuffer.concat(symbols).slice(-this.MAX_HISTORY);

    return symbols;
  }

  /**
   * Measure Inter-Symbol Interference
   */
  private measureISI(symbolWithCP: Float32Array): ISIMetrics {
    const cpLength = this.config.cpLength;
    const fftSize = this.config.fftSize;
    
    // Compare cyclic prefix with the corresponding end of symbol
    let isiPower = 0;
    let signalPower = 0;
    
    for (let i = 0; i < cpLength; i++) {
      const cpSample = symbolWithCP[i];
      const correspondingSample = symbolWithCP[fftSize + i];
      
      const diff = cpSample - correspondingSample;
      isiPower += diff * diff;
      signalPower += cpSample * cpSample;
    }
    
    // Normalize
    isiPower /= cpLength;
    signalPower /= cpLength;
    
    // Estimate ICI from symbol edges
    let iciPower = 0;
    const edgeSamples = 4; // Check first/last few samples
    
    for (let i = 0; i < edgeSamples; i++) {
      const startEdge = symbolWithCP[cpLength + i];
      const endEdge = symbolWithCP[symbolWithCP.length - edgeSamples + i];
      iciPower += (startEdge * startEdge + endEdge * endEdge) / 2;
    }
    iciPower /= edgeSamples;
    
    // Calculate SIR
    const totalInterference = isiPower + iciPower;
    const sirRatio = signalPower > 0 ? 10 * Math.log10(signalPower / (totalInterference + 1e-10)) : 0;
    
    return {
      isiPower,
      iciPower,
      signalPower,
      sirRatio
    };
  }

  /**
   * Find optimal CP length based on channel conditions
   */
  findOptimalCPLength(
    channelDelaySpread: number,
    sampleRate: number
  ): number {
    // CP should be longer than maximum channel delay spread
    const requiredSamples = Math.ceil(channelDelaySpread * sampleRate);
    
    // Add safety margin (20%)
    const withMargin = Math.ceil(requiredSamples * 1.2);
    
    // Round to power of 2 for efficiency
    let cpLength = 1;
    while (cpLength < withMargin) {
      cpLength *= 2;
    }
    
    // Limit to maximum 1/4 of FFT size
    const maxCP = Math.floor(this.config.fftSize / 4);
    cpLength = Math.min(cpLength, maxCP);
    
    return cpLength;
  }

  /**
   * Adaptive CP adjustment based on channel conditions
   */
  adaptCPLength(isiMetrics: ISIMetrics[]): void {
    if (isiMetrics.length < 10) return; // Need sufficient history
    
    // Calculate average ISI over recent symbols
    const recentMetrics = isiMetrics.slice(-10);
    const avgSIR = recentMetrics.reduce((sum, m) => sum + m.sirRatio, 0) / recentMetrics.length;
    
    if (avgSIR < 15) {
      // Poor SIR, increase CP length
      const newLength = Math.min(
        this.config.cpLength + 4,
        Math.floor(this.config.fftSize / 4)
      );
      
      if (newLength !== this.config.cpLength) {
        this.config.cpLength = newLength;
        this.config.cpRatio = newLength / this.config.fftSize;
        this.window = this.generateWindow();
        console.log(`Increased CP length to ${newLength} samples (SIR: ${avgSIR.toFixed(1)} dB)`);
      }
    } else if (avgSIR > 25) {
      // Good SIR, can reduce CP length for efficiency
      const newLength = Math.max(
        this.config.cpLength - 4,
        Math.floor(this.config.fftSize / 16)
      );
      
      if (newLength !== this.config.cpLength) {
        this.config.cpLength = newLength;
        this.config.cpRatio = newLength / this.config.fftSize;
        this.window = this.generateWindow();
        console.log(`Reduced CP length to ${newLength} samples (SIR: ${avgSIR.toFixed(1)} dB)`);
      }
    }
  }

  /**
   * Calculate spectral efficiency loss due to CP
   */
  getSpectralEfficiencyLoss(): number {
    const totalSymbolLength = this.config.fftSize + this.config.cpLength;
    const usefulSymbolLength = this.config.fftSize;
    
    // Efficiency = useful_length / total_length
    const efficiency = usefulSymbolLength / totalSymbolLength;
    
    // Loss in percentage
    const lossPercentage = (1 - efficiency) * 100;
    
    return lossPercentage;
  }

  /**
   * Get symbol timing for synchronization
   */
  getSymbolTiming(sampleOffset: number = 0): SymbolTiming {
    const symbolDuration = this.config.fftSize + this.config.cpLength;
    
    return {
      startSample: sampleOffset,
      endSample: sampleOffset + symbolDuration - 1,
      cpStartSample: sampleOffset,
      symbolDuration: symbolDuration,
      cpDuration: this.config.cpLength
    };
  }

  /**
   * Estimate timing offset using CP correlation
   */
  estimateTimingOffset(receivedSignal: Float32Array): number {
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const searchRange = Math.min(symbolLength * 2, receivedSignal.length - symbolLength);
    
    let maxCorrelation = 0;
    let bestOffset = 0;
    
    // Search for CP correlation peak
    for (let offset = 0; offset < searchRange; offset++) {
      let correlation = 0;
      
      // Correlate CP with end of symbol
      for (let i = 0; i < this.config.cpLength; i++) {
        const cpSample = receivedSignal[offset + i];
        const endSample = receivedSignal[offset + this.config.fftSize + i];
        correlation += cpSample * endSample;
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestOffset = offset;
      }
    }
    
    return bestOffset;
  }

  /**
   * Apply frequency domain equalization considering CP
   */
  frequencyDomainEqualization(
    symbol: Float32Array,
    channelResponse: Complex[]
  ): Float32Array {
    if (symbol.length !== this.config.fftSize) {
      throw new Error('Symbol length mismatch for equalization');
    }
    
    if (channelResponse.length !== this.config.fftSize) {
      throw new Error('Channel response length mismatch');
    }
    
    // This would typically involve FFT, channel compensation, and IFFT
    // Simplified implementation for demonstration
    const equalized = new Float32Array(this.config.fftSize);
    
    for (let i = 0; i < this.config.fftSize; i++) {
      const h = channelResponse[i];
      const hMagSq = h.real * h.real + h.imag * h.imag;
      
      if (hMagSq > 0.001) { // Avoid division by very small numbers
        // Zero-forcing equalization: Y/H
        equalized[i] = symbol[i] / Math.sqrt(hMagSq);
      } else {
        equalized[i] = 0;
      }
    }
    
    return equalized;
  }

  /**
   * Add timing history for analysis
   */
  private addTimingHistory(timing: SymbolTiming): void {
    this.timingHistory.push(timing);
    
    if (this.timingHistory.length > this.MAX_HISTORY) {
      this.timingHistory.shift();
    }
  }

  /**
   * Get CP configuration
   */
  getConfiguration(): CyclicPrefixConfig {
    return { ...this.config };
  }

  /**
   * Update CP configuration
   */
  updateConfiguration(config: Partial<CyclicPrefixConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recalculate CP length from ratio if needed
    if (config.cpRatio && !config.cpLength) {
      this.config.cpLength = Math.floor(this.config.fftSize * config.cpRatio);
    }
    
    // Regenerate window
    this.window = this.generateWindow();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    averageCPLength: number;
    spectralEfficiencyLoss: number;
    totalSymbolsProcessed: number;
    cpOverheadRatio: number;
  } {
    return {
      averageCPLength: this.config.cpLength,
      spectralEfficiencyLoss: this.getSpectralEfficiencyLoss(),
      totalSymbolsProcessed: this.timingHistory.length,
      cpOverheadRatio: this.config.cpRatio
    };
  }

  /**
   * Reset state
   */
  reset(): void {
    this.symbolBuffer = [];
    this.timingHistory = [];
  }
}

// Type definitions
interface Complex {
  real: number;
  imag: number;
}

export default CyclicPrefixManager;