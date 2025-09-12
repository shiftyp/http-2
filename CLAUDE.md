# Claude Code Context: HTTP Over Ham Radio

## Project Overview
Web application enabling HTTP communication over amateur radio networks using QPSK modulation and mesh routing.

## Architecture
- **Backend**: Node.js/Express API server with radio hardware integration
- **Frontend**: React web UI with bandwidth-optimized HTML
- **Radio Interface**: CAT control via serialport, audio via Web Audio API
- **Protocol**: HTTP/1.1 over QPSK modulation (2.8kHz bandwidth)
- **Mesh**: Store-and-forward HTTP requests with adaptive routing

## Key Technologies
- **Node.js 20 LTS** with TypeScript 5.x
- **Express.js** for backend API
- **React** for frontend (minimal JS, progressive enhancement)
- **SQLite** for metadata and routing tables
- **Web Audio API** for QPSK modulation/demodulation
- **node-serialport** for CAT radio control

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
backend/
├── src/
│   ├── models/       # Data models
│   ├── services/     # Business logic
│   ├── api/          # REST endpoints
│   └── lib/          # Core libraries
│       ├── radio-control/    # CAT interface
│       ├── qpsk-modem/      # Modulation
│       ├── mesh-router/     # Routing logic
│       └── cert-authority/  # PKI management
└── tests/

frontend/
├── src/
│   ├── components/   # React components
│   ├── pages/        # Route pages
│   └── services/     # API clients
└── tests/
```

## Testing Strategy
- **Contract tests** for all API endpoints
- **Integration tests** for radio hardware (test mode)
- **E2E tests** for user workflows
- **Performance tests** for bandwidth compliance

## Recent Changes
- Switched from Markdown to HTML for forms support
- Implemented ETag-based idempotency
- Added bandwidth policies for JS/CSS limiting
- Changed to request forwarding (not document forwarding)

## Common Commands
```bash
npm run backend:start    # Start API server
npm run frontend:start   # Start web UI
npm run radio:test      # Test radio connection
npm run mesh:status     # View mesh network
npm run test:integration # Run integration tests
```

## FCC Compliance Notes
- No encryption of content (only signatures)
- Station ID every 10 minutes
- Bandwidth limits per band
- All transmissions logged

## Performance Targets
- < 500ms transmission initiation
- 2.8 kHz maximum bandwidth
- Support 10+ concurrent mesh nodes
- 60% cache hit ratio target

---
*Context for AI assistance - Version 1.0*