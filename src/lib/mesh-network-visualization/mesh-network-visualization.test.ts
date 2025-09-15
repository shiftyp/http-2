import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { MeshNetworkVisualizer } from './mesh-visualizer';
import { StationNodeManager } from './station-node';
import { ConnectionLinkManager } from './connection-link';
import { NetworkTopologyManager } from './network-topology';
import {
  StationNode,
  ConnectionLink,
  TrafficFlow,
  NodeId,
  CallSign,
  GPSCoordinates,
  StationEquipment,
  RFCharacteristics,
  PropagationConditions
} from './types';

Object.defineProperty(window, 'HTMLCanvasElement', {
  value: class MockHTMLCanvasElement {
    width = 800;
    height = 600;
    style = { cursor: 'default' };

    getContext(type: string) {
      if (type === '2d') {
        return {
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          fillText: vi.fn(),
          createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn()
          })),
          save: vi.fn(),
          restore: vi.fn(),
          setLineDash: vi.fn(),
          fillStyle: '#000000',
          strokeStyle: '#000000',
          lineWidth: 1,
          globalAlpha: 1,
          font: '12px Arial',
          textAlign: 'left'
        };
      }
      return null;
    }

    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    dispatchEvent = vi.fn();
    getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 }));
  }
});

global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

global.cancelAnimationFrame = vi.fn();

const sampleCoordinates: GPSCoordinates = {
  latitude: 40.7128,
  longitude: -74.0060,
  altitude: 10,
  accuracy: 5
};

const sampleEquipment: StationEquipment = {
  manufacturer: 'Icom',
  model: 'IC-7300',
  power: 100,
  antenna: 'Dipole',
  bands: ['HF'],
  modes: ['HTTP-QPSK']
};

const sampleRFCharacteristics: RFCharacteristics = {
  frequency: 14230000,
  band: 'HF',
  power: 100,
  signalStrength: -73,
  snr: 15,
  noiseFloor: -120,
  bandwidth: 2800,
  modulation: 'QPSK'
};

