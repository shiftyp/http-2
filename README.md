# HTTP Over Ham Radio 📻

A Progressive Web Application (PWA) enabling HTTP communication over amateur radio networks using QPSK modulation, mesh routing, and visual content creation tools.

## 🎯 Overview

HTTP Over Ham Radio transforms amateur radio into a digital communication network capable of transmitting web content, messages, and data between stations. Built as a browser-based PWA with a visual page builder, it requires no server infrastructure and works completely offline.

### Key Features

- **⚡ Hybrid Transmission Modes**: Seamless switching between WebRTC (1MB/s) and RF (14.4kbps) with automatic fallback
- **🌐 Torrent-like Protocol Over Radio**: Chunked content distribution with CQ beacon routing and spectrum monitoring
- **📡 WebRTC P2P Network**: Direct peer connections via native WebSocket signaling server
- **🎨 Visual Page Builder**: Drag-and-drop interface for creating web content optimized for radio transmission
- **📊 Adaptive Modem**: 750-14400 bps data rates with SNR-based adaptation
- **🗜️ Content Compression**: 10x-20x text content compression over HTML using JSX-to-template compilation and browser-compatible algorithms
- **🕸️ Mesh Networking**: AODV routing protocol for multi-hop communication with visualization
- **🔒 Cryptographic Security**: ECDSA signatures and ECDH encryption using Web Crypto API
- **📖 Digital Logbook**: Full QSO logging with ADIF export and IndexedDB storage
- **💾 Offline-First**: Complete PWA with Service Worker caching and local data persistence
- **🎛️ Radio Control**: CAT control via Web Serial API for Icom, Yaesu, and Kenwood radios

## 🚦 Quick Start

### Prerequisites

