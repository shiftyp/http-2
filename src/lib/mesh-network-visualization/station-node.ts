import {
  StationNode,
  NodeId,
  CallSign,
  StationStatus,
  GPSCoordinates,
  StationEquipment,
  RFCharacteristics,
  Timestamp,
  Point2D,
  Protocol
} from './types';

export class StationNodeManager {
  private nodes = new Map<NodeId, StationNode>();

  createNode(
    callsign: CallSign,
    coordinates: GPSCoordinates,
    equipment: StationEquipment,
    rfCharacteristics: RFCharacteristics
  ): StationNode {
    const id = this.generateNodeId(callsign);

    const node: StationNode = {
      id,
      callsign,
      status: 'active',
      coordinates,
      equipment,
      rfCharacteristics,
      lastSeen: Date.now(),
      capabilities: {
        relay: true,
        store: true,
        gateway: false,
        modes: equipment.modes
      },
      metrics: {
        packetsRelayed: 0,
        packetsDropped: 0,
        bytesTransferred: 0,
        uptime: Date.now()
      }
    };

    this.nodes.set(id, node);
    return node;
  }

  updateNode(nodeId: NodeId, updates: Partial<StationNode>): StationNode | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const updatedNode = { ...node, ...updates, lastSeen: Date.now() };
    this.nodes.set(nodeId, updatedNode);
    return updatedNode;
  }

  updateNodeStatus(nodeId: NodeId, status: StationStatus): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.status = status;
    node.lastSeen = Date.now();
    this.nodes.set(nodeId, node);
    return true;
  }

  updateRFCharacteristics(nodeId: NodeId, rfCharacteristics: RFCharacteristics): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.rfCharacteristics = rfCharacteristics;
    node.lastSeen = Date.now();
    this.nodes.set(nodeId, node);
    return true;
  }

  updateCoordinates(nodeId: NodeId, coordinates: GPSCoordinates): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.coordinates = coordinates;
    node.lastSeen = Date.now();
    this.nodes.set(nodeId, node);
    return true;
  }

  getNode(nodeId: NodeId): StationNode | null {
    return this.nodes.get(nodeId) || null;
  }

  getAllNodes(): StationNode[] {
    return Array.from(this.nodes.values());
  }

  getActiveNodes(): StationNode[] {
    return this.getAllNodes().filter(node => node.status === 'active');
  }

  getNodesByProtocol(protocol: Protocol): StationNode[] {
    return this.getAllNodes().filter(node =>
      node.equipment.modes.includes(protocol)
    );
  }

  removeNode(nodeId: NodeId): boolean {
    return this.nodes.delete(nodeId);
  }

  markNodeUnreachable(nodeId: NodeId): boolean {
    return this.updateNodeStatus(nodeId, 'unreachable');
  }

  markNodeInactive(nodeId: NodeId): boolean {
    return this.updateNodeStatus(nodeId, 'inactive');
  }

  calculateDistance(nodeId1: NodeId, nodeId2: NodeId): number | null {
    const node1 = this.nodes.get(nodeId1);
    const node2 = this.nodes.get(nodeId2);

    if (!node1 || !node2) return null;

    return this.haversineDistance(
      node1.coordinates.latitude,
      node1.coordinates.longitude,
      node2.coordinates.latitude,
      node2.coordinates.longitude
    );
  }

  calculateBearing(fromNodeId: NodeId, toNodeId: NodeId): number | null {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);

    if (!fromNode || !toNode) return null;

    const lat1 = this.toRadians(fromNode.coordinates.latitude);
    const lat2 = this.toRadians(toNode.coordinates.latitude);
    const deltaLon = this.toRadians(toNode.coordinates.longitude - fromNode.coordinates.longitude);

    const x = Math.sin(deltaLon) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    return (this.toDegrees(Math.atan2(x, y)) + 360) % 360;
  }

  findNodesInRange(centerNodeId: NodeId, rangeKm: number): StationNode[] {
    const centerNode = this.nodes.get(centerNodeId);
    if (!centerNode) return [];

    return this.getAllNodes().filter(node => {
      if (node.id === centerNodeId) return false;

      const distance = this.haversineDistance(
        centerNode.coordinates.latitude,
        centerNode.coordinates.longitude,
        node.coordinates.latitude,
        node.coordinates.longitude
      );

      return distance <= rangeKm;
    });
  }

  getNodesByStatus(status: StationStatus): StationNode[] {
    return this.getAllNodes().filter(node => node.status === status);
  }

  updateNodeMetrics(nodeId: NodeId, metrics: Partial<StationNode['metrics']>): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.metrics = { ...node.metrics, ...metrics };
    node.lastSeen = Date.now();
    this.nodes.set(nodeId, node);
    return true;
  }

  cleanupStaleNodes(maxAgeMs: number = 600000): NodeId[] {
    const now = Date.now();
    const staleNodeIds: NodeId[] = [];

    for (const [nodeId, node] of this.nodes) {
      if (now - node.lastSeen > maxAgeMs) {
        staleNodeIds.push(nodeId);
        this.nodes.delete(nodeId);
      }
    }

    return staleNodeIds;
  }

  getNodeStatistics() {
    const nodes = this.getAllNodes();
    const activeCount = nodes.filter(n => n.status === 'active').length;
    const inactiveCount = nodes.filter(n => n.status === 'inactive').length;
    const unreachableCount = nodes.filter(n => n.status === 'unreachable').length;

    const totalPacketsRelayed = nodes.reduce((sum, n) => sum + n.metrics.packetsRelayed, 0);
    const totalBytesTransferred = nodes.reduce((sum, n) => sum + n.metrics.bytesTransferred, 0);

    return {
      totalNodes: nodes.length,
      activeNodes: activeCount,
      inactiveNodes: inactiveCount,
      unreachableNodes: unreachableCount,
      totalPacketsRelayed,
      totalBytesTransferred,
      averageUptime: nodes.length > 0 ?
        nodes.reduce((sum, n) => sum + (Date.now() - n.metrics.uptime), 0) / nodes.length : 0
    };
  }

  coordinatesToScreenSpace(
    coordinates: GPSCoordinates,
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    viewport: { width: number; height: number }
  ): Point2D {
    const latRange = bounds.maxLat - bounds.minLat;
    const lonRange = bounds.maxLon - bounds.minLon;

    const x = ((coordinates.longitude - bounds.minLon) / lonRange) * viewport.width;
    const y = ((bounds.maxLat - coordinates.latitude) / latRange) * viewport.height;

    return { x, y };
  }

  private generateNodeId(callsign: CallSign): NodeId {
    return `node-${callsign.toLowerCase()}-${Date.now()}`;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}