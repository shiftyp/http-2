# Distributed Servers - Specification Clarifications

## 1. Server Binary Distribution

### 1a. Size Constraints
- **PWA Bundle**: Total PWA size should remain under 50MB for fast initial load
- **Per-Binary Size**: Each platform binary ~5-10MB compressed
- **Total Binary Payload**: ~20-30MB for all platforms (Windows, macOS, Linux x64/arm64)

### 1b. Bundled Architecture
```javascript
// PWA structure with embedded binaries
/public/
  /server-binaries/
    /windows/
      server.exe          // ~8MB - Windows executable
    /darwin/
      server-x64         // ~7MB - macOS Intel
      server-arm64       // ~7MB - macOS Apple Silicon
    /linux/
      server-x64         // ~6MB - Linux x64
      server-arm64       // ~6MB - Linux ARM

// Server binary references PWA code
server.exe --pwa-path="http://localhost:3000"
```

The server binary is minimal - it provides:
- HTTP server capabilities
- WebSocket signaling
- SQLite database
- Certificate management
- mDNS advertisement

The PWA provides all application logic, UI, and radio functionality.

### 1c. Update Mechanism
```javascript
class BinaryUpdater {
  async checkForUpdates() {
    // Check PWA version
    const pwaVersion = await this.getPWAVersion();

    // Check binary version
    const binaryVersion = await fetch('http://localhost:8080/api/version');

    if (pwaVersion.binaryRequired > binaryVersion.current) {
      this.promptBinaryUpdate();
    }
  }

  promptBinaryUpdate() {
    // Show update notification
    this.ui.showNotification(
      'New server version available. Download and restart server for latest features.'
    );
  }
}
```

## 2. Certificate Authority Hierarchy

### 2a. No Maximum Chain Depth
- Chain depth unlimited in theory
- Practical limit ~10 levels for performance
- Each certificate includes full chain for verification

### 2b. Any Licensed Operator Can Be CA
```javascript
class CertificateAuthority {
  canIssue(operator) {
    // Any valid certificate holder can issue
    return operator.certificate.valid === true;
  }

  // No license class restrictions
  // Technician can issue to Extra
  // Extra can issue to Technician
  // Trust is established by chain, not class
}
```

### 2c. Certificate Blacklisting
```javascript
class CertificateBlacklist {
  constructor() {
    this.localBlacklist = new Set();
  }

  blacklist(certificateFingerprint, reason) {
    this.localBlacklist.add({
      fingerprint: certificateFingerprint,
      reason,
      timestamp: Date.now(),
      blacklistedBy: this.station.callsign
    });

    // Store in SQLite
    this.db.run(
      'INSERT INTO blacklist (fingerprint, reason, timestamp) VALUES (?, ?, ?)',
      [certificateFingerprint, reason, Date.now()]
    );
  }

  isBlacklisted(certificate) {
    return this.localBlacklist.has(certificate.fingerprint);
  }

  // Each station maintains its own blacklist
  // Not propagated to other stations
  // Local decision only
}
```

## 3. Server Persistence

### 3a. Stateless Server Design
```javascript
class StatelessServer {
  constructor() {
    // Only temporary runtime state
    this.activeConnections = new Map();    // Current WebSocket connections
    this.pendingOffers = new Map();        // WebRTC offers awaiting answers

    // Persistent state in SQLite only
    this.db = new SQLite('./server.db');
  }

  // No application state stored
  // PWA maintains all user data
  // Server is just a relay and certificate store
}
```

### 3b. SQLite Database Structure
```sql
-- Embedded SQLite database
CREATE TABLE certificates (
  fingerprint TEXT PRIMARY KEY,
  certificate BLOB,
  issuer_chain TEXT,
  added_date INTEGER,
  last_seen INTEGER
);

CREATE TABLE blacklist (
  fingerprint TEXT PRIMARY KEY,
  reason TEXT,
  timestamp INTEGER
);

CREATE TABLE peer_servers (
  endpoint TEXT PRIMARY KEY,
  callsign TEXT,
  last_contact INTEGER,
  capabilities TEXT
);
```

### 3c. Certificate Distribution
```javascript
class CertificateDistribution {
  // Certificates distributed to clients for verification
  async getCertificateBundle() {
    return {
      trusted: await this.db.all('SELECT * FROM certificates'),
      blacklisted: await this.db.all('SELECT fingerprint FROM blacklist'),
      timestamp: Date.now()
    };
  }

  // No backup needed - certificates are distributed
  // Clients cache certificates locally
  // Rebuild trust from network if server lost
}
```

## 4. Multi-Station Scenarios

