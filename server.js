/**
 * Minimal static server - ONLY serves the PWA files
 * All functionality is in the client-side PWA
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import compression from 'compression';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip compression
app.use(compression());

// Security headers for PWA
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Required for Web Serial API
  res.setHeader('Permissions-Policy', 'serial=()');
  // Enable CORS for service worker
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y', // Cache static assets
  etag: true
}));

// Serve signing list (read-only)
app.get('/signing-list.json', (req, res) => {
  const signingListPath = path.join(__dirname, 'data', 'signing-list.json');
  
  if (fs.existsSync(signingListPath)) {
    res.sendFile(signingListPath);
  } else {
    res.status(404).json({ error: 'Signing list not found' });
  }
});

// Serve signing list signature for verification
app.get('/signing-list.json.sig', (req, res) => {
  const sigPath = path.join(__dirname, 'data', 'signing-list.json.sig');
  
  if (fs.existsSync(sigPath)) {
    res.sendFile(sigPath);
  } else {
    res.status(404).json({ error: 'Signature not found' });
  }
});

// Catch-all route - serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (process.env.NODE_ENV === 'production') {
  // In production, use HTTPS for Web Serial API
  const privateKey = fs.readFileSync('sslcert/server.key', 'utf8');
  const certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  
  https.createServer(credentials, app).listen(PORT, () => {
    console.log(`HTTPS Server running on port ${PORT}`);
    console.log('PWA available for offline use after first visit');
  });
} else {
  app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log('Note: Web Serial API requires HTTPS in production');
  });
}