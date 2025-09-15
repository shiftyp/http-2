# Implementation Plan: Mesh DL Protocol for Ham Radio Networks

**Branch**: `013-bit-mesh-dl-protocol` | **Date**: 2025-09-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/workspaces/http-2/specs/013-bit-mesh-dl-protocol/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Loaded BitTorrent protocol spec for ham radio mesh networks
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Detected PWA with existing TypeScript/React architecture
   → Set Structure Decision to Option 1 (single project - extending existing)
3. Evaluate Constitution Check section below ✓
   → No violations detected - using existing library pattern
   → Update Progress Tracking: Initial Constitution Check ✓
4. Execute Phase 0 → research.md ✓
   → Resolved clarifications: chunk sizes, incentive mechanisms, retention policy
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
6. Re-evaluate Constitution Check section ✓
   → No new violations - extends existing mesh networking
   → Update Progress Tracking: Post-Design Constitution Check ✓
7. Plan Phase 2 → Task generation approach described ✓
8. STOP - Ready for /tasks command ✓
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Implement Mesh DL content distribution for ham radio mesh networks to enable efficient, fault-tolerant downloads of web pages and files across amateur radio stations. System splits content into 1KB chunks, discovers peer stations with content pieces, and downloads from multiple sources simultaneously while handling signal propagation changes and station availability. Integrates with existing AODV mesh routing and respects amateur radio bandwidth constraints.

## Technical Context
**Language/Version**: TypeScript 5.x with ES2022 modules
**Primary Dependencies**: React 18, IndexedDB, Web Audio API, Web Serial API, WebRTC APIs, SDR.js or similar, existing mesh-networking library
**Storage**: IndexedDB for chunk cache, content index, and transfer sessions
**Testing**: Vitest with existing test infrastructure and mock radio simulation
**Target Platform**: Progressive Web App (browser-based, offline-capable)
**Project Type**: Single (extending existing PWA architecture)
**Performance Goals**: <2s chunk discovery, <10s full page assembly, 80%+ compression maintenance
**Constraints**: 2.8kHz bandwidth limit, FCC Part 97 compliance, emergency traffic priority
**Scale/Scope**: Support 10+ mesh nodes, 100+ cached chunks, 5 concurrent transfers, 5-band spectrum monitoring, WebRTC swarm coordination

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (extending existing PWA - no new projects needed) ✓
- Using framework directly? Yes (React, IndexedDB APIs) ✓
- Single data model? Yes (unified content/chunk/peer model) ✓
- Avoiding patterns? Yes (no Repository/UoW - direct IndexedDB) ✓

**Architecture**:
- EVERY feature as library? Yes (src/lib/mesh-dl-protocol/) ✓
- Libraries listed: mesh-dl-protocol (chunking, discovery, routing), content-cache (storage), chunk-transfer (download/upload), spectrum-monitor (SDR), webrtc-swarm (peer management), band-manager (frequency allocation) ✓
- CLI per library: N/A (PWA-based, UI controls instead) ✓
- Library docs: Will follow existing patterns in lib/ ✓

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (following existing TDD) ✓
- Git commits show tests before implementation? Yes ✓
- Order: Contract→Integration→E2E→Unit strictly followed? Yes ✓
- Real dependencies used? Yes (IndexedDB, mock radios for integration) ✓
- Integration tests for: mesh networking, chunk transfer, peer discovery, spectrum monitoring, WebRTC swarm coordination, band management ✓
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? Yes (console logging with context) ✓
- Frontend logs → backend? N/A (PWA only) ✓
- Error context sufficient? Yes (chunk failures, peer disconnections) ✓

**Versioning**:
- Version number assigned? Part of existing PWA versioning ✓
- BUILD increments on every change? Yes (existing build process) ✓
- Breaking changes handled? Yes (backward compatibility maintained) ✓

## Project Structure

