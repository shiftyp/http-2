# Tasks: SDR Support for Wide-Band Monitoring

**Input**: Design documents from `/specs/015-sdr-support/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Loaded successfully: SDR support for wide-band monitoring
2. Load optional design documents:
   → data-model.md: 12 entities extracted → model tasks
   → contracts/: 3 API files → contract test tasks
   → research.md: WebUSB/WebAssembly decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, libraries
   → Integration: IndexedDB, WebUSB, WebAssembly
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests ✓
   → All entities have models ✓
   → All endpoints implemented ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Progressive Web App**: `src/` at repository root per existing architecture
- Extends existing structure: `src/lib/sdr-support/`
- Tests in existing `tests/` structure

## Phase 3.1: Setup
- [ ] T001 Create SDR support library structure in src/lib/sdr-support/
- [ ] T002 Add WebUSB and WebAssembly dependencies to package.json
- [ ] T003 [P] Configure TypeScript types for WebUSB API in src/types/webusb.d.ts
- [ ] T004 [P] Download and configure PulseFFT.wasm in public/workers/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (based on API contracts)
- [ ] T005 [P] Contract test SDR device API in tests/contract/sdr-device-api.contract.test.ts
- [ ] T006 [P] Contract test spectrum monitoring API in tests/contract/spectrum-monitoring-api.contract.test.ts
- [ ] T007 [P] Contract test content discovery API in tests/contract/content-discovery-api.contract.test.ts

### Integration Tests (based on quickstart scenarios)
- [ ] T008 [P] Integration test SDR device connection in tests/integration/sdr-device-connection.test.ts
- [ ] T009 [P] Integration test multi-band monitoring in tests/integration/multi-band-monitoring.test.ts
- [ ] T010 [P] Integration test content discovery caching in tests/integration/content-discovery-caching.test.ts
- [ ] T011 [P] Integration test waterfall display rendering in tests/integration/waterfall-display.test.ts
- [ ] T012 [P] Integration test emergency frequency override in tests/integration/emergency-override.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models (based on data-model.md entities)
- [ ] T013 [P] SDRDevice model in src/lib/sdr-support/models/SDRDevice.ts
- [ ] T014 [P] SDRCapabilities model in src/lib/sdr-support/models/SDRCapabilities.ts
- [ ] T015 [P] MonitoringConfiguration model in src/lib/sdr-support/models/MonitoringConfiguration.ts
- [ ] T016 [P] FrequencyRange model in src/lib/sdr-support/models/FrequencyRange.ts
- [ ] T017 [P] SpectrumData model in src/lib/sdr-support/models/SpectrumData.ts
- [ ] T018 [P] SignalPeak model in src/lib/sdr-support/models/SignalPeak.ts
- [ ] T019 [P] DecodedTransmission model in src/lib/sdr-support/models/DecodedTransmission.ts
- [ ] T020 [P] SignalQuality model in src/lib/sdr-support/models/SignalQuality.ts
- [ ] T021 [P] AutoDiscoveryCache model in src/lib/sdr-support/models/AutoDiscoveryCache.ts
- [ ] T022 [P] WaterfallDisplay model in src/lib/sdr-support/models/WaterfallDisplay.ts

### Core Libraries (based on plan.md architecture)
- [ ] T023 [P] SDR device manager service in src/lib/sdr-support/sdr-device-manager/index.ts
- [ ] T024 [P] Spectrum monitor service in src/lib/sdr-support/spectrum-monitor/index.ts
- [ ] T025 [P] Signal decoder service in src/lib/sdr-support/signal-decoder/index.ts
- [ ] T026 [P] Waterfall display service in src/lib/sdr-support/waterfall-display/index.ts
- [ ] T027 [P] Auto-discovery cache service in src/lib/sdr-support/auto-discovery-cache/index.ts

### WebUSB Device Drivers (based on research.md)
- [ ] T028 [P] RTL-SDR WebUSB driver in src/lib/sdr-support/drivers/rtl-sdr.ts
- [ ] T029 [P] HackRF WebUSB driver in src/lib/sdr-support/drivers/hackrf.ts
- [ ] T030 [P] LimeSDR WebUSB driver in src/lib/sdr-support/drivers/limesdr.ts
- [ ] T031 [P] PlutoSDR WebUSB driver in src/lib/sdr-support/drivers/plutosdr.ts
- [ ] T032 [P] SDRplay WebUSB driver in src/lib/sdr-support/drivers/sdrplay.ts

### WebAssembly Integration
- [ ] T033 WebAssembly FFT processor wrapper in src/lib/sdr-support/dsp/fft-processor.ts
- [ ] T034 WebWorker for background signal processing in src/workers/sdr-processor.worker.ts

### API Implementation
- [ ] T035 SDR device API endpoints in src/api/sdr-devices.ts
- [ ] T036 Spectrum monitoring API endpoints in src/api/spectrum-monitoring.ts
- [ ] T037 Content discovery API endpoints in src/api/content-discovery.ts

## Phase 3.4: Integration

### IndexedDB Integration
- [ ] T038 SDR configuration persistence in src/lib/sdr-support/storage/sdr-config-store.ts
- [ ] T039 Spectrum data caching in src/lib/sdr-support/storage/spectrum-data-store.ts
- [ ] T040 Auto-discovery cache storage in src/lib/sdr-support/storage/auto-discovery-store.ts

### Mesh Network Integration
- [ ] T041 Integrate SDR cache with BitTorrent chunk serving in src/lib/sdr-support/integration/chunk-integration.ts
- [ ] T042 Update CQ beacons with discovered content in src/lib/sdr-support/integration/beacon-integration.ts
- [ ] T043 FCC compliance logging for decoded transmissions in src/lib/sdr-support/compliance/fcc-logger.ts

### UI Components
- [ ] T044 [P] SDR Monitor Dashboard component in src/components/SDRMonitorDashboard/index.tsx
- [ ] T045 [P] Waterfall Display component in src/components/WaterfallDisplay/index.tsx
- [ ] T046 [P] Device Configuration component in src/components/DeviceConfiguration/index.tsx
- [ ] T047 [P] Spectrum Analyzer component in src/components/SpectrumAnalyzer/index.tsx

### Performance Optimization
- [ ] T048 Circular buffer implementation for real-time data in src/lib/sdr-support/utils/circular-buffer.ts
- [ ] T049 WebGL waterfall renderer in src/lib/sdr-support/rendering/webgl-waterfall.ts
- [ ] T050 SIMD-optimized signal processing in src/lib/sdr-support/dsp/simd-optimized.ts

## Phase 3.5: Polish

### Unit Tests
- [ ] T051 [P] Unit tests for SDR device drivers in tests/unit/sdr-device-drivers.test.ts
- [ ] T052 [P] Unit tests for FFT processing in tests/unit/fft-processor.test.ts
- [ ] T053 [P] Unit tests for signal quality analysis in tests/unit/signal-quality.test.ts
- [ ] T054 [P] Unit tests for frequency validation in tests/unit/frequency-validation.test.ts
- [ ] T055 [P] Unit tests for cache management in tests/unit/cache-management.test.ts

### Performance & Validation
- [ ] T056 Performance tests (<100ms decode latency) in tests/performance/sdr-decode-latency.test.ts
- [ ] T057 Memory usage tests (<500MB) in tests/performance/sdr-memory-usage.test.ts
- [ ] T058 CPU usage validation (<50% on dual-core) in tests/performance/sdr-cpu-usage.test.ts
- [ ] T059 Multi-device stress testing in tests/stress/multi-device-stress.test.ts

### Documentation Updates
- [ ] T060 [P] Update CLAUDE.md with SDR support documentation
- [ ] T061 [P] Create SDR troubleshooting guide in docs/sdr-troubleshooting.md
- [ ] T062 [P] Update main README with SDR hardware requirements

### Final Integration
- [ ] T063 End-to-end test suite for complete SDR workflow in tests/e2e/sdr-complete-workflow.test.ts
- [ ] T064 Manual testing validation per quickstart.md scenarios
- [ ] T065 Remove development scaffolding and optimize bundle size

## Dependencies

### Sequential Dependencies
- Setup (T001-T004) → Tests (T005-T012)
- Tests (T005-T012) → Models (T013-T022)
- Models (T013-T022) → Services (T023-T027)
- WebUSB drivers (T028-T032) depend on device manager (T023)
- WebAssembly (T033-T034) depends on signal decoder (T025)
- API (T035-T037) depends on all core services
- Storage (T038-T040) depends on models
- UI Components (T044-T047) depend on services and API
- Performance (T048-T050) can run after core services
- Unit tests (T051-T055) depend on implementation
- Performance tests (T056-T059) depend on complete system
- Documentation (T060-T062) can run in parallel after core implementation
- Final tests (T063-T065) depend on everything

### Blocking Relationships
- T023 (device manager) blocks T028-T032 (drivers)
- T025 (signal decoder) blocks T033-T034 (WebAssembly)
- T013-T022 (models) block T038-T040 (storage)
- T023-T027 (services) block T035-T037 (API)
- T035-T037 (API) blocks T044-T047 (UI components)

## Parallel Example

### Phase 3.2 Test Creation (run together):
```
Task: "Contract test SDR device API in tests/contract/sdr-device-api.contract.test.ts"
Task: "Contract test spectrum monitoring API in tests/contract/spectrum-monitoring-api.contract.test.ts"
Task: "Contract test content discovery API in tests/contract/content-discovery-api.contract.test.ts"
Task: "Integration test SDR device connection in tests/integration/sdr-device-connection.test.ts"
Task: "Integration test multi-band monitoring in tests/integration/multi-band-monitoring.test.ts"
```

### Phase 3.3 Model Creation (run together):
```
Task: "SDRDevice model in src/lib/sdr-support/models/SDRDevice.ts"
Task: "SDRCapabilities model in src/lib/sdr-support/models/SDRCapabilities.ts"
Task: "MonitoringConfiguration model in src/lib/sdr-support/models/MonitoringConfiguration.ts"
Task: "FrequencyRange model in src/lib/sdr-support/models/FrequencyRange.ts"
Task: "SpectrumData model in src/lib/sdr-support/models/SpectrumData.ts"
```

### Phase 3.4 UI Components (run together):
```
Task: "SDR Monitor Dashboard component in src/components/SDRMonitorDashboard/index.tsx"
Task: "Waterfall Display component in src/components/WaterfallDisplay/index.tsx"
Task: "Device Configuration component in src/components/DeviceConfiguration/index.tsx"
Task: "Spectrum Analyzer component in src/components/SpectrumAnalyzer/index.tsx"
```

## Notes
- [P] tasks = different files, no dependencies, can run in parallel
- Verify all contract and integration tests fail before implementing (TDD)
- Commit after each completed task
- SDR hardware testing requires physical devices or mock implementations
- WebUSB requires HTTPS and user gesture for security
- Emergency frequency monitoring (priority 1-3) takes precedence over content discovery
- FCC Part 97 compliance logging is mandatory for all decoded transmissions

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**: 3 contract files → 3 contract test tasks [P]
2. **From Data Model**: 10 entities → 10 model creation tasks [P]
3. **From User Stories**: 5 quickstart scenarios → 5 integration tests [P]
4. **From Plan Architecture**: 5 core libraries → 5 service implementation tasks [P]
5. **From Research Decisions**: 5 SDR device types → 5 driver implementation tasks [P]

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T005-T007)
- [x] All entities have model tasks (T013-T022)
- [x] All tests come before implementation (T005-T012 before T013+)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] WebUSB security requirements documented
- [x] FCC compliance requirements included
- [x] Performance targets specified (<100ms decode, <500MB memory, <50% CPU)