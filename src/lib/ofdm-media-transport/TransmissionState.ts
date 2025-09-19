/**
 * TransmissionState Model (T017)
 * 
 * State management for OFDM media transmissions,
 * tracking progress, chunks, and performance metrics.
 */

export type TransmissionStatus = 
  | 'queued' 
  | 'scheduled'
  | 'initializing'
  | 'transmitting' 
  | 'paused'
  | 'retrying'
  | 'completed' 
  | 'failed'
  | 'cancelled';

export type TransmissionPriority = 'emergency' | 'high' | 'normal' | 'low' | 'background';
export type TransmissionMode = 'RF' | 'WebRTC' | 'Hybrid';
export type ErrorType = 'network' | 'timeout' | 'fcc_violation' | 'capacity' | 'encoding' | 'unknown';

export interface ChunkInfo {
  id: string;
  index: number;
  size: number;
  offset: number;
  checksum: string;
  status: 'pending' | 'transmitting' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  transmittedAt?: Date;
  acknowledgedAt?: Date;
  error?: string;
  subcarriers?: number[]; // OFDM subcarriers used
}

export interface OFDMAllocation {
  subcarriers: number[];
  bandwidth: number; // Hz
  symbolRate: number; // symbols/second
  modulation: 'BPSK' | 'QPSK' | '16QAM' | '64QAM' | '256QAM';
  codingRate: string; // e.g., "3/4"
  pilots: number[];
  dataRate: number; // bps
  efficiency: number; // bits/s/Hz
}

export interface ChannelMetrics {
  snr: number; // dB
  ber: number; // bit error rate
  per: number; // packet error rate
  rssi: number; // dBm
  frequency: number; // Hz
  timestamp: Date;
  evm: number; // error vector magnitude %
  papr: number; // peak-to-average power ratio dB
}

export interface PerformanceMetrics {
  throughput: number; // bps
  efficiency: number; // actual vs theoretical rate
  latency: number; // ms
  jitter: number; // ms
  overhead: number; // protocol overhead %
  compressionRatio?: number;
  retransmissionRate: number; // %
  acknowledgmentDelay: number; // ms
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponential: boolean;
  jitterMs: number;
  timeoutMs: number;
}

export interface TransmissionError {
  type: ErrorType;
  code: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
  context?: {
    chunk?: string;
    subcarrier?: number;
    frequency?: number;
    snr?: number;
  };
}

export interface NetworkInfo {
  localCallsign: string;
  remoteCallsign: string;
  path?: string[]; // relay path
  hopCount: number;
  maxHops: number;
  meshNodeId?: string;
  connectionType: 'direct' | 'relay' | 'internet';
}

export interface FECInfo {
  enabled: boolean;
  algorithm: 'reed-solomon' | 'ldpc' | 'turbo' | 'convolutional';
  redundancy: number; // 0.0 - 1.0
  blockSize: number;
  correctedErrors?: number;
  uncorrectableErrors?: number;
}

/**
 * Main TransmissionState interface
 */
export interface TransmissionState {
  // Identifiers
  transmissionId: string;
  mediaId: string;
  sessionId?: string;
  
  // Status and progress
  status: TransmissionStatus;
  progress: number; // 0-100
  priority: TransmissionPriority;
  
  // Timing
  queuedAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  scheduledAt?: Date;
  
  // Data transfer
  bytesTotal: number;
  bytesTransmitted: number;
  bytesAcknowledged: number;
  
  // Chunking
  chunks?: ChunkInfo[];
  chunkSize: number;
  totalChunks: number;
  
  // Network
  mode: TransmissionMode;
  network: NetworkInfo;
  
  // OFDM specific
  ofdm?: OFDMAllocation;
  channel?: ChannelMetrics;
  
  // Performance
  metrics: PerformanceMetrics;
  
  // Error handling
  errors: TransmissionError[];
  retryPolicy: RetryPolicy;
  currentAttempt: number;
  
  // Forward Error Correction
  fec?: FECInfo;
  
  // Bandwidth management
  allocatedBandwidth: number; // bps
  usedBandwidth: number; // bps
  targetBandwidth?: number; // bps
  
  // Estimation
  estimatedDuration: number; // seconds
  estimatedCompletion?: Date;
  remainingTime?: number; // seconds
  
