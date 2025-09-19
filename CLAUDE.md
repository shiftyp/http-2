# Claude Code Context: HTTP Over Ham Radio

## Project Overview
Progressive Web Application enabling HTTP communication over amateur radio networks using QPSK modulation, mesh routing, and visual content creation tools.

## Architecture
- **Progressive Web App**: React-based PWA with offline capabilities and visual page builder
- **Radio Interface**: CAT control via Web Serial API, audio via Web Audio API
- **SDR Integration**: WebUSB-based Software-Defined Radio support for wide-band monitoring
- **Protocol**: HTTP/1.1 over OFDM with 48 parallel subcarriers (100+ kbps) or adaptive QPSK (2.8kHz)
- **Parallel Transmission**: BitTorrent chunks transmitted simultaneously across OFDM subcarriers
- **Mesh**: AODV-based store-and-forward routing with visualization
- **Transmission Modes**: Hybrid WebRTC/RF switching with automatic fallback
- **Content Distribution**: BitTorrent-style chunking with parallel OFDM transmission
- **Signaling**: Native WebSocket server for internet peer discovery
- **Visual Builder**: Drag-and-drop component-based page creation system

## Key Technologies
- **TypeScript 5.x** with ES2022 modules
- **React 18** for PWA UI with visual page builder
- **IndexedDB** for client-side data persistence via logbook API
- **Web Audio API** for QPSK modulation/demodulation with neural networks
- **WebUSB API** for direct SDR device control (RTL-SDR, HackRF, LimeSDR, PlutoSDR, SDRplay)
- **WebAssembly** for real-time FFT processing and signal analysis
- **Web Serial API** for CAT radio control (Icom, Yaesu, Kenwood)
- **WebRTC** for peer-to-peer local network transfers
- **Web Crypto API** for ECDSA signing and ECDH encryption
- **DndKit** for drag-and-drop visual page building
- **Service Workers** for offline functionality
- **Vite** for build tooling and HMR

## Domain Context
- **Callsigns**: Amateur radio identifiers (e.g., KA1ABC)
- **CAT Control**: Computer Aided Transceiver control protocol
- **SDR**: Software-Defined Radio for wide-band spectrum monitoring
- **OFDM**: 48 parallel subcarriers for 100+ kbps throughput (20-50x speedup)
- **QPSK**: Fallback modulation (750-14400 bps) for compatibility
- **FCC Part 97**: US amateur radio regulations (no content encryption)
- **HF Bands**: High Frequency (3-30 MHz) with variable propagation
- **WebRTC Mode**: High-speed peer-to-peer (1MB/s local, internet via signaling)
- **RF Mode**: Parallel BitTorrent chunks over OFDM (100+ kbps) or QPSK (14.4 kbps)
- **Hybrid Mode**: Automatic switching between WebRTC and RF protocols
- **Visual Builder**: Component-based page creation without text editing

## HTTP Over Radio Specifics
- URLs format: `http://callsign.radio/path`
- Each station is an HTTP server accessible via radio
- Pages created visually using React components
- ETags for caching and idempotency
- Request IDs prevent duplicate processing
- Bandwidth limits: 2KB typical page size
- Compression required for all transmissions

## Visual Page Builder System
- **Component-based**: Everything created through visual components
- **No text editing**: All content creation via drag-and-drop interface
- **Grid layout**: CSS Grid-based positioning with visual indicators
- **Component types**: TEXT, HEADING, PARAGRAPH, IMAGE, FORM, INPUT, BUTTON, LINK, TABLE, LIST, CONTAINER, DIVIDER
- **Property editor**: Modal-based component property configuration
- **Live preview**: Real-time bandwidth optimization display
- **Compression stats**: Visual feedback on transmission efficiency

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
│   ├── compression/          # Browser-compatible compression ✅
│   ├── crypto/              # ECDSA/ECDH cryptography ✅
│   ├── database/            # IndexedDB wrapper ✅
│   ├── logbook/             # QSO logging with IndexedDB ✅
│   ├── jsx-radio/           # React-to-radio renderer ✅
│   ├── mesh-networking/     # AODV routing ✅
│   ├── qpsk-modem/          # Adaptive QPSK with neural networks ✅
│   ├── radio-control/       # CAT control ✅
│   ├── webrtc-transport/    # WebRTC peer connection management ✅
│   ├── transmission-mode/   # RF/WebRTC mode switching ✅
│   ├── mesh-dl-protocol/    # BitTorrent-style content distribution ✅
│   ├── webrtc-transfer/     # P2P data transfer ✅
│   ├── qr-shortcode/        # Connection codes ✅
│   ├── station-data/        # Data export/import ✅
│   ├── react-renderer/      # Virtual DOM renderer for radio ✅
│   └── transfer-crypto/     # Transfer encryption ✅
├── components/              # React components
│   ├── PageBuilder/         # Visual builder components ✅
│   │   ├── GridCanvas.tsx   # Drag-drop grid interface
│   │   ├── ComponentPalette.tsx # Component library
│   │   ├── PropertyEditor.tsx   # Modal property editor
│   │   └── PreviewPanel.tsx     # Live preview
│   ├── TransmissionModeToggle.tsx # Mode switching UI ✅
│   └── ui/                  # Base UI components ✅
├── pages/                   # Application pages
│   ├── PageBuilder.tsx      # Main visual builder ✅
│   ├── ContentCreator.tsx   # Content management router ✅
│   └── Dashboard.tsx        # System overview ✅
└── workers/                 # Service workers

