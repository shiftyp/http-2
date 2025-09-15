export type CallSign = string;
export type Frequency = number;
export type Timestamp = number;
export type NodeId = string;

export type GPSCoordinates = {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: Timestamp;
};

export type StationStatus = 'active' | 'inactive' | 'unreachable';
export type ConnectionType = 'rf' | 'internet';
export type Protocol = 'VARA' | 'Winlink' | 'PacketRadio' | 'HTTP-QPSK';
export type TrafficDirection = 'bidirectional' | 'sourceToDestination' | 'destinationToSource';
export type TrafficPriority = 'low' | 'normal' | 'high' | 'emergency';

export type RFBand = 'HF' | 'VHF' | 'UHF';
export type PowerLevel = number;
export type SignalStrength = number;
export type SNR = number;

export type StationEquipment = {
  manufacturer: string;
  model: string;
  power: PowerLevel;
  antenna: string;
  bands: RFBand[];
  modes: Protocol[];
};

export type RFCharacteristics = {
  frequency: Frequency;
  band: RFBand;
  power: PowerLevel;
  signalStrength: SignalStrength;
  snr: SNR;
  noiseFloor: number;
  bandwidth: number;
  modulation: string;
};

export type PropagationConditions = {
  distance: number;
  azimuth: number;
  elevation?: number;
  pathLoss: number;
  fadingMargin: number;
  multipath: boolean;
  atmosphericNoise: number;
};

export type NetworkHealth = {
  throughput: number;
  packetLoss: number;
  latency: number;
  jitter: number;
  availability: number;
};

export type StationNode = {
  id: NodeId;
  callsign: CallSign;
  status: StationStatus;
  coordinates: GPSCoordinates;
  equipment: StationEquipment;
  rfCharacteristics: RFCharacteristics;
  lastSeen: Timestamp;
  capabilities: {
    relay: boolean;
    store: boolean;
    gateway: boolean;
    modes: Protocol[];
  };
  metrics: {
    packetsRelayed: number;
    packetsDropped: number;
    bytesTransferred: number;
    uptime: number;
  };
};

export type ConnectionLink = {
  id: string;
  sourceNodeId: NodeId;
  destinationNodeId: NodeId;
  connectionType: ConnectionType;
  protocol: Protocol;
  rfCharacteristics: RFCharacteristics;
  propagation: PropagationConditions;
  quality: number;
  established: Timestamp;
  lastActive: Timestamp;
  isActive: boolean;
  metrics: {
    throughput: number;
    packetsSent: number;
    packetsReceived: number;
    errors: number;
  };
};

export type RoutePath = {
  id: string;
  source: NodeId;
  destination: NodeId;
  hops: NodeId[];
  totalDistance: number;
  totalLatency: number;
  reliability: number;
  isOptimal: boolean;
  lastUsed: Timestamp;
  hopAnalysis: {
    nodeId: NodeId;
    signalStrength: SignalStrength;
    snr: SNR;
    linkQuality: number;
  }[];
};

export type TrafficFlow = {
  id: string;
  routeId: string;
  source: NodeId;
  destination: NodeId;
  direction: TrafficDirection;
  priority: TrafficPriority;
  startTime: Timestamp;
  endTime?: Timestamp;
  bytesTransmitted: number;
  packetsTransmitted: number;
  currentThroughput: number;
  isActive: boolean;
};

export type NetworkTopology = {
  nodes: Map<NodeId, StationNode>;
  links: Map<string, ConnectionLink>;
  routes: Map<string, RoutePath>;
  traffic: Map<string, TrafficFlow>;
  lastUpdate: Timestamp;
  health: NetworkHealth;
};

export type Point2D = {
  x: number;
  y: number;
};

export type ViewportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
};

export type CanvasContext = CanvasRenderingContext2D;

export type RenderStyle = {
  node: {
    radius: number;
    activeColor: string;
    inactiveColor: string;
    unreachableColor: string;
    strokeColor: string;
    strokeWidth: number;
  };
  link: {
    activeColor: string;
    inactiveColor: string;
    rfColor: string;
    internetColor: string;
    width: number;
    dashPattern: number[];
  };
  text: {
    font: string;
    color: string;
    size: number;
  };
  traffic: {
    animationSpeed: number;
    particleSize: number;
    lowPriorityColor: string;
    normalPriorityColor: string;
    highPriorityColor: string;
    emergencyPriorityColor: string;
  };
};

export type InteractionEvent = {
  type: 'click' | 'hover' | 'drag';
  target: 'node' | 'link' | 'background';
  targetId?: string;
  position: Point2D;
  originalEvent: MouseEvent | TouchEvent;
};

export type MeshEventType =
  | 'node-discovered'
  | 'node-updated'
  | 'node-lost'
  | 'link-established'
  | 'link-updated'
  | 'link-lost'
  | 'route-discovered'
  | 'route-updated'
  | 'route-expired'
  | 'traffic-started'
  | 'traffic-updated'
  | 'traffic-ended'
  | 'topology-changed'
  | 'propagation-updated';

export type MeshEvent = {
  type: MeshEventType;
  timestamp: Timestamp;
  nodeId?: NodeId;
  linkId?: string;
  routeId?: string;
  trafficId?: string;
  data: any;
};

export type VisualizationOptions = {
  showSignalStrength: boolean;
  showPropagationCoverage: boolean;
  showTrafficFlow: boolean;
  showRoutes: boolean;
  animateTraffic: boolean;
  realTimeUpdates: boolean;
  geographicMode: boolean;
  showFrequencies: boolean;
  showProtocols: boolean;
  autoZoom: boolean;
  maxNodes: number;
};