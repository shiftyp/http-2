import { vi } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Setup file for integration tests
 * Provides mocks for browser APIs needed by the tests
 */

// Mock logbook module
vi.mock('../../lib/logbook', () => ({
  logbook: {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addQSO: vi.fn().mockResolvedValue('qso-id'),
    listQSOs: vi.fn().mockResolvedValue([]),
    getQSO: vi.fn().mockResolvedValue(null),
    deleteQSO: vi.fn().mockResolvedValue(undefined),
    savePage: vi.fn().mockResolvedValue('page-id'),
    listPages: vi.fn().mockResolvedValue([]),
    getPage: vi.fn().mockResolvedValue(null),
    deletePage: vi.fn().mockResolvedValue(undefined),
    addMeshNode: vi.fn().mockResolvedValue('node-id'),
    listMeshNodes: vi.fn().mockResolvedValue([]),
    getMeshNode: vi.fn().mockResolvedValue(null),
    deleteMeshNode: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock IndexedDB
class MockIDBRequest {
  result: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onupgradeneeded: ((event: any) => void) | null = null;
}

class MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames = {
    contains: vi.fn(() => false)
  };
  stores = new Map<string, Map<any, any>>();

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
  }

  transaction = vi.fn((stores: string[], mode: string) => {
    const self = this;
    return {
      objectStore: vi.fn((name: string) => {
        if (!self.stores.has(name)) {
          self.stores.set(name, new Map());
        }
        const store = self.stores.get(name)!;

        return {
          add: vi.fn((value: any, key?: any) => {
            const req = new MockIDBRequest();
            const actualKey = key || value.id || value.path || value.callsign || Date.now();
            store.set(actualKey, value);
            req.result = actualKey;
            setTimeout(() => req.onsuccess?.({ target: { result: actualKey } }), 0);
            return req;
          }),
          put: vi.fn((value: any, key?: any) => {
            const req = new MockIDBRequest();
            const actualKey = key || value.id || value.path || value.callsign || Date.now();
            store.set(actualKey, value);
            req.result = actualKey;
            setTimeout(() => req.onsuccess?.({ target: { result: actualKey } }), 0);
            return req;
          }),
          get: vi.fn((key: any) => {
            const req = new MockIDBRequest();
            req.result = store.get(key) || null;
            setTimeout(() => req.onsuccess?.({ target: { result: req.result } }), 0);
            return req;
          }),
          getAll: vi.fn(() => {
            const req = new MockIDBRequest();
            req.result = Array.from(store.values());
            setTimeout(() => req.onsuccess?.({ target: { result: req.result } }), 0);
            return req;
          }),
          delete: vi.fn((key: any) => {
            const req = new MockIDBRequest();
            store.delete(key);
            setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
            return req;
          }),
          clear: vi.fn(() => {
            const req = new MockIDBRequest();
            store.clear();
            setTimeout(() => req.onsuccess?.({ target: { result: undefined } }), 0);
            return req;
          }),
          index: vi.fn((indexName: string) => ({
            getAll: vi.fn(() => {
              const req = new MockIDBRequest();
              req.result = Array.from(store.values());
              setTimeout(() => req.onsuccess?.({ target: { result: req.result } }), 0);
              return req;
            }),
            openCursor: vi.fn(() => {
              const req = new MockIDBRequest();
              req.result = null;
              setTimeout(() => req.onsuccess?.({ target: { result: null } }), 0);
              return req;
            })
          }))
        };
      })
    };
  });

  createObjectStore = vi.fn((name: string, options: any) => ({
    createIndex: vi.fn()
  }));

  close = vi.fn();
}

const databases = new Map<string, MockIDBDatabase>();

// @ts-ignore
global.indexedDB = {
  open: (name: string, version: number) => {
    console.log('Mock indexedDB.open called with:', name, version);
    const req = new MockIDBRequest();
    console.log('Created MockIDBRequest:', req);

    if (!databases.has(name)) {
      databases.set(name, new MockIDBDatabase(name, version));
    }

    const db = databases.get(name)!;
    req.result = db;

    // Ensure the request object has the expected properties
    setTimeout(() => {
      if (req.onupgradeneeded) {
        req.onupgradeneeded({ target: { result: db } });
      }
      if (req.onsuccess) {
        req.onsuccess({ target: { result: db } });
      }
    }, 0);

    console.log('Returning MockIDBRequest:', req);
    return req;
  },
  deleteDatabase: () => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      if (req.onsuccess) {
        req.onsuccess({ target: { result: null } });
      }
    }, 0);
    return req;
  },
  databases: () => Promise.resolve([])
};

