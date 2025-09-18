# Data Model: Certificate Management

**Date**: 2025-09-18
**Feature**: Certificate Management for Amateur Radio HTTP Communication

## Core Entities

### 1. Certificate

Represents an X.509 certificate with amateur radio extensions for station identification.

```typescript
interface Certificate {
  // Primary identification
  id: string;                    // Unique certificate identifier
  callsign: string;             // Amateur radio callsign
  type: CertificateType;        // 'self-signed' | 'arrl' | 'lotw'

  // Certificate data
  x509Data: ArrayBuffer;        // Raw X.509 certificate DER
  publicKeyPem: string;         // PEM-encoded public key
  privateKeyPem?: string;       // PEM-encoded private key (client only)

  // Amateur radio extensions
  licenseClass: string;         // 'extra' | 'advanced' | 'general' | 'technician' | 'novice'
  gridSquare?: string;          // Maidenhead grid locator

  // Metadata
  issuer: string;               // Certificate issuer DN
  subject: string;              // Certificate subject DN
  serialNumber: string;         // Certificate serial number

  // Validity
  validFrom: string;            // ISO 8601 timestamp
  validTo: string;              // ISO 8601 timestamp
  isRevoked: boolean;           // Revocation status

  // Trust and approval
  trustLevel: TrustLevel;       // 0=unknown, 1=self-signed, 2=arrl, 3=lotw
  approvedServers: string[];    // List of server callsigns that approved this cert

  // Timestamps
  createdAt: string;            // ISO 8601 timestamp
  lastUsedAt?: string;          // ISO 8601 timestamp

  // Storage metadata
  storageLocation: 'indexeddb' | 'server' | 'both';
}

enum CertificateType {
  SELF_SIGNED = 'self-signed',
  ARRL = 'arrl',
  LOTW = 'lotw'
}

enum TrustLevel {
  UNKNOWN = 0,
  SELF_SIGNED = 1,
  ARRL = 2,
  LOTW = 3
}
```

### 2. CertificateRequest

Represents a pending request for certificate approval on a server.

```typescript
interface CertificateRequest {
  // Primary identification
  id: string;                   // Unique request identifier
  certificateId: string;        // Reference to Certificate.id

  // Request details
  callsign: string;             // Requesting station callsign
  serverCallsign: string;       // Server receiving the request

  // Station information
  stationInfo: StationInfo;     // Details about requesting station

  // Certificate data (for approval review)
  certificateType: CertificateType;
  licenseClass: string;
  gridSquare?: string;
  publicKeyPem: string;         // Public key for verification

  // CAPTCHA verification
  captchaChallenge?: CAPTCHAChallenge;
  captchaSolution?: SignedCAPTCHASolution;
  captchaVerified: boolean;

  // Request status
  status: RequestStatus;        // 'pending' | 'approved' | 'rejected' | 'expired'
  submittedAt: string;          // ISO 8601 timestamp
  reviewedAt?: string;          // ISO 8601 timestamp
  reviewedBy?: string;          // Server operator callsign

  // Decision details
  approvalRecord?: ApprovalRecord;
  rejectionReason?: string;

  // Metadata
  requestSource: 'auto' | 'manual';  // Auto on first connect vs manual request
  retryCount: number;           // Number of submission attempts
  expiresAt: string;            // ISO 8601 timestamp (auto-expire pending requests)
}

interface StationInfo {
  callsign: string;
  licenseClass: string;
  gridSquare?: string;
  location?: string;            // Human-readable location
  equipment?: string;           // Radio equipment description
  antenna?: string;             // Antenna system description
  power?: number;               // Transmit power in watts
}

enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}
```

### 3. CAPTCHAChallenge

Represents a radio-optimized verification challenge.

```typescript
interface CAPTCHAChallenge {
  // Primary identification
  id: string;                   // Unique challenge identifier
  serverCallsign: string;       // Server that generated the challenge

  // Challenge details
  type: ChallengeType;          // Type of challenge
  question: string;             // Challenge question text
  expectedAnswer: string;       // Correct answer (server-side only)
  answerHash: string;           // SHA-256 hash of correct answer

  // Challenge options (for multiple choice)
  options?: string[];           // Array of possible answers
  correctIndex?: number;        // Index of correct answer (server-side only)

  // Metadata
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;             // 'math' | 'ham_knowledge' | 'pattern' | 'geography'

  // Validity
  generatedAt: string;          // ISO 8601 timestamp
  expiresAt: string;            // ISO 8601 timestamp (challenges expire in 1 hour)

  // Signature
  signature: string;            // Server signature to prevent tampering

  // Usage tracking
  usedBy: string[];             // Callsigns that have used this challenge
  maxUses: number;              // Maximum number of uses (default: 1)
}

enum ChallengeType {
  MATH = 'math',
  HAM_KNOWLEDGE = 'ham_knowledge',
  PATTERN = 'pattern',
  GEOGRAPHY = 'geography',
  MULTIPLE_CHOICE = 'multiple_choice'
}
```

