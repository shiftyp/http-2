/**
 * Spectrum Monitor
 * Real-time spectrum monitoring and signal analysis
 */

import { SpectrumData, SpectrumDataProcessor, SpectrumDataFactory } from './models/SpectrumData';
import { SignalPeak } from './models/SignalPeak';
import { MonitoringConfiguration } from './models/MonitoringConfiguration';
import { SDRDevice } from './models/SDRDevice';

export interface MonitoringSession {
  /** Session identifier */
  id: string;

  /** Associated SDR device */
  device: SDRDevice;

  /** Monitoring configuration */
  configuration: MonitoringConfiguration;

  /** Session start time */
  startTime: Date;

  /** Session status */
  status: SessionStatus;

  /** Current spectrum data */
  currentSpectrum?: SpectrumData;

  /** Monitoring statistics */
  statistics: MonitoringStatistics;

  /** Signal history */
  signalHistory: SignalHistory;
}

export interface MonitoringStatistics {
  /** Total samples processed */
  totalSamples: number;

  /** Processing time statistics */
  processingTime: ProcessingTimeStats;

  /** Signal detection statistics */
  signalDetection: SignalDetectionStats;

  /** Frequency coverage statistics */
  frequencyCoverage: FrequencyCoverageStats;

  /** Error statistics */
  errors: ErrorStatistics;

  /** Performance metrics */
  performance: PerformanceMetrics;
}

export interface SignalHistory {
  /** Historical signal peaks */
  peaks: TimestampedSignalPeak[];

  /** Maximum history size */
  maxHistorySize: number;

  /** Signal tracking data */
  tracking: SignalTrackingData[];

  /** Statistics by signal type */
  typeStatistics: Map<string, SignalTypeStats>;
}

export interface ProcessingTimeStats {
  /** Average processing time in ms */
  average: number;

  /** Minimum processing time in ms */
  minimum: number;

  /** Maximum processing time in ms */
  maximum: number;

  /** Total processing time in ms */
  total: number;

  /** Sample count */
  sampleCount: number;
}

export interface SignalDetectionStats {
  /** Total signals detected */
  totalDetected: number;

  /** Signals by type */
  byType: Map<string, number>;

  /** Detection rate (signals per second) */
  detectionRate: number;

  /** False positive rate */
  falsePositiveRate: number;

  /** Confidence distribution */
  confidenceDistribution: number[];
}

export interface FrequencyCoverageStats {
  /** Frequency ranges monitored */
  monitoredRanges: Array<{ start: number; end: number; time: number }>;

  /** Total bandwidth covered */
  totalBandwidth: number;

  /** Coverage efficiency (0-1) */
  coverageEfficiency: number;

  /** Time per frequency bin */
  timePerBin: Map<number, number>;
}

export interface ErrorStatistics {
  /** Total errors */
  totalErrors: number;

  /** Errors by type */
  byType: Map<string, number>;

  /** Error rate (errors per sample) */
  errorRate: number;

  /** Recent errors */
  recentErrors: Array<{ timestamp: Date; error: string; severity: string }>;
}

export interface PerformanceMetrics {
  /** CPU usage percentage */
  cpuUsage: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Throughput in samples per second */
  throughput: number;

  /** Buffer utilization percentage */
  bufferUtilization: number;

  /** Sample rate achieved */
  actualSampleRate: number;
}

export interface TimestampedSignalPeak {
  /** Timestamp */
  timestamp: Date;

  /** Signal peak data */
  peak: SignalPeak;

  /** Session ID */
  sessionId: string;
}

export interface SignalTrackingData {
  /** Signal ID */
  signalId: string;

  /** First detection time */
  firstSeen: Date;

  /** Last detection time */
  lastSeen: Date;

  /** Frequency history */
  frequencyHistory: Array<{ timestamp: Date; frequency: number; power: number }>;

  /** Signal characteristics */
  characteristics: SignalCharacteristics;

  /** Classification confidence */
  confidence: number;
}

export interface SignalTypeStats {
  /** Count of signals */
  count: number;

  /** Average signal strength */
  averageStrength: number;

  /** Average duration */
  averageDuration: number;

  /** Frequency distribution */
  frequencyDistribution: Map<number, number>;

  /** Quality statistics */
  qualityStats: {
    averageSnr: number;
    averageConfidence: number;
    stabilityScore: number;
  };
}

