# Implementation Plan: Protocol Buffers for All Transmissions

**Branch**: `003-protocol-buffers-for` | **Date**: 2025-09-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-protocol-buffers-for/spec.md`

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
Enable all dynamic data transmissions over ham radio to use Protocol Buffers with dynamically generated schema definitions sent before data. This reduces bandwidth usage through efficient binary encoding while maintaining interoperability across different station versions.

## Technical Context
**Language/Version**: TypeScript 5.x / ES2022
**Primary Dependencies**: protobufjs (browser-compatible protobuf library), existing compression lib (Brotli)
**Storage**: IndexedDB for schema caching (session-based)
**Testing**: Vitest with existing test infrastructure
**Target Platform**: Browser (Progressive Web App)
**Project Type**: single (PWA with libraries in src/lib/)
**Performance Goals**: 50-70% size reduction vs JSON, <100ms schema generation
**Constraints**: 2.8kHz bandwidth limit, FCC Part 97 compliance, browser-only environment
**Scale/Scope**: Support 100+ concurrent schema types, 10KB max schema size

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (single PWA project)
- Using framework directly? YES (protobufjs without wrappers)
- Single data model? YES (schema definitions + binary data)
- Avoiding patterns? YES (direct protobuf usage, no abstraction layers)

**Architecture**:
- EVERY feature as library? YES (new lib: protocol-buffers)
- Libraries listed:
  - protocol-buffers: Dynamic protobuf schema generation and encoding/decoding
- CLI per library: protocol-buffers CLI with --encode/--decode/--schema commands
- Library docs: llms.txt format planned? YES

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (actual protobuf library, IndexedDB)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase - UNDERSTOOD

**Observability**:
- Structured logging included? YES (schema cache hits/misses, generation times)
- Frontend logs → backend? N/A (PWA only)
- Error context sufficient? YES (schema IDs, decode errors, request failures)

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? YES (schema re-request on decode failure)

## Project Structure

### Documentation (this feature)
```
specs/003-protocol-buffers-for/
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
    └── protocol-buffers/    # NEW library for this feature
        ├── index.ts
        ├── schema-generator.ts
        ├── encoder.ts
        ├── decoder.ts
        ├── cache.ts
        └── cli.ts

tests/
├── contract/
│   └── protocol-buffers/
├── integration/
│   └── protocol-buffers/
└── unit/
    └── protocol-buffers/
```

**Structure Decision**: Option 1 (Single PWA project) - matches existing codebase structure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Best protobuf library for browser environment
   - Dynamic schema generation strategies
   - Optimal caching strategies for session-based storage
   - Integration with existing ham-server transmission flow

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research browser-compatible protobuf libraries"
     Task: "Find best practices for dynamic protobuf schema generation"
     Task: "Research session-based caching patterns in IndexedDB"
     Task: "Analyze ham-server transmission pipeline for integration points"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - SchemaDefinition: ID, version, proto content, timestamp
   - BinaryTransmission: schema ID, encoded data, compression type
   - SchemaCache: session-based storage with TTL
   - TransmissionPacket: combined schema + data unit

2. **Generate API contracts** from functional requirements:
   - Schema generation endpoint (internal)
   - Schema request endpoint (over radio)
   - Data encoding/decoding interfaces
   - Cache management interfaces
   - Output to `/contracts/`

3. **Generate contract tests** from contracts:
   - Test schema generation for various data types
   - Test encoding/decoding round trips
   - Test cache hit/miss scenarios
   - Test schema request flows

4. **Extract test scenarios** from user stories:
   - First transmission with new schema
   - Cached schema reuse
   - Schema request on decode failure
   - Session-based cache eviction

5. **Update agent file incrementally** (O(1) operation):
   - Add protocol-buffers library to CLAUDE.md
   - Update recent changes section
   - Keep under 150 lines

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

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
| None | N/A | N/A |

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