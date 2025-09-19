/**
 * OFDM Symbol Synchronization Module (T018)
 * 
 * Symbol timing synchronization for OFDM systems using
 * cyclic prefix correlation, pilot-based methods, and
 * maximum likelihood estimation.
 */

export interface SyncConfig {
  fftSize: number;
  cpLength: number;
  sampleRate: number;
  correlationThreshold: number;
  searchWindow: number;        // Samples to search for sync
  averagingWindow: number;     // Symbols to average for timing
  method: 'cp-correlation' | 'pilot-aided' | 'ml-estimation' | 'hybrid';
}

export interface SyncState {
  synchronized: boolean;
  timingOffset: number;        // Current timing offset in samples
  frequencyOffset: number;     // Estimated frequency offset in Hz
  phase: number;              // Current phase estimate
  confidence: number;         // Sync confidence (0-1)
  symbolCount: number;        // Number of symbols synchronized
  lastSyncTime: number;       // Timestamp of last sync
}

export interface SyncMetrics {
  correlationPeak: number;
  correlationRatio: number;   // Peak to average ratio
  timingError: number;        // RMS timing error
  frequencyError: number;     // Frequency offset error
  symbolErrorRate: number;    // Fraction of incorrectly synced symbols
  meanSquaredError: number;
}

/**
 * Symbol Synchronizer for OFDM
 */
export class SymbolSynchronizer {
  private config: SyncConfig;
  private state: SyncState;
  private correlationHistory: Float32Array;
  private timingHistory: number[];
  private phaseHistory: number[];
  private symbolBuffer: Float32Array;
  private readonly MAX_HISTORY = 100;
  private readonly CORRELATION_MEMORY = 1024;

  constructor(config?: Partial<SyncConfig>) {
    this.config = {
      fftSize: config?.fftSize || 64,
      cpLength: config?.cpLength || 16,
      sampleRate: config?.sampleRate || 48000,
      correlationThreshold: config?.correlationThreshold || 0.7,
      searchWindow: config?.searchWindow || 256,
      averagingWindow: config?.averagingWindow || 10,
      method: config?.method || 'hybrid'
    };

    this.state = {
      synchronized: false,
      timingOffset: 0,
      frequencyOffset: 0,
      phase: 0,
      confidence: 0,
      symbolCount: 0,
      lastSyncTime: Date.now()
    };

    this.correlationHistory = new Float32Array(this.CORRELATION_MEMORY);
    this.timingHistory = [];
    this.phaseHistory = [];
    this.symbolBuffer = new Float32Array(0);
  }

  /**
   * Main synchronization function
   */
  synchronize(receivedSignal: Float32Array): SyncState {
    // Append to buffer
    this.appendToBuffer(receivedSignal);

    switch (this.config.method) {
      case 'cp-correlation':
        this.cpCorrelationSync();
        break;
      case 'pilot-aided':
        this.pilotAidedSync();
        break;
      case 'ml-estimation':
        this.mlEstimationSync();
        break;
      case 'hybrid':
        this.hybridSync();
        break;
    }

    // Update state confidence
    this.updateConfidence();

    return { ...this.state };
  }

  /**
   * Cyclic prefix correlation synchronization
   */
  private cpCorrelationSync(): void {
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const searchLength = Math.min(this.config.searchWindow, this.symbolBuffer.length - symbolLength);

    if (searchLength <= 0) return;

    let maxCorrelation = 0;
    let maxCorrelationIndex = 0;
    let correlationSum = 0;

    // Search for correlation peak
    for (let offset = 0; offset < searchLength; offset++) {
      const correlation = this.calculateCPCorrelation(offset);
      correlationSum += Math.abs(correlation);

      if (Math.abs(correlation) > Math.abs(maxCorrelation)) {
        maxCorrelation = correlation;
        maxCorrelationIndex = offset;
      }

      // Store in history
      this.correlationHistory[offset % this.CORRELATION_MEMORY] = correlation;
    }

    // Calculate correlation metrics
    const avgCorrelation = correlationSum / searchLength;
    const correlationRatio = Math.abs(maxCorrelation) / (avgCorrelation + 1e-10);

    // Check if we found valid sync
    if (correlationRatio > 2.0 && Math.abs(maxCorrelation) > this.config.correlationThreshold) {
      // Update timing offset with smoothing
      const alpha = 0.1; // Smoothing factor
      this.state.timingOffset = alpha * maxCorrelationIndex + (1 - alpha) * this.state.timingOffset;
      
      // Estimate frequency offset from correlation phase
      const correlationPhase = Math.atan2(
        Math.sin(maxCorrelation),
        Math.cos(maxCorrelation)
      );
      this.estimateFrequencyOffset(correlationPhase);

      // Mark as synchronized
      if (!this.state.synchronized) {
        this.state.synchronized = true;
        this.state.lastSyncTime = Date.now();
      }

      // Update history
      this.updateTimingHistory(maxCorrelationIndex);
    }
  }

