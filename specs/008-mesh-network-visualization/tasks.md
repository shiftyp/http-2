# Tasks: Mesh Network Visualization

**Input**: Design documents from `/specs/008-mesh-network-visualization/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: TypeScript 5.x, React 18, Canvas/WebGL, IndexedDB
   → Libraries: mesh-visualization, mesh-rendering
2. Load design documents:
   → data-model.md: 7 entities → model tasks
   → contracts/: 1 interface file → contract test task
   → quickstart.md: 5 test scenarios → integration test tasks
3. Generate tasks by category:
   → Setup: library structure, dependencies
   → Tests: contract tests, integration tests (TDD)
   → Core: models, services, rendering
   → Integration: mesh-networking, React components
   → Polish: performance, UX features
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. SUCCESS: 54 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [ ] T001 Create mesh-visualization library structure in src/lib/mesh-visualization/
- [ ] T002 Create mesh-rendering library structure in src/lib/mesh-rendering/
- [ ] T003 [P] Configure Canvas TypeScript definitions in src/lib/mesh-rendering/types.ts
- [ ] T004 [P] Add mesh visualization route structure in src/components/MeshVisualization/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T005 [P] Contract test GET /api/mesh/topology in src/test/contract/mesh-topology.test.ts
- [ ] T006 [P] Contract test GET /api/mesh/stations in src/test/contract/mesh-stations.test.ts
- [ ] T007 [P] Contract test GET /api/mesh/stations/{callsign} in src/test/contract/mesh-station-details.test.ts
- [ ] T008 [P] Contract test GET /api/mesh/links in src/test/contract/mesh-links.test.ts
- [ ] T009 [P] Contract test GET /api/mesh/routes in src/test/contract/mesh-routes.test.ts
- [ ] T010 [P] Contract test GET /api/mesh/propagation/{callsign} in src/test/contract/mesh-propagation.test.ts
- [ ] T011 [P] Contract test GET /api/mesh/traffic in src/test/contract/mesh-traffic.test.ts
- [ ] T012 [P] Contract test GET/PUT /api/mesh/config in src/test/contract/mesh-config.test.ts

### Integration Tests (from quickstart scenarios)
- [ ] T013 [P] Integration test basic network visualization in src/test/integration/basic-network-visualization.test.ts
- [ ] T014 [P] Integration test real-time updates in src/test/integration/realtime-updates.test.ts
- [ ] T015 [P] Integration test interactive features in src/test/integration/interactive-features.test.ts
- [ ] T016 [P] Integration test RF propagation in src/test/integration/rf-propagation.test.ts
- [ ] T017 [P] Integration test zoom and navigation in src/test/integration/zoom-navigation.test.ts

### Data Model Tests
- [ ] T018 [P] Unit test StationNode validation in src/test/unit/station-node.test.ts
- [ ] T019 [P] Unit test ConnectionLink validation in src/test/unit/connection-link.test.ts
- [ ] T020 [P] Unit test NetworkTopology management in src/test/unit/network-topology.test.ts
- [ ] T021 [P] Unit test SignalMetrics calculations in src/test/unit/signal-metrics.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models (from data-model.md entities)
- [ ] T022 [P] StationNode model in src/lib/mesh-network-visualization/models/station-node.ts
- [ ] T023 [P] StationEquipment model in src/lib/mesh-network-visualization/models/station-equipment.ts
- [ ] T024 [P] ConnectionLink model in src/lib/mesh-network-visualization/models/connection-link.ts
- [ ] T025 [P] SignalMetrics model in src/lib/mesh-network-visualization/models/signal-metrics.ts
- [ ] T026 [P] RoutePath model in src/lib/mesh-network-visualization/models/route-path.ts
- [ ] T027 [P] NetworkTopology model in src/lib/mesh-network-visualization/models/network-topology.ts
- [ ] T028 [P] RFPropagation model in src/lib/propagation-model/models/rf-propagation.ts
- [ ] T029 [P] TrafficFlow model in src/lib/mesh-network-visualization/models/traffic-flow.ts

### Core Visualization Services
- [ ] T024 TopologyManager service in src/lib/mesh-visualization/topology-manager.ts
- [ ] T025 VisualizationRenderer service in src/lib/mesh-rendering/visualization-renderer.ts
- [ ] T026 [P] GPSManager service in src/lib/mesh-visualization/gps-manager.ts
- [ ] T027 [P] PropagationRenderer service in src/lib/mesh-rendering/propagation-renderer.ts

### Rendering Services
- [ ] T028 [P] ConnectionRenderer service in src/lib/mesh-rendering/connection-renderer.ts
- [ ] T029 [P] StationRenderer service in src/lib/mesh-rendering/station-renderer.ts
- [ ] T030 [P] TrafficRenderer service in src/lib/mesh-rendering/traffic-renderer.ts
- [ ] T031 [P] SignalRenderer service in src/lib/mesh-rendering/signal-renderer.ts

### Interactive Controls
- [ ] T032 ViewportControls service in src/lib/mesh-rendering/viewport-controls.ts
- [ ] T033 InteractionHandler service in src/lib/mesh-visualization/interaction-handler.ts
- [ ] T034 [P] CommunicationController service in src/lib/mesh-visualization/communication-controller.ts

## Phase 3.4: Integration

### Mesh Networking Integration
- [ ] T035 Integrate with mesh-networking events in src/lib/mesh-visualization/topology-manager.ts
- [ ] T036 Connect IndexedDB persistence in src/lib/mesh-visualization/gps-manager.ts
- [ ] T037 Integrate crypto for signatures in src/lib/mesh-visualization/communication-controller.ts

### React Component Integration
- [ ] T038 MeshVisualization React component in src/components/MeshVisualization/MeshVisualization.tsx
- [ ] T039 VisualizationControls component in src/components/MeshVisualization/VisualizationControls.tsx
- [ ] T040 StationDetailsModal component in src/components/MeshVisualization/StationDetailsModal.tsx
- [ ] T041 Add mesh visualization page in src/pages/MeshVisualizationPage.tsx

### Performance Optimization
- [ ] T042 Layered Canvas rendering in src/lib/mesh-rendering/layered-canvas.ts
- [ ] T043 Viewport culling in src/lib/mesh-rendering/viewport-controls.ts
- [ ] T044 RequestAnimationFrame loop in src/lib/mesh-rendering/render-loop.ts

## Phase 3.5: Polish

### RF Features
- [ ] T045 [P] Path loss calculations in src/lib/mesh-visualization/models/propagation-model.ts
- [ ] T046 [P] Signal quality colors in src/lib/mesh-rendering/signal-renderer.ts
- [ ] T047 [P] Coverage circles in src/lib/mesh-rendering/propagation-renderer.ts

### UX Polish
- [ ] T048 Smooth zoom animations in src/lib/mesh-rendering/viewport-controls.ts
- [ ] T049 Fit-to-network functionality in src/lib/mesh-rendering/viewport-controls.ts
- [ ] T050 Network health indicator in src/lib/mesh-rendering/statistics-renderer.ts
- [ ] T051 Keyboard shortcuts in src/components/MeshVisualization/MeshVisualization.tsx

### Validation
- [ ] T052 Run quickstart validation scenarios from quickstart.md
- [ ] T053 Performance validation: 60fps with 50 stations in tests/integration/mesh-visualization.performance.test.ts
- [ ] T054 [P] Update CLAUDE.md with mesh visualization docs

## Dependencies
- Setup (T001-T004) before all other tasks
- Tests (T005-T017) before core implementation (T018-T034)
- Data models (T018-T023) before services (T024-T034)
- T024 (TopologyManager) blocks T035 (mesh integration)
- React components (T038-T041) need core services (T024-T034)
- Performance tasks (T042-T044) need rendering services (T025-T031)
- Polish tasks (T045-T051) need core implementation complete
- Validation (T052-T054) comes last

## Parallel Example
```
# Launch contract tests together (T005-T012):
Task: "Contract test GET /api/mesh/topology in src/test/contract/mesh-topology.test.ts"
Task: "Contract test GET /api/mesh/stations in src/test/contract/mesh-stations.test.ts"
Task: "Contract test GET /api/mesh/stations/{callsign} in src/test/contract/mesh-station-details.test.ts"
Task: "Contract test GET /api/mesh/links in src/test/contract/mesh-links.test.ts"
Task: "Contract test GET /api/mesh/routes in src/test/contract/mesh-routes.test.ts"
Task: "Contract test GET /api/mesh/propagation/{callsign} in src/test/contract/mesh-propagation.test.ts"
Task: "Contract test GET /api/mesh/traffic in src/test/contract/mesh-traffic.test.ts"
Task: "Contract test GET/PUT /api/mesh/config in src/test/contract/mesh-config.test.ts"

