# Tasks: OFDM with Parallel BitTorrent Transmission

**Input**: Design documents from `/specs/023-ofdm/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.x, Web Audio API, WebAssembly, IndexedDB
   → Libraries: ofdm-modem, parallel-chunk-manager, carrier-health-monitor
2. Load optional design documents:
   → data-model.md: 7 entities identified
   → contracts/: 4 API endpoints defined
   → research.md: Technical decisions loaded
3. Generate tasks by category:
   → Setup: library structure, WASM setup, dependencies
   → Tests: contract tests, integration tests, quickstart scenarios
   → Core: OFDM modem, chunk manager, carrier health
   → Integration: IndexedDB, Web Audio, WebWorkers
   → Polish: unit tests, performance, visualization
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T035)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- All paths shown assume single project structure per plan.md

## Phase 3.1: Setup
- [ ] T001 Create library structure: `src/lib/ofdm-modem/`, `src/lib/parallel-chunk-manager/`, `src/lib/carrier-health-monitor/`
- [ ] T002 Set up WebAssembly build for KissFFT in `src/lib/ofdm-modem/wasm/`
- [ ] T003 [P] Install dependencies: `npm install kiss-fft-js @types/webaudio-api`
- [ ] T004 [P] Create WebWorker skeleton at `src/workers/ofdm-processor.ts`
- [ ] T005 [P] Set up IndexedDB schema for OFDM data in `src/lib/database/ofdm-schema.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests [P]
- [ ] T006 [P] Create contract test for parallel chunk frame transmission: `tests/contract/ofdm-parallel-chunk-frame.test.ts`
- [ ] T007 [P] Create contract test for chunk-to-carrier allocation: `tests/contract/ofdm-chunk-allocation.test.ts`
- [ ] T008 [P] Create contract test for carrier health monitoring: `tests/contract/ofdm-carrier-health.test.ts`
- [ ] T009 [P] Create contract test for OFDM configuration: `tests/contract/ofdm-configuration.test.ts`

### Integration Tests [P]
- [ ] T010 [P] Create integration test for parallel web page transfer scenario: `tests/integration/ofdm-parallel-transfer.test.ts`
- [ ] T011 [P] Create integration test for carrier failure redistribution: `tests/integration/ofdm-carrier-redistribution.test.ts`
- [ ] T012 [P] Create integration test for adaptive modulation per carrier: `tests/integration/ofdm-adaptive-modulation.test.ts`
- [ ] T013 [P] Create integration test for chunk pipelining: `tests/integration/ofdm-chunk-pipeline.test.ts`
- [ ] T014 [P] Create integration test for 48 parallel streams: `tests/integration/ofdm-parallel-streams.test.ts`

## Phase 3.3: Core Implementation

### OFDM Modem Library
- [ ] T015 Implement OFDMModem class with FFT/IFFT in `src/lib/ofdm-modem/index.ts`
- [ ] T016 Implement pilot tone insertion/extraction in `src/lib/ofdm-modem/pilot-tones.ts`
- [ ] T017 Implement cyclic prefix generation in `src/lib/ofdm-modem/cyclic-prefix.ts`
- [ ] T018 Implement symbol synchronization in `src/lib/ofdm-modem/symbol-sync.ts`
- [ ] T019 Create OFDM configuration manager in `src/lib/ofdm-modem/config.ts`

### Parallel Chunk Manager Library
- [ ] T020 Implement ParallelChunkManager class in `src/lib/parallel-chunk-manager/index.ts`
- [ ] T021 Implement chunk-to-subcarrier allocator in `src/lib/parallel-chunk-manager/allocator.ts`
- [ ] T022 Implement rarity-based prioritization in `src/lib/parallel-chunk-manager/rarity.ts`
- [ ] T023 Implement chunk pipeline queue in `src/lib/parallel-chunk-manager/pipeline.ts`
- [ ] T024 Create chunk redistribution handler in `src/lib/parallel-chunk-manager/redistribution.ts`

