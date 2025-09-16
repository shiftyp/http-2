# Implementation Plan: Distributed Servers for Internet Resilience

**Branch**: `017-webrtc-application-transfer` | **Date**: 2025-09-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-webrtc-application-transfer/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Enable decentralized HTTP-over-radio network operation during internet outages via PWA-bundled local server binaries that form a distributed mesh network. Licensed amateur radio operators can run local servers that provide WebRTC signaling, certificate authority services, and content synchronization capabilities.

## Technical Context
**Language/Version**: TypeScript 5.x (PWA), Node.js 20+ (Server Binary)
**Primary Dependencies**: React 18 (PWA), Express/ws (Server), SQLite3 (embedded DB), mdns (discovery)
**Storage**: SQLite (certificates), IndexedDB (PWA state), No server-side application state
**Testing**: Vitest (PWA), Jest (Server), Integration tests with mock radios
**Target Platform**: PWA (all browsers), Server binaries (Windows/macOS/Linux x64/arm64)
**Project Type**: web - PWA frontend + native server backend
**Performance Goals**: <5s discovery time, 100-1000 concurrent WebSocket connections, <500ms signaling relay
**Constraints**: Server binary <10MB, Stateless operation, Offline-capable indefinitely
**Scale/Scope**: 50+ distributed servers in mesh, Certificate chain verification, mDNS/RF discovery

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (PWA frontend, server binary)
- Using framework directly? YES (Express, React, SQLite directly)
- Single data model? YES (Certificates only, no DTOs)
- Avoiding patterns? YES (No unnecessary abstractions)

**Architecture**:
- EVERY feature as library? YES
  - `/src/lib/server-manager/` - Server discovery and connection
  - `/src/lib/certificate-verifier/` - Certificate chain validation
  - `/src/lib/signaling-client/` - WebRTC signaling client
  - `/server/lib/certificate-store/` - SQLite certificate management
  - `/server/lib/mdns-discovery/` - mDNS advertisement/discovery
  - `/server/lib/signaling-relay/` - WebSocket message relay
- CLI per library: Server binary with --help/--version/--port/--cert-dir
- Library docs: llms.txt format planned? YES

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES (tests first)
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (actual SQLite, WebSocket connections)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? YES (server logs, PWA console)
- Frontend logs → backend? YES (via WebSocket to server)
- Error context sufficient? YES (callsign, timestamp, operation)

**Versioning**:
- Version number assigned? YES (1.0.0 initial)
- BUILD increments on every change? YES
- Breaking changes handled? N/A (first version)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh [claude|gemini|copilot]` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Server binary tasks:
  - SQLite schema and certificate store [P]
  - WebSocket signaling relay [P]
  - mDNS discovery service [P]
  - HTTP API endpoints [P]
- PWA library tasks:
  - Server discovery client [P]
  - Certificate verifier [P]
  - Signaling WebSocket client [P]
- Integration test tasks:
  - Server initialization flow
  - Certificate chain validation
  - WebRTC signaling relay
  - Multi-server coordination

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → Implementation
- Parallel tracks: Server binary and PWA libraries can be developed in parallel
- Dependencies: Certificate system before CA features, discovery before coordination
- Mark [P] for parallel execution (independent libraries)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md
- 10-12 server binary tasks
- 8-10 PWA library tasks
- 10-12 test tasks
- 2-3 build/packaging tasks

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (none required) ✅

**Artifacts Generated**:
- research.md - Technology decisions and best practices ✅
- data-model.md - Core entities and relationships ✅
- contracts/server-api.yaml - OpenAPI specification ✅
- contracts/websocket-messages.yaml - WebSocket message schemas ✅
- quickstart.md - User validation guide ✅

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*