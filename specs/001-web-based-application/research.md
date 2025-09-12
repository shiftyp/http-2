# Research Findings: Ham Radio Web Application

## Web Audio API for QPSK Modulation

**Decision**: Use Web Audio API with ScriptProcessorNode/AudioWorklet for real-time QPSK modulation  
**Rationale**: 
- Native browser support for audio processing
- Low latency for real-time radio transmission
- Sufficient sample rate (48kHz) for 2.8kHz bandwidth signals
- Can interface directly with sound card for radio connection

**Alternatives considered**:
- WebRTC: Overkill for point-to-point radio, adds unnecessary complexity
- Server-side processing: Would add latency and require audio streaming
- WebAssembly DSP: More complex, Web Audio API sufficient for QPSK

**Implementation notes**:
- Use AudioWorklet for better performance (replaces deprecated ScriptProcessorNode)
- Implement constellation mapping for QPSK (00, 01, 10, 11 → phase shifts)
- Add root-raised cosine filter for bandwidth limiting

## CAT Control Libraries and Protocols

**Decision**: Use node-serialport with Hamlib command set compatibility  
**Rationale**:
- Hamlib is the de-facto standard for radio control
- Supports 200+ radio models
- Well-documented command protocols
- Active community support

**Alternatives considered**:
- Direct manufacturer protocols: Would limit radio compatibility
- rigctld daemon: Adds complexity, direct serial is simpler
- Web Serial API: Limited browser support, Node.js serialport more reliable

**Supported protocols**:
- Icom CI-V
- Yaesu CAT
- Kenwood CAT
- Elecraft K3/KX3
- Generic Hamlib commands

## Mesh Network Routing Algorithms

**Decision**: Implement AODV (Ad hoc On-Demand Distance Vector) with modifications for radio  
**Rationale**:
- On-demand routing reduces channel congestion
- Works well with variable propagation conditions
- Proven in amateur packet radio networks
- Simple to implement and debug

**Alternatives considered**:
- OLSR: Too chatty for limited bandwidth
- DSR: Source routing adds overhead
- Batman: Designed for WiFi, not optimal for HF propagation
- Custom flooding: Inefficient use of bandwidth

**Radio-specific modifications**:
- Adaptive timeouts based on propagation conditions
- Signal strength weighting in route selection
- Implement store-and-forward for poor conditions
- Add time-of-day routing preferences (HF propagation varies)

## FCC Part 97 Compliance

**Decision**: Implement configurable bandwidth limiting with FCC preset profiles  
**Rationale**:
- Must comply with Part 97.307 emission standards
- Different bands have different bandwidth limits
- User-configurable for international operation

**Key regulations**:
- HF bands (below 28 MHz): 2.8 kHz bandwidth maximum
- Symbol rate: No specific limit (removed in 2024)
- Identification: Callsign must be transmitted every 10 minutes
- Encryption: Prohibited except for control commands
- Third-party traffic: Allowed with restrictions

**Implementation requirements**:
- Bandwidth filter before transmission
- Automatic station identification timer
- Clear-text transmission only (no encryption of content)
- Logging of all transmissions

## Digital Signal Processing

**Decision**: Implement adaptive forward error correction using Reed-Solomon + Convolutional coding  
**Rationale**:
- RS handles burst errors common in HF
- Convolutional coding for additional gain
- Adaptive based on channel conditions
- Standard in many digital modes

**Alternatives considered**:
- LDPC: More complex, marginal improvement
- Turbo codes: Patent concerns, complex
- Simple parity: Insufficient for HF conditions

## Hardware Interface Considerations

**Decision**: Support both direct sound card and USB sound devices  
**Rationale**:
- Maximum compatibility with existing setups
- SignaLink USB is popular in ham community
- Direct sound card for integrated stations
- PTT control via CAT or serial RTS/DTR

**Interface options**:
- Sound: Line in/out or USB audio device
- PTT: CAT command, Serial RTS/DTR, VOX
- CAT: Serial port (USB-to-serial common)

## Document Storage Strategy

**Decision**: Hybrid approach - files for content, SQLite for metadata and indexing  
**Rationale**:
- Files are simple and reliable for markdown
- SQLite provides fast queries for routing
- No external database dependencies
- Easy backup and portability

**Schema design**:
- Documents table: metadata, paths, retention
- Nodes table: callsigns, certificates, last seen
- Routes table: destination, next hop, metric
- Transmissions table: log of all TX/RX

## Certificate Authority Design

**Decision**: Implement lightweight PKI using Node.js crypto module  
**Rationale**:
- Self-contained, no external CA needed
- Based on callsign trust model
- Simple revocation via broadcast
- Compatible with amateur radio practices

**Features**:
- Self-signed root certificate per network
- Station certificates signed by root
- Certificate exchange on first contact
- Revocation list distributed via mesh

---
*Research completed: 2025-09-12*