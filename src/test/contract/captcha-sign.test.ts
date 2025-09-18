/**
 * Contract Test: CAPTCHA Signing API
 *
 * Tests the HTTP API for signing CAPTCHA solutions with certificates
 * and creating tamper-proof verification records.
 *
 * These tests MUST FAIL initially (TDD Red phase) until the API
 * endpoints and CAPTCHA signing logic are implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SignedCAPTCHASolution,
  CAPTCHAChallenge,
  ChallengeType
} from '../../lib/certificate-management/types.js';

// ==================== Request/Response Types ====================

interface CAPTCHASigningRequest {
  /** Challenge being solved */
  challengeId: string;

  /** Solution details */
  solution: {
    /** The answer provided by user */
    answer: string;
    /** SHA-256 hash of the answer for verification */
    answerHash?: string;
    /** When solution was created (ISO 8601) */
    solvedAt: string;
  };

  /** Signing details */
  signing: {
    /** Callsign of solver */
    solverCallsign: string;
    /** Certificate ID used for signing */
    certificateId: string;
    /** Additional data to include in signature */
    additionalData?: string;
    /** Signature algorithm preference */
    signatureAlgorithm?: 'ECDSA' | 'RSA-PSS';
  };

  /** Context information */
  context?: {
    /** Request ID this signing is for */
    requestId?: string;
    /** Client information */
    clientInfo?: {
      /** IP address */
      ipAddress?: string;
      /** User agent */
      userAgent?: string;
      /** Time zone */
      timeZone?: string;
    };
    /** Verification intent */
    verificationIntent?: 'certificate_request' | 'identity_verification' | 'test';
  };
}

interface CAPTCHASigningResponse {
  /** Created signed solution */
  signedSolution: SignedCAPTCHASolution;

  /** Signing metadata */
  metadata: {
    /** Time taken to sign in milliseconds */
    signingTime: number;
    /** Signature algorithm used */
    algorithmUsed: string;
    /** Key length in bits */
    keyLength: number;
    /** Signature strength score (0-100) */
    signatureStrength: number;
  };

  /** Validation results */
  validation: {
    /** Whether challenge was valid */
    challengeValid: boolean;
    /** Whether certificate was valid */
    certificateValid: boolean;
    /** Whether timing was reasonable */
    timingValid: boolean;
    /** Overall validation score (0-100) */
    validationScore: number;
  };

  /** Compression information */
  compression: {
    /** Original size in bytes */
    originalSize: number;
    /** Compressed size in bytes */
    compressedSize: number;
    /** Compression ratio achieved */
    compressionRatio: number;
    /** Estimated transmission time at 1200 baud */
    transmissionTime: number;
  };
}

interface BulkSigningRequest {
  /** Multiple signing requests */
  signings: CAPTCHASigningRequest[];

  /** Bulk operation metadata */
  metadata: {
    /** Reason for bulk signing */
    bulkReason: string;
    /** Whether to use the same certificate for all */
    uniformCertificate: boolean;
    /** Whether to optimize for batch processing */
    optimizeForBatch: boolean;
  };
}

interface BulkSigningResponse {
  /** Individual signing results */
  results: {
    /** Challenge ID */
    challengeId: string;
    /** Whether signing succeeded */
    success: boolean;
    /** Signed solution if successful */
    signedSolution?: SignedCAPTCHASolution;
    /** Error message if failed */
    error?: string;
  }[];

  /** Bulk operation summary */
  summary: {
    /** Total signings processed */
    totalProcessed: number;
    /** Number of successful signings */
    successCount: number;
    /** Number of failed signings */
    failureCount: number;
    /** Total processing time in milliseconds */
    totalProcessTime: number;
    /** Average signing time */
    averageSigningTime: number;
  };

  /** Aggregate validation */
  aggregateValidation: {
    /** Average validation score */
    averageValidationScore: number;
    /** Percentage of valid challenges */
    challengeValidityRate: number;
    /** Percentage of valid certificates */
    certificateValidityRate: number;
    /** Percentage of valid timing */
    timingValidityRate: number;
  };

