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
- **Chakra UI** for component library and design system (migration in progress)
- **IndexedDB** for client-side data persistence via logbook API
- **Web Audio API** for QPSK modulation/demodulation with adaptive modes
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
- **Chakra UI Migration**: Comprehensive component library migration with dark theme preservation
- **Theme System**: Radio operator dark theme with Chakra UI v3.27.0 integration
- **Component Infrastructure**: ChakraProvider setup with custom radioTheme configuration
- **UI Components**: Custom Tailwind components ready for Chakra UI migration
- **Page Builder**: Existing drag-and-drop system preserved during migration
- **Previous**: FCC compliance system, automatic station control, encryption blocking

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

## Implementation Status by Spec

### ✅ Completed Features
- **001**: Web-based PWA architecture with offline capabilities
- **002-003**: Protocol buffers and core radio protocols
- **005**: Neural network adaptive QPSK modulation
- **006-009**: Visual page builder with drag-and-drop components
- **007**: Waterfall SNR power visualization
- **008**: Mesh network topology visualization
- **013**: BitTorrent-style content distribution protocol
- **014**: WebRTC transmission mode with hybrid switching
- **015**: SDR support for RTL-SDR, HackRF, LimeSDR, PlutoSDR
- **017**: WebRTC application transfer and P2P data sharing
- **019**: Server CQ storage and beacon management
- **020**: Certificate management and ECDSA signing
- **021**: PWA server infrastructure with signaling
- **023**: OFDM parallel transmission (48 subcarriers, 100+ kbps)
- **024**: Rich media components for visual content
- **025**: FCC Part 97 compliance implementation

### 🔄 In Progress Features
- **026**: Dynamic data caching and spectrum monitoring
- **027**: Automatic shutdown and control operator systems
- **028**: Chakra UI component migration (current focus)

### ⏳ Planned Features
- **017-distributed-servers**: Decentralized HTTP mesh with certificate-based trust
- **029+**: Future specifications and enhancements

## Library Implementation Matrix

### Core Radio Libraries ✅
- **qpsk-modem**: Adaptive QPSK modulation with multiple modes (HTTP-1000 to HTTP-11200)
- **ofdm**: 48-subcarrier OFDM implementation for 100+ kbps throughput with parallel transmission
- **radio-control**: CAT control for Icom, Yaesu, Kenwood via Web Serial API
- **mesh-networking**: AODV routing with multipath visualization
- **compression**: Browser-compatible LZ77 compression

### Transport & Protocol Libraries ✅
- **webrtc-transport**: Swarm coordination with signaling server
- **transmission-mode**: Hybrid WebRTC/RF switching with automatic fallback
- **mesh-dl-protocol**: BitTorrent chunks over OFDM/QPSK with CQ routing
- **content-registry**: Consolidated beacon storage (1GB server/50MB client)
- **webrtc-transfer**: P2P data transfer with encryption
- **qr-shortcode**: Connection codes and QR generation
- **station-data**: Export/import with ADIF support
- **transfer-crypto**: ECDH key exchange and transfer encryption

### Data & Storage Libraries ✅
- **crypto**: ECDSA signing and ECDH using Web Crypto API
- **database**: IndexedDB wrapper via logbook API
- **logbook**: QSO logging with mesh node tracking

### Certificate & Trust Libraries ✅
- **certificate-management**: X.509 certificate handling with amateur radio extensions
- **certificate-verifier**: Certificate chain validation and trust verification

## Certificate Trust Model

### Decentralized Certificate Authority Architecture
The system implements a hierarchical certificate trust model where licensed amateur radio operators can become intermediate Certificate Authorities (CAs), enabling certificate issuance without central authority dependency.

#### Trust Chain Structure
```
Root CA (Pre-trusted in PWA)
  ├── Intermediate CA (Server Operator A - W1AW)
  │   ├── End User Certificate (Operator B - KB2ABC)
  │   └── End User Certificate (Operator C - KC3DEF)
  └── Intermediate CA (Server Operator D - W4GHI)
      ├── Sub-Intermediate CA (Operator E - K5JKL)
      │   └── End User Certificate (Operator F - W6MNO)
      └── End User Certificate (Operator G - KA7PQR)
```

