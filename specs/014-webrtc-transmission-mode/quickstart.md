# WebRTC Transmission Mode Quickstart Guide

Get started with hybrid WebRTC/RF transmission modes for ham radio networks in 5 minutes.

## Overview

The WebRTC Transmission Mode enables ham radio stations to switch between:

- **WebRTC Mode**: High-speed peer-to-peer (1MB/s local, internet via signaling server)
- **RF Mode**: BitTorrent-style chunks over radio (14.4kbps max, CQ beacon routing)
- **Hybrid Mode**: Automatic switching between protocols for optimal performance

## Prerequisites

- Node.js 18+ installed
- Ham radio callsign
- Network connectivity for WebRTC mode
- Amateur radio transceiver for RF mode

## Quick Setup

### 1. Start the System

```bash
# Terminal 1: Start main application
npm run dev:https

# Terminal 2: Start signaling server
cd signaling-server
npm start
```

### 2. Initialize Transmission Mode

```javascript
import {
  TransmissionModeManager,
  TransmissionMode,
  WebRTCSwarm,
  MeshDLProtocol
} from './src/lib/transmission-mode/index.js';

// Configure hybrid mode
const modeManager = new TransmissionModeManager({
  mode: TransmissionMode.HYBRID,
  autoFallback: true,
  webrtcEnabled: true,
  rfEnabled: true,
  fallbackTimeoutMs: 10000,
  signalingServerUrl: 'ws://localhost:8080'
});

// Initialize WebRTC swarm
const webrtcSwarm = new WebRTCSwarm(modeManager);

// Initialize BitTorrent protocol
const meshDL = new MeshDLProtocol(modeManager, webrtcSwarm);
```

### 3. Connect to Network

```javascript
// WebRTC: Connect to signaling server
await webrtcSwarm.connectToSignalingServer(
  'ws://localhost:8080',
  'KA1ABC' // Your callsign
);

// RF: Initialize radio interface
// (Radio control integration - see existing radio-control library)
```

### 4. Switch Transmission Modes

```javascript
// Switch to WebRTC for high-speed transfer
await modeManager.switchToMode(TransmissionMode.WebRTC);

// Switch to RF for radio transmission
await modeManager.switchToMode(TransmissionMode.RF);

// Enable hybrid mode with automatic switching
await modeManager.switchToMode(TransmissionMode.HYBRID);
```

## Usage Examples

### Download Content (Mode-Adaptive)

```javascript
// System automatically selects optimal protocol
const contentHash = 'abc123def456';
const content = await meshDL.downloadContent(contentHash);
console.log('Downloaded:', new TextDecoder().decode(content));
```

### Manual Mode Selection

```javascript
// Force WebRTC for large files
const largeContent = await meshDL.downloadContent(
  contentHash,
  TransmissionMode.WebRTC
);

// Force RF for emergency communications
const emergencyContent = await meshDL.downloadContent(
  contentHash,
  TransmissionMode.RF
);
```

### Monitor Connection Status

```javascript
modeManager.onModeChange((status) => {
  console.log('Mode:', status.mode);
  console.log('WebRTC Peers:', status.webrtcPeers);
  console.log('RF Peers:', status.rfPeers);
  console.log('Bandwidth:', status.capabilities.maxBandwidth);
});
```

## React UI Integration

### Add Transmission Mode Toggle

```jsx
import { TransmissionModeToggle } from './src/components/TransmissionModeToggle.tsx';

function Dashboard() {
  return (
    <div>
      <h1>Ham Radio Station Dashboard</h1>
      <TransmissionModeToggle
        modeManager={modeManager}
        onModeChange={(mode) => console.log('Switched to:', mode)}
      />
    </div>
  );
}
```

### Visual Mode Indicators

The toggle component provides:
- 📻 RF Mode (14.4kbps, high latency)
- 🌐 WebRTC Mode (1MB/s, low latency)
- ⚡ Hybrid Mode (automatic switching)

## Testing the Setup

### 1. Test WebRTC Connection

```bash
# Check signaling server
curl http://localhost:8080/health

# Should return: {"status":"ok","networks":0,"stations":0,"uptime":...}
```

