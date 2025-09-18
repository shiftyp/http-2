# Feature Specification: Server CQ Storage

**Feature Branch**: `019-server-cq-storage`
**Created**: 2025-09-18
**Status**: Draft
**Input**: User description: "server cq storage"

## Execution Flow (main)
```
1. Parse user description from Input
   � If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   � Identify: actors, actions, data, constraints
3. For each unclear aspect:
   � Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   � If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   � Each requirement must be testable
   � Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   � If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   � If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## � Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Amateur radio operators need to discover content available on RF-only stations when they connect via WebRTC mode. When RF stations broadcast CQ beacons announcing cached content chunks, this information should be stored and made available to WebRTC clients through the signaling server, enabling hybrid mode stations to bridge content discovery between RF and internet-connected networks.

### Acceptance Scenarios
1. **Given** an RF station broadcasts a CQ beacon with content availability, **When** a hybrid mode station receives the beacon, **Then** the content metadata is uploaded to the signaling server's content registry
2. **Given** a WebRTC client connects to the signaling server, **When** they request available content, **Then** they receive a list including both WebRTC-available content and RF-announced content with routing information
3. **Given** content is announced via CQ beacon, **When** a configurable TTL expires, **Then** the content entry is removed from the server's registry
4. **Given** multiple stations announce the same content hash, **When** the server aggregates announcements, **Then** all source stations are listed with their capabilities (RF chunks vs WebRTC full file)

### Edge Cases
- What happens when content registry reaches storage limits?
- How does system handle conflicting content metadata from different sources?
- What occurs when a hybrid station loses RF reception after uploading content info?
- How does the system prevent stale content entries from accumulating?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST store CQ beacon content announcements received from hybrid mode stations
- **FR-002**: System MUST provide content discovery endpoint for WebRTC clients to query available content across all networks
- **FR-003**: System MUST track content metadata including hash, size, chunk availability, and source stations
- **FR-004**: System MUST expire content entries based on tiered TTL (30 days emergency, 14 days infrastructure, 7 days logistics, 3 days operational, 6 hours routine)
- **FR-005**: System MUST aggregate multiple announcements of the same content from different sources into consolidated entries with multiple paths ordered by last heard time
- **FR-006**: System MUST distinguish between RF chunk availability and WebRTC full file availability
- **FR-007**: System MUST include routing information for multi-hop RF content access with paths ordered by quality (recency, hop count, signal strength)
- **FR-008**: System MUST authenticate hybrid stations via callsign verification using ECDSA challenge-response, with rate limiting (10 beacons/minute, 100 unique items/hour) and trust scoring
- **FR-009**: System MUST provide content search by hash, callsign, or metadata attributes
- **FR-010**: System MUST maintain content freshness indicators based on last announcement time
- **FR-011**: System MUST limit server registry size to 1GB (approximately 500,000 consolidated entries) and client registry to 50MB browser storage
- **FR-012**: System MUST prioritize emergency content over regular content in storage decisions
- **FR-013**: System MUST validate content metadata format before storage
- **FR-014**: System MUST support concurrent updates from multiple hybrid stations
- **FR-015**: System MUST provide batch content query to minimize network overhead
- **FR-016**: System MUST use shared data schema between server and client for CQ beacon storage
- **FR-017**: System MUST consolidate duplicate beacons by merging paths rather than storing separate entries
- **FR-018**: Client applications MUST limit local CQ storage to 50MB with aggressive expiration (1 hour routine, 24 hours emergency)
- **FR-019**: System MUST maintain path diversity by storing up to 10 different routes per content item ordered by last heard time
- **FR-020**: System MUST prune dead paths that haven't been confirmed for more than 1 hour from consolidated entries
- **FR-021**: System MUST resolve content metadata conflicts by trusting most recent update, aggregating non-conflicting data, flagging size/type mismatches, and using majority consensus when 3+ stations agree
- **FR-022**: System MUST meet performance targets: <100ms hash lookups, <500ms wildcard searches, 1000+ concurrent WebSocket connections, 5-second update intervals per station
- **FR-023**: System MUST assign priority tiers per content item based on creator declaration, keyword detection, network consensus voting, and dynamic age/demand adjustments
- **FR-024**: System MUST implement per-page priority inheritance where all chunks of a page inherit the page's priority tier
- **FR-025**: System MUST support gradual station privileges where new stations are limited to 10 entries until verified by 2+ other stations

### Key Entities *(include if feature involves data)*

- **Consolidated Beacon Entry**: Unified content record with multiple access paths, shared schema between client and server
  - Content hash and metadata (size, type, chunks)
  - Multiple paths ordered by last heard time
  - Availability modes (RF chunks, WebRTC full file)
  - Priority tier for retention policy

- **Path Record**: Individual route to content through mesh network
  - Ordered callsign array representing hop sequence
  - Last heard timestamp for freshness
  - Signal quality metric for path selection
  - Hop count for efficiency ranking

- **Content Registry**: Tiered storage system with size limits
  - Server: 1GB capacity with disaster-oriented retention
  - Client: 50MB browser storage with aggressive expiration
  - Shared consolidation logic for deduplication
  - Priority-based eviction when approaching limits

- **Source Station**: Amateur radio station in the mesh network
  - Callsign identifier
  - Capabilities (RF-only, WebRTC, hybrid)
  - Last seen timestamp
  - Content availability list

- **Content Priority Tiers**: Classification for retention and eviction
  - P0: Emergency/Medical (30 days server, 24 hours client)
  - P1: Infrastructure (14 days server, 12 hours client)
  - P2: Logistics (7 days server, 6 hours client)
  - P3: Community (14 days server, 12 hours client)
  - P4: Operational (3 days server, 3 hours client)
  - P5: Routine (6 hours server, 1 hour client)

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
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
- [x] Review checklist passed

---