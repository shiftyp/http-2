/**
 * OFDM Throughput Monitoring Dashboard
 *
 * Real-time performance monitoring with throughput graphs,
 * efficiency metrics, and system health indicators.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OFDMModem } from '../../lib/ofdm-modem/index.js';
import { CarrierHealthMonitor } from '../../lib/carrier-health-monitor/index.js';
import { ParallelChunkManager } from '../../lib/parallel-chunk-manager/index.js';
import { ModulationController } from '../../lib/carrier-health-monitor/modulation.js';

export interface ThroughputDashboardProps {
  modem: OFDMModem;
  healthMonitor: CarrierHealthMonitor;
  chunkManager: ParallelChunkManager;
  modController?: ModulationController;
  updateInterval?: number;
  historyLength?: number;
  showDetails?: boolean;
}

interface ThroughputSample {
  timestamp: number;
  throughput: number; // bps
  chunksPerSecond: number;
  activeCarriers: number;
  avgSNR: number;
  avgModulation: number; // bits per symbol
  efficiency: number; // 0-1
}

interface SystemMetrics {
  currentThroughput: number;
  peakThroughput: number;
  avgThroughput: number;
  totalTransmitted: number; // bytes
  successRate: number;
  activeTime: number; // seconds
  spectralEfficiency: number; // bits/Hz
}

export const ThroughputDashboard: React.FC<ThroughputDashboardProps> = ({
  modem,
  healthMonitor,
  chunkManager,
  modController,
  updateInterval = 1000,
  historyLength = 60,
  showDetails = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [throughputHistory, setThroughputHistory] = useState<ThroughputSample[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    currentThroughput: 0,
    peakThroughput: 0,
    avgThroughput: 0,
    totalTransmitted: 0,
    successRate: 0,
    activeTime: 0,
    spectralEfficiency: 0
  });
  const [carrierStats, setCarrierStats] = useState({
    total: 48,
    active: 0,
    disabled: 0,
    pilots: 8
  });
  const [modulationDist, setModulationDist] = useState<Map<string, number>>(new Map());
  const startTime = useRef<number>(Date.now());

  /**
   * Calculate current throughput
   */
  const calculateThroughput = useCallback((): ThroughputSample => {
    const stats = healthMonitor.getStatistics();
    const chunkStats = chunkManager.getAllocationStatus();

    // Calculate bits per symbol across carriers
    let totalBitsPerSymbol = 0;
    let activeCount = 0;

    for (let i = 0; i < 48; i++) {
      const health = healthMonitor.getCarrierHealth(i);
      if (health && health.enabled && i % 6 !== 0) { // Skip pilots
        activeCount++;
        const bps = getModulationBits(health.modulation);
        totalBitsPerSymbol += bps;
      }
    }

    const avgBitsPerSymbol = activeCount > 0 ? totalBitsPerSymbol / activeCount : 0;

    // Calculate throughput
    const symbolRate = 37500; // symbols/sec
    const throughput = symbolRate * totalBitsPerSymbol; // Total bits/sec
    const chunksPerSecond = chunkStats.throughput;

    // Calculate efficiency (actual vs theoretical max)
    const maxThroughput = symbolRate * activeCount * 6; // 6 bits for 64-QAM
    const efficiency = maxThroughput > 0 ? throughput / maxThroughput : 0;

    return {
      timestamp: Date.now(),
      throughput,
      chunksPerSecond,
      activeCarriers: activeCount,
      avgSNR: stats.averageSNR,
      avgModulation: avgBitsPerSymbol,
      efficiency
    };
  }, [healthMonitor, chunkManager]);

  /**
   * Get bits per symbol for modulation type
   */
  const getModulationBits = (modulation: string): number => {
    const modMap: Record<string, number> = {
      'BPSK': 1,
      'QPSK': 2,
      '8PSK': 3,
      '16QAM': 4,
      '32QAM': 5,
      '64QAM': 6,
      '128QAM': 7,
      '256QAM': 8
    };
    return modMap[modulation] || 2;
  };

  /**
   * Update metrics
   */
  const updateMetrics = useCallback((history: ThroughputSample[]) => {
    if (history.length === 0) return;

    const current = history[history.length - 1];
    const peak = Math.max(...history.map(s => s.throughput));
    const avg = history.reduce((sum, s) => sum + s.throughput, 0) / history.length;
    const activeTime = (Date.now() - startTime.current) / 1000;

    // Calculate total transmitted (approximate)
    const totalBytes = history.reduce((sum, s) =>
      sum + (s.throughput * updateInterval / 8000), 0
    );

    // Calculate spectral efficiency
    const bandwidth = 2800; // Hz
    const spectralEff = current.throughput / bandwidth;

    // Calculate success rate from chunk manager
    const chunkStats = chunkManager.getAllocationStatus();
    const totalAttempts = chunkStats.completed + chunkStats.failed;
    const successRate = totalAttempts > 0
      ? chunkStats.completed / totalAttempts
      : 0;

    setMetrics({
      currentThroughput: current.throughput,
      peakThroughput: peak,
      avgThroughput: avg,
      totalTransmitted: totalBytes,
      successRate,
      activeTime,
      spectralEfficiency: spectralEff
    });
  }, [updateInterval, chunkManager]);

  /**
   * Update carrier statistics
   */
  const updateCarrierStats = useCallback(() => {
    const stats = healthMonitor.getStatistics();

    setCarrierStats({
      total: stats.totalCarriers,
      active: stats.enabledCarriers,
      disabled: stats.totalCarriers - stats.enabledCarriers,
      pilots: 8
    });

    // Update modulation distribution
    if (modController) {
      const dist = modController.getModulationDistribution();
      setModulationDist(dist);
    } else {
      // Get from health monitor
      const dist = new Map<string, number>();
      for (let i = 0; i < 48; i++) {
        const health = healthMonitor.getCarrierHealth(i);
        if (health && health.enabled) {
          const count = dist.get(health.modulation) || 0;
          dist.set(health.modulation, count + 1);
        }
      }
      setModulationDist(dist);
    }
  }, [healthMonitor, modController]);

  /**
   * Draw throughput graph
   */
  const drawGraph = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    if (throughputHistory.length < 2) return;

    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Find max throughput for scaling
    const maxThroughput = Math.max(...throughputHistory.map(s => s.throughput));
    const scale = maxThroughput > 0 ? graphHeight / maxThroughput : 1;

    // Draw grid
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * graphHeight / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const value = ((5 - i) * maxThroughput / 5 / 1000).toFixed(0); // kbps
      ctx.fillText(`${value}k`, padding - 5, y + 3);
    }

    // Vertical grid lines (time)
    for (let i = 0; i <= 6; i++) {
      const x = padding + (i * graphWidth / 6);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      // Time label
      const timeAgo = Math.floor((6 - i) * historyLength / 6);
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`-${timeAgo}s`, x, height - padding + 15);
    }

    // Draw throughput line
    ctx.strokeStyle = '#3B82F6'; // Blue
    ctx.lineWidth = 2;
    ctx.beginPath();

    throughputHistory.forEach((sample, i) => {
      const x = padding + (i / (historyLength - 1)) * graphWidth;
      const y = padding + graphHeight - (sample.throughput * scale);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw efficiency area (fill under line)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.beginPath();
    ctx.moveTo(padding, padding + graphHeight);

    throughputHistory.forEach((sample, i) => {
      const x = padding + (i / (historyLength - 1)) * graphWidth;
      const y = padding + graphHeight - (sample.throughput * scale);
      ctx.lineTo(x, y);
    });

    ctx.lineTo(width - padding, padding + graphHeight);
    ctx.closePath();
    ctx.fill();

    // Draw current value
    const current = throughputHistory[throughputHistory.length - 1];
    const currentX = width - padding;
    const currentY = padding + graphHeight - (current.throughput * scale);

    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Current value label
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${(current.throughput / 1000).toFixed(1)} kbps`,
      currentX - 10,
      currentY - 10
    );

    // Labels
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time', width / 2, height - 5);

    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Throughput (kbps)', 0, 0);
    ctx.restore();
  }, [throughputHistory, historyLength]);

  /**
   * Collect and update data
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const sample = calculateThroughput();

      setThroughputHistory(prev => {
        const updated = [...prev, sample];
        if (updated.length > historyLength) {
          return updated.slice(-historyLength);
        }
        return updated;
      });

      updateCarrierStats();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [calculateThroughput, updateCarrierStats, updateInterval, historyLength]);

  /**
   * Update metrics when history changes
   */
  useEffect(() => {
    updateMetrics(throughputHistory);
  }, [throughputHistory, updateMetrics]);

  /**
   * Draw graph when data updates
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGraph(ctx, canvas.width, canvas.height);
  }, [drawGraph]);

  /**
   * Format bytes for display
   */
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /**
   * Format throughput for display
   */
  const formatThroughput = (bps: number): string => {
    if (bps < 1000) return `${bps.toFixed(0)} bps`;
    if (bps < 1000000) return `${(bps / 1000).toFixed(1)} kbps`;
    return `${(bps / 1000000).toFixed(2)} Mbps`;
  };

  return (
    <div className="throughput-dashboard">
      <div className="dashboard-header mb-4">
        <h3 className="text-lg font-semibold">System Performance</h3>
      </div>

      <div className="metrics-grid grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="metric-card bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500 uppercase">Current</div>
          <div className="text-xl font-bold text-blue-600">
            {formatThroughput(metrics.currentThroughput)}
          </div>
        </div>

        <div className="metric-card bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500 uppercase">Peak</div>
          <div className="text-xl font-bold text-green-600">
            {formatThroughput(metrics.peakThroughput)}
          </div>
        </div>

        <div className="metric-card bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500 uppercase">Average</div>
          <div className="text-xl font-bold text-gray-700">
            {formatThroughput(metrics.avgThroughput)}
          </div>
        </div>

        <div className="metric-card bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500 uppercase">Efficiency</div>
          <div className="text-xl font-bold text-purple-600">
            {(metrics.spectralEfficiency).toFixed(2)} bits/Hz
          </div>
        </div>
      </div>

      <div className="graph-section bg-white p-4 rounded shadow mb-4">
        <h4 className="text-sm font-medium mb-2">Throughput History</h4>
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {showDetails && (
        <div className="details-section grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="carrier-status bg-white p-4 rounded shadow">
            <h4 className="text-sm font-medium mb-3">Carrier Status</h4>

            <div className="carrier-bars space-y-2">
              <div className="bar-item">
                <div className="flex justify-between text-sm mb-1">
                  <span>Active Carriers</span>
                  <span>{carrierStats.active}/{carrierStats.total - carrierStats.pilots}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${(carrierStats.active / (carrierStats.total - carrierStats.pilots)) * 100}%`
                    }}
                  />
                </div>
              </div>

              <div className="bar-item">
                <div className="flex justify-between text-sm mb-1">
                  <span>Success Rate</span>
                  <span>{(metrics.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${metrics.successRate * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="carrier-stats mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Total:</span>
                <span className="ml-2 font-medium">{carrierStats.total}</span>
              </div>
              <div>
                <span className="text-gray-500">Pilots:</span>
                <span className="ml-2 font-medium">{carrierStats.pilots}</span>
              </div>
              <div>
                <span className="text-gray-500">Disabled:</span>
                <span className="ml-2 font-medium">{carrierStats.disabled}</span>
              </div>
              <div>
                <span className="text-gray-500">Data:</span>
                <span className="ml-2 font-medium">{carrierStats.active}</span>
              </div>
            </div>
          </div>

          <div className="modulation-dist bg-white p-4 rounded shadow">
            <h4 className="text-sm font-medium mb-3">Modulation Distribution</h4>

            <div className="modulation-bars space-y-2">
              {Array.from(modulationDist.entries())
                .sort((a, b) => getModulationBits(b[0]) - getModulationBits(a[0]))
                .map(([mod, count]) => (
                  <div key={mod} className="bar-item">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{mod}</span>
                      <span>{count} carriers</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          getModulationBits(mod) >= 6 ? 'bg-purple-500' :
                          getModulationBits(mod) >= 4 ? 'bg-blue-500' :
                          getModulationBits(mod) >= 2 ? 'bg-green-500' :
                          'bg-yellow-500'
                        }`}
                        style={{
                          width: `${(count / (carrierStats.total - carrierStats.pilots)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="summary-stats mt-4 p-3 bg-gray-50 rounded text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <span className="text-gray-500">Transmitted:</span>
            <span className="ml-2 font-medium">{formatBytes(metrics.totalTransmitted)}</span>
          </div>
          <div>
            <span className="text-gray-500">Active Time:</span>
            <span className="ml-2 font-medium">{metrics.activeTime.toFixed(0)}s</span>
          </div>
          <div>
            <span className="text-gray-500">Avg SNR:</span>
            <span className="ml-2 font-medium">
              {throughputHistory.length > 0
                ? throughputHistory[throughputHistory.length - 1].avgSNR.toFixed(1)
                : '0.0'} dB
            </span>
          </div>
          <div>
            <span className="text-gray-500">Avg Modulation:</span>
            <span className="ml-2 font-medium">
              {throughputHistory.length > 0
                ? throughputHistory[throughputHistory.length - 1].avgModulation.toFixed(1)
                : '0.0'} bits/symbol
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThroughputDashboard;