# CQ-Based Server Announcement Protocol

## Overview
Server discovery announcements are integrated into the standard CQ (calling any station) propagation mechanism, allowing servers to advertise their presence and signaling capabilities during normal ham radio operations.

## CQ Message Format with Server Info

### Standard CQ Format
```
CQ CQ CQ de [CALLSIGN] [CALLSIGN] [CALLSIGN] K
```

### Enhanced CQ with Server Announcement
```javascript
{
  type: "CQ",
  callsign: "W1AW",
  grid: "FN31",

  // Server announcement extension
  server: {
    available: true,
    endpoint: "192.168.1.100:8080",
    signaling: {
      enabled: true,
      protocol: "ws",
      path: "/signal"
    },
    capabilities: ["http", "signaling", "ca", "mesh"],
    certFingerprint: "a1b2c3d4", // First 8 chars
    contentCatalog: {
      pages: 42,
      totalSize: "125KB",
      lastUpdate: "2025-01-16T10:00:00Z"
    }
  }
}
```

## Integration with Existing CQ Protocol

### Modified CQ Beacon
```javascript
class CQServerBeacon {
  constructor(station) {
    this.station = station;
    this.serverInfo = null;

    // Check if local server is running
    this.checkLocalServer();
  }

  async checkLocalServer() {
    try {
      const response = await fetch('http://localhost:8080/api/status');
      if (response.ok) {
        this.serverInfo = await response.json();
      }
    } catch {
      this.serverInfo = null;
    }
  }

  generateCQMessage() {
    const baseMessage = {
      type: "CQ",
      callsign: this.station.callsign,
      grid: this.station.gridSquare,
      timestamp: Date.now()
    };

    // Add server info if server is running
    if (this.serverInfo) {
      baseMessage.server = {
        available: true,
        endpoint: this.getAccessibleEndpoint(),
        signaling: this.getSignalingInfo(),
        capabilities: this.serverInfo.capabilities,
        certFingerprint: this.serverInfo.certFingerprint.substring(0, 8)
      };

      // Add content catalog summary
      if (this.serverInfo.content) {
        baseMessage.server.contentCatalog = {
          pages: this.serverInfo.content.pageCount,
          totalSize: this.formatSize(this.serverInfo.content.totalBytes),
          lastUpdate: this.serverInfo.content.lastModified
        };
      }
    }

    return baseMessage;
  }

  getAccessibleEndpoint() {
    // Provide local network IP if available
    const localIP = this.serverInfo.localIP;

    if (localIP && localIP !== '127.0.0.1') {
      return `${localIP}:${this.serverInfo.port}`;
    }

    // Fallback to hostname
    return `${this.station.callsign.toLowerCase()}.local:${this.serverInfo.port}`;
  }

  getSignalingInfo() {
    if (this.serverInfo.signaling) {
      return {
        enabled: true,
        protocol: this.serverInfo.signaling.protocol || 'ws',
        path: this.serverInfo.signaling.path || '/signal'
      };
    }
    return { enabled: false };
  }
}
```

## CQ Propagation with Server Discovery

### Mesh Network Propagation
```javascript
class CQPropagation {
  async propagateCQ(cqMessage) {
    // Standard CQ propagation
    await this.transmitCQ(cqMessage);

    // If server info included, update local directory
    if (cqMessage.server) {
      await this.updateServerDirectory(cqMessage);
    }

    // Forward to mesh network
    await this.forwardToMesh(cqMessage);
  }

  async updateServerDirectory(cqMessage) {
    const serverEntry = {
      callsign: cqMessage.callsign,
      endpoint: cqMessage.server.endpoint,
      signaling: cqMessage.server.signaling,
      capabilities: cqMessage.server.capabilities,
      lastHeard: Date.now(),
      signalStrength: this.getSignalStrength(),
      distance: this.calculateDistance(cqMessage.grid),
      certificate: cqMessage.server.certFingerprint
    };

    // Store in local server directory
    await this.serverDirectory.add(serverEntry);

    // If signaling available, try to establish connection
    if (serverEntry.signaling.enabled) {
      await this.trySignalingConnection(serverEntry);
    }
  }

  async trySignalingConnection(serverEntry) {
    // Build WebSocket URL
    const wsUrl = `ws://${serverEntry.endpoint}${serverEntry.signaling.path}`;

    try {
      // Test connection
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`Signaling server discovered via CQ: ${serverEntry.callsign}`);
        this.addToSignalingServers(serverEntry);
        ws.close();
      };

      ws.onerror = () => {
        // Can't reach via IP, might need RF relay
        this.markAsRFOnly(serverEntry);
      };
    } catch {
      // Server not reachable directly
    }
  }
}
```

## Client Discovery via CQ

### Browser Client Monitoring
```javascript
class CQMonitor {
  constructor(rfReceiver) {
    this.rfReceiver = rfReceiver;
    this.discoveredServers = new Map();
  }