### 4a. Server Coordination
```javascript
class ServerCoordination {
  async addCoordinatingServer(endpoint) {
    // Connect to another server
    const ws = new WebSocket(`${endpoint}/coordinate`);

    ws.onopen = async () => {
      // Exchange certificate lists
      const myCerts = await this.getCertificates();
      ws.send(JSON.stringify({
        type: 'CERT_SYNC',
        certificates: myCerts
      }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'CERT_SYNC') {
        // Merge certificate lists
        await this.mergeCertificates(msg.certificates);
      }
    };
  }

  async discoverCoordinatingServers() {
    // Method 1: Manual entry
    // Method 2: Discovery via signaling servers
    // Method 3: CQ message announcements

    const servers = await this.findServers();
    for (const server of servers) {
      await this.addCoordinatingServer(server.endpoint);
    }
  }

  async mergeCertificates(remoteCerts) {
    for (const cert of remoteCerts) {
      // Verify certificate chain
      if (await this.verifyCertificate(cert)) {
        // Add to local database
        await this.addCertificate(cert);
      }
    }
  }
}
```

### 4b. Server Handoff
- Not applicable - just create new server instance

### 4c. Certificate Expiry
- Certificates have no expiry date
- Trust based on chain validation only
- Revocation via blacklisting

## 5. Network Conflicts

### 5a. Port Selection
```javascript
class PortSelector {
  async findAvailablePort() {
    const preferredPorts = [8080, 8081, 8082, 3000, 3001, 3002];

    for (const port of preferredPorts) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }

    // Random port if all preferred taken
    return this.getRandomPort(8000, 9000);
  }

  async isPortAvailable(port) {
    try {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.listen(port, () => {
          server.close();
          resolve(true);
        });
        server.on('error', reject);
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### 5b. Multiple Server Coordination
```javascript
class ClientServerList {
  constructor() {
    // Clients maintain ordered list of servers
    this.servers = [
      { url: 'ws://server1.local:8080', priority: 1 },
      { url: 'ws://server2.local:8081', priority: 2 },
      { url: 'ws://server3.local:8082', priority: 3 }
    ];
  }

  async connect() {
    // Try servers in priority order
    for (const server of this.servers.sort((a, b) => a.priority - b.priority)) {
      try {
        await this.connectToServer(server.url);
        return server;
      } catch {
        continue; // Try next server
      }
    }
  }
}
```

### 5c. Server Authentication
- Certificate signing prevents impersonation
- Same as SSL/TLS - cryptographic proof of identity
- Clients verify server certificate chain

## 6. WebRTC Signaling Details

### 6a. Signaling Only
```javascript
class SignalingRelay {
  // Server only relays signaling messages
  // No media/data relay

  handleMessage(from, message) {
    switch (message.type) {
      case 'OFFER':
      case 'ANSWER':
      case 'ICE_CANDIDATE':
        // Just forward to target peer
        this.forwardToPeer(message.target, {
          from: from,
          ...message
        });
        break;
    }
  }

  // All actual data transfer is P2P
  // Server bandwidth minimal
}
```

### 6b. Connection Limits
```javascript
class ConnectionManager {
  // No hard limit - scale based on resources
  // Typical capacity: 100-1000 concurrent connections
  // Each connection uses ~10KB memory
  // CPU usage minimal (just message relay)

  getCapacity() {
    const memoryAvailable = os.freemem();
    const connectionsSupported = Math.floor(memoryAvailable / (10 * 1024));
    return Math.min(connectionsSupported, 10000); // Soft cap at 10k
  }
}
```

### 6c. Fallback Mechanisms
```javascript
class TransferFallback {
  async transfer(data, peer) {
    try {
      // Try 1: Direct P2P via WebRTC
      return await this.webrtcTransfer(data, peer);
    } catch {
      try {
        // Try 2: Direct HTTP download
        return await this.directDownload(data, peer);
      } catch {
        // Try 3: Server relay (with rate limiting)
        return await this.serverRelay(data, peer);
      }
    }
  }

  async serverRelay(data, peer) {
    // Rate limited to prevent DDOS
    const rateLimit = this.getRateLimit(peer);

    if (rateLimit.remaining <= 0) {
      throw new Error('Rate limit exceeded');
    }

    // Relay through server with chunking
    return this.chunkedRelay(data, peer, rateLimit.bytesPerSecond);
  }
}
```

## 7. Content Synchronization

### 7a. Direct Connection Only
```javascript
class ContentSync {
  async syncWithPeer(peer) {
    // All sync via direct connection
    const connection = await this.establishDirectConnection(peer);

    // Exchange content catalogs
    const myCatalog = await this.getContentCatalog();
    const peerCatalog = await connection.send('GET_CATALOG');

    // Verify all content with signatures
    for (const item of peerCatalog) {
      if (!this.hasContent(item) && await this.verifySignature(item)) {
        await this.requestContent(connection, item);
      }
    }
  }

  async verifySignature(content) {
    // Verify content signed by trusted certificate
    return crypto.verify(
      content.signature,
      content.data,
      content.certificate
    );
  }
}
```

## 8. Offline Operation

### 8a. Indefinite Offline Operation
- Server designed for permanent offline use
- No internet dependency after initial setup
- All features work via local network and RF

### 8b. Local Certificate Store
```javascript
class LocalCertificateStore {
  constructor() {
    this.db = new SQLite('./certificates.db');
    this.initializeDatabase();
  }

