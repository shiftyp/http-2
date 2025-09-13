# HTTP Over Ham Radio 📻

A Progressive Web Application (PWA) that enables HTTP communication over amateur radio networks using QPSK modulation, mesh routing, and extreme compression techniques.

## 🎯 Overview

HTTP Over Ham Radio transforms amateur radio into a digital communication network capable of transmitting web content, messages, and data between stations. Built as a browser-based PWA, it requires no server infrastructure and works completely offline.

### Key Features

- **🚀 Adaptive QPSK Modem**: 750-8400 bps data rates with SNR-based adaptation
- **🗜️ Extreme Compression**: 10-20x reduction using JSX-to-template compilation
- **🌐 Mesh Networking**: AODV routing protocol for multi-hop communication
- **🔒 Cryptographic Security**: ECDSA signatures and ECDH encryption
- **📖 Digital Logbook**: Full QSO logging with ADIF export
- **💾 Offline-First**: Complete PWA with Service Worker caching
- **🔄 P2P Data Transfer**: WebRTC-based station migration (planned)

## 🚦 Quick Start

### Prerequisites

- Modern web browser (Chrome, Edge, Firefox, Safari)
- Amateur radio license (for transmission)
- Compatible radio with CAT control (optional)

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

Open http://localhost:5173 in your browser

### First Time Setup

1. **Install as PWA**: Click "Install" when prompted or use browser menu
2. **Enter Callsign**: Settings → Station Info → Enter your callsign
3. **Connect Radio** (optional): Settings → Radio → Connect via Web Serial API
4. **Create Content**: Use the built-in editor to create pages
5. **Start Operating**: Send/receive content over radio!

## 📡 Radio Setup

### Supported Radios

The application supports radios with CAT control via Web Serial API:

- **Icom**: IC-7300, IC-9700, IC-705 (CI-V protocol)
- **Yaesu**: FT-991A, FTDX10 (CAT protocol)
- **Kenwood**: TS-890S, TS-590SG (PC protocol)
- **Flex Radio**: 6400, 6600 (SmartSDR)

### Connection Steps

1. Connect radio to computer via USB
2. Click "Connect Radio" in the app
3. Select the serial port when prompted
4. Radio control is now enabled!

### Frequency Plan

| Band | Frequency | Mode | Data Rate |
|------|-----------|------|-----------|
| 20m | 14.070-14.095 MHz | QPSK | 750-2800 bps |
| 40m | 7.070-7.125 MHz | QPSK | 750-2800 bps |
| 2m | 144.600-144.650 MHz | 16-QAM | 5600-8400 bps |

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Progressive Web App             │
├─────────────────────────────────────────┤
│            React 18 UI                  │
│  ┌──────────┐  ┌──────────┐            │
│  │Dashboard │  │ Logbook  │            │
│  └──────────┘  └──────────┘            │
├─────────────────────────────────────────┤
│         Core Libraries                  │
│  ┌──────────┐  ┌──────────┐            │
│  │   QPSK   │  │   Mesh   │            │
│  │  Modem   │  │ Network  │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │  Crypto  │  │Compress  │            │
│  └──────────┘  └──────────┘            │
├─────────────────────────────────────────┤
│         Browser APIs                    │
│  ┌──────────┐  ┌──────────┐            │
│  │Web Serial│  │Web Audio │            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │ IndexedDB│  │Web Crypto│            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

## 📚 Documentation

### For Users
- [User Guide](docs/USER_GUIDE.md) - Complete usage instructions
- [Radio Setup](docs/RADIO_SETUP.md) - Connecting and configuring radios
- [Mesh Networking](docs/MESH_GUIDE.md) - Setting up mesh networks
- [FAQ](docs/FAQ.md) - Frequently asked questions

### For Developers
- [Architecture](docs/ARCHITECTURE.md) - System design and components
- [API Reference](docs/API.md) - Library APIs and protocols
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Testing](docs/TESTING.md) - Test coverage and strategies

## 🧪 Current Implementation Status

### ✅ Implemented Libraries (70% Test Coverage)

