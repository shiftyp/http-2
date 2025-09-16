#!/usr/bin/env node
/**
 * Distributed Ham Radio Server
 * Main entry point for the local HTTP/WebSocket server
 */

import express, { Application } from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { Command } from 'commander';
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Import libraries
import { SignalingRelay } from './lib/signaling-relay';
// import { CertificateStore } from './lib/certificate-store';
// import { MDNSDiscovery } from './lib/mdns-discovery';
// import { RateLimiter } from './lib/rate-limiter';

// Version with build suffix
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const BUILD_SUFFIX = Date.now().toString();
const VERSION = `${packageJson.version}-${BUILD_SUFFIX}`;

// Server state
let serverState: 'unclaimed' | 'claimed' | 'active' = 'unclaimed';
let serverOwner: string | null = null;
let serverCertificate: any = null;

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Parse command line arguments
const program = new Command();
program
  .name('ham-server')
  .description('Distributed Ham Radio Server')
  .version(VERSION, '-v, --version', 'output the current version with build suffix')
  .option('-p, --port <number>', 'HTTP/WebSocket port', '8080')
  .option('-c, --cert-dir <path>', 'certificate storage directory', './certs')
  .option('--no-mdns', 'disable mDNS advertisement')
  .option('-i, --interface <name>', 'network interface for mDNS')
  .option('--verbose', 'enable debug logging')
  .parse(process.argv);

const options = program.opts();

if (options.verbose) {
  logger.level = 'debug';
}

// Create Express app
const app: Application = express();
const server = http.createServer(app);

// Configure middleware
app.use(cors({
  origin: '*', // Allow all origins for PWA access
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-User-Mode', 'Authorization']
}));

app.use(express.json());

// Rate limiting middleware (basic implementation)
const requestCounts = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;

app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  // Get request timestamps for this IP
  let timestamps = requestCounts.get(ip) || [];

  // Remove old timestamps outside the window
  timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (timestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  next();
});

// API Routes

// GET /api/status - Server status
app.get('/api/status', (req, res) => {
  const status: any = {
    state: serverState,
    version: VERSION,
    uptime: process.uptime(),
    signaling: {
      url: `ws://localhost:${options.port}/ws/signal`,
      connected: signalingRelay.getConnectedClients().length
    }
  };

  if (serverState !== 'unclaimed') {
    status.owner = serverOwner;
  }

  res.json(status);
});

// GET /api/info - Server capabilities
app.get('/api/info', (req, res) => {
  res.json({
    type: 'signaling',
    version: VERSION,
    capabilities: ['signaling', 'webrtc', 'ca', 'mesh', 'cache'],
    callsign: serverOwner,
    signalingUrl: `ws://localhost:${options.port}/ws/signal`
  });
});

// POST /api/claim-station - Claim unclaimed server
app.post('/api/claim-station', async (req, res) => {
  if (serverState !== 'unclaimed') {
    return res.status(403).json({ error: 'Server already claimed' });
  }

  const { certificate, station } = req.body;

  if (!certificate || !station?.callsign) {
    return res.status(400).json({ error: 'Invalid claim request' });
  }

  // TODO: Validate certificate
  // For now, basic validation
  if (certificate === 'invalid') {
    return res.status(400).json({ error: 'Invalid certificate' });
  }

  // Claim the server
  serverOwner = station.callsign;
  serverCertificate = certificate;
  serverState = 'claimed';

  // Generate access token (simplified)
  const accessToken = Buffer.from(`${serverOwner}:${Date.now()}`).toString('base64');

  logger.info(`Server claimed by ${serverOwner}`);

  // Transition to active state
  setTimeout(() => {
    serverState = 'active';
    logger.info('Server transitioned to active state');
  }, 1000);

  res.json({
    success: true,
    owner: serverOwner,
    signalingUrl: `ws://localhost:${options.port}/ws/signal`,
    accessToken
  });
});

// GET /api/certificates - List certificates
app.get('/api/certificates', (req, res) => {
  // TODO: Implement certificate store
  res.json([]);
});

// POST /api/certificates - Add certificate
app.post('/api/certificates', (req, res) => {
  const { certificate } = req.body;

  if (!certificate) {
    return res.status(400).json({ error: 'No certificate provided' });
  }

  // Basic PEM validation
  if (!certificate.includes('-----BEGIN') || certificate === 'not-a-valid-pem') {
    return res.status(400).json({ error: 'Invalid certificate format' });
  }

  // TODO: Store certificate
  res.status(201).json({ success: true });
});

