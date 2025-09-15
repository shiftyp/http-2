/**
 * WebRTC peer-to-peer data transfer for local network station migration
 * Compliant with FCC Part 97 - encryption only for local network, never over radio
 */

import { TransferCrypto } from '../transfer-crypto';

export interface TransferConfig {
  iceServers?: RTCIceServer[];
  timeout?: number;
  chunkSize?: number;
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

export interface TransferSession {
  id: string;
  role: 'sender' | 'receiver';
  state: 'waiting' | 'connecting' | 'transferring' | 'complete' | 'failed';
  peer?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export class WebRTCTransfer {
  private config: TransferConfig;
  private connection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private crypto: TransferCrypto;
  private session: TransferSession | null = null;
  private progressCallback?: (progress: TransferProgress) => void;
  private chunkSize: number;
  private pendingChunks: Map<number, Uint8Array> = new Map();
  private receivedChunks: Map<number, Uint8Array> = new Map();
  private totalChunks: number = 0;
  private bytesTransferred: number = 0;
  private startTime: number = 0;

  constructor(config: TransferConfig = {}) {
    this.config = {
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      timeout: config.timeout || 300000, // 5 minutes
      chunkSize: config.chunkSize || 16384 // 16KB chunks
    };
    this.chunkSize = this.config.chunkSize!;
    this.crypto = new TransferCrypto();
  }

  /**
   * Initialize a transfer session as sender
   */
  async initiateSend(data: any): Promise<string> {
    this.session = {
      id: this.generateSessionId(),
      role: 'sender',
      state: 'waiting',
      startTime: Date.now()
    };

    // Serialize and prepare data
    const serialized = JSON.stringify(data);
    const dataBuffer = new TextEncoder().encode(serialized);

    // Encrypt data for local network transfer
    const encrypted = await this.crypto.encryptForTransfer(dataBuffer);

    // Split into chunks
    this.prepareChunks(encrypted);

    // Create peer connection
    await this.createPeerConnection();

    // Create offer
    const offer = await this.connection!.createOffer();
    await this.connection!.setLocalDescription(offer);

    // Return connection info as base64
    return btoa(JSON.stringify({
      sessionId: this.session.id,
      offer: offer,
      totalSize: encrypted.byteLength,
      chunks: this.totalChunks
    }));
  }

  /**
   * Join a transfer session as receiver
   */
  async joinReceive(connectionInfo: string): Promise<void> {
    const info = JSON.parse(atob(connectionInfo));

    this.session = {
      id: info.sessionId,
      role: 'receiver',
      state: 'connecting',
      startTime: Date.now()
    };

    this.totalChunks = info.chunks;

    // Create peer connection
    await this.createPeerConnection();

    // Set remote description
    await this.connection!.setRemoteDescription(info.offer);

    // Create answer
    const answer = await this.connection!.createAnswer();
    await this.connection!.setLocalDescription(answer);

    // Return answer for sender to complete connection
    return btoa(JSON.stringify({ answer }));
  }

  /**
   * Complete connection as sender
   */
  async completeConnection(answerInfo: string): Promise<void> {
    if (!this.connection || this.session?.role !== 'sender') {
      throw new Error('Invalid session state');
    }

    const { answer } = JSON.parse(atob(answerInfo));
    await this.connection.setRemoteDescription(answer);
  }

  /**
   * Send data through established connection
   */
  private async sendData(): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    this.session!.state = 'transferring';
    this.startTime = Date.now();

    for (const [index, chunk] of this.pendingChunks) {
      // Send chunk with metadata
      const metadata = new Uint8Array(8);
      const view = new DataView(metadata.buffer);
      view.setUint32(0, index);
      view.setUint32(4, chunk.byteLength);

      const packet = new Uint8Array(metadata.byteLength + chunk.byteLength);
      packet.set(metadata);
      packet.set(chunk, metadata.byteLength);

      // Send with flow control
      while (this.dataChannel.bufferedAmount > 65536) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.dataChannel.send(packet);
      this.bytesTransferred += chunk.byteLength;

      // Report progress
      this.reportProgress();
    }

    // Send completion marker
    this.dataChannel.send(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]));
    this.session!.state = 'complete';
    this.session!.endTime = Date.now();
  }

  /**
   * Handle received data chunks
   */
  private async handleReceivedData(event: MessageEvent): Promise<void> {
    const data = new Uint8Array(event.data);

    // Check for completion marker
    if (data.length === 4 && data[0] === 0xFF && data[1] === 0xFF) {
      await this.assembleReceivedData();
      return;
    }

    // Extract metadata
    const view = new DataView(data.buffer);
    const index = view.getUint32(0);
    const length = view.getUint32(4);

    // Extract chunk
    const chunk = data.slice(8, 8 + length);
    this.receivedChunks.set(index, chunk);
    this.bytesTransferred += length;

    // Report progress
    this.reportProgress();
  }

  /**
   * Assemble received chunks into complete data
   */
  private async assembleReceivedData(): Promise<any> {
    // Combine chunks in order
    const totalSize = Array.from(this.receivedChunks.values())
      .reduce((sum, chunk) => sum + chunk.byteLength, 0);

    const combined = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.receivedChunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk ${i}`);
      }
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Decrypt data
    const decrypted = await this.crypto.decryptTransfer(combined);

    // Deserialize
    const text = new TextDecoder().decode(decrypted);
    const data = JSON.parse(text);

    this.session!.state = 'complete';
    this.session!.endTime = Date.now();

    return data;
  }

  /**
   * Create WebRTC peer connection
   */
  private async createPeerConnection(): Promise<void> {
    this.connection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });

    // Handle ICE candidates
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        // In production, would exchange candidates
        console.log('ICE candidate:', event.candidate);
      }
    };

    // Create or handle data channel
    if (this.session?.role === 'sender') {
      this.dataChannel = this.connection.createDataChannel('transfer', {
        ordered: true,
        maxRetransmits: 3
      });
      this.setupDataChannel();
    } else {
      this.connection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }

    // Handle connection state
    this.connection.onconnectionstatechange = () => {
      console.log('Connection state:', this.connection?.connectionState);
      if (this.connection?.connectionState === 'connected') {
        this.session!.state = 'connecting';
      } else if (this.connection?.connectionState === 'failed') {
        this.session!.state = 'failed';
        this.session!.error = 'Connection failed';
      }
    };
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      if (this.session?.role === 'sender') {
        this.sendData().catch(err => {
          console.error('Send failed:', err);
          this.session!.state = 'failed';
          this.session!.error = err.message;
        });
      }
    };

    this.dataChannel.onmessage = (event) => {
      if (this.session?.role === 'receiver') {
        this.handleReceivedData(event).catch(err => {
          console.error('Receive failed:', err);
          this.session!.state = 'failed';
          this.session!.error = err.message;
        });
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.session!.state = 'failed';
      this.session!.error = 'Data channel error';
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
    };
  }

  /**
   * Prepare data chunks for sending
   */
  private prepareChunks(data: Uint8Array): void {
    this.totalChunks = Math.ceil(data.byteLength / this.chunkSize);

    for (let i = 0; i < this.totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, data.byteLength);
      this.pendingChunks.set(i, data.slice(start, end));
    }
  }

  /**
   * Report transfer progress
   */
  private reportProgress(): void {
    if (!this.progressCallback) return;

    const totalBytes = this.session?.role === 'sender'
      ? Array.from(this.pendingChunks.values()).reduce((sum, chunk) => sum + chunk.byteLength, 0)
      : this.totalChunks * this.chunkSize; // Estimate for receiver

    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.bytesTransferred / elapsed : 0;
    const remaining = speed > 0 ? (totalBytes - this.bytesTransferred) / speed : 0;

    this.progressCallback({
      bytesTransferred: this.bytesTransferred,
      totalBytes,
      percentage: (this.bytesTransferred / totalBytes) * 100,
      speed,
      remainingTime: remaining
    });
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: TransferProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cancel active transfer
   */
  cancel(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.session) {
      this.session.state = 'failed';
      this.session.error = 'Cancelled by user';
      this.session.endTime = Date.now();
    }

    this.pendingChunks.clear();
    this.receivedChunks.clear();
  }

  /**
   * Get current session info
   */
  getSession(): TransferSession | null {
    return this.session;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.cancel();
    this.session = null;
    this.progressCallback = undefined;
  }
}