# Tasks: Waterfall SNR Power Visualization

**Input**: Design documents from `/specs/007-waterfall-snr-power/`
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
- Paths shown below for single project TypeScript/React application

## Phase 3.1: Setup
- [ ] T001 Create library directories: src/lib/waterfall-display, src/lib/spectrum-analyzer, src/lib/signal-detector
- [ ] T002 Install dependencies: npm install --save-dev @types/web-audio-api canvas
- [ ] T003 [P] Create TypeScript config for new libraries in tsconfig.json paths

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T004 [P] Contract test GET /api/waterfall/spectrum in src/test/contract/waterfall-spectrum.test.ts
- [ ] T005 [P] Contract test GET /api/waterfall/history in src/test/contract/waterfall-history.test.ts
- [ ] T006 [P] Contract test GET /api/waterfall/config in src/test/contract/waterfall-config-get.test.ts
- [ ] T007 [P] Contract test PUT /api/waterfall/config in src/test/contract/waterfall-config-put.test.ts
- [ ] T008 [P] Contract test GET /api/waterfall/signals in src/test/contract/waterfall-signals.test.ts
- [ ] T009 [P] Contract test POST /api/waterfall/export in src/test/contract/waterfall-export.test.ts

### Integration Tests
- [ ] T010 [P] Integration test: Audio input to spectrum display in src/test/integration/audio-to-spectrum.test.ts
- [ ] T011 [P] Integration test: Signal detection and SNR calculation in src/test/integration/signal-detection.test.ts
- [ ] T012 [P] Integration test: Configuration persistence in src/test/integration/config-persistence.test.ts
- [ ] T013 [P] Integration test: Data export functionality in src/test/integration/data-export.test.ts
- [ ] T014 [P] Integration test: Performance validation (30 FPS) in src/test/integration/performance.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T015 [P] Create SpectrumSample model in src/lib/waterfall-display/models/spectrum-sample.ts
- [ ] T016 [P] Create WaterfallConfiguration model in src/lib/waterfall-display/models/waterfall-config.ts
- [ ] T017 [P] Create SignalDetection model in src/lib/signal-detector/models/signal-detection.ts
- [ ] T018 [P] Create NoiseProfile model in src/lib/spectrum-analyzer/models/noise-profile.ts
- [ ] T019 [P] Create DisplayBuffer model in src/lib/waterfall-display/models/display-buffer.ts

### Core Libraries
- [ ] T020 [P] Implement FFT processor in src/lib/spectrum-analyzer/fft-processor.ts
- [ ] T021 [P] Implement noise floor estimator in src/lib/spectrum-analyzer/noise-estimator.ts
- [ ] T022 [P] Implement SNR calculator in src/lib/signal-detector/snr-calculator.ts
- [ ] T023 [P] Implement peak detector in src/lib/signal-detector/peak-detector.ts
- [ ] T024 [P] Implement color mapper in src/lib/waterfall-display/color-mapper.ts
- [ ] T025 Implement canvas renderer in src/lib/waterfall-display/canvas-renderer.ts
- [ ] T026 Implement spectrum analyzer main class in src/lib/spectrum-analyzer/index.ts
- [ ] T027 Implement signal detector main class in src/lib/signal-detector/index.ts
- [ ] T028 Implement waterfall display main class in src/lib/waterfall-display/index.ts

### API Implementation
- [ ] T029 Implement GET /api/waterfall/spectrum endpoint
- [ ] T030 Implement GET /api/waterfall/history endpoint
- [ ] T031 Implement GET/PUT /api/waterfall/config endpoints
- [ ] T032 Implement GET /api/waterfall/signals endpoint
- [ ] T033 Implement POST /api/waterfall/export endpoint

### React Component
- [ ] T034 Create WaterfallDisplay React component in src/components/WaterfallDisplay.tsx
- [ ] T035 Create WaterfallControls component in src/components/WaterfallControls.tsx
- [ ] T036 Create SignalInfo display component in src/components/SignalInfo.tsx

## Phase 3.4: Integration
- [ ] T037 Connect audio input pipeline to spectrum analyzer
- [ ] T038 Wire spectrum analyzer to waterfall display
- [ ] T039 Connect signal detector to spectrum data
- [ ] T040 Implement IndexedDB persistence for configuration
- [ ] T041 Add Web Worker for FFT processing
- [ ] T042 Implement frame skipping for performance

## Phase 3.5: Polish
- [ ] T043 [P] Unit tests for FFT accuracy in src/lib/spectrum-analyzer/fft-processor.test.ts
- [ ] T044 [P] Unit tests for color mapping in src/lib/waterfall-display/color-mapper.test.ts
- [ ] T045 [P] Unit tests for signal detection in src/lib/signal-detector/peak-detector.test.ts
- [ ] T046 [P] Performance optimization: Implement offscreen canvas
- [ ] T047 [P] Documentation: Create API documentation in docs/waterfall-api.md
- [ ] T048 [P] Documentation: Create user guide in docs/waterfall-guide.md
- [ ] T049 Memory leak testing and optimization
- [ ] T050 Run quickstart.md validation scenarios

## Dependencies
- Setup (T001-T003) must complete first
- All tests (T004-T014) before any implementation
- Models (T015-T019) before core libraries
- Core libraries (T020-T028) before API endpoints
- API endpoints (T029-T033) before React components
- Components (T034-T036) before integration
- Everything before polish phase

## Parallel Execution Examples

### Parallel Test Creation
```
# Launch T004-T009 together (contract tests):
Task: "Contract test GET /api/waterfall/spectrum in src/test/contract/waterfall-spectrum.test.ts"
Task: "Contract test GET /api/waterfall/history in src/test/contract/waterfall-history.test.ts"
Task: "Contract test GET /api/waterfall/config in src/test/contract/waterfall-config-get.test.ts"
Task: "Contract test PUT /api/waterfall/config in src/test/contract/waterfall-config-put.test.ts"
Task: "Contract test GET /api/waterfall/signals in src/test/contract/waterfall-signals.test.ts"
Task: "Contract test POST /api/waterfall/export in src/test/contract/waterfall-export.test.ts"
```

### Parallel Model Creation
```
# Launch T015-T019 together (data models):
Task: "Create SpectrumSample model in src/lib/waterfall-display/models/spectrum-sample.ts"
Task: "Create WaterfallConfiguration model in src/lib/waterfall-display/models/waterfall-config.ts"
Task: "Create SignalDetection model in src/lib/signal-detector/models/signal-detection.ts"
Task: "Create NoiseProfile model in src/lib/spectrum-analyzer/models/noise-profile.ts"
Task: "Create DisplayBuffer model in src/lib/waterfall-display/models/display-buffer.ts"
```

### Parallel Core Implementation
```
# Launch T020-T024 together (independent modules):
Task: "Implement FFT processor in src/lib/spectrum-analyzer/fft-processor.ts"
Task: "Implement noise floor estimator in src/lib/spectrum-analyzer/noise-estimator.ts"
Task: "Implement SNR calculator in src/lib/signal-detector/snr-calculator.ts"
Task: "Implement peak detector in src/lib/signal-detector/peak-detector.ts"
Task: "Implement color mapper in src/lib/waterfall-display/color-mapper.ts"
```

## Notes
- [P] tasks work on different files with no dependencies
- Verify all tests fail before implementing (RED phase of TDD)
- Commit after each task completion
- Canvas rendering and main classes cannot be parallel (shared dependencies)
- API endpoints share router configuration (sequential)
- Performance testing should run last to validate complete system

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T004-T009)
- [x] All entities have model tasks (T015-T019)
- [x] All tests come before implementation (T004-T014 before T015+)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task