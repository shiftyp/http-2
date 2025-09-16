# Data Model: Unlicensed Mode

## Core Entities

### UserMode
Represents the current user's licensing status and available features.

**Fields:**
- `status: 'licensed' | 'unlicensed'` - Current user licensing status
- `callsign: string | null` - Amateur radio callsign (null for unlicensed users)
- `certificateId: string | null` - Associated certificate ID for validation
- `sessionId: string` - Unique session identifier for tracking
- `capabilities: FeatureCapability[]` - Available features based on licensing status
- `modeSetAt: Date` - When current mode was established
- `lastVerification: Date | null` - Last certificate verification timestamp
- `persistAcrossSessions: boolean` - Whether to remember license status
- `autoUpgradePrompted: boolean` - Whether user has been prompted to upgrade to licensed mode
- `rateLimitState: RateLimitState` - Current rate limiting state for unlicensed users
- `complianceFlags: ComplianceFlag[]` - Active compliance monitoring flags

**Validation Rules:**
- Status must be either 'licensed' or 'unlicensed'
- Licensed users must have valid callsign and certificate
- Unlicensed users must have null callsign and certificate
- Session ID must be globally unique (UUID format)
- Rate limit state required for unlicensed users
- Compliance flags updated every mode transition

**State Transitions:**
```
unlicensed → upgrading → licensed (with valid certificate)
licensed → downgrading → unlicensed (certificate invalid/revoked)
unlicensed → unlicensed (session persistence)
licensed → licensed (certificate renewal)
```

### Certificate
Digital certificate for validating amateur radio callsign authenticity.

**Fields:**
- `certificateId: string` - Unique certificate identifier (UUID format)
- `callsign: string` - Associated amateur radio callsign
- `issuer: string` - Certificate authority or issuer name
- `issuedAt: Date` - Certificate issuance timestamp
- `expiresAt: Date` - Certificate expiration timestamp
- `revokedAt: Date | null` - Revocation timestamp (null if active)
- `certificateData: string` - Base64-encoded certificate content
- `fingerprint: string` - SHA-256 hash of certificate for quick validation
- `verificationStatus: 'valid' | 'expired' | 'revoked' | 'invalid'` - Current status
- `lastVerified: Date` - Last successful verification
- `verificationAttempts: number` - Number of verification attempts
- `issuerCertificateId: string | null` - Parent certificate for chain validation
- `alternateCallsigns: string[]` - Special event or club callsigns covered

**Validation Rules:**
- Certificate ID must be UUID format
- Callsign must match amateur radio format (regex validation)
- Expiration date must be future date when issued
- Certificate data must be valid Base64 encoding
- Fingerprint must be SHA-256 hash format
- Verification attempts limited to 3 per hour
- Chain validation required for issuer certificates

**Relationships:**
- Links to UserMode for licensed users
- Can reference parent certificate for chain validation
- Tracked in ComplianceLog for audit trails

### RateLimitState
DDoS protection and rate limiting for unlicensed users.

**Fields:**
- `userId: string` - User identifier (session-based for unlicensed users)
- `requestsPerMinute: number` - Current requests per minute count
- `requestsPerHour: number` - Current requests per hour count
- `requestsPerDay: number` - Current requests per day count
- `lastRequestTime: Date` - Timestamp of last request
- `consecutiveViolations: number` - Number of consecutive rate limit violations
- `temporaryBanUntil: Date | null` - Temporary ban expiration (null if not banned)
- `warningsSent: number` - Number of rate limit warnings sent to user
- `whitelistReason: string | null` - Reason for rate limit exemption (if any)
- `requestHistory: RequestHistoryEntry[]` - Recent request history for analysis
- `adaptiveThrottling: boolean` - Whether adaptive throttling is active

**Validation Rules:**
- User ID must be valid session identifier
- Request counters reset based on time windows (minute/hour/day)
- Consecutive violations trigger escalating penalties
- Maximum 3 warnings before temporary ban
- Request history limited to last 100 entries
- Temporary ban maximum duration 24 hours

