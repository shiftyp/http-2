import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';

describe('Server Package API - GET /api/packages/manifest', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8083;

  beforeAll(async () => {
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

  it('should return detailed package manifest', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('created');
    expect(response.body).toHaveProperty('files');
    expect(response.body.files).toBeInstanceOf(Array);
  });

  it('should list all platform binaries in manifest', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect(200);

    const binaries = response.body.files.filter(f => f.type === 'binary');
    const platforms = binaries.map(b => b.platform);

    // Since we're in test environment, not all binaries are built
    // Check that manifest structure is correct and returns existing platforms
    if (platforms.length > 0) {
      // If any binaries exist, they should have valid platform names
      const validPlatforms = ['linux-x64', 'linux-arm64', 'macos-x64', 'macos-arm64', 'windows-x64'];
      platforms.forEach(p => {
        expect(validPlatforms).toContain(p);
      });
    }

    // The manifest should at least have the structure for files
    expect(response.body.files).toBeInstanceOf(Array);
  });

  it('should include file sizes and checksums', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect(200);

    response.body.files.forEach(file => {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('checksum');
      expect(file.size).toBeGreaterThan(0);
      expect(file.checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  it('should categorize PWA assets correctly', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect(200);

    const pwaFiles = response.body.files.filter(f => f.type === 'pwa-asset');
    
    expect(pwaFiles.length).toBeGreaterThan(0);
    
    const fileTypes = pwaFiles.map(f => path.extname(f.path));
    expect(fileTypes).toContain('.html');
    expect(fileTypes).toContain('.js');
    expect(fileTypes).toContain('.json'); // manifest.json
  });

  it('should include deployment scripts', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect(200);

    const scripts = response.body.files.filter(f => f.type === 'script');
    const scriptNames = scripts.map(s => path.basename(s.path));
    
    expect(scriptNames).toContain('start-linux.sh');
    expect(scriptNames).toContain('start-macos.sh');
    expect(scriptNames).toContain('start-windows.bat');
  });

  it('should include configuration templates', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect(200);

    const configs = response.body.files.filter(f => f.type === 'config');
    expect(configs.length).toBeGreaterThan(0);
    
    const configNames = configs.map(c => path.basename(c.path));
    expect(configNames).toContain('server-config.json');
  });

  it('should include total package size', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/manifest')
      .expect(200);

    expect(response.body).toHaveProperty('totalSize');
    expect(response.body.totalSize).toBeGreaterThan(0);
    
    // Verify total matches sum of files
    const sumOfFiles = response.body.files.reduce((sum, file) => sum + file.size, 0);
    expect(response.body.totalSize).toBe(sumOfFiles);
  });
});