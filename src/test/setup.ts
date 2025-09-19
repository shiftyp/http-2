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

  // Mock Canvas and OffscreenCanvas
  const mockCanvas = {
    width: 1024,
    height: 512,
    getContext: vi.fn((contextType) => {
      if (contextType === '2d') {
        return {
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          putImageData: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(1024 * 512 * 4),
            width: 1024,
            height: 512
          })),
          createImageData: vi.fn((width, height) => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height
          })),
          drawImage: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          translate: vi.fn(),
          scale: vi.fn(),
          rotate: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          arc: vi.fn(),
          rect: vi.fn(),
          closePath: vi.fn(),
          isContextLost: vi.fn(() => false)
        };
      }
      if (contextType === 'webgl2' || contextType === 'webgl') {
        return {
          clearColor: vi.fn(),
          clear: vi.fn(),
          viewport: vi.fn(),
          useProgram: vi.fn(),
          createShader: vi.fn(() => ({})),
          shaderSource: vi.fn(),
          compileShader: vi.fn(),
          getShaderParameter: vi.fn(() => true),
          createProgram: vi.fn(() => ({})),
          attachShader: vi.fn(),
          linkProgram: vi.fn(),
          getProgramParameter: vi.fn(() => true),
          deleteShader: vi.fn(),
          createBuffer: vi.fn(() => ({})),
          bindBuffer: vi.fn(),
          bufferData: vi.fn(),
          getAttribLocation: vi.fn(() => 0),
          enableVertexAttribArray: vi.fn(),
          vertexAttribPointer: vi.fn(),
          createTexture: vi.fn(() => ({})),
          bindTexture: vi.fn(),
          texParameteri: vi.fn(),
          texImage2D: vi.fn(),
          activeTexture: vi.fn(),
          uniform1i: vi.fn(),
          uniform1f: vi.fn(),
          uniform2f: vi.fn(),
          getUniformLocation: vi.fn(() => ({})),
          drawArrays: vi.fn(),
          deleteProgram: vi.fn(),
          deleteBuffer: vi.fn(),
          deleteTexture: vi.fn(),
          disable: vi.fn(),
          VERTEX_SHADER: 35633,
          FRAGMENT_SHADER: 35632,
          COMPILE_STATUS: 35713,
          LINK_STATUS: 35714,
          ARRAY_BUFFER: 34962,
          STATIC_DRAW: 35044,
          FLOAT: 5126,
          TEXTURE_2D: 3553,
          TEXTURE_MIN_FILTER: 10241,
          TEXTURE_MAG_FILTER: 10240,
          NEAREST: 9728,
          LINEAR: 9729,
          TEXTURE_WRAP_S: 10242,
          TEXTURE_WRAP_T: 10243,
          CLAMP_TO_EDGE: 33071,
          RGBA: 6408,
          UNSIGNED_BYTE: 5121,
          COLOR_BUFFER_BIT: 16384,
          TRIANGLE_STRIP: 5,
          TEXTURE0: 33984,
          TEXTURE1: 33985,
          RED: 6403,
          R32F: 33326,
          DEPTH_TEST: 2929,
          BLEND: 3042
        };
      }
      return null;
    }),
    transferControlToOffscreen: vi.fn(() => mockCanvas)
  };

  // Mock HTMLCanvasElement
  global.HTMLCanvasElement = vi.fn().mockImplementation(() => mockCanvas);

  // Mock OffscreenCanvas
  global.OffscreenCanvas = vi.fn().mockImplementation(() => mockCanvas);

  // Mock document.createElement for canvas
  const originalCreateElement = document.createElement;
  document.createElement = vi.fn((tagName) => {
    if (tagName === 'canvas') {
      return mockCanvas as any;
    }
    return originalCreateElement.call(document, tagName);
  });

  // Mock WebUSB API
  Object.defineProperty(navigator, 'usb', {
    writable: true,
    value: {
      requestDevice: vi.fn(),
      getDevices: vi.fn(() => Promise.resolve([])),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  });

  // Suppress console warnings in tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});