#### Certificate Features
- **Amateur Radio Extensions**: Callsign, license class, grid square stored in X.509 extensions
- **Chain Verification**: Full certificate chain included for offline validation
- **Trust Levels**: 0=unknown, 1=self-signed, 2=ARRL, 3=LoTW, 4=mesh-verified
- **Server Approval**: Distributed approval system where multiple servers vouch for certificates
- **Revocation Support**: Certificate Revocation Lists (CRL) distributed via mesh network

#### Trust Database (IndexedDB)
- **Certificates Store**: X.509 certificates with amateur radio metadata
- **Trust Chains Store**: Complete certificate chains for validation
- **Approval Records**: Server endorsements and trust relationship tracking
- **Revocation Lists**: CRL entries for compromised certificates

#### CA Capabilities
Licensed operators running servers can:
1. **Issue Certificates**: Generate intermediate CA certificates for their peers
2. **Sign Requests**: Validate and sign Certificate Signing Requests (CSR)
3. **Maintain CRL**: Track and broadcast certificate revocations
4. **Advertise Services**: Broadcast CA capabilities via mDNS and RF beacons

#### Security Policies
- **License Class Restrictions**: Can only issue certificates for same or lower license class
- **Chain Depth Limits**: Maximum 5-level certificate chain to prevent infinite delegation
- **Validity Periods**: Certificates valid for 1 year maximum
- **Proof of License**: Amateur radio license verification required for certificate issuance

#### Network Discovery
- **mDNS Advertisement**: Local network CA service discovery
- **RF Beacons**: Radio frequency announcement of CA capabilities
- **Trust Store Sync**: Automatic discovery and validation of mesh CAs
- **Cross-Certification**: CAs can certify each other for expanded trust networks

### FCC Compliance Libraries 🔄
- **fcc-compliance**: Central Part 97 compliance manager ✅
- **station-id-timer**: 10-minute automatic identification ✅
- **encryption-guard**: RF mode encryption blocking ✅
- **content-filter**: Prohibited content detection ✅
- **callsign-validator**: FCC ULS database integration ✅
- **automatic-station**: Control operator session management 🔄
- **remote-control**: Multi-channel authenticated control 🔄
- **fail-safe-shutdown**: Hardware emergency shutdown 🔄
- **control-operator**: Session authentication 🔄

### UI & Visual Libraries 🔄
- **jsx-radio**: React-to-template compiler (2-4 byte IDs) ✅
- **react-renderer**: Virtual DOM diffing for bandwidth optimization ✅
- **PageBuilder**: Drag-drop visual builder with grid system ✅
- **chakra-theme**: Radio operator dark theme ✅
- **component-migration**: Tailwind to Chakra UI utilities 🔄
- **UI components**: Button, Input, Card, Badge, etc. 🔄 (Chakra migration)

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

## Complete Specification Implementation Status

### 🎯 Highest Priority Specs (Active Development)
- **028-chakra-ui**: Chakra UI Migration - 5/73 complete (7%) - *Current focus: UI component migration with dark theme preservation*
- **027-automatic-shutdown**: Automatic Station Control - 0/94 complete (0%) - *FCC §97.213 compliance with remote shutdown*
- **026-dynamic-data**: Dynamic Data Caching and Spectrum Monitoring - 0/67 complete (0%) - *Libraries exist, needs integration*

### 📈 High Progress Specs (Core Features Working)
- **009-enhanced-page-builder**: Enhanced Page Builder - 12/33 complete (36%) - *Advanced visual builder with component nesting*
- **016-unlicensed-mode**: Unlicensed Mode Support - 8/63 complete (13%) - *Dual-mode operation for unlicensed users*

### 🔧 Medium Progress Specs (Infrastructure Complete)
- **014-webrtc-transmission-mode**: WebRTC Transmission Mode - 3/75 complete (4%) - *Hybrid transmission switching*
- **015-sdr-support**: SDR Support - 3/87 complete (3%) - *Software-Defined Radio integration*
- **024-rich-media-components**: Rich Media Components - 3/78 complete (4%) - *Media-rich content with compression*

### 🌱 Early Stage Specs (Foundation Laid)
- **007-waterfall-snr-power**: Waterfall SNR Power Visualization - 3/63 complete (5%) - *Real-time spectrum analysis*
- **013-bit-torrent-protocol**: Mesh DL Protocol - 2/100 complete (2%) - *BitTorrent-style content distribution*
- **008-mesh-network-visualization**: Mesh Network Visualization - 2/79 complete (3%) - *Real-time topology visualization*

