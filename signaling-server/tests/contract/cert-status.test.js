import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Bootstrap API - GET /api/certificates/status', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8088;
  const certsDir = path.join(process.cwd(), 'certificates');

  beforeAll(async () => {
    // Ensure certificates directory exists
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

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  it('should indicate bootstrap needed when no certificates exist', async () => {
    // Clear certificates
    if (fs.existsSync(certsDir)) {
      fs.readdirSync(certsDir).forEach(file => {
        fs.unlinkSync(path.join(certsDir, file));
      });
    }

    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('bootstrapNeeded', true);
    expect(response.body).toHaveProperty('certificateCount', 0);
    expect(response.body).toHaveProperty('certificates');
    expect(response.body.certificates).toEqual([]);
  });

  it('should show certificate count after bootstrap', async () => {
    // Bootstrap a certificate first
    const testCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...test...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KA1ABC',
      description: 'Test certificate',
      emergencyUse: true
    };

    await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(testCert)
      .expect(201);

    // Check status
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    expect(response.body).toHaveProperty('bootstrapNeeded', false);
    expect(response.body).toHaveProperty('certificateCount');
    expect(response.body.certificateCount).toBeGreaterThan(0);
  });

  it('should list certificate details', async () => {
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    if (response.body.certificateCount > 0) {
      expect(response.body.certificates).toBeInstanceOf(Array);
      
      response.body.certificates.forEach(cert => {
        expect(cert).toHaveProperty('id');
        expect(cert).toHaveProperty('callsign');
        expect(cert).toHaveProperty('createdAt');
        expect(cert).toHaveProperty('trustLevel');
      });
    }
  });

  it('should include trust chain information', async () => {
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    expect(response.body).toHaveProperty('trustChainDepth');
    expect(response.body).toHaveProperty('rootCertificate');
    
    if (response.body.certificateCount > 0) {
      expect(response.body.rootCertificate).toHaveProperty('callsign');
      expect(response.body.rootCertificate).toHaveProperty('id');
    }
  });

  it('should indicate server readiness', async () => {
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    expect(response.body).toHaveProperty('serverReady');
    expect(response.body.serverReady).toBe(
      response.body.certificateCount > 0
    );
  });

  it('should include timestamp', async () => {
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);

    expect(response.body).toHaveProperty('timestamp');
    const timestamp = new Date(response.body.timestamp);
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});