export interface SignalCharacteristics {
  /** Estimated signal bandwidth */
  bandwidth: number;

  /** Modulation type confidence */
  modulationConfidence: Map<string, number>;

  /** Signal stability metrics */
  stability: StabilityMetrics;

  /** Spectral features */
  spectralFeatures: SpectralFeatures;
}

export interface StabilityMetrics {
  /** Frequency stability (Hz std dev) */
  frequencyStability: number;

  /** Power stability (dB std dev) */
  powerStability: number;

  /** Presence stability (0-1) */
  presenceStability: number;

  /** Overall stability score (0-1) */
  overallStability: number;
}

export interface SpectralFeatures {
  /** Spectral centroid */
  centroid: number;

  /** Spectral rolloff */
  rolloff: number;

  /** Spectral flux */
  flux: number;

  /** Zero crossing rate */
  zeroCrossingRate: number;

  /** Spectral entropy */
  entropy: number;
}

export enum SessionStatus {
  INITIALIZING = 'INITIALIZING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}

export class SpectrumMonitor {
  private sessions: Map<string, MonitoringSession> = new Map();
  private monitoringCallbacks: Map<string, MonitoringCallback[]> = new Map();
  private isGlobalMonitoring = false;
  private performanceTimer?: number;

  constructor() {
    this.setupPerformanceMonitoring();
  }

  /**
   * Starts monitoring session
   */
  async startMonitoring(
    device: SDRDevice,
    configuration: MonitoringConfiguration
  ): Promise<string> {
    const sessionId = this.generateSessionId(device, configuration);

    if (this.sessions.has(sessionId)) {
      throw new Error(`Monitoring session ${sessionId} already exists`);
    }

    const session: MonitoringSession = {
      id: sessionId,
      device,
      configuration,
      startTime: new Date(),
      status: SessionStatus.INITIALIZING,
      statistics: this.createInitialStatistics(),
      signalHistory: this.createInitialSignalHistory()
    };

    this.sessions.set(sessionId, session);

    try {
      // Initialize device monitoring
      await this.initializeDeviceMonitoring(session);

      // Start monitoring loop
      await this.startMonitoringLoop(session);

      session.status = SessionStatus.RUNNING;
      this.notifyMonitoringEvent(sessionId, 'started', session);

      return sessionId;
    } catch (error) {
      session.status = SessionStatus.ERROR;
      this.sessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * Stops monitoring session
   */
  async stopMonitoring(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Monitoring session ${sessionId} not found`);
    }

    session.status = SessionStatus.STOPPING;
    this.notifyMonitoringEvent(sessionId, 'stopping', session);

    try {
      // Stop device monitoring
      await this.stopDeviceMonitoring(session);

      session.status = SessionStatus.STOPPED;
      this.notifyMonitoringEvent(sessionId, 'stopped', session);

    } catch (error) {
      session.status = SessionStatus.ERROR;
      this.notifyMonitoringEvent(sessionId, 'error', session, error as Error);
      throw error;
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Pauses monitoring session
   */
  async pauseMonitoring(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Monitoring session ${sessionId} not found`);
    }

    if (session.status !== SessionStatus.RUNNING) {
      throw new Error(`Cannot pause session in status ${session.status}`);
    }

    await this.pauseDeviceMonitoring(session);
    session.status = SessionStatus.PAUSED;
    this.notifyMonitoringEvent(sessionId, 'paused', session);
  }

  /**
   * Resumes monitoring session
   */
  async resumeMonitoring(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Monitoring session ${sessionId} not found`);
    }

    if (session.status !== SessionStatus.PAUSED) {
      throw new Error(`Cannot resume session in status ${session.status}`);
    }

    await this.resumeDeviceMonitoring(session);
    session.status = SessionStatus.RUNNING;
    this.notifyMonitoringEvent(sessionId, 'resumed', session);
  }

  /**
   * Gets monitoring session
   */
  getSession(sessionId: string): MonitoringSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets all active sessions
   */
  getActiveSessions(): MonitoringSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets current spectrum data
   */
  getCurrentSpectrum(sessionId: string): SpectrumData | undefined {
    const session = this.sessions.get(sessionId);
    return session?.currentSpectrum;
  }

  /**
   * Gets signal history
   */
  getSignalHistory(
    sessionId: string,
    timeRange?: { start: Date; end: Date }
  ): TimestampedSignalPeak[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    let history = session.signalHistory.peaks;

    if (timeRange) {
      history = history.filter(peak =>
        peak.timestamp >= timeRange.start && peak.timestamp <= timeRange.end
      );
    }

    return history;
  }

  /**
   * Gets monitoring statistics
   */
  getStatistics(sessionId: string): MonitoringStatistics | undefined {
    const session = this.sessions.get(sessionId);
    return session?.statistics;
  }

  /**
   * Processes spectrum data manually
   */
  async processSpectrumData(
    sessionId: string,
    spectrumData: SpectrumData
  ): Promise<SignalPeak[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Monitoring session ${sessionId} not found`);
    }

