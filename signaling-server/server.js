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
const express = require('express');
const { createApp } = require('./src/app');

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
    this.authenticated = false;
    this.certificateInfo = null;
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
    this.app = null;
  }

  async start() {
    // Create Express app with all features
    this.app = await createApp(process.env.DB_PATH || './data/signaling.db');

    // Add health and stats endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        networks: this.networks.size,
        stations: this.stations.size,
        uptime: process.uptime(),
        emergencyMode: process.argv.includes('--emergency')
      });
    });

    this.app.get('/stats', (req, res) => {
      res.json(this.getStats());
    });

    // Create HTTP server from Express app
    const server = http.createServer(this.app);

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

      case 'server-management':
        this.handleServerManagement(ws, message);
        break;

      case 'emergency-broadcast':
        this.handleEmergencyBroadcast(ws, message);
        break;

      case 'certificate-request':
        this.handleCertificateRequest(ws, message);
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  async handleRegister(ws, message) {
    const { callsign, capabilities = [], certificate, certificateChain } = message;

    if (!callsign || !this.isValidCallsign(callsign)) {
      this.sendError(ws, 'Invalid or missing callsign');
      return;
    }

    // Check if callsign already registered
    if (this.callsignToStation.has(callsign)) {
      this.sendError(ws, `Callsign ${callsign} already registered`);
      return;
    }

    // Certificate authentication (if provided)
    let authenticated = false;
    let certificateInfo = null;

    if (certificate) {
      try {
        certificateInfo = await this.validateCertificate(certificate, callsign, certificateChain);
        authenticated = certificateInfo.valid;

        if (!authenticated) {
          console.warn(`Certificate validation failed for ${callsign}:`, certificateInfo.errors);
          this.sendError(ws, `Certificate validation failed: ${certificateInfo.errors.join('; ')}`);
          return;
        }

        console.log(`Certificate authentication successful for ${callsign}`);
      } catch (error) {
        console.error('Certificate validation error:', error);
        this.sendError(ws, 'Certificate validation error');
        return;
      }
    }

    // Create station
    const station = new Station(ws, callsign);
    station.capabilities = capabilities;
    station.authenticated = authenticated;
    station.certificateInfo = certificateInfo;

    this.stations.set(ws, station);
    this.callsignToStation.set(callsign, station);

    console.log(`Registered station ${callsign} with capabilities:`, capabilities, authenticated ? '(authenticated)' : '(unauthenticated)');

    this.send(ws, {
      type: 'registered',
      callsign: callsign,
      stationId: station.id,
      authenticated: authenticated,
      certificateStatus: certificateInfo ? 'valid' : 'none',
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

  /**
   * Validate amateur radio certificate
   */
  async validateCertificate(certificate, callsign, certificateChain = []) {
    try {
      // Basic certificate structure validation
      if (!certificate || typeof certificate !== 'object') {
        return {
          valid: false,
          errors: ['Invalid certificate format']
        };
      }

      // Check if certificate contains expected fields
      const requiredFields = ['subject', 'issuer', 'validFrom', 'validTo', 'publicKey'];
      const missingFields = requiredFields.filter(field => !certificate[field]);

      if (missingFields.length > 0) {
        return {
          valid: false,
          errors: [`Missing certificate fields: ${missingFields.join(', ')}`]
        };
      }

      // Check certificate validity period
      const now = new Date();
      const validFrom = new Date(certificate.validFrom);
      const validTo = new Date(certificate.validTo);

      if (now < validFrom || now > validTo) {
        return {
          valid: false,
          errors: ['Certificate is expired or not yet valid']
        };
      }

      // Check if certificate subject matches callsign
      const certCallsign = this.extractCallsignFromCertificate(certificate);
      if (certCallsign !== callsign.toUpperCase()) {
        return {
          valid: false,
          errors: [`Certificate callsign ${certCallsign} does not match provided callsign ${callsign}`]
        };
      }

      // Validate certificate chain if provided
      if (certificateChain.length > 0) {
        const chainValidation = this.validateCertificateChain(certificate, certificateChain);
        if (!chainValidation.valid) {
          return chainValidation;
        }
      }

      return {
        valid: true,
        callsign: certCallsign,
        issuer: certificate.issuer,
        validFrom,
        validTo,
        publicKey: certificate.publicKey
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Certificate validation error: ${error.message}`]
      };
    }
  }

  /**
   * Extract callsign from certificate subject
   */
  extractCallsignFromCertificate(certificate) {
    // Look for callsign in common certificate fields
    if (certificate.subject.CN) {
      return certificate.subject.CN.toUpperCase();
    }

    // Check subject alternative names
    if (certificate.subjectAltName) {
      for (const altName of certificate.subjectAltName) {
        if (altName.startsWith('callsign:')) {
          return altName.replace('callsign:', '').toUpperCase();
        }
      }
    }

    return null;
  }

  /**
   * Validate certificate chain
   */
  validateCertificateChain(certificate, chain) {
    // Simplified chain validation
    // In production, this would use actual cryptographic verification
    try {
      if (chain.length === 0) {
        return { valid: true }; // Self-signed or no chain required
      }

      // Check that the certificate's issuer matches the first certificate in chain
      const firstChainCert = chain[0];
      if (certificate.issuer !== firstChainCert.subject.CN) {
        return {
          valid: false,
          errors: ['Certificate issuer does not match chain']
        };
      }

      // Validate each certificate in the chain
      for (let i = 0; i < chain.length; i++) {
        const cert = chain[i];
        const now = new Date();
        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);

        if (now < validFrom || now > validTo) {
          return {
            valid: false,
            errors: [`Chain certificate ${i} is expired or not yet valid`]
          };
        }
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        errors: [`Chain validation error: ${error.message}`]
      };
    }
  }

  /**
   * Handle server approval/ban management
   */
  handleServerManagement(ws, message) {
    const station = this.stations.get(ws);
    if (!station || !station.authenticated) {
      this.sendError(ws, 'Authentication required for server management');
      return;
    }

    const { action, targetServer, reason } = message;

    switch (action) {
      case 'approve-server':
        this.approveServer(targetServer, station.callsign, reason);
        break;

      case 'ban-server':
        this.banServer(targetServer, station.callsign, reason);
        break;

      case 'get-server-status':
        this.getServerStatus(ws, targetServer);
        break;

      default:
        this.sendError(ws, `Unknown server management action: ${action}`);
    }
  }

  /**
   * Approve server for network participation
   */
  approveServer(serverId, authority, reason) {
    // In production, this would update a persistent approval database
    console.log(`Server ${serverId} approved by ${authority}: ${reason}`);

    // Broadcast approval to network
    this.broadcastToAll({
      type: 'server-approved',
      serverId,
      authority,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Ban server from network participation
   */
  banServer(serverId, authority, reason) {
    console.log(`Server ${serverId} banned by ${authority}: ${reason}`);

    // Broadcast ban to network
    this.broadcastToAll({
      type: 'server-banned',
      serverId,
      authority,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get server status
   */
  getServerStatus(ws, serverId) {
    // In production, this would query a server status database
    this.send(ws, {
      type: 'server-status',
      serverId,
      status: 'unknown', // Would be 'approved', 'banned', 'pending', etc.
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to all connected stations
   */
  broadcastToAll(message) {
    let sent = 0;
    for (const station of this.stations.values()) {
      if (station.send(message)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * Handle emergency broadcast from authenticated stations
   */
  handleEmergencyBroadcast(ws, message) {
    const station = this.stations.get(ws);
    if (!station) {
      this.sendError(ws, 'Must register before sending emergency broadcasts');
      return;
    }

    const { priority, category, content, scope = 'local' } = message;

    // Validate emergency broadcast
    if (priority < 0 || priority > 2) {
      this.sendError(ws, 'Emergency broadcasts must be priority 0-2');
      return;
    }

    console.log(`Emergency broadcast (P${priority}) from ${station.callsign}: ${category}`);

    // Create emergency broadcast message
    const emergencyMessage = {
      type: 'emergency-broadcast',
      id: crypto.randomUUID(),
      priority,
      category,
      content,
      scope,
      fromCallsign: station.callsign,
      timestamp: new Date().toISOString(),
      authenticated: station.authenticated
    };

    // Broadcast to all stations or specific scope
    let recipients = 0;
    if (scope === 'local' || scope === 'regional' || scope === 'national' || scope === 'global') {
      recipients = this.broadcastToAll(emergencyMessage);
    }

    // Log emergency broadcast
    console.log(`Emergency broadcast sent to ${recipients} stations`);

    // Acknowledge to sender
    this.send(ws, {
      type: 'emergency-broadcast-ack',
      id: emergencyMessage.id,
      recipients,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle certificate request for authentication
   */
  handleCertificateRequest(ws, message) {
    const station = this.stations.get(ws);
    if (!station) {
      this.sendError(ws, 'Must register before requesting certificates');
      return;
    }

    const { action, callsign } = message;

    switch (action) {
      case 'request':
        this.requestCertificate(ws, callsign || station.callsign);
        break;

      case 'verify':
        this.verifyCertificate(ws, message.certificate, message.certificateChain);
        break;

      default:
        this.sendError(ws, `Unknown certificate action: ${action}`);
    }
  }

  /**
   * Request certificate for callsign
   */
  requestCertificate(ws, callsign) {
    // In production, this would integrate with certificate authority
    console.log(`Certificate request for ${callsign}`);

    this.send(ws, {
      type: 'certificate-request-response',
      callsign,
      status: 'pending',
      message: 'Certificate request submitted for processing',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Verify certificate without registration
   */
  async verifyCertificate(ws, certificate, certificateChain) {
    try {
      const callsign = this.extractCallsignFromCertificate(certificate);
      const validation = await this.validateCertificate(certificate, callsign, certificateChain);

      this.send(ws, {
        type: 'certificate-verification-response',
        validation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.send(ws, {
        type: 'certificate-verification-response',
        validation: {
          valid: false,
          errors: [`Verification error: ${error.message}`]
        },
        timestamp: new Date().toISOString()
      });
    }
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

  server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { SignalingServer, Station, Network };