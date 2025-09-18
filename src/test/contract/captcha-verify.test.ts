/**
 * Contract Test: CAPTCHA Verification API
 *
 * Tests the HTTP API for verifying CAPTCHA challenge solutions
 * and validating human responses in certificate request processes.
 *
 * These tests MUST FAIL initially (TDD Red phase) until the API
 * endpoints and CAPTCHA verification logic are implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CAPTCHAChallenge,
  SignedCAPTCHASolution,
  ChallengeType
} from '../../lib/certificate-management/types.js';

// ==================== Request/Response Types ====================

interface CAPTCHAVerificationRequest {
  /** Challenge being solved */
  challengeId: string;

  /** Submitted solution */
  solution: {
    /** The answer provided by user */
    answer: string;
    /** Callsign of the solver */
    solverCallsign: string;
    /** Certificate ID used for signing */
    signingCertificateId: string;
    /** Time when solution was created */
    solvedAt: string;
  };

  /** Verification context */
  context?: {
    /** Request ID this verification is for */
    requestId?: string;
    /** Client IP address for rate limiting */
    clientIP?: string;
    /** User agent string */
    userAgent?: string;
    /** Time zone of solver */
    timeZone?: string;
  };
}

interface CAPTCHAVerificationResponse {
  /** Verification result */
  verification: {
    /** Whether the solution is correct */
    isValid: boolean;
    /** Confidence score (0-100) */
    confidenceScore: number;
    /** Verification timestamp */
    verifiedAt: string;
    /** Server that performed verification */
    verifiedBy: string;
  };

  /** Created signed solution record */
  signedSolution?: SignedCAPTCHASolution;

  /** Verification metadata */
  metadata: {
    /** Time taken to verify in milliseconds */
    verificationTime: number;
    /** Challenge complexity score */
    challengeComplexity: number;
    /** Solution quality metrics */
    solutionQuality: {
      /** Response time in seconds */
      responseTime: number;
      /** Answer format correctness */
      formatCorrect: boolean;
      /** Answer length appropriateness */
      lengthAppropriate: boolean;
    };
    /** Security validation */
    securityValidation: {
      /** Signature verification status */
      signatureValid: boolean;
      /** Certificate validation status */
      certificateValid: boolean;
      /** Rate limit check status */
      rateLimitPassed: boolean;
      /** Time-based validation */
      timingValid: boolean;
    };
  };

  /** Next steps information */
  nextSteps?: {
    /** Whether solution can be reused */
    canReuse: boolean;
    /** Remaining uses for this solution */
    remainingUses: number;
    /** Instructions for next steps */
    instructions: string;
  };
}

interface BulkVerificationRequest {
  /** Multiple verification requests */
  verifications: CAPTCHAVerificationRequest[];

  /** Bulk verification metadata */
  metadata: {
    /** Reason for bulk verification */
    bulkReason: string;
    /** Whether to stop on first failure */
    stopOnFirstFailure: boolean;
    /** Maximum processing time in seconds */
    maxProcessingTime?: number;
  };
}

interface BulkVerificationResponse {
  /** Individual verification results */
  results: {
    /** Challenge ID */
    challengeId: string;
    /** Whether verification succeeded */
    success: boolean;
    /** Verification result if successful */
    verification?: CAPTCHAVerificationResponse;
    /** Error message if failed */
    error?: string;
  }[];

  /** Bulk operation summary */
  summary: {
    /** Total verifications processed */
    totalProcessed: number;
    /** Number of successful verifications */
    successCount: number;
    /** Number of failed verifications */
    failureCount: number;
    /** Number of valid solutions */
    validSolutionCount: number;
    /** Number of invalid solutions */
    invalidSolutionCount: number;
    /** Total processing time in milliseconds */
    totalProcessTime: number;
    /** Average verification time */
    averageVerificationTime: number;
  };

  /** Aggregate statistics */
  statistics: {
    /** Success rate percentage */
    successRate: number;
    /** Average confidence score */
    averageConfidence: number;
    /** Most common failure reason */
    mostCommonFailure?: string;
    /** Security validation summary */
    securitySummary: {
      /** Signature validation rate */
      signatureValidationRate: number;
      /** Certificate validation rate */
      certificateValidationRate: number;
      /** Rate limit pass rate */
      rateLimitPassRate: number;
    };
  };
}

