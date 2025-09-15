/**
 * ReceptionStatus Entity Model for Ham Radio Web Communication
 *
 * Represents the status of an ongoing or completed image reception,
 * tracking received chunks, reconstruction progress, and signal quality.
 */

export interface ReceptionStatusData {
  id: string;
  sessionId: string;
  imageId: string;
  sourceCallsign: string;

  // Reception state
  status: 'waiting' | 'receiving' | 'completed' | 'failed' | 'timeout';
  startedAt: Date;
  completedAt?: Date;
  lastChunkAt?: Date;

  // Expected image metadata
  expectedMetadata: ExpectedImageMetadata;

  // Reception progress
  totalChunks: number;
  chunksReceived: number;
  bytesReceived: number;
  missingChunks: number[];
  corruptedChunks: number[];
  duplicateChunks: number[];

  // Quality tracking
  currentQuality: number;
  reconstructibleQuality: number;
  highestQualityReceived: number;

  // Received chunks storage
  receivedChunks: Map<number, ReceivedChunkData>;

  // Signal quality metrics
  signalQuality: ReceptionSignalMetrics;
  signalHistory: SignalQualitySnapshot[];

  // Reconstruction status
  canReconstruct: boolean;
  lastReconstructionAt?: Date;
  reconstructionErrors: string[];

  // Error recovery
  retransmissionRequests: RetransmissionRequest[];
  repairAttempts: RepairAttempt[];

  // Performance metrics
  averageChunkDelay: number;
  estimatedCompletionTime?: number;

  // FCC compliance tracking
  complianceNotes: string[];
  loggedEvents: ReceptionLogEvent[];
}

export interface ExpectedImageMetadata {
  filename: string;
  totalSize: number;
  dimensions: { width: number; height: number };
  format: string;
  totalChunks: number;
  chunkSize: number;
  qualityLevels: number[];
  checksum: string;
}

export interface ReceivedChunkData {
  chunkId: number;
  qualityLevel: number;
  data: Uint8Array;
  checksum: string;
  receivedAt: Date;
  signalMetrics: SignalQualitySnapshot;
  isValid: boolean;
  processingTime: number;
}

export interface ReceptionSignalMetrics {
  averageSnr: number;
  worstSnr: number;
  bestSnr: number;
  averageErrorRate: number;
  averageSignalStrength: number;
  signalStability: number; // 0-1 scale
  lastUpdated: Date;
}

export interface SignalQualitySnapshot {
  timestamp: Date;
  snr: number;
  errorRate: number;
  signalStrength: number;
  chunkId?: number;
}

export interface RetransmissionRequest {
  timestamp: Date;
  requestedChunks: number[];
  reason: string;
  priority: 'low' | 'normal' | 'high';
  acknowledged: boolean;
}

export interface RepairAttempt {
  timestamp: Date;
  targetChunks: number[];
  method: 'checksum-retry' | 'error-correction' | 'interpolation';
  success: boolean;
  repairedChunks: number[];
  notes?: string;
}

export interface ReceptionLogEvent {
  timestamp: Date;
  event: 'START' | 'CHUNK_RECEIVED' | 'RECONSTRUCTION' | 'ERROR' | 'COMPLETE';
  sourceCallsign: string;
  data?: any;
  errorMessage?: string;
}

export class ReceptionStatus implements ReceptionStatusData {
  id: string;
  sessionId: string;
  imageId: string;
  sourceCallsign: string;
  status: 'waiting' | 'receiving' | 'completed' | 'failed' | 'timeout';
  startedAt: Date;
  completedAt?: Date;
  lastChunkAt?: Date;
  expectedMetadata: ExpectedImageMetadata;
  totalChunks: number;
  chunksReceived: number;
  bytesReceived: number;
  missingChunks: number[];
  corruptedChunks: number[];
  duplicateChunks: number[];
  currentQuality: number;
  reconstructibleQuality: number;
  highestQualityReceived: number;
  receivedChunks: Map<number, ReceivedChunkData>;
  signalQuality: ReceptionSignalMetrics;
  signalHistory: SignalQualitySnapshot[];
  canReconstruct: boolean;
  lastReconstructionAt?: Date;
  reconstructionErrors: string[];
  retransmissionRequests: RetransmissionRequest[];
  repairAttempts: RepairAttempt[];
  averageChunkDelay: number;
  estimatedCompletionTime?: number;
  complianceNotes: string[];
  loggedEvents: ReceptionLogEvent[];