  // Metadata
  metadata?: {
    filename?: string;
    mimeType?: string;
    compression?: string;
    originalSize?: number;
    checksum?: string;
    userAgent?: string;
  };
}

/**
 * TransmissionState factory and utilities
 */
export class TransmissionStateFactory {
  /**
   * Create new transmission state
   */
  static create(
    mediaId: string,
    totalBytes: number,
    destination: string,
    options: {
      priority?: TransmissionPriority;
      mode?: TransmissionMode;
      chunkSize?: number;
      scheduledAt?: Date;
      metadata?: any;
    } = {}
  ): TransmissionState {
    const transmissionId = this.generateId();
    const chunkSize = options.chunkSize || this.calculateOptimalChunkSize(totalBytes);
    const totalChunks = Math.ceil(totalBytes / chunkSize);
    
    return {
      transmissionId,
      mediaId,
      status: options.scheduledAt ? 'scheduled' : 'queued',
      progress: 0,
      priority: options.priority || 'normal',
      queuedAt: new Date(),
      scheduledAt: options.scheduledAt,
      bytesTotal: totalBytes,
      bytesTransmitted: 0,
      bytesAcknowledged: 0,
      chunkSize,
      totalChunks,
      mode: options.mode || 'RF',
      network: {
        localCallsign: '', // Will be set by service
        remoteCallsign: destination,
        hopCount: 0,
        maxHops: 3,
        connectionType: 'direct'
      },
      metrics: {
        throughput: 0,
        efficiency: 0,
        latency: 0,
        jitter: 0,
        overhead: 10, // Default 10% overhead
        retransmissionRate: 0,
        acknowledgmentDelay: 0
      },
      errors: [],
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000,
        exponential: true,
        jitterMs: 500,
        timeoutMs: 30000
      },
      currentAttempt: 0,
      allocatedBandwidth: 1200, // Default 1200 bps
      usedBandwidth: 0,
      estimatedDuration: Math.ceil(totalBytes * 8 / 1200), // At 1200 bps
      metadata: options.metadata
    };
  }
  
  /**
   * Create chunks for transmission
   */
  static createChunks(
    transmissionId: string,
    totalBytes: number,
    chunkSize: number
  ): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    let offset = 0;
    let index = 0;
    
    while (offset < totalBytes) {
      const size = Math.min(chunkSize, totalBytes - offset);
      
      chunks.push({
        id: `${transmissionId}_chunk_${index}`,
        index,
        size,
        offset,
        checksum: '', // Will be calculated when data is available
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      });
      
      offset += size;
      index++;
    }
    
    return chunks;
  }
  
  /**
   * Calculate optimal chunk size based on total size and mode
   */
  private static calculateOptimalChunkSize(
    totalBytes: number,
    mode: TransmissionMode = 'RF'
  ): number {
    switch (mode) {
      case 'RF':
        // For RF, use smaller chunks for better error recovery
        if (totalBytes < 1024) return 256; // 256 bytes
        if (totalBytes < 10240) return 512; // 512 bytes
        return 1024; // 1KB max for RF
        
      case 'WebRTC':
        // WebRTC can handle larger chunks
        if (totalBytes < 10240) return 1024; // 1KB
        if (totalBytes < 102400) return 4096; // 4KB
        return 8192; // 8KB max
        
      case 'Hybrid':
        // Adaptive chunk size
        return Math.min(2048, Math.max(512, totalBytes / 100));
        
      default:
        return 1024;
    }
  }
  
  /**
   * Generate unique transmission ID
   */
  private static generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `tx_${timestamp}_${random}`;
  }
}

/**
 * TransmissionState utilities
 */
export class TransmissionStateUtils {
  /**
   * Update progress based on chunks
   */
  static updateProgress(state: TransmissionState): number {
    if (!state.chunks || state.chunks.length === 0) {
      return Math.round((state.bytesTransmitted / state.bytesTotal) * 100);
    }
    
    const completed = state.chunks.filter(chunk => 
      chunk.status === 'completed'
    ).length;
    
    return Math.round((completed / state.chunks.length) * 100);
  }
  
