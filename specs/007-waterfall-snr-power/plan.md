# Implementation Plan: Waterfall SNR Power Visualization

**Branch**: `007-waterfall-snr-power` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-waterfall-snr-power/spec.md`

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
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

## Summary
Real-time waterfall visualization for spectrum analysis showing signal strength, SNR, and power levels across time and frequency. Implements FFT-based spectrum analysis with configurable display parameters, signal detection, and data export capabilities.

## Technical Context
**Language/Version**: TypeScript 5.x / ES2022
**Primary Dependencies**: Web Audio API, Canvas API, IndexedDB
**Storage**: IndexedDB for configuration and history
**Testing**: Vitest for unit/integration tests
**Target Platform**: Modern browsers (Chrome, Firefox, Edge) - PWA
**Project Type**: single (browser-based library)
**Performance Goals**: 30 FPS display, <10ms FFT processing, <50MB memory
**Constraints**: 2.8kHz bandwidth limit, browser API limitations
**Scale/Scope**: Single user, 60 second history, 2048-point FFT

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (waterfall library)
- Using framework directly? YES (Canvas API, Web Audio API)
- Single data model? YES (SpectrumSample → Display)
- Avoiding patterns? YES (direct implementation, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? YES (waterfall-display library)
- Libraries listed:
  - waterfall-display: Real-time spectrum visualization
  - spectrum-analyzer: FFT processing and SNR calculation
  - signal-detector: Peak detection and signal identification
- CLI per library: waterfall-display --help/--version/--demo
- Library docs: llms.txt format planned? YES

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (actual audio input, canvas rendering)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? YES
- Frontend logs → backend? N/A (frontend only)
- Error context sufficient? YES

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? N/A (initial version)

## Project Structure

### Documentation (this feature)
```
specs/007-waterfall-snr-power/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✓
├── data-model.md        # Phase 1 output (/plan command) ✓
├── quickstart.md        # Phase 1 output (/plan command) ✓
├── contracts/           # Phase 1 output (/plan command) ✓
│   └── waterfall-api.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT) - SELECTED
src/
├── lib/
│   ├── waterfall-display/
│   │   ├── index.ts
│   │   ├── canvas-renderer.ts
│   │   ├── color-mapper.ts
│   │   └── waterfall-display.test.ts
│   ├── spectrum-analyzer/
│   │   ├── index.ts
│   │   ├── fft-processor.ts
│   │   ├── noise-estimator.ts
│   │   └── spectrum-analyzer.test.ts
│   └── signal-detector/
│       ├── index.ts
│       ├── peak-detector.ts
│       ├── snr-calculator.ts
│       └── signal-detector.test.ts
└── components/
    └── WaterfallDisplay.tsx

tests/
├── contract/
│   └── waterfall-api.test.ts
├── integration/
│   └── waterfall-integration.test.ts
└── unit/
    └── (generated from lib tests)
```

**Structure Decision**: Option 1 (Single project) - Browser-based library with React component

## Phase 0: Outline & Research
✅ COMPLETE - research.md generated with all technical decisions:
- Display update rate: 30Hz
- FFT size: 2048 points
- History buffer: 60 seconds
- Canvas rendering: Dual canvas approach
- Color mapping: HSL interpolation
- Sample rates: 48kHz primary
- Export formats: PNG and CSV
- Performance: RequestAnimationFrame
- SNR calculation: Minimum statistics
- Browser compatibility: Modern browsers only

**Output**: research.md with all NEEDS CLARIFICATION resolved ✓

## Phase 1: Design & Contracts
✅ COMPLETE - All artifacts generated:

1. **Entities extracted** → `data-model.md`:
   - SpectrumSample: FFT analysis result
   - WaterfallConfiguration: User settings
   - SignalDetection: Identified signals
   - NoiseProfile: Background noise
   - DisplayBuffer: Circular history buffer

2. **API contracts generated** → `/contracts/waterfall-api.yaml`:
   - GET /api/waterfall/spectrum
   - GET /api/waterfall/history
   - GET/PUT /api/waterfall/config
   - GET /api/waterfall/signals
   - POST /api/waterfall/export

3. **Contract tests planned**:
   - Schema validation for all endpoints
   - Request/response format tests
   - Error handling tests

4. **Test scenarios extracted** → quickstart.md:
   - Basic functionality verification
   - FT8 signal monitoring
   - Data export validation
   - Performance benchmarks

5. **CLAUDE.md update**: Ready for incremental update

**Output**: data-model.md ✓, /contracts/* ✓, quickstart.md ✓

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Contract tests for API endpoints (5 tasks)
- Model creation for each entity (5 tasks)
- Library implementation tasks (15 tasks)
- Integration test tasks (5 tasks)
- Component creation tasks (5 tasks)
- Performance optimization tasks (3 tasks)

**Ordering Strategy**:
1. Contract tests first (TDD)
2. Core libraries (spectrum-analyzer, signal-detector)
3. Display library (waterfall-display)
4. React component
5. Integration tests
6. Performance optimization

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - all constitutional principles followed*

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
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*