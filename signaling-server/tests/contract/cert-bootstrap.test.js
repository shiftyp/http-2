import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

describe('Bootstrap API - POST /api/certificates/bootstrap', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8087;
  const certsDir = path.join(process.cwd(), 'certificates');

  beforeAll(async () => {
    // Ensure certificates directory exists but is empty
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }

    serverProcess = spawn('node', [path.join(process.cwd(), 'server.js')], {
      env: { ...process.env, PORT: serverPort },
      cwd: process.cwd()
    });
    
    serverUrl = `http://localhost:${serverPort}`;
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  beforeEach(async () => {
    // Restart server to ensure clean state
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clear certificates directory for each test
    if (fs.existsSync(certsDir)) {
      fs.readdirSync(certsDir).forEach(file => {
        fs.unlinkSync(path.join(certsDir, file));
      });
    }

    // Use a unique database path for this test run
    const testDbPath = path.join(process.cwd(), 'data', `test-cert-${Date.now()}.db`);

    // Clean up any old test databases
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(dataDir)) {
      fs.readdirSync(dataDir).forEach(file => {
        if (file.startsWith('test-cert-') || file === 'certificates.db') {
          fs.unlinkSync(path.join(dataDir, file));
        }
      });
    }

    // Restart server with unique DB path
    serverProcess = spawn('node', [path.join(process.cwd(), 'server.js')], {
      env: {
        ...process.env,
        PORT: serverPort,
        CERT_DB_PATH: testDbPath
      },
      cwd: process.cwd()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  it('should accept root certificate when no certificates exist', async () => {
    // Generate a test certificate (simplified for testing)
    const testCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...test...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KA1ABC',
      description: 'Root certificate for emergency operations',
      emergencyUse: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(testCert)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('certificateId');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('bootstrap');
  });

  it('should reject bootstrap when certificates already exist', async () => {
    // First, bootstrap with initial certificate
    const firstCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...first...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KA1ABC',
      description: 'First certificate',
      emergencyUse: true
    };

    await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(firstCert)
      .expect(201);

    // Try to bootstrap again
    const secondCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...second...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KB2DEF',
      description: 'Second certificate',
      emergencyUse: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(secondCert)
      .expect(403); // Forbidden

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('already bootstrapped');
  });

  it('should validate certificate format', async () => {
    const invalidCert = {
      certificatePem: 'not-a-valid-certificate',
      callsign: 'KA1ABC',
      description: 'Invalid certificate',
      emergencyUse: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(invalidCert)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('invalid certificate');
  });

  it('should require callsign', async () => {
    const certWithoutCallsign = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...test...XYZ
-----END CERTIFICATE-----`,
      description: 'Certificate without callsign',
      emergencyUse: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(certWithoutCallsign)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('callsign');
  });

  it('should validate callsign format', async () => {
    const certWithInvalidCallsign = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...test...XYZ
-----END CERTIFICATE-----`,
      callsign: 'INVALID-CALLSIGN',
      description: 'Certificate with invalid callsign',
      emergencyUse: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(certWithInvalidCallsign)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('callsign format');
  });

  it('should store certificate in database', async () => {
    const testCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...test...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KA1ABC',
      description: 'Test certificate for storage',
      emergencyUse: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(testCert)
      .expect(201);

    const certificateId = response.body.certificateId;

    // Verify certificate was stored
    const statusResponse = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    expect(statusResponse.body.certificates).toContainEqual(
      expect.objectContaining({
        id: certificateId,
        callsign: 'KA1ABC'
      })
    );
  });
});