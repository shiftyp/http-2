# Implementation Plan: Unlicensed Mode

**Branch**: `016-unlicensed-mode` | **Date**: 2025-09-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/workspaces/http-2/specs/016-unlicensed-mode/spec.md`

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
Implement a dual-mode operation system where users without amateur radio licenses can participate in the network via internet-only protocols (WebRTC/WebSocket) while licensed users can use both radio and internet. Unlicensed users can monitor all radio traffic but cannot transmit on RF frequencies. All message relaying for unlicensed users must go through licensed stations with valid certificates to ensure traffic veracity.

## Technical Context
**Language/Version**: TypeScript 5.x with ES2022 modules
**Primary Dependencies**: React 18, IndexedDB, Web Crypto API, WebRTC, WebSocket
**Storage**: IndexedDB for certificate cache, user mode persistence, compliance logs
**Testing**: Vitest for unit/integration tests, contract tests for API validation
**Target Platform**: Progressive Web App (PWA) - modern browsers (Chrome, Firefox, Safari)
**Project Type**: single - PWA with all functionality in browser
**Performance Goals**: <500ms mode detection, instant UI updates for permission changes
**Constraints**: Browser API limitations, no backend dependencies, FCC Part 97 compliance
**Scale/Scope**: Support unlimited unlicensed users, 100+ concurrent licensed stations

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA only - no backend)
- Using framework directly? YES (React, WebRTC APIs directly)
- Single data model? YES (TypeScript interfaces only)
- Avoiding patterns? YES (no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? YES
- Libraries listed:
  - `/lib/certificate-validation/`: Callsign certificate verification
  - `/lib/user-mode/`: Licensed/unlicensed mode management
  - `/lib/rate-limiter/`: DDoS protection for unlicensed users
  - `/lib/relay-manager/`: Message relay through licensed stations
  - `/lib/monitor-receiver/`: Radio monitoring for unlicensed users
- CLI per library: N/A (browser-based PWA)
- Library docs: TypeScript JSDoc comments with examples

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (IndexedDB, WebRTC, actual certificates)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? YES (compliance logging)
- Frontend logs → backend? N/A (PWA - local logging only)
- Error context sufficient? YES (mode, callsign, timestamp, protocol)

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? YES (IndexedDB migration strategy)

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

**Structure Decision**: Option 1 (Single project - PWA with all libraries in src/lib/)

## Phase 0: Outline & Research ✅
1. **Extracted unknowns from Technical Context**:
   - Certificate validation approaches
   - WebRTC/WebSocket permission controls
   - Rate limiting patterns for PWA
   - Message relay trust models
   - Radio monitoring regulations

2. **Research completed** (see research.md):
   - ARRL LoTW-compatible PKI chosen for certificates
   - Browser feature flags with graceful degradation
   - Multi-layer rate limiting with IndexedDB storage
   - Licensed-station-only relay with trust chains
   - Full-spectrum monitoring with SDR integration

3. **Consolidated findings** in `research.md`:
   - All technical decisions documented
   - Implementation patterns provided
   - Regulatory compliance verified

**Output**: research.md complete with all clarifications resolved ✅

## Phase 1: Design & Contracts ✅
*Prerequisites: research.md complete ✅*

1. **Extracted entities from feature spec** → `data-model.md` ✅:
   - UserMode: License status and features
   - Certificate: Digital certificate validation
   - RateLimitState: DDoS protection tracking
   - RelayPath: Message routing paths
   - ComplianceLog: Audit trail records

2. **Generated API contracts** → `/contracts/` ✅:
   - mode-detection-api.yaml: Mode switching and capabilities
   - certificate-validation-api.yaml: Callsign verification
   - message-relay-api.yaml: Relay station management
   - monitoring-configuration-api.yaml: Radio monitoring setup
   - compliance-logging-api.yaml: Audit logging

3. **Contract tests** (to be generated in Phase 2):
   - Will create one test file per API contract
   - Tests will verify schema compliance
   - RED phase enforced (tests fail first)

4. **Extracted test scenarios** → `quickstart.md` ✅:
   - Unlicensed user setup and communication
   - License upgrade with certificate
   - Radio monitoring configuration
   - Relay path verification
   - Compliance logging validation

5. **Update CLAUDE.md** (pending):
   - Will add unlicensed mode libraries
   - Update recent changes section

**Output**: data-model.md ✅, /contracts/* ✅, quickstart.md ✅

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs:
  - 5 contract test tasks (one per API) [P]
  - 5 entity model tasks (UserMode, Certificate, etc.) [P]
  - 5 library implementation tasks (certificate-validation, user-mode, etc.)
  - 10 integration test tasks (from quickstart scenarios)
  - 5 UI component tasks (mode toggle, certificate upload, etc.)

**Ordering Strategy**:
1. Contract tests first (RED phase)
2. Entity models and IndexedDB schemas
3. Core libraries (certificate validation, rate limiting)
4. Integration with existing libraries (radio-control, mesh-networking)
5. UI components and user flows
6. Integration tests
7. Quickstart validation

**Estimated Output**: ~30 numbered, ordered tasks in tasks.md

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
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*