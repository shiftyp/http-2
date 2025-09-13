# Implementation Plan: WebRTC Local Data Transfer

**Branch**: `002-a-feature-whereby` | **Date**: 2025-09-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-a-feature-whereby/spec.md`

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
Enable amateur radio operators to transfer complete station data (logbooks, messages, configurations, private keys) between devices on local networks using WebRTC peer-to-peer connections established via QR codes or shortcodes, with public key encryption for security and intelligent data merging.

## Technical Context
**Language/Version**: TypeScript 5.x / JavaScript ES2022
**Primary Dependencies**: WebRTC API, IndexedDB, Web Crypto API, qrcode.js, simple-peer
**Storage**: IndexedDB for station data, localStorage for connection state
**Testing**: Vitest for unit tests, Playwright for E2E tests
**Target Platform**: Progressive Web App (browser-based, offline-capable)
**Project Type**: web - frontend PWA with service worker backend
**Performance Goals**: <1 second connection establishment, 1MB/s transfer rate on local network
**Constraints**: Must work offline, no external server dependencies, 5-minute code expiration
**Scale/Scope**: Support transfers up to 1GB, handle 100k+ logbook entries

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA with service worker)
- Using framework directly? Yes (React, WebRTC APIs directly)
- Single data model? Yes (unified station data model)
- Avoiding patterns? Yes (no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes - webrtc-transfer library
- Libraries listed:
  - webrtc-transfer: P2P connection and data transfer
  - qr-shortcode: QR/shortcode generation and validation
  - station-data: Data export/import/merge logic
  - transfer-crypto: Public key encryption for transfers
- CLI per library: Each library will have test harness
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual IndexedDB, WebRTC)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test, skipping RED phase - Understood

**Observability**:
- Structured logging included? Yes
- Frontend logs → backend? Yes (to service worker)
- Error context sufficient? Yes

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (data format versioning)

## Project Structure

### Documentation (this feature)
```
specs/002-a-feature-whereby/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Progressive Web App structure
src/
├── lib/
│   ├── webrtc-transfer/     # P2P connection and data transfer
│   ├── qr-shortcode/         # QR/shortcode generation
│   ├── station-data/         # Data export/import/merge
│   └── transfer-crypto/      # Encryption for transfers
├── components/
│   ├── TransferWizard/       # Main transfer UI
│   ├── QRScanner/            # QR code scanning
│   └── ProgressIndicator/    # Transfer progress
├── pages/
│   └── transfer/             # Transfer page
└── workers/
    └── transfer-worker.js    # Background transfer handling

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single PWA project with service worker

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - WebRTC implementation in PWA context
   - QR code generation/scanning best practices
   - Public key encryption without SSL
   - Data merging strategies for ham radio data
   - IndexedDB performance for large datasets

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
   - TransferSession entity with connection state
   - StationData aggregate with all transferable data
   - ConnectionCode with QR/shortcode representations
   - TransferLog for audit records

2. **Generate API contracts** from functional requirements:
   - WebRTC signaling protocol
   - Data chunk protocol for large transfers
   - Encryption handshake protocol
   - Progress reporting protocol

3. **Generate contract tests** from contracts:
   - Connection establishment tests
   - Data transfer protocol tests
   - Encryption validation tests
   - Error recovery tests

4. **Extract test scenarios** from user stories:
   - Complete station migration scenario
   - Interrupted transfer recovery
   - Code expiration handling
   - Duplicate data merging

5. **Update agent file incrementally** (O(1) operation):
   - Add WebRTC and crypto context
   - Update recent changes
   - Keep under 150 lines

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each protocol → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Core libs before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - feature aligns with constitutional principles*

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
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*