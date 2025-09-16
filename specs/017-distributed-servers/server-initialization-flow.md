# Server Initialization and Ownership Transfer

## Overview
When a new server is started, it begins in an "unclaimed" state. The first licensed amateur to connect transfers their station data via WebRTC, establishing ownership. The server then shares its signaling endpoint via QR code or visual URL display.

## Server Initialization Flow

```
1. Download & Start Server → Unclaimed State
2. Open PWA on same machine → Connect to localhost:8080
3. Transfer station via WebRTC → Server claims ownership
4. Server displays QR/URL → Other clients can connect
5. Server becomes signaling hub → Enables P2P connections
```

## Implementation

### 1. Server Unclaimed State
```javascript
class HamRadioServer {
  constructor() {
    this.state = 'UNCLAIMED';
    this.owner = null;
    this.station = null;
    this.signalingClients = new Map();
  }

  async start() {
    // Start HTTP server
    this.app.listen(8080, () => {
      console.log('Server running in UNCLAIMED state');
      console.log('Waiting for station owner...');
      console.log('Open http://localhost:8080 in your browser');
    });

    // WebSocket for signaling
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/signal'
    });

    // HTTP endpoint for status
    this.app.get('/api/status', (req, res) => {
      res.json({
        state: this.state,
        owner: this.owner,
        endpoint: this.getPublicEndpoint(),
        signaling: {
          url: `ws://${this.getLocalIP()}:8080/signal`,
          connected: this.signalingClients.size
        }
      });
    });

    // Station transfer endpoint
    this.app.post('/api/claim-station', async (req, res) => {
      if (this.state !== 'UNCLAIMED') {
        return res.status(403).json({ error: 'Server already claimed' });
      }

      const result = await this.claimStation(req.body);
      res.json(result);
    });
  }

  async claimStation(data) {
    // Verify certificate
    const cert = await this.verifyCertificate(data.certificate);
    if (!cert.valid) {
      throw new Error('Invalid amateur radio certificate');
    }

    // Set owner
    this.owner = {
      callsign: cert.callsign,
      licenseClass: cert.licenseClass,
      certificate: cert
    };

    // Store station data
    this.station = data.station;

    // Transition to claimed state
    this.state = 'CLAIMED';

    // Generate access credentials
    const accessToken = this.generateAccessToken();

    console.log(`Server claimed by ${this.owner.callsign}`);

    return {
      success: true,
      owner: this.owner.callsign,
      signalingUrl: this.getSignalingUrl(),
      accessToken
    };
  }

  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces).flat()) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
    return 'localhost';
  }

  getSignalingUrl() {
    const ip = this.getLocalIP();
    return `ws://${ip}:8080/signal`;
  }
}
```

### 2. PWA Station Transfer
```javascript
class StationTransfer {
  async initializeNewServer() {
    // Step 1: Check if server is unclaimed
    const status = await fetch('http://localhost:8080/api/status');
    const serverInfo = await status.json();

    if (serverInfo.state === 'UNCLAIMED') {
      // Show initialization UI
      this.showInitializationUI();
    } else {
      // Server already claimed, just connect
      this.connectToServer(serverInfo);
    }
  }

  async showInitializationUI() {
    const modal = document.createElement('div');
    modal.className = 'server-init-modal';
    modal.innerHTML = `
      <h2>Initialize New Server</h2>
      <p>This server is unclaimed. You will become the station owner.</p>

      <div class="transfer-options">
        <button onclick="transferStation()" class="primary">
          Transfer My Station to Server
        </button>

        <div class="certificate-upload">
          <label>Amateur Radio Certificate:</label>
          <input type="file" id="cert-file" accept=".p12,.pem,.crt">
        </div>
      </div>

      <p class="info">
        Your station data, pages, and settings will be transferred to the server.
      </p>
    `;

    document.body.appendChild(modal);
  }

