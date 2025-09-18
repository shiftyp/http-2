import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('PWA Serving API - GET / (PWA index)', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8084;

  beforeAll(async () => {
    // Create a test PWA index file
    const pwaAssetsDir = path.join(process.cwd(), 'pwa-assets');
    if (!fs.existsSync(pwaAssetsDir)) {
      fs.mkdirSync(pwaAssetsDir, { recursive: true });
    }
    
    // Create test index.html
    fs.writeFileSync(
      path.join(pwaAssetsDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>Ham Radio PWA</title></head><body><div id="root"></div></body></html>'
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

  it('should serve PWA index.html at root path', async () => {
    const response = await request(serverUrl)
      .get('/')
      .expect('Content-Type', /text\/html/)
      .expect(200);

    expect(response.text).toContain('<!DOCTYPE html>');
    expect(response.text).toContain('<div id="root">');
    expect(response.text).toContain('Ham Radio PWA');
  });

  it('should serve with correct cache headers', async () => {
    const response = await request(serverUrl)
      .get('/')
      .expect(200);

    expect(response.headers).toHaveProperty('cache-control');
    expect(response.headers['cache-control']).toContain('no-cache');
  });

  it('should support ETag for caching', async () => {
    const response1 = await request(serverUrl)
      .get('/')
      .expect(200);

    expect(response1.headers).toHaveProperty('etag');
    const etag = response1.headers.etag;

    // Request with If-None-Match
    const response2 = await request(serverUrl)
      .get('/')
      .set('If-None-Match', etag)
      .expect(304); // Not Modified
  });

  it('should serve index.html for SPA routes', async () => {
    const routes = ['/dashboard', '/station-setup', '/content/create', '/mesh/view'];
    
    for (const route of routes) {
      const response = await request(serverUrl)
        .get(route)
        .expect('Content-Type', /text\/html/)
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<div id="root">');
    }
  });

  it('should handle missing PWA files gracefully', async () => {
    // Temporarily rename index.html
    const indexPath = path.join(process.cwd(), 'pwa-assets', 'index.html');
    const backupPath = indexPath + '.backup';
    
    if (fs.existsSync(indexPath)) {
      fs.renameSync(indexPath, backupPath);
    }

    const response = await request(serverUrl)
      .get('/')
      .expect(503); // Service Unavailable

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('PWA');

    // Restore file
    if (fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, indexPath);
    }
  });

  it('should include CSP headers for security', async () => {
    const response = await request(serverUrl)
      .get('/')
      .expect(200);

    expect(response.headers).toHaveProperty('content-security-policy');
    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
  });
});