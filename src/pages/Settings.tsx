import React, { useState, useEffect } from 'react';
import { ThemeSelector } from '../components/ThemeSelector';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Toggle } from '../components/ui/Toggle';

const Settings: React.FC = () => {
  const [callsign, setCallsign] = useState(localStorage.getItem('callsign') || '');
  const [gridSquare, setGridSquare] = useState(localStorage.getItem('gridSquare') || '');
  const [realName, setRealName] = useState(localStorage.getItem('realName') || '');
  const [saved, setSaved] = useState(false);

  // Feature toggles
  const [meshEnabled, setMeshEnabled] = useState(
    localStorage.getItem('meshEnabled') === 'true'
  );
  const [beaconEnabled, setBeaconEnabled] = useState(
    localStorage.getItem('beaconEnabled') === 'true'
  );
  const [relayEnabled, setRelayEnabled] = useState(
    localStorage.getItem('relayEnabled') === 'true'
  );
  const [compressionEnabled, setCompressionEnabled] = useState(
    localStorage.getItem('compressionEnabled') !== 'false'
  );

  const handleSave = () => {
    localStorage.setItem('callsign', callsign.toUpperCase());
    localStorage.setItem('gridSquare', gridSquare.toUpperCase());
    localStorage.setItem('realName', realName);
    localStorage.setItem('meshEnabled', meshEnabled.toString());
    localStorage.setItem('beaconEnabled', beaconEnabled.toString());
    localStorage.setItem('relayEnabled', relayEnabled.toString());
    localStorage.setItem('compressionEnabled', compressionEnabled.toString());
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const validateCallsign = (call: string): boolean => {
    // Basic callsign validation
    const regex = /^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]$/i;
    return regex.test(call);
  };

  const validateGridSquare = (grid: string): boolean => {
    // Maidenhead grid square validation
    const regex = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i;
    return regex.test(grid);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Station Information</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                label="Callsign"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                placeholder="W1AW"
                error={callsign && !validateCallsign(callsign) ? 'Invalid callsign format' : ''}
              />
              
              <Input
                label="Grid Square"
                value={gridSquare}
                onChange={(e) => setGridSquare(e.target.value.toUpperCase())}
                placeholder="FN31"
                error={gridSquare && !validateGridSquare(gridSquare) ? 'Invalid grid square format' : ''}
              />
              
              <Input
                label="Real Name"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="John Doe"
              />

              <Button
                onClick={handleSave}
                variant="primary"
                fullWidth
                disabled={!callsign || !validateCallsign(callsign)}
              >
                Save Station Info
              </Button>

              {saved && (
                <Alert variant="success">
                  Settings saved successfully!
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Network Settings</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Toggle
                checked={meshEnabled}
                onChange={(checked) => {
                  setMeshEnabled(checked);
                  localStorage.setItem('meshEnabled', checked.toString());
                }}
                label="Enable Mesh Networking"
              />
              
              <Toggle
                checked={beaconEnabled}
                onChange={(checked) => {
                  setBeaconEnabled(checked);
                  localStorage.setItem('beaconEnabled', checked.toString());
                }}
                label="Automatic Beacon Transmission"
              />
              
              <Toggle
                checked={relayEnabled}
                onChange={(checked) => {
                  setRelayEnabled(checked);
                  localStorage.setItem('relayEnabled', checked.toString());
                }}
                label="Relay Packets for Others"
              />
              
              <Toggle
                checked={compressionEnabled}
                onChange={(checked) => {
                  setCompressionEnabled(checked);
                  localStorage.setItem('compressionEnabled', checked.toString());
                }}
                label="Enable Compression"
              />

              <Alert variant="info">
                These settings affect how your station participates in the mesh network.
              </Alert>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ThemeSelector />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-xl font-bold">About HTTP-over-Radio</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-400">
              <p>
                HTTP-over-Radio enables web content transmission over amateur radio frequencies
                using QPSK/16-QAM modulation with adaptive data rates from 750 bps to 8.4 kbps.
              </p>
              <p>
                Features include mesh networking, JSX compression, delta updates, and automatic
                route discovery through multiple stations.
              </p>
              <div className="mt-4">
                <h3 className="font-bold text-white">Frequency Allocations:</h3>
                <ul className="list-disc list-inside mt-2">
                  <li>80m: 3.583-3.588 MHz</li>
                  <li>40m: 7.043-7.048 MHz</li>
                  <li>20m: 14.078-14.083 MHz (Primary)</li>
                  <li>15m: 21.078-21.083 MHz</li>
                  <li>10m: 28.078-28.083 MHz</li>
                </ul>
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-white">Compliance:</h3>
                <p>Complies with FCC Part 97 rules (2024) - 2.8 kHz bandwidth limit, no symbol rate restrictions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;