  /** Compression statistics */
  compressionStats: {
    /** Total original size in bytes */
    totalOriginalSize: number;
    /** Total compressed size in bytes */
    totalCompressedSize: number;
    /** Average compression ratio */
    averageCompressionRatio: number;
    /** Total estimated transmission time */
    totalTransmissionTime: number;
  };
}

interface SigningHistory {
  /** Historical signing records */
  signings: SignedCAPTCHASolution[];

  /** History metadata */
  metadata: {
    /** Total signings by this solver */
    totalSignings: number;
    /** Average signing time in milliseconds */
    averageSigningTime: number;
    /** Success rate percentage */
    successRate: number;
    /** Most used certificate ID */
    mostUsedCertificate: string;
    /** Average signature strength */
    averageSignatureStrength: number;
  };

  /** Pagination for history */
  pagination: {
    /** Current page number */
    currentPage: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of signings */
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
    /** Signings in last 24 hours */
    last24Hours: number;
    /** Signings in last 7 days */
    last7Days: number;
    /** Signings in last 30 days */
    last30Days: number;
    /** Signings by challenge type */
    byChallengeType: Record<ChallengeType, number>;
    /** Signings by certificate */
    byCertificate: Record<string, number>;
    /** Quality metrics */
    qualityMetrics: {
      /** Average response time in seconds */
      averageResponseTime: number;
      /** Percentage of solutions marked as valid */
      validityRate: number;
      /** Average compression achieved */
      averageCompression: number;
    };
  };
}

interface SignatureVerificationRequest {
  /** Signed solution to verify */
  signedSolutionId: string;

  /** Verification parameters */
  verification?: {
    /** Whether to verify against original challenge */
    verifyChallenge: boolean;
    /** Whether to verify certificate validity */
    verifyCertificate: boolean;
    /** Whether to check signature freshness */
    checkFreshness: boolean;
    /** Maximum age in minutes for freshness check */
    maxAgeMinutes?: number;
  };
}

interface SignatureVerificationResponse {
  /** Verification results */
  verification: {
    /** Whether signature is valid */
    signatureValid: boolean;
    /** Whether challenge verification passed */
    challengeVerificationValid: boolean;
    /** Whether certificate is valid */
    certificateValid: boolean;
    /** Whether timing is within acceptable bounds */
    timingValid: boolean;
    /** Overall verification result */
    overallValid: boolean;
  };

  /** Detailed analysis */
  analysis: {
    /** Signature algorithm detected */
    signatureAlgorithm: string;
    /** Key strength assessment */
    keyStrength: number;
    /** Signature integrity score (0-100) */
    integrityScore: number;
    /** Solution quality assessment */
    solutionQuality: number;
  };

  /** Security assessment */
  security: {
    /** Potential tampering indicators */
    tamperingIndicators: string[];
    /** Risk level assessment */
    riskLevel: 'low' | 'medium' | 'high';
    /** Confidence in verification (0-100) */
    confidence: number;
    /** Recommendations */
    recommendations: string[];
  };

