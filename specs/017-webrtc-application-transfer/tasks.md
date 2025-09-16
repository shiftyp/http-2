# Implementation Tasks: Distributed Servers for Internet Resilience

**Feature**: Distributed Servers for Internet Resilience
**Branch**: `017-webrtc-application-transfer`
**Date**: 2025-09-16

## Summary
Implement a distributed server system where licensed amateur radio operators run local HTTP servers that provide WebRTC signaling, certificate authority services, and mesh networking capabilities during internet outages.

## Task Organization

### Parallel Execution Groups
Tasks marked with [P] can be executed in parallel within their group:

**Group 1 - Initial Setup**: T001-T003 (all parallel)
**Group 2 - Contract Tests**: T004-T011 (all parallel)
**Group 3 - PWA Libraries**: T012-T015 (all parallel)
**Group 4 - Server Libraries**: T016-T020 (all parallel)
**Group 5 - Integration Tests**: T021-T025 (sequential)
**Group 6 - API Implementation**: T026-T032 (sequential)
**Group 7 - UI Components**: T033-T036 (all parallel)
**Group 8 - Build & Package**: T037-T040 (sequential)
**Group 9 - E2E Tests**: T041-T043 (all parallel)
**Group 10 - Documentation**: T044-T045 (all parallel)

### Task Execution Examples

```bash
# Run parallel setup tasks
task "Setup server project structure" &
task "Setup PWA libraries structure" &
task "Configure build systems" &
wait

# Run parallel contract tests
task "Create server API contract tests" &
task "Create WebSocket message contract tests" &
wait

# Run sequential integration tasks
task "Server initialization flow test"
task "Certificate chain validation test"
task "WebRTC signaling relay test"
```

## Detailed Tasks

### Setup & Configuration

#### T001: Setup server project structure [P]
**File**: `/server/`
Create Node.js server project structure with directories for lib, tests, and binaries.
```
server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   └── lib/
├── tests/
└── build/
```
Dependencies: express, ws, sqlite3, mdns, pkg

#### T002: Setup PWA libraries structure [P]
**File**: `/src/lib/`
Create PWA library directories for distributed server features.
```
src/lib/
├── server-manager/
├── certificate-verifier/
├── signaling-client/
└── server-discovery/
```

#### T003: Configure build systems [P]
**Files**: `/vite.config.ts`, `/server/webpack.config.js`
- Configure Vite for PWA with version injection
- Setup webpack/pkg for server binary building
- Add build suffix generation (timestamp)

### Contract Tests (RED Phase)

#### T004: Create server API contract tests [P]
**File**: `/tests/contract/server-api.test.ts`
Test all REST endpoints from server-api.yaml:
- GET /api/status
- POST /api/claim-station
- GET /api/info
- GET/POST /api/certificates
- POST /api/issue-certificate
- GET/POST /api/peers
Tests must fail initially (no implementation).

#### T005: Create WebSocket signaling contract tests [P]
**File**: `/tests/contract/signaling-websocket.test.ts`
Test WebSocket message contracts:
- REGISTER/REGISTERED flow
- OFFER/ANSWER relay
- ICE_CANDIDATE relay
- PEER_JOINED/PEER_LEFT notifications
Tests must fail initially.

#### T006: Create certificate validation contract tests [P]
**File**: `/tests/contract/certificate-validation.test.ts`
Test certificate operations:
- Chain validation
- Signature verification
- Blacklist checking
- Trust level assignment
Tests must fail initially.

#### T007: Create mDNS discovery contract tests [P]
**File**: `/tests/contract/mdns-discovery.test.ts`
Test mDNS advertisement and discovery:
- Service announcement
- Peer discovery
- TXT record metadata
Tests must fail initially.

#### T008: Create server initialization contract tests [P]
**File**: `/tests/contract/server-init.test.ts`
Test server claim process:
- Unclaimed state detection
- Certificate upload and validation
- Station transfer
- Owner assignment
Tests must fail initially.