    const processingStart = performance.now();

    try {
      // Update session spectrum
      session.currentSpectrum = spectrumData;

      // Detect signals
      const signals = await this.detectSignals(session, spectrumData);

      // Update signal history
      this.updateSignalHistory(session, signals, spectrumData.timestamp);

      // Update statistics
      this.updateStatistics(session, spectrumData, signals, processingStart);

      // Notify listeners
      this.notifyMonitoringEvent(sessionId, 'spectrum_updated', session, undefined, {
        spectrum: spectrumData,
        signals
      });

      return signals;

    } catch (error) {
      this.updateErrorStatistics(session, error as Error);
      throw error;
    }
  }

  /**
   * Registers monitoring event callback
   */
  onMonitoringEvent(sessionId: string, callback: MonitoringCallback): void {
    if (!this.monitoringCallbacks.has(sessionId)) {
      this.monitoringCallbacks.set(sessionId, []);
    }
    this.monitoringCallbacks.get(sessionId)!.push(callback);
  }

  /**
   * Removes monitoring event callback
   */
  offMonitoringEvent(sessionId: string, callback: MonitoringCallback): void {
    const callbacks = this.monitoringCallbacks.get(sessionId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Disposes of all resources
   */
  async dispose(): Promise<void> {
    // Stop all sessions
    const stopPromises = Array.from(this.sessions.keys())
      .map(sessionId => this.stopMonitoring(sessionId));

    await Promise.allSettled(stopPromises);

    // Clear callbacks
    this.monitoringCallbacks.clear();

    // Stop performance monitoring
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
    }
  }

  // Private methods

  private generateSessionId(device: SDRDevice, config: MonitoringConfiguration): string {
    const timestamp = Date.now();
    const deviceId = device.id.substring(0, 8);
    const configHash = this.hashConfiguration(config);
    return `monitor-${deviceId}-${configHash}-${timestamp}`;
  }

  private hashConfiguration(config: MonitoringConfiguration): string {
    // Simple hash of configuration for session ID
    const str = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  private createInitialStatistics(): MonitoringStatistics {
    return {
      totalSamples: 0,
      processingTime: {
        average: 0,
        minimum: Infinity,
        maximum: 0,
        total: 0,
        sampleCount: 0
      },
      signalDetection: {
        totalDetected: 0,
        byType: new Map(),
        detectionRate: 0,
        falsePositiveRate: 0,
        confidenceDistribution: new Array(10).fill(0)
      },
      frequencyCoverage: {
        monitoredRanges: [],
        totalBandwidth: 0,
        coverageEfficiency: 0,
        timePerBin: new Map()
      },
      errors: {
        totalErrors: 0,
        byType: new Map(),
        errorRate: 0,
        recentErrors: []
      },
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        throughput: 0,
        bufferUtilization: 0,
        actualSampleRate: 0
      }
    };
  }

  private createInitialSignalHistory(): SignalHistory {
    return {
      peaks: [],
      maxHistorySize: 10000,
      tracking: [],
      typeStatistics: new Map()
    };
  }

  private async initializeDeviceMonitoring(session: MonitoringSession): Promise<void> {
    // Initialize device-specific monitoring
    console.log(`Initializing monitoring for device ${session.device.id}`);

    // Configure device for monitoring
    // This would set up the actual SDR device parameters
    // For now, this is a placeholder
  }

  private async startMonitoringLoop(session: MonitoringSession): Promise<void> {
    // Start the monitoring loop
    console.log(`Starting monitoring loop for session ${session.id}`);

    // This would start the actual data acquisition loop
    // For now, we'll simulate with sample data
    this.simulateMonitoring(session);
  }

  private simulateMonitoring(session: MonitoringSession): void {
    // Simulate monitoring with sample data for testing
    const interval = setInterval(async () => {
      if (session.status !== SessionStatus.RUNNING) {
        clearInterval(interval);
        return;
      }

      try {
        // Generate sample spectrum data
        const sampleSpectrum = SpectrumDataFactory.createSampleData(
          session.device.id,
          14074000, // 20m band
          2000,     // 2 kHz bandwidth
          3         // 3 signals
        );

        await this.processSpectrumData(session.id, sampleSpectrum);
      } catch (error) {
        console.error('Monitoring simulation error:', error);
      }
    }, 100); // 10 Hz update rate
  }

  private async stopDeviceMonitoring(session: MonitoringSession): Promise<void> {
    // Stop device monitoring
    console.log(`Stopping monitoring for device ${session.device.id}`);
  }

  private async pauseDeviceMonitoring(session: MonitoringSession): Promise<void> {
    // Pause device monitoring
    console.log(`Pausing monitoring for device ${session.device.id}`);
  }

  private async resumeDeviceMonitoring(session: MonitoringSession): Promise<void> {
    // Resume device monitoring
    console.log(`Resuming monitoring for device ${session.device.id}`);
  }

  private async detectSignals(
    session: MonitoringSession,
    spectrumData: SpectrumData
  ): Promise<SignalPeak[]> {
    // Use the spectrum data processor to detect signals
    const signals = SpectrumDataProcessor.detectPeaks(
      spectrumData.fftData,
      spectrumData.noiseFloor,
      spectrumData.centerFrequency,
      spectrumData.bandwidth,
      10 // 10 dB threshold
    );

    // Apply configuration-specific filtering
    const filteredSignals = signals.filter(signal =>
      this.isSignalInMonitoredRange(signal, session.configuration)
    );

    return filteredSignals;
  }

  private isSignalInMonitoredRange(
    signal: SignalPeak,
    config: MonitoringConfiguration
  ): boolean {
    return config.frequencyRanges.some(range =>
      signal.frequency >= range.startFrequency &&
      signal.frequency <= range.endFrequency
    );
  }

  private updateSignalHistory(
    session: MonitoringSession,
    signals: SignalPeak[],
    timestamp: Date
  ): void {
    const history = session.signalHistory;

    // Add new signals to history
    for (const signal of signals) {
      const timestampedPeak: TimestampedSignalPeak = {
        timestamp,
        peak: signal,
        sessionId: session.id
      };

      history.peaks.push(timestampedPeak);

      // Update signal tracking
      this.updateSignalTracking(history, signal, timestamp);
    }

    // Limit history size
    if (history.peaks.length > history.maxHistorySize) {
      const excess = history.peaks.length - history.maxHistorySize;
      history.peaks.splice(0, excess);
    }

    // Update type statistics
    this.updateTypeStatistics(history, signals);
  }

  private updateSignalTracking(
    history: SignalHistory,
    signal: SignalPeak,
    timestamp: Date
  ): void {
    // Find existing tracking data for similar signal
    const existingTrack = history.tracking.find(track => {
      const lastFreq = track.frequencyHistory[track.frequencyHistory.length - 1];
      return Math.abs(lastFreq.frequency - signal.frequency) < signal.bandwidth;
    });

    if (existingTrack) {
      // Update existing track
      existingTrack.lastSeen = timestamp;
      existingTrack.frequencyHistory.push({
        timestamp,
        frequency: signal.frequency,
        power: signal.power
      });

      // Limit frequency history
      if (existingTrack.frequencyHistory.length > 1000) {
        existingTrack.frequencyHistory.shift();
      }
    } else {
      // Create new tracking entry
      const newTrack: SignalTrackingData = {
        signalId: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        firstSeen: timestamp,
        lastSeen: timestamp,
        frequencyHistory: [{
          timestamp,
          frequency: signal.frequency,
          power: signal.power
        }],
        characteristics: {
          bandwidth: signal.bandwidth,
          modulationConfidence: new Map(),
          stability: {
            frequencyStability: 0,
            powerStability: 0,
            presenceStability: 0,
            overallStability: 0
          },
          spectralFeatures: {
            centroid: signal.frequency,
            rolloff: signal.frequency + signal.bandwidth * 0.85,
            flux: 0,
            zeroCrossingRate: 0,
            entropy: 0
          }
        },
        confidence: signal.confidence
      };

      history.tracking.push(newTrack);
    }
  }

  private updateTypeStatistics(
    history: SignalHistory,
    signals: SignalPeak[]
  ): void {
    for (const signal of signals) {
      const typeKey = signal.signalType.toString();

      if (!history.typeStatistics.has(typeKey)) {
        history.typeStatistics.set(typeKey, {
          count: 0,
          averageStrength: 0,
          averageDuration: 0,
          frequencyDistribution: new Map(),
          qualityStats: {
            averageSnr: 0,
            averageConfidence: 0,
            stabilityScore: 0
          }
        });
      }

      const stats = history.typeStatistics.get(typeKey)!;
      stats.count++;

      // Update running averages
      stats.averageStrength = (stats.averageStrength * (stats.count - 1) + signal.power) / stats.count;
      stats.qualityStats.averageSnr = (stats.qualityStats.averageSnr * (stats.count - 1) + signal.snr) / stats.count;
      stats.qualityStats.averageConfidence = (stats.qualityStats.averageConfidence * (stats.count - 1) + signal.confidence) / stats.count;
    }
  }

  private updateStatistics(
    session: MonitoringSession,
    spectrumData: SpectrumData,
    signals: SignalPeak[],
    processingStart: number
  ): void {
    const stats = session.statistics;
    const processingTime = performance.now() - processingStart;

    // Update processing time statistics
    stats.processingTime.total += processingTime;
    stats.processingTime.sampleCount++;
    stats.processingTime.average = stats.processingTime.total / stats.processingTime.sampleCount;
    stats.processingTime.minimum = Math.min(stats.processingTime.minimum, processingTime);
    stats.processingTime.maximum = Math.max(stats.processingTime.maximum, processingTime);

    // Update signal detection statistics
    stats.signalDetection.totalDetected += signals.length;
    for (const signal of signals) {
      const typeKey = signal.signalType.toString();
      stats.signalDetection.byType.set(
        typeKey,
        (stats.signalDetection.byType.get(typeKey) || 0) + 1
      );

      // Update confidence distribution
      const confidenceBin = Math.floor(signal.confidence * 10);
      if (confidenceBin >= 0 && confidenceBin < 10) {
        stats.signalDetection.confidenceDistribution[confidenceBin]++;
      }
    }

    // Update sample count
    stats.totalSamples++;

    // Calculate rates
    const sessionDuration = (Date.now() - session.startTime.getTime()) / 1000;
    stats.signalDetection.detectionRate = stats.signalDetection.totalDetected / sessionDuration;
  }

  private updateErrorStatistics(session: MonitoringSession, error: Error): void {
    const stats = session.statistics.errors;

    stats.totalErrors++;
    stats.errorRate = stats.totalErrors / session.statistics.totalSamples;

    const errorType = error.constructor.name;
    stats.byType.set(errorType, (stats.byType.get(errorType) || 0) + 1);

    stats.recentErrors.push({
      timestamp: new Date(),
      error: error.message,
      severity: 'error'
    });

    // Limit recent errors
    if (stats.recentErrors.length > 100) {
      stats.recentErrors.shift();
    }
  }

  private setupPerformanceMonitoring(): void {
    this.performanceTimer = window.setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Update every 5 seconds
  }

  private updatePerformanceMetrics(): void {
    for (const session of this.sessions.values()) {
      if (session.status === SessionStatus.RUNNING) {
        // Update performance metrics
        // This would get actual CPU, memory usage, etc.
        session.statistics.performance.cpuUsage = Math.random() * 100;
        session.statistics.performance.memoryUsage = Math.random() * 1024 * 1024 * 100;
        session.statistics.performance.throughput = Math.random() * 1000000;
        session.statistics.performance.bufferUtilization = Math.random() * 100;
      }
    }
  }

  private notifyMonitoringEvent(
    sessionId: string,
    event: MonitoringEvent,
    session: MonitoringSession,
    error?: Error,
    data?: any
  ): void {
    const callbacks = this.monitoringCallbacks.get(sessionId) || [];
    for (const callback of callbacks) {
      try {
        callback(event, session, error, data);
      } catch (callbackError) {
        console.error('Monitoring event callback error:', callbackError);
      }
    }
  }
}

export type MonitoringEvent = 'started' | 'stopped' | 'paused' | 'resumed' |
                             'stopping' | 'spectrum_updated' | 'signal_detected' |
                             'error';

export type MonitoringCallback = (
  event: MonitoringEvent,
  session: MonitoringSession,
  error?: Error,
  data?: any
) => void;

export default SpectrumMonitor;