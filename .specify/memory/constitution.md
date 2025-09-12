# HTTP-over-Radio Constitution

## Core Principles

### I. Amateur Radio First
All functionality must comply with FCC Part 97 regulations. Automatic identification required every 10 minutes. No business communications. Third-party traffic restrictions apply for non-control operator stations. 2024 rule changes: No symbol rate limits, 2.8 kHz bandwidth limit maintained.

### II. Progressive Web App Architecture  
Browser-first design with no backend dependencies. Service Worker for offline functionality. Web Serial API for radio control. IndexedDB for local storage. All libraries must work in browser environment without Node.js dependencies.

### III. Test-First Development (NON-NEGOTIABLE)
TDD mandatory: Tests written → User approved → Tests fail → Then implement. Red-Green-Refactor cycle strictly enforced. Unit tests, integration tests, and E2E tests required. GitHub Actions CI/CD pipeline validates all changes.

### IV. Compression-First Protocol Design
All transmissions must be optimized for limited bandwidth. Target 10-20x compression ratios. JSX-to-template compilation reduces React components to 2-4 byte template IDs. Delta updates for DOM changes only. Dictionary compression for ham radio terminology.

### V. Adaptive RF Performance
Automatic mode selection based on SNR: HTTP-11200 (16-QAM, 8.4 kbps) for SNR >20dB down to HTTP-1000 (QPSK, 750 bps) for SNR <0dB. AFC with pilot tone tracking. Convolutional encoding with Viterbi decoding.

## Technology Constraints

### Frequency Allocations
- Primary: 14.078.0 - 14.083.0 kHz (20m)
- Secondary: 7.043.0 - 7.048.0 kHz (40m), 21.078.0 - 21.083.0 kHz (15m)
- All modes: 2.8 kHz bandwidth maximum, no symbol rate limit (2024 FCC rules)

### Radio Compatibility
Support Icom (CI-V), Yaesu (CAT), Kenwood (PC), and Flex (SmartSDR) protocols via Web Serial API. PTT control required. Frequency, mode, and power monitoring. SWR protection.

### Performance Standards
- Target transmission time: <1 second for updates, <10 seconds for full pages
- Compression ratio: >80% for typical content
- Offline-first: All content cached locally
- PWA install support required

## Development Workflow

### Implementation Priority
1. Core libraries (crypto, compression, protocol, radio control)
2. Integration testing with mock radios
3. UI components and user workflows  
4. Real radio testing and field validation
5. Mesh networking and advanced features

### Quality Gates
- All TypeScript compilation must pass
- ESLint/Prettier formatting enforced
- 90%+ test coverage required
- Security audit passing (npm audit)
- Performance benchmarks met

### Code Organization
- `/src/lib/` - Core libraries (independently testable)
- `/src/components/` - React UI components
- `/src/pages/` - Page-level components
- `/tests/` - Test suites (unit, integration, E2E)
- `/docs/` - Technical documentation

## Governance

Constitution supersedes all other practices. Amendments require documentation, approval, and migration plan. All PRs must verify FCC compliance and performance standards. Complexity must be justified with compression/performance benefits.

**Version**: 1.0.0 | **Ratified**: 2025-01-12 | **Last Amended**: 2025-01-12