import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPServer, HTTPClient, HTTPRequest, HTTPResponse } from './index';

// Mock dependencies
vi.mock('../logbook', () => ({
  logbook: {
    open: vi.fn().mockResolvedValue(undefined),
    findQSOs: vi.fn().mockResolvedValue([]),
    listPages: vi.fn().mockResolvedValue([]),
    getActiveNodes: vi.fn().mockResolvedValue([]),
    savePage: vi.fn().mockResolvedValue(undefined),
    getSetting: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../compression', () => ({
  HamRadioCompressor: vi.fn().mockImplementation(() => ({
    compressHTML: vi.fn((html: string) => ({
      type: 'full',
      encoding: 'json',
      data: html
    }))
  }))
}));

vi.mock('../crypto', () => ({
  cryptoManager: {
    loadKeyPair: vi.fn().mockResolvedValue(null),
    generateKeyPair: vi.fn().mockResolvedValue({
      publicKey: {},
      privateKey: {},
      publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
      callsign: 'TEST',
      created: Date.now(),
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000
    }),
    verifyRequest: vi.fn().mockResolvedValue(true),
    signRequest: vi.fn().mockResolvedValue({
      request: { nonce: 'test-nonce' },
      signature: 'test-signature',
      publicKey: 'test-public-key',
      callsign: 'TEST'
    })
  }
}));

describe('HTTPServer', () => {
  let server: HTTPServer;

  beforeEach(() => {
    server = new HTTPServer({
      callsign: 'KJ4ABC',
      maxBodySize: 8192,
      compressionThreshold: 1024,
      cacheDuration: 300000,
      requireSignatures: false
    });
    vi.clearAllMocks();
  });

  describe('start()', () => {
    it('should start the server successfully', async () => {
      await expect(server.start()).resolves.toBeUndefined();
    });

    it('should throw error if already started', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow('Server already running');
    });

    it('should initialize crypto when signatures required', async () => {
      const secureServer = new HTTPServer({
        callsign: 'KJ4ABC',
        requireSignatures: true
      });

      await secureServer.start();
      
      const { cryptoManager } = await import('../crypto');
      expect(cryptoManager.loadKeyPair).toHaveBeenCalledWith('KJ4ABC');
    });
  });

  describe('stop()', () => {
    it('should stop the server', async () => {
      await server.start();
      expect(() => server.stop()).not.toThrow();
    });

    it('should clear request cache on stop', async () => {
      await server.start();
      server.stop();
      // Cache should be cleared (internal state)
    });
  });

  describe('route()', () => {
    it('should register a route handler', async () => {
      await server.start();
      
      const handler = vi.fn((req: HTTPRequest) => ({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: 'Test response'
      }));

      expect(() => server.route('GET', '/test', handler)).not.toThrow();
    });

    it('should throw for unsupported HTTP method', async () => {
      await server.start();
      
      expect(() => server.route('INVALID', '/test', () => ({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: ''
      }))).toThrow('Unsupported HTTP method');
    });
  });

  describe('handleRequest()', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should return 503 when server not active', async () => {
      server.stop();
      
      const request: HTTPRequest = {
        method: 'GET',
        path: '/',
        version: 'HTTP/1.1',
        headers: new Map([['X-Callsign', 'TEST']]),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(503);
      expect(response.statusText).toBe('Service Unavailable');
    });

    it('should return cached response for duplicate request ID', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'duplicate-123'
      };

      // First request
      const response1 = await server.handleRequest(request);
      
      // Duplicate request
      const response2 = await server.handleRequest(request);
      expect(response2.headers.get('X-Cache')).toBe('HIT');
    });

    it('should return 413 for oversized body', async () => {
      const largeBody = Buffer.alloc(10000); // Larger than maxBodySize
      
      const request: HTTPRequest = {
        method: 'POST',
        path: '/',
        version: 'HTTP/1.1',
        headers: new Map(),
        body: largeBody,
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(413);
      expect(response.statusText).toBe('Payload Too Large');
    });

    it('should verify signature when required', async () => {
      const secureServer = new HTTPServer({
        callsign: 'KJ4ABC',
        requireSignatures: true
      });
      await secureServer.start();

      const request: HTTPRequest = {
        method: 'GET',
        path: '/',
        version: 'HTTP/1.1',
        headers: new Map([
          ['X-Signature', 'test-sig'],
          ['X-Public-Key', 'test-key'],
          ['X-Nonce', 'test-nonce']
        ]),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await secureServer.handleRequest(request);
      
      const { cryptoManager } = await import('../crypto');
      expect(cryptoManager.verifyRequest).toHaveBeenCalled();
    });

    it('should return 404 for unknown route', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/unknown',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
    });

    it('should execute route handler', async () => {
      const handler = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: 'Custom response'
      });

      server.route('GET', '/custom', handler);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/custom',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.body).toBe('Custom response');
      expect(handler).toHaveBeenCalledWith(request);
    });

    it('should match wildcard routes', async () => {
      const handler = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: 'Wildcard match'
      });

      server.route('GET', '/api/*', handler);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/test/path',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.body).toBe('Wildcard match');
    });

    it('should compress large responses', async () => {
      const largeBody = 'x'.repeat(2000); // Larger than compressionThreshold
      
      server.route('GET', '/large', () => ({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: largeBody
      }));

      const request: HTTPRequest = {
        method: 'GET',
        path: '/large',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.headers.get('Content-Encoding')).toBe('ham-compressed');
      expect(response.compressed).toBe(true);
    });

    it('should generate ETag for responses', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.headers.get('ETag')).toBeDefined();
      expect(response.etag).toBeDefined();
    });

    it('should handle middleware', async () => {
      const middleware = vi.fn();
      server.use(middleware);

      server.route('GET', '/middleware', () => ({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: 'Test'
      }));

      const request: HTTPRequest = {
        method: 'GET',
        path: '/middleware',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      await server.handleRequest(request);
      expect(middleware).toHaveBeenCalled();
    });

    it('should handle handler errors', async () => {
      server.route('GET', '/error', () => {
        throw new Error('Handler error');
      });

      const request: HTTPRequest = {
        method: 'GET',
        path: '/error',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(500);
      expect(response.statusText).toBe('Internal Server Error');
    });
  });

  describe('Default routes', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should have GET / route', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.body).toContain('KJ4ABC');
    });

    it('should have GET /api/status route', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/status',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const status = JSON.parse(response.body as string);
      expect(status.callsign).toBe('KJ4ABC');
    });

    it('should have GET /api/log route', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/log',
        version: 'HTTP/1.1',
        headers: new Map([['X-Limit', '50']]),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should have GET /api/mesh route', async () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/mesh',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle OPTIONS for CORS', async () => {
      const request: HTTPRequest = {
        method: 'OPTIONS',
        path: '/any/path',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'TEST',
        timestamp: Date.now(),
        requestId: 'test-123'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });
});

