/**
 * FCC Compliance Manager
 *
 * Central coordinator for all FCC Part 97 compliance checking and enforcement.
 * Task T018 per FCC compliance implementation plan.
 */

import {
  storeComplianceLog,
  getComplianceLog,
  type ComplianceLogEntry
} from '../database/fcc-schema.js';

export interface ComplianceConfig {
  operatorCallsign: string;
  licenseClass: 'NOVICE' | 'TECHNICIAN' | 'GENERAL' | 'ADVANCED' | 'EXTRA';
  emergencyMode: boolean;
  autoStationId: boolean;
}

export interface ComplianceStatus {
  enabled: boolean;
  operatorCallsign: string;
  transmissionMode: 'RF' | 'WEBRTC' | 'HYBRID';
  stationIdTimer: {
    nextDue: number;
    transmissionActive: boolean;
    lastId: number;
  };
  encryptionGuard: {
    blocking: boolean;
    violationCount: number;
  };
  contentFilter: {
    level: 'STRICT' | 'MODERATE' | 'PERMISSIVE';
    emergencyBypass: boolean;
  };
  emergencyMode: boolean;
  violationCount: number;
  lastViolation: number;
}

export interface ComplianceReport {
  generatedAt: number;
  operatorCallsign: string;
  timeRange: { start: number; end: number };
  summary: {
    totalTransmissions: number;
    stationIDCount: number;
    violationCount: number;
    emergencyActivations: number;
    complianceRate: number;
  };
  violations: Array<{
    timestamp: number;
    type: string;
    description: string;
    severity: string;
    resolved: boolean;
  }>;
  recommendations: string[];
}

export class ComplianceManager extends EventTarget {
  private config: ComplianceConfig;
  private enabled: boolean = false;
  private currentMode: 'RF' | 'WEBRTC' | 'HYBRID' = 'WEBRTC';
  private violationCount: number = 0;
  private lastViolation: number = 0;
  private transmissionCount: number = 0;
  private stationIdCount: number = 0;
  private emergencyActivations: number = 0;

  // Component references (will be injected)
  private stationIdTimer: any = null;
  private encryptionGuard: any = null;
  private contentFilter: any = null;
  private callsignValidator: any = null;

  constructor(config: ComplianceConfig) {
    super();
    this.config = {
      emergencyMode: false,
      autoStationId: true,
      ...config
    };

    this.validateCallsign(config.operatorCallsign);
  }

  private validateCallsign(callsign: string): void {
    const callsignRegex = /^[A-Z0-9]{3,6}[A-Z]?$/;
    if (!callsignRegex.test(callsign)) {
      throw new Error(`Invalid callsign format: ${callsign}`);
    }
  }

  /**
   * Initialize compliance manager and all components
   */
  async initialize(): Promise<void> {
    this.enabled = true;

    await this.logEvent({
      logId: `init_${Date.now()}`,
      timestamp: Date.now(),
      eventType: 'STATION_ID',
      description: 'FCC Compliance Manager initialized',
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: this.currentMode,
      severity: 'INFO',
      details: {
        licenseClass: this.config.licenseClass,
        emergencyMode: this.config.emergencyMode
      },
      resolved: true
    });

    this.dispatchEvent(new CustomEvent('compliance-initialized', {
      detail: { operatorCallsign: this.config.operatorCallsign }
    }));
  }

  /**
   * Set transmission mode and update component states
   */
  setTransmissionMode(mode: 'RF' | 'WEBRTC' | 'HYBRID'): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;

    // Update encryption guard blocking status
    if (this.encryptionGuard) {
      this.encryptionGuard.setTransmissionMode(mode);
    }

    this.logEvent({
      logId: `mode_${Date.now()}`,
      timestamp: Date.now(),
      eventType: 'STATION_ID',
      description: `Transmission mode changed: ${previousMode} → ${mode}`,
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: mode,
      severity: 'INFO',
      details: { previousMode, newMode: mode },
      resolved: true
    });

