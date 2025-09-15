# Mesh Networking Guide

## Overview

HTTP Over Ham Radio implements AODV (Ad hoc On-Demand Distance Vector) routing for creating self-organizing mesh networks over amateur radio.

## How Mesh Networking Works

### Basic Concepts

```
Station A ←→ Station B ←→ Station C
     ↑                         ↑
     └─────── Multi-hop ───────┘
```

- **Nodes**: Individual stations in the network
- **Routes**: Paths between nodes
- **Hops**: Number of intermediate nodes
- **Metrics**: Link quality measurements

### AODV Protocol

1. **Route Discovery**
   - Node broadcasts Route Request (RREQ)
   - Intermediate nodes forward RREQ
   - Destination sends Route Reply (RREP)
   - Route established bidirectionally

2. **Route Maintenance**
   - Periodic hello beacons
   - Link quality monitoring
   - Automatic route repair
   - Multipath support

## Setting Up a Mesh Network

### Step 1: Enable Mesh Mode

```javascript
Settings → Mesh Network
├── Enable Mesh: ON
├── Node ID: [YOUR_CALLSIGN]
├── Network Name: LOCAL-MESH
└── Shared Key: [OPTIONAL]
```

### Step 2: Configure Parameters

```javascript
Advanced Settings
├── Max Hops: 5          // Maximum route length
├── Beacon Interval: 30s  // Hello beacon frequency
├── Route Timeout: 300s   // Route expiration
├── Buffer Size: 100      // Message queue size
└── Retry Count: 3        // Transmission retries
```

### Step 3: Join Network

```javascript
// Automatic discovery
meshNetwork.startDiscovery();

// Manual node addition
meshNetwork.addNeighbor({
  callsign: "W1ABC",
  frequency: 14085000,
  mode: "QPSK-1500"
});
```

## Mesh Operations

### Sending Messages

```javascript
// Single-hop (direct)
mesh.send({
  to: "W1ABC",
  message: "Hello direct",
  type: "direct"
});

// Multi-hop (routed)
mesh.send({
  to: "W9XYZ",
  message: "Hello via mesh",
  type: "routed"
});

// Broadcast (all nodes)
mesh.broadcast({
  message: "CQ Mesh Network",
  ttl: 3  // Time-to-live (hops)
});
```

### Receiving Messages

```javascript
mesh.on('message', (msg) => {
  console.log(`From: ${msg.from}`);
  console.log(`Hops: ${msg.hops}`);
  console.log(`Data: ${msg.data}`);
});
```

### Monitoring Network

```javascript
// View routing table
const routes = mesh.getRoutingTable();
/*
[
  {
    destination: "W9XYZ",
    nextHop: "W5DEF",
    hops: 3,
    metric: 85,
    lastSeen: "2025-01-15T10:30:00Z"
  }
]
*/

// View neighbors
const neighbors = mesh.getNeighbors();
/*
[
  {
    callsign: "W5DEF",
    rssi: -72,
    snr: 12,
    lastBeacon: "2025-01-15T10:29:45Z"
  }
]
*/
```

## Network Topologies

### Star Topology
```
    Central
   /   |   \
Node  Node  Node
```
- One central repeater node
- Simple but single point of failure
- Good for local groups

### Mesh Topology
```
Node --- Node
 |   \ /   |
 |    X    |
 |   / \   |
Node --- Node
```
- Fully interconnected
- Redundant paths
- Self-healing

### Linear Topology
```
Node - Node - Node - Node
```
- Chain of nodes
- Good for geographic lines
- Each node only needs to reach neighbors

## Advanced Features

### Multipath Routing

Enable redundant paths for reliability:

```javascript
Settings → Mesh → Advanced
├── Multipath: ENABLED
├── Path Diversity: 2     // Number of paths
└── Load Balancing: ROUND_ROBIN
```

### Quality of Service (QoS)

Prioritize traffic types:

```javascript
mesh.setQoS({
  emergency: 0,    // Highest priority
  messages: 1,
  pages: 2,
  telemetry: 3    // Lowest priority
});
```

### Store-and-Forward

Queue messages for offline nodes:

```javascript
Settings → Mesh → Store & Forward
├── Enable S&F: ON
├── Storage Time: 24 hours
├── Max Queue Size: 1000 messages
└── Auto-Retry: ON
```

### Bandwidth Management

Control network usage:

```javascript
mesh.setBandwidthLimits({
  maxThroughput: 2800,      // bps
  dutyCycle: 0.3,           // 30% transmit time
  fairQueuing: true         // Equal access
});
```

## Mesh Network Examples

### Emergency Network

```javascript
// Configure for emergency use
const emergencyConfig = {
  network: "EMCOMM-MESH",
  priority: "emergency",
  beacon: 10,  // Fast discovery
  encryption: false,  // FCC compliant
  autoRelay: true
};

mesh.configure(emergencyConfig);
```

### Event Network

