/**
 * Setup Page
 *
 * Main setup page for amateur radio HTTP-over-radio system.
 * Handles initial configuration flow and existing setup management.
 */

import React from 'react';
import { SetupIntegration, StationConfiguration } from '../components/Setup/SetupIntegration';

interface SetupPageProps {
  onSetupComplete: (config: StationConfiguration) => void;
  forceSetup?: boolean;
}

export const SetupPage: React.FC<SetupPageProps> = ({
  onSetupComplete,
  forceSetup = false
}) => {
  const handleSetupComplete = (config: StationConfiguration) => {
    console.log('Setup completed for station:', config.callsign);
    onSetupComplete(config);
  };

  return (
    <SetupIntegration
      onSetupComplete={handleSetupComplete}
      forceSetup={forceSetup}
    />
  );
};

export default SetupPage;