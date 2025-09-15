# WebRTC Implementation Research with Native WebSocket Signaling

## 1. Native WebSocket Signaling Server Patterns

**Decision:** Use Node.js 'ws' library with room-based message routing and minimal dependencies

**Rationale:**
- The 'ws' library remains the preferred choice for Node.js WebRTC signaling in 2024
- Provides low-latency, full-duplex communication essential for WebRTC
- Lightweight with minimal dependencies beyond Node.js built-ins
- Mature ecosystem with proven production scalability
- Native WebSocket support in Node.js has been streamlined for 2024

**Alternatives Considered:**
- Socket.io: More features but adds unnecessary complexity and dependencies
- Native Node.js WebSocket: Limited functionality without additional libraries
- HTTP polling: Higher latency, not suitable for real-time signaling

**Implementation Pattern:**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Room-based routing for multi-peer support
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    // Route offer/answer/candidate messages between specific peers
    // Handle room join/leave for multi-station mesh
  });
});
```

## 2. WebRTC Peer Discovery: Local Network vs Internet Connectivity

**Decision:** Implement hybrid discovery with mDNS privacy enhancement and ICE fallback chain

**Rationale:**
- Modern browsers (2024) implement mDNS for privacy protection, using random names like "abc123.local" instead of exposing actual IP addresses
- Connection success rates show 75-80% success with direct connections (host + server-reflexive), 20-25% requiring relay
- Local network discovery provides lowest latency and highest bandwidth efficiency
- Internet connectivity requires STUN/TURN infrastructure for NAT traversal

**Alternatives Considered:**
- Local-only discovery: Limited to same subnet, no internet connectivity
- Internet-only with TURN: Higher latency and bandwidth costs
- Manual peer configuration: Poor user experience

**ICE Candidate Priority Order:**
1. Host candidates (local network) - highest priority, lowest latency
2. Server reflexive candidates (STUN) - internet connectivity via NAT traversal
3. Relay candidates (TURN) - fallback for restrictive firewalls

## 3. STUN Server Configuration and NAT Traversal Best Practices

**Decision:** Use multiple Google STUN servers with self-hosted TURN fallback for production

**Rationale:**
- Google STUN servers (stun.l.google.com:19302, stun1-4.l.google.com:19302) provide reliable, global coverage
- Multiple servers ensure redundancy and geographic distribution
- Free to use and maintained by Google infrastructure
- Combined STUN/TURN deployment ensures connectivity in 75-80% + 20-25% scenarios

**Alternatives Considered:**
- Managed services (Twilio, Metered): Higher cost but includes TURN (~$0.40/GB)
- Self-hosted Coturn: Complete control but requires infrastructure management
- STUN-only configuration: Insufficient for symmetric NAT scenarios

**Configuration Best Practices:**
```javascript
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:your-turn-server.com:3478",
    username: "ephemeral-user",
    credential: "ephemeral-token"
  }
];
```

## 4. Integration Patterns with Browser-Based Radio Control Systems

**Decision:** Service Worker coordination with Web Serial API and WebRTC data channels

**Rationale:**
- WebRTC not available in Service Workers, requiring window-scope implementation with ArrayBuffer transfer
- Web Serial API provides direct hardware communication for CAT control
- PWA capabilities enable offline functionality and cross-platform deployment
- Asynchronous design prevents UI blocking during serial communication

**Alternatives Considered:**
- Native applications: Better hardware access but loses web deployment benefits
- WebSocket-only communication: No direct hardware control capability
- Polling-based serial communication: Higher latency, less efficient

**Integration Architecture:**
- Main thread: WebRTC peer connections and Web Serial API communication
- Service Worker: Data persistence, offline caching, background sync
- Shared ArrayBuffer: Transfer audio/radio data between contexts
- RTCDataChannel: Real-time coordination between radio stations

## 5. Mock Testing Strategies for WebRTC in CI Environments

**Decision:** Jest-Puppeteer with Chrome headless flags and mock RTCPeerConnection

**Rationale:**
- Jest-Puppeteer provides real browser testing environment required for WebRTC APIs
- Chrome headless flags enable fake media streams without hardware dependencies
- Real browser context necessary for WebRTC functionality testing
- CI-friendly with efficient resource usage and parallel execution

**Alternatives Considered:**
- Pure Jest mocking: Insufficient for WebRTC integration testing
- Selenium WebDriver: More complex setup, slower execution
- Karma + real browsers: Higher resource requirements for CI

**Testing Configuration:**
```javascript
// jest-puppeteer.config.js
module.exports = {
  launch: {
    headless: process.env.HEADLESS !== "false",
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-running-insecure-content',
      '--disable-web-security'
    ]
  }
};
```

**Mock Strategy:**
- Use Chrome flags for fake getUserMedia streams
- Mock RTCPeerConnection with controlled state transitions
- Simulate network conditions with artificial latency/packet loss
- Test signaling server independently with WebSocket mocks

## Implementation Integration with Existing Codebase

The research findings align well with the current PWA library architecture:

- **WebRTC Transport Library:** Will integrate with existing `src/lib/` structure
- **Radio Control Integration:** Extends current Web Serial API implementation
- **Mesh Networking:** Maintains compatibility with existing AODV routing
- **HTTP Protocol Consistency:** Same URL structure across RF and WebRTC modes
- **FCC Compliance:** Preserves station identification and logging requirements

These patterns support the 1MB/s WebRTC target while maintaining 14.4kbps radio fallback capability for emergency communications compliance.