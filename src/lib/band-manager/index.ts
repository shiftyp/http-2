/**
 * Band Manager Library
 * Manages band conditions, propagation, and automatic band switching
 */

export { BandManager } from './BandManager.js';
export { PropagationPredictor } from './PropagationPredictor.js';
export { BandConditions } from './BandConditions.js';

// Integrate with existing radio control
export { RadioControl } from '../radio-control/index.js';

// Data Models
export type { BandCondition } from './models/BandCondition.js';
export type { PropagationData } from './models/PropagationData.js';
export type { BandUsage } from './models/BandUsage.js';

/**
 * Band Management Configuration
 */
export interface BandManagerConfig {
  enabledBands: string[];
  autoSwitching: boolean;
  propagationChecking: boolean;
  usageTracking: boolean;
  switchThreshold: number; // dB improvement needed
  checkInterval: number; // seconds
}

export const DEFAULT_BAND_CONFIG: BandManagerConfig = {
  enabledBands: ['160m', '80m', '40m', '20m', '15m', '10m', '2m', '70cm'],
  autoSwitching: true,
  propagationChecking: true,
  usageTracking: true,
  switchThreshold: 10, // 10 dB improvement to switch bands
  checkInterval: 300 // 5 minutes
};