/**
 * Certificate verification library for amateur radio certificates
 * Handles X.509 certificates with custom extensions for ham radio
 */

export interface Certificate {
  fingerprint: string;
  serialNumber: string;
  subject: {
    commonName: string;
    organization?: string;
    country: string;
  };
  issuer: {
    commonName: string;
    organization?: string;
    country: string;
  };
  notBefore: Date;
  notAfter: Date | null; // Certificates don't expire in this system
  publicKey: string;
  signatureAlgorithm: string;
  signature: string;
  extensions: {
    callsign: string;
    licenseClass: 'Technician' | 'General' | 'Extra';
    canIssue: boolean;
    issuerChain: string[];
  };
  chain: Certificate[];
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  trustedAt?: string;
  chainDepth?: number;
}

export class CertificateVerifier {
  private trustedRoots: Map<string, Certificate> = new Map();
  private trustedIntermediates: Map<string, Certificate> = new Map();
  private blacklist: Set<string> = new Set();

  constructor() {
    this.loadTrustedRoots();
  }

  /**
   * Load pre-trusted root certificates
   */
  private async loadTrustedRoots(): Promise<void> {
    // In production, these would be loaded from IndexedDB or bundled
    // For now, we'll add them programmatically
    const trustedRootCAs = [
      'ARRL LOTW Root CA',
      'Amateur Radio Digital Communications Root',
      'RSGB Certificate Authority'
    ];

    // These would be actual certificate objects in production
    trustedRootCAs.forEach(ca => {
      // Placeholder for trusted root loading
      // this.trustedRoots.set(fingerprint, certificate);
    });
  }

  /**
   * Verify a single certificate
   */
  async verifyCertificate(cert: Certificate): Promise<VerificationResult> {
    // Check if certificate is blacklisted
    if (this.blacklist.has(cert.fingerprint)) {
      return {
        valid: false,
        reason: 'Certificate is blacklisted'
      };
    }

    // Check basic certificate properties
    if (!this.validateCertificateStructure(cert)) {
      return {
        valid: false,
        reason: 'Invalid certificate structure'
      };
    }

    // Verify callsign matches subject common name
    if (cert.subject.commonName !== cert.extensions.callsign) {
      return {
        valid: false,
        reason: 'Callsign does not match subject CN'
      };
    }

    // No expiry validation (certificates don't expire in this system)
    // But check notBefore date
    const now = new Date();
    if (cert.notBefore > now) {
      return {
        valid: false,
        reason: 'Certificate not yet valid'
      };
    }

    // If this is a trusted root, it's valid
    if (this.trustedRoots.has(cert.fingerprint)) {
      return {
        valid: true,
        trustedAt: cert.subject.commonName,
        chainDepth: 0
      };
    }

    // If we have a chain, verify it
    if (cert.chain && cert.chain.length > 0) {
      return this.verifyChain(cert.chain);
    }

    // Certificate not trusted and no chain provided
    return {
      valid: false,
      reason: 'Certificate not trusted and no chain provided'
    };
  }

  /**
   * Verify a certificate chain
   */
  async verifyChain(chain: Certificate[]): Promise<VerificationResult> {
    if (chain.length === 0) {
      return {
        valid: false,
        reason: 'Empty certificate chain'
      };
    }

    // Start from the end-entity certificate
    let current = chain[0];

    for (let i = 1; i <= chain.length; i++) {
      if (i === chain.length) {
        // We've reached the end of the chain
        // Check if the last certificate is trusted
        if (this.trustedRoots.has(current.fingerprint) ||
            this.trustedIntermediates.has(current.fingerprint)) {
          return {
            valid: true,
            trustedAt: current.subject.commonName,
            chainDepth: i - 1
          };
        }
        return {
          valid: false,
          reason: 'Chain does not terminate at trusted root'
        };
      }

      const issuer = chain[i];

      // Verify current cert is signed by issuer
      if (!await this.verifySignature(current, issuer)) {
        return {
          valid: false,
          reason: `Invalid signature at chain depth ${i}`
        };
      }

      // Check if issuer is trusted
      if (this.trustedRoots.has(issuer.fingerprint) ||
          this.trustedIntermediates.has(issuer.fingerprint)) {
        return {
          valid: true,
          trustedAt: issuer.subject.commonName,
          chainDepth: i
        };
      }

      // Move up the chain
      current = issuer;
    }

    return {
      valid: false,
      reason: 'Failed to verify certificate chain'
    };
  }

