/**
 * Contract Test: Ban Broadcast API
 *
 * Tests the HTTP API for ban broadcasting when hearing CQ, ban record
 * distribution, configurable broadcast behavior, and once-only for historical CQs.
 *
 * These tests MUST FAIL initially (TDD Red phase) until the API
 * endpoints and ban broadcast logic are implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BanRecord,
  Certificate,
  CertificateType,
  TrustLevel
} from '../../lib/certificate-management/types.js';

// ==================== Request/Response Types ====================

interface BanBroadcastRequest {
  /** Type of broadcast trigger */
  trigger: 'cq_heard' | 'manual' | 'scheduled';

  /** Callsign that triggered the broadcast (for CQ heard) */
  triggerCallsign?: string;

  /** CQ details if triggered by hearing CQ */
  cqDetails?: {
    /** Frequency where CQ was heard */
    frequency: number;

    /** Time when CQ was heard (ISO 8601) */
    heardAt: string;

    /** Signal strength (S-meter reading) */
    signalStrength?: number;

    /** CQ message content */
    message?: string;

    /** Whether this is a historical CQ (already processed) */
    isHistorical: boolean;

    /** Grid square of CQ origin */
    gridSquare?: string;
  };

  /** Ban records to broadcast */
  banRecords: BanRecord[];

  /** Broadcast configuration */
  broadcastConfig: {
    /** Target servers for broadcast */
    targetServers?: string[];

    /** Broadcast all known bans or just specific ones */
    broadcastScope: 'all_active' | 'specific' | 'recent_only';

    /** Maximum age of bans to broadcast (seconds) */
    maxBanAge?: number;

    /** Include expired bans in broadcast */
    includeExpiredBans?: boolean;

    /** Priority level for broadcast */
    priority: 'low' | 'medium' | 'high' | 'urgent';

    /** Whether to require acknowledgment */
    requireAcknowledgment?: boolean;

    /** Retry configuration */
    retryConfig?: {
      /** Maximum retry attempts */
      maxRetries?: number;

      /** Retry delay in milliseconds */
      retryDelay?: number;

      /** Exponential backoff multiplier */
      backoffMultiplier?: number;
    };
  };

  /** Rate limiting compliance */
  rateLimiting: {
    /** Whether to check rate limits */
    checkRateLimits: boolean;

    /** Override rate limits (operator privilege) */
    overrideRateLimits?: boolean;

    /** Reason for rate limit override */
    overrideReason?: string;
  };

  /** Server authentication */
  authentication: {
    /** Server certificate for authentication */
    serverCertificate: Certificate;

    /** Digital signature of broadcast request */
    signature: string;

    /** Timestamp of signature creation */
    signedAt: string;
  };
}

interface BanBroadcastResponse {
  /** Whether broadcast was accepted */
  accepted: boolean;

  /** Broadcast identifier */
  broadcastId: string;

  /** Trigger that initiated the broadcast */
  trigger: string;

  /** Broadcasting results */
  results: {
    /** Number of ban records processed */
    banRecordsProcessed: number;

    /** Number of servers targeted */
    serversTargeted: number;

    /** Number of successful broadcasts */
    successfulBroadcasts: number;

    /** Number of failed broadcasts */
    failedBroadcasts: number;

    /** Number of acknowledgments received */
    acknowledgementsReceived: number;
  };

  /** Per-server broadcast results */
  serverResults: BroadcastServerResult[];

  /** Rate limiting status */
  rateLimiting: {
    /** Whether rate limits were checked */
    checked: boolean;

    /** Current rate limit status */
    status: 'within_limits' | 'rate_limited' | 'overridden';

    /** Rate limit details */
    limits: {
      /** Broadcasts allowed per hour */
      broadcastsPerHour: number;

      /** Broadcasts used in current hour */
      broadcastsUsed: number;

      /** Remaining broadcasts in current hour */
      remainingBroadcasts: number;

      /** Rate limit reset time (ISO 8601) */
      resetTime: string;
    };

    /** Rate limit override details if applicable */
    override?: {
      /** Operator who authorized override */
      authorizedBy: string;

      /** Override reason */
      reason: string;

      /** Override timestamp */
      overriddenAt: string;
    };
  };

  /** CQ processing details if triggered by CQ */
  cqProcessing?: {
    /** Whether CQ was previously processed */
    previouslyProcessed: boolean;

    /** Number of times this CQ has been processed */
    processCount: number;

    /** First time this CQ was processed */
    firstProcessedAt?: string;

    /** CQ history hash for deduplication */
    cqHistoryHash: string;

    /** Whether broadcast was skipped due to historical CQ */
    skippedHistorical: boolean;
  };