  /** Metadata */
  metadata: {
    /** Verification timestamp */
    verifiedAt: string;
    /** Verifying server */
    verifiedBy: string;
    /** Verification duration in milliseconds */
    verificationDuration: number;
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

describe('CAPTCHA Signing API Contract', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/servers/:serverCallsign/captcha/:challengeId/sign', () => {
    it('should sign CAPTCHA solution with valid certificate', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const signingRequest: CAPTCHASigningRequest = {
        challengeId,
        solution: {
          answer: '4',
          answerHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000',
          signatureAlgorithm: 'ECDSA'
        },
        context: {
          requestId: 'req_550e8400-e29b-41d4-a716-446655440000',
          verificationIntent: 'certificate_request',
          clientInfo: {
            ipAddress: '192.168.1.100',
            userAgent: 'RadioBrowser/1.0',
            timeZone: 'America/New_York'
          }
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signingRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHASigningResponse = await response.json();

        // Validate signed solution
        expect(result.signedSolution.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.signedSolution.challengeId).toBe(challengeId);
        expect(result.signedSolution.answer).toBe('4');
        expect(result.signedSolution.solutionHash).toBe('a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
        expect(result.signedSolution.solvedBy).toBe('KA1ABC');
        expect(result.signedSolution.signingCertificateId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.signedSolution.signature).toBeTruthy();
        expect(result.signedSolution.solvedAt).toBe('2025-01-01T12:00:00Z');
        expect(result.signedSolution.isValid).toBe(true);
        expect(result.signedSolution.compressionSize).toBeGreaterThan(0);

        // Validate metadata
        expect(result.metadata.signingTime).toBeGreaterThan(0);
        expect(result.metadata.algorithmUsed).toBe('ECDSA');
        expect(typeof result.metadata.keyLength).toBe('number');
        expect(result.metadata.signatureStrength).toBeGreaterThanOrEqual(0);
        expect(result.metadata.signatureStrength).toBeLessThanOrEqual(100);

        // Validate validation results
        expect(result.validation.challengeValid).toBe(true);
        expect(result.validation.certificateValid).toBe(true);
        expect(result.validation.timingValid).toBe(true);
        expect(result.validation.validationScore).toBeGreaterThanOrEqual(80);

        // Validate compression
        expect(result.compression.originalSize).toBeGreaterThan(0);
        expect(result.compression.compressedSize).toBeGreaterThan(0);
        expect(result.compression.compressedSize).toBeLessThanOrEqual(result.compression.originalSize);
        expect(result.compression.compressionRatio).toBeGreaterThanOrEqual(1);
        expect(result.compression.transmissionTime).toBeGreaterThan(0);
      }).rejects.toThrow('Connection refused');
    });

    it('should use RSA-PSS algorithm when specified', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const rsaSigningRequest: CAPTCHASigningRequest = {
        challengeId,
        solution: {
          answer: 'B',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000',
          signatureAlgorithm: 'RSA-PSS'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rsaSigningRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHASigningResponse = await response.json();

        expect(result.metadata.algorithmUsed).toBe('RSA-PSS');
        expect(result.metadata.keyLength).toBeGreaterThanOrEqual(2048); // RSA typically uses larger keys
      }).rejects.toThrow('Connection refused');
    });

    it('should include additional data in signature', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const additionalDataRequest: CAPTCHASigningRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000',
          additionalData: 'Emergency certificate request - high priority'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(additionalDataRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHASigningResponse = await response.json();

        // Additional data should affect signature but not be directly visible
        expect(result.signedSolution.signature).toBeTruthy();
        expect(result.metadata.signatureStrength).toBeGreaterThan(70);
      }).rejects.toThrow('Connection refused');
    });

    it('should return 404 for non-existent challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const signingRequest: CAPTCHASigningRequest = {
        challengeId: nonExistentId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${nonExistentId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signingRequest)
        });

        if (response.status === 404) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('CHALLENGE_NOT_FOUND');
          expect(error.message).toContain('not found');
          expect(error.details.challengeId).toBe(nonExistentId);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should return 400 for invalid certificate', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidCertRequest: CAPTCHASigningRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '00000000-0000-0000-0000-000000000000' // Non-existent certificate
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
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

    it('should return 400 for expired challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const expiredChallengeId = '550e8400-e29b-41d4-a716-446655440000';
      const signingRequest: CAPTCHASigningRequest = {
        challengeId: expiredChallengeId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${expiredChallengeId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signingRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('CHALLENGE_EXPIRED');
          expect(error.message).toContain('expired');
          expect(error.details.expirationTime).toBeTruthy();
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate callsign format', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidCallsignRequest: CAPTCHASigningRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'INVALID_CALLSIGN', // Invalid format
          certificateId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
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

    it('should validate signature algorithm', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const invalidAlgorithmRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00Z'
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000',
          signatureAlgorithm: 'INVALID_ALGORITHM'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidAlgorithmRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_SIGNATURE_ALGORITHM');
          expect(error.message).toContain('algorithm');
          expect(error.details.validAlgorithms).toEqual(['ECDSA', 'RSA-PSS']);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should detect suspicious timing patterns', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const challengeId = '550e8400-e29b-41d4-a716-446655440000';
      const suspiciousTimingRequest: CAPTCHASigningRequest = {
        challengeId,
        solution: {
          answer: 'test',
          solvedAt: '2025-01-01T12:00:00.001Z' // Unrealistically fast
        },
        signing: {
          solverCallsign: 'KA1ABC',
          certificateId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/${challengeId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(suspiciousTimingRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHASigningResponse = await response.json();

        // Should flag suspicious timing
        expect(result.validation.timingValid).toBe(false);
        expect(result.validation.validationScore).toBeLessThan(70);
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('POST /api/servers/:serverCallsign/captcha/bulk-sign', () => {
    it('should perform bulk signing of multiple solutions', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const bulkRequest: BulkSigningRequest = {
        signings: [
          {
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            solution: {
              answer: '4',
              solvedAt: '2025-01-01T12:00:00Z'
            },
            signing: {
              solverCallsign: 'KA1ABC',
              certificateId: '123e4567-e89b-12d3-a456-426614174000'
            }
          },
          {
            challengeId: '123e4567-e89b-12d3-a456-426614174000',
            solution: {
              answer: 'B',
              solvedAt: '2025-01-01T12:01:00Z'
            },
            signing: {
              solverCallsign: 'KA1ABC',
              certificateId: '123e4567-e89b-12d3-a456-426614174000'
            }
          }
        ],
        metadata: {
          bulkReason: 'Multiple challenge signing for certificate request',
          uniformCertificate: true,
          optimizeForBatch: true
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkRequest)
        });

        expect(response.status).toBe(201);
        const result: BulkSigningResponse = await response.json();

        expect(result.results).toHaveLength(2);
        expect(result.summary.totalProcessed).toBe(2);
        expect(result.summary.totalProcessTime).toBeGreaterThan(0);
        expect(result.summary.averageSigningTime).toBeGreaterThan(0);

        result.results.forEach(signingResult => {
          expect(['550e8400-e29b-41d4-a716-446655440000', '123e4567-e89b-12d3-a456-426614174000'])
            .toContain(signingResult.challengeId);
          expect(typeof signingResult.success).toBe('boolean');
          if (signingResult.success) {
            expect(signingResult.signedSolution).toBeDefined();
            expect(signingResult.signedSolution!.signature).toBeTruthy();
          }
        });

        // Validate aggregate validation
        expect(result.aggregateValidation.averageValidationScore).toBeGreaterThanOrEqual(0);
        expect(result.aggregateValidation.averageValidationScore).toBeLessThanOrEqual(100);
        expect(result.aggregateValidation.challengeValidityRate).toBeGreaterThanOrEqual(0);
        expect(result.aggregateValidation.challengeValidityRate).toBeLessThanOrEqual(100);

        // Validate compression statistics
        expect(result.compressionStats.totalOriginalSize).toBeGreaterThan(0);
        expect(result.compressionStats.totalCompressedSize).toBeGreaterThan(0);
        expect(result.compressionStats.averageCompressionRatio).toBeGreaterThanOrEqual(1);
        expect(result.compressionStats.totalTransmissionTime).toBeGreaterThan(0);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle partial bulk signing failures', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const mixedBulkRequest: BulkSigningRequest = {
        signings: [
          {
            challengeId: '550e8400-e29b-41d4-a716-446655440000', // Valid
            solution: {
              answer: '4',
              solvedAt: '2025-01-01T12:00:00Z'
            },
            signing: {
              solverCallsign: 'KA1ABC',
              certificateId: '123e4567-e89b-12d3-a456-426614174000'
            }
          },
          {
            challengeId: '00000000-0000-0000-0000-000000000000', // Invalid challenge
            solution: {
              answer: 'test',
              solvedAt: '2025-01-01T12:01:00Z'
            },
            signing: {
              solverCallsign: 'KA1ABC',
              certificateId: '123e4567-e89b-12d3-a456-426614174000'
            }
          }
        ],
        metadata: {
          bulkReason: 'Mixed bulk signing test',
          uniformCertificate: true,
          optimizeForBatch: false
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mixedBulkRequest)
        });

        expect(response.status).toBe(207); // Multi-status
        const result: BulkSigningResponse = await response.json();

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

  describe('GET /api/servers/:serverCallsign/captcha/signings/:solverCallsign', () => {
    it('should list signing history for solver', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/signings/KA1ABC`);

        expect(response.status).toBe(200);
        const history: SigningHistory = await response.json();

        // Validate structure
        expect(history.signings).toBeInstanceOf(Array);
        expect(history.metadata).toBeDefined();
        expect(history.pagination).toBeDefined();
        expect(history.statistics).toBeDefined();

        // Validate metadata
        expect(typeof history.metadata.totalSignings).toBe('number');
        expect(typeof history.metadata.averageSigningTime).toBe('number');
        expect(typeof history.metadata.successRate).toBe('number');
        expect(history.metadata.mostUsedCertificate).toBeTruthy();
        expect(typeof history.metadata.averageSignatureStrength).toBe('number');

        // Validate statistics
        expect(typeof history.statistics.last24Hours).toBe('number');
        expect(typeof history.statistics.last7Days).toBe('number');
        expect(typeof history.statistics.last30Days).toBe('number');

        Object.values(ChallengeType).forEach(type => {
          expect(typeof history.statistics.byChallengeType[type]).toBe('number');
        });

        expect(typeof history.statistics.qualityMetrics.averageResponseTime).toBe('number');
        expect(typeof history.statistics.qualityMetrics.validityRate).toBe('number');
        expect(typeof history.statistics.qualityMetrics.averageCompression).toBe('number');

        // Validate signing records
        history.signings.forEach(signing => {
          expect(signing.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(signing.solvedBy).toBe('KA1ABC');
          expect(signing.signature).toBeTruthy();
          expect(typeof signing.isValid).toBe('boolean');
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should filter signing history by date range', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/signings/KA1ABC?${queryParams}`);

        expect(response.status).toBe(200);
        const history: SigningHistory = await response.json();

        const startDate = new Date('2025-01-01T00:00:00Z');
        const endDate = new Date('2025-01-31T23:59:59Z');

        history.signings.forEach(signing => {
          const signingDate = new Date(signing.solvedAt);
          expect(signingDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
          expect(signingDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
        });
      }).rejects.toThrow('Connection refused');
    });

    it('should filter signing history by certificate', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const queryParams = new URLSearchParams({
        certificate: '123e4567-e89b-12d3-a456-426614174000'
      });

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/signings/KA1ABC?${queryParams}`);

        expect(response.status).toBe(200);
        const history: SigningHistory = await response.json();

        history.signings.forEach(signing => {
          expect(signing.signingCertificateId).toBe('123e4567-e89b-12d3-a456-426614174000');
        });
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('POST /api/servers/:serverCallsign/captcha/verify-signature', () => {
    it('should verify signature of signed solution', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const verificationRequest: SignatureVerificationRequest = {
        signedSolutionId: '550e8400-e29b-41d4-a716-446655440000',
        verification: {
          verifyChallenge: true,
          verifyCertificate: true,
          checkFreshness: true,
          maxAgeMinutes: 60
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verify-signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequest)
        });

        expect(response.status).toBe(200);
        const result: SignatureVerificationResponse = await response.json();

        // Validate verification results
        expect(typeof result.verification.signatureValid).toBe('boolean');
        expect(typeof result.verification.challengeVerificationValid).toBe('boolean');
        expect(typeof result.verification.certificateValid).toBe('boolean');
        expect(typeof result.verification.timingValid).toBe('boolean');
        expect(typeof result.verification.overallValid).toBe('boolean');

        // Validate analysis
        expect(['ECDSA', 'RSA-PSS']).toContain(result.analysis.signatureAlgorithm);
        expect(result.analysis.keyStrength).toBeGreaterThanOrEqual(0);
        expect(result.analysis.integrityScore).toBeGreaterThanOrEqual(0);
        expect(result.analysis.integrityScore).toBeLessThanOrEqual(100);
        expect(result.analysis.solutionQuality).toBeGreaterThanOrEqual(0);
        expect(result.analysis.solutionQuality).toBeLessThanOrEqual(100);

        // Validate security assessment
        expect(result.security.tamperingIndicators).toBeInstanceOf(Array);
        expect(['low', 'medium', 'high']).toContain(result.security.riskLevel);
        expect(result.security.confidence).toBeGreaterThanOrEqual(0);
        expect(result.security.confidence).toBeLessThanOrEqual(100);
        expect(result.security.recommendations).toBeInstanceOf(Array);

        // Validate metadata
        expect(result.metadata.verifiedAt).toBeTruthy();
        expect(result.metadata.verifiedBy).toBe('W1AW');
        expect(result.metadata.verificationDuration).toBeGreaterThan(0);
      }).rejects.toThrow('Connection refused');
    });

    it('should detect tampered signatures', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const tamperedVerificationRequest: SignatureVerificationRequest = {
        signedSolutionId: 'tampered_550e8400-e29b-41d4-a716-446655440000',
        verification: {
          verifyChallenge: true,
          verifyCertificate: true,
          checkFreshness: false
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verify-signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tamperedVerificationRequest)
        });

        expect(response.status).toBe(200);
        const result: SignatureVerificationResponse = await response.json();

        // Should detect tampering
        expect(result.verification.signatureValid).toBe(false);
        expect(result.verification.overallValid).toBe(false);
        expect(result.security.tamperingIndicators.length).toBeGreaterThan(0);
        expect(result.security.riskLevel).toBe('high');
        expect(result.security.confidence).toBeLessThan(50);
      }).rejects.toThrow('Connection refused');
    });

    it('should return 404 for non-existent signed solution', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const nonExistentRequest: SignatureVerificationRequest = {
        signedSolutionId: '00000000-0000-0000-0000-000000000000'
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/verify-signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nonExistentRequest)
        });

        if (response.status === 404) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('SIGNED_SOLUTION_NOT_FOUND');
          expect(error.message).toContain('not found');
          expect(error.details.signedSolutionId).toBe('00000000-0000-0000-0000-000000000000');
        }
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('Performance Requirements', () => {
    it('should sign solutions within time limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const startTime = Date.now();

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/550e8400-e29b-41d4-a716-446655440000/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            solution: {
              answer: '4',
              solvedAt: '2025-01-01T12:00:00Z'
            },
            signing: {
              solverCallsign: 'KA1ABC',
              certificateId: '123e4567-e89b-12d3-a456-426614174000'
            }
          })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Signing should complete within 2 seconds
        expect(duration).toBeLessThan(2000);

        const result: CAPTCHASigningResponse = await response.json();
        expect(result.metadata.signingTime).toBeLessThan(2000);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle bulk signing efficiently', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const bulkRequest: BulkSigningRequest = {
        signings: Array.from({ length: 20 }, (_, i) => ({
          challengeId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
          solution: {
            answer: 'test',
            solvedAt: '2025-01-01T12:00:00Z'
          },
          signing: {
            solverCallsign: 'KA1ABC',
            certificateId: '123e4567-e89b-12d3-a456-426614174000'
          }
        })),
        metadata: {
          bulkReason: 'Performance testing bulk signing',
          uniformCertificate: true,
          optimizeForBatch: true
        }
      };

      await expect(async () => {
        const startTime = Date.now();

        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/bulk-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkRequest)
        });

        const result: BulkSigningResponse = await response.json();
        expect(result.summary.totalProcessTime).toBeLessThan(8000); // 8 seconds
        expect(result.summary.averageSigningTime).toBeLessThan(400); // 400ms per signing
        expect(result.summary.totalProcessed).toBe(20);
      }).rejects.toThrow('Connection refused');
    });

    it('should optimize compression for radio transmission', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/550e8400-e29b-41d4-a716-446655440000/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: '550e8400-e29b-41d4-a716-446655440000',
            solution: {
              answer: '4',
              solvedAt: '2025-01-01T12:00:00Z'
            },
            signing: {
              solverCallsign: 'KA1ABC',
              certificateId: '123e4567-e89b-12d3-a456-426614174000'
            }
          })
        });

        const result: CAPTCHASigningResponse = await response.json();

        // Should be optimized for radio transmission
        expect(result.compression.compressedSize).toBeLessThan(1000); // Under 1KB
        expect(result.compression.transmissionTime).toBeLessThan(15); // Under 15 seconds at 1200 baud
        expect(result.compression.compressionRatio).toBeGreaterThan(1.5); // At least 50% compression
        expect(result.signedSolution.compressionSize).toBe(result.compression.compressedSize);
      }).rejects.toThrow('Connection refused');
    });
  });
});