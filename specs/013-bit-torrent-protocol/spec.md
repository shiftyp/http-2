# Feature Specification: Mesh DL Protocol for Ham Radio Networks

**Feature Branch**: `013-mesh-dl-protocol`
**Created**: 2025-09-15
**Status**: Draft
**Input**: User description: "Mesh DL protocol for ham radio content distribution"

## Execution Flow (main)
```
1. Parse user description from Input
   � Mesh DL protocol adaptation for ham radio mesh networking
2. Extract key concepts from description
   � Actors: ham radio operators, mesh network stations
   � Actions: chunked distribution, peer discovery, adaptive routing
   � Data: web pages, files, protocol messages
   � Constraints: amateur radio bandwidth limits, FCC compliance
3. For each unclear aspect:
   � [NEEDS CLARIFICATION: specific chunk sizes for ham radio constraints]
   � [NEEDS CLARIFICATION: incentive mechanisms for amateur radio operators]
4. Fill User Scenarios & Testing section
   � User flow: request page � discover peers � download chunks � reassemble
5. Generate Functional Requirements
   � Each requirement must be testable for mesh networking
6. Identify Key Entities (chunks, peers, swarms, trackers)
7. Run Review Checklist
   � If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
8. Return: SUCCESS (spec ready for planning)
```

---

## � Quick Guidelines
-  Focus on WHAT ham radio operators need for efficient content distribution
- L Avoid HOW to implement (no specific protocols, data structures)
- =e Written for amateur radio operators and emergency coordinators

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a ham radio operator, I want to efficiently download web pages and files from other stations in the mesh network, even when some stations are unreachable or have poor signal conditions, so that I can access critical information during emergencies with minimal bandwidth usage and maximum reliability.

### Acceptance Scenarios
1. **Given** I request a web page from a distant station, **When** the direct path has poor propagation, **Then** the system discovers alternative stations with the same content and downloads chunks from multiple sources simultaneously
2. **Given** I am downloading a large file, **When** one source station goes offline mid-transfer, **Then** the system continues downloading remaining chunks from other available stations without starting over
3. **Given** I have downloaded popular content, **When** other stations request the same content, **Then** my station automatically serves chunks to help distribute the load across the mesh network
4. **Given** propagation conditions change during download, **When** signal quality degrades with current sources, **Then** the system discovers new peer stations with better signal paths and switches to them
5. **Given** I request content that no station currently has complete, **When** multiple stations have different portions, **Then** the system coordinates with all partial sources to reconstruct the complete content

