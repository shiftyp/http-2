#!/usr/bin/env node

/**
 * Integrated WebSocket + HTTP API Server
 * Combines WebRTC signaling with content registry API
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { createApp } = require('./src/app');

const PORT = process.env.PORT || 8080;

async function startIntegratedServer() {
  // Create Express app with content registry
  const app = await createApp();

  // Add health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      contentRegistry: 'active'
    });
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Add WebSocket server for signaling
  const wss = new WebSocket.Server({ server });

  // WebSocket connection handling (existing signaling logic)
  wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle content registry sync messages
        if (message.type === 'content-sync') {
          const { contentRegistry } = app.locals;
          const beacons = await contentRegistry.searchContent({
            priority: 3 // Get priority content
          });

          ws.send(JSON.stringify({
            type: 'batch-update',
            beacons: beacons.map(b => b.toJSON())
          }));
        }
        // Handle other WebRTC signaling messages
        else {
          // Existing WebRTC signaling logic
          console.log('Signaling message:', message.type);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`Integrated server running on http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log(`HTTP API: http://localhost:${PORT}/api/content`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Start server
startIntegratedServer().catch(console.error);