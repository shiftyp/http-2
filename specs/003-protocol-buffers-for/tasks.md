# Implementation Tasks: Protocol Buffers for Dynamic Data Transmission

**Feature Branch**: `003-protocol-buffers-for`
**Target**: Frontend-only implementation in src/lib/protocol-buffers/

## Task Organization
- Tasks marked with [P] can be executed in parallel
- Tasks without [P] must be done sequentially
- Follow TDD: Write tests first, watch them fail, then implement

## Phase 1: Setup & Dependencies

### T001: Install protobufjs dependency
**File**: `/workspaces/http-2/package.json`
```bash
npm install protobufjs
```
- Add protobufjs to dependencies
- Verify browser compatibility
- Update package-lock.json

### T002: Create library directory structure
**Files**: Multiple new directories
```bash
mkdir -p src/lib/protocol-buffers
mkdir -p tests/unit/protocol-buffers
mkdir -p tests/integration/protocol-buffers
mkdir -p tests/contract/protocol-buffers
```
- Create folder structure
- Add index.ts entry point
- Add README.md with library overview

## Phase 2: Contract Tests (TDD - Red Phase) [P]

### T003: Write contract test for schema generation [P]
**File**: `/workspaces/http-2/tests/contract/protocol-buffers/schema-generation.test.ts`
- Test POST /internal/schema/generate endpoint behavior
- Test various data structures (objects, arrays, nested)
- Test error cases (circular references, invalid data)
- Tests MUST fail initially

### T004: Write contract test for data encoding [P]
**File**: `/workspaces/http-2/tests/contract/protocol-buffers/data-encoding.test.ts`
- Test POST /internal/encode endpoint behavior
- Test encoding with different compression types
- Test schema not found errors
- Tests MUST fail initially

### T005: Write contract test for schema exchange [P]
**File**: `/workspaces/http-2/tests/contract/protocol-buffers/schema-exchange.test.ts`
- Test POST /radio/schema/request endpoint
- Test POST /radio/schema/provide endpoint
- Test POST /radio/transmission/send endpoint
- Tests MUST fail initially

### T006: Write contract test for cache management [P]
**File**: `/workspaces/http-2/tests/contract/protocol-buffers/cache-management.test.ts`
- Test cache get/set/has/clear operations
- Test cache statistics endpoint
- Test eviction policies (LRU, LFU, FIFO)
- Tests MUST fail initially

## Phase 3: Integration Tests (TDD - Red Phase) [P]

### T007: Write integration test for first transmission scenario [P]
**File**: `/workspaces/http-2/tests/integration/protocol-buffers/first-transmission.test.ts`
- Test new schema generation and transmission
- Verify schema sent before data
- Check size reduction metrics
- Test MUST fail initially

### T008: Write integration test for cached schema scenario [P]
**File**: `/workspaces/http-2/tests/integration/protocol-buffers/cached-schema.test.ts`
- Test schema reuse from cache
- Verify no schema retransmission
- Check cache hit statistics
- Test MUST fail initially

### T009: Write integration test for schema request scenario [P]
**File**: `/workspaces/http-2/tests/integration/protocol-buffers/schema-request.test.ts`
- Test missing schema request flow
- Verify automatic schema retrieval
- Test retry logic on failure
- Test MUST fail initially

### T010: Write integration test for session eviction [P]
**File**: `/workspaces/http-2/tests/integration/protocol-buffers/session-eviction.test.ts`
- Test session-based cache clearing
- Verify schemas removed on session end
- Test cache size limits
- Test MUST fail initially

## Phase 4: Core Models Implementation [P]

### T011: Implement SchemaDefinition model [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/models/schema-definition.ts`
- Create SchemaDefinition interface and class
- Implement validation rules
- Add SHA-256 ID generation
- Add proto content validation

### T012: Implement BinaryTransmission model [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/models/binary-transmission.ts`
- Create BinaryTransmission interface and class
- Implement compression type enum
- Add size tracking properties
- Add validation for encoded data

### T013: Implement SchemaCache model [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/models/schema-cache.ts`
- Create SchemaCache class with Map storage
- Implement eviction policies (LRU, LFU, FIFO)
- Add hit count tracking
- Add size management

### T014: Implement TransmissionPacket model [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/models/transmission-packet.ts`
- Create TransmissionPacket interface
- Add packet type enumeration
- Implement checksum calculation
- Add packet sequencing

### T015: Implement SchemaRequest model [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/models/schema-request.ts`
- Create SchemaRequest interface
- Add retry management
- Add priority levels
- Add state transitions

## Phase 5: Core Services Implementation

### T016: Implement schema generator service
**File**: `/workspaces/http-2/src/lib/protocol-buffers/services/schema-generator.ts`
- Analyze JavaScript objects recursively
- Map JS types to protobuf types
- Generate proto2 syntax strings
- Compile with protobufjs

