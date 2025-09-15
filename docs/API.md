# Ham Radio HTTP API Documentation

## Transmission Mode APIs

### TransmissionModeManager

Central management for switching between WebRTC and RF transmission modes.

#### Methods

##### `getCurrentMode(): TransmissionMode`

Returns the current active transmission mode.

```javascript
const mode = modeManager.getCurrentMode();
// Returns: 'RF' | 'WebRTC' | 'HYBRID'
```

##### `switchToMode(mode: TransmissionMode): Promise<boolean>`

Switch to a specific transmission mode.

```javascript
// Switch to WebRTC for high-speed transfers
await modeManager.switchToMode(TransmissionMode.WebRTC);

// Switch to RF for radio transmission
await modeManager.switchToMode(TransmissionMode.RF);

// Enable hybrid mode with automatic switching
await modeManager.switchToMode(TransmissionMode.HYBRID);
```

**Parameters:**
- `mode: TransmissionMode` - Target mode ('RF', 'WebRTC', or 'HYBRID')

**Returns:** `Promise<boolean>` - Success status

**Throws:** `Error` if mode is not supported in current configuration

##### `getConnectionStatus(): ConnectionStatus`

Get current connection status and capabilities.

```javascript
const status = modeManager.getConnectionStatus();
console.log('Current mode:', status.mode);
console.log('WebRTC peers:', status.webrtcPeers);
console.log('RF peers:', status.rfPeers);
console.log('Max bandwidth:', status.capabilities.maxBandwidth);
```

**Returns:** `ConnectionStatus` object:
```typescript
interface ConnectionStatus {
  mode: TransmissionMode;
  webrtcPeers: number;
  rfPeers: number;
  uptime: number;
  lastModeSwitch: Date;
  capabilities: {
    maxBandwidth: number;  // bytes/second
    latency: number;       // milliseconds
    reliability: number;   // 0-1 scale
    connectionType: 'local' | 'internet' | 'rf';
  };
}
```

##### `onModeChange(listener: (status: ConnectionStatus) => void): void`

Subscribe to transmission mode change events.

```javascript
modeManager.onModeChange((status) => {
  console.log('Mode changed to:', status.mode);
  updateUI(status);
});
```

##### `offModeChange(listener: (status: ConnectionStatus) => void): void`

Unsubscribe from mode change events.

##### `enableAutoFallback(): void`

Enable automatic fallback from WebRTC to RF when connection fails.

##### `disableAutoFallback(): void`

Disable automatic fallback behavior.

#### Configuration

```typescript
interface TransmissionModeConfig {
  mode: TransmissionMode;           // Initial mode
  autoFallback: boolean;            // Enable automatic fallback
  webrtcEnabled: boolean;           // Enable WebRTC mode
  rfEnabled: boolean;               // Enable RF mode
  fallbackTimeoutMs: number;        // Timeout before fallback (ms)
  signalingServerUrl?: string;      // WebSocket signaling server URL
}
```

### WebRTCSwarm

WebRTC peer-to-peer connection management for high-speed content distribution.

#### Methods

##### `connectToSignalingServer(serverUrl: string, callsign: string): Promise<void>`

Connect to WebSocket signaling server for internet peer discovery.

```javascript
await webrtcSwarm.connectToSignalingServer(
  'ws://signaling.example.com:8080',
  'KA1ABC'
);
```

**Parameters:**
- `serverUrl: string` - WebSocket server URL
- `callsign: string` - Amateur radio callsign

##### `discoverLocalPeers(): Promise<WebRTCPeerInfo[]>`

Discover peers on local network using mDNS.

```javascript
const localPeers = await webrtcSwarm.discoverLocalPeers();
console.log('Found peers:', localPeers.map(p => p.callsign));
```

**Returns:** Array of `WebRTCPeerInfo` objects:
```typescript
interface WebRTCPeerInfo {
  peerId: string;
  callsign: string;
  connectionState: RTCPeerConnectionState;
  dataChannels: Map<string, RTCDataChannel>;
  capabilities: string[];
  lastSeen: Date;
}
```

##### `connectToPeer(callsign: string): Promise<WebRTCPeerInfo>`

Establish WebRTC connection to specific peer.

```javascript
const peer = await webrtcSwarm.connectToPeer('KB2DEF');
console.log('Connected to:', peer.callsign);
```

