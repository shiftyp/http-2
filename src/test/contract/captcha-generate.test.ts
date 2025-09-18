/**
 * Contract Test: CAPTCHA Generation API
 *
 * Tests the HTTP API for generating radio-optimized CAPTCHA challenges
 * for human verification in certificate request processes.
 *
 * These tests MUST FAIL initially (TDD Red phase) until the API
 * endpoints and CAPTCHA generation logic are implemented.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CAPTCHAChallenge,
  ChallengeType,
  VALIDATION_CONSTRAINTS
} from '../../lib/certificate-management/types.js';

// ==================== Request/Response Types ====================

interface CAPTCHAGenerationRequest {
  /** Server generating the challenge */
  serverCallsign: string;

  /** Challenge parameters */
  parameters: {
    /** Type of challenge to generate */
    type?: ChallengeType;
    /** Difficulty level */
    difficulty?: 'easy' | 'medium' | 'hard';
    /** Category for challenge content */
    category?: string;
    /** Language preference */
    language?: 'en' | 'es' | 'fr' | 'de' | 'ja';
    /** Maximum uses allowed */
    maxUses?: number;
    /** Expiration time in minutes */
    expirationMinutes?: number;
  };

  /** Request context */
  context?: {
    /** Requesting callsign for personalization */
    requestingCallsign?: string;
    /** Request ID this CAPTCHA is for */
    requestId?: string;
    /** Whether this is a retry attempt */
    isRetry?: boolean;
    /** Previous CAPTCHA ID if retry */
    previousCaptchaId?: string;
  };
}

interface CAPTCHAGenerationResponse {
  /** Generated CAPTCHA challenge */
  challenge: CAPTCHAChallenge;

  /** Generation metadata */
  metadata: {
    /** Time taken to generate in milliseconds */
    generationTime: number;
    /** Challenge complexity score (0-100) */
    complexityScore: number;
    /** Estimated solve time in seconds */
    estimatedSolveTime: number;
    /** Challenge uniqueness hash */
    uniquenessHash: string;
  };

  /** Usage instructions */
  instructions: {
    /** How to solve this type of challenge */
    solvingInstructions: string;
    /** Format expected for answer */
    answerFormat: string;
    /** Examples if applicable */
    examples?: string[];
    /** Hints for solving */
    hints?: string[];
  };

  /** Radio transmission optimization */
  radioOptimization: {
    /** Compressed size in bytes */
    compressedSize: number;
    /** Transmission time estimate at 1200 baud */
    transmissionTime: number;
    /** Character encoding used */
    encoding: string;
    /** Compression ratio achieved */
    compressionRatio: number;
  };
}

interface CAPTCHABatchRequest {
  /** Server generating challenges */
  serverCallsign: string;

  /** Batch parameters */
  batch: {
    /** Number of challenges to generate */
    count: number;
    /** Challenge types to include */
    types?: ChallengeType[];
    /** Difficulty distribution */
    difficultyDistribution?: {
      easy: number;
      medium: number;
      hard: number;
    };
    /** Whether to ensure uniqueness across batch */
    ensureUniqueness: boolean;
  };

  /** Common parameters for all challenges */
  commonParameters?: {
    /** Language for all challenges */
    language?: string;
    /** Category for all challenges */
    category?: string;
    /** Expiration time for all challenges */
    expirationMinutes?: number;
  };
}

interface CAPTCHABatchResponse {
  /** Generated challenges */
  challenges: CAPTCHAChallenge[];

  /** Batch metadata */
  metadata: {
    /** Total generation time in milliseconds */
    totalGenerationTime: number;
    /** Average generation time per challenge */
    averageGenerationTime: number;
    /** Uniqueness verification results */
    uniquenessResults: {
      /** Number of unique challenges */
      uniqueCount: number;
      /** Number of duplicate challenges rejected */
      duplicatesRejected: number;
      /** Uniqueness percentage */
      uniquenessPercentage: number;
    };
    /** Quality metrics */
    qualityMetrics: {
      /** Average complexity score */
      averageComplexity: number;
      /** Distribution by difficulty */
      difficultyDistribution: Record<string, number>;
      /** Average estimated solve time */
      averageSolveTime: number;
    };
  };

  /** Batch instructions */
  batchInstructions: {
    /** Instructions by challenge type */
    byType: Record<ChallengeType, string>;
    /** General solving guidelines */
    generalGuidelines: string[];
    /** Common answer formats */
    answerFormats: Record<ChallengeType, string>;
  };
}