### Documentation (this feature)
```
specs/013-bit-mesh-dl-protocol/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Extending existing single project structure
src/
├── lib/
│   ├── mesh-dl-protocol/     # NEW: Mesh DL protocol
│   ├── content-cache/        # NEW: Chunk and content caching
│   ├── chunk-transfer/       # NEW: P2P chunk downloads
│   ├── spectrum-monitor/     # NEW: Wide-band SDR monitoring
│   ├── webrtc-swarm/         # NEW: WebRTC peer coordination
│   ├── band-manager/         # NEW: Ham radio frequency management
│   └── mesh-networking/      # EXISTING: Extend with peer discovery
├── components/
│   ├── TorrentStatus/        # NEW: Download progress UI
│   ├── SpectrumMonitor/      # NEW: SDR monitoring display
│   └── BandManager/          # NEW: Frequency management UI
├── pages/
│   ├── Downloads.tsx         # NEW: Transfer management page
│   └── Spectrum.tsx          # NEW: Spectrum monitoring page
└── workers/
    ├── chunk-analyzer.worker.ts  # NEW: Background chunk processing
    ├── spectrum-analyzer.worker.ts  # NEW: SDR signal processing
    └── webrtc-coordinator.worker.ts  # NEW: WebRTC connection management

tests/
├── contract/
│   ├── mesh-dl-protocol.test.ts
│   ├── spectrum-monitor.test.ts
│   └── webrtc-swarm.test.ts
├── integration/
│   ├── chunk-transfer.test.ts
│   ├── spectrum-monitoring.test.ts
│   └── webrtc-coordination.test.ts
└── unit/
    ├── content-cache.test.ts
    ├── band-manager.test.ts
    └── signal-processing.test.ts
```

**Structure Decision**: Option 1 (single project) - extends existing PWA architecture

## Phase 0: Outline & Research

**Research Tasks Completed**:

1. **Chunk size optimization for ham radio constraints**:
   - **Decision**: 1KB (1024 bytes) chunk size
   - **Rationale**: Balances transmission efficiency (fits in single 2400bps packet ~3.4s) with overhead minimization
   - **Alternatives considered**: 512B (too much overhead), 2KB (too large for poor conditions), 4KB (exceeds amateur radio practical limits)

2. **Incentive mechanisms for amateur radio context**:
   - **Decision**: Fair sharing with emergency priority
   - **Rationale**: Commercial incentives prohibited by FCC Part 97, but fair sharing encourages participation
   - **Alternatives considered**: Reputation systems (too complex), forced sharing (against amateur spirit), no incentives (leads to freeloaders)

3. **Cache retention and concurrent transfer limits**:
   - **Decision**: 7-day retention, 3 concurrent downloads, 2 concurrent uploads
   - **Rationale**: Balances storage with availability, prevents bandwidth saturation
   - **Alternatives considered**: Longer retention (storage issues), unlimited concurrent (bandwidth problems)

4. **Integration with existing mesh networking**:
   - **Decision**: Extend AODV router with peer discovery, integrate with existing MeshNetwork class
   - **Rationale**: Leverages existing route discovery and station tracking
   - **Alternatives considered**: Separate DHT (duplicates effort), manual peer lists (not scalable)

5. **Wide-band spectrum monitoring architecture**:
   - **Decision**: Real-time SDR monitoring of all 5 ham radio bands (40m, 20m, 80m, 15m, 30m)
   - **Rationale**: Automatic content discovery and caching, builds distributed availability map
   - **Alternatives considered**: Single-band monitoring (limited discovery), manual scan (inefficient)

6. **WebRTC swarm coordination vs RF BitTorrent**:
   - **Decision**: Mode-adaptive approach - WebRTC direct downloads for high bandwidth, RF chunking for radio transmission
   - **Rationale**: Leverages optimal protocol for each transmission medium (1MB/s WebRTC vs 14.4kbps RF)
   - **Alternatives considered**: WebRTC-only (no RF fallback), RF-only (bandwidth limited), hybrid manual switching (poor UX)

7. **Ham radio band plan and frequency management**:
   - **Decision**: Dedicated 10kHz ranges per band with automatic switching based on propagation
   - **Rationale**: Prevents interference, optimizes for band characteristics (40m regional, 20m DX, etc.)
   - **Alternatives considered**: Single frequency (congestion), manual band selection (requires operator knowledge)

**Output**: All NEEDS CLARIFICATION resolved ✓

## Phase 1: Design & Contracts

