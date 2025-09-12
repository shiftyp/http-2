import React, { useState, useEffect, useRef } from 'react';
import { MeshNetwork, MeshNode, RoutingTableEntry } from '../lib/mesh-networking';
import { HTTPProtocol } from '../lib/http-protocol';
import { RadioControl } from '../lib/radio-control';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Table } from './ui/Table';
import { Toggle } from './ui/Toggle';
import { Alert } from './ui/Alert';

interface MeshNetworkProps {
  protocol: HTTPProtocol;
  radio: RadioControl;
  callsign: string;
}

export const MeshNetworkView: React.FC<MeshNetworkProps> = ({ protocol, radio, callsign }) => {
  const [mesh, setMesh] = useState<MeshNetwork | null>(null);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [routes, setRoutes] = useState<RoutingTableEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [relayEnabled, setRelayEnabled] = useState(true);
  const [storeEnabled, setStoreEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (protocol && radio && callsign) {
      const meshNetwork = new MeshNetwork(callsign, protocol, radio);
      setMesh(meshNetwork);

      // Update state periodically
      const interval = setInterval(() => {
        setNodes(meshNetwork.getNodes());
        setRoutes(meshNetwork.getRoutingTable());
        setStats(meshNetwork.getNetworkStats());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [protocol, radio, callsign]);

  useEffect(() => {
    if (canvasRef.current && nodes.length > 0) {
      drawNetworkTopology();
    }
  }, [nodes, routes]);

  const drawNetworkTopology = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'var(--color-background)';
    ctx.fillRect(0, 0, width, height);

    // Calculate node positions (force-directed layout)
    const nodePositions = calculateNodePositions(nodes, width, height);

    // Draw connections (routes)
    ctx.strokeStyle = 'var(--color-primary)';
    ctx.lineWidth = 1;
    
    for (const route of routes) {
      const fromPos = nodePositions.get(mesh?.getMyNode().address || '');
      const toPos = nodePositions.get(route.destination);
      
      if (fromPos && toPos) {
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        
        // Draw curved line for better visibility
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2 - 20;
        ctx.quadraticCurveTo(midX, midY, toPos.x, toPos.y);
        
        // Set opacity based on link quality
        ctx.globalAlpha = route.linkQuality / 100;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Draw arrow
        const angle = Math.atan2(toPos.y - midY, toPos.x - midX);
        ctx.save();
        ctx.translate(toPos.x, toPos.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(0, 0);
        ctx.lineTo(-10, 5);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw nodes
    for (const [address, pos] of nodePositions) {
      const node = nodes.find(n => n.address === address) || mesh?.getMyNode();
      if (!node) continue;

      const isMyNode = node.address === mesh?.getMyNode().address;
      
      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isMyNode ? 15 : 10, 0, Math.PI * 2);
      ctx.fillStyle = isMyNode ? 'var(--color-accent)' : 'var(--color-primary)';
      ctx.fill();
      
      if (isMyNode) {
        ctx.strokeStyle = 'var(--color-text)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node label
      ctx.fillStyle = 'var(--color-text)';
      ctx.font = '12px var(--font-mono)';
      ctx.textAlign = 'center';
      ctx.fillText(node.callsign, pos.x, pos.y - 20);
      
      // Signal strength indicator
      if (node.snr > 0) {
        ctx.font = '10px var(--font-mono)';
        ctx.fillStyle = node.snr > 10 ? 'var(--color-success)' : 'var(--color-warning)';
        ctx.fillText(`${node.snr.toFixed(1)}dB`, pos.x, pos.y + 30);
      }
    }

    // Draw statistics
    ctx.fillStyle = 'var(--color-text-muted)';
    ctx.font = '10px var(--font-mono)';
    ctx.textAlign = 'left';
    ctx.fillText(`Nodes: ${nodes.length + 1}`, 10, 20);
    ctx.fillText(`Routes: ${routes.length}`, 10, 35);
    if (stats) {
      ctx.fillText(`Relayed: ${stats.metrics.packetsRelayed}`, 10, 50);
      ctx.fillText(`Queued: ${stats.queuedMessages}`, 10, 65);
    }
  };

  const calculateNodePositions = (
    nodes: MeshNode[],
    width: number,
    height: number
  ): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>();
    
    // Place my node at center
    const myNode = mesh?.getMyNode();
    if (myNode) {
      positions.set(myNode.address, { x: width / 2, y: height / 2 });
    }

    // Place other nodes in a circle around center
    const angleStep = (Math.PI * 2) / nodes.length;
    const radius = Math.min(width, height) * 0.3;
    
    nodes.forEach((node, i) => {
      const angle = angleStep * i;
      const x = width / 2 + Math.cos(angle) * radius;
      const y = height / 2 + Math.sin(angle) * radius;
      positions.set(node.address, { x, y });
    });

    // Also add route destinations that might not be in nodes list
    for (const route of routes) {
      if (!positions.has(route.destination)) {
        const angle = Math.random() * Math.PI * 2;
        const r = radius * (0.8 + Math.random() * 0.4);
        const x = width / 2 + Math.cos(angle) * r;
        const y = height / 2 + Math.sin(angle) * r;
        positions.set(route.destination, { x, y });
      }
    }

    return positions;
  };

  const handleRelayToggle = (enabled: boolean) => {
    setRelayEnabled(enabled);
    mesh?.setRelayEnabled(enabled);
  };

  const handleStoreToggle = (enabled: boolean) => {
    setStoreEnabled(enabled);
    mesh?.setStoreEnabled(enabled);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Mesh Network Topology</h2>
          <Badge variant="info">
            {nodes.length + 1} nodes
          </Badge>
        </CardHeader>
        <CardContent>
          <canvas
            ref={canvasRef}
            width={500}
            height={400}
            className="w-full bg-surface border border-gray-700 rounded"
            style={{ maxHeight: '400px' }}
          />
          
          <div className="mt-4 flex gap-4">
            <div className="flex items-center gap-2">
              <Toggle
                checked={relayEnabled}
                onChange={handleRelayToggle}
                label="Relay Packets"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Toggle
                checked={storeEnabled}
                onChange={handleStoreToggle}
                label="Store & Forward"
              />
            </div>
          </div>

          {stats && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Packets Relayed:</span>
                <span className="ml-2 font-mono">{stats.metrics.packetsRelayed}</span>
              </div>
              <div>
                <span className="text-gray-400">Packets Dropped:</span>
                <span className="ml-2 font-mono">{stats.metrics.packetsDropped}</span>
              </div>
              <div>
                <span className="text-gray-400">Bytes Transferred:</span>
                <span className="ml-2 font-mono">{(stats.metrics.bytesTransferred / 1024).toFixed(1)} KB</span>
              </div>
              <div>
                <span className="text-gray-400">Queued Messages:</span>
                <span className="ml-2 font-mono">{stats.queuedMessages}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Routing Table</h2>
          <Badge variant="success">
            {routes.length} routes
          </Badge>
        </CardHeader>
        <CardContent>
          {routes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2">Destination</th>
                    <th className="text-left py-2">Next Hop</th>
                    <th className="text-center py-2">Hops</th>
                    <th className="text-center py-2">Quality</th>
                    <th className="text-center py-2">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      <td className="py-2 font-mono text-xs">
                        {route.destination.substring(0, 16)}...
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {route.nextHop.substring(0, 16)}...
                      </td>
                      <td className="text-center py-2">{route.hopCount}</td>
                      <td className="text-center py-2">
                        <Badge
                          variant={
                            route.linkQuality > 80 ? 'success' :
                            route.linkQuality > 50 ? 'warning' : 'danger'
                          }
                          size="sm"
                        >
                          {route.linkQuality}%
                        </Badge>
                      </td>
                      <td className="text-center py-2 text-gray-400">
                        {Math.floor((Date.now() - route.lastUpdated) / 1000)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert variant="info">
              No routes discovered yet. Routes will appear as nodes join the mesh network.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <h2 className="text-xl font-bold">Network Nodes</h2>
        </CardHeader>
        <CardContent>
          {nodes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {nodes.map((node, i) => (
                <div key={i} className="border border-gray-700 rounded p-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">{node.callsign}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        {node.address.substring(0, 20)}...
                      </div>
                    </div>
                    <Badge
                      variant={node.snr > 10 ? 'success' : node.snr > 0 ? 'warning' : 'danger'}
                      size="sm"
                    >
                      {node.snr.toFixed(1)}dB
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex gap-2">
                      {node.capabilities.relay && <Badge size="xs">Relay</Badge>}
                      {node.capabilities.store && <Badge size="xs">Store</Badge>}
                      {node.capabilities.gateway && <Badge size="xs">Gateway</Badge>}
                    </div>
                    <div className="text-gray-400">
                      Hops: {node.hops} | Last: {Math.floor((Date.now() - node.lastSeen) / 1000)}s ago
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert variant="info">
              Searching for mesh nodes... Nodes will appear as beacons are received.
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};