**Rate Limits:**
- Unlicensed users: 30 requests/minute, 500/hour, 2000/day
- Licensed users: No rate limits (certificate-based trust)
- Adaptive throttling during high load periods
- Emergency override for critical communications

### RelayPath
Tracks message routing through licensed stations for unlicensed users.

**Fields:**
- `pathId: string` - Unique path identifier (UUID format)
- `originUserId: string` - Original sender identifier
- `destinationUserId: string` - Final recipient identifier
- `relayStations: RelayStation[]` - Licensed stations in relay chain
- `pathEstablishedAt: Date` - When relay path was created
- `lastUsed: Date` - Last message transmission via this path
- `messageCount: number` - Number of messages relayed via this path
- `totalBytesRelayed: number` - Total data relayed through path
- `pathStatus: 'active' | 'degraded' | 'failed' | 'expired'` - Current path status
- `averageLatency: number` - Average message latency through path (milliseconds)
- `reliabilityScore: number` - Path reliability score (0-100)
- `pathType: 'internet' | 'hybrid' | 'emergency'` - Type of relay path
- `encryptionStatus: 'signed' | 'plain'` - FCC-compliant signing status

**Validation Rules:**
- Path ID must be UUID format
- Must have at least one licensed relay station
- Origin must be unlicensed user for relay requirement
- Path expires after 24 hours of inactivity
- Maximum 5 relay stations per path for efficiency
- Reliability score updated after each message
- Encryption limited to signing only (no content encryption)

**Relationships:**
- Links unlicensed users to licensed relay stations
- Integrates with ComplianceLog for audit requirements
- References Certificate validation for relay stations

### RelayStation
Licensed amateur radio station providing relay services.

**Fields:**
- `callsign: string` - Amateur radio callsign of relay station
- `certificateId: string` - Valid certificate for callsign verification
- `stationId: string` - Unique station identifier
- `capabilities: RelayCapability[]` - Supported relay features
- `maxRelayLoad: number` - Maximum concurrent relay connections
- `currentLoad: number` - Current number of active relays
- `relayPolicy: RelayPolicy` - Station's relay policies and restrictions
- `lastActivity: Date` - Last relay activity timestamp
- `uptimePercentage: number` - Station uptime reliability (0-100)
- `averageResponseTime: number` - Average response time (milliseconds)
- `totalMessagesRelayed: number` - Lifetime message relay count
- `preferredProtocols: string[]` - Preferred communication protocols
- `geographicLocation: string | null` - General location for routing optimization

**Validation Rules:**
- Callsign must have valid associated certificate
- Certificate must not be expired or revoked
- Relay load cannot exceed maximum capacity
- Uptime percentage calculated over 30-day rolling window
- Response time measured for last 100 relay operations
- Geographic location optional but recommended for mesh routing

### ComplianceLog
Audit trail for regulatory compliance and mode operation tracking.

**Fields:**
- `logId: string` - Unique log entry identifier (UUID format)
- `timestamp: Date` - When event occurred
- `userId: string` - User identifier (session-based for unlicensed)
- `userMode: 'licensed' | 'unlicensed'` - User mode at time of event
- `eventType: ComplianceEventType` - Type of compliance event
- `eventData: any` - Event-specific data (JSON format)
- `protocolUsed: 'RF' | 'WebRTC' | 'WebSocket' | 'HTTP'` - Communication protocol
- `callsignInvolved: string | null` - Associated callsign (if any)
- `relayStations: string[]` - Relay stations involved (if applicable)
- `dataSize: number` - Size of data transmitted/received
- `ipAddress: string | null` - IP address for internet communications
- `complianceStatus: 'compliant' | 'warning' | 'violation'` - Compliance assessment
- `automaticAction: string | null` - Automatic action taken (if any)

**Validation Rules:**
- Log ID must be UUID format
- Timestamp must be accurate UTC time
- Event type must be from predefined enum
- Event data must be valid JSON
- Compliance status determined by automated rules
- IP address required for internet communications
- Data size tracked for bandwidth compliance

