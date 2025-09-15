# Quickstart: Mesh Network Visualization

**Phase**: 1 - Integration Testing Guide
**Date**: 2025-09-14
**Plan**: [plan.md](./plan.md)

This quickstart validates the mesh network visualization feature through user scenario testing.

## Prerequisites

- HTTP-over-radio PWA running locally (`npm run dev`)
- At least 2 simulated mesh stations for visualization
- Mock GPS coordinates for station positioning
- Active mesh-networking library integration

## Test Scenario 1: Basic Network Visualization

**User Story**: View mesh network topology with connected stations

### Setup
```bash
# Start development server
npm run dev

# Load mesh visualization page
# Navigate to http://localhost:5173/mesh-visualization

# Initialize test mesh with 3 stations
# This should be done through existing mesh-networking test setup
```

### Test Steps
1. **Load visualization page**
   - **Expected**: Canvas element renders with network viewport
   - **Expected**: Loading indicator appears while fetching topology

2. **View station nodes** (FR-001)
   - **Expected**: 3 station nodes appear as circles/symbols
   - **Expected**: Each node shows callsign label (KA1ABC, W2DEF, N3GHI)
   - **Expected**: Nodes positioned geographically if GPS available

3. **View connection links** (FR-002)
   - **Expected**: Lines connect stations that can communicate directly
   - **Expected**: Line styles differentiate RF vs internet connections
   - **Expected**: No connections to unreachable stations

### Validation
- [ ] Nodes render correctly with callsigns
- [ ] Connection links appear between reachable stations
- [ ] Visual styles match connection types (RF/internet)

## Test Scenario 2: Real-time Updates

**User Story**: Network topology updates as stations join/leave

### Test Steps
1. **Add new station to mesh**
   - Simulate new station (K4JKL) joining network
   - **Expected**: New node appears in visualization within 1 second
   - **Expected**: New connection links establish to reachable stations

2. **Remove station from mesh**
   - Simulate station (W2DEF) leaving network
   - **Expected**: Station node disappears from visualization
   - **Expected**: Connection links to that station are removed
   - **Expected**: Routes through that station update

3. **Signal quality changes**
   - Simulate SNR degradation on KA1ABC <-> N3GHI link
   - **Expected**: Link visual style updates to show poor quality
   - **Expected**: Link color/width changes to indicate status

### Validation
- [ ] Real-time updates work without page refresh
- [ ] Network topology reflects current mesh state
- [ ] Visual indicators update with signal quality changes

## Test Scenario 3: Interactive Features

**User Story**: Click stations for details and initiate communications

### Test Steps
1. **Click station node** (FR-014)
   - Click on KA1ABC station node
   - **Expected**: Station details modal/panel opens
   - **Expected**: Shows callsign, coordinates, equipment info
   - **Expected**: Shows current signal characteristics

2. **Click connection link**
   - Click on KA1ABC <-> N3GHI connection line
   - **Expected**: Link details appear
   - **Expected**: Shows protocol, signal quality, traffic stats

3. **Initiate communication** (FR-015)
   - Click "Contact" button in station details
   - **Expected**: Communication interface opens
   - **Expected**: Connection attempt starts to selected station

### Validation
- [ ] Station clicks show detailed information
- [ ] Link clicks display connection metrics
- [ ] Communication initiation works correctly

## Test Scenario 4: RF Propagation Visualization

**User Story**: Visualize radio wave propagation and signal coverage

### Test Steps
1. **Enable propagation view**
   - Toggle propagation visualization mode
   - **Expected**: Coverage circles appear around each station
   - **Expected**: Circle radius based on power and frequency

2. **View signal quality indicators** (FR-005)
   - **Expected**: Link colors represent signal strength
   - **Expected**: Link width indicates connection quality
   - **Expected**: Poor links show different visual style

3. **Check frequency/protocol display** (FR-009, FR-012)
   - **Expected**: Frequency labels appear on connections
   - **Expected**: Protocol type shown (VARA, HTTP-QPSK, etc.)
   - **Expected**: Different protocols have distinct visual styles

### Validation
- [ ] Propagation circles render with correct radii
- [ ] Signal quality visually represented
- [ ] Frequency and protocol information visible

## Test Scenario 5: Zoom and Navigation

**User Story**: Navigate large networks with zoom controls

### Test Steps
1. **Zoom controls** (FR-013)
   - Use mouse wheel or zoom buttons
   - **Expected**: Network view scales appropriately
   - **Expected**: Labels remain readable at all zoom levels
   - **Expected**: Performance maintains 60fps during zoom

2. **Pan functionality**
   - Click and drag to pan viewport
   - **Expected**: Network view pans smoothly
   - **Expected**: Nodes remain properly positioned

3. **Zoom to fit**
   - Use "Fit to Network" button
   - **Expected**: Viewport adjusts to show all stations
   - **Expected**: Optimal zoom level for current network size

### Validation
- [ ] Zoom functionality works smoothly
- [ ] Pan controls respond correctly
- [ ] Zoom-to-fit shows entire network optimally

## Performance Benchmarks

### Rendering Performance
- **Target**: 60fps with 10-50 stations
- **Test**: Monitor frame rate during real-time updates
- **Measurement**: Use browser dev tools performance tab

### Update Latency
- **Target**: <100ms from mesh event to visual update
- **Test**: Timestamp mesh events vs visual changes
- **Measurement**: Console.time() around update cycles

### Memory Usage
- **Target**: <50MB additional memory for visualization
- **Test**: Monitor heap size in dev tools
- **Measurement**: Compare before/after visualization load

## Error Scenarios

### GPS Unavailable
- **Test**: Disable GPS/location services
- **Expected**: Stations positioned in grid layout
- **Expected**: Manual coordinate entry available

### No Mesh Connections
- **Test**: Start with isolated station
- **Expected**: Single station shown
- **Expected**: "No connections" message displayed

### Large Network (50+ stations)
- **Test**: Simulate large mesh network
- **Expected**: Viewport culling maintains performance
- **Expected**: Zoom controls help navigate network

## Integration Validation

### Mesh Library Integration
- [ ] Subscribes to mesh-networking events correctly
- [ ] Receives station join/leave notifications
- [ ] Gets real-time signal quality updates
- [ ] Handles mesh protocol messages

### UI Component Integration
- [ ] Integrates with existing React component structure
- [ ] Uses consistent UI patterns with rest of PWA
- [ ] Maintains responsive design principles
- [ ] Works with existing service worker offline capabilities

### Data Persistence
- [ ] Station coordinates persist in IndexedDB
- [ ] Network topology cached for offline viewing
- [ ] Historical data available for analysis
- [ ] Settings preserved across sessions

---

**Quickstart Status**: ✅ Complete - 5 test scenarios with validation checkpoints defined