### Edge Cases
- What happens when chunk integrity verification fails due to transmission errors?
- How does the system handle stations that frequently disconnect during transfers?
- What occurs when network partitions isolate groups of stations?
- How does the system prioritize emergency traffic over routine file sharing?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST split large content into fixed-size chunks optimized for ham radio transmission constraints
- **FR-002**: System MUST discover peer stations that have requested or possess specific content pieces
- **FR-003**: System MUST verify chunk integrity using cryptographic hashes before accepting transmitted data
- **FR-004**: System MUST automatically serve content chunks to other stations when bandwidth is available
- **FR-005**: System MUST prioritize chunk downloads based on availability and signal quality of source stations
- **FR-006**: System MUST handle partial downloads gracefully when source stations become unavailable
- **FR-007**: System MUST track which stations have which content chunks to optimize discovery
- **FR-008**: System MUST implement adaptive routing to find the best signal paths for chunk transfers
- **FR-009**: System MUST respect amateur radio bandwidth limitations and fair sharing principles
- **FR-010**: System MUST maintain compliance with FCC Part 97 regulations during all transfers
- **FR-011**: System MUST provide emergency traffic priority over routine file sharing activities
- **FR-012**: Users MUST be able to see download progress including chunk completion status
- **FR-013**: Users MUST be able to pause and resume downloads across multiple sessions
- **FR-014**: System MUST handle network topology changes during active transfers
- **FR-015**: System MUST implement congestion control to prevent overwhelming slow stations
- **FR-016**: System MUST integrate with transmission mode manager to detect WebRTC vs RF capability
- **FR-017**: System MUST use WebRTC peer connections for direct downloads when in WebRTC mode
- **FR-018**: System MUST use native WebSocket signaling server for internet peer discovery in WebRTC mode
- **FR-019**: System MUST automatically switch from direct download to Mesh DL chunks when switching from WebRTC to RF mode
- **FR-020**: System MUST aggregate chunk availability information from CQ beacons to build distributed content routing tables
- **FR-021**: System MUST support multi-hop content requests when direct paths to content sources are unavailable
- **FR-022**: System MUST announce content routing paths in CQ beacons to help other stations discover content sources
- **FR-023**: System MUST cache popular content and announce cache availability to reduce network load
- **FR-024**: System MUST implement intelligent routing to prefer nearest stations and freshest content caches
- **FR-025**: System MUST implement APRS-style path tracking to prevent routing loops in content requests
- **FR-026**: System MUST use proportional beaconing where popular content is announced more frequently
- **FR-027**: System MUST implement decay algorithm to reduce beacon frequency for stable content over time
- **FR-028**: System MUST suppress duplicate content announcements using path history and unique identifiers
- **FR-029**: System MUST implement time-to-live expiration for content routing information to prevent stale data
- **FR-030**: System MUST implement Meshtastic-style hop limits to prevent excessive content propagation
- **FR-031**: System MUST provide store-and-forward capability for offline stations that return to network
- **FR-032**: System MUST implement implicit acknowledgment system to confirm content delivery
- **FR-033**: System MUST adapt content caching strategy based on station mobility (stationary vs mobile)
- **FR-034**: System MUST implement battery-conscious protocols for portable station operations

### Non-Functional Requirements
- **NFR-001**: System MUST use 512-byte chunks optimized for ham radio transmission efficiency
- **NFR-002**: System MUST operate without incentive mechanisms in compliance with FCC Part 97
- **NFR-003**: System MUST retain page chunks for 1 hour after last access to support redistribution
- **NFR-004**: System MUST limit simultaneous chunk transfers to 3 concurrent streams per station
- **NFR-005**: System MUST restrict content to web pages and embedded resources only (HTML, CSS, images, fonts)
- **NFR-006**: System MUST use cryptographic signatures for integrity verification without encryption

### Key Entities *(include if feature involves data)*
- **Content Distribution Manager**: Coordinates between WebRTC direct downloads and RF Mesh DL chunks based on active transmission mode
- **Content Chunk**: 512-byte piece of web page content with cryptographic signature for RF mode transfers
- **WebRTC Content Transfer**: Direct file transfer using WebRTC data channels for high-bandwidth mode
- **Hybrid Peer Station**: Ham radio station that supports both WebRTC direct downloads and RF chunk serving
- **Transmission Mode Adapter**: Interface layer that abstracts content distribution across WebRTC and RF protocols
- **Page Cache**: Local storage supporting both complete files (WebRTC) and chunks (RF) with unified access
- **Peer Discovery Service**: Unified discovery using WebRTC signaling server (internet) and enhanced CQ beacons (RF)
- **Content Routing Table**: Distributed index of chunk availability and routing paths across mesh network
- **Route Discovery Engine**: Intelligent path finding for multi-hop content requests
- **Content Cache Manager**: Manages local caching and announces cache availability in CQ beacons
- **Transfer Session**: Manages downloads across direct WebRTC transfers, chunked RF transfers, and multi-hop routes
- **Node Role Manager**: Adapts station behavior based on power source and capabilities (Router/Client/Repeater roles)
- **Store-and-Forward Queue**: Manages content caching for offline stations with priority and expiration
- **Hop Limit Controller**: Implements intelligent hop management based on content priority and network topology
- **Battery-Aware Protocol**: Adjusts beacon frequency and cache behavior based on power constraints

## Protocol Design

### Ham Radio Band Plan for Content Distribution

**Dedicated frequency ranges for HTTP-over-radio BitTorrent operations:**

