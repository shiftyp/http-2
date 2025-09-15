/**
 * WebRTC Transport Library Entry Point
 *
 * Exports all WebRTC transport functionality for ham radio networks
 */

export {
  WebRTCSwarm,
  type WebRTCPeerInfo,
  type ContentRequest,
  type ChunkRequest,
  type ContentMetadata
} from './WebRTCSwarm.js';

// Additional WebRTC transport components would be exported here
// as they are implemented (SignalingClient, LocalDiscovery, etc.)