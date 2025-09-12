import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPProtocol, HTTPPacket, HTTPRequest, HTTPResponse } from './index';
import { mockRadioControl } from '../../test/mocks';

describe('HTTPProtocol', () => {
  let protocol: HTTPProtocol;

  beforeEach(() => {
    protocol = new HTTPProtocol({
      callsign: 'TEST',
      retryLimit: 3,
      timeout: 5000
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const config = {
        callsign: 'KJ4ABC',
        retryLimit: 2,
        timeout: 10000
      };
      
      const testProtocol = new HTTPProtocol(config);
      expect(testProtocol).toBeDefined();
    });

    it('should use default values when config is partial', () => {
      const testProtocol = new HTTPProtocol({ callsign: 'TEST' });
      expect(testProtocol).toBeDefined();
    });
  });

  describe('Packet Creation', () => {
    it('should create valid HTTP packets', () => {
      const request: HTTPRequest = {
        method: 'GET',
        path: '/test',
        headers: { 'Accept': 'application/json' },
        body: null
      };

      const packet = protocol.createPacket('REQUEST', request, 'DEST');
      
      expect(packet.header.version).toBe(1);
      expect(packet.header.type).toBe('REQUEST');
      expect(packet.header.source).toBe('TEST');
      expect(packet.header.destination).toBe('DEST');
      expect(packet.payload).toEqual(request);
    });

    it('should generate unique sequence numbers', () => {
      const packet1 = protocol.createPacket('REQUEST', {}, 'DEST');
      const packet2 = protocol.createPacket('REQUEST', {}, 'DEST');

      expect(packet1.header.sequence).not.toBe(packet2.header.sequence);
    });

    it('should calculate correct checksums', () => {
      const request = { method: 'GET', path: '/test', headers: {}, body: null };
      const packet = protocol.createPacket('REQUEST', request, 'DEST');

      expect(packet.header.checksum).toBeGreaterThan(0);
    });
  });

  describe('Request Sending', () => {
    it('should send HTTP requests successfully', async () => {
      const mockTransmit = vi.fn().mockResolvedValue(undefined);
      protocol.setRadio({ transmit: mockTransmit } as any);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/api/status',
        headers: { 'Accept': 'application/json' }
      };

      // Mock a successful response
      setTimeout(() => {
        const responsePacket: HTTPPacket = {
          header: {
            version: 1,
            type: 'RESPONSE',
            source: 'DEST',
            destination: 'TEST',
            sequence: 1,
            timestamp: Date.now(),
            length: 100,
            checksum: 12345
          },
          payload: {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            body: { success: true }
          }
        };
        protocol.handlePacket(responsePacket);
      }, 100);

      const response = await protocol.sendRequest(request, 'DEST');
      
      expect(mockTransmit).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should timeout on no response', async () => {
      const mockTransmit = vi.fn().mockResolvedValue(undefined);
      protocol.setRadio({ transmit: mockTransmit } as any);

      const shortTimeoutProtocol = new HTTPProtocol({
        callsign: 'TEST',
        timeout: 100
      });
      shortTimeoutProtocol.setRadio({ transmit: mockTransmit } as any);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/test',
        headers: {}
      };

      await expect(shortTimeoutProtocol.sendRequest(request, 'DEST'))
        .rejects.toThrow('Request timeout');
    });

    it('should retry failed requests', async () => {
      const mockTransmit = vi.fn()
        .mockRejectedValueOnce(new Error('Transmission failed'))
        .mockRejectedValueOnce(new Error('Transmission failed'))
        .mockResolvedValueOnce(undefined);

      protocol.setRadio({ transmit: mockTransmit } as any);

      const request: HTTPRequest = {
        method: 'POST',
        path: '/api/test',
        headers: { 'Content-Type': 'application/json' },
        body: { test: true }
      };

      // Mock successful response after retries
      setTimeout(() => {
        const responsePacket: HTTPPacket = {
          header: {
            version: 1,
            type: 'RESPONSE',
            source: 'DEST',
            destination: 'TEST',
            sequence: 1,
            timestamp: Date.now(),
            length: 50,
            checksum: 12345
          },
          payload: { status: 201, statusText: 'Created', headers: {}, body: {} }
        };
        protocol.handlePacket(responsePacket);
      }, 200);

      const response = await protocol.sendRequest(request, 'DEST');
      
      expect(mockTransmit).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(201);
    });
  });

  describe('Request Handling', () => {
    it('should handle incoming requests', async () => {
      const handler = vi.fn().mockImplementation(async (req, respond) => {
        respond({
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Hello'
        });
      });

      protocol.onRequest(handler);

      const requestPacket: HTTPPacket = {
        header: {
          version: 1,
          type: 'REQUEST',
          source: 'CLIENT',
          destination: 'TEST',
          sequence: 1,
          timestamp: Date.now(),
          length: 100,
          checksum: 12345
        },
        payload: {
          method: 'GET',
          path: '/hello',
          headers: {},
          body: null
        }
      };

      await protocol.handlePacket(requestPacket);

      expect(handler).toHaveBeenCalledWith(
        requestPacket.payload,
        expect.any(Function)
      );
    });

    it('should send appropriate error responses for invalid requests', async () => {
      const mockTransmit = vi.fn();
      protocol.setRadio({ transmit: mockTransmit } as any);

      const invalidPacket: HTTPPacket = {
        header: {
          version: 2, // Unsupported version
          type: 'REQUEST',
          source: 'CLIENT',
          destination: 'TEST',
          sequence: 1,
          timestamp: Date.now(),
          length: 50,
          checksum: 12345
        },
        payload: {
          method: 'INVALID' as any,
          path: '/test',
          headers: {},
          body: null
        }
      };

      await protocol.handlePacket(invalidPacket);

      expect(mockTransmit).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            status: 400
          })
        })
      );
    });
  });

  describe('Packet Validation', () => {
    it('should validate packet checksums', () => {
      const validPacket: HTTPPacket = {
        header: {
          version: 1,
          type: 'REQUEST',
          source: 'TEST',
          destination: 'DEST',
          sequence: 1,
          timestamp: Date.now(),
          length: 50,
          checksum: 0 // Will be calculated
        },
        payload: { method: 'GET', path: '/', headers: {}, body: null }
      };

      // Calculate correct checksum
      const checksum = protocol.calculateChecksum(validPacket.payload);
      validPacket.header.checksum = checksum;

      expect(protocol.validatePacket(validPacket)).toBe(true);

      // Test invalid checksum
      validPacket.header.checksum = 99999;
      expect(protocol.validatePacket(validPacket)).toBe(false);
    });

    it('should validate packet structure', () => {
      const validPacket: HTTPPacket = {
        header: {
          version: 1,
          type: 'REQUEST',
          source: 'TEST',
          destination: 'DEST',
          sequence: 1,
          timestamp: Date.now(),
          length: 50,
          checksum: 12345
        },
        payload: { method: 'GET', path: '/', headers: {}, body: null }
      };

      expect(protocol.validatePacket(validPacket)).toBe(true);

      // Test missing required fields
      const invalidPacket = { ...validPacket };
      delete (invalidPacket as any).header.version;
      
      expect(protocol.validatePacket(invalidPacket)).toBe(false);
    });

    it('should reject packets with unsupported versions', () => {
      const packet: HTTPPacket = {
        header: {
          version: 999,
          type: 'REQUEST',
          source: 'TEST',
          destination: 'DEST',
          sequence: 1,
          timestamp: Date.now(),
          length: 50,
          checksum: 12345
        },
        payload: { method: 'GET', path: '/', headers: {}, body: null }
      };

      expect(protocol.validatePacket(packet)).toBe(false);
    });
  });

  describe('Protocol Statistics', () => {
    it('should track packet statistics', () => {
      const initialStats = protocol.getStats();
      
      expect(initialStats.packetsSent).toBe(0);
      expect(initialStats.packetsReceived).toBe(0);
      expect(initialStats.bytesSent).toBe(0);
      expect(initialStats.bytesReceived).toBe(0);
      expect(initialStats.errors).toBe(0);
    });

    it('should increment statistics on packet operations', async () => {
      const mockTransmit = vi.fn().mockResolvedValue(undefined);
      protocol.setRadio({ transmit: mockTransmit } as any);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/stats',
        headers: {}
      };

      // Send a request (won't wait for response)
      protocol.sendRequest(request, 'DEST').catch(() => {});

      // Give it time to send
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = protocol.getStats();
      expect(stats.packetsSent).toBe(1);
      expect(stats.bytesSent).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle transmission errors gracefully', async () => {
      const mockTransmit = vi.fn().mockRejectedValue(new Error('Radio error'));
      protocol.setRadio({ transmit: mockTransmit } as any);

      const request: HTTPRequest = {
        method: 'GET',
        path: '/test',
        headers: {}
      };

      await expect(protocol.sendRequest(request, 'DEST'))
        .rejects.toThrow();

      const stats = protocol.getStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    it('should handle malformed packets', async () => {
      const malformedPacket = {
        header: {
          version: 1,
          type: 'REQUEST'
          // Missing required fields
        },
        payload: null
      } as any;

      await expect(protocol.handlePacket(malformedPacket))
        .rejects.toThrow();
    });

    it('should handle payload serialization errors', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        protocol.createPacket('REQUEST', circular, 'DEST');
      }).toThrow();
    });
  });

  describe('Compression Integration', () => {
    it('should compress large payloads automatically', () => {
      const largePayload = {
        method: 'POST',
        path: '/api/upload',
        headers: { 'Content-Type': 'application/json' },
        body: {
          data: 'x'.repeat(2000) // Large payload
        }
      };

      const packet = protocol.createPacket('REQUEST', largePayload, 'DEST');
      
      // Should be compressed
      expect(packet.header.flags).toBeDefined();
      expect(packet.header.length).toBeLessThan(2000);
    });

    it('should decompress compressed payloads', async () => {
      const originalPayload = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'x'.repeat(1000) }
      };

      // Create compressed packet
      const compressedPacket = protocol.createPacket('RESPONSE', originalPayload, 'TEST');
      
      // Handle as incoming packet
      const result = await protocol.handlePacket(compressedPacket);
      
      // Should decompress correctly
      expect(result).toBeDefined();
    });
  });
});