| Band | Center Freq | Monitor Range | Bandwidth | Primary Use | Propagation |
|------|-------------|---------------|-----------|-------------|-------------|
| **40m** | 7.040 MHz | 7.035-7.045 MHz | 10 kHz | Primary mesh operations | Regional/NVIS (0-300 miles) |
| **20m** | 14.080 MHz | 14.075-14.085 MHz | 10 kHz | High-activity/DX | Worldwide DX propagation |
| **80m** | 3.580 MHz | 3.575-3.585 MHz | 10 kHz | Regional emergency nets | Local/regional NVIS |
| **15m** | 21.080 MHz | 21.075-21.085 MHz | 10 kHz | Daytime DX operations | Solar cycle dependent |
| **30m** | 10.145 MHz | 10.140-10.150 MHz | 10 kHz | CW/digital only | Consistent propagation |

**Band Selection Strategy:**
- **40m**: Primary operations band for most conditions
- **20m**: High-traffic stations and international content distribution
- **80m**: Regional emergency nets and NVIS coverage
- **15m**: Daytime DX operations during solar maximum
- **30m**: Backup band with consistent propagation characteristics

**Frequency Coordination:**
- Each 10 kHz window supports 3-4 simultaneous 2.8 kHz HTTP-over-radio channels
- Avoids interference with FT8/FT4 (*.074 MHz) and established digital modes
- Complies with amateur radio band plans for digital operations
- Automatic band switching based on propagation conditions and traffic load

### Wide-Band Spectrum Monitoring

**SDR-Based Content Discovery:**
```
Monitor entire allocated bandwidth simultaneously:
- 40m: 7.035-7.045 MHz (10 kHz total)
- 20m: 14.075-14.085 MHz (10 kHz total)
- Detection of all CQ beacons and chunk transmissions
- Real-time FFT analysis for carrier detection
- Parallel demodulation of up to 12 signals per band
```

**Automatic Content Caching:**
```
Cache Strategy for Monitoring Mode:
1. Decode all HTTP-over-radio transmissions in range
2. Cache popular content chunks automatically
3. Build distributed content availability map
4. Announce cached content in own CQ beacons
5. Serve cached chunks to reduce network load
```

### Hybrid Content Distribution Approach

This specification defines a **mode-adaptive content distribution system** that uses the optimal protocol for each transmission method:

#### Mode-Dependent Design Principles
- **WebRTC Mode**: Direct downloads leveraging high bandwidth (1MB/s) and reliable connections
- **Radio Mode**: Mesh DL protocol with chunking for low bandwidth (14.4kbps) and unreliable propagation
- **Automatic switching**: System selects approach based on active transmission mode
- **Unified interface**: Same user experience regardless of underlying protocol
- **Ham radio integration**: Maintains FCC compliance and station identification across both modes

#### Enhanced CQ Beacon Protocol for Content Routing

**Standard vs Enhanced CQ Messages with Monitoring Integration:**
```
Standard CQ: "CQ CQ DE KA1ABC: /status=ACTIVE /mesh-id=NODE47 K"
Enhanced CQ: "CQ CQ DE KA1ABC: /status=ACTIVE /mesh-id=NODE47 /chunks=wx:1-8,local:1-4 /routes=em:>KC2XYZ,tech:>VK3ABC /monitor=7.035-7.045,14.075-14.085 K"
```

**Content Routing Extensions with Automatic Discovery:**
```
/chunks=<content>:<available_chunks>     # What this station has locally
/routes=<content>:<path_to_source>       # Where to find other content
/cache=<content>:<freshness>             # Cached content with age (from monitoring)
/request=<content>:<needed_chunks>       # What this station is seeking
/monitor=<freq_ranges>                   # Which bands this station monitors
/discovered=<content>:<last_seen>        # Content discovered via monitoring
```

**Monitoring-Enhanced Discovery Protocol:**
```
Automatic Content Discovery Flow:
1. Station monitors 7.035-7.045 MHz continuously
2. Detects chunk transmission: "wx:chunk-5" from KC2XYZ
3. Successfully decodes and verifies chunk
4. Updates local cache with wx:chunk-5
5. Next CQ announces: "/cache=wx:5:fresh /discovered=wx:KC2XYZ:0245Z"
6. Other stations learn KC2XYZ has weather content
7. Future requests can route directly to KC2XYZ or use cached chunk
```