  /**
   * Verify certificate signature using Web Crypto API
   */
  async verifySignature(cert: Certificate, issuer: Certificate): Promise<boolean> {
    try {
      // Convert PEM public key to CryptoKey
      const publicKey = await this.importPublicKey(issuer.publicKey);

      // Prepare the data that was signed (TBS Certificate)
      const tbsCertificate = this.getTBSCertificate(cert);

      // Convert signature from hex/base64 to ArrayBuffer
      const signature = this.hexToArrayBuffer(cert.signature);

      // Verify using Web Crypto API
      const isValid = await crypto.subtle.verify(
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        publicKey,
        signature,
        tbsCertificate
      );

      return isValid;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Import PEM public key for use with Web Crypto API
   */
  private async importPublicKey(pem: string): Promise<CryptoKey> {
    // Remove PEM headers and decode base64
    const pemContents = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    const binaryDer = atob(pemContents);
    const arrayBuffer = new ArrayBuffer(binaryDer.length);
    const view = new Uint8Array(arrayBuffer);

    for (let i = 0; i < binaryDer.length; i++) {
      view[i] = binaryDer.charCodeAt(i);
    }

    return crypto.subtle.importKey(
      'spki',
      arrayBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      true,
      ['verify']
    );
  }

  /**
   * Extract TBS (To Be Signed) certificate data
   */
  private getTBSCertificate(cert: Certificate): ArrayBuffer {
    // In a real implementation, this would extract the actual TBS portion
    // of the certificate. For now, we'll create a canonical representation
    const data = JSON.stringify({
      serialNumber: cert.serialNumber,
      subject: cert.subject,
      issuer: cert.issuer,
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      publicKey: cert.publicKey,
      extensions: cert.extensions
    });

    const encoder = new TextEncoder();
    return encoder.encode(data).buffer;
  }

  /**
   * Convert hex string to ArrayBuffer
   */
  private hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  }

  /**
   * Validate certificate structure
   */
  private validateCertificateStructure(cert: Certificate): boolean {
    // Check required fields
    if (!cert.fingerprint || !cert.serialNumber) {
      return false;
    }

    if (!cert.subject?.commonName || !cert.issuer?.commonName) {
      return false;
    }

    if (!cert.publicKey || !cert.signature) {
      return false;
    }

    if (!cert.extensions?.callsign || !cert.extensions?.licenseClass) {
      return false;
    }

    // Validate license class
    const validClasses = ['Technician', 'General', 'Extra'];
    if (!validClasses.includes(cert.extensions.licenseClass)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a certificate is blacklisted
   */
  async checkBlacklist(fingerprint: string): Promise<boolean> {
    return this.blacklist.has(fingerprint);
  }

  /**
   * Add a certificate to the blacklist
   */
  async blacklistCertificate(fingerprint: string, reason: string): Promise<void> {
    this.blacklist.add(fingerprint);

    // Store in IndexedDB
    const db = await this.openDatabase();
    const tx = db.transaction(['blacklist'], 'readwrite');
    const store = tx.objectStore('blacklist');

    await store.put({
      fingerprint,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Extract callsign from certificate
   */
  extractCallsign(cert: Certificate): string {
    return cert.extensions.callsign;
  }

  /**
   * Add a trusted certificate
   */
  async addTrustedCertificate(cert: Certificate, level: 'root' | 'intermediate'): Promise<void> {
    const map = level === 'root' ? this.trustedRoots : this.trustedIntermediates;
    map.set(cert.fingerprint, cert);

    // Store in IndexedDB
    const db = await this.openDatabase();
    const tx = db.transaction(['certificates'], 'readwrite');
    const store = tx.objectStore('certificates');

    await store.put({
      ...cert,
      trustLevel: level,
      addedAt: Date.now()
    });
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('distributed-servers', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('certificates')) {
          const certStore = db.createObjectStore('certificates', { keyPath: 'fingerprint' });
          certStore.createIndex('callsign', 'extensions.callsign');
          certStore.createIndex('trustLevel', 'trustLevel');
        }

        if (!db.objectStoreNames.contains('blacklist')) {
          db.createObjectStore('blacklist', { keyPath: 'fingerprint' });
        }
      };
    });
  }

  /**
   * Generate SHA-256 fingerprint for a certificate
   */
  async generateFingerprint(cert: Partial<Certificate>): Promise<string> {
    const data = JSON.stringify({
      serialNumber: cert.serialNumber,
      subject: cert.subject,
      issuer: cert.issuer,
      publicKey: cert.publicKey
    });

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }
}

// Export singleton instance
export const certificateVerifier = new CertificateVerifier();