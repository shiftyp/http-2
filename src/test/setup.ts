import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Global test setup

// Cleanup after each test case
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Setup global mocks
beforeAll(() => {
  // Mock IndexedDB
  global.indexedDB = {
    open: vi.fn(),
    deleteDatabase: vi.fn(),
    databases: vi.fn()
  } as any;

  // Mock Web Serial API
  Object.defineProperty(navigator, 'serial', {
    writable: true,
    value: {
      requestPort: vi.fn(),
      getPorts: vi.fn(() => Promise.resolve([])),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  });

  // Mock Web Crypto API
  const mockKeyPair = {
    publicKey: { type: 'public', algorithm: { name: 'ECDSA' } },
    privateKey: { type: 'private', algorithm: { name: 'ECDSA' } }
  };

  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        generateKey: vi.fn(() => Promise.resolve(mockKeyPair)),
        importKey: vi.fn(() => Promise.resolve(mockKeyPair.publicKey)),
        exportKey: vi.fn(() => Promise.resolve(new ArrayBuffer(64))),
        sign: vi.fn(() => Promise.resolve(new ArrayBuffer(64))),
        verify: vi.fn(() => Promise.resolve(true)),
        encrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
        decrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
        deriveBits: vi.fn(() => Promise.resolve(new ArrayBuffer(32)))
      },
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      })
    }
  });

  // Mock Service Worker
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: vi.fn(() => Promise.resolve({})),
      getRegistration: vi.fn(() => Promise.resolve(null)),
      ready: Promise.resolve({})
    }
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock matchMedia
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

  // Suppress console warnings in tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});