# Research: Mesh Network Visualization

**Phase**: 0 - Research and Analysis
**Date**: 2025-09-14
**Plan**: [plan.md](./plan.md)

## Research Areas

### 1. Canvas vs WebGL for Network Visualization

**Decision**: Canvas 2D with WebGL fallback for large networks (50+ nodes)

**Rationale**:
- Canvas 2D provides sufficient performance for typical mesh networks (10-30 nodes)
- Easier to implement RF propagation visualization with gradients and transparency
- WebGL offers better performance for large networks but adds complexity
- Existing codebase uses Canvas for other visualizations (waterfall display)

**Alternatives considered**:
- Pure WebGL: Better performance but higher complexity, learning curve
- SVG: Good for interactive elements but poor performance for real-time updates
- D3.js: Powerful but adds dependency overhead, not optimized for RF visualizations

### 2. Real-time Data Integration with Existing Mesh Library

**Decision**: Event-driven updates from existing mesh-networking library

**Rationale**:
- Existing `src/lib/mesh-networking/` already tracks topology changes
- Can subscribe to mesh events for real-time updates
- Avoids polling and reduces bandwidth usage
- Maintains consistency with existing mesh state management

**Alternatives considered**:
- Polling mesh state: Simple but inefficient, increases bandwidth usage
- Separate WebSocket connection: Redundant with existing mesh protocol
- Direct radio monitoring: Would require duplicating mesh protocol logic

### 3. GPS Integration Strategy

**Decision**: HTML5 Geolocation API with manual coordinate fallback

**Rationale**:
- Browser's geolocation provides automatic positioning when available
- Manual coordinate entry essential for fixed stations without GPS
- Consistent with PWA's offline-first architecture
- No external mapping service dependencies

**Alternatives considered**:
- GPS serial integration: Complex, device-specific, not browser-compatible
- External GPS services: Requires internet connectivity, violates offline-first
- IP-based geolocation: Inaccurate for ham radio applications

### 4. RF Propagation Modeling Approach

**Decision**: Simplified path loss model with SNR-based visualization

**Rationale**:
- Free space path loss calculation: 20*log10(distance) + 20*log10(frequency) - 147.55
- SNR data already available from existing modem implementations
- Visual representation using color gradients and transparency
- Computationally efficient for real-time updates

**Alternatives considered**:
- ITU-R P.1546 model: Too complex for browser implementation, requires terrain data
- Longley-Rice model: Requires topographic database, not suitable for PWA
- Ray tracing: Too computationally intensive for browser real-time use

### 5. Interactive UI Framework Integration

**Decision**: React components with Canvas integration via useRef

**Rationale**:
- Consistent with existing PWA React 18 architecture
- Canvas element managed as React ref for direct rendering control
- React handles UI state, Canvas handles visualization rendering
- Maintains existing component architecture patterns

**Alternatives considered**:
- React-Canvas libraries: Add dependency overhead, limited RF-specific features
- Pure Canvas application: Breaks consistency with existing React architecture
- React-Three-Fiber: 3D overhead not needed for 2D network topology

### 6. Performance Optimization Strategy

**Decision**: Layered rendering with selective updates

**Rationale**:
- Background layer: Static elements (geographic features, grid)
- Network layer: Station nodes and connection links
- Dynamic layer: Active data flows, animations, highlights
- Only re-render changed layers to maintain 60fps target

**Alternatives considered**:
- Full canvas redraw: Simple but poor performance with many nodes
- Offscreen canvas: Better performance but browser support limitations
- Canvas pooling: Complex memory management, diminishing returns

### 7. Data Storage and Caching

**Decision**: IndexedDB for persistent topology data with memory cache

**Rationale**:
- IndexedDB aligns with PWA offline-first architecture
- Persistent storage for station coordinates, historical data
- Memory cache for current topology state and active connections
- Reduces mesh protocol queries for repeated data

**Alternatives considered**:
- LocalStorage: Size limitations, synchronous API blocks rendering
- In-memory only: Loses data on page refresh, poor user experience
- WebSQL: Deprecated, not supported in modern browsers

## Integration Points

### Existing Libraries to Leverage
- `src/lib/mesh-networking/`: Topology data source, event subscriptions
- `src/lib/database/`: IndexedDB wrapper for data persistence
- `src/components/ui/`: Existing UI components for controls and modals
- `src/lib/radio-control/`: Station identification and RF parameters

### New Libraries to Create
- `src/lib/mesh-visualization/`: Core visualization engine and data processing
- `src/lib/propagation-model/`: RF path loss calculations and signal visualization
- `src/components/MeshVisualization/`: React component wrapper for Canvas rendering

### Performance Considerations
- Throttle real-time updates to 10Hz to balance responsiveness with performance
- Use requestAnimationFrame for smooth animations
- Implement viewport culling for large networks
- Pre-calculate static elements (grids, legends) for reuse

## Technical Constraints Validated
- **FCC Part 97 compliance**: No encryption, station identification preserved
- **2.8kHz bandwidth**: Visualization uses existing mesh data, no additional bandwidth
- **Offline capability**: All visualization works with cached topology data
- **Browser-only**: No native dependencies, uses standard Web APIs
- **PWA integration**: Maintains existing service worker and offline functionality

---

**Phase 0 Status**: ✅ Complete - All unknowns resolved, technical approach validated