/**
 * CAPTCHA Generator for Radio-Optimized Human Verification
 *
 * Generates lightweight CAPTCHA challenges optimized for amateur radio transmission.
 * Focuses on amateur radio knowledge and simple math problems.
 * Task T039 per certificate management implementation plan.
 */

import {
  CAPTCHAChallenge,
  ChallengeType,
  VALIDATION_CONSTRAINTS
} from '../types.js';

export interface CAPTCHAGenerationOptions {
  type?: ChallengeType;
  difficulty?: 'easy' | 'medium' | 'hard';
  maxUses?: number;
  expirationMinutes?: number;
  serverCallsign: string;
}

/**
 * Generates radio-optimized CAPTCHA challenges for certificate verification
 */
export class CAPTCHAGenerator {
  private readonly hamKnowledgeQuestions = {
    easy: [
      {
        question: "What is the phonetic alphabet for the letter 'A'?",
        answer: "ALPHA",
        category: "phonetic"
      },
      {
        question: "What frequency band is 20 meters?",
        answer: "14",
        category: "frequency"
      },
      {
        question: "What does CQ mean?",
        answer: "CALLING ANY STATION",
        category: "procedure"
      },
      {
        question: "What is 73 in amateur radio?",
        answer: "BEST WISHES",
        category: "procedure"
      },
      {
        question: "What does QRT mean?",
        answer: "STOP TRANSMITTING",
        category: "q-codes"
      }
    ],
    medium: [
      {
        question: "What is the frequency range of the 40-meter band?",
        answer: "7000-7300",
        category: "frequency"
      },
      {
        question: "What does QSL mean?",
        answer: "I ACKNOWLEDGE RECEIPT",
        category: "q-codes"
      },
      {
        question: "What is the maximum power for Technician class on 2 meters?",
        answer: "1500",
        category: "regulations"
      },
      {
        question: "What modulation is used for FT8?",
        answer: "FSK",
        category: "digital"
      },
      {
        question: "What is the wavelength formula?",
        answer: "300/FREQUENCY",
        category: "technical"
      }
    ],
    hard: [
      {
        question: "What is the minimum signal-to-noise ratio for FT8?",
        answer: "-21",
        category: "digital"
      },
      {
        question: "What is the frequency deviation for FM on 2 meters?",
        answer: "5",
        category: "technical"
      },
      {
        question: "What Part 97 section covers station identification?",
        answer: "97.119",
        category: "regulations"
      },
      {
        question: "What is the symbol rate for PSK31?",
        answer: "31.25",
        category: "digital"
      },
      {
        question: "What is the maximum ERP for GMRS repeaters?",
        answer: "50",
        category: "regulations"
      }
    ]
  };

  private readonly geographyQuestions = {
    easy: [
      {
        question: "What ITU region is the United States in?",
        answer: "2",
        category: "geography"
      },
      {
        question: "What grid square contains Washington DC?",
        answer: "FM19",
        category: "grid"
      },
      {
        question: "How many miles are in a degree of latitude?",
        answer: "69",
        category: "navigation"
      }
    ],
    medium: [
      {
        question: "What is the grid square for latitude 42.36N, longitude 71.06W?",
        answer: "FN42",
        category: "grid"
      },
      {
        question: "What CQ zone is most of the continental US in?",
        answer: "3-5",
        category: "geography"
      }
    ],
    hard: [
      {
        question: "What is the exact grid square for 40.7128N, 74.0060W?",
        answer: "FN30as",
        category: "grid"
      }
    ]
  };

  /**
   * Generate a new CAPTCHA challenge
   */
  async generateChallenge(options: CAPTCHAGenerationOptions): Promise<CAPTCHAChallenge> {
    const type = options.type || this.selectRandomType();
    const difficulty = options.difficulty || 'medium';
    const maxUses = options.maxUses || VALIDATION_CONSTRAINTS.DEFAULT_MAX_CAPTCHA_USES;
    const expirationMinutes = options.expirationMinutes || VALIDATION_CONSTRAINTS.CAPTCHA_EXPIRATION_MINUTES;

    let challenge: {
      question: string;
      answer: string;
      category: string;
      options?: string[];
      correctIndex?: number;
    };

    switch (type) {
      case ChallengeType.MATH:
        challenge = this.generateMathChallenge(difficulty);
        break;
      case ChallengeType.HAM_KNOWLEDGE:
        challenge = this.generateHamKnowledgeChallenge(difficulty);
        break;
      case ChallengeType.PATTERN:
        challenge = this.generatePatternChallenge(difficulty);
        break;
      case ChallengeType.GEOGRAPHY:
        challenge = this.generateGeographyChallenge(difficulty);
        break;
      case ChallengeType.MULTIPLE_CHOICE:
        challenge = this.generateMultipleChoiceChallenge(difficulty);
        break;
      default:
        challenge = this.generateMathChallenge(difficulty);
    }

    // Generate answer hash
    const answerHash = await this.hashAnswer(challenge.answer);

    // Create challenge object
    const captchaChallenge: CAPTCHAChallenge = {
      id: crypto.randomUUID(),
      serverCallsign: options.serverCallsign,
      type,
      question: challenge.question,
      expectedAnswer: challenge.answer,
      answerHash,
      options: challenge.options,
      correctIndex: challenge.correctIndex,
      difficulty,
      category: challenge.category,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString(),
      signature: '', // Will be filled by server
      usedBy: [],
      maxUses
    };

    // Sign the challenge
    captchaChallenge.signature = await this.signChallenge(captchaChallenge);

    return captchaChallenge;
  }

