import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('PWA Serving API - GET /manifest.json', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8086;

  beforeAll(async () => {
    // Create test manifest.json
    const pwaAssetsDir = path.join(process.cwd(), 'pwa-assets');
    if (!fs.existsSync(pwaAssetsDir)) {
      fs.mkdirSync(pwaAssetsDir, { recursive: true });
    }
    
    const manifest = {
      name: 'Ham Radio WebRTC',
      short_name: 'Ham Radio',
      description: 'HTTP over amateur radio with WebRTC',
      start_url: '/',
      display: 'standalone',
      theme_color: '#2196F3',
      background_color: '#ffffff',
      icons: [
        {
          src: '/assets/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/assets/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    };
    
    fs.writeFileSync(
      path.join(pwaAssetsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
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

  it('should serve manifest.json with correct MIME type', async () => {
    const response = await request(serverUrl)
      .get('/manifest.json')
      .expect('Content-Type', /application\/manifest\+json|application\/json/)
      .expect(200);

    expect(response.body).toHaveProperty('name', 'Ham Radio WebRTC');
    expect(response.body).toHaveProperty('short_name', 'Ham Radio');
  });

  it('should include all required PWA manifest fields', async () => {
    const response = await request(serverUrl)
      .get('/manifest.json')
      .expect(200);

    // Required fields
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('short_name');
    expect(response.body).toHaveProperty('start_url');
    expect(response.body).toHaveProperty('display');
    expect(response.body).toHaveProperty('icons');
    
    // Icons should be an array
    expect(response.body.icons).toBeInstanceOf(Array);
    expect(response.body.icons.length).toBeGreaterThan(0);
  });

  it('should include theme and background colors', async () => {
    const response = await request(serverUrl)
      .get('/manifest.json')
      .expect(200);

    expect(response.body).toHaveProperty('theme_color');
    expect(response.body).toHaveProperty('background_color');
    expect(response.body.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(response.body.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should include proper icon definitions', async () => {
    const response = await request(serverUrl)
      .get('/manifest.json')
      .expect(200);

    response.body.icons.forEach(icon => {
      expect(icon).toHaveProperty('src');
      expect(icon).toHaveProperty('sizes');
      expect(icon).toHaveProperty('type');
      expect(icon.type).toBe('image/png');
      expect(icon.sizes).toMatch(/\d+x\d+/);
    });
  });

  it('should use appropriate cache headers', async () => {
    const response = await request(serverUrl)
      .get('/manifest.json')
      .expect(200);

    expect(response.headers).toHaveProperty('cache-control');
    // Manifest should have moderate caching
    expect(response.headers['cache-control']).toMatch(/max-age=\d+/);
  });

  it('should support cross-origin requests', async () => {
    const response = await request(serverUrl)
      .get('/manifest.json')
      .set('Origin', 'http://example.com')
      .expect(200);

    // Should have CORS headers for PWA compatibility
    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });
});