##### `downloadContent(contentHash: string): Promise<Uint8Array>`

Download content directly via WebRTC (no chunking).

```javascript
const content = await webrtcSwarm.downloadContent('abc123def456');
const text = new TextDecoder().decode(content);
```

##### `downloadContentChunks(contentHash: string): Promise<Uint8Array>`

Download content using BitTorrent-style chunks when WebRTC unavailable.

##### `uploadContent(content: Uint8Array, metadata: ContentMetadata): Promise<void>`

Make content available for other peers to download.

##### `getConnectedPeers(): WebRTCPeerInfo[]`

Get list of currently connected peers.

##### `disconnectFromPeer(callsign: string): Promise<void>`

Disconnect from specific peer.

### MeshDLProtocol

BitTorrent-style content distribution for ham radio mesh networks.

#### Methods

##### `downloadContent(contentHash: string, preferredMode?: TransmissionMode): Promise<Uint8Array>`

Download content using optimal protocol based on transmission mode.

```javascript
// Automatic mode selection
const content = await meshDL.downloadContent('abc123def456');

// Force specific mode
const emergencyContent = await meshDL.downloadContent(
  'emergency-bulletin-hash',
  TransmissionMode.RF
);
```

**Parameters:**
- `contentHash: string` - SHA-256 hash of content
- `preferredMode?: TransmissionMode` - Override automatic mode selection

**Returns:** `Promise<Uint8Array>` - Downloaded content

##### `discoverChunkAvailability(contentHash: string): Promise<ChunkAvailability[]>`

Discover which peers have chunks of specific content.

```javascript
const availability = await meshDL.discoverChunkAvailability(contentHash);
console.log('Available chunks:', availability.length);
```

**Returns:** Array of `ChunkAvailability` objects:
```typescript
interface ChunkAvailability {
  contentHash: string;
  chunkIndex: number;
  availablePeers: string[];  // Callsigns
  lastUpdated: Date;
  priority: number;
}
```

##### `announceContentAvailability(contentHash: string, chunkIndices: number[]): Promise<void>`

Announce chunk availability via CQ beacon.

```javascript
// Announce that we have chunks 0-7 of specific content
await meshDL.announceContentAvailability('content-hash', [0, 1, 2, 3, 4, 5, 6, 7]);
```

##### `handleChunkRequest(request: ChunkRequest, fromPeer: string): Promise<void>`

Process incoming chunk request from peer.

## Content Distribution Types

### ContentChunk

```typescript
interface ContentChunk {
  contentHash: string;     // SHA-256 of complete content
  chunkIndex: number;      // 0-based chunk index
  data: Uint8Array;        // Chunk data (typically 1KB)
  size: number;           // Actual chunk size
  verified: boolean;       // Integrity verification status
  signature?: string;      // Cryptographic signature
}
```

### ContentMetadata

```typescript
interface ContentMetadata {
  contentHash: string;     // SHA-256 hash
  totalSize: number;       // Total content size in bytes
  totalChunks: number;     // Number of chunks
  mimeType: string;        // Content MIME type
  filename: string;        // Original filename
  chunkSize: number;       // Size of each chunk (bytes)
}
```

### TransferSession

```typescript
interface TransferSession {
  sessionId: string;              // Unique session identifier
  contentHash: string;            // Content being transferred
  direction: 'upload' | 'download';
  completedChunks: Set<number>;   // Completed chunk indices
  totalChunks: number;            // Total chunks in content
  peers: string[];                // Participating peer callsigns
  status: 'active' | 'paused' | 'completed' | 'failed';
  mode: TransmissionMode;         // Transfer mode used
  startTime: Date;                // Session start time
  bandwidth: number;              // Current transfer rate (bytes/s)
}
```

## Error Handling

### Common Error Types

```typescript
// Mode not supported
try {
  await modeManager.switchToMode(TransmissionMode.WebRTC);
} catch (error) {
  if (error.message.includes('not supported')) {
    console.log('WebRTC mode not available');
  }
}

// Content not found
try {
  const content = await meshDL.downloadContent('nonexistent-hash');
} catch (error) {
  if (error.message.includes('No peers found')) {
    console.log('Content not available on network');
  }
}

// Connection failure
try {
  await webrtcSwarm.connectToSignalingServer(url, callsign);
} catch (error) {
  console.error('Signaling server connection failed:', error.message);
}
```