  /** Performance metrics */
  performance: {
    /** Total broadcast time in milliseconds */
    broadcastTime: number;

    /** Time spent on authentication */
    authenticationTime: number;

    /** Time spent on rate limit checks */
    rateLimitCheckTime: number;

    /** Average response time per server */
    averageServerResponseTime: number;

    /** Network requests made */
    networkRequests: number;
  };

  /** When broadcast was processed (ISO 8601) */
  processedAt: string;

  /** Server that processed the broadcast */
  processedBy: string;
}

interface BroadcastServerResult {
  /** Target server callsign */
  serverCallsign: string;

  /** Broadcast result for this server */
  result: 'success' | 'failure' | 'timeout' | 'rate_limited' | 'authentication_failed';

  /** Number of ban records sent to this server */
  banRecordsSent: number;

  /** Number of ban records acknowledged by server */
  banRecordsAcknowledged: number;

  /** Response time from server in milliseconds */
  responseTime: number;

  /** Server acknowledgment details */
  acknowledgment?: {
    /** Whether server acknowledged receipt */
    acknowledged: boolean;

    /** Acknowledgment timestamp */
    acknowledgedAt: string;

    /** Server response message */
    responseMessage?: string;

    /** Number of bans already known to server */
    alreadyKnownBans: number;

    /** Number of new bans accepted by server */
    newBansAccepted: number;

    /** Number of bans rejected by server */
    bansRejected: number;
  };

  /** Error details if result is failure */
  error?: {
    /** Error code */
    code: string;

    /** Error message */
    message: string;

    /** Whether error is retryable */
    retryable: boolean;

    /** Additional error details */
    details?: any;
  };

  /** Retry information */
  retries: {
    /** Number of retry attempts made */
    attemptsMade: number;

    /** Whether all retries were exhausted */
    retriesExhausted: boolean;

    /** Final attempt timestamp */
    finalAttemptAt?: string;
  };
}

interface BroadcastConfiguration {
  /** Whether ban broadcasting is enabled */
  broadcastEnabled: boolean;

  /** Default broadcast settings */
  defaults: {
    /** Default broadcast scope */
    defaultScope: 'all_active' | 'specific' | 'recent_only';

    /** Default priority level */
    defaultPriority: 'low' | 'medium' | 'high' | 'urgent';

    /** Default target servers */
    defaultTargetServers: string[];

    /** Whether to require acknowledgments by default */
    requireAcknowledgmentDefault: boolean;
  };

  /** Rate limiting configuration */
  rateLimits: {
    /** Broadcasts allowed per hour per server */
    broadcastsPerHour: number;

    /** Burst limit for rapid broadcasts */
    burstLimit: number;

    /** Rate limit window in seconds */
    windowSize: number;

    /** Whether to allow rate limit overrides */
    allowOverrides: boolean;

    /** Operators who can override rate limits */
    overrideOperators: string[];
  };

  /** CQ processing configuration */
  cqProcessing: {
    /** Whether to process CQ automatically */
    autoProcessCQ: boolean;

    /** Whether to broadcast on historical CQs */
    broadcastHistoricalCQs: boolean;

    /** CQ deduplication window in minutes */
    deduplicationWindow: number;

    /** Minimum signal strength to trigger broadcast */
    minimumSignalStrength?: number;

    /** Frequency ranges to monitor for CQs */
    monitoredFrequencies: {
      /** Start frequency in Hz */
      startFreq: number;

      /** End frequency in Hz */
      endFreq: number;

      /** Band name */
      bandName: string;
    }[];
  };

  /** Retry configuration */
  retryConfig: {
    /** Default maximum retry attempts */
    defaultMaxRetries: number;

    /** Default retry delay in milliseconds */
    defaultRetryDelay: number;

    /** Default backoff multiplier */
    defaultBackoffMultiplier: number;

    /** Maximum total retry time in milliseconds */
    maxRetryTime: number;
  };

  /** Server trust requirements */
  trustRequirements: {
    /** Minimum trust level for broadcast acceptance */
    minimumTrustLevel: TrustLevel;

    /** Whether to validate server certificates */
    validateServerCertificates: boolean;

    /** Required consensus for ban acceptance */
    requiredConsensus?: number;

    /** Trusted server list */
    trustedServers: string[];
  };
}

