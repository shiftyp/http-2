# Implementation Plan: Rich Media Components

**Branch**: `024-rich-media-components` | **Date**: 2025-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-rich-media-components/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Project Type: web (PWA with offline capabilities)
   → Structure Decision: Option 1 (Single project with lib structure)
3. Evaluate Constitution Check section ✓
   → FCC compliance verified
   → TDD approach confirmed
4. Execute Phase 0 → research.md ✓
5. Execute Phase 1 → contracts, data-model.md, quickstart.md ✓
6. Re-evaluate Constitution Check section ✓
7. Plan Phase 2 → Task generation approach described ✓
8. STOP - Ready for /tasks command
```

## Summary
Enable rich media components (images, audio, video, documents) in the visual page builder with 100KB size limits per file, using WebAssembly codecs for optimal compression, YAML/UTF-8 serialization for component transfer, and OFDM-only transmission with parallel chunk distribution across available subcarriers.

## Technical Context
**Language/Version**: TypeScript 5.x, ES2022 modules
**Primary Dependencies**: React 18, WebAssembly codecs, YAML parser, Web Audio/Canvas APIs
**Storage**: IndexedDB for media cache, blob storage for binary data
**Testing**: Vitest for unit/integration, contract tests for API compliance
**Target Platform**: Progressive Web App (browser-based, offline-capable)
**Project Type**: web (frontend PWA with service workers)
**Performance Goals**: <5s compression time, <2s progressive preview, 100+ kbps via OFDM
**Constraints**: 100KB max file size, 2.8 kHz bandwidth, FCC Part 97 compliance
**Scale/Scope**: Support 4 media types, 5+ items per page, configurable cache

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (PWA with integrated libraries)
- Using framework directly? Yes (React components, no wrappers)
- Single data model? Yes (unified media component model)
- Avoiding patterns? Yes (direct IndexedDB access)

**Architecture**:
- EVERY feature as library? Yes
- Libraries listed:
  - `media-codecs`: WebAssembly codec management
  - `yaml-serializer`: Component YAML serialization
  - `media-cache`: IndexedDB media storage
  - `ofdm-media-transport`: Parallel chunk transmission
  - `media-components`: React components for media
- CLI per library: Each with --help/--version/--format
- Library docs: llms.txt format planned

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual IndexedDB, WebAssembly)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test ✓

**Observability**:
- Structured logging included? Yes
- Frontend logs → backend? Yes (unified stream)
- Error context sufficient? Yes (media type, size, compression ratio)

**Versioning**:
- Version number assigned? Yes (0.1.0 for initial)
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (migration for YAML schema changes)

**FCC Compliance**:
- Station identification preserved? Yes
- Content validation enforced? Yes (manual review)
- Commercial content blocked? Yes
- Third-party content marked? Yes

## Project Structure

### Documentation (this feature)
```
specs/024-rich-media-components/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── lib/
│   ├── media-codecs/          # WebAssembly codec management
│   ├── yaml-serializer/       # YAML component serialization
│   ├── media-cache/           # IndexedDB media storage
│   ├── ofdm-media-transport/  # Parallel chunk transmission
│   └── media-components/      # React media components
├── components/
│   ├── MediaImage/
│   ├── MediaAudio/
│   ├── MediaVideo/
│   └── MediaDocument/
└── services/
    └── media-manager/

tests/
├── contract/
│   ├── media-upload.test.ts
│   ├── media-compression.test.ts
│   └── yaml-serialization.test.ts
├── integration/
│   ├── media-transmission.test.ts
│   └── progressive-loading.test.ts
└── unit/
    └── codec-selection.test.ts
```

**Structure Decision**: Option 1 (Single project) - PWA with integrated libraries

## Phase 0: Outline & Research

### Research Tasks Completed:
1. **WebAssembly Codecs Investigation**
   - Decision: Use existing WASM libraries (mozjpeg, libwebp, opus-encoder)
   - Rationale: Better compression ratios than browser native
   - Alternatives: Native browser APIs (rejected: insufficient compression)

2. **YAML Serialization Strategy**
   - Decision: js-yaml library with custom schemas
   - Rationale: Mature, supports UTF-8, compact output
   - Alternatives: Custom parser (rejected: complexity)

3. **OFDM Subcarrier Allocation**
   - Decision: Dynamic allocation based on client count
   - Rationale: Maximizes parallel transmission efficiency
   - Alternatives: Fixed allocation (rejected: wastes bandwidth)

4. **Progressive Loading Techniques**
   - Decision: Codec-specific progressive formats
   - Rationale: Minimizes RF transmission time
   - Alternatives: Custom chunking (rejected: codec support better)

5. **Media Storage Architecture**
   - Decision: IndexedDB for metadata, blob store for binary
   - Rationale: Best performance for large binary data
   - Alternatives: All IndexedDB (rejected: slower for binary)

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts

### Data Model (→ data-model.md)
```yaml
MediaComponent:
  id: string
  type: IMAGE | AUDIO | VIDEO | DOCUMENT
  gridPosition: {x, y, width, height}
  source:
    original: Blob
    compressed: Blob
    metadata:
      size: number
      format: string
      compression: emergency | standard | quality
      chunks: number
      checksum: string
  transmission:
    priority: emergency | high | normal
    status: pending | transmitting | complete | failed
    progress: number (0-100)
  display:
    fallbackText: string
    thumbnail: Blob
    progressive: Blob[]
```

### API Contracts (→ /contracts/)
1. **Media Upload API**
   - POST /api/media/upload
   - Multipart form with file, compression profile
   - Returns media ID, compressed size

2. **Media Compression API**
   - POST /api/media/compress
   - Body: media ID, target size, profile
   - Returns compressed blob, metadata

3. **YAML Serialization API**
   - POST /api/components/serialize
   - Body: component tree
   - Returns YAML string

4. **OFDM Transmission API**
   - POST /api/transmission/queue
   - Body: media chunks, priority
   - Returns queue position, ETA

### Contract Tests (failing, no implementation)
- media-upload.contract.test.ts
- media-compression.contract.test.ts
- yaml-serialization.contract.test.ts
- ofdm-transmission.contract.test.ts

### Quickstart Guide (→ quickstart.md)
Step-by-step guide for:
1. Adding image component to page
2. Configuring compression
3. Previewing YAML output
4. Transmitting via OFDM
5. Monitoring progress

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Contract tests for each API endpoint [P]
- Model creation for MediaComponent entity [P]
- WebAssembly codec integration tasks
- YAML serializer implementation
- React component creation (Image, Audio, Video, Document)
- OFDM transmission integration
- Progressive loading implementation
- Media cache management
- FCC compliance validation

**Ordering Strategy**:
1. Contract tests first (TDD)
2. Data models and storage
3. Codec libraries
4. Serialization layer
5. React components
6. Transmission integration
7. UI and progress tracking

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

## Complexity Tracking
*No violations - design adheres to constitutional principles*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*