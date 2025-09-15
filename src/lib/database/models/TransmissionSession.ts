/**
 * TransmissionSession Entity Model for Ham Radio Web Communication
 *
 * Represents an active or completed image transmission session
 * with progress tracking and error handling.
 */

export interface TransmissionSessionData {
  id: string;
  imageId: string;

  // Session configuration
  sourceCallsign: string;
  destinationCallsign: string;
  priority: 'low' | 'normal' | 'high' | 'emergency';

  // Transmission settings
  bandwidthLimit: number; // bps
  chunkTimeout: number; // milliseconds
  maxRetries: number;
  qualityAdaptation: boolean;
  requireAcknowledgment: boolean;

  // Session state
  status: 'pending' | 'transmitting' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentChunk: number;
  totalChunks: number;
  chunksTransmitted: number;
  chunksRemaining: number[];

  // Progress tracking
  bytesTransmitted: number;
  totalBytes: number;
  currentBandwidth: number;
  averageBandwidth: number;
  estimatedTimeRemaining: number;

  // Quality and adaptation
  currentQuality: number;
  adaptationHistory: QualityAdaptation[];

  // Error tracking
  errorCount: number;
  retryCount: number;
  lastError?: TransmissionError;
  errorHistory: TransmissionError[];

  // Timestamps
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;

  // FCC compliance
  stationIdTransmissions: Date[];
  complianceNotes?: string;

  // Results
  finalStatus?: 'success' | 'partial' | 'failed';
  transmissionResult?: TransmissionResult;
}

export interface QualityAdaptation {
  timestamp: Date;
  fromQuality: number;
  toQuality: number;
  reason: string;
  signalMetrics: SignalQualityMetrics;
}

export interface SignalQualityMetrics {
  snr: number; // Signal-to-noise ratio in dB
  errorRate: number; // Bit error rate
  signalStrength: number; // Relative signal strength (0-1)
  timestamp: Date;
}

export interface TransmissionError {
  timestamp: Date;
  chunkId?: number;
  errorCode: string;
  errorMessage: string;
  context?: any;
  retryable: boolean;
}

export interface TransmissionResult {
  success: boolean;
  chunksTransmitted: number;
  totalTransmissionTime: number;
  averageBandwidth: number;
  retransmissionCount: number;
  qualityAchieved: number;
  bandwidthEfficiency: number; // percentage
}

export class TransmissionSession implements TransmissionSessionData {
  id: string;
  imageId: string;
  sourceCallsign: string;
  destinationCallsign: string;
  priority: 'low' | 'normal' | 'high' | 'emergency';
  bandwidthLimit: number;
  chunkTimeout: number;
  maxRetries: number;
  qualityAdaptation: boolean;
  requireAcknowledgment: boolean;
  status: 'pending' | 'transmitting' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentChunk: number;
  totalChunks: number;
  chunksTransmitted: number;
  chunksRemaining: number[];
  bytesTransmitted: number;
  totalBytes: number;
  currentBandwidth: number;
  averageBandwidth: number;
  estimatedTimeRemaining: number;
  currentQuality: number;
  adaptationHistory: QualityAdaptation[];
  errorCount: number;
  retryCount: number;
  lastError?: TransmissionError;
  errorHistory: TransmissionError[];
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  stationIdTransmissions: Date[];
  complianceNotes?: string;
  finalStatus?: 'success' | 'partial' | 'failed';
  transmissionResult?: TransmissionResult;

