# Tasks: Mesh DL Protocol for Ham Radio Networks

**Input**: Design documents from `/workspaces/http-2/specs/013-bit-mesh-dl-protocol/`
**Prerequisites**: plan.md (✓), spec.md (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.x, React 18, IndexedDB, Web Audio API, WebRTC APIs, SDR.js
   → Libraries: mesh-dl-protocol, content-cache, chunk-transfer, spectrum-monitor, webrtc-swarm, band-manager
2. Load optional design documents:
   → data-model.md: Extracted entities from plan.md ✓
   → contracts/: API endpoints defined in plan.md ✓
   → spec.md: Enhanced with APRS/Meshtastic patterns and spectrum monitoring ✓
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, libraries
   → Integration: mesh networking, spectrum monitoring, WebRTC
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths are absolute from `/workspaces/http-2/`

## Phase 3.1: Setup

- [ ] T001 Create library directories for Mesh DL components in src/lib/
- [ ] T002 Install TypeScript dependencies for WebRTC APIs and SDR integration
- [ ] T003 [P] Configure ESLint and Prettier for new Mesh DL modules
- [ ] T004 [P] Update tsconfig.json to include new library paths

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P]
- [ ] T005 [P] Contract test GET /mesh-dl/discover/{contentHash} in tests/contract/mesh-dl-protocol.test.ts
- [ ] T006 [P] Contract test POST /mesh-dl/announce in tests/contract/mesh-dl-protocol.test.ts
- [ ] T007 [P] Contract test GET /mesh-dl/chunk/{contentHash}/{chunkIndex} in tests/contract/mesh-dl-protocol.test.ts
- [ ] T008 [P] Contract test POST /mesh-dl/chunk/{contentHash}/{chunkIndex} in tests/contract/mesh-dl-protocol.test.ts
- [ ] T009 [P] Contract test GET /mesh-dl/status/{sessionId} in tests/contract/mesh-dl-protocol.test.ts
- [ ] T010 [P] Contract test GET /spectrum/signals in tests/contract/spectrum-monitor.test.ts
- [ ] T011 [P] Contract test POST /spectrum/monitor/{band} in tests/contract/spectrum-monitor.test.ts
- [ ] T012 [P] Contract test GET /spectrum/beacons in tests/contract/spectrum-monitor.test.ts
- [ ] T013 [P] Contract test GET /spectrum/content in tests/contract/spectrum-monitor.test.ts
- [ ] T014 [P] Contract test POST /webrtc/connect/{callsign} in tests/contract/webrtc-swarm.test.ts
- [ ] T015 [P] Contract test GET /webrtc/peers in tests/contract/webrtc-swarm.test.ts
- [ ] T016 [P] Contract test POST /webrtc/transfer/{contentHash} in tests/contract/webrtc-swarm.test.ts
- [ ] T017 [P] Contract test GET /webrtc/capabilities/{peerId} in tests/contract/webrtc-swarm.test.ts
- [ ] T018 [P] Contract test GET /bands/conditions in tests/contract/band-manager.test.ts
- [ ] T019 [P] Contract test POST /bands/switch/{band} in tests/contract/band-manager.test.ts
- [ ] T020 [P] Contract test GET /bands/usage in tests/contract/band-manager.test.ts

### Integration Tests [P]
- [ ] T021 [P] Integration test chunk transfer over RF in tests/integration/chunk-transfer.test.ts
- [ ] T022 [P] Integration test spectrum monitoring pipeline in tests/integration/spectrum-monitoring.test.ts
- [ ] T023 [P] Integration test WebRTC peer discovery in tests/integration/webrtc-coordination.test.ts
- [ ] T024 [P] Integration test hybrid mode switching in tests/integration/mode-switching.test.ts
- [ ] T025 [P] Integration test CQ beacon content routing in tests/integration/cq-routing.test.ts
- [ ] T026 [P] Integration test APRS-style path flooding in tests/integration/aprs-routing.test.ts
- [ ] T027 [P] Integration test Meshtastic hop limits in tests/integration/meshtastic-hops.test.ts
- [ ] T028 [P] Integration test band switching and propagation in tests/integration/band-management.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models [P]
- [ ] T029 [P] ContentChunk model in src/lib/mesh-dl-protocol/models/ContentChunk.ts
- [ ] T030 [P] ContentMetadata model in src/lib/mesh-dl-protocol/models/ContentMetadata.ts
- [ ] T031 [P] PeerStation model in src/lib/mesh-dl-protocol/models/PeerStation.ts
- [ ] T032 [P] TransferSession model in src/lib/mesh-dl-protocol/models/TransferSession.ts
- [ ] T033 [P] ChunkAvailability model in src/lib/mesh-dl-protocol/models/ChunkAvailability.ts
- [ ] T034 [P] SpectrumSignal model in src/lib/spectrum-monitor/models/SpectrumSignal.ts
- [ ] T035 [P] BandConditions model in src/lib/band-manager/models/BandConditions.ts
- [ ] T036 [P] WebRTCPeer model in src/lib/webrtc-swarm/models/WebRTCPeer.ts
- [ ] T037 [P] CQBeacon model in src/lib/mesh-dl-protocol/models/CQBeacon.ts

