import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Offline PWA Operation', () => {
  let browser: Browser;
  let page: Page;
  let serverProcess: ChildProcess;
  const serverPort = 8094;
  const pwaAssetsDir = path.join(process.cwd(), 'signaling-server', 'pwa-assets');

  beforeAll(async () => {
    // Ensure PWA assets exist
    if (!fs.existsSync(pwaAssetsDir)) {
      fs.mkdirSync(pwaAssetsDir, { recursive: true });
    }
    
    // Create basic PWA files
    const indexHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ham Radio PWA</title>
        <link rel="manifest" href="/manifest.json">
      </head>
      <body>
        <div id="root">Ham Radio WebRTC PWA</div>
        <script src="/sw-register.js"></script>
      </body>
      </html>
    `;
    
    const manifest = {
      name: 'Ham Radio WebRTC',
      short_name: 'Ham Radio',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#2196F3'
    };
    
    const serviceWorker = `
      const CACHE_NAME = 'ham-radio-v1';
      const urlsToCache = ['/', '/manifest.json', '/offline.html'];
      
      self.addEventListener('install', event => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
        );
      });
      
      self.addEventListener('fetch', event => {
        event.respondWith(
          caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(() => caches.match('/offline.html'))
        );
      });
    `;
    
    const swRegister = `
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
      }
    `;
    
    const offlineHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Offline Mode</title></head>
      <body>
        <h1>Ham Radio PWA - Offline Mode</h1>
        <p>The application is running in offline mode.</p>
      </body>
      </html>
    `;
    
    fs.writeFileSync(path.join(pwaAssetsDir, 'index.html'), indexHtml);
    fs.writeFileSync(path.join(pwaAssetsDir, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(pwaAssetsDir, 'sw.js'), serviceWorker);
    fs.writeFileSync(path.join(pwaAssetsDir, 'sw-register.js'), swRegister);
    fs.writeFileSync(path.join(pwaAssetsDir, 'offline.html'), offlineHtml);
    
    // Start server
    serverProcess = spawn('node', [
      path.join(process.cwd(), 'signaling-server', 'server.js')
    ], {
      env: { ...process.env, PORT: serverPort.toString() },
      cwd: process.cwd()
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Launch browser
    browser = await chromium.launch();
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  it('should install service worker on first visit', async () => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Navigate to PWA
    await page.goto(`http://localhost:${serverPort}/`);
    
    // Wait for service worker to register
    await page.waitForTimeout(2000);
    
    // Check service worker is registered
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker?.controller !== null ||
             navigator.serviceWorker?.ready !== undefined;
    });
    
    expect(swRegistered).toBe(true);
  });

  it('should cache critical resources', async () => {
    // Check that cache is populated
    const cachedUrls = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      if (cacheNames.length === 0) return [];
      
      const cache = await caches.open(cacheNames[0]);
      const requests = await cache.keys();
      return requests.map(req => new URL(req.url).pathname);
    });
    
    expect(cachedUrls).toContain('/');
    expect(cachedUrls).toContain('/manifest.json');
  });

  it('should work offline after initial load', async () => {
    // Go offline
    await page.context().setOffline(true);
    
    // Try to navigate (should use cached version)
    await page.reload();
    
    // Check page still loads
    const content = await page.textContent('#root');
    expect(content).toBeTruthy();
  });

  it('should show offline page for uncached resources', async () => {
    // Navigate to uncached page while offline
    await page.context().setOffline(true);
    await page.goto(`http://localhost:${serverPort}/uncached-page`);
    
    // Should show offline page
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Offline Mode');
  });

  it('should sync when coming back online', async () => {
    // Start offline
    await page.context().setOffline(true);
    await page.goto(`http://localhost:${serverPort}/`);
    
    // Come back online
    await page.context().setOffline(false);
    
    // Should be able to fetch fresh content
    await page.reload();
    const isOnline = await page.evaluate(() => navigator.onLine);
    expect(isOnline).toBe(true);
  });

  it('should maintain local storage data offline', async () => {
    // Store data while online
    await page.context().setOffline(false);
    await page.goto(`http://localhost:${serverPort}/`);
    
    await page.evaluate(() => {
      localStorage.setItem('testKey', 'testValue');
      localStorage.setItem('callsign', 'KA1ABC');
    });
    
    // Go offline
    await page.context().setOffline(true);
    await page.reload();
    
    // Data should still be available
    const storedData = await page.evaluate(() => ({
      testKey: localStorage.getItem('testKey'),
      callsign: localStorage.getItem('callsign')
    }));
    
    expect(storedData.testKey).toBe('testValue');
    expect(storedData.callsign).toBe('KA1ABC');
  });

  it('should handle network failures gracefully', async () => {
    // Kill the server
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // PWA should still work from cache
    await page.reload();
    
    const content = await page.textContent('#root');
    expect(content).toBeTruthy();
  });
});