  startMonitoring() {
    // Listen for CQ messages with server announcements
    this.rfReceiver.on('cq', (message) => {
      if (message.server && message.server.available) {
        this.processServerAnnouncement(message);
      }
    });

    // Also listen for dedicated server beacons
    this.rfReceiver.on('beacon', (beacon) => {
      if (beacon.type === 'SERVER_ANNOUNCE') {
        this.processServerBeacon(beacon);
      }
    });
  }

  async processServerAnnouncement(cqMessage) {
    const server = {
      callsign: cqMessage.callsign,
      discovered: 'cq-propagation',
      timestamp: Date.now(),
      ...cqMessage.server
    };

    // Add to discovered list
    this.discoveredServers.set(server.callsign, server);

    // Try to connect if on same network
    if (await this.isLocalNetwork(server.endpoint)) {
      await this.attemptConnection(server);
    } else {
      // Mark for RF relay
      server.requiresRelay = true;
    }

    // Update UI
    this.updateServerList();
  }

  async isLocalNetwork(endpoint) {
    const [ip] = endpoint.split(':');

    // Check if IP is in local network range
    return ip.startsWith('192.168.') ||
           ip.startsWith('10.') ||
           ip.startsWith('172.') ||
           ip.includes('.local');
  }
}
```

## Bandwidth-Efficient Encoding

### Compressed Server Announcement
```javascript
class CompressedAnnouncement {
  encode(serverInfo) {
    // Use bit flags for capabilities
    const capabilities = this.encodeCapabilities(serverInfo.capabilities);

    // Compact binary format
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    // Byte 0: Message type (0x01 = server announcement)
    view.setUint8(0, 0x01);

    // Byte 1-2: Capabilities bitmap
    view.setUint16(1, capabilities);

    // Byte 3-6: IP address (4 bytes)
    this.encodeIP(view, 3, serverInfo.endpoint);

    // Byte 7-8: Port
    view.setUint16(7, serverInfo.port);

    // Byte 9-12: Certificate fingerprint (first 4 bytes)
    this.encodeCertFingerprint(view, 9, serverInfo.certFingerprint);

    // Byte 13-14: Content count
    view.setUint16(13, serverInfo.contentCount || 0);

    // Byte 15: Flags (signaling enabled, CA enabled, etc.)
    view.setUint8(15, this.encodeFlags(serverInfo));

    return buffer;
  }

  encodeCapabilities(caps) {
    let bitmap = 0;
    const capMap = {
      'http': 0x0001,
      'signaling': 0x0002,
      'ca': 0x0004,
      'mesh': 0x0008,
      'relay': 0x0010,
      'storage': 0x0020
    };

    for (const cap of caps) {
      bitmap |= capMap[cap] || 0;
    }

    return bitmap;
  }
}
```

## CQ Response with Server Negotiation

### Automated Server Connection
```javascript
class CQResponse {
  async respondToCQ(cqMessage) {
    // Standard CQ response
    await this.sendResponse(cqMessage.callsign);

    // If both have servers, negotiate connection
    if (cqMessage.server && this.localServer) {
      await this.negotiateServerConnection(cqMessage);
    }
  }

