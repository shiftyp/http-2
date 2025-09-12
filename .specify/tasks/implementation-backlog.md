# HTTP-over-Radio Implementation Backlog

## Status: Active | Priority: Critical | Owner: Development Team

## Core Library Implementation Tasks

### Compression System (HIGH PRIORITY)
**ID**: COMP-001-004  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: None  

#### Tasks:
- [ ] **COMP-001**: Implement HamRadioCompressor class methods (compressHTML, decompressHTML, dictionary optimization)
- [ ] **COMP-002**: Implement RadioJSXCompiler class and export it  
- [ ] **COMP-003**: Create h() JSX helper function
- [ ] **COMP-004**: Complete Brotli compression integration

**Acceptance Criteria**: All compression tests pass, >80% compression ratio achieved

### HTTP Protocol Layer (HIGH PRIORITY)
**ID**: HTTP-001-002  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: COMP-001-004  

#### Tasks:
- [ ] **HTTP-001**: Add HTTPProtocol methods: setRadio(), setMeshNetwork(), onRequest(), handlePacket()
- [ ] **HTTP-002**: Fix HTTPProtocol sendRequest() method signature and response handling

**Acceptance Criteria**: Protocol integration tests pass, request/response cycle functional

### Radio Control Interface (MEDIUM PRIORITY)
**ID**: RADIO-001-003  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: None  

#### Tasks:
- [ ] **RADIO-001**: Add RadioControl getter methods: getFrequency(), getMode(), getPower(), getSWR()
- [ ] **RADIO-002**: Implement RadioControl transmit() method properly
- [ ] **RADIO-003**: Add SerialPortInfo type and complete serial port handling

**Acceptance Criteria**: Radio control tests pass, Web Serial API integration working

### Cryptographic Security (HIGH PRIORITY)
**ID**: CRYPTO-001-002  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: None  

#### Tasks:
- [ ] **CRYPTO-001**: Fix CryptoManager key pair generation and PEM conversion
- [ ] **CRYPTO-002**: Implement CryptoManager trust management with localStorage

**Acceptance Criteria**: All crypto tests pass, ECDSA signatures functional, FCC ID compliance

### Mesh Networking (LOW PRIORITY)
**ID**: MESH-001-002  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: HTTP-001-002  

#### Tasks:
- [ ] **MESH-001**: Fix MeshNetwork sendPacket() method signature
- [ ] **MESH-002**: Implement mesh route discovery and packet forwarding

**Acceptance Criteria**: AODV routing functional, multi-hop packet delivery working

### Database Layer (MEDIUM PRIORITY)
**ID**: DB-001-003  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: None  

#### Tasks:
- [ ] **DB-001**: Fix Database IndexedDB initialization
- [ ] **DB-002**: Add Database methods: cacheContent(), getCachedContent()
- [ ] **DB-003**: Complete Database page management methods

**Acceptance Criteria**: Offline storage working, content caching functional

## UI/Infrastructure Tasks

### Component Cleanup (LOW PRIORITY)
**ID**: UI-001-002  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: None  

#### Tasks:
- [ ] **UI-001**: Remove unused imports from UI components
- [ ] **UI-002**: Fix ThemeSelector type mismatches

**Acceptance Criteria**: TypeScript compilation clean, no linting errors

### Test Infrastructure (MEDIUM PRIORITY)
**ID**: TEST-001-003  
**Status**: Not Started  
**Assignee**: TBD  
**Dependencies**: None  

#### Tasks:
- [ ] **TEST-001**: Add AudioContext mock to test setup
- [ ] **TEST-002**: Improve IndexedDB mock implementation  
- [ ] **TEST-003**: Complete Web Serial API type definitions

**Acceptance Criteria**: All tests run successfully, proper mocking in place

## Implementation Order

### Phase 1: Core Libraries (Week 1-2)
1. CRYPTO-001-002 (Security foundation)
2. COMP-001-004 (Compression engine)
3. DB-001-003 (Data persistence)

### Phase 2: Protocol Integration (Week 3)
4. HTTP-001-002 (Protocol layer)
5. RADIO-001-003 (Hardware interface)

### Phase 3: Testing & Polish (Week 4)
6. TEST-001-003 (Test infrastructure)
7. UI-001-002 (Code cleanup)
8. MESH-001-002 (Future features)

## Package Management Status

### ✅ Dependencies Resolved
- **Lock File**: `package-lock.json` (lockfileVersion: 3, 358KB, 9,986 lines)
- **Total Packages**: 717 audited
- **Production Dependencies**: 24 (React 18, Vite 5, Monaco Editor, Workbox PWA, Brotli-wasm)
- **Development Dependencies**: 24 (Vitest, Playwright, TypeScript 5.3, ESLint)
- **Node Version**: >=18.0.0 (compatible with Codespaces)

### ⚠️ Security Status
- **Vulnerabilities**: 7 moderate severity (development dependencies only)
- **Affected**: esbuild ≤0.24.2, vite 0.11.0-6.1.6 chain
- **Impact**: Development server only, no production risk
- **Resolution**: Breaking changes required (vite@7.1.5)

## Success Metrics

- [ ] All unit tests passing (>90% coverage)
- [ ] Integration tests functional
- [ ] E2E tests covering user workflows
- [ ] TypeScript compilation clean
- [ ] FCC Part 97 compliance verified
- [ ] Package vulnerabilities resolved or documented as acceptable
- [ ] Performance benchmarks met:
  - Compression ratio >80%
  - Update transmission <1 second
  - Full page transmission <10 seconds

## Risk Assessment

**High Risk**: 
- CRYPTO-001 (WebCrypto API complexity)
- COMP-004 (Brotli-wasm integration)
- RADIO-002-003 (Web Serial API browser support)

**Medium Risk**:
- HTTP-001-002 (Protocol state management)
- DB-001 (IndexedDB browser compatibility)

**Low Risk**:
- UI cleanup tasks
- Test infrastructure improvements

---
**Created**: 2025-01-12 | **Last Updated**: 2025-01-12 | **Next Review**: 2025-01-19