### Carrier Health Monitor Library
- [ ] T025 Implement CarrierHealthMonitor class in `src/lib/carrier-health-monitor/index.ts`
- [ ] T026 Implement SNR estimation per carrier in `src/lib/carrier-health-monitor/snr-estimator.ts`
- [ ] T027 Implement adaptive modulation controller in `src/lib/carrier-health-monitor/modulation.ts`
- [ ] T028 Create carrier enable/disable logic in `src/lib/carrier-health-monitor/carrier-control.ts`

## Phase 3.4: Integration Components

- [ ] T029 Integrate OFDM modem with Web Audio API in `src/lib/ofdm-modem/audio-interface.ts`
- [ ] T030 Connect WebWorker for FFT processing in `src/workers/ofdm-processor.ts`
- [ ] T031 Wire up IndexedDB persistence for carrier metrics in `src/lib/database/ofdm-persistence.ts`
- [ ] T032 Integrate with existing mesh-dl-protocol in `src/lib/mesh-dl-protocol/ofdm-adapter.ts`

## Phase 3.5: UI Components

- [ ] T033 [P] Create OFDM waterfall visualization component in `src/components/OFDMWaterfall/index.tsx`
- [ ] T034 [P] Create chunk allocation matrix display in `src/components/OFDMWaterfall/AllocationMatrix.tsx`
- [ ] T035 [P] Create throughput monitoring dashboard in `src/components/OFDMWaterfall/ThroughputDashboard.tsx`

## Parallel Execution Examples

### Batch 1: Setup Tasks (can run together)
```bash
# Run T003, T004, T005 in parallel
Task agent T003 --description "Install OFDM dependencies"
Task agent T004 --description "Create WebWorker skeleton"
Task agent T005 --description "Set up IndexedDB schema"
```

### Batch 2: All Contract Tests (can run together)
```bash
# Run T006-T009 in parallel
Task agent T006 --description "Contract test for parallel chunk frame"
Task agent T007 --description "Contract test for chunk allocation"
Task agent T008 --description "Contract test for carrier health"
Task agent T009 --description "Contract test for OFDM config"
```

### Batch 3: All Integration Tests (can run together)
```bash
# Run T010-T014 in parallel
Task agent T010 --description "Integration test for parallel transfer"
Task agent T011 --description "Integration test for carrier redistribution"
Task agent T012 --description "Integration test for adaptive modulation"
Task agent T013 --description "Integration test for chunk pipelining"
Task agent T014 --description "Integration test for 48 parallel streams"
```

### Batch 4: UI Components (can run together)
```bash
# Run T033-T035 in parallel
Task agent T033 --description "Create waterfall visualization"
Task agent T034 --description "Create allocation matrix"
Task agent T035 --description "Create throughput dashboard"
```

## Dependencies Graph
```
Setup (T001-T005)
    ↓
Contract Tests (T006-T009) [Parallel]
Integration Tests (T010-T014) [Parallel]
    ↓
OFDM Modem (T015-T019) [Sequential within library]
    ↓
Parallel Chunk Manager (T020-T024) [Sequential within library]
    ↓
Carrier Health Monitor (T025-T028) [Sequential within library]
    ↓
Integration Components (T029-T032) [Sequential]
    ↓
UI Components (T033-T035) [Parallel]
```

## Validation Checklist
- ✅ All 4 contract endpoints have tests (T006-T009)
- ✅ All 7 entities have implementation tasks
- ✅ All quickstart scenarios covered in integration tests
- ✅ TDD order enforced (tests before implementation)
- ✅ Parallel execution opportunities identified
- ✅ Total tasks: 35

## Notes
- WASM compilation for KissFFT may require additional build setup
- Web Audio API requires user interaction to start (include in tests)
- IndexedDB storage quota may need user permission for 50MB
- Performance target: Process FFT in <1ms per symbol