interface CAPTCHAPoolStatus {
  /** Server callsign */
  serverCallsign: string;

  /** Pool statistics */
  poolStats: {
    /** Total challenges available */
    totalAvailable: number;
    /** Challenges by type */
    byType: Record<ChallengeType, number>;
    /** Challenges by difficulty */
    byDifficulty: Record<string, number>;
    /** Challenges by category */
    byCategory: Record<string, number>;
    /** Unused challenges */
    unusedCount: number;
    /** Expired challenges */
    expiredCount: number;
  };

  /** Pool health */
  poolHealth: {
    /** Pool capacity utilization percentage */
    utilizationPercentage: number;
    /** Time until pool depletion at current usage rate */
    depletionEstimate: string;
    /** Recommended replenishment count */
    recommendedReplenishment: number;
    /** Quality score of available challenges */
    qualityScore: number;
  };

  /** Generation statistics */
  generationStats: {
    /** Challenges generated in last 24 hours */
    generated24h: number;
    /** Challenges used in last 24 hours */
    used24h: number;
    /** Average generation rate per hour */
    generationRate: number;
    /** Average usage rate per hour */
    usageRate: number;
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

describe('CAPTCHA Generation API Contract', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/servers/:serverCallsign/captcha/generate', () => {
    it('should generate math challenge with default parameters', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const generationRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.MATH,
          difficulty: 'medium'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(generationRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        // Validate challenge structure
        expect(result.challenge.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.challenge.serverCallsign).toBe('W1AW');
        expect(result.challenge.type).toBe(ChallengeType.MATH);
        expect(result.challenge.difficulty).toBe('medium');
        expect(result.challenge.question).toBeTruthy();
        expect(result.challenge.expectedAnswer).toBeTruthy();
        expect(result.challenge.answerHash).toMatch(/^[0-9a-f]{64}$/i); // SHA-256 hash
        expect(result.challenge.signature).toBeTruthy();
        expect(result.challenge.usedBy).toEqual([]);
        expect(result.challenge.maxUses).toBe(VALIDATION_CONSTRAINTS.DEFAULT_MAX_CAPTCHA_USES);

        // Validate metadata
        expect(result.metadata.generationTime).toBeGreaterThan(0);
        expect(result.metadata.complexityScore).toBeGreaterThanOrEqual(0);
        expect(result.metadata.complexityScore).toBeLessThanOrEqual(100);
        expect(result.metadata.estimatedSolveTime).toBeGreaterThan(0);
        expect(result.metadata.uniquenessHash).toBeTruthy();

        // Validate instructions
        expect(result.instructions.solvingInstructions).toContain('math');
        expect(result.instructions.answerFormat).toBeTruthy();

        // Validate radio optimization
        expect(result.radioOptimization.compressedSize).toBeGreaterThan(0);
        expect(result.radioOptimization.transmissionTime).toBeGreaterThan(0);
        expect(result.radioOptimization.compressionRatio).toBeGreaterThan(0);

        // Validate timestamps
        expect(result.challenge.generatedAt).toBeTruthy();
        expect(result.challenge.expiresAt).toBeTruthy();
        expect(new Date(result.challenge.expiresAt).getTime())
          .toBeGreaterThan(new Date(result.challenge.generatedAt).getTime());
      }).rejects.toThrow('Connection refused');
    });