  async transferStation() {
    // Gather station data
    const stationData = {
      callsign: this.station.callsign,
      pages: await this.exportPages(),
      settings: await this.exportSettings(),
      logbook: await this.exportLogbook(),
      meshNodes: await this.exportMeshNodes()
    };

    // Get certificate
    const certFile = document.getElementById('cert-file').files[0];
    const certificate = await this.readCertificate(certFile);

    // Create WebRTC connection for bulk transfer
    const pc = new RTCPeerConnection();
    const dataChannel = pc.createDataChannel('station-transfer');

    // Send initial claim request
    const response = await fetch('http://localhost:8080/api/claim-station', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certificate,
        station: {
          callsign: stationData.callsign,
          metadata: {
            pageCount: stationData.pages.length,
            logEntries: stationData.logbook.length
          }
        }
      })
    });

    const result = await response.json();

    if (result.success) {
      // Transfer full station data via WebRTC
      await this.transferViaWebRTC(dataChannel, stationData);

      // Update local config to use new server
      await this.updateLocalConfig({
        signalingServer: result.signalingUrl,
        serverOwner: result.owner,
        accessToken: result.accessToken
      });

      // Show success and QR code
      this.showServerReady(result);
    }
  }

  async transferViaWebRTC(dataChannel, stationData) {
    return new Promise((resolve) => {
      dataChannel.onopen = async () => {
        // Send station data in chunks
        const chunks = this.chunkData(stationData);

        for (const chunk of chunks) {
          dataChannel.send(JSON.stringify(chunk));
          await this.delay(10); // Prevent overwhelming
        }

        dataChannel.send(JSON.stringify({ type: 'TRANSFER_COMPLETE' }));
        resolve();
      };
    });
  }
}
```

### 3. QR Code and URL Sharing
```javascript
class ServerSharing {
  showServerReady(serverInfo) {
    const modal = document.createElement('div');
    modal.className = 'server-ready-modal';

    // Generate QR code for signaling URL
    const qrCode = this.generateQRCode({
      type: 'SIGNALING_SERVER',
      url: serverInfo.signalingUrl,
      owner: serverInfo.owner
    });

    modal.innerHTML = `
      <h2>✓ Server Initialized</h2>

      <div class="server-info">
        <p>Station Owner: <strong>${serverInfo.owner}</strong></p>
        <p>Your server is now running and ready for connections.</p>
      </div>

      <div class="connection-methods">
        <div class="qr-section">
          <h3>Quick Connect via QR Code</h3>
          <div id="qr-code">${qrCode}</div>
          <p>Scan from another device to connect</p>
        </div>

        <div class="url-section">
          <h3>Manual Connection</h3>
          <div class="url-display">
            <input type="text"
                   value="${serverInfo.signalingUrl}"
                   readonly
                   id="signaling-url">
            <button onclick="copyUrl()">Copy</button>
          </div>
          <p>Enter this URL in the PWA settings</p>
        </div>

        <div class="local-network">
          <h3>Local Network Discovery</h3>
          <p>Devices on the same network can auto-discover this server.</p>
          <code>Server: ${serverInfo.owner}.local:8080</code>
        </div>
      </div>

      <div class="next-steps">
        <h3>Share with Other Operators</h3>
        <ul>
          <li>Show QR code for instant connection</li>
          <li>Share URL for manual configuration</li>
          <li>Server will appear in CQ announcements</li>
        </ul>
      </div>
    `;

    document.body.appendChild(modal);
  }

  generateQRCode(data) {
    // Use QR code library to generate SVG/Canvas
    const qr = new QRCode({
      text: JSON.stringify(data),
      width: 256,
      height: 256
    });
    return qr;
  }

  async copyUrl() {
    const url = document.getElementById('signaling-url').value;
    await navigator.clipboard.writeText(url);

    // Show confirmation
    const button = event.target;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 2000);
  }
}
```

### 4. Client Connection Flow
```javascript
class ClientConnection {
  async connect() {
    // Option 1: Scan QR Code
    const qrData = await this.scanQRCode();
    if (qrData && qrData.type === 'SIGNALING_SERVER') {
      return this.connectToSignaling(qrData.url);
    }

    // Option 2: Manual URL entry
    const manualUrl = await this.promptForUrl();
    if (manualUrl) {
      return this.connectToSignaling(manualUrl);
    }

    // Option 3: Auto-discovery
    const discovered = await this.discoverLocalServers();
    if (discovered.length > 0) {
      return this.connectToSignaling(discovered[0].url);
    }
  }

  async scanQRCode() {
    // Use camera to scan QR
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    // QR code detection
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(video);

    if (codes.length > 0) {
      const data = JSON.parse(codes[0].rawValue);
      stream.getTracks().forEach(track => track.stop());
      return data;
    }
  }

  async connectToSignaling(url) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Connected to signaling server:', url);

      // Store for future use
      localStorage.setItem('signaling-server', url);

