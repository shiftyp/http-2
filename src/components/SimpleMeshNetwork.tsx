import React, { useState, useEffect } from 'react';
import { MeshNode, RoutingTableEntry } from '../lib/mesh-networking';

interface Station {
  id: string;
  callsign: string;
  status: 'active' | 'inactive' | 'unreachable';
  frequency: string;
  signal: number;
  snr: number;
  equipment: string;
  connections: string[];
}

interface SimpleMeshNetworkProps {
  layoutMode?: 'grid' | 'circular' | 'list';
  nodes?: MeshNode[];
  routes?: RoutingTableEntry[];
  myCallsign?: string;
}

export const SimpleMeshNetwork: React.FC<SimpleMeshNetworkProps> = ({
  layoutMode = 'grid',
  nodes = [],
  routes = [],
  myCallsign = 'LOCAL'
}) => {
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [currentLayout, setCurrentLayout] = useState(layoutMode);
  const [stations, setStations] = useState<Station[]>([]);

  // Convert mesh network data to station format
  useEffect(() => {
    const convertedStations: Station[] = [];

    // Add my node first
    convertedStations.push({
      id: myCallsign,
      callsign: myCallsign,
      status: 'active',
      frequency: '14.230 MHz',
      signal: -50,
      snr: 25,
      equipment: 'Local Station',
      connections: routes.map(r => extractCallsign(r.destination)).filter(Boolean)
    });

    // Add discovered nodes
    nodes.forEach(node => {
      const connections = routes
        .filter(r => r.destination === node.address)
        .map(r => extractCallsign(r.nextHop))
        .filter(Boolean);

      convertedStations.push({
        id: node.callsign,
        callsign: node.callsign,
        status: getNodeStatus(node),
        frequency: '14.230 MHz',
        signal: node.signalStrength,
        snr: node.snr,
        equipment: 'Remote Station',
        connections
      });
    });

    // If no real data, show demo stations
    if (convertedStations.length <= 1) {
      convertedStations.push(
        {
          id: 'KA1ABC',
          callsign: 'KA1ABC',
          status: 'active',
          frequency: '14.230 MHz',
          signal: -65,
          snr: 18,
          equipment: 'Icom IC-7300',
          connections: ['KB2DEF']
        },
        {
          id: 'KB2DEF',
          callsign: 'KB2DEF',
          status: 'active',
          frequency: '14.230 MHz',
          signal: -72,
          snr: 12,
          equipment: 'Yaesu FT-991A',
          connections: ['KA1ABC']
        }
      );
    }

    setStations(convertedStations);
  }, [nodes, routes, myCallsign]);

  const getNodeStatus = (node: MeshNode): 'active' | 'inactive' | 'unreachable' => {
    const age = Date.now() - node.lastSeen;
    if (age < 60000) return 'active';
    if (age < 300000) return 'inactive';
    return 'unreachable';
  };

  const extractCallsign = (address: string): string => {
    // Extract callsign from mesh address
    return address.split('-')[0] || address.substring(0, 6);
  };

  const getStatusColor = (status: Station['status']) => {
    switch (status) {
      case 'active': return '#22c55e'; // green-500
      case 'inactive': return '#eab308'; // yellow-500
      case 'unreachable': return '#ef4444'; // red-500
    }
  };

  const isConnected = (station1: string, station2: string) => {
    const s1 = stations.find(s => s.id === station1);
    return s1?.connections.includes(station2) || false;
  };

  const renderConnections = () => {
    if (currentLayout !== 'grid') return null;

    return (
      <div className="connections-overlay">
        {stations.map(station =>
          station.connections.map(connId => {
            const connStation = stations.find(s => s.id === connId);
            if (!connStation) return null;

            return (
              <div
                key={`${station.id}-${connId}`}
                className={`connection-line ${station.status === 'active' && connStation.status === 'active' ? 'active' : 'inactive'}`}
                data-from={station.id}
                data-to={connId}
              />
            );
          })
        )}
      </div>
    );
  };

  const renderStation = (station: Station, index: number) => {
    const isSelected = selectedStation === station.id;

    return (
      <div
        key={station.id}
        className={`station ${station.status} ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedStation(isSelected ? null : station.id)}
        style={{ '--status-color': getStatusColor(station.status) } as React.CSSProperties}
      >
        <div className="station-indicator" />
        <div className="station-callsign">{station.callsign}</div>
        <div className="station-frequency">{station.frequency}</div>

        {isSelected && (
          <div className="station-details">
            <div className="detail-row">
              <span>Signal:</span>
              <span>{station.signal} dBm</span>
            </div>
            <div className="detail-row">
              <span>SNR:</span>
              <span>{station.snr} dB</span>
            </div>
            <div className="detail-row">
              <span>Equipment:</span>
              <span>{station.equipment}</span>
            </div>
            <div className="detail-row">
              <span>Connections:</span>
              <span>{station.connections.join(', ')}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="simple-mesh-network">
      {/* Controls */}
      <div className="controls">
        <select
          value={currentLayout}
          onChange={(e) => setCurrentLayout(e.target.value as any)}
          className="layout-selector"
        >
          <option value="grid">Grid Layout</option>
          <option value="circular">Circular Layout</option>
          <option value="list">List Layout</option>
        </select>

        <div className="status-legend">
          <div className="legend-item">
            <div className="legend-dot active"></div>
            <span>Active</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot inactive"></div>
            <span>Inactive</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot unreachable"></div>
            <span>Unreachable</span>
          </div>
        </div>
      </div>

      {/* Network Visualization */}
      <div className={`network-container ${currentLayout}`}>
        {renderConnections()}
        {stations.map(renderStation)}
      </div>

      <style>{`
        .simple-mesh-network {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 12px;
          padding: 20px;
          color: white;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 500px;
        }

        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .layout-selector {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: white;
          padding: 8px 12px;
          font-size: 14px;
        }

        .status-legend {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .legend-dot.active { background: #22c55e; }
        .legend-dot.inactive { background: #eab308; }
        .legend-dot.unreachable { background: #ef4444; }

        .network-container {
          position: relative;
          min-height: 400px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 20px;
        }

        .network-container.grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 30px;
          align-items: center;
          justify-items: center;
        }

        .network-container.circular {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .network-container.circular .station {
          position: absolute;
        }

        .network-container.circular .station:nth-child(1) {
          transform: translate(0, -120px);
        }

        .network-container.circular .station:nth-child(2) {
          transform: translate(120px, 0);
        }

        .network-container.circular .station:nth-child(3) {
          transform: translate(0, 120px);
        }

        .network-container.circular .station:nth-child(4) {
          transform: translate(-120px, 0);
        }

        .network-container.list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .station {
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
          border: 2px solid var(--status-color);
          border-radius: 12px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          min-width: 160px;
          text-align: center;
        }

        .station:hover {
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08));
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }

        .station.selected {
          transform: scale(1.05);
          box-shadow: 0 0 20px var(--status-color);
          z-index: 10;
        }

        .station-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--status-color);
          margin: 0 auto 8px;
          box-shadow: 0 0 10px var(--status-color);
          animation: pulse 2s infinite;
        }

        .station.active .station-indicator {
          animation: pulse 1.5s infinite;
        }

        .station.inactive .station-indicator {
          animation: pulse 3s infinite;
        }

        .station.unreachable .station-indicator {
          animation: none;
          opacity: 0.6;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 5px var(--status-color); }
          50% { box-shadow: 0 0 20px var(--status-color), 0 0 30px var(--status-color); }
          100% { box-shadow: 0 0 5px var(--status-color); }
        }

        .station-callsign {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .station-frequency {
          font-size: 12px;
          opacity: 0.8;
          margin-bottom: 10px;
        }

        .station-details {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          padding: 10px;
          margin-top: 10px;
          text-align: left;
          font-size: 11px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
        }

        .detail-row span:first-child {
          font-weight: 500;
          opacity: 0.8;
        }

        .connections-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 1;
        }

        .connection-line {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, #22c55e, transparent, #22c55e);
          transform-origin: left center;
          opacity: 0.6;
        }

        .connection-line.inactive {
          background: linear-gradient(90deg, #64748b, transparent, #64748b);
          opacity: 0.3;
        }

        /* Simple connection lines for grid layout */
        .network-container.grid .connection-line[data-from="KA1ABC"][data-to="KB2DEF"] {
          top: 50%;
          left: 50%;
          width: 100px;
          transform: translate(0, -50%);
        }

        .network-container.grid .connection-line[data-from="KB2DEF"][data-to="KC3GHI"] {
          top: 50%;
          left: 50%;
          width: 100px;
          transform: translate(0, 50%);
        }

        @media (max-width: 768px) {
          .network-container.grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .controls {
            flex-direction: column;
            align-items: stretch;
          }

          .status-legend {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};