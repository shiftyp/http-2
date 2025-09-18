import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Package API - GET /api/packages/info', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8081; // Use different port for testing

  beforeAll(async () => {
    // Start the server
    serverProcess = spawn('node', [path.join(process.cwd(), 'server.js')], {
      env: { ...process.env, PORT: serverPort },
      cwd: process.cwd()
    });
    
    serverUrl = `http://localhost:${serverPort}`;
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Kill the server process
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  it('should return package information with all platform binaries', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/info')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('name', 'ham-radio-signaling-server');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('platforms');
    expect(response.body.platforms).toBeInstanceOf(Array);
    expect(response.body.platforms).toContain('linux-x64');
    expect(response.body.platforms).toContain('linux-arm64');
    expect(response.body.platforms).toContain('macos-x64');
    expect(response.body.platforms).toContain('macos-arm64');
    expect(response.body.platforms).toContain('windows-x64');
  });

  it('should include package size information', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/info')
      .expect(200);

    expect(response.body).toHaveProperty('size');
    expect(response.body.size).toBeGreaterThan(0);
    expect(response.body).toHaveProperty('sizeFormatted');
    expect(response.body.sizeFormatted).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB)/);
  });

  it('should include PWA assets information', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/info')
      .expect(200);

    expect(response.body).toHaveProperty('includesPWA', true);
    expect(response.body).toHaveProperty('pwaVersion');
    expect(response.body).toHaveProperty('pwaFiles');
    expect(response.body.pwaFiles).toBeInstanceOf(Array);
    expect(response.body.pwaFiles).toContainEqual(
      expect.objectContaining({
        name: 'index.html',
        type: 'text/html'
      })
    );
  });

  it('should include emergency preparedness messaging', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/info')
      .expect(200);

    expect(response.body).toHaveProperty('emergencyMessage');
    expect(response.body.emergencyMessage).toContain('emergency');
    expect(response.body.emergencyMessage).toContain('licensed stations');
  });

  it('should include checksum for package verification', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/info')
      .expect(200);

    expect(response.body).toHaveProperty('checksum');
    expect(response.body.checksum).toHaveProperty('sha256');
    expect(response.body.checksum.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});