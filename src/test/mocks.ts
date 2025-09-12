import { vi } from 'vitest';

// Mock implementations for testing

export const mockSerialPort = {
  readable: new ReadableStream(),
  writable: new WritableStream(),
  open: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  getInfo: vi.fn(() => ({
    usbVendorId: 0x1234,
    usbProductId: 0x5678
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

export const mockRadioControl = {
  connect: vi.fn(() => Promise.resolve()),
  disconnect: vi.fn(() => Promise.resolve()),
  setFrequency: vi.fn(() => Promise.resolve()),
  setMode: vi.fn(() => Promise.resolve()),
  transmit: vi.fn(() => Promise.resolve()),
  startReceive: vi.fn(),
  getSignalStrength: vi.fn(() => -80),
  isConnected: vi.fn(() => true)
};

export const mockDatabase = {
  init: vi.fn(() => Promise.resolve()),
  savePage: vi.fn(() => Promise.resolve()),
  getPage: vi.fn(() => Promise.resolve(null)),
  getAllPages: vi.fn(() => Promise.resolve([])),
  deletePage: vi.fn(() => Promise.resolve()),
  saveMessage: vi.fn(() => Promise.resolve()),
  getMessages: vi.fn(() => Promise.resolve([])),
  logQSO: vi.fn(() => Promise.resolve()),
  getQSOLog: vi.fn(() => Promise.resolve([])),
  setSetting: vi.fn(() => Promise.resolve()),
  getSetting: vi.fn(() => Promise.resolve(null)),
  cacheContent: vi.fn(() => Promise.resolve()),
  getCachedContent: vi.fn(() => Promise.resolve(null)),
  getCacheSize: vi.fn(() => Promise.resolve(0))
};

export const mockCryptoManager = {
  generateKeyPair: vi.fn(() => Promise.resolve({
    publicKey: {} as CryptoKey,
    privateKey: {} as CryptoKey,
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
    callsign: 'TEST',
    created: Date.now(),
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000
  })),
  loadKeyPair: vi.fn(() => Promise.resolve(null)),
  signRequest: vi.fn(() => Promise.resolve({
    request: {},
    signature: 'mock-signature',
    publicKey: 'mock-key',
    callsign: 'TEST'
  })),
  verifyRequest: vi.fn(() => Promise.resolve(true)),
  encryptData: vi.fn(() => Promise.resolve('encrypted')),
  decryptData: vi.fn(() => Promise.resolve('decrypted'))
};

export const mockMeshNetwork = {
  join: vi.fn(() => Promise.resolve()),
  leave: vi.fn(() => Promise.resolve()),
  sendPacket: vi.fn(() => Promise.resolve()),
  discoverRoute: vi.fn(() => Promise.resolve({
    destination: 'W5XYZ',
    path: ['KJ4ABC', 'N0CALL', 'W5XYZ'],
    hopCount: 2,
    metric: 100,
    timestamp: Date.now()
  })),
  getNeighbors: vi.fn(() => []),
  getRoutingTable: vi.fn(() => [])
};

export const mockCompressor = {
  compressHTML: vi.fn((html: string) => ({
    compressed: new Uint8Array([1, 2, 3]),
    originalSize: html.length,
    compressedSize: 3,
    ratio: html.length / 3,
    dictionary: {}
  })),
  decompressHTML: vi.fn(() => '<h1>Mock</h1>')
};

export const mockJSXCompiler = {
  compile: vi.fn(() => ({
    templates: { t1: '<div>{0}</div>' },
    compiled: { t: 't1', d: ['test'] }
  })),
  decompile: vi.fn(() => ({ type: 'div', props: {}, children: ['test'] })),
  registerComponent: vi.fn()
};

export const mockHTTPProtocol = {
  sendRequest: vi.fn(() => Promise.resolve({
    status: 200,
    statusText: 'OK',
    headers: {},
    body: { success: true }
  })),
  handlePacket: vi.fn(() => Promise.resolve()),
  onRequest: vi.fn(),
  getStats: vi.fn(() => ({
    packetsSent: 10,
    packetsReceived: 8,
    bytesSent: 1024,
    bytesReceived: 512,
    errors: 0
  }))
};

export const mockServerAppExecutor = {
  registerApp: vi.fn(() => Promise.resolve()),
  executeApp: vi.fn(() => Promise.resolve({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { result: 'success' }
  })),
  unregisterApp: vi.fn(() => Promise.resolve()),
  getRegisteredApps: vi.fn(() => [])
};

// Create mock factory functions
export const createMockIndexedDB = () => {
  const mockDB = {
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        get: vi.fn(() => ({ onsuccess: null, onerror: null })),
        put: vi.fn(() => ({ onsuccess: null, onerror: null })),
        add: vi.fn(() => ({ onsuccess: null, onerror: null })),
        delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
        clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
        getAll: vi.fn(() => ({ onsuccess: null, onerror: null })),
        createIndex: vi.fn(),
        index: vi.fn(() => ({
          get: vi.fn(() => ({ onsuccess: null, onerror: null })),
          getAll: vi.fn(() => ({ onsuccess: null, onerror: null }))
        }))
      })),
      oncomplete: null,
      onerror: null,
      onabort: null
    })),
    close: vi.fn(),
    createObjectStore: vi.fn(() => ({
      createIndex: vi.fn()
    })),
    deleteObjectStore: vi.fn()
  };

  return {
    open: vi.fn(() => ({
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: mockDB
    })),
    deleteDatabase: vi.fn(() => ({
      onsuccess: null,
      onerror: null
    }))
  };
};

export const createMockWebCrypto = () => ({
  subtle: {
    generateKey: vi.fn(() => Promise.resolve({
      publicKey: new CryptoKey(),
      privateKey: new CryptoKey()
    })),
    importKey: vi.fn(() => Promise.resolve(new CryptoKey())),
    exportKey: vi.fn(() => Promise.resolve(new ArrayBuffer(256))),
    sign: vi.fn(() => Promise.resolve(new ArrayBuffer(64))),
    verify: vi.fn(() => Promise.resolve(true)),
    encrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(128))),
    decrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(64))),
    deriveBits: vi.fn(() => Promise.resolve(new ArrayBuffer(32)))
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
});