/**
 * WebUSB Type Definitions for SDR Devices
 */

export type SDRDeviceType = 'RTL_SDR' | 'HACKRF' | 'LIMESDR' | 'PLUTOSDR' | 'SDRPLAY';

export interface SDRCapabilities {
  /** Minimum tunable frequency in Hz */
  minFrequency: number;

  /** Maximum tunable frequency in Hz */
  maxFrequency: number;

  /** Maximum bandwidth in Hz */
  maxBandwidth: number;

  /** Supported sample rates in Hz */
  sampleRates: number[];

  /** Gain range in dB */
  gainRange: {
    min: number;
    max: number;
  };

  /** Supports full-duplex operation */
  hasFullDuplex: boolean;

  /** Supports diversity reception */
  hasDiversityRx: boolean;
}

export type SDRDeviceCapabilities = SDRCapabilities;

export interface USBVendorProduct {
  vendorId: number;
  productId: number;
}

export const SDR_USB_DEVICES: Record<SDRDeviceType, Record<string, USBVendorProduct>> = {
  RTL_SDR: {
    'RTL2832U': { vendorId: 0x0bda, productId: 0x2832 },
    'RTL2838UHIDIR': { vendorId: 0x0bda, productId: 0x2838 },
  },
  HACKRF: {
    'HackRF One': { vendorId: 0x1d50, productId: 0x6089 },
  },
  LIMESDR: {
    'LimeSDR-USB': { vendorId: 0x1d50, productId: 0x6108 },
  },
  PLUTOSDR: {
    'PlutoSDR': { vendorId: 0x0456, productId: 0xb673 },
  },
  SDRPLAY: {
    'RSP1': { vendorId: 0x1df7, productId: 0x2500 },
    'RSP2': { vendorId: 0x1df7, productId: 0x3000 },
  }
};

// WebUSB API type extensions
declare global {
  interface Navigator {
    usb: USB;
  }

  interface USB extends EventTarget {
    getDevices(): Promise<USBDevice[]>;
    requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  }

  interface USBDeviceRequestOptions {
    filters: USBDeviceFilter[];
  }

  interface USBDeviceFilter {
    vendorId?: number;
    productId?: number;
    classCode?: number;
    subclassCode?: number;
    protocolCode?: number;
    serialNumber?: string;
  }

  interface USBConnectionEvent extends Event {
    readonly device: USBDevice;
  }
}