# Launch integration tests together (T013-T017):
Task: "Integration test basic network visualization in src/test/integration/basic-network-visualization.test.ts"
Task: "Integration test real-time updates in src/test/integration/realtime-updates.test.ts"
Task: "Integration test interactive features in src/test/integration/interactive-features.test.ts"
Task: "Integration test RF propagation in src/test/integration/rf-propagation.test.ts"
Task: "Integration test zoom and navigation in src/test/integration/zoom-navigation.test.ts"

# Launch data models together after tests fail (T022-T029):
Task: "StationNode model in src/lib/mesh-network-visualization/models/station-node.ts"
Task: "StationEquipment model in src/lib/mesh-network-visualization/models/station-equipment.ts"
Task: "ConnectionLink model in src/lib/mesh-network-visualization/models/connection-link.ts"
Task: "SignalMetrics model in src/lib/mesh-network-visualization/models/signal-metrics.ts"
Task: "RoutePath model in src/lib/mesh-network-visualization/models/route-path.ts"
Task: "NetworkTopology model in src/lib/mesh-network-visualization/models/network-topology.ts"
Task: "RFPropagation model in src/lib/propagation-model/models/rf-propagation.ts"
Task: "TrafficFlow model in src/lib/mesh-network-visualization/models/traffic-flow.ts"
```

## Notes
- Canvas 2D rendering chosen for RF gradient support
- GPS uses HTML5 Geolocation API with manual fallback
- Real-time updates throttled to 10Hz for performance
- IndexedDB for station coordinates and topology cache
- Integration with existing mesh-networking library
- 60fps target with 10-50 stations, <100ms update latency

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - contracts/mesh-visualization-api.yaml → T005-T012 REST API contract tests [P]
   - API endpoints → T030-T037 implementation tasks

2. **From Data Model**:
   - 8 entities (NetworkTopology, StationNode, ConnectionLink, etc.) → T022-T029 model tasks [P]
   - Relationships → T030-T037 service layer tasks

3. **From User Stories** (quickstart.md):
   - 5 scenarios → T013-T017 integration tests [P]
   - Performance benchmarks → T053 validation task

4. **Ordering**:
   - Setup → Tests → Models → Services → Components → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked before task execution*

- [x] All contracts have corresponding tests (T005-T012)
- [x] All entities have model tasks (T022-T029)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files marked [P])
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task

---
**Status**: ✅ 54 tasks generated following TDD approach, ready for execution