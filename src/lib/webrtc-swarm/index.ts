/**
 * WebRTC Swarm Library
 * High-speed peer-to-peer transfers with automatic fallback
 */

export { WebRTCSwarm } from './WebRTCSwarm.js';
export { PeerManager } from './PeerManager.js';
export { SignalingClient } from './SignalingClient.js';

// Integrate with existing WebRTC transport
export { WebRTCTransport } from '../webrtc-transport/index.js';

// Data Models
export type { WebRTCPeer } from './models/WebRTCPeer.js';
export type { SwarmConnection } from './models/SwarmConnection.js';
export type { PeerCapabilities } from './models/PeerCapabilities.js';

/**
 * WebRTC Swarm Configuration
 */
export interface WebRTCSwarmConfig {
  maxPeers: number;
  signalingServer: string;
  stunServers: string[];
  turnServers: string[];
  connectionTimeout: number;
  transferChunkSize: number;
  enableNATTraversal: boolean;
}

export const DEFAULT_WEBRTC_CONFIG: WebRTCSwarmConfig = {
  maxPeers: 10,
  signalingServer: 'ws://localhost:8080',
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302'
  ],
  turnServers: [], // No TURN servers by default
  connectionTimeout: 30000, // 30 seconds
  transferChunkSize: 65536, // 64KB for WebRTC
  enableNATTraversal: true
};