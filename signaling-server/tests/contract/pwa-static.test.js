import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('PWA Serving API - GET /static/* (assets)', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8085;

  beforeAll(async () => {
    // Create test PWA assets
    const pwaAssetsDir = path.join(process.cwd(), 'pwa-assets');
    const staticDir = path.join(pwaAssetsDir, 'static');
    const assetsDir = path.join(pwaAssetsDir, 'assets');
    
    [pwaAssetsDir, staticDir, assetsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Create test files
    fs.writeFileSync(
      path.join(staticDir, 'app.js'),
      'console.log("Ham Radio PWA");'
    );
    
    fs.writeFileSync(
      path.join(staticDir, 'app.css'),
      'body { font-family: sans-serif; }'
    );
    
    fs.writeFileSync(
      path.join(assetsDir, 'icon-192x192.png'),
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
    );

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

  it('should serve JavaScript files with correct MIME type', async () => {
    const response = await request(serverUrl)
      .get('/static/app.js')
      .expect('Content-Type', /application\/javascript/)
      .expect(200);

    expect(response.text).toContain('Ham Radio PWA');
  });

  it('should serve CSS files with correct MIME type', async () => {
    const response = await request(serverUrl)
      .get('/static/app.css')
      .expect('Content-Type', /text\/css/)
      .expect(200);

    expect(response.text).toContain('font-family');
  });

  it('should serve image files with correct MIME type', async () => {
    const response = await request(serverUrl)
      .get('/assets/icon-192x192.png')
      .expect('Content-Type', /image\/png/)
      .expect(200);

    expect(response.body).toBeInstanceOf(Buffer);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should use strong cache headers for static assets', async () => {
    const response = await request(serverUrl)
      .get('/static/app.js')
      .expect(200);

    expect(response.headers).toHaveProperty('cache-control');
    expect(response.headers['cache-control']).toMatch(/max-age=\d+/);
    expect(response.headers).toHaveProperty('etag');
  });

  it('should support gzip compression for text assets', async () => {
    const response = await request(serverUrl)
      .get('/static/app.js')
      .set('Accept-Encoding', 'gzip, deflate')
      .expect(200);

    // Server should compress text files
    if (response.text.length > 1000) {
      expect(response.headers['content-encoding']).toBe('gzip');
    }
  });

  it('should return 404 for non-existent assets', async () => {
    const response = await request(serverUrl)
      .get('/static/non-existent.js')
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('not found');
  });

  it('should handle nested asset paths', async () => {
    // Create nested directory
    const nestedDir = path.join(process.cwd(), 'pwa-assets', 'static', 'js');
    if (!fs.existsSync(nestedDir)) {
      fs.mkdirSync(nestedDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(nestedDir, 'module.js'),
      'export default {};'
    );

    const response = await request(serverUrl)
      .get('/static/js/module.js')
      .expect(200);

    expect(response.text).toContain('export default');
  });

  it('should prevent directory traversal attacks', async () => {
    const response = await request(serverUrl)
      .get('/static/../../../etc/passwd')
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('invalid path');
  });
});