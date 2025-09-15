import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { db } from '../lib/database';

interface DashboardStats {
  pagesCount: number;
  serverAppsCount: number;
  meshNodesCount: number;
  messagesCount: number;
  qsoCount: number;
  cacheSize: number;
  lastActivity: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    pagesCount: 0,
    serverAppsCount: 0,
    meshNodesCount: 0,
    messagesCount: 0,
    qsoCount: 0,
    cacheSize: 0,
    lastActivity: 0
  });
  
  const [recentQSOs, setRecentQSOs] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [activeMeshNodes, setActiveMeshNodes] = useState<any[]>([]);
  const [callsign, setCallsign] = useState(localStorage.getItem('callsign') || '');

  useEffect(() => {
    loadDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load stats
      const [
        pages,
        serverApps,
        meshNodes,
        messages,
        qsoLog,
        cacheSize
      ] = await Promise.all([
        db.getAllPages(),
        db.getAllServerApps(),
        db.getActiveMeshNodes(),
        db.getMessages({ limit: 100 }),
        db.getQSOLog({ limit: 100 }),
        db.getCacheSize()
      ]);

      setStats({
        pagesCount: pages.length,
        serverAppsCount: serverApps.length,
        meshNodesCount: meshNodes.length,
        messagesCount: messages.length,
        qsoCount: qsoLog.length,
        cacheSize,
        lastActivity: Date.now()
      });

      // Load recent data
      setRecentQSOs(qsoLog.slice(0, 5));
      setRecentMessages(messages.slice(0, 5));
      setActiveMeshNodes(meshNodes.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!callsign) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Welcome to HTTP-over-Radio</h1>
          </CardHeader>
          <CardContent>
            <Alert variant="warning">
              Please configure your callsign in <Link to="/settings" className="underline">Settings</Link> to get started.
            </Alert>
            
            <div className="mt-6 space-y-4">
              <h2 className="text-xl font-bold">Quick Start Guide</h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-400">
                <li>Go to Settings and enter your amateur radio callsign</li>
                <li>Connect your radio using the Radio Operations page</li>
                <li>Create content using the Visual Page Builder</li>
                <li>Browse content from other stations</li>
                <li>Join the mesh network to relay content</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400">Station {callsign}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pagesCount}</div>
            <div className="text-sm text-gray-400">Pages</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{stats.serverAppsCount}</div>
            <div className="text-sm text-gray-400">Server Apps</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{stats.meshNodesCount}</div>
            <div className="text-sm text-gray-400">Mesh Nodes</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesCount}</div>
            <div className="text-sm text-gray-400">Messages</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{stats.qsoCount}</div>
            <div className="text-sm text-gray-400">QSOs</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.cacheSize)}</div>
            <div className="text-sm text-gray-400">Cache</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent QSOs */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Recent QSOs</h2>
            <Link to="/database">
              <Button size="sm" variant="secondary">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentQSOs.length > 0 ? (
              <div className="space-y-2">
                {recentQSOs.map((qso, i) => (
                  <div key={i} className="flex justify-between items-center p-2 border border-gray-700 rounded">
                    <div>
                      <div className="font-bold">{qso.callsign}</div>
                      <div className="text-xs text-gray-400">
                        {qso.frequency} MHz | {qso.mode}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(new Date(qso.date).getTime())}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert variant="info">No QSOs logged yet</Alert>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Recent Messages</h2>
            <Badge variant="info">{recentMessages.filter(m => m.status === 'unread').length} unread</Badge>
          </CardHeader>
          <CardContent>
            {recentMessages.length > 0 ? (
              <div className="space-y-2">
                {recentMessages.map((msg, i) => (
                  <div key={i} className="flex justify-between items-center p-2 border border-gray-700 rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{msg.from}</span>
                        {msg.status === 'unread' && (
                          <Badge variant="warning" size="xs">New</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {msg.content?.substring(0, 50)}...
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(msg.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert variant="info">No messages yet</Alert>
            )}
          </CardContent>
        </Card>

        {/* Active Mesh Nodes */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Active Mesh Nodes</h2>
            <Link to="/radio">
              <Button size="sm" variant="secondary">View Network</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activeMeshNodes.length > 0 ? (
              <div className="space-y-2">
                {activeMeshNodes.map((node, i) => (
                  <div key={i} className="flex justify-between items-center p-2 border border-gray-700 rounded">
                    <div>
                      <div className="font-bold">{node.callsign}</div>
                      <div className="text-xs text-gray-400">
                        {node.gridSquare || 'Unknown location'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={node.signalStrength > -80 ? 'success' : 'warning'}
                        size="sm"
                      >
                        {node.signalStrength} dBm
                      </Badge>
                      <div className="text-xs text-gray-500">
                        {formatTimeAgo(node.lastSeen)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert variant="info">No active mesh nodes detected</Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-xl font-bold">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/radio">
              <Button variant="primary" fullWidth>
                Connect Radio
              </Button>
            </Link>
            <Link to="/content">
              <Button variant="primary" fullWidth>
                Create Page
              </Button>
            </Link>
            <Link to="/browse">
              <Button variant="primary" fullWidth>
                Browse Stations
              </Button>
            </Link>
            <Link to="/database">
              <Button variant="primary" fullWidth>
                View Database
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-xl font-bold">System Status</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Service Worker</span>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">IndexedDB</span>
              <Badge variant="success">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Web Serial API</span>
              <Badge variant={'serial' in navigator ? 'success' : 'danger'}>
                {'serial' in navigator ? 'Available' : 'Not Available'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Web Audio API</span>
              <Badge variant="success">Available</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Compression</span>
              <Badge variant={localStorage.getItem('compressionEnabled') !== 'false' ? 'success' : 'warning'}>
                {localStorage.getItem('compressionEnabled') !== 'false' ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Mesh Network</span>
              <Badge variant={localStorage.getItem('meshEnabled') === 'true' ? 'success' : 'warning'}>
                {localStorage.getItem('meshEnabled') === 'true' ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;