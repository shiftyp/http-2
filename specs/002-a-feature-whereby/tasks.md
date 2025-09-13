# Tasks: WebRTC Local Data Transfer

**Input**: Design documents from `/specs/002-a-feature-whereby/`
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
- **PWA project**: `src/lib/`, `src/components/`, `tests/` at repository root
- All paths shown are relative to repository root

## Phase 3.1: Setup
- [ ] T001 Create library directories for webrtc-transfer, qr-shortcode, station-data, transfer-crypto
- [ ] T002 Install WebRTC and crypto dependencies: qrcode, qr-scanner, web-streams-polyfill
- [ ] T003 [P] Configure TypeScript for Web Crypto API and WebRTC types
- [ ] T004 [P] Set up Vitest configuration for browser testing environment

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T005 [P] Contract test for WebRTC signaling protocol in tests/contract/webrtc-signaling.test.ts
- [ ] T006 [P] Contract test for data transfer protocol in tests/contract/data-transfer.test.ts
- [ ] T007 [P] Contract test for encryption protocol in tests/contract/encryption.test.ts

### Integration Tests (from quickstart scenarios)
- [ ] T008 [P] Integration test: Complete station migration in tests/integration/station-migration.test.ts
- [ ] T009 [P] Integration test: Selective logbook transfer in tests/integration/selective-transfer.test.ts
- [ ] T010 [P] Integration test: Emergency backup scenario in tests/integration/emergency-backup.test.ts
- [ ] T011 [P] Integration test: Network interruption recovery in tests/integration/network-recovery.test.ts
- [ ] T012 [P] Integration test: Code expiration handling in tests/integration/code-expiration.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models (from data-model.md entities)
- [ ] T013 [P] TransferSession model in src/lib/station-data/models/transfer-session.ts
- [ ] T014 [P] ConnectionCode model in src/lib/qr-shortcode/models/connection-code.ts
- [ ] T015 [P] StationData model in src/lib/station-data/models/station-data.ts
- [ ] T016 [P] TransferChunk model in src/lib/webrtc-transfer/models/transfer-chunk.ts
- [ ] T017 [P] TransferLog model in src/lib/station-data/models/transfer-log.ts
- [ ] T018 [P] MergeResult model in src/lib/station-data/models/merge-result.ts

### Core Libraries
- [ ] T019 WebRTC connection manager in src/lib/webrtc-transfer/connection.ts
- [ ] T020 SDP signaling handler in src/lib/webrtc-transfer/signaling.ts
- [ ] T021 Data channel management in src/lib/webrtc-transfer/channel.ts
- [ ] T022 [P] QR code generator in src/lib/qr-shortcode/generator.ts
- [ ] T023 [P] QR code scanner in src/lib/qr-shortcode/scanner.ts
- [ ] T024 [P] Shortcode validator in src/lib/qr-shortcode/validator.ts
- [ ] T025 [P] Station data exporter in src/lib/station-data/exporter.ts
- [ ] T026 [P] Station data importer in src/lib/station-data/importer.ts
- [ ] T027 Intelligent data merger in src/lib/station-data/merger.ts
- [ ] T028 [P] Session key management in src/lib/transfer-crypto/session.ts
- [ ] T029 [P] Streaming encryption in src/lib/transfer-crypto/stream.ts
- [ ] T030 [P] Data integrity checker in src/lib/transfer-crypto/integrity.ts

### IndexedDB Storage
- [ ] T031 Transfer session store in src/lib/station-data/stores/session-store.ts
- [ ] T032 Transfer log store in src/lib/station-data/stores/log-store.ts
- [ ] T033 Connection code store in src/lib/qr-shortcode/stores/code-store.ts
- [ ] T034 Merge result store in src/lib/station-data/stores/merge-store.ts

## Phase 3.4: UI Components

### React Components
- [ ] T035 TransferWizard component in src/components/TransferWizard/TransferWizard.tsx
- [ ] T036 QRScanner component in src/components/QRScanner/QRScanner.tsx
- [ ] T037 ProgressIndicator component in src/components/ProgressIndicator/ProgressIndicator.tsx
- [ ] T038 DataPreview component in src/components/DataPreview/DataPreview.tsx
- [ ] T039 MergeConflictResolver component in src/components/MergeConflictResolver/MergeConflictResolver.tsx

### Pages
- [ ] T040 Transfer page in src/pages/transfer/index.tsx
- [ ] T041 Transfer settings page in src/pages/settings/transfer.tsx

## Phase 3.5: Service Worker Integration

- [ ] T042 Transfer worker for background processing in src/workers/transfer-worker.ts
- [ ] T043 Message passing between main window and worker
- [ ] T044 Offline queue management for failed transfers
- [ ] T045 Background sync for resuming transfers

## Phase 3.6: Integration

