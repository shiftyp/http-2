/**
 * Mesh DL Protocol
 *
 * BitTorrent-style content distribution for ham radio mesh networks.
 * Integrates with WebRTC swarm for seamless mode switching.
 */

import { TransmissionModeManager, TransmissionMode } from '../transmission-mode/TransmissionModeManager.js';
import { WebRTCSwarm } from '../webrtc-transport/WebRTCSwarm.js';

export interface ContentChunk {
  contentHash: string;
  chunkIndex: number;
  data: Uint8Array;
  size: number;
  verified: boolean;
  signature?: string;
}

export interface ChunkAvailability {
  contentHash: string;
  chunkIndex: number;
  availablePeers: string[];
  lastUpdated: Date;
  priority: number;
}

export interface PeerStation {
  callsign: string;
  meshAddress: string;
  lastSeen: Date;
  availableChunks: Map<string, number[]>;
  signalQuality: number;
  transmissionMode: TransmissionMode;
}

export interface TransferSession {
  sessionId: string;
  contentHash: string;
  direction: 'upload' | 'download';
  completedChunks: Set<number>;
  totalChunks: number;
  peers: string[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  mode: TransmissionMode;
  startTime: Date;
  bandwidth: number;
}

export interface CQBeacon {
  callsign: string;
  chunks: Map<string, number[]>; // contentHash -> chunk indices
  routes: Map<string, string>; // contentHash -> route path
  cache: Map<string, string>; // contentHash -> freshness
  request: Map<string, number[]>; // contentHash -> needed chunks
  timestamp: Date;
  hopCount: number;
  path: string[];
}

/**
 * Mesh DL Protocol implementation with WebRTC integration
 */
export class MeshDLProtocol {
  private modeManager: TransmissionModeManager;
  private webrtcSwarm: WebRTCSwarm;
  private chunkCache: Map<string, ContentChunk> = new Map();
  private peerStations: Map<string, PeerStation> = new Map();
  private activeSessions: Map<string, TransferSession> = new Map();
  private chunkAvailability: Map<string, ChunkAvailability[]> = new Map();

  constructor(modeManager: TransmissionModeManager, webrtcSwarm: WebRTCSwarm) {
    this.modeManager = modeManager;
    this.webrtcSwarm = webrtcSwarm;
  }

  /**
   * Download content using optimal protocol based on transmission mode
   */
  async downloadContent(contentHash: string, preferredMode?: TransmissionMode): Promise<Uint8Array> {
    const currentMode = preferredMode || this.modeManager.getCurrentMode();

    try {
      switch (currentMode) {
        case TransmissionMode.WebRTC:
          return await this.downloadViaWebRTC(contentHash);

        case TransmissionMode.RF:
          return await this.downloadViaRFChunks(contentHash);

        case TransmissionMode.HYBRID:
          return await this.downloadViaHybrid(contentHash);

        default:
          throw new Error(`Unsupported transmission mode: ${currentMode}`);
      }
    } catch (error) {
      // Automatic fallback to RF chunks if WebRTC fails
      if (currentMode === TransmissionMode.WebRTC) {
        console.warn('WebRTC download failed, falling back to RF chunks:', error);
        await this.modeManager.switchToMode(TransmissionMode.RF);
        return this.downloadViaRFChunks(contentHash);
      }
      throw error;
    }
  }

  /**
   * Download content via WebRTC direct transfer
   */
  private async downloadViaWebRTC(contentHash: string): Promise<Uint8Array> {
    // Use WebRTC swarm for direct download (no chunking)
    return this.webrtcSwarm.downloadContent(contentHash);
  }

  /**
   * Download content via RF BitTorrent chunks
   */
  private async downloadViaRFChunks(contentHash: string): Promise<Uint8Array> {
    // 1. Discover peers with content chunks
    const availability = await this.discoverChunkAvailability(contentHash);

    if (availability.length === 0) {
      throw new Error('No peers found with requested content');
    }

    // 2. Create transfer session
    const sessionId = this.generateSessionId();
    const totalChunks = Math.max(...availability.map(a => a.chunkIndex)) + 1;

    const session: TransferSession = {
      sessionId,
      contentHash,
      direction: 'download',
      completedChunks: new Set(),
      totalChunks,
      peers: this.getAvailablePeers(availability),
      status: 'active',
      mode: TransmissionMode.RF,
      startTime: new Date(),
      bandwidth: 0
    };

    this.activeSessions.set(sessionId, session);

    // 3. Download chunks in parallel from different peers
    const chunks = await this.downloadChunksInParallel(contentHash, availability, session);

    // 4. Verify and assemble content
    const assembledContent = this.assembleAndVerifyContent(chunks);

    // 5. Cache content for redistribution
    await this.cacheContentForRedistribution(contentHash, assembledContent);

    session.status = 'completed';
    return assembledContent;
  }