#### T009: Create peer coordination contract tests [P]
**File**: `/tests/contract/peer-coordination.test.ts`
Test server-to-server coordination:
- Certificate synchronization
- Content catalog exchange
- Blacklist sharing
Tests must fail initially.

#### T010: Create content catalog contract tests [P]
**File**: `/tests/contract/content-catalog.test.ts`
Test content management:
- Catalog generation
- Entry validation
- Priority assignment
Tests must fail initially.

#### T011: Create rate limiting contract tests [P]
**File**: `/tests/contract/rate-limiting.test.ts`
Test rate limiting:
- Connection attempts
- Message rates
- Bandwidth limits
Tests must fail initially.

### PWA Libraries (Parallel Development)

#### T012: Implement server-manager library [P]
**File**: `/src/lib/server-manager/`
```typescript
// index.ts
export class ServerManager {
  checkServerStatus(): Promise<ServerStatus>
  downloadServer(platform: Platform): Promise<void>
  connectToServer(): Promise<WebSocket>
  getServerStats(): Promise<ServerStats>
}
```
Includes tests in `/src/lib/server-manager/server-manager.test.ts`

#### T013: Implement certificate-verifier library [P]
**File**: `/src/lib/certificate-verifier/`
```typescript
// index.ts
export class CertificateVerifier {
  verifyCertificate(cert: Certificate): Promise<boolean>
  verifyChain(chain: Certificate[]): Promise<boolean>
  checkBlacklist(fingerprint: string): Promise<boolean>
  extractCallsign(cert: Certificate): string
}
```
Includes tests in `/src/lib/certificate-verifier/certificate-verifier.test.ts`

#### T014: Implement signaling-client library [P]
**File**: `/src/lib/signaling-client/`
```typescript
// index.ts
export class SignalingClient {
  connect(url: string): Promise<void>
  register(callsign: string, cert?: Certificate): Promise<void>
  sendOffer(target: string, offer: RTCSessionDescription): Promise<void>
  sendAnswer(target: string, answer: RTCSessionDescription): Promise<void>
  sendIceCandidate(target: string, candidate: RTCIceCandidate): Promise<void>
}
```
Includes tests in `/src/lib/signaling-client/signaling-client.test.ts`

#### T015: Implement server-discovery library [P]
**File**: `/src/lib/server-discovery/`
```typescript
// index.ts
export class ServerDiscovery {
  discoverLocalhost(): Promise<ServerInfo[]>
  discoverViaWebRTC(): Promise<ServerInfo[]>
  scanQRCode(): Promise<ServerInfo>
  tryKnownServers(): Promise<ServerInfo[]>
}
```
Includes tests in `/src/lib/server-discovery/server-discovery.test.ts`

### Server Libraries (Parallel Development)

#### T016: Implement certificate-store library [P]
**File**: `/server/src/lib/certificate-store/`
```typescript
// index.ts
export class CertificateStore {
  constructor(dbPath: string)
  addCertificate(cert: Certificate): Promise<void>
  getCertificate(fingerprint: string): Promise<Certificate>
  blacklistCertificate(fingerprint: string, reason: string): Promise<void>
  getTrustedRoots(): Promise<Certificate[]>
}
```
Includes SQLite schema and tests.

#### T017: Implement mdns-discovery library [P]
**File**: `/server/src/lib/mdns-discovery/`
```typescript
// index.ts
export class MDNSDiscovery {
  advertise(service: ServiceInfo): Promise<void>
  browse(serviceType: string): Promise<ServiceInfo[]>
  updateTxtRecords(records: Record<string, string>): Promise<void>
}
```
Includes tests with mock mDNS.

#### T018: Implement signaling-relay library [P]
**File**: `/server/src/lib/signaling-relay/`
```typescript
// index.ts
export class SignalingRelay {
  handleConnection(ws: WebSocket, req: Request): void
  registerClient(clientId: string, ws: WebSocket, info: ClientInfo): void
  relayMessage(from: string, to: string, message: any): void
  broadcastPeerList(): void
}
```
Includes WebSocket tests.

