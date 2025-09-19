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
  transferStats: {
    bytesReceived: number;
    bytesSent: number;
    throughput: number; // bytes/second
    latency: number; // milliseconds
  };
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
  private contentCache: Map<string, { data: Uint8Array; metadata: ContentMetadata }> = new Map();
  private activeDownloads: Map<string, Promise<Uint8Array>> = new Map();
  private transferMetrics: Map<string, { startTime: number; bytesTransferred: number }> = new Map();

  constructor(modeManager: TransmissionModeManager) {
    this.modeManager = modeManager;
    this.startMetricsCollection();
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

    // Setup high-throughput data channel for content transfer
    const dataChannel = peerConnection.createDataChannel('content', {
      ordered: false, // Allow out-of-order delivery for speed
      maxRetransmits: 0, // No retransmits for speed
      protocol: 'ham-radio-transfer'
    });

    // Setup control channel for metadata and coordination
    const controlChannel = peerConnection.createDataChannel('control', {
      ordered: true,
      maxPacketLifeTime: 1000
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
            dataChannels: new Map([
              ['content', dataChannel],
              ['control', controlChannel]
            ]),
            capabilities: ['content-download', 'content-upload'],
            lastSeen: new Date(),
            transferStats: {
              bytesReceived: 0,
              bytesSent: 0,
              throughput: 0,
              latency: 0
            }
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
   * Optimized for 1MB/s+ transfers on local networks
   */
  async downloadContent(contentHash: string): Promise<Uint8Array> {
    // Check if already downloading
    if (this.activeDownloads.has(contentHash)) {
      return this.activeDownloads.get(contentHash)!;
    }

    // Check cache first
    const cached = this.contentCache.get(contentHash);
    if (cached) {
      return cached.data;
    }

    const downloadPromise = this.performHighSpeedDownload(contentHash);
    this.activeDownloads.set(contentHash, downloadPromise);

    try {
      const result = await downloadPromise;
      this.activeDownloads.delete(contentHash);
      return result;
    } catch (error) {
      this.activeDownloads.delete(contentHash);
      throw error;
    }
  }

  /**
   * Perform high-speed multi-peer download
   */
  private async performHighSpeedDownload(contentHash: string): Promise<Uint8Array> {
    // 1. Find all available peers with content
    const availablePeers = await this.findPeersWithContent(contentHash);

    if (availablePeers.length === 0) {
      throw new Error('No WebRTC peers available, switch to RF mode');
    }

    // 2. Get content metadata from fastest peer
    const fastestPeer = this.selectFastestPeer(availablePeers);
    const metadata = await this.getContentMetadata(contentHash, fastestPeer);

    // 3. For large files, use parallel downloading from multiple peers
    if (metadata.totalSize > 1024 * 1024) { // > 1MB, use parallel chunks
      return this.downloadParallelChunks(contentHash, metadata, availablePeers);
    } else {
      // Small files, download directly from fastest peer
      return this.downloadDirectly(contentHash, fastestPeer);
    }
  }

  /**
   * Download large content using parallel connections
   */
  private async downloadParallelChunks(
    contentHash: string,
    metadata: ContentMetadata,
    availablePeers: string[]
  ): Promise<Uint8Array> {
    const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal WebRTC performance
    const numChunks = Math.ceil(metadata.totalSize / CHUNK_SIZE);
    const chunks: (Uint8Array | null)[] = new Array(numChunks).fill(null);

    // Create download promises for each chunk
    const downloadPromises: Promise<void>[] = [];

    for (let i = 0; i < numChunks; i++) {
      const peerIndex = i % availablePeers.length;
      const peer = availablePeers[peerIndex];

      downloadPromises.push(
        this.downloadChunkRange(contentHash, i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, metadata.totalSize), peer)
          .then(chunkData => {
            chunks[i] = chunkData;
          })
      );
    }

    // Wait for all chunks to complete
    await Promise.all(downloadPromises);

    // Verify all chunks received
    for (let i = 0; i < chunks.length; i++) {
      if (!chunks[i]) {
        throw new Error(`Failed to download chunk ${i}`);
      }
    }

    // Assemble final content
    return this.assembleChunks(chunks as Uint8Array[]);
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
   * Get performance statistics for all peers
   */
  getPerformanceStats(): {
    totalPeers: number;
    connectedPeers: number;
    averageThroughput: number;
    maxThroughput: number;
    totalBytesTransferred: number;
    peerStats: Array<{
      callsign: string;
      throughput: number;
      bytesReceived: number;
      latency: number;
      connectionState: string;
    }>;
  } {
    const connectedPeers = this.getConnectedPeers();

    let totalThroughput = 0;
    let maxThroughput = 0;
    let totalBytes = 0;

    const peerStats = connectedPeers.map(peer => {
      totalThroughput += peer.transferStats.throughput;
      maxThroughput = Math.max(maxThroughput, peer.transferStats.throughput);
      totalBytes += peer.transferStats.bytesReceived;

      return {
        callsign: peer.callsign,
        throughput: peer.transferStats.throughput,
        bytesReceived: peer.transferStats.bytesReceived,
        latency: peer.transferStats.latency,
        connectionState: peer.connectionState
      };
    });

    return {
      totalPeers: this.peers.size,
      connectedPeers: connectedPeers.length,
      averageThroughput: connectedPeers.length > 0 ? totalThroughput / connectedPeers.length : 0,
      maxThroughput,
      totalBytesTransferred: totalBytes,
      peerStats
    };
  }

  /**
   * Check if target throughput (1MB/s) is achievable
   */
  canAchieveTargetThroughput(): boolean {
    const stats = this.getPerformanceStats();
    const targetThroughput = 1024 * 1024; // 1MB/s

    return stats.maxThroughput >= targetThroughput ||
           stats.averageThroughput >= targetThroughput * 0.8; // 80% of target
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
    const peer = this.peers.get(callsign);
    if (!peer || peer.connectionState !== 'connected') {
      throw new Error(`Peer ${callsign} not connected`);
    }

    const controlChannel = peer.dataChannels.get('control');
    const dataChannel = peer.dataChannels.get('content');

    if (!controlChannel || !dataChannel) {
      throw new Error(`Data channels not available for ${callsign}`);
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const chunks: Uint8Array[] = [];
      let expectedSize = 0;
      let receivedSize = 0;

      // Set up temporary message handler
      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);

          if (message.requestId === requestId) {
            switch (message.type) {
              case 'content-metadata':
                expectedSize = message.size;
                break;
              case 'content-chunk':
                const chunk = new Uint8Array(message.data);
                chunks.push(chunk);
                receivedSize += chunk.length;

                // Update transfer metrics
                this.updateTransferMetrics(callsign, chunk.length);

                if (receivedSize >= expectedSize) {
                  dataChannel.removeEventListener('message', messageHandler);
                  resolve(this.assembleChunks(chunks));
                }
                break;
              case 'content-error':
                dataChannel.removeEventListener('message', messageHandler);
                reject(new Error(message.error));
                break;
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      dataChannel.addEventListener('message', messageHandler);

      // Send download request
      controlChannel.send(JSON.stringify({
        type: 'download-request',
        contentHash,
        requestId
      }));

      // Set timeout
      setTimeout(() => {
        dataChannel.removeEventListener('message', messageHandler);
        reject(new Error('Download timeout'));
      }, 30000);
    });
  }

  /**
   * Download specific chunk range from peer
   */
  private async downloadChunkRange(
    contentHash: string,
    startByte: number,
    endByte: number,
    callsign: string
  ): Promise<Uint8Array> {
    const peer = this.peers.get(callsign);
    if (!peer || peer.connectionState !== 'connected') {
      throw new Error(`Peer ${callsign} not connected`);
    }

    const controlChannel = peer.dataChannels.get('control');
    const dataChannel = peer.dataChannels.get('content');

    if (!controlChannel || !dataChannel) {
      throw new Error(`Data channels not available for ${callsign}`);
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const chunks: Uint8Array[] = [];
      let receivedSize = 0;
      const expectedSize = endByte - startByte;

      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);

          if (message.requestId === requestId && message.type === 'chunk-data') {
            const chunk = new Uint8Array(message.data);
            chunks.push(chunk);
            receivedSize += chunk.length;

            this.updateTransferMetrics(callsign, chunk.length);

            if (receivedSize >= expectedSize) {
              dataChannel.removeEventListener('message', messageHandler);
              resolve(this.assembleChunks(chunks));
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      dataChannel.addEventListener('message', messageHandler);

      // Send chunk range request
      controlChannel.send(JSON.stringify({
        type: 'chunk-range-request',
        contentHash,
        startByte,
        endByte,
        requestId
      }));

      // Set timeout
      setTimeout(() => {
        dataChannel.removeEventListener('message', messageHandler);
        reject(new Error('Chunk download timeout'));
      }, 10000);
    });
  }

  /**
   * Select fastest peer based on transfer statistics
   */
  private selectFastestPeer(peers: string[]): string {
    let fastestPeer = peers[0];
    let highestThroughput = 0;

    for (const callsign of peers) {
      const peer = this.peers.get(callsign);
      if (peer && peer.transferStats.throughput > highestThroughput) {
        highestThroughput = peer.transferStats.throughput;
        fastestPeer = callsign;
      }
    }

    return fastestPeer;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Update transfer metrics for throughput calculation
   */
  private updateTransferMetrics(callsign: string, bytesTransferred: number): void {
    const peer = this.peers.get(callsign);
    if (!peer) return;

    peer.transferStats.bytesReceived += bytesTransferred;
    peer.lastSeen = new Date();

    const metricsKey = `${callsign}-${Date.now()}`;
    this.transferMetrics.set(metricsKey, {
      startTime: Date.now(),
      bytesTransferred
    });
  }

  /**
   * Start metrics collection for throughput calculation
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.calculateThroughput();
      this.cleanupOldMetrics();
    }, 1000);
  }

  /**
   * Calculate throughput for all peers
   */
  private calculateThroughput(): void {
    const now = Date.now();
    const timeWindow = 5000; // 5 second window

    for (const [callsign, peer] of this.peers) {
      let totalBytes = 0;
      let count = 0;

      for (const [key, metrics] of this.transferMetrics) {
        if (key.startsWith(callsign) && (now - metrics.startTime) < timeWindow) {
          totalBytes += metrics.bytesTransferred;
          count++;
        }
      }

      if (count > 0) {
        peer.transferStats.throughput = totalBytes / (timeWindow / 1000); // bytes per second
      }
    }
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 10000; // Keep metrics for 10 seconds

    for (const [key, metrics] of this.transferMetrics) {
      if (now - metrics.startTime > maxAge) {
        this.transferMetrics.delete(key);
      }
    }
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