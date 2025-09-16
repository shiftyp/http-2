# Implementation Architecture: PWA-Distributed Server System

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         PWA (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   UI/React   │  │ License Mgmt │  │  Server Control │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            │                                 │
│                     WebSocket (localhost:8081)               │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                   Local Server Binary                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ HTTP Server  │  │ mDNS Service │  │  RF Gateway     │   │
│  │   Port 8080  │  │   Discovery  │  │  Serial/Audio   │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────┴────────┬──────────────┐
                    │                 │              │
              Local Network      RF Network    Internet (optional)
```

## Component Specifications

### 1. PWA Components

#### Server Manager (`/src/lib/server-manager/`)
```typescript
interface ServerManager {
  // Check if server is installed/running
  checkServerStatus(): Promise<ServerStatus>;

  // Download appropriate binary
  downloadServer(platform: Platform): Promise<void>;

  // Connect to running server
  connectToServer(): Promise<WebSocket>;

  // Server control commands
  startServer(): Promise<void>;
  stopServer(): Promise<void>;

  // Get server metrics
  getServerStats(): Promise<ServerStats>;
}
```

#### License Validator (`/src/lib/license-validator/`)
```typescript
interface LicenseValidator {
  // Verify amateur radio license
  verifyLicense(callsign: string): Promise<boolean>;

  // Store validated license
  storeLicenseProof(certificate: Certificate): Promise<void>;

  // Check if user can run server
  canRunServer(): Promise<boolean>;

  // Get license class/privileges
  getLicenseClass(): Promise<LicenseClass>;
}
```

#### Binary Assets (`/public/server-binaries/`)
```
server-binaries/
├── windows/
│   └── ham-server-x64.exe (5MB)
├── darwin/
│   ├── ham-server-x64 (4MB)
│   └── ham-server-arm64 (4MB)
└── linux/
    ├── ham-server-x64 (4MB)
    └── ham-server-arm64 (4MB)
```

### 2. Local Server Implementation

#### Core Server (`server/main.js`)
```javascript
class HamRadioServer {
  constructor(config) {
    this.httpServer = new HTTPServer(config.httpPort);
    this.wsServer = new WebSocketServer(config.wsPort);
    this.mdnsService = new MDNSService(config.callsign);
    this.rfGateway = new RFGateway(config.radioPort);
    this.contentStore = new ContentStore(config.dataDir);
  }

  async start() {
    // Verify license is still valid
    await this.verifyLicense();

    // Start HTTP server for content
    await this.httpServer.listen();

    // Start WebSocket for PWA communication
    await this.wsServer.listen();

    // Announce presence on local network
    await this.mdnsService.announce();

    // Connect to radio if available
    await this.rfGateway.connect();
  }
}
```

#### HTTP Server Features
- Serves content on configurable port (default 8080)
- RESTful API for content management
- Static file serving for cached pages
- WebDAV support for content sync
- CORS configured for PWA access

#### mDNS Discovery Service
- Broadcasts `_hamradio._tcp` service
- Includes callsign and capabilities
- Discovers other servers on LAN
- Falls back to RF discovery if needed

#### RF Gateway
- Bridges HTTP requests to/from RF
- Manages radio CAT control
- Handles QPSK modulation
- Queues and prioritizes transmissions

### 3. Installation Flow

```javascript
// PWA Installation Flow
async function installServer() {
  // Step 1: Check license
  const hasLicense = await licenseValidator.verifyLicense(userCallsign);
  if (!hasLicense) {
    showError("Valid amateur radio license required");
    return;
  }

  // Step 2: Detect platform
  const platform = detectPlatform(); // windows|darwin|linux

  // Step 3: Get binary from PWA assets
  const binaryPath = `/server-binaries/${platform}/ham-server`;
  const response = await fetch(binaryPath);
  const binaryBlob = await response.blob();

  // Step 4: Verify binary integrity
  const hash = await crypto.subtle.digest('SHA-256', binaryBlob);
  if (!verifyBinaryHash(hash, platform)) {
    showError("Binary integrity check failed");
    return;
  }

  // Step 5: Trigger download
  const a = document.createElement('a');
  a.href = URL.createObjectURL(binaryBlob);
  a.download = `ham-server${platform === 'windows' ? '.exe' : ''}`;
  a.click();

  // Step 6: Show execution instructions
  showInstructions(platform);

  // Step 7: Start polling for connection
  pollForServerConnection();
}
```

### 4. Communication Protocol

#### PWA ↔ Server WebSocket Messages
```typescript
// PWA → Server
interface PWAMessage {
  type: 'STATUS' | 'START' | 'STOP' | 'CONFIG' | 'CONTENT';
  payload: any;
  callsign: string;
  timestamp: number;
}

// Server → PWA
interface ServerMessage {
  type: 'STATUS' | 'PEERS' | 'CONTENT' | 'RF_ACTIVITY' | 'ERROR';
  payload: any;
  timestamp: number;
}
```

### 5. Content Synchronization

#### Mesh Content Protocol
```javascript
class ContentSync {
  async syncWithPeers() {
    // Get list of peers from mDNS
    const peers = await this.mdnsService.getPeers();

    // Exchange content catalogs
    for (const peer of peers) {
      const catalog = await this.exchangeCatalog(peer);
      await this.syncMissingContent(catalog, peer);
    }

    // Announce new content via RF
    if (this.rfGateway.isConnected()) {
      await this.rfGateway.broadcastCatalog();
    }
  }
}
```

### 6. Offline Operation

#### Internet Failure Detection
```javascript
class NetworkMonitor {
  async checkConnectivity() {
    const checks = [
      fetch('https://dns.google/resolve?name=google.com'),
      fetch('https://1.1.1.1/dns-query'),
      fetch('https://cloudflare-dns.com/dns-query')
    ];

    try {
      await Promise.race(checks);
      return 'ONLINE';
    } catch {
      return 'OFFLINE';
    }
  }

  onOffline() {
    // Switch to distributed mode
    this.server.enableDistributedMode();
    this.mdnsService.increaseBeaconRate();
    this.rfGateway.enableMeshRouting();
  }
}
```

### 7. Security Implementation

#### Binary Signing
```bash
# Build process signs binaries
codesign --sign "Developer ID" ham-server-darwin
signtool sign /fd SHA256 ham-server-windows.exe
gpg --detach-sign ham-server-linux
```

#### Certificate Verification
```javascript
class CertificateVerifier {
  async verify(certificateFile) {
    // Parse the certificate
    const cert = await this.parseCertificate(certificateFile);

    // Verify certificate chain
    const chainValid = await this.verifyCertificateChain(cert);
    if (!chainValid) return false;

    // Check trusted roots (LOTW, ARRL, etc.)
    const trustedRoot = await this.checkTrustedRoot(cert.issuer);
    if (!trustedRoot) return false;

    // Verify certificate hasn't expired
    if (cert.validTo < Date.now()) return false;

    // Extract and validate amateur radio extensions
    const callsign = cert.subject.CN || cert.extensions.callsign;
    const licenseClass = cert.extensions.licenseClass;

    // Store for offline verification
    await this.storeCertificate(cert);

    return { valid: true, callsign, licenseClass };
  }

  // Trusted root certificates embedded in PWA
  getTrustedRoots() {
    return [
      'ARRL LOTW Root CA',
      'RSGB Certificate Authority',
      'Amateur Radio Digital Communications Root',
      // Additional trusted authorities
    ];
  }
}
```

## Deployment Strategy

### PWA Build Process
1. Include server binaries in build
2. Generate integrity hashes
3. Create platform detection logic
4. Bundle license verification

### Server Binary Build
1. Cross-compile for all platforms
2. Static linking for portability
3. Minimize dependencies
4. Sign all binaries

### Distribution
- PWA served over HTTPS
- Binaries included as static assets
- CDN distribution for fast downloads
- Fallback mirrors for reliability

## Testing Requirements

### Unit Tests
- License validation logic
- Platform detection
- Binary integrity verification
- Server communication protocol

### Integration Tests
- Full installation flow
- Server startup/shutdown
- PWA-server communication
- mDNS discovery
- RF gateway operation

### End-to-End Tests
- Complete distributed mode operation
- Internet failure handling
- Multi-peer synchronization
- Content routing through mesh

## Performance Targets

- Server startup: < 2 seconds
- PWA connection: < 500ms
- mDNS discovery: < 5 seconds
- Content sync: < 10KB/s overhead
- HTTP response: < 100ms local
- RF gateway: 14.4kbps throughput