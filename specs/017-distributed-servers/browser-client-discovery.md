# Browser Client Discovery of Local Signaling Servers

## Overview
How browser-based PWA clients discover signaling servers on the local network without manual configuration, working within browser sandbox limitations.

## Browser Constraints

Browsers **CANNOT**:
- Send UDP broadcasts
- Use raw sockets
- Access mDNS directly
- Scan network ports systematically

Browsers **CAN**:
- Make HTTP/WebSocket requests to known endpoints
- Use WebRTC with ICE servers
- Try connections to localhost and local IPs
- Store discovered servers for future use

## Discovery Strategy for Browser Clients

### 1. Localhost Attempts
Try common localhost ports first (fastest):

```javascript
class BrowserSignalingDiscovery {
  async discoverLocalSignaling() {
    const discovered = [];

    // Try localhost first (most likely)
    const localhostServers = await this.tryLocalhost();
    discovered.push(...localhostServers);

    // Try local IP addresses
    const localIPServers = await this.tryLocalIPs();
    discovered.push(...localIPServers);

    // Try previously known servers
    const knownServers = await this.tryKnownServers();
    discovered.push(...knownServers);

    return discovered;
  }

  async tryLocalhost() {
    const commonPorts = [8080, 8081, 3000, 9090, 8888, 3333];
    const servers = [];

    for (const port of commonPorts) {
      // Try HTTP endpoint first (to check if server exists)
      try {
        const response = await fetch(`http://localhost:${port}/api/info`, {
          signal: AbortSignal.timeout(1000)
        });

        const info = await response.json();

        if (info.type === 'signaling' || info.capabilities?.includes('signaling')) {
          servers.push({
            url: `ws://localhost:${port}/signal`,
            type: 'signaling',
            discovered: 'localhost',
            info
          });
        }
      } catch {
        // Try WebSocket directly
        try {
          await this.testWebSocket(`ws://localhost:${port}/signal`);
          servers.push({
            url: `ws://localhost:${port}/signal`,
            type: 'signaling',
            discovered: 'localhost-ws'
          });
        } catch {
          // Not available
        }
      }
    }

    return servers;
  }

  async testWebSocket(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout'));
      }, 1000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Connection failed'));
      };
    });
  }
}
```

### 2. Local IP Discovery via WebRTC
Use WebRTC to discover local network IPs:

```javascript
class LocalIPDiscovery {
  async getLocalIPs() {
    const ips = new Set();

    // Create peer connection to gather candidates
    const pc = new RTCPeerConnection({
      iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
    });

    // Create data channel to trigger ICE gathering
    pc.createDataChannel('');

    // Gather local IPs from ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const parts = event.candidate.candidate.split(' ');
        if (parts[7] === 'host') {
          const ip = parts[4];
          if (this.isPrivateIP(ip)) {
            ips.add(ip);
          }
        }
      }
    };

    // Create offer to start gathering
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for gathering
    await new Promise(resolve => setTimeout(resolve, 2000));

    pc.close();
    return Array.from(ips);
  }

  isPrivateIP(ip) {
    return ip.startsWith('192.168.') ||
           ip.startsWith('10.') ||
           ip.startsWith('172.');
  }

  async tryLocalNetworkIPs() {
    const localIPs = await this.getLocalIPs();
    const servers = [];

    // Get network prefix (e.g., 192.168.1)
    for (const ip of localIPs) {
      const prefix = ip.substring(0, ip.lastIndexOf('.'));

      // Try common server IPs on same network
      const attempts = [
        `${prefix}.1`,   // Router often runs services
        `${prefix}.100`, // Common server IP
        `${prefix}.200`, // Common server IP
      ];

      for (const serverIP of attempts) {
        for (const port of [8080, 8081, 3000]) {
          try {
            await this.testEndpoint(`http://${serverIP}:${port}`);
            servers.push({
              url: `ws://${serverIP}:${port}/signal`,
              type: 'signaling',
              discovered: 'local-network'
            });
          } catch {
            // Not available
          }
        }
      }
    }

    return servers;
  }
}
```

### 3. Server-Assisted Discovery
Servers help clients discover other local servers:

```javascript
class ServerAssistedDiscovery {
  async discoverViaServer(knownServer) {
    try {
      // Ask known server about other local servers
      const response = await fetch(`${knownServer}/api/local-servers`);
      const { servers } = await response.json();

      return servers.map(s => ({
        url: s.signalingUrl,
        type: 'signaling',
        discovered: 'server-assisted',
        capabilities: s.capabilities
      }));
    } catch {
      return [];
    }
  }
}
```

### 4. QR Code / Manual Entry Fallback
When automatic discovery fails:

```javascript
class ManualDiscovery {
  async promptManualEntry() {
    // Show UI for manual server entry
    const modal = this.showDiscoveryModal();

    modal.innerHTML = `
      <h3>Connect to Local Server</h3>

      <div class="discovery-options">
        <!-- QR Code Scanner -->
        <button onclick="scanQRCode()">
          Scan QR Code
        </button>

        <!-- Manual Entry -->
        <input type="text"
               placeholder="Server address (e.g., 192.168.1.100:8080)"
               id="server-address">
        <button onclick="connectManual()">Connect</button>

        <!-- Common Addresses -->
        <div class="common-addresses">
          <p>Try these common addresses:</p>
          <button onclick="tryAddress('localhost:8080')">localhost:8080</button>
          <button onclick="tryAddress('localhost:3000')">localhost:3000</button>
        </div>
      </div>
    `;

    return modal.result;
  }

