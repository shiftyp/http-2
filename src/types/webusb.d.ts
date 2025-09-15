/**
 * WebUSB API Type Definitions for SDR Support
 * Based on WebUSB specification for browser-based USB device access
 */

declare global {
  interface Navigator {
    usb: USB;
  }

  interface USB extends EventTarget {
    getDevices(): Promise<USBDevice[]>;
    requestDevice(options?: USBDeviceRequestOptions): Promise<USBDevice>;
    onconnect: ((this: USB, ev: USBConnectionEvent) => any) | null;
    ondisconnect: ((this: USB, ev: USBConnectionEvent) => any) | null;
    addEventListener<K extends keyof USBEventMap>(
      type: K,
      listener: (this: USB, ev: USBEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof USBEventMap>(
      type: K,
      listener: (this: USB, ev: USBEventMap[K]) => any,
      options?: boolean | EventListenerOptions
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void;
  }

  interface USBDevice {
    readonly usbVersionMajor: number;
    readonly usbVersionMinor: number;
    readonly usbVersionSubminor: number;
    readonly deviceClass: number;
    readonly deviceSubclass: number;
    readonly deviceProtocol: number;
    readonly vendorId: number;
    readonly productId: number;
    readonly deviceVersionMajor: number;
    readonly deviceVersionMinor: number;
    readonly deviceVersionSubminor: number;
    readonly manufacturerName?: string;
    readonly productName?: string;
    readonly serialNumber?: string;
    readonly configuration?: USBConfiguration;
    readonly configurations: USBConfiguration[];
    readonly opened: boolean;

    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
    controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
    controlTransferOut(setup: USBControlTransferParameters, data?: BufferSource): Promise<USBOutTransferResult>;
    transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
    isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>;
    isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>;
    reset(): Promise<void>;
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

  interface USBConfiguration {
    readonly configurationValue: number;
    readonly configurationName?: string;
    readonly interfaces: USBInterface[];
  }

  interface USBInterface {
    readonly interfaceNumber: number;
    readonly alternate: USBAlternateInterface;
    readonly alternates: USBAlternateInterface[];
    readonly claimed: boolean;
  }

  interface USBAlternateInterface {
    readonly alternateSetting: number;
    readonly interfaceClass: number;
    readonly interfaceSubclass: number;
    readonly interfaceProtocol: number;
    readonly interfaceName?: string;
    readonly endpoints: USBEndpoint[];
  }

  interface USBEndpoint {
    readonly endpointNumber: number;
    readonly direction: USBDirection;
    readonly type: USBEndpointType;
    readonly packetSize: number;
  }

  interface USBControlTransferParameters {
    requestType: USBRequestType;
    recipient: USBRecipient;
    request: number;
    value: number;
    index: number;
  }

  interface USBInTransferResult {
    readonly data: DataView;
    readonly status: USBTransferStatus;
  }

  interface USBOutTransferResult {
    readonly bytesWritten: number;
    readonly status: USBTransferStatus;
  }

  interface USBIsochronousInTransferResult {
    readonly data: DataView;
    readonly packets: USBIsochronousInTransferPacket[];
  }

  interface USBIsochronousOutTransferResult {
    readonly packets: USBIsochronousOutTransferPacket[];
  }

  interface USBIsochronousInTransferPacket {
    readonly data: DataView;
    readonly status: USBTransferStatus;
  }

  interface USBIsochronousOutTransferPacket {
    readonly bytesWritten: number;
    readonly status: USBTransferStatus;
  }

  interface USBConnectionEvent extends Event {
    readonly device: USBDevice;
  }

  interface USBEventMap {
    connect: USBConnectionEvent;
    disconnect: USBConnectionEvent;
  }

  type USBDirection = "in" | "out";
  type USBEndpointType = "bulk" | "interrupt" | "isochronous";
  type USBRequestType = "standard" | "class" | "vendor";
  type USBRecipient = "device" | "interface" | "endpoint" | "other";
  type USBTransferStatus = "ok" | "stall" | "babble";
}

/**
 * SDR Device USB Vendor/Product ID Constants
 * Based on known SDR device identifiers
 */
export const SDR_USB_DEVICES = {
  RTL_SDR: {
    REALTEK_2832U: { vendorId: 0x0bda, productId: 0x2838 },
    EZCAP_USB: { vendorId: 0x0bda, productId: 0x2832 },
    GENERIC_RTL: { vendorId: 0x0bda, productId: 0x2838 }
  },
  HACKRF: {
    HACKRF_ONE: { vendorId: 0x1d50, productId: 0x6089 }
  },
  LIMESDR: {
    LIMESDR_USB: { vendorId: 0x1d50, productId: 0x6108 },
    LIMESDR_MINI: { vendorId: 0x0403, productId: 0x601f }
  },
  PLUTOSDR: {
    ADALM_PLUTO: { vendorId: 0x0456, productId: 0xb673 }
  },
  SDRPLAY: {
    RSP1: { vendorId: 0x1df7, productId: 0x2500 },
    RSP1A: { vendorId: 0x1df7, productId: 0x2e0c },
    RSP2: { vendorId: 0x1df7, productId: 0x3800 },
    RSPDX: { vendorId: 0x1df7, productId: 0x3801 },
    RSPDUO: { vendorId: 0x1df7, productId: 0x3802 }
  }
} as const;

/**
 * SDR Device Type Enumeration
 */
export type SDRDeviceType = 'RTL_SDR' | 'HACKRF' | 'LIMESDR' | 'PLUTOSDR' | 'SDRPLAY';

/**
 * SDR Device Capabilities Interface
 */
export interface SDRDeviceCapabilities {
  minFrequency: number;
  maxFrequency: number;
  maxBandwidth: number;
  sampleRates: number[];
  gainRange: { min: number; max: number };
  hasFullDuplex: boolean;
  hasDiversityRx: boolean;
}

/**
 * SDR Device Information
 */
export interface SDRDeviceInfo {
  type: SDRDeviceType;
  vendorId: number;
  productId: number;
  serialNumber?: string;
  manufacturerName?: string;
  productName?: string;
  capabilities: SDRDeviceCapabilities;
}

export {};