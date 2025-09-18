/**
 * IndexedDB Schema Configuration for Certificate Management
 *
 * Provides type-safe IndexedDB access for amateur radio certificate management
 * including certificates, requests, CAPTCHA solutions, trust chains, and ban records.
 *
 * @module CertificateManagement/DbSchema
 */

import { DBSchema, IDBPDatabase, openDB } from 'idb';
import {
  Certificate,
  CertificateRequest,
  SignedCAPTCHASolution,
  TrustChain,
  BanRecord,
  CertificateType,
  TrustLevel,
  RequestStatus
} from './types.js';

// Database configuration
export const CERTIFICATE_DB_NAME = 'certificate-management';
export const CERTIFICATE_DB_VERSION = 1;

/**
 * TypeScript schema definition for the certificate management database
 * Extends idb's DBSchema for type safety
 */
export interface CertificateDBSchema extends DBSchema {
  /**
   * X.509 certificates with amateur radio extensions
   */
  certificates: {
    key: string; // Certificate.id
    value: Certificate;
    indexes: {
      by_callsign: string; // Certificate.callsign
      by_type: CertificateType; // Certificate.type
      by_trust_level: TrustLevel; // Certificate.trustLevel
      by_expiration: string; // Certificate.validTo (ISO 8601)
      by_created_at: string; // Certificate.createdAt (ISO 8601)
      by_storage_location: string; // Certificate.storageLocation
    };
  };

  /**
   * Certificate approval requests from stations to servers
   */
  certificate_requests: {
    key: string; // CertificateRequest.id
    value: CertificateRequest;
    indexes: {
      by_callsign: string; // CertificateRequest.callsign
      by_server: string; // CertificateRequest.serverCallsign
      by_status: RequestStatus; // CertificateRequest.status
      by_submitted_at: string; // CertificateRequest.submittedAt (ISO 8601)
      by_certificate_id: string; // CertificateRequest.certificateId
      by_expires_at: string; // CertificateRequest.expiresAt (ISO 8601)
    };
  };

  /**
   * CAPTCHA solutions signed by originating certificates
   */
  captcha_solutions: {
    key: string; // SignedCAPTCHASolution.id
    value: SignedCAPTCHASolution;
    indexes: {
      by_solver: string; // SignedCAPTCHASolution.solvedBy
      by_challenge_id: string; // SignedCAPTCHASolution.challengeId
      by_solved_at: string; // SignedCAPTCHASolution.solvedAt (ISO 8601)
      by_signing_cert: string; // SignedCAPTCHASolution.signingCertificateId
      by_is_valid: number; // SignedCAPTCHASolution.isValid (0 or 1)
    };
  };

  /**
   * Certificate trust relationships and validation chains
   */
  trust_chains: {
    key: string; // TrustChain.id
    value: TrustChain;
    indexes: {
      by_root_cert: string; // TrustChain.rootCertificateId
      by_leaf_cert: string; // TrustChain.leafCertificateId
      by_last_validated: string; // TrustChain.lastValidated (ISO 8601)
      by_trust_score: number; // TrustChain.trustScore
      by_is_valid: number; // TrustChain.isValid (0 or 1)
      by_expires_at: string; // TrustChain.expiresAt (ISO 8601)
    };
  };

  /**
   * Certificate ban records (distinct from revocation)
   */
  ban_records: {
    key: string; // BanRecord.id
    value: BanRecord;
    indexes: {
      by_callsign: string; // BanRecord.bannedCallsign
      by_server: string; // BanRecord.banningServer
      by_banned_at: string; // BanRecord.bannedAt (ISO 8601)
      by_certificate_id: string; // BanRecord.certificateId
      by_ban_type: string; // BanRecord.banType
      by_severity: string; // BanRecord.severity
      by_is_active: number; // BanRecord.isActive (0 or 1)
      by_expires_at: string; // BanRecord.expiresAt (ISO 8601)
    };
  };
}

/**
 * Initialize the certificate management database
 * Creates object stores and indexes with proper migration handling
 */
