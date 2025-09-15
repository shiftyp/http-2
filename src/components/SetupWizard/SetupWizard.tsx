import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { RadioControl } from '../../lib/radio-control';
import { Database } from '../../lib/database';

// Types for wizard state
interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  skippable: boolean;
}

interface StationConfig {
  callsign: string;
  radioModel: string;
  serialPort: string;
  baudRate: number;
  audioInputLevel: number;
  audioOutputLevel: number;
  pttMethod: 'RTS' | 'DTR' | 'VOX' | 'CAT';
  pttDelay: number;
}

interface RadioProfile {
  manufacturer: string;
  model: string;
  baudRates: number[];
  commands: Record<string, string>;
  capabilities: string[];
}

const RADIO_PROFILES: RadioProfile[] = [
  {
    manufacturer: 'Icom',
    model: 'IC-7300',
    baudRates: [19200, 9600, 4800, 1200],
    commands: { getFreq: 'FEFE94E003FD', setFreq: 'FEFE94E005{freq}FD' },
    capabilities: ['CAT', 'Audio', 'PTT']
  },
  {
    manufacturer: 'Yaesu',
    model: 'FT-991A',
    baudRates: [38400, 19200, 9600, 4800],
    commands: { getFreq: 'FA;', setFreq: 'FA{freq};' },
    capabilities: ['CAT', 'Audio', 'PTT']
  },
  {
    manufacturer: 'Kenwood',
    model: 'TS-590SG',
    baudRates: [115200, 57600, 38400, 19200, 9600, 4800],
    commands: { getFreq: 'FA;', setFreq: 'FA{freq};' },
    capabilities: ['CAT', 'Audio', 'PTT']
  }
];

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to HTTP-over-Ham-Radio setup',
    completed: false,
    skippable: false
  },
  {
    id: 'callsign',
    title: 'Amateur Radio Callsign',
    description: 'Enter your FCC-issued callsign',
    completed: false,
    skippable: false
  },
  {
    id: 'radio-detection',
    title: 'Radio Detection',
    description: 'Detect and configure your radio',
    completed: false,
    skippable: false
  },
  {
    id: 'audio-calibration',
    title: 'Audio Calibration',
    description: 'Calibrate audio input and output levels',
    completed: false,
    skippable: true
  },
  {
    id: 'ptt-test',
    title: 'PTT Testing',
    description: 'Test Push-To-Talk functionality',
    completed: false,
    skippable: true
  },
  {
    id: 'transmission-test',
    title: 'Test Transmission',
    description: 'Perform a local loopback test',
    completed: false,
    skippable: true
  },
  {
    id: 'completion',
    title: 'Setup Complete',
    description: 'Your station is ready to operate',
    completed: false,
    skippable: false
  }
];

export interface SetupWizardProps {
  onComplete: (config: StationConfig) => void;
  onSkip: () => void;
  allowSkip?: boolean;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  onSkip,
  allowSkip = true
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<WizardStep[]>(WIZARD_STEPS);
  const [config, setConfig] = useState<StationConfig>({
    callsign: '',
    radioModel: '',
    serialPort: '',
    baudRate: 9600,
    audioInputLevel: -12,
    audioOutputLevel: -6,
    pttMethod: 'RTS',
    pttDelay: 100
  });

  const [detectedPorts, setDetectedPorts] = useState<string[]>([]);
  const [detectedRadios, setDetectedRadios] = useState<RadioProfile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [audioLevels, setAudioLevels] = useState({ input: 0, output: 0 });
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>('');
  const [helpVisible, setHelpVisible] = useState(false);

  const radioControl = new RadioControl();
  const database = new Database();

  // Initialize database and check for existing config
  useEffect(() => {
    const initializeWizard = async () => {
      try {
        await database.init();

        // Check if setup was previously completed
        const existingConfig = await database.getSetting('station-config');
        if (existingConfig && allowSkip) {
          // Show option to use existing config or reconfigure
        }
      } catch (err) {
        console.error('Failed to initialize wizard:', err);
      }
    };

    initializeWizard();
  }, []);

  // Validate callsign format
  const validateCallsign = (callsign: string): boolean => {
    const callsignRegex = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignRegex.test(callsign.toUpperCase());
  };

