# Tasks: Dynamic Data

**Input**: Design documents from `/specs/026-dynamic-data/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   ✓ Tech stack: TypeScript, React, IndexedDB, WebRTC, Web Serial API
   ✓ Libraries: 6 core libraries identified
2. Load optional design documents:
   ✓ data-model.md: 6 entities extracted
   ✓ contracts/: 3 API contracts found
   ✓ research.md: Integration points identified
3. Generate tasks by category:
   ✓ Setup: Library initialization
   ✓ Tests: 15 contract tests, 10 integration tests
   ✓ Core: 6 libraries, signaling server extensions
   ✓ Integration: WebRTC, RF, caching
   ✓ Polish: Documentation, performance
4. Apply task rules:
   ✓ [P] marks for parallel execution
   ✓ TDD: Tests before implementation
5. Number tasks: T001-T060
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [ ] T001 Create library directories for update-manager, subscription-registry, retry-coordinator, cache-manager, delivery-router, beacon-monitor in src/lib/
- [ ] T002 [P] Initialize TypeScript configs for each library with ES2022 modules and browser target
- [ ] T003 [P] Set up IndexedDB schemas in src/lib/database/dynamic-data-schema.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests - Update API
- [ ] T004 [P] Write contract test for POST /api/updates - create emergency update (tests/contract/update-creation.test.ts)
- [ ] T005 [P] Write contract test for GET /api/updates - filter by priority/category (tests/contract/update-query.test.ts)
- [ ] T006 [P] Write contract test for GET /api/updates/{id}/holders - find peers (tests/contract/update-holders.test.ts)
- [ ] T007 [P] Write contract test for GET /api/updates/{id}/delta - version delta (tests/contract/update-delta.test.ts)

### Contract Tests - Subscription API
- [ ] T008 [P] Write contract test for POST /api/subscriptions - subscribe to channel (tests/contract/subscription-create.test.ts)
- [ ] T009 [P] Write contract test for GET /api/subscriptions - list active subscriptions (tests/contract/subscription-list.test.ts)
- [ ] T010 [P] Write contract test for DELETE /api/subscriptions/{id} - cancel subscription (tests/contract/subscription-cancel.test.ts)
- [ ] T011 [P] Write contract test for GET /api/subscriptions/{id}/updates - pending updates (tests/contract/subscription-updates.test.ts)

### Contract Tests - Retry Protocol
- [ ] T012 [P] Write contract test for POST /api/retry - request retry with ECDSA signature (tests/contract/retry-request.test.ts)
- [ ] T013 [P] Write contract test for GET /api/retry/{id} - check retry status (tests/contract/retry-status.test.ts)
- [ ] T014 [P] Write contract test for POST /api/retry/{id}/fulfill - mark fulfilled (tests/contract/retry-fulfill.test.ts)
- [ ] T015 [P] Write contract test for retry coordination window timing (tests/contract/retry-coordination.test.ts)

### Integration Tests
- [ ] T016 [P] Write integration test for P0 emergency update broadcast and rebroadcast (tests/integration/emergency-broadcast.test.ts)
- [ ] T017 [P] Write integration test for licensed station retry request flow (tests/integration/retry-request-flow.test.ts)
- [ ] T018 [P] Write integration test for WebRTC fallback when RF unavailable (tests/integration/webrtc-fallback.test.ts)
- [ ] T019 [P] Write integration test for cache eviction with priority rules (tests/integration/cache-eviction.test.ts)
- [ ] T020 [P] Write integration test for subscription-based routing (tests/integration/subscription-routing.test.ts)
- [ ] T021 [P] Write integration test for multi-station update distribution (tests/integration/multi-station-delivery.test.ts)
- [ ] T022 [P] Write integration test for unlicensed station WebRTC reception (tests/integration/unlicensed-reception.test.ts)
- [ ] T023 [P] Write integration test for beacon path tracking and routing (tests/integration/beacon-path-routing.test.ts)
- [ ] T024 [P] Write integration test for version conflict resolution (tests/integration/version-conflicts.test.ts)
- [ ] T025 [P] Write integration test for delta update synchronization (tests/integration/delta-sync.test.ts)

## Phase 3.3: Core Implementation

### Update Manager Library
- [ ] T026 Implement DynamicUpdate entity and validation in src/lib/update-manager/index.ts
- [ ] T027 Implement version tracking and ETags in src/lib/update-manager/versioning.ts
- [ ] T028 Implement priority-based expiration in src/lib/update-manager/priority.ts
- [ ] T029 Implement update-manager CLI with create/list/get commands in src/lib/update-manager/cli.ts

### Subscription Registry Library
- [ ] T030 Implement Subscription entity and persistence in src/lib/subscription-registry/index.ts
- [ ] T031 Implement channel management in src/lib/subscription-registry/persistence.ts
- [ ] T032 Implement subscription-registry CLI with subscribe/list/cancel commands in src/lib/subscription-registry/cli.ts

### Retry Coordinator Library
- [ ] T033 Implement RetryRequest entity and validation in src/lib/retry-coordinator/index.ts
- [ ] T034 Implement collision avoidance with 10-30s windows in src/lib/retry-coordinator/collision-avoidance.ts
- [ ] T035 Implement ECDSA authentication verification in src/lib/retry-coordinator/authentication.ts
- [ ] T036 Implement retry-coordinator CLI with request/status commands in src/lib/retry-coordinator/cli.ts

### Cache Manager Library
- [ ] T037 Implement UpdateCache entity and storage in src/lib/cache-manager/index.ts
- [ ] T038 Implement priority-based eviction (lowest priority, then LRU) in src/lib/cache-manager/eviction.ts
- [ ] T039 Implement expiration policies (P0:30d, P1:7d, P2:24h, P3-5:1h) in src/lib/cache-manager/expiration.ts
- [ ] T040 Implement cache-manager CLI with stats/evict commands in src/lib/cache-manager/cli.ts

### Delivery Router Library
- [ ] T041 Implement path selection logic (prefer WebRTC, respect RF beacon) in src/lib/delivery-router/index.ts
- [ ] T042 Implement beacon path tracking in src/lib/delivery-router/beacon-tracking.ts
- [ ] T043 Implement WebRTC/RF mode selection in src/lib/delivery-router/path-selection.ts
- [ ] T044 Implement delivery-router CLI with route/status commands in src/lib/delivery-router/cli.ts

### Beacon Monitor Library
- [ ] T045 Implement BeaconPath entity and tracking in src/lib/beacon-monitor/index.ts
- [ ] T046 Implement path analysis for routing decisions in src/lib/beacon-monitor/path-analysis.ts
- [ ] T047 Implement beacon-monitor CLI with status/paths commands in src/lib/beacon-monitor/cli.ts

## Phase 3.4: Integration

### Signaling Server Extensions
- [ ] T048 Implement subscription API endpoints in signaling-server/src/api/subscriptions.js
- [ ] T049 Implement update tracking service in signaling-server/src/services/UpdateRegistry.js
- [ ] T050 Implement retry coordination endpoints in signaling-server/src/api/retry.js
- [ ] T051 Add SQLite migrations for updates, subscriptions, retry tables in signaling-server/src/db/migrations/

### OFDM Integration
- [ ] T052 Reserve carriers 40-47 for P0/P1 updates in src/lib/parallel-chunk-manager/allocator.ts
- [ ] T053 Integrate update chunks with OFDM transmission in src/lib/ofdm-modem/update-integration.ts

### WebRTC Integration
- [ ] T054 Add update-specific negotiation to WebRTC transport in src/lib/webrtc-transport/update-negotiation.ts
- [ ] T055 Implement licensed-to-unlicensed transfer restrictions in src/lib/webrtc-transport/licensing.ts

## Phase 3.5: Polish

### UI Components
- [ ] T056 Create update monitoring dashboard in src/components/UpdateMonitor/
- [ ] T057 Create subscription manager interface in src/components/SubscriptionManager/
- [ ] T058 Create retry request UI for operators in src/components/RetryRequest/

### Documentation
- [ ] T059 [P] Generate llms.txt documentation for all 6 libraries
- [ ] T060 [P] Update CLAUDE.md with dynamic data system usage examples

## Parallel Execution Examples

### Maximum Parallelism - Setup Phase
```bash
# Run all contract tests in parallel (T004-T015)
Task agent --parallel \
  "tests/contract/update-creation.test.ts" \
  "tests/contract/update-query.test.ts" \
  "tests/contract/update-holders.test.ts" \
  "tests/contract/subscription-create.test.ts" \
  "tests/contract/retry-request.test.ts"
