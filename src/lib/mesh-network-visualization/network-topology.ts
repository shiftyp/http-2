import {
  NetworkTopology,
  StationNode,
  ConnectionLink,
  RoutePath,
  TrafficFlow,
  NodeId,
  NetworkHealth,
  MeshEvent,
  MeshEventType,
  Timestamp
} from './types';
import { StationNodeManager } from './station-node';
import { ConnectionLinkManager } from './connection-link';

export class NetworkTopologyManager {
  private topology: NetworkTopology;
  private nodeManager: StationNodeManager;
  private linkManager: ConnectionLinkManager;
  private eventListeners = new Map<MeshEventType, ((event: MeshEvent) => void)[]>();

  constructor() {
    this.nodeManager = new StationNodeManager();
    this.linkManager = new ConnectionLinkManager();

    this.topology = {
      nodes: new Map<NodeId, StationNode>(),
      links: new Map<string, ConnectionLink>(),
      routes: new Map<string, RoutePath>(),
      traffic: new Map<string, TrafficFlow>(),
      lastUpdate: Date.now(),
      health: {
        throughput: 0,
        packetLoss: 0,
        latency: 0,
        jitter: 0,
        availability: 0
      }
    };

    this.startPeriodicTasks();
  }

  getTopology(): NetworkTopology {
    return {
      ...this.topology,
      lastUpdate: Date.now()
    };
  }

  addNode(node: StationNode): void {
    this.topology.nodes.set(node.id, node);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('node-discovered', { nodeId: node.id, data: node });
    this.updateNetworkHealth();
  }

  updateNode(nodeId: NodeId, updates: Partial<StationNode>): boolean {
    const node = this.topology.nodes.get(nodeId);
    if (!node) return false;

    const updatedNode = { ...node, ...updates };
    this.topology.nodes.set(nodeId, updatedNode);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('node-updated', { nodeId, data: updatedNode });
    this.updateNetworkHealth();
    return true;
  }

  removeNode(nodeId: NodeId): boolean {
    const node = this.topology.nodes.get(nodeId);
    if (!node) return false;

    this.topology.nodes.delete(nodeId);

    const removedLinks = this.removeLinksForNode(nodeId);
    const removedRoutes = this.removeRoutesForNode(nodeId);
    const removedTraffic = this.removeTrafficForNode(nodeId);

    this.topology.lastUpdate = Date.now();
    this.emitEvent('node-lost', { nodeId, data: { node, removedLinks, removedRoutes, removedTraffic } });
    this.updateNetworkHealth();
    return true;
  }

  addLink(link: ConnectionLink): void {
    this.topology.links.set(link.id, link);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('link-established', { linkId: link.id, data: link });
    this.updateNetworkHealth();
  }

  updateLink(linkId: string, updates: Partial<ConnectionLink>): boolean {
    const link = this.topology.links.get(linkId);
    if (!link) return false;

    const updatedLink = { ...link, ...updates };
    this.topology.links.set(linkId, updatedLink);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('link-updated', { linkId, data: updatedLink });
    this.updateNetworkHealth();
    return true;
  }

  removeLink(linkId: string): boolean {
    const link = this.topology.links.get(linkId);
    if (!link) return false;

    this.topology.links.delete(linkId);
    this.removeRoutesUsingLink(linkId);

    this.topology.lastUpdate = Date.now();
    this.emitEvent('link-lost', { linkId, data: link });
    this.updateNetworkHealth();
    return true;
  }

  addRoute(route: RoutePath): void {
    this.topology.routes.set(route.id, route);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('route-discovered', { routeId: route.id, data: route });
  }

  updateRoute(routeId: string, updates: Partial<RoutePath>): boolean {
    const route = this.topology.routes.get(routeId);
    if (!route) return false;

    const updatedRoute = { ...route, ...updates };
    this.topology.routes.set(routeId, updatedRoute);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('route-updated', { routeId, data: updatedRoute });
    return true;
  }

  removeRoute(routeId: string): boolean {
    const route = this.topology.routes.get(routeId);
    if (!route) return false;

    this.topology.routes.delete(routeId);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('route-expired', { routeId, data: route });
    return true;
  }

  addTrafficFlow(traffic: TrafficFlow): void {
    this.topology.traffic.set(traffic.id, traffic);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('traffic-started', { trafficId: traffic.id, data: traffic });
  }

  updateTrafficFlow(trafficId: string, updates: Partial<TrafficFlow>): boolean {
    const traffic = this.topology.traffic.get(trafficId);
    if (!traffic) return false;

    const updatedTraffic = { ...traffic, ...updates };
    this.topology.traffic.set(trafficId, updatedTraffic);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('traffic-updated', { trafficId, data: updatedTraffic });
    return true;
  }