  // Scan for available serial ports
  const scanSerialPorts = async () => {
    setIsScanning(true);
    setError('');

    try {
      if ('serial' in navigator) {
        // Web Serial API - request port access
        const port = await (navigator as any).serial.requestPort();
        setDetectedPorts([port.toString()]);
      } else {
        setError('Serial port access not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      // Try to detect radio on each port
      await detectRadios();

    } catch (err) {
      setError('Failed to access serial ports. Please check permissions and connections.');
      console.error('Serial port scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Detect connected radios
  const detectRadios = async () => {
    const detected: RadioProfile[] = [];

    for (const profile of RADIO_PROFILES) {
      try {
        // Try to establish connection with radio profile
        const connected = await radioControl.connect({
          port: config.serialPort || detectedPorts[0],
          baudRate: profile.baudRates[0],
          manufacturer: profile.manufacturer
        });

        if (connected) {
          detected.push(profile);
          setConfig(prev => ({
            ...prev,
            radioModel: `${profile.manufacturer} ${profile.model}`,
            baudRate: profile.baudRates[0]
          }));
          break; // Use first working radio
        }
      } catch (err) {
        console.log(`Failed to connect to ${profile.manufacturer} ${profile.model}`);
      }
    }

    setDetectedRadios(detected);

    if (detected.length === 0) {
      setError('No compatible radios detected. Please check connections and try manual configuration.');
    }
  };

  // Simulate audio level monitoring
  const calibrateAudio = async () => {
    try {
      // Request microphone access for audio calibration
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();

      analyzer.fftSize = 256;
      source.connect(analyzer);

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      // Monitor audio levels
      const monitorLevels = () => {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const dbLevel = 20 * Math.log10(average / 255) || -60;

        setAudioLevels(prev => ({
          ...prev,
          input: Math.max(-60, Math.min(0, dbLevel))
        }));

        if (audioContext.state === 'running') {
          requestAnimationFrame(monitorLevels);
        }
      };

      monitorLevels();

      // Clean up after 10 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      }, 10000);

    } catch (err) {
      setError('Could not access microphone for audio calibration. Audio levels will use default settings.');
    }
  };

  // Test PTT functionality
  const testPTT = async () => {
    try {
      setError('');

      // Test PTT activation
      const pttWorking = await radioControl.testPTT(config.pttMethod);
      setTestResults(prev => ({ ...prev, ptt: pttWorking }));

      if (!pttWorking) {
        setError('PTT test failed. Please check PTT method and connections.');
      }

    } catch (err) {
      setError('PTT test encountered an error. Please verify radio connections.');
      setTestResults(prev => ({ ...prev, ptt: false }));
    }
  };

  // Perform transmission test
  const testTransmission = async () => {
    try {
      setError('');

      // Perform local loopback test
      const testMessage = 'TEST HTTP-RADIO SETUP';
      const success = await radioControl.transmitTest(testMessage);

      setTestResults(prev => ({ ...prev, transmission: success }));

      if (!success) {
        setError('Transmission test failed. Please check audio levels and radio configuration.');
      }

    } catch (err) {
      setError('Transmission test encountered an error.');
      setTestResults(prev => ({ ...prev, transmission: false }));
    }
  };

  // Save configuration and complete setup
  const completeSetup = async () => {
    try {
      // Save station configuration
      await database.saveSetting('station-config', config);
      await database.saveSetting('setup-completed', true);
      await database.saveSetting('setup-date', new Date().toISOString());

      // Mark wizard as completed
      setSteps(prev => prev.map(step => ({ ...step, completed: true })));

      // Call completion callback
      onComplete(config);

    } catch (err) {
      setError('Failed to save configuration. Please try again.');
      console.error('Setup completion failed:', err);
    }
  };

  // Navigate between steps
  const nextStep = async () => {
    const current = steps[currentStep];

    // Mark current step as completed
    setSteps(prev => prev.map((step, index) =>
      index === currentStep ? { ...step, completed: true } : step
    ));

    // Perform step-specific actions
    switch (current.id) {
      case 'radio-detection':
        if (detectedRadios.length === 0) {
          await detectRadios();
        }
        break;
      case 'audio-calibration':
        await calibrateAudio();
        break;
      case 'ptt-test':
        await testPTT();
        break;
      case 'transmission-test':
        await testTransmission();
        break;
      case 'completion':
        await completeSetup();
        return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipStep = () => {
    if (steps[currentStep].skippable) {
      nextStep();
    }
  };

  // Render current step content
  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl">📻</div>
            <h2 className="text-2xl font-bold">Welcome to HTTP-over-Ham-Radio</h2>
            <p className="text-gray-300">
              This wizard will help you configure your radio station for digital packet transmission.
              The setup process takes about 5 minutes and will test your equipment.
            </p>
            {allowSkip && (
              <Button
                onClick={onSkip}
                className="mt-4 bg-gray-600 hover:bg-gray-700"
              >
                Skip Setup (Advanced Users)
              </Button>
            )}
          </div>
        );

      case 'callsign':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Enter Your Amateur Radio Callsign</h3>
            <p className="text-gray-300">
              Your callsign identifies your station and is required for legal operation.
            </p>
            <Input
              value={config.callsign}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                callsign: e.target.value.toUpperCase()
              }))}
              placeholder="e.g., W1ABC"
              className="text-lg text-center"
            />
            {config.callsign && !validateCallsign(config.callsign) && (
              <Alert variant="destructive">
                Please enter a valid amateur radio callsign (e.g., W1ABC, K2DEF, VE3GHI)
              </Alert>
            )}
          </div>
        );

      case 'radio-detection':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Radio Detection & Configuration</h3>
            <p className="text-gray-300">
              Connect your radio via USB/Serial cable and click scan to detect it automatically.
            </p>

            <Button
              onClick={scanSerialPorts}
              disabled={isScanning}
              className="w-full"
            >
              {isScanning ? 'Scanning...' : 'Scan for Radios'}
            </Button>

            {detectedRadios.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Detected Radios:</h4>
                {detectedRadios.map((radio, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                    <div>
                      <div className="font-medium">{radio.manufacturer} {radio.model}</div>
                      <div className="text-sm text-gray-400">
                        Baud: {radio.baudRates[0]} | Capabilities: {radio.capabilities.join(', ')}
                      </div>
                    </div>
                    <Badge variant="default">Connected</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'audio-calibration':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Audio Level Calibration</h3>
            <p className="text-gray-300">
              Adjust your audio levels for optimal signal quality. Target: -12dB to -6dB.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Audio Input Level</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="-30"
                    max="0"
                    value={audioLevels.input}
                    onChange={(e) => setAudioLevels(prev => ({
                      ...prev,
                      input: parseInt(e.target.value)
                    }))}
                    className="flex-1"
                  />
                  <Badge
                    variant={audioLevels.input >= -12 && audioLevels.input <= -6 ? "default" : "secondary"}
                  >
                    {audioLevels.input}dB
                  </Badge>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Audio Output Level</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="-20"
                    max="0"
                    value={config.audioOutputLevel}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      audioOutputLevel: parseInt(e.target.value)
                    }))}
                    className="flex-1"
                  />
                  <Badge variant="secondary">{config.audioOutputLevel}dB</Badge>
                </div>
              </div>
            </div>

            <Button onClick={calibrateAudio} className="w-full mt-4">
              Start Audio Calibration
            </Button>
          </div>
        );