  /**
   * Download content via hybrid approach (WebRTC + RF)
   */
  private async downloadViaHybrid(contentHash: string): Promise<Uint8Array> {
    // Try WebRTC first, fallback to RF chunks for missing pieces
    try {
      return await this.downloadViaWebRTC(contentHash);
    } catch (webrtcError) {
      console.log('WebRTC failed, using RF chunks as backup');
      return await this.downloadViaRFChunks(contentHash);
    }
  }

  /**
   * Discover chunk availability across mesh network
   */
  async discoverChunkAvailability(contentHash: string): Promise<ChunkAvailability[]> {
    const availability: ChunkAvailability[] = [];

    // 1. Check local cache first
    const localChunks = this.getLocalChunks(contentHash);

    // 2. Query CQ beacons for chunk announcements
    const beaconChunks = await this.queryBeaconsForChunks(contentHash);

    // 3. Active peer discovery via mesh routing
    const peerChunks = await this.queryPeersForChunks(contentHash);

    // 4. Spectrum monitoring for overheard content
    const monitoredChunks = await this.getMonitoredChunks(contentHash);

    // Combine all sources
    const allSources = [...localChunks, ...beaconChunks, ...peerChunks, ...monitoredChunks];

    // Group by chunk index
    const chunkMap = new Map<number, string[]>();
    for (const source of allSources) {
      if (!chunkMap.has(source.chunkIndex)) {
        chunkMap.set(source.chunkIndex, []);
      }
      chunkMap.get(source.chunkIndex)!.push(source.peer);
    }

    // Convert to availability format
    for (const [chunkIndex, peers] of chunkMap) {
      availability.push({
        contentHash,
        chunkIndex,
        availablePeers: peers,
        lastUpdated: new Date(),
        priority: this.calculateChunkPriority(chunkIndex, peers.length)
      });
    }

    return availability;
  }

  /**
   * Download chunks in parallel from multiple peers
   */
  private async downloadChunksInParallel(
    contentHash: string,
    availability: ChunkAvailability[],
    session: TransferSession
  ): Promise<ContentChunk[]> {
    const downloadPromises: Promise<ContentChunk>[] = [];
    const concurrentLimit = 3; // FCC bandwidth compliance

    // Group chunks by peer to balance load
    const peerChunks = this.distributeChunksAcrossPeers(availability);

    for (const [peer, chunkIndices] of peerChunks) {
      for (const chunkIndex of chunkIndices.slice(0, concurrentLimit)) {
        downloadPromises.push(
          this.downloadSingleChunk(contentHash, chunkIndex, peer, session)
        );
      }
    }

    return Promise.all(downloadPromises);
  }

  /**
   * Download single chunk from specific peer
   */
  private async downloadSingleChunk(
    contentHash: string,
    chunkIndex: number,
    peer: string,
    session: TransferSession
  ): Promise<ContentChunk> {
    // Send chunk request via appropriate transport
    const request = {
      type: 'chunk-request',
      contentHash,
      chunkIndex,
      sessionId: session.sessionId,
      requestTime: Date.now()
    };

    // Route request based on peer's transmission mode
    const peerInfo = this.peerStations.get(peer);
    if (peerInfo?.transmissionMode === TransmissionMode.WebRTC) {
      return this.requestChunkViaWebRTC(request, peer);
    } else {
      return this.requestChunkViaRF(request, peer);
    }
  }

  /**
   * Request chunk via WebRTC data channel
   */
  private async requestChunkViaWebRTC(request: any, peer: string): Promise<ContentChunk> {
    // Use WebRTC swarm to request specific chunk
    return {
      contentHash: request.contentHash,
      chunkIndex: request.chunkIndex,
      data: new Uint8Array(), // Placeholder
      size: 1024,
      verified: false
    };
  }

