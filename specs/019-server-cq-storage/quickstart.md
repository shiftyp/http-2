# Quickstart: Server CQ Storage

**Feature**: Server CQ Storage | **Date**: 2025-09-18

## Overview
This quickstart demonstrates the Server CQ Storage feature which enables WebRTC clients to discover content announced via RF CQ beacons through a persistent content registry.

## Prerequisites
- Node.js 20+ for signaling server
- Modern browser with IndexedDB support
- Test data with various priority tiers

## Quick Test Sequence

### 1. Start Signaling Server with Registry
```bash
# In signaling-server directory
npm install
npm test  # Run contract tests first (should fail)
npm start

# Server starts on ws://localhost:8080
# Registry database created at ./cq-registry.db
```

### 2. Simulate RF Beacon Upload
```bash
# Test hybrid station uploading beacon
curl -X POST http://localhost:8080/api/content/announce \
  -H "Content-Type: application/json" \
  -d '{
    "callsign": "KA1ABC",
    "signature": "test-signature",
    "contentHash": "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    "path": ["KB2DEF"],
    "metadata": {
      "url": "/emergency/evacuation",
      "size": 2048,
      "mimeType": "text/html",
      "priority": 0
    },
    "signalQuality": 0.85,
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'

# Expected: 201 Created with consolidation info
```

### 3. Test Path Consolidation
```bash
# Same content from different path
curl -X POST http://localhost:8080/api/content/announce \
  -H "Content-Type: application/json" \
  -d '{
    "callsign": "KA1ABC",
    "signature": "test-signature2",
    "contentHash": "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    "path": ["KC3GHI", "KD4JKL"],
    "signalQuality": 0.72,
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'

# Expected: 201 with consolidated=true, pathCount=2
```

### 4. Query Content Registry
```bash
# Search by content hash
curl "http://localhost:8080/api/content/search?hash=abc123def456abc123def456abc123def456abc123def456abc123def456abcd"

# Expected: ConsolidatedBeacon with 2 paths

# Search by callsign
curl "http://localhost:8080/api/content/search?callsign=KA1ABC"

# Search by priority (emergency content)
curl "http://localhost:8080/api/content/search?priority=0"
```

### 5. Test Client Storage (Browser)
```javascript
// Open browser console
// Initialize client registry
const registry = new ContentRegistry({
  maxStorage: 50 * 1024 * 1024, // 50MB
  syncUrl: 'ws://localhost:8080'
});

// Connect and sync
await registry.connect();

// Query local cache
const emergency = await registry.getByPriority(0);
console.log('Emergency content:', emergency);

// Check storage usage
const stats = await registry.getStats();
console.log('Storage used:', stats.bytesUsed, 'of', stats.maxBytes);
```

### 6. Test Priority Tiers and TTL
```bash
# Add routine content (P5 - 6 hour TTL)
curl -X POST http://localhost:8080/api/content/announce \
  -H "Content-Type: application/json" \
  -d '{
    "callsign": "KE5MNO",
    "signature": "test-signature3",
    "contentHash": "routine123routine123routine123routine123routine123routine123rout",
    "path": ["KF6PQR"],
    "metadata": {
      "url": "/blog/daily-update",
      "size": 1024,
      "mimeType": "text/html",
      "priority": 5
    },
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'

# Wait and check expiration
sleep 21600  # 6 hours
curl "http://localhost:8080/api/content/search?hash=routine123routine123routine123routine123routine123routine123rout"
# Expected: 404 or empty result
```

### 7. Test Batch Query
```bash
# Query multiple items at once
curl -X POST http://localhost:8080/api/content/batch \
  -H "Content-Type: application/json" \
  -d '{
    "hashes": [
      "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
      "routine123routine123routine123routine123routine123routine123rout",
      "nonexistent456nonexistent456nonexistent456nonexistent456nonexist"
    ]
  }'

# Expected: Object with found entries, missing ones null
```

### 8. Test Station Trust
```bash
# Check station reputation
curl "http://localhost:8080/api/station/KA1ABC/trust"

# Expected: Trust score, beacon count, verification status
```

### 9. Performance Validation
```bash
# Measure hash lookup performance
time curl "http://localhost:8080/api/content/abc123def456abc123def456abc123def456abc123def456abc123def456abcd"
# Expected: <100ms

# Load test concurrent connections
for i in {1..100}; do
  wscat -c ws://localhost:8080 &
done
# Expected: All connections succeed
```

### 10. Disaster Scenario Test
```javascript
// Simulate disaster mode with multiple priority tiers
const testData = [
  { priority: 0, content: 'EMERGENCY: Evacuation required' },
  { priority: 1, content: 'POWER RESTORED at main hospital' },
  { priority: 2, content: 'SUPPLY DROP at coordinates' },
  { priority: 3, content: 'MISSING PERSON: John Doe' },
  { priority: 4, content: 'WEATHER forecast update' },
  { priority: 5, content: 'Daily blog post' }
];

for (const item of testData) {
  await uploadBeacon(item);
}

// Verify retention after 24 hours
setTimeout(async () => {
  const remaining = await registry.getAll();
  console.log('After 24h:', remaining.filter(b => b.priorityTier <= 3).length);
  // Expected: P0-P3 content still present, P4-P5 expired
}, 86400000);
```

## Validation Checklist

### Functional Requirements
- [ ] FR-001: Beacon storage working
- [ ] FR-002: Content discovery endpoint functional
- [ ] FR-005: Path consolidation reduces storage 80%
- [ ] FR-004: TTL expiration by priority tier
- [ ] FR-008: ECDSA authentication and rate limiting
- [ ] FR-011: Storage limits enforced (1GB server, 50MB client)
- [ ] FR-016: Shared schema between server and client
- [ ] FR-021: Metadata conflict resolution
- [ ] FR-022: Performance targets met (<100ms, 1000+ connections)
- [ ] FR-023: Priority classification working

### Integration Points
- [ ] WebSocket messages batched efficiently
- [ ] Client IndexedDB syncs with server
- [ ] Hybrid stations can upload RF beacon data
- [ ] WebRTC clients discover RF-announced content

### Edge Cases
- [ ] Storage limit eviction works correctly
- [ ] Conflicting metadata handled properly
- [ ] Dead paths pruned after 1 hour
- [ ] Network consensus adjusts priority

## Troubleshooting

### Server Won't Start
```bash
# Check port availability
lsof -i :8080

# Check SQLite database
sqlite3 cq-registry.db "SELECT COUNT(*) FROM consolidated_beacons;"

# Check logs
tail -f signaling-server/logs/server.log
```

### Client Storage Issues
```javascript
// Clear IndexedDB
await navigator.storage.estimate();
const dbs = await indexedDB.databases();
await indexedDB.deleteDatabase('cq-registry');

// Check quota
const {usage, quota} = await navigator.storage.estimate();
console.log(`Using ${usage} of ${quota} bytes`);
```

### Path Not Consolidating
```bash
# Check existing paths
curl "http://localhost:8080/api/content/{hash}" | jq '.paths'

# Verify path signature matches
# Paths consolidate only if callsign sequence identical
```

## Next Steps

After validating the quickstart:
1. Run full integration test suite
2. Test with real RF beacon data
3. Monitor production storage growth
4. Tune TTL values based on usage patterns
5. Implement backup/restore procedures

---
*Quickstart guide v1.0.0 - 2025-09-18*