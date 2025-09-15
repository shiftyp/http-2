# Feature Specification: WebRTC Transmission Mode with Native WebSocket Signaling

**Feature Branch**: `014-webrtc-transmission-mode`
**Created**: 2025-09-15
**Status**: Draft
**Input**: User description: "webrtc transmission mode with native websocket signaling"

## User Scenarios & Testing

### Primary User Story
Ham radio operators need to switch their communication system from radio frequency transmission to local network and internet WebRTC for high-speed data transfer. This enables faster content sharing, real-time collaboration on page building, and bulk data synchronization while maintaining the same HTTP-over-radio protocol and user interface.

### Acceptance Scenarios
1. **Given** two ham radio stations are on the same local network, **When** a user selects "WebRTC transmission mode" from their station settings, **Then** the system automatically discovers and connects to nearby stations via WebRTC while maintaining the same URL structure (http://callsign.radio/path)

2. **Given** two ham radio stations are connected via internet, **When** they use WebRTC mode through a signaling server, **Then** data transfers occur at internet speeds (1MB/s target) instead of radio frequency speeds (14.4kbps max)

3. **Given** multiple stations are connected via WebRTC, **When** one station goes offline or network fails, **Then** the system automatically falls back to radio frequency transmission for remaining connections

4. **Given** users are working on page building with WebRTC connections, **When** they make changes to shared content, **Then** updates are synchronized in real-time between connected stations

5. **Given** stations are connected through a signaling server, **When** they establish WebRTC connection, **Then** the signaling server is no longer needed for data transfer (peer-to-peer operation)

### Edge Cases
- What happens when WebRTC connection fails during transmission?
- How does the system handle mixed-mode scenarios where some stations use RF and others use WebRTC?
- What occurs when signaling server becomes unavailable?
- How are authentication and station identification maintained across transmission modes?
- How does NAT traversal work for different network configurations?

## Requirements

### Functional Requirements
- **FR-001**: System MUST allow users to toggle between radio frequency and WebRTC transmission modes from the user interface
- **FR-002**: System MUST automatically discover other ham radio stations on the same local network when WebRTC mode is enabled
- **FR-003**: System MUST connect to internet-based stations through a native WebSocket signaling server
- **FR-004**: System MUST maintain the same HTTP protocol and URL structure (http://callsign.radio/path) regardless of transmission mode
- **FR-005**: System MUST provide real-time connection status indicators showing which stations are reachable via WebRTC vs radio frequency
- **FR-006**: System MUST automatically fallback to radio frequency transmission when WebRTC connections are unavailable or fail
- **FR-007**: System MUST synchronize page builder changes in real-time when multiple stations are connected via WebRTC
- **FR-008**: System MUST maintain FCC Part 97 compliance with the same 10-minute station identification requirements regardless of transmission mode
- **FR-009**: System MUST achieve 1MB/s target performance for WebRTC transmission while maintaining 14.4kbps maximum for radio frequency transmission
- **FR-010**: System MUST handle authentication and station verification using the same certificate-based verification system for WebRTC connections
- **FR-011**: Users MUST be able to see bandwidth utilization and transmission statistics for both modes
- **FR-012**: System MUST preserve all existing functionality (mesh networking, compression, caching) when operating in WebRTC mode
- **FR-013**: Signaling server MUST use native WebSockets (no Socket.io dependencies) for SDP exchange and peer discovery
- **FR-014**: System MUST handle NAT traversal using STUN servers for internet WebRTC connections
- **FR-015**: Signaling server MUST support callsign-based room management for ham radio station organization

### Key Entities
- **Transmission Mode**: Current active mode (RF or WebRTC) with connection status and performance metrics
- **Signaling Server**: Native WebSocket server for SDP relay and peer discovery across internet
- **Station Connection**: Represents connection to another station including transmission method, signal quality, and available capabilities
- **WebRTC Peer**: Peer-to-peer connection wrapper around RTCPeerConnection with ham radio specific features
- **Network Discovery**: Information about discoverable stations on local network and via signaling server
- **Sync Session**: Real-time collaboration session for page building with participant list and change tracking

## Technical Constraints
- **Native WebSocket**: Use Node.js built-in WebSocket (ws library) instead of Socket.io for signaling server
- **Zero External Dependencies**: Signaling server should have minimal dependencies beyond Node.js built-ins
- **FCC Compliance**: All station identification and logging requirements apply to WebRTC mode
- **Performance**: WebRTC must achieve 70x performance improvement over RF (1MB/s vs 14.4kbps)
- **Fallback**: Automatic fallback to RF must occur within 10 seconds of WebRTC failure
- **Security**: Same certificate verification system must work for both RF and WebRTC modes

## Success Criteria
- WebRTC peer discovery works on local networks without signaling server
- Internet WebRTC connections establish through native WebSocket signaling server
- Data transfer speeds achieve 1MB/s target over WebRTC vs 14.4kbps over RF
- Automatic fallback to RF occurs reliably when WebRTC fails
- Real-time collaboration works with <500ms update propagation
- FCC station identification continues in WebRTC mode
- System maintains same user interface and URL structure across modes