/**
 * SDR Support Library - Main Entry Point
 * Wide-band spectrum monitoring with WebUSB device support
 */

export { SDRDeviceManager } from './sdr-device-manager/index.js';
export { SpectrumMonitor } from './spectrum-monitor/index.js';
export { SignalDecoder } from './signal-decoder/index.js';
export { WaterfallDisplay } from './waterfall-display/index.js';
export { AutoDiscoveryCache } from './auto-discovery-cache/index.js';

// Data Models
export type { SDRDevice } from './models/SDRDevice.js';
export type { SDRCapabilities } from './models/SDRCapabilities.js';
export type { MonitoringConfiguration } from './models/MonitoringConfiguration.js';
export type { FrequencyRange } from './models/FrequencyRange.js';
export type { SpectrumData } from './models/SpectrumData.js';
export type { SignalPeak } from './models/SignalPeak.js';
export type { DecodedTransmission } from './models/DecodedTransmission.js';
export type { SignalQuality } from './models/SignalQuality.js';
export type { AutoDiscoveryCache as AutoDiscoveryCacheModel } from './models/AutoDiscoveryCache.js';
export type { WaterfallDisplay as WaterfallDisplayModel } from './models/WaterfallDisplay.js';

// Device Drivers
export { RTLSDRDriver } from './drivers/rtl-sdr.js';
export { HackRFDriver } from './drivers/hackrf.js';
export { LimeSDRDriver } from './drivers/limesdr.js';
export { PlutoSDRDriver } from './drivers/plutosdr.js';
export { SDRplayDriver } from './drivers/sdrplay.js';

// Constants
export { SDR_USB_DEVICES, type SDRDeviceType } from '../../types/webusb.js';

/**
 * SDR Support Configuration
 */
export interface SDRSupportConfig {
  enableAutoDiscovery: boolean;
  monitoringBands: FrequencyRange[];
  maxSimultaneousDevices: number;
  fftSize: number;
  waterfallUpdateRate: number;
  signalThreshold: number;
  cacheSizeLimit: number;
}

/**
 * Default SDR configuration for ham radio frequencies
 */
export const DEFAULT_SDR_CONFIG: SDRSupportConfig = {
  enableAutoDiscovery: true,
  monitoringBands: [
    { startFreq: 14000000, endFreq: 14350000, name: '20m' },  // 20 meter band
    { startFreq: 21000000, endFreq: 21450000, name: '15m' },  // 15 meter band
    { startFreq: 28000000, endFreq: 29700000, name: '10m' },  // 10 meter band
    { startFreq: 144000000, endFreq: 148000000, name: '2m' }, // 2 meter band
    { startFreq: 420000000, endFreq: 450000000, name: '70cm' } // 70cm band
  ],
  maxSimultaneousDevices: 4,
  fftSize: 2048,
  waterfallUpdateRate: 30, // FPS
  signalThreshold: -80, // dBm
  cacheSizeLimit: 50 * 1024 * 1024 // 50MB
};