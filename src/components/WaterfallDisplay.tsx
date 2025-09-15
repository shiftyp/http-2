import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WaterfallAnalyzer, WaterfallRenderer, WaterfallConfig, WaterfallDisplaySettings, SpectrumSample } from '../lib/waterfall-snr';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';

interface WaterfallDisplayProps {
  config?: Partial<WaterfallConfig>;
  width?: number;
  height?: number;
  autoStart?: boolean;
}

export const WaterfallDisplay: React.FC<WaterfallDisplayProps> = ({
  config = {},
  width = 800,
  height = 400,
  autoStart = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<WaterfallAnalyzer | null>(null);
  const rendererRef = useRef<WaterfallRenderer | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [currentSample, setCurrentSample] = useState<SpectrumSample | null>(null);
  const [error, setError] = useState<string>('');
  const [settings, setSettings] = useState<WaterfallDisplaySettings>({
    centerFrequency: 14205000,
    spanFrequency: 3000,
    paused: false,
    zoom: 1,
    colorIntensity: 1
  });

  const [waterfallConfig, setWaterfallConfig] = useState<WaterfallConfig>({
    sampleRate: 48000,
    fftSize: 2048,
    frameRate: 30,
    historyDuration: 60,
    colorScheme: 'classic',
    dynamicRange: 60,
    noiseFloorOffset: 10,
    ...config
  });

  const initializeWaterfall = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      setError('');

      // Initialize analyzer
      analyzerRef.current = new WaterfallAnalyzer(waterfallConfig);
      await analyzerRef.current.initialize();

      // Initialize renderer
      rendererRef.current = new WaterfallRenderer(canvasRef.current, settings);

      // Set up spectrum update callback
      analyzerRef.current.onSpectrumUpdate((sample: SpectrumSample) => {
        setCurrentSample(sample);
        if (rendererRef.current) {
          rendererRef.current.renderSpectrum(sample, waterfallConfig.colorScheme);
        }
      });

      setIsRunning(true);
      if (autoStart) {
        analyzerRef.current.start();
      }

    } catch (err) {
      setError(`Failed to initialize waterfall: ${err}`);
      console.error('Waterfall initialization error:', err);
    }
  }, [waterfallConfig, settings, autoStart]);

  const cleanup = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.dispose();
      analyzerRef.current = null;
    }
    rendererRef.current = null;
    setIsRunning(false);
    setCurrentSample(null);
  }, []);

  useEffect(() => {
    initializeWaterfall();
    return cleanup;
  }, [initializeWaterfall, cleanup]);

  useEffect(() => {
    // Update renderer settings when changed
    if (rendererRef.current) {
      rendererRef.current.updateSettings(settings);
    }
  }, [settings]);

  const handleStart = () => {
    if (analyzerRef.current) {
      analyzerRef.current.start();
      setSettings(prev => ({ ...prev, paused: false }));
    }
  };

  const handleStop = () => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
      setSettings(prev => ({ ...prev, paused: true }));
    }
  };

  const handleClear = () => {
    if (rendererRef.current) {
      rendererRef.current.clear();
    }
  };

  const handleExport = (format: 'png' | 'json' | 'csv') => {
    if (format === 'png' && rendererRef.current) {
      const imageUrl = rendererRef.current.captureImage();
      const link = document.createElement('a');
      link.download = `waterfall-${new Date().toISOString()}.png`;
      link.href = imageUrl;
      link.click();
    } else if (analyzerRef.current) {
      const data = analyzerRef.current.exportData(format as 'json' | 'csv');
      const blob = new Blob([data], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `waterfall-data-${new Date().toISOString()}.${format}`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000000) {
      return (freq / 1000000).toFixed(3) + ' MHz';
    } else if (freq >= 1000) {
      return (freq / 1000).toFixed(1) + ' kHz';
    }
    return freq.toFixed(0) + ' Hz';
  };

  const getBestSignal = (): { frequency: number; snr: number } | null => {
    if (!currentSample || currentSample.peakSignals.length === 0) return null;
    const best = currentSample.peakSignals[0];
    return { frequency: best.frequency, snr: best.snr };
  };

  const bestSignal = getBestSignal();

  return (
    <div className="waterfall-display">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Waterfall Display</h2>
            <div className="flex gap-2">
              <Badge variant={isRunning && !settings.paused ? 'success' : 'danger'}>
                {isRunning && !settings.paused ? 'Running' : 'Stopped'}
              </Badge>
              {bestSignal && (
                <Badge variant="info">
                  Best: {formatFrequency(bestSignal.frequency)} ({bestSignal.snr.toFixed(1)}dB SNR)
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <div className="lg:col-span-3">
              <div className="border border-gray-700 rounded bg-black p-4">
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  className="w-full border border-gray-600 rounded"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={settings.paused ? handleStart : handleStop}
                  variant={settings.paused ? 'success' : 'danger'}
                  size="sm"
                  fullWidth
                >
                  {settings.paused ? 'Start' : 'Stop'}
                </Button>
                <Button onClick={handleClear} variant="secondary" size="sm" fullWidth>
                  Clear
                </Button>
              </div>

              <div className="space-y-3">
                <Input
                  type="number"
                  label="Center Freq (Hz)"
                  value={settings.centerFrequency.toString()}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    centerFrequency: Number(e.target.value)
                  }))}
                  step="100"
                />

                <Input
                  type="number"
                  label="Span (Hz)"
                  value={settings.spanFrequency.toString()}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    spanFrequency: Number(e.target.value)
                  }))}
                  step="100"
                  min="100"
                  max="24000"
                />

                <Select
                  label="Color Scheme"
                  value={waterfallConfig.colorScheme}
                  onChange={(e) => setWaterfallConfig(prev => ({
                    ...prev,
                    colorScheme: e.target.value as any
                  }))}
                  options={[
                    { value: 'classic', label: 'Classic' },
                    { value: 'thermal', label: 'Thermal' },
                    { value: 'monochrome', label: 'Monochrome' },
                    { value: 'green', label: 'Green' }
                  ]}
                />

                <Input
                  type="range"
                  label={`Intensity (${settings.colorIntensity.toFixed(1)})`}
                  value={settings.colorIntensity.toString()}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    colorIntensity: Number(e.target.value)
                  }))}
                  min="0.1"
                  max="2"
                  step="0.1"
                />

                <Input
                  type="range"
                  label={`Zoom (${settings.zoom.toFixed(1)}x)`}
                  value={settings.zoom.toString()}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    zoom: Number(e.target.value)
                  }))}
                  min="0.5"
                  max="4"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentSample ? currentSample.noiseFloor.toFixed(1) : '--'} dBm
                </div>
                <div className="text-sm text-gray-400">Noise Floor</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentSample ? currentSample.peakSignals.length : 0}
                </div>
                <div className="text-sm text-gray-400">Signals</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="text-2xl font-bold">{waterfallConfig.frameRate}</div>
                <div className="text-sm text-gray-400">Frame Rate</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="text-2xl font-bold">{waterfallConfig.fftSize}</div>
                <div className="text-sm text-gray-400">FFT Size</div>
              </CardContent>
            </Card>
          </div>

          {currentSample && currentSample.peakSignals.length > 0 && (
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Signal Peaks</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentSample.peakSignals.slice(0, 6).map((peak, idx) => (
                  <div key={idx} className="bg-gray-900 p-3 rounded border border-gray-600">
                    <div className="font-mono text-white font-bold">
                      {formatFrequency(peak.frequency)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      SNR: <span className="text-green-400">{peak.snr.toFixed(1)}dB</span> |
                      BW: <span className="text-blue-400">{peak.bandwidth.toFixed(0)}Hz</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Export</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleExport('png')} variant="secondary" size="sm" className="flex-1 min-w-[100px]">
                📷 PNG
              </Button>
              <Button onClick={() => handleExport('json')} variant="secondary" size="sm" className="flex-1 min-w-[100px]">
                📊 JSON
              </Button>
              <Button onClick={() => handleExport('csv')} variant="secondary" size="sm" className="flex-1 min-w-[100px]">
                📈 CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};