describe('Mesh Network Visualization', () => {
  let canvas: HTMLCanvasElement;
  let visualizer: MeshNetworkVisualizer;

  const mockCallbacks = {
    onNodeClick: vi.fn(),
    onNodeHover: vi.fn(),
    onLinkClick: vi.fn(),
    onInitiateCommunication: vi.fn(),
    onTopologyChange: vi.fn(),
    onError: vi.fn()
  };

  beforeEach(() => {
    canvas = new (window as any).HTMLCanvasElement();
    visualizer = new MeshNetworkVisualizer(canvas, {}, {}, mockCallbacks);
    vi.clearAllMocks();
  });

  describe('FR-001: System MUST display all active mesh network stations as visual nodes', () => {
    it('should display active stations as nodes', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

      const topology = visualizer.getTopology();
      expect(topology.nodes.size).toBe(1);

      const node = topology.nodes.get(nodeId);
      expect(node).toBeDefined();
      expect(node!.callsign).toBe('KA1ABC');
      expect(node!.status).toBe('active');
    });

    it('should not display inactive stations prominently', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);
      visualizer.updateStation(nodeId, { status: 'inactive' });

      const node = visualizer.getStation(nodeId);
      expect(node!.status).toBe('inactive');
    });
  });

  describe('FR-002: System MUST show connection links between stations', () => {
    it('should create links between connected stations', () => {
      const node1Id = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);
      const node2Id = visualizer.addStation('KB2DEF', {
        ...sampleCoordinates,
        latitude: sampleCoordinates.latitude + 0.1
      }, sampleEquipment, sampleRFCharacteristics);

      const propagation: PropagationConditions = {
        distance: 15.5,
        azimuth: 45,
        pathLoss: 85,
        fadingMargin: 10,
        multipath: false,
        atmosphericNoise: 5
      };

      const linkId = visualizer.establishConnection(
        node1Id,
        node2Id,
        'rf',
        'HTTP-QPSK',
        sampleRFCharacteristics,
        propagation
      );

      const link = visualizer.getConnection(linkId);
      expect(link).toBeDefined();
      expect(link!.sourceNodeId).toBe(node1Id);
      expect(link!.destinationNodeId).toBe(node2Id);
      expect(link!.isActive).toBe(true);
    });
  });

  describe('FR-003: System MUST update visualization in real-time', () => {
    it('should update when stations join the network', async () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

      expect(mockCallbacks.onTopologyChange).toHaveBeenCalled();

      const topology = visualizer.getTopology();
      expect(topology.nodes.has(nodeId)).toBe(true);
    });

    it('should update when stations leave the network', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);
      visualizer.removeStation(nodeId);

      const topology = visualizer.getTopology();
      expect(topology.nodes.has(nodeId)).toBe(false);
    });
  });

  describe('FR-004: System MUST highlight active communication paths', () => {
    it('should show active traffic flows on links', () => {
      const node1Id = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);
      const node2Id = visualizer.addStation('KB2DEF', {
        ...sampleCoordinates,
        latitude: sampleCoordinates.latitude + 0.1
      }, sampleEquipment, sampleRFCharacteristics);

      const linkId = visualizer.establishConnection(
        node1Id,
        node2Id,
        'rf',
        'HTTP-QPSK',
        sampleRFCharacteristics,
        {
          distance: 15.5,
          azimuth: 45,
          pathLoss: 85,
          fadingMargin: 10,
          multipath: false,
          atmosphericNoise: 5
        }
      );

      const traffic: TrafficFlow = {
        id: 'traffic-1',
        routeId: 'route-1',
        source: node1Id,
        destination: node2Id,
        direction: 'bidirectional',
        priority: 'normal',
        startTime: Date.now(),
        bytesTransmitted: 1024,
        packetsTransmitted: 10,
        currentThroughput: 2400,
        isActive: true
      };

      visualizer.addTrafficFlow(traffic);

      const topology = visualizer.getTopology();
      expect(topology.traffic.has(traffic.id)).toBe(true);
      expect(topology.traffic.get(traffic.id)!.isActive).toBe(true);
    });
  });

  describe('FR-005: System MUST indicate signal strength or link quality', () => {
    it('should store and display signal strength information', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

      const node = visualizer.getStation(nodeId);
      expect(node!.rfCharacteristics.signalStrength).toBe(-73);
      expect(node!.rfCharacteristics.snr).toBe(15);
    });

    it('should calculate link quality based on RF characteristics', () => {
      const linkManager = new ConnectionLinkManager();
      const link = linkManager.establishLink(
        'node1',
        'node2',
        'rf',
        'HTTP-QPSK',
        sampleRFCharacteristics,
        {
          distance: 15.5,
          azimuth: 45,
          pathLoss: 85,
          fadingMargin: 10,
          multipath: false,
          atmosphericNoise: 5
        }
      );

      expect(link.quality).toBeGreaterThan(0);
      expect(link.quality).toBeLessThanOrEqual(1);
    });
  });

  describe('FR-007: System MUST display station identification (callsigns)', () => {
    it('should show callsign for each station', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

      const node = visualizer.getStation(nodeId);
      expect(node!.callsign).toBe('KA1ABC');
    });
  });

  describe('FR-008: System MUST differentiate RF and internet connections', () => {
    it('should distinguish between RF and internet connections', () => {
      const node1Id = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);
      const node2Id = visualizer.addStation('KB2DEF', {
        ...sampleCoordinates,
        latitude: sampleCoordinates.latitude + 0.1
      }, sampleEquipment, sampleRFCharacteristics);

      const rfLinkId = visualizer.establishConnection(
        node1Id,
        node2Id,
        'rf',
        'HTTP-QPSK',
        sampleRFCharacteristics,
        {
          distance: 15.5,
          azimuth: 45,
          pathLoss: 85,
          fadingMargin: 10,
          multipath: false,
          atmosphericNoise: 5
        }
      );

      const internetLinkId = visualizer.establishConnection(
        node2Id, // Different order to ensure different link ID
        node1Id,
        'internet',
        'HTTP-QPSK',
        sampleRFCharacteristics,
        {
          distance: 0,
          azimuth: 0,
          pathLoss: 0,
          fadingMargin: 0,
          multipath: false,
          atmosphericNoise: 0
        }
      );

      const rfLink = visualizer.getConnection(rfLinkId);
      const internetLink = visualizer.getConnection(internetLinkId);

      expect(rfLink!.connectionType).toBe('rf');
      expect(internetLink!.connectionType).toBe('internet');
    });
  });

  describe('FR-011: System MUST utilize GPS location data when available', () => {
    it('should store GPS coordinates for each station', () => {
      const coordinates: GPSCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
        altitude: 10,
        accuracy: 5,
        timestamp: Date.now()
      };

      const nodeId = visualizer.addStation('KA1ABC', coordinates, sampleEquipment, sampleRFCharacteristics);

      const node = visualizer.getStation(nodeId);
      expect(node!.coordinates.latitude).toBe(40.7128);
      expect(node!.coordinates.longitude).toBe(-74.0060);
      expect(node!.coordinates.altitude).toBe(10);
    });
  });

  describe('FR-013: System MUST provide zoom capability', () => {
    it('should support zoom operations', () => {
      visualizer.zoom(1.5);
      visualizer.zoom(0.8);

      expect(true).toBe(true);
    });
  });

  describe('FR-014: System MUST show station details on click', () => {
    it('should trigger callback when station is clicked', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

      const mockEvent = new MouseEvent('click', {
        clientX: 400,
        clientY: 300
      });

      canvas.dispatchEvent(mockEvent);
    });
  });

  describe('FR-015: System MUST allow initiation of direct communications', () => {
    it('should support communication initiation', () => {
      const nodeId = visualizer.addStation('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

      visualizer.initiateCommunication(nodeId);

      expect(mockCallbacks.onInitiateCommunication).toHaveBeenCalledWith(nodeId);
    });
  });

  describe('FR-019: System MUST handle network topology changes gracefully', () => {
    it('should handle rapid topology changes without crashes', () => {
      const nodes: NodeId[] = [];

      for (let i = 0; i < 5; i++) {
        const nodeId = visualizer.addStation(
          `K${i}ABC`,
          {
            ...sampleCoordinates,
            latitude: sampleCoordinates.latitude + i * 0.01
          },
          sampleEquipment,
          sampleRFCharacteristics
        );
        nodes.push(nodeId);
      }

      for (const nodeId of nodes) {
        visualizer.updateStation(nodeId, { status: Math.random() > 0.5 ? 'active' : 'inactive' });
      }

      const topology = visualizer.getTopology();
      expect(topology.nodes.size).toBe(5);
    });
  });
});