  /**
   * Calculate current throughput
   */
  static calculateThroughput(
    state: TransmissionState,
    windowMs: number = 10000
  ): number {
    if (!state.startedAt) return 0;
    
    const elapsed = Date.now() - state.startedAt.getTime();
    const windowElapsed = Math.min(elapsed, windowMs);
    
    if (windowElapsed < 1000) return 0; // Need at least 1 second
    
    return (state.bytesTransmitted * 8 * 1000) / windowElapsed; // bps
  }
  
  /**
   * Estimate time remaining
   */
  static estimateTimeRemaining(state: TransmissionState): number {
    const throughput = this.calculateThroughput(state);
    if (throughput === 0) return Infinity;
    
    const remaining = state.bytesTotal - state.bytesTransmitted;
    return Math.ceil((remaining * 8) / throughput); // seconds
  }
  
  /**
   * Check if transmission is active
   */
  static isActive(state: TransmissionState): boolean {
    return ['initializing', 'transmitting', 'retrying'].includes(state.status);
  }
  
  /**
   * Check if transmission is complete
   */
  static isComplete(state: TransmissionState): boolean {
    return ['completed', 'failed', 'cancelled'].includes(state.status);
  }
  
  /**
   * Get next chunk to transmit
   */
  static getNextChunk(state: TransmissionState): ChunkInfo | null {
    if (!state.chunks) return null;
    
    // Find first pending chunk
    const pending = state.chunks.find(chunk => 
      chunk.status === 'pending'
    );
    
    if (pending) return pending;
    
    // Find failed chunk that can be retried
    const failed = state.chunks.find(chunk => 
      chunk.status === 'failed' && 
      chunk.attempts < chunk.maxAttempts
    );
    
    return failed || null;
  }
  
  /**
   * Add error to transmission state
   */
  static addError(
    state: TransmissionState,
    error: Omit<TransmissionError, 'timestamp'>
  ): void {
    state.errors.push({
      ...error,
      timestamp: new Date()
    });
    
    // Keep only last 100 errors
    if (state.errors.length > 100) {
      state.errors = state.errors.slice(-100);
    }
  }
  
  /**
   * Calculate retry delay
   */
  static calculateRetryDelay(
    state: TransmissionState,
    attempt: number
  ): number {
    const { backoffMs, exponential, jitterMs } = state.retryPolicy;
    
    let delay = backoffMs;
    
    if (exponential) {
      delay = backoffMs * Math.pow(2, attempt - 1);
    }
    
    // Add jitter
    const jitter = Math.random() * jitterMs;
    delay += jitter;
    
    // Cap at 60 seconds
    return Math.min(delay, 60000);
  }
  
  /**
   * Get transmission summary
   */
  static getSummary(state: TransmissionState): {
    id: string;
    status: string;
    progress: string;
    throughput: string;
    eta: string;
    efficiency: string;
  } {
    const throughput = this.calculateThroughput(state);
    const eta = this.estimateTimeRemaining(state);
    
    return {
      id: state.transmissionId,
      status: state.status.toUpperCase(),
      progress: `${state.progress}% (${state.bytesTransmitted}/${state.bytesTotal} bytes)`,
      throughput: `${Math.round(throughput)} bps`,
      eta: eta === Infinity ? 'Unknown' : `${Math.round(eta)}s`,
      efficiency: `${Math.round(state.metrics.efficiency * 100)}%`
    };
  }
  
  /**
   * Validate transmission state
   */
  static validate(state: TransmissionState): string[] {
    const errors: string[] = [];
    
    if (!state.transmissionId) {
      errors.push('Missing transmission ID');
    }
    
    if (!state.mediaId) {
      errors.push('Missing media ID');
    }
    
    if (state.bytesTotal <= 0) {
      errors.push('Invalid total bytes');
    }
    
    if (state.bytesTransmitted > state.bytesTotal) {
      errors.push('Transmitted bytes exceeds total');
    }
    
    if (state.progress < 0 || state.progress > 100) {
      errors.push('Invalid progress value');
    }
    
    if (state.chunks) {
      const totalChunkBytes = state.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
      if (Math.abs(totalChunkBytes - state.bytesTotal) > state.chunkSize) {
        errors.push('Chunk sizes do not match total bytes');
      }
    }
    
    return errors;
  }
}

export default TransmissionState;
