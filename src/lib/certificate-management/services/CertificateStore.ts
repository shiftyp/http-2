/**
 * Certificate Store Service
 *
 * IndexedDB wrapper for certificate storage and retrieval.
 * Provides efficient querying and caching for amateur radio certificates.
 * Task T041 per certificate management implementation plan.
 */

import {
  Certificate,
  CertificateRequest,
  SignedCAPTCHASolution,
  TrustChain,
  BanRecord,
  CertificateType,
  TrustLevel,
  RequestStatus
} from '../types.js';
import {
  getCertificateDatabase,
  type CertificateDBSchema,
  CERTIFICATE_INDEXES
} from '../db-schema.js';

export interface CertificateSearchOptions {
  callsign?: string;
  type?: CertificateType;
  trustLevel?: TrustLevel;
  storageLocation?: string;
  validAt?: Date;
  limit?: number;
  offset?: number;
}

export interface RequestSearchOptions {
  callsign?: string;
  serverCallsign?: string;
  status?: RequestStatus;
  submittedAfter?: Date;
  submittedBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * High-level certificate storage service with caching and optimized queries
 */
export class CertificateStore {
  private db: Awaited<ReturnType<typeof getCertificateDatabase>> | null = null;
  private cache = new Map<string, Certificate>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await getCertificateDatabase();
    } catch (error) {
      console.error('Failed to initialize certificate store database:', error);
    }
  }

  /**
   * Store a certificate with automatic caching
   */
  async storeCertificate(certificate: Certificate): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Validate certificate before storing
    this.validateCertificate(certificate);

    // Store in database
    await this.db.put('certificates', certificate);

    // Update cache
    this.cache.set(certificate.id, { ...certificate });
    this.cacheTimestamps.set(certificate.id, Date.now());

    // Update last used timestamp
    certificate.lastUsedAt = new Date().toISOString();
  }

  /**
   * Get certificate by ID with caching
   */
  async getCertificate(certificateId: string): Promise<Certificate | null> {
    // Check cache first
    if (this.cache.has(certificateId)) {
      const timestamp = this.cacheTimestamps.get(certificateId) || 0;
      if (Date.now() - timestamp < this.cacheTimeout) {
        return this.cache.get(certificateId) || null;
      } else {
        // Cache expired
        this.cache.delete(certificateId);
        this.cacheTimestamps.delete(certificateId);
      }
    }

    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const certificate = await this.db.get('certificates', certificateId);

    if (certificate) {
      // Add to cache
      this.cache.set(certificateId, certificate);
      this.cacheTimestamps.set(certificateId, Date.now());
    }

    return certificate || null;
  }

  /**
   * Search certificates with flexible criteria
   */
  async searchCertificates(options: CertificateSearchOptions = {}): Promise<Certificate[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let certificates: Certificate[];

    // Use appropriate index for efficient querying
    if (options.callsign) {
      certificates = await this.db.getAllFromIndex('certificates', CERTIFICATE_INDEXES.CERTIFICATES.BY_CALLSIGN, options.callsign);
    } else if (options.type) {
      certificates = await this.db.getAllFromIndex('certificates', CERTIFICATE_INDEXES.CERTIFICATES.BY_TYPE, options.type);
    } else if (options.trustLevel !== undefined) {
      certificates = await this.db.getAllFromIndex('certificates', CERTIFICATE_INDEXES.CERTIFICATES.BY_TRUST_LEVEL, options.trustLevel);
    } else if (options.storageLocation) {
      certificates = await this.db.getAllFromIndex('certificates', CERTIFICATE_INDEXES.CERTIFICATES.BY_STORAGE_LOCATION, options.storageLocation);
    } else {
      certificates = await this.db.getAll('certificates');
    }

    // Apply additional filters
    certificates = certificates.filter(cert => {
      if (options.validAt) {
        const validAt = options.validAt;
        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);
        if (validAt < validFrom || validAt > validTo) {
          return false;
        }
      }

      return true;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || certificates.length;

    return certificates.slice(offset, offset + limit);
  }

  /**
   * Get certificates by callsign (optimized)
   */
  async getCertificatesByCallsign(callsign: string): Promise<Certificate[]> {
    return this.searchCertificates({ callsign });
  }

  /**
   * Get certificates expiring soon
   */
  async getCertificatesExpiringSoon(daysAhead: number = 30): Promise<Certificate[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const futureDateString = futureDate.toISOString();

    // Get certificates that expire before the future date
    const expiring = await this.db.getAllFromIndex('certificates', CERTIFICATE_INDEXES.CERTIFICATES.BY_EXPIRATION, IDBKeyRange.upperBound(futureDateString));

    // Filter out already expired certificates
    const now = new Date().toISOString();
    return expiring.filter(cert => cert.validTo > now);
  }

  /**
   * Delete certificate and clear from cache
   */
  async deleteCertificate(certificateId: string): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.delete('certificates', certificateId);

    // Remove from cache
    this.cache.delete(certificateId);
    this.cacheTimestamps.delete(certificateId);
  }

  /**
   * Store certificate request
   */
  async storeRequest(request: CertificateRequest): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.put('certificate_requests', request);
  }

  /**
   * Get certificate request by ID
   */
  async getRequest(requestId: string): Promise<CertificateRequest | null> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.get('certificate_requests', requestId) || null;
  }

  /**
   * Search certificate requests
   */
  async searchRequests(options: RequestSearchOptions = {}): Promise<CertificateRequest[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let requests: CertificateRequest[];

    // Use appropriate index
    if (options.callsign) {
      requests = await this.db.getAllFromIndex('certificate_requests', CERTIFICATE_INDEXES.CERTIFICATE_REQUESTS.BY_CALLSIGN, options.callsign);
    } else if (options.serverCallsign) {
      requests = await this.db.getAllFromIndex('certificate_requests', CERTIFICATE_INDEXES.CERTIFICATE_REQUESTS.BY_SERVER, options.serverCallsign);
    } else if (options.status) {
      requests = await this.db.getAllFromIndex('certificate_requests', CERTIFICATE_INDEXES.CERTIFICATE_REQUESTS.BY_STATUS, options.status);
    } else {
      requests = await this.db.getAll('certificate_requests');
    }

    // Apply date filters
    if (options.submittedAfter || options.submittedBefore) {
      requests = requests.filter(req => {
        const submittedAt = new Date(req.submittedAt);
        if (options.submittedAfter && submittedAt < options.submittedAfter) {
          return false;
        }
        if (options.submittedBefore && submittedAt > options.submittedBefore) {
          return false;
        }
        return true;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || requests.length;

    return requests.slice(offset, offset + limit);
  }

  /**
   * Store CAPTCHA solution
   */
  async storeCAPTCHASolution(solution: SignedCAPTCHASolution): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.put('captcha_solutions', solution);
  }

  /**
   * Get CAPTCHA solution by ID
   */
  async getCAPTCHASolution(solutionId: string): Promise<SignedCAPTCHASolution | null> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.get('captcha_solutions', solutionId) || null;
  }

  /**
   * Get CAPTCHA solutions by solver
   */
  async getCAPTCHASolutionsBySolver(callsign: string): Promise<SignedCAPTCHASolution[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.getAllFromIndex('captcha_solutions', CERTIFICATE_INDEXES.CAPTCHA_SOLUTIONS.BY_SOLVER, callsign);
  }

  /**
   * Store trust chain
   */
  async storeTrustChain(trustChain: TrustChain): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.put('trust_chains', trustChain);
  }

  /**
   * Get trust chains for certificate
   */
  async getTrustChains(certificateId: string): Promise<TrustChain[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.getAllFromIndex('trust_chains', CERTIFICATE_INDEXES.TRUST_CHAINS.BY_LEAF_CERT, certificateId);
  }

  /**
   * Store ban record
   */
  async storeBanRecord(banRecord: BanRecord): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.put('ban_records', banRecord);
  }

  /**
   * Get active ban records for callsign
   */
  async getActiveBanRecords(callsign: string): Promise<BanRecord[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const allBans = await this.db.getAllFromIndex('ban_records', CERTIFICATE_INDEXES.BAN_RECORDS.BY_CALLSIGN, callsign);

    // Filter for active bans
    const now = new Date();
    return allBans.filter(ban => {
      if (!ban.isActive) return false;
      if (ban.expiresAt && new Date(ban.expiresAt) < now) return false;
      return true;
    });
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    certificates: number;
    requests: number;
    captchaSolutions: number;
    trustChains: number;
    banRecords: number;
    cacheSize: number;
    cacheHitRate: number;
  }> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [
      certificateCount,
      requestCount,
      captchaSolutionCount,
      trustChainCount,
      banRecordCount
    ] = await Promise.all([
      this.db.count('certificates'),
      this.db.count('certificate_requests'),
      this.db.count('captcha_solutions'),
      this.db.count('trust_chains'),
      this.db.count('ban_records')
    ]);

    return {
      certificates: certificateCount,
      requests: requestCount,
      captchaSolutions: captchaSolutionCount,
      trustChains: trustChainCount,
      banRecords: banRecordCount,
      cacheSize: this.cache.size,
      cacheHitRate: 0 // Would be calculated with actual cache statistics
    };
  }

  /**
   * Clean up expired data
   */
  async cleanupExpiredData(): Promise<{
    certificatesDeleted: number;
    requestsDeleted: number;
    solutionsDeleted: number;
    trustChainsDeleted: number;
    bansDeleted: number;
  }> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const now = new Date();
    let certificatesDeleted = 0;
    let requestsDeleted = 0;
    let solutionsDeleted = 0;
    let trustChainsDeleted = 0;
    let bansDeleted = 0;

    // Clean up expired certificates (only self-signed ones)
    const expiredCerts = await this.db.getAllFromIndex('certificates', CERTIFICATE_INDEXES.CERTIFICATES.BY_EXPIRATION, IDBKeyRange.upperBound(now.toISOString()));
    for (const cert of expiredCerts) {
      if (cert.type === CertificateType.SELF_SIGNED) {
        await this.db.delete('certificates', cert.id);
        this.cache.delete(cert.id);
        this.cacheTimestamps.delete(cert.id);
        certificatesDeleted++;
      }
    }

    // Clean up expired requests
    const allRequests = await this.db.getAll('certificate_requests');
    for (const request of allRequests) {
      if (new Date(request.expiresAt) < now) {
        await this.db.delete('certificate_requests', request.id);
        requestsDeleted++;
      }
    }

    // Clean up old CAPTCHA solutions (older than 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oldSolutions = await this.db.getAllFromIndex('captcha_solutions', CERTIFICATE_INDEXES.CAPTCHA_SOLUTIONS.BY_SOLVED_AT, IDBKeyRange.upperBound(thirtyDaysAgo.toISOString()));
    for (const solution of oldSolutions) {
      await this.db.delete('captcha_solutions', solution.id);
      solutionsDeleted++;
    }

    // Clean up expired trust chains
    const allTrustChains = await this.db.getAll('trust_chains');
    for (const chain of allTrustChains) {
      if (new Date(chain.expiresAt) < now) {
        await this.db.delete('trust_chains', chain.id);
        trustChainsDeleted++;
      }
    }

    // Clean up expired bans
    const expiredBans = await this.db.getAllFromIndex('ban_records', CERTIFICATE_INDEXES.BAN_RECORDS.BY_EXPIRES_AT, IDBKeyRange.upperBound(now.toISOString()));
    for (const ban of expiredBans) {
      if (ban.severity === 'temporary') {
        ban.isActive = false;
        await this.db.put('ban_records', ban);
        bansDeleted++;
      }
    }

    return {
      certificatesDeleted,
      requestsDeleted,
      solutionsDeleted,
      trustChainsDeleted,
      bansDeleted
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Validate certificate before storing
   */
  private validateCertificate(certificate: Certificate): void {
    if (!certificate.id) {
      throw new Error('Certificate ID is required');
    }

    if (!certificate.callsign) {
      throw new Error('Certificate callsign is required');
    }

    if (!certificate.x509Data || certificate.x509Data.byteLength === 0) {
      throw new Error('Certificate X.509 data is required');
    }

    if (!certificate.publicKeyPem) {
      throw new Error('Certificate public key is required');
    }

    // Validate dates
    const validFrom = new Date(certificate.validFrom);
    const validTo = new Date(certificate.validTo);

    if (isNaN(validFrom.getTime())) {
      throw new Error('Invalid validFrom date');
    }

    if (isNaN(validTo.getTime())) {
      throw new Error('Invalid validTo date');
    }

    if (validTo <= validFrom) {
      throw new Error('validTo must be after validFrom');
    }

    // Validate trust level
    if (!Object.values(TrustLevel).includes(certificate.trustLevel)) {
      throw new Error('Invalid trust level');
    }

    // Validate type
    if (!Object.values(CertificateType).includes(certificate.type)) {
      throw new Error('Invalid certificate type');
    }
  }

  /**
   * Export data for backup
   */
  async exportData(): Promise<{
    certificates: Certificate[];
    requests: CertificateRequest[];
    captchaSolutions: SignedCAPTCHASolution[];
    trustChains: TrustChain[];
    banRecords: BanRecord[];
    exportedAt: string;
  }> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [certificates, requests, captchaSolutions, trustChains, banRecords] = await Promise.all([
      this.db.getAll('certificates'),
      this.db.getAll('certificate_requests'),
      this.db.getAll('captcha_solutions'),
      this.db.getAll('trust_chains'),
      this.db.getAll('ban_records')
    ]);

    return {
      certificates,
      requests,
      captchaSolutions,
      trustChains,
      banRecords,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import data from backup
   */
  async importData(data: {
    certificates?: Certificate[];
    requests?: CertificateRequest[];
    captchaSolutions?: SignedCAPTCHASolution[];
    trustChains?: TrustChain[];
    banRecords?: BanRecord[];
  }): Promise<{
    certificatesImported: number;
    requestsImported: number;
    solutionsImported: number;
    trustChainsImported: number;
    bansImported: number;
  }> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stats = {
      certificatesImported: 0,
      requestsImported: 0,
      solutionsImported: 0,
      trustChainsImported: 0,
      bansImported: 0
    };

    // Import certificates
    if (data.certificates) {
      for (const cert of data.certificates) {
        try {
          await this.storeCertificate(cert);
          stats.certificatesImported++;
        } catch (error) {
          console.warn(`Failed to import certificate ${cert.id}:`, error);
        }
      }
    }

    // Import requests
    if (data.requests) {
      for (const request of data.requests) {
        try {
          await this.storeRequest(request);
          stats.requestsImported++;
        } catch (error) {
          console.warn(`Failed to import request ${request.id}:`, error);
        }
      }
    }

    // Import CAPTCHA solutions
    if (data.captchaSolutions) {
      for (const solution of data.captchaSolutions) {
        try {
          await this.storeCAPTCHASolution(solution);
          stats.solutionsImported++;
        } catch (error) {
          console.warn(`Failed to import CAPTCHA solution ${solution.id}:`, error);
        }
      }
    }

    // Import trust chains
    if (data.trustChains) {
      for (const chain of data.trustChains) {
        try {
          await this.storeTrustChain(chain);
          stats.trustChainsImported++;
        } catch (error) {
          console.warn(`Failed to import trust chain ${chain.id}:`, error);
        }
      }
    }

    // Import ban records
    if (data.banRecords) {
      for (const ban of data.banRecords) {
        try {
          await this.storeBanRecord(ban);
          stats.bansImported++;
        } catch (error) {
          console.warn(`Failed to import ban record ${ban.id}:`, error);
        }
      }
    }

    return stats;
  }

  /**
   * Dispose of the store and close database connections
   */
  dispose(): void {
    this.clearCache();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default CertificateStore;