  /**
   * Verify a CAPTCHA solution
   */
  async verifySolution(challenge: CAPTCHAChallenge, providedAnswer: string): Promise<{
    isCorrect: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check if challenge has expired
    if (new Date() > new Date(challenge.expiresAt)) {
      errors.push('CAPTCHA challenge has expired');
      return { isCorrect: false, errors };
    }

    // Check usage limits
    if (challenge.usedBy.length >= challenge.maxUses) {
      errors.push('CAPTCHA challenge has reached maximum usage limit');
      return { isCorrect: false, errors };
    }

    // Verify signature
    const isSignatureValid = await this.verifySignature(challenge);
    if (!isSignatureValid) {
      errors.push('CAPTCHA challenge signature is invalid');
      return { isCorrect: false, errors };
    }

    // Normalize answers for comparison
    const normalizedProvided = this.normalizeAnswer(providedAnswer);
    const normalizedExpected = this.normalizeAnswer(challenge.expectedAnswer);

    // Check if answer is correct
    const isCorrect = normalizedProvided === normalizedExpected;

    if (!isCorrect) {
      errors.push('Incorrect answer provided');
    }

    return { isCorrect, errors };
  }

  /**
   * Generate a math challenge
   */
  private generateMathChallenge(difficulty: 'easy' | 'medium' | 'hard'): {
    question: string;
    answer: string;
    category: string;
  } {
    let a: number, b: number, operation: string, result: number;

    switch (difficulty) {
      case 'easy':
        a = Math.floor(Math.random() * 20) + 1;
        b = Math.floor(Math.random() * 20) + 1;
        operation = Math.random() > 0.5 ? '+' : '-';
        result = operation === '+' ? a + b : Math.max(a, b) - Math.min(a, b);
        break;
      case 'medium':
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * 12) + 2;
        operation = Math.random() > 0.5 ? '*' : '/';
        if (operation === '*') {
          result = a * b;
        } else {
          result = a;
          a = result * b;
        }
        break;
      case 'hard':
        a = Math.floor(Math.random() * 100) + 50;
        b = Math.floor(Math.random() * 20) + 5;
        const operations = ['+', '-', '*'];
        operation = operations[Math.floor(Math.random() * operations.length)];
        switch (operation) {
          case '+':
            result = a + b;
            break;
          case '-':
            result = a - b;
            break;
          case '*':
            result = a * b;
            break;
          default:
            result = a + b;
        }
        break;
      default:
        a = 5;
        b = 3;
        operation = '+';
        result = 8;
    }

