# HTTP-over-Radio

A Progressive Web Application (PWA) for transmitting web content over amateur radio frequencies using modern digital modes and mesh networking.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Quick Start](#quick-start)
4. [System Architecture](#system-architecture)
5. [Documentation](#documentation)
6. [Development](#development)
7. [Deployment](#deployment)
8. [License](#license)

## Overview

HTTP-over-Radio enables amateur radio operators to share web content over HF/VHF/UHF frequencies using efficient digital modulation schemes. The system implements a complete HTTP-like protocol stack optimized for narrow bandwidth channels while maintaining compatibility with modern web standards.

### Key Capabilities

- **Adaptive Data Rates**: 750 bps to 11.2 kbps using QPSK/16-QAM modulation
- **Extreme Compression**: 10-20x reduction using JSX-to-template compilation
- **Mesh Networking**: AODV routing protocol for multi-hop communication
- **Offline-First**: Complete PWA with Service Worker caching
- **Cryptographic Security**: ECDSA signatures for request authentication
- **Server Apps**: Sandboxed JavaScript execution for dynamic content

## Features

### Radio Communication
- **Digital Modes**: QPSK (750-5600 bps), 16-QAM (8400-11200 bps)
- **Bandwidth**: 2.8 kHz maximum (FCC compliant)
- **Error Correction**: Reed-Solomon FEC with interleaving
- **CAT Control**: Web Serial API integration for radio control

### Content Management
- **Content Types**: HTML, Markdown, JSX React components
- **Compression**: Custom JSX compiler with template substitution
- **Delta Updates**: Incremental content synchronization
- **Caching**: Progressive enhancement with Service Workers

### Networking
- **Mesh Protocol**: AODV (Ad hoc On-Demand Distance Vector)
- **Registration**: Winlink-style station discovery
- **Services**: RESTful API over radio
- **Security**: ECDSA signatures, encrypted payloads

### User Interface
- **Dashboard**: Real-time statistics and activity monitoring
- **Content Creator**: WYSIWYG editor with compression preview
- **Radio Operations**: Frequency control, signal monitoring
- **Station Browser**: Discover and connect to remote stations

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern web browser with Web Serial API support
- Amateur radio license (for transmission)
- Compatible radio with CAT control

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/http-over-radio.git
cd http-over-radio

# Install dependencies
npm install

# Start development server
npm run dev
```

### Initial Setup

1. Open http://localhost:3000 in your browser
2. Navigate to Settings and enter your callsign
3. Connect your radio via USB in Radio Operations
4. Create content in the Content Creator
5. Start transmitting!

## System Architecture

```
┌─────────────────────────────────────────────────┐
│                   Web Browser                    │
├─────────────────────────────────────────────────┤
│                   React PWA                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │Dashboard │  │ Content  │  │  Radio   │      │
│  │          │  │ Creator  │  │   Ops    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
├─────────────────────────────────────────────────┤
│              Service Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  HTTP    │  │   Mesh   │  │  Crypto  │      │
│  │ Protocol │  │  Network │  │  Manager │      │
│  └──────────┘  └──────────┘  └──────────┘      │
├─────────────────────────────────────────────────┤
│              Radio Interface                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Modem   │  │   CAT    │  │  Audio   │      │
│  │  Engine  │  │ Control  │  │   API    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
├─────────────────────────────────────────────────┤
│              Storage Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │IndexedDB │  │  Cache   │  │  Local   │      │
│  │          │  │   API    │  │ Storage  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

## Documentation

### Core Documentation
- [Technical Specification](docs/TECHNICAL_SPEC.md) - Complete system specification
- [API Reference](docs/API_REFERENCE.md) - HTTP-over-Radio protocol API
- [Frequency Plan](docs/FREQUENCY_PLAN.md) - Band plans and mode specifications
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Development setup and guidelines
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Production deployment instructions

### Component Documentation
- [Protocol Implementation](docs/components/PROTOCOL.md)
- [Compression System](docs/components/COMPRESSION.md)
- [Mesh Networking](docs/components/MESH.md)
- [Cryptography](docs/components/CRYPTO.md)
- [Server Apps](docs/components/SERVER_APPS.md)

## Development

### Project Structure

```
http-over-radio/
├── src/
│   ├── components/     # React UI components
│   ├── pages/          # Application pages
│   ├── lib/            # Core libraries
│   │   ├── radio/      # Radio control and modem
│   │   ├── http-protocol/ # HTTP protocol implementation
│   │   ├── mesh/       # Mesh networking
│   │   ├── compression/ # Content compression
│   │   ├── crypto/     # Cryptographic functions
│   │   └── database/   # IndexedDB wrapper
│   ├── App.tsx         # Main application
│   └── main.tsx        # Entry point
├── public/
│   └── service-worker.js # Service Worker
├── docs/               # Documentation
├── tests/              # Test suites
└── package.json        # Dependencies
```

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run test       # Run test suite
npm run lint       # Lint code
npm run typecheck  # TypeScript type checking
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Build**: Vite, SWC
- **State**: React Context, IndexedDB
- **PWA**: Service Workers, Web Manifest
- **APIs**: Web Serial, Web Audio, Web Crypto
- **Testing**: Vitest, Playwright

## Deployment

### Building for Production

```bash
# Build the application
npm run build

# Preview the build
npm run preview
```

### Deployment Options

1. **Static Hosting** (Netlify, Vercel, GitHub Pages)
   - Upload `dist/` folder
   - Configure HTTPS
   - Set up custom domain

2. **Self-Hosted**
   - Serve `dist/` with nginx/Apache
   - Configure SSL certificates
   - Set up reverse proxy if needed

3. **Docker**
   ```bash
   docker build -t http-over-radio .
   docker run -p 8080:80 http-over-radio
   ```

### Configuration

Environment variables (`.env`):
```env
VITE_APP_TITLE=HTTP-over-Radio
VITE_DEFAULT_FREQUENCY=14230000
VITE_DEFAULT_MODE=QPSK
VITE_MESH_ENABLED=true
```

## License

This project is licensed under the MIT License with additional terms for amateur radio use:

1. Transmission requires valid amateur radio license
2. No encryption of message content (signatures allowed)
3. Station identification required per FCC Part 97
4. Non-commercial use only

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@example.com

## Acknowledgments

- Amateur Radio Community
- ARRL (American Radio Relay League)
- Open source contributors

---

**73 DE [Your Callsign]**