### Data Model (data-model.md)
**Entities**:
- **ContentChunk**: id, contentHash, chunkIndex, data (Uint8Array), size, verified
- **ContentMetadata**: contentHash, totalChunks, totalSize, mimeType, filename, createdAt
- **PeerStation**: callsign, meshAddress, lastSeen, availableChunks, signalQuality, transmissionMode
- **TransferSession**: sessionId, contentHash, direction, completedChunks, peers, status, mode
- **ChunkAvailability**: contentHash, chunkIndex, availablePeers, lastUpdated
- **SpectrumSignal**: frequency, bandwidth, signalType, callsign, timestamp, decodedContent
- **BandConditions**: band, frequency, propagation, noise, traffic, lastUpdated
- **WebRTCPeer**: peerId, callsign, connectionState, dataChannels, capabilities
- **CQBeacon**: callsign, chunks, routes, cache, request, timestamp, hopCount, path

### API Contracts (contracts/)
**Core Operations**:
- `GET /mesh-dl/discover/{contentHash}` - Find peers with content
- `POST /mesh-dl/announce` - Announce chunk availability
- `GET /mesh-dl/chunk/{contentHash}/{chunkIndex}` - Download specific chunk
- `POST /mesh-dl/chunk/{contentHash}/{chunkIndex}` - Upload chunk to peer
- `GET /mesh-dl/status/{sessionId}` - Get transfer progress

**Spectrum Monitoring**:
- `GET /spectrum/signals` - Get current spectrum activity
- `POST /spectrum/monitor/{band}` - Start monitoring specific band
- `GET /spectrum/beacons` - Get discovered CQ beacons
- `GET /spectrum/content` - Get discovered content availability

**WebRTC Swarm**:
- `POST /webrtc/connect/{callsign}` - Establish WebRTC connection
- `GET /webrtc/peers` - List active WebRTC connections
- `POST /webrtc/transfer/{contentHash}` - Initiate direct download
- `GET /webrtc/capabilities/{peerId}` - Get peer capabilities

**Band Management**:
- `GET /bands/conditions` - Get propagation conditions
- `POST /bands/switch/{band}` - Switch to specific band
- `GET /bands/usage` - Get current band usage statistics

### Integration Points
- Extends `MeshNetwork` class with peer discovery and spectrum monitoring
- Uses existing `compression-analyzer.worker.ts` for chunk processing
- Integrates with `IndexedDB` wrapper for persistence
- Leverages existing `radio-control` for transmission and SDR interface
- Integrates with WebRTC APIs for high-bandwidth peer connections
- Uses existing `AODV` routing with enhanced CQ beacon protocol
- Extends existing `certificate-authority` for WebRTC peer authentication

### Test Coverage Plan
- Contract tests: API schema validation for all endpoints
- Integration tests: End-to-end chunk transfer, spectrum monitoring, WebRTC coordination
- Unit tests: Individual chunk operations, signal processing, band management
- Mock radio simulation for mesh network testing
- Mock SDR for spectrum monitoring testing
- Mock WebRTC for peer connection testing
- Performance tests: Multi-band monitoring, concurrent transfer limits

**Output**: data-model.md, contracts/, failing tests, quickstart.md, CLAUDE.md updated ✓

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load existing TDD patterns from project
- Generate tasks from Phase 1 design (35-40 tasks estimated)
- Each contract → contract test task [P]
- Each entity → model/service task [P]
- Integration with existing mesh networking
- Spectrum monitoring and SDR integration
- WebRTC swarm coordination and peer management
- Band management and frequency allocation
- UI components for transfer, spectrum, and band management

**Ordering Strategy**:
- TDD order: Tests before implementation
- Foundation first: data models, then services, then integration
- Parallel tasks marked [P] for independent development
- Integration tasks depend on both new and existing systems

**Estimated Output**: 35-40 numbered tasks in tasks.md following TDD principles

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (tasks.md creation)
**Phase 4**: Implementation (TDD execution following constitutional principles)
**Phase 5**: Validation (integration testing with mock radios, performance benchmarking)

## Complexity Tracking
*No constitutional violations detected - no entries needed*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*