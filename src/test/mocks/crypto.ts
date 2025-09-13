import { vi } from 'vitest';

export function createMockWebCrypto() {
  const mockKeyPair = {
    publicKey: { type: 'public', algorithm: { name: 'ECDSA' } },
    privateKey: { type: 'private', algorithm: { name: 'ECDSA' } }
  };

  const mockAesKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };

  return {
    subtle: {
      generateKey: vi.fn().mockImplementation((algorithm) => {
        if (algorithm.name === 'ECDSA') {
          return Promise.resolve(mockKeyPair);
        }
        if (algorithm.name === 'AES-GCM') {
          return Promise.resolve(mockAesKey);
        }
        return Promise.resolve(null);
      }),

      exportKey: vi.fn().mockImplementation((format, key) => {
        // Return mock key data
        if (format === 'spki' || format === 'pkcs8') {
          return Promise.resolve(new ArrayBuffer(64));
        }
        if (format === 'raw') {
          return Promise.resolve(new ArrayBuffer(32));
        }
        return Promise.resolve(new ArrayBuffer(0));
      }),

      importKey: vi.fn().mockImplementation((format, keyData, algorithm, extractable, keyUsages) => {
        if (format === 'spki') {
          return Promise.resolve(mockKeyPair.publicKey);
        }
        if (format === 'pkcs8') {
          return Promise.resolve(mockKeyPair.privateKey);
        }
        if (format === 'raw') {
          return Promise.resolve(mockAesKey);
        }
        return Promise.resolve(null);
      }),

      sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),

      verify: vi.fn().mockResolvedValue(true),

      encrypt: vi.fn().mockImplementation((algorithm, key, data) => {
        // Simple mock encryption - just return the data with a prefix
        const encrypted = new Uint8Array(data.byteLength + 16);
        encrypted.set(new Uint8Array(data), 16);
        return Promise.resolve(encrypted.buffer);
      }),

      decrypt: vi.fn().mockImplementation((algorithm, key, data) => {
        // Simple mock decryption - remove the prefix
        const decrypted = new Uint8Array(data.byteLength - 16);
        decrypted.set(new Uint8Array(data).slice(16));
        return Promise.resolve(decrypted.buffer);
      }),

      deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    },

    getRandomValues: vi.fn().mockImplementation((array) => {
      // Fill with pseudo-random values
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  };
}