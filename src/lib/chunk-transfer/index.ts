/**
 * Chunk Transfer Library
 * Handles BitTorrent-style chunk transmission over radio and WebRTC
 */

export { ChunkTransfer } from './ChunkTransfer.js';
export { TransferManager } from './TransferManager.js';

// Data Models
export type { TransferRequest } from './models/TransferRequest.js';
export type { TransferProgress } from './models/TransferProgress.js';
export type { TransferStats } from './models/TransferStats.js';

/**
 * Chunk Transfer Configuration
 */
export interface ChunkTransferConfig {
  chunkSize: number; // bytes
  maxConcurrent: number;
  retryAttempts: number;
  timeoutMs: number;
  compressionLevel: number;
  useWebRTC: boolean;
  useRF: boolean;
}

export const DEFAULT_TRANSFER_CONFIG: ChunkTransferConfig = {
  chunkSize: 16384, // 16KB chunks
  maxConcurrent: 8,
  retryAttempts: 3,
  timeoutMs: 30000, // 30 seconds
  compressionLevel: 6, // Balanced compression
  useWebRTC: true,
  useRF: true
};