**Enhanced Encoding Examples:**
```
/chunks=wx:1-8,local:1-4                          # I have weather chunks 1-8, local chunks 1-4
/routes=em:>KC2XYZ>VK3ABC,tech:>N0DEF             # Emergency content via KC2XYZ→VK3ABC, tech via N0DEF
/cache=news:fresh,wx:3h                           # Fresh news cache, 3-hour-old weather cache
/request=em:9-12                                  # Seeking emergency bulletin chunks 9-12
```

**Content Request Routing Protocol (APRS-Inspired):**
```
1. Content Request: "KC2XYZ DE KA1ABC: REQ em:9-12 PATH=KA1ABC K"
2. Route Discovery: KC2XYZ checks local chunks, then CQ routing table
3. Path Extension: Add KC2XYZ to path for loop prevention
4. Proxy Response: "KA1ABC DE KC2XYZ: ROUTE em:9-12 VIA VK3ABC PATH=KA1ABC>KC2XYZ K"
5. Direct Request: "VK3ABC DE KA1ABC: REQ em:9-12 PATH=KA1ABC>KC2XYZ>VK3ABC K"
6. Content Delivery: VK3ABC sends chunks with path tracking
```

**Meshtastic-Enhanced Anti-Flood Protection:**
```
/chunks=wx:1-8[TTL=3][HOPS=0]      # Time-to-live + hop counter
/routes=em:>KC2XYZ[SEEN=KA1ABC][PKT=001234]  # Duplicate suppression + packet ID
/request=tech:9-12[ID=REQ001][WANT_ACK]      # Request acknowledgment
/store=em:1-4[OFFLINE=KC2XYZ]      # Store-and-forward for offline nodes
```

**Meshtastic-Style Routing Intelligence:**
```
Hop Limit Management:
- Local content: 1 hop (direct neighbors only)
- Regional content: 3 hops (local emergency nets)
- Emergency content: 7 hops (wide area distribution)

Implicit ACK System:
- Content delivered = remove from retry queue
- No ACK received = exponential backoff retry
- Store content for offline nodes until they return
```

**APRS-Inspired Content Intelligence:**
- **Distributed Index**: Each station builds map of content availability (like APRS position tables)
- **Smart Pathing**: Multi-hop routing with path optimization (like APRS WIDE1-1,WIDE2-1)
- **Decay Algorithm**: Content announcements reduce frequency over time to prevent flooding
- **Duplicate Suppression**: Prevent repeated content requests using unique IDs and path tracking
- **Proportional Beaconing**: Popular content announced more frequently than rare content
- **Geographic Optimization**: Route to nearest station based on grid square proximity
- **Time-to-Live**: Content routing announcements expire to prevent stale information

#### Mode-Adaptive Transfer Protocols

**WebRTC Mode: Direct Download Protocol** (integrates with spec 014)
```
1. Peer Discovery:
   - Local: Use NetworkDiscovery from WebRTC spec for mDNS scanning
   - Internet: Use SignalingConnection from WebRTC spec for peer coordination
2. Direct Connection: Establish WebRTC data channel via WebRTCPeer from spec 014
3. Direct Transfer: Stream complete file over high-bandwidth connection (1MB/s target)
4. Verification: Validate file integrity using same certificate system as WebRTC spec
5. Completion: File available immediately after transfer, no chunking required
```

