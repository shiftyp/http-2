import {
  StationNode,
  ConnectionLink,
  Point2D,
  GPSCoordinates,
  NodeId
} from './types';

export interface LayoutOptions {
  algorithm: 'force-directed' | 'geographic' | 'circular' | 'grid';
  iterations: number;
  repulsionForce: number;
  attractionForce: number;
  damping: number;
  centerForce: number;
  nodeSize: number;
  linkDistance: number;
}

export interface GeographicBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export class LayoutEngine {
  public nodePositions = new Map<NodeId, Point2D>();
  private nodeVelocities = new Map<NodeId, Point2D>();
  private viewport: { width: number; height: number };
  private options: LayoutOptions;

  constructor(
    viewport: { width: number; height: number },
    options: Partial<LayoutOptions> = {}
  ) {
    this.viewport = viewport;
    this.options = {
      algorithm: 'force-directed',
      iterations: 100,
      repulsionForce: 1000,
      attractionForce: 0.1,
      damping: 0.95,
      centerForce: 0.01,
      nodeSize: 20,
      linkDistance: 100,
      ...options
    };
  }

  updateViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  setOptions(options: Partial<LayoutOptions>): void {
    this.options = { ...this.options, ...options };
  }

  calculateLayout(
    nodes: StationNode[],
    links: ConnectionLink[]
  ): Map<NodeId, Point2D> {
    switch (this.options.algorithm) {
      case 'geographic':
        return this.calculateGeographicLayout(nodes);
      case 'circular':
        return this.calculateCircularLayout(nodes);
      case 'grid':
        return this.calculateGridLayout(nodes);
      case 'force-directed':
      default:
        return this.calculateForceDirectedLayout(nodes, links);
    }
  }

  private calculateGeographicLayout(nodes: StationNode[]): Map<NodeId, Point2D> {
    if (nodes.length === 0) return new Map();

    const bounds = this.calculateGeographicBounds(nodes);
    const positions = new Map<NodeId, Point2D>();

    for (const node of nodes) {
      const position = this.coordinatesToScreenSpace(node.coordinates, bounds);
      positions.set(node.id, position);
    }

    this.nodePositions = positions;
    return positions;
  }

