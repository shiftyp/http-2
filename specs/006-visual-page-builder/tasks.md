# Tasks: Visual Page Builder

**Input**: Design documents from `/specs/006-visual-page-builder/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- This project uses single PWA structure per plan.md

## Phase 3.1: Setup
- [ ] T001 Create library directories for visual-builder, page-optimizer, template-manager, grid-layout
- [ ] T002 Install dependencies: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers
- [ ] T003 [P] Configure TypeScript for new libraries in tsconfig.json
- [ ] T004 [P] Create IndexedDB store definitions in src/lib/database/page-builder-stores.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Operations)
- [ ] T005 [P] Contract test POST /api/sites in tests/contract/test_sites_post.test.ts
- [ ] T006 [P] Contract test GET /api/sites in tests/contract/test_sites_get.test.ts
- [ ] T007 [P] Contract test POST /api/pages in tests/contract/test_pages_post.test.ts
- [ ] T008 [P] Contract test GET /api/pages/{pageId} in tests/contract/test_pages_get.test.ts
- [ ] T009 [P] Contract test PUT /api/pages/{pageId} in tests/contract/test_pages_put.test.ts
- [ ] T010 [P] Contract test POST /api/pages/{pageId}/components in tests/contract/test_components_add.test.ts
- [ ] T011 [P] Contract test PUT /api/pages/{pageId}/components/{componentId} in tests/contract/test_components_update.test.ts
- [ ] T012 [P] Contract test POST /api/pages/{pageId}/components/{componentId}/move in tests/contract/test_components_move.test.ts
- [ ] T013 [P] Contract test GET /api/pages/{pageId}/preview in tests/contract/test_preview.test.ts
- [ ] T014 [P] Contract test POST /api/pages/{pageId}/validate in tests/contract/test_validate.test.ts
- [ ] T015 [P] Contract test POST /api/templates in tests/contract/test_templates_create.test.ts
- [ ] T016 [P] Contract test POST /api/pages/{pageId}/apply-template in tests/contract/test_templates_apply.test.ts
- [ ] T017 [P] Contract test POST /api/actions in tests/contract/test_actions_create.test.ts
- [ ] T018 [P] Contract test GET /api/functions in tests/contract/test_functions_list.test.ts
- [ ] T019 [P] Contract test POST /api/history/{pageId}/undo in tests/contract/test_undo.test.ts
- [ ] T020 [P] Contract test POST /api/history/{pageId}/redo in tests/contract/test_redo.test.ts

### Integration Tests (User Scenarios)
- [ ] T021 [P] Integration test: Create first page with text component in tests/integration/test_create_first_page.test.ts
- [ ] T022 [P] Integration test: Apply template to page in tests/integration/test_apply_template.test.ts
- [ ] T023 [P] Integration test: Wire form to backend function in tests/integration/test_wire_form_function.test.ts
- [ ] T024 [P] Integration test: Multi-page site navigation in tests/integration/test_multi_page_navigation.test.ts
- [ ] T025 [P] Integration test: Undo/redo operations in tests/integration/test_undo_redo.test.ts
- [ ] T026 [P] Integration test: Responsive preview in tests/integration/test_responsive_preview.test.ts
- [ ] T027 [P] Integration test: Template export/import in tests/integration/test_template_export_import.test.ts
- [ ] T028 [P] Integration test: Bandwidth validation warning in tests/integration/test_bandwidth_validation.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T029 [P] Site model in src/lib/visual-builder/models/site.ts
- [ ] T030 [P] Page model in src/lib/visual-builder/models/page.ts
- [ ] T031 [P] PageComponent model in src/lib/visual-builder/models/page-component.ts
- [ ] T032 [P] GridLayout model in src/lib/visual-builder/models/grid-layout.ts
- [ ] T033 [P] PageTemplate model in src/lib/visual-builder/models/page-template.ts
- [ ] T034 [P] ActionBinding model in src/lib/visual-builder/models/action-binding.ts
- [ ] T035 [P] ServerFunction model in src/lib/visual-builder/models/server-function.ts
- [ ] T036 [P] EditHistory model in src/lib/visual-builder/models/edit-history.ts

### Core Services
- [ ] T037 [P] SiteService CRUD in src/lib/visual-builder/services/site-service.ts
- [ ] T038 [P] PageService CRUD in src/lib/visual-builder/services/page-service.ts
- [ ] T039 [P] ComponentService operations in src/lib/visual-builder/services/component-service.ts
- [ ] T040 [P] TemplateService management in src/lib/template-manager/template-service.ts
- [ ] T041 [P] ActionService binding in src/lib/visual-builder/services/action-service.ts
- [ ] T042 [P] HistoryService undo/redo in src/lib/visual-builder/services/history-service.ts

### Page Optimization
- [ ] T043 [P] PageCompressor for 2KB limit in src/lib/page-optimizer/page-compressor.ts
- [ ] T044 [P] ComponentTemplateCompiler in src/lib/page-optimizer/template-compiler.ts
- [ ] T045 [P] AtomicCSSGenerator in src/lib/page-optimizer/atomic-css.ts
- [ ] T046 [P] BinarySerializer for extreme compression in src/lib/page-optimizer/binary-serializer.ts

### Grid Layout System
- [ ] T047 [P] GridLayoutManager in src/lib/grid-layout/grid-manager.ts
- [ ] T048 [P] GridPositionCalculator in src/lib/grid-layout/position-calculator.ts
- [ ] T049 [P] ResponsiveBreakpointHandler in src/lib/grid-layout/responsive-handler.ts

### React Components
- [ ] T050 PageBuilder main component in src/components/PageBuilder/PageBuilder.tsx
- [ ] T051 ComponentPalette draggable items in src/components/PageBuilder/ComponentPalette.tsx
- [ ] T052 GridCanvas drop zones in src/components/PageBuilder/GridCanvas.tsx
- [ ] T053 PropertyEditor basic/advanced modes in src/components/PageBuilder/PropertyEditor.tsx
- [ ] T054 ActionWireUp visual connectors in src/components/PageBuilder/ActionWireUp.tsx
- [ ] T055 FunctionPicker browser in src/components/PageBuilder/FunctionPicker.tsx
- [ ] T056 PreviewPanel responsive views in src/components/PageBuilder/PreviewPanel.tsx
- [ ] T057 TemplateManager save/load UI in src/components/PageBuilder/TemplateManager.tsx

### Drag and Drop Implementation
- [ ] T058 DragDropContext setup in src/lib/visual-builder/drag-drop/context.tsx
- [ ] T059 DraggableComponent wrapper in src/lib/visual-builder/drag-drop/draggable.tsx
- [ ] T060 DroppableGrid zones in src/lib/visual-builder/drag-drop/droppable.tsx
- [ ] T061 BandwidthOptimizedDrag hook in src/lib/visual-builder/drag-drop/optimized-drag.ts

### Action System
- [ ] T062 ActionCompiler for bandwidth in src/lib/visual-builder/actions/action-compiler.ts
- [ ] T063 ActionExecutor runtime in src/lib/visual-builder/actions/action-executor.ts
- [ ] T064 ParameterMapper UI in src/lib/visual-builder/actions/parameter-mapper.ts
- [ ] T065 DataFlowVisualizer overlay in src/lib/visual-builder/actions/data-flow-visualizer.tsx

### Database Integration
- [ ] T066 PageBuilderDB extension in src/lib/database/page-builder-db.ts
- [ ] T067 Connect all services to IndexedDB stores
- [ ] T068 Migration scripts for existing data

## Phase 3.4: Integration
- [ ] T069 Wire PageBuilder to main app router
- [ ] T070 Integrate with existing compression library
- [ ] T071 Connect to ham-server for preview/serving
- [ ] T072 Add structured logging throughout
- [ ] T073 Performance monitoring hooks
- [ ] T074 Error boundaries and recovery

## Phase 3.5: Polish
- [ ] T075 [P] Unit tests for GridPositionCalculator in tests/unit/grid-position.test.ts
- [ ] T076 [P] Unit tests for PageCompressor in tests/unit/page-compressor.test.ts
- [ ] T077 [P] Unit tests for ActionCompiler in tests/unit/action-compiler.test.ts
- [ ] T078 [P] Unit tests for TemplateService in tests/unit/template-service.test.ts
- [ ] T079 Performance tests: < 100ms drag operations
- [ ] T080 Performance tests: < 500ms page save
- [ ] T081 Performance tests: < 50ms undo/redo
- [ ] T082 [P] Update documentation in docs/page-builder.md
- [ ] T083 [P] Create user guide in docs/page-builder-guide.md
- [ ] T084 Remove code duplication across services
- [ ] T085 Run all quickstart scenarios for validation

## Dependencies
- Setup (T001-T004) blocks everything
- All tests (T005-T028) must be written and failing before implementation (T029-T068)
- Models (T029-T036) before services (T037-T042)
- Services before components (T050-T057)
- Core implementation before integration (T069-T074)
- Everything before polish (T075-T085)
- T050 depends on T058-T061 (drag-drop must work first)
- T066-T067 depend on models being complete

## Parallel Execution Examples

### Batch 1: Contract Tests (after setup)
```bash
# Launch T005-T020 together (all different files):
Task: "Contract test POST /api/sites in tests/contract/test_sites_post.test.ts"
Task: "Contract test GET /api/sites in tests/contract/test_sites_get.test.ts"
Task: "Contract test POST /api/pages in tests/contract/test_pages_post.test.ts"
# ... continue for all contract tests
```

### Batch 2: Integration Tests (after setup)
```bash
# Launch T021-T028 together (all different files):
Task: "Integration test: Create first page in tests/integration/test_create_first_page.test.ts"
Task: "Integration test: Apply template in tests/integration/test_apply_template.test.ts"
Task: "Integration test: Wire form to function in tests/integration/test_wire_form_function.test.ts"
# ... continue for all integration tests
```

### Batch 3: Models (after tests are failing)
```bash
# Launch T029-T036 together (all different files):
Task: "Site model in src/lib/visual-builder/models/site.ts"
Task: "Page model in src/lib/visual-builder/models/page.ts"
Task: "PageComponent model in src/lib/visual-builder/models/page-component.ts"
# ... continue for all models
```

### Batch 4: Services (after models)
```bash
# Launch T037-T042 together (all different files):
Task: "SiteService CRUD in src/lib/visual-builder/services/site-service.ts"
Task: "PageService CRUD in src/lib/visual-builder/services/page-service.ts"
Task: "ComponentService operations in src/lib/visual-builder/services/component-service.ts"
# ... continue for all services
```

### Batch 5: Unit Tests (in polish phase)
```bash
# Launch T075-T078 together (all different test files):
Task: "Unit tests for GridPositionCalculator in tests/unit/grid-position.test.ts"
Task: "Unit tests for PageCompressor in tests/unit/page-compressor.test.ts"
Task: "Unit tests for ActionCompiler in tests/unit/action-compiler.test.ts"
Task: "Unit tests for TemplateService in tests/unit/template-service.test.ts"
```

## Notes
- [P] tasks can run in parallel (different files, no dependencies)
- Verify all tests fail before implementing (RED phase of TDD)
- Commit after each task completion
- Components T050-T057 must be done sequentially (same directory, potential conflicts)
- Database tasks T066-T068 must be sequential (schema dependencies)

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T005-T020)
- [x] All entities have model tasks (T029-T036)
- [x] All tests come before implementation (T005-T028 before T029-T068)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] All user scenarios from quickstart.md covered (T021-T028)
- [x] All endpoints from contracts have implementation tasks
- [x] Performance requirements have test tasks (T079-T081)