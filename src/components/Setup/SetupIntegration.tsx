/**
 * Setup Integration Component
 *
 * Integrates the setup wizard with the main application,
 * handling initialization, configuration persistence, and setup flow management.
 */

import React, { useState, useEffect } from 'react';
import { SetupWizard, StationConfiguration, SetupStep } from './SetupWizard';
import { CertificateService } from '../../lib/certificate-management/services/CertificateService';
import { ComplianceManager } from '../../lib/fcc-compliance/core/ComplianceManager';
import { createComplianceManager } from '../../lib/fcc-compliance';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

export interface SetupIntegrationProps {
  onSetupComplete: (config: StationConfiguration) => void;
  forceSetup?: boolean; // Force setup even if already configured
}

export enum SetupState {
  CHECKING = 'checking',
  NEEDED = 'needed',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  ERROR = 'error'
}

interface SetupStatus {
  hasCallsign: boolean;
  hasConfiguration: boolean;
  hasCertificates: boolean;
  hasComplianceManager: boolean;
  configurationComplete: boolean;
  lastSetupDate?: Date;
  configurationVersion?: string;
}

export const SetupIntegration: React.FC<SetupIntegrationProps> = ({
  onSetupComplete,
  forceSetup = false
}) => {
  const [setupState, setSetupState] = useState<SetupState>(SetupState.CHECKING);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    hasCallsign: false,
    hasConfiguration: false,
    hasCertificates: false,
    hasComplianceManager: false,
    configurationComplete: false
  });
  const [existingConfiguration, setExistingConfiguration] = useState<Partial<StationConfiguration>>({});
  const [error, setError] = useState<string | null>(null);

  // Check current setup status
  const checkSetupStatus = async (): Promise<SetupStatus> => {
    try {
      // Check for existing callsign
      const callsign = localStorage.getItem('callsign');
      const hasCallsign = !!callsign;

      // Check for station configuration
      const configData = localStorage.getItem('stationConfig');
      const hasConfiguration = !!configData;
      let existingConfig: Partial<StationConfiguration> = {};

      if (hasConfiguration && configData) {
        try {
          existingConfig = JSON.parse(configData);
          setExistingConfiguration(existingConfig);
        } catch (e) {
          console.warn('Failed to parse existing station configuration');
        }
      }

      // Check for certificates
      const certData = localStorage.getItem('stationCertificates');
      const hasCertificates = !!certData && certData !== '[]';

      // Check compliance manager initialization
      let hasComplianceManager = false;
      if (callsign) {
        try {
          const complianceManager = createComplianceManager(callsign);
          hasComplianceManager = !!complianceManager;
        } catch (e) {
          console.warn('Failed to initialize compliance manager');
        }
      }

      // Determine if configuration is complete
      const configurationComplete = hasCallsign &&
                                   hasConfiguration &&
                                   hasCertificates &&
                                   hasComplianceManager &&
                                   !!existingConfig.operatorName &&
                                   !!existingConfig.stationLocation &&
                                   !!existingConfig.radioModel;

      // Check setup metadata
      const setupMetadata = localStorage.getItem('setupMetadata');
      let lastSetupDate: Date | undefined;
      let configurationVersion: string | undefined;

      if (setupMetadata) {
        try {
          const metadata = JSON.parse(setupMetadata);
          lastSetupDate = metadata.lastSetupDate ? new Date(metadata.lastSetupDate) : undefined;
          configurationVersion = metadata.configurationVersion;
        } catch (e) {
          console.warn('Failed to parse setup metadata');
        }
      }

      return {
        hasCallsign,
        hasConfiguration,
        hasCertificates,
        hasComplianceManager,
        configurationComplete,
        lastSetupDate,
        configurationVersion
      };

    } catch (error) {
      console.error('Failed to check setup status:', error);
      throw error;
    }
  };

  // Initialize setup status check
  useEffect(() => {
    const initialize = async () => {
      try {
        setSetupState(SetupState.CHECKING);
        const status = await checkSetupStatus();
        setSetupStatus(status);

        if (forceSetup || !status.configurationComplete) {
          setSetupState(SetupState.NEEDED);
        } else {
          setSetupState(SetupState.COMPLETE);
          // If already configured, load the existing configuration
          if (status.hasConfiguration) {
            const configData = localStorage.getItem('stationConfig');
            if (configData) {
              const config = JSON.parse(configData);
              onSetupComplete(config);
            }
          }
        }
      } catch (error) {
        setError(error.message);
        setSetupState(SetupState.ERROR);
      }
    };

    initialize();
  }, [forceSetup, onSetupComplete]);

  // Handle setup completion
  const handleSetupComplete = async (config: StationConfiguration) => {
    try {
      setSetupState(SetupState.IN_PROGRESS);

      // Save configuration
      localStorage.setItem('callsign', config.callsign);
      localStorage.setItem('stationConfig', JSON.stringify(config));

      // Save setup metadata
      const setupMetadata = {
        lastSetupDate: new Date().toISOString(),
        configurationVersion: '1.0.0',
        setupCompleteTimestamp: Date.now()
      };
      localStorage.setItem('setupMetadata', JSON.stringify(setupMetadata));

      // Initialize compliance manager
      const complianceManager = createComplianceManager(config.callsign, {
        stationID: {
          controlOperatorCallsign: config.controlOperatorCallsign,
          emergencyCallsign: config.emergencyCallsign
        },
        emergencyMode: config.enableEmergencyMode
      });

      // Start compliance monitoring if automatic station is enabled
      if (config.enableAutomaticStation) {
        await complianceManager.startMonitoring();
      }

      setSetupState(SetupState.COMPLETE);
      onSetupComplete(config);

    } catch (error) {
      console.error('Failed to complete setup:', error);
      setError(error.message);
      setSetupState(SetupState.ERROR);
    }
  };

  // Handle setup cancellation
  const handleSetupCancel = () => {
    if (setupStatus.configurationComplete) {
      setSetupState(SetupState.COMPLETE);
    } else {
      // If no existing configuration, show error state
      setError('Setup is required to use the amateur radio HTTP system');
      setSetupState(SetupState.ERROR);
    }
  };

  // Force new setup
  const startNewSetup = () => {
    setSetupState(SetupState.NEEDED);
    setError(null);
  };

  // Render setup checking state
  const renderCheckingState = () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-96">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Checking Setup Status</h2>
          <p className="text-gray-400">Please wait while we verify your configuration...</p>
        </CardContent>
      </Card>
    </div>
  );

  // Render setup complete state
  const renderCompleteState = () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-96">
        <CardContent className="p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold mb-2">Setup Complete</h2>
          <p className="text-gray-400 mb-6">
            Your amateur radio HTTP station is configured and ready.
          </p>

          <div className="space-y-2 text-sm text-left bg-gray-800 p-4 rounded mb-6">
            <div><strong>Callsign:</strong> {setupStatus.hasCallsign ? localStorage.getItem('callsign') : 'Not set'}</div>
            <div><strong>Configuration:</strong> {setupStatus.hasConfiguration ? '✅ Complete' : '❌ Missing'}</div>
            <div><strong>Certificates:</strong> {setupStatus.hasCertificates ? '✅ Configured' : '❌ Missing'}</div>
            <div><strong>Compliance:</strong> {setupStatus.hasComplianceManager ? '✅ Active' : '❌ Inactive'}</div>
            {setupStatus.lastSetupDate && (
              <div><strong>Last Setup:</strong> {setupStatus.lastSetupDate.toLocaleDateString()}</div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={startNewSetup}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Reconfigure Station
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render error state
  const renderErrorState = () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-96">
        <CardContent className="p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2">Setup Error</h2>
          <Alert variant="error" className="mb-6">
            <p>{error}</p>
          </Alert>

          <div className="space-y-2">
            <Button
              onClick={startNewSetup}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Start Setup
            </Button>

            {setupStatus.configurationComplete && (
              <Button
                onClick={() => setSetupState(SetupState.COMPLETE)}
                className="w-full bg-gray-600 hover:bg-gray-700"
              >
                Use Existing Configuration
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render main component based on state
  switch (setupState) {
    case SetupState.CHECKING:
      return renderCheckingState();

    case SetupState.NEEDED:
    case SetupState.IN_PROGRESS:
      return (
        <SetupWizard
          onComplete={handleSetupComplete}
          onCancel={handleSetupCancel}
          initialConfig={existingConfiguration}
        />
      );

    case SetupState.COMPLETE:
      return renderCompleteState();

    case SetupState.ERROR:
      return renderErrorState();

    default:
      return renderErrorState();
  }
};

export default SetupIntegration;