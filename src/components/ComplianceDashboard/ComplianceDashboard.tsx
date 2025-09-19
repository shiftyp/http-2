/**
 * FCC Compliance Dashboard
 *
 * Real-time monitoring and control panel for FCC Part 97 compliance
 * including station identification, encryption control, and content filtering.
 * Implements Track C - Spec 025 compliance UI requirements.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ComplianceManager } from '../../lib/fcc-compliance/index.js';
import { EmergencyOverrideModal } from './EmergencyOverrideModal.js';
import { ComplianceViolationsList } from './ComplianceViolationsList.js';
import { StationIDTimer } from './StationIDTimer.js';
import { TransmissionModeIndicator } from './TransmissionModeIndicator.js';

interface ComplianceDashboardProps {
  complianceManager: ComplianceManager;
  onEmergencyOverride?: (override: any) => void;
  onViolationReview?: (violation: any) => void;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  complianceManager,
  onEmergencyOverride,
  onViolationReview
}) => {
  const [status, setStatus] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Update compliance status
  const updateStatus = useCallback(async () => {
    try {
      const [complianceStatus, healthStatus] = await Promise.all([
        complianceManager.getComplianceStatus(),
        complianceManager.getSystemHealth()
      ]);

      setStatus(complianceStatus);
      setSystemHealth(healthStatus);
    } catch (error) {
      console.error('Failed to update compliance status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [complianceManager]);

  // Auto-refresh status
  useEffect(() => {
    updateStatus();

    if (autoRefresh) {
      const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [updateStatus, autoRefresh]);

  // Listen for compliance events
  useEffect(() => {
    const handleViolation = (violation: any) => {
      updateStatus();
      if (onViolationReview) {
        onViolationReview(violation);
      }
    };

    const handleStationID = () => {
      updateStatus();
    };

    complianceManager.on('violation', handleViolation);
    complianceManager.on('station-id-transmitted', handleStationID);

    return () => {
      complianceManager.off('violation', handleViolation);
      complianceManager.off('station-id-transmitted', handleStationID);
    };
  }, [complianceManager, onViolationReview, updateStatus]);

  const handleForceStationID = async () => {
    try {
      await complianceManager.forceStationID();
      updateStatus();
    } catch (error) {
      console.error('Failed to force station ID:', error);
    }
  };

  const handleEmergencyOverride = async (overrideData: any) => {
    try {
      await complianceManager.activateEmergencyOverride(
        overrideData.reason,
        overrideData.authority,
        overrideData.emergencyType
      );

      setShowEmergencyModal(false);
      updateStatus();

      if (onEmergencyOverride) {
        onEmergencyOverride(overrideData);
      }
    } catch (error) {
      console.error('Failed to activate emergency override:', error);
    }
  };

  const handleDeactivateEmergency = async () => {
    try {
      await complianceManager.deactivateEmergencyOverride();
      updateStatus();
    } catch (error) {
      console.error('Failed to deactivate emergency override:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const getComplianceColor = (level: string) => {
    switch (level) {
      case 'COMPLIANT': return 'text-green-600 bg-green-100';
      case 'WARNING': return 'text-yellow-600 bg-yellow-100';
      case 'VIOLATION': return 'text-red-600 bg-red-100';
      case 'EMERGENCY_OVERRIDE': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getTimeUntilNextID = () => {
    if (!status?.nextStationID) return 'Unknown';

    const now = new Date().getTime();
    const next = new Date(status.nextStationID).getTime();
    const diff = Math.max(0, next - now);

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">FCC Compliance Dashboard</h2>
          <p className="text-gray-600">Real-time Part 97 compliance monitoring</p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Auto-refresh</span>
          </label>

          <button
            onClick={updateStatus}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Overall Status</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplianceColor(status?.level || 'UNKNOWN')}`}>
              {status?.level || 'UNKNOWN'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {status?.compliant ? 'All systems compliant' : 'Compliance issues detected'}
          </p>
        </div>

        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">System Health</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              systemHealth?.operational ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
            }`}>
              {systemHealth?.operational ? 'OPERATIONAL' : 'DEGRADED'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Response time: {systemHealth?.responseTime?.toFixed(1) || 'N/A'}ms
          </p>
        </div>

        <div className="p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Emergency Override</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              status?.emergencyOverride ? 'text-orange-600 bg-orange-100' : 'text-gray-600 bg-gray-100'
            }`}>
              {status?.emergencyOverride ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <div className="mt-2 space-x-2">
            {status?.emergencyOverride ? (
              <button
                onClick={handleDeactivateEmergency}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => setShowEmergencyModal(true)}
                className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
              >
                Activate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Station ID Status */}
      <div className="mb-6">
        <StationIDTimer
          nextIDTime={status?.nextStationID}
          lastIDTime={status?.lastStationID}
          timeUntilNext={getTimeUntilNextID()}
          onForceID={handleForceStationID}
        />
      </div>

      {/* Transmission Mode */}
      <div className="mb-6">
        <TransmissionModeIndicator
          currentMode={systemHealth?.transmissionMode}
          encryptionBlocked={systemHealth?.encryptionGuard?.operational}
          contentFilterActive={systemHealth?.contentFilter?.operational}
        />
      </div>

      {/* Recent Violations */}
      <div className="mb-6">
        <ComplianceViolationsList
          violations={status?.recentViolations || []}
          onViolationReview={onViolationReview}
        />
      </div>

      {/* System Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Station Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Callsign:</span>
              <span className="font-mono">{status?.callsign || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Station ID:</span>
              <span>{status?.lastStationID ? formatTime(new Date(status.lastStationID)) : 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Next Station ID:</span>
              <span>{getTimeUntilNextID()}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Component Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Station ID Timer:</span>
              <span className={systemHealth?.stationIDTimer?.operational ? 'text-green-600' : 'text-red-600'}>
                {systemHealth?.stationIDTimer?.operational ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Content Filter:</span>
              <span className={systemHealth?.contentFilter?.operational ? 'text-green-600' : 'text-red-600'}>
                {systemHealth?.contentFilter?.operational ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Encryption Guard:</span>
              <span className={systemHealth?.encryptionGuard?.operational ? 'text-green-600' : 'text-red-600'}>
                {systemHealth?.encryptionGuard?.operational ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Override Modal */}
      {showEmergencyModal && (
        <EmergencyOverrideModal
          onConfirm={handleEmergencyOverride}
          onCancel={() => setShowEmergencyModal(false)}
        />
      )}
    </div>
  );
};