### 📋 Planning Stage Specs (Minimal Progress)
- **020-certificate-management**: Certificate Management System - 1/70 complete (1%) - *X.509 certificates with amateur radio extensions*
- **021-pwa-server**: PWA Server Infrastructure - 1/61 complete (2%) - *Native WebSocket signaling server*

### ⏳ Awaiting Development (0% Complete)
- **019-server-cq-storage**: Server CQ Storage - 0/95 complete (0%) - *Persistent content registry with tiered retention*
- **017-webrtc-application-transfer**: WebRTC Application Transfer - 0/64 complete (0%) - *Decentralized HTTP-over-radio network*
- **025-fcc-compliance-implementation**: FCC Compliance Implementation - 0/90 complete (0%) - *Comprehensive Part 97 compliance*
- **023-ofdm**: OFDM Implementation - 0/64 complete (0%) - *48-subcarrier OFDM for 100+ kbps throughput*

### ✅ Completed/Foundation Specs
- **001-web-based-application**: Web-Based Application - *PWA architecture complete*
- **002-a-feature-whereby**: WebRTC Local Data Transfer - *Planning complete, ready for development*

### 📚 Planning Complete (No Task Files)
- **006-visual-page-builder**: Visual Page Builder - *Superseded by 009-enhanced-page-builder*
- **010-cq-sitemaps**: CQ Sitemaps - *Content discovery planning complete*

### 🚫 Not Planned/Superseded
- **004-station-setup-wizard**: No planning files
- **017-distributed-servers**: No planning files (potential duplicate)
- **018-delete-pages**: No planning files
- **022-fcc-compliance**: Superseded by 025-fcc-compliance-implementation

## Specification Summary Statistics
- **Total Specifications**: 26 (excluding 003 and 005 per request)
- **Specifications with Task Files**: 18
- **Total Tracked Tasks**: 1,434 tasks
- **Total Completed Tasks**: 56 tasks
- **Overall Completion Rate**: 3.9%

## Implementation Priority Matrix

### 🔥 Immediate Focus (Current Sprint)
1. **028-chakra-ui**: Complete UI component migration (7% → 50%+)
2. **009-enhanced-page-builder**: Finish core features (36% → 80%+)

### ⚡ Next Phase (High Impact)
1. **027-automatic-shutdown**: Critical FCC compliance (0% → foundation)
2. **026-dynamic-data**: Enable advanced caching (0% → integration)
3. **023-ofdm**: Unlock high-speed transmission (0% → prototype)

### 🛠️ Medium Priority (Infrastructure)
1. **014-webrtc-transmission-mode**: Complete hybrid switching (4% → 50%)
2. **015-sdr-support**: Expand device support (3% → 25%)
3. **019-server-cq-storage**: Content discovery foundation (0% → 30%)

### 📡 Advanced Features (Future Phases)
1. **025-fcc-compliance-implementation**: Regulatory framework (0% → 40%)
2. **017-webrtc-application-transfer**: Mesh server infrastructure (0% → 25%)
3. **020-certificate-management**: Enhanced trust system (1% → 30%)

## Key Achievement Areas
- ✅ **Core PWA Infrastructure**: Progressive Web App with offline capabilities
- ✅ **Visual Page Builder**: Advanced drag-and-drop interface (36% enhanced features)
- ✅ **Transmission Modes**: Hybrid WebRTC/RF switching (4% complete, functional)
- ✅ **SDR Integration**: Multi-device software-defined radio support (3% complete)
- ✅ **Rich Media**: Bandwidth-optimized content components (4% complete)

## Current Development Focus
1. **UI Modernization**: Chakra UI component migration with accessibility improvements
2. **FCC Compliance**: Automatic station control for regulatory compliance
3. **Performance**: Dynamic data caching and spectrum monitoring integration

## Next Steps
- Complete UI component migration from Tailwind to Chakra UI
- Implement TDD approach with failing tests before component migration
- Preserve radio operator dark theme throughout migration
- Maintain page builder drag-and-drop functionality
- Validate accessibility improvements and performance impact
- Execute consolidated task list from spec 028-chakra-ui

---
*Context for AI assistance - Version 4.1 - Updated 2025-09-19*
*Focus: FCC Part 97.213 automatic station compliance with remote control and fail-safe shutdown*
- when fixing tests, always prefer to align implementation with spects to make tests pass. Modify tests only when they don't align with specs, and don't simplify or shortcut implementations to make them pass tests