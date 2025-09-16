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
  private db: IDBDatabase | null = null;
  private dbName = 'ham-radio-crypto';
  private dbVersion = 1;
  // In-memory storage for tests when IndexedDB is not available
  private memoryStore: Map<string, any> = new Map();

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
    await this.ensureDatabase();
    await this.storeKeyPair(this.keyPair);

    return this.keyPair;
  }

  async loadKeyPair(callsign: string): Promise<KeyPair | null> {
    try {
      await this.ensureDatabase();
      const data = await this.getFromDB('keyPairs', callsign);
      if (!data) return null;

      // Check expiration
      if (data.expires < Date.now()) {
        await this.deleteFromDB('keyPairs', callsign);
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

    await this.saveToDatabase('keyPairs', data);
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
      iv: this.bufferToBase64(iv.buffer),
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
    return this.bufferToBase64(array.buffer);
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

  // IndexedDB helper methods
  private async ensureDatabase(): Promise<void> {
    if (this.db) return;

    // Check if indexedDB is available (for test environments)
    if (typeof indexedDB === 'undefined' || !indexedDB?.open) {
      // Use in-memory storage for testing
      this.db = null;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(this.dbName, this.dbVersion);
      } catch (error) {
        // If indexedDB.open throws, use in-memory storage
        this.db = null;
        console.log('CryptoManager using in-memory storage (test environment)');
        resolve();
        return;
      }

      if (!request) {
        // If request is undefined, use in-memory storage
        this.db = null;
        console.log('CryptoManager using in-memory storage (test environment)');
        resolve();
        return;
      }

      request.onerror = () => {
        reject(new Error('Failed to open crypto database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create keyPairs store
        if (!db.objectStoreNames.contains('keyPairs')) {
          const keyPairStore = db.createObjectStore('keyPairs', { keyPath: 'callsign' });
          keyPairStore.createIndex('expires', 'expires', { unique: false });
        }

        // Create trustedKeys store
        if (!db.objectStoreNames.contains('trustedKeys')) {
          db.createObjectStore('trustedKeys', { keyPath: 'callsign' });
        }
      };
    });
  }

  private async saveToDatabase(storeName: string, data: any): Promise<void> {
    // Use in-memory storage if database is not available
    if (!this.db) {
      const key = `${storeName}_${data.callsign || Date.now()}`;
      this.memoryStore.set(key, data);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save to ${storeName}`));
    });
  }

  private async getFromDB(storeName: string, key: string): Promise<any> {
    // Use in-memory storage if database is not available
    if (!this.db) {
      const memKey = `${storeName}_${key}`;
      return this.memoryStore.get(memKey);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get from ${storeName}`));
    });
  }

  private async getAllFromDB(storeName: string): Promise<any[]> {
    // Use in-memory storage if database is not available
    if (!this.db) {
      const prefix = `${storeName}_`;
      const results: any[] = [];
      this.memoryStore.forEach((value, key) => {
        if (key.startsWith(prefix)) {
          results.push(value);
        }
      });
      return results;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`));
    });
  }

  private async deleteFromDB(storeName: string, key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete from ${storeName}`));
    });
  }

  // Trust management
  async addTrustedKey(callsign: string, publicKeyPem: string): Promise<void> {
    await this.ensureDatabase();
    await this.saveToDatabase('trustedKeys', { callsign, publicKeyPem });
  }

  async removeTrustedKey(callsign: string): Promise<void> {
    await this.ensureDatabase();
    await this.deleteFromDB('trustedKeys', callsign);
    this.trustedKeys.delete(callsign);
  }

  async getTrustedKeys(): Promise<Record<string, string>> {
    await this.ensureDatabase();
    const keys = await this.getAllFromDB('trustedKeys');
    const result: Record<string, string> = {};
    keys.forEach(k => {
      result[k.callsign] = k.publicKeyPem;
    });
    return result;
  }
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Method expected by integration tests
  async sign(data: string | Buffer, callsign?: string): Promise<string> {
    if (!this.keyPair) {
      throw new Error('No key pair loaded');
    }

    let dataBuffer: Uint8Array;
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      dataBuffer = encoder.encode(data);
    } else {
      dataBuffer = new Uint8Array(data);
    }

    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      this.keyPair.privateKey,
      dataBuffer
    );

    return this.bufferToBase64(signature);
  }

  // Method expected by integration tests - supports both 2 and 3 parameter forms
  async verify(data: string | Buffer, signature: string, callsignOrPublicKey?: string): Promise<boolean> {
    try {
      let publicKey: CryptoKey;

      if (callsignOrPublicKey) {
        // Check if it's a PEM public key or a callsign
        if (callsignOrPublicKey.includes('BEGIN PUBLIC KEY')) {
          // Use provided public key PEM
          publicKey = await crypto.subtle.importKey(
            'spki',
            this.pemToBuffer(callsignOrPublicKey, 'PUBLIC KEY'),
            {
              name: 'ECDSA',
              namedCurve: 'P-256'
            },
            false,
            ['verify']
          );
        } else {
          // It's a callsign - for now just use current key pair
          if (!this.keyPair) {
            throw new Error('No key pair available for verification');
          }
          publicKey = this.keyPair.publicKey;
        }
      } else {
        // Use current key pair's public key
        if (!this.keyPair) {
          throw new Error('No key pair available for verification');
        }
        publicKey = this.keyPair.publicKey;
      }

      let dataBuffer: Uint8Array;
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        dataBuffer = encoder.encode(data);
      } else {
        dataBuffer = new Uint8Array(data);
      }
      const signatureBuffer = this.base64ToBuffer(signature);

      return await crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        publicKey,
        signatureBuffer,
        dataBuffer
      );
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }
}

// Global crypto manager instance
export const cryptoManager = new CryptoManager();