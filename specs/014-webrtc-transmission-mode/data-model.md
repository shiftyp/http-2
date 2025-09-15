# Data Model: WebRTC Transmission Mode with Native WebSocket Signaling

## Core Entities

### TransmissionMode
Represents the current active transmission mode and state management.

**Fields:**
- `mode: 'RF' | 'WebRTC'` - Current active transmission mode
- `status: 'active' | 'switching' | 'failed' | 'fallback'` - Connection status
- `lastSwitchTime: Date` - When mode was last changed
- `performanceMetrics: PerformanceMetrics` - Current performance data
- `availableModes: string[]` - Available transmission modes based on connectivity
- `autoFallback: boolean` - Whether automatic fallback to RF is enabled
- `signalingServerUrl: string | null` - WebSocket signaling server URL for internet mode

**Validation Rules:**
- Mode must be one of the supported transmission modes
- Status transitions: active ↔ switching ↔ failed → fallback → active
- Performance metrics must be updated every 5 seconds when active
- Auto fallback must be enabled for emergency communications compliance
- Signaling server URL required for internet WebRTC connections

**State Transitions:**
```
RF(active) → switching → WebRTC(active)    # Local or internet WebRTC
WebRTC(active) → switching → RF(active)    # Manual switch back
WebRTC(active) → failed → fallback → RF(active)  # Automatic fallback
```

### WebRTCPeer
Represents a WebRTC peer-to-peer connection to another ham radio station.

**Fields:**
- `callsign: string` - Remote station callsign (required for FCC compliance)
- `peerId: string` - Unique peer identifier (UUID format)
- `rtcConnection: RTCPeerConnection` - WebRTC connection object (transient)
- `dataChannels: Map<string, RTCDataChannel>` - Active data channels by purpose
- `connectionState: RTCPeerConnectionState` - WebRTC connection state
- `iceConnectionState: RTCIceConnectionState` - ICE connection state
- `gatheringState: RTCIceGatheringState` - ICE candidate gathering state
- `localCandidates: RTCIceCandidate[]` - Local ICE candidates
- `remoteCandidates: RTCIceCandidate[]` - Remote ICE candidates
- `certificateFingerprint: string` - Station certificate fingerprint for verification
- `connectedAt: Date` - When peer connection was established
- `lastActivity: Date` - Last communication timestamp
- `bandwidth: BandwidthMetrics` - Connection bandwidth statistics
- `isLocalNetwork: boolean` - Whether connection is on same local network

**Validation Rules:**
- Callsign must match amateur radio format (e.g., KA1ABC, VK2XYZ)
- Peer ID must be globally unique (UUID format)
- Certificate verification required for all connections
- Connection timeout after 30 seconds of inactivity
- Maximum 10 concurrent peer connections per station

**Relationships:**
- Belongs to one SignalingConnection (for internet peers)
- Can have multiple data channels for HTTP, collaboration, mesh routing
- Links to station identification logging for FCC compliance

### SignalingConnection
WebSocket connection to signaling server for internet WebRTC establishment.

**Fields:**
- `serverUrl: string` - Signaling server WebSocket URL
- `websocket: WebSocket` - Native WebSocket connection (transient)
- `connectionState: 'connecting' | 'open' | 'closing' | 'closed'` - WebSocket state
- `callsign: string` - Local station callsign for room management
- `sessionId: string` - Unique session identifier
- `connectedAt: Date` - When WebSocket connection was established
- `lastPing: Date` - Last ping/pong timestamp
- `messageQueue: PendingMessage[]` - Queued messages during reconnection
- `availablePeers: Map<string, PeerInfo>` - Discovered peers from signaling server
- `activeOffers: Map<string, OfferInfo>` - Pending WebRTC offers/answers

