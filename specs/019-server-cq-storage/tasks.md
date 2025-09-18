# Tasks: Server CQ Storage

**Input**: Design documents from `/specs/019-server-cq-storage/`
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
- **Server**: `signaling-server/src/`, `signaling-server/tests/`
- **Client Library**: `src/lib/content-registry/`, `tests/`
- Dual project structure per plan.md

## Phase 3.1: Setup
- [ ] T001 Create signaling-server directory structure with src/models, src/services, src/api
- [ ] T002 Initialize Node.js project in signaling-server with ws, sqlite3, msgpack dependencies
- [ ] T003 [P] Configure ESLint and Prettier for signaling-server
- [ ] T004 [P] Create src/lib/content-registry directory for client library
- [ ] T005 [P] Create src/lib/priority-tiers directory for classification library
- [ ] T006 Setup SQLite database initialization script at signaling-server/src/db/init.js

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests [P] - Can all run in parallel
- [ ] T007 [P] Create contract test for POST /api/content/announce at signaling-server/tests/contract/announce-endpoint.test.js
- [ ] T008 [P] Create contract test for GET /api/content/search at signaling-server/tests/contract/search-endpoint.test.js
- [ ] T009 [P] Create contract test for POST /api/content/batch at signaling-server/tests/contract/batch-endpoint.test.js
- [ ] T010 [P] Create contract test for GET /api/content/{hash} at signaling-server/tests/contract/get-content.test.js
- [ ] T011 [P] Create contract test for DELETE /api/content/{hash} at signaling-server/tests/contract/delete-content.test.js
- [ ] T012 [P] Create contract test for GET /api/station/{callsign}/trust at signaling-server/tests/contract/station-trust.test.js

### Integration Tests [P] - Test scenarios from quickstart
- [ ] T013 [P] Create integration test for beacon path consolidation at signaling-server/tests/integration/path-consolidation.test.js
- [ ] T014 [P] Create integration test for priority TTL expiration at signaling-server/tests/integration/ttl-expiration.test.js
- [ ] T015 [P] Create integration test for storage limit eviction at signaling-server/tests/integration/storage-eviction.test.js
- [ ] T016 [P] Create integration test for metadata conflict resolution at signaling-server/tests/integration/conflict-resolution.test.js
- [ ] T017 [P] Create integration test for WebSocket message batching at signaling-server/tests/integration/ws-batching.test.js
- [ ] T018 [P] Create client integration test for IndexedDB sync at tests/integration/client-sync.test.ts

## Phase 3.3: Core Implementation

### Data Models [P] - Different files
- [ ] T019 [P] Implement ConsolidatedBeacon model at signaling-server/src/models/ConsolidatedBeacon.js
- [ ] T020 [P] Implement PathRecord model at signaling-server/src/models/PathRecord.js
- [ ] T021 [P] Implement StationTrust model at signaling-server/src/models/StationTrust.js
- [ ] T022 [P] Implement PriorityTier enum at signaling-server/src/models/PriorityTier.js
- [ ] T023 [P] Create shared TypeScript types at src/lib/content-registry/types.ts

### Services - Sequential (same files referenced)
- [ ] T024 Implement ContentRegistry service at signaling-server/src/services/ContentRegistry.js
- [ ] T025 Implement PriorityManager service at signaling-server/src/services/PriorityManager.js
- [ ] T026 Implement path consolidation algorithm in ContentRegistry.consolidatePaths()
- [ ] T027 Implement TTL expiration logic in ContentRegistry.expireContent()
- [ ] T028 Implement storage eviction in ContentRegistry.evictLowPriority()
- [ ] T029 Implement conflict resolution in ContentRegistry.resolveConflicts()
- [ ] T030 Implement station trust scoring in StationTrust.calculateScore()

### API Endpoints - Sequential (same router file)
- [ ] T031 Implement POST /api/content/announce at signaling-server/src/api/content-endpoints.js
- [ ] T032 Implement GET /api/content/search in same file
- [ ] T033 Implement POST /api/content/batch in same file
- [ ] T034 Implement GET /api/content/{hash} in same file
- [ ] T035 Implement DELETE /api/content/{hash} in same file
- [ ] T036 Implement GET /api/station/{callsign}/trust in same file

### Client Library [P] - Different module
- [ ] T037 [P] Implement ContentRegistry class at src/lib/content-registry/ContentRegistry.ts
- [ ] T038 [P] Implement IndexedDB operations at src/lib/content-registry/storage.ts
- [ ] T039 [P] Implement WebSocket sync at src/lib/content-registry/sync.ts
- [ ] T040 [P] Implement PriorityClassifier at src/lib/priority-tiers/PriorityClassifier.ts

