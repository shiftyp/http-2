# API Reference - HTTP-over-Radio Protocol

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Core APIs](#core-apis)
3. [Radio Control API](#radio-control-api)
4. [Compression API](#compression-api)
5. [Mesh Networking API](#mesh-networking-api)
6. [Cryptography API](#cryptography-api)
7. [Database API](#database-api)
8. [Server Apps API](#server-apps-api)
9. [Event System](#event-system)
10. [Error Codes](#error-codes)

## Protocol Overview

The HTTP-over-Radio protocol extends standard HTTP semantics for radio transmission, adding compression, mesh routing, and authentication.

### Request Format

```typescript
interface HTTPRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers: Record<string, string>;
  body?: any;
  compression?: 'none' | 'jsx' | 'gzip';
  signature?: string;
}
```

### Response Format

```typescript
interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  compressed: boolean;
  signature?: string;
}
```

## Core APIs

### HTTPProtocol Class

```typescript
class HTTPProtocol {
  // Create protocol instance
  constructor(config?: ProtocolConfig);
  
  // Send HTTP request over radio
  async sendRequest(
    request: HTTPRequest,
    destination: string
  ): Promise<HTTPResponse>;
  
  // Handle incoming packet
  async handlePacket(packet: HTTPPacket): Promise<void>;
  
  // Register request handler
  onRequest(handler: RequestHandler): void;
  
  // Get protocol statistics
  getStats(): ProtocolStats;
}
```

#### Usage Example

```javascript
import { HTTPProtocol } from './lib/http-protocol';

const protocol = new HTTPProtocol({
  callsign: 'KJ4ABC',
  retryLimit: 3,
  timeout: 5000
});

// Send request
const response = await protocol.sendRequest({
  method: 'GET',
  path: '/weather',
  headers: { 'Accept': 'application/json' }
}, 'W5XYZ');

// Handle incoming requests
protocol.onRequest(async (request, respond) => {
  if (request.path === '/status') {
    respond({
      status: 200,
      body: { online: true }
    });
  }
});
```

## Radio Control API

### RadioControl Class

```typescript
class RadioControl {
  // Connect to radio via serial port
  async connect(portConfig?: SerialPortConfig): Promise<void>;
  
  // Disconnect from radio
  async disconnect(): Promise<void>;
  
  // Set frequency (Hz)
  async setFrequency(freq: number): Promise<void>;
  
  // Set operating mode
  async setMode(mode: RadioMode): Promise<void>;
  
  // Transmit data
  async transmit(data: Uint8Array): Promise<void>;
  
  // Start receiving
  startReceive(callback: (data: Uint8Array) => void): void;
  
  // Get signal strength
  getSignalStrength(): number; // dBm
}
```

#### Serial Port Configuration

```typescript
interface SerialPortConfig {
  baudRate: number;      // Default: 9600
  dataBits: 7 | 8;      // Default: 8
  stopBits: 1 | 2;      // Default: 1
  parity: 'none' | 'even' | 'odd'; // Default: 'none'
  flowControl: 'none' | 'hardware'; // Default: 'none'
}
```

#### Radio Modes

```typescript
type RadioMode = 
  | 'USB'  // Upper Sideband
  | 'LSB'  // Lower Sideband
  | 'DATA' // Data mode
  | 'PKT'  // Packet mode
  | 'FM'   // Frequency Modulation
  | 'AM';  // Amplitude Modulation
```

## Compression API

### HamRadioCompressor Class

```typescript
class HamRadioCompressor {
  // Compress HTML content
  compressHTML(html: string): CompressedPayload;
  
  // Decompress HTML content
  decompressHTML(payload: CompressedPayload): string;
  
  // Get compression statistics
  getCompressionRatio(original: string, compressed: CompressedPayload): number;
}
```

### RadioJSXCompiler Class

```typescript
class RadioJSXCompiler {
  // Compile JSX to compressed format
  compile(jsx: JSXElement): CompiledJSX;
  
  // Decompile back to JSX
  decompile(compiled: CompiledJSX): JSXElement;
  
  // Register custom component
  registerComponent(name: string, template: Template): void;
}
```

#### Compression Example

```javascript
const compressor = new HamRadioCompressor();
const compiler = new RadioJSXCompiler();

// HTML compression
const compressed = compressor.compressHTML('<h1>Hello World</h1>');
console.log(`Ratio: ${compressed.ratio}x`);

// JSX compilation
const jsxCompiled = compiler.compile(
  h('Card', {}, [
    h('CardHeader', {}, 'Title'),
    h('CardContent', {}, 'Content')
  ])
);
```

## Mesh Networking API

### MeshNetwork Class

```typescript
class MeshNetwork {
  // Initialize mesh network
  constructor(config: MeshConfig);
  
  // Join mesh network
  async join(): Promise<void>;
  
  // Leave mesh network
  async leave(): Promise<void>;
  
  // Send packet through mesh
  async sendPacket(
    packet: MeshPacket,
    destination: string
  ): Promise<void>;
  
  // Discover routes
  async discoverRoute(destination: string): Promise<Route>;
  
  // Get neighbor nodes
  getNeighbors(): MeshNode[];
  
  // Get routing table
  getRoutingTable(): RoutingEntry[];
}
```

#### Mesh Configuration

```typescript
interface MeshConfig {
  callsign: string;
  maxHops: number;        // Default: 7
  beaconInterval: number; // Default: 60000 ms
  routeTimeout: number;   // Default: 300000 ms
}
```

#### Route Structure

```typescript
interface Route {
  destination: string;
  path: string[];
  hopCount: number;
  metric: number;
  timestamp: number;
}
```

## Cryptography API

### CryptoManager Class

```typescript
class CryptoManager {
  // Generate key pair
  async generateKeyPair(callsign: string): Promise<KeyPair>;
  
  // Load existing key pair
  async loadKeyPair(callsign: string): Promise<KeyPair | null>;
  
  // Sign request
  async signRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any
  ): Promise<SignedRequest>;
  
  // Verify request signature
  async verifyRequest(request: SignedRequest): Promise<boolean>;
  
  // Encrypt data
  async encryptData(
    data: string,
    recipientPublicKey: string
  ): Promise<string>;
  
  // Decrypt data
  async decryptData(encryptedData: string): Promise<string>;
  
  // Manage trusted keys
  addTrustedKey(callsign: string, publicKey: string): void;
  removeTrustedKey(callsign: string): void;
  getTrustedKeys(): Record<string, string>;
}
```

#### Key Pair Structure

```typescript
interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyPem: string;
  callsign: string;
  created: number;
  expires: number;
}
```

## Database API

### Database Class

```typescript
class Database {
  // Initialize database
  async init(): Promise<void>;
  
  // Pages
  async savePage(page: Page): Promise<void>;
  async getPage(path: string): Promise<Page | null>;
  async getAllPages(): Promise<Page[]>;
  async deletePage(id: string): Promise<void>;
  
  // Server Apps
  async saveServerApp(app: ServerApp): Promise<void>;
  async getServerApp(path: string): Promise<ServerApp | null>;
  async getAllServerApps(): Promise<ServerApp[]>;
  
  // Mesh Nodes
  async saveMeshNode(node: MeshNode): Promise<void>;
  async getMeshNode(callsign: string): Promise<MeshNode | null>;
  async getActiveMeshNodes(maxAge?: number): Promise<MeshNode[]>;
  
  // Messages
  async saveMessage(message: Message): Promise<void>;
  async getMessages(filter: MessageFilter): Promise<Message[]>;
  async markMessageAsRead(id: number): Promise<void>;
  
  // QSO Log
  async logQSO(qso: QSOEntry): Promise<void>;
  async getQSOLog(filter?: QSOFilter): Promise<QSOEntry[]>;
  
  // Settings
  async setSetting(key: string, value: any): Promise<void>;
  async getSetting(key: string): Promise<any>;
  async getAllSettings(): Promise<Record<string, any>>;
  
  // Cache
  async cacheContent(url: string, content: any): Promise<void>;
  async getCachedContent(url: string): Promise<any>;
  async clearCache(olderThan?: number): Promise<void>;
  async getCacheSize(): Promise<number>;
}
```

## Server Apps API

### ServerAppExecutor Class

```typescript
class ServerAppExecutor {
  // Register server app
  async registerApp(app: ServerApp): Promise<void>;
  
  // Execute server app
  async executeApp(
    appId: string,
    context: AppContext
  ): Promise<AppResponse>;
  
  // Unregister app
  async unregisterApp(appId: string): Promise<void>;
  
  // Get registered apps
  getRegisteredApps(): ServerApp[];
}
```

#### Server App Structure

```typescript
interface ServerApp {
  id: string;
  path: string;
  handler: string; // JavaScript code
  metadata: {
    author: string;
    version: string;
    description: string;
    permissions: string[]; // 'storage', 'network', 'radio'
  };
}
```

#### App Context

```typescript
interface AppContext {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    params: Record<string, string>;
    query: Record<string, string>;
    body?: any;
  };
  env: {
    callsign: string;
    gridSquare: string;
    timestamp: number;
  };
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}
```

## Event System

### Custom Events

The application uses custom DOM events for communication between components:

```typescript
// Station discovered
window.addEventListener('station-discovered', (event: CustomEvent) => {
  const station: StationInfo = event.detail;
  console.log(`Found station: ${station.callsign}`);
});

// Content received
window.addEventListener('http-data-received', (event: CustomEvent) => {
  const { html, packet } = event.detail;
  displayContent(html);
});

// Transmit content
window.dispatchEvent(new CustomEvent('transmit-content', {
  detail: {
    path: '/page',
    compressed: compressedData,
    metadata: { /* ... */ }
  }
}));
```

### Event Types

| Event | Description | Detail Type |
|-------|-------------|-------------|
| `station-discovered` | New station found | `StationInfo` |
| `http-data-received` | Content received | `{html, packet}` |
| `transmit-content` | Request transmission | `TransmitRequest` |
| `mesh-request` | Mesh network request | `MeshRequest` |
| `registration-beacon` | Registration beacon | `RegistrationBeacon` |
| `radio-connected` | Radio connected | `RadioInfo` |
| `radio-disconnected` | Radio disconnected | `void` |
| `signal-report` | Signal strength update | `SignalReport` |

## Error Codes

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Authentication required |
| 404 | Not Found | Resource not found |
| 500 | Internal Error | Server error |
| 503 | Service Unavailable | Station offline |

### Protocol Error Codes

| Code | Error | Description |
|------|-------|-------------|
| E001 | TIMEOUT | Request timeout |
| E002 | NO_ROUTE | No route to destination |
| E003 | SIGNATURE_INVALID | Invalid signature |
| E004 | COMPRESSION_FAILED | Compression error |
| E005 | RADIO_OFFLINE | Radio not connected |
| E006 | PACKET_CORRUPT | Corrupted packet |
| E007 | MAX_RETRIES | Maximum retries exceeded |
| E008 | BUFFER_OVERFLOW | Buffer size exceeded |

### Error Handling Example

```javascript
try {
  const response = await protocol.sendRequest(request, destination);
  handleResponse(response);
} catch (error) {
  switch (error.code) {
    case 'E001':
      console.error('Request timed out');
      break;
    case 'E002':
      console.error('No route to station');
      break;
    case 'E003':
      console.error('Invalid signature');
      break;
    default:
      console.error('Unknown error:', error);
  }
}
```

## WebSocket API (Future)

### Real-time Communication

```typescript
// Future WebSocket support for real-time updates
interface WebSocketAPI {
  // Connect to WebSocket server
  connect(url: string): Promise<void>;
  
  // Subscribe to events
  subscribe(event: string, callback: Function): void;
  
  // Send message
  send(message: any): void;
  
  // Close connection
  close(): void;
}
```

---

*API Version: 1.0.0*  
*Last Updated: 2024*  
*Status: Stable*