**Validation Rules:**
- Server URL must be valid WebSocket URL (ws:// or wss://)
- Callsign required for room-based peer discovery
- Session ID must be unique per connection attempt
- Connection timeout after 60 seconds without response
- Message queue limited to 100 pending messages

**Relationships:**
- Can manage multiple WebRTCPeer connections
- Integrates with certificate verification system
- Links to NetworkDiscovery for peer information

### NetworkDiscovery
Information about discoverable stations on local network and via signaling server.

**Fields:**
- `discoveryId: string` - Unique discovery session identifier
- `localPeers: Map<string, LocalPeer>` - Peers discovered on local network
- `internetPeers: Map<string, InternetPeer>` - Peers discovered via signaling server
- `scanStartTime: Date` - When discovery scan started
- `lastLocalScan: Date` - Last local network scan completion
- `lastInternetSync: Date` - Last signaling server peer list sync
- `isScanning: boolean` - Whether actively scanning for local peers
- `signalingConnected: boolean` - Whether connected to signaling server
- `localNetworkInterface: NetworkInterface[]` - Available local network interfaces
- `mDnsResponses: Map<string, mDnsResponse>` - Local network mDNS responses

**Validation Rules:**
- Discovery ID must be unique per scan session
- Local scan timeout after 30 seconds maximum
- Internet peer list sync every 60 seconds when connected
- mDNS responses must be validated for ham radio stations
- Maximum 50 discovered peers per session

### LocalPeer
Station discovered on the same local network via mDNS/WebRTC discovery.

**Fields:**
- `callsign: string` - Station callsign
- `ipAddress: string` - Local network IP address
- `port: number` - WebRTC connection port
- `mDnsName: string` - Local network mDNS name (e.g., "abc123.local")
- `capabilities: string[]` - Supported features (WebRTC, PageBuilder, etc.)
- `signalStrength: number` - Local network signal strength estimate (0-100)
- `lastSeen: Date` - When peer was last discovered
- `certificateHash: string` - Station certificate hash for verification
- `protocolVersion: string` - HTTP-over-radio protocol version

**Validation Rules:**
- Callsign format validation required
- IP address must be valid local network range (RFC 1918)
- Port must be in valid range (1024-65535)
- Certificate verification required before connection
- Protocol version compatibility check

### InternetPeer
Station discovered via signaling server for internet WebRTC connections.

**Fields:**
- `callsign: string` - Station callsign
- `peerId: string` - Unique peer identifier from signaling server
- `capabilities: string[]` - Supported features reported by signaling server
- `lastSeen: Date` - When peer was last active on signaling server
- `certificateHash: string` - Station certificate hash for verification
- `protocolVersion: string` - HTTP-over-radio protocol version
- `geolocation: string` - General geographic location (optional)
- `connectionLatency: number` - Estimated connection latency (milliseconds)

**Validation Rules:**
- Callsign must be verified through signaling server
- Peer ID must be unique within signaling server scope
- Certificate verification required before WebRTC establishment
- Latency estimate updated during ICE gathering

### SyncSession
Real-time collaboration session for page building over WebRTC data channels.

**Fields:**
- `sessionId: string` - Unique collaboration session identifier
- `participants: Map<string, Participant>` - Active participants by callsign
- `documentId: string` - Document being collaboratively edited
- `crdtState: Uint8Array` - Current CRDT state (Y.js document)
- `lastModified: Date` - Last modification timestamp
- `conflictResolution: 'automatic' | 'manual'` - How conflicts are handled
- `bandwidth: BandwidthMetrics` - Session bandwidth usage across all peers
- `changeLog: ChangeLogEntry[]` - History of changes for rollback
- `dataChannelName: string` - WebRTC data channel used for sync

**Validation Rules:**
- Session ID must be UUID format
- Maximum 10 participants per session for performance
- Document ID must reference existing page/content
- CRDT state must be valid Y.js format
- Change log limited to last 100 entries for bandwidth efficiency

### Participant
Individual participant in a real-time collaboration session.

**Fields:**
- `callsign: string` - Station callsign
- `peerId: string` - Associated WebRTC peer connection ID
- `joinedAt: Date` - When participant joined session
- `lastActivity: Date` - Last activity timestamp
- `cursor: CursorPosition` - Current editing cursor position
- `permissions: Permission[]` - What actions participant can perform
- `connectionType: 'local' | 'internet'` - How participant is connected
- `clientInfo: ClientInfo` - Browser/application information

**Validation Rules:**
- Callsign must match connected WebRTC peer
- Activity timeout after 5 minutes of inactivity
- Cursor position must be valid within document bounds
- Permissions checked before each collaborative action

## Supporting Types

### PerformanceMetrics
- `throughput: number` - Current data throughput (bytes/second)
- `latency: number` - Round-trip latency (milliseconds)
- `packetLoss: number` - Packet loss percentage
- `jitter: number` - Jitter in milliseconds
- `measuredAt: Date` - When metrics were captured

### BandwidthMetrics
- `bytesTransmitted: number` - Total bytes sent
- `bytesReceived: number` - Total bytes received
- `currentRate: number` - Current transmission rate (bytes/second)
- `averageRate: number` - Average transmission rate
- `peakRate: number` - Peak transmission rate achieved

### PendingMessage
- `messageId: string` - Unique message identifier
- `type: 'offer' | 'answer' | 'candidate' | 'peer-list'` - Message type
- `target: string` - Target callsign
- `payload: any` - Message content
- `timestamp: Date` - When message was queued
- `retries: number` - Number of send attempts

### CursorPosition
- `documentOffset: number` - Character offset in document
- `selectionStart: number` - Selection start position
- `selectionEnd: number` - Selection end position
- `lastUpdated: Date` - When cursor was last moved

### ChangeLogEntry
- `timestamp: Date` - When change occurred
- `authorCallsign: string` - Who made the change
- `operation: string` - Type of operation (insert, delete, format)
- `position: number` - Document position of change
- `content: string` - Change content
- `crdtOperation: Uint8Array` - Y.js operation data

## Integration with Existing Models

### Station (existing)
Extended to include:
- `transmissionModes: TransmissionMode[]` - Available transmission modes
- `webRtcConfiguration: RTCConfiguration` - WebRTC ICE server configuration
- `signalingServerUrls: string[]` - Configured signaling servers

### MeshNode (existing)
Extended to include:
- `webRtcPeer: WebRTCPeer | null` - Associated WebRTC connection
- `dualModeRouting: boolean` - Whether node supports RF/WebRTC routing
- `preferredMode: 'RF' | 'WebRTC'` - Preferred transmission mode for routing

### QSOLog (existing)
Extended to include:
- `transmissionMode: 'RF' | 'WebRTC' | 'Hybrid'` - How contact was made
- `dataTransferred: number` - Amount of data exchanged
- `collaborationSession: string | null` - Associated sync session ID
- `connectionType: 'local' | 'internet'` - WebRTC connection type