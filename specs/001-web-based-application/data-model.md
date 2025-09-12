# Data Model: Ham Radio Web Application

## Core Entities

### RadioStation
Represents a ham radio operator's station configuration and status.

**Fields**:
- `callsign`: string (primary key) - Amateur radio callsign (e.g., "KA1ABC")
- `operatorName`: string - Full name of the operator
- `gridSquare`: string - Maidenhead grid locator (e.g., "FN31pr")
- `radioModel`: string - Radio model identifier (e.g., "IC-7300")
- `catInterface`: object - CAT control configuration
  - `port`: string - Serial port path
  - `baudRate`: number - Serial baud rate
  - `dataBits`: number - Data bits (7 or 8)
  - `stopBits`: number - Stop bits (1 or 2)
  - `parity`: string - Parity (none, even, odd)
- `audioInterface`: object - Audio interface configuration
  - `inputDevice`: string - Audio input device ID
  - `outputDevice`: string - Audio output device ID
  - `pttMethod`: string - PTT control method (CAT, RTS, DTR, VOX)
- `connectionStatus`: enum - Current connection state
  - Values: 'disconnected', 'connecting', 'connected', 'error'
- `lastSeen`: datetime - Last activity timestamp
- `certificate`: string - Base64 encoded station certificate

**Validation**:
- Callsign must match amateur radio format
- Grid square must be valid Maidenhead format
- Audio devices must exist on system

### Resource
Represents an HTTP resource (HTML page, form, file) served over radio.

**Fields**:
- `url`: string (primary key) - URL format: `http://callsign.radio/path`
- `callsign`: string - Host station callsign
- `path`: string - URL path component
- `contentType`: string - MIME type (text/html, application/json, etc.)
- `content`: text - HTML, JSON, or other content
- `headers`: object - HTTP headers
  - `Last-Modified`: datetime
  - `ETag`: string - Entity tag for caching
  - `Cache-Control`: string - Caching directives
  - `Content-Encoding`: string - Compression if used
- `checksum`: string - SHA-256 hash of content
- `size`: number - Resource size in bytes
- `compressed`: boolean - Whether content is compressed
- `retentionPolicy`: string - Cache retention rule

**Validation**:
- ID must be unique across network
- Checksum must match content
- Retention policy must be valid rule

### HttpRequest
Represents an HTTP request to be transmitted over radio.

