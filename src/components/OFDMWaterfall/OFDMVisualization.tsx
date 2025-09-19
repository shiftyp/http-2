/**
 * OFDM Visualization Component
 *
 * Combined visualization interface for OFDM system monitoring
 * including waterfall, allocation matrix, and throughput dashboard.
 */

import React, { useState, useEffect } from 'react';
import { OFDMModem } from '../../lib/ofdm-modem/index.js';
import { ParallelChunkManager } from '../../lib/parallel-chunk-manager/index.js';
import { CarrierHealthMonitor } from '../../lib/carrier-health-monitor/index.js';
import { ModulationController } from '../../lib/carrier-health-monitor/modulation.js';

import OFDMWaterfall from './index.js';
import AllocationMatrix from './AllocationMatrix.js';
import ThroughputDashboard from './ThroughputDashboard.js';

export interface OFDMVisualizationProps {
  autoStart?: boolean;
  defaultView?: 'waterfall' | 'allocation' | 'throughput' | 'all';
}

type ViewMode = 'waterfall' | 'allocation' | 'throughput' | 'all';

export const OFDMVisualization: React.FC<OFDMVisualizationProps> = ({
  autoStart = true,
  defaultView = 'all'
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [isRunning, setIsRunning] = useState(false);
  const [modem, setModem] = useState<OFDMModem | null>(null);
  const [chunkManager, setChunkManager] = useState<ParallelChunkManager | null>(null);
  const [healthMonitor, setHealthMonitor] = useState<CarrierHealthMonitor | null>(null);
  const [modController, setModController] = useState<ModulationController | null>(null);

  // System stats
  const [systemStats, setSystemStats] = useState({
    carriers: 48,
    dataCarriers: 40,
    pilotCarriers: 8,
    bandwidth: 2800,
    sampleRate: 48000,
    fftSize: 64,
    mode: 'normal'
  });

  /**
   * Initialize OFDM system
   */
  useEffect(() => {
    const initSystem = () => {
      const newModem = new OFDMModem();
      const newChunkManager = new ParallelChunkManager();
      const newHealthMonitor = new CarrierHealthMonitor();
      const newModController = new ModulationController();

      newChunkManager.initialize(newModem);
      newHealthMonitor.initialize(newModem);

      setModem(newModem);
      setChunkManager(newChunkManager);
      setHealthMonitor(newHealthMonitor);
      setModController(newModController);

      // Update system stats
      const config = newModem.getConfiguration();
      setSystemStats({
        carriers: config.numCarriers,
        dataCarriers: config.numDataCarriers,
        pilotCarriers: config.numPilotCarriers,
        bandwidth: config.channelBandwidth,
        sampleRate: newModem.getSampleRate(),
        fftSize: config.fftSize,
        mode: 'normal'
      });
    };

    if (autoStart) {
      initSystem();
      setIsRunning(true);
    }

    return () => {
      if (healthMonitor) {
        healthMonitor.stop();
      }
      if (chunkManager) {
        chunkManager.reset();
      }
    };
  }, [autoStart]);

  /**
   * Start/stop system
   */
  const toggleSystem = () => {
    if (isRunning) {
      healthMonitor?.stop();
      chunkManager?.reset();
      setIsRunning(false);
    } else {
      if (!modem) {
        // Initialize if not already done
        const newModem = new OFDMModem();
        const newChunkManager = new ParallelChunkManager();
        const newHealthMonitor = new CarrierHealthMonitor();
        const newModController = new ModulationController();

        newChunkManager.initialize(newModem);
        newHealthMonitor.initialize(newModem);

        setModem(newModem);
        setChunkManager(newChunkManager);
        setHealthMonitor(newHealthMonitor);
        setModController(newModController);
      } else {
        healthMonitor?.initialize(modem);
      }
      setIsRunning(true);
    }
  };

  /**
   * Generate test traffic
   */
  const generateTestTraffic = () => {
    if (!chunkManager) return;

    const numChunks = 50;
    const chunks = Array.from({ length: numChunks }, (_, i) => ({
      id: `test_chunk_${Date.now()}_${i}`,
      pieceIndex: i,
      totalPieces: numChunks,
      data: new Uint8Array(256).map(() => Math.random() * 256),
      hash: `hash_${i}`,
      rarity: Math.random(),
      attempts: 0
    }));

    chunkManager.queueChunks(chunks);
  };

  /**
   * Simulate carrier failure
   */
  const simulateFailure = () => {
    if (!modem) return;

    // Randomly fail some carriers
    for (let i = 0; i < 5; i++) {
      const carrierId = Math.floor(Math.random() * 48);
      if (carrierId % 6 !== 0) { // Don't fail pilots
        modem.disableCarrier(carrierId);

        // Re-enable after delay
        setTimeout(() => {
          modem.enableCarrier(carrierId);
        }, 5000);
      }
    }
  };

  /**
   * Render view based on mode
   */
  const renderView = () => {
    if (!modem || !chunkManager || !healthMonitor) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <p className="mb-4">OFDM System not initialized</p>
            <button
              onClick={toggleSystem}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Initialize System
            </button>
          </div>
        </div>
      );
    }

    switch (viewMode) {
      case 'waterfall':
        return (
          <OFDMWaterfall
            modem={modem}
            healthMonitor={healthMonitor}
            updateInterval={100}
            historyLength={100}
            colorScheme="thermal"
            showPilots={true}
            showGrid={true}
          />
        );

      case 'allocation':
        return (
          <AllocationMatrix
            chunkManager={chunkManager}
            updateInterval={250}
            showLabels={true}
            compactView={false}
            maxChunksDisplay={50}
          />
        );

      case 'throughput':
        return (
          <ThroughputDashboard
            modem={modem}
            healthMonitor={healthMonitor}
            chunkManager={chunkManager}
            modController={modController}
            updateInterval={1000}
            historyLength={60}
            showDetails={true}
          />
        );

      case 'all':
        return (
          <div className="space-y-6">
            <div className="visualization-section">
              <h4 className="text-md font-medium mb-3">Spectrum Waterfall</h4>
              <OFDMWaterfall
                modem={modem}
                healthMonitor={healthMonitor}
                updateInterval={100}
                historyLength={50}
                colorScheme="thermal"
                showPilots={true}
                showGrid={true}
                height={250}
              />
            </div>

            <div className="visualization-section">
              <h4 className="text-md font-medium mb-3">Carrier Allocation</h4>
              <AllocationMatrix
                chunkManager={chunkManager}
                updateInterval={250}
                showLabels={true}
                compactView={true}
                maxChunksDisplay={30}
              />
            </div>

            <div className="visualization-section">
              <h4 className="text-md font-medium mb-3">Performance Metrics</h4>
              <ThroughputDashboard
                modem={modem}
                healthMonitor={healthMonitor}
                chunkManager={chunkManager}
                modController={modController}
                updateInterval={1000}
                historyLength={60}
                showDetails={true}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="ofdm-visualization">
      <div className="visualization-header mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">OFDM System Visualization</h2>

          <div className="controls flex gap-2">
            <button
              onClick={toggleSystem}
              className={`px-4 py-2 rounded font-medium ${
                isRunning
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isRunning ? 'Stop' : 'Start'} System
            </button>

            <button
              onClick={generateTestTraffic}
              disabled={!isRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Generate Traffic
            </button>

            <button
              onClick={simulateFailure}
              disabled={!isRunning}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              Simulate Failure
            </button>
          </div>
        </div>

        <div className="system-info mt-2 flex gap-4 text-sm text-gray-600">
          <span>Carriers: {systemStats.carriers}</span>
          <span>•</span>
          <span>Data: {systemStats.dataCarriers}</span>
          <span>•</span>
          <span>Pilots: {systemStats.pilotCarriers}</span>
          <span>•</span>
          <span>Bandwidth: {systemStats.bandwidth} Hz</span>
          <span>•</span>
          <span>Sample Rate: {systemStats.sampleRate / 1000} kHz</span>
          <span>•</span>
          <span>FFT: {systemStats.fftSize}</span>
          <span>•</span>
          <span className={`font-medium ${isRunning ? 'text-green-600' : 'text-red-600'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      <div className="view-tabs mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded">
          <button
            onClick={() => setViewMode('waterfall')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'waterfall'
                ? 'bg-white shadow font-medium'
                : 'hover:bg-gray-50'
            }`}
          >
            Waterfall
          </button>

          <button
            onClick={() => setViewMode('allocation')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'allocation'
                ? 'bg-white shadow font-medium'
                : 'hover:bg-gray-50'
            }`}
          >
            Allocation
          </button>

          <button
            onClick={() => setViewMode('throughput')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'throughput'
                ? 'bg-white shadow font-medium'
                : 'hover:bg-gray-50'
            }`}
          >
            Throughput
          </button>

          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded transition-colors ${
              viewMode === 'all'
                ? 'bg-white shadow font-medium'
                : 'hover:bg-gray-50'
            }`}
          >
            All Views
          </button>
        </div>
      </div>

      <div className="visualization-content">
        {renderView()}
      </div>
    </div>
  );
};

export default OFDMVisualization;