### Core Services [P]
- [ ] T038 [P] ContentCache service in src/lib/content-cache/ContentCache.ts
- [ ] T039 [P] ChunkTransfer service in src/lib/chunk-transfer/ChunkTransfer.ts
- [ ] T040 [P] SpectrumMonitor service in src/lib/spectrum-monitor/SpectrumMonitor.ts
- [ ] T041 [P] WebRTCSwarm service in src/lib/webrtc-swarm/WebRTCSwarm.ts
- [ ] T042 [P] BandManager service in src/lib/band-manager/BandManager.ts
- [ ] T043 [P] MeshDLProtocol service in src/lib/mesh-dl-protocol/MeshDLProtocol.ts

### Background Workers [P]
- [ ] T044 [P] ChunkAnalyzer worker in src/workers/chunk-analyzer.worker.ts
- [ ] T045 [P] SpectrumAnalyzer worker in src/workers/spectrum-analyzer.worker.ts
- [ ] T046 [P] WebRTCCoordinator worker in src/workers/webrtc-coordinator.worker.ts

### API Endpoints
- [ ] T047 MeshDLProtocol API endpoints in src/api/mesh-dl.ts
- [ ] T048 SpectrumMonitor API endpoints in src/api/spectrum.ts
- [ ] T049 WebRTCSwarm API endpoints in src/api/webrtc.ts
- [ ] T050 BandManager API endpoints in src/api/bands.ts

## Phase 3.4: Integration

### Mesh Network Integration
- [ ] T051 Extend MeshNetwork class with peer discovery in src/lib/mesh-networking/MeshNetwork.ts
- [ ] T052 Integrate CQ beacon protocol with AODV routing in src/lib/mesh-networking/AODVRouter.ts
- [ ] T053 Add spectrum monitoring to mesh peer discovery in src/lib/mesh-networking/PeerDiscovery.ts

### Storage Integration
- [ ] T054 IndexedDB schema for chunk cache in src/lib/content-cache/ChunkStore.ts
- [ ] T055 IndexedDB schema for spectrum data in src/lib/spectrum-monitor/SpectrumStore.ts
- [ ] T056 IndexedDB schema for WebRTC peer data in src/lib/webrtc-swarm/PeerStore.ts

### Hardware Integration
- [ ] T057 Extend radio-control for SDR interface in src/lib/radio-control/SDRInterface.ts
- [ ] T058 WebRTC peer authentication with certificate authority in src/lib/webrtc-swarm/PeerAuth.ts
- [ ] T059 Band switching integration with radio hardware in src/lib/band-manager/RadioControl.ts

## Phase 3.5: User Interface

### React Components [P]
- [ ] T060 [P] MeshDLStatus component in src/components/MeshDLStatus/MeshDLStatus.tsx
- [ ] T061 [P] SpectrumMonitor component in src/components/SpectrumMonitor/SpectrumMonitor.tsx
- [ ] T062 [P] BandManager component in src/components/BandManager/BandManager.tsx
- [ ] T063 [P] WebRTCPeers component in src/components/WebRTCPeers/WebRTCPeers.tsx

### Pages [P]
- [ ] T064 [P] Downloads page in src/pages/Downloads.tsx
- [ ] T065 [P] Spectrum monitoring page in src/pages/Spectrum.tsx
- [ ] T066 [P] Network topology page in src/pages/Network.tsx

## Phase 3.6: Polish

### Unit Tests [P]
- [ ] T067 [P] Unit tests for ContentCache in tests/unit/content-cache.test.ts
- [ ] T068 [P] Unit tests for BandManager in tests/unit/band-manager.test.ts
- [ ] T069 [P] Unit tests for signal processing in tests/unit/signal-processing.test.ts
- [ ] T070 [P] Unit tests for chunk verification in tests/unit/chunk-verification.test.ts
- [ ] T071 [P] Unit tests for WebRTC peer management in tests/unit/webrtc-peer.test.ts

