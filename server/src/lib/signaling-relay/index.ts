/**
 * WebRTC Signaling Relay Library
 * Manages WebRTC signaling between peers without media relay
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import winston from 'winston';

export interface SignalingClient {
  id: string;
  ws: WebSocket;
  callsign?: string;
  certificate?: string;
  licenseClass?: string;
  canRelay: boolean;
  registeredAt: Date;
  lastActivity: Date;
}

export interface SignalingMessage {
  type: string;
  [key: string]: any;
}

export interface RelayStatistics {
  totalClients: number;
  licensedClients: number;
  unlicensedClients: number;
  totalMessages: number;
  offersRelayed: number;
  answersRelayed: number;
  iceCandidatesRelayed: number;
}

export class SignalingRelay extends EventEmitter {
  private clients: Map<string, SignalingClient> = new Map();
  private clientsByCallsign: Map<string, SignalingClient> = new Map();
  private statistics: RelayStatistics = {
    totalClients: 0,
    licensedClients: 0,
    unlicensedClients: 0,
    totalMessages: 0,
    offersRelayed: 0,
    answersRelayed: 0,
    iceCandidatesRelayed: 0
  };
  private readonly MAX_CLIENTS = 1000;
  private readonly ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly logger: winston.Logger;

  constructor(logger?: winston.Logger) {
    super();
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });

    // Start cleanup interval
    setInterval(() => this.cleanupInactiveClients(), 60000);
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, clientId: string): void {
    if (this.clients.size >= this.MAX_CLIENTS) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: 'Server at capacity'
      }));
      ws.close();
      return;
    }

    const client: SignalingClient = {
      id: clientId,
      ws,
      canRelay: false,
      registeredAt: new Date(),
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);
    this.statistics.totalClients++;

    this.logger.debug(`Client connected: ${clientId}`);
    this.emit('clientConnected', clientId);
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from maps
    this.clients.delete(clientId);
    if (client.callsign) {
      this.clientsByCallsign.delete(client.callsign);
    }

    // Update statistics
    this.statistics.totalClients--;
    if (client.certificate) {
      this.statistics.licensedClients--;
    } else {
      this.statistics.unlicensedClients--;
    }

    // Notify other clients
    this.broadcastPeerLeft(clientId);

    this.logger.debug(`Client disconnected: ${clientId}`);
    this.emit('clientDisconnected', clientId);
  }

  /**
   * Process signaling message
   */
  processMessage(clientId: string, message: SignalingMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update activity
    client.lastActivity = new Date();
    this.statistics.totalMessages++;

    switch (message.type) {
      case 'REGISTER':
        this.handleRegister(client, message);
        break;
      case 'OFFER':
        this.handleOffer(client, message);
        break;
      case 'ANSWER':
        this.handleAnswer(client, message);
        break;
      case 'ICE_CANDIDATE':
        this.handleIceCandidate(client, message);
        break;
      case 'LIST_PEERS':
        this.handleListPeers(client);
        break;
      case 'PING':
        this.handlePing(client);
        break;
      default:
        this.sendError(client, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle registration
   */
  private handleRegister(client: SignalingClient, message: SignalingMessage): void {
    const { callsign, certificate, licenseClass } = message;

    // Update client info
    client.callsign = callsign || 'GUEST';
    client.certificate = certificate;
    client.licenseClass = licenseClass;
    client.canRelay = !!certificate;

    // Update maps
    if (callsign) {
      this.clientsByCallsign.set(callsign, client);
    }

    // Update statistics
    if (certificate) {
      this.statistics.licensedClients++;
    } else {
      this.statistics.unlicensedClients++;
    }

    // Send registration confirmation
    this.sendMessage(client, {
      type: 'REGISTERED',
      clientId: client.id,
      peers: this.getPeerList(client.id)
    });

    // Notify others of new peer
    this.broadcastPeerJoined(client);

    this.logger.info(`Client registered: ${client.callsign} (${client.id})`);
    this.emit('clientRegistered', client);
  }

  /**
   * Handle WebRTC offer
   */
  private handleOffer(from: SignalingClient, message: SignalingMessage): void {
    const { target, offer } = message;
    const targetClient = this.findClient(target);

    if (!targetClient) {
      this.sendError(from, `Target ${target} not found`);
      return;
    }

    // Check if unlicensed user trying to relay
    if (!from.certificate && !this.isLocalConnection(from, targetClient)) {
      this.sendError(from, 'Unlicensed users can only connect locally');
      return;
    }

    this.sendMessage(targetClient, {
      type: 'OFFER_RECEIVED',
      from: from.id,
      fromCallsign: from.callsign,
      offer
    });

    this.statistics.offersRelayed++;
    this.emit('offerRelayed', from.id, targetClient.id);
  }

  /**
   * Handle WebRTC answer
   */
  private handleAnswer(from: SignalingClient, message: SignalingMessage): void {
    const { target, answer } = message;
    const targetClient = this.findClient(target);

    if (!targetClient) {
      this.sendError(from, `Target ${target} not found`);
      return;
    }

    this.sendMessage(targetClient, {
      type: 'ANSWER_RECEIVED',
      from: from.id,
      fromCallsign: from.callsign,
      answer
    });

    this.statistics.answersRelayed++;
    this.emit('answerRelayed', from.id, targetClient.id);
  }

  /**
   * Handle ICE candidate
   */
  private handleIceCandidate(from: SignalingClient, message: SignalingMessage): void {
    const { target, candidate } = message;
    const targetClient = this.findClient(target);

    if (!targetClient) {
      // Silently ignore missing targets for ICE candidates
      return;
    }

    this.sendMessage(targetClient, {
      type: 'ICE_CANDIDATE_RECEIVED',
      from: from.id,
      candidate
    });

    this.statistics.iceCandidatesRelayed++;
  }

  /**
   * Handle peer list request
   */
  private handleListPeers(client: SignalingClient): void {
    this.sendMessage(client, {
      type: 'PEER_LIST',
      peers: this.getPeerList(client.id)
    });
  }

  /**
   * Handle ping
   */
  private handlePing(client: SignalingClient): void {
    this.sendMessage(client, {
      type: 'PONG',
      timestamp: Date.now()
    });
  }

  /**
   * Get list of peers
   */
  private getPeerList(excludeId: string): any[] {
    const peers: any[] = [];

    this.clients.forEach((client, id) => {
      if (id !== excludeId) {
        peers.push({
          id: client.id,
          callsign: client.callsign,
          hasLicense: !!client.certificate,
          licenseClass: client.licenseClass,
          canRelay: client.canRelay
        });
      }
    });

    return peers;
  }

  /**
   * Broadcast peer joined
   */
  private broadcastPeerJoined(newClient: SignalingClient): void {
    const message = {
      type: 'PEER_JOINED',
      peer: {
        id: newClient.id,
        callsign: newClient.callsign,
        hasLicense: !!newClient.certificate,
        licenseClass: newClient.licenseClass
      }
    };

    this.broadcast(message, newClient.id);
  }

  /**
   * Broadcast peer left
   */
  private broadcastPeerLeft(clientId: string): void {
    const message = {
      type: 'PEER_LEFT',
      peerId: clientId
    };

    this.broadcast(message);
  }

  /**
   * Broadcast message to all clients
   */
  private broadcast(message: any, excludeId?: string): void {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendMessage(client: SignalingClient, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  private sendError(client: SignalingClient, error: string): void {
    this.sendMessage(client, {
      type: 'ERROR',
      error
    });
  }

  /**
   * Find client by ID or callsign
   */
  private findClient(identifier: string): SignalingClient | undefined {
    // Try by ID first
    if (this.clients.has(identifier)) {
      return this.clients.get(identifier);
    }

    // Try by callsign
    return this.clientsByCallsign.get(identifier);
  }

  /**
   * Check if connection is local (same network)
   */
  private isLocalConnection(from: SignalingClient, to: SignalingClient): boolean {
    // In a real implementation, check IP addresses
    // For now, allow all local connections
    return true;
  }

  /**
   * Cleanup inactive clients
   */
  private cleanupInactiveClients(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.clients.forEach((client, id) => {
      if (now - client.lastActivity.getTime() > this.ACTIVITY_TIMEOUT) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => {
      const client = this.clients.get(id);
      if (client) {
        client.ws.close(1000, 'Inactive timeout');
        this.handleDisconnection(id);
      }
    });

    if (toRemove.length > 0) {
      this.logger.info(`Cleaned up ${toRemove.length} inactive clients`);
    }
  }

  /**
   * Get relay statistics
   */
  getStatistics(): RelayStatistics {
    return { ...this.statistics };
  }

  /**
   * Get connected clients
   */
  getConnectedClients(): SignalingClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Shutdown relay
   */
  shutdown(): void {
    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });

    this.clients.clear();
    this.clientsByCallsign.clear();

    this.removeAllListeners();
  }
}