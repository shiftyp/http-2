import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Serve static files from the dist directory (production build)
app.use(express.static(path.join(__dirname, '../dist')));

// Serve static files from the public directory (development)
app.use(express.static(path.join(__dirname, '../public')));

// Serve the signing list (read-only)
app.get('/signing-list.json', (req, res) => {
  const signingListPath = path.join(__dirname, 'data', 'signing-list.json');
  
  // Check if signing list exists
  if (!fs.existsSync(signingListPath)) {
    // Return empty list if not found
    return res.json({
      version: '1.0.0',
      publishDate: new Date().toISOString(),
      entries: [],
      checksum: '',
      entryCount: 0
    });
  }
  
  // Set cache headers for signing list
  res.set({
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    'Content-Type': 'application/json'
  });
  
  res.sendFile(signingListPath);
});

// Serve the signing list signature (for verification)
app.get('/signing-list.json.sig', (req, res) => {
  const sigPath = path.join(__dirname, 'data', 'signing-list.json.sig');
  
  if (!fs.existsSync(sigPath)) {
    return res.status(404).send('Signature not found');
  }
  
  res.set({
    'Cache-Control': 'public, max-age=3600',
    'Content-Type': 'text/plain'
  });
  
  res.sendFile(sigPath);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Catch all - serve the PWA for any other route
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback to public/index.html during development
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// Start the server
if (USE_HTTPS) {
  // Generate self-signed certificate for development
  // In production, use proper certificates
  const privateKey = fs.readFileSync(path.join(__dirname, 'data', 'key.pem'), 'utf8');
  const certificate = fs.readFileSync(path.join(__dirname, 'data', 'cert.pem'), 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(PORT, () => {
    console.log(`HTTPS Server running on https://localhost:${PORT}`);
    console.log('Note: Web Serial API requires HTTPS or localhost');
  });
} else {
  app.listen(PORT, () => {
    console.log(`HTTP Server running on http://localhost:${PORT}`);
    console.log('Note: Web Serial API requires HTTPS or localhost');
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});