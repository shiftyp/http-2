# Local Server Applications Architecture

## Overview
Each ham radio station can create and host "server applications" entirely within their browser. These apps handle incoming HTTP requests from other stations, process form submissions, and generate responses - all running client-side in sandboxed JavaScript environments.

## How It Works

### 1. Creating a Server App
Users write JavaScript code that handles HTTP requests:

```javascript
// Example: Guestbook Server App
export default {
  name: 'Guestbook',
  version: '1.0.0',
  endpoints: {
    'GET /guestbook': async (req, store) => {
      const entries = await store.getAll('entries');
      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <h1>KA1ABC's Guestbook</h1>
            <form method="POST" action="/guestbook/sign">
              <input name="callsign" required>
              <textarea name="message"></textarea>
              <button type="submit">Sign</button>
            </form>
            <h2>Entries:</h2>
            ${entries.map(e => `<p><b>${e.callsign}:</b> ${e.message}</p>`).join('')}
          </html>
        `
      };
    },
    
    'POST /guestbook/sign': async (req, store) => {
      const formData = req.body;
      await store.add('entries', {
        callsign: formData.callsign,
        message: formData.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        status: 303,
        headers: { 'Location': '/guestbook' }
      };
    }
  }
};
```

### 2. Server App Storage
Each server app gets its own IndexedDB store:

```
IndexedDB
├── server-apps
│   ├── guestbook
│   │   ├── code: "export default {...}"
│   │   ├── version: "1.0.0"
│   │   └── created: "2024-01-15"
│   └── contact-form
│       ├── code: "export default {...}"
│       ├── version: "1.0.0"
│       └── created: "2024-01-16"
└── app-data
    ├── guestbook
    │   └── entries: [...]
    └── contact-form
        └── messages: [...]
```

### 3. Request Processing Flow

```
Incoming HTTP Request (via radio)
         ↓
Parse URL: http://KA1ABC.radio/guestbook
         ↓
Find matching server app endpoint
         ↓
Execute in sandboxed environment
         ↓
Generate HTTP Response
         ↓
Transmit response back via radio
```

### 4. Web Worker Execution

Server apps run in dedicated Web Workers for true isolation:

```javascript
// server-app.worker.js
class ServerAppWorker {
  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
    this.apps = new Map();
  }

  async handleMessage(event) {
    const { type, appName, request, appCode } = event.data;
    
    switch(type) {
      case 'LOAD_APP':
        await this.loadApp(appName, appCode);
        break;
        
      case 'HANDLE_REQUEST':
        // Verify request signature first
        if (!await this.verifyRequestSignature(request)) {
          self.postMessage({
            type: 'RESPONSE',
            response: {
              status: 401,
              body: 'Invalid signature'
            }
          });
          return;
        }
        
        const response = await this.handleRequest(appName, request);
        self.postMessage({ type: 'RESPONSE', response });
        break;
    }
  }
  
  async verifyRequestSignature(request) {
    // Verify the request signature using Web Crypto API
    const publicKey = await this.getPublicKey(request.fromCallsign);
    const signature = request.headers['X-Radio-Signature'];
    const data = request.method + request.path + request.body;
    
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      new TextEncoder().encode(data)
    );
  }
  
  async handleRequest(appName, request) {
    const app = this.apps.get(appName);
    const handler = app.endpoints[`${request.method} ${request.path}`];
    
    // Create isolated store for this app
    const store = new AppDataStore(appName);
    
    // Execute handler with verified request
    return await handler(request, store);
  }
}
```

## Server App Examples

### Contact Form
```javascript
export default {
  name: 'Contact Form',
  endpoints: {
    'GET /contact': async (req, store) => {
      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <form method="POST" action="/contact/submit">
            <label>Your Callsign: <input name="from" required></label>
            <label>Subject: <input name="subject" required></label>
            <label>Message: <textarea name="message" required></textarea></label>
            <button type="submit">Send</button>
          </form>
        `
      };
    },
    
    'POST /contact/submit': async (req, store) => {
      await store.add('messages', {
        from: req.body.from,
        subject: req.body.subject,
        message: req.body.message,
        received: new Date().toISOString()
      });
      
      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>Message received! Thank you.</h1>'
      };
    },
    
    'GET /contact/inbox': async (req, store) => {
      const messages = await store.getAll('messages');
      // Return inbox view...
    }
  }
};
```

### Emergency Info
```javascript
export default {
  name: 'Emergency Information',
  endpoints: {
    'GET /emergency': async (req, store) => {
      const info = await store.get('current-status');
      return {
        status: 200,
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        },
        body: `
          <h1>Emergency Status - ${info.callsign}</h1>
          <p>Status: ${info.status}</p>
          <p>Location: ${info.location}</p>
          <p>Needs: ${info.needs}</p>
          <p>Updated: ${info.updated}</p>
        `
      };
    }
  }
};
```

### File Sharing
```javascript
export default {
  name: 'File Repository',
  endpoints: {
    'GET /files': async (req, store) => {
      const files = await store.getAll('files');
      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <h1>Shared Files</h1>
          <ul>
            ${files.map(f => `
              <li>
                <a href="/files/${f.id}">${f.name}</a>
                (${f.size} bytes)
              </li>
            `).join('')}
          </ul>
        `
      };
    },
    
    'GET /files/:id': async (req, store) => {
      const file = await store.get('files', req.params.id);
      return {
        status: 200,
        headers: { 
          'Content-Type': file.mimeType,
          'Content-Disposition': `attachment; filename="${file.name}"`
        },
        body: file.content
      };
    }
  }
};
```

## App Management Interface

### Creating Apps
```typescript
interface ServerAppCreator {
  name: string;
  description: string;
  version: string;
  endpoints: EndpointDefinition[];
}

interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: string; // JavaScript code as string
}
```

### App Editor UI
```
┌─────────────────────────────────────────┐
│        Create Server App                │
├─────────────────────────────────────────┤
│ Name: [Guestbook_________]              │
│ Version: [1.0.0__________]              │
│                                         │
│ Endpoints:                              │
│ ┌─────────────────────────────────────┐ │
│ │ GET /guestbook                      │ │
│ │ [Edit Handler Code]                 │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ POST /guestbook/sign                │ │
│ │ [Edit Handler Code]                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ Add Endpoint]                        │
│                                         │
│ [Test App] [Save App] [Deploy]          │
└─────────────────────────────────────────┘
```

## Security Model

### Sandboxing
- Apps run in restricted JavaScript environment
- No access to PWA's Web Serial or Audio APIs
- No access to other apps' data stores
- No network access (everything via radio)
- Memory and CPU limits enforced

### Authentication
- Requests include sender's callsign
- Verified against signing list
- Apps can check `req.authenticated` flag
- Trust level available in `req.trustLevel`

### Data Isolation
```
app-data/
├── guestbook/        # Only guestbook app can access
├── contact-form/     # Only contact-form app can access
└── emergency-info/   # Only emergency-info app can access
```

## Request Signing & Verification

### Signing Process
Every HTTP request transmitted over radio is cryptographically signed:

```javascript
class RequestSigner {
  async signRequest(request, privateKey) {
    // Create canonical request string
    const canonical = [
      request.method,
      request.path,
      request.headers['X-Radio-Timestamp'],
      request.fromCallsign,
      request.body || ''
    ].join('\n');
    
    // Sign with private key
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(canonical)
    );
    
    // Add signature to headers
    request.headers['X-Radio-Signature'] = btoa(String.fromCharCode(...new Uint8Array(signature)));
    request.headers['X-Radio-Callsign'] = request.fromCallsign;
    request.headers['X-Radio-Timestamp'] = new Date().toISOString();
    
    return request;
  }
}
```

### Verification in Web Worker
```javascript
class RequestVerifier {
  async verifyRequest(request, signingList) {
    // Get sender's public key from signing list
    const entry = signingList.find(e => e.callsign === request.headers['X-Radio-Callsign']);
    if (!entry) return { valid: false, reason: 'Unknown callsign' };
    
    // Check timestamp (prevent replay attacks)
    const timestamp = new Date(request.headers['X-Radio-Timestamp']);
    const now = new Date();
    const ageMinutes = (now - timestamp) / 60000;
    if (ageMinutes > 30) return { valid: false, reason: 'Request too old' };
    
    // Verify signature
    const canonical = [
      request.method,
      request.path,
      request.headers['X-Radio-Timestamp'],
      request.headers['X-Radio-Callsign'],
      request.body || ''
    ].join('\n');
    
    const publicKey = await crypto.subtle.importKey(
      'spki',
      entry.publicKeyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(atob(request.headers['X-Radio-Signature']), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      new TextEncoder().encode(canonical)
    );
    
    return { 
      valid, 
      trustLevel: entry.trustLevel,
      callsign: entry.callsign 
    };
  }
}
```

## HTTP Request/Response Objects

### Request Object
```typescript
interface ServerAppRequest {
  method: string;
  path: string;
  params: Record<string, string>;  // URL parameters
  query: Record<string, string>;   // Query string
  headers: Record<string, string>;
  body: any;  // Parsed form data or JSON
  
  // Signature headers (always present)
  'X-Radio-Signature': string;     // Cryptographic signature
  'X-Radio-Callsign': string;      // Sender's callsign
  'X-Radio-Timestamp': string;     // ISO timestamp
  
  // Verified radio-specific data
  fromCallsign: string;            // Verified from signature
  authenticated: boolean;          // Signature valid
  trustLevel: number;             // From signing list
  hops: number;                   // Network hops
  signalStrength: number;         // Radio signal strength
}
```

### Response Object
```typescript
interface ServerAppResponse {
  status: number;
  headers: Record<string, string>;
  body: string | Uint8Array;
}
```

### Data Store API
```typescript
interface AppDataStore {
  get(collection: string, key: string): Promise<any>;
  getAll(collection: string): Promise<any[]>;
  add(collection: string, data: any): Promise<void>;
  update(collection: string, key: string, data: any): Promise<void>;
  delete(collection: string, key: string): Promise<void>;
  clear(collection: string): Promise<void>;
}
```

## Deployment

### Local Testing
Apps can be tested locally before "going live":
1. Create app in editor
2. Test with mock requests
3. View generated responses
4. Check data store operations
5. Deploy when ready

### App Distribution
Server apps can be shared:
1. Export as JSON file
2. Share at hamfests or online
3. Import into other stations
4. Apps remain local - no central repository

## Benefits

1. **No Backend Needed**: Everything runs in the browser
2. **True Serverless**: Each station is its own server
3. **Privacy**: Data stays on operator's machine
4. **Flexibility**: Create any type of application
5. **Offline**: Works without internet
6. **Secure**: Sandboxed execution environment

---
*This architecture enables true peer-to-peer applications over ham radio.*