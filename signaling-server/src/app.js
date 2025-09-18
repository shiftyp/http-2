/**
 * Express app with content registry API endpoints
 */

const express = require('express');
const Database = require('./db/init');
const ContentRegistry = require('./services/ContentRegistry');
const contentEndpoints = require('./api/content-endpoints');
const PWAServer = require('./pwa-server');
const CertificateBootstrap = require('./certificate-bootstrap');
const { setupPackageRoutes } = require('./download-server');

async function createApp(dbPath = ':memory:') {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize database
  const db = new Database(dbPath);
  await db.initialize();

  // Initialize services
  const contentRegistry = new ContentRegistry(db);
  const certificateBootstrap = new CertificateBootstrap();
  const pwaServer = new PWAServer();

  // Store services in app for endpoint access
  app.locals.db = db;
  app.locals.contentRegistry = contentRegistry;
  app.locals.certificateBootstrap = certificateBootstrap;

  // Mount API routes
  app.use('/api/content', contentEndpoints);

  // Mount package routes
  setupPackageRoutes(app);

  // Certificate bootstrap routes
  app.get('/api/certificates/status', (req, res) => {
    try {
      const status = certificateBootstrap.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/certificates/bootstrap', express.json(), (req, res) => {
    try {
      const result = certificateBootstrap.bootstrap(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (error.message.includes('already')) {
        res.status(403).json({
          error: error.message,
          suggestion: 'Use certificate request process for additional certificates.'
        });
      } else if (error.message.includes('Invalid') || error.message.includes('required')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post('/api/certificates/initialize', express.json(), (req, res) => {
    try {
      const result = certificateBootstrap.initialize(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (error.message.includes('already initialized')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('depth') || error.message.includes('Invalid')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post('/api/certificates/request', express.json(), (req, res) => {
    try {
      const result = certificateBootstrap.handleRequest(req.body);
      res.status(202).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Mount PWA server routes - MUST BE LAST for catch-all route
  app.use(pwaServer.getRouter());

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  });

  // Periodic cleanup tasks
  setInterval(async () => {
    try {
      await contentRegistry.expireContent();
      await contentRegistry.evictLowPriority();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 60000); // Every minute

  return app;
}

module.exports = { createApp };