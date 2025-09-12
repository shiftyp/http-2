import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { RadioConnectRequest, RadioStatus } from '@shared/types';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Radio Control API Contract Tests', () => {
  describe('POST /api/radio/connect', () => {
    it('should connect to radio with valid configuration', async () => {
      const connectRequest: RadioConnectRequest = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        model: 'IC-7300',
        audioInput: 'hw:1,0',
        audioOutput: 'hw:1,0',
        pttMethod: 'CAT',
      };

      const response = await request(API_URL)
        .post('/api/radio/connect')
        .send(connectRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        connected: true,
        callsign: expect.any(String),
        model: 'IC-7300',
        frequency: expect.any(Number),
        mode: expect.any(String),
        connectionStatus: 'connected',
      });
    });

    it('should return 400 for invalid configuration', async () => {
      const invalidRequest = {
        port: '', // Invalid empty port
        baudRate: -1, // Invalid baud rate
        model: 'UNKNOWN',
      };

      await request(API_URL)
        .post('/api/radio/connect')
        .send(invalidRequest)
        .expect(400);
    });

    it('should return 500 if connection fails', async () => {
      const connectRequest: RadioConnectRequest = {
        port: '/dev/nonexistent',
        baudRate: 9600,
        model: 'IC-7300',
      };

      const response = await request(API_URL)
        .post('/api/radio/connect')
        .send(connectRequest)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/radio/status', () => {
    it('should return current radio status', async () => {
      const response = await request(API_URL)
        .get('/api/radio/status')
        .expect(200);

      const status: RadioStatus = response.body;
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('connectionStatus');
      expect(['disconnected', 'connecting', 'connected', 'error']).toContain(
        status.connectionStatus
      );

      if (status.connected) {
        expect(status).toHaveProperty('callsign');
        expect(status).toHaveProperty('model');
        expect(status).toHaveProperty('frequency');
        expect(status).toHaveProperty('mode');
      }
    });
  });

  describe('POST /api/radio/disconnect', () => {
    it('should disconnect from radio', async () => {
      await request(API_URL)
        .post('/api/radio/disconnect')
        .expect(200);

      // Verify disconnection
      const status = await request(API_URL)
        .get('/api/radio/status')
        .expect(200);

      expect(status.body.connected).toBe(false);
      expect(status.body.connectionStatus).toBe('disconnected');
    });

    it('should handle disconnect when not connected', async () => {
      // Disconnect twice should not error
      await request(API_URL)
        .post('/api/radio/disconnect')
        .expect(200);

      await request(API_URL)
        .post('/api/radio/disconnect')
        .expect(200);
    });
  });

  describe('Schema Validation', () => {
    it('should validate RadioStatus schema', async () => {
      const response = await request(API_URL)
        .get('/api/radio/status')
        .expect(200);

      const status = response.body;

      // Required fields
      expect(status).toHaveProperty('connected');
      expect(typeof status.connected).toBe('boolean');
      expect(status).toHaveProperty('connectionStatus');
      expect(typeof status.connectionStatus).toBe('string');

      // Optional fields when connected
      if (status.connected) {
        expect(typeof status.callsign).toBe('string');
        expect(status.callsign).toMatch(/^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]$/i);
        expect(typeof status.frequency).toBe('number');
        expect(status.frequency).toBeGreaterThan(0);
        expect(typeof status.mode).toBe('string');
        expect(['USB', 'LSB', 'AM', 'FM', 'CW', 'DATA']).toContain(status.mode);
      }
    });

    it('should validate connect request schema', async () => {
      const invalidRequests = [
        {}, // Missing required fields
        { port: '/dev/ttyUSB0' }, // Missing baudRate and model
        { port: 123, baudRate: 9600, model: 'IC-7300' }, // Wrong type for port
        { port: '/dev/ttyUSB0', baudRate: '9600', model: 'IC-7300' }, // Wrong type for baudRate
        { port: '/dev/ttyUSB0', baudRate: 9600, model: 123 }, // Wrong type for model
        { port: '/dev/ttyUSB0', baudRate: 9600, model: 'IC-7300', pttMethod: 'INVALID' }, // Invalid enum
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await request(API_URL)
          .post('/api/radio/connect')
          .send(invalidRequest)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });
});

describe('Radio Hardware Mock Mode', () => {
  it('should support mock mode for testing without hardware', async () => {
    const connectRequest: RadioConnectRequest = {
      port: 'MOCK',
      baudRate: 9600,
      model: 'MOCK-7300',
    };

    const response = await request(API_URL)
      .post('/api/radio/connect')
      .send(connectRequest)
      .expect(200);

    expect(response.body.connected).toBe(true);
    expect(response.body.model).toBe('MOCK-7300');
  });
});