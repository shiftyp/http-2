# Tasks: Certificate Management

**Input**: Design documents from `/specs/020-certificate-management/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.x, React, IndexedDB, Web Crypto API
   → Libraries: certificate-management, enhanced crypto lib
   → Structure: Single PWA project with signaling server enhancement
2. Load optional design documents:
   → data-model.md: 7 entities extracted (Certificate, CertificateRequest, etc.)
   → contracts/: 4 API contracts found
   → research.md: Technical decisions loaded
3. Generate tasks by category:
   → Setup: library structure, dependencies, type definitions
   → Tests: 16 contract tests, 8 integration tests
   → Core: 7 models, 5 services, CLI commands
   → Integration: IndexedDB, WebSocket, server DB
   → Polish: unit tests, compression, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T057)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Library**: `src/lib/certificate-management/`
- **Components**: `src/components/`
- **Tests**: `src/test/`
- **Server**: `signaling-server/src/`

## Phase 3.1: Setup
- [ ] T001 Create certificate-management library structure in src/lib/certificate-management/
- [ ] T002 Install certificate dependencies: idb@8.0.0, node-forge@1.3.1 for PKCS#12 parsing
- [ ] T003 [P] Create TypeScript interfaces from data model in src/lib/certificate-management/types.ts
- [ ] T004 [P] Set up IndexedDB schema for certificate stores in src/lib/certificate-management/db-schema.ts
- [ ] T005 [P] Create certificate CLI command structure in src/lib/certificate-management/cli.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests - Certificate API
- [ ] T006 [P] Contract test POST /api/certificates/generate in src/test/contract/certificate-generate.test.ts
- [ ] T007 [P] Contract test POST /api/certificates/upload in src/test/contract/certificate-upload.test.ts
- [ ] T008 [P] Contract test GET /api/certificates in src/test/contract/certificate-list.test.ts
- [ ] T009 [P] Contract test DELETE /api/certificates/{id} in src/test/contract/certificate-delete.test.ts

### Contract Tests - Server Certificate API
- [ ] T010 [P] Contract test POST /api/server/certificate-requests in src/test/contract/server-request.test.ts
- [ ] T011 [P] Contract test GET /api/server/pending-requests in src/test/contract/server-pending.test.ts
- [ ] T012 [P] Contract test POST /api/server/approve-request in src/test/contract/server-approve.test.ts
- [ ] T013 [P] Contract test POST /api/server/reject-request in src/test/contract/server-reject.test.ts

### Contract Tests - CAPTCHA API
- [ ] T014 [P] Contract test POST /api/captcha/generate in src/test/contract/captcha-generate.test.ts
- [ ] T015 [P] Contract test POST /api/captcha/verify in src/test/contract/captcha-verify.test.ts
- [ ] T016 [P] Contract test POST /api/captcha/sign-solution in src/test/contract/captcha-sign.test.ts

### Contract Tests - Trust Chain API
- [ ] T017 [P] Contract test POST /api/trust/validate-chain in src/test/contract/trust-validate.test.ts
- [ ] T018 [P] Contract test GET /api/trust/chain/{certificateId} in src/test/contract/trust-chain.test.ts
- [ ] T019 [P] Contract test POST /api/trust/federate in src/test/contract/trust-federate.test.ts
- [ ] T020 [P] Contract test POST /api/trust/consensus in src/test/contract/trust-consensus.test.ts
- [ ] T021 [P] Contract test POST /api/bans/broadcast in src/test/contract/ban-broadcast.test.ts

### Integration Tests
- [ ] T022 [P] Integration test: Generate self-signed certificate flow in src/test/integration/cert-generate.integration.test.ts
- [ ] T023 [P] Integration test: Upload LoTW certificate flow in src/test/integration/cert-upload-lotw.integration.test.ts
- [ ] T024 [P] Integration test: Request server approval flow in src/test/integration/cert-approval.integration.test.ts
- [ ] T025 [P] Integration test: CAPTCHA challenge/response flow in src/test/integration/captcha-flow.integration.test.ts
- [ ] T026 [P] Integration test: Trust chain validation in src/test/integration/trust-chain.integration.test.ts
- [ ] T027 [P] Integration test: Certificate switching/session handling in src/test/integration/cert-switch.integration.test.ts
- [ ] T028 [P] Integration test: Ban broadcast and processing in src/test/integration/ban-broadcast.integration.test.ts
- [ ] T029 [P] Integration test: Offline certificate verification in src/test/integration/cert-offline.integration.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T030 [P] Certificate model with X.509 parsing in src/lib/certificate-management/models/Certificate.ts
- [ ] T031 [P] CertificateRequest model in src/lib/certificate-management/models/CertificateRequest.ts
- [ ] T032 [P] CAPTCHAChallenge model in src/lib/certificate-management/models/CAPTCHAChallenge.ts
- [ ] T033 [P] SignedCAPTCHASolution model in src/lib/certificate-management/models/SignedCAPTCHASolution.ts
- [ ] T034 [P] ApprovalRecord model in src/lib/certificate-management/models/ApprovalRecord.ts
- [ ] T035 [P] BanRecord model in src/lib/certificate-management/models/BanRecord.ts
- [ ] T036 [P] TrustChain model in src/lib/certificate-management/models/TrustChain.ts

### Core Services
- [ ] T037 CertificateService with Web Crypto API in src/lib/certificate-management/services/CertificateService.ts
- [ ] T038 PKCS12Parser for LoTW certificates in src/lib/certificate-management/services/PKCS12Parser.ts
- [ ] T039 CAPTCHAGenerator with radio-optimized challenges in src/lib/certificate-management/services/CAPTCHAGenerator.ts
- [ ] T040 TrustChainValidator with depth limits in src/lib/certificate-management/services/TrustChainValidator.ts
- [ ] T041 CertificateStore IndexedDB wrapper in src/lib/certificate-management/services/CertificateStore.ts

### React Components
- [ ] T042 CertificateManager main component in src/components/CertificateManager/CertificateManager.tsx
- [ ] T043 CertificateUploader with P12 support in src/components/CertificateManager/CertificateUploader.tsx
- [ ] T044 CertificateGenerator for self-signed in src/components/CertificateManager/CertificateGenerator.tsx
- [ ] T045 CertificateSelector for multi-cert support in src/components/CertificateManager/CertificateSelector.tsx
- [ ] T046 ServerApprovalQueue component in src/components/ServerOperator/ApprovalQueue.tsx
- [ ] T047 CAPTCHASolver component in src/components/CertificateManager/CAPTCHASolver.tsx

## Phase 3.4: Integration

### Server Integration
- [ ] T048 WebSocket handlers for certificate requests in signaling-server/src/handlers/certificate-handler.js
- [ ] T049 SQLite schema for server approvals in signaling-server/src/database/certificate-schema.sql
- [ ] T050 Server CAPTCHA pool manager in signaling-server/src/services/captcha-pool.js
- [ ] T051 Ban broadcast protocol in signaling-server/src/services/ban-broadcaster.js

### Client Integration
- [ ] T052 Certificate auto-send on connection in src/lib/certificate-management/integration/auto-request.ts
- [ ] T053 Trust chain federation client in src/lib/certificate-management/integration/trust-federation.ts
- [ ] T054 Certificate export/import with compression in src/lib/certificate-management/integration/cert-export.ts

## Phase 3.5: Polish
- [ ] T055 [P] Unit tests for CAPTCHA generation in src/test/unit/captcha-generator.test.ts
- [ ] T056 [P] Unit tests for trust chain validation in src/test/unit/trust-chain.test.ts
- [ ] T057 [P] Update CLAUDE.md with certificate management instructions
- [ ] T058 Performance test: Certificate verification <200ms in src/test/performance/cert-verify.perf.test.ts
- [ ] T059 Compression test: CAPTCHA challenges <100 bytes in src/test/performance/captcha-compress.test.ts
- [ ] T060 Run quickstart.md validation scenarios

## Dependencies
- Setup (T001-T005) blocks everything
- Tests (T006-T029) must complete before implementation (T030-T047)
- Models (T030-T036) before services (T037-T041)
- Services before components (T042-T047)
- Core implementation before integration (T048-T054)
- Everything before polish (T055-T060)

## Parallel Example
```bash
# Phase 3.2: Launch all contract tests together (T006-T021):
Task: "Contract test POST /api/certificates/generate in src/test/contract/certificate-generate.test.ts"
Task: "Contract test POST /api/certificates/upload in src/test/contract/certificate-upload.test.ts"
Task: "Contract test GET /api/certificates in src/test/contract/certificate-list.test.ts"
Task: "Contract test DELETE /api/certificates/{id} in src/test/contract/certificate-delete.test.ts"
Task: "Contract test POST /api/server/certificate-requests in src/test/contract/server-request.test.ts"
# ... (continue with remaining contract tests)

# Phase 3.3: Launch all models together (T030-T036):
Task: "Certificate model with X.509 parsing in src/lib/certificate-management/models/Certificate.ts"
Task: "CertificateRequest model in src/lib/certificate-management/models/CertificateRequest.ts"
Task: "CAPTCHAChallenge model in src/lib/certificate-management/models/CAPTCHAChallenge.ts"
# ... (continue with remaining models)
```

## Notes
- Web Crypto API for all certificate operations (no external crypto libraries except PKCS#12 parsing)
- IndexedDB for client storage, SQLite for server approval records
- CAPTCHA challenges must compress to <100 bytes for radio transmission
- Trust chains limited to depth 5 to prevent attacks
- Rate limiting: 3 CAPTCHA attempts per hour per callsign
- Bootstrap: First certificate transferred from installing client
- All certificate operations must work offline using cached database

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (4 APIs → 16 contract tests)
- [x] All entities have model tasks (7 entities → 7 models)
- [x] All tests come before implementation (T006-T029 before T030-T054)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] User story scenarios covered (8 integration tests)
- [x] Performance requirements included (verification <200ms)