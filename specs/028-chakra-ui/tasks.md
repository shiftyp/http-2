# Tasks: Chakra UI Component Migration

**Input**: Design documents from `/specs/028-chakra-ui/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.3, React 18.2, Chakra UI v3.27.0
   → Structure: Single project PWA with src/components/, src/theme/
2. Load optional design documents: ✓
   → data-model.md: Theme entity, component migration entity, accessibility model
   → contracts/: button-migration, input-migration, pagebuilder-migration
   → research.md: Chakra UI v3.27.0 decisions, migration strategy
3. Generate tasks by category: ✓
   → Setup: theme, ChakraProvider, dependencies
   → Tests: contract tests, accessibility tests, visual regression
   → Core: component migrations, prop mappings
   → Integration: page builder, navigation, forms
   → Polish: performance tests, documentation
4. Apply task rules: ✓
   → Different components = mark [P] for parallel
   → Same component/file = sequential
   → Tests before implementation (TDD) ✓
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [x] T001 Set up Chakra UI theme configuration in `src/theme/chakraTheme.ts`
- [x] T002 Configure ChakraProvider in `src/App.tsx` with custom theme
- [ ] T003 [P] Add theme type definitions in `src/theme/types.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T004 [P] Button migration contract test in `src/test/contract/button-migration.test.ts`
- [ ] T005 [P] Input migration contract test in `src/test/contract/input-migration.test.ts`
- [ ] T006 [P] Page builder migration contract test in `src/test/contract/pagebuilder-migration.test.ts`

### Accessibility Tests
- [ ] T007 [P] Button accessibility test in `src/test/accessibility/button-accessibility.test.ts`
- [ ] T008 [P] Input accessibility test in `src/test/accessibility/input-accessibility.test.ts`
- [ ] T009 [P] Page builder accessibility test in `src/test/accessibility/pagebuilder-accessibility.test.ts`

### Visual Regression Tests
- [ ] T010 [P] Button visual regression test in `src/test/visual/button-visual.test.ts`
- [ ] T011 [P] Input visual regression test in `src/test/visual/input-visual.test.ts`
- [ ] T012 [P] Navigation visual regression test in `src/test/visual/navigation-visual.test.ts`