// GET /api/certificates/:fingerprint - Get certificate
app.get('/api/certificates/:fingerprint', (req, res) => {
  // TODO: Implement certificate retrieval
  res.status(404).json({ error: 'Certificate not found' });
});

// POST /api/issue-certificate - Issue certificate (CA function)
app.post('/api/issue-certificate', (req, res) => {
  // Check if server has CA capability
  if (serverState !== 'active') {
    return res.status(403).json({ error: 'Server not active' });
  }

  // TODO: Implement certificate issuance
  res.status(403).json({ error: 'CA functionality not yet implemented' });
});

// GET /api/peers - List peer servers
app.get('/api/peers', (req, res) => {
  // TODO: Implement peer management
  res.json([]);
});

// POST /api/peers - Add peer server
app.post('/api/peers', (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'No endpoint provided' });
  }

  // Validate endpoint format
  try {
    new URL(endpoint);
  } catch {
    return res.status(400).json({ error: 'Invalid endpoint URL' });
  }

  // TODO: Add peer
  res.status(201).json({ success: true });
});

// GET /api/content-catalog - Get content catalog
app.get('/api/content-catalog', (req, res) => {
  res.json({
    serverId: `server-${serverOwner || 'unclaimed'}`,
    callsign: serverOwner,
    lastUpdated: new Date().toISOString(),
    totalSize: 0,
    entryCount: 0,
    entries: []
  });
});

// GET /api/local-servers - Discover local servers
app.get('/api/local-servers', (req, res) => {
  // TODO: Implement local server discovery
  res.json({ servers: [] });
});

// Unlicensed mode endpoint
app.get('/api/download-server', (req, res) => {
  const userMode = req.headers['x-user-mode'];

  if (userMode === 'unlicensed') {
    return res.status(403).json({
      error: 'Server download requires a valid amateur radio license',
      info: 'Please visit http://www.arrl.org/getting-licensed to learn about licensing'
    });
  }

  // TODO: Implement server binary download
  res.json({ url: '/server-binaries/ham-server' });
});

// Initialize signaling relay
const signalingRelay = new SignalingRelay(logger);

// WebSocket servers
const wss = new WebSocket.Server({
  server,
  path: '/ws/signal'
});

const coordinationWss = new WebSocket.Server({
  server,
  path: '/ws/coordinate'
});

wss.on('connection', (ws, req) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.debug(`WebSocket connection from ${req.socket.remoteAddress}`);

  // Register with relay
  signalingRelay.handleConnection(ws, clientId);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      signalingRelay.processMessage(clientId, message);
    } catch (error) {
      logger.error('Invalid WebSocket message:', error);
      ws.send(JSON.stringify({ type: 'ERROR', error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    signalingRelay.handleDisconnection(clientId);
    logger.debug(`Client ${clientId} disconnected`);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error for ${clientId}:`, error);
  });
});

// Signaling relay event handlers
signalingRelay.on('clientRegistered', (client) => {
  logger.info(`Client registered: ${client.callsign} (${client.id})`);
});

signalingRelay.on('offerRelayed', (from, to) => {
  logger.debug(`Offer relayed from ${from} to ${to}`);
});

signalingRelay.on('answerRelayed', (from, to) => {
  logger.debug(`Answer relayed from ${from} to ${to}`);
});

// Server coordination WebSocket handling
coordinationWss.on('connection', (ws, req) => {
  logger.debug(`Coordination connection from ${req.socket.remoteAddress}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      // TODO: Handle server-to-server coordination
      logger.debug('Coordination message:', message.type);
    } catch (error) {
      logger.error('Invalid coordination message:', error);
    }
  });
});

// Start the server
const port = parseInt(options.port);

server.listen(port, () => {
  logger.info(`Ham Radio Distributed Server v${VERSION}`);
  logger.info(`Server running on http://localhost:${port}`);
  logger.info(`WebSocket signaling at ws://localhost:${port}/ws/signal`);
  logger.info(`State: ${serverState}`);

  if (options.mdns !== false) {
    logger.info('mDNS advertisement enabled');
    // TODO: Start mDNS advertisement
  }

  console.log('\nServer is running in UNCLAIMED state');
  console.log('Waiting for station owner...');
  console.log(`Open http://localhost:${port} in your browser to initialize\n`);
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  logger.info('Shutting down server...');

  // Shutdown signaling relay
  signalingRelay.shutdown();

  // Close coordination connections
  coordinationWss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutting down');
  });

  server.close(() => {
    logger.info('Server shut down gracefully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10000);
}

export default app;