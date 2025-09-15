/**
 * Interface contracts for Mesh Network Visualization
 * Generated from functional requirements in spec.md
 */

// Core data types from data-model.md
export interface StationNode {
  callsign: string;
  coordinates: { lat: number; lon: number } | null;
  lastSeen: Date;
  equipmentInfo: StationEquipment;
  status: 'active' | 'inactive' | 'unreachable';
  meshAddress: string;
}

export interface StationEquipment {
  frequency: number;
  mode: string;
  power: number;
  antenna?: string;
  protocolVersion: string;
}

export interface ConnectionLink {
  source: string;
  destination: string;
  connectionType: 'rf' | 'internet';
  frequency: number;
  protocol: 'VARA' | 'Winlink' | 'PacketRadio' | 'HTTP-QPSK';
  signalQuality: SignalMetrics;
  lastActive: Date;
  status: 'active' | 'standby' | 'failed';
}

export interface SignalMetrics {
  snr: number;
  signalStrength: number;
  linkQuality: number;
  distance: number | null;
  pathLoss: number | null;
}

export interface RoutePath {
  source: string;
  destination: string;
  hops: string[];
  totalHops: number;
  pathQuality: number;
  established: Date;
  isActive: boolean;
}

export interface NetworkTopology {
  networkId: string;
  stations: Map<string, StationNode>;
  links: ConnectionLink[];
  routes: RoutePath[];
  lastUpdate: Date;
  partitionCount: number;
}

// FR-001: Display all active mesh network stations as visual nodes
export interface IVisualizationRenderer {
  renderStations(stations: StationNode[]): void;
  updateStationStatus(callsign: string, status: StationNode['status']): void;
  highlightStation(callsign: string, highlight: boolean): void;
}

// FR-002: Show connection links between stations
export interface IConnectionRenderer {
  renderLinks(links: ConnectionLink[]): void;
  updateLinkStatus(source: string, destination: string, status: ConnectionLink['status']): void;
  showLinkDetails(source: string, destination: string): ConnectionLink | null;
}

// FR-003: Update visualization in real-time
export interface ITopologyManager {
  subscribeToUpdates(callback: (topology: NetworkTopology) => void): void;
  unsubscribeFromUpdates(callback: (topology: NetworkTopology) => void): void;
  getCurrentTopology(): NetworkTopology;
  refreshTopology(): Promise<void>;
}

// FR-004: Highlight active communication paths
export interface ITrafficRenderer {
  showActiveTraffic(paths: RoutePath[]): void;
  animateDataFlow(source: string, destination: string, direction: 'bidirectional' | 'sourceToDestination' | 'destinationToSource'): void;
  hideTrafficFlow(source: string, destination: string): void;
}

// FR-005: Indicate signal strength/link quality
export interface ISignalRenderer {
  renderSignalStrength(link: ConnectionLink): void;
  updateSignalMetrics(source: string, destination: string, metrics: SignalMetrics): void;
  showSignalQualityLegend(): void;
}

// FR-006: Show routing path for multi-hop communications
export interface IRouteRenderer {
  highlightRoute(route: RoutePath): void;
  clearRouteHighlight(source: string, destination: string): void;
  showRouteDetails(route: RoutePath): void;
}

// FR-007: Display station identification (callsigns)
export interface IStationLabels {
  showCallsigns(visible: boolean): void;
  updateCallsignLabel(callsign: string, position: { x: number; y: number }): void;
  setLabelFontSize(size: number): void;
}

// FR-008, FR-009: Connection type and frequency visualization
export interface IConnectionTypeRenderer {
  renderConnectionType(link: ConnectionLink): void;
  showFrequencyInfo(frequency: number, band: string): void;
  differentiateConnectionTypes(rfStyle: RenderStyle, internetStyle: RenderStyle): void;
}

// FR-010: Visualize RF propagation based on SNR and distance
export interface IPropagationRenderer {
  renderPropagationCircle(station: StationNode, radius: number, signalStrength: number): void;
  updatePropagationModel(station: string, snr: number, distance: number): void;
  showPropagationLegend(): void;
}

