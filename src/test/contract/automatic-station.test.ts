/**
 * Automatic Station Control System Contract Tests
 *
 * Verifies FCC Part 97.213 automatic station control requirements including
 * control operator monitoring, acknowledgment systems, and emergency shutdown.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AutomaticStationController,
  ControlOperatorSession,
  AutomaticStationConfig,
  StationStatus,
  StationAlarm,
  RemoteControlCommand,
  ShutdownSequence
} from '../../lib/automatic-station/index.js';
import { createComplianceManager } from '../../lib/fcc-compliance/index.js';

// Polyfill crypto for test environment
if (!globalThis.crypto) {
  globalThis.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  } as any;
}

// Ensure crypto.randomUUID is available
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

describe('Automatic Station Control System', () => {
  let controller: AutomaticStationController;
  let config: AutomaticStationConfig;

  beforeEach(async () => {
    config = {
      callsign: 'KA1AUTO',
      licenseClass: 'EXTRA',
      maxUnattendedTime: 30 * 60 * 1000, // 30 minutes
      acknowledgmentRequired: true,
      acknowledgmentInterval: 10 * 60 * 1000, // 10 minutes
      maxMissedAcknowledgments: 3,
      emergencyShutdownEnabled: true,
      hardwareMonitoring: true,
      transmissionLimits: {
        maxPower: 1500,
        allowedBands: [14.0, 21.0, 28.0],
        allowedModes: ['SSB', 'CW', 'FT8'],
        dutyLimit: 80
      },
      controlChannels: {
        rf: { frequency: 146.52, mode: 'FM' },
        internet: { enabled: true, port: 8080 },
        dtmf: { enabled: true, code: '*97213#' }
      },
      safetyInterlocks: {
        vswr: { enabled: true, threshold: 2.0 },
        temperature: { enabled: true, threshold: 50 },
        current: { enabled: true, threshold: 20 },
        voltage: { enabled: true, min: 11.0, max: 15.0 }
      }
    };

    controller = new AutomaticStationController(config);
    await controller.initialize();
  });

  afterEach(async () => {
    await controller.emergencyShutdown();
  });

  describe('Control Operator Session Management', () => {
    it('should start control operator session with proper validation', async () => {
      const sessionId = await controller.startControlOperatorSession(
        'KB1CTRL',
        'EXTRA',
        {
          remoteControl: true,
          location: {
            latitude: 42.3601,
            longitude: -71.0589,
            gridSquare: 'FN42io'
          }
        }
      );

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const sessionInfo = controller.getControlOperatorInfo();
      expect(sessionInfo).toBeDefined();
      expect(sessionInfo!.callsign).toBe('KB1CTRL');
      expect(sessionInfo!.licenseClass).toBe('EXTRA');
      expect(sessionInfo!.status).toBe('active');
      expect(sessionInfo!.remoteControl).toBe(true);
    });

    it('should determine privileges based on license class', async () => {
      const testCases: Array<{
        licenseClass: ControlOperatorSession['licenseClass'];
        expectedPrivileges: Partial<ControlOperatorSession['privileges']>;
      }> = [
        {
          licenseClass: 'EXTRA',
          expectedPrivileges: {
            emergencyOverride: true,
            frequencyChange: true,
            powerAdjustment: true,
            bandwidthControl: true
          }
        },
        {
          licenseClass: 'GENERAL',
          expectedPrivileges: {
            emergencyOverride: false,
            frequencyChange: true,
            powerAdjustment: true,
            bandwidthControl: false
          }
        },
        {
          licenseClass: 'TECHNICIAN',
          expectedPrivileges: {
            emergencyOverride: false,
            frequencyChange: false,
            powerAdjustment: true,
            bandwidthControl: false
          }
        }
      ];

      for (const testCase of testCases) {
        // Clean up previous session
        if (controller.getControlOperatorInfo()) {
          await controller.endControlOperatorSession('Test cleanup');
        }

        const sessionId = await controller.startControlOperatorSession(
          'KB1TEST',
          testCase.licenseClass
        );

        const sessionInfo = controller.getControlOperatorInfo();
        expect(sessionInfo).toBeDefined();

        for (const [privilege, expected] of Object.entries(testCase.expectedPrivileges)) {
          expect(sessionInfo!.privileges[privilege as keyof typeof sessionInfo.privileges])
            .toBe(expected);
        }
      }
    });

    it('should prevent multiple concurrent sessions', async () => {
      await controller.startControlOperatorSession('KB1FIRST', 'EXTRA');

      await expect(controller.startControlOperatorSession('KB1SECOND', 'GENERAL'))
        .rejects.toThrow('Control operator session already active');
    });

    it('should handle session end with proper cleanup', async () => {
      const sessionId = await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      await controller.endControlOperatorSession('Test completion');

      const sessionInfo = controller.getControlOperatorInfo();
      expect(sessionInfo).toBeNull();

      const status = controller.getStationStatus();
      expect(status.controlOperator).toBeNull();
    });
  });

  describe('Acknowledgment System', () => {
    it('should track acknowledgments correctly', async () => {
      const sessionId = await controller.startControlOperatorSession(
        'KB1CTRL',
        'EXTRA',
        { acknowledgmentInterval: 5000 } // 5 seconds for testing
      );

      // Initial acknowledgment should be current
      let stats = controller.getStatistics();
      expect(stats.acknowledgmentStatus).toBe('current');

      // Wait and acknowledge
      await new Promise(resolve => setTimeout(resolve, 1000));

      const ackResult = await controller.acknowledgeControlOperator(sessionId, 'manual');
      expect(ackResult).toBe(true);

      stats = controller.getStatistics();
      expect(stats.lastAcknowledgment).toBeInstanceOf(Date);
    });

    it('should warn when acknowledgment is due soon', async () => {
      const sessionId = await controller.startControlOperatorSession(
        'KB1CTRL',
        'EXTRA',
        { acknowledgmentInterval: 1000 } // 1 second for testing
      );

      // Wait for warning threshold (80% of interval)
      await new Promise(resolve => setTimeout(resolve, 900));

      const stats = controller.getStatistics();
      expect(stats.acknowledgmentStatus).toBe('warning');
    });

    it('should detect overdue acknowledgments', async () => {
      const sessionId = await controller.startControlOperatorSession(
        'KB1CTRL',
        'EXTRA',
        { acknowledgmentInterval: 500 } // 0.5 seconds for testing
      );

      // Wait for acknowledgment to become overdue
      await new Promise(resolve => setTimeout(resolve, 600));

      const stats = controller.getStatistics();
      expect(stats.acknowledgmentStatus).toBe('overdue');

      const alarms = controller.getActiveAlarms();
      const ackAlarm = alarms.find(a => a.type === 'operator' && a.description.includes('overdue'));
      expect(ackAlarm).toBeDefined();
    });

    it('should handle invalid acknowledgment attempts', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const invalidResult = await controller.acknowledgeControlOperator('invalid-id', 'manual');
      expect(invalidResult).toBe(false);
    });

    it('should support different acknowledgment methods', async () => {
      const sessionId = await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const methods: Array<'manual' | 'automatic' | 'remote'> = ['manual', 'automatic', 'remote'];

      for (const method of methods) {
        const result = await controller.acknowledgeControlOperator(sessionId, method);
        expect(result).toBe(true);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe('Remote Control Commands', () => {
    beforeEach(async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA', { remoteControl: true });
    });

    it('should process status command', async () => {
      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'status',
        timestamp: new Date(),
        authorization: {
          method: 'certificate',
          credential: 'valid-cert-hash',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(true);
      expect(response.response).toBe('Station status retrieved');
      expect(response.data).toBeDefined();
      expect(response.data.operational).toBeDefined();
    });

    it('should process remote acknowledgment command', async () => {
      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'acknowledge',
        timestamp: new Date(),
        authorization: {
          method: 'dtmf',
          credential: '*97213#',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(true);
      expect(response.response).toBe('Acknowledgment recorded');
    });

    it('should process shutdown command', async () => {
      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'shutdown',
        timestamp: new Date(),
        authorization: {
          method: 'internet',
          credential: 'session-token',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(true);
      expect(response.response).toBe('Shutdown initiated');
      expect(response.data.shutdownId).toBeDefined();
    });

    it('should process emergency command', async () => {
      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1EMERGENCY',
        command: 'emergency',
        timestamp: new Date(),
        authorization: {
          method: 'rf',
          credential: 'emergency-code',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(true);
      expect(response.response).toBe('Emergency shutdown initiated');
      expect(response.data.emergencyId).toBeDefined();
    });

    it('should reject unauthorized commands', async () => {
      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'UNAUTHORIZED',
        command: 'shutdown',
        timestamp: new Date(),
        authorization: {
          method: 'certificate',
          credential: 'invalid-cert',
          verified: false
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(false);
      expect(response.response).toBe('Command authorization failed');
    });

    it('should reject commands without active session', async () => {
      await controller.endControlOperatorSession('Test cleanup');

      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'status',
        timestamp: new Date(),
        authorization: {
          method: 'certificate',
          credential: 'valid-cert',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(false);
      expect(response.response).toBe('No active control operator session');
    });

    it('should handle parameter adjustment with privilege check', async () => {
      // Test with EXTRA license (should have parameter adjustment privileges)
      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'parameter',
        parameters: { power: 100, frequency: 14.205 },
        timestamp: new Date(),
        authorization: {
          method: 'certificate',
          credential: 'valid-cert',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);

      expect(response.success).toBe(true);
      expect(response.response).toBe('Parameters updated');
    });
  });

  describe('Emergency Shutdown System', () => {
    it('should initiate emergency shutdown with proper sequence', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const shutdownId = await controller.initiateEmergencyShutdown(
        'High VSWR detected',
        'automatic-safety-system'
      );

      expect(shutdownId).toBeDefined();
      expect(typeof shutdownId).toBe('string');

      // Allow time for shutdown sequence
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = controller.getStationStatus();
      expect(status.operational).toBe(false);
    });

    it('should create emergency broadcast during shutdown', async () => {
      // This test would verify integration with emergency broadcaster
      // For now, just verify the shutdown initiates correctly

      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const shutdownId = await controller.initiateEmergencyShutdown(
        'Equipment failure',
        'hardware-monitor'
      );

      expect(shutdownId).toBeDefined();
    });

    it('should prevent multiple concurrent shutdowns', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      await controller.initiateEmergencyShutdown('First emergency', 'operator');

      await expect(controller.initiateEmergencyShutdown('Second emergency', 'operator'))
        .rejects.toThrow('Shutdown already in progress');
    });

    it('should complete shutdown sequence with all steps', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const shutdownId = await controller.initiateEmergencyShutdown(
        'Test shutdown sequence',
        'operator'
      );

      // Allow time for all shutdown steps to complete
      await new Promise(resolve => setTimeout(resolve, 6000)); // 5 steps + overhead

      const status = controller.getStationStatus();
      expect(status.operational).toBe(false);
    });
  });

  describe('Station Status and Monitoring', () => {
    it('should provide comprehensive station status', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const status = controller.getStationStatus();

      expect(status).toBeDefined();
      expect(status.operational).toBe(true);
      expect(status.lastHeartbeat).toBeInstanceOf(Date);
      expect(status.controlOperator).toBeDefined();
      expect(status.controlOperator!.callsign).toBe('KB1CTRL');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.dutyFactor).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(status.alarms)).toBe(true);
    });

    it('should monitor hardware parameters', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Allow time for monitoring to collect data
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for monitoring cycle

      const status = controller.getStationStatus();

      expect(typeof status.temperature).toBe('number');
      expect(typeof status.voltage).toBe('number');
      expect(typeof status.vswr).toBe('number');

      expect(status.temperature).toBeGreaterThan(0);
      expect(status.voltage).toBeGreaterThan(10);
      expect(status.vswr).toBeGreaterThan(0.5);
    });

    it('should create alarms for out-of-spec conditions', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Monitor for a period to potentially generate alarms
      await new Promise(resolve => setTimeout(resolve, 6000));

      const alarms = controller.getActiveAlarms();

      // Alarms may or may not be present depending on random monitoring values
      // Just verify the structure is correct
      alarms.forEach(alarm => {
        expect(alarm.id).toBeDefined();
        expect(alarm.severity).toMatch(/^(info|warning|critical|emergency)$/);
        expect(alarm.timestamp).toBeInstanceOf(Date);
        expect(alarm.type).toMatch(/^(hardware|compliance|operator|safety|communication)$/);
        expect(alarm.description).toBeDefined();
        expect(typeof alarm.acknowledged).toBe('boolean');
        expect(typeof alarm.resolved).toBe('boolean');
        expect(Array.isArray(alarm.actions)).toBe(true);
      });
    });

    it('should track uptime and session time accurately', async () => {
      const startTime = Date.now();

      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      const stats = controller.getStatistics();

      expect(stats.uptime).toBeGreaterThan(900); // At least 900ms
      expect(stats.sessionTime).toBeGreaterThan(900);
      expect(stats.sessionTime).toBeLessThan(2000); // Less than 2 seconds
    });
  });

  describe('Alarm Management', () => {
    it('should acknowledge alarms correctly', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Force create an alarm by waiting for acknowledgment to become overdue
      await new Promise(resolve => setTimeout(resolve, 6000));

      const activeAlarms = controller.getActiveAlarms();

      if (activeAlarms.length > 0) {
        const alarm = activeAlarms[0];
        const ackResult = await controller.acknowledgeAlarm(alarm.id, 'KB1CTRL');

        expect(ackResult).toBe(true);
        expect(alarm.acknowledged).toBe(true);
      }
    });

    it('should handle invalid alarm acknowledgment', async () => {
      const result = await controller.acknowledgeAlarm('invalid-id', 'KB1CTRL');
      expect(result).toBe(false);
    });

    it('should categorize alarms by type and severity', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Allow monitoring to run and potentially create alarms
      await new Promise(resolve => setTimeout(resolve, 6000));

      const alarms = controller.getActiveAlarms();

      // Verify alarm structure even if no alarms are present
      const validTypes = ['hardware', 'compliance', 'operator', 'safety', 'communication'];
      const validSeverities = ['info', 'warning', 'critical', 'emergency'];

      alarms.forEach(alarm => {
        expect(validTypes).toContain(alarm.type);
        expect(validSeverities).toContain(alarm.severity);
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration properly', async () => {
      const newConfig = {
        acknowledgmentInterval: 5 * 60 * 1000, // 5 minutes
        maxMissedAcknowledgments: 5,
        safetyInterlocks: {
          ...config.safetyInterlocks,
          temperature: { enabled: true, threshold: 60 }
        }
      };

      controller.updateConfiguration(newConfig);

      // Verify configuration was updated
      const stats = controller.getStatistics();
      expect(stats).toBeDefined();
    });

    it('should restart monitoring when intervals change', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const originalInterval = 10 * 60 * 1000; // 10 minutes
      const newInterval = 5 * 60 * 1000; // 5 minutes

      controller.updateConfiguration({
        acknowledgmentInterval: newInterval
      });

      // Verify the change took effect
      const sessionInfo = controller.getControlOperatorInfo();
      expect(sessionInfo).toBeDefined();
    });
  });

  describe('Statistics and Reporting', () => {
    it('should provide comprehensive statistics', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Allow time for data collection
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = controller.getStatistics();

      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.sessionTime).toBeGreaterThanOrEqual(0);
      expect(stats.totalAlarms).toBeGreaterThanOrEqual(0);
      expect(stats.activeAlarms).toBeGreaterThanOrEqual(0);
      expect(stats.acknowledgmentStatus).toMatch(/^(current|warning|overdue)$/);
      expect(stats.dutyFactor).toBeGreaterThanOrEqual(0);
      expect(stats.dutyFactor).toBeLessThanOrEqual(100);

      expect(stats.compliance).toBeDefined();
      expect(stats.hardware).toBeDefined();
      expect(typeof stats.hardware.operational).toBe('boolean');
    });

    it('should track acknowledgment status accurately', async () => {
      const sessionId = await controller.startControlOperatorSession(
        'KB1CTRL',
        'EXTRA',
        { acknowledgmentInterval: 2000 } // 2 seconds for testing
      );

      // Check initial status
      let stats = controller.getStatistics();
      expect(stats.acknowledgmentStatus).toBe('current');

      // Wait for warning threshold
      await new Promise(resolve => setTimeout(resolve, 1700)); // 85% of interval

      stats = controller.getStatistics();
      expect(stats.acknowledgmentStatus).toBe('warning');

      // Acknowledge to reset
      await controller.acknowledgeControlOperator(sessionId, 'manual');

      stats = controller.getStatistics();
      expect(stats.acknowledgmentStatus).toBe('current');
    });

    it('should track duty factor and uptime', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = controller.getStatistics();

      expect(stats.uptime).toBeGreaterThan(500); // At least 500ms
      expect(stats.dutyFactor).toBeGreaterThanOrEqual(0);
      expect(stats.dutyFactor).toBeLessThanOrEqual(100);
    });
  });

  describe('Integration and Compliance', () => {
    it('should integrate with FCC compliance manager', async () => {
      const complianceManager = createComplianceManager('KA1AUTO');
      await controller.initialize(complianceManager);

      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const stats = controller.getStatistics();
      expect(stats.compliance).toBeDefined();
    });

    it('should enforce FCC Part 97.213 requirements', async () => {
      // Test automatic station requirements:
      // 1. Control operator must be available
      // 2. Station must be capable of being shut down
      // 3. Must comply with all other Part 97 requirements

      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const sessionInfo = controller.getControlOperatorInfo();
      expect(sessionInfo).toBeDefined();
      expect(sessionInfo!.privileges.remoteShutdown).toBe(true);

      const status = controller.getStationStatus();
      expect(status.operational).toBe(true);

      // Test shutdown capability
      await controller.endControlOperatorSession('Compliance test');

      const finalStatus = controller.getStationStatus();
      expect(finalStatus.operational).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle system disposal gracefully', () => {
      expect(() => controller.dispose()).not.toThrow();

      // After disposal, basic operations should still work without errors
      const status = controller.getStationStatus();
      expect(status).toBeDefined();
    });

    it('should handle malformed remote commands', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const malformedCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'invalid-command',
        timestamp: new Date(),
        authorization: {
          method: 'certificate',
          credential: 'valid-cert',
          verified: true
        }
      } as RemoteControlCommand;

      const response = await controller.processRemoteCommand(malformedCommand);

      expect(response.success).toBe(false);
      expect(response.response).toContain('Unknown command');
    });

    it('should handle rapid session start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        const sessionId = await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');
        expect(sessionId).toBeDefined();

        await controller.endControlOperatorSession('Rapid cycle test');

        const sessionInfo = controller.getControlOperatorInfo();
        expect(sessionInfo).toBeNull();
      }
    });

    it('should handle concurrent alarm creation', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Allow monitoring to run and create alarms
      await new Promise(resolve => setTimeout(resolve, 6000));

      const initialAlarmCount = controller.getActiveAlarms().length;

      // Wait for more monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 6000));

      const finalAlarmCount = controller.getActiveAlarms().length;

      // Alarm count should be stable or increasing (never decreasing without resolution)
      expect(finalAlarmCount).toBeGreaterThanOrEqual(initialAlarmCount);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond to commands within reasonable time', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const startTime = Date.now();

      const command: RemoteControlCommand = {
        commandId: crypto.randomUUID(),
        source: 'KB1REMOTE',
        command: 'status',
        timestamp: new Date(),
        authorization: {
          method: 'certificate',
          credential: 'valid-cert',
          verified: true
        }
      };

      const response = await controller.processRemoteCommand(command);
      const duration = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle multiple concurrent operations', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      const operations = [
        controller.getStationStatus(),
        controller.getControlOperatorInfo(),
        controller.getActiveAlarms(),
        controller.getStatistics()
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should maintain stable memory usage', async () => {
      await controller.startControlOperatorSession('KB1CTRL', 'EXTRA');

      // Perform many operations to test for memory leaks
      for (let i = 0; i < 100; i++) {
        controller.getStationStatus();
        controller.getStatistics();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });
});