/**
 * Transfer Crypto Module - Local Network Encryption Only
 *
 * WARNING: This module is ONLY for local network WebRTC transfers.
 * NEVER use these functions for amateur radio transmission.
 * Encryption over amateur radio violates FCC Part 97 regulations.
 *
 * This module will eventually contain all encryption functionality
 * moved from the main crypto module to ensure clear separation
 * between radio-compliant and non-compliant cryptography.
 *
 * @module transfer-crypto
 */

import { RADIO_TRANSMISSION_MODE } from '../crypto';

export interface EncryptedPackage {
  ephemeralKey: string;
  iv: string;
  data: string;
  timestamp: number;
  algorithm: 'AES-GCM';
}

/**
 * Transfer Encryption Manager
 * Handles encryption for local network transfers only
 */
export class TransferCrypto {
  private readonly FORBIDDEN_MESSAGE =
    'COMPLIANCE VIOLATION: This module is ONLY for local network transfers. ' +
    'Encryption is FORBIDDEN on amateur radio per FCC Part 97.';

  /**
   * Check if we're in a safe environment for encryption
   * @throws Error if in radio transmission mode
   */
  private ensureLocalNetworkOnly(): void {
    if (RADIO_TRANSMISSION_MODE.isRadio) {
      throw new Error(this.FORBIDDEN_MESSAGE);
    }
  }

  /**
   * Encrypt data for local network transfer
   * Uses ECDH key agreement and AES-GCM encryption
   *
   * @param data - Data to encrypt
   * @param recipientPublicKey - Recipient's public key (PEM format)
   * @returns Encrypted package for transfer
   * @throws Error if in radio mode
   */
  async encryptForTransfer(data: string, recipientPublicKey: string): Promise<EncryptedPackage> {
    this.ensureLocalNetworkOnly();

    // Generate ephemeral ECDH key pair
    const ephemeralKey = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveBits']
    );

    // Import recipient's public key
    const recipientKey = await crypto.subtle.importKey(
      'spki',
      this.pemToBuffer(recipientPublicKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: recipientKey
      },
      ephemeralKey.privateKey,
      256
    );

    // Import as AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'AES-GCM',
      false,
      ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt data
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      encoder.encode(data)
    );

    // Export ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.exportKey(
      'spki',
      ephemeralKey.publicKey
    );

    return {
      ephemeralKey: this.bufferToBase64(ephemeralPublicKey),
      iv: this.bufferToBase64(iv.buffer),
      data: this.bufferToBase64(encrypted),
      timestamp: Date.now(),
      algorithm: 'AES-GCM'
    };
  }

  /**
   * Decrypt data from local network transfer
   *
   * @param encryptedPackage - Encrypted package to decrypt
   * @param privateKey - Recipient's private key
   * @returns Decrypted data
   * @throws Error if in radio mode
   */
  async decryptFromTransfer(
    encryptedPackage: EncryptedPackage,
    privateKey: CryptoKey
  ): Promise<string> {
    this.ensureLocalNetworkOnly();

    // Import ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.importKey(
      'spki',
      this.base64ToBuffer(encryptedPackage.ephemeralKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // Convert private key for ECDH if needed
    const ecdhPrivateKey = privateKey.algorithm.name === 'ECDH'
      ? privateKey
      : await this.convertToECDH(privateKey);

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: ephemeralPublicKey
      },
      ecdhPrivateKey,
      256
    );

    // Import as AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.base64ToBuffer(encryptedPackage.iv)
      },
      aesKey,
      this.base64ToBuffer(encryptedPackage.data)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Convert ECDSA key to ECDH for key agreement
   * Note: In production, use separate keys for signing and encryption
   */
  private async convertToECDH(ecdsaKey: CryptoKey): Promise<CryptoKey> {
    const exported = await crypto.subtle.exportKey('pkcs8', ecdsaKey);
    return crypto.subtle.importKey(
      'pkcs8',
      exported,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveBits']
    );
  }

  // Utility functions
  private pemToBuffer(pem: string): ArrayBuffer {
    const base64 = pem
      .replace(/-----BEGIN .+-----/, '')
      .replace(/-----END .+-----/, '')
      .replace(/\s/g, '');
    return this.base64ToBuffer(base64);
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export singleton instance
export const transferCrypto = new TransferCrypto();

/**
 * Migration notice for developers
 * ================================
 * This module will eventually contain all encryption functionality
 * currently in src/lib/crypto/index.ts (encryptData/decryptData methods).
 *
 * The migration ensures:
 * 1. Clear separation between radio and local network crypto
 * 2. Reduced risk of compliance violations
 * 3. Better code organization
 *
 * Until migration is complete, both modules coexist with runtime guards.
 */