export async function initCertificateDatabase(): Promise<IDBPDatabase<CertificateDBSchema>> {
  return openDB<CertificateDBSchema>(CERTIFICATE_DB_NAME, CERTIFICATE_DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Certificate database upgrading from v${oldVersion} to v${newVersion}`);

      // Certificates object store
      if (!db.objectStoreNames.contains('certificates')) {
        const certificatesStore = db.createObjectStore('certificates', {
          keyPath: 'id'
        });

        // Create indexes for efficient querying
        certificatesStore.createIndex('by_callsign', 'callsign', { unique: false });
        certificatesStore.createIndex('by_type', 'type', { unique: false });
        certificatesStore.createIndex('by_trust_level', 'trustLevel', { unique: false });
        certificatesStore.createIndex('by_expiration', 'validTo', { unique: false });
        certificatesStore.createIndex('by_created_at', 'createdAt', { unique: false });
        certificatesStore.createIndex('by_storage_location', 'storageLocation', { unique: false });

        console.log('Created certificates object store with indexes');
      }

      // Certificate requests object store
      if (!db.objectStoreNames.contains('certificate_requests')) {
        const requestsStore = db.createObjectStore('certificate_requests', {
          keyPath: 'id'
        });

        // Create indexes for request querying
        requestsStore.createIndex('by_callsign', 'callsign', { unique: false });
        requestsStore.createIndex('by_server', 'serverCallsign', { unique: false });
        requestsStore.createIndex('by_status', 'status', { unique: false });
        requestsStore.createIndex('by_submitted_at', 'submittedAt', { unique: false });
        requestsStore.createIndex('by_certificate_id', 'certificateId', { unique: false });
        requestsStore.createIndex('by_expires_at', 'expiresAt', { unique: false });

        console.log('Created certificate_requests object store with indexes');
      }

      // CAPTCHA solutions object store
      if (!db.objectStoreNames.contains('captcha_solutions')) {
        const captchaStore = db.createObjectStore('captcha_solutions', {
          keyPath: 'id'
        });

        // Create indexes for CAPTCHA solution tracking
        captchaStore.createIndex('by_solver', 'solvedBy', { unique: false });
        captchaStore.createIndex('by_challenge_id', 'challengeId', { unique: false });
        captchaStore.createIndex('by_solved_at', 'solvedAt', { unique: false });
        captchaStore.createIndex('by_signing_cert', 'signingCertificateId', { unique: false });
        captchaStore.createIndex('by_is_valid', 'isValid', { unique: false });

        console.log('Created captcha_solutions object store with indexes');
      }

      // Trust chains object store
      if (!db.objectStoreNames.contains('trust_chains')) {
        const trustStore = db.createObjectStore('trust_chains', {
          keyPath: 'id'
        });

        // Create indexes for trust chain navigation
        trustStore.createIndex('by_root_cert', 'rootCertificateId', { unique: false });
        trustStore.createIndex('by_leaf_cert', 'leafCertificateId', { unique: false });
        trustStore.createIndex('by_last_validated', 'lastValidated', { unique: false });
        trustStore.createIndex('by_trust_score', 'trustScore', { unique: false });
        trustStore.createIndex('by_is_valid', 'isValid', { unique: false });
        trustStore.createIndex('by_expires_at', 'expiresAt', { unique: false });

        console.log('Created trust_chains object store with indexes');
      }

      // Ban records object store
      if (!db.objectStoreNames.contains('ban_records')) {
        const banStore = db.createObjectStore('ban_records', {
          keyPath: 'id'
        });

        // Create indexes for ban record management
        banStore.createIndex('by_callsign', 'bannedCallsign', { unique: false });
        banStore.createIndex('by_server', 'banningServer', { unique: false });
        banStore.createIndex('by_banned_at', 'bannedAt', { unique: false });
        banStore.createIndex('by_certificate_id', 'certificateId', { unique: false });
        banStore.createIndex('by_ban_type', 'banType', { unique: false });
        banStore.createIndex('by_severity', 'severity', { unique: false });
        banStore.createIndex('by_is_active', 'isActive', { unique: false });
        banStore.createIndex('by_expires_at', 'expiresAt', { unique: false });

        console.log('Created ban_records object store with indexes');
      }

      console.log('Certificate database schema upgrade complete');
    },

    blocked() {
      console.warn('Certificate database upgrade blocked by another connection');
    },

    blocking() {
      console.warn('Certificate database blocking another connection upgrade');
    }
  });
}

// Database singleton instance
let certificateDbInstance: IDBPDatabase<CertificateDBSchema> | null = null;

/**
 * Get the certificate management database instance
 * Creates the database if it doesn't exist
 */
export async function getCertificateDatabase(): Promise<IDBPDatabase<CertificateDBSchema>> {
  if (!certificateDbInstance) {
    certificateDbInstance = await initCertificateDatabase();
  }
  return certificateDbInstance;
}

/**
 * Close the certificate database connection
 * Useful for cleanup or testing
 */
export function closeCertificateDatabase(): void {
  if (certificateDbInstance) {
    certificateDbInstance.close();
    certificateDbInstance = null;
  }
}

/**
 * Clear all data from the certificate management database
 * WARNING: This will delete all certificates, requests, and related data
 * Use only for testing or complete reset scenarios
 */
export async function clearCertificateDatabase(): Promise<void> {
  const db = await getCertificateDatabase();

  const storeNames = [
    'certificates',
    'certificate_requests',
    'captcha_solutions',
    'trust_chains',
    'ban_records'
  ] as const;

  const transaction = db.transaction(storeNames, 'readwrite');

  // Clear all stores in parallel
  await Promise.all(
    storeNames.map(storeName =>
      transaction.objectStore(storeName).clear()
    )
  );

  await transaction.done;
  console.log('Certificate database cleared successfully');
}

/**
 * Check if the certificate database needs migration
 * Returns true if current version is different from expected version
 */
export async function needsCertificateDatabaseMigration(): Promise<boolean> {
  try {
    const db = await getCertificateDatabase();
    const currentVersion = db.version;
    db.close();
    return currentVersion !== CERTIFICATE_DB_VERSION;
  } catch (error) {
    // Database doesn't exist or can't be opened
    return true;
  }
}

/**
 * Get database statistics for monitoring and debugging
 */
export async function getCertificateDatabaseStats(): Promise<{
  certificateCount: number;
  requestCount: number;
  captchaSolutionCount: number;
  trustChainCount: number;
  banRecordCount: number;
  databaseVersion: number;
}> {
  const db = await getCertificateDatabase();

  const transaction = db.transaction([
    'certificates',
    'certificate_requests',
    'captcha_solutions',
    'trust_chains',
    'ban_records'
  ], 'readonly');

  const [
    certificateCount,
    requestCount,
    captchaSolutionCount,
    trustChainCount,
    banRecordCount
  ] = await Promise.all([
    transaction.objectStore('certificates').count(),
    transaction.objectStore('certificate_requests').count(),
    transaction.objectStore('captcha_solutions').count(),
    transaction.objectStore('trust_chains').count(),
    transaction.objectStore('ban_records').count()
  ]);

  await transaction.done;

  return {
    certificateCount,
    requestCount,
    captchaSolutionCount,
    trustChainCount,
    banRecordCount,
    databaseVersion: db.version
  };
}

/**
 * Validate database integrity
 * Checks for orphaned records and referential integrity
 */
export async function validateCertificateDatabaseIntegrity(): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const db = await getCertificateDatabase();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const transaction = db.transaction([
      'certificates',
      'certificate_requests',
      'captcha_solutions',
      'trust_chains',
      'ban_records'
    ], 'readonly');

    // Get all certificate IDs for reference checking
    const certificates = await transaction.objectStore('certificates').getAll();
    const certificateIds = new Set(certificates.map(cert => cert.id));

    // Check certificate requests reference valid certificates
    const requests = await transaction.objectStore('certificate_requests').getAll();
    for (const request of requests) {
      if (!certificateIds.has(request.certificateId)) {
        errors.push(`Certificate request ${request.id} references non-existent certificate ${request.certificateId}`);
      }
    }

    // Check CAPTCHA solutions reference valid certificates
    const solutions = await transaction.objectStore('captcha_solutions').getAll();
    for (const solution of solutions) {
      if (!certificateIds.has(solution.signingCertificateId)) {
        errors.push(`CAPTCHA solution ${solution.id} references non-existent certificate ${solution.signingCertificateId}`);
      }
    }

    // Check trust chains reference valid certificates
    const trustChains = await transaction.objectStore('trust_chains').getAll();
    for (const chain of trustChains) {
      if (!certificateIds.has(chain.rootCertificateId)) {
        errors.push(`Trust chain ${chain.id} references non-existent root certificate ${chain.rootCertificateId}`);
      }
      if (!certificateIds.has(chain.leafCertificateId)) {
        errors.push(`Trust chain ${chain.id} references non-existent leaf certificate ${chain.leafCertificateId}`);
      }
    }

    // Check ban records reference valid certificates
    const banRecords = await transaction.objectStore('ban_records').getAll();
    for (const ban of banRecords) {
      if (!certificateIds.has(ban.certificateId)) {
        errors.push(`Ban record ${ban.id} references non-existent certificate ${ban.certificateId}`);
      }
    }

    await transaction.done;

  } catch (error) {
    errors.push(`Database integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Export store configuration for external reference
export const CERTIFICATE_STORE_NAMES = {
  CERTIFICATES: 'certificates',
  CERTIFICATE_REQUESTS: 'certificate_requests',
  CAPTCHA_SOLUTIONS: 'captcha_solutions',
  TRUST_CHAINS: 'trust_chains',
  BAN_RECORDS: 'ban_records'
} as const;

// Export index names for query optimization
export const CERTIFICATE_INDEXES = {
  CERTIFICATES: {
    BY_CALLSIGN: 'by_callsign',
    BY_TYPE: 'by_type',
    BY_TRUST_LEVEL: 'by_trust_level',
    BY_EXPIRATION: 'by_expiration',
    BY_CREATED_AT: 'by_created_at',
    BY_STORAGE_LOCATION: 'by_storage_location'
  },
  CERTIFICATE_REQUESTS: {
    BY_CALLSIGN: 'by_callsign',
    BY_SERVER: 'by_server',
    BY_STATUS: 'by_status',
    BY_SUBMITTED_AT: 'by_submitted_at',
    BY_CERTIFICATE_ID: 'by_certificate_id',
    BY_EXPIRES_AT: 'by_expires_at'
  },
  CAPTCHA_SOLUTIONS: {
    BY_SOLVER: 'by_solver',
    BY_CHALLENGE_ID: 'by_challenge_id',
    BY_SOLVED_AT: 'by_solved_at',
    BY_SIGNING_CERT: 'by_signing_cert',
    BY_IS_VALID: 'by_is_valid'
  },
  TRUST_CHAINS: {
    BY_ROOT_CERT: 'by_root_cert',
    BY_LEAF_CERT: 'by_leaf_cert',
    BY_LAST_VALIDATED: 'by_last_validated',
    BY_TRUST_SCORE: 'by_trust_score',
    BY_IS_VALID: 'by_is_valid',
    BY_EXPIRES_AT: 'by_expires_at'
  },
  BAN_RECORDS: {
    BY_CALLSIGN: 'by_callsign',
    BY_SERVER: 'by_server',
    BY_BANNED_AT: 'by_banned_at',
    BY_CERTIFICATE_ID: 'by_certificate_id',
    BY_BAN_TYPE: 'by_ban_type',
    BY_SEVERITY: 'by_severity',
    BY_IS_ACTIVE: 'by_is_active',
    BY_EXPIRES_AT: 'by_expires_at'
  }
} as const;