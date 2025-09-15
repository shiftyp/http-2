# Implementation Plan: WebRTC Transmission Mode with Native WebSocket Signaling

**Branch**: `014-webrtc-transmission-mode` | **Date**: 2025-09-15 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-webrtc-transmission-mode/spec.md`

## Summary
Enable ham radio operators to switch between radio frequency transmission and high-speed WebRTC (local network + internet) for data transfer while maintaining the same HTTP-over-radio protocol. Uses native WebSocket signaling server (no Socket.io) for internet connections and achieves 1MB/s WebRTC vs 14.4kbps RF performance.

## Technical Context
**Language/Version**: TypeScript 5.x with ES2022 modules
**Primary Dependencies**: React 18, WebRTC APIs (RTCPeerConnection, RTCDataChannel), native WebSocket (ws library)
**Storage**: IndexedDB via existing logbook API for connection state and peer discovery
**Testing**: Vitest for unit/integration tests with WebRTC mock infrastructure
**Target Platform**: Browser PWA with Web APIs (WebRTC, WebSocket, IndexedDB)
**Project Type**: Library-first PWA with core libraries in `src/lib/`
**Performance Goals**: 1MB/s WebRTC vs 14.4kbps RF, real-time synchronization, < 500ms connection switching
**Constraints**: FCC Part 97 compliance, native WebSocket signaling (no Socket.io), automatic fallback to RF
**Scale/Scope**: 10+ concurrent mesh nodes, dual-mode transmission system integration

## Constitution Check

**Simplicity**:
- Projects: 2 (PWA libraries + signaling server)
- Using framework directly? Yes (React 18, WebRTC APIs, native WebSocket)
- Single data model? Yes (extending existing Station/Connection models)
- Avoiding patterns? Yes (direct WebRTC integration, no wrapper layers)

**Architecture**:
- EVERY feature as library? Yes (webrtc-transport, transmission-mode libraries)
- Libraries listed: webrtc-transport (peer connection management), transmission-mode (mode switching logic), signaling-server (native WebSocket)
- CLI per library: Not applicable (PWA with UI controls)
- Library docs: Will follow existing lib/ documentation patterns

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (tests first for WebRTC connection logic)
- Git commits show tests before implementation? Required
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual WebRTC APIs with mock peers for testing)
- Integration tests for: WebRTC peer discovery, mode switching, fallback scenarios
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (extending existing radio-control logging)
- Frontend logs → backend? Yes (unified logging stream to logbook)
- Error context sufficient? Yes (WebRTC connection state, peer status)

**Versioning**:
- Version number assigned? Feature increment within existing version scheme
- BUILD increments on every change? Yes (following existing CI/CD)
- Breaking changes handled? No breaking changes (additive dual-mode feature)

## Project Structure

### Documentation (this feature)
```
specs/014-webrtc-transmission-mode/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── lib/
│   ├── webrtc-transport/        # NEW: WebRTC peer connection management
│   ├── transmission-mode/       # NEW: Mode switching logic
│   └── [existing libs extend]   # Extend radio-control, mesh-networking
├── components/
│   ├── TransmissionModeToggle/  # NEW: UI for mode switching
│   ├── ConnectionStatus/        # NEW: Real-time connection indicators
│   └── [existing components]    # Extend PageBuilder for real-time sync
└── pages/
    └── [existing pages]         # Add transmission mode controls

signaling-server/                 # NEW: Native WebSocket signaling server
├── server.js                   # Main WebSocket server (native ws)
├── package.json                # Minimal dependencies
└── README.md                   # Deployment guide

tests/
├── contract/                    # WebRTC API contract tests
├── integration/                 # Dual-mode integration tests
└── unit/                       # WebRTC transport unit tests
```

**Structure Decision**: Extends existing PWA library architecture with new WebRTC transport libraries and standalone signaling server

## Phase 0: Outline & Research

**Output**: research.md with all technical decisions resolved

## Phase 1: Design & Contracts

1. **Extract entities from feature spec** → `data-model.md`:
   - TransmissionMode (RF/WebRTC state management)
   - WebRTCPeer (peer connection wrapper)
   - SignalingConnection (WebSocket signaling client)
   - NetworkDiscovery (local/internet peer discovery)
   - SyncSession (real-time collaboration state)

2. **Generate API contracts** from functional requirements:
   - Mode switching endpoints (toggle, status)
   - Peer discovery API (local network scan)
   - WebRTC connection management (connect, disconnect, status)
   - Real-time sync protocol (collaboration sessions)
   - Signaling server protocol (WebSocket message schemas)
   - Output OpenAPI schemas to `/contracts/`

3. **Generate contract tests** from contracts:
   - WebRTC API endpoint tests
   - WebSocket signaling protocol tests
   - Mode switching behavior tests
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each acceptance scenario → integration test
   - Quickstart validation for dual-mode operation

5. **Update CLAUDE.md** with WebRTC functionality:
   - Add WebRTC libraries to architecture
   - Update transmission mode capabilities
   - Document native WebSocket signaling approach
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (WebRTC contracts, transmission mode data model)
- Each WebRTC contract → contract test task [P]
- Each entity (TransmissionMode, WebRTCPeer) → model creation task [P]
- Signaling server → separate Node.js project setup and implementation
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: All tests before implementation
- Dependencies: Signaling server → WebRTC client → UI integration
- Mark [P] for parallel execution (independent WebRTC and signaling components)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No Constitution Check violations identified*

## Progress Tracking

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
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*