  constructor(data: Partial<TransmissionSessionData>) {
    this.id = data.id || this.generateId();
    this.imageId = data.imageId || '';
    this.sourceCallsign = data.sourceCallsign || '';
    this.destinationCallsign = data.destinationCallsign || '';
    this.priority = data.priority || 'normal';
    this.bandwidthLimit = data.bandwidthLimit || 2400;
    this.chunkTimeout = data.chunkTimeout || 30000;
    this.maxRetries = data.maxRetries || 3;
    this.qualityAdaptation = data.qualityAdaptation !== false;
    this.requireAcknowledgment = data.requireAcknowledgment !== false;
    this.status = data.status || 'pending';
    this.currentChunk = data.currentChunk || 0;
    this.totalChunks = data.totalChunks || 0;
    this.chunksTransmitted = data.chunksTransmitted || 0;
    this.chunksRemaining = data.chunksRemaining || [];
    this.bytesTransmitted = data.bytesTransmitted || 0;
    this.totalBytes = data.totalBytes || 0;
    this.currentBandwidth = data.currentBandwidth || 0;
    this.averageBandwidth = data.averageBandwidth || 0;
    this.estimatedTimeRemaining = data.estimatedTimeRemaining || 0;
    this.currentQuality = data.currentQuality || 0.8;
    this.adaptationHistory = data.adaptationHistory || [];
    this.errorCount = data.errorCount || 0;
    this.retryCount = data.retryCount || 0;
    this.lastError = data.lastError;
    this.errorHistory = data.errorHistory || [];
    this.startedAt = data.startedAt || new Date();
    this.completedAt = data.completedAt;
    this.lastActivityAt = data.lastActivityAt || new Date();
    this.stationIdTransmissions = data.stationIdTransmissions || [new Date()];
    this.complianceNotes = data.complianceNotes;
    this.finalStatus = data.finalStatus;
    this.transmissionResult = data.transmissionResult;
  }

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the transmission session
   */
  start(): void {
    this.status = 'transmitting';
    this.startedAt = new Date();
    this.lastActivityAt = new Date();
  }

  /**
   * Pause the transmission session
   */
  pause(): void {
    if (this.status === 'transmitting') {
      this.status = 'paused';
      this.lastActivityAt = new Date();
    }
  }

  /**
   * Resume the transmission session
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'transmitting';
      this.lastActivityAt = new Date();
    }
  }

  /**
   * Cancel the transmission session
   */
  cancel(reason: string): void {
    this.status = 'cancelled';
    this.completedAt = new Date();
    this.lastActivityAt = new Date();
    this.complianceNotes = `Cancelled: ${reason}`;
  }

  /**
   * Complete the transmission session
   */
  complete(result: TransmissionResult): void {
    this.status = 'completed';
    this.completedAt = new Date();
    this.lastActivityAt = new Date();
    this.transmissionResult = result;
    this.finalStatus = result.success ? 'success' : 'partial';
  }

  /**
   * Mark session as failed
   */
  fail(error: TransmissionError): void {
    this.status = 'failed';
    this.completedAt = new Date();
    this.lastActivityAt = new Date();
    this.lastError = error;
    this.errorHistory.push(error);
    this.errorCount++;
    this.finalStatus = 'failed';
  }

  /**
   * Record chunk transmission
   */
  recordChunkTransmission(chunkId: number, chunkSize: number): void {
    this.currentChunk = chunkId;
    this.chunksTransmitted++;
    this.bytesTransmitted += chunkSize;
    this.chunksRemaining = this.chunksRemaining.filter(id => id !== chunkId);
    this.lastActivityAt = new Date();

    // Update progress estimates
    this.updateProgressEstimates();
  }

  /**
   * Record transmission error
   */
  recordError(error: TransmissionError): void {
    this.errorCount++;
    this.lastError = error;
    this.errorHistory.push(error);
    this.lastActivityAt = new Date();

    if (error.retryable && this.retryCount < this.maxRetries) {
      this.retryCount++;
    } else {
      this.fail(error);
    }
  }

  /**
   * Adapt quality based on signal conditions
   */
  adaptQuality(newQuality: number, reason: string, signalMetrics: SignalQualityMetrics): void {
    if (!this.qualityAdaptation) return;

    const adaptation: QualityAdaptation = {
      timestamp: new Date(),
      fromQuality: this.currentQuality,
      toQuality: newQuality,
      reason,
      signalMetrics
    };

    this.adaptationHistory.push(adaptation);
    this.currentQuality = newQuality;
    this.lastActivityAt = new Date();
  }

