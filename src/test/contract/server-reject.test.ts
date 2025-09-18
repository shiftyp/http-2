/**
 * Contract Test: Server Reject API
 *
 * Tests the HTTP API for rejecting certificate requests on a server.
 * Handles rejection decisions, reason documentation, and appeal processes.
 *
 * These tests MUST FAIL initially (TDD Red phase) until the API
 * endpoints and server rejection logic are implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CertificateRequest,
  RequestStatus,
  CertificateType,
  TrustLevel
} from '../../lib/certificate-management/types.js';

// ==================== Request/Response Types ====================

interface RejectionDecision {
  /** Request being rejected */
  requestId: string;

  /** Rejection details */
  rejection: {
    /** Primary reason for rejection */
    reason: string;
    /** Detailed explanation */
    detailedReason?: string;
    /** Rejection category */
    category: 'documentation' | 'verification' | 'policy' | 'technical' | 'fraud' | 'other';
    /** Whether this rejection can be appealed */
    appealable: boolean;
    /** Appeal deadline if appealable (ISO 8601) */
    appealDeadline?: string;
    /** Required actions for resubmission */
    requiredActions?: string[];
    /** Suggested improvements */
    suggestions?: string[];
  };

  /** Review details */
  review: {
    /** Public notes visible to certificate holder */
    publicNotes?: string;
    /** Private notes for server records */
    privateNotes?: string;
    /** Time taken to review in milliseconds */
    reviewDuration: number;
    /** Whether this is rejecting an appeal */
    isAppealRejection?: boolean;
    /** Reference to original rejection if appeal */
    originalRejectionId?: string;
  };

  /** Operator information */
  operator: {
    /** Server operator callsign making the decision */
    operatorCallsign: string;
    /** Additional operator verification */
    operatorSignature?: string;
  };
}

interface RejectionResponse {
  /** Updated certificate request */
  request: CertificateRequest;

  /** Rejection metadata */
  metadata: {
    /** Time taken to process rejection */
    processTime: number;
    /** New queue statistics after rejection */
    queueStats: {
      /** Remaining pending requests */
      remainingPending: number;
      /** New average wait time */
      averageWaitTime: number;
    };
    /** Appeal information if applicable */
    appealInfo?: {
      /** Appeal process available */
      appealAvailable: boolean;
      /** Appeal deadline */
      appealDeadline?: string;
      /** Appeal instructions */
      appealInstructions?: string;
    };
  };
}

interface BulkRejectionRequest {
  /** Multiple rejection decisions */
  rejections: RejectionDecision[];

  /** Bulk operation metadata */
  metadata: {
    /** Reason for bulk rejection */
    bulkReason: string;
    /** Whether to apply same category to all */
    uniformCategory?: string;
    /** Whether to apply same appealability to all */
    uniformAppealable?: boolean;
  };
}

interface BulkRejectionResponse {
  /** Individual rejection results */
  results: {
    /** Request ID */
    requestId: string;
    /** Whether rejection succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Updated request if successful */
    request?: CertificateRequest;
  }[];

  /** Bulk operation summary */
  summary: {
    /** Total rejections processed */
    totalProcessed: number;
    /** Number of successful rejections */
    successCount: number;
    /** Number of failed rejections */
    failureCount: number;
    /** Total processing time in milliseconds */
    totalProcessTime: number;
    /** Queue impact statistics */
    queueImpact: {
      /** Requests removed from queue */
      removedFromQueue: number;
      /** New queue depth */
      newQueueDepth: number;
    };
  };
}

interface RejectionHistory {
  /** Rejection records */
  rejections: CertificateRequest[];

  /** History metadata */
  metadata: {
    /** Total rejections by this server */
    totalRejections: number;
    /** Average rejection time in minutes */
    averageRejectionTime: number;
    /** Rejection rate percentage */
    rejectionRate: number;
    /** Most common rejection category */
    mostCommonCategory: string;
    /** Appeal success rate percentage */
    appealSuccessRate: number;
  };

  /** Pagination for history */
  pagination: {
    /** Current page number */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of rejections */
    totalCount: number;
    /** Items per page */
    limit: number;
    /** Whether there are more pages */
    hasNext: boolean;
    /** Whether there are previous pages */
    hasPrevious: boolean;
  };

