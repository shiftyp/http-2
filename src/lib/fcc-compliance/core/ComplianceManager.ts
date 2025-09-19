/**
 * FCC Compliance Manager
 *
 * Central coordinator for FCC Part 97 compliance automation including
 * station identification, encryption control, and content filtering.
 */

import {
  FCCComplianceConfig,
  ComplianceCheckResult,
  ComplianceViolation,
  ComplianceLevel,
  ViolationType,
  TransmissionMode,
  ComplianceMonitoringState,
  ComplianceEvent,
  EmergencyOverride,
  ComplianceSystemHealth
} from '../types.js';
import { StationIDTimer } from '../timers/StationIDTimer.js';
import { EncryptionGuard } from '../validators/EncryptionGuard.js';
import { ContentFilter } from '../validators/ContentFilter.js';
import { ComplianceLogger } from '../monitors/ComplianceLogger.js';

export class ComplianceManager {
  private config: FCCComplianceConfig;
  private stationIDTimer: StationIDTimer;
  private encryptionGuard: EncryptionGuard;
  private contentFilter: ContentFilter;
  private complianceLogger: ComplianceLogger;

  private monitoringState: ComplianceMonitoringState;
  private emergencyOverride?: EmergencyOverride;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: FCCComplianceConfig) {
    this.config = config;

    // Initialize components
    this.stationIDTimer = new StationIDTimer(config.stationID);
    this.encryptionGuard = new EncryptionGuard(config.encryptionControl);
    this.contentFilter = new ContentFilter(config.contentFilter);
    this.complianceLogger = new ComplianceLogger();

    // Initialize monitoring state
    this.monitoringState = {
      isActive: false,
      startTime: new Date(),
      currentMode: TransmissionMode.RF,
      stationIDTimer: this.stationIDTimer.getState(),
      lastStationID: new Date(0),
      recentViolations: [],
      warningLevel: ComplianceLevel.COMPLIANT,
      emergencyOverrideActive: false
    };

    this.setupEventHandlers();
  }

  /**
   * Start compliance monitoring
   */
  async start(): Promise<void> {
    if (this.monitoringState.isActive) {
      throw new Error('Compliance monitoring already active');
    }

    // Start all components
    await this.stationIDTimer.start();
    this.encryptionGuard.enable();
    this.contentFilter.enable();

    this.monitoringState.isActive = true;
    this.monitoringState.startTime = new Date();

    await this.logComplianceEvent('compliance', 'Compliance monitoring started');
  }

  /**
   * Stop compliance monitoring
   */
  async stop(): Promise<void> {
    if (!this.monitoringState.isActive) {
      return;
    }

    // Stop all components
    await this.stationIDTimer.stop();
    this.encryptionGuard.disable();
    this.contentFilter.disable();

    this.monitoringState.isActive = false;

    await this.logComplianceEvent('compliance', 'Compliance monitoring stopped');
  }

  /**
   * Check transmission compliance - alias for legacy compatibility
   */
  async checkTransmission(data: {
    data: Uint8Array;
    destination: string;
    type: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    const result = await this.checkTransmissionCompliance(
      data.data,
      this.monitoringState.currentMode,
      { contentType: data.type }
    );

    return {
      allowed: result.compliant && !result.blocked,
      reason: result.blocked ? result.violations.map(v => v.description).join('; ') : undefined
    };
  }

  /**
   * Check emergency override capability
   */
  async checkEmergencyOverride(data: {
    data: Uint8Array;
    priority: number;
    source: string;
  }): Promise<{ allowed: boolean; reason?: string }> {
    // P0 emergency messages always allowed if from valid callsign
    if (data.priority === 0) {
      const callsignValid = this.validateCallsign(data.source);
      if (callsignValid.valid) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Invalid source callsign for emergency override' };
    }

    // P1 urgent messages allowed with some restrictions
    if (data.priority === 1) {
      const callsignValid = this.validateCallsign(data.source);
      return {
        allowed: callsignValid.valid,
        reason: callsignValid.valid ? undefined : 'Invalid source callsign'
      };
    }

    // Other priorities require normal compliance
    const result = await this.checkTransmission({
      data: data.data,
      destination: 'BROADCAST',
      type: 'priority-message'
    });

    return result;
  }

  /**
   * Trigger emergency mode
   */
  async triggerEmergencyMode(): Promise<void> {
    if (!this.emergencyOverride) {
      await this.activateEmergencyOverride(
        'Emergency protocol activated',
        this.config.stationID.callsign,
        'disaster'
      );
    }

    // Emit emergency mode event
    this.emit('emergency-mode-activated');
  }

  /**
   * Get compliance status for HTTP protocol
   */
  getStatus(): any {
    return this.getComplianceStatus();
  }

  /**
   * Validate callsign format
   */
  private validateCallsign(callsign: string): { valid: boolean; reason?: string } {
    if (!callsign || typeof callsign !== 'string') {
      return { valid: false, reason: 'Callsign must be a non-empty string' };
    }

    const clean = callsign.trim().toUpperCase();

    // Basic format validation
    if (clean.length < 3 || clean.length > 6) {
      return { valid: false, reason: 'Callsign must be 3-6 characters long' };
    }

    // Must contain at least one number
    if (!/\d/.test(clean)) {
      return { valid: false, reason: 'Callsign must contain at least one number' };
    }

    // Must start with letter(s) and contain number
    if (!/^[A-Z]{1,2}\d[A-Z]{1,3}$/.test(clean)) {
      return { valid: false, reason: 'Invalid callsign format' };
    }

    return { valid: true };
  }

  /**
   * Check content for FCC compliance before transmission
   */
  async checkTransmissionCompliance(
    content: string | ArrayBuffer,
    mode: TransmissionMode,
    metadata?: {
      frequency?: number;
      power?: number;
      contentType?: string;
    }
  ): Promise<ComplianceCheckResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: string[] = [];
    let blocked = false;
    let modified = false;

    // Update current transmission context
    this.updateTransmissionContext(mode, metadata);

    // 1. Check station ID compliance (§97.119)
    const stationIDCompliant = await this.checkStationIDCompliance();
    if (!stationIDCompliant.compliant) {
      violations.push(...stationIDCompliant.violations);
      if (stationIDCompliant.shouldBlock) {
        blocked = true;
      }
    }

    // 2. Check encryption compliance (§97.113)
    const encryptionCheck = await this.encryptionGuard.checkContent(content, mode);
    if (!encryptionCheck.compliant) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.ENCRYPTION_BLOCKED,
        severity: 'critical',
        timestamp: new Date(),
        description: 'Encryption detected in RF transmission mode',
        regulation: '§97.113(a)(4)',
        content: typeof content === 'string' ? content.substring(0, 100) : '[Binary data]',
        transmissionMode: mode,
        callsign: this.config.stationID.callsign,
        blocked: true,
        overridden: false
      });
      blocked = true;
    }

    // 3. Check content compliance (§97.113)
    const contentCheck = await this.contentFilter.analyzeContent(content);
    if (!contentCheck.compliant) {
      violations.push(...contentCheck.violations);
      if (contentCheck.shouldBlock) {
        blocked = true;
      }
      if (contentCheck.modified) {
        modified = true;
      }
      warnings.push(...contentCheck.warnings);
    }

    // 4. Check power and frequency compliance
    if (metadata?.power && metadata.power > this.getMaxPowerForBand(metadata.frequency)) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.POWER_EXCEEDED,
        severity: 'high',
        timestamp: new Date(),
        description: `Power ${metadata.power}W exceeds limit for frequency`,
        regulation: '§97.313',
        transmissionMode: mode,
        callsign: this.config.stationID.callsign,
        frequency: metadata.frequency,
        power: metadata.power,
        blocked: true,
        overridden: false
      });
      blocked = true;
    }

    // Determine compliance level
    let level = ComplianceLevel.COMPLIANT;
    if (violations.length > 0) {
      const hasHighSeverity = violations.some(v => v.severity === 'critical' || v.severity === 'high');
      level = hasHighSeverity ? ComplianceLevel.VIOLATION : ComplianceLevel.WARNING;
    } else if (warnings.length > 0) {
      level = ComplianceLevel.WARNING;
    }

    // Apply emergency override if active
    if (this.emergencyOverride && level === ComplianceLevel.VIOLATION) {
      level = ComplianceLevel.EMERGENCY_OVERRIDE;
      blocked = false;
      violations.forEach(v => v.overridden = true);
    }

    const result: ComplianceCheckResult = {
      compliant: level === ComplianceLevel.COMPLIANT || level === ComplianceLevel.EMERGENCY_OVERRIDE,
      level,
      violations,
      warnings,
      stationIDCompliant: stationIDCompliant.compliant,
      encryptionCompliant: encryptionCheck.compliant,
      contentCompliant: contentCheck.compliant,
      blocked,
      modified,
      logged: true,
      timestamp: new Date()
    };

    // Log violations
    if (violations.length > 0) {
      await this.logViolations(violations);
    }

    // Update monitoring state
    this.monitoringState.recentViolations.push(...violations);
    this.monitoringState.warningLevel = level;

    // Emit compliance event
    this.emit('compliance-check', result);

    return result;
  }

  /**
   * Activate emergency override
   */
  async activateEmergencyOverride(
    reason: string,
    authority: string,
    emergencyType: EmergencyOverride['emergencyType']
  ): Promise<void> {
    if (this.emergencyOverride) {
      throw new Error('Emergency override already active');
    }

    this.emergencyOverride = {
      id: crypto.randomUUID(),
      callsign: this.config.stationID.callsign,
      startTime: new Date(),
      reason,
      authority,
      scope: ['§97.113', '§97.119'], // Common overrides for emergency
      emergencyType,
      jurisdiction: authority,
      violationsOverridden: [],
      postEmergencyReview: false
    };

    this.monitoringState.emergencyOverrideActive = true;
    this.monitoringState.emergencyStartTime = new Date();

    await this.logComplianceEvent('emergency', `Emergency override activated: ${reason}`);
    this.emit('emergency-override-activated', this.emergencyOverride);
  }

  /**
   * Deactivate emergency override
   */
  async deactivateEmergencyOverride(): Promise<void> {
    if (!this.emergencyOverride) {
      throw new Error('No emergency override active');
    }

    this.emergencyOverride.endTime = new Date();
    this.monitoringState.emergencyOverrideActive = false;
    this.monitoringState.emergencyStartTime = undefined;

    await this.logComplianceEvent('emergency', 'Emergency override deactivated');
    this.emit('emergency-override-deactivated', this.emergencyOverride);

    this.emergencyOverride = undefined;
  }

  /**
   * Update transmission mode (called by transmission-mode library)
   */
  setTransmissionMode(mode: TransmissionMode): void {
    const previousMode = this.monitoringState.currentMode;
    this.monitoringState.currentMode = mode;

    // Update encryption guard for mode change
    this.encryptionGuard.setTransmissionMode(mode);

    this.emit('mode-changed', { from: previousMode, to: mode });
  }

  /**
   * Force station identification
   */
  async forceStationID(): Promise<void> {
    await this.stationIDTimer.forceStationID();
    this.monitoringState.lastStationID = new Date();

    await this.logComplianceEvent('station_id', 'Manual station identification');
  }

  /**
   * Get current compliance status
   */
  getComplianceStatus(): {
    compliant: boolean;
    level: ComplianceLevel;
    nextStationID: Date;
    recentViolations: ComplianceViolation[];
    emergencyOverride: boolean;
  } {
    return {
      compliant: this.monitoringState.warningLevel === ComplianceLevel.COMPLIANT,
      level: this.monitoringState.warningLevel,
      nextStationID: this.monitoringState.stationIDTimer.nextIDTime,
      recentViolations: this.monitoringState.recentViolations.slice(-10),
      emergencyOverride: this.monitoringState.emergencyOverrideActive
    };
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<ComplianceSystemHealth> {
    return {
      operational: this.monitoringState.isActive,
      lastCheck: new Date(),
      stationIDTimer: await this.stationIDTimer.getHealthStatus(),
      contentFilter: this.contentFilter.getHealthStatus(),
      encryptionGuard: this.encryptionGuard.getHealthStatus(),
      responseTime: await this.measureResponseTime(),
      cpuUsage: 0, // Would integrate with performance monitoring
      memoryUsage: 0,
      transmissionModeIntegration: true,
      meshNetworkIntegration: true,
      certificateIntegration: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FCCComplianceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update component configs
    if (newConfig.stationID) {
      this.stationIDTimer.updateConfig(newConfig.stationID);
    }
    if (newConfig.encryptionControl) {
      this.encryptionGuard.updateConfig(newConfig.encryptionControl);
    }
    if (newConfig.contentFilter) {
      this.contentFilter.updateConfig(newConfig.contentFilter);
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in compliance event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check station ID compliance
   */
  private async checkStationIDCompliance(): Promise<{
    compliant: boolean;
    violations: ComplianceViolation[];
    shouldBlock: boolean;
  }> {
    const violations: ComplianceViolation[] = [];
    const timerState = this.stationIDTimer.getState();

    if (timerState.isOverdue) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.STATION_ID_OVERDUE,
        severity: 'high',
        timestamp: new Date(),
        description: `Station ID overdue by ${Math.floor((Date.now() - timerState.nextIDTime.getTime()) / 1000)} seconds`,
        regulation: '§97.119(a)',
        transmissionMode: this.monitoringState.currentMode,
        callsign: this.config.stationID.callsign,
        blocked: false, // Don't block for station ID - auto-transmit instead
        overridden: false
      });

      // Auto-transmit station ID if possible
      if (this.config.stationID.automaticIDEnabled) {
        await this.stationIDTimer.forceStationID();
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      shouldBlock: false // Never block for station ID - auto-correct instead
    };
  }

  /**
   * Update transmission context
   */
  private updateTransmissionContext(
    mode: TransmissionMode,
    metadata?: { frequency?: number; power?: number; contentType?: string }
  ): void {
    this.monitoringState.currentTransmission = {
      startTime: new Date(),
      mode,
      frequency: metadata?.frequency,
      power: metadata?.power
    };
  }

  /**
   * Get maximum power for frequency band
   */
  private getMaxPowerForBand(frequency?: number): number {
    if (!frequency) return 1500; // Default max

    // Simplified power limits (full implementation would be more comprehensive)
    if (frequency >= 1.8 && frequency <= 2.0) return 1500;    // 160m
    if (frequency >= 3.5 && frequency <= 4.0) return 1500;    // 80m
    if (frequency >= 7.0 && frequency <= 7.3) return 1500;    // 40m
    if (frequency >= 14.0 && frequency <= 14.35) return 1500; // 20m
    if (frequency >= 21.0 && frequency <= 21.45) return 1500; // 15m
    if (frequency >= 28.0 && frequency <= 29.7) return 1500;  // 10m

    return 1500; // Default
  }

  /**
   * Log violations
   */
  private async logViolations(violations: ComplianceViolation[]): Promise<void> {
    for (const violation of violations) {
      await this.complianceLogger.logViolation(violation);
    }
  }

  /**
   * Log compliance event
   */
  private async logComplianceEvent(type: ComplianceEvent['type'], description: string): Promise<void> {
    const event: ComplianceEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      details: {
        callsign: this.config.stationID.callsign,
        mode: this.monitoringState.currentMode,
        data: { description }
      },
      automated: true
    };

    await this.complianceLogger.logEvent(event);
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Station ID timer events
    this.stationIDTimer.on('station-id-due', () => {
      this.emit('station-id-due');
    });

    this.stationIDTimer.on('station-id-transmitted', (event) => {
      this.monitoringState.lastStationID = event.timestamp;
      this.emit('station-id-transmitted', event);
    });

    // Encryption guard events
    this.encryptionGuard.on('encryption-blocked', (event) => {
      this.emit('encryption-blocked', event);
    });

    // Content filter events
    this.contentFilter.on('content-blocked', (event) => {
      this.emit('content-blocked', event);
    });
  }

  /**
   * Measure system response time
   */
  private async measureResponseTime(): Promise<number> {
    const start = performance.now();

    // Simple test operation
    await this.stationIDTimer.getState();

    return performance.now() - start;
  }

  /**
   * Dispose of the compliance manager
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.eventListeners.clear();
  }
}

export default ComplianceManager;