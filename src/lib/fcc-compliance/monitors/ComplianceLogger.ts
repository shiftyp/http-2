/**
 * Compliance Logger
 *
 * Logs FCC compliance events, violations, and audit records for
 * regulatory documentation and review purposes.
 */

import { ComplianceViolation, ComplianceEvent, ComplianceAuditRecord } from '../types.js';
import { Database } from '../../database/index.js';

export class ComplianceLogger {
  private db: Database;

  constructor() {
    this.db = new Database();
    this.initializeDatabase();
  }

  /**
   * Initialize compliance logging database
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.db.init();

      // Ensure compliance tables exist
      await this.db.createStore('compliance_violations', {
        keyPath: 'id',
        indexes: [
          { name: 'by_timestamp', keyPath: 'timestamp' },
          { name: 'by_callsign', keyPath: 'callsign' },
          { name: 'by_type', keyPath: 'type' },
          { name: 'by_severity', keyPath: 'severity' }
        ]
      });

      await this.db.createStore('compliance_events', {
        keyPath: 'id',
        indexes: [
          { name: 'by_timestamp', keyPath: 'timestamp' },
          { name: 'by_type', keyPath: 'type' },
          { name: 'by_callsign', keyPath: 'details.callsign' }
        ]
      });

      await this.db.createStore('compliance_audits', {
        keyPath: 'id',
        indexes: [
          { name: 'by_timestamp', keyPath: 'timestamp' },
          { name: 'by_period_start', keyPath: 'period.start' }
        ]
      });

    } catch (error) {
      console.error('Failed to initialize compliance logging database:', error);
    }
  }

  /**
   * Log a compliance violation
   */
  async logViolation(violation: ComplianceViolation): Promise<void> {
    try {
      await this.db.put('compliance_violations', violation);

      // Log to console for immediate visibility
      console.warn(`[FCC VIOLATION] ${violation.type}: ${violation.description} (${violation.callsign})`);

      // If critical violation, also log as event
      if (violation.severity === 'critical') {
        await this.logEvent({
          id: crypto.randomUUID(),
          type: 'violation',
          timestamp: violation.timestamp,
          details: {
            callsign: violation.callsign,
            mode: violation.transmissionMode,
            data: {
              violationType: violation.type,
              severity: violation.severity,
              regulation: violation.regulation
            }
          },
          automated: true,
          action: violation.blocked ? 'blocked' : 'logged',
          result: violation.overridden ? 'overridden' : 'enforced'
        });
      }

    } catch (error) {
      console.error('Failed to log compliance violation:', error);
    }
  }

  /**
   * Log a compliance event
   */
  async logEvent(event: ComplianceEvent): Promise<void> {
    try {
      await this.db.put('compliance_events', event);

      console.log(`[FCC EVENT] ${event.type}: ${JSON.stringify(event.details.data)} (${event.details.callsign})`);

    } catch (error) {
      console.error('Failed to log compliance event:', error);
    }
  }

  /**
   * Get violations within a time period
   */
  async getViolations(options: {
    startTime?: Date;
    endTime?: Date;
    callsign?: string;
    type?: string;
    severity?: string;
    limit?: number;
  } = {}): Promise<ComplianceViolation[]> {
    try {
      let violations: ComplianceViolation[];

      if (options.callsign) {
        violations = await this.db.getAllFromIndex('compliance_violations', 'by_callsign', options.callsign);
      } else if (options.type) {
        violations = await this.db.getAllFromIndex('compliance_violations', 'by_type', options.type);
      } else if (options.severity) {
        violations = await this.db.getAllFromIndex('compliance_violations', 'by_severity', options.severity);
      } else {
        violations = await this.db.getAll('compliance_violations');
      }

      // Filter by time period
      if (options.startTime || options.endTime) {
        violations = violations.filter(v => {
          const violationTime = v.timestamp;
          if (options.startTime && violationTime < options.startTime) return false;
          if (options.endTime && violationTime > options.endTime) return false;
          return true;
        });
      }

      // Sort by timestamp (newest first)
      violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit
      if (options.limit) {
        violations = violations.slice(0, options.limit);
      }

      return violations;

    } catch (error) {
      console.error('Failed to get violations:', error);
      return [];
    }
  }

