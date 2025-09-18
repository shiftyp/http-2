# Implementation Plan: Certificate Management

**Branch**: `020-certificate-management` | **Date**: 2025-09-18 | **Spec**: `/specs/020-certificate-management/spec.md`
**Input**: Feature specification from `/specs/020-certificate-management/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement a comprehensive certificate management system for amateur radio HTTP communication supporting X.509 certificates with ham extensions, CAPTCHA verification, server approval workflows, and trust chain federation. The system enables secure station identification using LoTW, ARRL, and self-signed certificates with offline verification capabilities.

## Technical Context
**Language/Version**: TypeScript 5.x (PWA), Node.js 20+ (Server)
**Primary Dependencies**: Web Crypto API (certificates), IndexedDB (storage), ws (WebSocket server), idb (IndexedDB wrapper)
**Storage**: IndexedDB for client certificates/trust chains, signaling server for approval workflows
**Testing**: Vitest for unit/integration tests, contract tests for API compliance
**Target Platform**: Progressive Web App (client), Node.js signaling server (approval workflow)
**Project Type**: web - PWA enhancement + signaling server certificate approval system
**Performance Goals**: <200ms certificate verification, <1s CAPTCHA generation, offline verification capability
**Constraints**: FCC Part 97 compliance (no content encryption), radio bandwidth optimization, offline operation
**Scale/Scope**: Multiple certificates per client, trust chain depth limit, CAPTCHA rate limiting (3/hour)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (PWA client library, signaling server enhancement) ✓
- Using framework directly? Yes - Web Crypto API, IndexedDB, ws library ✓
- Single data model? Yes - X.509 with ham extensions, shared schemas ✓
- Avoiding patterns? Yes - direct browser APIs, simple REST endpoints ✓

**Architecture**:
- EVERY feature as library? Yes - certificate-management library ✓
- Libraries listed:
  - certificate-management: X.509 parsing, CAPTCHA generation, trust chains
  - crypto: Extended for certificate operations (builds on existing)
- CLI per library: certificate-management --list, --verify, --trust ✓
- Library docs: llms.txt format planned? Yes ✓

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes ✓
- Git commits show tests before implementation? Yes ✓
- Order: Contract→Integration→E2E→Unit strictly followed? Yes ✓
- Real dependencies used? Web Crypto API, IndexedDB, signaling server ✓
- Integration tests for: certificate parsing, CAPTCHA verification, trust chains? Yes ✓
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? Yes - certificate operations, CAPTCHA attempts, approvals ✓
- Frontend logs → backend? Yes - approval requests, ban notifications ✓
- Error context sufficient? Yes - callsign, certificate type, operation ✓

**Versioning**:
- Version number assigned? 1.0.0 ✓
- BUILD increments on every change? Yes ✓
- Breaking changes handled? Certificate format migrations planned ✓

## Project Structure

### Documentation (this feature)
```
specs/020-certificate-management/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (PWA with certificate management)
src/lib/
├── certificate-management/
│   ├── Certificate.ts           # X.509 with ham extensions
│   ├── CertificateRequest.ts    # Approval workflow
│   ├── CAPTCHAGenerator.ts      # Radio-optimized challenges
│   ├── TrustChain.ts           # Certificate federation
│   ├── PKCSParser.ts           # LoTW P12 parsing
│   └── index.ts
├── crypto/                      # Extended existing library
│   ├── index.ts                # Enhanced with certificate operations
│   └── CertificateValidator.ts  # X.509 validation
└── database/                    # Extended existing library
    ├── index.ts                # Enhanced with certificate storage
    └── CertificateStore.ts      # IndexedDB certificate operations

signaling-server/
├── src/
│   ├── services/
│   │   ├── CertificateApproval.js  # Server approval workflow
│   │   ├── CAPTCHAVerification.js  # Solution validation
│   │   └── TrustManager.js         # Trust chain operations
│   └── api/
│       └── certificate-endpoints.js # REST API for approvals
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

tests/
├── contract/
│   ├── certificate-api.test.ts      # Client API contracts
│   └── server-certificate-api.test.ts # Server API contracts
├── integration/
│   ├── certificate-lifecycle.test.ts  # End-to-end flows
│   ├── captcha-verification.test.ts   # CAPTCHA workflow
│   └── trust-chain.test.ts           # Federation tests
└── unit/
```

**Structure Decision**: Option 1 - Single project (PWA + signaling server enhancement)

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - X.509 certificate extensions for amateur radio
   - PKCS#12 parsing in browser environment (LoTW certificates)
   - CAPTCHA generation suitable for radio transmission compression
   - Trust chain validation algorithms and depth limits
   - IndexedDB patterns for certificate storage and retrieval
   - WebSocket integration for approval workflow notifications

2. **Generate and dispatch research agents**:
   ```
   Task: "Research X.509 certificate extensions for amateur radio applications"
   Task: "Find browser-compatible PKCS#12 parsing libraries and techniques"
   Task: "Research CAPTCHA design for radio transmission optimization"
   Task: "Analyze trust chain validation algorithms and attack prevention"
   Task: "Study IndexedDB best practices for certificate storage and indexing"
   Task: "Research WebSocket patterns for approval workflow notifications"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: Web Crypto API for certificate operations
   - Rationale: Native browser support, no external dependencies
   - Alternatives considered: Third-party libs (bundle size), server-side (offline issues)

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Certificate: X.509 with amateur radio extensions (callsign, license class)
   - CertificateRequest: Pending approval with CAPTCHA status
   - CAPTCHAChallenge: Radio-optimized verification challenge
   - SignedCAPTCHASolution: Forever-valid CAPTCHA solution
   - ApprovalRecord: Server operator's decision with trust level
   - BanRecord: Distinguished from revocation
   - TrustChain: Certificate trust relationships with depth limits

2. **Generate API contracts** from functional requirements:
   - POST /api/certificates/request - Submit certificate for approval
   - GET /api/certificates/pending - Server operator approval queue
   - PUT /api/certificates/{id}/approve - Approve/reject certificate
   - POST /api/captcha/generate - Generate CAPTCHA challenge
   - POST /api/captcha/verify - Verify CAPTCHA solution
   - GET /api/trust-chain/{callsign} - Get certificate trust lineage
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - test-certificate-request.js
   - test-approval-workflow.js
   - test-captcha-verification.js
   - test-trust-chain-federation.js
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Client uploads LoTW P12 certificate
   - Server operator approves/rejects requests
   - CAPTCHA generation and verification
   - Trust chain validation and federation
   - Offline certificate verification

5. **Update agent file incrementally** (O(1) operation):
   - Add certificate management context to CLAUDE.md
   - Note X.509 with ham extensions requirement
   - Update recent changes section

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Certificate parsing → core implementation task
- CAPTCHA generation → implementation task
- Trust chain validation → implementation task
- Approval workflow → server implementation task

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models → Services → API → Integration
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - design follows constitutional principles*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*