    return {
      question: `What is ${a} ${operation} ${b}?`,
      answer: result.toString(),
      category: 'math'
    };
  }

  /**
   * Generate a ham radio knowledge challenge
   */
  private generateHamKnowledgeChallenge(difficulty: 'easy' | 'medium' | 'hard'): {
    question: string;
    answer: string;
    category: string;
  } {
    const questions = this.hamKnowledgeQuestions[difficulty];
    const selected = questions[Math.floor(Math.random() * questions.length)];
    return selected;
  }

  /**
   * Generate a pattern recognition challenge
   */
  private generatePatternChallenge(difficulty: 'easy' | 'medium' | 'hard'): {
    question: string;
    answer: string;
    category: string;
  } {
    const patterns = {
      easy: [
        { sequence: [2, 4, 6, 8], next: 10, description: "even numbers" },
        { sequence: [1, 3, 5, 7], next: 9, description: "odd numbers" },
        { sequence: [5, 10, 15, 20], next: 25, description: "multiples of 5" }
      ],
      medium: [
        { sequence: [1, 1, 2, 3, 5], next: 8, description: "Fibonacci" },
        { sequence: [2, 6, 18, 54], next: 162, description: "multiply by 3" },
        { sequence: [100, 81, 64, 49], next: 36, description: "perfect squares descending" }
      ],
      hard: [
        { sequence: [2, 3, 5, 7, 11], next: 13, description: "prime numbers" },
        { sequence: [1, 4, 9, 16, 25], next: 36, description: "perfect squares" },
        { sequence: [1, 8, 27, 64], next: 125, description: "perfect cubes" }
      ]
    };

    const selected = patterns[difficulty][Math.floor(Math.random() * patterns[difficulty].length)];

    return {
      question: `What is the next number in the sequence: ${selected.sequence.join(', ')}?`,
      answer: selected.next.toString(),
      category: 'pattern'
    };
  }

  /**
   * Generate a geography challenge
   */
  private generateGeographyChallenge(difficulty: 'easy' | 'medium' | 'hard'): {
    question: string;
    answer: string;
    category: string;
  } {
    const questions = this.geographyQuestions[difficulty];
    const selected = questions[Math.floor(Math.random() * questions.length)];
    return selected;
  }

  /**
   * Generate a multiple choice challenge
   */
  private generateMultipleChoiceChallenge(difficulty: 'easy' | 'medium' | 'hard'): {
    question: string;
    answer: string;
    category: string;
    options: string[];
    correctIndex: number;
  } {
    const baseChallenge = this.generateHamKnowledgeChallenge(difficulty);
    const correctAnswer = baseChallenge.answer;

    // Generate 3 incorrect options
    const incorrectOptions = this.generateIncorrectOptions(correctAnswer, baseChallenge.category);

    // Combine and shuffle options
    const allOptions = [correctAnswer, ...incorrectOptions];
    const shuffledOptions = this.shuffleArray([...allOptions]);
    const correctIndex = shuffledOptions.indexOf(correctAnswer);

    return {
      question: baseChallenge.question,
      answer: correctAnswer,
      category: baseChallenge.category,
      options: shuffledOptions,
      correctIndex
    };
  }

  /**
   * Generate plausible incorrect options for multiple choice
   */
  private generateIncorrectOptions(correctAnswer: string, category: string): string[] {
    const options: string[] = [];

    switch (category) {
      case 'frequency':
        const freq = parseInt(correctAnswer);
        if (!isNaN(freq)) {
          options.push((freq + 1).toString());
          options.push((freq - 1).toString());
          options.push((freq + 3).toString());
        } else {
          options.push('28', '21', '18');
        }
        break;
      case 'phonetic':
        const phoneticOptions = ['BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];
        options.push(...phoneticOptions.filter(opt => opt !== correctAnswer).slice(0, 3));
        break;
      case 'q-codes':
        const qCodeOptions = ['QRZ', 'QTH', 'QSY', 'QRM', 'QRN'];
        options.push(...qCodeOptions.slice(0, 3));
        break;
      default:
        options.push('Option A', 'Option B', 'Option C');
    }

    return options.slice(0, 3);
  }

  /**
   * Select a random challenge type
   */
  private selectRandomType(): ChallengeType {
    const types = Object.values(ChallengeType);
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Normalize answer for comparison
   */
  private normalizeAnswer(answer: string): string {
    return answer.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Hash an answer using SHA-256
   */
  private async hashAnswer(answer: string): Promise<string> {
    const normalized = this.normalizeAnswer(answer);
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Sign a CAPTCHA challenge
   */
  private async signChallenge(challenge: CAPTCHAChallenge): Promise<string> {
    // In a real implementation, this would use the server's private key
    // For now, we'll create a simple signature
    const dataToSign = `${challenge.id}${challenge.question}${challenge.answerHash}${challenge.expiresAt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(dataToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify challenge signature
   */
  private async verifySignature(challenge: CAPTCHAChallenge): Promise<boolean> {
    // In a real implementation, this would verify using the server's public key
    const expectedSignature = await this.signChallenge(challenge);
    return challenge.signature === expectedSignature;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get challenge statistics for monitoring
   */
  getStatistics(): {
    totalTypes: number;
    questionsPerType: Record<ChallengeType, number>;
    difficultyLevels: string[];
  } {
    return {
      totalTypes: Object.keys(ChallengeType).length,
      questionsPerType: {
        [ChallengeType.MATH]: Number.MAX_SAFE_INTEGER, // Generated dynamically
        [ChallengeType.HAM_KNOWLEDGE]:
          this.hamKnowledgeQuestions.easy.length +
          this.hamKnowledgeQuestions.medium.length +
          this.hamKnowledgeQuestions.hard.length,
        [ChallengeType.PATTERN]: 9, // 3 per difficulty
        [ChallengeType.GEOGRAPHY]:
          this.geographyQuestions.easy.length +
          this.geographyQuestions.medium.length +
          this.geographyQuestions.hard.length,
        [ChallengeType.MULTIPLE_CHOICE]: Number.MAX_SAFE_INTEGER // Based on other types
      },
      difficultyLevels: ['easy', 'medium', 'hard']
    };
  }

  /**
   * Estimate compressed size of challenge for radio transmission
   */
  estimateCompressedSize(challenge: CAPTCHAChallenge): number {
    const jsonString = JSON.stringify({
      id: challenge.id,
      type: challenge.type,
      question: challenge.question,
      options: challenge.options,
      expiresAt: challenge.expiresAt
    });

    // Estimate 60% compression ratio for typical text
    return Math.ceil(jsonString.length * 0.6);
  }
}

export default CAPTCHAGenerator;