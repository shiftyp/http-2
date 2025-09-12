import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { RadioJSXCompiler } from '../lib/jsx-radio';

interface RemoteStation {
  callsign: string;
  gridSquare: string;
  lastSeen: number;
  signalStrength: number;
  content: RemoteContent[];
}

interface RemoteContent {
  path: string;
  title: string;
  type: 'page' | 'app' | 'data';
  size: number;
  lastModified: number;
  compressed: boolean;
}

const Browse: React.FC = () => {
  const [stations, setStations] = useState<RemoteStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<RemoteStation | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [receivedContent, setReceivedContent] = useState<string>('');

  useEffect(() => {
    // Listen for discovered stations
    const handleStationDiscovered = (event: CustomEvent) => {
      const station = event.detail as RemoteStation;
      setStations(prev => {
        const existing = prev.findIndex(s => s.callsign === station.callsign);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = station;
          return updated;
        }
        return [...prev, station];
      });
    };

    // Listen for received content
    const handleContentReceived = (event: CustomEvent) => {
      const { html, packet } = event.detail;
      setReceivedContent(html);
    };

    window.addEventListener('station-discovered', handleStationDiscovered as EventListener);
    window.addEventListener('http-data-received', handleContentReceived as EventListener);

    return () => {
      window.removeEventListener('station-discovered', handleStationDiscovered as EventListener);
      window.removeEventListener('http-data-received', handleContentReceived as EventListener);
    };
  }, []);

  const requestContent = async (station: RemoteStation, content: RemoteContent) => {
    setLoading(true);
    
    // Send request via mesh network
    const event = new CustomEvent('mesh-request', {
      detail: {
        destination: station.callsign,
        method: 'GET',
        path: content.path,
        headers: {
          'Accept': 'text/html',
          'X-Compression': 'jsx'
        }
      }
    });
    
    window.dispatchEvent(event);
    
    // Wait for response (handled by event listener)
    setTimeout(() => setLoading(false), 5000);
  };

  const filteredStations = stations.filter(s => 
    s.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.gridSquare.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Remote Stations</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Discovered Stations</h2>
              <Badge variant="info">{stations.length} stations</Badge>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search callsign or grid..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-4"
              />

              <div className="space-y-2">
                {filteredStations.length > 0 ? (
                  filteredStations.map(station => (
                    <div
                      key={station.callsign}
                      className={`
                        p-3 border rounded cursor-pointer transition-colors
                        ${selectedStation?.callsign === station.callsign 
                          ? 'border-blue-500 bg-blue-900/20' 
                          : 'border-gray-700 hover:border-gray-600'}
                      `}
                      onClick={() => setSelectedStation(station)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">{station.callsign}</div>
                          <div className="text-sm text-gray-400">{station.gridSquare}</div>
                        </div>
                        <Badge
                          variant={station.signalStrength > -90 ? 'success' : 'warning'}
                          size="sm"
                        >
                          {station.signalStrength} dBm
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last seen: {new Date(station.lastSeen).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {station.content.length} items available
                      </div>
                    </div>
                  ))
                ) : (
                  <Alert variant="info">
                    No stations discovered yet. Stations will appear as they broadcast beacons.
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedStation ? (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold">
                  Content from {selectedStation.callsign}
                </h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedStation.content.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border border-gray-700 rounded"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              item.type === 'page' ? 'info' :
                              item.type === 'app' ? 'success' : 'secondary'
                            }
                            size="sm"
                          >
                            {item.type}
                          </Badge>
                          <span className="font-mono text-sm">{item.path}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Size: {(item.size / 1024).toFixed(1)} KB
                          {item.compressed && ' (compressed)'}
                          | Modified: {new Date(item.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => requestContent(selectedStation, item)}
                        disabled={loading}
                      >
                        Fetch
                      </Button>
                    </div>
                  ))}
                </div>

                {selectedStation.content.length === 0 && (
                  <Alert variant="info">
                    No content available from this station yet.
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold">Select a Station</h2>
              </CardHeader>
              <CardContent>
                <Alert variant="info">
                  Select a station from the list to browse available content.
                </Alert>
              </CardContent>
            </Card>
          )}

          {receivedContent && (
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-xl font-bold">Received Content</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setReceivedContent('')}
                >
                  Clear
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border border-gray-700 rounded p-4 bg-gray-900">
                  <div dangerouslySetInnerHTML={{ __html: receivedContent }} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4">
          <Alert variant="info">
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Requesting content via mesh network...
            </div>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default Browse;