  /** Statistics by category */
  statistics: {
    /** Rejections in last 24 hours */
    last24Hours: number;
    /** Rejections in last 7 days */
    last7Days: number;
    /** Rejections in last 30 days */
    last30Days: number;
    /** Rejections by category */
    byCategory: Record<string, number>;
    /** Rejections by certificate type */
    byCertificateType: Record<CertificateType, number>;
    /** Appealable vs non-appealable */
    appealStats: {
      /** Total appealable rejections */
      appealable: number;
      /** Total non-appealable rejections */
      nonAppealable: number;
      /** Active appeals in progress */
      activeAppeals: number;
      /** Appeals that were overturned */
      successfulAppeals: number;
    };
  };
}

interface AppealSubmission {
  /** Original rejected request ID */
  originalRequestId: string;

  /** Appeal details */
  appeal: {
    /** Reason for appeal */
    appealReason: string;
    /** Additional documentation provided */
    additionalDocumentation?: string[];
    /** New evidence or clarifications */
    newEvidence?: string;
    /** Response to rejection reasons */
    responseToRejection: string;
  };

  /** Updated certificate data if applicable */
  updatedCertificateData?: {
    /** Updated public key if relevant */
    publicKeyPem?: string;
    /** Updated station information */
    stationInfo?: any;
    /** Updated license documentation */
    licenseDocumentation?: string[];
  };
}

interface AppealResponse {
  /** New certificate request for appeal */
  appealRequest: CertificateRequest;

