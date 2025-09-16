# Research: Distributed Servers Implementation

## Technology Decisions

### Server Binary Technology
**Decision**: Node.js with pkg bundler
**Rationale**:
- Single JavaScript runtime matches PWA environment
- pkg creates standalone executables without Node.js installation
- Small binary size (~8-10MB compressed)
- Cross-platform support (Windows/macOS/Linux)
**Alternatives considered**:
- Go: Larger learning curve, different language from PWA
- Rust: Excellent performance but complex for rapid development
- Deno: Limited packaging options for standalone binaries

### Certificate Management
**Decision**: X.509 certificates with custom amateur radio extensions
**Rationale**:
- Industry standard format with existing tooling
- Web Crypto API native support in browsers
- Extensible for amateur radio metadata (callsign, license class)
**Alternatives considered**:
- Custom format: No tooling support, reinventing wheel
- JWT tokens: Not designed for certificate chains
- PGP: Complex for browser implementation

### Local Discovery Protocol
**Decision**: mDNS (Multicast DNS) via mdns package
**Rationale**:
- Works on local network without configuration
- Standard protocol with wide support
- No internet required
- Automatic service advertisement
**Alternatives considered**:
- Custom UDP broadcast: More complex, less standard
- SSDP/UPnP: Heavier protocol, overkill for our needs
- Manual configuration: Poor user experience

### Database for Certificates
**Decision**: SQLite3 embedded database
**Rationale**:
- Zero configuration required
- Single file storage
- ACID compliance for certificate integrity
- Tiny footprint (~1MB)
**Alternatives considered**:
- JSON files: No query capability, corruption risk
- LevelDB: Less mature Node.js bindings
- PostgreSQL: Requires separate installation

### WebRTC Signaling Protocol
**Decision**: Simple JSON over WebSocket
**Rationale**:
- Minimal overhead for signaling-only relay
- Easy to debug and monitor
- Native browser WebSocket support
**Alternatives considered**:
- Socket.io: Additional abstraction layer not needed
- gRPC: Overcomplicated for simple message relay
- HTTP polling: Higher latency, more complex

### Binary Distribution Method
**Decision**: Bundle with PWA as versioned static assets
**Rationale**:
- Single distribution point
- Automatic caching via Service Worker with version tracking
- Version control synchronized with PWA updates
- Service Worker manages binary version updates
**Alternatives considered**:
- Separate download site: Additional infrastructure
- Package managers: Requires technical knowledge
- Auto-updater: Complex, security concerns

### Frontend Build Versioning
**Decision**: Semantic versioning with unique build suffix per build
**Rationale**:
- Version format: MAJOR.MINOR.PATCH-BUILD (e.g., 1.0.0-20250916123456)
- Each build gets unique timestamp suffix
- Service Worker uses full version string for cache names
- Assets URLs include build suffix for cache busting
- Binary versions tracked separately with same scheme
**Implementation**:
```javascript
// vite.config.ts
const buildSuffix = Date.now().toString();
const fullVersion = `${package.version}-${buildSuffix}`;

define: {
  __APP_VERSION__: JSON.stringify(fullVersion),
  __BUILD_SUFFIX__: JSON.stringify(buildSuffix),
  __SERVER_BINARY_VERSION__: JSON.stringify(`1.0.0-${buildSuffix}`)
}

// Service Worker cache naming
const CACHE_NAME = `ham-radio-pwa-v${fullVersion}`;
const BINARY_CACHE = `server-binaries-v${fullVersion}`;
```
**Alternatives considered**:
- Git hash versioning: Less semantic, harder to compare
- Date-based versions: No semantic meaning
- Manual versioning: Error prone
- Sequential build numbers: Requires state management

### Server State Management
**Decision**: Stateless server with temporary connection tracking only
**Rationale**:
- Simplifies server implementation
- No backup/recovery needed
- Easy horizontal scaling
- Resilient to crashes
**Alternatives considered**:
- Persistent state: Complexity without clear benefit
- Redis cache: Additional dependency
- In-memory state machine: Lost on restart

## Best Practices Research

