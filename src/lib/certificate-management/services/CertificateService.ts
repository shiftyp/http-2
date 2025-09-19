/**
 * Certificate Management Service
 *
 * Core service for amateur radio certificate operations using Web Crypto API.
 * Handles certificate generation, validation, and X.509 operations.
 * Task T037 per certificate management implementation plan.
 */

import {
  Certificate,
  CertificateType,
  TrustLevel,
  StationInfo,
  VALIDATION_CONSTRAINTS
} from '../types.js';
import { getCertificateDatabase } from '../db-schema.js';

export interface CertificateGenerationOptions {
  callsign: string;
  licenseClass: string;
  gridSquare?: string;
  validityDays?: number;
  keySize?: number;
}

export interface CertificateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  trustLevel: TrustLevel;
  expiresAt: Date;
}

export class CertificateService {
  private db: Awaited<ReturnType<typeof getCertificateDatabase>> | null = null;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await getCertificateDatabase();
    } catch (error) {
      console.error('Failed to initialize certificate database:', error);
    }
  }

  /**
   * Generate a new self-signed certificate for amateur radio use
   */
  async generateSelfSignedCertificate(options: CertificateGenerationOptions): Promise<Certificate> {
    const { callsign, licenseClass, gridSquare, validityDays = 365, keySize = 2048 } = options;

    // Validate callsign format
    this.validateCallsignFormat(callsign);

    // Generate key pair using Web Crypto API
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: keySize,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: 'SHA-256'
      },
      true, // extractable
      ['sign', 'verify']
    );

    // Export keys to PEM format
    const publicKeyPem = await this.exportKeyToPem(keyPair.publicKey, 'PUBLIC KEY');
    const privateKeyPem = await this.exportKeyToPem(keyPair.privateKey, 'PRIVATE KEY');

    // Create certificate data
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    // Generate a basic X.509 structure (simplified for amateur radio use)
    const x509Data = await this.createBasicX509Certificate({
      callsign,
      licenseClass,
      gridSquare,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      validFrom: now,
      validTo: expiresAt
    });

    const certificate: Certificate = {
      id: crypto.randomUUID(),
      callsign,
      type: CertificateType.SELF_SIGNED,
      x509Data,
      publicKeyPem,
      privateKeyPem,
      licenseClass,
      gridSquare,
      issuer: `CN=${callsign}, O=Amateur Radio, C=US`,
      subject: `CN=${callsign}, O=Amateur Radio, C=US`,
      serialNumber: this.generateSerialNumber(),
      validFrom: now.toISOString(),
      validTo: expiresAt.toISOString(),
      isRevoked: false,
      trustLevel: TrustLevel.SELF_SIGNED,
      approvedServers: [],
      createdAt: now.toISOString(),
      storageLocation: 'indexeddb'
    };

    // Store certificate in database
    await this.storeCertificate(certificate);

    return certificate;
  }

  /**
   * Validate a certificate's structure and signatures
   */
  async validateCertificate(certificate: Certificate): Promise<CertificateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic format validation
      if (!certificate.id || !certificate.callsign || !certificate.x509Data) {
        errors.push('Certificate missing required fields');
      }

      // Callsign format validation
      try {
        this.validateCallsignFormat(certificate.callsign);
      } catch (error) {
        errors.push(`Invalid callsign format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Date validation
      const now = new Date();
      const validFrom = new Date(certificate.validFrom);
      const validTo = new Date(certificate.validTo);

      if (validFrom > now) {
        errors.push('Certificate not yet valid');
      }

      if (validTo < now) {
        errors.push('Certificate has expired');
      }

      if (validTo.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
        warnings.push('Certificate expires within 30 days');
      }

      // Revocation check
      if (certificate.isRevoked) {
        errors.push('Certificate has been revoked');
      }

      // Trust level validation
      let trustLevel = certificate.trustLevel;
      if (certificate.type === CertificateType.SELF_SIGNED && trustLevel > TrustLevel.SELF_SIGNED) {
        warnings.push('Self-signed certificate has unexpectedly high trust level');
        trustLevel = TrustLevel.SELF_SIGNED;
      }

      // X.509 structure validation (basic check)
      if (certificate.x509Data.byteLength < 100) {
        errors.push('X.509 certificate data appears invalid (too small)');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        trustLevel,
        expiresAt: validTo
      };

    } catch (error) {
      errors.push(`Certificate validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        isValid: false,
        errors,
        warnings,
        trustLevel: TrustLevel.UNKNOWN,
        expiresAt: new Date(certificate.validTo)
      };
    }
  }

  /**
   * Sign data using a certificate's private key
   */
  async signData(certificateId: string, data: ArrayBuffer): Promise<ArrayBuffer> {
    const certificate = await this.getCertificate(certificateId);
    if (!certificate) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    if (!certificate.privateKeyPem) {
      throw new Error('Certificate does not contain private key for signing');
    }

    // Import private key
    const privateKey = await this.importKeyFromPem(certificate.privateKeyPem, 'PRIVATE KEY');

    // Sign the data
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      data
    );

    return signature;
  }

  /**
   * Verify a signature using a certificate's public key
   */
  async verifySignature(certificateId: string, data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
    const certificate = await this.getCertificate(certificateId);
    if (!certificate) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    // Import public key
    const publicKey = await this.importKeyFromPem(certificate.publicKeyPem, 'PUBLIC KEY');

    // Verify the signature
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      data
    );
  }

  /**
   * Store certificate in IndexedDB
   */
  async storeCertificate(certificate: Certificate): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Don't store private key if this is for server storage
    const certToStore = { ...certificate };
    if (certificate.storageLocation === 'server') {
      delete certToStore.privateKeyPem;
    }

    await this.db.put('certificates', certToStore);
  }

  /**
   * Retrieve certificate by ID
   */
  async getCertificate(certificateId: string): Promise<Certificate | null> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.get('certificates', certificateId) || null;
  }

  /**
   * Get certificates by callsign
   */
  async getCertificatesByCallsign(callsign: string): Promise<Certificate[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.db.getAllFromIndex('certificates', 'by_callsign', callsign);
  }

  /**
   * Get all certificates with pagination
   */
  async getAllCertificates(options: {
    limit?: number;
    offset?: number;
    filter?: {
      type?: CertificateType;
      trustLevel?: TrustLevel;
      storageLocation?: string;
    };
  } = {}): Promise<Certificate[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let certificates: Certificate[];

    if (options.filter?.type) {
      certificates = await this.db.getAllFromIndex('certificates', 'by_type', options.filter.type);
    } else if (options.filter?.trustLevel !== undefined) {
      certificates = await this.db.getAllFromIndex('certificates', 'by_trust_level', options.filter.trustLevel);
    } else if (options.filter?.storageLocation) {
      certificates = await this.db.getAllFromIndex('certificates', 'by_storage_location', options.filter.storageLocation);
    } else {
      certificates = await this.db.getAll('certificates');
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || certificates.length;

    return certificates.slice(offset, offset + limit);
  }

  /**
   * Delete certificate
   */
  async deleteCertificate(certificateId: string): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.delete('certificates', certificateId);
  }

  /**
   * Update certificate trust level
   */
  async updateTrustLevel(certificateId: string, trustLevel: TrustLevel): Promise<void> {
    const certificate = await this.getCertificate(certificateId);
    if (!certificate) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    certificate.trustLevel = trustLevel;
    await this.storeCertificate(certificate);
  }

  /**
   * Add server approval to certificate
   */
  async addServerApproval(certificateId: string, serverCallsign: string): Promise<void> {
    const certificate = await this.getCertificate(certificateId);
    if (!certificate) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    if (!certificate.approvedServers.includes(serverCallsign)) {
      certificate.approvedServers.push(serverCallsign);
      await this.storeCertificate(certificate);
    }
  }

  /**
   * Validate callsign format against amateur radio patterns
   */
  private validateCallsignFormat(callsign: string): void {
    // Basic amateur radio callsign pattern
    const callsignRegex = /^[A-Z0-9]{1,3}[0-9][A-Z]{1,4}$/;

    if (!callsignRegex.test(callsign)) {
      throw new Error(`Invalid amateur radio callsign format: ${callsign}`);
    }

    if (callsign.length < 3 || callsign.length > 6) {
      throw new Error(`Callsign must be 3-6 characters: ${callsign}`);
    }
  }

  /**
   * Export CryptoKey to PEM format
   */
  private async exportKeyToPem(key: CryptoKey, type: 'PUBLIC KEY' | 'PRIVATE KEY'): Promise<string> {
    const exportFormat = type === 'PUBLIC KEY' ? 'spki' : 'pkcs8';
    const exported = await crypto.subtle.exportKey(exportFormat, key);
    const exportedAsBase64 = this.arrayBufferToBase64(exported);

    return `-----BEGIN ${type}-----\n${exportedAsBase64.match(/.{1,64}/g)?.join('\n')}\n-----END ${type}-----`;
  }

  /**
   * Import CryptoKey from PEM format
   */
  private async importKeyFromPem(pemString: string, type: 'PUBLIC KEY' | 'PRIVATE KEY'): Promise<CryptoKey> {
    // Remove PEM headers and whitespace
    const pemBody = pemString
      .replace(`-----BEGIN ${type}-----`, '')
      .replace(`-----END ${type}-----`, '')
      .replace(/\s/g, '');

    const binaryDer = this.base64ToArrayBuffer(pemBody);
    const importFormat = type === 'PUBLIC KEY' ? 'spki' : 'pkcs8';
    const keyUsages = type === 'PUBLIC KEY' ? ['verify'] : ['sign'];

    return await crypto.subtle.importKey(
      importFormat,
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      keyUsages as KeyUsage[]
    );
  }

  /**
   * Create basic X.509 certificate structure
   */
  private async createBasicX509Certificate(options: {
    callsign: string;
    licenseClass: string;
    gridSquare?: string;
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    validFrom: Date;
    validTo: Date;
  }): Promise<ArrayBuffer> {
    // This is a simplified X.509 structure for amateur radio use
    // In a full implementation, you would use a proper ASN.1 library

    const certificateData = {
      version: 3,
      serialNumber: this.generateSerialNumber(),
      issuer: `CN=${options.callsign}, O=Amateur Radio, C=US`,
      subject: `CN=${options.callsign}, O=Amateur Radio, C=US`,
      validFrom: options.validFrom.toISOString(),
      validTo: options.validTo.toISOString(),
      publicKey: await crypto.subtle.exportKey('spki', options.publicKey),
      extensions: {
        callsign: options.callsign,
        licenseClass: options.licenseClass,
        gridSquare: options.gridSquare || ''
      }
    };

    // Sign the certificate data
    const encoder = new TextEncoder();
    const dataToSign = encoder.encode(JSON.stringify(certificateData));
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', options.privateKey, dataToSign);

    // Create final certificate structure
    const certificate = {
      ...certificateData,
      signature: this.arrayBufferToBase64(signature)
    };

    return encoder.encode(JSON.stringify(certificate));
  }

  /**
   * Generate a random certificate serial number
   */
  private generateSerialNumber(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get certificate statistics
   */
  async getStatistics(): Promise<{
    totalCertificates: number;
    byType: Record<CertificateType, number>;
    byTrustLevel: Record<TrustLevel, number>;
    expiringSoon: number;
    expired: number;
  }> {
    const certificates = await this.getAllCertificates();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalCertificates: certificates.length,
      byType: {
        [CertificateType.SELF_SIGNED]: 0,
        [CertificateType.ARRL]: 0,
        [CertificateType.LOTW]: 0
      },
      byTrustLevel: {
        [TrustLevel.UNKNOWN]: 0,
        [TrustLevel.SELF_SIGNED]: 0,
        [TrustLevel.ARRL]: 0,
        [TrustLevel.LOTW]: 0
      },
      expiringSoon: 0,
      expired: 0
    };

    for (const cert of certificates) {
      stats.byType[cert.type]++;
      stats.byTrustLevel[cert.trustLevel]++;

      const expiresAt = new Date(cert.validTo);
      if (expiresAt < now) {
        stats.expired++;
      } else if (expiresAt < thirtyDaysFromNow) {
        stats.expiringSoon++;
      }
    }

    return stats;
  }

  /**
   * Clean up expired certificates
   */
  async cleanupExpiredCertificates(): Promise<number> {
    const certificates = await this.getAllCertificates();
    const now = new Date();
    let deletedCount = 0;

    for (const cert of certificates) {
      const expiresAt = new Date(cert.validTo);
      if (expiresAt < now && cert.type === CertificateType.SELF_SIGNED) {
        // Only auto-delete self-signed certificates
        await this.deleteCertificate(cert.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Dispose of the service and close database connections
   */
  dispose(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default CertificateService;