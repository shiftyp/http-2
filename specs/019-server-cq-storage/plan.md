# Implementation Plan: Server CQ Storage

**Branch**: `019-server-cq-storage` | **Date**: 2025-09-18 | **Spec**: `/specs/019-server-cq-storage/spec.md`
**Input**: Feature specification from `/specs/019-server-cq-storage/spec.md`

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
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
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
Enable WebRTC clients to discover content announced via RF CQ beacons by implementing a persistent content registry at the signaling server. The registry uses a shared consolidation schema between server (1GB storage) and clients (50MB browser storage) with disaster-oriented tiered retention policies and path aggregation to reduce storage by 80%.

## Technical Context
**Language/Version**: TypeScript 5.x (PWA), Node.js 20+ (Server)
**Primary Dependencies**: ws (WebSocket server), SQLite3 (persistent storage), IndexedDB (client storage)
**Storage**: SQLite for server registry (1GB limit), IndexedDB for client cache (50MB limit)
**Testing**: Vitest for unit/integration tests, contract tests for API
**Target Platform**: Node.js signaling server, Browser PWA clients
**Project Type**: web - signaling server enhancement + client library
**Performance Goals**: <100ms hash lookups, <500ms wildcard searches, 1000+ concurrent connections
**Constraints**: 1GB server storage, 50MB browser storage, disaster-oriented retention
**Scale/Scope**: 500,000 consolidated entries, 10,000 active stations

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (signaling-server, client library) ✓
- Using framework directly? Yes - ws library directly, no wrappers ✓
- Single data model? Yes - ConsolidatedBeacon shared schema ✓
- Avoiding patterns? Yes - direct SQLite/IndexedDB access ✓

**Architecture**:
- EVERY feature as library? Yes - content-registry library ✓
- Libraries listed:
  - content-registry: Shared beacon consolidation and storage
  - priority-tiers: Content priority classification
- CLI per library: content-registry --list, --expire, --stats ✓
- Library docs: llms.txt format planned? Yes ✓

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes ✓
- Git commits show tests before implementation? Yes ✓
- Order: Contract→Integration→E2E→Unit strictly followed? Yes ✓
- Real dependencies used? SQLite, WebSocket server ✓
- Integration tests for: new libraries, contract changes, shared schemas? Yes ✓
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? Yes - registry operations logged ✓
- Frontend logs → backend? Yes - client cache events to server ✓
- Error context sufficient? Yes - station, content hash, operation ✓

**Versioning**:
- Version number assigned? 1.0.0 ✓
- BUILD increments on every change? Yes ✓
- Breaking changes handled? Schema migrations planned ✓

## Project Structure

### Documentation (this feature)
```
specs/019-server-cq-storage/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (signaling server + client)
signaling-server/
├── src/
│   ├── models/
│   │   └── ConsolidatedBeacon.js
│   ├── services/
│   │   ├── ContentRegistry.js
│   │   └── PriorityManager.js
│   └── api/
│       └── content-endpoints.js
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

src/lib/
├── content-registry/
│   ├── ConsolidatedBeacon.ts
│   ├── ContentRegistry.ts
│   └── index.ts
└── priority-tiers/
    ├── PriorityClassifier.ts
    └── index.ts

tests/
├── contract/
│   └── content-registry-api.test.ts
├── integration/
│   └── beacon-consolidation.test.ts
└── unit/
```

**Structure Decision**: Option 2 - Web application (signaling server + client library)

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - SQLite schema design for 1GB efficient storage
   - IndexedDB optimization for 50MB browser limit
   - WebSocket message batching strategies
   - Path consolidation algorithms
   - Priority classification heuristics

2. **Generate and dispatch research agents**:
   ```
   Task: "Research SQLite schema for time-series beacon data with 1GB limit"
   Task: "Find IndexedDB best practices for 50MB content caching"
   Task: "Research WebSocket batching for 1000+ concurrent clients"
   Task: "Analyze path consolidation algorithms for 80% storage reduction"
   Task: "Study disaster communication priority systems (ARES/RACES)"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: SQLite with consolidated beacon table
   - Rationale: Efficient joins, built-in TTL support
   - Alternatives considered: PostgreSQL (overkill), Redis (no persistence)

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - ConsolidatedBeacon: Content with multiple paths
   - PathRecord: Individual route with quality metrics
   - PriorityTier: Classification levels P0-P5
   - StationTrust: Reputation scoring

2. **Generate API contracts** from functional requirements:
   - POST /api/content/announce - Upload beacon data
   - GET /api/content/search - Query content by hash/callsign
   - GET /api/content/batch - Batch query for efficiency
   - DELETE /api/content/{hash} - Remove expired content
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - test-announce-endpoint.js
   - test-search-endpoint.js
   - test-batch-query.js
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Hybrid station uploads RF beacon
   - WebRTC client discovers RF content
   - Duplicate beacons get consolidated
   - Emergency content survives eviction

5. **Update agent file incrementally** (O(1) operation):
   - Add content registry context to CLAUDE.md
   - Note shared schema requirement
   - Update recent changes section

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Consolidation algorithm → core implementation task
- Priority classification → implementation task
- Client library → browser storage tasks

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models → Services → API → Client
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - design follows constitutional principles*

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
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*