  constructor(data: Partial<ReceptionStatusData>) {
    this.id = data.id || this.generateId();
    this.sessionId = data.sessionId || '';
    this.imageId = data.imageId || '';
    this.sourceCallsign = data.sourceCallsign || '';
    this.status = data.status || 'waiting';
    this.startedAt = data.startedAt || new Date();
    this.completedAt = data.completedAt;
    this.lastChunkAt = data.lastChunkAt;
    this.expectedMetadata = data.expectedMetadata || this.getDefaultMetadata();
    this.totalChunks = data.totalChunks || this.expectedMetadata.totalChunks;
    this.chunksReceived = data.chunksReceived || 0;
    this.bytesReceived = data.bytesReceived || 0;
    this.missingChunks = data.missingChunks || this.initializeMissingChunks();
    this.corruptedChunks = data.corruptedChunks || [];
    this.duplicateChunks = data.duplicateChunks || [];
    this.currentQuality = data.currentQuality || 0;
    this.reconstructibleQuality = data.reconstructibleQuality || 0;
    this.highestQualityReceived = data.highestQualityReceived || 0;
    this.receivedChunks = data.receivedChunks || new Map();
    this.signalQuality = data.signalQuality || this.initializeSignalMetrics();
    this.signalHistory = data.signalHistory || [];
    this.canReconstruct = data.canReconstruct || false;
    this.lastReconstructionAt = data.lastReconstructionAt;
    this.reconstructionErrors = data.reconstructionErrors || [];
    this.retransmissionRequests = data.retransmissionRequests || [];
    this.repairAttempts = data.repairAttempts || [];
    this.averageChunkDelay = data.averageChunkDelay || 0;
    this.estimatedCompletionTime = data.estimatedCompletionTime;
    this.complianceNotes = data.complianceNotes || [];
    this.loggedEvents = data.loggedEvents || [];

    // Log initial event
    this.logEvent('START', {
      expectedMetadata: this.expectedMetadata,
      sourceCallsign: this.sourceCallsign
    });
  }

