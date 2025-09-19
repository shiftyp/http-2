/**
 * Station Setup Wizard Page
 *
 * Complete guided setup process for new amateur radio stations including
 * callsign configuration, radio detection, audio calibration, and testing.
 * Implements Spec 004 critical missing feature for user onboarding.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { StationSetupManager, type SetupStep, type StationConfig } from '../lib/station-setup/index.js';
import { WelcomeStep } from '../components/StationSetup/WelcomeStep.js';
import { CallsignStep } from '../components/StationSetup/CallsignStep.js';
import { RadioDetectionStep } from '../components/StationSetup/RadioDetectionStep.js';
import { AudioCalibrationStep } from '../components/StationSetup/AudioCalibrationStep.js';
import { PTTTestStep } from '../components/StationSetup/PTTTestStep.js';
import { SettingsStep } from '../components/StationSetup/SettingsStep.js';
import { TestingStep } from '../components/StationSetup/TestingStep.js';
import { CompletionStep } from '../components/StationSetup/CompletionStep.js';

interface StationSetupProps {
  onComplete?: (config: StationConfig) => void;
  onCancel?: () => void;
}

export const StationSetup: React.FC<StationSetupProps> = ({
  onComplete,
  onCancel
}) => {
  const [setupManager] = useState(() => new StationSetupManager());
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Partial<StationConfig>>({});

  // Initialize setup manager
  useEffect(() => {
    const initializeSetup = async () => {
      try {
        setIsLoading(true);
        await setupManager.initialize();
        const currentConfig = await setupManager.getConfig();
        if (currentConfig) {
          setConfig(currentConfig);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize setup');
      } finally {
        setIsLoading(false);
      }
    };

    initializeSetup();
  }, [setupManager]);

  // Handle step navigation
  const handleNext = useCallback(async (stepData?: any) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update configuration with step data
      if (stepData) {
        const updatedConfig = { ...config, ...stepData };
        setConfig(updatedConfig);
        await setupManager.updateConfig(updatedConfig);
      }

      // Move to next step
      const nextStep = await setupManager.nextStep();
      setCurrentStep(nextStep);

      // If completed, call onComplete callback
      if (nextStep === 'complete') {
        const finalConfig = await setupManager.getConfig();
        if (finalConfig && onComplete) {
          onComplete(finalConfig);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to proceed to next step');
    } finally {
      setIsLoading(false);
    }
  }, [config, setupManager, onComplete]);

  const handlePrevious = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const prevStep = await setupManager.previousStep();
      setCurrentStep(prevStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go to previous step');
    } finally {
      setIsLoading(false);
    }
  }, [setupManager]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handleRetry = useCallback(() => {
    setError(null);
  }, []);

  // Get step progress
  const getStepProgress = () => {
    const steps: SetupStep[] = ['welcome', 'callsign', 'radio-detection', 'audio-calibration', 'ptt-test', 'settings', 'testing', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return {
      current: currentIndex + 1,
      total: steps.length,
      percentage: Math.round(((currentIndex + 1) / steps.length) * 100)
    };
  };

  const progress = getStepProgress();

  // Render current step component
  const renderStep = () => {
    const commonProps = {
      setupManager,
      config,
      onNext: handleNext,
      onPrevious: handlePrevious,
      onCancel: handleCancel,
      isLoading,
      error,
      onRetry: handleRetry
    };

    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep {...commonProps} />;
      case 'callsign':
        return <CallsignStep {...commonProps} />;
      case 'radio-detection':
        return <RadioDetectionStep {...commonProps} />;
      case 'audio-calibration':
        return <AudioCalibrationStep {...commonProps} />;
      case 'ptt-test':
        return <PTTTestStep {...commonProps} />;
      case 'settings':
        return <SettingsStep {...commonProps} />;
      case 'testing':
        return <TestingStep {...commonProps} />;
      case 'complete':
        return <CompletionStep {...commonProps} />;
      default:
        return <div className="text-red-600">Unknown step: {currentStep}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Amateur Radio Station Setup
          </h1>
          <p className="text-gray-600">
            Configure your station for HTTP over amateur radio communication
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {progress.current} of {progress.total}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {progress.percentage}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Need help? Consult your radio manual or contact your local amateur radio club.
          </p>
          <p className="mt-1">
            This setup wizard ensures FCC Part 97 compliance for amateur radio operations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StationSetup;