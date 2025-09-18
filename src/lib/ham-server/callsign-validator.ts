/**
 * Callsign Validator for Amateur Radio License Verification
 * Implements FCC Part 97 compliance for HTTP over Ham Radio
 */

export interface CallsignValidationResult {
  valid: boolean;
  licensed: boolean;
  callsign: string;
  country?: string;
  type?: 'amateur' | 'swl' | 'special' | 'unlicensed';
  error?: string;
}

/**
 * Validates amateur radio callsigns and determines license status
 */
export class CallsignValidator {
  // US Amateur Radio callsign patterns (FCC)
  private static readonly US_PATTERNS = [
    /^[AKNW][A-Z]?[0-9][A-Z]{1,3}$/,  // Standard US format
    /^[AKNW][0-9][A-Z]{1,3}$/,        // Shortened format
    /^[AKNW][A-Z][0-9][A-Z]$/,        // 1x1 special event
    /^[AKNW][A-Z]{2}[0-9][A-Z]$/      // 2x1 special event
  ];

  // International callsign patterns
  private static readonly INTERNATIONAL_PATTERNS: Map<string, RegExp> = new Map([
    ['Canada', /^V[AEY][0-9][A-Z]{1,3}$/],
    ['UK', /^[GM][0-9][A-Z]{1,3}$/],
    ['Germany', /^D[A-Z][0-9][A-Z]{1,3}$/],
    ['Japan', /^J[A-S][0-9][A-Z]{1,3}$/],
    ['Australia', /^VK[0-9][A-Z]{1,3}$/],
    ['France', /^F[0-9][A-Z]{1,3}$/],
    ['Italy', /^I[0-9][A-Z]{1,3}$/],
    ['Spain', /^E[A-H][0-9][A-Z]{1,3}$/],
    ['Russia', /^[RU][A-Z][0-9][A-Z]{1,3}$/],
    ['Brazil', /^P[PYZ][0-9][A-Z]{1,3}$/]
  ]);

  // Special prefixes for non-amateur stations
  private static readonly SPECIAL_PREFIXES = [
    'SWL',        // Short Wave Listener
    'SCANNER',    // Scanner enthusiast
    'UNLICENSED', // Explicitly unlicensed
    'GUEST',      // Guest user
    'MONITOR',    // Monitor station
    'RX-ONLY',    // Receive only station
    'OBSERVER'    // Observer station
  ];

  /**
   * Validates a callsign and determines if it's licensed
   */
  static validate(callsign: string): CallsignValidationResult {
    if (!callsign || typeof callsign !== 'string') {
      return {
        valid: false,
        licensed: false,
        callsign: callsign || '',
        type: 'unlicensed',
        error: 'Invalid or missing callsign'
      };
    }

    const normalized = callsign.toUpperCase().trim();

    // Check for special non-licensed prefixes
    for (const prefix of this.SPECIAL_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        return {
          valid: true,
          licensed: false,
          callsign: normalized,
          type: 'swl',
          country: 'International'
        };
      }
    }

    // Check for empty or obviously invalid callsigns
    if (normalized.length < 3 || normalized.length > 10) {
      return {
        valid: false,
        licensed: false,
        callsign: normalized,
        type: 'unlicensed',
        error: 'Callsign length invalid (must be 3-10 characters)'
      };
    }

    // Check if it matches US patterns
    for (const pattern of this.US_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          valid: true,
          licensed: true,
          callsign: normalized,
          type: 'amateur',
          country: 'United States'
        };
      }
    }

    // Check international patterns
    for (const [country, pattern] of this.INTERNATIONAL_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          valid: true,
          licensed: true,
          callsign: normalized,
          type: 'amateur',
          country
        };
      }
    }

    // Check for special event callsigns (may not match standard patterns)
    if (this.isSpecialEventCallsign(normalized)) {
      return {
        valid: true,
        licensed: true,
        callsign: normalized,
        type: 'special',
        country: 'International'
      };
    }

    // If no patterns match, consider it unlicensed
    return {
      valid: false,
      licensed: false,
      callsign: normalized,
      type: 'unlicensed',
      error: 'Callsign does not match any known amateur radio format'
    };
  }

  /**
   * Checks if a callsign appears to be a special event station
   */
  private static isSpecialEventCallsign(callsign: string): boolean {
    // Special event stations often have unusual formats
    // but still follow some basic rules

    // Must start with a letter
    if (!/^[A-Z]/.test(callsign)) {
      return false;
    }

    // Must contain at least one number
    if (!/[0-9]/.test(callsign)) {
      return false;
    }

    // Check for known special event patterns
    const specialPatterns = [
      /^[A-Z]{1,2}[0-9][A-Z]$/,       // Very short special events
      /^[A-Z][0-9]{2}[A-Z]{1,3}$/,    // Centennial stations
      /^[0-9][A-Z][0-9][A-Z]{1,3}$/   // Some contest stations
    ];

    for (const pattern of specialPatterns) {
      if (pattern.test(callsign)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines if a callsign is allowed to use write methods (POST, PUT, DELETE)
   */
  static canUseWriteMethods(callsign: string): boolean {
    const result = this.validate(callsign);
    return result.licensed && result.type === 'amateur';
  }

  /**
   * Gets allowed HTTP methods for a callsign
   */
  static getAllowedMethods(callsign: string): string[] {
    const result = this.validate(callsign);

    if (result.licensed && result.type === 'amateur') {
      // Licensed amateurs can use all methods
      return ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
    } else {
      // Unlicensed/SWL can only use read methods
      return ['GET', 'HEAD', 'OPTIONS'];
    }
  }

  /**
   * Validates a batch of callsigns
   */
  static validateBatch(callsigns: string[]): Map<string, CallsignValidationResult> {
    const results = new Map<string, CallsignValidationResult>();

    for (const callsign of callsigns) {
      results.set(callsign, this.validate(callsign));
    }

    return results;
  }
}