### Integration Tests
- [ ] T013 [P] Theme application integration test in `src/test/integration/theme-integration.test.ts`
- [ ] T014 [P] Page builder drag-drop integration test in `src/test/integration/pagebuilder-dnd.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Base UI Component Migrations
- [ ] T015 [P] Migrate Button component to Chakra UI in `src/components/ui/Button.tsx`
- [ ] T016 [P] Migrate Input component to Chakra UI in `src/components/ui/Input.tsx`
- [ ] T017 [P] Migrate Card component to Chakra UI in `src/components/ui/Card.tsx`
- [ ] T018 [P] Migrate Badge component to Chakra UI in `src/components/ui/Badge.tsx`
- [ ] T019 [P] Migrate Alert component to Chakra UI in `src/components/ui/Alert.tsx`
- [ ] T020 [P] Migrate Table component to Chakra UI in `src/components/ui/Table.tsx`
- [ ] T021 [P] Migrate Select component to Chakra UI in `src/components/ui/Select.tsx`
- [ ] T022 [P] Migrate Toggle component to Chakra UI in `src/components/ui/Toggle.tsx`

### Form Component Enhancements
- [ ] T023 Create FormControl wrapper in `src/components/ui/FormControl.tsx`
- [ ] T024 Update Input component with FormControl integration in `src/components/ui/Input.tsx`

## Phase 3.4: Integration

### Navigation System
- [ ] T025 Update main navigation in `src/App.tsx` with Chakra UI components
- [ ] T026 Update mobile navigation responsive behavior in `src/App.tsx`

### Page Builder System
- [ ] T027 Update GridCanvas component with Chakra UI styling in `src/components/PageBuilder/GridCanvas.tsx`
- [ ] T028 Update ComponentPalette with Chakra UI components in `src/components/PageBuilder/ComponentPalette.tsx`
- [ ] T029 Update PropertyEditor modal with Chakra UI in `src/components/PageBuilder/PropertyEditor.tsx`
- [ ] T030 Update PreviewPanel with Chakra UI styling in `src/components/PageBuilder/PreviewPanel.tsx`

### Page Component Updates
- [ ] T031 [P] Update Dashboard page components in `src/pages/Dashboard.tsx`
- [ ] T032 [P] Update ContentCreator page components in `src/pages/ContentCreator.tsx`
- [ ] T033 [P] Update DatabaseManager page components in `src/pages/DatabaseManager.tsx`
- [ ] T034 [P] Update RadioOps page components in `src/pages/RadioOps.tsx`
- [ ] T035 [P] Update Browse page components in `src/pages/Browse.tsx`
- [ ] T036 [P] Update Settings page components in `src/pages/Settings.tsx`

### Component Integrations
- [ ] T037 Update InstallPrompt with Chakra UI in `src/components/InstallPrompt/InstallPrompt.tsx`

## Phase 3.5: Polish

### Performance Validation
- [ ] T038 [P] Bundle size analysis and optimization in `scripts/analyze-bundle.js`
- [ ] T039 [P] Component render performance test in `src/test/performance/component-render.test.ts`
- [ ] T040 [P] Page builder performance test in `src/test/performance/pagebuilder-performance.test.ts`

### Accessibility Validation
- [ ] T041 [P] WCAG 2.1 AA compliance validation in `src/test/accessibility/wcag-compliance.test.ts`
- [ ] T042 [P] Keyboard navigation test suite in `src/test/accessibility/keyboard-navigation.test.ts`
- [ ] T043 [P] Screen reader compatibility test in `src/test/accessibility/screen-reader.test.ts`

### Documentation and Cleanup
- [ ] T044 [P] Update component documentation in `docs/components.md`
- [ ] T045 [P] Create Chakra UI migration guide in `docs/chakra-migration.md`
- [ ] T046 Remove deprecated Tailwind classes from CSS files
- [ ] T047 Execute quickstart validation process from `specs/028-chakra-ui/quickstart.md`

## Dependencies

### Phase Dependencies
- Setup (T001-T003) before everything
- Tests (T004-T014) before implementation (T015-T037)
- Base components (T015-T024) before page integration (T025-T037)
- Integration (T025-T037) before polish (T038-T047)

### Specific Dependencies
- T001 (theme) blocks T002 (ChakraProvider setup)
- T002 (ChakraProvider) blocks all component migrations (T015-T037)
- T015 (Button) blocks T025 (navigation), T031-T036 (pages)
- T016 (Input) blocks T024 (FormControl integration)
- T023 (FormControl) blocks T024 (Input integration)
- T027-T030 (PageBuilder) have internal dependencies (GridCanvas → ComponentPalette → PropertyEditor → PreviewPanel)

## Parallel Example
```bash
# Launch T004-T006 contract tests together:
Task: "Button migration contract test in src/test/contract/button-migration.test.ts"
Task: "Input migration contract test in src/test/contract/input-migration.test.ts"
Task: "Page builder migration contract test in src/test/contract/pagebuilder-migration.test.ts"

# Launch T015-T022 base component migrations together:
Task: "Migrate Button component to Chakra UI in src/components/ui/Button.tsx"
Task: "Migrate Input component to Chakra UI in src/components/ui/Input.tsx"
Task: "Migrate Card component to Chakra UI in src/components/ui/Card.tsx"
Task: "Migrate Badge component to Chakra UI in src/components/ui/Badge.tsx"

# Launch T031-T036 page updates together:
Task: "Update Dashboard page components in src/pages/Dashboard.tsx"
Task: "Update ContentCreator page components in src/pages/ContentCreator.tsx"
Task: "Update DatabaseManager page components in src/pages/DatabaseManager.tsx"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing (TDD requirement)
- Maintain radio operator dark theme throughout migration
- Preserve all existing functionality including drag-and-drop
- Test accessibility improvements with each component
- Monitor bundle size impact (<100KB increase target)

## Task Generation Rules Applied

1. **From Contracts**:
   - button-migration.contract.md → T004 (contract test), T015 (implementation)
   - input-migration.contract.md → T005 (contract test), T016 (implementation)
   - pagebuilder-migration.contract.md → T006 (contract test), T027-T030 (implementation)

2. **From Data Model**:
   - Theme Configuration Entity → T001 (theme setup), T003 (types)
   - Component Migration Entity → T015-T022 (component migrations)
   - Accessibility Enhancement Entity → T007-T009, T041-T043 (accessibility tests)

3. **From User Stories**:
   - Page builder drag-drop → T014 (integration test), T027-T030 (implementation)
   - Responsive design → T010-T012 (visual regression), T026 (mobile nav)
   - Form interaction → T013 (theme integration), T023-T024 (FormControl)

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T004-T006)
- [x] All entities have implementation tasks (theme: T001-T003, components: T015-T037)
- [x] All tests come before implementation (T004-T014 before T015-T037)
- [x] Parallel tasks truly independent (different files marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task

## Success Criteria
- All 47 tasks completed successfully
- No regression in existing functionality
- Accessibility improvements validated
- Performance targets met (<100KB bundle increase)
- Visual consistency maintained
- Radio operator theme preserved
- PWA functionality intact