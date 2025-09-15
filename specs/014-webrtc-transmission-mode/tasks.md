# Tasks: WebRTC Transmission Mode with Native WebSocket Signaling

**Input**: Design documents from `/specs/014-webrtc-transmission-mode/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.x, React 18, WebRTC APIs, native WebSocket
   → Libraries: webrtc-transport, transmission-mode, signaling-server
2. Load design documents:
   → data-model.md: 7 entities → model tasks
   → contracts/: 2 files → contract test tasks
   → quickstart.md: 4 scenarios → integration test tasks
3. Generate tasks by category:
   → Setup: signaling server, WebRTC libraries, dependencies
   → Tests: contract tests, integration tests (TDD enforced)
   → Core: models, transport layer, mode switching logic
   → Integration: UI components, API endpoints, real-time sync
   → Polish: unit tests, performance validation, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Dependencies: Signaling server → WebRTC client → UI integration
7. Validation: All contracts tested, all entities modeled, all scenarios covered
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup

- [ ] T001 Create signaling server project structure in `signaling-server/` with minimal dependencies
- [ ] T002 Initialize signaling server with native WebSocket (ws) dependencies in `signaling-server/package.json`
- [ ] T003 [P] Configure TypeScript 5.x compilation for WebRTC libraries in `src/lib/webrtc-transport/tsconfig.json`
- [ ] T004 [P] Configure TypeScript 5.x compilation for transmission mode library in `src/lib/transmission-mode/tsconfig.json`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (from contracts/)
- [ ] T005 [P] Contract test WebSocket signaling protocol in `src/test/contract/signaling-protocol.contract.test.ts`
- [ ] T006 [P] Contract test transmission mode API in `src/test/contract/transmission-mode-api.contract.test.ts`

### Integration Tests (from quickstart scenarios)
- [ ] T007 [P] Integration test local network WebRTC connection in `src/test/integration/local-webrtc-connection.test.ts`
- [ ] T008 [P] Integration test internet WebRTC via signaling server in `src/test/integration/internet-webrtc-connection.test.ts`
- [ ] T009 [P] Integration test real-time collaboration sync in `src/test/integration/realtime-collaboration.test.ts`
- [ ] T010 [P] Integration test automatic fallback to RF in `src/test/integration/automatic-fallback.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models (from data-model.md)
- [ ] T011 [P] TransmissionMode model in `src/lib/database/models/TransmissionMode.ts`
- [ ] T012 [P] WebRTCPeer model in `src/lib/database/models/WebRTCPeer.ts`
- [ ] T013 [P] SignalingConnection model in `src/lib/database/models/SignalingConnection.ts`
- [ ] T014 [P] NetworkDiscovery model in `src/lib/database/models/NetworkDiscovery.ts`
- [ ] T015 [P] SyncSession model in `src/lib/database/models/SyncSession.ts`
- [ ] T016 [P] LocalPeer model in `src/lib/database/models/LocalPeer.ts`
- [ ] T017 [P] InternetPeer model in `src/lib/database/models/InternetPeer.ts`

### Signaling Server (standalone Node.js project)
- [ ] T018 WebSocket signaling server main logic in `signaling-server/server.js`
- [ ] T019 Callsign-based room management in `signaling-server/server.js`
- [ ] T020 SDP relay and peer discovery in `signaling-server/server.js`

### Core Libraries
- [ ] T021 WebRTC peer connection wrapper in `src/lib/webrtc-transport/WebRTCPeer.ts`
- [ ] T022 Local network peer discovery in `src/lib/webrtc-transport/LocalDiscovery.ts`
- [ ] T023 WebSocket signaling client in `src/lib/webrtc-transport/SignalingClient.ts`
- [ ] T024 ICE candidate management and STUN integration in `src/lib/webrtc-transport/ICEManager.ts`
- [ ] T025 WebRTC data channel management in `src/lib/webrtc-transport/DataChannelManager.ts`
- [ ] T026 Transmission mode switching logic in `src/lib/transmission-mode/ModeManager.ts`
- [ ] T027 Automatic fallback detection in `src/lib/transmission-mode/FallbackDetector.ts`
- [ ] T028 Real-time collaboration sync engine in `src/lib/transmission-mode/CollaborationSync.ts`

### Library Entry Points
- [ ] T029 WebRTC transport library index in `src/lib/webrtc-transport/index.ts`
- [ ] T030 Transmission mode library index in `src/lib/transmission-mode/index.ts`

## Phase 3.4: Integration

### API Endpoints (based on contracts)
- [ ] T031 POST /api/v1/transmission/mode endpoint for mode switching in `src/api/transmission.ts`
- [ ] T032 GET /api/v1/transmission/mode endpoint for status in `src/api/transmission.ts`
- [ ] T033 POST /api/v1/transmission/peers/discover endpoint in `src/api/transmission.ts`
- [ ] T034 GET /api/v1/transmission/peers/discover endpoint in `src/api/transmission.ts`
- [ ] T035 POST /api/v1/transmission/peers/{callsign}/connect endpoint in `src/api/transmission.ts`
- [ ] T036 GET /api/v1/transmission/peers/{callsign} endpoint in `src/api/transmission.ts`
- [ ] T037 POST /api/v1/transmission/signaling endpoint in `src/api/transmission.ts`
- [ ] T038 POST /api/v1/transmission/sync/session endpoint in `src/api/transmission.ts`
- [ ] T039 GET /api/v1/transmission/sync/session/{sessionId} endpoint in `src/api/transmission.ts`

