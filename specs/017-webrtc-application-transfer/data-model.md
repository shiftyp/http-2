# Data Model: Distributed Servers

## Core Entities

### Certificate
Primary entity for trust and authentication.

```typescript
interface Certificate {
  // Identity
  fingerprint: string;          // SHA-256 hash of certificate
  serialNumber: string;         // Unique certificate ID

  // Subject Info
  subject: {
    commonName: string;         // Callsign (e.g., "W1AW")
    organization?: string;      // Optional org (e.g., "ARRL")
    country: string;           // Country code (e.g., "US")
  };

  // Issuer Info
  issuer: {
    commonName: string;         // Issuer's callsign
    organization?: string;
    country: string;
  };

  // Validity
  notBefore: Date;             // Valid from
  notAfter: Date;              // Valid until (or null for no expiry)

  // Public Key
  publicKey: string;           // PEM encoded public key
  signatureAlgorithm: string;  // e.g., "RSA-SHA256"
  signature: string;           // Certificate signature

  // Amateur Radio Extensions
  extensions: {
    callsign: string;          // Amateur callsign
    licenseClass: 'Technician' | 'General' | 'Extra';
    canIssue: boolean;         // Can act as CA
    issuerChain: string[];     // Array of issuer fingerprints
  };

  // Certificate Chain
  chain: Certificate[];        // Full chain to root
}
```