  endTrafficFlow(trafficId: string): boolean {
    const traffic = this.topology.traffic.get(trafficId);
    if (!traffic) return false;

    traffic.isActive = false;
    traffic.endTime = Date.now();
    this.topology.traffic.set(trafficId, traffic);
    this.topology.lastUpdate = Date.now();
    this.emitEvent('traffic-ended', { trafficId, data: traffic });
    return true;
  }

  findOptimalRoute(sourceId: NodeId, destinationId: NodeId): RoutePath | null {
    const routes = Array.from(this.topology.routes.values())
      .filter(route => route.source === sourceId && route.destination === destinationId);

    if (routes.length === 0) return null;

    return routes.reduce((best, current) => {
      if (current.isOptimal) return current;
      if (!best.isOptimal && current.reliability > best.reliability) return current;
      if (!best.isOptimal && current.reliability === best.reliability && current.totalLatency < best.totalLatency) return current;
      return best;
    });
  }

  findAllRoutes(sourceId: NodeId, destinationId: NodeId): RoutePath[] {
    return Array.from(this.topology.routes.values())
      .filter(route => route.source === sourceId && route.destination === destinationId)
      .sort((a, b) => {
        if (a.isOptimal && !b.isOptimal) return -1;
        if (!a.isOptimal && b.isOptimal) return 1;
        return b.reliability - a.reliability;
      });
  }

  getConnectedNodes(nodeId: NodeId): NodeId[] {
    const connectedNodes: Set<NodeId> = new Set();

    for (const link of this.topology.links.values()) {
      if (link.isActive) {
        if (link.sourceNodeId === nodeId) {
          connectedNodes.add(link.destinationNodeId);
        } else if (link.destinationNodeId === nodeId) {
          connectedNodes.add(link.sourceNodeId);
        }
      }
    }

    return Array.from(connectedNodes);
  }

  getActiveTrafficForNode(nodeId: NodeId): TrafficFlow[] {
    return Array.from(this.topology.traffic.values())
      .filter(traffic =>
        traffic.isActive && (traffic.source === nodeId || traffic.destination === nodeId)
      );
  }

  getActiveTrafficForLink(linkId: string): TrafficFlow[] {
    const link = this.topology.links.get(linkId);
    if (!link) return [];

    return Array.from(this.topology.traffic.values())
      .filter(traffic => {
        if (!traffic.isActive) return false;

        const route = this.topology.routes.get(traffic.routeId);
        if (!route) return false;

        for (let i = 0; i < route.hops.length - 1; i++) {
          const hopLinks = Array.from(this.topology.links.values())
            .filter(l =>
              (l.sourceNodeId === route.hops[i] && l.destinationNodeId === route.hops[i + 1]) ||
              (l.sourceNodeId === route.hops[i + 1] && l.destinationNodeId === route.hops[i])
            );

          if (hopLinks.some(l => l.id === linkId)) {
            return true;
          }
        }
        return false;
      });
  }

  detectNetworkPartitions(): NodeId[][] {
    const visited = new Set<NodeId>();
    const partitions: NodeId[][] = [];

    for (const nodeId of this.topology.nodes.keys()) {
      if (!visited.has(nodeId)) {
        const partition = this.explorePartition(nodeId, visited);
        partitions.push(partition);
      }
    }

    return partitions;
  }