      case 'ptt-test':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">PTT (Push-To-Talk) Testing</h3>
            <p className="text-gray-300">
              Test your PTT setup to ensure the radio can transmit when commanded.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">PTT Method</label>
                <select
                  value={config.pttMethod}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    pttMethod: e.target.value as any
                  }))}
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
                >
                  <option value="RTS">RTS (Serial)</option>
                  <option value="DTR">DTR (Serial)</option>
                  <option value="VOX">VOX (Voice Activated)</option>
                  <option value="CAT">CAT Command</option>
                </select>
              </div>

              <Button onClick={testPTT} className="w-full">
                Test PTT
              </Button>

              {testResults.ptt !== undefined && (
                <Alert variant={testResults.ptt ? "default" : "destructive"}>
                  {testResults.ptt ? '✅ PTT test successful!' : '❌ PTT test failed'}
                </Alert>
              )}
            </div>
          </div>
        );

      case 'transmission-test':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Test Transmission</h3>
            <p className="text-gray-300">
              Perform a local loopback test to verify your complete setup is working.
            </p>

            <Alert>
              <strong>Note:</strong> This will key your transmitter for a brief test.
              Ensure your antenna is connected or use a dummy load.
            </Alert>

            <Button onClick={testTransmission} className="w-full">
              Start Transmission Test
            </Button>

            {testResults.transmission !== undefined && (
              <Alert variant={testResults.transmission ? "default" : "destructive"}>
                {testResults.transmission
                  ? '✅ Transmission test successful! Your station is ready.'
                  : '❌ Transmission test failed. Please check configuration.'}
              </Alert>
            )}
          </div>
        );

      case 'completion':
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-green-400">Setup Complete!</h2>
            <p className="text-gray-300">
              Your HTTP-over-Ham-Radio station is configured and ready for operation.
            </p>

            <div className="bg-gray-800 p-4 rounded mt-4 text-left">
              <h4 className="font-semibold mb-2">Configuration Summary:</h4>
              <div className="text-sm space-y-1">
                <div>Callsign: <span className="font-mono">{config.callsign}</span></div>
                <div>Radio: <span className="font-mono">{config.radioModel || 'Manual'}</span></div>
                <div>Baud Rate: <span className="font-mono">{config.baudRate}</span></div>
                <div>PTT: <span className="font-mono">{config.pttMethod}</span></div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Station Setup Wizard</h1>
              <p className="text-gray-400">
                Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
              </p>
            </div>
            <Button
              onClick={() => setHelpVisible(!helpVisible)}
              className="bg-gray-600 hover:bg-gray-700"
            >
              Help
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex space-x-1">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex-1 h-2 rounded ${
                    index < currentStep
                      ? 'bg-green-500'
                      : index === currentStep
                      ? 'bg-blue-500'
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}

          {helpVisible && (
            <Alert className="mb-4">
              <h4 className="font-semibold">Help: {steps[currentStep].title}</h4>
              <p className="mt-2">{steps[currentStep].description}</p>
              {/* Add context-sensitive help content here */}
            </Alert>
          )}

          <div className="mb-6">
            {renderStepContent()}
          </div>

          <div className="flex justify-between">
            <Button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="bg-gray-600 hover:bg-gray-700"
            >
              Back
            </Button>

            <div className="space-x-2">
              {steps[currentStep].skippable && (
                <Button
                  onClick={skipStep}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Skip
                </Button>
              )}

              <Button
                onClick={nextStep}
                disabled={
                  (steps[currentStep].id === 'callsign' && !validateCallsign(config.callsign)) ||
                  (steps[currentStep].id === 'radio-detection' && detectedRadios.length === 0 && !isScanning)
                }
              >
                {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};