### 4. SignedCAPTCHASolution

Represents a CAPTCHA solution signed by the originating certificate.

```typescript
interface SignedCAPTCHASolution {
  // Primary identification
  id: string;                   // Unique solution identifier
  challengeId: string;          // Reference to CAPTCHAChallenge.id

  // Solution details
  answer: string;               // The submitted answer
  solutionHash: string;         // SHA-256 hash of the answer

  // Signing details
  solvedBy: string;             // Callsign of solver
  signingCertificateId: string; // Certificate used to sign
  signature: string;            // Digital signature of solution

  // Timestamps
  solvedAt: string;             // ISO 8601 timestamp

  // Verification status
  isValid: boolean;             // Whether solution is correct
  verifiedAt?: string;          // When verification occurred
  verifiedBy?: string;          // Server that verified

  // Usage tracking
  usedForRequests: string[];    // CertificateRequest IDs that used this solution

  // Metadata
  compressionSize: number;      // Size in bytes when compressed for transmission
}
```

### 5. ApprovalRecord

Represents a server operator's decision on a certificate request.

```typescript
interface ApprovalRecord {
  // Primary identification
  id: string;                   // Unique approval record identifier
  requestId: string;            // Reference to CertificateRequest.id

  // Approval details
  decision: 'approved' | 'rejected';
  approvedBy: string;           // Server operator callsign
  approvedAt: string;           // ISO 8601 timestamp

  // Trust assignment
  assignedTrustLevel: TrustLevel;
  trustJustification: string;   // Reason for trust level assignment

  // Conditions and restrictions
  conditions?: string[];        // Any conditions of approval
  restrictions?: string[];      // Any usage restrictions
  expiresAt?: string;           // Approval expiration (ISO 8601)

  // Review notes
  reviewNotes?: string;         // Private notes from operator
  publicNotes?: string;         // Notes visible to certificate holder

  // Metadata
  reviewDuration: number;       // Time taken to review (milliseconds)
  isAppeal: boolean;            // Whether this is an appeal of previous rejection
}
```

### 6. BanRecord

Represents a certificate ban (distinguished from revocation).

```typescript
interface BanRecord {
  // Primary identification
  id: string;                   // Unique ban record identifier
  certificateId: string;        // Reference to Certificate.id
  bannedCallsign: string;       // Callsign that is banned

  // Ban details
  banningServer: string;        // Server callsign that issued the ban
  bannedBy: string;             // Operator callsign that issued the ban
  bannedAt: string;             // ISO 8601 timestamp

  // Ban scope
  banType: 'server' | 'network'; // Server-local or network-wide ban
  severity: 'warning' | 'temporary' | 'permanent';

  // Duration
  expiresAt?: string;           // ISO 8601 timestamp (for temporary bans)

  // Justification
  reason: string;               // Reason for ban
  evidence?: string[];          // Supporting evidence (log entries, etc.)

  // Ban distribution
  broadcastEnabled: boolean;    // Whether to broadcast ban when hearing CQ
  acknowledgedBy: string[];     // Servers that have acknowledged the ban

  // Appeal process
  appealAllowed: boolean;       // Whether appeals are accepted
  appealDeadline?: string;      // Deadline for appeals (ISO 8601)

  // Metadata
  isActive: boolean;            // Whether ban is currently in effect
  revokedAt?: string;           // When ban was revoked (ISO 8601)
  revokedBy?: string;           // Who revoked the ban
}
```

### 7. TrustChain

Represents certificate trust relationships and lineage.

```typescript
interface TrustChain {
  // Primary identification
  id: string;                   // Unique trust chain identifier
  rootCertificateId: string;    // Root certificate in the chain
  leafCertificateId: string;    // End certificate in the chain

  // Chain structure
  chainPath: string[];          // Array of certificate IDs from root to leaf
  chainDepth: number;           // Number of certificates in chain

  // Trust calculation
  trustScore: number;           // Calculated trust score (0-100)
  trustFactors: TrustFactor[];  // Factors contributing to trust score

  // Validation
  isValid: boolean;             // Whether chain is currently valid
  lastValidated: string;        // ISO 8601 timestamp of last validation
  validatedBy: string[];        // Servers that have validated this chain

  // Consensus
  consensusCount: number;       // Number of servers agreeing on this chain
  consensusThreshold: number;   // Required consensus for acceptance

  // Chain metadata
  establishedAt: string;        // When trust chain was first established
  lastUsedAt: string;           // When chain was last used for verification

  // Expiration and refresh
  expiresAt: string;            // When chain expires without refresh
  refreshInterval: number;      // How often to refresh chain (seconds)

  // Path quality metrics
  pathReliability: number;      // Reliability score based on intermediate nodes
  pathLatency: number;          // Average verification latency (milliseconds)
}

interface TrustFactor {
  factor: string;               // Name of trust factor
  weight: number;               // Weight in trust calculation (0-1)
  value: number;                // Factor value (0-1)
  description: string;          // Human-readable description
}
```