      // Register with server
      this.ws.send(JSON.stringify({
        type: 'REGISTER',
        callsign: this.station?.callsign || 'GUEST',
        certificate: this.certificate || null
      }));
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };

    return this.ws;
  }
}
```

### 5. Server as Signaling Hub
```javascript
class SignalingHub {
  constructor(server) {
    this.server = server;
    this.clients = new Map();
    this.rooms = new Map();
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();

    ws.on('message', (data) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'REGISTER':
          this.registerClient(clientId, ws, message);
          break;

        case 'OFFER':
          this.relayOffer(clientId, message);
          break;

        case 'ANSWER':
          this.relayAnswer(clientId, message);
          break;

        case 'ICE_CANDIDATE':
          this.relayIceCandidate(clientId, message);
          break;

        case 'LIST_PEERS':
          this.sendPeerList(ws);
          break;
      }
    });

    ws.on('close', () => {
      this.removeClient(clientId);
    });
  }

  registerClient(id, ws, data) {
    this.clients.set(id, {
      ws,
      callsign: data.callsign,
      certificate: data.certificate,
      registered: Date.now()
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'REGISTERED',
      clientId: id,
      serverOwner: this.server.owner.callsign,
      peers: this.getPeerList(id)
    }));

    // Notify others of new peer
    this.broadcast({
      type: 'PEER_JOINED',
      peer: {
        id,
        callsign: data.callsign
      }
    }, id);
  }

  getPeerList(excludeId) {
    const peers = [];
    for (const [id, client] of this.clients) {
      if (id !== excludeId) {
        peers.push({
          id,
          callsign: client.callsign,
          hasLicense: !!client.certificate
        });
      }
    }
    return peers;
  }

  broadcast(message, excludeId) {
    for (const [id, client] of this.clients) {
      if (id !== excludeId) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }
}
```

### 6. Visual URL Configuration UI
```javascript
class SignalingConfiguration {
  showConfigurationUI() {
    const modal = document.createElement('div');
    modal.className = 'signaling-config-modal';

    modal.innerHTML = `
      <h2>Connect to Signaling Server</h2>

      <div class="config-tabs">
        <button class="tab active" onclick="showTab('qr')">
          QR Code
        </button>
        <button class="tab" onclick="showTab('manual')">
          Manual Entry
        </button>
        <button class="tab" onclick="showTab('discover')">
          Auto-Discover
        </button>
      </div>

      <div class="tab-content" id="qr-tab">
        <div class="qr-scanner">
          <video id="qr-video"></video>
          <button onclick="startQRScan()">
            Start Camera Scan
          </button>
        </div>
      </div>

      <div class="tab-content hidden" id="manual-tab">
        <div class="manual-entry">
          <label>Signaling Server URL:</label>
          <input type="text"
                 placeholder="ws://192.168.1.100:8080/signal"
                 id="manual-url">

          <div class="url-examples">
            <p>Common formats:</p>
            <button onclick="setUrl('ws://localhost:8080/signal')">
              localhost:8080
            </button>
            <button onclick="setUrl('ws://ham-server.local:8080/signal')">
              ham-server.local
            </button>
          </div>

          <button onclick="testConnection()" class="primary">
            Test Connection
          </button>
        </div>
      </div>

      <div class="tab-content hidden" id="discover-tab">
        <div class="discovery">
          <button onclick="startDiscovery()" class="primary">
            Search Local Network
          </button>

          <div id="discovery-results" class="hidden">
            <h3>Found Servers:</h3>
            <ul id="server-list"></ul>
          </div>
        </div>
      </div>

      <div class="connection-status" id="status">
        Ready to connect...
      </div>
    `;

    document.body.appendChild(modal);
  }

  async testConnection() {
    const url = document.getElementById('manual-url').value;
    const status = document.getElementById('status');

    status.textContent = 'Testing connection...';
    status.className = 'connection-status testing';

    try {
      const ws = new WebSocket(url);

      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          status.textContent = '✓ Connection successful!';
          status.className = 'connection-status success';

          // Save and use this server
          this.saveSignalingServer(url);
          ws.close();
          resolve();
        };

        ws.onerror = () => {
          status.textContent = '✗ Connection failed';
          status.className = 'connection-status error';
          reject();
        };

        setTimeout(() => {
          status.textContent = '✗ Connection timeout';
          status.className = 'connection-status error';
          reject();
        }, 5000);
      });
    } catch (e) {
      console.error('Connection test failed:', e);
    }
  }
}
```

## Benefits of This Approach

1. **Simple Setup**: Download server → Open browser → Transfer station → Done
2. **Natural Ownership**: First licensed operator becomes owner
3. **Easy Sharing**: QR code or visual URL for quick connection
4. **No Manual Config**: Server auto-configures based on station transfer
5. **Secure**: Certificate verification ensures only licensed operators can claim
6. **Discoverable**: Server announces itself once configured

## Security Considerations

1. **Certificate Verification**: Only valid amateur radio certificates can claim servers
2. **Access Tokens**: Generated after successful claim for authenticated access
3. **Local-First**: Initial claim must be from localhost for security
4. **Ownership Lock**: Once claimed, server cannot be re-claimed without reset

## Implementation Phases

### Phase 1: Basic Server Initialization
- Unclaimed state detection
- Station transfer via HTTP POST
- Owner assignment

### Phase 2: WebRTC Transfer
- Bulk data transfer via DataChannel
- Progress indication
- Error handling

### Phase 3: QR Code Sharing
- QR generation with connection info
- Camera-based QR scanning
- Visual URL display

### Phase 4: Enhanced Discovery
- mDNS advertisement after claiming
- CQ announcement integration
- Peer discovery network