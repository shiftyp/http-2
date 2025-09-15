# Implementation Plan: Mesh Network Visualization

**Branch**: `008-mesh-network-visualization` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-mesh-network-visualization/spec.md`

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
Ham radio operators need a real-time visualization system for mesh network topology, displaying stations as nodes with RF propagation characteristics, connection quality, and routing paths. The system will provide interactive network monitoring with GPS positioning, frequency/protocol display, and propagation modeling based on SNR and distance. Key capabilities include zoom functionality, station detail views, communication initiation, and real-time RF statistics display.

## Technical Context
**Language/Version**: TypeScript 5.x with ES2022 modules (from constitution)
**Primary Dependencies**: React 18, Web Audio API, Web Serial API, Canvas/WebGL for visualization, IndexedDB
**Storage**: IndexedDB for mesh topology cache, GPS coordinates, station data persistence
**Testing**: Vitest for unit/integration tests, existing mesh-networking test infrastructure
**Target Platform**: Progressive Web App (PWA) in browser environment, offline-capable
**Project Type**: web (frontend integration into existing HTTP-over-radio PWA)
**Performance Goals**: Real-time updates <100ms, 60fps visualization, support 50+ station networks
**Constraints**: 2.8kHz bandwidth limit, FCC Part 97 compliance, offline-first, browser-only
**Scale/Scope**: 10-100 mesh nodes, geographic mapping with propagation visualization

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (integration into existing PWA)
- Using framework directly? Yes (React 18, Canvas/WebGL, existing mesh-networking lib)
- Single data model? Yes (mesh topology with station/link entities)
- Avoiding patterns? Yes (direct use of existing mesh-networking infrastructure)

**Architecture**:
- EVERY feature as library? Yes (`src/lib/mesh-visualization/`)
- Libraries listed: mesh-visualization (topology visualization), mesh-rendering (canvas/webgl), mesh-interactions (user controls)
- CLI per library: N/A (browser-based UI components)
- Library docs: llms.txt format planned for AI context

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (tests written first, must fail)
- Git commits show tests before implementation? Yes (following TDD)
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual mesh-networking lib, IndexedDB, Canvas)
- Integration tests for: new visualization library, mesh data integration
- FORBIDDEN: Implementation before test, skipping RED phase - ENFORCED

**Observability**:
- Structured logging included? Yes (mesh events, rendering performance)
- Frontend logs → backend? N/A (PWA-only, no backend)
- Error context sufficient? Yes (GPS errors, rendering failures, mesh timeouts)

**Versioning**:
- Version number assigned? Will inherit from existing PWA versioning
- BUILD increments on every change? Following existing PWA practices
- Breaking changes handled? Integration with existing mesh-networking API

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

**Structure Decision**: Option 1 (Single project) - integrating into existing PWA with new visualization library

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
- Contract tests for mesh API integration (7 tasks)
- Model creation for each entity (7 tasks)
- Core visualization libraries (6 tasks)
- Canvas rendering implementation (4 tasks)
- React component integration (3 tasks)
- Integration test tasks (5 tasks)
- Performance optimization (3 tasks)

**Ordering Strategy**:
1. Contract tests first (TDD - must fail before implementation)
2. Data models (NetworkTopology, StationNode, ConnectionLink, etc.)
3. Core libraries (mesh-network-visualization, propagation-model)
4. Canvas rendering and visualization engine
5. React component wrapper
6. Integration tests with mesh-networking library
7. Performance optimization and polish

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

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


## Phase 0: Outline & Research
✅ COMPLETE - research.md generated with all technical decisions:
- Canvas 2D with WebGL fallback for large networks
- Event-driven updates from existing mesh-networking library
- HTML5 Geolocation API with manual coordinate fallback
- Simplified path loss model with SNR-based visualization
- React components with Canvas integration via useRef
- Layered rendering with selective updates
- IndexedDB for persistent topology data with memory cache

**Output**: research.md with all NEEDS CLARIFICATION resolved ✓

## Phase 1: Design & Contracts
✅ COMPLETE - All artifacts generated:

1. **Entities extracted** → `data-model.md`:
   - NetworkTopology: Complete mesh network state
   - StationNode: Ham radio station representation
   - ConnectionLink: RF communication capability
   - SignalMetrics: RF signal quality measurements
   - RoutePath: Multi-hop routing paths
   - RFPropagation: Visual radio wave coverage
   - TrafficFlow: Real-time communication activity

2. **API contracts generated** → `/contracts/mesh-visualization-api.yaml`:
   - GET /api/mesh/topology
   - GET /api/mesh/stations
   - GET /api/mesh/links
   - GET /api/mesh/routes
   - GET /api/mesh/propagation/{callsign}
   - GET /api/mesh/traffic
   - GET/PUT /api/mesh/config

3. **Test scenarios extracted** → quickstart.md:
   - Basic network visualization
   - Real-time updates
   - Interactive features
   - RF propagation visualization
   - Zoom and navigation

**Output**: data-model.md ✓, /contracts/* ✓, quickstart.md ✓

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