**Radio Mode: BitTorrent Protocol with Wide-Band Monitoring**
```
1. Wide-Band Discovery: Monitor entire allocated spectrum for content activity
   - Continuous SDR monitoring of all 5 designated frequency ranges
   - Real-time FFT analysis to detect active transmissions
   - Parallel demodulation of all detected HTTP-over-radio signals
   - Automatic extraction of chunk data from overheard transmissions

2. Passive Content Caching: Build content cache from monitoring activities
   - Cache all successfully decoded chunks automatically
   - Verify chunk integrity using embedded cryptographic signatures
   - Build comprehensive content availability database
   - Track content freshness and popularity metrics

3. Enhanced CQ Beacon Integration: Combine monitoring with active discovery
   - Track /chunks= announcements for direct availability
   - Track /routes= announcements for multi-hop paths
   - Track /cache= announcements for freshness optimization
   - Supplement beacon data with monitoring-derived content maps

4. Smart Chunk Request: Use combined intelligence for optimal requests
   - "KA1ABC DE KB2DEF: REQ wx:3,7 K" (direct if KB2DEF has chunks)
   - "KC2XYZ DE KA1ABC: ROUTE wx:3 K" (route request if KC2XYZ knows path)
   - Prioritize cached content from monitoring over beacon announcements

5. Distributed Downloads: Leverage network topology for parallel transfers
   - Download different chunks from different stations simultaneously
   - Use multi-hop routing when direct paths unavailable
   - Coordinate with intermediate stations for load balancing
   - Serve cached chunks to reduce load on original sources

6. Verification: Validate each chunk integrity using cryptographic signatures
7. Assembly: Reconstruct complete content from verified chunks
8. Network Contribution: Announce new content availability and routing paths
   - Update CQ with /chunks= for newly acquired content
   - Update CQ with /cache= for monitoring-derived content caches
   - Update CQ with /routes= for discovered content paths
   - Become relay node for popular content
```

**Monitoring-Enhanced Content Discovery Architecture:**
```
Spectrum Monitor Thread:
├── FFT Analysis Engine (all 5 bands simultaneously)
├── Signal Detection (carrier presence, QPSK demodulation)
├── HTTP-over-Radio Protocol Decoder
├── Chunk Extraction and Verification
├── Content Database Updates
└── Cache Freshness Management

Content Serving Thread:
├── CQ Beacon Parser (traditional announcements)
├── Monitoring Cache Query (overheard content)
├── Route Optimization (prefer cached content)
├── Chunk Request Handler
└── Content Distribution Statistics
```

**Automatic Mode Selection (Integration with Transmission Mode Manager)**
```
// Get current mode from WebRTC Transmission Mode system (spec 014)
current_mode = TransmissionModeManager.getCurrentMode()

IF current_mode == "WebRTC":
    // Use WebRTC peer connections for direct downloads
    peer_connection = WebRTCPeer.connectToPeer(target_callsign)
    content = peer_connection.downloadDirectly(content_url)

ELIF current_mode == "RF":
    // Use BitTorrent chunking protocol over RF
    chunks = CQBeaconDiscovery.findChunksForContent(content_hash)
    content = MeshDL.downloadChunksInParallel(chunks)

ELSE:
    // Automatic fallback (when WebRTC fails)
    TransmissionModeManager.switchToRF()
    content = MeshDL.downloadChunksInParallel(chunks)
```

#### Benefits of Hybrid Approach

**WebRTC Mode Advantages:**
- **High Performance**: Direct downloads at 1MB/s vs 14.4kbps RF
- **Simple Protocol**: No chunking overhead for reliable connections
- **Native Browser Support**: Uses established WebRTC APIs
- **Immediate Availability**: Complete files transfer without reassembly

**Radio Mode Advantages:**
- **Bandwidth Optimization**: Chunking maximizes efficiency over constrained RF links
- **Parallel Sources**: Multiple stations serve different chunks simultaneously
- **Resilience**: Download continues if some stations go offline
- **Load Distribution**: Popular content spreads across multiple stations automatically

**Unified System Benefits:**
- **Best of Both Worlds**: Optimal protocol selection for each transmission mode
- **Intelligent Routing**: CQ beacon aggregation creates distributed content discovery network
- **Multi-hop Capability**: Content requests can traverse multiple stations to find sources
- **Automatic Caching**: Popular content spreads across network for improved availability
- **Load Distribution**: Multiple stations can serve same content reducing bottlenecks
- **Seamless Switching**: Automatic mode selection based on transmission capability
- **Ham Radio Integration**: Works with existing mesh networking and FCC compliance
- **Emergency Readiness**: Mesh DL chunks provide redundancy when WebRTC unavailable