**Validation Rules**:
- Fingerprint must be unique
- Signature must be valid
- Chain must terminate at trusted root
- Callsign must match subject.commonName
- No expiry validation (certificates don't expire)

**State Transitions**:
- PENDING → VERIFIED (after chain validation)
- VERIFIED → BLACKLISTED (if revoked locally)
- VERIFIED → TRUSTED (if added to trust store)

### ServerInfo
Represents a distributed server instance.

```typescript
interface ServerInfo {
  // Identity
  id: string;                  // UUID for this server instance
  callsign: string;            // Owner's callsign
  certificateFingerprint: string; // Owner's certificate

  // Network Info
  endpoint: string;            // HTTP endpoint (e.g., "192.168.1.100:8080")
  signalingUrl: string;        // WebSocket URL for signaling
  discoveryMethod: 'localhost' | 'mdns' | 'manual' | 'cq' | 'peer';

  // Capabilities
  capabilities: {
    signaling: boolean;        // WebRTC signaling relay
    certificateAuthority: boolean; // Can issue certificates
    contentCache: boolean;     // Caches content
    meshRelay: boolean;        // Relays mesh traffic
  };

  // Status
  state: 'unclaimed' | 'claimed' | 'active' | 'unreachable';
  lastSeen: Date;
  connectionQuality: number;   // 0-100 quality score

  // Statistics
  stats: {
    connectedClients: number;
    certificatesIssued: number;
    uptime: number;            // Seconds
    bytesRelayed: number;
  };
}
```

**Validation Rules**:
- Endpoint must be valid URL format
- Callsign required when state is 'claimed' or 'active'
- Certificate required for 'claimed' state transition

**State Transitions**:
- UNCLAIMED → CLAIMED (first licensed operator connects)
- CLAIMED → ACTIVE (server fully operational)
- ACTIVE → UNREACHABLE (connection lost)
- UNREACHABLE → ACTIVE (connection restored)

### SignalingSession
WebRTC signaling session between peers.

```typescript
interface SignalingSession {
  // Session Identity
  sessionId: string;           // UUID
  timestamp: Date;

  // Participants
  initiator: {
    clientId: string;
    callsign?: string;
    certificateFingerprint?: string;
  };

  target: {
    clientId: string;
    callsign?: string;
    certificateFingerprint?: string;
  };

  // Signaling State
  state: 'pending' | 'offer_sent' | 'answer_sent' | 'connected' | 'failed';

  // Messages
  offer?: RTCSessionDescription;
  answer?: RTCSessionDescription;
  iceCandidates: RTCIceCandidate[];

  // Metadata
  serverEndpoint: string;      // Which server is relaying
  protocol: 'webrtc';
  purpose: 'content_transfer' | 'mesh_sync' | 'general';
}
```

**Validation Rules**:
- SessionId must be unique
- Initiator and target must be different
- State transitions must be sequential

**State Transitions**:
- PENDING → OFFER_SENT
- OFFER_SENT → ANSWER_SENT
- ANSWER_SENT → CONNECTED
- Any state → FAILED (on error/timeout)

### ContentCatalog
Index of content available on a server.

```typescript
interface ContentCatalog {
  // Catalog Identity
  serverId: string;            // Server UUID
  callsign: string;
  lastUpdated: Date;

  // Content Entries
  entries: ContentEntry[];

  // Metadata
  totalSize: number;           // Total bytes
  entryCount: number;
  priority: 'essential' | 'popular' | 'standard' | 'personal';
}

interface ContentEntry {
  // Content Identity
  path: string;                // URL path (e.g., "/emergency-info")
  hash: string;                // SHA-256 content hash

  // Metadata
  size: number;                // Size in bytes
  contentType: string;         // MIME type
  created: Date;
  modified: Date;

  // Ownership
  origin: string;              // Creating callsign
  signature: string;           // Content signature

  // Replication
  priority: number;            // 1-4 (1 = essential)
  replicas: string[];          // Callsigns with copies
}
```

**Validation Rules**:
- Path must be unique within catalog
- Hash must match content
- Signature must be valid for origin certificate
- Priority 1 content must be replicated

### MeshDirectory
Network topology and routing information.

```typescript
interface MeshDirectory {
  // Directory Version
  version: number;
  timestamp: Date;

  // Network Nodes
  nodes: MeshNode[];

  // Routing Table
  routes: Route[];
}

interface MeshNode {
  callsign: string;
  endpoint: string;
  capabilities: string[];
  neighbors: string[];         // Direct connections
  hopCount: number;            // Hops from this node
  lastHeard: Date;
  signalStrength?: number;     // For RF connections
}

interface Route {
  destination: string;         // Target callsign
  nextHop: string;             // Next node in path
  hopCount: number;
  metric: number;              // Route quality (lower = better)
  protocol: 'direct' | 'mdns' | 'rf' | 'relay';
}
```

**Validation Rules**:
- Callsigns must be unique
- Routes must not create loops
- Hop count must be reasonable (<10)

## Relationships

### Certificate Relationships
- Certificate → Certificate (issuer chain, many-to-one)
- Certificate → ServerInfo (ownership, one-to-many)
- Certificate → ContentEntry (signature, one-to-many)

### Server Relationships
- ServerInfo → Certificate (owner, many-to-one)
- ServerInfo → SignalingSession (relay, one-to-many)
- ServerInfo → ContentCatalog (hosts, one-to-one)
- ServerInfo → MeshNode (represents, one-to-one)

### Content Relationships
- ContentCatalog → ServerInfo (hosted by, many-to-one)
- ContentEntry → Certificate (signed by, many-to-one)
- ContentEntry → MeshNode (replicated at, many-to-many)

## Storage Schemas

### SQLite Schema (Server)
```sql
-- Certificates table
CREATE TABLE certificates (
  fingerprint TEXT PRIMARY KEY,
  serial_number TEXT UNIQUE,
  subject_cn TEXT NOT NULL,
  issuer_cn TEXT,
  certificate_pem TEXT NOT NULL,
  chain_json TEXT,
  callsign TEXT,
  license_class TEXT,
  can_issue BOOLEAN DEFAULT FALSE,
  added_date INTEGER,
  last_verified INTEGER,
  trust_level TEXT CHECK(trust_level IN ('root', 'intermediate', 'peer'))
);

CREATE INDEX idx_callsign ON certificates(callsign);
CREATE INDEX idx_issuer ON certificates(issuer_cn);

-- Blacklist table
CREATE TABLE blacklist (
  fingerprint TEXT PRIMARY KEY,
  reason TEXT,
  blacklisted_date INTEGER,
  blacklisted_by TEXT
);

-- Peer servers table
CREATE TABLE peer_servers (
  endpoint TEXT PRIMARY KEY,
  callsign TEXT,
  capabilities_json TEXT,
  last_contact INTEGER,
  discovery_method TEXT
);

-- Content catalog table
CREATE TABLE content_catalog (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  size INTEGER,
  content_type TEXT,
  origin_callsign TEXT,
  signature TEXT,
  priority INTEGER,
  created INTEGER,
  modified INTEGER
);

CREATE INDEX idx_content_hash ON content_catalog(hash);
CREATE INDEX idx_content_origin ON content_catalog(origin_callsign);
```

### IndexedDB Schema (PWA)
```typescript
// Database: 'distributed-servers'
// Version: 1

// Object Stores:
const stores = {
  'certificates': {
    keyPath: 'fingerprint',
    indexes: [
      { name: 'callsign', keyPath: 'extensions.callsign' },
      { name: 'trust', keyPath: 'trustLevel' }
    ]
  },
  'servers': {
    keyPath: 'id',
    indexes: [
      { name: 'callsign', keyPath: 'callsign' },
      { name: 'endpoint', keyPath: 'endpoint', unique: true },
      { name: 'state', keyPath: 'state' }
    ]
  },
  'signaling_sessions': {
    keyPath: 'sessionId',
    indexes: [
      { name: 'state', keyPath: 'state' },
      { name: 'timestamp', keyPath: 'timestamp' }
    ]
  },
  'content_cache': {
    keyPath: 'path',
    indexes: [
      { name: 'hash', keyPath: 'hash' },
      { name: 'priority', keyPath: 'priority' }
    ]
  }
};
```

## Data Constraints

### Size Limits
- Certificate: Max 10KB per certificate
- Certificate Chain: Max 10 certificates deep
- Content Path: Max 255 characters
- Signaling Message: Max 64KB
- Content Entry: Max 100MB per file

### Rate Limits
- Certificate Issuance: 10 per hour per CA
- Signaling Sessions: 100 concurrent per server
- Content Sync: 10% of bandwidth max
- Discovery Beacons: 1 per minute

### Retention Policies
- Certificates: Permanent (no expiry)
- Blacklist: Permanent until manually cleared
- Signaling Sessions: 24 hours after completion
- Content Cache: LRU eviction when full
- Server Stats: 30 days rolling window