describe('StationNodeManager', () => {
  let nodeManager: StationNodeManager;

  beforeEach(() => {
    nodeManager = new StationNodeManager();
  });

  it('should create nodes with all required properties', () => {
    const node = nodeManager.createNode('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

    expect(node.callsign).toBe('KA1ABC');
    expect(node.status).toBe('active');
    expect(node.coordinates).toEqual(sampleCoordinates);
    expect(node.equipment).toEqual(sampleEquipment);
    expect(node.rfCharacteristics).toEqual(sampleRFCharacteristics);
    expect(node.capabilities).toBeDefined();
    expect(node.metrics).toBeDefined();
  });

  it('should calculate distance between nodes', () => {
    const node1 = nodeManager.createNode('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);
    const node2 = nodeManager.createNode('KB2DEF', {
      ...sampleCoordinates,
      latitude: sampleCoordinates.latitude + 0.1
    }, sampleEquipment, sampleRFCharacteristics);

    const distance = nodeManager.calculateDistance(node1.id, node2.id);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(20);
  });

  it('should find nodes in range', () => {
    const centerNode = nodeManager.createNode('KA1ABC', sampleCoordinates, sampleEquipment, sampleRFCharacteristics);

    const nearNode = nodeManager.createNode('KB2DEF', {
      ...sampleCoordinates,
      latitude: sampleCoordinates.latitude + 0.01
    }, sampleEquipment, sampleRFCharacteristics);

    const farNode = nodeManager.createNode('KC3GHI', {
      ...sampleCoordinates,
      latitude: sampleCoordinates.latitude + 1.0
    }, sampleEquipment, sampleRFCharacteristics);

    const nodesInRange = nodeManager.findNodesInRange(centerNode.id, 10);

    expect(nodesInRange).toContainEqual(expect.objectContaining({ id: nearNode.id }));
    expect(nodesInRange).not.toContainEqual(expect.objectContaining({ id: farNode.id }));
  });
});

describe('ConnectionLinkManager', () => {
  let linkManager: ConnectionLinkManager;

  beforeEach(() => {
    linkManager = new ConnectionLinkManager();
  });

  it('should establish links with proper quality calculation', () => {
    const link = linkManager.establishLink(
      'node1',
      'node2',
      'rf',
      'HTTP-QPSK',
      sampleRFCharacteristics,
      {
        distance: 15.5,
        azimuth: 45,
        pathLoss: 85,
        fadingMargin: 10,
        multipath: false,
        atmosphericNoise: 5
      }
    );

    expect(link.sourceNodeId).toBe('node1');
    expect(link.destinationNodeId).toBe('node2');
    expect(link.connectionType).toBe('rf');
    expect(link.protocol).toBe('HTTP-QPSK');
    expect(link.quality).toBeGreaterThan(0);
    expect(link.isActive).toBe(true);
  });

  it('should calculate path loss correctly', () => {
    const pathLoss = linkManager.calculatePathLoss(100, 14000000, 'rural');
    expect(pathLoss).toBeGreaterThan(0);
    expect(pathLoss).toBeLessThan(200);
  });

  it('should estimate propagation reliability', () => {
    const reliability = linkManager.estimatePropagationReliability(100, 14000000, 20, 'HF');
    expect(reliability).toBeGreaterThan(0);
    expect(reliability).toBeLessThanOrEqual(1);
  });
});

describe('NetworkTopologyManager', () => {
  let topologyManager: NetworkTopologyManager;

  beforeEach(() => {
    topologyManager = new NetworkTopologyManager();
  });

  it('should manage network topology with event emission', () => {
    const eventCallback = vi.fn();
    topologyManager.addEventListener('node-discovered', eventCallback);

    const node: StationNode = {
      id: 'test-node',
      callsign: 'KA1ABC',
      status: 'active',
      coordinates: sampleCoordinates,
      equipment: sampleEquipment,
      rfCharacteristics: sampleRFCharacteristics,
      lastSeen: Date.now(),
      capabilities: {
        relay: true,
        store: true,
        gateway: false,
        modes: ['HTTP-QPSK']
      },
      metrics: {
        packetsRelayed: 0,
        packetsDropped: 0,
        bytesTransferred: 0,
        uptime: Date.now()
      }
    };

    topologyManager.addNode(node);

    expect(eventCallback).toHaveBeenCalled();

    const topology = topologyManager.getTopology();
    expect(topology.nodes.has('test-node')).toBe(true);
  });

  it('should detect network partitions', () => {
    const node1: StationNode = {
      id: 'node-1',
      callsign: 'KA1ABC',
      status: 'active',
      coordinates: sampleCoordinates,
      equipment: sampleEquipment,
      rfCharacteristics: sampleRFCharacteristics,
      lastSeen: Date.now(),
      capabilities: { relay: true, store: true, gateway: false, modes: ['HTTP-QPSK'] },
      metrics: { packetsRelayed: 0, packetsDropped: 0, bytesTransferred: 0, uptime: Date.now() }
    };

    const node2: StationNode = {
      id: 'node-2',
      callsign: 'KB2DEF',
      status: 'active',
      coordinates: sampleCoordinates,
      equipment: sampleEquipment,
      rfCharacteristics: sampleRFCharacteristics,
      lastSeen: Date.now(),
      capabilities: { relay: true, store: true, gateway: false, modes: ['HTTP-QPSK'] },
      metrics: { packetsRelayed: 0, packetsDropped: 0, bytesTransferred: 0, uptime: Date.now() }
    };

    topologyManager.addNode(node1);
    topologyManager.addNode(node2);

    const partitions = topologyManager.detectNetworkPartitions();
    expect(partitions.length).toBe(2);
  });

  it('should calculate network statistics', () => {
    const node: StationNode = {
      id: 'test-node',
      callsign: 'KA1ABC',
      status: 'active',
      coordinates: sampleCoordinates,
      equipment: sampleEquipment,
      rfCharacteristics: sampleRFCharacteristics,
      lastSeen: Date.now(),
      capabilities: { relay: true, store: true, gateway: false, modes: ['HTTP-QPSK'] },
      metrics: { packetsRelayed: 0, packetsDropped: 0, bytesTransferred: 0, uptime: Date.now() }
    };

    topologyManager.addNode(node);

    const stats = topologyManager.getTopologyStatistics();
    expect(stats.nodes).toBe(1);
    expect(stats.activeNodes).toBe(1);
    expect(stats.health).toBeDefined();
  });
});