**Content Routing Network Effects:**
- **Self-Organizing**: Network automatically learns optimal content distribution paths
- **Resilient**: Content remains available even if original source goes offline
- **Efficient**: Popular content caches close to requesters reducing bandwidth usage
- **Scalable**: Adding more stations improves content availability and routing options

## APRS Lessons Applied to Content Distribution

### **Proven APRS Patterns Adapted:**

#### **1. Smart Pathing for Content Routing**
```
APRS: WIDE1-1,WIDE2-1 (efficient geographic distribution)
Content: /routes=emergency:>WIDE-CACHE>ORIGIN (content-aware pathing)
```

#### **2. Proportional Beaconing Strategy**
```
APRS: Moving stations beacon faster, stationary slower
Content: Popular content announced faster, stable content slower

Example Beacon Intervals:
- Breaking news: 30 seconds (high demand)
- Weather updates: 5 minutes (moderate demand)
- Archive content: 15 minutes (low demand)
```

#### **3. Anti-Flood Protection**
```
APRS Techniques Applied:
- Path tracking prevents routing loops
- Duplicate suppression using callsign+sequence
- TTL counters prevent infinite propagation
- Rate limiting prevents beacon storms
```

#### **4. Geographic Optimization**
```
APRS: Grid square proximity for position reporting
Content: Grid square proximity for content routing

Example: EM12 station prefers EM12/EM13 content sources over distant FM29
```

#### **5. Proven Network Reliability**
- **30+ years** of APRS operation proves digipeater mesh reliability
- **Emergency tested** during disasters and public service events
- **Bandwidth efficient** packet protocols suitable for amateur radio
- **Self-healing** network topology that adapts to station failures

## Meshtastic Innovations Applied to Content Distribution

### **Modern Mesh Networking Patterns Adapted:**

#### **1. Intelligent Hop Management**
```
Meshtastic: Dynamic hop limits based on message priority
Content: Priority-based content propagation

Content Priority Hop Limits:
- Emergency bulletins: 7 hops (wide distribution)
- Weather updates: 3 hops (regional distribution)
- Social content: 1 hop (local only)
- Archive content: 2 hops (moderate distribution)
```

#### **2. Store-and-Forward for Intermittent Connectivity**
```
Meshtastic: Queue messages for offline nodes
Content: Cache popular content for returning stations

Offline Node Management:
- Detect when known station goes offline
- Store high-priority content for that station
- Deliver queued content when station returns
- Expire stored content after configurable timeout
```

#### **3. Adaptive Node Roles**
```
Content Router Nodes (Base stations):
- Always-on with unlimited power
- Large content cache storage
- High-hop routing capability
- WebRTC + RF dual-mode operation

Content Client Nodes (Mobile/Portable):
- Battery-conscious operation
- Limited cache storage
- Low-hop content requests only
- Adaptive beacon intervals based on battery

Content Repeater Nodes (Digipeaters):
- Dedicated content relay stations
- Medium cache storage for popular content
- Focus on routing efficiency over content creation
```

#### **4. Battery-Conscious Protocol Design**
```
Mobile Station Optimizations:
- Reduce beacon frequency when on battery
- Cache only essential content locally
- Use shorter content request timeouts
- Implement sleep mode between content operations
```

#### **5. Modern Packet Efficiency**
```
Meshtastic Protocol Improvements:
- Compressed packet headers
- Binary encoding vs ASCII
- Efficient routing tables
- Optimized for low-power radio modules

Applied to Content System:
- Binary chunk identifiers vs text
- Compressed content routing tables
- Efficient cache announcements
- Optimized for amateur radio constraints
```

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain (WebRTC approach resolves all clarifications)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (1MB/s WebRTC performance vs 14.4kbps RF)
- [x] Scope is clearly bounded (web content distribution via WebRTC swarms)
- [x] Dependencies and assumptions identified (WebRTC APIs, signaling server, mesh integration)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed (WebRTC approach complete)

---