  async scanQRCode() {
    // Use camera to scan QR code containing server info
    const stream = await navigator.mediaDevices.getUserMedia({video: true});
    const serverInfo = await this.decodeQR(stream);
    return serverInfo;
  }
}
```

## Complete Discovery Flow

```javascript
class SignalingServerManager {
  async initialize() {
    // Step 1: Check cached/known servers
    const cached = await this.getCachedServers();
    if (cached.length > 0) {
      const alive = await this.pingServers(cached);
      if (alive.length > 0) {
        return this.connect(alive[0]);
      }
    }

    // Step 2: Auto-discovery attempts
    const discovered = await this.autoDiscover();
    if (discovered.length > 0) {
      await this.cacheServers(discovered);
      return this.connect(discovered[0]);
    }

    // Step 3: Manual configuration
    const manual = await this.promptManualConfig();
    if (manual) {
      await this.cacheServers([manual]);
      return this.connect(manual);
    }

    // Step 4: Offer to install local server
    return this.offerServerInstallation();
  }

  async autoDiscover() {
    // Try all automatic methods in parallel
    const promises = [
      this.discoverLocalhost(),
      this.discoverViaWebRTC(),
      this.discoverViaKnownPeers()
    ];

    const results = await Promise.allSettled(promises);
    const servers = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    return this.deduplicateServers(servers);
  }

  async connect(server) {
    this.ws = new WebSocket(server.url);

    this.ws.onopen = () => {
      console.log('Connected to signaling server:', server.url);
      this.onConnected(server);
    };

    this.ws.onerror = () => {
      console.error('Failed to connect:', server.url);
      this.tryNextServer();
    };

    return this.ws;
  }
}
```

## Server-Side Support

The local server binary should support discovery:

```javascript
// Server advertises itself for discovery
class SignalingServer {
  constructor() {
    this.app = express();
    this.setupDiscoveryEndpoints();
    this.advertiseMDNS();
  }

  setupDiscoveryEndpoints() {
    // Info endpoint for HTTP discovery
    this.app.get('/api/info', (req, res) => {
      res.json({
        type: 'signaling',
        version: '1.0',
        capabilities: ['signaling', 'webrtc', 'mesh'],
        callsign: this.config.callsign,
        signalingUrl: `ws://${this.getLocalIP()}:${this.port}/signal`
      });
    });

    // CORS for browser access
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST']
    }));

    // WebSocket endpoint
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/signal'
    });
  }

  advertiseMDNS() {
    // Advertise via mDNS (for native clients)
    mdns.advertise({
      name: 'Ham Radio Signaling',
      type: '_hamradio-signal._tcp',
      port: this.port,
      txt: {
        version: '1.0',
        capabilities: 'signaling,webrtc'
      }
    });
  }

  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }
}
```

## UI/UX Considerations

### Discovery Status Display
```javascript
class DiscoveryUI {
  showDiscoveryProgress() {
    const status = document.getElementById('connection-status');

    status.innerHTML = `
      <div class="discovery-progress">
        <h4>Finding Local Signaling Server...</h4>

        <div class="discovery-steps">
          <div class="step" id="step-localhost">
            <span class="spinner"></span>
            Checking localhost...
          </div>

          <div class="step" id="step-network">
            <span class="spinner"></span>
            Scanning local network...
          </div>

          <div class="step" id="step-cached">
            <span class="spinner"></span>
            Trying known servers...
          </div>
        </div>

        <button onclick="skipToManual()">
          Enter Server Manually
        </button>
      </div>
    `;
  }

  updateStep(stepId, status) {
    const step = document.getElementById(stepId);
    step.className = `step ${status}`; // 'checking', 'success', 'failed'
  }
}
```

## Performance Optimization

### Parallel Discovery with Timeout
```javascript
class OptimizedDiscovery {
  async discover() {
    // Race between timeout and discovery
    return Promise.race([
      this.tryAllMethods(),
      this.timeout(5000)
    ]);
  }

  async tryAllMethods() {
    // Try fastest methods first
    const methods = [
      { fn: () => this.tryLocalhost(), timeout: 1000 },
      { fn: () => this.tryCached(), timeout: 1000 },
      { fn: () => this.tryLocalNetwork(), timeout: 3000 }
    ];

    for (const method of methods) {
      try {
        const result = await Promise.race([
          method.fn(),
          this.timeout(method.timeout)
        ]);

        if (result) return result;
      } catch {
        continue;
      }
    }

    return null;
  }

  timeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
  }
}
```

## Caching and Persistence

```javascript
class ServerCache {
  async cacheDiscoveredServer(server) {
    const cached = await this.getCache();

    // Add with timestamp
    cached.push({
      ...server,
      lastSeen: Date.now(),
      successCount: 1
    });

    // Keep only recent/successful servers
    const filtered = cached
      .filter(s => Date.now() - s.lastSeen < 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 10);

    await localStorage.setItem('signaling-servers', JSON.stringify(filtered));
  }
}
```

## Summary

Browser clients discover local signaling servers through:
1. **Automatic attempts** to localhost and common ports
2. **WebRTC-based** local IP discovery
3. **Server-assisted** discovery from known servers
4. **Manual entry** or QR code as fallback
5. **Caching** successful connections for quick reconnection

This approach works within browser sandbox limitations while providing a seamless discovery experience for users.