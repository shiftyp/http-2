import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import supertest from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

describe('Server Package API - GET /api/packages/download', () => {
  let serverProcess;
  let serverUrl;
  const serverPort = 8082;

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

  it('should download server package as zip file', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/download')
      .buffer(true) // Ensure response is buffered
      .parse(supertest.parse['application/octet-stream']) // Parse as binary
      .expect('Content-Type', 'application/zip')
      .expect('Content-Disposition', /attachment; filename="ham-radio-server.*\.zip"/)
      .expect(200);

    expect(response.body).toBeInstanceOf(Buffer);
    expect(response.body.length).toBeGreaterThan(1000); // At least 1KB
  });

  it('should support range requests for resumable downloads', async () => {
    // First get the full size
    const headResponse = await request(serverUrl)
      .head('/api/packages/download')
      .expect(200);

    const contentLength = parseInt(headResponse.headers['content-length']);
    expect(contentLength).toBeGreaterThan(0);

    // Request partial content
    const rangeResponse = await request(serverUrl)
      .get('/api/packages/download')
      .set('Range', 'bytes=0-1023')
      .expect(206); // Partial Content

    expect(rangeResponse.headers['content-range']).toMatch(/bytes 0-1023\/\d+/);
    expect(rangeResponse.body.length).toBe(1024);
  });

  it('should include correct checksum in headers', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/download')
      .buffer(true)
      .parse(supertest.parse['application/octet-stream'])
      .expect(200);

    expect(response.headers).toHaveProperty('x-checksum-sha256');
    const providedChecksum = response.headers['x-checksum-sha256'];

    // Verify checksum format
    expect(providedChecksum).toMatch(/^[a-f0-9]{64}$/);

    // Calculate actual checksum
    const hash = crypto.createHash('sha256');
    hash.update(response.body);
    const actualChecksum = hash.digest('hex');

    expect(providedChecksum).toBe(actualChecksum);
  });

  it('should support platform-specific downloads', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/download')
      .query({ platform: 'linux-x64' })
      .expect(200);

    expect(response.headers['content-disposition']).toMatch(/linux-x64/);
  });

  it('should return 404 for invalid platform', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/download')
      .query({ platform: 'invalid-platform' })
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('platform');
  });

  it('should track download statistics', async () => {
    // Download the package
    await request(serverUrl)
      .get('/api/packages/download')
      .expect(200);

    // Check statistics
    const statsResponse = await request(serverUrl)
      .get('/api/packages/stats')
      .expect(200);

    expect(statsResponse.body).toHaveProperty('downloads');
    expect(statsResponse.body.downloads).toBeGreaterThan(0);
  });

  it('should compress package efficiently', async () => {
    const response = await request(serverUrl)
      .get('/api/packages/download')
      .expect(200);

    // Check that compression is used
    expect(response.headers).toHaveProperty('content-encoding');
    const encoding = response.headers['content-encoding'];
    expect(['gzip', 'deflate', 'br']).toContain(encoding);
  });
});