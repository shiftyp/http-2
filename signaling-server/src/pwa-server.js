const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * PWA Server Module
 * Serves the Progressive Web App with proper caching and offline support
 */
class PWAServer {
  constructor(pwaAssetsPath = './pwa-assets') {
    this.pwaAssetsPath = path.resolve(pwaAssetsPath);
    this.router = express.Router();
    this.setupRoutes();
    this.validatePWAStructure();
  }

  /**
   * Validate that required PWA files exist
   */
  validatePWAStructure() {
    const requiredFiles = ['index.html', 'manifest.json'];
    const missingFiles = [];

    requiredFiles.forEach(file => {
      const filePath = path.join(this.pwaAssetsPath, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    });

    if (missingFiles.length > 0) {
      console.warn(`[PWA Server] Missing required files: ${missingFiles.join(', ')}`);
    }

    return missingFiles.length === 0;
  }

  /**
   * Setup Express routes for PWA serving
   */
  setupRoutes() {
    // Serve manifest.json with proper MIME type
    this.router.get('/manifest.json', (req, res) => {
      const manifestPath = path.join(this.pwaAssetsPath, 'manifest.json');
      
      if (!fs.existsSync(manifestPath)) {
        return res.status(503).json({ 
          error: 'PWA manifest not available' 
        });
      }

      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      const manifest = fs.readFileSync(manifestPath);
      const etag = this.generateETag(manifest);
      res.setHeader('ETag', etag);
      
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      res.send(manifest);
    });

    // Serve service worker
    this.router.get('/sw.js', (req, res) => {
      const swPath = path.join(this.pwaAssetsPath, 'sw.js');
      
      if (!fs.existsSync(swPath)) {
        return res.status(404).json({ 
          error: 'Service worker not found' 
        });
      }

      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(swPath);
    });

    // Handle static assets
    this.router.get('/static/*', (req, res) => {
      // Security check for directory traversal
      if (req.path.includes('..')) {
        return res.status(400).json({ error: 'invalid path' });
      }

      const relativePath = req.path.replace('/static/', '');
      const filePath = path.join(this.pwaAssetsPath, 'static', relativePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'not found' });
      }

      // Set appropriate headers based on file type
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.js') {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      }

      res.setHeader('Cache-Control', 'max-age=86400'); // 1 day
      const content = fs.readFileSync(filePath);
      const etag = this.generateETag(content);
      res.setHeader('ETag', etag);

      res.send(content);
    });

    // Serve assets directory
    this.router.use('/assets', express.static(
      path.join(this.pwaAssetsPath, 'assets'),
      {
        maxAge: '7d',
        etag: true
      }
    ));

    // PWA validation endpoint
    this.router.get('/api/pwa/validate', (req, res) => {
      const files = [];
      
      if (fs.existsSync(this.pwaAssetsPath)) {
        const items = fs.readdirSync(this.pwaAssetsPath);
        items.forEach(item => {
          const itemPath = path.join(this.pwaAssetsPath, item);
          const stat = fs.statSync(itemPath);
          if (stat.isFile()) {
            files.push(item);
          }
        });
      }

      const valid = files.includes('index.html') && 
                   files.includes('manifest.json');

      res.json({
        valid,
        files,
        checkedAt: new Date().toISOString(),
        checks: [
          { name: 'index.html', found: files.includes('index.html') },
          { name: 'manifest.json', found: files.includes('manifest.json') },
          { name: 'sw.js', found: files.includes('sw.js') }
        ]
      });
    });

    // PWA health check
    this.router.get('/api/pwa/health', (req, res) => {
      const checks = [];
      const requiredFiles = ['index.html', 'manifest.json'];
      
      requiredFiles.forEach(file => {
        const filePath = path.join(this.pwaAssetsPath, file);
        checks.push({
          file,
          exists: fs.existsSync(filePath),
          size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
        });
      });

      const healthy = checks.every(check => check.exists);

      res.json({
        healthy,
        checkedAt: new Date().toISOString(),
        checks
      });
    });

    // Serve index.html for all other routes (SPA support)
    this.router.get('*', (req, res) => {
      const indexPath = path.join(this.pwaAssetsPath, 'index.html');
      
      if (!fs.existsSync(indexPath)) {
        return res.status(503).json({ 
          error: 'PWA not available. Please ensure PWA files are present.' 
        });
      }

      // Set security headers
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " +
        "connect-src 'self' ws: wss:; " +
        "font-src 'self' data:;"
      );
      
      const content = fs.readFileSync(indexPath);
      const etag = this.generateETag(content);
      res.setHeader('ETag', etag);
      
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      res.send(content);
    });
  }

  /**
   * Generate ETag for content
   */
  generateETag(content) {
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex');
  }

  /**
   * Get Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = PWAServer;