```javascript
// Marathon/event support
const eventConfig = {
  network: "MARATHON-2025",
  nodes: [
    { id: "START", location: [42.3601, -71.0589] },
    { id: "MILE5", location: [42.3651, -71.0634] },
    { id: "MILE10", location: [42.3701, -71.0689] },
    { id: "FINISH", location: [42.3751, -71.0734] }
  ],
  mode: "QPSK-2800",  // High speed for local
  autoPosition: true   // GPS integration
};
```

### Wide Area Network

```javascript
// Regional mesh network
const regionalConfig = {
  network: "REGION-1-MESH",
  hops: 10,           // Long paths
  mode: "QPSK-750",   // Long distance
  schedule: {         // Time-based operation
    active: "0800-2200",
    beacon: 60        // Slow beacon
  }
};
```

## Troubleshooting

### Common Issues

#### Nodes Not Discovering
```bash
# Check frequency alignment
Verify all nodes on same frequency ±100Hz

# Check squelch settings
Set squelch just above noise floor

# Verify network name
All nodes must use same network ID
```

#### Routes Not Establishing
```javascript
// Debug routing
mesh.debug.enable();
mesh.on('routing', (event) => {
  console.log(event);
});

// Force route discovery
mesh.discoverRoute("W9XYZ");
```

#### Poor Link Quality
```javascript
// Monitor link metrics
const link = mesh.getLinkQuality("W5DEF");
console.log(`RSSI: ${link.rssi} dBm`);
console.log(`SNR: ${link.snr} dB`);
console.log(`Loss: ${link.packetLoss}%`);

// Adjust parameters
if (link.snr < 6) {
  mesh.setMode("QPSK-750");  // Reduce rate
}
```

### Performance Optimization

#### Reduce Overhead
```javascript
// Minimize beacons
mesh.setBeaconInterval(60);  // 1 minute

// Compress headers
mesh.enableCompression(true);

// Batch messages
mesh.enableBatching({
  interval: 5000,  // 5 seconds
  maxBatch: 10     // messages
});
```

#### Improve Reliability
```javascript
// Add FEC
mesh.setErrorCorrection({
  type: "ReedSolomon",
  redundancy: 0.2  // 20% overhead
});

// Enable ARQ
mesh.setARQ({
  enabled: true,
  timeout: 5000,
  retries: 3
});
```

## Best Practices

### Network Planning

1. **Coverage Mapping**
   - Plot node locations
   - Verify RF paths
   - Plan for redundancy

2. **Frequency Coordination**
   - Choose clear frequencies
   - Coordinate with local groups
   - Document assignments

3. **Node Configuration**
   - Standardize settings
   - Document configurations
   - Test before deployment

### Operation

1. **Regular Maintenance**
   - Weekly net check-ins
   - Update routing tables
   - Test emergency paths

2. **Monitoring**
   - Log all traffic
   - Track performance metrics
   - Alert on failures

3. **Documentation**
   - Network diagram
   - Contact list
   - Troubleshooting guide

## Mesh Network Commands

### CLI Commands

```bash
# View status
mesh status

# List nodes
mesh nodes

# Show routes
mesh routes

# Ping node
mesh ping W9XYZ

# Trace route
mesh trace W9XYZ

# Send message
mesh send W9XYZ "Test message"
```

### API Reference

```javascript
// Core methods
mesh.init(config)
mesh.start()
mesh.stop()
mesh.send(destination, data)
mesh.broadcast(data)

// Discovery
mesh.discoverNodes()
mesh.discoverRoute(destination)
mesh.addStaticRoute(destination, nextHop)

// Monitoring
mesh.getStatus()
mesh.getRoutingTable()
mesh.getNeighbors()
mesh.getStatistics()

// Events
mesh.on('message', handler)
mesh.on('nodeJoined', handler)
mesh.on('nodeLeft', handler)
mesh.on('routeChanged', handler)
```

## Example Networks

### Local Club Network
```
Members: 10-20 nodes
Topology: Star with mesh backup
Frequency: 2m (145.550 MHz)
Mode: QPSK-2800
Purpose: Local communication
```

### County ARES Network
```
Members: 30-50 nodes
Topology: Hierarchical mesh
Frequency: 40m (7.080 MHz)
Mode: QPSK-1500
Purpose: Emergency communication
```

### Regional Experiment
```
Members: 100+ nodes
Topology: Full mesh
Frequency: 20m (14.085 MHz)
Mode: Adaptive (750-2800)
Purpose: Research and testing
```

## Resources

### Documentation
- [AODV RFC 3561](https://www.rfc-editor.org/rfc/rfc3561)
- [Mesh Networking Basics](https://en.wikipedia.org/wiki/Mesh_networking)
- [Amateur Radio Emergency Data Network](https://www.arednmesh.org/)

### Software
- **HTTP Over Ham Radio**: This application
- **AREDN**: Amateur Radio Emergency Data Network
- **Broadband-Hamnet**: HSMM-MESH

### Communities
- Amateur Radio Mesh Networks Facebook Group
- Reddit r/hamradio mesh discussions
- Local mesh network groups

---

*For mesh network support, join the Thursday night net on 14.230 MHz*