import React, { useState, useEffect, useRef } from 'react';
import { RadioControl } from '../lib/radio-control';
import { QPSKModem } from '../lib/qpsk-modem';
import { HTTPProtocol } from '../lib/http-protocol';
import { RadioJSXCompiler } from '../lib/jsx-radio';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';

interface RadioStatus {
  connected: boolean;
  frequency: number;
  mode: string;
  power: number;
  swr: number;
  ptt: boolean;
  snr: number;
  afc: number;
  dataRate: string;
}

export const RadioControlPanel: React.FC = () => {
  const [status, setStatus] = useState<RadioStatus>({
    connected: false,
    frequency: 14205000,
    mode: 'USB',
    power: 100,
    swr: 1.5,
    ptt: false,
    snr: 0,
    afc: 0,
    dataRate: 'HTTP-4800'
  });

  const [selectedRadio, setSelectedRadio] = useState<string>('icom');
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [transmitting, setTransmitting] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [waterfall, setWaterfall] = useState<number[][]>([]);
  
  const radioRef = useRef<RadioControl | null>(null);
  const modemRef = useRef<QPSKModem | null>(null);
  const protocolRef = useRef<HTTPProtocol | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Check for Web Serial API support
    if ('serial' in navigator) {
      navigator.serial.getPorts().then(setPorts);
    }
  }, []);

  const handleConnect = async () => {
    if (status.connected) {
      await handleDisconnect();
      return;
    }

    try {
      // Initialize radio control
      radioRef.current = new RadioControl({
        type: selectedRadio as any,
        baudRate: selectedRadio === 'icom' ? 19200 : 4800,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      await radioRef.current.connect();
      
      // Initialize modem
      modemRef.current = new QPSKModem({
        mode: status.dataRate as any,
        sampleRate: 48000,
        fftSize: 2048
      });

      await modemRef.current.init();

      // Initialize protocol
      protocolRef.current = new HTTPProtocol({
        mode: status.dataRate,
        sampleRate: 48000,
        fftSize: 2048
      });

      setStatus(prev => ({ ...prev, connected: true }));
      
      // Start monitoring
      startMonitoring();
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to radio. Please check connections.');
    }
  };

  const handleDisconnect = async () => {
    if (radioRef.current) {
      await radioRef.current.disconnect();
      radioRef.current = null;
    }

    if (modemRef.current) {
      modemRef.current.stopReceive();
      modemRef.current = null;
    }

    setStatus(prev => ({ ...prev, connected: false }));
    setReceiving(false);
    setTransmitting(false);
  };

  const startMonitoring = () => {
    if (!radioRef.current) return;

    // Poll radio status
    const pollInterval = setInterval(async () => {
      if (!radioRef.current) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const freq = await radioRef.current.getFrequency();
        const mode = await radioRef.current.getMode();
        const power = await radioRef.current.getPower();
        const swr = await radioRef.current.getSWR();

        setStatus(prev => ({
          ...prev,
          frequency: freq,
          mode,
          power,
          swr
        }));
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);

    // Update SNR and AFC from modem
    if (modemRef.current) {
      const snrInterval = setInterval(() => {
        if (!modemRef.current) {
          clearInterval(snrInterval);
          return;
        }

        setStatus(prev => ({
          ...prev,
          snr: modemRef.current!.getSNR(),
          afc: modemRef.current!.getAFC()
        }));

        // Auto-select best mode based on SNR
        const bestMode = modemRef.current.selectBestMode();
        if (bestMode !== status.dataRate) {
          setStatus(prev => ({ ...prev, dataRate: bestMode }));
        }
      }, 500);
    }
  };

  const handleFrequencyChange = async (freq: number) => {
    if (!radioRef.current) return;
    
    try {
      await radioRef.current.setFrequency(freq);
      setStatus(prev => ({ ...prev, frequency: freq }));
    } catch (error) {
      console.error('Failed to set frequency:', error);
    }
  };

  const handleModeChange = async (mode: string) => {
    if (!radioRef.current) return;
    
    try {
      await radioRef.current.setMode(mode as any);
      setStatus(prev => ({ ...prev, mode }));
    } catch (error) {
      console.error('Failed to set mode:', error);
    }
  };

  const handleStartReceive = () => {
    if (!modemRef.current || !protocolRef.current) return;

    setReceiving(true);
    
    protocolRef.current.startReceive((packet) => {
      console.log('Received packet:', packet);
      
      // Handle received data
      if (packet.type === 'response' || packet.type === 'delta') {
        const compiler = new RadioJSXCompiler();
        const html = compiler.decompile(packet.payload);
        
        // Update UI with received content
        const event = new CustomEvent('http-data-received', {
          detail: { html, packet }
        });
        window.dispatchEvent(event);
      }
    });

    // Start waterfall display
    startWaterfall();
  };

  const handleStopReceive = () => {
    if (modemRef.current) {
      modemRef.current.stopReceive();
    }
    setReceiving(false);
  };

  const handleTransmit = async (data: string) => {
    if (!modemRef.current || !radioRef.current) return;

    setTransmitting(true);
    
    try {
      // Enable PTT
      await radioRef.current.setPTT(true);
      
      // Wait for TX to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Transmit data
      const encoded = new TextEncoder().encode(data);
      await modemRef.current.transmit(encoded);
      
      // Disable PTT
      await radioRef.current.setPTT(false);
    } catch (error) {
      console.error('Transmission error:', error);
    } finally {
      setTransmitting(false);
    }
  };

  const startWaterfall = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Create gradient for waterfall colors
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.25, '#0000ff');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(0.75, '#ffff00');
    gradient.addColorStop(1, '#ff0000');

    const animateWaterfall = () => {
      if (!receiving) return;

      // Shift existing image up
      const imageData = ctx.getImageData(0, 1, width, height - 1);
      ctx.putImageData(imageData, 0, 0);

      // Draw new line at bottom
      if (modemRef.current && 'analyser' in modemRef.current) {
        const analyser = (modemRef.current as any).analyser;
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);

        for (let i = 0; i < width; i++) {
          const index = Math.floor(i * freqData.length / width);
          const value = freqData[index] / 255;
          
          const color = `hsl(${240 - value * 240}, 100%, ${value * 50}%)`;
          ctx.fillStyle = color;
          ctx.fillRect(i, height - 1, 1, 1);
        }
      }

      requestAnimationFrame(animateWaterfall);
    };

    animateWaterfall();
  };

  const formatFrequency = (freq: number): string => {
    return (freq / 1000000).toFixed(6) + ' MHz';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Radio Control</h2>
          <Badge variant={status.connected ? 'success' : 'danger'}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!status.connected && (
              <>
                <Select
                  label="Radio Type"
                  value={selectedRadio}
                  onChange={(e) => setSelectedRadio(e.target.value)}
                  options={[
                    { value: 'icom', label: 'Icom' },
                    { value: 'yaesu', label: 'Yaesu' },
                    { value: 'kenwood', label: 'Kenwood' },
                    { value: 'flex', label: 'Flex (SmartSDR CAT)' }
                  ]}
                />
                
                <Select
                  label="Serial Port"
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  options={ports.map(p => ({
                    value: p.toString(),
                    label: `COM${p}` // Simplified
                  }))}
                />
              </>
            )}

            <Button 
              onClick={handleConnect}
              variant={status.connected ? 'danger' : 'primary'}
              fullWidth
            >
              {status.connected ? 'Disconnect' : 'Connect'}
            </Button>

            {status.connected && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-gray-400">Frequency</label>
                    <div className="text-lg font-mono text-green-400">
                      {formatFrequency(status.frequency)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">Mode</label>
                    <div className="text-lg font-mono text-green-400">
                      {status.mode}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">Power</label>
                    <div className="text-lg font-mono text-green-400">
                      {status.power}W
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">SWR</label>
                    <div className={`text-lg font-mono ${status.swr > 2 ? 'text-red-400' : 'text-green-400'}`}>
                      {status.swr.toFixed(1)}:1
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={status.frequency}
                    onChange={(e) => handleFrequencyChange(Number(e.target.value))}
                    step={100}
                    label="QSY Frequency (Hz)"
                  />
                  
                  <Select
                    value={status.mode}
                    onChange={(e) => handleModeChange(e.target.value)}
                    options={[
                      { value: 'USB', label: 'USB' },
                      { value: 'LSB', label: 'LSB' },
                      { value: 'DATA-U', label: 'DATA-U' }
                    ]}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Digital Mode</h2>
          <Badge variant="info">{status.dataRate}</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-gray-400">SNR</label>
                <div className={`text-lg font-mono ${status.snr > 10 ? 'text-green-400' : status.snr > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {status.snr.toFixed(1)} dB
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400">AFC</label>
                <div className="text-lg font-mono text-cyan-400">
                  {status.afc > 0 ? '+' : ''}{status.afc.toFixed(1)} Hz
                </div>
              </div>
            </div>

            <Select
              label="Data Rate Mode"
              value={status.dataRate}
              onChange={(e) => setStatus(prev => ({ ...prev, dataRate: e.target.value }))}
              options={[
                { value: 'HTTP-1000', label: 'HTTP-1000 (Narrow, 750 bps)' },
                { value: 'HTTP-4800', label: 'HTTP-4800 (Standard, 3.6 kbps)' },
                { value: 'HTTP-5600', label: 'HTTP-5600 (Wide, 4.2 kbps)' },
                { value: 'HTTP-11200', label: 'HTTP-11200 (16-QAM, 8.4 kbps)' }
              ]}
              disabled={!status.connected}
            />

            <div className="flex gap-2">
              <Button
                onClick={receiving ? handleStopReceive : handleStartReceive}
                variant={receiving ? 'danger' : 'success'}
                disabled={!status.connected || transmitting}
              >
                {receiving ? 'Stop RX' : 'Start RX'}
              </Button>
              
              <Button
                onClick={() => handleTransmit('CQ CQ CQ de ' + localStorage.getItem('callsign'))}
                variant="warning"
                disabled={!status.connected || receiving || transmitting}
              >
                {transmitting ? 'TX...' : 'Send CQ'}
              </Button>
            </div>

            {transmitting && (
              <Alert variant="warning">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></div>
                  Transmitting...
                </div>
              </Alert>
            )}

            {receiving && (
              <Alert variant="info">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                  Receiving... SNR: {status.snr.toFixed(1)} dB
                </div>
              </Alert>
            )}

            <div className="mt-4">
              <label className="text-sm text-gray-400">Waterfall Display</label>
              <canvas
                ref={canvasRef}
                width={400}
                height={200}
                className="w-full bg-black border border-gray-700 rounded"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};