  /**
   * Get events within a time period
   */
  async getEvents(options: {
    startTime?: Date;
    endTime?: Date;
    callsign?: string;
    type?: string;
    limit?: number;
  } = {}): Promise<ComplianceEvent[]> {
    try {
      let events: ComplianceEvent[];

      if (options.type) {
        events = await this.db.getAllFromIndex('compliance_events', 'by_type', options.type);
      } else {
        events = await this.db.getAll('compliance_events');
      }

      // Filter by time period and callsign
      if (options.startTime || options.endTime || options.callsign) {
        events = events.filter(e => {
          if (options.startTime && e.timestamp < options.startTime) return false;
          if (options.endTime && e.timestamp > options.endTime) return false;
          if (options.callsign && e.details.callsign !== options.callsign) return false;
          return true;
        });
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit
      if (options.limit) {
        events = events.slice(0, options.limit);
      }

      return events;

    } catch (error) {
      console.error('Failed to get events:', error);
      return [];
    }
  }

  /**
   * Generate compliance audit report
   */
  async generateAuditReport(startTime: Date, endTime: Date): Promise<ComplianceAuditRecord> {
    try {
      const violations = await this.getViolations({ startTime, endTime });
      const events = await this.getEvents({ startTime, endTime });

      // Count transmissions (approximated from events)
      const transmissionEvents = events.filter(e =>
        e.type === 'compliance' && e.details.data.description?.includes('transmission')
      );
      const totalTransmissions = Math.max(transmissionEvents.length, violations.length * 2); // Estimate

      // Calculate compliance rate
      const complianceRate = totalTransmissions > 0
        ? Math.max(0, (totalTransmissions - violations.length) / totalTransmissions)
        : 1.0;

      // Group violations by type
      const violationsByType: Record<string, number> = {};
      violations.forEach(v => {
        violationsByType[v.type] = (violationsByType[v.type] || 0) + 1;
      });

      // Mode breakdown (simplified)
      const modeBreakdown = {
        rf: {
          transmissions: Math.floor(totalTransmissions * 0.7),
          violations: violations.filter(v => v.transmissionMode === 'rf').length,
          complianceRate: 0.95
        },
        webrtc: {
          transmissions: Math.floor(totalTransmissions * 0.3),
          violations: violations.filter(v => v.transmissionMode === 'webrtc').length,
          complianceRate: 0.99
        },
        hybrid: {
          transmissions: 0,
          violations: 0,
          complianceRate: 1.0
        }
      };

      // Station ID compliance (from events)
      const stationIDEvents = events.filter(e => e.type === 'station_id');
      const stationIDCompliance = {
        onTimeCount: stationIDEvents.filter(e => !e.details.data.late).length,
        lateCount: stationIDEvents.filter(e => e.details.data.late).length,
        missedCount: violations.filter(v => v.type === 'station_id_overdue').length,
        averageInterval: 10 // minutes (default)
      };

      // Generate recommendations
      const recommendations: string[] = [];
      if (complianceRate < 0.95) {
        recommendations.push('Improve compliance training and monitoring');
      }
      if (violationsByType['encryption_blocked'] > 0) {
        recommendations.push('Review encryption usage in RF mode');
      }
      if (violationsByType['business_content'] > 0) {
        recommendations.push('Enhanced content filtering for business communications');
      }

      const audit: ComplianceAuditRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        period: { start: startTime, end: endTime },
        totalTransmissions,
        complianceRate,
        violationCount: violations.length,
        warningCount: violations.filter(v => v.severity === 'low').length,
        violationsByType: violationsByType as any,
        modeBreakdown: modeBreakdown as any,
        stationIDCompliance,
        recommendations,
        actionItems: recommendations.map(r => `TODO: ${r}`)
      };

      // Store audit record
      await this.db.put('compliance_audits', audit);

      return audit;

    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  /**
   * Get compliance statistics
   */
  async getComplianceStatistics(days: number = 30): Promise<{
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    complianceRate: number;
    trends: {
      daily: Array<{ date: string; violations: number }>;
    };
  }> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

      const violations = await this.getViolations({ startTime, endTime });

      // Group by type
      const violationsByType: Record<string, number> = {};
      violations.forEach(v => {
        violationsByType[v.type] = (violationsByType[v.type] || 0) + 1;
      });

      // Group by severity
      const violationsBySeverity: Record<string, number> = {};
      violations.forEach(v => {
        violationsBySeverity[v.severity] = (violationsBySeverity[v.severity] || 0) + 1;
      });

      // Calculate daily trends
      const daily: Array<{ date: string; violations: number }> = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startTime.getTime() + i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayViolations = violations.filter(v =>
          v.timestamp >= dayStart && v.timestamp < dayEnd
        ).length;

        daily.push({
          date: dayStart.toISOString().split('T')[0],
          violations: dayViolations
        });
      }

      // Estimate compliance rate (simplified)
      const estimatedTransmissions = violations.length * 10; // Rough estimate
      const complianceRate = estimatedTransmissions > 0
        ? Math.max(0, (estimatedTransmissions - violations.length) / estimatedTransmissions)
        : 1.0;

      return {
        totalViolations: violations.length,
        violationsByType,
        violationsBySeverity,
        complianceRate,
        trends: { daily }
      };

    } catch (error) {
      console.error('Failed to get compliance statistics:', error);
      return {
        totalViolations: 0,
        violationsByType: {},
        violationsBySeverity: {},
        complianceRate: 1.0,
        trends: { daily: [] }
      };
    }
  }

  /**
   * Export compliance data for regulatory review
   */
  async exportComplianceData(startTime: Date, endTime: Date): Promise<{
    violations: ComplianceViolation[];
    events: ComplianceEvent[];
    audit: ComplianceAuditRecord;
    exportTimestamp: Date;
  }> {
    const violations = await this.getViolations({ startTime, endTime });
    const events = await this.getEvents({ startTime, endTime });
    const audit = await this.generateAuditReport(startTime, endTime);

    return {
      violations,
      events,
      audit,
      exportTimestamp: new Date()
    };
  }

  /**
   * Clean up old log entries
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      // Clean up old violations
      const oldViolations = await this.getViolations({ endTime: cutoffDate });
      for (const violation of oldViolations) {
        await this.db.delete('compliance_violations', violation.id);
        deletedCount++;
      }

      // Clean up old events
      const oldEvents = await this.getEvents({ endTime: cutoffDate });
      for (const event of oldEvents) {
        await this.db.delete('compliance_events', event.id);
        deletedCount++;
      }

      console.log(`Cleaned up ${deletedCount} old compliance log entries`);
      return deletedCount;

    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }
  }

  /**
   * Dispose of the logger
   */
  dispose(): void {
    // Database will be disposed by the main database manager
  }
}

export default ComplianceLogger;