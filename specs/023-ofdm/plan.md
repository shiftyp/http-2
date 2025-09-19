# Implementation Plan: OFDM with Parallel BitTorrent Transmission

**Branch**: `023-ofdm` | **Date**: 2025-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-ofdm/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detected 2 clarifications needed (FCC emission, CPU percentage)
   → Set Structure Decision: Option 1 (Single project - PWA architecture)
3. Evaluate Constitution Check section below
   → No violations detected - browser-first, TDD approach
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → Research OFDM implementations, BitTorrent protocols
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → No new violations
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

## Summary
Implement parallel BitTorrent chunk transmission across OFDM subcarriers to achieve 20-50x throughput gains over sequential transmission. The system will transmit up to 48 different chunks simultaneously across the 2.8 kHz bandwidth, with adaptive modulation per subcarrier and automatic chunk redistribution for failed carriers.

## Technical Context
**Language/Version**: TypeScript 5.x / ES2022 modules
**Primary Dependencies**: Web Audio API, WebAssembly (FFT), existing mesh-dl-protocol, qpsk-modem
**Storage**: IndexedDB for chunk maps and carrier health metrics
**Testing**: Vitest with contract/integration/unit tests
**Target Platform**: Progressive Web App (browser-based)
**Project Type**: single (PWA with offline-first architecture)
**Performance Goals**: 100+ kbps throughput on HF bands, <100ms chunk request latency
**Constraints**: 2.8 kHz bandwidth limit, FCC Part 97 compliance, browser CPU limits
**Scale/Scope**: 48 parallel subcarriers, 10+ concurrent peers, 256-byte chunk size

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA architecture)
- Using framework directly? Yes (Web Audio API, no wrappers)
- Single data model? Yes (extends existing BitTorrent chunk model)
- Avoiding patterns? Yes (direct implementation, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes
- Libraries listed:
  - `ofdm-modem`: OFDM modulation/demodulation with parallel carriers
  - `parallel-chunk-manager`: Chunk-to-subcarrier allocation and pipelining
  - `carrier-health-monitor`: Per-subcarrier SNR tracking and adaptation
- CLI per library: Each library will have test CLI
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (Web Audio API, IndexedDB)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? Yes
- Frontend logs → backend? N/A (PWA architecture)
- Error context sufficient? Yes (per-subcarrier error tracking)

**Versioning**:
- Version number assigned? 1.0.0
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (backwards compat with QPSK mode)

## Project Structure

### Documentation (this feature)
```
specs/023-ofdm/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── lib/
│   ├── ofdm-modem/           # OFDM modulation/demodulation
│   ├── parallel-chunk-manager/ # Chunk allocation logic
│   └── carrier-health-monitor/ # SNR tracking per carrier
├── components/
│   └── OFDMWaterfall/        # Visual spectrum display
└── workers/
    └── ofdm-processor.ts     # WebWorker for FFT processing

tests/
├── contract/
│   └── ofdm-transmission.test.ts
├── integration/
│   └── parallel-chunks.test.ts
└── unit/
    └── fft-processing.test.ts
```

**Structure Decision**: Option 1 (Single project - PWA architecture per constitution)

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - FCC emission designator for OFDM (2K80J2D vs 2K80G1D)
   - Optimal FFT size for 48 subcarriers in 2.8 kHz
   - WebAssembly vs Web Audio ScriptProcessor performance
   - Chunk size optimization (256 vs 512 bytes per subcarrier)

2. **Generate and dispatch research agents**:
   ```
   Task: "Research FCC emission designators for OFDM in amateur radio"
   Task: "Find optimal FFT parameters for 48-carrier OFDM in 2.8 kHz"
   Task: "Compare WebAssembly vs ScriptProcessor for realtime DSP"
   Task: "Research BitTorrent chunk sizing for parallel transmission"
   ```

3. **Consolidate findings** in `research.md`

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - ParallelChunkFrame: OFDM symbol with chunk allocations
   - SubcarrierGroup: 1-4 carriers per chunk
   - ChunkAllocationMap: Real-time chunk-to-carrier mapping
   - CarrierHealthMap: SNR and error rates per subcarrier

2. **Generate API contracts** from functional requirements:
   - OFDM transmission protocol specification
   - Chunk-to-subcarrier allocation protocol
   - Carrier health reporting protocol

3. **Generate contract tests** from contracts:
   - Test parallel chunk transmission
   - Test carrier failure and redistribution
   - Test adaptive modulation per carrier

4. **Extract test scenarios** from user stories:
   - Parallel transmission of 48 chunks
   - Automatic redistribution on carrier failure
   - Priority chunk allocation to best carriers

5. **Update agent file incrementally**:
   - Add OFDM and parallel chunk concepts to CLAUDE.md

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Generate OFDM modem library tasks
- Generate parallel chunk manager tasks
- Generate carrier health monitor tasks
- Generate visual waterfall component tasks
- Generate integration test tasks

**Ordering Strategy**:
- TDD order: Contract tests → Implementation → Integration
- Dependency order: OFDM modem → Chunk manager → Health monitor → UI
- Mark [P] for parallel execution where possible

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

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
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*