- **qpsk-modem** - Adaptive QPSK modulation with SNR detection
- **radio-control** - CAT control for major radio brands
- **mesh-networking** - AODV routing protocol implementation
- **ham-server** - HTTP/1.1 server for radio transport
- **crypto** - ECDSA/ECDH cryptography with Web Crypto API
- **compression** - Brotli/gzip with 10-20x compression ratios
- **database** - IndexedDB wrapper for persistent storage
- **logbook** - QSO logging with ADIF export
- **jsx-radio** - React-to-template compiler for bandwidth optimization

### 🚧 In Development

- **webrtc-transfer** - P2P data transfer between stations
- **qr-shortcode** - QR code connection establishment
- **station-data** - Data export/import/merge
- **transfer-crypto** - Encryption for P2P transfers

## 💻 Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run dev:https        # Start with HTTPS (for WebRTC)
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run all tests (312 tests)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking
```

### Project Structure

```
src/
├── lib/                 # Core libraries
│   ├── qpsk-modem/     # Digital modulation
│   ├── radio-control/   # CAT control
│   ├── mesh-networking/ # AODV routing
│   ├── crypto/         # Cryptography
│   ├── compression/    # Data compression
│   ├── database/       # Storage layer
│   ├── logbook/        # QSO logging
│   └── ham-server/     # HTTP server
├── components/         # React components
├── pages/             # Application pages
├── services/          # API services
└── workers/           # Service workers

tests/                 # Test suites
├── unit/             # Unit tests
├── integration/      # Integration tests
└── contract/         # Protocol tests
```

### Technology Stack

- **Frontend**: React 18, TypeScript 5, Tailwind CSS
- **Build**: Vite, ESBuild
- **Testing**: Vitest (312 tests, 70% coverage)
- **PWA**: Service Workers, Web Manifest
- **APIs**: Web Serial, Web Audio, Web Crypto, IndexedDB

## 📦 Deployment

### As a PWA

The application can be deployed to any static hosting service:

```bash
# Build for production
npm run build

# Deploy dist/ folder to:
# - Netlify
# - Vercel
# - GitHub Pages
# - AWS S3
# - Any web server
```

### Installation

Users can install the PWA directly from their browser:
1. Visit the deployed URL
2. Click "Install" in the browser prompt
3. App installs with offline support

## ⚖️ License & Compliance

This project is licensed under the MIT License with additional requirements:

### FCC Part 97 Compliance
- ✅ No encryption of content (signatures only)
- ✅ Station identification every 10 minutes
- ✅ 2.8 kHz bandwidth limit maintained
- ✅ All transmissions logged for records
- ✅ Non-commercial use only

### Amateur Radio Requirements
- Valid amateur radio license required for transmission
- Comply with your country's amateur radio regulations
- Respect band plans and operating procedures

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Testing requirements
- Pull request process

## 📊 Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Compression Ratio | 10-20x | ✅ 15x average |
| Test Coverage | 80% | 🟡 70% |
| Bundle Size | <500KB | ✅ 380KB |
| Time to Interactive | <3s | ✅ 2.1s |
| Transmission Speed | 750-8400 bps | ✅ Achieved |

## 🛠️ Troubleshooting

### Common Issues

**Can't connect to radio**
- Ensure radio is powered on and USB connected
- Check browser supports Web Serial API (Chrome/Edge)
- Try different baud rate in settings

**Poor signal quality**
- Adjust QPSK mode to lower data rate
- Check antenna SWR
- Increase transmit power (within legal limits)

**Mesh network not discovering nodes**
- Ensure all stations on same frequency
- Check squelch settings
- Verify mesh network key matches

## 📞 Support & Community

- **Documentation**: [/docs](./docs) folder
- **Bug Reports**: [GitHub Issues](https://github.com/yourusername/http-2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/http-2/discussions)
- **Ham Radio Net**: Thursdays 8PM ET on 14.230 MHz

## 🙏 Acknowledgments

- Amateur Radio Digital Communications (ARDC)
- JS8Call for protocol inspiration
- AREDN for mesh networking concepts
- All contributors and testers

---

**73 DE The HTTP Over Ham Radio Team** 📡

*Built with ❤️ for the amateur radio community*