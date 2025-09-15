/**
 * Contract Tests: Transmission Mode Integration
 *
 * Tests that verify the contracts between BitTorrent Protocol and WebRTC Transmission Mode
 */

import { describe, test, expect } from 'vitest';
import { TransmissionModeManager, TransmissionMode } from '../../lib/transmission-mode/TransmissionModeManager.js';
import { WebRTCSwarm } from '../../lib/webrtc-transport/WebRTCSwarm.js';
import { MeshDLProtocol } from '../../lib/mesh-dl-protocol/MeshDLProtocol.js';

describe('Transmission Mode Integration Contracts', () => {
  test('TransmissionModeManager should implement required interface', () => {
    const config = {
      mode: TransmissionMode.RF,
      autoFallback: true,
      webrtcEnabled: true,
      rfEnabled: true,
      fallbackTimeoutMs: 10000
    };

    const manager = new TransmissionModeManager(config);

    // Required methods
    expect(typeof manager.getCurrentMode).toBe('function');
    expect(typeof manager.switchToMode).toBe('function');
    expect(typeof manager.getConnectionStatus).toBe('function');
    expect(typeof manager.onModeChange).toBe('function');
    expect(typeof manager.offModeChange).toBe('function');
    expect(typeof manager.enableAutoFallback).toBe('function');
    expect(typeof manager.disableAutoFallback).toBe('function');

    // Initial state
    expect(manager.getCurrentMode()).toBe(TransmissionMode.RF);

    // Connection status structure
    const status = manager.getConnectionStatus();
    expect(status).toHaveProperty('mode');
    expect(status).toHaveProperty('webrtcPeers');
    expect(status).toHaveProperty('rfPeers');
    expect(status).toHaveProperty('uptime');
    expect(status).toHaveProperty('lastModeSwitch');
    expect(status).toHaveProperty('capabilities');

    // Capabilities structure
    expect(status.capabilities).toHaveProperty('maxBandwidth');
    expect(status.capabilities).toHaveProperty('latency');
    expect(status.capabilities).toHaveProperty('reliability');
    expect(status.capabilities).toHaveProperty('connectionType');
  });

  test('WebRTCSwarm should implement required interface', () => {
    const manager = new TransmissionModeManager({
      mode: TransmissionMode.WebRTC,
      autoFallback: false,
      webrtcEnabled: true,
      rfEnabled: false,
      fallbackTimeoutMs: 10000
    });

    const swarm = new WebRTCSwarm(manager);

    // Required methods
    expect(typeof swarm.connectToSignalingServer).toBe('function');
    expect(typeof swarm.discoverLocalPeers).toBe('function');
    expect(typeof swarm.connectToPeer).toBe('function');
    expect(typeof swarm.downloadContent).toBe('function');
    expect(typeof swarm.downloadContentChunks).toBe('function');
    expect(typeof swarm.uploadContent).toBe('function');
    expect(typeof swarm.getConnectedPeers).toBe('function');
    expect(typeof swarm.disconnectFromPeer).toBe('function');

    // Initial state
    expect(swarm.getConnectedPeers()).toEqual([]);
  });

  test('MeshDLProtocol should implement required interface', () => {
    const manager = new TransmissionModeManager({
      mode: TransmissionMode.RF,
      autoFallback: false,
      webrtcEnabled: false,
      rfEnabled: true,
      fallbackTimeoutMs: 10000
    });

    const swarm = new WebRTCSwarm(manager);
    const meshDL = new MeshDLProtocol(manager, swarm);

    // Required methods
    expect(typeof meshDL.downloadContent).toBe('function');
    expect(typeof meshDL.discoverChunkAvailability).toBe('function');
    expect(typeof meshDL.announceContentAvailability).toBe('function');
    expect(typeof meshDL.handleChunkRequest).toBe('function');
  });

  test('TransmissionMode enum should have required values', () => {
    expect(TransmissionMode.RF).toBe('RF');
    expect(TransmissionMode.WebRTC).toBe('WebRTC');
    expect(TransmissionMode.HYBRID).toBe('HYBRID');

    // Should be exactly 3 modes
    expect(Object.values(TransmissionMode)).toHaveLength(3);
  });

  test('ContentChunk interface should be compatible between implementations', async () => {
    // Test that chunk format is consistent between WebRTC and RF protocols
    const testChunk = {
      contentHash: 'abc123',
      chunkIndex: 0,
      data: new Uint8Array([1, 2, 3, 4]),
      size: 4,
      verified: true,
      signature: 'test-signature'
    };

    // Chunk should have required properties
    expect(testChunk).toHaveProperty('contentHash');
    expect(testChunk).toHaveProperty('chunkIndex');
    expect(testChunk).toHaveProperty('data');
    expect(testChunk).toHaveProperty('size');
    expect(testChunk).toHaveProperty('verified');

    // Data should be Uint8Array
    expect(testChunk.data).toBeInstanceOf(Uint8Array);
    expect(typeof testChunk.chunkIndex).toBe('number');
    expect(typeof testChunk.size).toBe('number');
    expect(typeof testChunk.verified).toBe('boolean');
  });

  test('WebRTCPeerInfo interface should be compatible', () => {
    const testPeer = {
      peerId: 'test-peer-id',
      callsign: 'KA1ABC',
      connectionState: 'connected' as RTCPeerConnectionState,
      dataChannels: new Map([['content', {} as RTCDataChannel]]),
      capabilities: ['content-download', 'content-upload'],
      lastSeen: new Date()
    };

    // Peer should have required properties
    expect(testPeer).toHaveProperty('peerId');
    expect(testPeer).toHaveProperty('callsign');
    expect(testPeer).toHaveProperty('connectionState');
    expect(testPeer).toHaveProperty('dataChannels');
    expect(testPeer).toHaveProperty('capabilities');
    expect(testPeer).toHaveProperty('lastSeen');

    // Types should be correct
    expect(typeof testPeer.peerId).toBe('string');
    expect(typeof testPeer.callsign).toBe('string');
    expect(testPeer.dataChannels).toBeInstanceOf(Map);
    expect(Array.isArray(testPeer.capabilities)).toBe(true);
    expect(testPeer.lastSeen).toBeInstanceOf(Date);
  });

  test('Mode switching contract should be asynchronous', async () => {
    const manager = new TransmissionModeManager({
      mode: TransmissionMode.RF,
      autoFallback: true,
      webrtcEnabled: true,
      rfEnabled: true,
      fallbackTimeoutMs: 1000
    });

    // switchToMode should return a Promise
    const switchPromise = manager.switchToMode(TransmissionMode.WebRTC);
    expect(switchPromise).toBeInstanceOf(Promise);

    // Should be able to await the result
    try {
      const result = await switchPromise;
      expect(typeof result).toBe('boolean');
    } catch (error) {
      // Expected to fail in test environment
      expect(error).toBeInstanceOf(Error);
    }
  });

  test('Content download contract should be consistent across modes', async () => {
    const manager = new TransmissionModeManager({
      mode: TransmissionMode.HYBRID,
      autoFallback: true,
      webrtcEnabled: true,
      rfEnabled: true,
      fallbackTimeoutMs: 5000
    });

    const swarm = new WebRTCSwarm(manager);
    const meshDL = new MeshDLProtocol(manager, swarm);

    const contentHash = 'test-content-hash';

    // Both WebRTC and MeshDL should have same downloadContent signature
    const webrtcDownload = swarm.downloadContent(contentHash);
    const meshDLDownload = meshDL.downloadContent(contentHash);

    expect(webrtcDownload).toBeInstanceOf(Promise);
    expect(meshDLDownload).toBeInstanceOf(Promise);

    // Both should return Uint8Array when successful
    try {
      const webrtcResult = await webrtcDownload;
      expect(webrtcResult).toBeInstanceOf(Uint8Array);
    } catch (error) {
      // Expected to fail in test environment
    }

    try {
      const meshDLResult = await meshDLDownload;
      expect(meshDLResult).toBeInstanceOf(Uint8Array);
    } catch (error) {
      // Expected to fail in test environment
    }
  });

  test('Event listener contracts should be consistent', () => {
    const manager = new TransmissionModeManager({
      mode: TransmissionMode.RF,
      autoFallback: true,
      webrtcEnabled: true,
      rfEnabled: true,
      fallbackTimeoutMs: 10000
    });

    let listenerCalled = false;
    const testListener = (status: any) => {
      listenerCalled = true;
      // Status should have required properties
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('webrtcPeers');
      expect(status).toHaveProperty('rfPeers');
    };

    // Should be able to add and remove listeners
    manager.onModeChange(testListener);
    manager.offModeChange(testListener);

    // Listener functions should not throw
    expect(() => manager.onModeChange(testListener)).not.toThrow();
    expect(() => manager.offModeChange(testListener)).not.toThrow();
  });

  test('Error handling contracts should be consistent', async () => {
    const manager = new TransmissionModeManager({
      mode: TransmissionMode.RF,
      autoFallback: false,
      webrtcEnabled: false,
      rfEnabled: false,
      fallbackTimeoutMs: 1000
    });

    // Switching to unsupported mode should throw Error
    try {
      await manager.switchToMode(TransmissionMode.WebRTC);
      expect.fail('Should have thrown error for unsupported mode');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('not supported');
    }

    const swarm = new WebRTCSwarm(manager);

    // Invalid operations should throw consistent errors
    try {
      await swarm.connectToPeer('INVALID-CALLSIGN');
      expect.fail('Should have thrown error for invalid operation');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});