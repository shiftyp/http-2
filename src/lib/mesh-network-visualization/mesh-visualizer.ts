import {
  StationNode,
  ConnectionLink,
  TrafficFlow,
  RoutePath,
  NetworkTopology,
  MeshEvent,
  MeshEventType,
  VisualizationOptions,
  RenderStyle,
  InteractionEvent,
  NodeId,
  Point2D,
  CallSign,
  GPSCoordinates,
  StationEquipment,
  RFCharacteristics,
  PropagationConditions,
  ConnectionType,
  Protocol
} from './types';
import { NetworkTopologyManager } from './network-topology';
import { CanvasRenderer } from './canvas-renderer';
import { StationNodeManager } from './station-node';
import { ConnectionLinkManager } from './connection-link';

export interface MeshVisualizerCallbacks {
  onNodeClick?: (nodeId: NodeId, node: StationNode) => void;
  onNodeHover?: (nodeId: NodeId, node: StationNode) => void;
  onLinkClick?: (linkId: string, link: ConnectionLink) => void;
  onInitiateCommunication?: (nodeId: NodeId) => void;
  onTopologyChange?: (topology: NetworkTopology) => void;
  onError?: (error: Error) => void;
}

export class MeshNetworkVisualizer {
  private canvas: HTMLCanvasElement;
  private topologyManager: NetworkTopologyManager;
  private renderer: CanvasRenderer;
  private callbacks: MeshVisualizerCallbacks;
  private updateInterval: number | null = null;
  private animationFrame: number | null = null;
  private isRunning = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: Partial<VisualizationOptions> = {},
    style: Partial<RenderStyle> = {},
    callbacks: MeshVisualizerCallbacks = {}
  ) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.topologyManager = new NetworkTopologyManager();
    this.renderer = new CanvasRenderer(canvas, options, style);

    this.setupEventListeners();
    this.setupTopologyListeners();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startRenderLoop();

    if (this.renderer['options'].realTimeUpdates) {
      this.updateInterval = window.setInterval(() => {
        this.render();
      }, 100);
    }
  }

  stop(): void {
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
  }

  addStation(
    callsign: CallSign,
    coordinates: GPSCoordinates,
    equipment: StationEquipment,
    rfCharacteristics: RFCharacteristics
  ): NodeId {
    try {
      const nodeManager = new StationNodeManager();
      const node = nodeManager.createNode(callsign, coordinates, equipment, rfCharacteristics);

      this.topologyManager.addNode(node);
      return node.id;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to add station'));
      throw error;
    }
  }

  updateStation(nodeId: NodeId, updates: Partial<StationNode>): boolean {
    try {
      return this.topologyManager.updateNode(nodeId, updates);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to update station'));
      return false;
    }
  }

  removeStation(nodeId: NodeId): boolean {
    try {
      return this.topologyManager.removeNode(nodeId);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to remove station'));
      return false;
    }
  }

  establishConnection(
    sourceNodeId: NodeId,
    destinationNodeId: NodeId,
    connectionType: ConnectionType,
    protocol: Protocol,
    rfCharacteristics: RFCharacteristics,
    propagation: PropagationConditions
  ): string {
    try {
      const linkManager = new ConnectionLinkManager();
      const link = linkManager.establishLink(
        sourceNodeId,
        destinationNodeId,
        connectionType,
        protocol,
        rfCharacteristics,
        propagation
      );

      this.topologyManager.addLink(link);
      return link.id;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to establish connection'));
      throw error;
    }
  }

  updateConnection(linkId: string, updates: Partial<ConnectionLink>): boolean {
    try {
      return this.topologyManager.updateLink(linkId, updates);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to update connection'));
      return false;
    }
  }

  removeConnection(linkId: string): boolean {
    try {
      return this.topologyManager.removeLink(linkId);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to remove connection'));
      return false;
    }
  }

  addTrafficFlow(traffic: TrafficFlow): void {
    try {
      this.topologyManager.addTrafficFlow(traffic);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to add traffic flow'));
    }
  }

  updateTrafficFlow(trafficId: string, updates: Partial<TrafficFlow>): boolean {
    try {
      return this.topologyManager.updateTrafficFlow(trafficId, updates);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to update traffic flow'));
      return false;
    }
  }

  endTrafficFlow(trafficId: string): boolean {
    try {
      return this.topologyManager.endTrafficFlow(trafficId);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to end traffic flow'));
      return false;
    }
  }

  getTopology(): NetworkTopology {
    return this.topologyManager.getTopology();
  }

  getStation(nodeId: NodeId): StationNode | null {
    const topology = this.getTopology();
    return topology.nodes.get(nodeId) || null;
  }

  getConnection(linkId: string): ConnectionLink | null {
    const topology = this.getTopology();
    return topology.links.get(linkId) || null;
  }

  findOptimalRoute(sourceId: NodeId, destinationId: NodeId): RoutePath | null {
    try {
      return this.topologyManager.findOptimalRoute(sourceId, destinationId);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to find optimal route'));
      return null;
    }
  }

  setOptions(options: Partial<VisualizationOptions>): void {
    this.renderer.setOptions(options);
  }

  setStyle(style: Partial<RenderStyle>): void {
    this.renderer.setStyle(style);
  }

  zoom(factor: number, center?: Point2D): void {
    this.renderer.zoom(factor, center);
  }

  pan(deltaX: number, deltaY: number): void {
    this.renderer.pan(deltaX, deltaY);
  }

  autoFit(): void {
    const topology = this.getTopology();
    const nodes = Array.from(topology.nodes.values());
    this.renderer.autoFit(nodes);
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }

  initiateCommunication(nodeId: NodeId): void {
    if (this.callbacks.onInitiateCommunication) {
      try {
        this.callbacks.onInitiateCommunication(nodeId);
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error('Communication initiation failed'));
      }
    }
  }

  getNetworkStatistics() {
    return this.topologyManager.getTopologyStatistics();
  }

  exportData(): any {
    const topology = this.getTopology();

    return {
      timestamp: Date.now(),
      nodes: Array.from(topology.nodes.entries()),
      links: Array.from(topology.links.entries()),
      routes: Array.from(topology.routes.entries()),
      traffic: Array.from(topology.traffic.entries()),
      statistics: this.getNetworkStatistics()
    };
  }

  importData(data: any): void {
    try {
      if (data.nodes) {
        for (const [nodeId, node] of data.nodes) {
          this.topologyManager.addNode(node);
        }
      }

      if (data.links) {
        for (const [linkId, link] of data.links) {
          this.topologyManager.addLink(link);
        }
      }

      if (data.routes) {
        for (const [routeId, route] of data.routes) {
          this.topologyManager.addRoute(route);
        }
      }

      if (data.traffic) {
        for (const [trafficId, traffic] of data.traffic) {
          this.topologyManager.addTrafficFlow(traffic);
        }
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to import data'));
    }
  }

  addEventListener(eventType: MeshEventType, callback: (event: MeshEvent) => void): void {
    this.topologyManager.addEventListener(eventType, callback);
  }

  removeEventListener(eventType: MeshEventType, callback: (event: MeshEvent) => void): void {
    this.topologyManager.removeEventListener(eventType, callback);
  }

  private render(): void {
    const topology = this.getTopology();
    const nodes = Array.from(topology.nodes.values());
    const links = Array.from(topology.links.values());
    const traffic = Array.from(topology.traffic.values());

    this.renderer.render(nodes, links, traffic);
  }

  private startRenderLoop(): void {
    const renderFrame = () => {
      if (!this.isRunning) return;

      this.render();
      this.animationFrame = requestAnimationFrame(renderFrame);
    };

    this.animationFrame = requestAnimationFrame(renderFrame);
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickPoint: Point2D = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const nodeId = this.renderer.getNodeAt(clickPoint);
      if (nodeId) {
        const node = this.getStation(nodeId);
        if (node && this.callbacks.onNodeClick) {
          this.callbacks.onNodeClick(nodeId, node);
        }
        return;
      }

      const topology = this.getTopology();
      const links = Array.from(topology.links.values());
      const linkId = this.renderer.getLinkAt(clickPoint, links);
      if (linkId) {
        const link = this.getConnection(linkId);
        if (link && this.callbacks.onLinkClick) {
          this.callbacks.onLinkClick(linkId, link);
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const hoverPoint: Point2D = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const nodeId = this.renderer.getNodeAt(hoverPoint);
      if (nodeId) {
        const node = this.getStation(nodeId);
        if (node && this.callbacks.onNodeHover) {
          this.callbacks.onNodeHover(nodeId, node);
        }

        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    });

    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const dblClickPoint: Point2D = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const nodeId = this.renderer.getNodeAt(dblClickPoint);
      if (nodeId) {
        this.initiateCommunication(nodeId);
      }
    });
  }

  private setupTopologyListeners(): void {
    this.addEventListener('topology-changed', (event) => {
      if (this.callbacks.onTopologyChange) {
        this.callbacks.onTopologyChange(this.getTopology());
      }
    });
  }

  private handleError(error: Error): void {
    console.error('MeshNetworkVisualizer Error:', error);

    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }
}