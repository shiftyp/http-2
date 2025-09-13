# Claude Code Context: HTTP Over Ham Radio

## Project Overview
Web application enabling HTTP communication over amateur radio networks using QPSK modulation and mesh routing.

## Architecture
- **Progressive Web App**: React-based PWA with offline capabilities
- **Radio Interface**: CAT control via Web Serial API, audio via Web Audio API
- **Protocol**: HTTP/1.1 over QPSK modulation (2.8kHz bandwidth)
- **Mesh**: AODV-based store-and-forward routing with multipath support
- **Data Transfer**: WebRTC peer-to-peer for local network station migration

## Key Technologies
- **TypeScript 5.x** with ES2022 modules
- **React 18** for PWA UI (minimal bundle, progressive enhancement)
- **IndexedDB** for client-side data persistence and caching
- **Web Audio API** for QPSK modulation/demodulation
- **Web Serial API** for CAT radio control
- **WebRTC** for peer-to-peer local network transfers
- **Web Crypto API** for ECDSA signing and ECDH encryption
- **Service Workers** for offline functionality
- **Vite** for build tooling and HMR

## Domain Context
- **Callsigns**: Amateur radio identifiers (e.g., KA1ABC)
- **CAT Control**: Computer Aided Transceiver control protocol
- **QPSK**: Quadrature Phase Shift Keying modulation
- **FCC Part 97**: US amateur radio regulations (no encryption)
- **HF Bands**: High Frequency (3-30 MHz) with variable propagation

## HTTP Over Radio Specifics
- URLs format: `http://callsign.radio/path`
- Each station is an HTTP server accessible via radio
- HTML pages with forms, minimal CSS, optional inline JS
- ETags for caching and idempotency
- Request IDs prevent duplicate processing
- Bandwidth limits: 2KB typical page size
- Compression required for all transmissions

## Idempotency Strategy
- **GET**: If-None-Match with ETags (304 responses)
- **PUT/DELETE**: If-Match for optimistic locking
- **POST**: X-Request-ID for deduplication
- Request body ETags prevent duplicate processing
- Idempotency keys for critical operations

## Project Structure
```
src/
├── lib/                      # Core libraries (70% test coverage)
│   ├── compression/          # Brotli/gzip compression ✅
│   ├── crypto/              # ECDSA/ECDH cryptography ✅
│   ├── database/            # IndexedDB wrapper ✅
│   ├── ham-server/          # HTTP server for radio ✅
│   ├── jsx-radio/           # React-to-radio renderer ✅
│   ├── logbook/             # QSO logging ✅
│   ├── mesh-networking/     # AODV routing ✅
│   ├── qpsk-modem/          # QPSK modulation ✅
│   ├── radio-control/       # CAT control ✅
│   ├── webrtc-transfer/     # P2P data transfer (planned)
│   ├── qr-shortcode/        # Connection codes (planned)
│   ├── station-data/        # Data export/import (planned)
│   └── transfer-crypto/     # Transfer encryption (planned)
├── components/              # React components
│   └── Radio/               # Radio UI components
├── pages/                   # Application pages
├── services/                # API services
├── test/                    # Test utilities and mocks
└── workers/                 # Service workers

tests/ (312 total tests, 219 passing)
├── contract/                # API contract tests
├── integration/             # E2E tests
└── unit/                    # Unit tests
```

## Testing Strategy
- **TDD Approach**: Tests written before implementation
- **Contract tests** for protocol compliance
- **Integration tests** for library interactions
- **Unit tests** for individual functions (70% coverage)
- **Mock infrastructure** for radio hardware simulation
- **Current Status**: 312 tests, 219 passing (70.2%)

## Recent Changes
- Implemented comprehensive test suites (70% coverage, 219 passing tests)
- Added JSX-to-radio React renderer for bandwidth optimization
- Implemented AODV mesh networking with multipath support
- Added QPSK modem with SNR-based adaptive rates
- Created ham-server HTTP implementation for radio
- Specified WebRTC peer-to-peer data transfer feature (in planning)

## Common Commands
```bash
npm run dev              # Start Vite dev server
npm run dev:https        # Start with HTTPS for WebRTC
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:integration # Run integration tests
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checks
```

## FCC Compliance Notes
- No encryption of content (only signatures)
- Station ID every 10 minutes
- Bandwidth limits per band
- All transmissions logged

## Implemented Libraries

### Core Radio Libraries
- **qpsk-modem**: Adaptive QPSK modulation with SNR-based rate selection (750-8400 bps)
- **radio-control**: CAT control for Icom, Yaesu, Kenwood radios via Web Serial API
- **mesh-networking**: AODV routing protocol with multipath support
- **ham-server**: HTTP/1.1 server implementation for radio transport

### Data & Crypto Libraries
- **crypto**: ECDSA signing and ECDH key exchange using Web Crypto API
- **compression**: Brotli/gzip compression with 10-20x ratios
- **database**: IndexedDB wrapper for pages, logs, settings, certificates
- **logbook**: QSO logging with ADIF export and contest support

### UI Libraries
- **jsx-radio**: React-to-template compiler for bandwidth optimization (2-4 byte IDs)

## Performance Targets
- < 500ms transmission initiation
- 2.8 kHz maximum bandwidth
- Support 10+ concurrent mesh nodes
- 60% cache hit ratio target
- 1MB/s WebRTC transfer rate (local network)

## Next Steps
- Implement WebRTC transfer libraries (webrtc-transfer, qr-shortcode, station-data, transfer-crypto)
- Complete remaining test coverage for untested modules
- Add E2E tests with Playwright
- Implement service worker for offline functionality
- Deploy as installable PWA

---
*Context for AI assistance - Version 2.0 - Updated 2025-09-13*