### UI Components
- [ ] T040 [P] TransmissionModeToggle component in `src/components/TransmissionModeToggle.tsx`
- [ ] T041 [P] ConnectionStatus component in `src/components/ConnectionStatus.tsx`
- [ ] T042 [P] PeerDiscovery component in `src/components/PeerDiscovery.tsx`
- [ ] T043 Extend PageBuilder for real-time collaboration in `src/components/PageBuilder/GridCanvas.tsx`

### Integration with Existing Systems
- [ ] T044 Extend Station model for WebRTC configuration in `src/lib/database/models/Station.ts`
- [ ] T045 Extend MeshNode model for dual-mode routing in `src/lib/database/models/MeshNode.ts`
- [ ] T046 Extend QSOLog model for transmission mode tracking in `src/lib/database/models/QSOLog.ts`

## Phase 3.5: Polish

### Unit Tests
- [ ] T047 [P] Unit tests for WebRTC peer connection in `src/test/unit/webrtc-transport/WebRTCPeer.test.ts`
- [ ] T048 [P] Unit tests for signaling client in `src/test/unit/webrtc-transport/SignalingClient.test.ts`
- [ ] T049 [P] Unit tests for mode switching in `src/test/unit/transmission-mode/ModeManager.test.ts`
- [ ] T050 [P] Unit tests for fallback detection in `src/test/unit/transmission-mode/FallbackDetector.test.ts`
- [ ] T051 [P] Unit tests for collaboration sync in `src/test/unit/transmission-mode/CollaborationSync.test.ts`

### Performance and Validation
- [ ] T052 Performance validation: 1MB/s WebRTC vs 14.4kbps RF throughput testing
- [ ] T053 Performance validation: <500ms collaboration update propagation testing
- [ ] T054 Performance validation: <10s automatic fallback timing testing
- [ ] T055 FCC compliance validation: station identification in WebRTC mode testing

### Documentation and Deployment
- [ ] T056 [P] Signaling server deployment guide in `signaling-server/README.md`
- [ ] T057 [P] Update main CLAUDE.md with WebRTC transmission capabilities
- [ ] T058 Run complete quickstart validation scenarios from `specs/014-webrtc-transmission-mode/quickstart.md`

## Dependencies

### Sequential Dependencies
- Setup (T001-T004) before Tests (T005-T010)
- Tests (T005-T010) before Implementation (T011-T046)
- Models (T011-T017) before Libraries (T021-T030)
- Libraries (T021-T030) before API Endpoints (T031-T039)
- Signaling Server (T018-T020) before WebRTC Integration (T021-T025)
- Core Implementation (T011-T046) before Polish (T047-T058)

### Specific Blocking Dependencies
- T018 blocks T023 (signaling server before signaling client)
- T021 blocks T031-T039 (WebRTC peer before API endpoints)
- T026 blocks T031-T032 (mode manager before mode endpoints)
- T043 blocks T009 (collaboration UI before collaboration integration test)

## Parallel Execution Examples

### Phase 3.2: All Contract/Integration Tests
```bash
# Launch T005-T010 together (all different test files):
Task: "Contract test WebSocket signaling protocol in src/test/contract/signaling-protocol.contract.test.ts"
Task: "Contract test transmission mode API in src/test/contract/transmission-mode-api.contract.test.ts"
Task: "Integration test local network WebRTC connection in src/test/integration/local-webrtc-connection.test.ts"
Task: "Integration test internet WebRTC via signaling server in src/test/integration/internet-webrtc-connection.test.ts"
Task: "Integration test real-time collaboration sync in src/test/integration/realtime-collaboration.test.ts"
Task: "Integration test automatic fallback to RF in src/test/integration/automatic-fallback.test.ts"
```

### Phase 3.3: All Data Models
```bash
# Launch T011-T017 together (all different model files):
Task: "TransmissionMode model in src/lib/database/models/TransmissionMode.ts"
Task: "WebRTCPeer model in src/lib/database/models/WebRTCPeer.ts"
Task: "SignalingConnection model in src/lib/database/models/SignalingConnection.ts"
Task: "NetworkDiscovery model in src/lib/database/models/NetworkDiscovery.ts"
Task: "SyncSession model in src/lib/database/models/SyncSession.ts"
Task: "LocalPeer model in src/lib/database/models/LocalPeer.ts"
Task: "InternetPeer model in src/lib/database/models/InternetPeer.ts"
```

### Phase 3.4: UI Components (after core libraries)
```bash
# Launch T040-T042 together (different component files):
Task: "TransmissionModeToggle component in src/components/TransmissionModeToggle.tsx"
Task: "ConnectionStatus component in src/components/ConnectionStatus.tsx"
Task: "PeerDiscovery component in src/components/PeerDiscovery.tsx"
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify tests fail before implementing (TDD requirement)
- Commit after each task completion
- WebRTC requires HTTPS context for browser APIs
- Signaling server uses native WebSocket (no Socket.io dependency)
- Maintain FCC Part 97 compliance throughout implementation

## Task Generation Rules Applied

1. **From Contracts**: 2 contract files → 2 contract test tasks [P]
2. **From Data Model**: 7 entities → 7 model creation tasks [P]
3. **From Quickstart**: 4 scenarios → 4 integration test tasks [P]
4. **From Plan**: WebRTC transport + transmission mode libraries → core implementation tasks
5. **Ordering**: Setup → Tests → Models → Libraries → API → UI → Polish
6. **Parallelization**: Different files marked [P], same file sequential

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T005-T006)
- [x] All entities have model tasks (T011-T017)
- [x] All tests come before implementation (T005-T010 before T011+)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD enforced: tests must fail before implementation
- [x] WebRTC performance targets included (1MB/s, <500ms, <10s fallback)
- [x] FCC compliance validation included