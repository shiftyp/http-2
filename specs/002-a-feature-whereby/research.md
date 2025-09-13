# Research Document: WebRTC Local Data Transfer

**Feature**: WebRTC Local Data Transfer
**Date**: 2025-09-13
**Branch**: `002-a-feature-whereby`

## Executive Summary

Research findings for implementing peer-to-peer data transfer between ham radio stations on local networks using WebRTC, QR codes/shortcodes for connection establishment, and public key encryption for security.

## Technology Decisions

### 1. WebRTC Implementation Approach

**Decision**: Native WebRTC APIs
**Rationale**:
- Zero bundle size overhead (critical for 2KB bandwidth constraint)
- Full control over connection parameters
- No external dependencies that could become stale
- Aligns with PWA constitution requirement for minimal dependencies

**Alternatives Considered**:
- simple-peer library: Rejected due to 4-year stale status and bundle overhead
- PeerJS: Rejected due to server dependency requirement
- Socket.io P2P: Rejected due to complexity and server requirements

### 2. Local Network Discovery

**Decision**: No STUN/TURN servers, use local ICE candidates only
**Rationale**:
- STUN/TURN not required for same-subnet connections
- Reduces complexity and external dependencies
- Faster connection establishment on local networks
- Aligns with offline-first requirement

**Alternatives Considered**:
- Google STUN servers: Rejected due to internet dependency
- Self-hosted TURN: Rejected as unnecessary for local networks
- mDNS discovery: Considered but not universally supported

### 3. Connection Establishment Method

**Decision**: QR code with fallback to 6-character alphanumeric shortcode
**Rationale**:
- QR codes can encode ~4KB of SDP data
- Shortcodes provide manual entry fallback
- No signaling server required
- Works completely offline

**Alternatives Considered**:
- NFC: Limited device support
- Bluetooth: Complex pairing requirements
- UDP broadcast: Firewall/router restrictions

### 4. Encryption Strategy

**Decision**: Leverage existing CryptoManager with ECDH + AES-GCM
**Rationale**:
- Existing robust implementation in codebase
- Web Crypto API provides hardware acceleration
- ECDH for key exchange, AES-GCM for data encryption
- Complies with no-encryption-over-RF requirement (local network only)

**Alternatives Considered**:
- libsodium.js: Additional dependency overhead
- Custom crypto: Security risk, reinventing wheel
- No encryption: Rejected for privacy of private keys

### 5. Data Merging Strategy

**Decision**: Three-tier intelligent merge with conflict resolution
**Rationale**:
- Exact match detection prevents duplicates
- Fuzzy matching handles clock drift
- Field-specific rules preserve data completeness
- Idempotent operations prevent merge loops

**Alternatives Considered**:
- Last-write-wins: Data loss risk
- Manual resolution only: Poor user experience
- Blockchain/CRDT: Overcomplicated for use case

### 6. Service Worker Integration

**Decision**: Hybrid architecture - WebRTC in main window, queuing in service worker
**Rationale**:
- WebRTC not available in service workers (browser limitation)
- Service worker handles offline queueing and retry
- Main window manages active connections
- Progressive enhancement approach

**Alternatives Considered**:
- Service worker only: Not possible with WebRTC
- Main window only: No background processing
- Shared worker: Limited browser support

## Implementation Architecture

### Component Structure
```
src/lib/
├── webrtc-transfer/      # Core P2P connection management
│   ├── connection.ts     # RTCPeerConnection wrapper
│   ├── signaling.ts      # QR/shortcode exchange
│   └── channel.ts        # Data channel management
├── qr-shortcode/         # Connection code generation
│   ├── generator.ts      # QR and shortcode creation
│   ├── scanner.ts        # QR code scanning
│   └── validator.ts      # Code expiration/validation
├── station-data/         # Data export/import
│   ├── exporter.ts       # Station data serialization
│   ├── importer.ts       # Data deserialization
│   └── merger.ts         # Intelligent merge logic
└── transfer-crypto/      # Encryption layer
    ├── session.ts        # Session key management
    ├── stream.ts         # Streaming encryption
    └── integrity.ts      # Data integrity checks
```

### Data Flow
1. **Connection Setup**: QR/shortcode → SDP exchange → WebRTC connection
2. **Security**: ECDH key exchange → derive session key → AES-GCM encryption
3. **Transfer**: Chunk data → encrypt → send via data channel → decrypt → merge
4. **Recovery**: Detect disconnect → show restart option → maintain transfer log

## Performance Targets

### Connection Establishment
- **Target**: <1 second on local network
- **Method**: Pre-generate ICE candidates, minimize SDP size
- **Optimization**: Connection pooling for multiple transfers

### Data Transfer
- **Target**: 1MB/s minimum on local network
- **Method**: 64KB chunks, binary protocol
- **Optimization**: Compression before encryption

### Large Dataset Handling
- **Target**: Support 100k+ logbook entries
- **Method**: Streaming with backpressure
- **Optimization**: IndexedDB cursors, Web Workers

## Security Considerations

### Threat Model
- **In Scope**: Eavesdropping on local network, MITM attacks
- **Out of Scope**: Nation-state adversaries, RF interception

### Mitigations
- **Public key verification**: Display fingerprint for out-of-band verification
- **Session expiration**: 5-minute code timeout, 30-minute session timeout
- **Forward secrecy**: Ephemeral keys per session
- **Data integrity**: HMAC verification of chunks

## Testing Strategy

### Unit Tests
- Encryption/decryption round trips
- Merge logic with edge cases
- QR code generation/parsing

### Integration Tests
- WebRTC connection establishment
- Full transfer flow with encryption
- Interrupted transfer recovery

### E2E Tests
- Complete station migration scenario
- Multiple simultaneous transfers rejection
- Code expiration handling

## Browser Compatibility

### Required Features
- WebRTC Data Channels (all modern browsers)
- Web Crypto API (all modern browsers)
- IndexedDB (all modern browsers)
- Service Workers (all except Firefox on iOS)

### Polyfills/Fallbacks
- QR scanning: File upload fallback
- Service Worker: LocalStorage queue fallback
- WebRTC: Manual file export/import fallback

## Regulatory Compliance

### FCC Part 97
- No encryption over RF (local network only)
- Transfer logs maintained for record keeping
- Station identification not required (no RF transmission)

### Data Privacy
- All data stays on local network
- No cloud services involved
- User controls what data to transfer

## Risk Assessment

### Technical Risks
- **WebRTC complexity**: Mitigated by phased implementation
- **Browser compatibility**: Mitigated by progressive enhancement
- **Large data handling**: Mitigated by streaming architecture

### User Experience Risks
- **QR code scanning issues**: Mitigated by shortcode fallback
- **Connection failures**: Mitigated by clear error messages
- **Merge conflicts**: Mitigated by preview before accepting

## Recommendations

1. **Phase 1**: Implement basic unencrypted transfer with QR codes
2. **Phase 2**: Add encryption layer using existing CryptoManager
3. **Phase 3**: Implement intelligent merging with conflict resolution
4. **Phase 4**: Add service worker integration for background processing

## Open Questions Resolved

All technical questions have been resolved through research:
- ✅ WebRTC works on local networks without STUN/TURN
- ✅ QR codes can handle SDP exchange with compression
- ✅ Existing crypto infrastructure supports requirements
- ✅ Service worker limitations addressed with hybrid approach
- ✅ Merge conflicts resolvable with field-specific rules

---
*Research complete. Ready for Phase 1: Design & Contracts*