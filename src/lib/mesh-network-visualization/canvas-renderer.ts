import {
  CanvasContext,
  ViewportBounds,
  Point2D,
  StationNode,
  ConnectionLink,
  TrafficFlow,
  RenderStyle,
  InteractionEvent,
  VisualizationOptions,
  NodeId,
  GPSCoordinates
} from './types';
import { LayoutEngine, LayoutOptions } from './layout-engine';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasContext;
  private viewport: ViewportBounds;
  private style: RenderStyle;
  private options: VisualizationOptions;
  private animationFrame: number | null = null;
  private lastRenderTime = 0;
  private layoutEngine: LayoutEngine;
  private needsRelayout = true;

  constructor(
    canvas: HTMLCanvasElement,
    options: Partial<VisualizationOptions> = {},
    style: Partial<RenderStyle> = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.viewport = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      zoom: 1.0
    };

    this.layoutEngine = new LayoutEngine(
      { width: canvas.width, height: canvas.height },
      {
        algorithm: 'force-directed',
        iterations: 50,
        repulsionForce: 800,
        attractionForce: 0.05,
        damping: 0.9,
        centerForce: 0.02,
        nodeSize: 20,
        linkDistance: 120
      }
    );

    this.options = {
      showSignalStrength: true,
      showPropagationCoverage: false,
      showTrafficFlow: true,
      showRoutes: true,
      animateTraffic: true,
      realTimeUpdates: true,
      geographicMode: false,
      showFrequencies: false,
      showProtocols: false,
      autoZoom: true,
      maxNodes: 100,
      ...options
    };

    this.style = {
      node: {
        radius: 8,
        activeColor: '#00ff00',
        inactiveColor: '#ffff00',
        unreachableColor: '#ff0000',
        strokeColor: '#ffffff',
        strokeWidth: 2,
        ...style.node
      },
      link: {
        activeColor: '#00aaff',
        inactiveColor: '#666666',
        rfColor: '#00ff88',
        internetColor: '#ff8800',
        width: 2,
        dashPattern: [5, 5],
        ...style.link
      },
      text: {
        font: '12px Arial',
        color: '#ffffff',
        size: 12,
        ...style.text
      },
      traffic: {
        animationSpeed: 50,
        particleSize: 4,
        lowPriorityColor: '#88ff88',
        normalPriorityColor: '#ffff88',
        highPriorityColor: '#ff8888',
        emergencyPriorityColor: '#ff0000',
        ...style.traffic
      }
    };

    this.setupEventListeners();
    this.startRenderLoop();
  }

  render(
    nodes: StationNode[],
    links: ConnectionLink[],
    traffic: TrafficFlow[] = []
  ): void {
    this.updateLayout(nodes, links);
    this.clearCanvas();

    if (this.options.showPropagationCoverage) {
      this.renderPropagationCoverage(nodes, links);
    }

    if (this.options.showRoutes) {
      this.renderRoutes(links);
    }

    this.renderLinks(links);

    if (this.options.showTrafficFlow && this.options.animateTraffic) {
      this.renderTrafficFlow(traffic, links);
    }

    this.renderNodes(nodes);

    if (this.options.showFrequencies) {
      this.renderFrequencies(links);
    }

    if (this.options.showProtocols) {
      this.renderProtocols(links);
    }
  }

  setOptions(options: Partial<VisualizationOptions>): void {
    const oldGeographicMode = this.options.geographicMode;
    this.options = { ...this.options, ...options };

    if (this.options.geographicMode !== oldGeographicMode) {
      this.layoutEngine.setOptions({
        algorithm: this.options.geographicMode ? 'geographic' : 'force-directed'
      });
      this.needsRelayout = true;
    }
  }

  setStyle(style: Partial<RenderStyle>): void {
    this.style = {
      node: { ...this.style.node, ...style.node },
      link: { ...this.style.link, ...style.link },
      text: { ...this.style.text, ...style.text },
      traffic: { ...this.style.traffic, ...style.traffic }
    };
  }

  setViewport(viewport: Partial<ViewportBounds>): void {
    this.viewport = { ...this.viewport, ...viewport };
  }

  screenToWorld(screenPoint: Point2D): Point2D {
    return {
      x: (screenPoint.x / this.viewport.zoom) + this.viewport.x,
      y: (screenPoint.y / this.viewport.zoom) + this.viewport.y
    };
  }

  worldToScreen(worldPoint: Point2D): Point2D {
    return {
      x: (worldPoint.x - this.viewport.x) * this.viewport.zoom,
      y: (worldPoint.y - this.viewport.y) * this.viewport.zoom
    };
  }

  zoom(factor: number, center?: Point2D): void {
    const centerPoint = center || { x: this.canvas.width / 2, y: this.canvas.height / 2 };
    const worldCenter = this.screenToWorld(centerPoint);

    this.viewport.zoom = Math.max(0.1, Math.min(10.0, this.viewport.zoom * factor));

    const newScreenCenter = this.worldToScreen(worldCenter);
    this.viewport.x += (centerPoint.x - newScreenCenter.x) / this.viewport.zoom;
    this.viewport.y += (centerPoint.y - newScreenCenter.y) / this.viewport.zoom;
  }

  pan(deltaX: number, deltaY: number): void {
    this.viewport.x -= deltaX / this.viewport.zoom;
    this.viewport.y -= deltaY / this.viewport.zoom;
  }

  autoFit(nodes: StationNode[]): void {
    if (nodes.length === 0) return;

    const bounds = this.layoutEngine.getBounds();
    const padding = 50;

    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    if (contentWidth === 0 || contentHeight === 0) return;

    const scaleX = this.canvas.width / contentWidth;
    const scaleY = this.canvas.height / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2.0);

    this.viewport.zoom = scale;
    this.viewport.x = bounds.minX - padding;
    this.viewport.y = bounds.minY - padding;
  }

  getNodeAt(screenPoint: Point2D): NodeId | null {
    const worldPoint = this.screenToWorld(screenPoint);

    for (const [nodeId, position] of this.layoutEngine.nodePositions) {
      const distance = Math.sqrt(
        Math.pow(worldPoint.x - position.x, 2) + Math.pow(worldPoint.y - position.y, 2)
      );

      if (distance <= this.style.node.radius) {
        return nodeId;
      }
    }

    return null;
  }

  getLinkAt(screenPoint: Point2D, links: ConnectionLink[]): string | null {
    const worldPoint = this.screenToWorld(screenPoint);
    const tolerance = 5;

    for (const link of links) {
      const sourcePos = this.layoutEngine.getNodePosition(link.sourceNodeId);
      const destPos = this.layoutEngine.getNodePosition(link.destinationNodeId);

      if (!sourcePos || !destPos) continue;

      const distance = this.pointToLineDistance(worldPoint, sourcePos, destPos);
      if (distance <= tolerance) {
        return link.id;
      }
    }

    return null;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.viewport.width = width;
    this.viewport.height = height;
    this.layoutEngine.updateViewport(width, height);
    this.needsRelayout = true;
  }

  dispose(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  private updateLayout(nodes: StationNode[], links: ConnectionLink[]): void {
    if (this.needsRelayout || this.layoutEngine.nodePositions.size !== nodes.length) {
      this.layoutEngine.setOptions({
        algorithm: this.options.geographicMode ? 'geographic' : 'force-directed'
      });

      console.log(`Layout update: ${nodes.length} nodes, algorithm: ${this.options.geographicMode ? 'geographic' : 'force-directed'}`);
      this.layoutEngine.calculateLayout(nodes, links);
      this.needsRelayout = false;

      console.log(`Positions calculated: ${this.layoutEngine.nodePositions.size} nodes positioned`);
    }
  }

  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderNodes(nodes: StationNode[]): void {
    this.ctx.save();

    console.log(`Rendering ${nodes.length} nodes`);

    for (const node of nodes) {
      const position = this.layoutEngine.getNodePosition(node.id);
      if (!position) {
        console.log(`No position found for node ${node.id}`);
        continue;
      }

      console.log(`Node ${node.id} at position:`, position);
      const screenPos = this.worldToScreen(position);
      console.log(`Screen position:`, screenPos);

      let fillColor = this.style.node.activeColor;
      switch (node.status) {
        case 'inactive':
          fillColor = this.style.node.inactiveColor;
          break;
        case 'unreachable':
          fillColor = this.style.node.unreachableColor;
          break;
      }

      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, this.style.node.radius * this.viewport.zoom, 0, 2 * Math.PI);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      this.ctx.strokeStyle = this.style.node.strokeColor;
      this.ctx.lineWidth = this.style.node.strokeWidth;
      this.ctx.stroke();

      this.ctx.fillStyle = this.style.text.color;
      this.ctx.font = `${this.style.text.size * this.viewport.zoom}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        node.callsign,
        screenPos.x,
        screenPos.y + this.style.node.radius * this.viewport.zoom + 15
      );

      if (this.options.showSignalStrength && node.rfCharacteristics.signalStrength) {
        const signalText = `${node.rfCharacteristics.signalStrength.toFixed(0)} dBm`;
        this.ctx.fillText(
          signalText,
          screenPos.x,
          screenPos.y + this.style.node.radius * this.viewport.zoom + 30
        );
      }
    }

    this.ctx.restore();
  }

  private renderLinks(links: ConnectionLink[]): void {
    this.ctx.save();

    for (const link of links) {
      const sourcePos = this.layoutEngine.getNodePosition(link.sourceNodeId);
      const destPos = this.layoutEngine.getNodePosition(link.destinationNodeId);

      if (!sourcePos || !destPos) continue;

      const screenSource = this.worldToScreen(sourcePos);
      const screenDest = this.worldToScreen(destPos);

      let strokeColor = link.isActive ? this.style.link.activeColor : this.style.link.inactiveColor;
      if (link.connectionType === 'rf') {
        strokeColor = this.style.link.rfColor;
      } else if (link.connectionType === 'internet') {
        strokeColor = this.style.link.internetColor;
      }

      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = this.style.link.width * Math.sqrt(this.viewport.zoom);

      if (!link.isActive) {
        this.ctx.setLineDash(this.style.link.dashPattern);
      } else {
        this.ctx.setLineDash([]);
      }

      const alpha = Math.max(0.3, link.quality);
      this.ctx.globalAlpha = alpha;

      this.ctx.beginPath();
      this.ctx.moveTo(screenSource.x, screenSource.y);
      this.ctx.lineTo(screenDest.x, screenDest.y);
      this.ctx.stroke();

      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.restore();
  }

  private renderTrafficFlow(traffic: TrafficFlow[], links: ConnectionLink[]): void {
    const currentTime = Date.now();

    this.ctx.save();

    for (const flow of traffic.filter(f => f.isActive)) {
      const link = links.find(l =>
        (l.sourceNodeId === flow.source && l.destinationNodeId === flow.destination) ||
        (l.sourceNodeId === flow.destination && l.destinationNodeId === flow.source)
      );

      if (!link) continue;

      const sourcePos = this.layoutEngine.getNodePosition(link.sourceNodeId);
      const destPos = this.layoutEngine.getNodePosition(link.destinationNodeId);

      if (!sourcePos || !destPos) continue;

      const progress = ((currentTime - flow.startTime) / 1000 * this.style.traffic.animationSpeed) % 100 / 100;

      const particleX = sourcePos.x + (destPos.x - sourcePos.x) * progress;
      const particleY = sourcePos.y + (destPos.y - sourcePos.y) * progress;
      const screenPos = this.worldToScreen({ x: particleX, y: particleY });

      let particleColor = this.style.traffic.normalPriorityColor;
      switch (flow.priority) {
        case 'low':
          particleColor = this.style.traffic.lowPriorityColor;
          break;
        case 'high':
          particleColor = this.style.traffic.highPriorityColor;
          break;
        case 'emergency':
          particleColor = this.style.traffic.emergencyPriorityColor;
          break;
      }

      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, this.style.traffic.particleSize * this.viewport.zoom, 0, 2 * Math.PI);
      this.ctx.fillStyle = particleColor;
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private renderPropagationCoverage(nodes: StationNode[], links: ConnectionLink[]): void {
    this.ctx.save();

    for (const node of nodes) {
      if (node.status !== 'active') continue;

      const position = this.getNodePosition(node);
      const screenPos = this.worldToScreen(position);

      const maxRange = this.estimateNodeRange(node);
      const screenRadius = maxRange * this.viewport.zoom;

      const gradient = this.ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, screenRadius
      );

      const snrRatio = Math.max(0, Math.min(1, (node.rfCharacteristics.snr + 20) / 40));
      gradient.addColorStop(0, `rgba(0, 255, 0, ${0.3 * snrRatio})`);
      gradient.addColorStop(0.7, `rgba(0, 255, 0, ${0.1 * snrRatio})`);
      gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private renderRoutes(links: ConnectionLink[]): void {
  }

  private renderFrequencies(links: ConnectionLink[]): void {
    this.ctx.save();
    this.ctx.font = `${10 * this.viewport.zoom}px Arial`;
    this.ctx.fillStyle = '#cccccc';
    this.ctx.textAlign = 'center';

    for (const link of links) {
      const sourcePos = this.layoutEngine.getNodePosition(link.sourceNodeId);
      const destPos = this.layoutEngine.getNodePosition(link.destinationNodeId);

      if (!sourcePos || !destPos) continue;

      const midX = (sourcePos.x + destPos.x) / 2;
      const midY = (sourcePos.y + destPos.y) / 2;
      const screenMid = this.worldToScreen({ x: midX, y: midY });

      const freqText = `${(link.rfCharacteristics.frequency / 1000000).toFixed(3)} MHz`;
      this.ctx.fillText(freqText, screenMid.x, screenMid.y - 5);
    }

    this.ctx.restore();
  }

  private renderProtocols(links: ConnectionLink[]): void {
    this.ctx.save();
    this.ctx.font = `${9 * this.viewport.zoom}px Arial`;
    this.ctx.fillStyle = '#aaaaaa';
    this.ctx.textAlign = 'center';

    for (const link of links) {
      const sourcePos = this.layoutEngine.getNodePosition(link.sourceNodeId);
      const destPos = this.layoutEngine.getNodePosition(link.destinationNodeId);

      if (!sourcePos || !destPos) continue;

      const midX = (sourcePos.x + destPos.x) / 2;
      const midY = (sourcePos.y + destPos.y) / 2;
      const screenMid = this.worldToScreen({ x: midX, y: midY });

      this.ctx.fillText(link.protocol, screenMid.x, screenMid.y + 10);
    }

    this.ctx.restore();
  }


  private estimateNodeRange(node: StationNode): number {
    const power = node.rfCharacteristics.power;
    const frequency = node.rfCharacteristics.frequency;

    let baseRange = 50;
    if (node.rfCharacteristics.band === 'HF') baseRange = 500;
    else if (node.rfCharacteristics.band === 'VHF') baseRange = 150;
    else if (node.rfCharacteristics.band === 'UHF') baseRange = 50;

    const powerFactor = Math.sqrt(power / 100);
    return baseRange * powerFactor;
  }

  private pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    let param = dot / lenSq;
    if (param < 0) param = 0;
    else if (param > 1) param = 1;

    const xx = lineStart.x + param * C;
    const yy = lineStart.y + param * D;

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  private setupEventListeners(): void {
    let isDragging = false;
    let lastMousePos: Point2D | null = null;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastMousePos = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging && lastMousePos) {
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        this.pan(deltaX, deltaY);
        lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
      lastMousePos = null;
    });

    this.canvas.addEventListener('wheel', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(zoomFactor, { x: centerX, y: centerY });
      e.preventDefault();
    });
  }

  private startRenderLoop(): void {
    const renderFrame = (timestamp: number) => {
      if (timestamp - this.lastRenderTime > 16) {
        this.lastRenderTime = timestamp;
      }

      this.animationFrame = requestAnimationFrame(renderFrame);
    };

    this.animationFrame = requestAnimationFrame(renderFrame);
  }
}