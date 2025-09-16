# Peer and Signaling Server Discovery

## Overview
How clients discover local signaling servers on the network, and how distributed servers discover each other, using local network protocols and RF beacons.

## Discovery Methods

### 1. Signaling Server Discovery (Clients)
Clients discover local WebRTC signaling servers for peer coordination:

```javascript
class SignalingServerDiscovery {
  async discoverSignalingServers() {
    const discovered = [];

    // Method 1: mDNS for signaling servers
    const mdnsServers = await this.discoverViaMDNS();
    discovered.push(...mdnsServers);

    // Method 2: Well-known ports scan
    const portServers = await this.scanWellKnownPorts();
    discovered.push(...portServers);

    // Method 3: UDP broadcast discovery
    const broadcastServers = await this.discoverViaBroadcast();
    discovered.push(...broadcastServers);

    // Method 4: HTTP servers advertising signaling capability
    const httpServers = await this.queryLocalHTTPServers();
    discovered.push(...httpServers);

    return this.deduplicateServers(discovered);
  }

  async discoverViaMDNS() {
    // Look for signaling servers advertising via mDNS
    const browser = new MDNSBrowser('_hamradio-signal._tcp');
    const servers = [];

    browser.on('serviceUp', (service) => {
      if (service.txt && service.txt.type === 'signaling') {
        servers.push({
          type: 'signaling',
          protocol: service.txt.protocol || 'ws',
          host: service.host,
          port: service.port,
          capabilities: service.txt.capabilities
        });
      }
    });

    await browser.search(5000); // 5 second discovery
    return servers;
  }

  async scanWellKnownPorts() {
    // Check common signaling server ports
    const commonPorts = [8080, 8081, 3000, 9090, 8888];
    const servers = [];

    for (const port of commonPorts) {
      try {
        // Try WebSocket connection
        const ws = new WebSocket(`ws://localhost:${port}/signal`);

        await new Promise((resolve, reject) => {
          ws.onopen = () => {
            servers.push({
              type: 'signaling',
              protocol: 'ws',
              host: 'localhost',
              port,
              discovered: 'port-scan'
            });
            ws.close();
            resolve();
          };
          ws.onerror = reject;
          setTimeout(reject, 1000);
        });
      } catch {
        // Port not available or not a signaling server
      }
    }

    return servers;
  }

  async discoverViaBroadcast() {
    // Send UDP broadcast to discover signaling servers
    const DISCOVERY_PORT = 8089;

    // Signaling servers listen for this broadcast
    const request = {
      type: 'DISCOVER_SIGNALING',
      clientId: this.clientId,
      timestamp: Date.now()
    };

    // Servers respond with their info
    const responses = await this.broadcastAndListen(request, DISCOVERY_PORT);

    return responses.map(r => ({
      type: 'signaling',
      protocol: r.protocol,
      host: r.address,
      port: r.port,
      capabilities: r.capabilities
    }));
  }
}
```

### 2. HTTP Server Discovery with Signaling Capability
Distributed HTTP servers that also provide signaling:

```javascript
class LocalServerDiscovery {
  async discoverServers() {
    // Advertise our server (includes signaling capability)
    const advertisement = {
      name: `${this.callsign}._hamradio._tcp.local`,
      port: 8080,
      txt: {
        callsign: this.callsign,
        version: "2.0",
        capabilities: ["http", "signaling", "ca", "mesh"],
        signalingEndpoint: "/ws/signal",
        signalingProtocol: "ws",
        certificate: this.cert.fingerprint
      }
    };

    // Browse for other servers
    const browser = new MDNSBrowser('_hamradio._tcp');
    const servers = [];

    browser.on('serviceUp', (service) => {
      // Check if server provides signaling
      if (service.txt && service.txt.capabilities) {
        const server = {
          callsign: service.txt.callsign,
          endpoint: `http://${service.host}:${service.port}`,
          capabilities: service.txt.capabilities
        };

        if (service.txt.capabilities.includes('signaling')) {
          server.signalingUrl = `ws://${service.host}:${service.port}${service.txt.signalingEndpoint}`;
        }

        servers.push(server);
      }
    });

    browser.start();
    return servers;
  }
}

### 2. RF Beacon Discovery
Servers announce presence via radio:

