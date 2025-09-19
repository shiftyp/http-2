/**
 * Setup Wizard
 *
 * Comprehensive setup wizard for amateur radio HTTP-over-radio system
 * integrating certificate management, station configuration, and compliance setup.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Toggle } from '../ui/Toggle';
import { CertificateService } from '../../lib/certificate-management/services/CertificateService';
import { CertificateType, CertificateValidationLevel, StationCertificate } from '../../lib/certificate-management/types';
import { validateCallsign, createComplianceManager } from '../../lib/fcc-compliance';
import { ComplianceManager } from '../../lib/fcc-compliance/core/ComplianceManager';

export enum SetupStep {
  WELCOME = 'welcome',
  STATION_INFO = 'station_info',
  CERTIFICATES = 'certificates',
  COMPLIANCE = 'compliance',
  TRANSMISSION = 'transmission',
  FINAL_CONFIG = 'final_config',
  COMPLETE = 'complete'
}

export interface StationConfiguration {
  callsign: string;
  operatorName: string;
  stationLocation: string;
  gridSquare: string;
  licenseClass: 'technician' | 'general' | 'extra';
  controlOperatorCallsign?: string;
  emergencyCallsign?: string;

  // Contact info
  email: string;
  phone?: string;
  address: string;

  // Equipment
  radioModel: string;
  antennaType: string;
  powerOutput: number; // watts

  // Network
  meshNodeId: string;
  preferredFrequencies: string[];

  // Features
  enableAutomaticStation: boolean;
  enableMeshRouting: boolean;
  enableEmergencyMode: boolean;
}

export interface SetupProgress {
  currentStep: SetupStep;
  completedSteps: Set<SetupStep>;
  configuration: Partial<StationConfiguration>;
  certificates: StationCertificate[];
  complianceManager?: ComplianceManager;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

interface SetupWizardProps {
  onComplete: (config: StationConfiguration) => void;
  onCancel?: () => void;
  initialConfig?: Partial<StationConfiguration>;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  onCancel,
  initialConfig = {}
}) => {
  const [progress, setProgress] = useState<SetupProgress>({
    currentStep: SetupStep.WELCOME,
    completedSteps: new Set(),
    configuration: initialConfig,
    certificates: [],
    errors: {},
    warnings: {}
  });

  const [isLoading, setIsLoading] = useState(false);
  const [certificateService] = useState(() => new CertificateService());

  // Navigation helpers
  const stepOrder = [
    SetupStep.WELCOME,
    SetupStep.STATION_INFO,
    SetupStep.CERTIFICATES,
    SetupStep.COMPLIANCE,
    SetupStep.TRANSMISSION,
    SetupStep.FINAL_CONFIG,
    SetupStep.COMPLETE
  ];

  const currentStepIndex = stepOrder.indexOf(progress.currentStep);
  const progressPercentage = Math.round((currentStepIndex / (stepOrder.length - 1)) * 100);

  // Update configuration
  const updateConfig = (updates: Partial<StationConfiguration>) => {
    setProgress(prev => ({
      ...prev,
      configuration: { ...prev.configuration, ...updates },
      errors: { ...prev.errors },
      warnings: { ...prev.warnings }
    }));
  };

  // Validate current step
  const validateStep = async (step: SetupStep): Promise<{ valid: boolean; errors: Record<string, string> }> => {
    const errors: Record<string, string> = {};
    const config = progress.configuration;

    switch (step) {
      case SetupStep.STATION_INFO:
        if (!config.callsign) {
          errors.callsign = 'Callsign is required';
        } else {
          const validation = validateCallsign(config.callsign);
          if (!validation.valid) {
            errors.callsign = validation.reason || 'Invalid callsign format';
          }
        }

        if (!config.operatorName) errors.operatorName = 'Operator name is required';
        if (!config.stationLocation) errors.stationLocation = 'Station location is required';
        if (!config.gridSquare) errors.gridSquare = 'Grid square is required';
        if (!config.licenseClass) errors.licenseClass = 'License class is required';
        if (!config.email) errors.email = 'Email is required';
        break;

      case SetupStep.CERTIFICATES:
        if (progress.certificates.length === 0) {
          errors.certificates = 'At least one certificate is required for secure operation';
        }
        break;

      case SetupStep.TRANSMISSION:
        if (!config.radioModel) errors.radioModel = 'Radio model is required';
        if (!config.antennaType) errors.antennaType = 'Antenna type is required';
        if (!config.powerOutput || config.powerOutput <= 0) {
          errors.powerOutput = 'Valid power output is required';
        }
        break;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  };

  // Navigation functions
  const goToStep = async (step: SetupStep) => {
    if (step === progress.currentStep) return;

    // Validate current step before moving forward
    if (stepOrder.indexOf(step) > currentStepIndex) {
      const validation = await validateStep(progress.currentStep);
      if (!validation.valid) {
        setProgress(prev => ({ ...prev, errors: validation.errors }));
        return;
      }

      // Mark current step as completed
      setProgress(prev => ({
        ...prev,
        completedSteps: new Set([...prev.completedSteps, prev.currentStep]),
        errors: {}
      }));
    }

    setProgress(prev => ({ ...prev, currentStep: step }));
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepOrder.length) {
      goToStep(stepOrder[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(stepOrder[prevIndex]);
    }
  };

  // Certificate management
  const generateSelfSignedCertificate = async () => {
    if (!progress.configuration.callsign) {
      setProgress(prev => ({
        ...prev,
        errors: { certificates: 'Callsign required for certificate generation' }
      }));
      return;
    }

    setIsLoading(true);
    try {
      const cert = await certificateService.generateSelfSignedCertificate(
        progress.configuration.callsign,
        {
          operatorName: progress.configuration.operatorName || '',
          email: progress.configuration.email || '',
          location: progress.configuration.stationLocation || ''
        }
      );

      setProgress(prev => ({
        ...prev,
        certificates: [...prev.certificates, cert],
        errors: { ...prev.errors, certificates: undefined }
      }));
    } catch (error) {
      setProgress(prev => ({
        ...prev,
        errors: { ...prev.errors, certificates: error.message }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize compliance manager
  const initializeCompliance = async () => {
    if (!progress.configuration.callsign) return;

    try {
      const complianceManager = createComplianceManager(progress.configuration.callsign, {
        stationID: {
          controlOperatorCallsign: progress.configuration.controlOperatorCallsign,
          emergencyCallsign: progress.configuration.emergencyCallsign
        },
        emergencyMode: progress.configuration.enableEmergencyMode
      });

      setProgress(prev => ({
        ...prev,
        complianceManager
      }));
    } catch (error) {
      console.error('Failed to initialize compliance manager:', error);
    }
  };

  // Complete setup
  const completeSetup = async () => {
    const validation = await validateStep(progress.currentStep);
    if (!validation.valid) {
      setProgress(prev => ({ ...prev, errors: validation.errors }));
      return;
    }

    const config = progress.configuration as StationConfiguration;

    // Save configuration to localStorage
    localStorage.setItem('callsign', config.callsign);
    localStorage.setItem('stationConfig', JSON.stringify(config));
    localStorage.setItem('stationCertificates', JSON.stringify(progress.certificates));

    // Initialize compliance if not already done
    if (!progress.complianceManager) {
      await initializeCompliance();
    }

    onComplete(config);
  };

  // Initialize compliance manager when callsign is set
  useEffect(() => {
    if (progress.configuration.callsign && !progress.complianceManager) {
      initializeCompliance();
    }
  }, [progress.configuration.callsign]);

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Station Setup</h2>
        <span className="text-sm text-gray-400">{progressPercentage}% Complete</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        {stepOrder.slice(0, -1).map((step, index) => (
          <span
            key={step}
            className={`${
              index <= currentStepIndex ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            {step.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        ))}
      </div>
    </div>
  );

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-4">📻</div>
      <h1 className="text-3xl font-bold">Welcome to Amateur Radio HTTP</h1>
      <p className="text-lg text-gray-300 max-w-2xl mx-auto">
        This wizard will guide you through setting up your amateur radio HTTP-over-radio station.
        We'll configure your station details, certificates, and compliance settings to get you
        on the air quickly and safely.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold mb-1">Station Configuration</h3>
            <p className="text-sm text-gray-400">Set up your callsign, location, and equipment details</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">🔐</div>
            <h3 className="font-semibold mb-1">Certificate Management</h3>
            <p className="text-sm text-gray-400">Generate or import certificates for secure communication</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">⚖️</div>
            <h3 className="font-semibold mb-1">FCC Compliance</h3>
            <p className="text-sm text-gray-400">Automatic Part 97 compliance and station identification</p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <p>
          <strong>Important:</strong> This system requires a valid amateur radio license.
          All transmissions will comply with FCC Part 97 regulations including automatic
          station identification and content filtering.
        </p>
      </Alert>
    </div>
  );

  const renderStationInfoStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Station Information</h2>
        <p className="text-gray-300 mb-6">
          Enter your amateur radio station details. This information will be used for
          station identification and compliance logging.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Callsign *</label>
          <Input
            value={progress.configuration.callsign || ''}
            onChange={(e) => updateConfig({ callsign: e.target.value.toUpperCase() })}
            placeholder="W1ABC"
            maxLength={6}
            error={progress.errors.callsign}
          />
          {progress.errors.callsign && (
            <p className="text-red-400 text-xs mt-1">{progress.errors.callsign}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">License Class *</label>
          <Select
            value={progress.configuration.licenseClass || ''}
            onChange={(e) => updateConfig({ licenseClass: e.target.value as any })}
            error={progress.errors.licenseClass}
          >
            <option value="">Select License Class</option>
            <option value="technician">Technician</option>
            <option value="general">General</option>
            <option value="extra">Extra</option>
          </Select>
          {progress.errors.licenseClass && (
            <p className="text-red-400 text-xs mt-1">{progress.errors.licenseClass}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Operator Name *</label>
          <Input
            value={progress.configuration.operatorName || ''}
            onChange={(e) => updateConfig({ operatorName: e.target.value })}
            placeholder="John Smith"
            error={progress.errors.operatorName}
          />
          {progress.errors.operatorName && (
            <p className="text-red-400 text-xs mt-1">{progress.errors.operatorName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email Address *</label>
          <Input
            type="email"
            value={progress.configuration.email || ''}
            onChange={(e) => updateConfig({ email: e.target.value })}
            placeholder="operator@example.com"
            error={progress.errors.email}
          />
          {progress.errors.email && (
            <p className="text-red-400 text-xs mt-1">{progress.errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Station Location *</label>
          <Input
            value={progress.configuration.stationLocation || ''}
            onChange={(e) => updateConfig({ stationLocation: e.target.value })}
            placeholder="City, State"
            error={progress.errors.stationLocation}
          />
          {progress.errors.stationLocation && (
            <p className="text-red-400 text-xs mt-1">{progress.errors.stationLocation}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Grid Square *</label>
          <Input
            value={progress.configuration.gridSquare || ''}
            onChange={(e) => updateConfig({ gridSquare: e.target.value.toUpperCase() })}
            placeholder="FN31pr"
            maxLength={6}
            error={progress.errors.gridSquare}
          />
          {progress.errors.gridSquare && (
            <p className="text-red-400 text-xs mt-1">{progress.errors.gridSquare}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Optional Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <Input
              value={progress.configuration.phone || ''}
              onChange={(e) => updateConfig({ phone: e.target.value })}
              placeholder="+1-555-123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Mailing Address</label>
            <Input
              value={progress.configuration.address || ''}
              onChange={(e) => updateConfig({ address: e.target.value })}
              placeholder="123 Main St, City, State 12345"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Control Operator Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Control Operator Callsign</label>
            <Input
              value={progress.configuration.controlOperatorCallsign || ''}
              onChange={(e) => updateConfig({ controlOperatorCallsign: e.target.value.toUpperCase() })}
              placeholder="W1XYZ (if different)"
              maxLength={6}
            />
            <p className="text-xs text-gray-400 mt-1">
              Required for automatic station operation per §97.213
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Emergency Callsign</label>
            <Input
              value={progress.configuration.emergencyCallsign || ''}
              onChange={(e) => updateConfig({ emergencyCallsign: e.target.value.toUpperCase() })}
              placeholder="Emergency callsign"
              maxLength={6}
            />
            <p className="text-xs text-gray-400 mt-1">
              Special callsign for emergency communications
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCertificatesStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Certificate Management</h2>
        <p className="text-gray-300 mb-6">
          Certificates are used for secure authentication and encryption in WebRTC mode.
          RF mode uses signatures only (no encryption) per FCC regulations.
        </p>
      </div>

      {progress.errors.certificates && (
        <Alert variant="error">
          <p>{progress.errors.certificates}</p>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Self-Signed Certificate</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Generate a self-signed certificate for immediate use. Suitable for testing and private networks.
            </p>
            <Button
              onClick={generateSelfSignedCertificate}
              disabled={isLoading || !progress.configuration.callsign}
              className="w-full"
            >
              {isLoading ? 'Generating...' : 'Generate Certificate'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">ARRL Certificate</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Import an ARRL-issued certificate for enhanced trust and verification.
            </p>
            <Button disabled className="w-full bg-gray-600">
              Import ARRL Cert
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Feature coming soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">LoTW Certificate</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Use your existing Logbook of the World certificate for authentication.
            </p>
            <Button disabled className="w-full bg-gray-600">
              Import LoTW Cert
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Feature coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      {progress.certificates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Configured Certificates</h3>
          <div className="space-y-2">
            {progress.certificates.map((cert, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div>
                  <div className="font-medium">{cert.callsign}</div>
                  <div className="text-sm text-gray-400">
                    {cert.type} • Expires: {cert.expiresAt.toLocaleDateString()}
                  </div>
                </div>
                <Badge variant={cert.validationLevel === CertificateValidationLevel.VERIFIED ? 'success' : 'warning'}>
                  {cert.validationLevel}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderComplianceStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">FCC Compliance Configuration</h2>
        <p className="text-gray-300 mb-6">
          Configure automatic FCC Part 97 compliance features including station identification,
          content filtering, and transmission monitoring.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Station Identification (§97.119)</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Automatic ID Every 10 Minutes</div>
                  <div className="text-sm text-gray-400">Required for all amateur transmissions</div>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">End-of-Transmission ID</div>
                  <div className="text-sm text-gray-400">ID at the end of each transmission</div>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ID Interval (minutes)</label>
                <Input
                  type="number"
                  value="10"
                  disabled
                  className="bg-gray-700"
                />
                <p className="text-xs text-gray-400 mt-1">Fixed at 10 minutes per regulations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Content Filtering (§97.113)</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Block Music Files</div>
                  <div className="text-sm text-gray-400">Prevent music transmission over RF</div>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Business Content Detection</div>
                  <div className="text-sm text-gray-400">Warn about business communications</div>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Profanity Filter</div>
                  <div className="text-sm text-gray-400">Filter inappropriate content</div>
                </div>
                <Toggle
                  checked={progress.configuration.enableEmergencyMode || false}
                  onChange={(checked) => updateConfig({ enableEmergencyMode: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Encryption Control</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Block RF Mode Encryption</div>
                  <div className="text-sm text-gray-400">No encryption over radio per Part 97</div>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Allow WebRTC Encryption</div>
                  <div className="text-sm text-gray-400">Encryption permitted for IP traffic</div>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Digital Signatures</div>
                  <div className="text-sm text-gray-400">Allow authentication signatures</div>
                </div>
                <Toggle checked={true} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Emergency Mode</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Emergency Override</div>
                  <div className="text-sm text-gray-400">Allow emergency traffic bypass</div>
                </div>
                <Toggle
                  checked={progress.configuration.enableEmergencyMode || false}
                  onChange={(checked) => updateConfig({ enableEmergencyMode: checked })}
                />
              </div>

              <Alert>
                <p className="text-sm">
                  Emergency mode allows certain compliance restrictions to be bypassed during
                  declared emergencies. Use responsibly and in accordance with FCC guidelines.
                </p>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>

      {progress.complianceManager && (
        <Alert variant="success">
          <p>
            ✅ Compliance manager initialized for {progress.configuration.callsign}.
            All Part 97 requirements will be automatically enforced.
          </p>
        </Alert>
      )}
    </div>
  );

  const renderTransmissionStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Transmission Configuration</h2>
        <p className="text-gray-300 mb-6">
          Configure your radio equipment and transmission parameters for optimal performance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Radio Equipment</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Radio Model *</label>
              <Input
                value={progress.configuration.radioModel || ''}
                onChange={(e) => updateConfig({ radioModel: e.target.value })}
                placeholder="e.g., Icom IC-7300, Yaesu FT-991A"
                error={progress.errors.radioModel}
              />
              {progress.errors.radioModel && (
                <p className="text-red-400 text-xs mt-1">{progress.errors.radioModel}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Antenna Type *</label>
              <Select
                value={progress.configuration.antennaType || ''}
                onChange={(e) => updateConfig({ antennaType: e.target.value })}
                error={progress.errors.antennaType}
              >
                <option value="">Select Antenna Type</option>
                <option value="dipole">Dipole</option>
                <option value="vertical">Vertical</option>
                <option value="yagi">Yagi</option>
                <option value="loop">Loop</option>
                <option value="longwire">Longwire</option>
                <option value="other">Other</option>
              </Select>
              {progress.errors.antennaType && (
                <p className="text-red-400 text-xs mt-1">{progress.errors.antennaType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Power Output (Watts) *</label>
              <Input
                type="number"
                min="1"
                max="1500"
                value={progress.configuration.powerOutput || ''}
                onChange={(e) => updateConfig({ powerOutput: parseInt(e.target.value) })}
                placeholder="100"
                error={progress.errors.powerOutput}
              />
              {progress.errors.powerOutput && (
                <p className="text-red-400 text-xs mt-1">{progress.errors.powerOutput}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Maximum allowed power varies by band and license class
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Mesh Network</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mesh Node ID</label>
              <Input
                value={progress.configuration.meshNodeId || progress.configuration.callsign || ''}
                onChange={(e) => updateConfig({ meshNodeId: e.target.value })}
                placeholder="Auto-generated from callsign"
              />
              <p className="text-xs text-gray-400 mt-1">
                Unique identifier for mesh routing
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Enable Mesh Routing</div>
                <div className="text-sm text-gray-400">Participate in mesh network</div>
              </div>
              <Toggle
                checked={progress.configuration.enableMeshRouting !== false}
                onChange={(checked) => updateConfig({ enableMeshRouting: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Automatic Station Operation</div>
                <div className="text-sm text-gray-400">Enable unattended operation (§97.213)</div>
              </div>
              <Toggle
                checked={progress.configuration.enableAutomaticStation || false}
                onChange={(checked) => updateConfig({ enableAutomaticStation: checked })}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Preferred Frequencies</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { band: '80m', freq: '3.585 MHz' },
            { band: '40m', freq: '7.245 MHz' },
            { band: '20m', freq: '14.245 MHz' },
            { band: '17m', freq: '18.145 MHz' },
            { band: '15m', freq: '21.345 MHz' },
            { band: '12m', freq: '24.945 MHz' },
            { band: '10m', freq: '28.345 MHz' },
            { band: '6m', freq: '50.345 MHz' }
          ].map(({ band, freq }) => (
            <div key={band} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={band}
                checked={(progress.configuration.preferredFrequencies || []).includes(freq)}
                onChange={(e) => {
                  const current = progress.configuration.preferredFrequencies || [];
                  const updated = e.target.checked
                    ? [...current, freq]
                    : current.filter(f => f !== freq);
                  updateConfig({ preferredFrequencies: updated });
                }}
                className="rounded"
              />
              <label htmlFor={band} className="text-sm">
                {band} ({freq})
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Select your preferred frequencies for mesh operation. Ensure you have privileges for selected bands.
        </p>
      </div>
    </div>
  );

  const renderFinalConfigStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Final Configuration</h2>
        <p className="text-gray-300 mb-6">
          Review your configuration and complete the setup process.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Station Information</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Callsign:</strong> {progress.configuration.callsign}</div>
              <div><strong>Operator:</strong> {progress.configuration.operatorName}</div>
              <div><strong>License:</strong> {progress.configuration.licenseClass}</div>
              <div><strong>Location:</strong> {progress.configuration.stationLocation}</div>
              <div><strong>Grid Square:</strong> {progress.configuration.gridSquare}</div>
              <div><strong>Email:</strong> {progress.configuration.email}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Equipment</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Radio:</strong> {progress.configuration.radioModel}</div>
              <div><strong>Antenna:</strong> {progress.configuration.antennaType}</div>
              <div><strong>Power:</strong> {progress.configuration.powerOutput}W</div>
              <div><strong>Mesh ID:</strong> {progress.configuration.meshNodeId}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Certificates</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Count:</strong> {progress.certificates.length}</div>
              {progress.certificates.map((cert, index) => (
                <div key={index}>
                  <strong>{cert.type}:</strong> {cert.callsign}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Features</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Mesh Routing:</strong> {progress.configuration.enableMeshRouting ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Automatic Station:</strong> {progress.configuration.enableAutomaticStation ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Emergency Mode:</strong> {progress.configuration.enableEmergencyMode ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Compliance:</strong> {progress.complianceManager ? 'Active' : 'Not configured'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <p>
          <strong>Ready to complete setup!</strong> Your station will be configured with all
          necessary certificates and compliance features. You can modify these settings later
          in the station configuration panel.
        </p>
      </Alert>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-4">🎉</div>
      <h1 className="text-3xl font-bold">Setup Complete!</h1>
      <p className="text-lg text-gray-300 max-w-2xl mx-auto">
        Your amateur radio HTTP-over-radio station has been successfully configured.
        You're now ready to begin secure, compliant amateur radio communications.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">📻</div>
            <h3 className="font-semibold mb-1">Station Active</h3>
            <p className="text-sm text-gray-400">Your station is configured and ready for operation</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">⚖️</div>
            <h3 className="font-semibold mb-1">FCC Compliant</h3>
            <p className="text-sm text-gray-400">All Part 97 requirements automatically enforced</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl mb-2">🔐</div>
            <h3 className="font-semibold mb-1">Secure</h3>
            <p className="text-sm text-gray-400">Certificates configured for authenticated communications</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Button
          onClick={() => onComplete(progress.configuration as StationConfiguration)}
          className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
        >
          Start Using Amateur Radio HTTP
        </Button>
      </div>
    </div>
  );

  // Step navigation
  const renderNavigation = () => (
    <div className="flex justify-between mt-8">
      <Button
        onClick={prevStep}
        disabled={currentStepIndex === 0}
        className="bg-gray-600 hover:bg-gray-700"
      >
        ← Previous
      </Button>

      <div className="flex space-x-2">
        {onCancel && (
          <Button
            onClick={onCancel}
            className="bg-red-600 hover:bg-red-700"
          >
            Cancel
          </Button>
        )}

        {progress.currentStep === SetupStep.FINAL_CONFIG ? (
          <Button
            onClick={completeSetup}
            className="bg-green-600 hover:bg-green-700"
          >
            Complete Setup
          </Button>
        ) : (
          <Button onClick={nextStep}>
            Next →
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8">
            {renderStepIndicator()}

            {progress.currentStep === SetupStep.WELCOME && renderWelcomeStep()}
            {progress.currentStep === SetupStep.STATION_INFO && renderStationInfoStep()}
            {progress.currentStep === SetupStep.CERTIFICATES && renderCertificatesStep()}
            {progress.currentStep === SetupStep.COMPLIANCE && renderComplianceStep()}
            {progress.currentStep === SetupStep.TRANSMISSION && renderTransmissionStep()}
            {progress.currentStep === SetupStep.FINAL_CONFIG && renderFinalConfigStep()}
            {progress.currentStep === SetupStep.COMPLETE && renderCompleteStep()}

            {progress.currentStep !== SetupStep.WELCOME && progress.currentStep !== SetupStep.COMPLETE && renderNavigation()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SetupWizard;