  /**
   * Generate unique reception status ID
   */
  private generateId(): string {
    return `rx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize default metadata
   */
  private getDefaultMetadata(): ExpectedImageMetadata {
    return {
      filename: 'unknown.jpg',
      totalSize: 0,
      dimensions: { width: 0, height: 0 },
      format: 'jpeg',
      totalChunks: 0,
      chunkSize: 512,
      qualityLevels: [0.1, 0.3, 0.5, 0.8],
      checksum: ''
    };
  }

  /**
   * Initialize missing chunks array
   */
  private initializeMissingChunks(): number[] {
    return Array.from({ length: this.totalChunks }, (_, i) => i + 1);
  }

  /**
   * Initialize signal quality metrics
   */
  private initializeSignalMetrics(): ReceptionSignalMetrics {
    return {
      averageSnr: 0,
      worstSnr: Infinity,
      bestSnr: -Infinity,
      averageErrorRate: 0,
      averageSignalStrength: 0,
      signalStability: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Process a received chunk
   */
  processReceivedChunk(chunk: ReceivedChunkData): {
    success: boolean;
    wasNew: boolean;
    isDuplicate: boolean;
    isCorrupted: boolean;
  } {
    const chunkId = chunk.chunkId;
    const wasNew = !this.receivedChunks.has(chunkId);
    const isDuplicate = !wasNew;

    // Validate chunk
    const isValid = this.validateChunk(chunk);

    if (!isValid) {
      this.corruptedChunks.push(chunkId);
      this.logEvent('ERROR', {
        chunkId,
        reason: 'Chunk validation failed',
        checksum: chunk.checksum
      });
      return {
        success: false,
        wasNew,
        isDuplicate,
        isCorrupted: true
      };
    }

    // Process valid chunk
    if (wasNew) {
      this.receivedChunks.set(chunkId, chunk);
      this.chunksReceived++;
      this.bytesReceived += chunk.data.length;
      this.missingChunks = this.missingChunks.filter(id => id !== chunkId);

      // Update quality tracking
      if (chunk.qualityLevel > this.highestQualityReceived) {
        this.highestQualityReceived = chunk.qualityLevel;
      }

      this.updateReconstructionStatus();
    } else {
      this.duplicateChunks.push(chunkId);
    }

    // Update signal metrics
    this.updateSignalMetrics(chunk.signalMetrics);

    // Update timestamps
    this.lastChunkAt = new Date();
    if (this.status === 'waiting') {
      this.status = 'receiving';
    }

    // Update progress estimates
    this.updateProgressEstimates();

    // Log the event
    this.logEvent('CHUNK_RECEIVED', {
      chunkId,
      qualityLevel: chunk.qualityLevel,
      size: chunk.data.length,
      wasNew,
      totalReceived: this.chunksReceived
    });

    return {
      success: true,
      wasNew,
      isDuplicate,
      isCorrupted: false
    };
  }

  /**
   * Validate received chunk
   */
  private validateChunk(chunk: ReceivedChunkData): boolean {
    // Basic validation
    if (!chunk.data || chunk.data.length === 0) return false;
    if (chunk.chunkId < 1 || chunk.chunkId > this.totalChunks) return false;

    // Checksum validation (simplified - would use proper checksum in real implementation)
    const expectedChecksum = `chunk-${chunk.chunkId}-checksum`;
    return chunk.checksum === expectedChecksum;
  }

  /**
   * Update signal quality metrics
   */
  private updateSignalMetrics(snapshot: SignalQualitySnapshot): void {
    this.signalHistory.push(snapshot);

    // Keep only recent history (last 100 samples)
    if (this.signalHistory.length > 100) {
      this.signalHistory.shift();
    }

    // Update aggregate metrics
    const recent = this.signalHistory.slice(-10); // Last 10 samples
    this.signalQuality.averageSnr = recent.reduce((sum, s) => sum + s.snr, 0) / recent.length;
    this.signalQuality.averageErrorRate = recent.reduce((sum, s) => sum + s.errorRate, 0) / recent.length;
    this.signalQuality.averageSignalStrength = recent.reduce((sum, s) => sum + s.signalStrength, 0) / recent.length;

    // Update extremes
    this.signalQuality.bestSnr = Math.max(this.signalQuality.bestSnr, snapshot.snr);
    this.signalQuality.worstSnr = Math.min(this.signalQuality.worstSnr, snapshot.snr);

    // Calculate signal stability (coefficient of variation)
    if (recent.length > 1) {
      const snrValues = recent.map(s => s.snr);
      const mean = snrValues.reduce((sum, val) => sum + val, 0) / snrValues.length;
      const variance = snrValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / snrValues.length;
      const stdDev = Math.sqrt(variance);
      this.signalQuality.signalStability = mean > 0 ? 1 - (stdDev / mean) : 0;
    }

    this.signalQuality.lastUpdated = new Date();
  }

  /**
   * Update reconstruction status
   */
  private updateReconstructionStatus(): void {
    // Check if we have the base chunk (essential for reconstruction)
    const hasBaseChunk = Array.from(this.receivedChunks.values())
      .some(chunk => chunk.qualityLevel === Math.min(...this.expectedMetadata.qualityLevels));

    this.canReconstruct = hasBaseChunk;

    if (this.canReconstruct) {
      // Calculate current reconstructible quality
      const receivedQualities = Array.from(this.receivedChunks.values())
        .map(chunk => chunk.qualityLevel)
        .sort((a, b) => b - a); // Highest first

      this.currentQuality = receivedQualities[0] || 0;

      // Calculate what quality we can reconstruct
      const qualityLevels = [...this.expectedMetadata.qualityLevels].sort();
      let reconstructible = 0;

      for (const qualityLevel of qualityLevels) {
        const hasChunksForQuality = receivedQualities.includes(qualityLevel);
        if (hasChunksForQuality) {
          reconstructible = qualityLevel;
        } else {
          break; // Can't reconstruct higher qualities without lower ones
        }
      }

      this.reconstructibleQuality = reconstructible;
    }

    // Check if reception is complete
    if (this.chunksReceived === this.totalChunks) {
      this.status = 'completed';
      this.completedAt = new Date();
      this.logEvent('COMPLETE', {
        totalChunks: this.chunksReceived,
        finalQuality: this.currentQuality,
        duration: this.getDuration()
      });
    }
  }

  /**
   * Update progress estimates
   */
  private updateProgressEstimates(): void {
    if (this.chunksReceived > 0 && this.startedAt) {
      const elapsedSeconds = (Date.now() - this.startedAt.getTime()) / 1000;
      this.averageChunkDelay = elapsedSeconds / this.chunksReceived;

      const remainingChunks = this.totalChunks - this.chunksReceived;
      if (remainingChunks > 0) {
        this.estimatedCompletionTime = new Date(Date.now() + (remainingChunks * this.averageChunkDelay * 1000));
      }
    }
  }

  /**
   * Request retransmission of missing/corrupted chunks
   */
  requestRetransmission(chunkIds: number[], reason: string, priority: 'low' | 'normal' | 'high' = 'normal'): void {
    const request: RetransmissionRequest = {
      timestamp: new Date(),
      requestedChunks: chunkIds,
      reason,
      priority,
      acknowledged: false
    };

    this.retransmissionRequests.push(request);
    this.logEvent('ERROR', {
      action: 'retransmission_requested',
      chunkIds,
      reason,
      priority
    });
  }

  /**
   * Attempt to repair corrupted data
   */
  attemptRepair(targetChunks: number[], method: 'checksum-retry' | 'error-correction' | 'interpolation'): boolean {
    const attempt: RepairAttempt = {
      timestamp: new Date(),
      targetChunks,
      method,
      success: false,
      repairedChunks: []
    };

    // Simplified repair logic - in real implementation would use actual error correction
    if (method === 'checksum-retry') {
      // Retry validation with different parameters
      attempt.success = Math.random() > 0.3; // 70% success rate simulation
      if (attempt.success) {
        attempt.repairedChunks = targetChunks.slice(0, Math.ceil(targetChunks.length * 0.7));
      }
    }

    this.repairAttempts.push(attempt);

    if (attempt.success) {
      // Remove repaired chunks from corrupted list
      this.corruptedChunks = this.corruptedChunks.filter(id => !attempt.repairedChunks.includes(id));
      this.updateReconstructionStatus();
    }

    return attempt.success;
  }

  /**
   * Handle reception timeout
   */
  handleTimeout(): void {
    this.status = 'timeout';
    this.completedAt = new Date();
    this.logEvent('ERROR', {
      reason: 'Reception timeout',
      chunksReceived: this.chunksReceived,
      missingChunks: this.missingChunks.length
    });
  }

  /**
   * Mark reception as failed
   */
  fail(reason: string): void {
    this.status = 'failed';
    this.completedAt = new Date();
    this.reconstructionErrors.push(reason);
    this.logEvent('ERROR', {
      reason,
      finalStatus: 'failed'
    });
  }

  /**
   * Get reception progress percentage
   */
  getProgress(): number {
    if (this.totalChunks === 0) return 0;
    return (this.chunksReceived / this.totalChunks) * 100;
  }

  /**
   * Get reception duration in seconds
   */
  getDuration(): number {
    if (!this.startedAt) return 0;
    const endTime = this.completedAt || new Date();
    return (endTime.getTime() - this.startedAt.getTime()) / 1000;
  }

  /**
   * Check if reception is active
   */
  isActive(): boolean {
    return this.status === 'waiting' || this.status === 'receiving';
  }

  /**
   * Get quality metrics
   */
  getQualityMetrics(): {
    completionPercentage: number;
    qualityPercentage: number;
    signalQualityScore: number;
    errorRate: number;
  } {
    return {
      completionPercentage: this.getProgress(),
      qualityPercentage: (this.reconstructibleQuality / Math.max(...this.expectedMetadata.qualityLevels)) * 100,
      signalQualityScore: Math.min(100, (this.signalQuality.averageSnr + 20) / 40 * 100), // SNR normalized to 0-100
      errorRate: (this.corruptedChunks.length / Math.max(1, this.chunksReceived)) * 100
    };
  }

  /**
   * Log reception event
   */
  private logEvent(event: 'START' | 'CHUNK_RECEIVED' | 'RECONSTRUCTION' | 'ERROR' | 'COMPLETE', data?: any): void {
    this.loggedEvents.push({
      timestamp: new Date(),
      event,
      sourceCallsign: this.sourceCallsign,
      data,
      errorMessage: event === 'ERROR' ? data?.reason : undefined
    });
  }

  /**
   * Convert to JSON for storage
   */
  toJSON(): Omit<ReceptionStatusData, 'receivedChunks'> & {
    receivedChunksArray: Array<[number, ReceivedChunkData]>;
  } {
    return {
      ...this,
      receivedChunks: undefined as any,
      receivedChunksArray: Array.from(this.receivedChunks.entries())
    };
  }

  /**
   * Create instance from JSON
   */
  static fromJSON(data: any): ReceptionStatus {
    const statusData = { ...data };

    // Restore Map from array
    if (data.receivedChunksArray) {
      statusData.receivedChunks = new Map(data.receivedChunksArray);
    }

    return new ReceptionStatus(statusData);
  }
}