  calculateNetworkDiameter(): number {
    const nodes = Array.from(this.topology.nodes.keys());
    let maxDistance = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const route = this.findOptimalRoute(nodes[i], nodes[j]);
        if (route && route.hops.length > maxDistance) {
          maxDistance = route.hops.length;
        }
      }
    }

    return maxDistance;
  }

  cleanupStaleData(): void {
    const now = Date.now();
    const maxNodeAge = 600000;
    const maxLinkAge = 300000;
    const maxRouteAge = 300000;
    const maxTrafficAge = 86400000;

    let hasChanges = false;

    for (const [nodeId, node] of this.topology.nodes) {
      if (now - node.lastSeen > maxNodeAge) {
        this.removeNode(nodeId);
        hasChanges = true;
      }
    }

    for (const [linkId, link] of this.topology.links) {
      if (now - link.lastActive > maxLinkAge) {
        this.removeLink(linkId);
        hasChanges = true;
      }
    }

    for (const [routeId, route] of this.topology.routes) {
      if (now - route.lastUsed > maxRouteAge) {
        this.removeRoute(routeId);
        hasChanges = true;
      }
    }

    for (const [trafficId, traffic] of this.topology.traffic) {
      const age = traffic.endTime ? now - traffic.endTime : now - traffic.startTime;
      if (age > maxTrafficAge) {
        this.topology.traffic.delete(trafficId);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.topology.lastUpdate = Date.now();
      this.emitEvent('topology-changed', { data: this.getTopologyStatistics() });
    }
  }

  getTopologyStatistics() {
    const nodes = this.topology.nodes.size;
    const activeNodes = Array.from(this.topology.nodes.values()).filter(n => n.status === 'active').length;
    const links = this.topology.links.size;
    const activeLinks = Array.from(this.topology.links.values()).filter(l => l.isActive).length;
    const routes = this.topology.routes.size;
    const activeTraffic = Array.from(this.topology.traffic.values()).filter(t => t.isActive).length;
    const partitions = this.detectNetworkPartitions();
    const diameter = this.calculateNetworkDiameter();

    return {
      nodes,
      activeNodes,
      links,
      activeLinks,
      routes,
      activeTraffic,
      partitions: partitions.length,
      largestPartition: Math.max(...partitions.map(p => p.length)),
      diameter,
      health: this.topology.health
    };
  }

  addEventListener(eventType: MeshEventType, callback: (event: MeshEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  removeEventListener(eventType: MeshEventType, callback: (event: MeshEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(type: MeshEventType, data: Partial<MeshEvent>): void {
    const event: MeshEvent = {
      type,
      timestamp: Date.now(),
      ...data
    } as MeshEvent;

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }

    const allListeners = this.eventListeners.get('topology-changed' as MeshEventType);
    if (allListeners && type !== 'topology-changed') {
      allListeners.forEach(callback => callback(event));
    }
  }

  private removeLinksForNode(nodeId: NodeId): string[] {
    const removedLinks: string[] = [];

    for (const [linkId, link] of this.topology.links) {
      if (link.sourceNodeId === nodeId || link.destinationNodeId === nodeId) {
        this.topology.links.delete(linkId);
        removedLinks.push(linkId);
      }
    }

    return removedLinks;
  }

  private removeRoutesForNode(nodeId: NodeId): string[] {
    const removedRoutes: string[] = [];

    for (const [routeId, route] of this.topology.routes) {
      if (route.source === nodeId || route.destination === nodeId || route.hops.includes(nodeId)) {
        this.topology.routes.delete(routeId);
        removedRoutes.push(routeId);
      }
    }

    return removedRoutes;
  }

  private removeTrafficForNode(nodeId: NodeId): string[] {
    const removedTraffic: string[] = [];

    for (const [trafficId, traffic] of this.topology.traffic) {
      if (traffic.source === nodeId || traffic.destination === nodeId) {
        traffic.isActive = false;
        traffic.endTime = Date.now();
        removedTraffic.push(trafficId);
      }
    }

    return removedTraffic;
  }

  private removeRoutesUsingLink(linkId: string): void {
    const link = this.topology.links.get(linkId);
    if (!link) return;

    for (const [routeId, route] of this.topology.routes) {
      for (let i = 0; i < route.hops.length - 1; i++) {
        const hopLink = Array.from(this.topology.links.values())
          .find(l =>
            (l.sourceNodeId === route.hops[i] && l.destinationNodeId === route.hops[i + 1]) ||
            (l.sourceNodeId === route.hops[i + 1] && l.destinationNodeId === route.hops[i])
          );

        if (hopLink?.id === linkId) {
          this.removeRoute(routeId);
          break;
        }
      }
    }
  }

  private explorePartition(startNodeId: NodeId, visited: Set<NodeId>): NodeId[] {
    const partition: NodeId[] = [];
    const queue: NodeId[] = [startNodeId];
    visited.add(startNodeId);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      partition.push(nodeId);

      const connectedNodes = this.getConnectedNodes(nodeId);
      for (const connectedNodeId of connectedNodes) {
        if (!visited.has(connectedNodeId)) {
          visited.add(connectedNodeId);
          queue.push(connectedNodeId);
        }
      }
    }

    return partition;
  }

  private calculateNetworkHealth(): NetworkHealth {
    const nodes = Array.from(this.topology.nodes.values());
    const links = Array.from(this.topology.links.values());
    const activeLinks = links.filter(l => l.isActive);

    if (nodes.length === 0) {
      return {
        throughput: 0,
        packetLoss: 0,
        latency: 0,
        jitter: 0,
        availability: 0
      };
    }

    const totalThroughput = activeLinks.reduce((sum, l) => sum + l.metrics.throughput, 0);
    const totalPackets = links.reduce((sum, l) => sum + l.metrics.packetsSent + l.metrics.packetsReceived, 0);
    const totalErrors = links.reduce((sum, l) => sum + l.metrics.errors, 0);

    const packetLoss = totalPackets > 0 ? totalErrors / totalPackets : 0;
    const availability = nodes.filter(n => n.status === 'active').length / nodes.length;

    const routes = Array.from(this.topology.routes.values());
    const averageLatency = routes.length > 0 ?
      routes.reduce((sum, r) => sum + r.totalLatency, 0) / routes.length : 0;

    return {
      throughput: totalThroughput,
      packetLoss,
      latency: averageLatency,
      jitter: averageLatency * 0.1,
      availability
    };
  }

  private updateNetworkHealth(): void {
    this.topology.health = this.calculateNetworkHealth();
  }

  private startPeriodicTasks(): void {
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupStaleData(), 60000);
      setInterval(() => this.updateNetworkHealth(), 30000);
    }
  }
}