```javascript
class RFDiscovery {
  async startBeacon() {
    const beacon = {
      type: 'SERVER_BEACON',
      callsign: this.callsign,
      endpoint: this.localIP,
      port: 8080,
      capabilities: ['http', 'ca', 'mesh'],
      certFingerprint: this.cert.fingerprint.substring(0, 8)
    };

    // Transmit every 5 minutes
    setInterval(() => {
      this.rf.transmit(beacon);
    }, 5 * 60 * 1000);
  }

  async listenForBeacons() {
    this.rf.on('beacon', (beacon) => {
      if (beacon.type === 'SERVER_BEACON') {
        this.registerPeer({
          callsign: beacon.callsign,
          endpoint: `http://${beacon.endpoint}:${beacon.port}`,
          capabilities: beacon.capabilities,
          lastSeen: Date.now()
        });
      }
    });
  }
}
```

### 3. Local Broadcast Discovery
UDP broadcast on local network:

```javascript
class BroadcastDiscovery {
  constructor() {
    this.DISCOVERY_PORT = 8088;
    this.BROADCAST_ADDR = '255.255.255.255';
  }

  async announce() {
    const message = {
      type: 'HAM_SERVER_ANNOUNCE',
      callsign: this.callsign,
      ip: this.getLocalIP(),
      port: this.serverPort,
      timestamp: Date.now()
    };

    // Send UDP broadcast
    this.udpSocket.send(
      JSON.stringify(message),
      this.DISCOVERY_PORT,
      this.BROADCAST_ADDR
    );
  }

  async listen() {
    this.udpSocket.bind(this.DISCOVERY_PORT);

    this.udpSocket.on('message', (msg, rinfo) => {
      const data = JSON.parse(msg);

      if (data.type === 'HAM_SERVER_ANNOUNCE') {
        this.addPeer({
          callsign: data.callsign,
          address: `${rinfo.address}:${data.port}`
        });
      }
    });
  }
}
```

### 4. Known Peers List
Maintain list of previously discovered peers:

```javascript
class PeerRegistry {
  async loadKnownPeers() {
    // Load from local storage
    const peers = await this.storage.get('known_peers');

    // Try to connect to each
    for (const peer of peers) {
      try {
        await this.pingPeer(peer);
        this.activePeers.set(peer.callsign, peer);
      } catch {
        // Peer offline, keep in known list
      }
    }
  }

  async sharePeerList() {
    // Share our known peers with newly discovered peers
    const peerList = Array.from(this.activePeers.values());

    for (const peer of this.activePeers.values()) {
      await fetch(`${peer.endpoint}/peers`, {
        method: 'POST',
        body: JSON.stringify(peerList)
      });
    }
  }
}
```

## WebRTC Connection Without Signaling

### Using RF for SDP Exchange
```javascript
class RFSignaling {
  async initiateWebRTC(targetCallsign) {
    // Create WebRTC offer
    const pc = new RTCPeerConnection(this.iceConfig);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Compress SDP
    const compressedSDP = this.compressSDP(offer.sdp);

    // Send over RF
    await this.rf.transmit({
      type: 'WEBRTC_OFFER',
      from: this.callsign,
      to: targetCallsign,
      sdp: compressedSDP
    });

    // Listen for answer
    this.rf.once(`WEBRTC_ANSWER:${targetCallsign}`, async (answer) => {
      const sdp = this.decompressSDP(answer.sdp);
      await pc.setRemoteDescription({type: 'answer', sdp});
    });

    return pc;
  }

  compressSDP(sdp) {
    // Remove unnecessary whitespace
    // Abbreviate known strings
    // Compress with zlib
    return compressed;
  }
}
```

### Using Local HTTP for SDP Exchange
```javascript
class LocalHTTPSignaling {
  async connectToPeer(peerEndpoint) {
    // Create offer
    const pc = new RTCPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send to peer's HTTP endpoint
    const response = await fetch(`${peerEndpoint}/webrtc/offer`, {
      method: 'POST',
      body: JSON.stringify({
        offer: offer.sdp,
        callsign: this.callsign
      })
    });

    // Get answer
    const { answer } = await response.json();
    await pc.setRemoteDescription({type: 'answer', sdp: answer});

    return pc;
  }
}
```

## Mesh Network Formation

### Automatic Mesh Building
```javascript
class MeshNetwork {
  async formMesh() {
    // Phase 1: Discover local peers
    const localPeers = await this.discoverLocal();

    // Phase 2: Exchange peer lists
    const allPeers = await this.exchangePeerLists(localPeers);

    // Phase 3: Establish connections
    for (const peer of allPeers) {
      await this.connectToPeer(peer);
    }

    // Phase 4: Build routing table
    this.routingTable = await this.buildRoutingTable();

    // Phase 5: Start content synchronization
    await this.startContentSync();
  }

