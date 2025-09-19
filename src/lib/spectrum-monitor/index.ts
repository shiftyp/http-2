/**
 * Spectrum Monitor Library
 * Automated content discovery through spectrum monitoring and CQ beacon detection
 */

export { SpectrumMonitor } from './SpectrumMonitor.js';
export { BeaconDecoder } from './BeaconDecoder.js';
export { ContentDiscovery } from './ContentDiscovery.js';

// Integrate with existing signal detection
export { SignalDetector } from '../signal-detector/index.js';
export { SpectrumAnalyzer } from '../spectrum-analyzer/index.js';

// Data Models
export type { SpectrumSignal } from './models/SpectrumSignal.js';
export type { BeaconContent } from './models/BeaconContent.js';
export type { DiscoveredContent } from './models/DiscoveredContent.js';

/**
 * Spectrum Monitoring Configuration
 */
export interface SpectrumMonitorConfig {
  monitoringBands: string[];
  scanInterval: number; // seconds
  beaconDetection: boolean;
  autoContentDiscovery: boolean;
  signalThreshold: number; // dB
  maxSignals: number;
}

export const DEFAULT_SPECTRUM_CONFIG: SpectrumMonitorConfig = {
  monitoringBands: ['20m', '15m', '10m', '2m', '70cm'],
  scanInterval: 60, // 1 minute
  beaconDetection: true,
  autoContentDiscovery: true,
  signalThreshold: 6, // 6 dB SNR threshold
  maxSignals: 50
};