    this.dispatchEvent(new CustomEvent('transmission-mode-changed', {
      detail: { previousMode, currentMode: mode }
    }));
  }

  /**
   * Start transmission session
   */
  async startTransmission(): Promise<void> {
    this.transmissionCount++;

    // Start station ID timer if in RF mode
    if (this.currentMode === 'RF' && this.stationIdTimer) {
      await this.stationIdTimer.start(this.config.operatorCallsign);
    }

    await this.logEvent({
      logId: `tx_start_${Date.now()}`,
      timestamp: Date.now(),
      eventType: 'STATION_ID',
      description: `Transmission started in ${this.currentMode} mode`,
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: this.currentMode,
      severity: 'INFO',
      details: { transmissionNumber: this.transmissionCount },
      resolved: true
    });

    this.dispatchEvent(new CustomEvent('transmission-started', {
      detail: { mode: this.currentMode, count: this.transmissionCount }
    }));
  }

  /**
   * End transmission session
   */
  async endTransmission(): Promise<void> {
    // Stop station ID timer and send final ID if needed
    if (this.stationIdTimer) {
      await this.stationIdTimer.stop();
    }

    await this.logEvent({
      logId: `tx_end_${Date.now()}`,
      timestamp: Date.now(),
      eventType: 'STATION_ID',
      description: `Transmission ended in ${this.currentMode} mode`,
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: this.currentMode,
      severity: 'INFO',
      details: {},
      resolved: true
    });

    this.dispatchEvent(new CustomEvent('transmission-ended', {
      detail: { mode: this.currentMode }
    }));
  }

  /**
   * Validate encryption operation through encryption guard
   */
  validateEncryption(operation: string, algorithm?: string): boolean {
    if (!this.encryptionGuard) {
      // Default blocking in RF mode
      if (this.currentMode === 'RF' && ['encrypt', 'decrypt', 'ecdh'].includes(operation)) {
        this.recordViolation('ENCRYPTION_BLOCK',
          `${operation} operation blocked in RF mode`, 'CRITICAL');
        return false;
      }
      return true;
    }

    const result = this.encryptionGuard.validateOperation({
      operation,
      algorithm,
      timestamp: Date.now()
    });

    if (!result.allowed) {
      this.recordViolation('ENCRYPTION_BLOCK',
        result.violation.reason, 'CRITICAL');
    }

    return result.allowed;
  }

  /**
   * Filter content through content filter
   */
  async filterContent(content: string, mimeType?: string): Promise<{
    passed: boolean;
    warnings: string[];
    blockedReasons: string[];
    emergencyOverride: boolean;
  }> {
    if (!this.contentFilter) {
      // Basic default filtering
      const warnings: string[] = [];
      const blockedReasons: string[] = [];

      if (mimeType && mimeType.startsWith('audio/') && !this.config.emergencyMode) {
        blockedReasons.push('Music files prohibited on amateur radio (§97.113)');
      }

      const result = {
        passed: blockedReasons.length === 0,
        warnings,
        blockedReasons,
        emergencyOverride: this.config.emergencyMode && blockedReasons.length > 0
      };

      if (!result.passed && !result.emergencyOverride) {
        await this.logEvent({
          logId: `content_block_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'CONTENT_FILTER',
          description: `Content blocked: ${blockedReasons.join(', ')}`,
          operatorCallsign: this.config.operatorCallsign,
          transmissionMode: this.currentMode,
          severity: 'WARNING',
          details: { mimeType, contentLength: content.length },
          resolved: false
        });
      }

      return result;
    }

    return this.contentFilter.filterContent(content, mimeType);
  }

  /**
   * Validate callsign through callsign validator
   */
  async validateCallsign(callsign: string): Promise<{
    callsign: string;
    valid: boolean;
    licenseClass?: string;
    country: string;
    source: string;
  }> {
    if (!this.callsignValidator) {
      // Basic format validation
      const formatValid = /^[A-Z0-9]{3,6}[A-Z]?$/.test(callsign);

      const result = {
        callsign,
        valid: formatValid,
        country: this.getCountryFromCallsign(callsign),
        source: 'LOCAL'
      };

      await this.logEvent({
        logId: `callsign_val_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'CALLSIGN_VALIDATION',
        description: `Callsign validation: ${callsign} - ${result.valid ? 'VALID' : 'INVALID'}`,
        operatorCallsign: this.config.operatorCallsign,
        transmissionMode: this.currentMode,
        severity: result.valid ? 'INFO' : 'WARNING',
        details: result,
        resolved: true
      });

      return result;
    }

    return this.callsignValidator.validateCallsign(callsign);
  }

  private getCountryFromCallsign(callsign: string): string {
    if (callsign.startsWith('W') || callsign.startsWith('K') || callsign.startsWith('N')) return 'US';
    if (callsign.startsWith('VE')) return 'CA';
    if (callsign.startsWith('JA')) return 'JP';
    if (callsign.startsWith('DL')) return 'DE';
    if (callsign.startsWith('G')) return 'GB';
    return 'UNKNOWN';
  }

  /**
   * Set emergency mode
   */
  setEmergencyMode(enabled: boolean): void {
    this.config.emergencyMode = enabled;

    if (enabled) {
      this.emergencyActivations++;
    }

    // Update content filter
    if (this.contentFilter) {
      this.contentFilter.setEmergencyMode(enabled);
    }

    this.logEvent({
      logId: `emergency_${Date.now()}`,
      timestamp: Date.now(),
      eventType: 'STATION_ID',
      description: `Emergency mode ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`,
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: this.currentMode,
      severity: enabled ? 'WARNING' : 'INFO',
      details: { activationCount: this.emergencyActivations },
      resolved: true
    });

    this.dispatchEvent(new CustomEvent('emergency-mode-changed', {
      detail: { enabled, activationCount: this.emergencyActivations }
    }));
  }

  /**
   * Force manual station identification
   */
  async forceStationId(): Promise<void> {
    if (this.stationIdTimer) {
      await this.stationIdTimer.forceId();
    } else {
      // Manual station ID without timer
      this.stationIdCount++;

      await this.logEvent({
        logId: `manual_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'STATION_ID',
        description: `Manual station ID: ${this.config.operatorCallsign}`,
        operatorCallsign: this.config.operatorCallsign,
        transmissionMode: this.currentMode,
        severity: 'INFO',
        details: { method: 'DIGITAL', manual: true },
        resolved: true
      });
    }
  }

  /**
   * Record compliance violation
   */
  private async recordViolation(eventType: string, description: string, severity: 'WARNING' | 'VIOLATION' | 'CRITICAL'): Promise<void> {
    this.violationCount++;
    this.lastViolation = Date.now();

    await this.logEvent({
      logId: `violation_${Date.now()}`,
      timestamp: this.lastViolation,
      eventType: eventType as any,
      description,
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: this.currentMode,
      severity: severity as any,
      details: { violationNumber: this.violationCount },
      resolved: false
    });

    this.dispatchEvent(new CustomEvent('compliance-violation', {
      detail: {
        eventType,
        description,
        severity,
        count: this.violationCount
      }
    }));
  }

  /**
   * Get current compliance status
   */
  getStatus(): ComplianceStatus {
    const stationIdStatus = this.stationIdTimer ? this.stationIdTimer.getStatus() : {
      nextDue: 0,
      transmissionActive: false,
      lastIdSent: 0
    };

    const encryptionStatus = this.encryptionGuard ? this.encryptionGuard.getStatus() : {
      blocking: this.currentMode === 'RF',
      violationCount: 0
    };

    const contentFilterStatus = this.contentFilter ? {
      level: 'MODERATE' as const,
      emergencyBypass: this.config.emergencyMode
    } : {
      level: 'MODERATE' as const,
      emergencyBypass: this.config.emergencyMode
    };

    return {
      enabled: this.enabled,
      operatorCallsign: this.config.operatorCallsign,
      transmissionMode: this.currentMode,
      stationIdTimer: {
        nextDue: stationIdStatus.nextDue || 0,
        transmissionActive: stationIdStatus.transmissionActive || false,
        lastId: stationIdStatus.lastIdSent || 0
      },
      encryptionGuard: {
        blocking: encryptionStatus.blocking,
        violationCount: encryptionStatus.violationCount || 0
      },
      contentFilter: contentFilterStatus,
      emergencyMode: this.config.emergencyMode,
      violationCount: this.violationCount,
      lastViolation: this.lastViolation
    };
  }

  /**
   * Generate compliance report for FCC inspection
   */
  async generateComplianceReport(options: {
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<ComplianceReport> {
    const now = Date.now();
    const startTime = options.startDate?.getTime() || (now - 24 * 60 * 60 * 1000);
    const endTime = options.endDate?.getTime() || now;

    // Get logs for the time period
    const logs = await getComplianceLog(startTime, endTime);

    // Analyze logs
    const stationIdEvents = logs.filter(l => l.eventType === 'STATION_ID' && l.details?.method);
    const violations = logs.filter(l => l.severity === 'VIOLATION');

    const complianceRate = this.transmissionCount > 0
      ? Math.max(0, (this.transmissionCount - violations.length) / this.transmissionCount)
      : 1.0;

    return {
      generatedAt: now,
      operatorCallsign: this.config.operatorCallsign,
      timeRange: { start: startTime, end: endTime },
      summary: {
        totalTransmissions: this.transmissionCount,
        stationIDCount: stationIdEvents.length,
        violationCount: violations.length,
        emergencyActivations: this.emergencyActivations,
        complianceRate
      },
      violations: violations.map(v => ({
        timestamp: v.timestamp,
        type: v.eventType,
        description: v.description,
        severity: v.severity,
        resolved: v.resolved
      })),
      recommendations: this.generateRecommendations(violations.length, complianceRate)
    };
  }

  private generateRecommendations(violationCount: number, complianceRate: number): string[] {
    const recommendations: string[] = [];

    if (violationCount === 0) {
      recommendations.push('Excellent compliance record - continue current practices');
    } else {
      recommendations.push('Review and address compliance violations promptly');

      if (complianceRate < 0.95) {
        recommendations.push('Consider additional operator training on FCC regulations');
      }

      if (this.currentMode === 'RF') {
        recommendations.push('Ensure proper transmission mode detection before crypto operations');
      }
    }

    if (this.emergencyActivations > 0) {
      recommendations.push('Document all emergency communications for FCC records');
    }

    return recommendations;
  }

  /**
   * Get audit log
   */
  async getAuditLog(options: {
    startTime?: number;
    endTime?: number;
    eventType?: string;
    limit?: number;
  } = {}): Promise<ComplianceLogEntry[]> {
    return getComplianceLog(
      options.startTime,
      options.endTime,
      options.eventType as any,
      options.limit
    );
  }

  /**
   * Export audit log for FCC inspection
   */
  async exportAuditLog(): Promise<string> {
    const logs = await this.getAuditLog();

    const report = {
      operator: this.config.operatorCallsign,
      licenseClass: this.config.licenseClass,
      exportTimestamp: Date.now(),
      totalEvents: logs.length,
      violationCount: this.violationCount,
      events: logs
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Log compliance event
   */
  private async logEvent(entry: ComplianceLogEntry): Promise<void> {
    try {
      await storeComplianceLog(entry);
    } catch (error) {
      console.error('Failed to log compliance event:', error);
      // Don't throw - logging failure shouldn't break compliance
    }
  }

  /**
   * Inject dependencies (for testing and modular architecture)
   */
  setComponents(components: {
    stationIdTimer?: any;
    encryptionGuard?: any;
    contentFilter?: any;
    callsignValidator?: any;
  }): void {
    if (components.stationIdTimer) {
      this.stationIdTimer = components.stationIdTimer;
    }
    if (components.encryptionGuard) {
      this.encryptionGuard = components.encryptionGuard;
    }
    if (components.contentFilter) {
      this.contentFilter = components.contentFilter;
    }
    if (components.callsignValidator) {
      this.callsignValidator = components.callsignValidator;
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.enabled = false;

    if (this.stationIdTimer) {
      this.stationIdTimer.dispose?.();
    }
    if (this.encryptionGuard) {
      this.encryptionGuard.dispose?.();
    }
    if (this.contentFilter) {
      this.contentFilter.dispose?.();
    }
    if (this.callsignValidator) {
      this.callsignValidator.dispose?.();
    }
  }
}

export { ComplianceManager as default };