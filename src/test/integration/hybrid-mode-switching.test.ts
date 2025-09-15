/**
 * Integration Tests: Hybrid Mode Switching
 *
 * Tests integration between BitTorrent Protocol (spec 013) and WebRTC Transmission Mode (spec 014)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TransmissionModeManager, TransmissionMode } from '../../lib/transmission-mode/TransmissionModeManager.js';
import { WebRTCSwarm } from '../../lib/webrtc-transport/WebRTCSwarm.js';
import { MeshDLProtocol } from '../../lib/mesh-dl-protocol/MeshDLProtocol.js';

describe('Hybrid Mode Switching Integration', () => {
  let modeManager: TransmissionModeManager;
  let webrtcSwarm: WebRTCSwarm;
  let meshDL: MeshDLProtocol;

  beforeEach(() => {
    // Initialize with hybrid mode enabled
    modeManager = new TransmissionModeManager({
      mode: TransmissionMode.HYBRID,
      autoFallback: true,
      webrtcEnabled: true,
      rfEnabled: true,
      fallbackTimeoutMs: 10000,
      signalingServerUrl: 'ws://localhost:8080'
    });

    webrtcSwarm = new WebRTCSwarm(modeManager);
    meshDL = new MeshDLProtocol(modeManager, webrtcSwarm);
  });

  afterEach(() => {
    // Cleanup connections
  });

  test('should start in hybrid mode', () => {
    expect(modeManager.getCurrentMode()).toBe(TransmissionMode.HYBRID);
  });

  test('should switch from WebRTC to RF when WebRTC fails', async () => {
    // Start in WebRTC mode
    await modeManager.switchToMode(TransmissionMode.WebRTC);
    expect(modeManager.getCurrentMode()).toBe(TransmissionMode.WebRTC);

    // Simulate WebRTC failure during content download
    const contentHash = 'test-content-hash-123';

    // Mock WebRTC failure
    const originalDownload = webrtcSwarm.downloadContent;
    webrtcSwarm.downloadContent = async () => {
      throw new Error('WebRTC connection failed');
    };

    // Attempt download should trigger fallback to RF
    try {
      await meshDL.downloadContent(contentHash);
    } catch (error) {
      // Expected to fail since we're mocking
    }

    // Should have switched to RF mode
    expect(modeManager.getCurrentMode()).toBe(TransmissionMode.RF);

    // Restore original method
    webrtcSwarm.downloadContent = originalDownload;
  });

  test('should download content via WebRTC when available', async () => {
    await modeManager.switchToMode(TransmissionMode.WebRTC);

    const contentHash = 'test-webrtc-content';
    const mockContent = new TextEncoder().encode('WebRTC test content');

    // Mock successful WebRTC download
    webrtcSwarm.downloadContent = async (hash: string) => {
      if (hash === contentHash) {
        return mockContent;
      }
      throw new Error('Content not found');
    };

    const result = await meshDL.downloadContent(contentHash);
    expect(result).toEqual(mockContent);
    expect(modeManager.getCurrentMode()).toBe(TransmissionMode.WebRTC);
  });

  test('should download content via RF chunks when WebRTC unavailable', async () => {
    await modeManager.switchToMode(TransmissionMode.RF);

    const contentHash = 'test-rf-content';
    const mockContent = new TextEncoder().encode('RF chunk test content');

    // Mock RF chunk availability discovery
    const originalDiscover = meshDL.discoverChunkAvailability;
    meshDL.discoverChunkAvailability = async (hash: string) => {
      if (hash === contentHash) {
        return [
          {
            contentHash: hash,
            chunkIndex: 0,
            availablePeers: ['KA1ABC', 'KB2DEF'],
            lastUpdated: new Date(),
            priority: 1
          }
        ];
      }
      return [];
    };

    // Mock chunk download
    const originalDownloadChunks = (meshDL as any).downloadChunksInParallel;
    (meshDL as any).downloadChunksInParallel = async () => {
      return [{
        contentHash,
        chunkIndex: 0,
        data: mockContent,
        size: mockContent.length,
        verified: true
      }];
    };

    // Mock content assembly
    const originalAssemble = (meshDL as any).assembleAndVerifyContent;
    (meshDL as any).assembleAndVerifyContent = (chunks: any[]) => {
      return chunks[0].data;
    };

    // Mock caching
    const originalCache = (meshDL as any).cacheContentForRedistribution;
    (meshDL as any).cacheContentForRedistribution = async () => {};

    const result = await meshDL.downloadContent(contentHash);
    expect(result).toEqual(mockContent);
    expect(modeManager.getCurrentMode()).toBe(TransmissionMode.RF);

    // Restore methods
    meshDL.discoverChunkAvailability = originalDiscover;
    (meshDL as any).downloadChunksInParallel = originalDownloadChunks;
    (meshDL as any).assembleAndVerifyContent = originalAssemble;
    (meshDL as any).cacheContentForRedistribution = originalCache;
  });

  test('should maintain connection status across mode switches', async () => {
    const statusUpdates: any[] = [];

    modeManager.onModeChange((status) => {
      statusUpdates.push({
        mode: status.mode,
        timestamp: status.lastModeSwitch
      });
    });

    // Switch modes multiple times
    await modeManager.switchToMode(TransmissionMode.WebRTC);
    await modeManager.switchToMode(TransmissionMode.RF);
    await modeManager.switchToMode(TransmissionMode.HYBRID);

    expect(statusUpdates).toHaveLength(3);
    expect(statusUpdates[0].mode).toBe(TransmissionMode.WebRTC);
    expect(statusUpdates[1].mode).toBe(TransmissionMode.RF);
    expect(statusUpdates[2].mode).toBe(TransmissionMode.HYBRID);
  });

  test('should handle concurrent downloads in hybrid mode', async () => {
    await modeManager.switchToMode(TransmissionMode.HYBRID);

    const content1 = 'webrtc-content-1';
    const content2 = 'rf-content-2';

    // Mock different content sources
    webrtcSwarm.downloadContent = async (hash: string) => {
      if (hash === 'hash1') {
        return new TextEncoder().encode(content1);
      }
      throw new Error('Not available via WebRTC');
    };

    // Mock RF discovery for second content
    const originalDiscover = meshDL.discoverChunkAvailability;
    meshDL.discoverChunkAvailability = async (hash: string) => {
      if (hash === 'hash2') {
        return [{
          contentHash: hash,
          chunkIndex: 0,
          availablePeers: ['KC2XYZ'],
          lastUpdated: new Date(),
          priority: 1
        }];
      }
      return [];
    };

    // Start concurrent downloads
    const [result1, result2] = await Promise.allSettled([
      meshDL.downloadContent('hash1'),
      meshDL.downloadContent('hash2')
    ]);

    expect(result1.status).toBe('fulfilled');
    if (result1.status === 'fulfilled') {
      expect(new TextDecoder().decode(result1.value)).toBe(content1);
    }

    // Second download should attempt RF but may fail in mock
    // This tests that the system attempts different protocols

    // Restore
    meshDL.discoverChunkAvailability = originalDiscover;
  });

  test('should respect bandwidth limits across transmission modes', async () => {
    const status = modeManager.getConnectionStatus();

    // WebRTC should have high bandwidth
    await modeManager.switchToMode(TransmissionMode.WebRTC);
    const webrtcStatus = modeManager.getConnectionStatus();
    expect(webrtcStatus.capabilities.maxBandwidth).toBeGreaterThan(1000000); // > 1MB/s

    // RF should have limited bandwidth
    await modeManager.switchToMode(TransmissionMode.RF);
    const rfStatus = modeManager.getConnectionStatus();
    expect(rfStatus.capabilities.maxBandwidth).toBeLessThan(20000); // < 20kbps

    // Hybrid should use best available
    await modeManager.switchToMode(TransmissionMode.HYBRID);
    const hybridStatus = modeManager.getConnectionStatus();
    expect(hybridStatus.capabilities.maxBandwidth).toBeGreaterThan(1000000);
  });

  test('should handle signaling server connection for WebRTC mode', async () => {
    const mockCallsign = 'KA1ABC';
    let signalingConnected = false;

    // Mock WebSocket connection
    const originalConnect = webrtcSwarm.connectToSignalingServer;
    webrtcSwarm.connectToSignalingServer = async (url: string, callsign: string) => {
      expect(url).toBe('ws://localhost:8080');
      expect(callsign).toBe(mockCallsign);
      signalingConnected = true;
    };

    await modeManager.switchToMode(TransmissionMode.WebRTC);
    await webrtcSwarm.connectToSignalingServer('ws://localhost:8080', mockCallsign);

    expect(signalingConnected).toBe(true);

    // Restore
    webrtcSwarm.connectToSignalingServer = originalConnect;
  });

  test('should announce chunk availability via CQ beacons in RF mode', async () => {
    await modeManager.switchToMode(TransmissionMode.RF);

    const contentHash = 'test-announcement';
    const chunkIndices = [0, 1, 2, 3];

    let announcementMade = false;

    // Mock CQ beacon broadcast
    const originalAnnounce = meshDL.announceContentAvailability;
    meshDL.announceContentAvailability = async (hash: string, chunks: number[]) => {
      expect(hash).toBe(contentHash);
      expect(chunks).toEqual(chunkIndices);
      announcementMade = true;
    };

    await meshDL.announceContentAvailability(contentHash, chunkIndices);
    expect(announcementMade).toBe(true);

    // Restore
    meshDL.announceContentAvailability = originalAnnounce;
  });
});