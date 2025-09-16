# Tasks: Unlicensed Mode

**Input**: Design documents from `/specs/016-unlicensed-mode/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.x, React 18, IndexedDB, WebRTC, WebSocket
   → Libraries: certificate-validation, user-mode, rate-limiter, relay-manager, monitor-receiver
2. Load design documents ✓
   → data-model.md: UserMode, Certificate, RateLimitState, RelayPath, ComplianceLog
   → contracts/: 5 API specs (mode-detection, certificate-validation, message-relay, monitoring, compliance)
   → quickstart.md: Test scenarios for unlicensed/licensed modes
3. Generate tasks by category ✓
4. Apply TDD rules: Tests before implementation ✓
5. Number tasks sequentially (T001-T038) ✓
6. Mark parallel tasks with [P] ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Single PWA project: `src/lib/`, `src/test/` at repository root
- All libraries in `src/lib/` following existing pattern
- Tests in `src/test/contract/`, `src/test/integration/`, `src/test/unit/`

## Phase 3.1: Setup
- [ ] T001 Create library directories: src/lib/certificate-validation/, src/lib/user-mode/, src/lib/rate-limiter/, src/lib/relay-manager/, src/lib/monitor-receiver/
- [ ] T002 Initialize TypeScript configurations for new libraries with ES2022 module support
- [ ] T003 [P] Create index.ts exports for each library following existing patterns

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T004 [P] Contract test for mode detection API in src/test/contract/mode-detection.contract.test.ts
- [ ] T005 [P] Contract test for certificate validation API in src/test/contract/certificate-validation.contract.test.ts
- [ ] T006 [P] Contract test for message relay API in src/test/contract/message-relay.contract.test.ts
- [ ] T007 [P] Contract test for monitoring configuration API in src/test/contract/monitoring-configuration.contract.test.ts
- [ ] T008 [P] Contract test for compliance logging API in src/test/contract/compliance-logging.contract.test.ts

### Integration Tests
- [ ] T009 [P] Integration test for unlicensed user initialization in src/test/integration/unlicensed-mode-init.integration.test.ts
- [ ] T010 [P] Integration test for certificate registration and upgrade in src/test/integration/certificate-upgrade.integration.test.ts
- [ ] T011 [P] Integration test for radio monitoring without transmission in src/test/integration/monitor-only-mode.integration.test.ts
- [ ] T012 [P] Integration test for message relay through licensed stations in src/test/integration/relay-routing.integration.test.ts
- [ ] T013 [P] Integration test for rate limiting and DDoS protection in src/test/integration/rate-limiting.integration.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T014 [P] UserMode interface and IndexedDB schema in src/lib/user-mode/models.ts
- [ ] T015 [P] Certificate interface and validation logic in src/lib/certificate-validation/models.ts
- [ ] T016 [P] RateLimitState interface and tracking in src/lib/rate-limiter/models.ts
- [ ] T017 [P] RelayPath and RelayStation interfaces in src/lib/relay-manager/models.ts
- [ ] T018 [P] ComplianceLog interface and storage in src/lib/user-mode/compliance.ts

### Core Libraries
- [ ] T019 UserModeManager class in src/lib/user-mode/manager.ts with mode detection and switching
- [ ] T020 CertificateValidator class in src/lib/certificate-validation/validator.ts with LoTW-compatible verification
- [ ] T021 RateLimiter class in src/lib/rate-limiter/limiter.ts with multi-tier protection
- [ ] T022 RelayManager class in src/lib/relay-manager/manager.ts for licensed station routing
- [ ] T023 MonitorReceiver class in src/lib/monitor-receiver/receiver.ts for radio monitoring

### API Implementation
- [ ] T024 Mode detection and switching endpoints in src/lib/user-mode/api.ts
- [ ] T025 Certificate validation and registration in src/lib/certificate-validation/api.ts
- [ ] T026 Message relay coordination in src/lib/relay-manager/api.ts
- [ ] T027 Monitoring configuration in src/lib/monitor-receiver/api.ts
- [ ] T028 Compliance logging and reports in src/lib/user-mode/compliance-api.ts

## Phase 3.4: Integration with Existing Systems
- [ ] T029 Integrate UserModeManager with existing radio-control library for transmission blocking
- [ ] T030 Connect MonitorReceiver to existing qpsk-modem for decode-only operation
- [ ] T031 Link RelayManager with mesh-networking library for routing tables
- [ ] T032 Update webrtc-transport library to respect unlicensed mode restrictions
- [ ] T033 Modify transmission-mode library to check user licensing status

## Phase 3.5: UI Components
- [ ] T034 [P] UnlicensedModeIndicator component in src/components/UnlicensedModeIndicator.tsx
- [ ] T035 [P] CertificateUpload component in src/components/CertificateUpload.tsx
- [ ] T036 [P] RateLimitWarning component in src/components/RateLimitWarning.tsx
- [ ] T037 Update Dashboard.tsx to show current mode and capabilities
- [ ] T038 Add mode toggle to ContentCreator.tsx with appropriate warnings

## Phase 3.6: Polish
- [ ] T039 [P] Unit tests for certificate format validation in src/test/unit/certificate-format.test.ts
- [ ] T040 [P] Unit tests for rate limit calculations in src/test/unit/rate-limit-calc.test.ts
- [ ] T041 Performance tests for mode detection (<500ms) in src/test/performance/mode-detection.perf.test.ts
- [ ] T042 Update CLAUDE.md with unlicensed mode libraries and recent changes
- [ ] T043 Run quickstart.md validation scenarios end-to-end

## Dependencies
- Setup (T001-T003) must complete first
- All tests (T004-T013) before any implementation (T014-T028)
- Models (T014-T018) before library implementations (T019-T023)
- Core libraries (T019-T023) before API endpoints (T024-T028)
- API implementation before integration (T029-T033)
- Integration before UI (T034-T038)
- Everything before polish (T039-T043)

## Parallel Execution Examples

### Launch all contract tests together (T004-T008):
```typescript
Task: "Write contract test for mode detection API in src/test/contract/mode-detection.contract.test.ts"
Task: "Write contract test for certificate validation API in src/test/contract/certificate-validation.contract.test.ts"
Task: "Write contract test for message relay API in src/test/contract/message-relay.contract.test.ts"
Task: "Write contract test for monitoring configuration API in src/test/contract/monitoring-configuration.contract.test.ts"
Task: "Write contract test for compliance logging API in src/test/contract/compliance-logging.contract.test.ts"
```

### Launch all integration tests together (T009-T013):
```typescript
Task: "Write integration test for unlicensed user initialization in src/test/integration/unlicensed-mode-init.integration.test.ts"
Task: "Write integration test for certificate registration in src/test/integration/certificate-upgrade.integration.test.ts"
Task: "Write integration test for monitor-only mode in src/test/integration/monitor-only-mode.integration.test.ts"
Task: "Write integration test for relay routing in src/test/integration/relay-routing.integration.test.ts"
Task: "Write integration test for rate limiting in src/test/integration/rate-limiting.integration.test.ts"
```

### Launch all model creation together (T014-T018):
```typescript
Task: "Create UserMode interface in src/lib/user-mode/models.ts"
Task: "Create Certificate interface in src/lib/certificate-validation/models.ts"
Task: "Create RateLimitState interface in src/lib/rate-limiter/models.ts"
Task: "Create RelayPath interfaces in src/lib/relay-manager/models.ts"
Task: "Create ComplianceLog interface in src/lib/user-mode/compliance.ts"
```

## Notes
- **TDD Enforcement**: Tests T004-T013 MUST fail before implementing T014-T028
- **Browser APIs Only**: No Node.js dependencies, use Web Crypto API, IndexedDB
- **FCC Compliance**: Ensure unlicensed users cannot transmit on RF frequencies
- **Certificate Security**: Implement proper X.509 validation with chain verification
- **Rate Limiting**: Multi-tier approach with graceful degradation
- **Commit Strategy**: Commit after each task with descriptive messages
- **Existing Integration**: Respect existing library patterns and interfaces

## Validation Checklist
- [x] All 5 contracts have test tasks (T004-T008)
- [x] All 5 entities have model tasks (T014-T018)
- [x] All 5 API endpoints have implementation tasks (T024-T028)
- [x] Integration with existing libraries covered (T029-T033)
- [x] UI components for user interaction included (T034-T038)
- [x] Performance and unit tests included (T039-T041)
- [x] Documentation updates planned (T042)
- [x] End-to-end validation included (T043)

---
*Total Tasks: 43 | Parallel Groups: 8 | Sequential Dependencies: Yes*
*Estimated Time: 3-4 days with parallel execution*