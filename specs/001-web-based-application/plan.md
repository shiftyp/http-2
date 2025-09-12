# Implementation Plan: Ham Radio Web Application for Digital Communication

**Branch**: `001-web-based-application` | **Date**: 2025-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-web-based-application/spec.md`

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
A web-based application for ham radio operators that enables digital communication through radio interfaces. The system connects to HF and other radios via CAT control and sound interfaces, digitizes markdown documents for transmission using QPSK modulation, and implements mesh networking for automatic document forwarding between stations. Authentication uses callsigns with digital certificates managed by the application's built-in CA.

## Technical Context
**Language/Version**: Node.js 20 LTS / TypeScript 5.x  
**Primary Dependencies**: Express.js (backend API), React (frontend UI), serialport (CAT control), Web Audio API (sound processing)  
**Storage**: File-based document storage with SQLite for metadata and routing tables  
**Testing**: Jest (unit/integration), Playwright (E2E)  
**Target Platform**: Linux/Windows/macOS (cross-platform web app)
**Project Type**: web - frontend+backend with radio hardware integration  
**Performance Goals**: <500ms transmission initiation, support 10+ concurrent mesh nodes  
**Constraints**: FCC bandwidth compliance for HF, <2.8kHz bandwidth, adaptive to poor SNR conditions  
**Scale/Scope**: Single operator per station, unlimited documents, mesh network up to 100 nodes

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (backend API, frontend UI)
- Using framework directly? Yes (Express, React without wrappers)
- Single data model? Yes (shared TypeScript interfaces)
- Avoiding patterns? Yes (direct service calls, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes
- Libraries listed:
  - radio-control: CAT control and radio interface management
  - qpsk-modem: QPSK modulation/demodulation for data transmission
  - mesh-router: Document routing and mesh network management
  - doc-manager: Markdown document storage and metadata handling
  - cert-authority: Digital certificate generation and validation
- CLI per library: Each library will expose CLI commands for testing
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual radio interfaces in test mode)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test, skipping RED phase - Understood

**Observability**:
- Structured logging included? Yes
- Frontend logs → backend? Yes (unified logging stream)
- Error context sufficient? Yes (includes radio state, mesh topology)

**Versioning**:
- Version number assigned? 0.1.0
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (versioned API endpoints)

## Project Structure

### Documentation (this feature)
```
specs/001-web-based-application/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   ├── api/
│   └── lib/
│       ├── radio-control/
│       ├── qpsk-modem/
│       ├── mesh-router/
│       ├── doc-manager/
│       └── cert-authority/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

**Structure Decision**: Option 2 (Web application) - frontend + backend architecture required for web UI and radio hardware integration

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Research: Best practices for Web Audio API and QPSK implementation
   - Research: CAT control protocols for common radio models (Icom, Yaesu, Kenwood)
   - Research: Mesh routing algorithms suitable for radio networks
   - Research: FCC Part 97 compliance for digital modes

2. **Generate and dispatch research agents**:
   ```
   Task: "Research Web Audio API for QPSK modulation at 2.8kHz bandwidth"
   Task: "Find CAT control libraries and protocols for ham radio interfaces"
   Task: "Research mesh network routing algorithms for high-latency links"
   Task: "Research FCC Part 97 digital mode regulations and bandwidth limits"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - RadioStation: callsign, equipment model, connection status
   - Document: id, content, metadata (frontmatter), retention policy
   - Transmission: source, destination, payload, status, retry count
   - MeshNode: callsign, routing table, link quality metrics
   - Certificate: callsign, public key, signature, expiry

2. **Generate API contracts** from functional requirements:
   - POST /api/radio/connect - Connect to radio via CAT
   - GET /api/radio/status - Get radio connection status
   - POST /api/documents - Create/upload markdown document
   - GET /api/documents/{id} - Retrieve document
   - POST /api/transmit - Send document over radio
   - GET /api/mesh/nodes - List mesh network nodes
   - POST /api/mesh/request - Request document from mesh
   - POST /api/certificates - Generate station certificate
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Connect radio and verify CAT control
   - Create and transmit markdown document
   - Receive and decode transmission
   - Forward document through mesh network

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh claude`
   - Add ham radio domain context
   - Update recent changes
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

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