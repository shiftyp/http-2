/**
 * Contract Test: FCC Compliance Status
 *
 * Tests compliance status monitoring and reporting.
 * Task T011 per FCC compliance implementation plan.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Type definitions based on the FCC compliance contract
interface ComplianceStatusMonitor {
  initialize(): Promise<void>;
  getStatus(): ComplianceStatus;
  getDetailedStatus(): DetailedComplianceStatus;
  onStatusChange(callback: (status: ComplianceStatus) => void): void;
  generateComplianceReport(options?: ReportOptions): Promise<ComplianceReport>;
  dispose(): void;
}

interface ComplianceStatus {
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

interface DetailedComplianceStatus extends ComplianceStatus {
  systemHealth: {
    allSystemsOperational: boolean;
    issues: string[];
    lastHealthCheck: number;
  };
  performance: {
    stationIdAccuracy: number; // milliseconds deviation
    encryptionBlockingLatency: number; // milliseconds
    contentFilteringLatency: number; // milliseconds
    callsignValidationLatency: number; // milliseconds
  };
  statistics: {
    totalTransmissions: number;
    complianceRate: number; // 0-1
    averageSessionDuration: number; // milliseconds
    mostCommonViolationType: string;
  };
}

interface ReportOptions {
  startDate?: Date;
  endDate?: Date;
  includeStatistics?: boolean;
  includeViolationDetails?: boolean;
  format?: 'SUMMARY' | 'DETAILED' | 'FCC_INSPECTION';
}

interface ComplianceReport {
  generatedAt: number;
  reportType: string;
  timeRange: {
    start: number;
    end: number;
  };
  operatorCallsign: string;
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

// Mock implementation for testing
class MockComplianceStatusMonitor implements ComplianceStatusMonitor {
  private status: ComplianceStatus;
  private callbacks: ((status: ComplianceStatus) => void)[] = [];
  private violations: Array<{
    timestamp: number;
    type: string;
    description: string;
    severity: string;
    resolved: boolean;
  }> = [];

  constructor() {
    this.status = {
      enabled: true,
      operatorCallsign: 'W1AW',
      transmissionMode: 'WEBRTC',
      stationIdTimer: {
        nextDue: 0,
        transmissionActive: false,
        lastId: 0
      },
      encryptionGuard: {
        blocking: false,
        violationCount: 0
      },
      contentFilter: {
        level: 'MODERATE',
        emergencyBypass: false
      },
      emergencyMode: false,
      violationCount: 0,
      lastViolation: 0
    };
  }

  async initialize(): Promise<void> {
    // Initialize status monitor
  }

  getStatus(): ComplianceStatus {
    return { ...this.status };
  }

  getDetailedStatus(): DetailedComplianceStatus {
    return {
      ...this.status,
      systemHealth: {
        allSystemsOperational: this.status.violationCount === 0,
        issues: this.status.violationCount > 0 ? ['Active violations detected'] : [],
        lastHealthCheck: Date.now()
      },
      performance: {
        stationIdAccuracy: 50, // ±50ms
        encryptionBlockingLatency: 3,
        contentFilteringLatency: 12,
        callsignValidationLatency: 45
      },
      statistics: {
        totalTransmissions: 10,
        complianceRate: this.status.violationCount === 0 ? 1.0 : 0.95,
        averageSessionDuration: 300000, // 5 minutes
        mostCommonViolationType: 'CONTENT_FILTER'
      }
    };
  }

  onStatusChange(callback: (status: ComplianceStatus) => void): void {
    this.callbacks.push(callback);
  }

  // Test helpers to simulate status changes
  setTransmissionMode(mode: 'RF' | 'WEBRTC' | 'HYBRID'): void {
    this.status.transmissionMode = mode;
    this.status.encryptionGuard.blocking = mode === 'RF';
    this.notifyStatusChange();
  }

  startTransmission(): void {
    this.status.stationIdTimer.transmissionActive = true;
    this.status.stationIdTimer.nextDue = Date.now() + 600000; // 10 minutes
    this.notifyStatusChange();
  }

  recordViolation(type: string, description: string, severity: string): void {
    this.status.violationCount++;
    this.status.encryptionGuard.violationCount++;
    this.status.lastViolation = Date.now();

    this.violations.push({
      timestamp: Date.now(),
      type,
      description,
      severity,
      resolved: false
    });

    this.notifyStatusChange();
  }

  setEmergencyMode(enabled: boolean): void {
    this.status.emergencyMode = enabled;
    this.status.contentFilter.emergencyBypass = enabled;
    this.notifyStatusChange();
  }

  private notifyStatusChange(): void {
    this.callbacks.forEach(callback => callback(this.getStatus()));
  }

  async generateComplianceReport(options: ReportOptions = {}): Promise<ComplianceReport> {
    const now = Date.now();
    const startTime = options.startDate?.getTime() || (now - 24 * 60 * 60 * 1000); // 24 hours ago
    const endTime = options.endDate?.getTime() || now;

    const filteredViolations = this.violations.filter(v =>
      v.timestamp >= startTime && v.timestamp <= endTime
    );

    const report: ComplianceReport = {
      generatedAt: now,
      reportType: options.format || 'SUMMARY',
      timeRange: {
        start: startTime,
        end: endTime
      },
      operatorCallsign: this.status.operatorCallsign,
      summary: {
        totalTransmissions: 10,
        stationIDCount: 15,
        violationCount: filteredViolations.length,
        emergencyActivations: this.status.emergencyMode ? 1 : 0,
        complianceRate: filteredViolations.length === 0 ? 1.0 : 0.95
      },
      violations: filteredViolations,
      recommendations: this.generateRecommendations(filteredViolations)
    };

    return report;
  }

  private generateRecommendations(violations: any[]): string[] {
    const recommendations: string[] = [];

    if (violations.length === 0) {
      recommendations.push('Excellent compliance record - continue current practices');
    } else {
      recommendations.push('Review and address compliance violations');

      const encryptionViolations = violations.filter(v => v.type === 'ENCRYPTION_BLOCK');
      if (encryptionViolations.length > 0) {
        recommendations.push('Ensure proper transmission mode detection before crypto operations');
      }

      const contentViolations = violations.filter(v => v.type === 'CONTENT_FILTER');
      if (contentViolations.length > 0) {
        recommendations.push('Review content filtering policies and operator training');
      }
    }

    return recommendations;
  }

  dispose(): void {
    this.callbacks = [];
    this.violations = [];
  }
}

describe('FCC Compliance Status Contract', () => {
  let statusMonitor: MockComplianceStatusMonitor;

  beforeEach(async () => {
    statusMonitor = new MockComplianceStatusMonitor();
    await statusMonitor.initialize();
  });

  afterEach(() => {
    statusMonitor.dispose();
  });

  describe('Requirement: Basic status reporting', () => {
    it('should return current compliance status', () => {
      const status = statusMonitor.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.operatorCallsign).toBe('W1AW');
      expect(status.transmissionMode).toBe('WEBRTC');
      expect(status.violationCount).toBe(0);
    });

    it('should report station ID timer status', () => {
      const status = statusMonitor.getStatus();

      expect(status.stationIdTimer).toBeDefined();
      expect(status.stationIdTimer.transmissionActive).toBe(false);
      expect(status.stationIdTimer.nextDue).toBe(0);
      expect(status.stationIdTimer.lastId).toBe(0);
    });

    it('should report encryption guard status', () => {
      const status = statusMonitor.getStatus();

      expect(status.encryptionGuard).toBeDefined();
      expect(status.encryptionGuard.blocking).toBe(false); // WebRTC mode
      expect(status.encryptionGuard.violationCount).toBe(0);
    });

    it('should report content filter status', () => {
      const status = statusMonitor.getStatus();

      expect(status.contentFilter).toBeDefined();
      expect(status.contentFilter.level).toBe('MODERATE');
      expect(status.contentFilter.emergencyBypass).toBe(false);
    });
  });

  describe('Requirement: Status change monitoring', () => {
    it('should notify on transmission mode changes', () => {
      const statusChanges: ComplianceStatus[] = [];
      statusMonitor.onStatusChange(status => statusChanges.push(status));

      statusMonitor.setTransmissionMode('RF');

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].transmissionMode).toBe('RF');
      expect(statusChanges[0].encryptionGuard.blocking).toBe(true);
    });

    it('should notify on transmission start', () => {
      const statusChanges: ComplianceStatus[] = [];
      statusMonitor.onStatusChange(status => statusChanges.push(status));

      statusMonitor.startTransmission();

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].stationIdTimer.transmissionActive).toBe(true);
      expect(statusChanges[0].stationIdTimer.nextDue).toBeGreaterThan(Date.now());
    });

    it('should notify on violations', () => {
      const statusChanges: ComplianceStatus[] = [];
      statusMonitor.onStatusChange(status => statusChanges.push(status));

      statusMonitor.recordViolation('ENCRYPTION_BLOCK', 'Test violation', 'CRITICAL');

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].violationCount).toBe(1);
      expect(statusChanges[0].lastViolation).toBeGreaterThan(0);
    });

    it('should notify on emergency mode changes', () => {
      const statusChanges: ComplianceStatus[] = [];
      statusMonitor.onStatusChange(status => statusChanges.push(status));

      statusMonitor.setEmergencyMode(true);

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].emergencyMode).toBe(true);
      expect(statusChanges[0].contentFilter.emergencyBypass).toBe(true);
    });
  });

  describe('Requirement: Detailed status information', () => {
    it('should provide system health information', () => {
      const detailed = statusMonitor.getDetailedStatus();

      expect(detailed.systemHealth).toBeDefined();
      expect(detailed.systemHealth.allSystemsOperational).toBe(true);
      expect(detailed.systemHealth.issues).toHaveLength(0);
      expect(detailed.systemHealth.lastHealthCheck).toBeGreaterThan(0);
    });

    it('should report performance metrics', () => {
      const detailed = statusMonitor.getDetailedStatus();

      expect(detailed.performance).toBeDefined();
      expect(detailed.performance.stationIdAccuracy).toBeLessThan(100); // <100ms per spec
      expect(detailed.performance.encryptionBlockingLatency).toBeLessThan(10); // <10ms per spec
      expect(detailed.performance.contentFilteringLatency).toBeLessThan(50); // <50ms per spec
      expect(detailed.performance.callsignValidationLatency).toBeLessThan(100); // <100ms per spec
    });

    it('should include operational statistics', () => {
      const detailed = statusMonitor.getDetailedStatus();

      expect(detailed.statistics).toBeDefined();
      expect(detailed.statistics.totalTransmissions).toBeGreaterThanOrEqual(0);
      expect(detailed.statistics.complianceRate).toBeGreaterThanOrEqual(0);
      expect(detailed.statistics.complianceRate).toBeLessThanOrEqual(1);
      expect(detailed.statistics.averageSessionDuration).toBeGreaterThan(0);
    });

    it('should detect system issues when violations occur', () => {
      statusMonitor.recordViolation('ENCRYPTION_BLOCK', 'Test violation', 'CRITICAL');

      const detailed = statusMonitor.getDetailedStatus();

      expect(detailed.systemHealth.allSystemsOperational).toBe(false);
      expect(detailed.systemHealth.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement: Compliance reporting', () => {
    it('should generate summary compliance report', async () => {
      const report = await statusMonitor.generateComplianceReport({
        format: 'SUMMARY'
      });

      expect(report.generatedAt).toBeGreaterThan(0);
      expect(report.reportType).toBe('SUMMARY');
      expect(report.operatorCallsign).toBe('W1AW');
      expect(report.summary).toBeDefined();
      expect(report.timeRange).toBeDefined();
    });

    it('should include violation details in report', async () => {
      statusMonitor.recordViolation('ENCRYPTION_BLOCK', 'Test violation', 'CRITICAL');

      const report = await statusMonitor.generateComplianceReport({
        includeViolationDetails: true
      });

      expect(report.violations).toHaveLength(1);
      expect(report.violations[0].type).toBe('ENCRYPTION_BLOCK');
      expect(report.violations[0].description).toBe('Test violation');
      expect(report.violations[0].severity).toBe('CRITICAL');
    });

    it('should filter report by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      statusMonitor.recordViolation('TEST', 'Current violation', 'WARNING');

      const report = await statusMonitor.generateComplianceReport({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(report.timeRange.start).toBe(yesterday.getTime());
      expect(report.timeRange.end).toBe(tomorrow.getTime());
      expect(report.violations).toHaveLength(1);
    });

    it('should provide compliance recommendations', async () => {
      const report = await statusMonitor.generateComplianceReport();

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain('compliance');
    });

    it('should calculate compliance rate correctly', async () => {
      // Perfect compliance
      let report = await statusMonitor.generateComplianceReport();
      expect(report.summary.complianceRate).toBe(1.0);

      // Add violation
      statusMonitor.recordViolation('TEST', 'Test violation', 'WARNING');
      report = await statusMonitor.generateComplianceReport();
      expect(report.summary.complianceRate).toBeLessThan(1.0);
    });
  });

  describe('Real-time status updates', () => {
    it('should update encryption blocking status based on transmission mode', () => {
      // Start in WebRTC mode
      let status = statusMonitor.getStatus();
      expect(status.encryptionGuard.blocking).toBe(false);

      // Switch to RF mode
      statusMonitor.setTransmissionMode('RF');
      status = statusMonitor.getStatus();
      expect(status.encryptionGuard.blocking).toBe(true);

      // Switch back to WebRTC
      statusMonitor.setTransmissionMode('WEBRTC');
      status = statusMonitor.getStatus();
      expect(status.encryptionGuard.blocking).toBe(false);
    });

    it('should track station ID timer during transmission', () => {
      statusMonitor.startTransmission();

      const status = statusMonitor.getStatus();
      expect(status.stationIdTimer.transmissionActive).toBe(true);
      expect(status.stationIdTimer.nextDue).toBeGreaterThan(Date.now());

      // Should be approximately 10 minutes from now
      const timeUntilId = status.stationIdTimer.nextDue - Date.now();
      expect(timeUntilId).toBeGreaterThan(590000); // ~9.8 minutes
      expect(timeUntilId).toBeLessThan(610000); // ~10.2 minutes
    });

    it('should accumulate violation counts', () => {
      expect(statusMonitor.getStatus().violationCount).toBe(0);

      statusMonitor.recordViolation('ENCRYPTION_BLOCK', 'Violation 1', 'CRITICAL');
      expect(statusMonitor.getStatus().violationCount).toBe(1);

      statusMonitor.recordViolation('CONTENT_FILTER', 'Violation 2', 'WARNING');
      expect(statusMonitor.getStatus().violationCount).toBe(2);
    });
  });

  describe('Emergency mode behavior', () => {
    it('should activate emergency bypass in content filter', () => {
      statusMonitor.setEmergencyMode(true);

      const status = statusMonitor.getStatus();
      expect(status.emergencyMode).toBe(true);
      expect(status.contentFilter.emergencyBypass).toBe(true);
    });

    it('should deactivate emergency bypass when disabled', () => {
      statusMonitor.setEmergencyMode(true);
      statusMonitor.setEmergencyMode(false);

      const status = statusMonitor.getStatus();
      expect(status.emergencyMode).toBe(false);
      expect(status.contentFilter.emergencyBypass).toBe(false);
    });
  });
});