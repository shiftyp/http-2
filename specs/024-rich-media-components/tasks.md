# Tasks: Rich Media Components

**Input**: Design documents from `/specs/024-rich-media-components/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.x, React 18, WebAssembly codecs, YAML parser
   → Libraries: media-codecs, yaml-serializer, media-cache, ofdm-media-transport, media-components
   → Structure: Single project with integrated libraries
2. Load optional design documents ✓
   → data-model.md: MediaComponent, TransmissionState, CompressionProfile entities
   → contracts/: media-api.yaml, transmission-api.yaml, yaml-serialization-api.yaml
   → research.md: WebAssembly codecs, YAML serialization, OFDM allocation
3. Generate tasks by category ✓
   → Setup: WebAssembly codecs, YAML dependencies, IndexedDB schema
   → Tests: Contract tests for 3 APIs, integration tests for transmission/loading
   → Core: 5 libraries, React components, compression profiles
   → Integration: OFDM transmission, cache management, FCC validation
   → Polish: Unit tests, performance optimization, documentation
4. Apply task rules ✓
   → Different files = [P] for parallel execution
   → Same file = sequential dependencies
   → Tests before implementation (TDD enforced)
5. Number tasks sequentially (T001-T033) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
   → All 3 contracts have test tasks
   → All 6 entities have model tasks
   → All APIs implemented
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- React components in `src/components/`
- Libraries in `src/lib/`
- Tests in `tests/contract/`, `tests/integration/`, `tests/unit/`

## Phase 3.1: Setup

- [ ] T001 Create WebAssembly codec dependencies (mozjpeg-wasm, libwebp-wasm, opus-encoder-wasm)
- [ ] T002 Initialize YAML serialization with js-yaml library
- [ ] T003 [P] Configure IndexedDB schema for media storage in src/lib/database/media-schema.ts
- [ ] T004 [P] Set up WebAssembly module loading in src/lib/media-codecs/wasm-loader.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T005 [P] Contract test POST /api/media/upload in tests/contract/media-upload.test.ts
- [ ] T006 [P] Contract test POST /api/media/compress in tests/contract/media-compression.test.ts
- [ ] T007 [P] Contract test GET /api/media/gallery in tests/contract/media-gallery.test.ts
- [ ] T008 [P] Contract test POST /api/transmission/queue in tests/contract/transmission-queue.test.ts
- [ ] T009 [P] Contract test GET /api/transmission/progress in tests/contract/transmission-progress.test.ts
- [ ] T010 [P] Contract test POST /api/components/serialize in tests/contract/yaml-serialization.test.ts
- [ ] T011 [P] Contract test POST /api/components/deserialize in tests/contract/yaml-deserialization.test.ts

### Integration Tests
- [ ] T012 [P] Integration test image progressive loading in tests/integration/progressive-loading.test.ts
- [ ] T013 [P] Integration test OFDM media transmission in tests/integration/ofdm-transmission.test.ts
- [ ] T014 [P] Integration test cache management in tests/integration/cache-management.test.ts
- [ ] T015 [P] Integration test compression profile switching in tests/integration/compression-profiles.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T016 [P] MediaComponent model in src/lib/media-cache/MediaComponent.ts
- [ ] T017 [P] TransmissionState model in src/lib/ofdm-media-transport/TransmissionState.ts
- [ ] T018 [P] CompressionProfile model in src/lib/media-codecs/CompressionProfile.ts
- [ ] T019 [P] MediaGallery model in src/lib/media-cache/MediaGallery.ts
- [ ] T020 [P] YAMLComponent model in src/lib/yaml-serializer/YAMLComponent.ts
- [ ] T021 [P] CodecConfiguration model in src/lib/media-codecs/CodecConfiguration.ts

### Core Libraries
- [ ] T022 [P] WebAssembly codec manager in src/lib/media-codecs/CodecManager.ts
- [ ] T023 [P] YAML serializer service in src/lib/yaml-serializer/ComponentSerializer.ts
- [ ] T024 [P] Media cache service in src/lib/media-cache/MediaCacheService.ts
- [ ] T025 [P] OFDM transmission queue in src/lib/ofdm-media-transport/TransmissionQueue.ts
- [ ] T026 [P] Progressive loading handler in src/lib/media-cache/ProgressiveLoader.ts

### React Components
- [ ] T027 [P] MediaImage component in src/components/MediaImage/MediaImage.tsx
- [ ] T028 [P] MediaAudio component in src/components/MediaAudio/MediaAudio.tsx
- [ ] T029 [P] MediaVideo component in src/components/MediaVideo/MediaVideo.tsx
- [ ] T030 [P] MediaDocument component in src/components/MediaDocument/MediaDocument.tsx

## Phase 3.4: Integration

- [ ] T031 Connect MediaCacheService to IndexedDB storage
- [ ] T032 Integrate OFDM transmission with existing mesh networking
- [ ] T033 Add media components to visual page builder palette
- [ ] T034 Implement YAML serialization in page export
- [ ] T035 Add compression profile selection to component properties
- [ ] T036 Integrate FCC compliance validation for media content

## Phase 3.5: Polish

- [ ] T037 [P] Unit tests for codec selection in tests/unit/codec-selection.test.ts
- [ ] T038 [P] Unit tests for YAML compression in tests/unit/yaml-compression.test.ts
- [ ] T039 [P] Unit tests for cache eviction in tests/unit/cache-eviction.test.ts
- [ ] T040 Performance tests for compression times (<5s target)
- [ ] T041 Performance tests for transmission throughput (>100 kbps OFDM)
- [ ] T042 [P] Update CLAUDE.md with media component usage
- [ ] T043 Remove code duplication between media components
- [ ] T044 Manual testing of emergency broadcast scenario per quickstart.md

## Dependencies

**Phase Dependencies**:
- Setup (T001-T004) → Tests (T005-T015) → Implementation (T016-T030) → Integration (T031-T036) → Polish (T037-T044)

**Critical Blocking Relationships**:
- T003 (IndexedDB schema) blocks T024 (MediaCacheService)
- T004 (WASM loader) blocks T022 (CodecManager)
- T016-T021 (models) block T022-T026 (services)
- T022 (CodecManager) blocks T027-T030 (React components)
- T025 (TransmissionQueue) blocks T032 (OFDM integration)
- T023 (YAML serializer) blocks T034 (page export)

**File-Level Dependencies**:
- T031 requires T024 (same MediaCacheService file)
- T033 requires T027-T030 (component registration)
- T034 requires T023 (YAML integration)

## Parallel Example

### Phase 3.2 Tests (All Parallel):
```bash
# Launch contract tests together:
npm run test:parallel \
  tests/contract/media-upload.test.ts \
  tests/contract/media-compression.test.ts \
  tests/contract/media-gallery.test.ts \
  tests/contract/transmission-queue.test.ts \
  tests/contract/transmission-progress.test.ts \
  tests/contract/yaml-serialization.test.ts \
  tests/contract/yaml-deserialization.test.ts

