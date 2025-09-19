/**
 * Emergency Broadcast System Contract Tests
 *
 * Verifies the enhanced emergency broadcasting system meets requirements
 * for priority-based distribution, FCC compliance, and multi-channel coordination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EnhancedEmergencyBroadcaster,
  EmergencyContext,
  BroadcastChannel,
  EmergencyBroadcastConfig
} from '../../lib/emergency-broadcast/index.js';
import { PriorityLevel, PriorityManager } from '../../lib/priority-tiers/index.js';
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
    },
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        // Simple hash for testing
        const bytes = new Uint8Array(data);
        let hash = 0;
        for (let i = 0; i < bytes.length; i++) {
          hash = ((hash << 5) - hash) + bytes[i];
          hash = hash & hash;
        }
        return new ArrayBuffer(32); // Mock SHA-256 result
      }
    } as any
  } as any;
}

describe('Enhanced Emergency Broadcasting System', () => {
  let broadcaster: EnhancedEmergencyBroadcaster;
  let mockBroadcastHandler: ReturnType<typeof vi.fn>;
  let config: EmergencyBroadcastConfig;

  const testChannels: BroadcastChannel[] = [
    {
      id: 'rf-emergency',
      name: 'RF Emergency Channel',
      frequency: 146.52,
      mode: 'RF',
      priority: PriorityLevel.P0_EMERGENCY,
      maxRetries: 10,
      retryInterval: 30000,
      acknowledgmentRequired: true,
      geographicScope: 'regional'
    },
    {
      id: 'webrtc-local',
      name: 'WebRTC Local Network',
      mode: 'WebRTC',
      priority: PriorityLevel.P2_HIGH,
      maxRetries: 3,
      retryInterval: 60000,
      acknowledgmentRequired: false,
      geographicScope: 'local'
    },
    {
      id: 'hybrid-wide',
      name: 'Hybrid Wide Area',
      mode: 'hybrid',
      priority: PriorityLevel.P1_URGENT,
      maxRetries: 5,
      retryInterval: 45000,
      acknowledgmentRequired: true,
      geographicScope: 'national'
    }
  ];

  beforeEach(() => {
    mockBroadcastHandler = vi.fn().mockResolvedValue(true);

    config = {
      callsign: 'KA1TEST',
      licenseClass: 'TECHNICIAN',
      emergencyAuthority: 'SERVED-AGENCY-001',
      defaultChannels: testChannels,
      complianceEnabled: true,
      automaticRebroadcast: true,
      acknowledgmentTimeout: 300000, // 5 minutes
      maxHops: 10
    };

    broadcaster = new EnhancedEmergencyBroadcaster(config, mockBroadcastHandler);
  });

  afterEach(async () => {
    if (broadcaster) {
      await broadcaster.emergencyShutdown();
    }
  });

  describe('Emergency Broadcast Creation', () => {
    it('should create P0 emergency broadcast for catastrophic events', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'disaster',
        severity: 'catastrophic',
        jurisdiction: 'Marin County',
        coordinates: { lat: 37.7749, lon: -122.4194 },
        radius: 50,
        evacuationZone: true,
        emergencyServices: ['fire', 'police', 'ems']
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'CATASTROPHIC EARTHQUAKE - IMMEDIATE EVACUATION REQUIRED',
        emergencyContext
      );

      expect(broadcastId).toBeDefined();
      expect(mockBroadcastHandler).toHaveBeenCalled();

      // Verify broadcast was called for all channels (P0 uses all available)
      expect(mockBroadcastHandler).toHaveBeenCalledTimes(testChannels.length);

      const stats = broadcaster.getEmergencyStatistics();
      expect(stats.emergencyMessages).toBe(1);
      expect(stats.totalBroadcasts).toBe(1);
    });

    it('should create P1 urgent broadcast for critical health emergencies', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'health',
        severity: 'critical',
        jurisdiction: 'City of San Francisco',
        shelterInPlace: true,
        emergencyServices: ['health', 'ems']
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'CRITICAL HEALTH EMERGENCY - SHELTER IN PLACE ORDERED',
        emergencyContext,
        { priority: PriorityLevel.P1_URGENT }
      );

      expect(broadcastId).toBeDefined();

      const stats = broadcaster.getEmergencyStatistics();
      expect(stats.urgentMessages).toBe(1);
    });

    it('should automatically determine priority from severity', async () => {
      const contexts: Array<{ severity: EmergencyContext['severity']; expectedPriority: PriorityLevel }> = [
        { severity: 'catastrophic', expectedPriority: PriorityLevel.P0_EMERGENCY },
        { severity: 'critical', expectedPriority: PriorityLevel.P0_EMERGENCY },
        { severity: 'major', expectedPriority: PriorityLevel.P1_URGENT },
        { severity: 'moderate', expectedPriority: PriorityLevel.P2_HIGH },
        { severity: 'minor', expectedPriority: PriorityLevel.P3_NORMAL }
      ];

      for (const { severity, expectedPriority } of contexts) {
        mockBroadcastHandler.mockClear();

        const emergencyContext: EmergencyContext = {
          type: 'safety',
          severity,
          jurisdiction: 'Test Area'
        };

        const broadcastId = await broadcaster.broadcastEmergency(
          `Test message - ${severity}`,
          emergencyContext
        );

        expect(broadcastId).toBeDefined();
        expect(mockBroadcastHandler).toHaveBeenCalled();

        // Check that the broadcast was called with correct priority
        const call = mockBroadcastHandler.mock.calls[0];
        const message = call[0];
        expect(message.priority.level).toBe(expectedPriority);
      }
    });
  });

  describe('Channel Selection and Management', () => {
    it('should select appropriate channels based on priority', async () => {
      // High priority should use emergency-capable channels
      const emergencyContext: EmergencyContext = {
        type: 'disaster',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Major disaster event',
        emergencyContext,
        { priority: PriorityLevel.P1_URGENT }
      );

      expect(broadcastId).toBeDefined();

      // Should use channels that support P1 priority or higher
      const expectedChannels = testChannels.filter(c => c.priority <= PriorityLevel.P1_URGENT);
      expect(mockBroadcastHandler).toHaveBeenCalledTimes(expectedChannels.length);
    });

    it('should respect geographic scope filtering', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'weather',
        severity: 'moderate',
        jurisdiction: 'Local Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Local weather alert',
        emergencyContext,
        { geographicScope: 'local' }
      );

      expect(broadcastId).toBeDefined();

      // Should only use local scope channels
      const localChannels = testChannels.filter(c => c.geographicScope === 'local');
      expect(mockBroadcastHandler).toHaveBeenCalledTimes(localChannels.length);
    });

    it('should support specific channel selection', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'infrastructure',
        severity: 'moderate',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Infrastructure alert',
        emergencyContext,
        { channels: ['rf-emergency'] }
      );

      expect(broadcastId).toBeDefined();
      expect(mockBroadcastHandler).toHaveBeenCalledTimes(1);

      const call = mockBroadcastHandler.mock.calls[0];
      const channel = call[1];
      expect(channel.id).toBe('rf-emergency');
    });

    it('should allow dynamic channel registration', () => {
      const newChannel: BroadcastChannel = {
        id: 'test-channel',
        name: 'Test Channel',
        mode: 'hybrid',
        priority: PriorityLevel.P2_HIGH,
        maxRetries: 3,
        retryInterval: 60000,
        acknowledgmentRequired: false,
        geographicScope: 'local'
      };

      broadcaster.registerChannel(newChannel);

      // Channel should now be available for broadcasts
      expect(() => broadcaster.removeChannel('test-channel')).not.toThrow();
    });
  });

  describe('Acknowledgment System', () => {
    it('should track acknowledgments from receiving stations', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'safety',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Safety alert requiring acknowledgment',
        emergencyContext,
        { requireAcknowledgment: true }
      );

      // Send acknowledgments from multiple stations
      const stations = ['KB1ABC', 'KC2DEF', 'KD3GHI'];
      for (const station of stations) {
        const ackResult = broadcaster.acknowledgeEmergencyBroadcast(broadcastId, station);
        expect(ackResult).toBe(true);
      }

      const stats = broadcaster.getEmergencyStatistics();
      expect(stats.acknowledgedBroadcasts).toBeGreaterThan(0);
    });

    it('should mark broadcast as acknowledged when sufficient responses received', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'weather',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Weather emergency',
        emergencyContext,
        { geographicScope: 'local', requireAcknowledgment: true }
      );

      // For local scope, only 1 acknowledgment required
      const ackResult = broadcaster.acknowledgeEmergencyBroadcast(broadcastId, 'KB1ACK');
      expect(ackResult).toBe(true);

      const activeBroadcasts = broadcaster.getActiveBroadcasts();
      const thisBroadcast = activeBroadcasts.find(b => b.id === broadcastId);

      // Should not be in active broadcasts if acknowledged
      expect(thisBroadcast?.status).not.toBe('pending');
    });

    it('should handle invalid acknowledgment attempts', () => {
      const result = broadcaster.acknowledgeEmergencyBroadcast('invalid-id', 'KB1TEST');
      expect(result).toBe(false);
    });
  });

  describe('Broadcast Management', () => {
    it('should list active broadcasts', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'infrastructure',
        severity: 'moderate',
        jurisdiction: 'Test Area'
      };

      const broadcastId1 = await broadcaster.broadcastEmergency(
        'Infrastructure alert 1',
        emergencyContext
      );

      const broadcastId2 = await broadcaster.broadcastEmergency(
        'Infrastructure alert 2',
        emergencyContext
      );

      const activeBroadcasts = broadcaster.getActiveBroadcasts();
      expect(activeBroadcasts.length).toBeGreaterThanOrEqual(2);

      const ids = activeBroadcasts.map(b => b.id);
      expect(ids).toContain(broadcastId1);
      expect(ids).toContain(broadcastId2);
    });

    it('should cancel pending broadcasts', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'safety',
        severity: 'minor',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Minor safety alert',
        emergencyContext,
        { priority: PriorityLevel.P4_LOW }
      );

      const cancelResult = broadcaster.cancelBroadcast(broadcastId);
      expect(cancelResult).toBe(true);

      const activeBroadcasts = broadcaster.getActiveBroadcasts();
      const cancelled = activeBroadcasts.find(b => b.id === broadcastId);
      expect(cancelled).toBeUndefined();
    });

    it('should not cancel completed broadcasts', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'weather',
        severity: 'minor',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Weather update',
        emergencyContext
      );

      // Acknowledge to complete
      broadcaster.acknowledgeEmergencyBroadcast(broadcastId, 'KB1TEST');

      const cancelResult = broadcaster.cancelBroadcast(broadcastId);
      expect(cancelResult).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive statistics', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'disaster',
        severity: 'catastrophic',
        jurisdiction: 'Test Area'
      };

      // Create multiple broadcasts
      await broadcaster.broadcastEmergency('Emergency 1', emergencyContext);
      await broadcaster.broadcastEmergency('Emergency 2', emergencyContext);

      const stats = broadcaster.getEmergencyStatistics();

      expect(stats.totalBroadcasts).toBe(2);
      expect(stats.emergencyMessages).toBe(2);
      expect(stats.channels).toBe(testChannels.length);
      expect(stats.lastEmergencyBroadcast).toBeInstanceOf(Date);
    });

    it('should track average acknowledgment times', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'health',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Health emergency',
        emergencyContext,
        { requireAcknowledgment: true }
      );

      // Simulate acknowledgment after some time
      setTimeout(() => {
        broadcaster.acknowledgeEmergencyBroadcast(broadcastId, 'KB1QUICK');
      }, 100);

      // Allow time for acknowledgment
      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = broadcaster.getEmergencyStatistics();
      expect(stats.avgAcknowledgmentTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle broadcast failures gracefully', async () => {
      // Mock broadcast failure
      mockBroadcastHandler.mockRejectedValueOnce(new Error('Channel unavailable'));

      const emergencyContext: EmergencyContext = {
        type: 'infrastructure',
        severity: 'moderate',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Infrastructure alert',
        emergencyContext,
        { channels: ['rf-emergency'] }
      );

      expect(broadcastId).toBeDefined();

      const activeBroadcasts = broadcaster.getActiveBroadcasts();
      const failedBroadcast = activeBroadcasts.find(b => b.id === broadcastId);
      expect(failedBroadcast?.status).toBe('failed');
    });

    it('should handle partial broadcast failures', async () => {
      // Mock partial failure - first call fails, second succeeds
      mockBroadcastHandler
        .mockRejectedValueOnce(new Error('First channel failed'))
        .mockResolvedValueOnce(true);

      const emergencyContext: EmergencyContext = {
        type: 'weather',
        severity: 'moderate',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Weather alert',
        emergencyContext
      );

      expect(broadcastId).toBeDefined();
      expect(mockBroadcastHandler).toHaveBeenCalledTimes(testChannels.length);
    });

    it('should handle emergency shutdown', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'safety',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      await broadcaster.broadcastEmergency('Safety alert', emergencyContext);

      await expect(broadcaster.emergencyShutdown()).resolves.not.toThrow();

      const stats = broadcaster.getEmergencyStatistics();
      expect(stats.activeBroadcasts).toBe(0);
    });
  });

  describe('FCC Compliance Integration', () => {
    it('should integrate with FCC compliance manager', async () => {
      const complianceManager = createComplianceManager('KA1TEST');
      await broadcaster.initialize(complianceManager);

      // This should succeed as it's not encrypted content
      const emergencyContext: EmergencyContext = {
        type: 'safety',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'Safety emergency',
        emergencyContext
      );

      expect(broadcastId).toBeDefined();
    });

    it('should allow emergency override for P0 messages', async () => {
      const complianceManager = createComplianceManager('KA1TEST');
      await broadcaster.initialize(complianceManager);

      const emergencyContext: EmergencyContext = {
        type: 'disaster',
        severity: 'catastrophic',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'CATASTROPHIC EMERGENCY - IMMEDIATE ACTION REQUIRED',
        emergencyContext,
        { override: true }
      );

      expect(broadcastId).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should handle emergency broadcasts within 3 seconds', async () => {
      const startTime = Date.now();

      const emergencyContext: EmergencyContext = {
        type: 'disaster',
        severity: 'catastrophic',
        jurisdiction: 'Test Area'
      };

      const broadcastId = await broadcaster.broadcastEmergency(
        'P0 EMERGENCY TEST',
        emergencyContext,
        { priority: PriorityLevel.P0_EMERGENCY }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(broadcastId).toBeDefined();
      expect(duration).toBeLessThan(3000); // 3 second target
    });

    it('should support concurrent emergency broadcasts', async () => {
      const emergencyContext: EmergencyContext = {
        type: 'disaster',
        severity: 'major',
        jurisdiction: 'Test Area'
      };

      const broadcasts = await Promise.all([
        broadcaster.broadcastEmergency('Emergency 1', emergencyContext),
        broadcaster.broadcastEmergency('Emergency 2', emergencyContext),
        broadcaster.broadcastEmergency('Emergency 3', emergencyContext)
      ]);

      expect(broadcasts).toHaveLength(3);
      expect(new Set(broadcasts)).toHaveSize(3); // All unique IDs

      const stats = broadcaster.getEmergencyStatistics();
      expect(stats.totalBroadcasts).toBe(3);
    });
  });
});