signaling-server/            # Native WebSocket signaling server ✅
├── server.js               # Main WebSocket server (native ws)
├── package.json            # Minimal dependencies (ws only)
└── README.md               # Deployment guide

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
- **FCC Compliance System**: Comprehensive Part 97 compliance with automatic station ID, encryption blocking, content filtering
- **Station Identification**: 10-minute automatic timer plus end-of-transmission ID per §97.119
- **Encryption Control**: Runtime blocking of encryption in RF mode, allows signatures only
- **Content Filtering**: Music file blocking, profanity detection, business content warnings
- **Callsign Validation**: FCC ULS database integration for mesh relay verification
- **Previous**: OFDM parallel transmission, content registry, transmission modes

## Component System Architecture
- **ComponentType enum**: Defines all available component types
- **PageComponent interface**: Grid positioning and properties
- **DndKit integration**: Drag-and-drop with accessibility
- **Property modals**: Component configuration via modal interfaces
- **Grid system**: CSS Grid with visual indicators and snap-to-grid
- **Real-time compression**: Live bandwidth optimization feedback

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
- **Automatic Station Control**: FCC §97.213 compliance with remote shutdown capability
- **Control Operator Monitoring**: Required for automatic operation with session timeouts
- **Fail-Safe Mechanisms**: Hardware-level emergency shutdown independent of software

## Implemented Libraries

### Core Radio Libraries
- **qpsk-modem**: Adaptive QPSK modulation with neural network SNR optimization (750-14400 bps)
- **radio-control**: CAT control for Icom, Yaesu, Kenwood radios via Web Serial API
- **mesh-networking**: AODV routing protocol with multipath support and visualization
- **compression**: Browser-compatible LZ77-style compression replacing Node.js zlib

### Data & Transport Libraries
- **webrtc-transport**: WebRTC swarm coordination with signaling server integration
- **transmission-mode**: Hybrid mode switching manager with automatic fallback
- **mesh-dl-protocol**: BitTorrent-style content distribution with CQ beacon routing
- **content-registry**: Consolidated beacon storage with path aggregation (1GB server/50MB client)
- **priority-tiers**: Disaster-oriented content classification (P0-P5 with TTL management)
- **qr-shortcode**: QR code and shortcode generation for connection establishment
- **station-data**: Station data export/import with ADIF support
- **crypto**: ECDSA signing and ECDH key exchange using Web Crypto API
- **database**: IndexedDB wrapper using logbook API (no mock data)
- **logbook**: QSO logging with IndexedDB storage, pages, and mesh node tracking

### FCC Compliance & Automatic Station Libraries
- **fcc-compliance**: Central compliance manager coordinating all Part 97 requirements
- **station-id-timer**: 10-minute automatic identification with control operator ID
- **encryption-guard**: RF mode encryption blocking with transmission mode integration
- **content-filter**: Prohibited content detection with emergency override capability
- **callsign-validator**: FCC ULS database integration for mesh relay verification
- **remote-control**: Multi-channel authenticated remote control (WebSocket, RF, DTMF)
- **automatic-station**: Control operator session management with periodic acknowledgment
- **fail-safe-shutdown**: Hardware-level emergency shutdown with equipment monitoring
- **control-operator**: Session authentication and authority management

### UI Libraries
- **jsx-radio**: React-to-template compiler for bandwidth optimization (2-4 byte IDs)
- **react-renderer**: Virtual DOM diffing for bandwidth-optimized updates
- **PageBuilder components**: Complete visual building system with drag-drop
- **Grid-based layout**: CSS Grid positioning with visual indicators
- **Component palette**: Draggable component library with accessibility
- **Property editor**: Modal-based component configuration

## Performance Target
- < 500ms transmission initiation
- 2.8 kHz maximum bandwidth
- Support 10+ concurrent mesh nodes
- 60% cache hit ratio target
- 1MB/s WebRTC transfer rate (local network)
- 2KB page size optimization target

## Visual Building Principles
- **Pure component approach**: No text/markdown editing interfaces
- **Drag-and-drop first**: All content creation via visual tools
- **Real-time feedback**: Live compression and bandwidth stats
- **Grid-based layout**: Precise positioning with visual guides
- **Modal configuration**: Component properties via dedicated editors
- **Accessibility**: Full keyboard navigation and screen reader support

## Transmission Mode Commands
```bash
# Start signaling server for WebRTC mode
cd signaling-server && npm start

# Run WebRTC integration tests
npm test src/test/integration/hybrid-mode-switching.test.ts

# Run transmission mode contract tests
npm test src/test/contract/transmission-mode-integration.contract.test.ts

# Check signaling server health
curl http://localhost:8080/health
```

## Next Steps
- Add UI for transmission mode selection and peer management
- Implement spectrum monitoring for automatic content caching
- Enhance CQ beacon protocol with content routing intelligence
- Add WebRTC NAT traversal with TURN server support
- Deploy signaling server with Docker containerization
- Complete automatic shutdown system integration (027-automatic-shutdown)
- Add control operator monitoring UI with real-time status display
- Implement hardware fail-safe device integration via Web Serial API

---
*Context for AI assistance - Version 4.1 - Updated 2025-09-19*
*Focus: FCC Part 97.213 automatic station compliance with remote control and fail-safe shutdown*
- when fixing tests, always prefer to align implementation with spects to make tests pass. Modify tests only when they don't align with specs, and don't simplify or shortcut implementations to make them pass tests