  /**
   * Calculate cyclic prefix correlation
   */
  private calculateCPCorrelation(offset: number): number {
    let correlationReal = 0;
    let correlationImag = 0;
    let power = 0;

    // Correlate CP with end of symbol
    for (let i = 0; i < this.config.cpLength; i++) {
      const cpSample = this.symbolBuffer[offset + i];
      const endSample = this.symbolBuffer[offset + this.config.fftSize + i];
      
      correlationReal += cpSample * endSample;
      // For complex signals, would also calculate imaginary part
      power += cpSample * cpSample + endSample * endSample;
    }

    // Normalize
    if (power > 0) {
      correlationReal /= Math.sqrt(power);
    }

    return correlationReal;
  }

  /**
   * Pilot-aided synchronization
   */
  private pilotAidedSync(): void {
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const numSymbols = Math.floor(this.symbolBuffer.length / symbolLength);

    if (numSymbols < 1) return;

    let bestMetric = -Infinity;
    let bestOffset = 0;

    // Search for best pilot alignment
    for (let offset = 0; offset < this.config.searchWindow; offset++) {
      const metric = this.calculatePilotMetric(offset);
      
      if (metric > bestMetric) {
        bestMetric = metric;
        bestOffset = offset;
      }
    }

    // Update sync if good metric found
    if (bestMetric > 0.5) {
      this.state.timingOffset = bestOffset;
      this.state.synchronized = true;
      this.updateTimingHistory(bestOffset);
    }
  }

  /**
   * Calculate pilot-based synchronization metric
   */
  private calculatePilotMetric(offset: number): number {
    // Simplified pilot metric calculation
    // In real implementation, would correlate with known pilot patterns
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const pilotPositions = [0, 6, 12, 18, 24, 30, 36, 42]; // Example pilot positions
    
    let metric = 0;
    const symbolStart = offset + this.config.cpLength;
    
    if (symbolStart + this.config.fftSize > this.symbolBuffer.length) {
      return -Infinity;
    }

    // Check pilot power at expected positions
    for (const pilotPos of pilotPositions) {
      if (pilotPos < this.config.fftSize) {
        const sampleIndex = symbolStart + pilotPos;
        const pilotPower = Math.abs(this.symbolBuffer[sampleIndex]);
        metric += pilotPower;
      }
    }

    return metric / pilotPositions.length;
  }

  /**
   * Maximum Likelihood estimation synchronization
   */
  private mlEstimationSync(): void {
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const searchLength = Math.min(this.config.searchWindow, this.symbolBuffer.length - symbolLength);

    if (searchLength <= 0) return;

    let minError = Infinity;
    let bestOffset = 0;

    // Search for minimum error position
    for (let offset = 0; offset < searchLength; offset++) {
      const error = this.calculateMLError(offset);
      
      if (error < minError) {
        minError = error;
        bestOffset = offset;
      }
    }

    // Update sync if error is below threshold
    if (minError < 0.1) {
      this.state.timingOffset = bestOffset;
      this.state.synchronized = true;
      this.updateTimingHistory(bestOffset);
    }
  }