# Launch integration tests together:
npm run test:parallel \
  tests/integration/progressive-loading.test.ts \
  tests/integration/ofdm-transmission.test.ts \
  tests/integration/cache-management.test.ts \
  tests/integration/compression-profiles.test.ts
```

### Phase 3.3 Models (All Parallel):
```bash
# Create all data models simultaneously:
Task: "MediaComponent model in src/lib/media-cache/MediaComponent.ts"
Task: "TransmissionState model in src/lib/ofdm-media-transport/TransmissionState.ts"
Task: "CompressionProfile model in src/lib/media-codecs/CompressionProfile.ts"
Task: "MediaGallery model in src/lib/media-cache/MediaGallery.ts"
Task: "YAMLComponent model in src/lib/yaml-serializer/YAMLComponent.ts"
Task: "CodecConfiguration model in src/lib/media-codecs/CodecConfiguration.ts"
```

### Phase 3.3 Libraries (All Parallel after models complete):
```bash
# Create all service libraries simultaneously:
Task: "WebAssembly codec manager in src/lib/media-codecs/CodecManager.ts"
Task: "YAML serializer service in src/lib/yaml-serializer/ComponentSerializer.ts"
Task: "Media cache service in src/lib/media-cache/MediaCacheService.ts"
Task: "OFDM transmission queue in src/lib/ofdm-media-transport/TransmissionQueue.ts"
Task: "Progressive loading handler in src/lib/media-cache/ProgressiveLoader.ts"
```

### Phase 3.3 React Components (All Parallel after services complete):
```bash
# Create all React components simultaneously:
Task: "MediaImage component in src/components/MediaImage/MediaImage.tsx"
Task: "MediaAudio component in src/components/MediaAudio/MediaAudio.tsx"
Task: "MediaVideo component in src/components/MediaVideo/MediaVideo.tsx"
Task: "MediaDocument component in src/components/MediaDocument/MediaDocument.tsx"
```

## Notes

- **[P] tasks**: Different files, no shared dependencies, can run in parallel
- **TDD Enforcement**: All T005-T015 tests must fail before implementing T016-T030
- **WASM Integration**: T001, T004, T022 form the WebAssembly loading pipeline
- **OFDM Integration**: T008, T013, T025, T032 enable parallel media transmission
- **Performance Targets**: <5s compression (T040), >100 kbps transmission (T041)
- **FCC Compliance**: T036 ensures amateur radio regulatory compliance
- **Emergency Priority**: All tasks support emergency broadcast scenarios

## Task Generation Rules Applied

1. **From Contracts**:
   - media-api.yaml → T005, T006, T007 (upload, compress, gallery)
   - transmission-api.yaml → T008, T009 (queue, progress)
   - yaml-serialization-api.yaml → T010, T011 (serialize, deserialize)

2. **From Data Model**:
   - MediaComponent → T016
   - TransmissionState → T017
   - CompressionProfile → T018
   - MediaGallery → T019
   - YAMLComponent → T020
   - CodecConfiguration → T021

3. **From User Stories** (quickstart.md):
   - Image upload/transmission → T012, T027
   - Audio recording/playback → T028
   - Video keyframe extraction → T029
   - Document PDF rendering → T030
   - Progressive loading → T012, T026
   - Emergency broadcast → T044

## Validation Checklist ✓

- [x] All 3 contracts have corresponding test tasks (T005-T011)
- [x] All 6 entities have model creation tasks (T016-T021)
- [x] All tests come before implementation (T005-T015 before T016-T030)
- [x] Parallel tasks are truly independent (different files, no shared state)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] TDD enforced with explicit "MUST FAIL" requirement
- [x] Performance and FCC compliance requirements covered
- [x] Emergency broadcast scenario tested per constitutional requirements

---
*Tasks generated from rich media components design documents - Version 1.0.0*