  async initializeDatabase() {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS certificates (
        fingerprint TEXT PRIMARY KEY,
        certificate BLOB,
        chain TEXT,
        added_date INTEGER
      )
    `);
  }
}
```

### 8c. Time Synchronization
```javascript
class TimeSync {
  async synchronize() {
    // Option 1: GPS time from radio
    const gpsTime = await this.getGPSTime();
    if (gpsTime) return this.setSystemTime(gpsTime);

    // Option 2: Consensus time from peers
    const peerTimes = await this.getPeerTimes();
    if (peerTimes.length >= 3) {
      const consensusTime = this.calculateMedianTime(peerTimes);
      return this.setSystemTime(consensusTime);
    }

    // Option 3: Manual time entry
    return this.promptManualTime();
  }

  async getPeerTimes() {
    const times = [];
    for (const peer of this.connectedPeers) {
      const response = await peer.send('GET_TIME');
      times.push({
        peer: peer.id,
        time: response.time,
        latency: response.latency
      });
    }
    return times;
  }
}
```

## 9. Security Boundaries

### 9a. Read-Only Access
```javascript
class AccessControl {
  getPermissions(client) {
    if (!client.certificate) {
      // Unlicensed users: read-only
      return {
        canRead: true,
        canWrite: false,
        canIssue: false,
        canRelay: false
      };
    }

    // Licensed operators: full access
    return {
      canRead: true,
      canWrite: true,
      canIssue: true,
      canRelay: true
    };
  }
}
```

### 9b. Signaling Abuse Prevention
```javascript
class AbuseProtection {
  constructor() {
    this.connectionAttempts = new Map();
    this.messageRates = new Map();
  }

  checkConnectionRate(ip) {
    const attempts = this.connectionAttempts.get(ip) || 0;

    if (attempts > 10) {
      // Block after 10 failed attempts
      return false;
    }

    this.connectionAttempts.set(ip, attempts + 1);

    // Reset counter after 1 hour
    setTimeout(() => {
      this.connectionAttempts.delete(ip);
    }, 3600000);

    return true;
  }

  checkMessageRate(clientId) {
    const rate = this.messageRates.get(clientId) || { count: 0, reset: Date.now() + 60000 };

    if (Date.now() > rate.reset) {
      // Reset rate limit every minute
      rate.count = 0;
      rate.reset = Date.now() + 60000;
    }

    if (rate.count > 100) {
      // Max 100 messages per minute
      return false;
    }

    rate.count++;
    this.messageRates.set(clientId, rate);
    return true;
  }
}
```

### 9c. Rate Limiting
```javascript
class RateLimiter {
  constructor() {
    this.limits = {
      connections: { max: 10, window: 60000 },    // 10 per minute
      messages: { max: 100, window: 60000 },      // 100 per minute
      bandwidth: { max: 1048576, window: 1000 }   // 1MB per second
    };
  }

  async checkLimit(type, identifier) {
    const limit = this.limits[type];
    const key = `${type}:${identifier}`;
    const current = await this.getCount(key);

    if (current >= limit.max) {
      return false;
    }

    await this.increment(key, limit.window);
    return true;
  }
}
```

## 10. Platform-Specific Issues

### 10a. Windows Firewall
```markdown
## Windows Firewall Instructions

When first running the server, Windows will show a firewall prompt.

To allow the server:
1. Check "Private networks"
2. Check "Public networks" (if on public WiFi)
3. Click "Allow access"

If you missed the prompt:
1. Open Windows Defender Firewall
2. Click "Allow an app"
3. Browse to server.exe
4. Check both network types
5. Click OK
```

### 10b. macOS Terminal Execution
```bash
# Yes, run directly from Terminal without packaging

# Make executable
chmod +x server-darwin-x64

# Run server (will prompt for network access permission)
./server-darwin-x64

# If blocked by Gatekeeper:
# Right-click → Open → Open
# OR
xattr -d com.apple.quarantine server-darwin-x64
```

### 10c. Linux Service Installation
```bash
# Manual systemd service setup

# 1. Create service file
sudo nano /etc/systemd/system/ham-radio-server.service

# 2. Add configuration:
[Unit]
Description=Ham Radio Signaling Server
After=network.target

[Service]
Type=simple
User=hamradio
ExecStart=/opt/ham-radio/server-linux-x64
Restart=always

[Install]
WantedBy=multi-user.target

# 3. Enable and start
sudo systemctl enable ham-radio-server
sudo systemctl start ham-radio-server

# 4. Check status
sudo systemctl status ham-radio-server
```

## Summary

The distributed server system is designed to be:
- **Stateless**: Minimal server state, just certificates and connections
- **Resilient**: Operates forever offline
- **Flexible**: Multiple servers coordinate, any port works
- **Secure**: Certificate-based trust, rate limiting
- **Simple**: Binary + PWA, no complex configuration