  async buildRoutingTable() {
    // Each peer shares its connections
    const topology = new Map();

    for (const peer of this.connectedPeers) {
      const connections = await this.getPeerConnections(peer);
      topology.set(peer.callsign, connections);
    }

    // Calculate shortest paths
    return this.calculateRoutes(topology);
  }
}
```

## Discovery Priority System

```javascript
class DiscoveryManager {
  constructor() {
    this.methods = [
      { name: 'mDNS', priority: 1, local: true },
      { name: 'broadcast', priority: 2, local: true },
      { name: 'known_peers', priority: 3, local: false },
      { name: 'rf_beacon', priority: 4, local: false }
    ];
  }

  async discoverPeers() {
    const discovered = new Map();

    // Try methods in parallel
    const promises = this.methods.map(method =>
      this.tryDiscoveryMethod(method)
    );

    const results = await Promise.allSettled(promises);

    // Merge results, preferring higher priority
    for (const [i, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        const method = this.methods[i];
        for (const peer of result.value) {
          if (!discovered.has(peer.callsign) ||
              discovered.get(peer.callsign).priority > method.priority) {
            discovered.set(peer.callsign, {...peer, method: method.name});
          }
        }
      }
    }

    return discovered;
  }
}
```

## Offline Internet Detection

```javascript
class ConnectivityMonitor {
  async checkInternet() {
    // Multiple checks for reliability
    const checks = [
      this.dnsCheck(),
      this.httpCheck(),
      this.pingCheck()
    ];

    try {
      await Promise.race([
        Promise.any(checks),
        this.timeout(5000)
      ]);
      return true;
    } catch {
      // Internet unavailable
      await this.switchToDistributedMode();
      return false;
    }
  }

  async switchToDistributedMode() {
    // Enable all discovery methods
    await this.discovery.enableAll();

    // Increase beacon frequency
    this.rf.setBeaconInterval(60000); // 1 minute

    // Start content replication
    await this.content.startReplication();

    // Notify user
    this.ui.showStatus('Distributed Mode - No Internet');
  }
}
```

## Implementation Notes

### Server Binary Features Required
- mDNS/Bonjour support
- UDP broadcast capability
- HTTP server for SDP exchange
- WebSocket for real-time communication
- RF gateway integration

### PWA Integration
```javascript
class PWAServerConnector {
  async connectToLocalServer() {
    // Try localhost first
    if (await this.tryConnect('localhost:8080')) {
      return true;
    }

    // Try mDNS discovery
    const servers = await this.discoverLocalServers();
    for (const server of servers) {
      if (server.callsign === this.myCallsign) {
        return await this.tryConnect(server.endpoint);
      }
    }

    // Prompt to install server
    this.ui.promptServerInstall();
    return false;
  }
}
```

### Bandwidth Optimization
- Compress discovery messages
- Batch peer updates
- Use binary protocols where possible
- Cache discovery results
- Exponential backoff for failed peers

## Security Considerations

### Peer Authentication
- All announcements include certificate fingerprint
- Verify certificate chain before trusting peer
- Sign discovery messages with private key

### Network Isolation
- Separate discovery from data transfer
- Rate limit discovery messages
- Validate all peer data
- Sandbox untrusted peers

## Testing Strategy

### Unit Tests
- mDNS advertisement/discovery
- RF beacon encoding/decoding
- Peer list management
- Connectivity detection

### Integration Tests
- Multi-peer discovery
- Mesh formation
- Failover scenarios
- Network partition handling

### End-to-End Tests
- Complete offline operation
- 10+ node mesh formation
- Content synchronization
- Internet restoration handling