**Event Types:**
- MODE_SWITCH: User changed between licensed/unlicensed
- MESSAGE_RELAY: Message relayed through licensed station
- CERTIFICATE_VALIDATION: Certificate verification event
- RATE_LIMIT_VIOLATION: Rate limit exceeded
- PROTOCOL_SWITCH: Communication protocol changed
- EMERGENCY_OVERRIDE: Emergency communication activated

## Supporting Types

### FeatureCapability
- `feature: string` - Feature name (e.g., 'radio_transmission', 'mesh_routing')
- `enabled: boolean` - Whether feature is available
- `restrictions: string[]` - Any restrictions on feature usage
- `requiresCertificate: boolean` - Whether valid certificate required

### ComplianceFlag
- `flag: string` - Compliance flag identifier
- `severity: 'info' | 'warning' | 'critical'` - Flag severity level
- `description: string` - Human-readable flag description
- `triggeredAt: Date` - When flag was activated
- `autoResolves: boolean` - Whether flag auto-resolves

### RequestHistoryEntry
- `timestamp: Date` - Request timestamp
- `endpoint: string` - API endpoint accessed
- `method: string` - HTTP method
- `responseCode: number` - HTTP response code
- `responseTime: number` - Request processing time (milliseconds)

### RelayCapability
- `protocol: string` - Supported protocol (WebRTC, WebSocket, HTTP)
- `maxBandwidth: number` - Maximum bandwidth (bytes/second)
- `qosLevel: 'best-effort' | 'guaranteed' | 'priority'` - Quality of service
- `encryptionSupport: boolean` - Whether signing is supported

### RelayPolicy
- `acceptAnonymous: boolean` - Accept unlicensed user relays
- `maxSessionDuration: number` - Maximum relay session time (minutes)
- `contentFiltering: boolean` - Whether content filtering is enabled
- `emergencyOverride: boolean` - Allow emergency traffic override
- `bandwidthLimit: number` - Per-user bandwidth limit (bytes/second)

### ComplianceEventType
```typescript
enum ComplianceEventType {
  MODE_SWITCH = 'mode_switch',
  MESSAGE_RELAY = 'message_relay',
  CERTIFICATE_VALIDATION = 'certificate_validation',
  RATE_LIMIT_VIOLATION = 'rate_limit_violation',
  PROTOCOL_SWITCH = 'protocol_switch',
  EMERGENCY_OVERRIDE = 'emergency_override',
  TRANSMISSION_ATTEMPT = 'transmission_attempt',
  MONITORING_ACTIVITY = 'monitoring_activity'
}
```

## Integration with Existing Models

### Station (existing)
Extended to include:
- `relayCapabilities: RelayCapability[]` - Relay services offered
- `relayPolicy: RelayPolicy` - Relay policies and restrictions
- `unlicensedClientCount: number` - Number of unlicensed clients being relayed

### QSOLog (existing)
Extended to include:
- `relayPath: string | null` - Associated relay path ID
- `complianceLogId: string` - Associated compliance log entry
- `userMode: 'licensed' | 'unlicensed'` - User mode during contact

### MeshNode (existing)
Extended to include:
- `relayStation: RelayStation | null` - Associated relay station info
- `unlicensedRoute: boolean` - Whether node is in unlicensed user path
- `certificateVerified: boolean` - Whether station certificate is verified

## Security and Privacy Considerations

### Data Retention
- User mode data: Retained for session duration plus 7 days
- Certificate cache: Retained until expiration plus 30 days
- Rate limit state: Reset daily, violation history kept 30 days
- Relay paths: Purged after 24 hours of inactivity
- Compliance logs: Retained 1 year for regulatory requirements

### Privacy Protection
- Session-based identifiers for unlicensed users (no persistent tracking)
- IP addresses hashed for compliance logs (not stored in plain text)
- Relay paths anonymized after completion
- Certificate data cached locally only

### FCC Compliance
- All amateur radio transmissions logged with callsign identification
- No content encryption (signing only for verification)
- Message relay through licensed stations maintains identification chain
- Compliance logs available for regulatory inspection