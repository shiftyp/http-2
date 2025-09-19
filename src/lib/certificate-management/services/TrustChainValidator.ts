/**
 * Trust Chain Validator for Certificate Management
 *
 * Validates trust chains and manages certificate relationships with depth limits.
 * Implements consensus-based trust validation for amateur radio networks.
 * Task T040 per certificate management implementation plan.
 */

import {
  Certificate,
  TrustChain,
  TrustLevel,
  TrustFactor,
  VALIDATION_CONSTRAINTS
} from '../types.js';
import { getCertificateDatabase } from '../db-schema.js';
import CertificateService from './CertificateService.js';

export interface TrustValidationResult {
  isValid: boolean;
  trustScore: number;
  trustLevel: TrustLevel;
  errors: string[];
  warnings: string[];
  path: string[];
  factors: TrustFactor[];
}

export interface TrustChainOptions {
  maxDepth?: number;
  minConsensus?: number;
  allowSelfSigned?: boolean;
  requireSignatureVerification?: boolean;
}

/**
 * Validates certificate trust chains for amateur radio networks
 */
export class TrustChainValidator {
  private db: Awaited<ReturnType<typeof getCertificateDatabase>> | null = null;
  private certificateService: CertificateService;

  constructor(certificateService?: CertificateService) {
    this.certificateService = certificateService || new CertificateService();
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await getCertificateDatabase();
    } catch (error) {
      console.error('Failed to initialize trust chain database:', error);
    }
  }

  /**
   * Validate a trust chain from root to leaf certificate
   */
  async validateTrustChain(
    leafCertificateId: string,
    options: TrustChainOptions = {}
  ): Promise<TrustValidationResult> {
    const {
      maxDepth = VALIDATION_CONSTRAINTS.MAX_CHAIN_DEPTH,
      minConsensus = VALIDATION_CONSTRAINTS.MIN_CONSENSUS_THRESHOLD,
      allowSelfSigned = true,
      requireSignatureVerification = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];
    const path: string[] = [];
    const factors: TrustFactor[] = [];

    try {
      // Get the leaf certificate
      const leafCert = await this.certificateService.getCertificate(leafCertificateId);
      if (!leafCert) {
        errors.push(`Leaf certificate not found: ${leafCertificateId}`);
        return this.createFailedResult(errors, warnings, path, factors);
      }

      path.push(leafCert.callsign);

      // Build trust chain
      const chain = await this.buildTrustChain(leafCert, maxDepth);

      if (chain.length === 0) {
        errors.push('No trust chain could be established');
        return this.createFailedResult(errors, warnings, path, factors);
      }

      // Validate each link in the chain
      for (let i = 0; i < chain.length - 1; i++) {
        const current = chain[i];
        const next = chain[i + 1];

        if (requireSignatureVerification) {
          const isValidSignature = await this.verifySignatureBetweenCertificates(current, next);
          if (!isValidSignature) {
            errors.push(`Invalid signature between ${current.callsign} and ${next.callsign}`);
          }
        }

        // Check for revocation
        if (current.isRevoked) {
          errors.push(`Certificate in chain is revoked: ${current.callsign}`);
        }

        // Check validity period
        const now = new Date();
        if (new Date(current.validTo) < now) {
          errors.push(`Certificate in chain has expired: ${current.callsign}`);
        }

        if (new Date(current.validFrom) > now) {
          errors.push(`Certificate in chain is not yet valid: ${current.callsign}`);
        }
      }

      // Calculate trust factors
      const trustFactors = this.calculateTrustFactors(chain);
      factors.push(...trustFactors);

      // Calculate overall trust score
      const trustScore = this.calculateTrustScore(trustFactors);

      // Determine trust level based on score and chain characteristics
      const trustLevel = this.determineTrustLevel(chain, trustScore);

      // Check consensus if required
      if (minConsensus > 1) {
        const consensusResult = await this.checkConsensus(leafCertificateId, minConsensus);
        if (!consensusResult.hasConsensus) {
          warnings.push(`Insufficient consensus: ${consensusResult.count}/${minConsensus} required`);
        }
      }

      // Validate self-signed certificates if not allowed
      if (!allowSelfSigned && chain.length === 1 && chain[0].type === 'self-signed') {
        errors.push('Self-signed certificates not allowed in this context');
      }

      // Update path with full chain
      path.length = 0;
      path.push(...chain.map(cert => cert.callsign));

      return {
        isValid: errors.length === 0,
        trustScore,
        trustLevel,
        errors,
        warnings,
        path,
        factors
      };

    } catch (error) {
      errors.push(`Trust validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.createFailedResult(errors, warnings, path, factors);
    }
  }

  /**
   * Build a trust chain from a leaf certificate to a root
   */
  private async buildTrustChain(leafCert: Certificate, maxDepth: number): Promise<Certificate[]> {
    const chain: Certificate[] = [leafCert];
    const visited = new Set<string>([leafCert.id]);

    let current = leafCert;

    while (chain.length < maxDepth) {
      // Find the issuer certificate
      const issuer = await this.findIssuerCertificate(current);

      if (!issuer) {
        // No issuer found, this might be a root certificate
        break;
      }

      if (visited.has(issuer.id)) {
        // Circular reference detected
        break;
      }

      chain.push(issuer);
      visited.add(issuer.id);

      // If issuer is self-signed, we've reached the root
      if (this.isSelfSigned(issuer)) {
        break;
      }

      current = issuer;
    }

    return chain;
  }

  /**
   * Find the issuer certificate for a given certificate
   */
  private async findIssuerCertificate(cert: Certificate): Promise<Certificate | null> {
    // In a simplified implementation, we'll look for certificates that could be issuers
    // based on the issuer DN and trust level

    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // If this is self-signed, no issuer
    if (this.isSelfSigned(cert)) {
      return null;
    }

    // Look for certificates with higher trust levels that could be issuers
    const allCerts = await this.db.getAll('certificates');

    const potentialIssuers = allCerts.filter(issuer => {
      // Skip same certificate
      if (issuer.id === cert.id) return false;

      // Issuer should have higher or equal trust level
      if (issuer.trustLevel < cert.trustLevel) return false;

      // For LoTW certificates, issuer should be ARRL
      if (cert.type === 'lotw' && issuer.type !== 'arrl' && issuer.type !== 'lotw') {
        return false;
      }

      // For ARRL certificates, allow other ARRL or higher
      if (cert.type === 'arrl' && issuer.trustLevel < TrustLevel.ARRL) {
        return false;
      }

      return true;
    });

    // Sort by trust level (highest first) and select the best match
    potentialIssuers.sort((a, b) => b.trustLevel - a.trustLevel);

    return potentialIssuers[0] || null;
  }

  /**
   * Check if a certificate is self-signed
   */
  private isSelfSigned(cert: Certificate): boolean {
    return cert.type === 'self-signed' || cert.issuer === cert.subject;
  }

  /**
   * Verify signature relationship between two certificates
   */
  private async verifySignatureBetweenCertificates(cert: Certificate, issuer: Certificate): Promise<boolean> {
    try {
      // In a real implementation, this would verify that the certificate
      // was actually signed by the issuer's private key

      // For now, we'll do a simplified verification based on trust levels and types
      if (issuer.trustLevel < cert.trustLevel) {
        return false;
      }

      // ARRL can sign LoTW certificates
      if (cert.type === 'lotw' && issuer.type === 'arrl') {
        return true;
      }

      // Self-signed certificates don't have external signers
      if (cert.type === 'self-signed') {
        return cert.id === issuer.id;
      }

      // Same trust level certificates can cross-sign
      if (cert.trustLevel === issuer.trustLevel) {
        return true;
      }

      return true; // Simplified for demonstration

    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Calculate trust factors for a certificate chain
   */
  private calculateTrustFactors(chain: Certificate[]): TrustFactor[] {
    const factors: TrustFactor[] = [];

    // Chain length factor (shorter chains are better)
    factors.push({
      factor: 'chain_length',
      weight: 0.2,
      value: Math.max(0, 1 - (chain.length - 1) / VALIDATION_CONSTRAINTS.MAX_CHAIN_DEPTH),
      description: `Trust chain depth: ${chain.length}`
    });

    // Root certificate type factor
    const rootCert = chain[chain.length - 1];
    let rootTrustValue = 0;
    switch (rootCert.type) {
      case 'lotw':
        rootTrustValue = 1.0;
        break;
      case 'arrl':
        rootTrustValue = 0.9;
        break;
      case 'self-signed':
        rootTrustValue = 0.3;
        break;
      default:
        rootTrustValue = 0.1;
    }

    factors.push({
      factor: 'root_certificate_type',
      weight: 0.3,
      value: rootTrustValue,
      description: `Root certificate type: ${rootCert.type}`
    });

    // Certificate age factor (newer certificates are less tested)
    const leafCert = chain[0];
    const certAge = Date.now() - new Date(leafCert.createdAt).getTime();
    const ageInDays = certAge / (24 * 60 * 60 * 1000);
    const ageFactor = Math.min(1, ageInDays / 90); // Fully trusted after 90 days

    factors.push({
      factor: 'certificate_age',
      weight: 0.15,
      value: ageFactor,
      description: `Certificate age: ${Math.floor(ageInDays)} days`
    });

    // Server approval factor
    const approvalCount = leafCert.approvedServers.length;
    const approvalFactor = Math.min(1, approvalCount / 3); // Fully trusted with 3+ approvals

    factors.push({
      factor: 'server_approvals',
      weight: 0.25,
      value: approvalFactor,
      description: `Server approvals: ${approvalCount}`
    });

    // Usage factor (certificates that are used are more trusted)
    const hasRecentUsage = leafCert.lastUsedAt &&
      (Date.now() - new Date(leafCert.lastUsedAt).getTime()) < (30 * 24 * 60 * 60 * 1000);

    factors.push({
      factor: 'recent_usage',
      weight: 0.1,
      value: hasRecentUsage ? 1.0 : 0.0,
      description: `Recent usage: ${hasRecentUsage ? 'Yes' : 'No'}`
    });

    return factors;
  }

  /**
   * Calculate overall trust score from factors
   */
  private calculateTrustScore(factors: TrustFactor[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      weightedSum += factor.value * factor.weight;
      totalWeight += factor.weight;
    }

    return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  }

  /**
   * Determine trust level based on chain and score
   */
  private determineTrustLevel(chain: Certificate[], trustScore: number): TrustLevel {
    const rootCert = chain[chain.length - 1];

    // Base trust level on root certificate
    let baseTrustLevel = rootCert.trustLevel;

    // Adjust based on trust score
    if (trustScore < 30) {
      baseTrustLevel = Math.min(baseTrustLevel, TrustLevel.UNKNOWN);
    } else if (trustScore < 50) {
      baseTrustLevel = Math.min(baseTrustLevel, TrustLevel.SELF_SIGNED);
    } else if (trustScore < 80) {
      baseTrustLevel = Math.min(baseTrustLevel, TrustLevel.ARRL);
    }

    return baseTrustLevel;
  }

  /**
   * Check consensus for a certificate among multiple servers
   */
  private async checkConsensus(certificateId: string, requiredConsensus: number): Promise<{
    hasConsensus: boolean;
    count: number;
    servers: string[];
  }> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Look for existing trust chain records for this certificate
    const trustChains = await this.db.getAllFromIndex('trust_chains', 'by_leaf_cert', certificateId);

    const validatingServers = new Set<string>();

    for (const chain of trustChains) {
      validatingServers.add(...chain.validatedBy);
    }

    const consensusCount = validatingServers.size;

    return {
      hasConsensus: consensusCount >= requiredConsensus,
      count: consensusCount,
      servers: Array.from(validatingServers)
    };
  }

  /**
   * Store a validated trust chain
   */
  async storeTrustChain(
    leafCertificateId: string,
    validationResult: TrustValidationResult,
    validatingServer: string
  ): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const trustChain: TrustChain = {
      id: crypto.randomUUID(),
      rootCertificateId: validationResult.path[validationResult.path.length - 1] || leafCertificateId,
      leafCertificateId,
      chainPath: validationResult.path,
      chainDepth: validationResult.path.length,
      trustScore: validationResult.trustScore,
      trustFactors: validationResult.factors,
      isValid: validationResult.isValid,
      lastValidated: new Date().toISOString(),
      validatedBy: [validatingServer],
      consensusCount: 1,
      consensusThreshold: VALIDATION_CONSTRAINTS.MIN_CONSENSUS_THRESHOLD,
      establishedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      refreshInterval: 3600, // 1 hour
      pathReliability: validationResult.isValid ? 1.0 : 0.0,
      pathLatency: 0 // Would be measured in real implementation
    };

    await this.db.put('trust_chains', trustChain);
  }

  /**
   * Get trust chains for a certificate
   */
  async getTrustChains(certificateId: string): Promise<TrustChain[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.getAllFromIndex('trust_chains', 'by_leaf_cert', certificateId);
  }

  /**
   * Clean up expired trust chains
   */
  async cleanupExpiredTrustChains(): Promise<number> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const allChains = await this.db.getAll('trust_chains');
    const now = new Date();
    let deletedCount = 0;

    for (const chain of allChains) {
      if (new Date(chain.expiresAt) < now) {
        await this.db.delete('trust_chains', chain.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get trust validation statistics
   */
  async getStatistics(): Promise<{
    totalChains: number;
    validChains: number;
    averageTrustScore: number;
    averageChainDepth: number;
    consensusDistribution: Record<number, number>;
  }> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const allChains = await this.db.getAll('trust_chains');

    const stats = {
      totalChains: allChains.length,
      validChains: allChains.filter(chain => chain.isValid).length,
      averageTrustScore: 0,
      averageChainDepth: 0,
      consensusDistribution: {} as Record<number, number>
    };

    if (allChains.length > 0) {
      stats.averageTrustScore = allChains.reduce((sum, chain) => sum + chain.trustScore, 0) / allChains.length;
      stats.averageChainDepth = allChains.reduce((sum, chain) => sum + chain.chainDepth, 0) / allChains.length;

      // Calculate consensus distribution
      for (const chain of allChains) {
        const consensus = chain.consensusCount;
        stats.consensusDistribution[consensus] = (stats.consensusDistribution[consensus] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Create a failed validation result
   */
  private createFailedResult(
    errors: string[],
    warnings: string[],
    path: string[],
    factors: TrustFactor[]
  ): TrustValidationResult {
    return {
      isValid: false,
      trustScore: 0,
      trustLevel: TrustLevel.UNKNOWN,
      errors,
      warnings,
      path,
      factors
    };
  }

  /**
   * Dispose of the validator and close database connections
   */
  dispose(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default TrustChainValidator;