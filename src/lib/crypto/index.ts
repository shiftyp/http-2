// Cryptographic signing and verification for HTTP-over-Radio
// Uses Web Crypto API for digital signatures

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyPem: string;
  callsign: string;
  created: number;
  expires: number;
}

export interface SignedRequest {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
    nonce: string;
  };
  signature: string;
  publicKey: string;
  callsign: string;
}

export class CryptoManager {
  private keyPair: KeyPair | null = null;
  private trustedKeys: Map<string, CryptoKey> = new Map();

  async generateKeyPair(callsign: string): Promise<KeyPair> {
    // Generate ECDSA key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );

    // Export public key to PEM format
    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyPem = this.bufferToPem(publicKeyBuffer, 'PUBLIC KEY');

    const created = Date.now();
    const expires = created + (365 * 24 * 60 * 60 * 1000); // 1 year

    this.keyPair = {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      publicKeyPem,
      callsign,
      created,
      expires
    };

    // Store in IndexedDB
    await this.storeKeyPair(this.keyPair);

    return this.keyPair;
  }

  async loadKeyPair(callsign: string): Promise<KeyPair | null> {
    try {
      const stored = localStorage.getItem(`keypair_${callsign}`);
      if (!stored) return null;

      const data = JSON.parse(stored);
      
      // Check expiration
      if (data.expires < Date.now()) {
        localStorage.removeItem(`keypair_${callsign}`);
        return null;
      }

      // Import keys from stored format
      const publicKey = await crypto.subtle.importKey(
        'spki',
        this.pemToBuffer(data.publicKeyPem, 'PUBLIC KEY'),
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        true,
        ['verify']
      );

      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        this.pemToBuffer(data.privateKeyPem, 'PRIVATE KEY'),
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        true,
        ['sign']
      );

      this.keyPair = {
        publicKey,
        privateKey,
        publicKeyPem: data.publicKeyPem,
        callsign: data.callsign,
        created: data.created,
        expires: data.expires
      };

      return this.keyPair;
    } catch (error) {
      console.error('Failed to load key pair:', error);
      return null;
    }
  }

  private async storeKeyPair(keyPair: KeyPair): Promise<void> {
    // Export private key
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyPem = this.bufferToPem(privateKeyBuffer, 'PRIVATE KEY');

    const data = {
      publicKeyPem: keyPair.publicKeyPem,
      privateKeyPem,
      callsign: keyPair.callsign,
      created: keyPair.created,
      expires: keyPair.expires
    };

    localStorage.setItem(`keypair_${keyPair.callsign}`, JSON.stringify(data));
  }

  async signRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any
  ): Promise<SignedRequest> {
    if (!this.keyPair) {
      throw new Error('No key pair loaded');
    }

    const request = {
      method,
      path,
      headers,
      body,
      timestamp: Date.now(),
      nonce: this.generateNonce()
    };

    // Create signature payload
    const payload = JSON.stringify(request);
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);

    // Sign the payload
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      this.keyPair.privateKey,
      data
    );

    return {
      request,
      signature: this.bufferToBase64(signature),
      publicKey: this.keyPair.publicKeyPem,
      callsign: this.keyPair.callsign
    };
  }

  async verifyRequest(signedRequest: SignedRequest): Promise<boolean> {
    try {
      // Check timestamp (5 minute window)
      const age = Date.now() - signedRequest.request.timestamp;
      if (age > 5 * 60 * 1000 || age < -60 * 1000) {
        console.error('Request timestamp out of range');
        return false;
      }

      // Import public key
      const publicKey = await crypto.subtle.importKey(
        'spki',
        this.pemToBuffer(signedRequest.publicKey, 'PUBLIC KEY'),
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false,
        ['verify']
      );

      // Verify signature
      const payload = JSON.stringify(signedRequest.request);
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const signature = this.base64ToBuffer(signedRequest.signature);

      const valid = await crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        publicKey,
        signature,
        data
      );

      if (valid) {
        // Cache trusted key
        this.trustedKeys.set(signedRequest.callsign, publicKey);
      }

      return valid;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  async encryptData(data: string, recipientPublicKey: string): Promise<string> {
    // Generate ephemeral key for ECDH
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
      this.pemToBuffer(recipientPublicKey, 'PUBLIC KEY'),
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

    // Derive AES key from shared secret
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'AES-GCM',
      false,
      ['encrypt']
    );

    // Encrypt data
    const iv = crypto.getRandomValues(new Uint8Array(12));
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

    // Combine ephemeral key, IV, and encrypted data
    const result = {
      ephemeralKey: this.bufferToBase64(ephemeralPublicKey),
      iv: this.bufferToBase64(iv),
      data: this.bufferToBase64(encrypted)
    };

    return JSON.stringify(result);
  }

  async decryptData(encryptedData: string): Promise<string> {
    if (!this.keyPair) {
      throw new Error('No key pair loaded');
    }

    const { ephemeralKey, iv, data } = JSON.parse(encryptedData);

    // Import ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.importKey(
      'spki',
      this.base64ToBuffer(ephemeralKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );

    // Convert our ECDSA key to ECDH for key agreement
    // Note: In production, use separate keys for signing and encryption
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      await crypto.subtle.exportKey('pkcs8', this.keyPair.privateKey),
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveBits']
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: ephemeralPublicKey
      },
      privateKey,
      256
    );

    // Derive AES key
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
        iv: this.base64ToBuffer(iv)
      },
      aesKey,
      this.base64ToBuffer(data)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  // Utility functions
  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.bufferToBase64(array);
  }

  private bufferToPem(buffer: ArrayBuffer, type: string): string {
    const base64 = this.bufferToBase64(buffer);
    const lines = base64.match(/.{1,64}/g) || [];
    return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
  }

  private pemToBuffer(pem: string, type: string): ArrayBuffer {
    const base64 = pem
      .replace(`-----BEGIN ${type}-----`, '')
      .replace(`-----END ${type}-----`, '')
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

  // Trust management
  addTrustedKey(callsign: string, publicKeyPem: string): void {
    const trustedKeys = JSON.parse(
      localStorage.getItem('trusted_keys') || '{}'
    );
    trustedKeys[callsign] = publicKeyPem;
    localStorage.setItem('trusted_keys', JSON.stringify(trustedKeys));
  }

  removeTrustedKey(callsign: string): void {
    const trustedKeys = JSON.parse(
      localStorage.getItem('trusted_keys') || '{}'
    );
    delete trustedKeys[callsign];
    localStorage.setItem('trusted_keys', JSON.stringify(trustedKeys));
    this.trustedKeys.delete(callsign);
  }

  getTrustedKeys(): Record<string, string> {
    return JSON.parse(localStorage.getItem('trusted_keys') || '{}');
  }
}

// Global crypto manager instance
export const cryptoManager = new CryptoManager();