# Tasks: Enhanced Page Builder

**Input**: Design documents from `/workspaces/http-2/specs/009-enhanced-page-builder/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   ✅ Tech stack: TypeScript 5.x, React 18, @dnd-kit/core, Vite
   ✅ Structure: Single project (existing codebase)
2. Load design documents:
   ✅ data-model.md: PageComponent, ComponentChildren, ComponentHierarchy
   ✅ contracts/: property-editor.ts, grid-canvas.ts, page-builder.ts
   ✅ quickstart.md: Integration test scenarios
3. Generate tasks by category:
   ✅ Setup: Type definitions, component enhancements
   ✅ Tests: Contract tests, integration tests
   ✅ Core: PropertyEditor, GridCanvas, PageBuilder updates
   ✅ Integration: Child management, rendering, persistence
   ✅ Polish: Unit tests, performance validation
4. Apply task rules:
   ✅ Different files = marked [P] for parallel
   ✅ Same file = sequential (no [P])
   ✅ Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **NOTE**: Many tasks already implemented during planning - validation tasks ensure completeness

## Path Conventions
- **Single project**: `/workspaces/http-2/src/`, `/workspaces/http-2/tests/`
- Existing codebase structure maintained

## Phase 3.1: Setup & Type Definitions
- [x] T001 [P] Enhance PageComponent interface with children array in `/workspaces/http-2/src/pages/PageBuilder.tsx`
- [x] T002 [P] Add ComponentChildren interface to data model (COMPLETED)
- [x] T003 [P] Add ComponentHierarchy interface to data model (COMPLETED)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] Contract test PropertyEditor child management in `/workspaces/http-2/tests/contract/property-editor-children.test.ts`
- [ ] T005 [P] Contract test GridCanvas nested rendering in `/workspaces/http-2/tests/contract/grid-canvas-children.test.ts`
- [ ] T006 [P] Contract test PageBuilder hierarchy management in `/workspaces/http-2/tests/contract/page-builder-hierarchy.test.ts`
- [ ] T007 [P] Integration test container creation and child addition in `/workspaces/http-2/tests/integration/enhanced-page-builder.test.ts`
- [ ] T008 [P] Integration test child property editing workflow in `/workspaces/http-2/tests/integration/child-property-editing.test.ts`
- [ ] T009 [P] Integration test deletion warning system in `/workspaces/http-2/tests/integration/deletion-warnings.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
**NOTE: Most core implementation completed during planning - these tasks validate/complete**
- [x] T010 [P] PropertyEditor Children tab implementation in `/workspaces/http-2/src/components/PageBuilder/PropertyEditor.tsx`
- [x] T011 [P] GridCanvas nested component rendering in `/workspaces/http-2/src/components/PageBuilder/GridCanvas.tsx`
- [x] T012 PageBuilder component hierarchy management in `/workspaces/http-2/src/pages/PageBuilder.tsx`
- [x] T013 Child component creation and management methods (COMPLETED)
- [x] T014 Recursive child rendering implementation (COMPLETED)
- [x] T015 Deletion warning system with child count (COMPLETED)

## Phase 3.4: Integration & UI Polish
- [x] T016 Wire PropertyEditor child handlers to PageBuilder (COMPLETED)
- [x] T017 Container-specific child rendering (Form, List, Table, Container) (COMPLETED)
- [x] T018 Visual hierarchy indicators and child count badges (COMPLETED)
- [ ] T019 IndexedDB persistence for nested component structures
- [ ] T020 Compression optimization for hierarchical data
- [ ] T021 Undo/redo support for child operations

## Phase 3.5: Polish & Validation
- [ ] T022 [P] Unit tests for child management utilities in `/workspaces/http-2/tests/unit/child-management.test.ts`
- [ ] T023 [P] Unit tests for recursive rendering functions in `/workspaces/http-2/tests/unit/nested-rendering.test.ts`
- [ ] T024 [P] Unit tests for hierarchy validation in `/workspaces/http-2/tests/unit/hierarchy-validation.test.ts`
- [ ] T025 Performance tests for deep nesting (10+ levels)
- [ ] T026 Circular reference prevention validation
- [ ] T027 Execute quickstart validation scenarios
- [ ] T028 Update CLAUDE.md documentation with feature completion status

## Dependencies
- Type definitions (T001-T003) before tests (T004-T009)
- Tests (T004-T009) before implementation validation (T010-T015)
- Core implementation (T010-T015) before integration (T016-T021)
- Integration before polish (T022-T028)

## Parallel Example
```bash
# Launch contract tests together (Phase 3.2):
Task: "Contract test PropertyEditor child management in tests/contract/property-editor-children.test.ts"
Task: "Contract test GridCanvas nested rendering in tests/contract/grid-canvas-children.test.ts"
Task: "Contract test PageBuilder hierarchy management in tests/contract/page-builder-hierarchy.test.ts"

# Launch integration tests together:
Task: "Integration test container creation in tests/integration/enhanced-page-builder.test.ts"
Task: "Integration test child property editing in tests/integration/child-property-editing.test.ts"
Task: "Integration test deletion warnings in tests/integration/deletion-warnings.test.ts"

# Launch unit tests together (Phase 3.5):
Task: "Unit tests for child management utilities in tests/unit/child-management.test.ts"
Task: "Unit tests for nested rendering in tests/unit/nested-rendering.test.ts"
Task: "Unit tests for hierarchy validation in tests/unit/hierarchy-validation.test.ts"
```

## Implementation Status Note
**IMPORTANT**: Core feature implementation was completed during the planning phase. The following components are already functional:

✅ **Completed During Planning**:
- PropertyEditor with Children tab and management UI
- GridCanvas with nested component rendering
- PageBuilder with hierarchy management and deletion warnings
- Visual indicators and child count badges
- Container-specific rendering patterns

📋 **Remaining Tasks**:
- Contract and integration tests for validation
- Unit tests for comprehensive coverage
- Performance optimization and validation
- Documentation updates

## Validation Scenarios (from quickstart.md)
1. **Container Creation**: Drag container, access Children tab, verify empty state
2. **Child Addition**: Add child via dropdown, verify count indicator, verify nested rendering
3. **Child Editing**: Edit child properties independently, verify context switching
4. **Complex Hierarchy**: Create form with multiple nested components
5. **Deletion Warnings**: Test warning dialog with accurate child counts
6. **Movement Preservation**: Verify children move with parent during drag operations

## Notes
- [P] tasks = different files, no dependencies
- Core implementation already functional - tests validate behavior
- Focus on comprehensive test coverage for hierarchy features
- Commit after each task completion
- Validate against quickstart scenarios throughout

## Task Generation Rules Applied
1. **From Contracts**: Each contract file → contract test task [P]
2. **From Data Model**: Each entity → validation task [P]
3. **From User Stories**: Each quickstart scenario → integration test [P]
4. **Ordering**: Setup → Tests → Validation → Polish

## Validation Checklist
- [x] All contracts have corresponding tests
- [x] All entities have model tasks
- [x] All tests come before implementation validation
- [x] Parallel tasks truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task