## Performance Characteristics

### Mode Comparison

| Feature | WebRTC Mode | RF Mode | Hybrid Mode |
|---------|-------------|---------|-------------|
| Max Bandwidth | 1MB/s | 14.4kbps | 1MB/s |
| Latency | 50ms | 2000ms | 50ms |
| Range | Local/Internet | Radio range | Best of both |
| Reliability | 90% | 70% | 95% |
| Setup Time | ~2s | ~5s | ~2s |

### Chunk Size Optimization

- **RF Mode**: 1KB chunks (optimized for 2.8kHz bandwidth)
- **WebRTC Mode**: Direct transfer (no chunking needed)
- **Hybrid Mode**: Adaptive based on connection quality

## Integration Examples

### React Component Integration

```jsx
import { TransmissionModeToggle } from '../components/TransmissionModeToggle';

function StationDashboard({ modeManager }) {
  return (
    <div>
      <TransmissionModeToggle
        modeManager={modeManager}
        onModeChange={(mode) => console.log('Mode:', mode)}
      />
    </div>
  );
}
```

### Real-time Status Monitoring

```javascript
// Monitor connection status
modeManager.onModeChange((status) => {
  updateStatusDisplay({
    mode: status.mode,
    peers: status.webrtcPeers + status.rfPeers,
    bandwidth: formatBandwidth(status.capabilities.maxBandwidth),
    latency: `${status.capabilities.latency}ms`
  });
});

// Monitor transfer progress
function monitorTransfer(sessionId) {
  const session = meshDL.getSession(sessionId);
  const progress = (session.completedChunks.size / session.totalChunks) * 100;

  updateProgressBar(progress);

  if (session.status === 'completed') {
    showSuccess('Transfer completed');
  }
}
```

### Emergency Communication Setup

```javascript
// Configure for emergency operations
const emergencyConfig = {
  mode: TransmissionMode.RF,        // Reliable radio-only mode
  autoFallback: false,              // No automatic switching
  webrtcEnabled: false,             // Disable internet dependency
  rfEnabled: true,                  // RF only
  fallbackTimeoutMs: 30000,         // Longer timeout for poor conditions
};

const emergencyManager = new TransmissionModeManager(emergencyConfig);

// Prioritize emergency content
await meshDL.downloadContent(
  emergencyBulletinHash,
  TransmissionMode.RF  // Force RF mode
);
```

## Testing APIs

### Mock Configurations

```javascript
// Test mode switching
const testConfig = {
  mode: TransmissionMode.HYBRID,
  autoFallback: true,
  webrtcEnabled: true,
  rfEnabled: true,
  fallbackTimeoutMs: 1000,  // Fast timeout for testing
  signalingServerUrl: 'ws://localhost:8080'
};

// Mock WebRTC connections for testing
webrtcSwarm.downloadContent = async (hash) => {
  if (hash === 'test-content') {
    return new TextEncoder().encode('Test content data');
  }
  throw new Error('Content not found');
};
```

### Performance Testing

```javascript
// Measure mode switching time
const startTime = performance.now();
await modeManager.switchToMode(TransmissionMode.WebRTC);
const switchTime = performance.now() - startTime;
console.log(`Mode switch took ${switchTime}ms`);

// Measure download performance
const downloadStart = performance.now();
const content = await meshDL.downloadContent(contentHash);
const downloadTime = performance.now() - downloadStart;
const bandwidth = (content.length / downloadTime) * 1000; // bytes/second
console.log(`Download bandwidth: ${bandwidth} bytes/s`);
```

## Signaling Server API

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "networks": 2,
  "stations": 5,
  "uptime": 3600.25
}
```

### Statistics

```bash
curl http://localhost:8080/stats
```

Response:
```json
{
  "networks": 2,
  "totalStations": 5,
  "uptime": 3600.25,
  "timestamp": "2025-09-15T18:00:00.000Z",
  "networkDetails": {
    "emergency-net": {
      "stations": 3,
      "stationList": ["KA1ABC", "KB2DEF", "KC3GHI"],
      "createdAt": "2025-09-15T17:30:00.000Z"
    },
    "default": {
      "stations": 2,
      "stationList": ["KD4JKL", "KE5MNO"],
      "createdAt": "2025-09-15T17:45:00.000Z"
    }
  }
}
```