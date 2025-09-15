/**
 * SDRDevice Model
 * Represents a connected Software-Defined Radio device
 */

import { SDRDeviceType, SDRDeviceCapabilities } from '../../../types/webusb';

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export interface SDRDevice {
  /** Unique device identifier */
  id: string;

  /** Type of SDR device */
  type: SDRDeviceType;

  /** USB vendor ID */
  vendorId: number;

  /** USB product ID */
  productId: number;

  /** Device serial number (for multi-device support) */
  serialNumber?: string;

  /** Manufacturer name */
  manufacturerName?: string;

  /** Product name */
  productName?: string;

  /** Device capabilities and limitations */
  capabilities: SDRDeviceCapabilities;

  /** Current connection status */
  connectionStatus: ConnectionStatus;

  /** Last successful communication timestamp */
  lastSeen?: Date;

  /** Reference to the underlying USB device */
  usbDevice?: USBDevice;

  /** Device configuration state */
  configuration?: SDRDeviceConfiguration;
}

export interface SDRDeviceConfiguration {
  /** Current center frequency in Hz */
  centerFrequency?: number;

  /** Current sample rate in Hz */
  sampleRate?: number;

  /** Current RF gain setting */
  gain?: number;

  /** Current bandwidth in Hz */
  bandwidth?: number;

  /** Configuration timestamp */
  configuredAt?: Date;
}

/**
 * Validation rules for SDRDevice
 */
export class SDRDeviceValidator {
  /**
   * Validates SDRDevice properties
   */
  static validate(device: Partial<SDRDevice>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!device.id) {
      errors.push('Device ID is required');
    }

    if (!device.type) {
      errors.push('Device type is required');
    }

    if (device.vendorId === undefined || device.vendorId === null) {
      errors.push('Vendor ID is required');
    }

    if (device.productId === undefined || device.productId === null) {
      errors.push('Product ID is required');
    }

    if (!device.capabilities) {
      errors.push('Device capabilities are required');
    }

    if (!device.connectionStatus) {
      errors.push('Connection status is required');
    }

    // Validate capabilities if present
    if (device.capabilities) {
      const capErrors = SDRDeviceValidator.validateCapabilities(device.capabilities);
      errors.push(...capErrors);
    }

