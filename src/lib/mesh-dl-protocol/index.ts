/**
 * Mesh DL Protocol - Enhanced BitTorrent for Ham Radio
 * Spectrum-monitored content distribution with CQ beacon routing
 */

export { MeshDLProtocol } from './MeshDLProtocol.js';
export { ContentCache } from '../content-cache/ContentCache.js';
export { ChunkTransfer } from '../chunk-transfer/ChunkTransfer.js';
export { SpectrumMonitor } from '../spectrum-monitor/SpectrumMonitor.js';
export { WebRTCSwarm } from '../webrtc-swarm/WebRTCSwarm.js';
export { BandManager } from '../band-manager/BandManager.js';

// Data Models
export type { ContentChunk } from './models/ContentChunk.js';
export type { ContentMetadata } from './models/ContentMetadata.js';
export type { PeerStation } from './models/PeerStation.js';
export type { TransferSession } from './models/TransferSession.js';
export type { ChunkAvailability } from './models/ChunkAvailability.js';
export type { CQBeacon } from './models/CQBeacon.js';

/**
 * Enhanced BitTorrent Configuration
 */
export interface MeshDLConfig {
  maxPeers: number;
  chunkSize: number; // bytes
  concurrentChunks: number;
  spectrumMonitoring: boolean;
  webrtcEnabled: boolean;
  cqBeaconInterval: number; // seconds
  bandSwitchingEnabled: boolean;
  priorityTiers: number[];
}

export const DEFAULT_MESH_DL_CONFIG: MeshDLConfig = {
  maxPeers: 20,
  chunkSize: 16384, // 16KB chunks for radio efficiency
  concurrentChunks: 8,
  spectrumMonitoring: true,
  webrtcEnabled: true,
  cqBeaconInterval: 30, // 30 second CQ beacons
  bandSwitchingEnabled: true,
  priorityTiers: [0, 1, 2, 3, 4, 5] // P0-P5 emergency tiers
};