# Data Model: Mesh Network Visualization

**Phase**: 1 - Design & Contracts
**Date**: 2025-09-14
**Plan**: [plan.md](./plan.md)

## Core Entities

### Station Node
Represents a ham radio station in the mesh network.

**Properties**:
- `callsign: string` - FCC amateur radio callsign (primary identifier)
- `coordinates: { lat: number, lon: number } | null` - GPS location if available
- `lastSeen: Date` - Most recent communication timestamp
- `equipmentInfo: StationEquipment` - Radio and antenna details
- `status: 'active' | 'inactive' | 'unreachable'` - Current connectivity state
- `meshAddress: string` - Network layer address for routing

**Validation Rules**:
- Callsign must match amateur radio format (letters/numbers, 3-6 characters)
- Coordinates must be valid latitude (-90 to 90) and longitude (-180 to 180)
- lastSeen must not be in future
- meshAddress must be unique within network

### StationEquipment
Equipment and RF characteristics for a station.

**Properties**:
- `frequency: number` - Operating frequency in Hz
- `mode: string` - Operating mode (USB, DATA-U, etc.)
- `power: number` - Transmit power in watts
- `antenna: string` - Antenna description (optional)
- `protocolVersion: string` - Mesh protocol version

### ConnectionLink
Represents communication capability between two stations.

**Properties**:
- `source: string` - Source station callsign
- `destination: string` - Destination station callsign
- `connectionType: 'rf' | 'internet'` - Direct RF or internet-assisted
- `frequency: number` - Operating frequency for RF connections
- `protocol: 'VARA' | 'Winlink' | 'PacketRadio' | 'HTTP-QPSK'` - Communication protocol
- `signalQuality: SignalMetrics` - RF signal characteristics
- `lastActive: Date` - Most recent data transmission
- `status: 'active' | 'standby' | 'failed'` - Link operational state

### SignalMetrics
RF signal quality measurements.

**Properties**:
- `snr: number` - Signal-to-noise ratio in dB
- `signalStrength: number` - Received signal strength in dBm
- `linkQuality: number` - Percentage (0-100) link reliability
- `distance: number | null` - Calculated distance in meters if coordinates available
- `pathLoss: number | null` - Calculated path loss in dB

**Validation Rules**:
- SNR typically ranges -10 to +40 dB
- Signal strength typically ranges -120 to -40 dBm
- Link quality must be 0-100 percentage
- Distance must be positive when provided

### RoutePath
Represents actual multi-hop routing path through the network.

**Properties**:
- `source: string` - Origin station callsign
- `destination: string` - Target station callsign
- `hops: string[]` - Ordered array of intermediate station callsigns
- `totalHops: number` - Total hop count including source and destination
- `pathQuality: number` - End-to-end path quality percentage
- `established: Date` - When route was discovered/established
- `isActive: boolean` - Whether route is currently in use

### NetworkTopology
Overall mesh network state and metadata.

**Properties**:
- `networkId: string` - Network identifier
- `stations: Map<string, StationNode>` - All known stations by callsign
- `links: ConnectionLink[]` - All connection links
- `routes: RoutePath[]` - All established routing paths
- `lastUpdate: Date` - Most recent topology change
- `partitionCount: number` - Number of disconnected network segments

### RFPropagation
Visual representation of radio wave coverage.

**Properties**:
- `centerStation: string` - Station callsign at center of propagation
- `frequency: number` - RF frequency in Hz
- `power: number` - Transmit power in watts
- `coverageRadius: number` - Calculated coverage radius in meters
- `propagationModel: 'freeSpace' | 'twoRay'` - Path loss model used
- `terrainFactor: number` - Terrain adjustment factor (1.0 = flat)

**Calculated Properties**:
- Coverage area polygons based on path loss calculations
- Signal strength contours for visualization
- Interference zones where multiple stations overlap

### TrafficFlow
Real-time communication activity visualization.

**Properties**:
- `linkId: string` - Connection link identifier (source-destination)
- `throughput: number` - Current data rate in bits per second
- `packetCount: number` - Packets transmitted in current time window
- `direction: 'bidirectional' | 'sourceToDestination' | 'destinationToSource'`
- `protocol: string` - Application protocol (HTTP, FTP, etc.)
- `priority: 'low' | 'normal' | 'high' | 'emergency'` - Traffic priority
- `startTime: Date` - When current traffic flow began

## State Transitions

### Station Status Transitions
```
active -> inactive: No traffic for 30 seconds
active -> unreachable: Connection attempts fail
inactive -> active: New traffic received
unreachable -> active: Connection restored
```

### Link Status Transitions
```
active -> standby: No data for 10 seconds
active -> failed: Signal quality below threshold
standby -> active: Data transmission resumes
failed -> standby: Signal quality improves
```

### Route Path Lifecycle
```
discovered -> established: Route validation complete
established -> active: Data transmission starts
active -> standby: No current traffic
standby -> expired: Route timeout exceeded
expired -> removed: Cleanup cycle
```

## Data Relationships

- **Station** 1:N **ConnectionLink** (one station can have multiple links)
- **ConnectionLink** 1:1 **SignalMetrics** (each link has current signal data)
- **Station** 1:N **RFPropagation** (station can operate multiple frequencies)
- **ConnectionLink** 1:N **TrafficFlow** (link can carry multiple traffic types)
- **NetworkTopology** contains all other entities as aggregated state

## Indexing Strategy

**Primary Indexes**:
- Stations by callsign (unique)
- Links by source-destination pair
- Routes by source-destination pair

**Secondary Indexes**:
- Stations by last seen timestamp (for cleanup)
- Links by frequency (for interference analysis)
- Links by signal quality (for visualization prioritization)

## Persistence Requirements

**IndexedDB Stores**:
- `stations`: Station nodes with equipment info
- `topology`: Network topology snapshots
- `coordinates`: GPS coordinates cache
- `history`: Historical signal quality data (optional)

**Memory-Only Data**:
- Current traffic flows (too frequent for persistence)
- Real-time signal metrics (high update rate)
- Propagation calculations (derived data)

---

**Phase 1 Status**: ✅ Data Model Complete - 7 entities defined with relationships and validation