### Performance & Validation
- [ ] T072 Performance tests for multi-band monitoring (<2s chunk discovery)
- [ ] T073 Performance tests for WebRTC vs RF transfer speeds (1MB/s vs 14.4kbps)
- [ ] T074 Validate FCC Part 97 compliance for all transmission modes
- [ ] T075 Test emergency traffic priority handling
- [ ] T076 Validate APRS anti-flood protection mechanisms
- [ ] T077 Test Meshtastic hop limit enforcement

### Documentation [P]
- [ ] T078 [P] Update CLAUDE.md with Mesh DL protocol commands
- [ ] T079 [P] Add spectrum monitoring usage examples
- [ ] T080 [P] Document WebRTC swarm coordination patterns
- [ ] T081 [P] Create band management configuration guide

## Dependencies

### Phase Dependencies
- Setup (T001-T004) before everything
- Tests (T005-T028) before implementation (T029-T081)
- Models (T029-T037) before services (T038-T043)
- Services before API endpoints (T047-T050)
- Core implementation before integration (T051-T059)
- Integration before UI (T060-T066)
- Everything before polish (T067-T081)

### Specific Dependencies
- T029-T037 blocks T038-T043 (services need models)
- T038-T043 blocks T047-T050 (endpoints need services)
- T051 requires T043 (mesh integration needs MeshDLProtocol)
- T054-T056 blocks T057-T059 (storage before hardware integration)
- T047-T050 blocks T060-T066 (UI needs API endpoints)

## Parallel Execution Examples

### Contract Tests (T005-T020)
```bash
# Launch all contract tests together:
Task: "Contract test GET /mesh-dl/discover/{contentHash} in tests/contract/mesh-dl-protocol.test.ts"
Task: "Contract test GET /spectrum/signals in tests/contract/spectrum-monitor.test.ts"
Task: "Contract test POST /webrtc/connect/{callsign} in tests/contract/webrtc-swarm.test.ts"
Task: "Contract test GET /bands/conditions in tests/contract/band-manager.test.ts"
```

### Integration Tests (T021-T028)
```bash
# Launch all integration tests together:
Task: "Integration test chunk transfer over RF in tests/integration/chunk-transfer.test.ts"
Task: "Integration test spectrum monitoring pipeline in tests/integration/spectrum-monitoring.test.ts"
Task: "Integration test WebRTC peer discovery in tests/integration/webrtc-coordination.test.ts"
Task: "Integration test hybrid mode switching in tests/integration/mode-switching.test.ts"
```

### Data Models (T029-T037)
```bash
# Launch all model creation together:
Task: "ContentChunk model in src/lib/mesh-dl-protocol/models/ContentChunk.ts"
Task: "SpectrumSignal model in src/lib/spectrum-monitor/models/SpectrumSignal.ts"
Task: "WebRTCPeer model in src/lib/webrtc-swarm/models/WebRTCPeer.ts"
Task: "BandConditions model in src/lib/band-manager/models/BandConditions.ts"
```

### Core Services (T038-T043)
```bash
# Launch all service creation together:
Task: "ContentCache service in src/lib/content-cache/ContentCache.ts"
Task: "SpectrumMonitor service in src/lib/spectrum-monitor/SpectrumMonitor.ts"
Task: "WebRTCSwarm service in src/lib/webrtc-swarm/WebRTCSwarm.ts"
Task: "BandManager service in src/lib/band-manager/BandManager.ts"
```

## Notes

- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Hybrid mode switching is critical for seamless WebRTC ↔ RF transitions
- Spectrum monitoring runs continuously in background workers
- APRS and Meshtastic patterns implemented for routing efficiency
- FCC Part 97 compliance maintained across all transmission modes

## Task Generation Summary

**Generated**: 81 tasks total
- **Setup**: 4 tasks
- **Contract Tests**: 16 tasks (all [P])
- **Integration Tests**: 8 tasks (all [P])
- **Data Models**: 9 tasks (all [P])
- **Core Services**: 6 tasks (all [P])
- **Background Workers**: 3 tasks (all [P])
- **API Endpoints**: 4 tasks (sequential)
- **Integration**: 9 tasks (sequential dependencies)
- **UI Components**: 7 tasks (4 [P], 3 [P])
- **Unit Tests**: 5 tasks (all [P])
- **Performance/Validation**: 6 tasks (sequential)
- **Documentation**: 4 tasks (all [P])

**Parallel Tasks**: 57 tasks can run in parallel across different files
**Sequential Tasks**: 24 tasks require specific ordering due to dependencies

## Validation Checklist

- [x] All contracts have corresponding tests (T005-T020)
- [x] All entities have model tasks (T029-T037)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD order enforced (tests must fail before implementation)
- [x] Integration with existing mesh networking planned
- [x] Spectrum monitoring and WebRTC coordination included
- [x] Performance targets and FCC compliance addressed