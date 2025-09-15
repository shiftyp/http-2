/**
 * WebRTC Swarm Manager
 *
 * Manages WebRTC peer connections for BitTorrent-style content distribution.
 * Implements direct downloads with automatic switching to RF chunks when needed.
 */

import { TransmissionModeManager, TransmissionMode } from '../transmission-mode/TransmissionModeManager.js';

export interface WebRTCPeerInfo {
  peerId: string;
  callsign: string;
  connectionState: RTCPeerConnectionState;
  dataChannels: Map<string, RTCDataChannel>;
  capabilities: string[];
  lastSeen: Date;
}

export interface ContentRequest {
  contentHash: string;
  requestId: string;
  requesterCallsign: string;
  priority: 'emergency' | 'normal' | 'background';
}

export interface ChunkRequest {
  contentHash: string;
  chunkIndex: number;
  requestId: string;
}

export interface ContentMetadata {
  contentHash: string;
  totalSize: number;
  totalChunks: number;
  mimeType: string;
  filename: string;
  chunkSize: number;
}

/**
 * WebRTC-based content distribution swarm
 * Integrates with BitTorrent protocol for seamless mode switching
 */
export class WebRTCSwarm {
  private peers: Map<string, WebRTCPeerInfo> = new Map();
  private pendingConnections: Map<string, RTCPeerConnection> = new Map();
  private signalingSocket?: WebSocket;
  private modeManager: TransmissionModeManager;

  constructor(modeManager: TransmissionModeManager) {
    this.modeManager = modeManager;
  }

