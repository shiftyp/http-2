import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoManager, KeyPair, SignedRequest } from './index';
import { createMockWebCrypto } from '../../test/mocks';

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: createMockWebCrypto()
});

describe('CryptoManager', () => {
  let cryptoManager: CryptoManager;

  beforeEach(() => {
    cryptoManager = new CryptoManager();
    vi.clearAllMocks();
  });

  describe('Key Pair Generation', () => {
    it('should generate a valid key pair', async () => {
      const keyPair = await cryptoManager.generateKeyPair('KJ4ABC');

      expect(keyPair).toBeDefined();
      expect(keyPair.callsign).toBe('KJ4ABC');
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.publicKeyPem).toContain('-----END PUBLIC KEY-----');
      expect(keyPair.created).toBeCloseTo(Date.now(), -1000);
      expect(keyPair.expires).toBeGreaterThan(keyPair.created);
    });

    it('should set correct expiration date', async () => {
      const keyPair = await cryptoManager.generateKeyPair('W5XYZ');
      
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const expectedExpiry = keyPair.created + oneYear;
      
      expect(keyPair.expires).toBeCloseTo(expectedExpiry, -10000);
    });

    it('should store key pair in localStorage', async () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
      
      await cryptoManager.generateKeyPair('N0CALL');
      
      expect(mockSetItem).toHaveBeenCalledWith(
        'keypair_N0CALL',
        expect.any(String)
      );
    });
  });

  describe('Key Pair Loading', () => {
    it('should load existing key pair', async () => {
      // First generate a key pair
      const original = await cryptoManager.generateKeyPair('TEST');
      
      // Create new crypto manager instance
      const newCryptoManager = new CryptoManager();
      
      // Load the key pair
      const loaded = await newCryptoManager.loadKeyPair('TEST');
      
      expect(loaded).toBeDefined();
      expect(loaded!.callsign).toBe('TEST');
      expect(loaded!.publicKeyPem).toBe(original.publicKeyPem);
    });

    it('should return null for non-existent key pair', async () => {
      const result = await cryptoManager.loadKeyPair('NONEXISTENT');
      
      expect(result).toBeNull();
    });

    it('should handle expired key pairs', async () => {
      // Mock expired key pair in localStorage
      const expiredKeyData = {
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nEXPIRED\n-----END PUBLIC KEY-----',
        privateKeyPem: '-----BEGIN PRIVATE KEY-----\nEXPIRED\n-----END PRIVATE KEY-----',
        callsign: 'EXPIRED',
        created: Date.now() - (2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago
        expires: Date.now() - (365 * 24 * 60 * 60 * 1000) // 1 year ago
      };

      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
        JSON.stringify(expiredKeyData)
      );
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      const result = await cryptoManager.loadKeyPair('EXPIRED');
      
      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('keypair_EXPIRED');
    });
  });

  describe('Request Signing', () => {
    beforeEach(async () => {
      await cryptoManager.generateKeyPair('SIGNER');
    });

    it('should sign HTTP requests', async () => {
      const signedRequest = await cryptoManager.signRequest(
        'GET',
        '/api/test',
        { 'Accept': 'application/json' },
        null
      );

      expect(signedRequest).toBeDefined();
      expect(signedRequest.request.method).toBe('GET');
      expect(signedRequest.request.path).toBe('/api/test');
      expect(signedRequest.request.timestamp).toBeCloseTo(Date.now(), -1000);
      expect(signedRequest.request.nonce).toBeDefined();
      expect(signedRequest.signature).toBeDefined();
      expect(signedRequest.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(signedRequest.callsign).toBe('SIGNER');
    });

    it('should include request body in signature', async () => {
      const requestBody = { data: 'test payload' };
      
      const signedRequest = await cryptoManager.signRequest(
        'POST',
        '/api/submit',
        { 'Content-Type': 'application/json' },
        requestBody
      );

      expect(signedRequest.request.body).toEqual(requestBody);
      expect(signedRequest.signature).toBeDefined();
    });

    it('should generate unique nonces', async () => {
      const request1 = await cryptoManager.signRequest('GET', '/test', {});
      const request2 = await cryptoManager.signRequest('GET', '/test', {});

      expect(request1.request.nonce).not.toBe(request2.request.nonce);
    });

    it('should throw error when no key pair loaded', async () => {
      const emptyCrypto = new CryptoManager();
      
      await expect(emptyCrypto.signRequest('GET', '/test', {}))
        .rejects.toThrow('No key pair loaded');
    });
  });

  describe('Signature Verification', () => {
    let testKeyPair: KeyPair;

    beforeEach(async () => {
      testKeyPair = await cryptoManager.generateKeyPair('VERIFIER');
    });

    it('should verify valid signatures', async () => {
      const signedRequest = await cryptoManager.signRequest(
        'GET',
        '/api/verify',
        { 'Authorization': 'Bearer token' }
      );

      const isValid = await cryptoManager.verifyRequest(signedRequest);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', async () => {
      const signedRequest = await cryptoManager.signRequest(
        'GET',
        '/api/verify',
        {}
      );

      // Tamper with signature
      signedRequest.signature = 'invalid-signature';

      const isValid = await cryptoManager.verifyRequest(signedRequest);
      
      expect(isValid).toBe(false);
    });

    it('should reject expired requests', async () => {
      const signedRequest = await cryptoManager.signRequest(
        'GET',
        '/api/verify',
        {}
      );

      // Make request appear old
      signedRequest.request.timestamp = Date.now() - (10 * 60 * 1000); // 10 minutes ago

      const isValid = await cryptoManager.verifyRequest(signedRequest);
      
      expect(isValid).toBe(false);
    });

    it('should reject future-dated requests', async () => {
      const signedRequest = await cryptoManager.signRequest(
        'GET',
        '/api/verify',
        {}
      );

      // Make request appear from future
      signedRequest.request.timestamp = Date.now() + (5 * 60 * 1000); // 5 minutes in future

      const isValid = await cryptoManager.verifyRequest(signedRequest);
      
      expect(isValid).toBe(false);
    });

    it('should cache verified public keys', async () => {
      const signedRequest = await cryptoManager.signRequest(
        'GET',
        '/api/test',
        {}
      );

      await cryptoManager.verifyRequest(signedRequest);

      // Key should be cached for the callsign
      expect(cryptoManager['trustedKeys'].has('VERIFIER')).toBe(true);
    });
  });

  describe('Data Encryption/Decryption', () => {
    let recipientKeyPair: KeyPair;

    beforeEach(async () => {
      recipientKeyPair = await cryptoManager.generateKeyPair('RECIPIENT');
    });

    it('should encrypt and decrypt data', async () => {
      const originalData = 'Secret message for amateur radio';
      
      const encrypted = await cryptoManager.encryptData(
        originalData,
        recipientKeyPair.publicKeyPem
      );

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain(originalData);

      const decrypted = await cryptoManager.decryptData(encrypted);
      
      expect(decrypted).toBe(originalData);
    });

    it('should handle empty data', async () => {
      const encrypted = await cryptoManager.encryptData(
        '',
        recipientKeyPair.publicKeyPem
      );

      const decrypted = await cryptoManager.decryptData(encrypted);
      
      expect(decrypted).toBe('');
    });

    it('should handle large data', async () => {
      const largeData = 'x'.repeat(10000);
      
      const encrypted = await cryptoManager.encryptData(
        largeData,
        recipientKeyPair.publicKeyPem
      );

      const decrypted = await cryptoManager.decryptData(encrypted);
      
      expect(decrypted).toBe(largeData);
    });

    it('should throw error when decrypting with wrong key', async () => {
      const wrongKeyPair = await cryptoManager.generateKeyPair('WRONG');
      
      const encrypted = await cryptoManager.encryptData(
        'secret',
        recipientKeyPair.publicKeyPem
      );

      // Try to decrypt with wrong crypto manager instance
      const wrongCrypto = new CryptoManager();
      await wrongCrypto.generateKeyPair('WRONG');

      await expect(wrongCrypto.decryptData(encrypted))
        .rejects.toThrow();
    });
  });

  describe('Trust Management', () => {
    it('should add trusted keys', () => {
      const publicKeyPem = '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----';
      
      cryptoManager.addTrustedKey('TRUSTED', publicKeyPem);

      const trustedKeys = cryptoManager.getTrustedKeys();
      expect(trustedKeys['TRUSTED']).toBe(publicKeyPem);
    });

    it('should remove trusted keys', () => {
      const publicKeyPem = '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----';
      
      cryptoManager.addTrustedKey('TRUSTED', publicKeyPem);
      cryptoManager.removeTrustedKey('TRUSTED');

      const trustedKeys = cryptoManager.getTrustedKeys();
      expect(trustedKeys['TRUSTED']).toBeUndefined();
    });

    it('should persist trusted keys in localStorage', () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
      const publicKeyPem = '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----';
      
      cryptoManager.addTrustedKey('PERSISTENT', publicKeyPem);

      expect(mockSetItem).toHaveBeenCalledWith(
        'trusted_keys',
        expect.stringContaining('PERSISTENT')
      );
    });

    it('should load trusted keys from localStorage', () => {
      const trustedKeysData = {
        'LOADED': '-----BEGIN PUBLIC KEY-----\nLOADED\n-----END PUBLIC KEY-----'
      };

      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
        JSON.stringify(trustedKeysData)
      );

      const keys = cryptoManager.getTrustedKeys();
      expect(keys['LOADED']).toBe(trustedKeysData['LOADED']);
    });
  });

  describe('Utility Functions', () => {
    it('should convert buffers to PEM format', () => {
      const testBuffer = new ArrayBuffer(32);
      const uint8Array = new Uint8Array(testBuffer);
      for (let i = 0; i < uint8Array.length; i++) {
        uint8Array[i] = i;
      }

      const pem = cryptoManager['bufferToPem'](testBuffer, 'TEST KEY');
      
      expect(pem).toContain('-----BEGIN TEST KEY-----');
      expect(pem).toContain('-----END TEST KEY-----');
    });

    it('should convert PEM to buffers', () => {
      const pem = `-----BEGIN TEST KEY-----
VGVzdCBkYXRh
-----END TEST KEY-----`;

      const buffer = cryptoManager['pemToBuffer'](pem, 'TEST KEY');
      
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should convert buffers to base64', () => {
      const testBuffer = new ArrayBuffer(4);
      const uint8Array = new Uint8Array(testBuffer);
      uint8Array[0] = 72;  // 'H'
      uint8Array[1] = 101; // 'e'
      uint8Array[2] = 108; // 'l'
      uint8Array[3] = 108; // 'l'

      const base64 = cryptoManager['bufferToBase64'](testBuffer);
      
      expect(base64).toBe('SGVsbA==');
    });

    it('should convert base64 to buffers', () => {
      const base64 = 'SGVsbG8='; // 'Hello'
      
      const buffer = cryptoManager['base64ToBuffer'](base64);
      const uint8Array = new Uint8Array(buffer);
      
      expect(uint8Array[0]).toBe(72);  // 'H'
      expect(uint8Array[1]).toBe(101); // 'e'
      expect(uint8Array[2]).toBe(108); // 'l'
      expect(uint8Array[3]).toBe(108); // 'l'
      expect(uint8Array[4]).toBe(111); // 'o'
    });

    it('should generate cryptographically secure nonces', () => {
      const nonce1 = cryptoManager['generateNonce']();
      const nonce2 = cryptoManager['generateNonce']();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Web Crypto API failures gracefully', async () => {
      // Mock crypto.subtle.generateKey to fail
      vi.spyOn(crypto.subtle, 'generateKey').mockRejectedValue(
        new Error('Crypto API unavailable')
      );

      await expect(cryptoManager.generateKeyPair('FAIL'))
        .rejects.toThrow('Crypto API unavailable');
    });

    it('should handle invalid PEM data', () => {
      const invalidPem = 'not-a-valid-pem-string';

      expect(() => {
        cryptoManager['pemToBuffer'](invalidPem, 'PUBLIC KEY');
      }).toThrow();
    });

    it('should handle invalid base64 data', () => {
      const invalidBase64 = 'not-valid-base64!@#$';

      expect(() => {
        cryptoManager['base64ToBuffer'](invalidBase64);
      }).toThrow();
    });

    it('should handle corrupted localStorage data', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('invalid-json');

      const result = await cryptoManager.loadKeyPair('CORRUPTED');
      
      expect(result).toBeNull();
    });
  });
});