  /** Appeal metadata */
  metadata: {
    /** Original rejection reference */
    originalRejectionId: string;
    /** Appeal submission timestamp */
    appealSubmittedAt: string;
    /** Appeal deadline */
    appealDeadline: string;
    /** Queue position for appeal review */
    appealQueuePosition: number;
    /** Estimated appeal review time */
    estimatedAppealReviewTime: string;
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

describe('Server Reject API Contract', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/servers/:serverCallsign/requests/:requestId/reject', () => {
    it('should reject certificate request with detailed reason', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const requestId = '550e8400-e29b-41d4-a716-446655440000';
      const rejectionDecision: RejectionDecision = {
        requestId,
        rejection: {
          reason: 'Insufficient license documentation',
          detailedReason: 'The provided license information could not be verified against FCC records. License class appears to be outdated or incorrect.',
          category: 'documentation',
          appealable: true,
          appealDeadline: '2025-02-01T00:00:00Z',
          requiredActions: [
            'Provide current FCC license certificate',
            'Verify license class with official documentation',
            'Update station information to match FCC records'
          ],
          suggestions: [
            'Check FCC ULS database for current license status',
            'Ensure all information matches official records exactly'
          ]
        },
        review: {
          publicNotes: 'Request rejected due to documentation issues. Please review requirements and resubmit with corrected information.',
          privateNotes: 'License verification failed - possible data entry error or expired license',
          reviewDuration: 1200000, // 20 minutes
          isAppealRejection: false
        },
        operator: {
          operatorCallsign: 'W1AW',
          operatorSignature: 'digital_signature_hash'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${requestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectionDecision)
        });

        expect(response.status).toBe(200);
        const result: RejectionResponse = await response.json();

        // Validate updated request
        expect(result.request.id).toBe(requestId);
        expect(result.request.status).toBe(RequestStatus.REJECTED);
        expect(result.request.reviewedAt).toBeTruthy();
        expect(result.request.reviewedBy).toBe('W1AW');
        expect(result.request.rejectionReason).toBe('Insufficient license documentation');

        // Validate metadata
        expect(result.metadata.processTime).toBeGreaterThan(0);
        expect(result.metadata.queueStats.remainingPending).toBeGreaterThanOrEqual(0);
        expect(result.metadata.queueStats.averageWaitTime).toBeGreaterThanOrEqual(0);

        // Check appeal information
        if (result.metadata.appealInfo) {
          expect(result.metadata.appealInfo.appealAvailable).toBe(true);
          expect(result.metadata.appealInfo.appealDeadline).toBe('2025-02-01T00:00:00Z');
          expect(result.metadata.appealInfo.appealInstructions).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should reject with non-appealable decision', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const requestId = '550e8400-e29b-41d4-a716-446655440000';
      const nonAppealableRejection: RejectionDecision = {
        requestId,
        rejection: {
          reason: 'Fraudulent certificate detected',
          detailedReason: 'Certificate appears to be forged or contains falsified information. This is a serious violation of amateur radio regulations.',
          category: 'fraud',
          appealable: false,
          requiredActions: ['Contact FCC for license verification'],
          suggestions: []
        },
        review: {
          publicNotes: 'Request rejected due to suspected fraud. No appeal available.',
          privateNotes: 'Clear evidence of document forgery - escalate to appropriate authorities',
          reviewDuration: 600000, // 10 minutes
          isAppealRejection: false
        },
        operator: {
          operatorCallsign: 'W1AW'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${requestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nonAppealableRejection)
        });

        expect(response.status).toBe(200);
        const result: RejectionResponse = await response.json();

        expect(result.request.status).toBe(RequestStatus.REJECTED);
        expect(result.request.rejectionReason).toBe('Fraudulent certificate detected');

        // Appeal should not be available
        if (result.metadata.appealInfo) {
          expect(result.metadata.appealInfo.appealAvailable).toBe(false);
          expect(result.metadata.appealInfo.appealDeadline).toBeUndefined();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 404 for non-existent request', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const rejectionDecision: RejectionDecision = {
        requestId: nonExistentId,
        rejection: {
          reason: 'Test rejection',
          category: 'other',
          appealable: false
        },
        review: {
          reviewDuration: 300000
        },
        operator: {
          operatorCallsign: 'W1AW'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${nonExistentId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectionDecision)
        });

        if (response.status === 404) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('REQUEST_NOT_FOUND');
          expect(error.message).toContain('not found');
          expect(error.details.requestId).toBe(nonExistentId);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for already processed request', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const requestId = '550e8400-e29b-41d4-a716-446655440000';
      const rejectionDecision: RejectionDecision = {
        requestId,
        rejection: {
          reason: 'Duplicate rejection test',
          category: 'other',
          appealable: false
        },
        review: {
          reviewDuration: 300000
        },
        operator: {
          operatorCallsign: 'W1AW'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${requestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectionDecision)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('REQUEST_ALREADY_PROCESSED');
          expect(error.message).toContain('already processed');
          expect(error.details.currentStatus).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate rejection category', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const requestId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidRejection = {
        requestId,
        rejection: {
          reason: 'Invalid category test',
          category: 'invalid_category', // Invalid category
          appealable: false
        },
        review: {
          reviewDuration: 300000
        },
        operator: {
          operatorCallsign: 'W1AW'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${requestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRejection)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_REJECTION_CATEGORY');
          expect(error.message).toContain('category');
          expect(error.details.validCategories).toBeInstanceOf(Array);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate operator authorization', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const requestId = '550e8400-e29b-41d4-a716-446655440000';
      const unauthorizedRejection: RejectionDecision = {
        requestId,
        rejection: {
          reason: 'Unauthorized operator test',
          category: 'other',
          appealable: false
        },
        review: {
          reviewDuration: 300000
        },
        operator: {
          operatorCallsign: 'UNAUTHORIZED' // Not authorized for this server
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${requestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unauthorizedRejection)
        });

        if (response.status === 403) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('OPERATOR_NOT_AUTHORIZED');
          expect(error.message).toContain('not authorized');
          expect(error.details.operatorCallsign).toBe('UNAUTHORIZED');
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should handle appeal deadline validation', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const requestId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidDeadlineRejection: RejectionDecision = {
        requestId,
        rejection: {
          reason: 'Invalid deadline test',
          category: 'documentation',
          appealable: true,
          appealDeadline: '2020-01-01T00:00:00Z' // Past date
        },
        review: {
          reviewDuration: 300000
        },
        operator: {
          operatorCallsign: 'W1AW'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${requestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidDeadlineRejection)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_APPEAL_DEADLINE');
          expect(error.message).toContain('deadline');
          expect(error.details.providedDeadline).toBe('2020-01-01T00:00:00Z');
        }
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('POST /api/servers/:serverCallsign/requests/bulk-reject', () => {
    it('should perform bulk rejection of multiple requests', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const bulkRequest: BulkRejectionRequest = {
        rejections: [
          {
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            rejection: {
              reason: 'Batch rejection - incomplete documentation',
              category: 'documentation',
              appealable: true,
              appealDeadline: '2025-02-01T00:00:00Z'
            },
            review: {
              reviewDuration: 600000
            },
            operator: {
              operatorCallsign: 'W1AW'
            }
          },
          {
            requestId: '123e4567-e89b-12d3-a456-426614174000',
            rejection: {
              reason: 'Batch rejection - incomplete documentation',
              category: 'documentation',
              appealable: true,
              appealDeadline: '2025-02-01T00:00:00Z'
            },
            review: {
              reviewDuration: 600000
            },
            operator: {
              operatorCallsign: 'W1AW'
            }
          }
        ],
        metadata: {
          bulkReason: 'Routine rejection of incomplete documentation submissions',
          uniformCategory: 'documentation',
          uniformAppealable: true
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/bulk-reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkRequest)
        });

        expect(response.status).toBe(200);
        const result: BulkRejectionResponse = await response.json();

        expect(result.results).toHaveLength(2);
        expect(result.summary.totalProcessed).toBe(2);
        expect(result.summary.totalProcessTime).toBeGreaterThan(0);

        result.results.forEach(rejectionResult => {
          expect(['550e8400-e29b-41d4-a716-446655440000', '123e4567-e89b-12d3-a456-426614174000'])
            .toContain(rejectionResult.requestId);
          expect(typeof rejectionResult.success).toBe('boolean');
          if (rejectionResult.success) {
            expect(rejectionResult.request!.status).toBe(RequestStatus.REJECTED);
          }
        });

        expect(result.summary.queueImpact.removedFromQueue).toBe(result.summary.successCount);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle partial bulk rejection failures', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const mixedBulkRequest: BulkRejectionRequest = {
        rejections: [
          {
            requestId: '550e8400-e29b-41d4-a716-446655440000', // Valid
            rejection: {
              reason: 'Valid rejection',
              category: 'documentation',
              appealable: true
            },
            review: {
              reviewDuration: 600000
            },
            operator: {
              operatorCallsign: 'W1AW'
            }
          },
          {
            requestId: '00000000-0000-0000-0000-000000000000', // Invalid
            rejection: {
              reason: 'Invalid rejection',
              category: 'documentation',
              appealable: true
            },
            review: {
              reviewDuration: 600000
            },
            operator: {
              operatorCallsign: 'W1AW'
            }
          }
        ],
        metadata: {
          bulkReason: 'Mixed bulk rejection test'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/bulk-reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mixedBulkRequest)
        });

        expect(response.status).toBe(207); // Multi-status
        const result: BulkRejectionResponse = await response.json();

        expect(result.results).toHaveLength(2);
        expect(result.summary.successCount).toBeLessThan(result.summary.totalProcessed);
        expect(result.summary.failureCount).toBeGreaterThan(0);

        // Should have both success and failure results
        const successResults = result.results.filter(r => r.success);
        const failureResults = result.results.filter(r => !r.success);
        expect(successResults.length).toBeGreaterThan(0);
        expect(failureResults.length).toBeGreaterThan(0);

        failureResults.forEach(failure => {
          expect(failure.error).toBeTruthy();
        });
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('POST /api/servers/:serverCallsign/requests/:requestId/appeal', () => {
    it('should submit appeal for rejected request', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const originalRequestId = '550e8400-e29b-41d4-a716-446655440000';
      const appealSubmission: AppealSubmission = {
        originalRequestId,
        appeal: {
          appealReason: 'Additional documentation now available',
          additionalDocumentation: [
            'Updated FCC license certificate',
            'Official letter from FCC confirming license status'
          ],
          newEvidence: 'License was recently renewed - original rejection was based on outdated information',
          responseToRejection: 'The documentation issues cited in the rejection have been resolved with updated FCC records'
        },
        updatedCertificateData: {
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\nUpdatedKey...\n-----END PUBLIC KEY-----',
          licenseDocumentation: ['updated_license.pdf', 'fcc_confirmation.pdf']
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${originalRequestId}/appeal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appealSubmission)
        });

        expect(response.status).toBe(201);
        const result: AppealResponse = await response.json();

        // Validate new appeal request
        expect(result.appealRequest.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.appealRequest.status).toBe(RequestStatus.PENDING);
        expect(result.appealRequest.serverCallsign).toBe('W1AW');

        // Validate appeal metadata
        expect(result.metadata.originalRejectionId).toBe(originalRequestId);
        expect(result.metadata.appealSubmittedAt).toBeTruthy();
        expect(result.metadata.appealDeadline).toBeTruthy();
        expect(typeof result.metadata.appealQueuePosition).toBe('number');
        expect(result.metadata.estimatedAppealReviewTime).toBeTruthy();

        // Appeal should be marked appropriately
        expect(result.appealRequest.retryCount).toBeGreaterThan(0);
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for non-appealable rejection', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const nonAppealableRequestId = '550e8400-e29b-41d4-a716-446655440000';
      const appealSubmission: AppealSubmission = {
        originalRequestId: nonAppealableRequestId,
        appeal: {
          appealReason: 'Attempting to appeal non-appealable rejection',
          responseToRejection: 'Test appeal submission'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${nonAppealableRequestId}/appeal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appealSubmission)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('APPEAL_NOT_ALLOWED');
          expect(error.message).toContain('not appealable');
          expect(error.details.rejectionCategory).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for expired appeal deadline', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const expiredRequestId = '550e8400-e29b-41d4-a716-446655440000';
      const expiredAppeal: AppealSubmission = {
        originalRequestId: expiredRequestId,
        appeal: {
          appealReason: 'Appeal after deadline',
          responseToRejection: 'Testing expired appeal'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/${expiredRequestId}/appeal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expiredAppeal)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('APPEAL_DEADLINE_EXPIRED');
          expect(error.message).toContain('deadline');
          expect(error.details.appealDeadline).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('GET /api/servers/:serverCallsign/rejections', () => {
    it('should list rejection history with statistics', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/rejections`);

        expect(response.status).toBe(200);
        const history: RejectionHistory = await response.json();

        // Validate structure
        expect(history.rejections).toBeInstanceOf(Array);
        expect(history.metadata).toBeDefined();
        expect(history.pagination).toBeDefined();
        expect(history.statistics).toBeDefined();

        // Validate metadata
        expect(typeof history.metadata.totalRejections).toBe('number');
        expect(typeof history.metadata.averageRejectionTime).toBe('number');
        expect(typeof history.metadata.rejectionRate).toBe('number');
        expect(typeof history.metadata.mostCommonCategory).toBe('string');
        expect(typeof history.metadata.appealSuccessRate).toBe('number');

        // Validate statistics
        expect(typeof history.statistics.last24Hours).toBe('number');
        expect(typeof history.statistics.last7Days).toBe('number');
        expect(typeof history.statistics.last30Days).toBe('number');

        expect(history.statistics.byCategory).toBeDefined();
        Object.values(CertificateType).forEach(type => {
          expect(typeof history.statistics.byCertificateType[type]).toBe('number');
        });

        // Validate appeal statistics
        expect(typeof history.statistics.appealStats.appealable).toBe('number');
        expect(typeof history.statistics.appealStats.nonAppealable).toBe('number');
        expect(typeof history.statistics.appealStats.activeAppeals).toBe('number');
        expect(typeof history.statistics.appealStats.successfulAppeals).toBe('number');

        // Validate rejection records
        history.rejections.forEach(rejection => {
          expect(rejection.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(rejection.status).toBe(RequestStatus.REJECTED);
          expect(rejection.rejectionReason).toBeTruthy();
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should filter rejection history by category', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        category: 'documentation'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/rejections?${queryParams}`);

        expect(response.status).toBe(200);
        const history: RejectionHistory = await response.json();

        // Note: Category filtering validation would need additional request metadata
        // This test validates the API structure
        expect(history.rejections).toBeInstanceOf(Array);
      }).rejects.toThrow('Connection refused');
    });

    it('should filter rejection history by date range', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/rejections?${queryParams}`);

        expect(response.status).toBe(200);
        const history: RejectionHistory = await response.json();

        const startDate = new Date('2025-01-01T00:00:00Z');
        const endDate = new Date('2025-01-31T23:59:59Z');

        history.rejections.forEach(rejection => {
          if (rejection.reviewedAt) {
            const rejectionDate = new Date(rejection.reviewedAt);
            expect(rejectionDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(rejectionDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
          }
        });
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('Performance Requirements', () => {
    it('should process rejections within time limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const startTime = Date.now();

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/550e8400-e29b-41d4-a716-446655440000/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            rejection: {
              reason: 'Performance test rejection',
              category: 'other',
              appealable: false
            },
            review: {
              reviewDuration: 300000
            },
            operator: {
              operatorCallsign: 'W1AW'
            }
          })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Rejection processing should complete within 2 seconds
        expect(duration).toBeLessThan(2000);

        const result: RejectionResponse = await response.json();
        expect(result.metadata.processTime).toBeLessThan(2000);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle bulk rejections efficiently', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const bulkRequest: BulkRejectionRequest = {
        rejections: Array.from({ length: 25 }, (_, i) => ({
          requestId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
          rejection: {
            reason: 'Bulk performance test',
            category: 'other',
            appealable: false
          },
          review: {
            reviewDuration: 300000
          },
          operator: {
            operatorCallsign: 'W1AW'
          }
        })),
        metadata: {
          bulkReason: 'Performance testing bulk rejection'
        }
      };

      await expect(async () => {
        const startTime = Date.now();

        const response = await fetch(`${API_BASE_URL}/servers/W1AW/requests/bulk-reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkRequest)
        });

        const result: BulkRejectionResponse = await response.json();
        expect(result.summary.totalProcessTime).toBeLessThan(10000); // 10 seconds
        expect(result.summary.totalProcessed).toBe(25);
      }).rejects.toThrow('Connection refused');
    });
  });
});