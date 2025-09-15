#!/usr/bin/env node

/**
 * Native WebSocket Signaling Server for Ham Radio WebRTC
 *
 * Lightweight signaling server using native WebSocket (no Socket.io)
 * Supports callsign-based room management and SDP relay
 */

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Ham radio station connected to signaling server
 */
class Station {
  constructor(ws, callsign) {
    this.ws = ws;
    this.callsign = callsign;
    this.id = crypto.randomUUID();
    this.capabilities = [];
    this.lastHeartbeat = Date.now();
    this.connectedAt = new Date();
  }

  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  updateHeartbeat() {
    this.lastHeartbeat = Date.now();
  }

  isAlive() {
    return Date.now() - this.lastHeartbeat < HEARTBEAT_INTERVAL * 2;
  }
}

/**
 * Ham radio network room for related stations
 */
class Network {
  constructor(name) {
    this.name = name;
    this.stations = new Map(); // callsign -> Station
    this.createdAt = new Date();
  }

  addStation(station) {
    this.stations.set(station.callsign, station);
    console.log(`Station ${station.callsign} joined network ${this.name}`);
  }

  removeStation(callsign) {
    const removed = this.stations.delete(callsign);
    if (removed) {
      console.log(`Station ${callsign} left network ${this.name}`);
    }
    return removed;
  }

  getStationList() {
    return Array.from(this.stations.values()).map(station => ({
      callsign: station.callsign,
      capabilities: station.capabilities,
      connectedAt: station.connectedAt
    }));
  }

  broadcast(message, excludeCallsign = null) {
    let sent = 0;
    for (const station of this.stations.values()) {
      if (station.callsign !== excludeCallsign && station.send(message)) {
        sent++;
      }
    }
    return sent;
  }

  getStation(callsign) {
    return this.stations.get(callsign);
  }
}

/**
 * Main signaling server
 */
class SignalingServer {
  constructor() {
    this.stations = new Map(); // websocket -> Station
    this.networks = new Map(); // network name -> Network
    this.callsignToStation = new Map(); // callsign -> Station
  }

