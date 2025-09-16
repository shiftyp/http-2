# Distributed Servers Specification - Summary

## Overview
A distributed server system that enables ham radio operators to run local HTTP/WebSocket servers, providing signaling for WebRTC connections and certificate authority services during internet outages.

## Core Architecture

### Server Binary
- **Minimal footprint**: 5-10MB per platform
- **Bundled with PWA**: Downloaded through the web interface
- **Stateless design**: Only stores certificates and active connections
- **SQLite embedded**: Local certificate database

### Key Features
1. **WebRTC Signaling**: Relay offer/answer/ICE candidates between peers
2. **Certificate Authority**: Any licensed operator can issue certificates
3. **Server Coordination**: Multiple servers share certificate lists
4. **Offline Operation**: Works indefinitely without internet

## Installation Flow

```
1. User installs PWA
2. Downloads server binary (platform-specific)
3. Runs server (unclaimed state)
4. Opens PWA on localhost:8080
5. Transfers station data → Server claimed
6. Server generates QR code / URL for sharing
```

## Discovery Methods

### For Web Clients
1. **QR Code Scanning**: Camera-based connection
2. **Manual URL Entry**: `ws://192.168.1.100:8080/signal`
3. **Localhost Attempts**: Try common ports automatically
4. **CQ Announcements**: Discover servers via radio

### Server Advertisement
- mDNS broadcast on local network
- CQ messages include server info
- Coordinating servers share peer lists

## Certificate System

### Trust Model
- No maximum chain depth
- Any licensed operator can issue
- Local blacklisting per station
- Certificates never expire

### Verification
```
Client → Server Certificate → Verify Chain → Check Blacklist → Trust
```

## Security

### Access Control
- **Licensed operators**: Full read/write access
- **Unlicensed users**: Read-only access
- **Rate limiting**: Prevent abuse
- **Certificate signing**: Prevent impersonation

## Platform Support

### Windows
- Run `server.exe`
- Allow through firewall when prompted

### macOS
- Run via Terminal: `./server-darwin-x64`
- Bypass Gatekeeper if needed

### Linux
- Run directly or install as systemd service
- Configure firewall as needed

## Key Design Decisions

1. **Stateless servers**: Simplifies implementation and scaling
2. **Certificate-based trust**: No central authority needed
3. **SQLite storage**: Embedded database for certificates
4. **WebRTC signaling only**: No media relay (bandwidth efficient)
5. **Bundled distribution**: Server binaries included in PWA
6. **Server coordination**: Multiple servers can share certificates
7. **Offline-first**: Designed for permanent offline operation

## Implementation Phases

### Phase 1: Basic Server (MVP)
- HTTP server with WebSocket signaling
- Certificate verification
- SQLite certificate store
- QR code generation

### Phase 2: Discovery & Coordination
- mDNS advertisement
- Server-to-server coordination
- Certificate list merging
- CQ announcement integration

### Phase 3: Advanced Features
- GPS/consensus time sync
- Predictive certificate caching
- Advanced rate limiting
- Performance optimization

## Files in This Specification

- `spec.md` - Main specification
- `technical-constraints.md` - Browser limitations and solutions
- `license-requirements.md` - Amateur radio licensing requirements
- `implementation-architecture.md` - Technical architecture details
- `certificate-specification.md` - Certificate format and validation
- `decentralized-ca-model.md` - Certificate authority hierarchy
- `peer-discovery.md` - Discovery mechanisms
- `browser-client-discovery.md` - Browser-specific discovery
- `cq-server-announcement.md` - CQ integration
- `server-initialization-flow.md` - Setup and ownership transfer
- `spec-clarifications.md` - Detailed clarifications
- `README.md` - This summary

## Next Steps

1. Implement minimal server binary with HTTP/WebSocket
2. Add certificate management and SQLite storage
3. Integrate with PWA for station transfer
4. Add QR code generation and scanning
5. Test multi-server coordination
6. Deploy and test in offline scenarios