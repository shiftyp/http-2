import React, { useState } from 'react';
import { WaterfallDisplay } from '../components/WaterfallDisplay';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';

export const WaterfallPage: React.FC = () => {
  const [presetConfig, setPresetConfig] = useState({
    sampleRate: 48000,
    fftSize: 2048,
    frameRate: 30,
    historyDuration: 60,
    colorScheme: 'classic' as const,
    dynamicRange: 60,
    noiseFloorOffset: 10
  });

  const [savedPresets, setSavedPresets] = useState([
    {
      name: 'HF Voice',
      centerFreq: 14205000,
      span: 3000,
      config: { ...presetConfig, frameRate: 15 }
    },
    {
      name: 'HF Data',
      centerFreq: 14070000,
      span: 1000,
      config: { ...presetConfig, fftSize: 4096, frameRate: 10 }
    },
    {
      name: 'VHF Wide',
      centerFreq: 144000000,
      span: 20000,
      config: { ...presetConfig, frameRate: 60 }
    }
  ]);

  const [selectedPreset, setSelectedPreset] = useState('HF Voice');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getCurrentPreset = () => {
    return savedPresets.find(p => p.name === selectedPreset) || savedPresets[0];
  };

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
  };

  const handleSavePreset = () => {
    const name = prompt('Enter preset name:');
    if (name && name.trim()) {
      const preset = getCurrentPreset();
      setSavedPresets(prev => [
        ...prev.filter(p => p.name !== name.trim()),
        {
          name: name.trim(),
          centerFreq: preset.centerFreq,
          span: preset.span,
          config: { ...presetConfig }
        }
      ]);
    }
  };

  const currentPreset = getCurrentPreset();

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Waterfall Display</h1>
          <p className="text-gray-400 mt-1">
            Real-time spectrum analyzer with SNR and signal detection
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            options={savedPresets.map(p => ({ value: p.name, label: p.name }))}
          />
          <Button onClick={handleSavePreset} variant="secondary" size="sm">
            Save Preset
          </Button>
          <Button
            onClick={() => setShowAdvanced(!showAdvanced)}
            variant="secondary"
            size="sm"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Advanced Configuration</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                type="number"
                label="Sample Rate (Hz)"
                value={presetConfig.sampleRate}
                onChange={(e) => setPresetConfig(prev => ({
                  ...prev,
                  sampleRate: Number(e.target.value)
                }))}
                step={1000}
                min={8000}
                max={192000}
              />

              <Select
                label="FFT Size"
                value={presetConfig.fftSize.toString()}
                onChange={(e) => setPresetConfig(prev => ({
                  ...prev,
                  fftSize: Number(e.target.value)
                }))}
                options={[
                  { value: '512', label: '512' },
                  { value: '1024', label: '1024' },
                  { value: '2048', label: '2048' },
                  { value: '4096', label: '4096' },
                  { value: '8192', label: '8192' },
                  { value: '16384', label: '16384' }
                ]}
              />

              <Input
                type="number"
                label="Frame Rate (fps)"
                value={presetConfig.frameRate}
                onChange={(e) => setPresetConfig(prev => ({
                  ...prev,
                  frameRate: Number(e.target.value)
                }))}
                min={1}
                max={120}
                step={1}
              />

              <Input
                type="number"
                label="History (seconds)"
                value={presetConfig.historyDuration}
                onChange={(e) => setPresetConfig(prev => ({
                  ...prev,
                  historyDuration: Number(e.target.value)
                }))}
                min={10}
                max={600}
                step={10}
              />

              <Input
                type="number"
                label="Dynamic Range (dB)"
                value={presetConfig.dynamicRange}
                onChange={(e) => setPresetConfig(prev => ({
                  ...prev,
                  dynamicRange: Number(e.target.value)
                }))}
                min={20}
                max={120}
                step={5}
              />

              <Input
                type="number"
                label="Noise Floor Offset (dB)"
                value={presetConfig.noiseFloorOffset}
                onChange={(e) => setPresetConfig(prev => ({
                  ...prev,
                  noiseFloorOffset: Number(e.target.value)
                }))}
                min={0}
                max={30}
                step={1}
              />

              <Select
                label="Color Scheme"
                value={presetConfig.colorScheme}
                onChange={(e) => setPresetConfig(prev => ({
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
            </div>

            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Performance Note:</strong> Higher FFT sizes and frame rates require more CPU power.
                Start with default settings and adjust based on your system's performance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert variant="info">
        <div className="space-y-2">
          <p className="font-semibold">Getting Started:</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Click "Start" to begin spectrum analysis</li>
            <li>Adjust center frequency and span to focus on your band of interest</li>
            <li>Yellow markers show detected signals with SNR values</li>
            <li>Use color intensity and zoom controls to optimize the display</li>
            <li>Export data or screenshots for analysis and logging</li>
          </ul>
        </div>
      </Alert>

      {/* Main Waterfall Display */}
      <WaterfallDisplay
        config={presetConfig}
        width={1000}
        height={500}
        autoStart={false}
      />

      {/* Additional Tools and Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-white">Frequency Presets</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Button
                onClick={() => {
                  // This would work better with a callback prop, but DOM manipulation for demo
                  const display = document.querySelector('input[type="number"]') as HTMLInputElement;
                  if (display) display.value = '14200000';
                }}
                variant="secondary"
                size="sm"
                fullWidth
              >
                20m SSB (14.200 MHz)
              </Button>
              <Button
                onClick={() => {
                  const display = document.querySelector('input[type="number"]') as HTMLInputElement;
                  if (display) display.value = '14074000';
                }}
                variant="secondary"
                size="sm"
                fullWidth
              >
                20m FT8 (14.074 MHz)
              </Button>
              <Button
                onClick={() => {
                  const display = document.querySelector('input[type="number"]') as HTMLInputElement;
                  if (display) display.value = '7200000';
                }}
                variant="secondary"
                size="sm"
                fullWidth
              >
                40m SSB (7.200 MHz)
              </Button>
              <Button
                onClick={() => {
                  const display = document.querySelector('input[type="number"]') as HTMLInputElement;
                  if (display) display.value = '3573000';
                }}
                variant="secondary"
                size="sm"
                fullWidth
              >
                80m FT8 (3.573 MHz)
              </Button>
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-white">Analysis Tips</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2 text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span><strong className="text-white">Strong signals:</strong> Bright yellow/red traces</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span><strong className="text-white">Weak signals:</strong> Blue/green traces above noise</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span><strong className="text-white">Noise floor:</strong> Uniform blue background</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span><strong className="text-white">Interference:</strong> Irregular patterns</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                <span><strong className="text-white">Digital modes:</strong> Narrow constant carriers</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Start/Stop</span>
                <kbd className="bg-gray-700 text-white px-2 py-1 rounded text-xs font-mono">Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Clear display</span>
                <kbd className="bg-gray-700 text-white px-2 py-1 rounded text-xs font-mono">C</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Adjust zoom</span>
                <kbd className="bg-gray-700 text-white px-2 py-1 rounded text-xs font-mono">+/-</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Adjust intensity</span>
                <kbd className="bg-gray-700 text-white px-2 py-1 rounded text-xs font-mono">↑↓</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Save screenshot</span>
                <kbd className="bg-gray-700 text-white px-2 py-1 rounded text-xs font-mono">S</kbd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold text-white">System Status</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Audio Input:</span>
                <Badge variant="success">Available</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">WebAudio API:</span>
                <Badge variant={window.AudioContext ? 'success' : 'danger'}>
                  {window.AudioContext ? 'Supported' : 'Not Supported'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Canvas 2D:</span>
                <Badge variant="success">Supported</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">FFT Size:</span>
                <span className="font-mono text-white">{presetConfig.fftSize}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Sample Rate:</span>
                <span className="font-mono text-white">{presetConfig.sampleRate} Hz</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};