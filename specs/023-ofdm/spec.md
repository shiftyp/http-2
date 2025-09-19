# Feature Specification: OFDM with BitTorrent Content Distribution

**Feature Branch**: `023-ofdm`
**Created**: 2025-09-18
**Status**: Draft
**Input**: User description: "OFDM"

## Execution Flow (main)
```
1. Parse user description from Input
   � Extract: OFDM modulation with BitTorrent content distribution
2. Extract key concepts from description
   � Identify: radio operators, OFDM transmission, BitTorrent chunks, mesh network
3. For each unclear aspect:
   � Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   � Define clear user flows for content distribution
5. Generate Functional Requirements
   � Each requirement must be testable
   � Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   � Check for implementation details
8. Return: SUCCESS (spec ready for planning)
```

---

## � Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a ham radio operator, I want to transmit multiple BitTorrent chunks simultaneously across parallel OFDM subcarriers, so that I can achieve massive throughput gains by sending different pieces of content in parallel rather than sequentially.

### Acceptance Scenarios
1. **Given** a 10KB file split into 40x 256-byte BitTorrent chunks, **When** transmitted over 48 OFDM subcarriers, **Then** multiple chunks transmit in parallel achieving 100+ kbps effective throughput
2. **Given** 48 active OFDM subcarriers, **When** each carries a different BitTorrent chunk, **Then** 48 chunks transfer simultaneously in one OFDM symbol period
3. **Given** a request for chunks #1-48, **When** OFDM transmission begins, **Then** each subcarrier group handles different chunks in parallel (subcarriers 1-4 = chunk 1, subcarriers 5-8 = chunk 2, etc.)
4. **Given** multiple peers requesting different chunks, **When** station transmits, **Then** OFDM subcarriers are dynamically allocated to serve different chunks to different peers simultaneously
5. **Given** some subcarriers have better SNR, **When** allocating chunks, **Then** critical chunks (rare pieces) are assigned to most reliable subcarriers
6. **Given** interference on subcarriers 10-15, **When** transmitting chunks, **Then** system redistributes those chunks to healthy subcarriers maintaining parallel transmission

### Edge Cases
- What happens when only narrow bandwidth is available? System falls back to single-carrier QPSK mode
- How does system handle selective fading? OFDM uses pilot tones for channel estimation and equalizes affected subcarriers
- What if no peers have requested chunks? System broadcasts CQ beacons with content availability using OFDM
- How to handle mixed-mode network? Stations negotiate capabilities and use highest common mode

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST support parallel BitTorrent chunk transmission across 48+ OFDM subcarriers
- **FR-002**: System MUST map individual torrent chunks to specific subcarrier groups for parallel transfer
- **FR-003**: System MUST achieve 100+ kbps aggregate throughput by parallelizing chunk transmission
- **FR-004**: System MUST dynamically allocate subcarriers to different chunks based on demand
- **FR-005**: System MUST transmit up to 48 different chunks simultaneously in a single OFDM symbol
- **FR-006**: System MUST adapt modulation per subcarrier (BPSK/QPSK/16-QAM) based on per-carrier SNR
- **FR-007**: System MUST reassign chunks from failed subcarriers to healthy ones without interrupting parallel streams
- **FR-008**: System MUST support "chunk pipelining" where next chunks queue for transmission as subcarriers free up
- **FR-009**: System MUST allocate more subcarriers to rare chunks to improve swarm completion time
- **FR-010**: System MUST provide chunk-to-subcarrier mapping table for monitoring parallel transfers
- **FR-011**: System MUST maintain FCC compliance with [NEEDS CLARIFICATION: emission designator for parallel OFDM - 2K80J2D?]
- **FR-012**: System MUST fall back to sequential single-carrier mode if parallel OFDM unavailable
- **FR-013**: System MUST implement pilot tones between chunk-carrying subcarriers for synchronization
- **FR-014**: System MUST support partial chunk retransmission on specific corrupted subcarriers
- **FR-015**: System MUST provide visual matrix display showing chunk×subcarrier allocation in real-time
- **FR-016**: System MUST prioritize emergency/priority content chunks to most reliable subcarriers
- **FR-017**: System MUST achieve 20-50x speedup over sequential transmission through parallelization

### Performance Requirements
- **PR-001**: Latency MUST be under 100ms for chunk requests in good conditions
- **PR-002**: System MUST handle at least 10 concurrent peer connections
- **PR-003**: CPU usage MUST stay under [NEEDS CLARIFICATION: acceptable CPU percentage?] during OFDM processing
- **PR-004**: System MUST achieve 90% of theoretical throughput in lab conditions

### Key Entities *(include if feature involves data)*
- **Parallel Chunk Frame**: OFDM symbol carrying multiple BitTorrent chunks simultaneously across subcarriers
- **Subcarrier Group**: Set of 1-4 subcarriers allocated to transmit a single torrent chunk
- **Chunk Allocation Map**: Real-time matrix showing which chunk is assigned to which subcarrier group
- **Parallel Transfer Session**: Tracks multiple simultaneous chunk transfers across OFDM spectrum
- **Chunk Pipeline**: Queue of chunks waiting for available subcarriers, ordered by rarity
- **Carrier Health Map**: Per-subcarrier SNR and error rates to optimize chunk placement
- **Swarm Efficiency Metric**: Measure of how parallel transmission improves overall swarm completion time

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (has clarifications needed)

---

## Notes
This specification focuses on **parallelizing BitTorrent chunk transmission across OFDM subcarriers** to achieve massive throughput gains. Instead of sending chunks sequentially, the system transmits up to 48 different chunks simultaneously - one chunk per subcarrier group. This parallel approach can achieve 20-50x speed improvements over sequential transmission.

### Key Innovation: Parallel Chunk Transmission
- Traditional: Send chunk 1, then chunk 2, then chunk 3... (sequential)
- OFDM Parallel: Send chunks 1-48 simultaneously across different frequencies
- Each OFDM symbol carries multiple complete chunks in parallel
- Failed chunks on bad subcarriers automatically redistribute to good ones
- Rare chunks get more subcarriers to optimize swarm health

This creates a "massively parallel" content distribution system where the 2.8 kHz bandwidth is divided into 48+ independent data streams, each carrying different parts of the content simultaneously.