## Phase 3.4: Integration & Features

### Database & Middleware
- [ ] T041 Create SQLite schema migrations at signaling-server/src/db/migrations/
- [ ] T042 Implement ECDSA authentication middleware at signaling-server/src/middleware/auth.js
- [ ] T043 Implement rate limiting middleware at signaling-server/src/middleware/rateLimit.js
- [ ] T044 Add structured logging with context at signaling-server/src/utils/logger.js

### WebSocket Integration
- [ ] T045 Integrate content registry with existing WebSocket server at signaling-server/server.js
- [ ] T046 Implement message batching for content updates
- [ ] T047 Add content discovery to peer-list messages
- [ ] T048 Implement delta updates for path changes

### CLI Tools
- [ ] T049 Create content-registry CLI at src/lib/content-registry/cli.js with --list, --expire, --stats
- [ ] T050 Add --import and --export commands for disaster recovery

## Phase 3.5: Polish & Documentation

### Unit Tests [P] - Different test files
- [ ] T051 [P] Unit tests for consolidatePaths algorithm at signaling-server/tests/unit/consolidate.test.js
- [ ] T052 [P] Unit tests for priority classification at signaling-server/tests/unit/priority.test.js
- [ ] T053 [P] Unit tests for path quality scoring at signaling-server/tests/unit/pathScore.test.js
- [ ] T054 [P] Unit tests for conflict resolution at signaling-server/tests/unit/conflicts.test.js

### Performance & Optimization
- [ ] T055 Add LRU cache for frequent content queries
- [ ] T056 Implement SQLite VACUUM scheduling
- [ ] T057 Profile and optimize IndexedDB operations
- [ ] T058 Add performance metrics collection

### Documentation
- [ ] T059 [P] Create API documentation from OpenAPI spec
- [ ] T060 [P] Write llms.txt for content-registry library
- [ ] T061 [P] Update main CLAUDE.md with implementation details
- [ ] T062 Create disaster recovery runbook

## Parallel Execution Examples

### Maximum Parallel - Phase 3.2 (All contract and integration tests)
```bash
# Run all contract tests in parallel
Task "T007: Create announce endpoint contract test" &
Task "T008: Create search endpoint contract test" &
Task "T009: Create batch endpoint contract test" &
Task "T010: Create get content contract test" &
Task "T011: Create delete content contract test" &
Task "T012: Create station trust contract test" &

# Run all integration tests in parallel
Task "T013: Create path consolidation test" &
Task "T014: Create TTL expiration test" &
Task "T015: Create storage eviction test" &
Task "T016: Create conflict resolution test" &
Task "T017: Create WebSocket batching test" &
Task "T018: Create client sync test" &
wait
```

### Model Creation - Phase 3.3
```bash
# All models can be created in parallel
Task "T019: Implement ConsolidatedBeacon model" &
Task "T020: Implement PathRecord model" &
Task "T021: Implement StationTrust model" &
Task "T022: Implement PriorityTier enum" &
Task "T023: Create shared TypeScript types" &
wait
```

### Client Library - Phase 3.3
```bash
# Client library components in parallel
Task "T037: Implement ContentRegistry class" &
Task "T038: Implement IndexedDB operations" &
Task "T039: Implement WebSocket sync" &
Task "T040: Implement PriorityClassifier" &
wait
```

## Dependencies Graph
```
Setup (T001-T006)
    ↓
Contract Tests (T007-T012) [P]  +  Integration Tests (T013-T018) [P]
    ↓
Models (T019-T023) [P]
    ↓
Services (T024-T030)
    ↓
API Endpoints (T031-T036)  +  Client Library (T037-T040) [P]
    ↓
Integration (T041-T050)
    ↓
Polish (T051-T062) [P]
```

## Validation Checklist
- ✅ All 6 API endpoints have contract tests (T007-T012)
- ✅ All 6 entities have model implementations (T019-T023)
- ✅ All endpoints have implementations (T031-T036)
- ✅ Integration tests cover all quickstart scenarios (T013-T018)
- ✅ Both server and client implementations included
- ✅ TDD order enforced (tests before implementation)

## Task Count: 62 tasks total
- Setup: 6 tasks
- Tests: 12 contract + 6 integration = 18 tasks
- Core: 18 tasks
- Integration: 8 tasks
- Polish: 12 tasks

---
*Ready for execution via Task agents or manual implementation*