# Research: Certificate Management

**Date**: 2025-09-18
**Feature**: Certificate Management for Amateur Radio HTTP Communication

## Research Areas

### 1. X.509 Certificate Extensions for Amateur Radio

**Decision**: Use X.509 v3 certificates with custom extensions for amateur radio metadata
**Rationale**: Standard X.509 format ensures compatibility with existing tools while extensions provide ham-specific data
**Alternatives considered**:
- Custom certificate format (incompatible with standard tools)
- Embedded metadata in subject fields (limited space, parsing issues)

**Key findings**:
- X.509 v3 supports custom extensions via OID (Object Identifier)
- Amateur radio extensions should include: callsign, license class, grid square
- Extensions can be marked critical or non-critical for backward compatibility
- Web Crypto API supports custom extensions in certificate parsing

**Implementation approach**:
- Define custom OID namespace for amateur radio: 1.3.6.1.4.1.XXXXX.1 (amateur radio)
- Callsign extension: 1.3.6.1.4.1.XXXXX.1.1
- License class extension: 1.3.6.1.4.1.XXXXX.1.2
- Grid square extension: 1.3.6.1.4.1.XXXXX.1.3
- Use ASN.1 DER encoding for extension values

### 2. PKCS#12 Parsing in Browser Environment

**Decision**: Use Web Crypto API with manual PKCS#12 parsing for LoTW certificates
**Rationale**: No external dependencies, works offline, maintains security model
**Alternatives considered**:
- Server-side parsing (breaks offline requirement)
- Third-party libraries (bundle size, security concerns)
- Native PKCS#12 support (not available in browsers)

**Key findings**:
- PKCS#12 is a binary format containing certificates and private keys
- LoTW uses PKCS#12 with password protection
- Web Crypto API can import certificates after parsing PKCS#12 structure
- ASN.1 parsing required for PKCS#12 structure extraction

**Implementation approach**:
- Implement minimal ASN.1 parser for PKCS#12 structure
- Support password-based encryption decryption
- Extract X.509 certificates and private keys
- Import using Web Crypto API's importKey() method
- Store in IndexedDB using encrypted format

### 3. CAPTCHA Generation for Radio Transmission

**Decision**: Use simple text-based challenges optimized for compression
**Rationale**: Radio bandwidth is limited, visual CAPTCHAs don't compress well
**Alternatives considered**:
- Image-based CAPTCHAs (poor compression, high bandwidth)
- Audio CAPTCHAs (incompatible with digital modes)
- Complex puzzles (high cognitive load for mobile operation)

**Key findings**:
- Text compresses 10-50x better than images over radio
- Simple math problems: "What is 7 + 15?" → "22"
- Ham knowledge: "What frequency band is 14.205 MHz?" → "20 meters"
- Pattern recognition: "Next in sequence: 2, 4, 8, ?" → "16"
- Geographic: "What grid square contains Kansas City?" → "EM28"

**Implementation approach**:
- Generate challenges dynamically with known answers
- Use structured format: {"type": "math", "question": "7+15", "answer": "22"}
- Pool of 1000+ pre-generated challenges per server
- Challenges signed by server for anti-tampering
- Rate limiting: 3 attempts per hour per callsign

### 4. Trust Chain Validation and Attack Prevention

**Decision**: Implement depth-limited trust chains with consensus validation
**Rationale**: Prevents trust chain attacks while enabling certificate federation
**Alternatives considered**:
- Unlimited trust chains (vulnerable to attacks)
- No federation (limits network growth)
- Central authority (single point of failure)

**Key findings**:
- Trust chain attacks: long chains to trusted roots, circular references
- Depth limit of 3-5 hops prevents most attacks
- Consensus validation: multiple servers must agree on trust
- Time-based expiration prevents stale trust relationships

**Implementation approach**:
- Maximum trust depth: 5 certificates
- Circular reference detection using visited set
- Trust consensus: 2+ servers must vouch for certificate
- Time-based trust expiration: 30 days without refresh
- Revocation checking at each hop

### 5. IndexedDB Patterns for Certificate Storage

**Decision**: Use composite indexing with callsign + certificate type for efficient retrieval
**Rationale**: Supports multiple certificates per callsign with fast lookups
**Alternatives considered**:
- Single certificate per callsign (limits flexibility)
- File-based storage (no query capabilities)
- Memory-only storage (lost on reload)

**Key findings**:
- IndexedDB supports compound indexes for complex queries
- Certificate storage needs: callsign, type, expiration, trust level
- Binary certificate data stored as ArrayBuffer
- Metadata stored as separate JSON for quick filtering

**Implementation approach**:
- Object store: 'certificates' with auto-incrementing primary key
- Indexes: 'by_callsign', 'by_type', 'by_expiration', 'by_trust_level'
- Compound index: 'by_callsign_type' for efficient multi-cert queries
- Separate 'trust_chains' store for relationship mapping
- Background cleanup of expired certificates

### 6. WebSocket Integration for Approval Workflow

**Decision**: Extend existing signaling server with certificate approval endpoints
**Rationale**: Reuses existing infrastructure, real-time notifications
**Alternatives considered**:
- Separate certificate server (additional infrastructure)
- Polling-based updates (inefficient, delayed notifications)
- Email notifications (requires external service)

**Key findings**:
- Existing WebSocket server handles 1000+ concurrent connections
- Real-time notifications improve user experience
- Server operators need immediate approval notifications
- Client status updates prevent request duplication

**Implementation approach**:
- Add certificate approval message types to WebSocket protocol
- Server operator dashboard gets real-time approval requests
- Clients receive immediate approval/rejection notifications
- Approval queue persistence in server database
- Retry mechanism for failed WebSocket deliveries

## Technical Decisions Summary

1. **Certificate Format**: X.509 v3 with amateur radio extensions
2. **PKCS#12 Support**: Manual parsing with Web Crypto API import
3. **CAPTCHA Design**: Text-based challenges optimized for compression
4. **Trust Chains**: Depth-limited (5 hops) with consensus validation
5. **Storage Pattern**: IndexedDB with compound indexing
6. **Real-time Updates**: WebSocket integration with existing server

## Implementation Priorities

1. **Phase 1**: Basic certificate storage and Web Crypto API integration
2. **Phase 2**: PKCS#12 parsing for LoTW certificate support
3. **Phase 3**: CAPTCHA generation and verification system
4. **Phase 4**: Trust chain validation and federation
5. **Phase 5**: WebSocket approval workflow integration

## Security Considerations

- Certificate private keys never leave client device
- CAPTCHA solutions signed to prevent replay attacks
- Trust chain depth limits prevent recursive attacks
- Rate limiting prevents brute force attempts
- All certificate operations logged for audit trail

## Performance Targets

- Certificate verification: <200ms
- CAPTCHA generation: <1s
- Trust chain validation: <500ms
- IndexedDB queries: <50ms
- Offline operation: 100% functional without network

## Bandwidth Analysis

- X.509 certificate: ~2-4KB
- CAPTCHA challenge: ~50-100 bytes
- CAPTCHA solution: ~20-50 bytes
- Trust chain query: ~500 bytes
- Approval notification: ~200 bytes

All values optimized for radio transmission compression.