#### T019: Implement rate-limiter library [P]
**File**: `/server/src/lib/rate-limiter/`
```typescript
// index.ts
export class RateLimiter {
  checkConnectionRate(ip: string): boolean
  checkMessageRate(clientId: string): boolean
  checkBandwidth(clientId: string, bytes: number): boolean
}
```
Includes tests with time mocking.

#### T020: Implement server-coordinator library [P]
**File**: `/server/src/lib/server-coordinator/`
```typescript
// index.ts
export class ServerCoordinator {
  addPeer(endpoint: string): Promise<void>
  syncCertificates(peer: PeerInfo): Promise<void>
  syncContentCatalog(peer: PeerInfo): Promise<void>
}
```
Includes tests with mock peers.

### Integration Tests (Sequential)

#### T021: Server initialization flow test
**File**: `/tests/integration/server-init.integration.test.ts`
Test complete server initialization:
1. Start server in unclaimed state
2. Upload certificate
3. Transfer station data
4. Verify claimed state
5. Check QR code generation

#### T022: Certificate chain validation test
**File**: `/tests/integration/certificate-chain.integration.test.ts`
Test certificate operations:
1. Create certificate chain
2. Validate signatures
3. Check trust roots
4. Handle blacklisting

#### T023: WebRTC signaling relay test
**File**: `/tests/integration/signaling.integration.test.ts`
Test signaling flow:
1. Connect two clients
2. Exchange offer/answer
3. Relay ICE candidates
4. Verify connection establishment

#### T024: mDNS discovery integration test
**File**: `/tests/integration/mdns.integration.test.ts`
Test local discovery:
1. Start two servers
2. Advertise via mDNS
3. Discover each other
4. Exchange metadata

#### T025: Multi-server coordination test
**File**: `/tests/integration/coordination.integration.test.ts`
Test server coordination:
1. Start multiple servers
2. Add as peers
3. Sync certificates
4. Verify shared state

### API Implementation (Sequential - GREEN Phase)

#### T026: Implement server main entry point
**File**: `/server/src/index.ts`
Create main server with:
- Express app setup
- WebSocket server
- SQLite initialization
- CLI argument parsing
- Version with build suffix

#### T027: Implement status and info endpoints
**Files**: `/server/src/api/status.ts`, `/server/src/api/info.ts`
- GET /api/status - Return server state
- GET /api/info - Return capabilities

#### T028: Implement claim station endpoint
**File**: `/server/src/api/claim.ts`
- POST /api/claim-station
- Certificate validation
- Owner assignment
- Access token generation

#### T029: Implement certificate endpoints
**File**: `/server/src/api/certificates.ts`
- GET /api/certificates - List certificates
- POST /api/certificates - Add certificate
- GET /api/certificates/:fingerprint
- POST /api/certificates/:fingerprint/blacklist

#### T030: Implement CA endpoints
**File**: `/server/src/api/ca.ts`
- POST /api/issue-certificate
- Certificate signing
- Chain building

#### T031: Implement peer endpoints
**File**: `/server/src/api/peers.ts`
- GET /api/peers - List peers
- POST /api/peers - Add peer
- GET /api/local-servers

#### T032: Implement WebSocket handlers
**File**: `/server/src/websocket/`
- /ws/signal - Signaling relay
- /ws/coordinate - Server coordination
- Message validation and routing

### UI Components (Parallel)

#### T033: Create ServerInitializer component [P]
**File**: `/src/components/ServerInitializer.tsx`
UI for server initialization:
- Certificate upload
- Station transfer progress
- QR code display
- URL sharing

#### T034: Create ServerDiscovery component [P]
**File**: `/src/components/ServerDiscovery.tsx`
UI for finding servers:
- QR scanner
- Manual URL entry
- Local discovery results
- Connection status

#### T035: Create CertificateManager component [P]
**File**: `/src/components/CertificateManager.tsx`
UI for certificate operations:
- Certificate list
- Trust level management
- Blacklist management
- CA functions

