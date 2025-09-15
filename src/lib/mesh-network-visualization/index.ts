export * from './types';
export { StationNodeManager } from './station-node';
export { ConnectionLinkManager } from './connection-link';
export { NetworkTopologyManager } from './network-topology';
export { CanvasRenderer } from './canvas-renderer';
export { LayoutEngine, type LayoutOptions } from './layout-engine';
export { MeshNetworkVisualizer, type MeshVisualizerCallbacks } from './mesh-visualizer';

// CSS-based components (recommended)
export { SimpleMeshNetwork } from '../../components/SimpleMeshNetwork';
export { MeshNetworkVisualizationCSS } from '../../components/MeshNetworkVisualizationCSS';

export const VERSION = '1.0.0';

export const DEFAULT_VISUALIZATION_OPTIONS = {
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
  maxNodes: 100
};

export const DEFAULT_RENDER_STYLE = {
  node: {
    radius: 8,
    activeColor: '#00ff00',
    inactiveColor: '#ffff00',
    unreachableColor: '#ff0000',
    strokeColor: '#ffffff',
    strokeWidth: 2
  },
  link: {
    activeColor: '#00aaff',
    inactiveColor: '#666666',
    rfColor: '#00ff88',
    internetColor: '#ff8800',
    width: 2,
    dashPattern: [5, 5]
  },
  text: {
    font: '12px Arial',
    color: '#ffffff',
    size: 12
  },
  traffic: {
    animationSpeed: 50,
    particleSize: 4,
    lowPriorityColor: '#88ff88',
    normalPriorityColor: '#ffff88',
    highPriorityColor: '#ff8888',
    emergencyPriorityColor: '#ff0000'
  }
};

export function createMeshNetworkVisualizer(
  canvas: HTMLCanvasElement,
  options = DEFAULT_VISUALIZATION_OPTIONS,
  style = DEFAULT_RENDER_STYLE,
  callbacks = {}
): MeshNetworkVisualizer {
  return new MeshNetworkVisualizer(canvas, options, style, callbacks);
}