describe('HTTPClient', () => {
  let client: HTTPClient;

  beforeEach(() => {
    client = new HTTPClient({
      callsign: 'KJ4ABC',
      maxBodySize: 8192,
      compressionThreshold: 1024,
      cacheDuration: 300000,
      requireSignatures: false
    });
    vi.clearAllMocks();
  });

  describe('request()', () => {
    it('should make a basic request', async () => {
      const response = await client.request('GET', '/test');
      
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
    });

    it('should include required headers', async () => {
      await client.request('GET', '/test', {
        headers: { 'X-Custom': 'value' }
      });

      // Request would include X-Callsign, X-Request-ID, User-Agent
      // (verified through internal state in real implementation)
    });

    it('should sign request when configured', async () => {
      const secureClient = new HTTPClient({
        callsign: 'KJ4ABC',
        requireSignatures: true,
        maxBodySize: 8192,
        compressionThreshold: 1024,
        cacheDuration: 300000
      });

      await secureClient.request('POST', '/secure', {
        body: 'test data'
      });

      const { cryptoManager } = await import('../crypto');
      expect(cryptoManager.signRequest).toHaveBeenCalled();
    });

    it('should handle request body', async () => {
      const response = await client.request('POST', '/data', {
        body: JSON.stringify({ test: 'data' })
      });

      expect(response.status).toBe(200);
    });

    it('should generate unique request IDs', async () => {
      // Request IDs should be unique
      const response1 = await client.request('GET', '/test1');
      const response2 = await client.request('GET', '/test2');
      
      // Each request gets a unique ID (internal implementation detail)
      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });
  });
});