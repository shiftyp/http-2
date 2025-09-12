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
A Progressive Web App (PWA) for ham radio operators that enables HTTP communication over radio. Each station can create and host "server applications" locally that process HTTP requests and form submissions. The application runs entirely in the browser using Web Serial API for radio control and Web Audio API for signal processing. Server apps are JavaScript programs stored in IndexedDB and executed in sandboxed environments when HTTP requests arrive via radio. After initial installation, everything operates fully offline with service workers.

## Technical Context
**Language/Version**: TypeScript 5.x / Modern JavaScript (ES2022+)  
**Primary Dependencies**: React (UI), Workbox (service worker), Web Serial API, Web Audio API, IndexedDB  
**Storage**: IndexedDB for all local storage (no server-side storage)  
**Testing**: Vitest (unit), Playwright (E2E)  
**Target Platform**: Modern browsers with Web Serial API support (Chrome, Edge, Opera)
**Project Type**: Progressive Web App (PWA) with offline-first architecture  
**Performance Goals**: <500ms transmission initiation, support 10+ concurrent mesh nodes  
**Constraints**: FCC 2024 rules - 2.8kHz bandwidth limit (symbol rate limits removed), adaptive SNR  
**Scale/Scope**: Single operator per station, unlimited documents, mesh network up to 100 nodes
**Modulation**: QPSK/16-QAM adaptive (1-11.2 kbps effective), Web Audio API based

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Single PWA, no backend)
- Using framework directly? Yes (React without wrappers)
- Single data model? Yes (TypeScript interfaces)
- Avoiding patterns? Yes (direct function calls, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes
- Libraries listed:
  - radio-control: Web Serial API wrapper for CAT control (Icom, Yaesu, Kenwood, Flex)
  - qpsk-modem: Web Audio API QPSK/16-QAM modulation (HoR-1000 to HoR-11200)
  - hor-protocol: HTTP-over-Radio protocol with delta updates & compression
  - jsx-radio: React-like JSX compilation to compressed templates
  - compression: HTML/CSS/JS compression with dictionary & template system
  - themes: Customizable theming system with 8 built-in themes
  - mesh-router: HTTP request/response routing over radio
  - function-runtime: FaaS execution engine for server functions
  - orm: Simplified ORM wrapper for IndexedDB operations
  - data-table: Spreadsheet-like interface for database tables
  - signing-list: Pre-distributed signing list verification
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
# PWA Structure - Single Application
public/                    # Static files served by server
├── index.html            # PWA entry point
├── manifest.json         # PWA manifest
├── service-worker.js     # Service worker (compiled)
└── assets/              # Icons, fonts, etc.

src/                      # Source code (compiled to public/)
├── components/          # React components
│   ├── RadioControl/   # Radio interface components
│   ├── MeshNetwork/    # Mesh visualization
│   ├── Registration/   # User registration
│   ├── PageEditor/     # Static page creation (Markdown/HTML)
│   ├── FunctionEditor/ # Server function development UI
│   ├── DataTable/      # Spreadsheet-like database interface
│   └── AppCreator/    # Server app development UI
├── lib/                # Core libraries (browser-compatible)
│   ├── radio-control/  # Web Serial API wrapper
│   ├── qpsk-modem/    # Web Audio API modulation
│   ├── mesh-router/   # P2P routing protocol
│   ├── signing/       # Request signing & verification
│   ├── function-runtime/ # FaaS execution engine
│   ├── orm/           # Simplified ORM for IndexedDB
│   └── server-runtime/ # Server app execution engine
├── services/          # Business logic
│   ├── database/      # IndexedDB wrapper with ORM
│   ├── crypto/        # Web Crypto API
│   ├── content/       # Static pages vs functions manager
│   └── http-radio/    # HTTP over radio protocol
├── pages/             # Application pages
├── workers/           # Web Workers
│   ├── modem.worker.ts      # Audio processing
│   ├── function.worker.ts   # Server function sandbox
│   ├── server-app.worker.ts # Server app sandbox
│   └── crypto.worker.ts     # Crypto operations
├── service-worker.ts  # Service worker source
└── index.tsx         # App entry point

server/               # Minimal static server
├── server.js        # Express static server
└── data/           # Server-side data
    ├── signing-list.json     # Read-only signing list
    └── signing-list.json.sig # Signature

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests
```

**Structure Decision**: PWA with minimal static server - all functionality in the browser

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - ✅ Research: Web Audio API QPSK/16-QAM implementation (COMPLETED)
   - ✅ Research: CAT control protocols (COMPLETED - Icom, Yaesu, Kenwood, Flex)
   - Research: Mesh routing algorithms suitable for radio networks
   - ✅ Research: FCC 2024 rules - symbol rate limits removed (COMPLETED)

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
   - StaticPage: path, content, format (markdown/html), metadata
   - ServerFunction: path, code, handler, context API usage
   - FunctionData: function_id, collection, data (via ORM)
   - DataTable: name, schema, rows (spreadsheet interface)
   - Transmission: source, destination, payload, status, retry count
   - MeshNode: callsign, routing table, link quality metrics
   - Certificate: callsign, public key, signature, expiry

2. **Generate API contracts** from functional requirements:
   - Static Pages:
     - GET /pages/* - Serve static HTML/Markdown pages
     - POST /pages/create - Create new static page
   - Server Functions:
     - GET /functions/* - Execute server function GET handler
     - POST /functions/* - Execute server function POST handler
     - PUT /functions/deploy - Deploy new server function
   - Database Operations:
     - GET /db/schema - Get database schema
     - POST /db/query - Execute ORM query
     - GET /db/table/{name} - Get table data for spreadsheet view
     - PUT /db/table/{name} - Update table via spreadsheet interface
   - Radio Operations:
     - POST /radio/connect - Connect to radio via CAT
     - GET /radio/status - Get radio connection status
     - POST /transmit - Send HTTP over radio
   - Mesh Operations:
     - GET /mesh/nodes - List mesh network nodes
     - POST /mesh/request - Request content from mesh
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
- [x] Phase 4: Implementation in progress
  - ✅ QPSK/16-QAM modem (HoR-1000 to HoR-11200)
  - ✅ Radio CAT control (Web Serial API)
  - ✅ HTTP-over-Radio protocol with compression
  - ✅ JSX-to-template compilation system
  - ✅ Theming system (8 themes)
  - ✅ Radio Control UI component
  - ⏳ Mesh networking
  - ⏳ Full UI integration
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*