## Relationships

### Certificate ↔ CertificateRequest
- One certificate can have multiple requests (to different servers)
- One request references exactly one certificate

### CertificateRequest ↔ CAPTCHAChallenge
- One request can have one active challenge
- One challenge can be used by multiple requests (within limits)

### CertificateRequest ↔ SignedCAPTCHASolution
- One request can have one solution
- One solution can be reused for multiple requests (signed solutions are forever valid)

### CertificateRequest ↔ ApprovalRecord
- One request has zero or one approval record
- One approval record belongs to exactly one request

### Certificate ↔ BanRecord
- One certificate can have multiple ban records (from different servers)
- One ban record affects exactly one certificate

### Certificate ↔ TrustChain
- One certificate can participate in multiple trust chains
- One trust chain connects multiple certificates

## Storage Patterns

### IndexedDB Stores (Client)

```typescript
// Store: 'certificates'
// Primary key: id
// Indexes: 'by_callsign', 'by_type', 'by_trust_level', 'by_expiration'

// Store: 'certificate_requests'
// Primary key: id
// Indexes: 'by_callsign', 'by_server', 'by_status', 'by_submitted_at'

// Store: 'captcha_solutions'
// Primary key: id
// Indexes: 'by_solver', 'by_challenge_id', 'by_solved_at'

// Store: 'trust_chains'
// Primary key: id
// Indexes: 'by_root_cert', 'by_leaf_cert', 'by_last_validated'

// Store: 'ban_records'
// Primary key: id
// Indexes: 'by_callsign', 'by_server', 'by_banned_at'
```

### Server Database (SQLite)

```sql
-- Server stores only approval workflow data
CREATE TABLE certificate_requests (
  id TEXT PRIMARY KEY,
  callsign TEXT NOT NULL,
  server_callsign TEXT NOT NULL,
  certificate_type TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_at TIMESTAMP NOT NULL,
  reviewed_at TIMESTAMP,
  INDEX(callsign, server_callsign),
  INDEX(status, submitted_at)
);

CREATE TABLE approval_records (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES certificate_requests(id),
  decision TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMP NOT NULL,
  trust_level INTEGER NOT NULL
);

CREATE TABLE ban_records (
  id TEXT PRIMARY KEY,
  callsign TEXT NOT NULL,
  banning_server TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  banned_at TIMESTAMP NOT NULL,
  ban_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  INDEX(callsign, is_active)
);
```

## Data Flow Patterns

### Certificate Request Flow
1. Client generates/uploads certificate → `Certificate`
2. Client connects to server → auto-creates `CertificateRequest`
3. Server generates CAPTCHA → `CAPTCHAChallenge`
4. Client solves CAPTCHA → `SignedCAPTCHASolution`
5. Server operator reviews → `ApprovalRecord`
6. Client receives approval notification

### Trust Chain Validation
1. Client presents certificate for verification
2. Server looks up certificate in local store
3. If not found, queries trust chain → `TrustChain`
4. Validates each link in chain
5. Calculates trust score based on factors
6. Caches validation result

### Ban Distribution
1. Server operator bans certificate → `BanRecord`
2. Server hears CQ from banned station
3. If broadcast enabled, transmits ban info
4. Receiving servers create local `BanRecord` copy
5. Server operators can manually review and unban

## Validation Rules

### Certificate Validation
- X.509 structure must be valid
- Amateur radio extensions must be present and valid
- Callsign must match extension and subject
- Certificate must not be expired or revoked
- Private key must match public key (for client certificates)

### Trust Chain Validation
- Maximum depth: 5 certificates
- No circular references
- All intermediate certificates must be valid
- Root certificate must be trusted
- Chain must have sufficient consensus

### CAPTCHA Validation
- Solution must match expected answer hash
- Challenge must not be expired
- Solution must be signed by valid certificate
- Rate limiting: 3 attempts per hour per callsign
- Challenge can only be used within max uses limit

## Performance Considerations

### Indexing Strategy
- Compound indexes for common query patterns
- Separate indexes for time-based queries
- Index on foreign keys for join performance

### Caching Strategy
- Certificate verification results cached for 1 hour
- Trust chains cached until expiration
- CAPTCHA challenges cached until expiration
- Ban records cached and updated via WebSocket

### Compression Optimization
- Certificate requests compressed for radio transmission
- CAPTCHA challenges use minimal text
- Trust chain queries return only essential data
- Ban broadcasts use compact binary format