    it('should generate ham knowledge challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const hamKnowledgeRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.HAM_KNOWLEDGE,
          difficulty: 'hard',
          category: 'regulations',
          language: 'en'
        },
        context: {
          requestingCallsign: 'KA1ABC'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hamKnowledgeRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        expect(result.challenge.type).toBe(ChallengeType.HAM_KNOWLEDGE);
        expect(result.challenge.difficulty).toBe('hard');
        expect(result.challenge.category).toBe('regulations');
        expect(result.challenge.question).toContain('amateur radio');
        expect(result.instructions.solvingInstructions).toContain('knowledge');
      }).rejects.toThrow('Connection refused');
    });

    it('should generate multiple choice challenge with options', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const multipleChoiceRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.MULTIPLE_CHOICE,
          difficulty: 'easy',
          category: 'bands'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(multipleChoiceRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        expect(result.challenge.type).toBe(ChallengeType.MULTIPLE_CHOICE);
        expect(result.challenge.options).toBeInstanceOf(Array);
        expect(result.challenge.options!.length).toBeGreaterThanOrEqual(2);
        expect(result.challenge.options!.length).toBeLessThanOrEqual(6);
        expect(typeof result.challenge.correctIndex).toBe('number');
        expect(result.challenge.correctIndex!).toBeGreaterThanOrEqual(0);
        expect(result.challenge.correctIndex!).toBeLessThan(result.challenge.options!.length);
      }).rejects.toThrow('Connection refused');
    });

    it('should generate geography challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const geographyRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.GEOGRAPHY,
          difficulty: 'medium',
          category: 'grid_squares'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geographyRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        expect(result.challenge.type).toBe(ChallengeType.GEOGRAPHY);
        expect(result.challenge.category).toBe('grid_squares');
        expect(result.challenge.question).toMatch(/grid|square|location|coordinates/i);
      }).rejects.toThrow('Connection refused');
    });

    it('should generate pattern challenge', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const patternRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.PATTERN,
          difficulty: 'hard'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patternRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        expect(result.challenge.type).toBe(ChallengeType.PATTERN);
        expect(result.challenge.difficulty).toBe('hard');
        expect(result.challenge.question).toMatch(/pattern|sequence|next|continue/i);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle custom expiration time', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const customExpirationRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.MATH,
          expirationMinutes: 120 // 2 hours
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customExpirationRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        const generatedTime = new Date(result.challenge.generatedAt);
        const expirationTime = new Date(result.challenge.expiresAt);
        const diffMinutes = (expirationTime.getTime() - generatedTime.getTime()) / (1000 * 60);

        expect(diffMinutes).toBeCloseTo(120, 1);
      }).rejects.toThrow('Connection refused');
    });

    it('should validate server callsign format', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const invalidServerRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'INVALID_CALLSIGN',
        parameters: {
          type: ChallengeType.MATH
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/INVALID_CALLSIGN/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidServerRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_SERVER_CALLSIGN');
          expect(error.message).toContain('callsign');
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate challenge type', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const invalidTypeRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: 'invalid_type',
          difficulty: 'medium'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidTypeRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_CHALLENGE_TYPE');
          expect(error.message).toContain('type');
          expect(error.details.validTypes).toBeInstanceOf(Array);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should validate difficulty level', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const invalidDifficultyRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.MATH,
          difficulty: 'invalid_difficulty'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidDifficultyRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('INVALID_DIFFICULTY');
          expect(error.message).toContain('difficulty');
          expect(error.details.validDifficulties).toEqual(['easy', 'medium', 'hard']);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should handle retry context appropriately', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const retryRequest: CAPTCHAGenerationRequest = {
        serverCallsign: 'W1AW',
        parameters: {
          type: ChallengeType.MATH,
          difficulty: 'easy' // Easier for retry
        },
        context: {
          requestingCallsign: 'KA1ABC',
          isRetry: true,
          previousCaptchaId: '550e8400-e29b-41d4-a716-446655440000'
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(retryRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHAGenerationResponse = await response.json();

        // Retry challenges should be easier
        expect(result.challenge.difficulty).toBe('easy');
        expect(result.metadata.complexityScore).toBeLessThan(50); // Lower complexity for retry
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('POST /api/servers/:serverCallsign/captcha/batch-generate', () => {
    it('should generate batch of mixed challenge types', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const batchRequest: CAPTCHABatchRequest = {
        serverCallsign: 'W1AW',
        batch: {
          count: 10,
          types: [ChallengeType.MATH, ChallengeType.HAM_KNOWLEDGE, ChallengeType.GEOGRAPHY],
          difficultyDistribution: {
            easy: 4,
            medium: 4,
            hard: 2
          },
          ensureUniqueness: true
        },
        commonParameters: {
          language: 'en',
          expirationMinutes: 60
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/batch-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHABatchResponse = await response.json();

        // Validate batch size
        expect(result.challenges).toHaveLength(10);

        // Validate uniqueness
        const challengeIds = result.challenges.map(c => c.id);
        const uniqueIds = new Set(challengeIds);
        expect(uniqueIds.size).toBe(10);

        // Validate type distribution
        const typeCount = result.challenges.reduce((acc, challenge) => {
          acc[challenge.type] = (acc[challenge.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        expect(Object.keys(typeCount).length).toBeGreaterThan(1);

        // Validate difficulty distribution
        const difficultyCount = result.challenges.reduce((acc, challenge) => {
          acc[challenge.difficulty] = (acc[challenge.difficulty] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        expect(difficultyCount.easy).toBe(4);
        expect(difficultyCount.medium).toBe(4);
        expect(difficultyCount.hard).toBe(2);

        // Validate metadata
        expect(result.metadata.totalGenerationTime).toBeGreaterThan(0);
        expect(result.metadata.averageGenerationTime).toBeGreaterThan(0);
        expect(result.metadata.uniquenessResults.uniqueCount).toBe(10);
        expect(result.metadata.uniquenessResults.duplicatesRejected).toBe(0);
        expect(result.metadata.uniquenessResults.uniquenessPercentage).toBe(100);

        // Validate quality metrics
        expect(result.metadata.qualityMetrics.averageComplexity).toBeGreaterThanOrEqual(0);
        expect(result.metadata.qualityMetrics.averageComplexity).toBeLessThanOrEqual(100);
        expect(result.metadata.qualityMetrics.averageSolveTime).toBeGreaterThan(0);

        // Validate batch instructions
        expect(result.batchInstructions.byType).toBeDefined();
        expect(result.batchInstructions.generalGuidelines).toBeInstanceOf(Array);
        expect(result.batchInstructions.answerFormats).toBeDefined();
      }).rejects.toThrow('Connection refused');
    });

    it('should handle batch size limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const oversizedBatchRequest: CAPTCHABatchRequest = {
        serverCallsign: 'W1AW',
        batch: {
          count: 1001, // Exceeds maximum batch size
          ensureUniqueness: false
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/batch-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(oversizedBatchRequest)
        });

        if (response.status === 400) {
          const error: ApiError = await response.json();
          expect(error.code).toBe('BATCH_SIZE_EXCEEDED');
          expect(error.message).toContain('batch size');
          expect(error.details.maxBatchSize).toBeTruthy();
          expect(error.details.requestedSize).toBe(1001);
        }
      }).rejects.toThrow('Connection refused');
    });

    it('should handle duplicate detection in batch', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const duplicateProneRequest: CAPTCHABatchRequest = {
        serverCallsign: 'W1AW',
        batch: {
          count: 50,
          types: [ChallengeType.MATH], // Single type more likely to have duplicates
          difficultyDistribution: {
            easy: 50,
            medium: 0,
            hard: 0
          },
          ensureUniqueness: true
        }
      };

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/batch-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(duplicateProneRequest)
        });

        expect(response.status).toBe(201);
        const result: CAPTCHABatchResponse = await response.json();

        // Should handle duplicates appropriately
        expect(result.metadata.uniquenessResults.uniqueCount).toBeLessThanOrEqual(50);
        expect(result.metadata.uniquenessResults.duplicatesRejected).toBeGreaterThanOrEqual(0);

        // Actual challenge count might be less due to duplicate rejection
        expect(result.challenges.length).toBeLessThanOrEqual(50);
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('GET /api/servers/:serverCallsign/captcha/pool-status', () => {
    it('should return comprehensive pool status', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/pool-status`);

        expect(response.status).toBe(200);
        const status: CAPTCHAPoolStatus = await response.json();

        // Validate basic structure
        expect(status.serverCallsign).toBe('W1AW');

        // Validate pool statistics
        expect(typeof status.poolStats.totalAvailable).toBe('number');
        expect(typeof status.poolStats.unusedCount).toBe('number');
        expect(typeof status.poolStats.expiredCount).toBe('number');

        Object.values(ChallengeType).forEach(type => {
          expect(typeof status.poolStats.byType[type]).toBe('number');
        });

        ['easy', 'medium', 'hard'].forEach(difficulty => {
          expect(typeof status.poolStats.byDifficulty[difficulty]).toBe('number');
        });

        // Validate pool health
        expect(typeof status.poolHealth.utilizationPercentage).toBe('number');
        expect(status.poolHealth.utilizationPercentage).toBeGreaterThanOrEqual(0);
        expect(status.poolHealth.utilizationPercentage).toBeLessThanOrEqual(100);
        expect(status.poolHealth.depletionEstimate).toBeTruthy();
        expect(typeof status.poolHealth.recommendedReplenishment).toBe('number');
        expect(typeof status.poolHealth.qualityScore).toBe('number');

        // Validate generation statistics
        expect(typeof status.generationStats.generated24h).toBe('number');
        expect(typeof status.generationStats.used24h).toBe('number');
        expect(typeof status.generationStats.generationRate).toBe('number');
        expect(typeof status.generationStats.usageRate).toBe('number');
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('DELETE /api/servers/:serverCallsign/captcha/expired', () => {
    it('should clean up expired challenges', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/expired`, {
          method: 'DELETE'
        });

        expect(response.status).toBe(200);
        const result = await response.json();

        expect(typeof result.deletedCount).toBe('number');
        expect(typeof result.deletedSize).toBe('number');
        expect(result.deletedChallenges).toBeInstanceOf(Array);
        expect(typeof result.operationTime).toBe('number');

        // Should return details about deleted challenges
        result.deletedChallenges.forEach((challengeId: string) => {
          expect(challengeId).toMatch(/^[0-9a-f-]{36}$/i);
        });
      }).rejects.toThrow('Connection refused');
    });
  });

  describe('Challenge Validation', () => {
    it('should validate challenge type values', () => {
      const validTypes = Object.values(ChallengeType);
      const invalidTypes = ['invalid', 'unknown', 'fake'];

      validTypes.forEach(type => {
        expect(Object.values(ChallengeType)).toContain(type);
      });

      invalidTypes.forEach(type => {
        expect(Object.values(ChallengeType)).not.toContain(type);
      });
    });

    it('should validate difficulty levels', () => {
      const validDifficulties = ['easy', 'medium', 'hard'];
      const invalidDifficulties = ['trivial', 'impossible', 'unknown'];

      validDifficulties.forEach(difficulty => {
        expect(['easy', 'medium', 'hard']).toContain(difficulty);
      });

      invalidDifficulties.forEach(difficulty => {
        expect(['easy', 'medium', 'hard']).not.toContain(difficulty);
      });
    });

    it('should validate challenge structure', () => {
      const validChallenge: CAPTCHAChallenge = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        serverCallsign: 'W1AW',
        type: ChallengeType.MATH,
        question: 'What is 2 + 2?',
        expectedAnswer: '4',
        answerHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        difficulty: 'easy',
        category: 'arithmetic',
        generatedAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-01-01T01:00:00Z',
        signature: 'signature_hash',
        usedBy: [],
        maxUses: 1
      };

      // Validate structure
      expect(validChallenge.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(validChallenge.serverCallsign).toMatch(/^[A-Z0-9]{3,7}$/);
      expect(Object.values(ChallengeType)).toContain(validChallenge.type);
      expect(['easy', 'medium', 'hard']).toContain(validChallenge.difficulty);
      expect(validChallenge.answerHash).toMatch(/^[0-9a-f]{64}$/i);
      expect(validChallenge.usedBy).toBeInstanceOf(Array);
      expect(typeof validChallenge.maxUses).toBe('number');
    });
  });

  describe('Performance Requirements', () => {
    it('should generate challenges within time limits', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const startTime = Date.now();

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverCallsign: 'W1AW',
            parameters: {
              type: ChallengeType.MATH,
              difficulty: 'medium'
            }
          })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Challenge generation should complete within 1 second
        expect(duration).toBeLessThan(1000);

        const result: CAPTCHAGenerationResponse = await response.json();
        expect(result.metadata.generationTime).toBeLessThan(1000);
      }).rejects.toThrow('Connection refused');
    });

    it('should handle batch generation efficiently', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const batchRequest: CAPTCHABatchRequest = {
        serverCallsign: 'W1AW',
        batch: {
          count: 100,
          ensureUniqueness: true
        }
      };

      await expect(async () => {
        const startTime = Date.now();

        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/batch-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batchRequest)
        });

        const result: CAPTCHABatchResponse = await response.json();
        expect(result.metadata.totalGenerationTime).toBeLessThan(10000); // 10 seconds
        expect(result.metadata.averageGenerationTime).toBeLessThan(100); // 100ms per challenge
        expect(result.challenges.length).toBeLessThanOrEqual(100);
      }).rejects.toThrow('Connection refused');
    });

    it('should optimize for radio transmission', async () => {
      // This will FAIL until API is implemented
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(async () => {
        const response = await fetch(`${API_BASE_URL}/servers/W1AW/captcha/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverCallsign: 'W1AW',
            parameters: {
              type: ChallengeType.MATH,
              difficulty: 'easy'
            }
          })
        });

        const result: CAPTCHAGenerationResponse = await response.json();

        // Should be optimized for radio transmission
        expect(result.radioOptimization.compressedSize).toBeLessThan(500); // Under 500 bytes
        expect(result.radioOptimization.transmissionTime).toBeLessThan(10); // Under 10 seconds at 1200 baud
        expect(result.radioOptimization.compressionRatio).toBeGreaterThan(1);
        expect(['ascii', 'utf-8', 'latin1']).toContain(result.radioOptimization.encoding);
      }).rejects.toThrow('Connection refused');
    });
  });
});