// FR-011: Utilize GPS location data
export interface IGPSManager {
  getDeviceLocation(): Promise<{ lat: number; lon: number } | null>;
  setStationCoordinates(callsign: string, coordinates: { lat: number; lon: number }): void;
  calculateDistance(station1: StationNode, station2: StationNode): number | null;
}

// FR-012: Display connection protocols
export interface IProtocolRenderer {
  showProtocolLabels(visible: boolean): void;
  renderProtocolInfo(link: ConnectionLink): void;
  groupByProtocol(links: ConnectionLink[]): Map<string, ConnectionLink[]>;
}

// FR-013: Zoom capability
export interface IViewportControls {
  setZoomLevel(level: number): void;
  getZoomLevel(): number;
  zoomToFit(nodes: StationNode[]): void;
  zoomToStation(callsign: string): void;
  panToCoordinates(lat: number, lon: number): void;
}

// FR-014: Station details on click
export interface IInteractionHandler {
  onStationClick(callsign: string): StationDetails;
  onLinkClick(source: string, destination: string): LinkDetails;
  onBackgroundClick(): void;
  enableInteraction(enabled: boolean): void;
}

export interface StationDetails {
  callsign: string;
  location: string | null;
  equipment: StationEquipment;
  signalCharacteristics: SignalMetrics[];
  activeConnections: ConnectionLink[];
}

export interface LinkDetails {
  source: string;
  destination: string;
  protocol: string;
  signalQuality: SignalMetrics;
  trafficStats: {
    throughput: number;
    packetCount: number;
    errorRate: number;
  };
}

// FR-015: Initiate communications through visualization
export interface ICommunicationController {
  initiateConnection(localCallsign: string, remoteCallsign: string): Promise<boolean>;
  sendMessage(to: string, message: string): Promise<boolean>;
  startQSO(remoteCallsign: string): Promise<boolean>;
}

// FR-016, FR-017: Real-time statistics and RF data
export interface IStatisticsRenderer {
  showRealTimeStats(visible: boolean): void;
  updateThroughputDisplay(link: ConnectionLink, throughput: number): void;
  displayRFParameters(station: StationNode): void;
  showNetworkHealthIndicator(health: number): void;
}

// FR-018: Map network health to propagation characteristics
export interface IHealthMapper {
  calculateNetworkHealth(topology: NetworkTopology): number;
  mapHealthToPropagation(health: number): PropagationCharacteristics;
  getHealthColor(health: number): string;
}

export interface PropagationCharacteristics {
  signalStrength: 'excellent' | 'good' | 'fair' | 'poor';
  linkReliability: number;
  coverageArea: number;
  interferenceLevel: 'low' | 'medium' | 'high';
}

// FR-019: Handle topology changes gracefully
export interface IChangeHandler {
  onStationJoin(station: StationNode): void;
  onStationLeave(callsign: string): void;
  onLinkEstablished(link: ConnectionLink): void;
  onLinkFailed(source: string, destination: string): void;
  onTopologyChange(changes: TopologyChange[]): void;
}

export interface TopologyChange {
  type: 'station_added' | 'station_removed' | 'link_added' | 'link_removed' | 'link_updated';
  timestamp: Date;
  data: StationNode | ConnectionLink | { callsign: string } | { source: string; destination: string };
}

// Utility interfaces
export interface RenderStyle {
  color: string;
  width: number;
  dashPattern?: number[];
  opacity: number;
}

export interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// Main visualization component interface
export interface IMeshVisualization extends
  IVisualizationRenderer,
  IConnectionRenderer,
  ITopologyManager,
  ITrafficRenderer,
  ISignalRenderer,
  IRouteRenderer,
  IStationLabels,
  IConnectionTypeRenderer,
  IPropagationRenderer,
  IProtocolRenderer,
  IViewportControls,
  IInteractionHandler,
  IStatisticsRenderer {

  // Core lifecycle methods
  initialize(canvas: HTMLCanvasElement): void;
  destroy(): void;
  resize(width: number, height: number): void;
  render(): void;
}