- [ ] T046 Connect WebRTC library to UI components
- [ ] T047 Wire up IndexedDB stores to models
- [ ] T048 Integrate encryption with data transfer
- [ ] T049 Connect QR scanner to connection establishment
- [ ] T050 Hook up progress tracking to UI
- [ ] T051 Implement transfer logging for audit

## Phase 3.7: Polish

- [ ] T052 [P] Unit tests for QR code generation in tests/unit/qr-generator.test.ts
- [ ] T053 [P] Unit tests for data merging logic in tests/unit/merger.test.ts
- [ ] T054 [P] Unit tests for encryption/decryption in tests/unit/crypto.test.ts
- [ ] T055 [P] Unit tests for chunk validation in tests/unit/chunk-validator.test.ts
- [ ] T056 Performance test: 1MB/s transfer rate validation
- [ ] T057 Performance test: <1 second connection establishment
- [ ] T058 [P] Update documentation in docs/webrtc-transfer.md
- [ ] T059 [P] Create llms.txt for each library
- [ ] T060 Manual testing following quickstart.md scenarios

## Dependencies
- Setup (T001-T004) must complete first
- All tests (T005-T012) before any implementation (T013+)
- Models (T013-T018) before services that use them
- Core libraries (T019-T030) before UI components (T035-T041)
- IndexedDB stores (T031-T034) can run parallel with core libraries
- Service worker (T042-T045) after core libraries
- Integration (T046-T051) after all components complete
- Polish (T052-T060) last

## Parallel Execution Examples

### Batch 1: All contract and integration tests (after setup)
```bash
# Launch T005-T012 together:
Task: "Contract test for WebRTC signaling protocol in tests/contract/webrtc-signaling.test.ts"
Task: "Contract test for data transfer protocol in tests/contract/data-transfer.test.ts"
Task: "Contract test for encryption protocol in tests/contract/encryption.test.ts"
Task: "Integration test: Complete station migration in tests/integration/station-migration.test.ts"
Task: "Integration test: Selective logbook transfer in tests/integration/selective-transfer.test.ts"
Task: "Integration test: Emergency backup scenario in tests/integration/emergency-backup.test.ts"
Task: "Integration test: Network interruption recovery in tests/integration/network-recovery.test.ts"
Task: "Integration test: Code expiration handling in tests/integration/code-expiration.test.ts"
```

### Batch 2: All data models (after tests fail)
```bash
# Launch T013-T018 together:
Task: "TransferSession model in src/lib/station-data/models/transfer-session.ts"
Task: "ConnectionCode model in src/lib/qr-shortcode/models/connection-code.ts"
Task: "StationData model in src/lib/station-data/models/station-data.ts"
Task: "TransferChunk model in src/lib/webrtc-transfer/models/transfer-chunk.ts"
Task: "TransferLog model in src/lib/station-data/models/transfer-log.ts"
Task: "MergeResult model in src/lib/station-data/models/merge-result.ts"
```

### Batch 3: Independent library components
```bash
# Launch T022-T026, T028-T030 together:
Task: "QR code generator in src/lib/qr-shortcode/generator.ts"
Task: "QR code scanner in src/lib/qr-shortcode/scanner.ts"
Task: "Shortcode validator in src/lib/qr-shortcode/validator.ts"
Task: "Station data exporter in src/lib/station-data/exporter.ts"
Task: "Station data importer in src/lib/station-data/importer.ts"
Task: "Session key management in src/lib/transfer-crypto/session.ts"
Task: "Streaming encryption in src/lib/transfer-crypto/stream.ts"
Task: "Data integrity checker in src/lib/transfer-crypto/integrity.ts"
```

### Batch 4: Unit tests (during polish phase)
```bash
# Launch T052-T055 together:
Task: "Unit tests for QR code generation in tests/unit/qr-generator.test.ts"
Task: "Unit tests for data merging logic in tests/unit/merger.test.ts"
Task: "Unit tests for encryption/decryption in tests/unit/crypto.test.ts"
Task: "Unit tests for chunk validation in tests/unit/chunk-validator.test.ts"
```

## Notes
- [P] tasks operate on different files with no dependencies
- WebRTC connection components (T019-T021) must be sequential (shared state)
- UI components can be developed in parallel once core libraries exist
- Service worker integration requires core libraries to be complete
- All tests must fail before implementation per TDD requirements
- Commit after each task completion
- Run integration tests after each phase to ensure nothing breaks

## Validation Checklist
*GATE: Verified before task execution*

- [x] All 3 contracts have corresponding test tasks (T005-T007)
- [x] All 6 entities have model tasks (T013-T018)
- [x] All tests come before implementation (T005-T012 before T013+)
- [x] Parallel tasks operate on independent files
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Integration scenarios from quickstart.md covered (T008-T012)
- [x] All 4 libraries from plan.md have implementation tasks

---
*Generated from design documents. Ready for execution.*