```

### Integration Tests Batch
```bash
# Run all integration tests in parallel (T016-T025)
Task agent --parallel \
  "tests/integration/emergency-broadcast.test.ts" \
  "tests/integration/retry-request-flow.test.ts" \
  "tests/integration/webrtc-fallback.test.ts" \
  "tests/integration/cache-eviction.test.ts"
```

### Library Implementation - Different Files
```bash
# Implement core library files in parallel (different libraries)
Task agent --parallel \
  "src/lib/update-manager/index.ts" \
  "src/lib/subscription-registry/index.ts" \
  "src/lib/retry-coordinator/index.ts" \
  "src/lib/cache-manager/index.ts"
```

## Dependencies

### Critical Path
```
T001 (setup) → T004-T015 (contract tests) → T026-T047 (libraries) → T048-T051 (server) → T056-T058 (UI)
```

### Parallel Opportunities
- All contract tests (T004-T015) can run in parallel
- All integration tests (T016-T025) can run in parallel
- Different library implementations can run in parallel
- Documentation tasks (T059-T060) can run in parallel

### Sequential Requirements
- Tests must pass before implementation (TDD)
- Library core before CLI
- Server endpoints after library implementation
- UI components after server APIs

## Success Criteria
- [ ] All 60 tasks completed
- [ ] All tests passing (25 contract + integration)
- [ ] 6 libraries with CLIs functional
- [ ] Signaling server extended with new APIs
- [ ] P0 updates broadcast within 3 seconds
- [ ] 100 concurrent updates supported
- [ ] Documentation complete