/**
 * FCC Compliance Library
 *
 * Complete FCC Part 97 compliance automation system for amateur radio
 * HTTP-over-radio communications including station identification,
 * encryption control, and content filtering.
 *
 * @module FCCCompliance
 * @version 1.0.0
 */

// Core exports
import { ComplianceManager } from './core/ComplianceManager.js';
export { ComplianceManager };

// Component exports
export { StationIDTimer } from './timers/StationIDTimer.js';
export { EncryptionGuard } from './validators/EncryptionGuard.js';
export { ContentFilter } from './validators/ContentFilter.js';
export { ComplianceLogger } from './monitors/ComplianceLogger.js';

// Type exports
export * from './types.js';

// Default configuration
export const DEFAULT_FCC_COMPLIANCE_CONFIG = {
  enabled: true,
  strictMode: false,
  emergencyMode: false,

  stationID: {
    callsign: '',
    automaticIDEnabled: true,
    intervalMinutes: 10,
    endOfTransmissionID: true,
    controlOperatorCallsign: undefined,
    emergencyCallsign: undefined
  },

  contentFilter: {
    enabled: true,
    blockMusic: true,
    blockBusiness: true,
    profanityFilter: true,
    emergencyOverride: true,
    blockedWords: [],
    blockedFileTypes: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
    maxFileSize: 1024 * 1024, // 1MB
    musicDetectionEnabled: true,
    businessContentDetection: true
  },

  encryptionControl: {
    rfModeBlocking: true,
    webrtcModeAllowed: true,
    signaturesAllowed: true,
    emergencyOverride: true,
    cryptoFunctionMonitoring: true,
    contentAnalysis: true,
    headerInspection: true
  },

  auditLogging: true,
  violationLogging: true,
  complianceReporting: true,
  transmissionModeIntegration: true,
  meshNetworkCompliance: true,
  automaticShutdown: false
};

/**
 * Create a new FCC compliance manager with default configuration
 */
export function createComplianceManager(callsign: string, overrides = {}) {
  const config = {
    ...DEFAULT_FCC_COMPLIANCE_CONFIG,
    ...overrides,
    stationID: {
      ...DEFAULT_FCC_COMPLIANCE_CONFIG.stationID,
      callsign,
      ...(overrides as any).stationID
    }
  };

  return new ComplianceManager(config);
}

/**
 * Validate a callsign format according to amateur radio standards
 */
export function validateCallsign(callsign: string): {
  valid: boolean;
  reason?: string;
  country?: string;
  class?: string;
} {
  if (!callsign || typeof callsign !== 'string') {
    return { valid: false, reason: 'Callsign must be a non-empty string' };
  }

  const clean = callsign.trim().toUpperCase();

  // Basic format validation
  if (clean.length < 3 || clean.length > 6) {
    return { valid: false, reason: 'Callsign must be 3-6 characters long' };
  }

  // Must contain at least one number
  if (!/\d/.test(clean)) {
    return { valid: false, reason: 'Callsign must contain at least one number' };
  }

  // Must start with letter(s) and contain number
  if (!/^[A-Z]{1,2}\d[A-Z]{1,3}$/.test(clean)) {
    return { valid: false, reason: 'Invalid callsign format' };
  }

  // Determine country from prefix
  let country = 'Unknown';
  if (clean.startsWith('W') || clean.startsWith('K') || clean.startsWith('N')) {
    country = 'United States';
  } else if (clean.startsWith('VE')) {
    country = 'Canada';
  } else if (clean.startsWith('G')) {
    country = 'United Kingdom';
  } else if (clean.startsWith('JA')) {
    country = 'Japan';
  }

  return {
    valid: true,
    country,
    class: 'Unknown' // Would need more sophisticated logic
  };
}

/**
 * Get regulation reference for a specific FCC rule
 */
export function getRegulationReference(section: string) {
  const regulations = {
    '§97.119': {
      title: 'Station identification',
      description: 'Requirements for amateur station identification including timing and content',
      url: 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/subpart-E/section-97.119'
    },
    '§97.113': {
      title: 'Prohibited transmissions',
      description: 'Prohibitions on business communications, encryption, and other restricted content',
      url: 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/subpart-E/section-97.113'
    },
    '§97.313': {
      title: 'Transmitter power standards',
      description: 'Maximum power levels for amateur radio transmissions by frequency band',
      url: 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97/subpart-D/section-97.313'
    }
  };

  return regulations[section as keyof typeof regulations] || {
    title: 'Unknown regulation',
    description: 'Regulation reference not found',
    url: 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97'
  };
}

export const VERSION = '1.0.0';
export const COMPLIANCE_DATE = '2025-09-19';

// Export for factory function usage
export const FCCComplianceLibrary = {
  createComplianceManager,
  validateCallsign,
  getRegulationReference,
  DEFAULT_FCC_COMPLIANCE_CONFIG,
  VERSION,
  COMPLIANCE_DATE
};