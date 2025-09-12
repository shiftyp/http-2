# Architecture Revision: Direct Radio Control

## Problem with Initial Design
The initial design had a traditional client-server architecture with API endpoints for radio control. This doesn't make sense for an offline-first ham radio application where:
- Each station operates independently
- No central server exists
- Radio hardware connects directly to the operator's computer

## Correct Architecture

### Application Structure
```
┌─────────────────────────────────────────┐
│         Electron/Browser App            │
│  (Single application, no client-server) │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │     Web Serial API / Node.js     │  │
│  │    (Direct hardware access)      │  │
│  └──────────────────────────────────┘  │
│                ↓                        │
│  ┌──────────────────────────────────┐  │
│  │      Radio Control Module        │  │
│  │   - CAT commands via serial      │  │
│  │   - PTT control                  │  │
│  │   - Frequency/mode control       │  │
│  └──────────────────────────────────┘  │
│                ↓                        │
│  ┌──────────────────────────────────┐  │
│  │      QPSK Modem Module          │  │
│  │   - Web Audio API for TX/RX      │  │
│  │   - Modulation/demodulation      │  │
│  └──────────────────────────────────┘  │
│                ↓                        │
│  ┌──────────────────────────────────┐  │
│  │    Local HTTP Server             │  │
│  │   - Serves YOUR pages to radio   │  │
│  │   - Handles incoming requests    │  │
│  └──────────────────────────────────┘  │
│                ↓                        │
│  ┌──────────────────────────────────┐  │
│  │    Mesh Network Protocol         │  │
│  │   - Routes HTTP over radio       │  │
│  │   - Store & forward requests     │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
                    ↓
            [RADIO HARDWARE]
```

### Technology Stack

#### Option 1: Electron Application (Recommended)
- **Electron**: Desktop application with full hardware access
- **Node.js serialport**: Direct CAT control
- **Web Audio API**: Audio processing in renderer
- **SQLite**: Local database
- **React**: UI in renderer process

```javascript
// Main process - hardware access
const { SerialPort } = require('serialport');
const radio = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 9600 });

// Renderer process - UI
// Communicates with main via IPC
ipcRenderer.send('radio:connect', { port, baudRate });
```

#### Option 2: Browser with Web Serial API
- **Web Serial API**: Direct serial access from browser
- **Web Audio API**: Audio processing
- **IndexedDB**: Local storage
- **Service Worker**: Offline functionality

```javascript
// Browser - direct hardware access
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 9600 });

// Web Audio for modulation
const audioContext = new AudioContext();
const processor = audioContext.createScriptProcessor();
```

### Data Flow

1. **Local Operation**:
```
User Action → Local App → Radio Hardware → RF Transmission
```

2. **HTTP Over Radio**:
```
HTTP Request → QPSK Encode → Radio TX → [RF] → Radio RX → QPSK Decode → HTTP Response
```

3. **Mesh Forwarding**:
```
Request for KB2XYZ.radio → Check local routes → Forward via next hop → Destination
```

### File Structure (Revised)
```
http-radio-app/
├── electron/           # Electron main process
│   ├── main.js        # App entry point
│   ├── radio.js       # Radio control
│   └── server.js      # Local HTTP server
├── src/               # Renderer/UI
│   ├── components/    # React components
│   ├── services/      # Business logic
│   └── pages/         # Application screens
├── lib/               # Core libraries
│   ├── qpsk-modem/    # Modulation/demodulation
│   ├── mesh-router/   # Routing protocol
│   └── signing-list/  # Authentication
├── data/              # Local storage
│   ├── signing-list.json
│   ├── resources/     # HTML pages to serve
│   └── cache/         # Received pages
└── package.json

# NO backend/ directory - this is a single application!
```

### Key Differences from Original Design

| Original (Wrong) | Revised (Correct) |
|-----------------|-------------------|
| Client-server architecture | Single desktop/web application |
| API endpoints for radio control | Direct hardware access |
| Backend server | Local HTTP server for radio only |
| REST API | Local function calls |
| Network requests | IPC (Electron) or direct calls |

### HTTP Server Role

The HTTP server in this architecture:
- **ONLY serves pages to other stations via radio**
- **Does NOT control the radio** (that's done directly)
- **Does NOT manage the UI** (that's the app itself)
- **Acts as origin server** for `callsign.radio` domain

### Example Implementation

```javascript
// Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const express = require('express');

// Direct radio control
class RadioController {
  constructor() {
    this.port = null;
  }

  async connect(portPath, baudRate) {
    this.port = new SerialPort({ path: portPath, baudRate });
    return this.getStatus();
  }

  async setFrequency(freq) {
    // Send CAT command directly
    this.port.write(`FA${freq};`);
  }
}

// Local HTTP server for radio network
class RadioHTTPServer {
  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    // Serve local HTML pages to radio network
    this.app.get('/*', (req, res) => {
      // Serve from local resources
      const page = this.loadLocalPage(req.path);
      res.send(page);
    });
  }

  listen() {
    // This server is accessed via radio, not network!
    this.app.listen(8073); // Ham radio digital port
  }
}

// IPC handlers for renderer
ipcMain.handle('radio:connect', async (event, config) => {
  return await radioController.connect(config.port, config.baudRate);
});

ipcMain.handle('radio:setFrequency', async (event, freq) => {
  return await radioController.setFrequency(freq);
});
```

### Testing Approach

Tests should be:
1. **Unit tests**: Test modules directly
2. **Integration tests**: Test with mock hardware
3. **Hardware tests**: Test with real radio in mock mode

```javascript
// Direct testing - no HTTP requests!
describe('RadioController', () => {
  it('should connect to radio', async () => {
    const controller = new RadioController();
    const mockPort = new MockSerialPort();
    
    await controller.connect(mockPort);
    expect(controller.isConnected()).toBe(true);
  });
});
```

### Benefits of This Architecture

1. **True Offline**: No network dependencies
2. **Direct Control**: Immediate hardware response
3. **Lower Latency**: No client-server overhead
4. **Simpler**: No API layer needed
5. **Secure**: No network attack surface
6. **Portable**: Single application to distribute

### Migration Path

To update the current implementation:
1. Remove `/backend/api/` endpoints
2. Move radio control to Electron main process
3. Use IPC instead of HTTP for UI-hardware communication
4. Keep HTTP server ONLY for serving pages to radio network
5. Simplify to single application structure

---
*This is the correct architecture for an offline-first ham radio application.*