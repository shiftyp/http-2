/**
 * Station Configuration Panel
 *
 * Provides ongoing management of station configuration,
 * certificates, and compliance settings after initial setup.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Toggle } from '../ui/Toggle';
import { StationConfiguration } from './SetupWizard';
import { CertificateService } from '../../lib/certificate-management/services/CertificateService';
import { StationCertificate } from '../../lib/certificate-management/types';
import { createComplianceManager } from '../../lib/fcc-compliance';
import { ComplianceManager } from '../../lib/fcc-compliance/core/ComplianceManager';

interface StationConfigPanelProps {
  onConfigurationUpdate?: (config: StationConfiguration) => void;
  className?: string;
}

export const StationConfigPanel: React.FC<StationConfigPanelProps> = ({
  onConfigurationUpdate,
  className = ''
}) => {
  const [configuration, setConfiguration] = useState<StationConfiguration | null>(null);
  const [certificates, setCertificates] = useState<StationCertificate[]>([]);
  const [complianceManager, setComplianceManager] = useState<ComplianceManager | null>(null);
  const [certificateService] = useState(() => new CertificateService());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'station' | 'equipment' | 'certificates' | 'compliance'>('station');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);

      // Load station configuration
      const configData = localStorage.getItem('stationConfig');
      if (configData) {
        const config = JSON.parse(configData);
        setConfiguration(config);

        // Initialize compliance manager
        if (config.callsign) {
          const manager = createComplianceManager(config.callsign);
          setComplianceManager(manager);
        }
      }

      // Load certificates
      const certData = localStorage.getItem('stationCertificates');
      if (certData) {
        const certs = JSON.parse(certData);
        setCertificates(certs);
      }

    } catch (error) {
      console.error('Failed to load configuration:', error);
      setErrorMessage('Failed to load station configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Update configuration
  const updateConfiguration = (updates: Partial<StationConfiguration>) => {
    if (!configuration) return;

    const updatedConfig = { ...configuration, ...updates };
    setConfiguration(updatedConfig);

    // Save to localStorage
    localStorage.setItem('stationConfig', JSON.stringify(updatedConfig));

    // Notify parent component
    if (onConfigurationUpdate) {
      onConfigurationUpdate(updatedConfig);
    }

    setSuccessMessage('Configuration updated successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Generate new certificate
  const generateNewCertificate = async () => {
    if (!configuration?.callsign) return;

    setIsLoading(true);
    try {
      const cert = await certificateService.generateSelfSignedCertificate(
        configuration.callsign,
        {
          operatorName: configuration.operatorName,
          email: configuration.email,
          location: configuration.stationLocation
        }
      );

      const updatedCerts = [...certificates, cert];
      setCertificates(updatedCerts);
      localStorage.setItem('stationCertificates', JSON.stringify(updatedCerts));

      setSuccessMessage('New certificate generated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (error) {
      setErrorMessage(`Failed to generate certificate: ${error.message}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete certificate
  const deleteCertificate = (certIndex: number) => {
    const updatedCerts = certificates.filter((_, index) => index !== certIndex);
    setCertificates(updatedCerts);
    localStorage.setItem('stationCertificates', JSON.stringify(updatedCerts));

    setSuccessMessage('Certificate deleted successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Restart compliance manager
  const restartCompliance = async () => {
    if (!configuration?.callsign) return;

    try {
      setIsLoading(true);

      // Reinitialize compliance manager
      const manager = createComplianceManager(configuration.callsign, {
        stationID: {
          controlOperatorCallsign: configuration.controlOperatorCallsign,
          emergencyCallsign: configuration.emergencyCallsign
        },
        emergencyMode: configuration.enableEmergencyMode
      });

      setComplianceManager(manager);

      if (configuration.enableAutomaticStation) {
        await manager.startMonitoring();
      }

      setSuccessMessage('Compliance manager restarted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (error) {
      setErrorMessage(`Failed to restart compliance: ${error.message}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!configuration) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <h3 className="text-lg font-semibold mb-2">No Configuration Found</h3>
          <p className="text-gray-400 mb-4">
            No station configuration was found. Please run the setup wizard first.
          </p>
          <Button onClick={() => window.location.href = '/setup'}>
            Run Setup Wizard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const renderStationTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Callsign</label>
          <Input
            value={configuration.callsign}
            onChange={(e) => updateConfiguration({ callsign: e.target.value.toUpperCase() })}
            maxLength={6}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">License Class</label>
          <Select
            value={configuration.licenseClass}
            onChange={(e) => updateConfiguration({ licenseClass: e.target.value as any })}
          >
            <option value="technician">Technician</option>
            <option value="general">General</option>
            <option value="extra">Extra</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Operator Name</label>
          <Input
            value={configuration.operatorName}
            onChange={(e) => updateConfiguration({ operatorName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <Input
            type="email"
            value={configuration.email}
            onChange={(e) => updateConfiguration({ email: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Station Location</label>
          <Input
            value={configuration.stationLocation}
            onChange={(e) => updateConfiguration({ stationLocation: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Grid Square</label>
          <Input
            value={configuration.gridSquare}
            onChange={(e) => updateConfiguration({ gridSquare: e.target.value.toUpperCase() })}
            maxLength={6}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Control Operator</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Control Operator Callsign</label>
            <Input
              value={configuration.controlOperatorCallsign || ''}
              onChange={(e) => updateConfiguration({ controlOperatorCallsign: e.target.value.toUpperCase() })}
              placeholder="W1XYZ (if different)"
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Emergency Callsign</label>
            <Input
              value={configuration.emergencyCallsign || ''}
              onChange={(e) => updateConfiguration({ emergencyCallsign: e.target.value.toUpperCase() })}
              placeholder="Emergency callsign"
              maxLength={6}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderEquipmentTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Radio Model</label>
          <Input
            value={configuration.radioModel}
            onChange={(e) => updateConfiguration({ radioModel: e.target.value })}
            placeholder="e.g., Icom IC-7300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Antenna Type</label>
          <Select
            value={configuration.antennaType}
            onChange={(e) => updateConfiguration({ antennaType: e.target.value })}
          >
            <option value="dipole">Dipole</option>
            <option value="vertical">Vertical</option>
            <option value="yagi">Yagi</option>
            <option value="loop">Loop</option>
            <option value="longwire">Longwire</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Power Output (Watts)</label>
          <Input
            type="number"
            min="1"
            max="1500"
            value={configuration.powerOutput}
            onChange={(e) => updateConfiguration({ powerOutput: parseInt(e.target.value) })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Mesh Node ID</label>
          <Input
            value={configuration.meshNodeId || configuration.callsign}
            onChange={(e) => updateConfiguration({ meshNodeId: e.target.value })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Features</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enable Mesh Routing</div>
              <div className="text-sm text-gray-400">Participate in mesh network</div>
            </div>
            <Toggle
              checked={configuration.enableMeshRouting !== false}
              onChange={(checked) => updateConfiguration({ enableMeshRouting: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Automatic Station Operation</div>
              <div className="text-sm text-gray-400">Enable unattended operation (§97.213)</div>
            </div>
            <Toggle
              checked={configuration.enableAutomaticStation || false}
              onChange={(checked) => updateConfiguration({ enableAutomaticStation: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Emergency Mode</div>
              <div className="text-sm text-gray-400">Allow emergency traffic bypass</div>
            </div>
            <Toggle
              checked={configuration.enableEmergencyMode || false}
              onChange={(checked) => updateConfiguration({ enableEmergencyMode: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderCertificatesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Station Certificates</h3>
        <Button
          onClick={generateNewCertificate}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? 'Generating...' : 'Generate New'}
        </Button>
      </div>

      {certificates.length === 0 ? (
        <Alert>
          <p>No certificates configured. Generate a self-signed certificate to get started.</p>
        </Alert>
      ) : (
        <div className="space-y-3">
          {certificates.map((cert, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded">
              <div>
                <div className="font-medium">{cert.callsign}</div>
                <div className="text-sm text-gray-400">
                  {cert.type} • Expires: {cert.expiresAt.toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                  Created: {cert.createdAt.toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={cert.validationLevel === 'verified' ? 'success' : 'warning'}>
                  {cert.validationLevel}
                </Badge>
                <Button
                  onClick={() => deleteCertificate(index)}
                  className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderComplianceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">FCC Compliance Status</h3>
        <Button
          onClick={restartCompliance}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700"
        >
          {isLoading ? 'Restarting...' : 'Restart Compliance'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h4 className="font-semibold">Station Identification</h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge variant={complianceManager ? 'success' : 'danger'}>
                  {complianceManager ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Interval:</span>
                <span>10 minutes</span>
              </div>
              <div className="flex justify-between">
                <span>End-of-TX ID:</span>
                <Badge variant="success">Enabled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h4 className="font-semibold">Content Filtering</h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Music Blocking:</span>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex justify-between">
                <span>Business Detection:</span>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex justify-between">
                <span>Profanity Filter:</span>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h4 className="font-semibold">Encryption Control</h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>RF Mode:</span>
                <Badge variant="danger">No Encryption</Badge>
              </div>
              <div className="flex justify-between">
                <span>WebRTC Mode:</span>
                <Badge variant="success">Encryption OK</Badge>
              </div>
              <div className="flex justify-between">
                <span>Signatures:</span>
                <Badge variant="success">Allowed</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h4 className="font-semibold">Emergency Features</h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Emergency Mode:</span>
                <Badge variant={configuration.enableEmergencyMode ? 'warning' : 'default'}>
                  {configuration.enableEmergencyMode ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Override Available:</span>
                <Badge variant="warning">Yes</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {successMessage && (
        <Alert variant="success" className="mb-4">
          <p>{successMessage}</p>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" className="mb-4">
          <p>{errorMessage}</p>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Station Configuration</h2>
            <Badge variant="success">{configuration.callsign}</Badge>
          </div>
        </CardHeader>

        <CardContent>
          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            {[
              { id: 'station', label: 'Station Info' },
              { id: 'equipment', label: 'Equipment' },
              { id: 'certificates', label: 'Certificates' },
              { id: 'compliance', label: 'Compliance' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded text-sm ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'station' && renderStationTab()}
          {activeTab === 'equipment' && renderEquipmentTab()}
          {activeTab === 'certificates' && renderCertificatesTab()}
          {activeTab === 'compliance' && renderComplianceTab()}
        </CardContent>
      </Card>
    </div>
  );
};

export default StationConfigPanel;