import React, { useEffect, useState, useRef } from 'react';
import { MeshNetworkVisualizer, StationNode, VisualizationOptions } from '../lib/mesh-network-visualization';

interface MeshNetworkVisualizationCSSProps {
  width?: number;
  height?: number;
  options?: Partial<VisualizationOptions>;
  className?: string;
}

export const MeshNetworkVisualizationCSS: React.FC<MeshNetworkVisualizationCSSProps> = ({
  width = 800,
  height = 600,
  options = {},
  className = ''
}) => {
  const [nodes, setNodes] = useState<StationNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<StationNode | null>(null);
  const [layoutMode, setLayoutMode] = useState<'force-directed' | 'geographic' | 'circular' | 'grid'>('force-directed');
  const containerRef = useRef<HTMLDivElement>(null);

  // Demo data
  useEffect(() => {
    const demoNodes: StationNode[] = [
      {
        id: 'node-ka1abc',
        callsign: 'KA1ABC',
        status: 'active',
        coordinates: { latitude: 40.7128, longitude: -74.0060, altitude: 10 },
        equipment: { manufacturer: 'Icom', model: 'IC-7300', power: 100, antenna: 'Dipole', bands: ['HF'], modes: ['HTTP-QPSK'] },
        rfCharacteristics: { frequency: 14230000, band: 'HF', power: 100, signalStrength: -65, snr: 18, noiseFloor: -120, bandwidth: 2800, modulation: 'QPSK' },
        lastSeen: Date.now(),
        capabilities: { relay: true, store: true, gateway: false, modes: ['HTTP-QPSK'] },
        metrics: { packetsRelayed: 45, packetsDropped: 2, bytesTransferred: 12458, uptime: Date.now() - 3600000 }
      },
      {
        id: 'node-kb2def',
        callsign: 'KB2DEF',
        status: 'active',
        coordinates: { latitude: 40.7589, longitude: -73.9851, altitude: 15 },
        equipment: { manufacturer: 'Yaesu', model: 'FT-991A', power: 100, antenna: 'Vertical', bands: ['HF'], modes: ['HTTP-QPSK'] },
        rfCharacteristics: { frequency: 14230000, band: 'HF', power: 100, signalStrength: -72, snr: 12, noiseFloor: -120, bandwidth: 2800, modulation: 'QPSK' },
        lastSeen: Date.now() - 30000,
        capabilities: { relay: true, store: true, gateway: false, modes: ['HTTP-QPSK'] },
        metrics: { packetsRelayed: 23, packetsDropped: 1, bytesTransferred: 8924, uptime: Date.now() - 7200000 }
      },
      {
        id: 'node-kc3ghi',
        callsign: 'KC3GHI',
        status: 'inactive',
        coordinates: { latitude: 40.6892, longitude: -74.0445, altitude: 5 },
        equipment: { manufacturer: 'Kenwood', model: 'TS-590SG', power: 100, antenna: 'Beam', bands: ['HF'], modes: ['HTTP-QPSK'] },
        rfCharacteristics: { frequency: 21070000, band: 'HF', power: 100, signalStrength: -85, snr: 8, noiseFloor: -120, bandwidth: 2800, modulation: 'QPSK' },
        lastSeen: Date.now() - 180000,
        capabilities: { relay: true, store: false, gateway: false, modes: ['HTTP-QPSK'] },
        metrics: { packetsRelayed: 12, packetsDropped: 3, bytesTransferred: 4521, uptime: Date.now() - 10800000 }
      },
      {
        id: 'node-kd4jkl',
        callsign: 'KD4JKL',
        status: 'active',
        coordinates: { latitude: 40.7282, longitude: -73.7949, altitude: 20 },
        equipment: { manufacturer: 'Icom', model: 'IC-7610', power: 100, antenna: 'Loop', bands: ['HF'], modes: ['HTTP-QPSK'] },
        rfCharacteristics: { frequency: 28074000, band: 'HF', power: 100, signalStrength: -58, snr: 22, noiseFloor: -120, bandwidth: 2800, modulation: 'QPSK' },
        lastSeen: Date.now() - 15000,
        capabilities: { relay: true, store: true, gateway: true, modes: ['HTTP-QPSK'] },
        metrics: { packetsRelayed: 78, packetsDropped: 0, bytesTransferred: 23451, uptime: Date.now() - 1800000 }
      }
    ];
    setNodes(demoNodes);
  }, []);

  const calculateNodePosition = (node: StationNode, index: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    switch (layoutMode) {
      case 'geographic':
        // Simple geographic layout using relative positioning
        const latRange = 0.1; // Approximate lat range for NYC area
        const lonRange = 0.3; // Approximate lon range for NYC area
        const baseLat = 40.6892;
        const baseLon = -74.0445;

        return {
          x: ((node.coordinates.longitude - baseLon) / lonRange) * width * 0.8 + width * 0.1,
          y: ((baseLat + latRange - node.coordinates.latitude) / latRange) * height * 0.8 + height * 0.1
        };

      case 'circular':
        const angle = (2 * Math.PI * index) / nodes.length;
        const radius = Math.min(width, height) * 0.3;
        return {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };

      case 'grid':
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const cellWidth = width / cols;
        const cellHeight = height / Math.ceil(nodes.length / cols);
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          x: col * cellWidth + cellWidth / 2,
          y: row * cellHeight + cellHeight / 2
        };

      case 'force-directed':
      default:
        // Simple force-directed approximation
        const spread = 200;
        return {
          x: centerX + (Math.random() - 0.5) * spread + (index - nodes.length / 2) * 80,
          y: centerY + (Math.random() - 0.5) * spread + Math.sin(index) * 60
        };
    }
  };

  const getStatusColor = (status: StationNode['status']) => {
    switch (status) {
      case 'active': return '#00ff00';
      case 'inactive': return '#ffff00';
      case 'unreachable': return '#ff0000';
      default: return '#cccccc';
    }
  };

  const handleNodeClick = (node: StationNode) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
  };

  return (
    <div className={`mesh-network-css ${className}`} style={{ width, height, position: 'relative', backgroundColor: '#1a1a1a', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <select
          value={layoutMode}
          onChange={(e) => setLayoutMode(e.target.value as any)}
          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}
        >
          <option value="force-directed">Force Directed</option>
          <option value="geographic">Geographic</option>
          <option value="circular">Circular</option>
          <option value="grid">Grid</option>
        </select>
      </div>

      {/* Network visualization container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Connection lines (SVG overlay) */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
          {nodes.map((node, i) =>
            nodes.slice(i + 1).map((otherNode, j) => {
              const pos1 = calculateNodePosition(node, i);
              const pos2 = calculateNodePosition(otherNode, i + j + 1);

              // Only show connections between some nodes (simulated)
              if (Math.random() > 0.6) return null;

              return (
                <line
                  key={`${node.id}-${otherNode.id}`}
                  x1={pos1.x}
                  y1={pos1.y}
                  x2={pos2.x}
                  y2={pos2.y}
                  stroke="#00ff88"
                  strokeWidth="2"
                  opacity="0.6"
                  strokeDasharray={node.status === 'active' && otherNode.status === 'active' ? '' : '5,5'}
                />
              );
            })
          )}
        </svg>

        {/* Station nodes */}
        {nodes.map((node, index) => {
          const position = calculateNodePosition(node, index);
          const isSelected = selectedNode?.id === node.id;

          return (
            <div
              key={node.id}
              onClick={() => handleNodeClick(node)}
              style={{
                position: 'absolute',
                left: position.x - 15,
                top: position.y - 15,
                width: 30,
                height: 30,
                borderRadius: '50%',
                backgroundColor: getStatusColor(node.status),
                border: isSelected ? '3px solid #ffffff' : '2px solid #ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold',
                color: node.status === 'inactive' ? '#000' : '#000',
                boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.8)' : '0 2px 4px rgba(0,0,0,0.3)',
                transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.2s ease',
                zIndex: isSelected ? 10 : 2
              }}
              title={node.callsign}
            >
              {node.callsign.substring(0, 2)}
            </div>
          );
        })}

        {/* Callsign labels */}
        {nodes.map((node, index) => {
          const position = calculateNodePosition(node, index);

          return (
            <div
              key={`label-${node.id}`}
              style={{
                position: 'absolute',
                left: position.x - 25,
                top: position.y + 20,
                fontSize: '11px',
                color: '#ffffff',
                textAlign: 'center',
                width: 50,
                pointerEvents: 'none',
                zIndex: 3
              }}
            >
              {node.callsign}
            </div>
          );
        })}

        {/* Traffic flow animation (simple example) */}
        {nodes.length >= 2 && (
          <div
            style={{
              position: 'absolute',
              left: calculateNodePosition(nodes[0], 0).x,
              top: calculateNodePosition(nodes[0], 0).y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#ffff88',
              animation: 'traffic-flow 3s infinite linear',
              zIndex: 5
            }}
          />
        )}
      </div>

      {/* Station details panel */}
      {selectedNode && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 280,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: 15,
          borderRadius: 8,
          fontSize: 12,
          color: '#333',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Station Details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gap: 5 }}>
            <div><strong>Callsign:</strong> {selectedNode.callsign}</div>
            <div><strong>Status:</strong> <span style={{ color: getStatusColor(selectedNode.status) }}>●</span> {selectedNode.status}</div>
            <div><strong>Frequency:</strong> {(selectedNode.rfCharacteristics.frequency / 1000000).toFixed(3)} MHz</div>
            <div><strong>Signal:</strong> {selectedNode.rfCharacteristics.signalStrength.toFixed(1)} dBm</div>
            <div><strong>SNR:</strong> {selectedNode.rfCharacteristics.snr.toFixed(1)} dB</div>
            <div><strong>Equipment:</strong> {selectedNode.equipment.manufacturer} {selectedNode.equipment.model}</div>
            <div><strong>Power:</strong> {selectedNode.equipment.power}W</div>
            <div><strong>Packets Relayed:</strong> {selectedNode.metrics.packetsRelayed}</div>
            <div><strong>Data Transferred:</strong> {(selectedNode.metrics.bytesTransferred / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 10,
        borderRadius: 6,
        fontSize: 11,
        color: '#333',
        zIndex: 10
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 5 }}>Legend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#00ff00' }}></div>
          <span>Active</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffff00' }}></div>
          <span>Inactive</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff0000' }}></div>
          <span>Unreachable</span>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes traffic-flow {
          0% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(${nodes.length > 1 ? calculateNodePosition(nodes[1], 1).x - calculateNodePosition(nodes[0], 0).x : 100}px,
                                ${nodes.length > 1 ? calculateNodePosition(nodes[1], 1).y - calculateNodePosition(nodes[0], 0).y : 50}px);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        .mesh-network-css {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
      `}</style>
    </div>
  );
};