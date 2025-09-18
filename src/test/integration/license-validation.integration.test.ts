import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';
import { HTTPServer } from '../../lib/ham-server';
import { HTTPProtocol } from '../../lib/http-protocol';
import { CallsignValidator } from '../../lib/ham-server/callsign-validator';

describe('License Validation Integration Test', () => {
  let licensedServer: HTTPServer;
  let protocol: HTTPProtocol;

  beforeEach(async () => {
    // Set up server with license validation
    licensedServer = new HTTPServer({
      callsign: 'KA1ABC',
      requireLicense: true,
      requireSignatures: false
    });

    protocol = new HTTPProtocol({
      callsign: 'TEST'
    });

    await licensedServer.start();

    // Register test endpoints
    licensedServer.route('GET', '/public', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/html']]),
      body: '<h1>Public Content - Anyone Can Read</h1>'
    }));

    licensedServer.route('POST', '/submit', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'Data submitted successfully'
    }));

    licensedServer.route('PUT', '/update', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'Resource updated'
    }));

    licensedServer.route('DELETE', '/delete', async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map([['Content-Type', 'text/plain']]),
      body: 'Resource deleted'
    }));
  });

  afterEach(async () => {
    await licensedServer.stop();
  });

  describe('FCC Part 97 Compliance', () => {
    it('should allow licensed amateur radio operators full access', async () => {
      const licensedCallsigns = [
        'KA1ABC',  // US Technician
        'W2DEF',   // US General/Extra
        'N3GHI',   // US Amateur Extra
        'VE7XYZ',  // Canadian
        'G0ABC'    // UK
      ];

      for (const callsign of licensedCallsigns) {
        // Verify callsign is recognized as licensed
        const validation = CallsignValidator.validate(callsign);
        expect(validation.licensed).toBe(true);
        expect(validation.type).toBe('amateur');

        // Test all methods
        const request = {
          method: 'POST' as const,
          path: '/submit',
          version: 'HTTP/1.1',
          headers: new Map(),
          body: Buffer.from('test data'),
          callsign,
          timestamp: Date.now(),
          requestId: `test-${callsign}-${Date.now()}`
        };

        const response = await licensedServer.handleRequest(request);
        expect(response.status).not.toBe(403);
        expect(response.body).toContain('submitted successfully');
      }
    });

    it('should restrict unlicensed operators to read-only access', async () => {
      const unlicensedCallsigns = [
        'SWL-12345',      // Short Wave Listener
        'SCANNER-001',    // Scanner enthusiast
        'INVALID-CALL',   // Invalid format
        'GUEST-USER',     // Guest access
        '12345',          // Numbers only
        'NOCALLSIGN'      // No valid format
      ];

      for (const callsign of unlicensedCallsigns) {
        // GET should work
        let request = {
          method: 'GET' as const,
          path: '/public',
          version: 'HTTP/1.1',
          headers: new Map(),
          callsign,
          timestamp: Date.now(),
          requestId: `test-get-${callsign}-${Date.now()}`
        };

        let response = await licensedServer.handleRequest(request);
        expect(response.status).toBe(200);
        expect(response.body).toContain('Public Content');

        // POST should be blocked
        request = {
          method: 'POST' as const,
          path: '/submit',
          version: 'HTTP/1.1',
          headers: new Map(),
          body: Buffer.from('test data'),
          callsign,
          timestamp: Date.now(),
          requestId: `test-post-${callsign}-${Date.now()}`
        };

        response = await licensedServer.handleRequest(request);
        expect(response.status).toBe(403);
        expect(response.statusText).toBe('Forbidden');
        expect(response.body).toContain('restricted to GET, HEAD, and OPTIONS');
        expect(response.headers.get('X-License-Status')).toBe('unlicensed');
      }
    });

    it('should provide appropriate error messages for unlicensed users', async () => {
      const request = {
        method: 'PUT' as const,
        path: '/update',
        version: 'HTTP/1.1',
        headers: new Map(),
        body: Buffer.from('update data'),
        callsign: 'UNLICENSED',
        timestamp: Date.now(),
        requestId: 'error-msg-test'
      };

      const response = await licensedServer.handleRequest(request);

      expect(response.status).toBe(403);
      expect(response.body).toContain('UNLICENSED');
      expect(response.body).toContain('restricted');
      expect(response.headers.get('X-Allowed-Methods')).toBe('GET, HEAD, OPTIONS');
    });
  });

  describe('Special Callsign Handling', () => {
    it('should recognize special event callsigns as licensed', async () => {
      const specialCallsigns = [
        'K1A',    // Special 1x1
        'W1AW',   // ARRL HQ
        'W9W'     // Special event
      ];

      for (const callsign of specialCallsigns) {
        const validation = CallsignValidator.validate(callsign);
        expect(validation.licensed).toBe(true);
        expect(['amateur', 'special']).toContain(validation.type);

        const request = {
          method: 'POST' as const,
          path: '/submit',
          version: 'HTTP/1.1',
          headers: new Map(),
          body: Buffer.from('special event data'),
          callsign,
          timestamp: Date.now(),
          requestId: `special-${callsign}`
        };

        const response = await licensedServer.handleRequest(request);
        expect(response.status).not.toBe(403);
      }
    });

    it('should handle SWL (Short Wave Listener) stations appropriately', async () => {
      const swlCallsign = 'SWL-USA-12345';

      const validation = CallsignValidator.validate(swlCallsign);
      expect(validation.licensed).toBe(false);
      expect(validation.type).toBe('swl');

      // SWL can read
      const getRequest = {
        method: 'GET' as const,
        path: '/public',
        version: 'HTTP/1.1',
        headers: new Map(),
        callsign: swlCallsign,
        timestamp: Date.now(),
        requestId: 'swl-get'
      };

      let response = await licensedServer.handleRequest(getRequest);
      expect(response.status).toBe(200);

      // SWL cannot write
      const postRequest = {
        method: 'POST' as const,
        path: '/submit',
        version: 'HTTP/1.1',
        headers: new Map(),
        body: Buffer.from('swl data'),
        callsign: swlCallsign,
        timestamp: Date.now(),
        requestId: 'swl-post'
      };

      response = await licensedServer.handleRequest(postRequest);
      expect(response.status).toBe(403);
      expect(response.body).toContain('SWL-USA-12345');
      expect(response.body).toContain('restricted');
    });
  });

  describe('Server Configuration Options', () => {
    it('should respect requireLicense configuration', async () => {
      // Create server without license requirement
      const openServer = new HTTPServer({
        callsign: 'OPEN',
        requireLicense: false
      });

      await openServer.start();

      openServer.route('POST', '/open', async () => ({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: 'Posted'
      }));

      // Unlicensed user can POST
      const request = {
        method: 'POST' as const,
        path: '/open',
        version: 'HTTP/1.1',
        headers: new Map(),
        body: Buffer.from('data'),
        callsign: 'INVALID',
        timestamp: Date.now(),
        requestId: 'open-access'
      };

      const response = await openServer.handleRequest(request);
      expect(response.status).toBe(200);

      await openServer.stop();
    });

    it('should log license status for monitoring', async () => {
      const requests = [
        { callsign: 'KA1ABC', expectedStatus: 'licensed', expectedType: 'amateur' },
        { callsign: 'SWL-123', expectedStatus: 'unlicensed', expectedType: 'swl' },
        { callsign: 'INVALID', expectedStatus: 'unlicensed', expectedType: 'unlicensed' }
      ];

      for (const { callsign, expectedStatus, expectedType } of requests) {
        const request = {
          method: 'GET' as const,
          path: '/public',
          version: 'HTTP/1.1',
          headers: new Map(),
          callsign,
          timestamp: Date.now(),
          requestId: `log-${callsign}`
        };

        await licensedServer.handleRequest(request);

        // Check that license status was added to request headers for logging
        expect(request.headers.get('X-License-Status')).toBe(expectedStatus);
        expect(request.headers.get('X-Callsign-Type')).toBe(expectedType);
      }
    });
  });

  describe('International Callsign Support', () => {
    it('should recognize international amateur callsigns', async () => {
      const internationalCallsigns = [
        { callsign: 'VE3ABC', country: 'Canada' },
        { callsign: 'G0XYZ', country: 'UK' },
        { callsign: 'DL1ABC', country: 'Germany' },
        { callsign: 'JA1ABC', country: 'Japan' },
        { callsign: 'VK2XYZ', country: 'Australia' },
        { callsign: 'F5ABC', country: 'France' },
        { callsign: 'EA1XYZ', country: 'Spain' },
        { callsign: 'I0ABC', country: 'Italy' },
        { callsign: 'PY2ABC', country: 'Brazil' }
      ];

      for (const { callsign, country } of internationalCallsigns) {
        const validation = CallsignValidator.validate(callsign);
        expect(validation.licensed).toBe(true);
        expect(validation.country).toBe(country);

        // Should have full access
        const request = {
          method: 'DELETE' as const,
          path: '/delete',
          version: 'HTTP/1.1',
          headers: new Map(),
          callsign,
          timestamp: Date.now(),
          requestId: `intl-${callsign}`
        };

        const response = await licensedServer.handleRequest(request);
        expect(response.status).not.toBe(403);
      }
    });
  });
});