  /**
   * Calculate Maximum Likelihood error metric
   */
  private calculateMLError(offset: number): number {
    let error = 0;
    const symbolLength = this.config.fftSize + this.config.cpLength;
    
    // Check CP similarity
    for (let i = 0; i < this.config.cpLength; i++) {
      const cpSample = this.symbolBuffer[offset + i];
      const endSample = this.symbolBuffer[offset + this.config.fftSize + i];
      const diff = cpSample - endSample;
      error += diff * diff;
    }

    // Check symbol boundaries (should have discontinuity)
    if (offset > 0 && offset + symbolLength < this.symbolBuffer.length) {
      const prevSymbolEnd = this.symbolBuffer[offset - 1];
      const currentSymbolStart = this.symbolBuffer[offset];
      const nextSymbolStart = this.symbolBuffer[offset + symbolLength];
      
      // Boundaries should show discontinuity
      const boundaryDiscontinuity = Math.abs(currentSymbolStart - prevSymbolEnd) +
                                   Math.abs(nextSymbolStart - this.symbolBuffer[offset + symbolLength - 1]);
      
      // Subtract discontinuity (we want high discontinuity at boundaries)
      error -= boundaryDiscontinuity * 0.1;
    }

    return error / this.config.cpLength;
  }

  /**
   * Hybrid synchronization combining multiple methods
   */
  private hybridSync(): void {
    // Start with CP correlation for coarse sync
    this.cpCorrelationSync();

    // Refine with pilot-aided if available
    if (this.state.synchronized) {
      const originalOffset = this.state.timingOffset;
      
      // Search in smaller window around current estimate
      const refinementWindow = 10;
      let bestMetric = -Infinity;
      let bestOffset = originalOffset;

      for (let delta = -refinementWindow; delta <= refinementWindow; delta++) {
        const offset = Math.max(0, originalOffset + delta);
        const pilotMetric = this.calculatePilotMetric(offset);
        const mlError = this.calculateMLError(offset);
        
        // Combined metric
        const combinedMetric = pilotMetric - mlError;
        
        if (combinedMetric > bestMetric) {
          bestMetric = combinedMetric;
          bestOffset = offset;
        }
      }

      this.state.timingOffset = bestOffset;
    }
  }

  /**
   * Estimate frequency offset from correlation phase
   */
  private estimateFrequencyOffset(correlationPhase: number): void {
    this.phaseHistory.push(correlationPhase);
    
    if (this.phaseHistory.length > this.MAX_HISTORY) {
      this.phaseHistory.shift();
    }

    // Estimate frequency offset from phase change
    if (this.phaseHistory.length >= 2) {
      const phaseDiff = correlationPhase - this.phaseHistory[this.phaseHistory.length - 2];
      
      // Unwrap phase
      let unwrappedDiff = phaseDiff;
      while (unwrappedDiff > Math.PI) unwrappedDiff -= 2 * Math.PI;
      while (unwrappedDiff < -Math.PI) unwrappedDiff += 2 * Math.PI;
      
      // Convert to frequency offset
      const symbolDuration = (this.config.fftSize + this.config.cpLength) / this.config.sampleRate;
      const frequencyOffset = unwrappedDiff / (2 * Math.PI * symbolDuration);
      
      // Smooth estimate
      const alpha = 0.1;
      this.state.frequencyOffset = alpha * frequencyOffset + (1 - alpha) * this.state.frequencyOffset;
    }

    // Update phase
    this.state.phase = correlationPhase;
  }

  /**
   * Extract synchronized symbol from buffer
   */
  extractSymbol(): Float32Array | null {
    const symbolLength = this.config.fftSize + this.config.cpLength;
    const offset = Math.round(this.state.timingOffset);
    
    if (offset + symbolLength > this.symbolBuffer.length) {
      return null;
    }

    // Extract symbol with CP
    const symbolWithCP = this.symbolBuffer.slice(offset, offset + symbolLength);
    
    // Remove from buffer
    this.symbolBuffer = this.symbolBuffer.slice(offset + symbolLength);
    
    // Update state
    this.state.symbolCount++;
    
    // Return symbol without CP
    return symbolWithCP.slice(this.config.cpLength);
  }

  /**
   * Extract multiple synchronized symbols
   */
  extractSymbols(count: number): Float32Array[] {
    const symbols: Float32Array[] = [];
    
    for (let i = 0; i < count; i++) {
      const symbol = this.extractSymbol();
      if (symbol) {
        symbols.push(symbol);
      } else {
        break;
      }
    }
    
    return symbols;
  }