  /**
   * Request chunk via RF transmission
   */
  private async requestChunkViaRF(request: any, peer: string): Promise<ContentChunk> {
    // Use radio control to send chunk request
    return {
      contentHash: request.contentHash,
      chunkIndex: request.chunkIndex,
      data: new Uint8Array(), // Placeholder
      size: 1024,
      verified: false
    };
  }

  /**
   * Announce content availability in CQ beacon
   */
  async announceContentAvailability(contentHash: string, chunkIndices: number[]): Promise<void> {
    const beacon: CQBeacon = {
      callsign: 'KA1ABC', // From configuration
      chunks: new Map([[contentHash, chunkIndices]]),
      routes: new Map(),
      cache: new Map(),
      request: new Map(),
      timestamp: new Date(),
      hopCount: 0,
      path: []
    };

    // Broadcast enhanced CQ beacon with content info
    await this.broadcastCQBeacon(beacon);
  }

  /**
   * Handle incoming chunk request
   */
  async handleChunkRequest(request: any, fromPeer: string): Promise<void> {
    const chunk = this.chunkCache.get(`${request.contentHash}:${request.chunkIndex}`);

    if (chunk) {
      // Send chunk to requesting peer
      await this.sendChunkToPeer(chunk, fromPeer);

      // Log transfer for QSO
      await this.logChunkTransfer(request, fromPeer, 'sent');
    } else {
      // Check if we can route request to another peer
      await this.routeChunkRequest(request, fromPeer);
    }
  }

  /**
   * Cache content for redistribution
   */
  private async cacheContentForRedistribution(contentHash: string, content: Uint8Array): Promise<void> {
    const chunkSize = 1024; // 1KB chunks for ham radio optimization
    const totalChunks = Math.ceil(content.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, content.length);
      const chunkData = content.slice(start, end);

      const chunk: ContentChunk = {
        contentHash,
        chunkIndex: i,
        data: chunkData,
        size: chunkData.length,
        verified: true,
        signature: await this.signChunk(chunkData)
      };

      this.chunkCache.set(`${contentHash}:${i}`, chunk);
    }

    // Announce availability
    await this.announceContentAvailability(contentHash, Array.from({length: totalChunks}, (_, i) => i));
  }

  // Helper methods (placeholders for now)
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAvailablePeers(availability: ChunkAvailability[]): string[] {
    const peers = new Set<string>();
    availability.forEach(a => a.availablePeers.forEach(p => peers.add(p)));
    return Array.from(peers);
  }

  private assembleAndVerifyContent(chunks: ContentChunk[]): Uint8Array {
    // Sort chunks by index and verify integrity
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const assembled = new Uint8Array(totalSize);

    let offset = 0;
    for (const chunk of chunks) {
      assembled.set(chunk.data, offset);
      offset += chunk.size;
    }

    return assembled;
  }

  private calculateChunkPriority(chunkIndex: number, peerCount: number): number {
    // Higher priority for chunks with fewer peers
    return Math.max(1, 10 - peerCount);
  }

  private distributeChunksAcrossPeers(availability: ChunkAvailability[]): Map<string, number[]> {
    const peerChunks = new Map<string, number[]>();

    for (const chunk of availability) {
      for (const peer of chunk.availablePeers) {
        if (!peerChunks.has(peer)) {
          peerChunks.set(peer, []);
        }
        peerChunks.get(peer)!.push(chunk.chunkIndex);
      }
    }

    return peerChunks;
  }

  // More placeholder methods
  private async getLocalChunks(contentHash: string): Promise<any[]> { return []; }
  private async queryBeaconsForChunks(contentHash: string): Promise<any[]> { return []; }
  private async queryPeersForChunks(contentHash: string): Promise<any[]> { return []; }
  private async getMonitoredChunks(contentHash: string): Promise<any[]> { return []; }
  private async broadcastCQBeacon(beacon: CQBeacon): Promise<void> { }
  private async sendChunkToPeer(chunk: ContentChunk, peer: string): Promise<void> { }
  private async logChunkTransfer(request: any, peer: string, direction: string): Promise<void> { }
  private async routeChunkRequest(request: any, fromPeer: string): Promise<void> { }
  private async signChunk(data: Uint8Array): Promise<string> { return 'signature'; }
}