interface VerificationHistory {
  /** Historical verification records */
  verifications: SignedCAPTCHASolution[];

  /** History metadata */
  metadata: {
    /** Total verifications by this server */
    totalVerifications: number;
    /** Average verification time in milliseconds */
    averageVerificationTime: number;
    /** Success rate percentage */
    successRate: number;
    /** Most active solver callsign */
    mostActiveSolver: string;
  };

  /** Pagination for history */
  pagination: {
    /** Current page number */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of verifications */
    totalCount: number;
    /** Items per page */
    limit: number;
    /** Whether there are more pages */
    hasNext: boolean;
    /** Whether there are previous pages */
    hasPrevious: boolean;
  };

  /** Statistics by time period */
  statistics: {
    /** Verifications in last 24 hours */
    last24Hours: number;
    /** Verifications in last 7 days */
    last7Days: number;
    /** Verifications in last 30 days */
    last30Days: number;
    /** Verifications by challenge type */
    byChallengeType: Record<ChallengeType, number>;
    /** Verifications by result */
    byResult: {
      /** Valid solutions */
      valid: number;
      /** Invalid solutions */
      invalid: number;
      /** Expired challenges */
      expired: number;
      /** Signature failures */
      signatureFailures: number;
    };
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

describe('CAPTCHA Verification API Contract', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/servers/:serverCallsign/captcha/:challengeId/verify', () => {
    it('should verify correct math challenge solution', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const verificationRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: '4',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        context: {
          requestId: 'req_550e8400-e29b-41d4-a716-446655440000',
          clientIP: '192.168.1.100',
          userAgent: 'RadioBrowser/1.0',
          timeZone: 'America/New_York'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequest)
        });

        expect(response.status).toBe(200);
        const result: CAPTCHAVerificationResponse = await response.json();

        // Validate verification result
        expect(result.verification.isValid).toBe(true);
        expect(result.verification.confidenceScore).toBeGreaterThanOrEqual(80);
        expect(result.verification.confidenceScore).toBeLessThanOrEqual(100);
        expect(result.verification.verifiedAt).toBeTruthy();
        expect(result.verification.verifiedBy).toBe('W1AW');

        // Validate signed solution
        expect(result.signedSolution).toBeDefined();
        expect(result.signedSolution!.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.signedSolution!.challengeId).toBe(challengeId);
        expect(result.signedSolution!.answer).toBe('4');
        expect(result.signedSolution!.solvedBy).toBe('KA1ABC');
        expect(result.signedSolution!.signingCertificateId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.signedSolution!.isValid).toBe(true);
        expect(result.signedSolution!.signature).toBeTruthy();

        // Validate metadata
        expect(result.metadata.verificationTime).toBeGreaterThan(0);
        expect(result.metadata.challengeComplexity).toBeGreaterThanOrEqual(0);
        expect(result.metadata.challengeComplexity).toBeLessThanOrEqual(100);

        // Validate solution quality
        expect(typeof result.metadata.solutionQuality.responseTime).toBe('number');
        expect(typeof result.metadata.solutionQuality.formatCorrect).toBe('boolean');
        expect(typeof result.metadata.solutionQuality.lengthAppropriate).toBe('boolean');

        // Validate security validation
        expect(result.metadata.securityValidation.signatureValid).toBe(true);
        expect(result.metadata.securityValidation.certificateValid).toBe(true);
        expect(result.metadata.securityValidation.rateLimitPassed).toBe(true);
        expect(result.metadata.securityValidation.timingValid).toBe(true);

        // Validate next steps
        if (result.nextSteps) {
          expect(typeof result.nextSteps.canReuse).toBe('boolean');
          expect(typeof result.nextSteps.remainingUses).toBe('number');
          expect(result.nextSteps.instructions).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should reject incorrect solution', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const incorrectRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: '5', // Incorrect answer
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incorrectRequest)
        });

        expect(response.status).toBe(200);
        const result: CAPTCHAVerificationResponse = await response.json();

        expect(result.verification.isValid).toBe(false);
        expect(result.verification.confidenceScore).toBeLessThan(50);
        expect(result.signedSolution).toBeUndefined(); // No signed solution for incorrect answer
      }).rejects.toThrow('Connection refused');
    });

    it('should verify multiple choice challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const multipleChoiceRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: 'B', // Multiple choice answer
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(multipleChoiceRequest)
        });

        expect(response.status).toBe(200);
        const result: CAPTCHAVerificationResponse = await response.json();

        // Should handle multiple choice format
        expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(result.signedSolution?.answer);
        expect(result.metadata.solutionQuality.formatCorrect).toBe(true);
      }).rejects.toThrow('Connection refused');
    });

    it('should verify ham knowledge challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const hamKnowledgeRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: 'Part 97',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hamKnowledgeRequest)
        });

        expect(response.status).toBe(200);
        const result: CAPTCHAVerificationResponse = await response.json();

        // Ham knowledge challenges may have higher complexity
        expect(result.metadata.challengeComplexity).toBeGreaterThan(30);
      }).rejects.toThrow('Connection refused');
    });

    it('should return 404 for non-existent challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const verificationRequest: CAPTCHAVerificationRequest = {
        challengeId: nonExistentId,
        solution: {
          answer: 'test',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${nonExistentId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequest)
        });

        if (response.status === 404) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('CHALLENGE_NOT_FOUND');
          expect(error.message).toContain('not found');
          expect(error.details.challengeId).toBe(nonExistentId);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for expired challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const expiredChallengeId = '550e8400-e29b-41d4-a716-446655440000';
      const verificationRequest: CAPTCHAVerificationRequest = {
        challengeId: expiredChallengeId,
        solution: {
          answer: 'test',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${expiredChallengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('CHALLENGE_EXPIRED');
          expect(error.message).toContain('expired');
          expect(error.details.expirationTime).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for already used challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const usedChallengeId = '550e8400-e29b-41d4-a716-446655440000';
      const verificationRequest: CAPTCHAVerificationRequest = {
        challengeId: usedChallengeId,
        solution: {
          answer: 'test',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${usedChallengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('CHALLENGE_ALREADY_USED');
          expect(error.message).toContain('already used');
          expect(error.details.usedBy).toBeInstanceOf(Array);
          expect(error.details.maxUses).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate callsign format', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidCallsignRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solverCallsign: 'INVALID_CALLSIGN', // Invalid format
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidCallsignRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_SOLVER_CALLSIGN');
          expect(error.message).toContain('callsign');
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate certificate existence', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidCertRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '00000000-0000-0000-0000-000000000000', // Non-existent certificate
          solvedAt: '2025-01-01T12:00:00Z'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidCertRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('CERTIFICATE_NOT_FOUND');
          expect(error.message).toContain('certificate');
          expect(error.details.certificateId).toBe('00000000-0000-0000-0000-000000000000');
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should enforce rate limiting', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const verificationRequest: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        context: {
          clientIP: '192.168.1.100'
        }
      };

      await expect(async () => {
        // Simulate rapid requests from same IP
        const requests = Array.from({ length: 10 }, () =>
          fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verificationRequest)
          })
        );

        const responses = await Promise.all(requests);
        const rateLimitedResponse = responses.find(r => r.status === 429);

        if (rateLimitedResponse) {
          const error: ApiError = await rateLimitedResponse.json();
          expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
          expect(error.message).toContain('rate limit');
          expect(error.details.retryAfter).toBeTruthy();
          expect(error.details.limitType).toBe('captcha_verification');
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate solution timing', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const suspiciousTiming: CAPTCHAVerificationRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solverCallsign: 'KA1ABC',
          signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
          solvedAt: '2025-01-01T12:00:00.001Z' // Unrealistically fast solve time
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(suspiciousTiming)
        });

        expect(response.status).toBe(200);
        const result: CAPTCHAVerificationResponse = await response.json();

        // Should flag suspicious timing
        expect(result.metadata.securityValidation.timingValid).toBe(false);
        expect(result.verification.confidenceScore).toBeLessThan(70);
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('POST /api/servers/:serverCallsign/captcha/bulk-verify', () => {
    it('should perform bulk verification of multiple solutions', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const bulkRequest: BulkVerificationRequest = {
        verifications: [
          {
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            solution: {
              answer: '4',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:00:00Z'
            }
          },
          {
            challengeId: '123e4567-e89b-12d3-a456-426614174000',
            solution: {
              answer: 'B',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:01:00Z'
            }
          }
        ],
        metadata: {
          bulkReason: 'Multiple challenge verification for certificate request',
          stopOnFirstFailure: false
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkRequest)
        });

        expect(response.status).toBe(200);
        const result: BulkVerificationResponse = await response.json();

        expect(result.results).toHaveLength(2);
        expect(result.summary.totalProcessed).toBe(2);
        expect(result.summary.totalProcessTime).toBeGreaterThan(0);
        expect(result.summary.averageVerificationTime).toBeGreaterThan(0);

        result.results.forEach(verificationResult => {
          expect(['550e8400-e29b-41d4-a716-446655440000', '123e4567-e89b-12d3-a456-426614174000'])
            .toContain(verificationResult.challengeId);
          expect(typeof verificationResult.success).toBe('boolean');
        });

        // Validate statistics
        expect(result.statistics.successRate).toBeGreaterThanOrEqual(0);
        expect(result.statistics.successRate).toBeLessThanOrEqual(100);
        expect(result.statistics.averageConfidence).toBeGreaterThanOrEqual(0);
        expect(result.statistics.averageConfidence).toBeLessThanOrEqual(100);

        // Validate security summary
        expect(result.statistics.securitySummary.signatureValidationRate).toBeGreaterThanOrEqual(0);
        expect(result.statistics.securitySummary.signatureValidationRate).toBeLessThanOrEqual(100);
        expect(result.statistics.securitySummary.certificateValidationRate).toBeGreaterThanOrEqual(0);
        expect(result.statistics.securitySummary.certificateValidationRate).toBeLessThanOrEqual(100);
        expect(result.statistics.securitySummary.rateLimitPassRate).toBeGreaterThanOrEqual(0);
        expect(result.statistics.securitySummary.rateLimitPassRate).toBeLessThanOrEqual(100);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle partial bulk verification failures', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const mixedBulkRequest: BulkVerificationRequest = {
        verifications: [
          {
            challengeId: '550e8400-e29b-41d4-a716-446655440000', // Valid
            solution: {
              answer: '4',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:00:00Z'
            }
          },
          {
            challengeId: '00000000-0000-0000-0000-000000000000', // Invalid challenge
            solution: {
              answer: 'test',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:01:00Z'
            }
          }
        ],
        metadata: {
          bulkReason: 'Mixed bulk verification test',
          stopOnFirstFailure: false
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mixedBulkRequest)
        });

        expect(response.status).toBe(207); // Multi-status
        const result: BulkVerificationResponse = await response.json();

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

    it('should respect stop on first failure setting', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const stopOnFailureRequest: BulkVerificationRequest = {
        verifications: [
          {
            challengeId: '00000000-0000-0000-0000-000000000000', // Invalid - will fail
            solution: {
              answer: 'test',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:00:00Z'
            }
          },
          {
            challengeId: '550e8400-e29b-41d4-a716-446655440000', // Valid - should not be processed
            solution: {
              answer: '4',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:01:00Z'
            }
          }
        ],
        metadata: {
          bulkReason: 'Stop on failure test',
          stopOnFirstFailure: true
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stopOnFailureRequest)
        });

        expect(response.status).toBe(207);
        const result: BulkVerificationResponse = await response.json();

        // Should stop after first failure
        expect(result.summary.totalProcessed).toBeLessThan(2);
        expect(result.summary.failureCount).toBeGreaterThan(0);
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('GET /api/servers/:serverCallsign/captcha/verifications', () => {
    it('should list verification history with statistics', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verifications`);

        expect(response.status).toBe(200);
        const history: VerificationHistory = await response.json();

        // Validate structure
        expect(history.verifications).toBeInstanceOf(Array);
        expect(history.metadata).toBeDefined();
        expect(history.pagination).toBeDefined();
        expect(history.statistics).toBeDefined();

        // Validate metadata
        expect(typeof history.metadata.totalVerifications).toBe('number');
        expect(typeof history.metadata.averageVerificationTime).toBe('number');
        expect(typeof history.metadata.successRate).toBe('number');
        expect(history.metadata.mostActiveSolver).toBeTruthy();

        // Validate statistics
        expect(typeof history.statistics.last24Hours).toBe('number');
        expect(typeof history.statistics.last7Days).toBe('number');
        expect(typeof history.statistics.last30Days).toBe('number');

        Object.values(ChallengeType).forEach(type => {
          expect(typeof history.statistics.byChallengeType[type]).toBe('number');
        });

        expect(typeof history.statistics.byResult.valid).toBe('number');
        expect(typeof history.statistics.byResult.invalid).toBe('number');
        expect(typeof history.statistics.byResult.expired).toBe('number');
        expect(typeof history.statistics.byResult.signatureFailures).toBe('number');

        // Validate verification records
        history.verifications.forEach(verification => {
          expect(verification.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(verification.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
          expect(verification.solvedBy).toMatch(/^[A-Z0-9]{3,7}$/);
          expect(typeof verification.isValid).toBe('boolean');
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should filter verification history by solver', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        solver: 'KA1ABC'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verifications?${queryParams}`);

        expect(response.status).toBe(200);
        const history: VerificationHistory = await response.json();

        history.verifications.forEach(verification => {
          expect(verification.solvedBy).toBe('KA1ABC');
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should filter verification history by date range', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verifications?${queryParams}`);

        expect(response.status).toBe(200);
        const history: VerificationHistory = await response.json();

        const startDate = new Date('2025-01-01T00:00:00Z');
        const endDate = new Date('2025-01-31T23:59:59Z');

        history.verifications.forEach(verification => {
          if (verification.verifiedAt) {
            const verificationDate = new Date(verification.verifiedAt);
            expect(verificationDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(verificationDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
          }
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should filter verification history by result', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        result: 'valid'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verifications?${queryParams}`);

        expect(response.status).toBe(200);
        const history: VerificationHistory = await response.json();

        history.verifications.forEach(verification => {
          expect(verification.isValid).toBe(true);
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should support pagination for large verification histories', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        page: '2',
        limit: '50'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verifications?${queryParams}`);

        expect(response.status).toBe(200);
        const history: VerificationHistory = await response.json();

        expect(history.pagination.currentPage).toBe(2);
        expect(history.pagination.limit).toBe(50);
        expect(history.verifications.length).toBeLessThanOrEqual(50);

        if (history.pagination.totalPages > 1) {
          expect(history.pagination.hasPrevious).toBe(true);
        }
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('Performance Requirements', () => {
    it('should verify solutions within time limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const startTime = Date.now();

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/550e8400-e29b-41d4-a716-446655440000/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            solution: {
              answer: '4',
              solverCallsign: 'KA1ABC',
              signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
              solvedAt: '2025-01-01T12:00:00Z'
            }
          })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Verification should complete within 1 second
        expect(duration).toBeLessThan(1000);

        const result: CAPTCHAVerificationResponse = await response.json();
        expect(result.metadata.verificationTime).toBeLessThan(1000);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle bulk verification efficiently', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const bulkRequest: BulkVerificationRequest = {
        verifications: Array.from({ length: 25 }, (_, i) => ({
          challengeId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
          solution: {
            answer: 'test',
            solverCallsign: 'KA1ABC',
            signingCertificateId: '123e4567-e89b-12d3-a456-426614174000',
            solvedAt: '2025-01-01T12:00:00Z'
          }
        })),
        metadata: {
          bulkReason: 'Performance testing bulk verification',
          stopOnFirstFailure: false
        }
      };

      await expect(async () => {
        const startTime = Date.now();

        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkRequest)
        });

        const result: BulkVerificationResponse = await response.json();
        expect(result.summary.totalProcessTime).toBeLessThan(5000); // 5 seconds
        expect(result.summary.averageVerificationTime).toBeLessThan(200); // 200ms per verification
        expect(result.summary.totalProcessed).toBe(25);
      }).rejects.toThrow('Connection refused');
    });
  });
});