import React, { useEffect, useRef, useState } from 'react';
import {
  MeshNetworkVisualizer,
  StationNode,
  MeshVisualizerCallbacks,
  VisualizationOptions
} from '../lib/mesh-network-visualization';
import './MeshNetworkVisualization.css';

interface MeshNetworkVisualizationProps {
  width?: number;
  height?: number;
  options?: Partial<VisualizationOptions>;
  className?: string;
}

export const MeshNetworkVisualization: React.FC<MeshNetworkVisualizationProps> = ({
  width = 800,
  height = 600,
  options = {},
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<MeshNetworkVisualizer | null>(null);
  const [selectedNode, setSelectedNode] = useState<StationNode | null>(null);
  const [networkStats, setNetworkStats] = useState<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const callbacks: MeshVisualizerCallbacks = {
      onNodeClick: (_, node) => {
        setSelectedNode(node);
        console.log('Node clicked:', node.callsign);
      },
      onNodeHover: (_, node) => {
        console.log('Node hover:', node.callsign);
      },
      onLinkClick: (_, link) => {
        console.log('Link clicked:', link.id);
      },
      onInitiateCommunication: (nodeId) => {
        console.log('Initiate communication with:', nodeId);
        const node = visualizerRef.current?.getStation(nodeId);
        if (node) {
          alert(`Initiating communication with ${node.callsign}`);
        }
      },
      onTopologyChange: (_) => {
        const stats = visualizerRef.current?.getNetworkStatistics();
        setNetworkStats(stats);
      },
      onError: (error) => {
        console.error('Mesh visualization error:', error);
      }
    };

    visualizerRef.current = new MeshNetworkVisualizer(
      canvasRef.current,
      {
        showSignalStrength: true,
        showPropagationCoverage: false,
        showTrafficFlow: true,
        showRoutes: true,
        animateTraffic: true,
        realTimeUpdates: true,
        geographicMode: false,
        showFrequencies: true,
        showProtocols: true,
        autoZoom: true,
        maxNodes: 50,
        ...options
      },
      {},
      callbacks
    );

    visualizerRef.current.start();

    addDemoStations();

    return () => {
      visualizerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      visualizerRef.current?.resize(width, height);
    }
  }, [width, height]);

  const addDemoStations = () => {
    if (!visualizerRef.current) return;

    const stations = [
      {
        callsign: 'KA1ABC',
        coordinates: { latitude: 40.7128, longitude: -74.0060, altitude: 10 },
        frequency: 14230000
      },
      {
        callsign: 'KB2DEF',
        coordinates: { latitude: 40.7589, longitude: -73.9851, altitude: 15 },
        frequency: 14230000
      },
      {
        callsign: 'KC3GHI',
        coordinates: { latitude: 40.6892, longitude: -74.0445, altitude: 5 },
        frequency: 21070000
      },
      {
        callsign: 'KD4JKL',
        coordinates: { latitude: 40.7282, longitude: -73.7949, altitude: 20 },
        frequency: 28074000
      }
    ];

    const nodeIds: string[] = [];

    for (const station of stations) {
      const nodeId = visualizerRef.current.addStation(
        station.callsign,
        station.coordinates,
        {
          manufacturer: 'Icom',
          model: 'IC-7300',
          power: 100,
          antenna: 'Dipole',
          bands: ['HF'],
          modes: ['HTTP-QPSK']
        },
        {
          frequency: station.frequency,
          band: 'HF',
          power: 100,
          signalStrength: -60 - Math.random() * 20,
          snr: 10 + Math.random() * 20,
          noiseFloor: -120,
          bandwidth: 2800,
          modulation: 'QPSK'
        }
      );
      nodeIds.push(nodeId);
    }

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        if (Math.random() > 0.5) {
          const distance = 10 + Math.random() * 50;
          visualizerRef.current.establishConnection(
            nodeIds[i],
            nodeIds[j],
            'rf',
            'HTTP-QPSK',
            {
              frequency: 14230000,
              band: 'HF',
              power: 100,
              signalStrength: -60 - distance / 2,
              snr: 20 - distance / 5,
              noiseFloor: -120,
              bandwidth: 2800,
              modulation: 'QPSK'
            },
            {
              distance,
              azimuth: Math.random() * 360,
              pathLoss: 60 + distance * 1.5,
              fadingMargin: 10,
              multipath: Math.random() > 0.7,
              atmosphericNoise: Math.random() * 10
            }
          );
        }
      }
    }

    visualizerRef.current.autoFit();

    setTimeout(() => {
      if (visualizerRef.current && nodeIds.length >= 2) {
        visualizerRef.current.addTrafficFlow({
          id: 'demo-traffic-1',
          routeId: 'demo-route-1',
          source: nodeIds[0],
          destination: nodeIds[1],
          direction: 'bidirectional',
          priority: 'normal',
          startTime: Date.now(),
          bytesTransmitted: 1024,
          packetsTransmitted: 10,
          currentThroughput: 2400,
          isActive: true
        });
      }
    }, 2000);
  };

  const handleZoomIn = () => {
    visualizerRef.current?.zoom(1.2);
  };

  const handleZoomOut = () => {
    visualizerRef.current?.zoom(0.8);
  };

  const handleAutoFit = () => {
    visualizerRef.current?.autoFit();
  };

  const toggleOption = (option: keyof VisualizationOptions) => {
    if (visualizerRef.current) {
      const currentOptions = { ...options };
      currentOptions[option] = !currentOptions[option] as any;
      visualizerRef.current.setOptions(currentOptions);
    }
  };

  return (
    <div className={`mesh-network-visualization ${className}`}>
      <div className="controls" style={{ marginBottom: '10px' }}>
        <button onClick={handleZoomIn}>Zoom In</button>
        <button onClick={handleZoomOut}>Zoom Out</button>
        <button onClick={handleAutoFit}>Auto Fit</button>

        <select
          onChange={(e) => {
            const algorithm = e.target.value as 'force-directed' | 'geographic' | 'circular' | 'grid';
            if (visualizerRef.current) {
              visualizerRef.current.setOptions({
                geographicMode: algorithm === 'geographic'
              });
              // Update layout engine algorithm
              const renderer = (visualizerRef.current as any).renderer;
              if (renderer && renderer.layoutEngine) {
                renderer.layoutEngine.setOptions({ algorithm });
                renderer.needsRelayout = true;
              }
            }
          }}
          style={{ marginLeft: '10px' }}
        >
          <option value="force-directed">Force Directed</option>
          <option value="geographic">Geographic</option>
          <option value="circular">Circular</option>
          <option value="grid">Grid</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={options.showSignalStrength}
            onChange={() => toggleOption('showSignalStrength')}
          />
          Signal Strength
        </label>

        <label>
          <input
            type="checkbox"
            checked={options.showTrafficFlow}
            onChange={() => toggleOption('showTrafficFlow')}
          />
          Traffic Flow
        </label>

        <label>
          <input
            type="checkbox"
            checked={options.showFrequencies}
            onChange={() => toggleOption('showFrequencies')}
          />
          Frequencies
        </label>

        <label>
          <input
            type="checkbox"
            checked={options.showPropagationCoverage}
            onChange={() => toggleOption('showPropagationCoverage')}
          />
          Propagation Coverage
        </label>

        <label>
          <input
            type="checkbox"
            checked={options.geographicMode}
            onChange={() => toggleOption('geographicMode')}
          />
          Geographic Layout
        </label>
      </div>

      <div className="visualization-container">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
          />
        </div>

        {(selectedNode || networkStats) && (
          <div className="details-panel">
            {selectedNode && (
              <div>
                <h3>Station Details</h3>
                <p><strong>Callsign:</strong> {selectedNode.callsign}</p>
                <p><strong>Status:</strong> {selectedNode.status}</p>
                <p><strong>Frequency:</strong> {(selectedNode.rfCharacteristics.frequency / 1000000).toFixed(3)} MHz</p>
                <p><strong>Signal:</strong> {selectedNode.rfCharacteristics.signalStrength.toFixed(1)} dBm</p>
                <p><strong>SNR:</strong> {selectedNode.rfCharacteristics.snr.toFixed(1)} dB</p>
                <p><strong>Location:</strong> {selectedNode.coordinates.latitude.toFixed(4)}, {selectedNode.coordinates.longitude.toFixed(4)}</p>
                <p><strong>Equipment:</strong> {selectedNode.equipment.manufacturer} {selectedNode.equipment.model}</p>
                <p><strong>Power:</strong> {selectedNode.equipment.power}W</p>
              </div>
            )}

            {networkStats && (
              <div>
                <h3>Network Statistics</h3>
                <p><strong>Total Nodes:</strong> {networkStats.nodes}</p>
                <p><strong>Active Nodes:</strong> {networkStats.activeNodes}</p>
                <p><strong>Total Links:</strong> {networkStats.links}</p>
                <p><strong>Active Links:</strong> {networkStats.activeLinks}</p>
                <p><strong>Network Health:</strong> {(networkStats.health?.availability * 100 || 0).toFixed(1)}%</p>
              </div>
            )}

            <div className="legend">
              <h4>Legend</h4>
              <div className="legend-item">
                <div className="legend-color active"></div>
                <span>Active Station</span>
              </div>
              <div className="legend-item">
                <div className="legend-color inactive"></div>
                <span>Inactive Station</span>
              </div>
              <div className="legend-item">
                <div className="legend-color unreachable"></div>
                <span>Unreachable Station</span>
              </div>
              <div className="legend-item">
                <div className="legend-color rf-link"></div>
                <span>RF Connection</span>
              </div>
              <div className="legend-item">
                <div className="legend-color internet-link"></div>
                <span>Internet Connection</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="help-text">
        <p>Click on nodes to see details. Double-click to initiate communication. Use mouse wheel to zoom. Drag to pan.</p>
      </div>
    </div>
  );
};