  /**
   * Connect to signaling server for internet peer discovery
   */
  async connectToSignalingServer(serverUrl: string, callsign: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signalingSocket = new WebSocket(serverUrl);

      this.signalingSocket.onopen = () => {
        // Register with signaling server
        this.signalingSocket!.send(JSON.stringify({
          type: 'register',
          callsign: callsign,
          capabilities: ['content-download', 'content-upload', 'mesh-routing']
        }));
        resolve();
      };

      this.signalingSocket.onerror = (error) => {
        reject(new Error(`Signaling server connection failed: ${error}`));
      };

      this.signalingSocket.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.signalingSocket.onclose = () => {
        // Attempt to fallback to RF mode
        if (this.modeManager.getCurrentMode() === TransmissionMode.WebRTC) {
          this.modeManager.switchToMode(TransmissionMode.RF);
        }
      };
    });
  }

  /**
   * Discover peers on local network using mDNS
   */
  async discoverLocalPeers(): Promise<WebRTCPeerInfo[]> {
    // Use WebRTC local discovery for same-subnet stations
    // This would typically use mDNS or other local discovery protocols
    // Placeholder implementation
    return [];
  }

  /**
   * Connect to specific peer by callsign
   */
  async connectToPeer(callsign: string): Promise<WebRTCPeerInfo> {
    if (this.peers.has(callsign)) {
      return this.peers.get(callsign)!;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // Setup data channel for content transfer
    const dataChannel = peerConnection.createDataChannel('content', {
      ordered: true,
      maxPacketLifeTime: 3000
    });

    this.setupDataChannelHandlers(dataChannel, callsign);

    // Store pending connection
    this.pendingConnections.set(callsign, peerConnection);

    // Create offer and send via signaling
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify({
        type: 'offer',
        targetCallsign: callsign,
        offer: offer
      }));
    }

    return new Promise((resolve, reject) => {
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'connected') {
          const peerInfo: WebRTCPeerInfo = {
            peerId: callsign,
            callsign: callsign,
            connectionState: peerConnection.connectionState,
            dataChannels: new Map([['content', dataChannel]]),
            capabilities: ['content-download', 'content-upload'],
            lastSeen: new Date()
          };

          this.peers.set(callsign, peerInfo);
          this.pendingConnections.delete(callsign);
          resolve(peerInfo);
        } else if (peerConnection.connectionState === 'failed') {
          this.pendingConnections.delete(callsign);
          reject(new Error(`Failed to connect to peer ${callsign}`));
        }
      };
    });
  }

  /**
   * Download content directly via WebRTC (BitTorrent alternative)
   */
  async downloadContent(contentHash: string): Promise<Uint8Array> {
    // 1. Find peers with content
    const availablePeers = await this.findPeersWithContent(contentHash);

    if (availablePeers.length === 0) {
      // Fallback to BitTorrent chunking over RF
      throw new Error('No WebRTC peers available, switch to RF mode');
    }

    // 2. Get content metadata
    const metadata = await this.getContentMetadata(contentHash, availablePeers[0]);

    // 3. Download content directly (no chunking needed for WebRTC)
    return this.downloadDirectly(contentHash, availablePeers[0]);
  }

  /**
   * Download content using BitTorrent-style chunks (when WebRTC unavailable)
   */
  async downloadContentChunks(contentHash: string): Promise<Uint8Array> {
    // This method bridges to the BitTorrent implementation
    // when WebRTC peers are unavailable
    const availablePeers = await this.findPeersWithContent(contentHash);

    if (availablePeers.length === 0) {
      throw new Error('No peers available for chunked download');
    }

    const metadata = await this.getContentMetadata(contentHash, availablePeers[0]);
    const chunks: Uint8Array[] = new Array(metadata.totalChunks);

    // Download different chunks from different peers simultaneously
    const downloadPromises = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      const peer = availablePeers[i % availablePeers.length];
      downloadPromises.push(this.downloadChunk(contentHash, i, peer));
    }

    const chunkResults = await Promise.all(downloadPromises);

    // Assemble chunks into complete content
    return this.assembleChunks(chunkResults);
  }

  /**
   * Upload content to make it available for other peers
   */
  async uploadContent(content: Uint8Array, metadata: ContentMetadata): Promise<void> {
    // Make content available for direct download requests
    // Store in local cache and announce availability
  }

  /**
   * Get list of connected peers
   */
  getConnectedPeers(): WebRTCPeerInfo[] {
    return Array.from(this.peers.values()).filter(
      peer => peer.connectionState === 'connected'
    );
  }

  /**
   * Disconnect from specific peer
   */
  async disconnectFromPeer(callsign: string): Promise<void> {
    const peer = this.peers.get(callsign);
    if (peer) {
      peer.dataChannels.forEach(channel => channel.close());
      this.peers.delete(callsign);
    }
  }

  /**
   * Handle signaling server messages
   */
  private handleSignalingMessage(message: any): void {
    switch (message.type) {
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'ice-candidate':
        this.handleIceCandidate(message);
        break;
      case 'peer-list':
        this.handlePeerList(message);
        break;
    }
  }

  /**
   * Handle WebRTC offer from peer
   */
  private async handleOffer(message: any): Promise<void> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    await peerConnection.setRemoteDescription(message.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer back through signaling
    if (this.signalingSocket) {
      this.signalingSocket.send(JSON.stringify({
        type: 'answer',
        targetCallsign: message.fromCallsign,
        answer: answer
      }));
    }
  }

  /**
   * Handle WebRTC answer from peer
   */
  private async handleAnswer(message: any): Promise<void> {
    const peerConnection = this.pendingConnections.get(message.fromCallsign);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(message.answer);
    }
  }

  /**
   * Handle ICE candidate from peer
   */
  private async handleIceCandidate(message: any): Promise<void> {
    const peerConnection = this.pendingConnections.get(message.fromCallsign) ||
                          this.getConnectionForPeer(message.fromCallsign);

    if (peerConnection) {
      await peerConnection.addIceCandidate(message.candidate);
    }
  }

  /**
   * Handle peer list from signaling server
   */
  private handlePeerList(message: any): void {
    // Update available peers for connection
    console.log('Available peers:', message.peers);
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannelHandlers(channel: RTCDataChannel, callsign: string): void {
    channel.onopen = () => {
      console.log(`Data channel opened with ${callsign}`);
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, callsign);
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${callsign}`);
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with ${callsign}:`, error);
    };
  }

  /**
   * Handle data channel messages (content requests/responses)
   */
  private handleDataChannelMessage(data: any, fromCallsign: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'content-request':
          this.handleContentRequest(message, fromCallsign);
          break;
        case 'chunk-request':
          this.handleChunkRequest(message, fromCallsign);
          break;
        case 'content-response':
          this.handleContentResponse(message);
          break;
        case 'chunk-response':
          this.handleChunkResponse(message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse data channel message:', error);
    }
  }

  /**
   * Find peers that have specific content
   */
  private async findPeersWithContent(contentHash: string): Promise<string[]> {
    // Query connected peers for content availability
    const availablePeers: string[] = [];

    for (const [callsign, peer] of this.peers) {
      if (peer.connectionState === 'connected') {
        const hasContent = await this.queryPeerForContent(callsign, contentHash);
        if (hasContent) {
          availablePeers.push(callsign);
        }
      }
    }

    return availablePeers;
  }

  /**
   * Query peer to check if they have content
   */
  private async queryPeerForContent(callsign: string, contentHash: string): Promise<boolean> {
    // Send content availability query to peer
    return false; // Placeholder
  }

  /**
   * Get content metadata from peer
   */
  private async getContentMetadata(contentHash: string, callsign: string): Promise<ContentMetadata> {
    // Request metadata from peer
    return {
      contentHash,
      totalSize: 0,
      totalChunks: 0,
      mimeType: 'application/octet-stream',
      filename: 'unknown',
      chunkSize: 1024
    }; // Placeholder
  }

  /**
   * Download content directly (no chunking)
   */
  private async downloadDirectly(contentHash: string, callsign: string): Promise<Uint8Array> {
    // Request complete content from peer
    return new Uint8Array(); // Placeholder
  }

  /**
   * Download specific chunk from peer
   */
  private async downloadChunk(contentHash: string, chunkIndex: number, callsign: string): Promise<Uint8Array> {
    // Request specific chunk from peer
    return new Uint8Array(); // Placeholder
  }

  /**
   * Assemble chunks into complete content
   */
  private assembleChunks(chunks: Uint8Array[]): Uint8Array {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const assembled = new Uint8Array(totalSize);

    let offset = 0;
    for (const chunk of chunks) {
      assembled.set(chunk, offset);
      offset += chunk.length;
    }

    return assembled;
  }

  /**
   * Handle content request from peer
   */
  private handleContentRequest(message: ContentRequest, fromCallsign: string): void {
    // Process content request and respond with availability
  }

  /**
   * Handle chunk request from peer
   */
  private handleChunkRequest(message: ChunkRequest, fromCallsign: string): void {
    // Process chunk request and send chunk data
  }

  /**
   * Handle content response from peer
   */
  private handleContentResponse(message: any): void {
    // Process content response
  }

  /**
   * Handle chunk response from peer
   */
  private handleChunkResponse(message: any): void {
    // Process chunk response
  }

  /**
   * Get RTCPeerConnection for specific peer
   */
  private getConnectionForPeer(callsign: string): RTCPeerConnection | undefined {
    // Get existing connection for peer
    return undefined; // Placeholder
  }
}