  /**
   * Record station identification transmission
   */
  recordStationId(): void {
    this.stationIdTransmissions.push(new Date());
  }

  /**
   * Check if station ID is due (every 10 minutes)
   */
  isStationIdDue(): boolean {
    const lastStationId = this.stationIdTransmissions[this.stationIdTransmissions.length - 1];
    const timeSinceLastId = Date.now() - lastStationId.getTime();
    return timeSinceLastId >= 10 * 60 * 1000; // 10 minutes in milliseconds
  }

  /**
   * Update progress estimates
   */
  private updateProgressEstimates(): void {
    if (this.startedAt && this.bytesTransmitted > 0) {
      const elapsedSeconds = (Date.now() - this.startedAt.getTime()) / 1000;
      this.currentBandwidth = (this.bytesTransmitted * 8) / elapsedSeconds;
      this.averageBandwidth = this.currentBandwidth; // Simplified - could use moving average

      const remainingBytes = this.totalBytes - this.bytesTransmitted;
      if (this.currentBandwidth > 0) {
        this.estimatedTimeRemaining = (remainingBytes * 8) / this.currentBandwidth;
      }
    }
  }

  /**
   * Get transmission progress percentage
   */
  getProgress(): number {
    if (this.totalBytes === 0) return 0;
    return (this.bytesTransmitted / this.totalBytes) * 100;
  }

  /**
   * Get transmission duration in seconds
   */
  getDuration(): number {
    if (!this.startedAt) return 0;
    const endTime = this.completedAt || new Date();
    return (endTime.getTime() - this.startedAt.getTime()) / 1000;
  }

  /**
   * Check if transmission is active
   */
  isActive(): boolean {
    return this.status === 'transmitting' || this.status === 'paused';
  }

  /**
   * Check if transmission has bandwidth compliance issues
   */
  hasBandwidthIssues(): boolean {
    return this.currentBandwidth > this.bandwidthLimit * 1.1; // 10% tolerance
  }

  /**
   * Get efficiency metrics
   */
  getEfficiencyMetrics(): {
    bandwidthUtilization: number;
    errorRate: number;
    retransmissionRate: number;
  } {
    return {
      bandwidthUtilization: this.bandwidthLimit > 0 ?
        (this.averageBandwidth / this.bandwidthLimit) * 100 : 0,
      errorRate: this.totalChunks > 0 ?
        (this.errorCount / this.totalChunks) * 100 : 0,
      retransmissionRate: this.chunksTransmitted > 0 ?
        (this.retryCount / this.chunksTransmitted) * 100 : 0
    };
  }

  /**
   * Validate session for FCC compliance
   */
  validateCompliance(): {
    isCompliant: boolean;
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Station ID requirements
    if (this.getDuration() > 10 * 60 && this.stationIdTransmissions.length < 2) {
      violations.push('Station ID required every 10 minutes for transmissions over 10 minutes');
    }

    // Bandwidth compliance
    if (this.hasBandwidthIssues()) {
      violations.push(`Bandwidth exceeded limit: ${this.currentBandwidth} bps > ${this.bandwidthLimit} bps`);
    }

    // Callsign validation
    if (!this.isValidCallsign(this.sourceCallsign)) {
      violations.push('Invalid source callsign format');
    }
    if (!this.isValidCallsign(this.destinationCallsign)) {
      violations.push('Invalid destination callsign format');
    }

    // Duration warnings
    if (this.getDuration() > 30 * 60) {
      warnings.push('Transmission duration exceeds 30 minutes - consider breaking into shorter sessions');
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Validate amateur radio callsign format
   */
  private isValidCallsign(callsign: string): boolean {
    const callsignRegex = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignRegex.test(callsign.toUpperCase());
  }

  /**
   * Convert to JSON for storage
   */
  toJSON(): TransmissionSessionData {
    return { ...this };
  }

  /**
   * Create instance from JSON
   */
  static fromJSON(data: any): TransmissionSession {
    return new TransmissionSession(data);
  }
}