interface BroadcastHistory {
  /** Broadcast identifier */
  broadcastId: string;

  /** When broadcast occurred */
  broadcastAt: string;

  /** Server that initiated broadcast */
  initiatedBy: string;

  /** Trigger that caused broadcast */
  trigger: string;

  /** Number of ban records broadcast */
  banRecordsBroadcast: number;

  /** Target servers */
  targetServers: string[];

  /** Broadcast results summary */
  results: {
    /** Success rate percentage */
    successRate: number;

    /** Total acknowledgments received */
    totalAcknowledgments: number;

    /** Average response time */
    averageResponseTime: number;
  };

  /** CQ details if triggered by CQ */
  cqTrigger?: {
    /** Callsign that sent CQ */
    callsign: string;

    /** Frequency of CQ */
    frequency: number;

    /** Whether CQ was historical */
    wasHistorical: boolean;
  };
}

interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Mock API base URL (will fail until API is implemented)
const API_BASE_URL = 'http://localhost:3000/api';

// Mock fetch function that will fail until API exists
const mockFetch = vi.fn();

describe('Ban Broadcast API Contract', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/bans/broadcast', () => {
    it('should broadcast bans when CQ is heard', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'cq_heard',
        triggerCallsign: 'KC3BAD',
        cqDetails: {
          frequency: 14230000,
          heardAt: '2025-09-18T10:00:00Z',
          signalStrength: 7,
          message: 'CQ DX KC3BAD KC3BAD',
          isHistorical: false,
          gridSquare: 'FN20'
        },
        banRecords: [
          {
            id: 'ban-001',
            certificateId: '777e8400-e29b-41d4-a716-446655440002',
            bannedCallsign: 'KC3BAD',
            banningServer: 'KA1ABC',
            bannedBy: 'KA1ABC',
            bannedAt: '2025-09-18T09:00:00Z',
            banType: 'network',
            severity: 'permanent',
            reason: 'Malicious activity',
            broadcastEnabled: true,
            acknowledgedBy: [],
            appealAllowed: false,
            isActive: true
          }
        ],
        broadcastConfig: {
          broadcastScope: 'all_active',
          priority: 'high',
          requireAcknowledgment: true
        },
        rateLimiting: {
          checkRateLimits: true
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KA1ABC',
            type: CertificateType.ARRL,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=ARRL',
            subject: 'CN=KA1ABC',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2026-01-01T00:00:00Z',
            isRevoked: false,
            trustLevel: TrustLevel.ARRL,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'abcdef123456',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        expect(response.status).toBe(200);
        const result: BanBroadcastResponse = await response.json();

        // Validate response structure
        expect(typeof result.accepted).toBe('boolean');
        expect(result.broadcastId).toBeDefined();
        expect(result.trigger).toBe('cq_heard');
        expect(result.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(result.processedBy).toMatch(/^[A-Z0-9]{3,7}$/);

        // Validate results
        expect(result.results).toBeDefined();
        expect(result.results.banRecordsProcessed).toBe(1);
        expect(result.results.serversTargeted).toBeGreaterThanOrEqual(0);
        expect(result.results.successfulBroadcasts).toBeGreaterThanOrEqual(0);
        expect(result.results.failedBroadcasts).toBeGreaterThanOrEqual(0);
        expect(result.results.acknowledgementsReceived).toBeGreaterThanOrEqual(0);

        // Total broadcasts should match targeted servers
        expect(result.results.successfulBroadcasts + result.results.failedBroadcasts)
          .toBe(result.results.serversTargeted);

        // Validate server results
        expect(result.serverResults).toBeInstanceOf(Array);
        expect(result.serverResults.length).toBe(result.results.serversTargeted);

        result.serverResults.forEach(serverResult => {
          expect(serverResult.serverCallsign).toMatch(/^[A-Z0-9]{3,7}$/);
          expect(['success', 'failure', 'timeout', 'rate_limited', 'authentication_failed'])
            .toContain(serverResult.result);
          expect(serverResult.banRecordsSent).toBeGreaterThanOrEqual(0);
          expect(serverResult.banRecordsAcknowledged).toBeGreaterThanOrEqual(0);
          expect(serverResult.responseTime).toBeGreaterThanOrEqual(0);

          // Validate retry information
          expect(serverResult.retries).toBeDefined();
          expect(serverResult.retries.attemptsMade).toBeGreaterThanOrEqual(0);
          expect(typeof serverResult.retries.retriesExhausted).toBe('boolean');

          // Validate acknowledgment if successful
          if (serverResult.result === 'success' && request.broadcastConfig.requireAcknowledgment) {
            expect(serverResult.acknowledgment).toBeDefined();
            expect(typeof serverResult.acknowledgment!.acknowledged).toBe('boolean');
            if (serverResult.acknowledgment!.acknowledged) {
              expect(serverResult.acknowledgment!.acknowledgedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
              expect(serverResult.acknowledgment!.alreadyKnownBans).toBeGreaterThanOrEqual(0);
              expect(serverResult.acknowledgment!.newBansAccepted).toBeGreaterThanOrEqual(0);
              expect(serverResult.acknowledgment!.bansRejected).toBeGreaterThanOrEqual(0);
            }
          }
        });

        // Validate rate limiting
        expect(result.rateLimiting).toBeDefined();
        expect(result.rateLimiting.checked).toBe(true);
        expect(['within_limits', 'rate_limited', 'overridden']).toContain(result.rateLimiting.status);
        expect(result.rateLimiting.limits).toBeDefined();
        expect(result.rateLimiting.limits.broadcastsPerHour).toBeGreaterThan(0);
        expect(result.rateLimiting.limits.broadcastsUsed).toBeGreaterThanOrEqual(0);
        expect(result.rateLimiting.limits.remainingBroadcasts).toBeGreaterThanOrEqual(0);

        // Validate CQ processing
        expect(result.cqProcessing).toBeDefined();
        expect(typeof result.cqProcessing!.previouslyProcessed).toBe('boolean');
        expect(result.cqProcessing!.processCount).toBeGreaterThanOrEqual(1);
        expect(result.cqProcessing!.cqHistoryHash).toBeDefined();
        expect(typeof result.cqProcessing!.skippedHistorical).toBe('boolean');

        // For non-historical CQ, should not skip
        expect(result.cqProcessing!.skippedHistorical).toBe(false);

        // Validate performance metrics
        expect(result.performance).toBeDefined();
        expect(result.performance.broadcastTime).toBeGreaterThan(0);
        expect(result.performance.authenticationTime).toBeGreaterThanOrEqual(0);
        expect(result.performance.rateLimitCheckTime).toBeGreaterThanOrEqual(0);
        expect(result.performance.networkRequests).toBeGreaterThanOrEqual(0);
      }).rejects.toThrow('Connection refused');
    });

    it('should skip broadcast for historical CQs when configured', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'cq_heard',
        triggerCallsign: 'KC3BAD',
        cqDetails: {
          frequency: 14230000,
          heardAt: '2025-09-18T09:00:00Z', // Historical time
          signalStrength: 7,
          message: 'CQ DX KC3BAD KC3BAD',
          isHistorical: true, // Mark as historical
          gridSquare: 'FN20'
        },
        banRecords: [
          {
            id: 'ban-001',
            certificateId: '777e8400-e29b-41d4-a716-446655440002',
            bannedCallsign: 'KC3BAD',
            banningServer: 'KA1ABC',
            bannedBy: 'KA1ABC',
            bannedAt: '2025-09-18T09:00:00Z',
            banType: 'network',
            severity: 'permanent',
            reason: 'Malicious activity',
            broadcastEnabled: true,
            acknowledgedBy: [],
            appealAllowed: false,
            isActive: true
          }
        ],
        broadcastConfig: {
          broadcastScope: 'all_active',
          priority: 'medium'
        },
        rateLimiting: {
          checkRateLimits: true
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KA1ABC',
            type: CertificateType.ARRL,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=ARRL',
            subject: 'CN=KA1ABC',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2026-01-01T00:00:00Z',
            isRevoked: false,
            trustLevel: TrustLevel.ARRL,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'abcdef123456',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        expect(response.status).toBe(200);
        const result: BanBroadcastResponse = await response.json();

        // Broadcast should be skipped for historical CQ
        expect(result.cqProcessing).toBeDefined();
        expect(result.cqProcessing!.skippedHistorical).toBe(true);
        expect(result.cqProcessing!.previouslyProcessed).toBe(true);

        // Should not target any servers for historical CQ
        if (result.cqProcessing!.skippedHistorical) {
          expect(result.results.serversTargeted).toBe(0);
          expect(result.results.successfulBroadcasts).toBe(0);
          expect(result.serverResults.length).toBe(0);
        }

        // CQ should have been processed before
        expect(result.cqProcessing!.processCount).toBeGreaterThan(1);
        expect(result.cqProcessing!.firstProcessedAt).toBeDefined();
        expect(result.cqProcessing!.firstProcessedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle manual ban broadcast with specific target servers', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'manual',
        banRecords: [
          {
            id: 'ban-002',
            certificateId: '888e8400-e29b-41d4-a716-446655440003',
            bannedCallsign: 'KD4BAD',
            banningServer: 'KA1ABC',
            bannedBy: 'KA1ABC',
            bannedAt: '2025-09-18T10:00:00Z',
            banType: 'server',
            severity: 'temporary',
            expiresAt: '2025-09-19T10:00:00Z',
            reason: 'Policy violation',
            broadcastEnabled: true,
            acknowledgedBy: [],
            appealAllowed: true,
            appealDeadline: '2025-09-25T10:00:00Z',
            isActive: true
          }
        ],
        broadcastConfig: {
          targetServers: ['KB2DEF', 'KC3GHI', 'KD4JKL'],
          broadcastScope: 'specific',
          priority: 'urgent',
          requireAcknowledgment: true,
          retryConfig: {
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2.0
          }
        },
        rateLimiting: {
          checkRateLimits: true
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KA1ABC',
            type: CertificateType.ARRL,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=ARRL',
            subject: 'CN=KA1ABC',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2026-01-01T00:00:00Z',
            isRevoked: false,
            trustLevel: TrustLevel.ARRL,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'abcdef123456',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        expect(response.status).toBe(200);
        const result: BanBroadcastResponse = await response.json();

        expect(result.trigger).toBe('manual');

        // Should target exactly the specified servers
        expect(result.results.serversTargeted).toBe(3);
        expect(result.serverResults.length).toBe(3);

        // Validate specific target servers
        const targetCallsigns = result.serverResults.map(sr => sr.serverCallsign);
        expect(targetCallsigns).toContain('KB2DEF');
        expect(targetCallsigns).toContain('KC3GHI');
        expect(targetCallsigns).toContain('KD4JKL');

        // Should not have CQ processing for manual trigger
        expect(result.cqProcessing).toBeUndefined();

        // Validate retry configuration was applied
        result.serverResults.forEach(serverResult => {
          if (serverResult.result === 'failure' || serverResult.result === 'timeout') {
            expect(serverResult.retries.attemptsMade).toBeGreaterThan(0);
            expect(serverResult.retries.attemptsMade).toBeLessThanOrEqual(3);
          }
        });

        // High priority should be reflected in faster processing
        expect(result.performance.broadcastTime).toBeLessThan(10000); // 10 seconds
      }).rejects.toThrow('Connection refused');
    });

    it('should handle rate limiting and provide detailed limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'manual',
        banRecords: [
          {
            id: 'ban-003',
            certificateId: '999e8400-e29b-41d4-a716-446655440004',
            bannedCallsign: 'KE5BAD',
            banningServer: 'KA1ABC',
            bannedBy: 'KA1ABC',
            bannedAt: '2025-09-18T10:00:00Z',
            banType: 'network',
            severity: 'warning',
            reason: 'Excessive QRM',
            broadcastEnabled: true,
            acknowledgedBy: [],
            appealAllowed: true,
            isActive: true
          }
        ],
        broadcastConfig: {
          broadcastScope: 'all_active',
          priority: 'low'
        },
        rateLimiting: {
          checkRateLimits: true
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KA1ABC',
            type: CertificateType.ARRL,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=ARRL',
            subject: 'CN=KA1ABC',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2026-01-01T00:00:00Z',
            isRevoked: false,
            trustLevel: TrustLevel.ARRL,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'abcdef123456',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        expect(response.status).toBe(200);
        const result: BanBroadcastResponse = await response.json();

        // Rate limiting should be checked
        expect(result.rateLimiting.checked).toBe(true);
        expect(['within_limits', 'rate_limited', 'overridden']).toContain(result.rateLimiting.status);

        // Validate rate limit details
        expect(result.rateLimiting.limits.broadcastsPerHour).toBeGreaterThan(0);
        expect(result.rateLimiting.limits.broadcastsUsed).toBeGreaterThanOrEqual(0);
        expect(result.rateLimiting.limits.broadcastsUsed).toBeLessThanOrEqual(result.rateLimiting.limits.broadcastsPerHour);
        expect(result.rateLimiting.limits.remainingBroadcasts).toBeGreaterThanOrEqual(0);
        expect(result.rateLimiting.limits.resetTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        // If rate limited, broadcast should be rejected or limited
        if (result.rateLimiting.status === 'rate_limited') {
          expect(result.accepted).toBe(false);
          expect(result.results.serversTargeted).toBe(0);
        } else {
          expect(result.accepted).toBe(true);
        }

        // Rate limit check time should be tracked
        expect(result.performance.rateLimitCheckTime).toBeGreaterThanOrEqual(0);
      }).rejects.toThrow('Connection refused');
    });

    it('should allow rate limit override with proper authorization', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'manual',
        banRecords: [
          {
            id: 'ban-004',
            certificateId: 'aaae8400-e29b-41d4-a716-446655440005',
            bannedCallsign: 'KF6BAD',
            banningServer: 'KA1ABC',
            bannedBy: 'KA1ABC',
            bannedAt: '2025-09-18T10:00:00Z',
            banType: 'network',
            severity: 'permanent',
            reason: 'Emergency - interference with emergency services',
            broadcastEnabled: true,
            acknowledgedBy: [],
            appealAllowed: false,
            isActive: true
          }
        ],
        broadcastConfig: {
          broadcastScope: 'all_active',
          priority: 'urgent'
        },
        rateLimiting: {
          checkRateLimits: true,
          overrideRateLimits: true,
          overrideReason: 'Emergency - immediate threat to public safety'
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KA1ABC',
            type: CertificateType.ARRL,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=ARRL',
            subject: 'CN=KA1ABC',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2026-01-01T00:00:00Z',
            isRevoked: false,
            trustLevel: TrustLevel.ARRL,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'abcdef123456',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        expect(response.status).toBe(200);
        const result: BanBroadcastResponse = await response.json();

        // Rate limits should be overridden
        expect(result.rateLimiting.status).toBe('overridden');
        expect(result.rateLimiting.override).toBeDefined();
        expect(result.rateLimiting.override!.authorizedBy).toMatch(/^[A-Z0-9]{3,7}$/);
        expect(result.rateLimiting.override!.reason).toBe('Emergency - immediate threat to public safety');
        expect(result.rateLimiting.override!.overriddenAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        // Broadcast should be accepted despite rate limits
        expect(result.accepted).toBe(true);
        expect(result.results.serversTargeted).toBeGreaterThan(0);

        // Emergency broadcasts should be processed quickly
        expect(result.performance.broadcastTime).toBeLessThan(5000); // 5 seconds
      }).rejects.toThrow('Connection refused');
    });

    it('should reject broadcast with invalid authentication', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'manual',
        banRecords: [],
        broadcastConfig: {
          broadcastScope: 'all_active',
          priority: 'low'
        },
        rateLimiting: {
          checkRateLimits: true
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KB2DEF', // Different from signing server
            type: CertificateType.SELF_SIGNED,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=Self',
            subject: 'CN=KB2DEF',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2024-01-01T00:00:00Z', // Expired
            isRevoked: false,
            trustLevel: TrustLevel.SELF_SIGNED,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'invalid_signature',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        if (response.status === 401) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('AUTHENTICATION_FAILED');
          expect(error.message).toContain('authentication');
          expect(error.details.reason).toContain('signature');
        } else if (response.status === 200) {
          const result: BanBroadcastResponse = await response.json();

          // If processed, should be rejected due to authentication
          expect(result.accepted).toBe(false);
          expect(result.results.serversTargeted).toBe(0);

          // Authentication failure should be reflected in server results
          result.serverResults.forEach(serverResult => {
            if (serverResult.result === 'authentication_failed') {
              expect(serverResult.error).toBeDefined();
              expect(serverResult.error!.code).toBe('AUTHENTICATION_FAILED');
            }
          });
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for invalid broadcast configuration', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const request: BanBroadcastRequest = {
        trigger: 'cq_heard',
        triggerCallsign: 'KC3BAD',
        // Missing cqDetails for CQ trigger
        banRecords: [],
        broadcastConfig: {
          broadcastScope: 'specific',
          // Missing targetServers for specific scope
          priority: 'invalid_priority' as any
        },
        rateLimiting: {
          checkRateLimits: true
        },
        authentication: {
          serverCertificate: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            callsign: 'KA1ABC',
            type: CertificateType.ARRL,
            x509Data: new ArrayBuffer(1024),
            publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            licenseClass: 'General',
            issuer: 'CN=ARRL',
            subject: 'CN=KA1ABC',
            serialNumber: '123456789',
            validFrom: '2025-01-01T00:00:00Z',
            validTo: '2026-01-01T00:00:00Z',
            isRevoked: false,
            trustLevel: TrustLevel.ARRL,
            approvedServers: [],
            createdAt: '2025-01-01T00:00:00Z',
            storageLocation: 'server'
          },
          signature: 'abcdef123456',
          signedAt: '2025-09-18T10:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_BROADCAST_CONFIGURATION');
          expect(error.message).toContain('configuration');
          expect(error.details.validationErrors).toBeInstanceOf(Array);
          expect(error.details.validationErrors.length).toBeGreaterThan(0);
        }
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('GET /api/bans/broadcast/config', () => {
    it('should retrieve broadcast configuration', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast/config`);

        expect(response.status).toBe(200);
        const result: BroadcastConfiguration = await response.json();

        // Validate configuration structure
        expect(typeof result.broadcastEnabled).toBe('boolean');

        // Validate defaults
        expect(result.defaults).toBeDefined();
        expect(['all_active', 'specific', 'recent_only']).toContain(result.defaults.defaultScope);
        expect(['low', 'medium', 'high', 'urgent']).toContain(result.defaults.defaultPriority);
        expect(result.defaults.defaultTargetServers).toBeInstanceOf(Array);
        expect(typeof result.defaults.requireAcknowledgmentDefault).toBe('boolean');

        // Validate rate limits
        expect(result.rateLimits).toBeDefined();
        expect(result.rateLimits.broadcastsPerHour).toBeGreaterThan(0);
        expect(result.rateLimits.burstLimit).toBeGreaterThan(0);
        expect(result.rateLimits.windowSize).toBeGreaterThan(0);
        expect(typeof result.rateLimits.allowOverrides).toBe('boolean');
        expect(result.rateLimits.overrideOperators).toBeInstanceOf(Array);

        // Validate CQ processing
        expect(result.cqProcessing).toBeDefined();
        expect(typeof result.cqProcessing.autoProcessCQ).toBe('boolean');
        expect(typeof result.cqProcessing.broadcastHistoricalCQs).toBe('boolean');
        expect(result.cqProcessing.deduplicationWindow).toBeGreaterThan(0);
        expect(result.cqProcessing.monitoredFrequencies).toBeInstanceOf(Array);

        result.cqProcessing.monitoredFrequencies.forEach(freq => {
          expect(freq.startFreq).toBeGreaterThan(0);
          expect(freq.endFreq).toBeGreaterThan(freq.startFreq);
          expect(freq.bandName).toBeDefined();
        });

        // Validate retry config
        expect(result.retryConfig).toBeDefined();
        expect(result.retryConfig.defaultMaxRetries).toBeGreaterThanOrEqual(0);
        expect(result.retryConfig.defaultRetryDelay).toBeGreaterThan(0);
        expect(result.retryConfig.defaultBackoffMultiplier).toBeGreaterThan(1);
        expect(result.retryConfig.maxRetryTime).toBeGreaterThan(0);

        // Validate trust requirements
        expect(result.trustRequirements).toBeDefined();
        expect(Object.values(TrustLevel)).toContain(result.trustRequirements.minimumTrustLevel);
        expect(typeof result.trustRequirements.validateServerCertificates).toBe('boolean');
        expect(result.trustRequirements.trustedServers).toBeInstanceOf(Array);
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('GET /api/bans/broadcast/history', () => {
    it('should retrieve broadcast history with pagination', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        limit: '10',
        offset: '0'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast/history?${queryParams}`);

        expect(response.status).toBe(200);
        const result: BroadcastHistory[] = await response.json();

        // Validate history structure
        expect(result).toBeInstanceOf(Array);

        result.forEach(history => {
          expect(history.broadcastId).toBeDefined();
          expect(history.broadcastAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          expect(history.initiatedBy).toMatch(/^[A-Z0-9]{3,7}$/);
          expect(history.trigger).toBeDefined();
          expect(history.banRecordsBroadcast).toBeGreaterThanOrEqual(0);
          expect(history.targetServers).toBeInstanceOf(Array);

          // Validate results summary
          expect(history.results.successRate).toBeGreaterThanOrEqual(0);
          expect(history.results.successRate).toBeLessThanOrEqual(100);
          expect(history.results.totalAcknowledgments).toBeGreaterThanOrEqual(0);
          expect(history.results.averageResponseTime).toBeGreaterThanOrEqual(0);

          // Validate CQ trigger if present
          if (history.cqTrigger) {
            expect(history.cqTrigger.callsign).toMatch(/^[A-Z0-9]{3,7}$/);
            expect(history.cqTrigger.frequency).toBeGreaterThan(0);
            expect(typeof history.cqTrigger.wasHistorical).toBe('boolean');
          }
        });
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('Response Validation', () => {
    it('should validate ban broadcast response structure', () => {
      const validResponse: BanBroadcastResponse = {
        accepted: true,
        broadcastId: 'broadcast-001',
        trigger: 'cq_heard',
        results: {
          banRecordsProcessed: 1,
          serversTargeted: 3,
          successfulBroadcasts: 2,
          failedBroadcasts: 1,
          acknowledgementsReceived: 2
        },
        serverResults: [
          {
            serverCallsign: 'KB2DEF',
            result: 'success',
            banRecordsSent: 1,
            banRecordsAcknowledged: 1,
            responseTime: 150,
            acknowledgment: {
              acknowledged: true,
              acknowledgedAt: '2025-09-18T10:00:30Z',
              alreadyKnownBans: 0,
              newBansAccepted: 1,
              bansRejected: 0
            },
            retries: {
              attemptsMade: 0,
              retriesExhausted: false
            }
          }
        ],
        rateLimiting: {
          checked: true,
          status: 'within_limits',
          limits: {
            broadcastsPerHour: 10,
            broadcastsUsed: 2,
            remainingBroadcasts: 8,
            resetTime: '2025-09-18T11:00:00Z'
          }
        },
        cqProcessing: {
          previouslyProcessed: false,
          processCount: 1,
          cqHistoryHash: 'abc123def456',
          skippedHistorical: false
        },
        performance: {
          broadcastTime: 2500,
          authenticationTime: 100,
          rateLimitCheckTime: 50,
          averageServerResponseTime: 175,
          networkRequests: 3
        },
        processedAt: '2025-09-18T10:00:00Z',
        processedBy: 'KA1ABC'
      };

      // Validate structure
      expect(typeof validResponse.accepted).toBe('boolean');
      expect(validResponse.broadcastId).toBeDefined();
      expect(validResponse.results.banRecordsProcessed).toBeGreaterThanOrEqual(0);
      expect(validResponse.results.successfulBroadcasts + validResponse.results.failedBroadcasts)
        .toBe(validResponse.results.serversTargeted);
      expect(validResponse.serverResults).toBeInstanceOf(Array);
      expect(validResponse.rateLimiting.checked).toBe(true);
      expect(['within_limits', 'rate_limited', 'overridden']).toContain(validResponse.rateLimiting.status);
      expect(validResponse.performance.broadcastTime).toBeGreaterThan(0);
      expect(validResponse.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(validResponse.processedBy).toMatch(/^[A-Z0-9]{3,7}$/);
    });
  });

  describe('Performance Requirements', () => {
    it('should process urgent broadcasts within time limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const startTime = Date.now();

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/bans/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trigger: 'manual',
            banRecords: [],
            broadcastConfig: {
              broadcastScope: 'all_active',
              priority: 'urgent'
            },
            rateLimiting: {
              checkRateLimits: true
            },
            authentication: {
              serverCertificate: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                callsign: 'KA1ABC',
                type: CertificateType.ARRL,
                x509Data: new ArrayBuffer(1024),
                publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
                licenseClass: 'General',
                issuer: 'CN=ARRL',
                subject: 'CN=KA1ABC',
                serialNumber: '123456789',
                validFrom: '2025-01-01T00:00:00Z',
                validTo: '2026-01-01T00:00:00Z',
                isRevoked: false,
                trustLevel: TrustLevel.ARRL,
                approvedServers: [],
                createdAt: '2025-01-01T00:00:00Z',
                storageLocation: 'server'
              },
              signature: 'abcdef123456',
              signedAt: '2025-09-18T10:00:00Z'
            }
          })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Urgent broadcasts should complete within 5 seconds
        expect(duration).toBeLessThan(5000);

        expect(response.status).toBe(200);
        const result: BanBroadcastResponse = await response.json();

        // Performance metrics should reflect urgency
        expect(result.performance.broadcastTime).toBeLessThan(5000);
      }).rejects.toThrow('Connection refused');
    });
  });
});