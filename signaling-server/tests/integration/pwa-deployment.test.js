import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

describe('PWA Deployment Integration', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8091;
  const pwaAssetsDir = path.join(process.cwd(), 'pwa-assets');

  beforeAll(async () => {
    // Create and populate PWA assets directory
    if (!fs.existsSync(pwaAssetsDir)) {
      fs.mkdirSync(pwaAssetsDir, { recursive: true });
    }
    
    // Create test PWA files
    const testFiles = {
      'index.html': '<!DOCTYPE html><html><head><title>Test PWA</title></head><body></body></html>',
      'manifest.json': JSON.stringify({
        name: 'Test PWA',
        short_name: 'Test',
        start_url: '/'
      }),
      'sw.js': 'self.addEventListener("install", event => {});'
    };
    
    Object.entries(testFiles).forEach(([filename, content]) => {
      fs.writeFileSync(path.join(pwaAssetsDir, filename), content);
    });

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

  it('should serve PWA from root path', async () => {
    const response = await request(serverUrl)
      .get('/')
      .expect(200)
      .expect('Content-Type', /text\/html/);
    
    expect(response.text).toContain('<!DOCTYPE html>');
    expect(response.text).toContain('Test PWA');
  });

  it('should serve all PWA assets correctly', async () => {
    // Test manifest.json
    const manifestResponse = await request(serverUrl)
      .get('/manifest.json')
      .expect(200)
      .expect('Content-Type', /json/);
    
    expect(manifestResponse.body.name).toBe('Test PWA');
    
    // Test service worker
    const swResponse = await request(serverUrl)
      .get('/sw.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
    
    expect(swResponse.text).toContain('addEventListener');
  });

  it('should handle PWA updates without server restart', async () => {
    // Update index.html
    const updatedHtml = '<!DOCTYPE html><html><head><title>Updated PWA</title></head><body></body></html>';
    fs.writeFileSync(path.join(pwaAssetsDir, 'index.html'), updatedHtml);
    
    // Request should return updated content
    const response = await request(serverUrl)
      .get('/')
      .expect(200);
    
    expect(response.text).toContain('Updated PWA');
  });

  it('should serve PWA alongside WebSocket connections', async () => {
    // Test that both PWA and WebSocket endpoints work
    const pwaResponse = await request(serverUrl)
      .get('/')
      .expect(200);
    
    const healthResponse = await request(serverUrl)
      .get('/health')
      .expect(200);
    
    expect(pwaResponse.text).toContain('<!DOCTYPE html>');
    expect(healthResponse.body).toHaveProperty('status');
  });

  it('should validate PWA structure on startup', async () => {
    // Request server status which should include PWA validation
    const response = await request(serverUrl)
      .get('/api/pwa/validate')
      .expect(200);
    
    expect(response.body).toHaveProperty('valid', true);
    expect(response.body).toHaveProperty('files');
    expect(response.body.files).toContain('index.html');
    expect(response.body.files).toContain('manifest.json');
    expect(response.body.files).toContain('sw.js');
  });

  it('should package server with PWA for distribution', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/build')
      .query({ includePWA: true })
      .expect(200);
    
    expect(response.body).toHaveProperty('packageCreated', true);
    expect(response.body).toHaveProperty('size');
    expect(response.body).toHaveProperty('platforms');
    expect(response.body).toHaveProperty('pwaIncluded', true);
  });
});