  start() {
    // Create HTTP server for health checks
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          networks: this.networks.size,
          stations: this.stations.size,
          uptime: process.uptime()
        }));
      } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getStats()));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Create WebSocket server
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
      console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Failed to parse message:', error);
          this.sendError(ws, 'Invalid JSON message');
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });

      // Send welcome message
      this.send(ws, {
        type: 'welcome',
        server: 'Ham Radio WebRTC Signaling',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // Start heartbeat monitoring
    setInterval(() => this.cleanupStaleConnections(), HEARTBEAT_INTERVAL);

    // Start server
    server.listen(PORT, () => {
      console.log(`Ham Radio WebRTC Signaling Server listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Statistics: http://localhost:${PORT}/stats`);
    });
  }

  handleMessage(ws, message) {
    const { type } = message;

    switch (type) {
      case 'register':
        this.handleRegister(ws, message);
        break;

      case 'join-network':
        this.handleJoinNetwork(ws, message);
        break;

      case 'offer':
        this.handleOffer(ws, message);
        break;

      case 'answer':
        this.handleAnswer(ws, message);
        break;

      case 'ice-candidate':
        this.handleIceCandidate(ws, message);
        break;

      case 'request-peers':
        this.handleRequestPeers(ws, message);
        break;

      case 'heartbeat':
        this.handleHeartbeat(ws, message);
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  handleRegister(ws, message) {
    const { callsign, capabilities = [] } = message;

    if (!callsign || !this.isValidCallsign(callsign)) {
      this.sendError(ws, 'Invalid or missing callsign');
      return;
    }

    // Check if callsign already registered
    if (this.callsignToStation.has(callsign)) {
      this.sendError(ws, `Callsign ${callsign} already registered`);
      return;
    }

    // Create station
    const station = new Station(ws, callsign);
    station.capabilities = capabilities;

    this.stations.set(ws, station);
    this.callsignToStation.set(callsign, station);

    console.log(`Registered station ${callsign} with capabilities:`, capabilities);

    this.send(ws, {
      type: 'registered',
      callsign: callsign,
      stationId: station.id,
      timestamp: new Date().toISOString()
    });
  }

  handleJoinNetwork(ws, message) {
    const station = this.stations.get(ws);
    if (!station) {
      this.sendError(ws, 'Must register before joining network');
      return;
    }

    const { networkName = 'default' } = message;

    // Get or create network
    if (!this.networks.has(networkName)) {
      this.networks.set(networkName, new Network(networkName));
    }

    const network = this.networks.get(networkName);
    network.addStation(station);

    this.send(ws, {
      type: 'network-joined',
      networkName: networkName,
      peers: network.getStationList().filter(s => s.callsign !== station.callsign)
    });

    // Notify other stations in network
    network.broadcast({
      type: 'peer-joined',
      callsign: station.callsign,
      capabilities: station.capabilities
    }, station.callsign);
  }

  handleOffer(ws, message) {
    const { targetCallsign, offer } = message;
    const fromStation = this.stations.get(ws);

    if (!fromStation) {
      this.sendError(ws, 'Must register before sending offers');
      return;
    }

    const targetStation = this.callsignToStation.get(targetCallsign);
    if (!targetStation) {
      this.sendError(ws, `Target station ${targetCallsign} not found`);
      return;
    }

    console.log(`Relaying offer from ${fromStation.callsign} to ${targetCallsign}`);

    targetStation.send({
      type: 'offer',
      fromCallsign: fromStation.callsign,
      offer: offer,
      timestamp: new Date().toISOString()
    });
  }

  handleAnswer(ws, message) {
    const { targetCallsign, answer } = message;
    const fromStation = this.stations.get(ws);

    if (!fromStation) {
      this.sendError(ws, 'Must register before sending answers');
      return;
    }

    const targetStation = this.callsignToStation.get(targetCallsign);
    if (!targetStation) {
      this.sendError(ws, `Target station ${targetCallsign} not found`);
      return;
    }

    console.log(`Relaying answer from ${fromStation.callsign} to ${targetCallsign}`);

    targetStation.send({
      type: 'answer',
      fromCallsign: fromStation.callsign,
      answer: answer,
      timestamp: new Date().toISOString()
    });
  }

  handleIceCandidate(ws, message) {
    const { targetCallsign, candidate } = message;
    const fromStation = this.stations.get(ws);

    if (!fromStation) {
      this.sendError(ws, 'Must register before sending ICE candidates');
      return;
    }

    const targetStation = this.callsignToStation.get(targetCallsign);
    if (!targetStation) {
      // Silently ignore ICE candidates for non-existent targets
      // This is normal during connection cleanup
      return;
    }

    targetStation.send({
      type: 'ice-candidate',
      fromCallsign: fromStation.callsign,
      candidate: candidate,
      timestamp: new Date().toISOString()
    });
  }

  handleRequestPeers(ws, message) {
    const station = this.stations.get(ws);
    if (!station) {
      this.sendError(ws, 'Must register before requesting peers');
      return;
    }

    const { networkName = 'default' } = message;
    const network = this.networks.get(networkName);

    if (!network) {
      this.send(ws, {
        type: 'peer-list',
        peers: []
      });
      return;
    }

    const peers = network.getStationList().filter(s => s.callsign !== station.callsign);

    this.send(ws, {
      type: 'peer-list',
      peers: peers
    });
  }

  handleHeartbeat(ws, message) {
    const station = this.stations.get(ws);
    if (station) {
      station.updateHeartbeat();
      this.send(ws, {
        type: 'heartbeat-ack',
        timestamp: new Date().toISOString()
      });
    }
  }

  handleDisconnection(ws) {
    const station = this.stations.get(ws);
    if (station) {
      console.log(`Station ${station.callsign} disconnected`);

      // Remove from networks
      for (const network of this.networks.values()) {
        if (network.removeStation(station.callsign)) {
          // Notify other stations in network
          network.broadcast({
            type: 'peer-left',
            callsign: station.callsign
          });
        }
      }

      // Clean up references
      this.stations.delete(ws);
      this.callsignToStation.delete(station.callsign);
    }
  }

  cleanupStaleConnections() {
    const staleConnections = [];

    for (const [ws, station] of this.stations) {
      if (!station.isAlive()) {
        staleConnections.push(ws);
      }
    }

    for (const ws of staleConnections) {
      console.log(`Cleaning up stale connection for ${this.stations.get(ws)?.callsign}`);
      ws.terminate();
      this.handleDisconnection(ws);
    }

    // Clean up empty networks
    for (const [name, network] of this.networks) {
      if (network.stations.size === 0) {
        this.networks.delete(name);
        console.log(`Removed empty network: ${name}`);
      }
    }
  }

  send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  sendError(ws, error) {
    this.send(ws, {
      type: 'error',
      message: error,
      timestamp: new Date().toISOString()
    });
  }

  isValidCallsign(callsign) {
    // Basic ham radio callsign validation
    // Supports most international formats
    const callsignRegex = /^[A-Z0-9]{2,}[0-9][A-Z]{1,4}$/;
    return callsignRegex.test(callsign.toUpperCase());
  }

  getStats() {
    const stats = {
      networks: this.networks.size,
      totalStations: this.stations.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      networkDetails: {}
    };

    for (const [name, network] of this.networks) {
      stats.networkDetails[name] = {
        stations: network.stations.size,
        stationList: network.getStationList().map(s => s.callsign),
        createdAt: network.createdAt
      };
    }

    return stats;
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new SignalingServer();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nGracefully shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nGracefully shutting down...');
    process.exit(0);
  });

  server.start();
}

module.exports = { SignalingServer, Station, Network };