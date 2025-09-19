# Research: Dynamic Data Feature

## Executive Summary
Research into existing codebase reveals strong foundation for dynamic data distribution. Content registry already handles beacon announcements, WebRTC transport is functional, and OFDM supports parallel transmission. Key integration points identified for subscription management, retry coordination, and priority-based delivery.

## Existing Infrastructure Analysis

### 1. Content Registry System
**Location**: `signaling-server/src/services/ContentRegistry.js`
- Already stores beacon metadata with paths and priorities
- ConsolidatedBeacon model includes TTL based on priority tiers
- Supports batch queries and path consolidation
- **Integration Point**: Extend for update metadata tracking

### 2. WebRTC Transport
**Location**: `src/lib/webrtc-transport/`
- Peer connection management implemented
- Swarm coordination via signaling server
- DataChannel established for file transfers
- **Integration Point**: Add update-specific negotiation

### 3. OFDM Parallel Transmission
**Location**: `src/lib/ofdm-modem/`, `src/lib/parallel-chunk-manager/`
- 48 subcarriers available for parallel transmission
- ChunkAllocator handles priority-based carrier assignment
- Carrier health monitoring for reliability
- **Integration Point**: Reserve carriers 40-47 for priority updates

### 4. Signaling Server
**Location**: `signaling-server/`
- Express-based API server
- SQLite database for persistence
- WebSocket support for real-time notifications
- **Integration Point**: Add subscription and update tracking endpoints

### 5. FCC Compliance System
**Location**: `src/lib/fcc-compliance/`, `src/lib/station-id-timer/`
- Station ID timer for 10-minute identification
- Encryption guard prevents content encryption
- Callsign validator with FCC ULS database
- **Integration Point**: Validate retry request signatures

## Technical Discoveries

### Beacon System
- Beacons use content hash as primary key
- Path tracking shows mesh routing capability
- Priority tiers (P0-P5) already defined:
  - P0: 30 days retention
  - P1: 14 days retention
  - P2: 7 days retention
  - P3-P5: 6-24 hours retention

### WebRTC Capabilities
- Signaling server coordinates peer discovery
- STUN/TURN configuration available
- Binary data transfer via DataChannel confirmed
- Multiple simultaneous connections supported

### RF Transmission Modes
- OFDM: 100+ kbps with 48 parallel carriers
- QPSK: 750-14400 bps adaptive based on SNR
- Hybrid mode switching between WebRTC and RF
- Automatic fallback on connection failure

### Database Schema
```sql
-- Existing tables relevant to dynamic data
beacons (
  content_hash TEXT PRIMARY KEY,
  callsign TEXT,
  priority_tier INTEGER,
  created_at INTEGER,
  expires_at INTEGER
)

beacon_paths (
  beacon_hash TEXT,
  path TEXT,
  signal_strength INTEGER,
  hop_count INTEGER
)
```

## Integration Requirements

### 1. Subscription Management
- Need new table for subscriptions:
  ```sql
  subscriptions (
    id TEXT PRIMARY KEY,
    station_id TEXT,
    channel TEXT,
    created_at INTEGER,
    active BOOLEAN
  )
  ```

### 2. Update Tracking
- Extend beacon system for update metadata:
  ```sql
  updates (
    id TEXT PRIMARY KEY,
    version INTEGER,
    priority INTEGER,
    data BLOB,
    created_at INTEGER,
    etag TEXT
  )

  update_holders (
    update_id TEXT,
    station_id TEXT,
    received_at INTEGER
  )
  ```

### 3. Retry Coordination
- Track retry requests and responses:
  ```sql
  retry_requests (
    id TEXT PRIMARY KEY,
    update_id TEXT,
    requester TEXT,
    signature TEXT,
    requested_at INTEGER,
    fulfilled BOOLEAN
  )
  ```

## Protocol Considerations

### Update Broadcast Format
```yaml
type: UPDATE
id: EMRG-2024-001
version: 2
priority: 0
etag: "abc123"
size: 2048
data: [base64 encoded]
subscribers: [KA1ABC, KB2DEF]
```

### Retry Request Protocol
```yaml
type: RETRY_REQUEST
update_id: EMRG-2024-001
version: 2
requester: KD4JKL
signature: [ECDSA signature]
timestamp: 1234567890
```

### Subscription Message
```yaml
type: SUBSCRIBE
channel: emergency.missing_person
station_id: KA1ABC
signature: [ECDSA signature]
```

## Performance Analysis

### Bandwidth Requirements
- P0 Emergency: ~500 bytes typical
- P1 Safety: ~1-2 KB typical
- P2-P5 Routine: Up to 50KB (configurable)
- Beacon overhead: ~100 bytes per update

### Timing Constraints
- Emergency broadcast: < 3 seconds
- Retry coordination: 10-30 second window
- WebRTC negotiation: ~1-2 seconds
- RF transmission: Varies by size/mode

### Storage Impact
- 100 concurrent updates @ 50KB = 5MB maximum
- Subscription registry: ~100 bytes per subscription
- Retry tracking: ~200 bytes per request
- Total impact: < 10MB for typical relay station

## Security Considerations

### Authentication
- ECDSA signatures required for:
  - Update creation (licensed stations only)
  - Retry requests (prevent spam)
  - Subscription management

### Data Integrity
- ETags for version tracking
- Checksums for corruption detection
- Timestamp validation for replay prevention

### FCC Compliance
- No content encryption (signatures only)
- Station ID included in transmissions
- Licensed station verification via ULS database

## Recommended Approach

### Phase 1 Priorities
1. Extend content registry for update metadata
2. Implement subscription management API
3. Create retry coordination protocol
4. Add priority-based cache management

### Phase 2 Enhancements
1. WebRTC peer selection optimization
2. Carrier allocation for priority updates
3. Beacon path tracking for routing
4. UI components for monitoring

### Phase 3 Advanced Features
1. Multi-hop retry propagation
2. Predictive pre-caching
3. Bandwidth optimization
4. Mesh-wide coordination

## Open Questions Resolved
- ✓ Subscription expiration: Not needed (on-demand only)
- ✓ Retry limits: Operator judgment (no hard limit)
- ✓ Emergency interval: 5 minutes default
- ✓ Priority echo: P0 and P1 only
- ✓ Storage eviction: Lowest priority, then oldest
- ✓ Path selection: RF if last beacon, else WebRTC

## Conclusion
The existing infrastructure provides excellent foundation for dynamic data distribution. Content registry, WebRTC transport, and OFDM transmission can be extended with minimal changes. Key additions are subscription management, retry coordination, and priority-based delivery logic. Implementation should follow TDD approach with contract tests first.