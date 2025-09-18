import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Bootstrap API - POST /api/certificates/initialize', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8089;
  const certsDir = path.join(process.cwd(), 'certificates');

  beforeAll(async () => {
    // Ensure certificates directory exists but is empty
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }

    // Clear certificates
    fs.readdirSync(certsDir).forEach(file => {
      fs.unlinkSync(path.join(certsDir, file));
    });

    // Remove database file to ensure clean state
    const dbPath = path.join(process.cwd(), 'data', 'certificates.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
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

    // Clear database between tests to ensure isolation
    const dbPath = path.join(process.cwd(), 'data', 'certificates.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Clear certificates
    if (fs.existsSync(certsDir)) {
      fs.readdirSync(certsDir).forEach(file => {
        fs.unlinkSync(path.join(certsDir, file));
      });
    }

    // Restart server with clean state
    serverProcess = spawn('node', [path.join(process.cwd(), 'server.js')], {
      env: { ...process.env, PORT: serverPort },
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

  it('should initialize certificate store with root certificate', async () => {
    const initData = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...root...XYZ
-----END CERTIFICATE-----`,
        callsign: 'KA1ABC',
        description: 'Root certificate for network',
        emergencyUse: true
      },
      config: {
        trustChainMaxDepth: 5,
        requireEmergencyCapability: true,
        allowSelfSigned: false
      }
    };

    const response = await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(initData)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('rootCertificateId');
    expect(response.body).toHaveProperty('config');
    expect(response.body.config).toMatchObject(initData.config);
  });

  it('should reject initialization if already initialized', async () => {
    // First initialization
    const firstInit = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...first...XYZ
-----END CERTIFICATE-----`,
        callsign: 'KA1ABC',
        description: 'First root',
        emergencyUse: true
      }
    };

    await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(firstInit)
      .expect(201);

    // Try to initialize again
    const secondInit = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...second...XYZ
-----END CERTIFICATE-----`,
        callsign: 'KB2DEF',
        description: 'Second root',
        emergencyUse: true
      }
    };

    const response = await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(secondInit)
      .expect(403);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('already initialized');
  });

  it('should validate configuration parameters', async () => {
    const invalidConfig = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...test...XYZ
-----END CERTIFICATE-----`,
        callsign: 'KA1ABC',
        description: 'Test root',
        emergencyUse: true
      },
      config: {
        trustChainMaxDepth: 100, // Too deep
        requireEmergencyCapability: true
      }
    };

    const response = await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(invalidConfig)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('trust chain depth');
  });

  it('should create default configuration if not provided', async () => {
    const minimalInit = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...minimal...XYZ
-----END CERTIFICATE-----`,
        callsign: 'KA1ABC',
        description: 'Minimal root',
        emergencyUse: true
      }
    };

    const response = await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(minimalInit)
      .expect(201);

    expect(response.body).toHaveProperty('config');
    expect(response.body.config).toHaveProperty('trustChainMaxDepth');
    expect(response.body.config).toHaveProperty('requireEmergencyCapability');
    expect(response.body.config).toHaveProperty('allowSelfSigned');
  });

  it('should set up trust chain with root certificate', async () => {
    const initData = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...chain...XYZ
-----END CERTIFICATE-----`,
        callsign: 'KA1ABC',
        description: 'Chain root',
        emergencyUse: true
      }
    };

    await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(initData)
      .expect(201);

    // Verify trust chain
    const statusResponse = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    expect(statusResponse.body).toHaveProperty('trustChainDepth', 1);
    expect(statusResponse.body.rootCertificate).toMatchObject({
      callsign: 'KA1ABC'
    });
  });

  it('should support emergency mode initialization', async () => {
    const emergencyInit = {
      rootCertificate: {
        certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...emergency...XYZ
-----END CERTIFICATE-----`,
        callsign: 'EMRG1',
        description: 'Emergency operations root',
        emergencyUse: true
      },
      emergencyMode: true
    };

    const response = await request(serverUrl)
      .post('/api/certificates/initialize')
      .send(emergencyInit)
      .expect(201);

    expect(response.body).toHaveProperty('emergencyMode', true);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('emergency');
  });
});