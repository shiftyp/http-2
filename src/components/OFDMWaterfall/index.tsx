/**
 * OFDM Waterfall Visualization Component
 *
 * Real-time spectrum waterfall display showing OFDM carrier
 * activity, SNR levels, and modulation schemes.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { OFDMModem } from '../../lib/ofdm-modem/index.js';
import { CarrierHealthMonitor } from '../../lib/carrier-health-monitor/index.js';
import type { CarrierHealth } from '../../lib/carrier-health-monitor/index.js';

export interface OFDMWaterfallProps {
  modem: OFDMModem;
  healthMonitor: CarrierHealthMonitor;
  updateInterval?: number; // ms
  historyLength?: number; // Number of time samples to display
  colorScheme?: 'thermal' | 'rainbow' | 'grayscale';
  showPilots?: boolean;
  showGrid?: boolean;
  height?: number;
  width?: number;
}

interface SpectrumData {
  timestamp: number;
  carriers: Array<{
    id: number;
    snr: number;
    power: number;
    modulation: string;
    enabled: boolean;
    isPilot: boolean;
  }>;
}

export const OFDMWaterfall: React.FC<OFDMWaterfallProps> = ({
  modem,
  healthMonitor,
  updateInterval = 100,
  historyLength = 100,
  colorScheme = 'thermal',
  showPilots = true,
  showGrid = true,
  height = 400,
  width = 800
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [spectrumHistory, setSpectrumHistory] = useState<SpectrumData[]>([]);
  const [isPaused, setPaused] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  // Pilot carrier positions
  const pilotCarriers = [0, 6, 12, 18, 24, 30, 36, 42];

  /**
   * Get color based on SNR value
   */
  const getColor = useCallback((snr: number, enabled: boolean): string => {
    if (!enabled) return 'rgba(0, 0, 0, 0.8)';

    const normalized = Math.max(0, Math.min(1, snr / 30)); // Normalize 0-30 dB

    switch (colorScheme) {
      case 'thermal': {
        // Black -> Red -> Yellow -> White
        if (normalized < 0.25) {
          const t = normalized * 4;
          return `rgb(${Math.floor(t * 255)}, 0, 0)`;
        } else if (normalized < 0.5) {
          const t = (normalized - 0.25) * 4;
          return `rgb(255, ${Math.floor(t * 255)}, 0)`;
        } else if (normalized < 0.75) {
          const t = (normalized - 0.5) * 4;
          return `rgb(255, 255, ${Math.floor(t * 255)})`;
        } else {
          return 'rgb(255, 255, 255)';
        }
      }
      case 'rainbow': {
        // HSL color space
        const hue = (1 - normalized) * 240; // Blue to Red
        return `hsl(${hue}, 100%, 50%)`;
      }
      case 'grayscale': {
        const gray = Math.floor(normalized * 255);
        return `rgb(${gray}, ${gray}, ${gray})`;
      }
      default:
        return `rgb(0, ${Math.floor(normalized * 255)}, 0)`;
    }
  }, [colorScheme]);

  /**
   * Collect spectrum data
   */
  const collectSpectrumData = useCallback((): SpectrumData => {
    const carriers = healthMonitor.getAllCarrierHealth();

    return {
      timestamp: Date.now(),
      carriers: carriers.map(carrier => ({
        id: carrier.id,
        snr: carrier.snr,
        power: carrier.powerLevel,
        modulation: carrier.modulation,
        enabled: carrier.enabled,
        isPilot: pilotCarriers.includes(carrier.id)
      }))
    };
  }, [healthMonitor, pilotCarriers]);

  /**
   * Draw waterfall display
   */
  const drawWaterfall = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);

    const carrierWidth = width / 48;
    const timeHeight = height / historyLength;

    // Draw spectrum history (waterfall)
    spectrumHistory.forEach((spectrum, timeIndex) => {
      const y = timeIndex * timeHeight;

      spectrum.carriers.forEach((carrier, carrierIndex) => {
        if (!showPilots && carrier.isPilot) return;

        const x = carrierIndex * carrierWidth;
        ctx.fillStyle = getColor(carrier.snr, carrier.enabled);
        ctx.fillRect(x, y, carrierWidth, timeHeight);

        // Pilot carrier indicator
        if (carrier.isPilot && showPilots) {
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, carrierWidth, timeHeight);
        }
      });
    });

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;

      // Vertical lines (carrier boundaries)
      for (let i = 0; i <= 48; i++) {
        const x = i * carrierWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines (time markers)
      for (let i = 0; i <= 10; i++) {
        const y = (i / 10) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Highlight selected carrier
    if (selectedCarrier !== null) {
      const x = selectedCarrier * carrierWidth;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, 0, carrierWidth, height);
    }

    // Draw tooltip
    if (mousePosition && spectrumHistory.length > 0) {
      const carrierIndex = Math.floor(mousePosition.x / carrierWidth);
      const timeIndex = Math.floor(mousePosition.y / timeHeight);

      if (carrierIndex >= 0 && carrierIndex < 48 &&
          timeIndex >= 0 && timeIndex < spectrumHistory.length) {
        const spectrum = spectrumHistory[timeIndex];
        const carrier = spectrum.carriers[carrierIndex];

        if (carrier) {
          // Draw tooltip background
          const tooltipWidth = 150;
          const tooltipHeight = 80;
          const tooltipX = Math.min(mousePosition.x + 10, width - tooltipWidth);
          const tooltipY = Math.min(mousePosition.y + 10, height - tooltipHeight);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
          ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

          ctx.fillStyle = 'white';
          ctx.font = '11px monospace';
          ctx.fillText(`Carrier: ${carrier.id}${carrier.isPilot ? ' (Pilot)' : ''}`, tooltipX + 5, tooltipY + 15);
          ctx.fillText(`SNR: ${carrier.snr.toFixed(1)} dB`, tooltipX + 5, tooltipY + 30);
          ctx.fillText(`Power: ${(carrier.power * 100).toFixed(0)}%`, tooltipX + 5, tooltipY + 45);
          ctx.fillText(`Mod: ${carrier.modulation}`, tooltipX + 5, tooltipY + 60);
          ctx.fillText(`Status: ${carrier.enabled ? 'Active' : 'Disabled'}`, tooltipX + 5, tooltipY + 75);
        }
      }
    }
  }, [spectrumHistory, width, height, historyLength, showPilots, showGrid,
      selectedCarrier, mousePosition, getColor]);

  /**
   * Animation loop
   */
  const animate = useCallback(() => {
    if (!isPaused) {
      const newData = collectSpectrumData();

      setSpectrumHistory(prev => {
        const updated = [...prev, newData];
        if (updated.length > historyLength) {
          return updated.slice(-historyLength);
        }
        return updated;
      });
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [isPaused, collectSpectrumData, historyLength]);

  /**
   * Handle mouse move for tooltip
   */
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }, []);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    setMousePosition(null);
  }, []);

  /**
   * Handle click to select carrier
   */
  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const carrierIndex = Math.floor(x / (width / 48));

    if (carrierIndex >= 0 && carrierIndex < 48) {
      setSelectedCarrier(prev => prev === carrierIndex ? null : carrierIndex);
    }
  }, [width]);

  // Start animation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Update canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawWaterfall(ctx);
  }, [drawWaterfall]);

  // Update at regular intervals
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) drawWaterfall(ctx);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval, isPaused, drawWaterfall]);

  return (
    <div className="ofdm-waterfall">
      <div className="waterfall-controls mb-2 flex gap-2">
        <button
          onClick={() => setPaused(!isPaused)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={() => setSpectrumHistory([])}
          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Clear
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm">Color Scheme:</label>
          <select
            value={colorScheme}
            onChange={(e) => window.location.reload()} // Simple refresh for demo
            className="px-2 py-1 border rounded"
          >
            <option value="thermal">Thermal</option>
            <option value="rainbow">Rainbow</option>
            <option value="grayscale">Grayscale</option>
          </select>
        </div>
      </div>

      <div className="waterfall-display border border-gray-300 rounded">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
      </div>

      <div className="waterfall-legend mt-2 flex justify-between text-xs">
        <div>0 Hz</div>
        <div>Carrier Frequency (48 subcarriers)</div>
        <div>2.8 kHz</div>
      </div>

      {selectedCarrier !== null && (
        <div className="carrier-details mt-2 p-2 bg-gray-100 rounded text-sm">
          <strong>Selected Carrier {selectedCarrier}:</strong>
          {' '}
          {pilotCarriers.includes(selectedCarrier) ? 'Pilot Carrier' : 'Data Carrier'}
          {' • '}
          Frequency: {((selectedCarrier / 48) * 2800).toFixed(0)} Hz
        </div>
      )}
    </div>
  );
};

export default OFDMWaterfall;