- Modern web browser (Chrome, Edge, Firefox, Safari)
- Amateur radio license (for transmission)
- Compatible radio with CAT control (optional)
- Web Serial API support (Chrome/Edge recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/http-2.git
cd http-2

# Install dependencies
npm install

# Start development server
npm run dev

# For WebRTC features (requires HTTPS)
npm run dev:https
```

Open http://localhost:3000 in your browser

### First Time Setup

1. **Install as PWA**: Click "Install" when prompted or use browser menu
2. **Enter Callsign**: Settings → Station Info → Enter your callsign
3. **Connect Radio** (optional): Settings → Radio → Connect via Web Serial API
4. **Create Content**: Use the Visual Page Builder to create your first page

## 🏗️ Visual Page Builder

The core of the system is the visual, component-based page builder:

- **Drag & Drop Interface**: Create pages by dragging components onto a grid canvas
- **Component Library**: Text, headings, images, forms, buttons, tables, and containers
- **Property Editor**: Configure component properties and styles through modal interfaces
- **Live Preview**: Real-time preview of your page as you build
- **Compression Stats**: See bandwidth optimization in real-time
- **Grid Layout**: Precise positioning using CSS Grid with visual indicators

### Creating Your First Page

1. Navigate to **Content Creator** → **Visual Page Builder**
2. Drag components from the palette to the canvas
3. Click components to edit their properties
4. Save your page for radio transmission

## 📡 Radio Integration

### Supported Radios

- **Icom**: IC-7300, IC-7610, IC-9700 (via USB/CI-V)
- **Yaesu**: FT-991A, FT-710, FT-DX101 (via USB CAT)
- **Kenwood**: TS-590, TS-890, TS-990 (via USB)

### Audio Interface

- **Web Audio API**: Browser-based QPSK modulation/demodulation
- **Adaptive Rates**: Automatic adjustment based on signal conditions
- **Adaptive Demodulation**: Signal quality-based optimization for improved performance

### Frequency Plan

- **HF Bands**: 40m, 20m, 15m, 10m (SSB frequencies)
- **VHF/UHF**: 2m, 70cm (FM frequencies)
- **Bandwidth**: 2.8 kHz maximum per FCC regulations

## 🗜️ Compression Technology

### Multi-Layer Compression

1. **JSX-to-Template**: React components compiled to 2-4 byte template IDs
2. **Dictionary Compression**: Ham radio terms compressed to single characters
3. **Browser Compression**: LZ77-style compression for large content
4. **Bandwidth Optimization**: Target 2KB page size for rapid transmission

### Compression Ratios

- **Typical Pages**: 85-95% size reduction
- **Template Reuse**: 97-99% reduction for templated content
- **Ham Radio Content**: 90-95% reduction using domain-specific dictionary

## 🌐 Mesh Networking

### AODV Protocol

- **Route Discovery**: Automatic path finding between stations
- **Multipath Support**: Load balancing across multiple routes
- **Message Queuing**: Basic offline message handling for disconnected operations
- **Visualization**: Real-time network topology display

### Network Features

- **Station Registry**: Automatic discovery and registration
- **QR Codes**: Quick connection establishment
- **Basic Queuing**: Limited message queuing for disconnected operations

## 🔒 Security & Compliance

### FCC Part 97 Compliance

- **No Content Encryption**: Only signatures for authenticity
- **Station Identification**: Automatic callsign insertion every 10 minutes
- **Bandwidth Limits**: Enforced 2.8 kHz maximum
- **Transmission Logging**: All RF activity logged with timestamps

### Cryptographic Features

- **Digital Signatures**: ECDSA using P-256 curve for message authenticity
- **Key Exchange**: ECDH for establishing secure channels (local network only)
- **Certificate Management**: Self-signed certificates with callsign verification

## 🧪 Testing

### Test Coverage

- **Unit Tests**: 70% coverage across core libraries
- **Integration Tests**: End-to-end testing of protocol stack
- **Contract Tests**: API compliance validation
- **Performance Tests**: Compression and bandwidth optimization

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests only
npm run test:integration
```

## 📁 Project Structure

```
src/
├── lib/                      # Core libraries (70% test coverage)
│   ├── compression/          # Browser-compatible compression ✅
│   ├── crypto/              # ECDSA/ECDH cryptography ✅
│   ├── database/            # IndexedDB wrapper ✅
│   ├── logbook/             # QSO logging ✅
│   ├── jsx-radio/           # React-to-radio renderer ✅
│   ├── mesh-networking/     # AODV routing ✅
│   ├── qpsk-modem/          # Adaptive QPSK modem ✅
│   ├── radio-control/       # CAT control ✅
│   ├── webrtc-transfer/     # P2P data transfer ✅
│   ├── qr-shortcode/        # Connection codes ✅
│   └── station-data/        # Data export/import ✅
├── components/              # React components
│   ├── PageBuilder/         # Visual builder components ✅
│   └── ui/                  # Base UI components ✅
├── pages/                   # Application pages
│   ├── PageBuilder.tsx      # Main visual builder ✅
│   └── ContentCreator.tsx   # Content management ✅
└── workers/                 # Service workers
```

## 🛠️ Development

### Commands

```bash
npm run dev              # Start Vite dev server
npm run dev:https        # Start with HTTPS for WebRTC
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checks
```

### Technologies

- **React 18**: Component-based UI with hooks
- **TypeScript 5**: Full type safety
- **Vite**: Fast development and building
- **IndexedDB**: Client-side persistence
- **Web APIs**: Serial, Audio, Crypto, WebRTC
- **Service Workers**: Offline functionality

## 📜 License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## 📞 Support

- **GitHub Issues**: Bug reports and feature requests
- **Amateur Radio**: QRZ.com or local repeaters
- **Email**: Technical questions and support

## 🏆 Amateur Radio Integration

This project is designed for and by amateur radio operators. All transmission features comply with FCC Part 97 regulations. The visual page builder makes it easy to create bandwidth-optimized content for efficient over-the-air transmission.

**73, and happy coding!** 📻