import React, { useState, useRef } from 'react';
import { RadioControlPanel } from '../components/RadioControl';
import { MeshNetworkView } from '../components/MeshNetwork';
import { HTTPProtocol } from '../lib/http-protocol';
import { RadioControl } from '../lib/radio-control';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';

const RadioOps: React.FC = () => {
  const [callsign, setCallsign] = useState(localStorage.getItem('callsign') || '');
  const protocolRef = useRef<HTTPProtocol | null>(null);
  const radioRef = useRef<RadioControl | null>(null);

  // These would be passed from RadioControlPanel after connection
  const handleRadioConnect = (protocol: HTTPProtocol, radio: RadioControl) => {
    protocolRef.current = protocol;
    radioRef.current = radio;
  };

  if (!callsign) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Radio Operations</h1>
          </CardHeader>
          <CardContent>
            <Alert variant="warning">
              Please set your callsign in Settings before using Radio Operations.
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Radio Operations</h1>
      
      <div className="space-y-6">
        <RadioControlPanel />
        
        {protocolRef.current && radioRef.current && (
          <MeshNetworkView
            protocol={protocolRef.current}
            radio={radioRef.current}
            callsign={callsign}
          />
        )}
      </div>
    </div>
  );
};

export default RadioOps;