  async negotiateServerConnection(cqMessage) {
    // Exchange server capabilities
    const negotiation = {
      type: 'SERVER_NEGOTIATE',
      myServer: {
        endpoint: this.localServer.endpoint,
        signaling: this.localServer.signaling,
        capabilities: this.localServer.capabilities
      },
      requestedServices: ['signaling', 'content-sync']
    };

    await this.rf.transmit(negotiation, cqMessage.callsign);

    // Listen for acceptance
    const response = await this.waitForResponse(cqMessage.callsign, 5000);

    if (response && response.type === 'SERVER_ACCEPT') {
      // Establish server-to-server connection
      await this.connectToRemoteServer(response.connectionInfo);
    }
  }
}
```

## Priority and QoS

### Server Announcement Priority
```javascript
class AnnouncementScheduler {
  getAnnouncementPriority() {
    // Higher priority if:
    // - Running CA services
    // - Have unique content
    // - Good network connectivity
    // - High uptime

    let priority = 0;

    if (this.capabilities.includes('ca')) priority += 10;
    if (this.uniqueContent > 10) priority += 5;
    if (this.uptime > 3600) priority += 3; // 1 hour uptime
    if (this.connectedPeers > 5) priority += 2;

    return priority;
  }

  scheduleAnnouncement() {
    const priority = this.getAnnouncementPriority();

    // Higher priority = more frequent announcements
    const interval = Math.max(
      60000, // Minimum 1 minute
      300000 / (1 + priority) // Up to 5 minutes based on priority
    );

    setInterval(() => this.sendCQWithServer(), interval);
  }
}
```

## Integration with Content Distribution

### Content Advertisement in CQ
```javascript
class ContentAdvertisement {
  addContentToCQ(cqMessage) {
    // Add popular content hints
    cqMessage.server.popularContent = [
      { path: '/emergency-info', hash: 'abc123', size: 2048 },
      { path: '/local-repeaters', hash: 'def456', size: 1024 },
      { path: '/weather-update', hash: 'ghi789', size: 3072 }
    ];

    // Add content categories
    cqMessage.server.categories = [
      'emergency',
      'weather',
      'technical',
      'local-info'
    ];

    return cqMessage;
  }
}
```

## UI Integration

### Server Discovery Dashboard
```javascript
class ServerDiscoveryUI {
  displayCQServers() {
    const serverList = document.getElementById('discovered-servers');

    for (const [callsign, server] of this.cqMonitor.discoveredServers) {
      const serverCard = document.createElement('div');
      serverCard.className = 'server-card';

      serverCard.innerHTML = `
        <div class="server-header">
          <h4>${callsign}</h4>
          <span class="discovery-method">via CQ</span>
        </div>

        <div class="server-details">
          <p>Endpoint: ${server.endpoint}</p>
          <p>Signaling: ${server.signaling.enabled ? '✓' : '✗'}</p>
          <p>Content: ${server.contentCatalog?.pages || 0} pages</p>
        </div>

        <div class="server-actions">
          ${server.signaling.enabled ?
            `<button onclick="connectToSignaling('${callsign}')">
              Connect Signaling
            </button>` : ''
          }
          <button onclick="browseContent('${callsign}')">
            Browse Content
          </button>
        </div>

        <div class="signal-strength">
          Signal: ${this.getSignalStrength(callsign)}dB
        </div>
      `;

      serverList.appendChild(serverCard);
    }
  }
}
```

## Benefits of CQ Integration

1. **No Additional Traffic**: Server announcements piggyback on existing CQ messages
2. **Natural Discovery**: Servers found during normal ham radio operation
3. **Distance Awareness**: Signal strength indicates server proximity
4. **Mesh Building**: CQ propagation naturally builds mesh network
5. **Bandwidth Efficient**: Minimal overhead on CQ messages
6. **Protocol Compatible**: Works with existing CQ handling

## Implementation Phases

### Phase 1: Basic CQ Enhancement
- Add server flag to CQ messages
- Include endpoint information
- Basic discovery via CQ

### Phase 2: Signaling Integration
- Add signaling server info
- Auto-connect to discovered servers
- WebSocket URL construction

### Phase 3: Content Catalog
- Include content summaries
- Popular content hints
- Category information

### Phase 4: Advanced Features
- Server-to-server negotiation
- Priority-based announcements
- Compressed binary format
- QoS for server traffic