### 2. Test Mode Switching

```bash
# Run integration tests
npm test src/test/integration/hybrid-mode-switching.test.ts

# Run contract tests
npm test src/test/contract/transmission-mode-integration.contract.test.ts
```

### 3. Test Peer Discovery

```javascript
// Local network discovery (WebRTC)
const localPeers = await webrtcSwarm.discoverLocalPeers();
console.log('Local peers:', localPeers);

// RF mesh discovery (BitTorrent)
const availability = await meshDL.discoverChunkAvailability(contentHash);
console.log('RF peers:', availability);
```

## Common Scenarios

### Scenario 1: Emergency Net Setup

```javascript
// Start in RF mode for reliability
await modeManager.switchToMode(TransmissionMode.RF);

// Prioritize emergency traffic
await meshDL.downloadContent(emergencyBulletinHash, TransmissionMode.RF);
```

### Scenario 2: High-Speed Content Sync

```javascript
// Switch to WebRTC for bulk transfers
await modeManager.switchToMode(TransmissionMode.WebRTC);

// Download large files directly
const largeFile = await webrtcSwarm.downloadContent(largeFileHash);
```

### Scenario 3: Hybrid Operations

```javascript
// Let system automatically choose optimal protocol
await modeManager.switchToMode(TransmissionMode.HYBRID);

// System will use WebRTC when available, fall back to RF
const adaptiveContent = await meshDL.downloadContent(contentHash);
```

## Configuration Options

### Transmission Mode Manager

```javascript
const config = {
  mode: TransmissionMode.HYBRID,     // Initial mode
  autoFallback: true,                // Enable automatic fallback
  webrtcEnabled: true,               // Enable WebRTC mode
  rfEnabled: true,                   // Enable RF mode
  fallbackTimeoutMs: 10000,          // Fallback timeout (10s)
  signalingServerUrl: 'ws://localhost:8080' // Signaling server
};
```

### Performance Characteristics

| Mode | Max Bandwidth | Latency | Range | Reliability |
|------|---------------|---------|-------|-------------|
| WebRTC | 1MB/s | 50ms | Local/Internet | 90% |
| RF | 14.4kbps | 2000ms | Radio range | 70% |
| Hybrid | 1MB/s | 50ms | Best of both | 95% |

## Troubleshooting

### WebRTC Connection Issues

```bash
# Check signaling server logs
cd signaling-server
npm start

# Verify WebSocket connection
curl --include --no-buffer --header "Connection: Upgrade" --header "Upgrade: websocket" --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" --header "Sec-WebSocket-Version: 13" http://localhost:8080/
```

### RF Mode Issues

```javascript
// Check RF peer discovery
const availability = await meshDL.discoverChunkAvailability('test');
console.log('RF peers found:', availability.length);

// Test CQ beacon functionality
await meshDL.announceContentAvailability('test-hash', [0, 1, 2]);
```

### Mode Switching Issues

```javascript
// Check mode capabilities
const status = modeManager.getConnectionStatus();
console.log('Current capabilities:', status.capabilities);

// Test manual switching
try {
  await modeManager.switchToMode(TransmissionMode.WebRTC);
} catch (error) {
  console.error('Mode switch failed:', error.message);
}
```

## Next Steps

1. **Integrate with Existing Radio Control**: Connect to your radio hardware
2. **Configure Multiple Networks**: Set up emergency nets and regular operations
3. **Deploy Signaling Server**: Host on internet server for wider coverage
4. **Add Custom Content Types**: Extend for specific amateur radio applications
5. **Implement FCC Compliance**: Add station identification and logging

## Related Documentation

- [BitTorrent Protocol Spec](../013-bit-torrent-protocol/spec.md)
- [WebRTC Transmission Mode Spec](./spec.md)
- [Signaling Server Documentation](../../signaling-server/README.md)
- [Main Project Documentation](../../CLAUDE.md)

## Support

For questions and issues:
- Run tests: `npm test src/test/integration/hybrid-mode-switching.test.ts`
- Check logs: Monitor signaling server and application console output
- Verify setup: Use health check endpoints and connection status monitoring