import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

describe('Certificate Bootstrap Integration Flow', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8092;
  const certsDir = path.join(process.cwd(), 'certificates');
  const dbPath = path.join(process.cwd(), 'data', 'certificates.db');

  beforeAll(async () => {
    // Ensure clean state
    if (fs.existsSync(certsDir)) {
      fs.rmSync(certsDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    fs.mkdirSync(certsDir, { recursive: true });
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    // Start server
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

  it('should detect empty certificate store on fresh deployment', async () => {
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);
    
    expect(response.body).toHaveProperty('bootstrapNeeded', true);
    expect(response.body).toHaveProperty('certificateCount', 0);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('bootstrap required');
  });

  it('should accept first certificate as root', async () => {
    // Generate a mock certificate (in real scenario, this would be a valid X.509)
    const rootCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...root...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KA1ROOT',
      description: 'Network root certificate',
      emergencyUse: true,
      licenseClass: 'Extra'
    };
    
    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(rootCert)
      .expect(201);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('certificateId');
    expect(response.body).toHaveProperty('trustLevel', 3); // Root gets highest trust
  });

  it('should establish trust chain from root', async () => {
    // Check that root is now established
    const statusResponse = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);
    
    expect(statusResponse.body).toHaveProperty('bootstrapNeeded', false);
    expect(statusResponse.body).toHaveProperty('certificateCount', 1);
    expect(statusResponse.body).toHaveProperty('rootCertificate');
    expect(statusResponse.body.rootCertificate).toHaveProperty('callsign', 'KA1ROOT');
    expect(statusResponse.body).toHaveProperty('trustChainDepth', 1);
  });

  it('should reject subsequent bootstrap attempts', async () => {
    const anotherCert = {
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...another...XYZ
-----END CERTIFICATE-----`,
      callsign: 'KB2NEW',
      description: 'Another certificate',
      emergencyUse: true
    };
    
    const response = await request(serverUrl)
      .post('/api/certificates/bootstrap')
      .send(anotherCert)
      .expect(403);
    
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('already bootstrapped');
    expect(response.body).toHaveProperty('suggestion');
    expect(response.body.suggestion).toContain('certificate request');
  });

  it('should allow new certificates through request process after bootstrap', async () => {
    // Now that bootstrap is done, new certificates must go through request process
    const newCertRequest = {
      callsign: 'KB2NEW',
      certificatePem: `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHIG...new...XYZ
-----END CERTIFICATE-----`,
      requestType: 'add',
      captchaSolution: 'test-solution' // In real scenario, this would be validated
    };
    
    const response = await request(serverUrl)
      .post('/api/certificates/request')
      .send(newCertRequest)
      .expect(202); // Accepted for review
    
    expect(response.body).toHaveProperty('requestId');
    expect(response.body).toHaveProperty('status', 'pending_review');
  });

  it('should persist bootstrap configuration', async () => {
    // Restart server to test persistence
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start new server instance
    serverProcess = spawn('node', [path.join(process.cwd(), 'server.js')], {
      env: { ...process.env, PORT: serverPort },
      cwd: process.cwd()
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check that bootstrap is still complete
    const response = await request(serverUrl)
      .get('/api/certificates/status')
      .expect(200);
    
    expect(response.body).toHaveProperty('bootstrapNeeded', false);
    expect(response.body.rootCertificate).toHaveProperty('callsign', 'KA1ROOT');
  });
});