# Quickstart: Protocol Buffers for Dynamic Data Transmission

## Overview
This guide demonstrates how to use Protocol Buffers for efficient binary encoding of dynamic data in the HTTP-over-Ham-Radio application.

## Prerequisites
- Ham radio station running the HTTP-over-Ham-Radio PWA
- Browser with IndexedDB support
- Active ham radio connection

## Basic Usage

### 1. Automatic Schema Generation
When your station transmits dynamic API data, the system automatically:
1. Analyzes the data structure
2. Generates a Protocol Buffer schema
3. Encodes the data in binary format
4. Sends the schema first (if needed), then the data

### 2. First Transmission Example
```javascript
// Your application sends API data
const apiResponse = {
  callsign: "KA1ABC",
  frequency: 14078000,
  mode: "USB",
  signal: -85,
  timestamp: Date.now()
};

// System automatically:
// 1. Generates schema (first time only)
// 2. Encodes to binary (60% smaller than JSON)
// 3. Transmits over radio
await hamServer.transmit(apiResponse, "KB2DEF");
```

### 3. Receiving Data
When receiving protobuf-encoded data:
```javascript
// Station receives transmission
// System automatically:
// 1. Checks if schema is cached
// 2. Requests schema if missing
// 3. Decodes binary data
// 4. Returns original structure

hamServer.on('data', (data) => {
  console.log('Received:', data);
  // Data is automatically decoded
});
```

## Test Scenarios

### Scenario 1: New Schema Transmission
**Goal**: Verify schema generation and transmission for new data types

1. Open the PWA in your browser
2. Navigate to Settings → Protocol Buffers
3. Click "Test New Schema"
4. Observe in the console:
   - "Generating schema for data type: test"
   - "Schema ID: [64-char hash]"
   - "Encoding data with protobuf"
   - "Transmission size reduced by 65%"

**Expected Result**: Data transmitted with schema, significant size reduction

### Scenario 2: Cached Schema Reuse
**Goal**: Verify schema caching works within session

1. Send the same data structure again
2. Click "Test Cached Schema"
3. Observe in the console:
   - "Schema found in cache: [ID]"
   - "Cache hit count: 2"
   - "Skipping schema transmission"
   - "Encoding with cached schema"

**Expected Result**: No schema retransmission, faster encoding

### Scenario 3: Schema Request on Missing
**Goal**: Verify automatic schema requests

1. Clear your cache (Settings → Clear Cache)
2. Receive data from another station
3. Observe in the console:
   - "Schema not in cache: [ID]"
   - "Requesting schema from KA1ABC"
   - "Schema received and cached"
   - "Decoding data with new schema"

**Expected Result**: Automatic schema retrieval and successful decode

### Scenario 4: Session-Based Eviction
**Goal**: Verify schemas are cleared on session end

1. Send multiple transmissions with different schemas
2. Note the cached schema count in Settings
3. Close the browser tab
4. Reopen the PWA
5. Check Settings → Protocol Buffers → Cache Stats

**Expected Result**: Cache is empty, schemas were evicted

## Performance Validation

### Bandwidth Test
1. Navigate to Diagnostics → Bandwidth Test
2. Click "Compare JSON vs Protobuf"
3. Results should show:
   - JSON size: 1000 bytes
   - Protobuf size: 400 bytes
   - Compression: 60% reduction
   - With Brotli: 85% total reduction

### Encoding Speed Test
1. Navigate to Diagnostics → Performance
2. Click "Test Encoding Speed"
3. Results should show:
   - Schema generation: <50ms
   - Encoding time: <10ms
   - Decoding time: <10ms
   - Round-trip: <100ms

## Troubleshooting

### Schema Generation Fails
- Check data structure is valid JavaScript object
- Verify no circular references
- Check console for specific error

### Decode Errors
- System automatically requests schema
- Check radio connection is active
- Verify target station is online

### Cache Full
- Schemas are automatically evicted (LRU)
- Close and reopen tab to clear all
- Check Settings for cache statistics

## Integration with Existing Features

### With Compression
Protocol Buffers work seamlessly with existing compression:
1. Data is encoded to protobuf (60% reduction)
2. Then compressed with Brotli (additional 25% reduction)
3. Total reduction: ~85% vs raw JSON

### With Mesh Networking
Each mesh node maintains its own schema cache:
1. Schemas propagate through mesh as needed
2. Each hop can cache for efficiency
3. Request forwarding for missing schemas

### With Ham Server
The ham-server automatically detects dynamic data:
1. Static content (HTML) sent as-is
2. Dynamic API data triggers protobuf encoding
3. Transparent to application layer

## Configuration

### Settings Available
- **Cache Size**: Maximum memory for schemas (default: 5MB)
- **Eviction Policy**: LRU, LFU, or FIFO (default: LRU)
- **Auto-Request**: Enable/disable automatic schema requests
- **Compression**: Choose compression algorithm

### Advanced Options
```javascript
// Configure in Settings → Advanced
protobufConfig = {
  maxSchemaSize: 10240,        // 10KB max per schema
  cacheSize: 5242880,          // 5MB total cache
  evictionPolicy: 'LRU',       // Least Recently Used
  compression: 'brotli',       // Or 'gzip', 'none'
  autoRequest: true,           // Auto-request missing schemas
  requestTimeout: 5000,        // 5 second timeout
  maxRetries: 3               // Retry schema requests
};
```

## Success Criteria
✓ 60%+ bandwidth reduction for API data
✓ <100ms schema generation time
✓ Automatic schema exchange between stations
✓ Session-based cache management
✓ Seamless integration with existing features