    // Validate configuration if present
    if (device.configuration) {
      const configErrors = SDRDeviceValidator.validateConfiguration(
        device.configuration,
        device.capabilities
      );
      errors.push(...configErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates device capabilities
   */
  static validateCapabilities(capabilities: SDRDeviceCapabilities): string[] {
    const errors: string[] = [];

    if (capabilities.minFrequency >= capabilities.maxFrequency) {
      errors.push('Minimum frequency must be less than maximum frequency');
    }

    if (capabilities.maxBandwidth <= 0) {
      errors.push('Maximum bandwidth must be positive');
    }

    if (!capabilities.sampleRates || capabilities.sampleRates.length === 0) {
      errors.push('At least one sample rate must be specified');
    }

    if (capabilities.sampleRates?.some(rate => rate <= 0)) {
      errors.push('All sample rates must be positive');
    }

    if (capabilities.gainRange) {
      if (capabilities.gainRange.min > capabilities.gainRange.max) {
        errors.push('Gain range minimum must be less than or equal to maximum');
      }
    }

    return errors;
  }

  /**
   * Validates device configuration against capabilities
   */
  static validateConfiguration(
    config: SDRDeviceConfiguration,
    capabilities?: SDRDeviceCapabilities
  ): string[] {
    const errors: string[] = [];

    if (config.centerFrequency && capabilities) {
      if (config.centerFrequency < capabilities.minFrequency ||
          config.centerFrequency > capabilities.maxFrequency) {
        errors.push(
          `Center frequency ${config.centerFrequency} Hz is outside device range ` +
          `${capabilities.minFrequency}-${capabilities.maxFrequency} Hz`
        );
      }
    }

    if (config.sampleRate && capabilities?.sampleRates) {
      if (!capabilities.sampleRates.includes(config.sampleRate)) {
        errors.push(
          `Sample rate ${config.sampleRate} Hz is not supported. ` +
          `Supported rates: ${capabilities.sampleRates.join(', ')} Hz`
        );
      }
    }

    if (config.gain && capabilities?.gainRange) {
      if (config.gain < capabilities.gainRange.min ||
          config.gain > capabilities.gainRange.max) {
        errors.push(
          `Gain ${config.gain} dB is outside device range ` +
          `${capabilities.gainRange.min}-${capabilities.gainRange.max} dB`
        );
      }
    }

    if (config.bandwidth && capabilities) {
      if (config.bandwidth > capabilities.maxBandwidth) {
        errors.push(
          `Bandwidth ${config.bandwidth} Hz exceeds device maximum ` +
          `${capabilities.maxBandwidth} Hz`
        );
      }
    }

    return errors;
  }
}

/**
 * Factory for creating SDRDevice instances
 */
export class SDRDeviceFactory {
  /**
   * Creates an SDRDevice from USB device information
   */
  static fromUSBDevice(usbDevice: USBDevice, capabilities: SDRDeviceCapabilities): SDRDevice {
    const deviceType = SDRDeviceFactory.determineDeviceType(
      usbDevice.vendorId,
      usbDevice.productId
    );

    if (!deviceType) {
      throw new Error(
        `Unsupported SDR device: vendor=0x${usbDevice.vendorId.toString(16)}, ` +
        `product=0x${usbDevice.productId.toString(16)}`
      );
    }

    const device: SDRDevice = {
      id: `${deviceType.toLowerCase()}-${usbDevice.serialNumber || Date.now()}`,
      type: deviceType,
      vendorId: usbDevice.vendorId,
      productId: usbDevice.productId,
      serialNumber: usbDevice.serialNumber,
      manufacturerName: usbDevice.manufacturerName,
      productName: usbDevice.productName,
      capabilities,
      connectionStatus: ConnectionStatus.DISCONNECTED,
      lastSeen: new Date(),
      usbDevice
    };

    const validation = SDRDeviceValidator.validate(device);
    if (!validation.valid) {
      throw new Error(`Invalid SDR device: ${validation.errors.join(', ')}`);
    }

    return device;
  }

  /**
   * Determines device type from USB vendor/product IDs
   */
  private static determineDeviceType(vendorId: number, productId: number): SDRDeviceType | null {
    // RTL-SDR devices
    if (vendorId === 0x0bda && (productId === 0x2838 || productId === 0x2832)) {
      return 'RTL_SDR';
    }

    // HackRF devices
    if (vendorId === 0x1d50 && productId === 0x6089) {
      return 'HACKRF';
    }

    // LimeSDR devices
    if ((vendorId === 0x1d50 && productId === 0x6108) ||
        (vendorId === 0x0403 && productId === 0x601f)) {
      return 'LIMESDR';
    }

    // PlutoSDR devices
    if (vendorId === 0x0456 && productId === 0xb673) {
      return 'PLUTOSDR';
    }

    // SDRplay devices
    if (vendorId === 0x1df7 && [0x2500, 0x2e0c, 0x3800, 0x3801, 0x3802].includes(productId)) {
      return 'SDRPLAY';
    }

    return null;
  }
}

/**
 * Utility functions for SDRDevice
 */
export class SDRDeviceUtils {
  /**
   * Checks if a frequency is within amateur radio bands
   */
  static isAmateurRadioFrequency(frequency: number): boolean {
    const amateurBands = [
      { min: 1800000, max: 2000000 },     // 160m
      { min: 3500000, max: 4000000 },     // 80m
      { min: 7000000, max: 7300000 },     // 40m
      { min: 10100000, max: 10150000 },   // 30m
      { min: 14000000, max: 14350000 },   // 20m
      { min: 18068000, max: 18168000 },   // 17m
      { min: 21000000, max: 21450000 },   // 15m
      { min: 24890000, max: 24990000 },   // 12m
      { min: 28000000, max: 29700000 },   // 10m
      { min: 50000000, max: 54000000 },   // 6m
      { min: 144000000, max: 148000000 }, // 2m
      { min: 420000000, max: 450000000 }  // 70cm
    ];

    return amateurBands.some(band =>
      frequency >= band.min && frequency <= band.max
    );
  }

  /**
   * Gets the amateur radio band name for a frequency
   */
  static getAmateurRadioBand(frequency: number): string | null {
    const bands = [
      { min: 1800000, max: 2000000, name: '160M' },
      { min: 3500000, max: 4000000, name: '80M' },
      { min: 7000000, max: 7300000, name: '40M' },
      { min: 10100000, max: 10150000, name: '30M' },
      { min: 14000000, max: 14350000, name: '20M' },
      { min: 18068000, max: 18168000, name: '17M' },
      { min: 21000000, max: 21450000, name: '15M' },
      { min: 24890000, max: 24990000, name: '12M' },
      { min: 28000000, max: 29700000, name: '10M' },
      { min: 50000000, max: 54000000, name: '6M' },
      { min: 144000000, max: 148000000, name: '2M' },
      { min: 420000000, max: 450000000, name: '70CM' }
    ];

    const band = bands.find(b => frequency >= b.min && frequency <= b.max);
    return band?.name || null;
  }

  /**
   * Formats frequency for display
   */
  static formatFrequency(frequency: number): string {
    if (frequency >= 1000000000) {
      return `${(frequency / 1000000000).toFixed(3)} GHz`;
    } else if (frequency >= 1000000) {
      return `${(frequency / 1000000).toFixed(3)} MHz`;
    } else if (frequency >= 1000) {
      return `${(frequency / 1000).toFixed(3)} kHz`;
    } else {
      return `${frequency} Hz`;
    }
  }

  /**
   * Estimates the optimal sample rate for a given bandwidth
   */
  static getOptimalSampleRate(
    targetBandwidth: number,
    availableRates: number[]
  ): number {
    // Sample rate should be at least 2x the bandwidth (Nyquist)
    const minSampleRate = targetBandwidth * 2;

    // Find the smallest available rate that meets requirements
    const suitableRates = availableRates
      .filter(rate => rate >= minSampleRate)
      .sort((a, b) => a - b);

    return suitableRates[0] || availableRates[availableRates.length - 1];
  }
}

export default SDRDevice;