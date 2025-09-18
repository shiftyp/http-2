import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HTTPServer, HTTPRequest, HTTPResponse } from './index';
import { CallsignValidator } from './callsign-validator';

// Mock logbook to avoid IndexedDB issues in tests
vi.mock('../logbook', () => ({
  logbook: {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    logTransmission: vi.fn().mockResolvedValue(undefined),
    getRecentTransmissions: vi.fn().mockResolvedValue([]),
    listPages: vi.fn().mockResolvedValue([]),
    savePage: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockResolvedValue(null)
  }
}));

describe('License Validation for HTTP Server', () => {
  let server: HTTPServer;

  beforeEach(async () => {
    // Create server with license validation enabled
    server = new HTTPServer({
      callsign: 'KA1ABC',
      requireLicense: true,  // Enable license validation
      requireSignatures: false
    });

    await server.start();

    // Register test routes
    server.route('GET', '/test', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'GET response'
    }));

    server.route('POST', '/test', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'POST response'
    }));

    server.route('PUT', '/test', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'PUT response'
    }));

    server.route('DELETE', '/test', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'DELETE response'
    }));
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('CallsignValidator', () => {
    it('should validate US amateur radio callsigns', () => {
      const validCallsigns = ['KA1ABC', 'W2DEF', 'N3GHI', 'K4JKL', 'AA5MNO'];

      for (const callsign of validCallsigns) {
        const result = CallsignValidator.validate(callsign);
        expect(result.valid).toBe(true);
        expect(result.licensed).toBe(true);
        expect(result.type).toBe('amateur');
        expect(result.country).toBe('United States');
      }
    });

    it('should validate international amateur radio callsigns', () => {
      const internationalCallsigns = [
        { callsign: 'VE7ABC', country: 'Canada' },
        { callsign: 'G0XYZ', country: 'UK' },
        { callsign: 'DL1ABC', country: 'Germany' },
        { callsign: 'JA1XYZ', country: 'Japan' },
        { callsign: 'VK2ABC', country: 'Australia' },
        { callsign: 'F4XYZ', country: 'France' }
      ];

      for (const { callsign, country } of internationalCallsigns) {
        const result = CallsignValidator.validate(callsign);
        expect(result.valid).toBe(true);
        expect(result.licensed).toBe(true);
        expect(result.type).toBe('amateur');
        expect(result.country).toBe(country);
      }
    });

    it('should identify SWL and unlicensed stations', () => {
      const unlicensedCallsigns = [
        'SWL-12345',
        'SCANNER-001',
        'UNLICENSED',
        'GUEST-USER',
        'MONITOR-1',
        'RX-ONLY-ABC',
        'OBSERVER-123'
      ];

      for (const callsign of unlicensedCallsigns) {
        const result = CallsignValidator.validate(callsign);
        expect(result.licensed).toBe(false);
        expect(result.type).toBe('swl');
      }
    });

    it('should reject invalid callsign formats', () => {
      const invalidCallsigns = [
        '',
        '123456',
        'TOOLONGCALLSIGN',
        'NO-NUMBERS',
        '!!!INVALID',
        'AB',  // Too short
        null,
        undefined
      ];

      for (const callsign of invalidCallsigns) {
        const result = CallsignValidator.validate(callsign as string);
        expect(result.valid).toBe(false);
        expect(result.licensed).toBe(false);
        expect(result.type).toBe('unlicensed');
        expect(result.error).toBeDefined();
      }
    });

    it('should determine allowed methods based on license status', () => {
      // Licensed amateur
      let methods = CallsignValidator.getAllowedMethods('KA1ABC');
      expect(methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']);

      // SWL station
      methods = CallsignValidator.getAllowedMethods('SWL-12345');
      expect(methods).toEqual(['GET', 'HEAD', 'OPTIONS']);

      // Invalid callsign
      methods = CallsignValidator.getAllowedMethods('INVALID');
      expect(methods).toEqual(['GET', 'HEAD', 'OPTIONS']);
    });
  });

  describe('Licensed Amateur Station Access', () => {
    const licensedCallsigns = ['KA1ABC', 'W2DEF', 'VE7XYZ'];

    for (const callsign of licensedCallsigns) {
      it(`should allow all HTTP methods for licensed callsign ${callsign}`, async () => {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'] as const;

        for (const method of methods) {
          const request: HTTPRequest = {
            method,
            path: '/test',
            version: 'HTTP/1.1',
            headers: new Map(),
            callsign,
            timestamp: Date.now(),
            requestId: `test-${method}-${Date.now()}`
          };

          const response = await server.handleRequest(request);

          if (method === 'HEAD' || method === 'OPTIONS') {
            // These might return different status codes
            expect(response.status).toBeLessThan(500);
          } else {
            expect(response.status).toBe(200);
          }

          // Should include server callsign in headers if response has headers Map
          if (response.headers && response.headers instanceof Map) {
            expect(response.headers.get('X-Callsign')).toBe('KA1ABC');
          }
        }
      });
    }
  });

  describe('Unlicensed Station Restrictions', () => {
    const unlicensedCallsigns = ['SWL-12345', 'SCANNER-001', 'INVALID', 'GUEST'];

    for (const callsign of unlicensedCallsigns) {
      it(`should restrict ${callsign} to GET/HEAD/OPTIONS only`, async () => {
        // Test allowed methods
        const allowedMethods = ['GET', 'HEAD', 'OPTIONS'] as const;
        for (const method of allowedMethods) {
          const request: HTTPRequest = {
            method,
            path: '/test',
            version: 'HTTP/1.1',
            headers: new Map(),
            callsign,
            timestamp: Date.now(),
            requestId: `test-${method}-${Date.now()}`
          };

          const response = await server.handleRequest(request);

          // Should not return 403 for allowed methods
          expect(response.status).not.toBe(403);
        }

        // Test restricted methods
        const restrictedMethods = ['POST', 'PUT', 'DELETE'] as const;
        for (const method of restrictedMethods) {
          const request: HTTPRequest = {
            method,
            path: '/test',
            version: 'HTTP/1.1',
            headers: new Map(),
            callsign,
            timestamp: Date.now(),
            requestId: `test-${method}-${Date.now()}`
          };

          const response = await server.handleRequest(request);

          // Should return 403 Forbidden
          expect(response.status).toBe(403);
          expect(response.statusText).toBe('Forbidden');
          expect(response.body).toContain('restricted to GET, HEAD, and OPTIONS');
          expect(response.headers.get('X-License-Status')).toBe('unlicensed');
          expect(response.headers.get('X-Allowed-Methods')).toBe('GET, HEAD, OPTIONS');
        }
      });
    }
  });

  describe('Server Configuration', () => {
    it('should allow disabling license validation', async () => {
      // Create server without license validation
      const openServer = new HTTPServer({
        callsign: 'OPEN-SERVER',
        requireLicense: false,  // Disable license validation
        requireSignatures: false
      });

      await openServer.start();

      openServer.route('POST', '/open', async () => ({
        status: 200,
        statusText: 'OK',
        headers: new Map([['Content-Type', 'text/plain']]),
        body: 'Open access'
      }));

      // Unlicensed station should be able to POST
      const request: HTTPRequest = {
        method: 'POST',
        path: '/open',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'UNLICENSED',
        timestamp: Date.now(),
        requestId: 'open-test'
      };

      const response = await openServer.handleRequest(request);
      expect(response.status).toBe(200);
      expect(response.body).toBe('Open access');

      await openServer.stop();
    });

    it('should enable license validation by default', async () => {
      // Create server with default settings
      const defaultServer = new HTTPServer({
        callsign: 'DEFAULT-SERVER'
      });

      await defaultServer.start();

      defaultServer.route('POST', '/default', async () => ({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: 'Should not reach here'
      }));

      // Unlicensed station should be blocked
      const request: HTTPRequest = {
        method: 'POST',
        path: '/default',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'UNLICENSED',
        timestamp: Date.now(),
        requestId: 'default-test'
      };

      const response = await defaultServer.handleRequest(request);
      expect(response.status).toBe(403);
      expect(response.statusText).toBe('Forbidden');

      await defaultServer.stop();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special event callsigns', () => {
      const specialCallsigns = ['K1A', 'W1AW', 'N9N'];

      for (const callsign of specialCallsigns) {
        const result = CallsignValidator.validate(callsign);
        expect(result.valid).toBe(true);
        expect(result.licensed).toBe(true);
        expect(['amateur', 'special']).toContain(result.type);
      }
    });

    it('should handle case insensitive callsigns', () => {
      const callsigns = ['ka1abc', 'KA1ABC', 'Ka1AbC'];

      for (const callsign of callsigns) {
        const result = CallsignValidator.validate(callsign);
        expect(result.valid).toBe(true);
        expect(result.licensed).toBe(true);
        expect(result.callsign).toBe('KA1ABC'); // Normalized to uppercase
      }
    });

    it('should include helpful error messages for unlicensed stations', async () => {
      const request: HTTPRequest = {
        method: 'POST',
        path: '/test',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'INVALID-CALL',
        timestamp: Date.now(),
        requestId: 'error-test'
      };

      const response = await server.handleRequest(request);
      expect(response.status).toBe(403);
      expect(response.body).toContain('INVALID-CALL');
      expect(response.body).toContain('unlicensed');
      expect(response.headers.get('X-Allowed-Methods')).toBe('GET, HEAD, OPTIONS');
    });
  });

  describe('License Status Headers', () => {
    it('should add license status headers to responses', async () => {
      // Licensed request
      let request: HTTPRequest = {
        method: 'GET',
        path: '/test',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'KA1ABC',
        timestamp: Date.now(),
        requestId: 'licensed-header-test'
      };

      let response = await server.handleRequest(request);
      // The request headers would have been modified
      expect(request.headers.get('X-License-Status')).toBe('licensed');
      expect(request.headers.get('X-Callsign-Type')).toBe('amateur');

      // Unlicensed request (but allowed method)
      request = {
        method: 'GET',
        path: '/test',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: 'SWL-12345',
        timestamp: Date.now(),
        requestId: 'unlicensed-header-test'
      };

      response = await server.handleRequest(request);
      expect(request.headers.get('X-License-Status')).toBe('unlicensed');
      expect(request.headers.get('X-Callsign-Type')).toBe('swl');
    });
  });
});