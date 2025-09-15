# Implementation Plan: Visual Page Builder

**Branch**: `006-visual-page-builder` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-visual-page-builder/spec.md`

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
Visual drag-and-drop page builder for creating HTML pages that can be served over amateur radio HTTP connections, supporting multi-page sites per callsign with responsive design, grid-based component layout, and bandwidth optimization.

## Technical Context
**Language/Version**: TypeScript 5.x / ES2022 modules
**Primary Dependencies**: React 18, Vite, IndexedDB, Web Audio API
**Storage**: IndexedDB for pages, templates, and site data
**Testing**: Vitest for unit/integration, Playwright for E2E
**Target Platform**: Progressive Web App (browser)
**Project Type**: web - frontend PWA with service worker
**Performance Goals**: < 2KB page size after compression, < 500ms render time
**Constraints**: 2.8 kHz bandwidth, FCC Part 97 compliance, offline-capable
**Scale/Scope**: Support 100+ pages per site, 20+ component types

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA frontend only)
- Using framework directly? YES (React, no wrappers)
- Single data model? YES (component/page/site entities)
- Avoiding patterns? YES (direct IndexedDB, no ORM)

**Architecture**:
- EVERY feature as library? YES (visual-builder lib)
- Libraries listed:
  - visual-builder: Core page builder functionality
  - page-optimizer: Bandwidth optimization
  - template-manager: Template save/load
  - grid-layout: CSS Grid component manager
- CLI per library: N/A (browser libraries)
- Library docs: llms.txt format planned? YES

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (IndexedDB, not mocks)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? YES
- Frontend logs → backend? N/A (PWA only)
- Error context sufficient? YES

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? YES (migration plan)

## Project Structure

### Documentation (this feature)
```
specs/006-visual-page-builder/
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
│   ├── visual-builder/     # Core page builder
│   ├── page-optimizer/     # Bandwidth optimization
│   ├── template-manager/   # Template management
│   └── grid-layout/        # Grid component system
├── components/
│   ├── PageBuilder/        # Main builder UI
│   ├── ComponentPalette/   # Draggable components
│   ├── GridCanvas/         # Visual canvas
│   └── PropertyEditor/     # Component properties
├── pages/
│   └── builder/            # Page builder page
└── workers/
    └── optimizer.worker.ts  # Background optimization

tests/
├── contract/               # API contracts (if any)
├── integration/            # Feature integration tests
└── unit/                   # Component unit tests
```

**Structure Decision**: Single project (PWA frontend) - no backend needed

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Grid layout implementation strategies for visual builders
   - Drag-and-drop with React best practices
   - IndexedDB schema for multi-page sites
   - Bandwidth optimization techniques for HTML
   - Undo/redo implementation patterns

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
   - Site: Callsign website container
   - Page: Individual page with components
   - Component: HTML element with properties
   - Template: Reusable page layout
   - GridPosition: Component placement
   - EditHistory: Undo/redo stack

2. **Generate API contracts** from functional requirements:
   - Page CRUD operations
   - Component manipulation
   - Template import/export
   - Site navigation
   - Output to `/contracts/` (internal APIs)

3. **Generate contract tests** from contracts:
   - One test file per operation
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Drag component to canvas
   - Save/load pages
   - Apply templates
   - Undo/redo operations
   - Bandwidth validation

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh claude`
   - Add visual page builder context
   - Update recent changes
   - Keep under 150 lines
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each entity → model creation task [P]
- Each UI component → component creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models → Services → Components → Pages
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

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
| None | - | - |

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
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*