  private calculateCircularLayout(nodes: StationNode[]): Map<NodeId, Point2D> {
    const positions = new Map<NodeId, Point2D>();
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;
    const radius = Math.min(this.viewport.width, this.viewport.height) * 0.3;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      positions.set(node.id, { x, y });
    });

    this.nodePositions = positions;
    return positions;
  }

  private calculateGridLayout(nodes: StationNode[]): Map<NodeId, Point2D> {
    const positions = new Map<NodeId, Point2D>();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);

    const cellWidth = this.viewport.width / cols;
    const cellHeight = this.viewport.height / rows;

    const padding = 50;
    const usableWidth = this.viewport.width - 2 * padding;
    const usableHeight = this.viewport.height - 2 * padding;

    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = padding + (col + 0.5) * (usableWidth / cols);
      const y = padding + (row + 0.5) * (usableHeight / rows);

      positions.set(node.id, { x, y });
    });

    this.nodePositions = positions;
    return positions;
  }

  private calculateForceDirectedLayout(
    nodes: StationNode[],
    links: ConnectionLink[]
  ): Map<NodeId, Point2D> {
    this.initializePositions(nodes);
    this.initializeVelocities(nodes);

    for (let iteration = 0; iteration < this.options.iterations; iteration++) {
      this.simulateForces(nodes, links, iteration);
    }

    return new Map(this.nodePositions);
  }

  private initializePositions(nodes: StationNode[]): void {
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;

    for (const node of nodes) {
      if (!this.nodePositions.has(node.id)) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * 100 + 50;

        this.nodePositions.set(node.id, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        });
      }
    }
  }

  private initializeVelocities(nodes: StationNode[]): void {
    for (const node of nodes) {
      if (!this.nodeVelocities.has(node.id)) {
        this.nodeVelocities.set(node.id, { x: 0, y: 0 });
      }
    }
  }

  private simulateForces(nodes: StationNode[], links: ConnectionLink[], iteration: number): void {
    const forces = new Map<NodeId, Point2D>();

    for (const node of nodes) {
      forces.set(node.id, { x: 0, y: 0 });
    }

    this.applyRepulsionForces(nodes, forces);
    this.applyAttractionForces(links, forces);
    this.applyCenteringForce(nodes, forces);
    this.applyBoundaryForces(nodes, forces);

    this.updatePositions(nodes, forces, iteration);
  }

  private applyRepulsionForces(nodes: StationNode[], forces: Map<NodeId, Point2D>): void {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const pos1 = this.nodePositions.get(node1.id)!;
        const pos2 = this.nodePositions.get(node2.id)!;

        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) continue;

        const force = this.options.repulsionForce / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        const force1 = forces.get(node1.id)!;
        const force2 = forces.get(node2.id)!;

        force1.x += fx;
        force1.y += fy;
        force2.x -= fx;
        force2.y -= fy;
      }
    }
  }

  private applyAttractionForces(links: ConnectionLink[], forces: Map<NodeId, Point2D>): void {
    for (const link of links.filter(l => l.isActive)) {
      const pos1 = this.nodePositions.get(link.sourceNodeId);
      const pos2 = this.nodePositions.get(link.destinationNodeId);

      if (!pos1 || !pos2) continue;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) continue;

      const displacement = distance - this.options.linkDistance;
      const force = this.options.attractionForce * displacement * link.quality;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      const force1 = forces.get(link.sourceNodeId)!;
      const force2 = forces.get(link.destinationNodeId)!;

      force1.x += fx;
      force1.y += fy;
      force2.x -= fx;
      force2.y -= fy;
    }
  }

  private applyCenteringForce(nodes: StationNode[], forces: Map<NodeId, Point2D>): void {
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;

    for (const node of nodes) {
      const pos = this.nodePositions.get(node.id)!;
      const force = forces.get(node.id)!;

      const dx = centerX - pos.x;
      const dy = centerY - pos.y;

      force.x += dx * this.options.centerForce;
      force.y += dy * this.options.centerForce;
    }
  }

  private applyBoundaryForces(nodes: StationNode[], forces: Map<NodeId, Point2D>): void {
    const margin = this.options.nodeSize;

    for (const node of nodes) {
      const pos = this.nodePositions.get(node.id)!;
      const force = forces.get(node.id)!;

      if (pos.x < margin) {
        force.x += (margin - pos.x) * 0.1;
      } else if (pos.x > this.viewport.width - margin) {
        force.x -= (pos.x - (this.viewport.width - margin)) * 0.1;
      }

      if (pos.y < margin) {
        force.y += (margin - pos.y) * 0.1;
      } else if (pos.y > this.viewport.height - margin) {
        force.y -= (pos.y - (this.viewport.height - margin)) * 0.1;
      }
    }
  }

  private updatePositions(nodes: StationNode[], forces: Map<NodeId, Point2D>, iteration: number): void {
    const cooling = 1 - (iteration / this.options.iterations);
    const maxVelocity = 10 * cooling;

    for (const node of nodes) {
      const pos = this.nodePositions.get(node.id)!;
      const velocity = this.nodeVelocities.get(node.id)!;
      const force = forces.get(node.id)!;

      velocity.x = (velocity.x + force.x) * this.options.damping;
      velocity.y = (velocity.y + force.y) * this.options.damping;

      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > maxVelocity) {
        velocity.x = (velocity.x / speed) * maxVelocity;
        velocity.y = (velocity.y / speed) * maxVelocity;
      }

      pos.x += velocity.x;
      pos.y += velocity.y;

      pos.x = Math.max(this.options.nodeSize, Math.min(this.viewport.width - this.options.nodeSize, pos.x));
      pos.y = Math.max(this.options.nodeSize, Math.min(this.viewport.height - this.options.nodeSize, pos.y));
    }
  }

  private calculateGeographicBounds(nodes: StationNode[]): GeographicBounds {
    if (nodes.length === 0) {
      return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
    }

    let minLat = nodes[0].coordinates.latitude;
    let maxLat = nodes[0].coordinates.latitude;
    let minLon = nodes[0].coordinates.longitude;
    let maxLon = nodes[0].coordinates.longitude;

    for (const node of nodes) {
      minLat = Math.min(minLat, node.coordinates.latitude);
      maxLat = Math.max(maxLat, node.coordinates.latitude);
      minLon = Math.min(minLon, node.coordinates.longitude);
      maxLon = Math.max(maxLon, node.coordinates.longitude);
    }

    if (minLat === maxLat) {
      minLat -= 0.01;
      maxLat += 0.01;
    }
    if (minLon === maxLon) {
      minLon -= 0.01;
      maxLon += 0.01;
    }

    const padding = 0.1;
    const latPadding = (maxLat - minLat) * padding;
    const lonPadding = (maxLon - minLon) * padding;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding
    };
  }

  private coordinatesToScreenSpace(
    coordinates: GPSCoordinates,
    bounds: GeographicBounds
  ): Point2D {
    const latRange = bounds.maxLat - bounds.minLat;
    const lonRange = bounds.maxLon - bounds.minLon;

    const x = ((coordinates.longitude - bounds.minLon) / lonRange) * this.viewport.width;
    const y = ((bounds.maxLat - coordinates.latitude) / latRange) * this.viewport.height;

    return { x, y };
  }

  getNodePosition(nodeId: NodeId): Point2D | null {
    return this.nodePositions.get(nodeId) || null;
  }

  setNodePosition(nodeId: NodeId, position: Point2D): void {
    this.nodePositions.set(nodeId, position);
  }

  clearPositions(): void {
    this.nodePositions.clear();
    this.nodeVelocities.clear();
  }

  getBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    if (this.nodePositions.size === 0) {
      return { minX: 0, maxX: this.viewport.width, minY: 0, maxY: this.viewport.height };
    }

    const positions = Array.from(this.nodePositions.values());
    let minX = positions[0].x;
    let maxX = positions[0].x;
    let minY = positions[0].y;
    let maxY = positions[0].y;

    for (const pos of positions) {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }

    return { minX, maxX, minY, maxY };
  }
}