  /**
   * Apply frequency offset correction
   */
  correctFrequencyOffset(symbol: Float32Array): Float32Array {
    const corrected = new Float32Array(symbol.length);
    const phaseIncrement = -2 * Math.PI * this.state.frequencyOffset / this.config.sampleRate;
    
    for (let i = 0; i < symbol.length; i++) {
      const phase = phaseIncrement * i;
      // Apply rotation (for complex signals would use complex multiplication)
      corrected[i] = symbol[i] * Math.cos(phase); // Simplified for real signal
    }
    
    return corrected;
  }

  /**
   * Update timing history
   */
  private updateTimingHistory(timing: number): void {
    this.timingHistory.push(timing);
    
    if (this.timingHistory.length > this.MAX_HISTORY) {
      this.timingHistory.shift();
    }
  }

  /**
   * Update synchronization confidence
   */
  private updateConfidence(): void {
    if (!this.state.synchronized) {
      this.state.confidence = 0;
      return;
    }

    // Calculate timing stability
    if (this.timingHistory.length >= this.config.averagingWindow) {
      const recent = this.timingHistory.slice(-this.config.averagingWindow);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const variance = recent.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / recent.length;
      const stdDev = Math.sqrt(variance);
      
      // Low variance = high confidence
      const timingConfidence = Math.exp(-stdDev / 10);
      
      // Time since last sync
      const timeSinceSync = (Date.now() - this.state.lastSyncTime) / 1000;
      const timeConfidence = Math.exp(-timeSinceSync / 10);
      
      // Combined confidence
      this.state.confidence = timingConfidence * timeConfidence;
    }
  }

  /**
   * Append signal to buffer
   */
  private appendToBuffer(signal: Float32Array): void {
    const newBuffer = new Float32Array(this.symbolBuffer.length + signal.length);
    newBuffer.set(this.symbolBuffer);
    newBuffer.set(signal, this.symbolBuffer.length);
    
    // Limit buffer size
    const maxBufferSize = (this.config.fftSize + this.config.cpLength) * 10;
    if (newBuffer.length > maxBufferSize) {
      this.symbolBuffer = newBuffer.slice(-maxBufferSize);
    } else {
      this.symbolBuffer = newBuffer;
    }
  }

  /**
   * Get synchronization metrics
   */
  getMetrics(): SyncMetrics {
    // Find correlation peak
    let correlationPeak = 0;
    let correlationSum = 0;
    
    for (let i = 0; i < this.CORRELATION_MEMORY; i++) {
      const correlation = Math.abs(this.correlationHistory[i]);
      correlationPeak = Math.max(correlationPeak, correlation);
      correlationSum += correlation;
    }
    
    const correlationAvg = correlationSum / this.CORRELATION_MEMORY;
    const correlationRatio = correlationPeak / (correlationAvg + 1e-10);
    
    // Calculate timing error
    let timingError = 0;
    if (this.timingHistory.length >= 2) {
      const recent = this.timingHistory.slice(-10);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      timingError = Math.sqrt(
        recent.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / recent.length
      );
    }
    
    // Symbol error rate (simplified)
    const symbolErrorRate = this.state.synchronized ? 0 : 1;
    
    return {
      correlationPeak,
      correlationRatio,
      timingError,
      frequencyError: Math.abs(this.state.frequencyOffset),
      symbolErrorRate,
      meanSquaredError: timingError * timingError
    };
  }

  /**
   * Get current synchronization state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Get configuration
   */
  getConfiguration(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Force resynchronization
   */
  resync(): void {
    this.state.synchronized = false;
    this.state.confidence = 0;
    this.state.timingOffset = 0;
    this.state.frequencyOffset = 0;
    this.state.phase = 0;
    this.timingHistory = [];
    this.phaseHistory = [];
  }

  /**
   * Reset synchronizer
   */
  reset(): void {
    this.resync();
    this.state.symbolCount = 0;
    this.correlationHistory.fill(0);
    this.symbolBuffer = new Float32Array(0);
  }
}

export default SymbolSynchronizer;