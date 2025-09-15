/**
 * Transmission Mode Toggle Component
 *
 * UI component for switching between RF and WebRTC transmission modes
 */

import React, { useState, useEffect } from 'react';
import { TransmissionModeManager, TransmissionMode, ConnectionStatus } from '../lib/transmission-mode/TransmissionModeManager.js';

interface TransmissionModeToggleProps {
  modeManager: TransmissionModeManager;
  onModeChange?: (mode: TransmissionMode) => void;
}

export const TransmissionModeToggle: React.FC<TransmissionModeToggleProps> = ({
  modeManager,
  onModeChange
}) => {
  const [currentMode, setCurrentMode] = useState<TransmissionMode>(modeManager.getCurrentMode());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    // Subscribe to mode changes
    const handleModeChange = (status: ConnectionStatus) => {
      setCurrentMode(status.mode);
      setConnectionStatus(status);
      setSwitching(false);
      onModeChange?.(status.mode);
    };

    modeManager.onModeChange(handleModeChange);

    // Get initial status
    setConnectionStatus(modeManager.getConnectionStatus());

    // Cleanup
    return () => {
      modeManager.offModeChange(handleModeChange);
    };
  }, [modeManager, onModeChange]);

  const handleModeSwitch = async (newMode: TransmissionMode) => {
    if (newMode === currentMode || switching) {
      return;
    }

    setSwitching(true);

    try {
      await modeManager.switchToMode(newMode);
    } catch (error) {
      console.error('Failed to switch transmission mode:', error);
      setSwitching(false);
      // Could show error notification here
    }
  };

  const getModeIcon = (mode: TransmissionMode) => {
    switch (mode) {
      case TransmissionMode.RF:
        return '📻';
      case TransmissionMode.WebRTC:
        return '🌐';
      case TransmissionMode.HYBRID:
        return '⚡';
      default:
        return '❓';
    }
  };

  const getModeDescription = (mode: TransmissionMode) => {
    switch (mode) {
      case TransmissionMode.RF:
        return 'Radio Frequency (14.4kbps)';
      case TransmissionMode.WebRTC:
        return 'WebRTC Direct (1MB/s)';
      case TransmissionMode.HYBRID:
        return 'Hybrid Mode (Auto)';
      default:
        return 'Unknown Mode';
    }
  };

  const getBandwidthInfo = () => {
    if (!connectionStatus) return '';

    const { capabilities } = connectionStatus;
    const mbps = (capabilities.maxBandwidth / 1048576).toFixed(1);
    return `${mbps} MB/s max, ${capabilities.latency}ms latency`;
  };

  return (
    <div className="transmission-mode-toggle">
      <div className="mode-header">
        <h3>Transmission Mode</h3>
        <div className="connection-indicator">
          <span className={`status-dot ${currentMode.toLowerCase()}`}></span>
          <span className="status-text">{getModeDescription(currentMode)}</span>
        </div>
      </div>

      <div className="mode-buttons">
        {Object.values(TransmissionMode).map((mode) => (
          <button
            key={mode}
            className={`mode-button ${currentMode === mode ? 'active' : ''} ${switching ? 'disabled' : ''}`}
            onClick={() => handleModeSwitch(mode)}
            disabled={switching}
            title={getModeDescription(mode)}
          >
            <span className="mode-icon">{getModeIcon(mode)}</span>
            <span className="mode-label">{mode}</span>
          </button>
        ))}
      </div>

      {connectionStatus && (
        <div className="connection-details">
          <div className="detail-row">
            <span className="label">WebRTC Peers:</span>
            <span className="value">{connectionStatus.webrtcPeers}</span>
          </div>
          <div className="detail-row">
            <span className="label">RF Peers:</span>
            <span className="value">{connectionStatus.rfPeers}</span>
          </div>
          <div className="detail-row">
            <span className="label">Bandwidth:</span>
            <span className="value">{getBandwidthInfo()}</span>
          </div>
          <div className="detail-row">
            <span className="label">Uptime:</span>
            <span className="value">{Math.floor(connectionStatus.uptime / 1000)}s</span>
          </div>
        </div>
      )}

      {switching && (
        <div className="switching-indicator">
          <div className="spinner"></div>
          <span>Switching transmission mode...</span>
        </div>
      )}

      <style jsx>{`
        .transmission-mode-toggle {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 16px;
          margin: 8px 0;
          color: #fff;
        }

        .mode-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .mode-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .connection-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #666;
        }

        .status-dot.rf {
          background: #ff6b35;
        }

        .status-dot.webrtc {
          background: #4ade80;
        }

        .status-dot.hybrid {
          background: #fbbf24;
        }

        .status-text {
          font-size: 12px;
          color: #ccc;
        }

        .mode-buttons {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .mode-button {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          color: #ccc;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-button:hover {
          background: #333;
          border-color: #555;
        }

        .mode-button.active {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: white;
        }

        .mode-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-icon {
          font-size: 20px;
        }

        .mode-label {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .connection-details {
          background: #0a0a0a;
          border-radius: 4px;
          padding: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .detail-row:last-child {
          margin-bottom: 0;
        }

        .label {
          font-size: 12px;
          color: #888;
        }

        .value {
          font-size: 12px;
          color: #fff;
          font-weight: 500;
        }

        .switching-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 8px;
          background: #1e3a8a;
          border-radius: 4px;
          font-size: 12px;
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};