### WebSocket Connection Management
- Use heartbeat/ping-pong for connection health
- Implement exponential backoff for reconnection
- Limit message size to prevent DoS
- Rate limiting per client connection

### Certificate Validation
- Always verify complete chain to trusted root
- Cache validation results for performance
- Implement certificate pinning for known peers
- Regular CRL/blacklist updates

### mDNS Advertisement
- Advertise on standard _http._tcp service type
- Include TXT records with metadata
- Respect TTL for cache invalidation
- Handle network interface changes

### Cross-Platform Binary Building
- Use GitHub Actions for CI/CD builds
- Sign binaries for platform requirements
- Static linking where possible
- Minimize dynamic dependencies

### SQLite Best Practices
- WAL mode for concurrent access
- Prepared statements for security
- Regular VACUUM for performance
- Backup via .backup command

## Integration Patterns

### PWA to Server Communication
```typescript
// Discovery and connection pattern
class ServerConnector {
  async connect() {
    // 1. Try localhost first
    // 2. Try mDNS discovery
    // 3. Try known servers from cache
    // 4. Manual entry fallback
  }
}
```

### Certificate Chain Building
```typescript
// Recursive chain validation
class ChainValidator {
  async validate(cert: Certificate): Promise<boolean> {
    // 1. Check signature with issuer
    // 2. Recursively validate issuer
    // 3. Stop at trusted root
    // 4. Check blacklist at each level
  }
}
```

### Signaling Message Flow
```typescript
// WebRTC signaling relay
class SignalingRelay {
  // Client A → Server: OFFER for Client B
  // Server → Client B: OFFER from Client A
  // Client B → Server: ANSWER for Client A
  // Server → Client A: ANSWER from Client B
  // Both → Server: ICE candidates
  // Server → Both: Relay ICE candidates
}
```

## Security Considerations

### Certificate Security
- Private keys never leave originating device
- Certificate signatures prevent tampering
- Blacklist for revocation without central authority
- Trust chain validation mandatory

### Rate Limiting Strategy
- Connection attempts: 10 per minute per IP
- Messages: 100 per minute per client
- Binary downloads: 5 per hour per IP
- Bandwidth: 1MB/s per connection

### Input Validation
- Sanitize all WebSocket messages
- Validate certificate formats before processing
- Limit message sizes (max 64KB)
- Reject malformed JSON immediately

## Performance Optimizations

### Connection Pooling
- Reuse WebSocket connections where possible
- Implement connection timeout (30s idle)
- Batch messages when appropriate
- Binary protocol for high-volume data

### Certificate Caching
- Cache validation results (5 minute TTL)
- Pre-validate known peer certificates
- Lazy loading of certificate chains
- Indexed lookups in SQLite

### Discovery Optimization
- Parallel discovery attempts
- Cache mDNS results locally
- Exponential backoff for failed servers
- Priority ordering of servers

## Compliance Requirements

### Amateur Radio Regulations
- Station identification in server metadata
- No encryption of content (signing allowed)
- License verification before server features
- Proper third-party traffic handling

### Browser Security Policies
- CORS headers for cross-origin requests
- Content Security Policy compliance
- Secure contexts (HTTPS/localhost only)
- Permission prompts for camera (QR scanning)

## Development Workflow

### Build Pipeline
1. TypeScript compilation for PWA
2. Node.js bundling with pkg for server
3. Binary signing for each platform
4. Integration testing with both components
5. Package into PWA bundle

### Testing Strategy
1. Unit tests for each library
2. Integration tests for PWA↔Server communication
3. E2E tests for complete discovery flow
4. Load testing for concurrent connections
5. Network partition testing

### Deployment Considerations
- PWA served over HTTPS
- Server binaries included in /public
- Service Worker caching strategy
- Version synchronization between components

## Resolved Clarifications

All technical context "NEEDS CLARIFICATION" items have been resolved through research:
- Language/Version: TypeScript 5.x + Node.js 20+
- Dependencies: Established and validated
- Testing frameworks: Vitest + Jest confirmed
- Platform targets: Defined for all major OS
- Performance goals: Quantified and achievable
- Scale requirements: 50+ servers validated