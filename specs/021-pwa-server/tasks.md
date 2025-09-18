# Tasks: PWA Server with Station Setup Download

**Input**: Design documents from `/specs/021-pwa-server/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: Node.js, Express, PKG packaging, React PWA
   → Libraries: express.static, better-sqlite3, Web Crypto API
   → Structure: Signaling server enhancement + Station setup integration
2. Load optional design documents:
   → data-model.md: 5 entities (ServerPackage, PlatformBinary, PWAAssets, DeploymentConfig, RootCertificate)
   → contracts/: 3 API specs (server-package-api, pwa-serving-api, bootstrap-api)
   → research.md: Technical decisions loaded
3. Generate tasks by category:
   → Setup: server structure, dependencies
   → Tests: 9 contract tests, 6 integration tests
   → Core: 5 models, 4 services, 3 endpoints
   → Integration: Station setup UI, binary packaging
   → Polish: unit tests, emergency docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T051)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Server**: `signaling-server/src/`
- **PWA**: `src/components/` and `src/pages/`
- **Tests**: `signaling-server/tests/` and `src/test/`

## Phase 3.1: Setup
- [ ] T001 Create server module structure in signaling-server/src/
- [ ] T002 Install server dependencies: express-fileupload@1.4.3, archiver@7.0.1
- [ ] T003 [P] Create PWA assets directory structure in signaling-server/pwa-assets/
- [ ] T004 [P] Update package.json build scripts for PWA inclusion

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests - Server Package API
- [ ] T005 [P] Contract test GET /api/packages/info in signaling-server/tests/contract/package-info.test.js
- [ ] T006 [P] Contract test GET /api/packages/download in signaling-server/tests/contract/package-download.test.js
- [ ] T007 [P] Contract test GET /api/packages/manifest in signaling-server/tests/contract/package-manifest.test.js

### Contract Tests - PWA Serving API
- [ ] T008 [P] Contract test GET / (PWA index) in signaling-server/tests/contract/pwa-index.test.js
- [ ] T009 [P] Contract test GET /static/* (assets) in signaling-server/tests/contract/pwa-static.test.js
- [ ] T010 [P] Contract test GET /manifest.json in signaling-server/tests/contract/pwa-manifest.test.js

### Contract Tests - Bootstrap API
- [ ] T011 [P] Contract test POST /api/certificates/bootstrap in signaling-server/tests/contract/cert-bootstrap.test.js
- [ ] T012 [P] Contract test GET /api/certificates/status in signaling-server/tests/contract/cert-status.test.js
- [ ] T013 [P] Contract test POST /api/certificates/initialize in signaling-server/tests/contract/cert-init.test.js

### Integration Tests
- [ ] T014 [P] Integration test: Download server package flow in src/test/integration/server-download.integration.test.ts
- [ ] T015 [P] Integration test: Deploy and verify PWA serving in signaling-server/tests/integration/pwa-deployment.test.js
- [ ] T016 [P] Integration test: Certificate bootstrap flow in signaling-server/tests/integration/cert-bootstrap.test.js
- [ ] T017 [P] Integration test: Emergency deployment scenario in src/test/integration/emergency-deploy.integration.test.ts
- [ ] T018 [P] Integration test: Multi-platform package validation in signaling-server/tests/integration/multi-platform.test.js
- [ ] T019 [P] Integration test: Offline PWA operation in src/test/integration/offline-pwa.integration.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Server Modules
- [ ] T020 PWA server module in signaling-server/src/pwa-server.js with Express static serving
- [ ] T021 Package builder module in signaling-server/src/package-builder.js for creating distributions
- [ ] T022 Certificate bootstrap module in signaling-server/src/certificate-bootstrap.js
- [ ] T023 Download server endpoints in signaling-server/src/download-server.js

### Data Models (if using SQLite for tracking)
- [ ] T024 [P] ServerPackage model in signaling-server/src/models/ServerPackage.js
- [ ] T025 [P] PlatformBinary model in signaling-server/src/models/PlatformBinary.js
- [ ] T026 [P] DeploymentConfig model in signaling-server/src/models/DeploymentConfig.js
- [ ] T027 [P] RootCertificate model in signaling-server/src/models/RootCertificate.js

### Express Route Integration
- [ ] T028 Integrate PWA serving into signaling-server/src/app.js with proper middleware ordering
- [ ] T029 Add package download routes to signaling-server/src/app.js
- [ ] T030 Add certificate bootstrap routes to signaling-server/src/app.js

### React Components
- [ ] T031 ServerDownload component in src/components/StationSetup/ServerDownload.tsx
- [ ] T032 EmergencyMessage component in src/components/StationSetup/EmergencyMessage.tsx
- [ ] T033 CertificateBootstrap component in src/components/StationSetup/CertificateBootstrap.tsx
- [ ] T034 Update StationSetup wizard in src/pages/StationSetup.tsx to include server download step

## Phase 3.4: Integration

### Binary Packaging
- [ ] T035 Update PKG configuration in signaling-server/package.json to include PWA assets
- [ ] T036 Create build script for multi-platform binaries in signaling-server/scripts/build-binaries.sh
- [ ] T037 Test binary packaging with embedded PWA assets

### PWA Asset Pipeline
- [ ] T038 Create PWA build copy script in scripts/copy-pwa-assets.sh
- [ ] T039 Update GitHub Actions workflow to include PWA in server builds
- [ ] T040 Verify PWA assets are correctly served from binaries

### Station Configuration
- [ ] T041 Save server deployment status in IndexedDB
- [ ] T042 Display server status in station configuration view
- [ ] T043 Add server health check to station dashboard

## Phase 3.5: Polish
- [ ] T044 [P] Unit tests for package builder in signaling-server/tests/unit/package-builder.test.js
- [ ] T045 [P] Unit tests for certificate bootstrap in signaling-server/tests/unit/cert-bootstrap.test.js
- [ ] T046 [P] Update CLAUDE.md with PWA server deployment instructions
- [ ] T047 Create emergency deployment documentation in docs/emergency-deployment.md
- [ ] T048 Performance test: PWA loading time <2s in signaling-server/tests/performance/pwa-load.test.js
- [ ] T049 Compression test: Package size <100MB in signaling-server/tests/performance/package-size.test.js
- [ ] T050 Add server deployment metrics to telemetry
- [ ] T051 Run quickstart.md validation scenarios

## Dependencies
- Setup (T001-T004) blocks everything
- Tests (T005-T019) must complete before implementation (T020-T034)
- Server modules (T020-T023) before route integration (T028-T030)
- React components (T031-T034) can run parallel with server work
- Binary packaging (T035-T037) after server implementation
- Everything before polish (T044-T051)

## Parallel Example
```bash
# Phase 3.2: Launch all contract tests together (T005-T013):
Task: "Contract test GET /api/packages/info in signaling-server/tests/contract/package-info.test.js"
Task: "Contract test GET /api/packages/download in signaling-server/tests/contract/package-download.test.js"
Task: "Contract test GET /api/packages/manifest in signaling-server/tests/contract/package-manifest.test.js"
Task: "Contract test GET / (PWA index) in signaling-server/tests/contract/pwa-index.test.js"
Task: "Contract test GET /static/* (assets) in signaling-server/tests/contract/pwa-static.test.js"
# ... (continue with remaining contract tests)

# Phase 3.3: Launch all models together (T024-T027):
Task: "ServerPackage model in signaling-server/src/models/ServerPackage.js"
Task: "PlatformBinary model in signaling-server/src/models/PlatformBinary.js"
Task: "DeploymentConfig model in signaling-server/src/models/DeploymentConfig.js"
Task: "RootCertificate model in signaling-server/src/models/RootCertificate.js"
```

## Notes
- Express.static middleware for efficient PWA serving
- PWA must be served on same port (8080) as WebSocket
- Certificate bootstrap only triggers when no existing certificates
- Emergency preparedness messaging prominent in UI
- Package includes all platform binaries (Linux x64/ARM64, macOS x64/ARM64, Windows x64)
- Server must validate PWA structure on startup
- Binary packages must be self-contained with embedded assets

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (3 APIs → 9 contract tests)
- [x] All entities have model tasks (4 entities → 4 models, PWAAssets is static)
- [x] All tests come before implementation (T005-T019 before T020-T043)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] User story scenarios covered (6 integration tests)
- [x] Performance requirements included (load time <2s, package <100MB)