// Mock localStorage
const localStorageStore: Record<string, string> = {};

// @ts-ignore
global.localStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key in localStorageStore) {
      delete localStorageStore[key];
    }
  })
};

// Mock Web Audio API
class MockAudioContext {
  sampleRate = 48000;
  currentTime = 0;
  destination = { connect: vi.fn() };

  createGain() {
    return {
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  createOscillator() {
    return {
      frequency: { value: 1500, setValueAtTime: vi.fn() },
      type: 'sine',
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
  }

  createScriptProcessor(bufferSize: number, inputs: number, outputs: number) {
    return {
      bufferSize,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn((array: Float32Array) => {
        // Fill with test signal
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.sin(2 * Math.PI * 1500 * i / this.sampleRate);
        }
      }),
      getByteFrequencyData: vi.fn()
    };
  }

  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 3000, setValueAtTime: vi.fn() },
      Q: { value: 1 },
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: vi.fn((channel: number) => new Float32Array(length)),
      copyToChannel: vi.fn((source: Float32Array, channelNumber: number, startInChannel?: number) => {})
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
  }
}

// @ts-ignore
global.AudioContext = MockAudioContext;

// Mock Web Serial API
class MockSerialPort {
  readable = {
    getReader: vi.fn(() => ({
      read: vi.fn(async () => ({ value: new Uint8Array([0x4F, 0x4B]), done: false })),
      releaseLock: vi.fn()
    }))
  };

  writable = {
    getWriter: vi.fn(() => ({
      write: vi.fn(async () => {}),
      releaseLock: vi.fn()
    }))
  };

  open = vi.fn(async () => {});
  close = vi.fn(async () => {});
}

// @ts-ignore
global.navigator = {
  ...global.navigator,
  serial: {
    requestPort: vi.fn(async () => new MockSerialPort()),
    getPorts: vi.fn(async () => [])
  }
};

// Mock crypto API
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    generateKey: vi.fn(async (algorithm: any) => {
      if (algorithm.name === 'ECDSA' || algorithm.name === 'ECDH') {
        return {
          publicKey: { type: 'public', algorithm },
          privateKey: { type: 'private', algorithm }
        };
      }
      if (algorithm.name === 'AES-GCM') {
        return { type: 'secret', algorithm };
      }
      return null;
    }),
    exportKey: vi.fn(async (format: string) => {
      if (format === 'spki' || format === 'pkcs8') {
        return new ArrayBuffer(64);
      }
      if (format === 'raw') {
        return new ArrayBuffer(32);
      }
      return new ArrayBuffer(0);
    }),
    importKey: vi.fn(async (format: string, keyData: any, algorithm: any) => {
      return { type: format === 'spki' ? 'public' : 'private', algorithm };
    }),
    sign: vi.fn(async () => new ArrayBuffer(64)),
    verify: vi.fn(async () => true),
    encrypt: vi.fn(async (algorithm: any, key: any, data: ArrayBuffer) => {
      // Simple mock encryption
      const encrypted = new Uint8Array(data.byteLength + 16);
      encrypted.set(new Uint8Array(data), 16);
      return encrypted.buffer;
    }),
    decrypt: vi.fn(async (algorithm: any, key: any, data: ArrayBuffer) => {
      // Simple mock decryption
      const decrypted = new Uint8Array(data.byteLength - 16);
      decrypted.set(new Uint8Array(data).slice(16));
      return decrypted.buffer;
    }),
    deriveBits: vi.fn(async () => new ArrayBuffer(32))
  }
};

// Use defineProperty for crypto since it has a getter
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  configurable: true,
  writable: true
});

// Mock DOM and window properties
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Export for use in tests
export {
  MockIDBDatabase,
  MockIDBRequest,
  MockAudioContext,
  MockSerialPort,
  databases,
  localStorageStore
};