#### T036: Create ServerStatus component [P]
**File**: `/src/components/ServerStatus.tsx`
UI for server monitoring:
- Connection status
- Peer list
- Statistics
- Logs viewer

### Build & Packaging (Sequential)

#### T037: Configure server binary building
**File**: `/server/package.json`
Add pkg configuration:
```json
"pkg": {
  "scripts": "dist/**/*.js",
  "targets": ["node20-win-x64", "node20-macos-x64", "node20-linux-x64"],
  "outputPath": "binaries"
}
```

#### T038: Add server binaries to PWA
**File**: `/public/server-binaries/`
Copy built binaries to PWA public directory:
- Windows: server-windows.exe
- macOS: server-darwin
- Linux: server-linux

#### T039: Implement version injection
**File**: `/vite.config.ts`
Add build suffix generation:
```typescript
define: {
  __APP_VERSION__: JSON.stringify(`${version}-${Date.now()}`),
  __SERVER_VERSION__: JSON.stringify(`${version}-${Date.now()}`)
}
```

#### T040: Update service worker for binary caching
**File**: `/src/service-worker.ts`
Add caching strategy for server binaries:
- Version-based cache names
- Binary file caching
- Update detection

### End-to-End Tests (Parallel)

#### T041: Complete setup flow E2E test [P]
**File**: `/tests/e2e/setup-flow.e2e.test.ts`
Test from PWA install to server running:
1. Install PWA
2. Download server
3. Initialize server
4. Share connection info

#### T042: Peer discovery E2E test [P]
**File**: `/tests/e2e/peer-discovery.e2e.test.ts`
Test finding and connecting to peers:
1. Start multiple servers
2. Discover via different methods
3. Establish connections
4. Exchange data

#### T043: Offline operation E2E test [P]
**File**: `/tests/e2e/offline-mode.e2e.test.ts`
Test without internet:
1. Disconnect internet
2. Verify local discovery works
3. Test signaling relay
4. Verify mesh formation

### Documentation & Polish

#### T044: Create server CLI documentation [P]
**File**: `/server/README.md`
Document:
- Installation steps
- CLI options
- Configuration
- Troubleshooting

#### T045: Create API documentation [P]
**File**: `/docs/api.md`
Generate from OpenAPI:
- Endpoint descriptions
- Request/response examples
- WebSocket protocols
- Rate limits

## Dependency Notes

### Critical Path
1. Setup tasks (T001-T003) must complete first
2. Contract tests (T004-T011) before any implementation
3. Libraries (T012-T020) can be parallel after contracts
4. Integration tests (T021-T025) require libraries
5. API implementation (T026-T032) after integration tests
6. UI components (T033-T036) can start with libraries
7. Build tasks (T037-T040) after implementation
8. E2E tests (T041-T043) require complete system
9. Documentation (T044-T045) can be parallel with E2E

### File Dependencies
- Server and PWA libraries are independent (parallel)
- API endpoints share Express app (sequential)
- UI components are independent (parallel)
- Tests for each library are independent (parallel)

## Validation Checklist

Before marking complete:
- [ ] All contract tests pass
- [ ] Integration tests pass
- [ ] Quickstart guide validates
- [ ] Server binary < 10MB
- [ ] Discovery time < 5 seconds
- [ ] 100+ concurrent connections supported
- [ ] Offline operation verified
- [ ] Version with build suffix working

## Task Count Summary
- **Total Tasks**: 45
- **Parallel Groups**: 10
- **Setup**: 3 tasks
- **Tests**: 20 tasks (11 contract, 5 integration, 4 E2E)
- **Implementation**: 17 tasks (7 PWA, 10 server)
- **UI**: 4 tasks
- **Build**: 4 tasks
- **Documentation**: 2 tasks

## Next Steps
After tasks complete:
1. Run quickstart validation
2. Performance testing
3. Security audit
4. Field testing with real radios
5. Community beta testing