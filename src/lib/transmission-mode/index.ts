/**
 * Transmission Mode Library Entry Point
 *
 * Exports all transmission mode related functionality
 */

export {
  TransmissionModeManager,
  TransmissionMode,
  type TransmissionModeConfig,
  type ModeCapabilities,
  type ConnectionStatus
} from './TransmissionModeManager.js';

// Re-export related types and interfaces for convenience
export type {
  WebRTCPeerInfo,
  ContentRequest,
  ChunkRequest,
  ContentMetadata
} from '../webrtc-transport/WebRTCSwarm.js';

export type {
  ContentChunk,
  ChunkAvailability,
  PeerStation,
  TransferSession,
  CQBeacon
} from '../mesh-dl-protocol/MeshDLProtocol.js';