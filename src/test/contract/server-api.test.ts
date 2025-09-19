import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:8080';

describe('Server API Contract Tests', () => {
  describe('GET /api/status', () => {
    it('should return server status with required fields', async () => {
      const response = await fetch(`${SERVER_URL}/api/status`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('state');
      expect(['unclaimed', 'claimed', 'active']).toContain(data.state);
      expect(data).toHaveProperty('version');
      expect(data.version).toMatch(/^\d+\.\d+\.\d+-\d+$/); // Version with build suffix

      if (data.state !== 'unclaimed') {
        expect(data).toHaveProperty('owner');
        expect(data.owner).toMatch(/^[A-Z0-9]+$/); // Valid callsign
      }

      expect(data).toHaveProperty('signaling');
      expect(data.signaling).toHaveProperty('url');
      expect(data.signaling).toHaveProperty('connected');
      expect(typeof data.signaling.connected).toBe('number');
    });
  });

  describe('POST /api/claim-station', () => {
    it('should reject claim without valid certificate', async () => {
      const response = await fetch(`${SERVER_URL}/api/claim-station`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate: 'invalid',
          station: { callsign: 'TEST' }
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should reject claim if server already claimed', async () => {
      // First, check if server is claimed
      const statusResponse = await fetch(`${SERVER_URL}/api/status`);
      const status = await statusResponse.json();

      if (status.state !== 'unclaimed') {
        const response = await fetch(`${SERVER_URL}/api/claim-station`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificate: 'valid-cert',
            station: { callsign: 'TEST' }
          })
        });

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain('already claimed');
      }
    });
  });

  describe('GET /api/info', () => {
    it('should return server capabilities', async () => {
      const response = await fetch(`${SERVER_URL}/api/info`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('type');
      expect(['signaling', 'server']).toContain(data.type);
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('capabilities');
      expect(Array.isArray(data.capabilities)).toBe(true);

      // Check for expected capabilities
      const validCapabilities = ['signaling', 'webrtc', 'ca', 'mesh', 'cache'];
      data.capabilities.forEach((cap: string) => {
        expect(validCapabilities).toContain(cap);
      });
    });
  });

  describe('GET /api/certificates', () => {
    it('should return list of trusted certificates', async () => {
      const response = await fetch(`${SERVER_URL}/api/certificates`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const cert = data[0];
        expect(cert).toHaveProperty('fingerprint');
        expect(cert).toHaveProperty('callsign');
        expect(cert).toHaveProperty('licenseClass');
        expect(['Technician', 'General', 'Extra']).toContain(cert.licenseClass);
        expect(cert).toHaveProperty('trustLevel');
        expect(['root', 'intermediate', 'peer']).toContain(cert.trustLevel);
      }
    });
  });

  describe('POST /api/certificates', () => {
    it('should reject invalid certificate format', async () => {
      const response = await fetch(`${SERVER_URL}/api/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate: 'not-a-valid-pem'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('GET /api/certificates/:fingerprint', () => {
    it('should return 404 for non-existent certificate', async () => {
      const response = await fetch(`${SERVER_URL}/api/certificates/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/issue-certificate', () => {
    it('should require CA capability', async () => {
      const response = await fetch(`${SERVER_URL}/api/issue-certificate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csr: 'certificate-signing-request',
          proofOfLicense: {}
        })
      });

      // Should fail if server doesn't have CA capability
      const status = await fetch(`${SERVER_URL}/api/info`);
      const info = await status.json();

      if (!info.capabilities?.includes('ca')) {
        expect(response.status).toBe(403);
      }
    });
  });

  describe('GET /api/peers', () => {
    it('should return list of peer servers', async () => {
      const response = await fetch(`${SERVER_URL}/api/peers`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const peer = data[0];
        expect(peer).toHaveProperty('endpoint');
        expect(peer).toHaveProperty('callsign');
        expect(peer).toHaveProperty('capabilities');
        expect(peer).toHaveProperty('lastContact');
        expect(peer).toHaveProperty('discoveryMethod');
        expect(['mdns', 'manual', 'cq', 'peer']).toContain(peer.discoveryMethod);
      }
    });
  });

  describe('POST /api/peers', () => {
    it('should validate peer endpoint format', async () => {
      const response = await fetch(`${SERVER_URL}/api/peers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'not-a-valid-url'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('GET /api/content-catalog', () => {
    it('should return content catalog', async () => {
      const response = await fetch(`${SERVER_URL}/api/content-catalog`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('serverId');
      expect(data).toHaveProperty('callsign');
      expect(data).toHaveProperty('lastUpdated');
      expect(data).toHaveProperty('totalSize');
      expect(data).toHaveProperty('entryCount');
      expect(data).toHaveProperty('entries');
      expect(Array.isArray(data.entries)).toBe(true);

      if (data.entries.length > 0) {
        const entry = data.entries[0];
        expect(entry).toHaveProperty('path');
        expect(entry).toHaveProperty('hash');
        expect(entry).toHaveProperty('size');
        expect(entry).toHaveProperty('contentType');
        expect(entry).toHaveProperty('priority');
      }
    });
  });

  describe('GET /api/local-servers', () => {
    it('should return discovered local servers', async () => {
      const response = await fetch(`${SERVER_URL}/api/local-servers`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('servers');
      expect(Array.isArray(data.servers)).toBe(true);

      if (data.servers.length > 0) {
        const server = data.servers[0];
        expect(server).toHaveProperty('callsign');
        expect(server).toHaveProperty('endpoint');
        expect(server).toHaveProperty('signalingUrl');
        expect(server).toHaveProperty('capabilities');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(fetch(`${SERVER_URL}/api/status`));
      }

      const responses = await Promise.all(promises);
      const tooManyRequests = responses.some(r => r.status === 429);

      // Should have rate limiting in place
      expect(tooManyRequests).toBe(true);
    });
  });

  describe('CORS Headers', () => {
    it('should include proper CORS headers', async () => {
      const response = await fetch(`${SERVER_URL}/api/status`);

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });
  });

  describe('Unlicensed Mode Support', () => {
    it('should handle unlicensed user requests', async () => {
      const response = await fetch(`${SERVER_URL}/api/status`, {
        headers: { 'X-User-Mode': 'unlicensed' }
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Server should still respond to unlicensed users for status
      expect(data).toHaveProperty('state');
    });

    it('should block server download for unlicensed users', async () => {
      const response = await fetch(`${SERVER_URL}/api/download-server`, {
        headers: { 'X-User-Mode': 'unlicensed' }
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('license required');
    });
  });
});

describe('WebSocket Signaling Contract Tests', () => {
  let ws: WebSocket;

  afterEach(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  it('should accept WebSocket connection at /ws/signal', (done) => {
    ws = new WebSocket(`ws://localhost:8080/ws/signal`);

    ws.onopen = () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    };

    ws.onerror = (error) => {
      done(error);
    };
  });

  it('should respond to REGISTER message', (done) => {
    ws = new WebSocket(`ws://localhost:8080/ws/signal`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'REGISTER',
        callsign: 'TEST',
        certificate: null
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      expect(data.type).toBe('REGISTERED');
      expect(data).toHaveProperty('clientId');
      expect(data).toHaveProperty('peers');
      done();
    };
  });
});