**Fields**:
- `id`: uuid (primary key) - Request identifier
- `method`: string - HTTP method (GET, POST, PUT, DELETE)
- `url`: string - Target URL (http://callsign.radio/path)
- `headers`: object - HTTP request headers
  - `Host`: string - Target callsign.radio
  - `User-Agent`: string - Client identifier
  - `Accept`: string - Accepted content types
  - `Content-Type`: string - Body content type (for POST/PUT)
  - `If-None-Match`: string - ETag for conditional GET (cache validation)
  - `If-Match`: string - ETag for conditional PUT/DELETE (optimistic locking)
  - `X-Request-ID`: string - Unique request ID for idempotency
- `body`: text - Request body (for POST/PUT)
- `bodyETag`: string - ETag of request body for deduplication
- `sourceCallsign`: string - Requesting station
- `priority`: number - Request priority (0-9)
- `timeout`: number - Request timeout in seconds
- `created`: datetime - Request creation time
- `maxHops`: number - Maximum hops allowed
- `idempotencyKey`: string - Key for idempotent request processing

### HttpResponse
Represents an HTTP response transmitted over radio.

**Fields**:
- `id`: uuid (primary key) - Response identifier
- `requestId`: uuid - Original request ID
- `statusCode`: number - HTTP status code
- `statusText`: string - HTTP status text
- `headers`: object - HTTP response headers
  - `Content-Type`: string
  - `Content-Length`: number
  - `Last-Modified`: datetime
  - `ETag`: string
  - `Cache-Control`: string
- `body`: text - Response body
- `compressed`: boolean - Whether body is compressed
- `size`: number - Total response size

### Transmission
Represents a radio transmission of HTTP traffic.

**Fields**:
- `id`: uuid (primary key) - Unique transmission identifier
- `requestId`: uuid - Associated HTTP request (nullable)
- `responseId`: uuid - Associated HTTP response (nullable)
- `sourceCallsign`: string - Transmitting station
- `destinationCallsign`: string - Target station (or next hop)
- `frequency`: number - Transmission frequency in Hz
- `mode`: string - Transmission mode ("QPSK-2.8k")
- `startTime`: datetime - Transmission start
- `endTime`: datetime - Transmission end (nullable)
- `status`: enum - Current transmission state
  - Values: 'pending', 'transmitting', 'completed', 'failed', 'retrying'
- `retryCount`: number - Number of retry attempts
- `errorRate`: number - Bit error rate (0.0-1.0)
- `acknowledgment`: boolean - Whether ACK received
- `fragments`: array - For multi-part transmissions
  - `sequenceNumber`: number
  - `totalFragments`: number
  - `checksum`: string

**Validation**:
- Frequency must be in amateur bands
- Retry count must not exceed maximum
- Error rate triggers adaptive coding

### BandwidthPolicy
Controls resource size and content filtering for radio transmission.

**Fields**:
- `id`: string (primary key) - Policy identifier
- `name`: string - Policy name (e.g., "HF-2.8k", "VHF-9.6k")
- `maxResourceSize`: number - Maximum size in bytes
- `maxRequestSize`: number - Maximum request size
- `allowedContentTypes`: array - Permitted MIME types
  - "text/html"
  - "text/plain"
  - "application/json"
  - "text/css" (minified only)
- `compressionRequired`: boolean - Force compression
- `stripWhitespace`: boolean - Remove unnecessary whitespace
- `inlineOnly`: boolean - No external resource references
- `jsPolicy`: enum - JavaScript handling
  - Values: 'none', 'inline-only', 'critical-only'
- `maxInlineScriptSize`: number - Max inline JS size (bytes)
- `cssPolicy`: enum - CSS handling
  - Values: 'none', 'inline-only', 'critical-only'
- `imagePolicy`: enum - Image handling
  - Values: 'none', 'data-uri-only', 'ascii-art'

### MeshNode
Represents a node in the mesh network.

**Fields**:
- `callsign`: string (primary key) - Node's amateur callsign
- `publicKey`: string - Node's public key for verification
- `lastHeard`: datetime - Last time node was heard
- `linkQuality`: number - Link quality metric (0-100)
- `hopCount`: number - Hops to reach this node
- `nextHop`: string - Callsign of next hop (nullable)
- `routingTable`: array - Known routes through this node
  - `destination`: string - Target callsign
  - `metric`: number - Route quality metric
  - `updated`: datetime - Route last updated
- `capabilities`: object - Node capabilities
  - `maxBandwidth`: number - Maximum data rate
  - `supportedModes`: array - Supported transmission modes
  - `meshVersion`: string - Protocol version
- `documentCatalog`: array - Documents available at node (metadata only)
  - `documentId`: string
  - `size`: number
  - `modified`: datetime
  - `checksum`: string

**Validation**:
- Public key must be valid format
- Link quality based on SNR and success rate
- Routing loops must be prevented

### Certificate
Represents a digital certificate for station authentication.

**Fields**:
- `id`: uuid (primary key) - Certificate identifier
- `callsign`: string - Station callsign
- `publicKey`: text - RSA public key (PEM format)
- `signature`: text - Certificate signature
- `issuer`: string - Issuing authority (root CA or self)
- `issuedAt`: datetime - Issue timestamp
- `expiresAt`: datetime - Expiration timestamp
- `revoked`: boolean - Revocation status
- `revokedAt`: datetime - Revocation timestamp (nullable)
- `revokedReason`: string - Revocation reason (nullable)

**Validation**:
- Signature must be valid
- Expiration must be future date on issue
- Callsign must match certificate CN

### TransmissionLog
Audit log of all transmissions for FCC compliance.

**Fields**:
- `id`: uuid (primary key) - Log entry identifier
- `timestamp`: datetime - Transmission time
- `callsign`: string - Operating station
- `frequency`: number - Operating frequency
- `mode`: string - Transmission mode
- `power`: number - Transmission power in watts
- `direction`: enum - 'transmit' or 'receive'
- `remoteCallsign`: string - Other station involved
- `duration`: number - Transmission duration in seconds
- `content`: string - Content description (not encrypted)

**Validation**:
- Required for FCC Part 97 compliance
- Must be retained for minimum period
- Cannot be modified after creation

## Relationships

```
RadioStation (1) ←→ (N) Resource (hosts)
RadioStation (1) ←→ (N) HttpRequest (originates)
RadioStation (1) ←→ (N) Transmission
RadioStation (1) ←→ (1) Certificate
RadioStation (1) ←→ (1) MeshNode

HttpRequest (1) ←→ (1) HttpResponse
HttpRequest (1) ←→ (N) Transmission (forwarded)
HttpResponse (1) ←→ (N) Transmission

Resource (N) ←→ (N) MeshNode (cached)

MeshNode (N) ←→ (N) MeshNode (via routingTable)
MeshNode (1) ←→ (1) BandwidthPolicy

Certificate (1) ←→ (1) RadioStation
Certificate (1) ←→ (1) MeshNode

TransmissionLog (N) ←→ (1) RadioStation
```

## State Transitions

### Transmission States
```
pending → transmitting → completed
        ↓            ↓
        → retrying → failed
```

### Connection States
```
disconnected → connecting → connected
           ↓             ↓
           → error ←
```

### HTTP Request Lifecycle
```
created → queued → transmitting → forwarded → delivered → responded
           ↓            ↓            ↓           ↓
           → timeout    → failed     → retry    → expired
```

### Resource Caching
```
requested → fetching → cached → validated → stale → purged
              ↓          ↓         ↓
              → failed   → hit     → revalidate
```

## Indexes

For optimal query performance:
- `documents_by_callsign`: (callsign, filePath)
- `transmissions_by_status`: (status, startTime)
- `nodes_by_quality`: (linkQuality DESC, lastHeard DESC)
- `routes_by_destination`: (destination, metric)
- `logs_by_date`: (timestamp, callsign)

## Data Constraints

1. **Callsign Uniqueness**: Callsigns are globally unique
2. **Document Deduplication**: Same document ID cannot exist twice
3. **Frequency Validation**: Must be within amateur radio bands
4. **Retention Enforcement**: Documents past retention must be purged
5. **Certificate Chain**: All certificates must chain to root CA
6. **Route Loop Prevention**: Routing table cannot contain cycles
7. **Transmission Logging**: All TX/RX must be logged immediately

---
*Data model version 1.0.0*