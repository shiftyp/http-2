# Feature Specification: Unlicensed Mode

**Feature Branch**: `016-unlicensed-mode`
**Created**: 2025-09-16
**Status**: Ready for Implementation
**Purpose**: Enable read-only access for unlicensed users while maintaining FCC compliance

## Summary
Allow unlicensed users to browse content and connect to distributed servers in read-only mode, while restricting transmit capabilities and server hosting to licensed amateur radio operators.

## User Scenarios & Testing

### Primary User Story
As an unlicensed user interested in ham radio, I want to browse content from the mesh network and observe communications, so that I can learn about amateur radio before obtaining my license.

### Acceptance Scenarios
1. **Given** an unlicensed user opens the PWA, **When** they connect to a distributed server, **Then** they can browse all public content but cannot transmit or host servers
2. **Given** an unlicensed user attempts to download the server binary, **When** the system checks for a certificate, **Then** access is denied with information about licensing requirements
3. **Given** an unlicensed user is connected to the mesh, **When** they attempt to create or modify content, **Then** the action is blocked with a message about licensing requirements
4. **Given** an unlicensed user views content, **When** they want to respond, **Then** they see options to learn about getting licensed

### Edge Cases
- What happens when a licensed user's certificate expires? They revert to unlicensed mode until renewed
- Can unlicensed users participate in WebRTC? Yes, for receiving content only (no relay capability)
- How are unlicensed users identified? Absence of valid certificate = unlicensed
- Can unlicensed users cache content? Yes, for offline viewing only

## Requirements

### Functional Requirements
- **FR-001**: System MUST detect absence of valid amateur radio certificate
- **FR-002**: Unlicensed users MUST have read-only access to all public content
- **FR-003**: Server binary download MUST be restricted to certificate holders
- **FR-004**: Transmit functions MUST be disabled for unlicensed users
- **FR-005**: UI MUST clearly indicate unlicensed status and restrictions
- **FR-006**: System MUST provide path to licensing information
- **FR-007**: Unlicensed users MUST be able to receive WebRTC streams
- **FR-008**: Content caching MUST work in unlicensed mode for offline viewing
- **FR-009**: Unlicensed users MUST NOT be able to relay or host content
- **FR-010**: System MUST track and display unlicensed user statistics separately

### Non-Functional Requirements
- **NFR-001**: License check must complete within 100ms
- **NFR-002**: UI restrictions must be immediately visible
- **NFR-003**: No performance degradation for licensed users
- **NFR-004**: Clear visual distinction between modes

### Key Entities
- **UserMode**: Enum of 'licensed' | 'unlicensed'
- **AccessLevel**: Read-only vs full access permissions
- **RestrictedFeatures**: List of features disabled in unlicensed mode
- **LicensePrompt**: UI elements guiding to licensing resources

## Implementation Approach

### Detection Logic
1. Check for certificate in IndexedDB
2. Validate certificate if present
3. Set user mode based on validation
4. Apply appropriate restrictions

### UI Adaptations
- Disabled transmit buttons
- "License Required" badges on restricted features
- Prominent "Get Licensed" call-to-action
- Read-only indicators on all inputs

### Server Interaction
- Include mode in all API requests
- Server enforces restrictions regardless of client
- Separate connection pools for licensed/unlicensed
- No CA or relay capabilities for unlicensed

## Success Metrics
- Unlicensed users can successfully browse content
- Zero unauthorized transmissions
- Clear understanding of restrictions
- Conversion path to licensed mode visible

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details
- [x] Focused on user value
- [x] Written for stakeholders
- [x] All sections completed

### Requirement Completeness
- [x] Requirements are testable
- [x] Success criteria measurable
- [x] Scope clearly bounded
- [x] Dependencies identified

## Notes for Implementation
This feature ensures FCC compliance while making the application accessible to those interested in ham radio. The clear progression from unlicensed observer to licensed operator supports community growth while maintaining regulatory compliance.