### T017: Implement encoder service
**File**: `/workspaces/http-2/src/lib/protocol-buffers/services/encoder.ts`
- Load schema from cache
- Encode data using protobufjs
- Apply compression (Brotli/gzip)
- Track size metrics

### T018: Implement decoder service
**File**: `/workspaces/http-2/src/lib/protocol-buffers/services/decoder.ts`
- Decompress data if needed
- Load schema from cache
- Decode using protobufjs
- Handle decode errors

### T019: Implement cache manager service
**File**: `/workspaces/http-2/src/lib/protocol-buffers/services/cache-manager.ts`
- Manage in-memory Map storage
- Implement IndexedDB persistence
- Handle session lifecycle
- Implement eviction strategies

### T020: Implement schema exchange service
**File**: `/workspaces/http-2/src/lib/protocol-buffers/services/schema-exchange.ts`
- Handle schema requests over radio
- Implement retry logic
- Manage request queues
- Track request states

## Phase 6: Ham-Server Integration

### T021: Create transmission interceptor
**File**: `/workspaces/http-2/src/lib/protocol-buffers/interceptors/transmission-interceptor.ts`
- Hook into ham-server pipeline
- Detect dynamic data
- Trigger protobuf encoding
- Add schema transmission logic

### T022: Implement ham-server adapter
**File**: `/workspaces/http-2/src/lib/protocol-buffers/adapters/ham-server-adapter.ts`
- Integrate with existing transmission flow
- Handle schema-first transmission
- Manage packet sequencing
- Add error recovery

## Phase 7: CLI Implementation

### T023: Create CLI tool
**File**: `/workspaces/http-2/src/lib/protocol-buffers/cli.ts`
- Implement --encode command
- Implement --decode command
- Implement --schema command
- Add --help and --version

### T024: Add CLI tests
**File**: `/workspaces/http-2/tests/unit/protocol-buffers/cli.test.ts`
- Test all CLI commands
- Test error handling
- Test file I/O operations
- Verify output formats

## Phase 8: Performance & Polish [P]

### T025: Add performance benchmarks [P]
**File**: `/workspaces/http-2/tests/integration/protocol-buffers/performance.test.ts`
- Benchmark schema generation (<50ms)
- Benchmark encoding/decoding (<10ms)
- Compare with JSON baseline
- Measure compression ratios

### T026: Create library documentation [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/llms.txt`
- Document API interfaces
- Add usage examples
- Include performance notes
- Add troubleshooting guide

### T027: Add logging and observability [P]
**File**: `/workspaces/http-2/src/lib/protocol-buffers/utils/logger.ts`
- Add structured logging
- Track cache metrics
- Log schema generation times
- Add debug mode

### T028: Create React component for settings [P]
**File**: `/workspaces/http-2/src/components/Radio/ProtobufSettings.tsx`
- Cache size configuration
- Eviction policy selector
- Compression options
- Debug mode toggle

## Phase 9: Final Integration & Testing

### T029: Run all tests and fix failures
**Command**: `npm test -- protocol-buffers`
- Ensure all contract tests pass
- Verify integration tests pass
- Check unit test coverage >80%
- Fix any failing tests

### T030: Execute quickstart validation
**File**: `/workspaces/http-2/specs/003-protocol-buffers-for/quickstart.md`
- Run through all test scenarios
- Verify bandwidth reduction >60%
- Test schema exchange flow
- Validate session eviction

## Execution Examples

### Parallel Execution Group 1 (Contract Tests)
```bash
# Run T003-T006 in parallel
npm test -- tests/contract/protocol-buffers/schema-generation.test.ts &
npm test -- tests/contract/protocol-buffers/data-encoding.test.ts &
npm test -- tests/contract/protocol-buffers/schema-exchange.test.ts &
npm test -- tests/contract/protocol-buffers/cache-management.test.ts &
wait
```

### Parallel Execution Group 2 (Models)
```bash
# Can implement T011-T015 simultaneously (different files)
# Each developer/agent can work on one model
```

### Sequential Execution (Services)
```bash
# T016-T020 should be done in order as they depend on each other
# T021-T022 depend on services being complete
```

## Success Criteria
- [ ] All 30 tasks completed
- [ ] All tests passing (contract, integration, unit)
- [ ] Performance targets met (<50ms generation, >60% compression)
- [ ] Integration with ham-server verified
- [ ] Quickstart scenarios validated
- [ ] Documentation complete

## Notes
- Follow TDD strictly: RED → GREEN → REFACTOR
- Commit after each test (RED) and implementation (GREEN)
- Use protobufjs minimal build for browser
- Session-based caching only (no persistent storage)
- All operations are frontend-only

---
**Generated**: 2025-09-13
**Total Tasks**: 30
**Estimated Effort**: 3-4 days with parallel execution