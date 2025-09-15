# Implementation Plan: CQ Sitemaps for Content Discovery

**Branch**: `010-cq-sitemaps` | **Date**: 2025-09-15 | **Spec**: [link](spec.md)
**Input**: Feature specification from `/workspaces/http-2/specs/010-cq-sitemaps/spec.md`

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
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
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
Primary requirement: Enable content discovery across mesh network via periodic sitemap broadcasts, reducing bandwidth waste from 404 errors and enabling intelligent content-aware routing. Technical approach: Extend existing mesh-networking library with sitemap message type, integrate with ham-server for content inventory, cache in IndexedDB for query interface.

## Technical Context
**Language/Version**: TypeScript 5.x with ES2022 modules
**Primary Dependencies**: React 18, IndexedDB, Web Audio API, Web Serial API
**Storage**: IndexedDB for sitemap cache and content discovery index
**Testing**: Vitest with contract/integration/unit test suites
**Target Platform**: Progressive Web App (browser-based)
**Project Type**: web - React PWA with radio networking libraries
**Performance Goals**: <500ms sitemap query response, <1s broadcast transmission time
**Constraints**: 2.8kHz bandwidth limit, FCC Part 97 compliance, compression-first design
**Scale/Scope**: 10+ concurrent mesh nodes, 50+ content items per sitemap

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA with radio libraries)
- Using framework directly? Yes (React 18, IndexedDB, Web Audio)
- Single data model? Yes (sitemap entries with metadata)
- Avoiding patterns? Yes (direct mesh integration, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes (cq-sitemaps as standalone library)
- Libraries listed:
  - cq-sitemaps: Sitemap broadcasting and caching
  - sitemap-discovery: Content query interface
- CLI per library: N/A (browser-based PWA)
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual IndexedDB, mesh networking)
- Integration tests for: mesh message propagation, cache operations, discovery queries
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (sitemap broadcast/receive events)
- Frontend logs → backend? N/A (PWA-only)
- Error context sufficient? Yes (broadcast failures, cache errors)

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (mesh protocol compatibility)

## Project Structure

### Documentation (this feature)
```
specs/010-cq-sitemaps/
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
├── lib/
│   ├── cq-sitemaps/         # New library for sitemap broadcasting
│   ├── sitemap-discovery/   # New library for content queries
│   ├── mesh-networking/     # Existing - extend with sitemap messages
│   ├── database/           # Existing - extend with sitemap cache
│   └── ham-server/         # Existing - integrate for content inventory
├── components/
│   └── SitemapBrowser/     # UI component for content discovery
└── pages/
    └── ContentDiscovery.tsx # Page for browsing available content

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Option 1 (single PWA project) - matches existing HTTP-over-radio architecture

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - Bandwidth limits for sitemap size (FR-005)
   - Station timeout detection method (FR-007)
   - Loop prevention mechanism (FR-008)
   - Broadcast frequency timing (FR-010)

2. **Generate and dispatch research agents**:
   ```
   Task: "Research optimal sitemap broadcast timing for 2.8kHz mesh networks"
   Task: "Find mesh loop prevention patterns for content discovery protocols"
   Task: "Research bandwidth-optimized sitemap compression techniques"
   Task: "Find station timeout detection methods in AODV mesh networks"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - SitemapEntry: URL, size, ETag, timestamp, callsign
   - SitemapCache: TTL tracking, freshness indicators
   - CQSitemapMessage: Broadcast format with propagation metadata
   - ContentDiscoveryIndex: Queryable aggregated index

2. **Generate API contracts** from functional requirements:
   - Sitemap broadcast API (FR-001)
   - Cache management API (FR-003)
   - Content query API (FR-006)
   - Mesh integration API (FR-009)
   - Output TypeScript interfaces to `/contracts/`

3. **Generate contract tests** from contracts:
   - Sitemap message serialization/deserialization
   - Cache storage and retrieval operations
   - Content discovery query responses
   - Mesh propagation behavior
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Sitemap broadcast and reception
   - Content discovery without network requests
   - Intelligent request routing
   - Cache staleness handling

5. **Update CLAUDE.md incrementally**:
   - Add cq-sitemaps and sitemap-discovery libraries
   - Update mesh-networking extensions
   - Preserve existing context markers
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Data models → Libraries → Integration → UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations identified*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*