# Implementation Plan: Chakra UI Component Migration

**Branch**: `028-chakra-ui` | **Date**: 2025-09-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-chakra-ui/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Loaded specification for Chakra UI component migration
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Detect Project Type: web (frontend PWA)
   → Set Structure Decision: Single project (PWA with components)
3. Evaluate Constitution Check section below ✓
   → No violations detected
   → Update Progress Tracking: Initial Constitution Check ✓
4. Execute Phase 0 → research.md ✓
   → All technical details resolved from existing project context
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
6. Re-evaluate Constitution Check section ✓
   → No new violations
   → Update Progress Tracking: Post-Design Constitution Check ✓
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md) ✓
8. STOP - Ready for /tasks command ✓
```

## Summary
Migrate the HTTP-over-Radio PWA from custom Tailwind CSS components to Chakra UI component library while preserving the radio operator dark theme aesthetic, accessibility features, and all existing functionality including the drag-and-drop page builder and radio-specific visualizations.

## Technical Context
**Language/Version**: TypeScript 5.3 with React 18.2
**Primary Dependencies**: @chakra-ui/react, @emotion/react, @emotion/styled, framer-motion
**Storage**: IndexedDB via logbook API (no changes required)
**Testing**: Vitest, React Testing Library, Playwright E2E
**Target Platform**: Progressive Web App (browser-based)
**Project Type**: single (PWA with component library)
**Performance Goals**: Maintain <500ms UI interaction response, preserve real-time radio operation performance
**Constraints**: FCC Part 97 compliance, 2.8kHz bandwidth limits, PWA offline capability, dark theme for radio operators
**Scale/Scope**: ~15 UI components, 8 page components, existing drag-and-drop system preservation

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA only)
- Using framework directly? Yes (Chakra UI components directly, no wrapper classes)
- Single data model? Yes (UI component props, no additional DTOs)
- Avoiding patterns? Yes (direct component migration, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes (theme system as library, components remain in components/)
- Libraries listed:
  - chakra-theme: Radio operator theme configuration
  - component-migration: Migration utilities for prop mapping
- CLI per library: N/A (UI components, not CLI libraries)
- Library docs: N/A (UI migration, internal project)

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (tests will fail before migration implementation)
- Git commits show tests before implementation? Yes (visual regression tests, accessibility tests)
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual Chakra UI, real browser environment)
- Integration tests for: Component migration, theme application, drag-and-drop preservation
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? Console logging for migration status (development only)
- Frontend logs → backend? N/A (PWA only, no backend)
- Error context sufficient? Yes (component migration error boundaries)

**Versioning**:
- Version number assigned? 0.1.0 (patch increment for UI library change)
- BUILD increments on every change? Yes (existing CI/CD pipeline)
- Breaking changes handled? No breaking changes (internal UI migration only)

## Project Structure

### Documentation (this feature)
```
specs/028-chakra-ui/
├── plan.md              # This file (/plan command output) ✓
├── research.md          # Phase 0 output (/plan command) ✓
├── data-model.md        # Phase 1 output (/plan command) ✓
├── quickstart.md        # Phase 1 output (/plan command) ✓
├── contracts/           # Phase 1 output (/plan command) ✓
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Single project (PWA)
src/
├── theme/               # Chakra UI theme configuration
├── components/          # Existing React components (to be migrated)
│   ├── ui/             # Base UI components
│   └── PageBuilder/    # Page builder components
├── pages/              # Page-level components
└── lib/                # Existing core libraries (unchanged)

tests/
├── contract/           # Component contract tests
├── integration/        # Theme and accessibility integration tests
└── unit/              # Individual component unit tests
```

**Structure Decision**: Single project (PWA with React components)

## Phase 0: Outline & Research

**Research Complete**: All technical context resolved from existing project knowledge.

Key findings documented in research.md:
- Chakra UI v3.27.0 compatibility with React 18.2 ✓
- Emotion/React styling system integration ✓
- Theme customization approach for radio operator aesthetics ✓
- Component migration strategy preserving existing functionality ✓
- Accessibility improvements through Chakra UI built-in features ✓

## Phase 1: Design & Contracts

**Design Complete**: All design artifacts generated.

1. **Data Model**: UI component structure and theme configuration (data-model.md) ✓
2. **Component Contracts**: Migration interfaces for each UI component type (contracts/) ✓
3. **Integration Tests**: Visual regression and accessibility test scenarios ✓
4. **Quickstart**: Step-by-step migration validation process (quickstart.md) ✓
5. **Agent Context**: Updated CLAUDE.md with Chakra UI migration context ✓

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate component migration tasks from contracts/
- Each UI component → migration task [P] (parallel execution possible)
- Theme setup → theme configuration task
- Page component updates → sequential tasks (dependencies)
- Testing tasks → accessibility and visual regression validation

**Ordering Strategy**:
- TDD order: Component tests before migration implementation
- Dependency order: Theme → Base UI components → Page components → Integration tests
- Mark [P] for parallel execution: Independent component migrations
- Sequential: Theme setup, page builder updates (due to dependencies)

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations identified - table empty*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach defined (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*