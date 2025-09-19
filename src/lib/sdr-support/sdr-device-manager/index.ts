/**
 * SDR Device Manager Service
 * Manages WebUSB-based SDR device connections and operations
 */

import type { SDRDevice, SDRDeviceConfiguration } from '../models/SDRDevice.js';
import type { SDRCapabilities } from '../models/SDRCapabilities.js';
import type { SDRDeviceType } from '../../../types/webusb.js';
import { SDRDeviceFactory, SDRDeviceValidator, ConnectionStatus } from '../models/SDRDevice.js';
import { SDR_USB_DEVICES } from '../../../types/webusb.js';

export interface IQDataCallback {
  (data: Float32Array): void;
}

export interface DeviceEventCallback {
  (device: SDRDevice): void;
}

/**
 * Main SDR Device Manager
 * Handles device discovery, connection, configuration, and data streaming
 */
export class SDRDeviceManager {
  private devices: Map<string, SDRDevice> = new Map();
  private dataCallbacks: Map<string, IQDataCallback[]> = new Map();
  private deviceCallbacks: {
    connected: DeviceEventCallback[];
    disconnected: DeviceEventCallback[];
    error: DeviceEventCallback[];
  } = {
    connected: [],
    disconnected: [],
    error: []
  };
  private isInitialized = false;

  /**
   * Initialize the SDR device manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Check WebUSB support
    if (!navigator.usb) {
      throw new Error('WebUSB not supported in this browser');
    }

    // Set up USB device event listeners
    navigator.usb.addEventListener('connect', this.handleUSBConnect.bind(this));
    navigator.usb.addEventListener('disconnect', this.handleUSBDisconnect.bind(this));

    // Enumerate existing devices
    await this.refreshDeviceList();

    this.isInitialized = true;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Disconnect all devices
    for (const device of this.devices.values()) {
      if (device.connectionStatus === ConnectionStatus.CONNECTED) {
        await this.disconnectDevice(device.id);
      }
    }

    // Clear all callbacks
    this.dataCallbacks.clear();
    this.deviceCallbacks.connected = [];
    this.deviceCallbacks.disconnected = [];
    this.deviceCallbacks.error = [];

    // Remove USB event listeners
    navigator.usb.removeEventListener('connect', this.handleUSBConnect.bind(this));
    navigator.usb.removeEventListener('disconnect', this.handleUSBDisconnect.bind(this));

    this.isInitialized = false;
  }

  /**
   * Enumerate all available SDR devices
   */
  async enumerateDevices(): Promise<SDRDevice[]> {
    if (!this.isInitialized) {
      throw new Error('SDRDeviceManager not initialized');
    }

    await this.refreshDeviceList();
    return Array.from(this.devices.values());
  }

  /**
   * Request user permission for new SDR device
   */
  async requestDevice(deviceTypes: SDRDeviceType[]): Promise<SDRDevice> {
    if (!this.isInitialized) {
      throw new Error('SDRDeviceManager not initialized');
    }

    // Build filter for requested device types
    const filters = deviceTypes.flatMap(type => {
      const deviceIds = SDR_USB_DEVICES[type];
      return Object.values(deviceIds);
    });

    try {
      const usbDevice = await navigator.usb.requestDevice({ filters });
      const capabilities = this.getDeviceCapabilities(usbDevice.vendorId, usbDevice.productId);
      const device = SDRDeviceFactory.fromUSBDevice(usbDevice, capabilities);

      this.devices.set(device.id, device);
      return device;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Permission denied by user');
      }
      throw error;
    }
  }

  /**
   * Connect to an SDR device
   */
  async connectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (!device.usbDevice) {
      throw new Error('USB device reference not available');
    }

    try {
      if (!device.usbDevice.opened) {
        await device.usbDevice.open();
      }

      // Select configuration and claim interface
      if (device.usbDevice.configuration === null) {
        await device.usbDevice.selectConfiguration(1);
      }

      // Claim the first interface
      await device.usbDevice.claimInterface(0);

      // Update device status
      device.connectionStatus = ConnectionStatus.CONNECTED;
      device.lastSeen = new Date();

      this.devices.set(deviceId, device);
      this.notifyDeviceCallbacks('connected', device);

      return true;
    } catch (error) {
      device.connectionStatus = ConnectionStatus.ERROR;
      this.notifyDeviceCallbacks('error', device);
      throw new Error(`Failed to connect to device: ${error}`);
    }
  }

  /**
   * Disconnect from an SDR device
   */
  async disconnectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    try {
      if (device.usbDevice && device.usbDevice.opened) {
        // Stop streaming if active
        await this.stopStreaming(deviceId);

        // Release interface and close device
        await device.usbDevice.releaseInterface(0);
        await device.usbDevice.close();
      }

      device.connectionStatus = ConnectionStatus.DISCONNECTED;
      this.devices.set(deviceId, device);
      this.notifyDeviceCallbacks('disconnected', device);

      return true;
    } catch (error) {
      throw new Error(`Failed to disconnect device: ${error}`);
    }
  }

  /**
   * Validate device capabilities
   */
  validateCapabilities(capabilities: SDRCapabilities): boolean {
    const errors = SDRDeviceValidator.validateCapabilities(capabilities);
    return errors.length === 0;
  }

  /**
   * Set device frequency
   */
  async setFrequency(deviceId: string, frequency: number): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Device not connected');
    }

    // Validate frequency range
    if (frequency < device.capabilities.minFrequency ||
        frequency > device.capabilities.maxFrequency) {
      throw new Error(`Frequency ${frequency} Hz is outside device range`);
    }

    try {
      // Send frequency configuration to device
      await this.sendDeviceCommand(device, 'SET_FREQUENCY', frequency);

      // Update device configuration
      if (!device.configuration) {
        device.configuration = {};
      }
      device.configuration.centerFrequency = frequency;
      device.configuration.configuredAt = new Date();

      this.devices.set(deviceId, device);
      return true;
    } catch (error) {
      throw new Error(`Failed to set frequency: ${error}`);
    }
  }

  /**
   * Get current device frequency
   */
  async getFrequency(deviceId: string): Promise<number> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    return device.configuration?.centerFrequency || 0;
  }

  /**
   * Set device sample rate
   */
  async setSampleRate(deviceId: string, sampleRate: number): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Device not connected');
    }

    // Validate sample rate
    if (!device.capabilities.sampleRates.includes(sampleRate)) {
      throw new Error(`Sample rate ${sampleRate} Hz not supported`);
    }

    try {
      await this.sendDeviceCommand(device, 'SET_SAMPLE_RATE', sampleRate);

      if (!device.configuration) {
        device.configuration = {};
      }
      device.configuration.sampleRate = sampleRate;
      device.configuration.configuredAt = new Date();

      this.devices.set(deviceId, device);
      return true;
    } catch (error) {
      throw new Error(`Failed to set sample rate: ${error}`);
    }
  }

  /**
   * Get current device sample rate
   */
  async getSampleRate(deviceId: string): Promise<number> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    return device.configuration?.sampleRate || 0;
  }

  /**
   * Set device gain
   */
  async setGain(deviceId: string, gain: number): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Device not connected');
    }

    // Validate gain range
    if (gain < device.capabilities.gainRange.min ||
        gain > device.capabilities.gainRange.max) {
      throw new Error(`Gain ${gain} dB is outside device range`);
    }

    try {
      await this.sendDeviceCommand(device, 'SET_GAIN', gain);

      if (!device.configuration) {
        device.configuration = {};
      }
      device.configuration.gain = gain;
      device.configuration.configuredAt = new Date();

      this.devices.set(deviceId, device);
      return true;
    } catch (error) {
      throw new Error(`Failed to set gain: ${error}`);
    }
  }

  /**
   * Get current device gain
   */
  async getGain(deviceId: string): Promise<number> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    return device.configuration?.gain || 0;
  }

  /**
   * Start IQ data streaming
   */
  async startStreaming(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Device not connected');
    }

    try {
      await this.sendDeviceCommand(device, 'START_STREAMING', null);

      // Start data reading loop
      this.startDataReadLoop(device);

      return true;
    } catch (error) {
      throw new Error(`Failed to start streaming: ${error}`);
    }
  }

  /**
   * Stop IQ data streaming
   */
  async stopStreaming(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    try {
      await this.sendDeviceCommand(device, 'STOP_STREAMING', null);
      return true;
    } catch (error) {
      throw new Error(`Failed to stop streaming: ${error}`);
    }
  }

  /**
   * Check if device is streaming
   */
  async isStreaming(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    // In a real implementation, this would query the device status
    // For now, we'll maintain state locally
    return device.configuration?.centerFrequency !== undefined;
  }

  /**
   * Register callback for IQ data
   */
  onDataReceived(deviceId: string, callback: IQDataCallback): void {
    if (!this.dataCallbacks.has(deviceId)) {
      this.dataCallbacks.set(deviceId, []);
    }
    this.dataCallbacks.get(deviceId)!.push(callback);
  }

  /**
   * Register device event callbacks
   */
  onDeviceConnected(callback: DeviceEventCallback): void {
    this.deviceCallbacks.connected.push(callback);
  }

  onDeviceDisconnected(callback: DeviceEventCallback): void {
    this.deviceCallbacks.disconnected.push(callback);
  }

  onDeviceError(callback: DeviceEventCallback): void {
    this.deviceCallbacks.error.push(callback);
  }

  /**
   * Private helper methods
   */

  private async refreshDeviceList(): Promise<void> {
    try {
      const usbDevices = await navigator.usb.getDevices();

      for (const usbDevice of usbDevices) {
        const existingDevice = Array.from(this.devices.values())
          .find(d => d.usbDevice === usbDevice);

        if (!existingDevice) {
          const capabilities = this.getDeviceCapabilities(usbDevice.vendorId, usbDevice.productId);
          if (capabilities) {
            const device = SDRDeviceFactory.fromUSBDevice(usbDevice, capabilities);
            this.devices.set(device.id, device);
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh device list:', error);
    }
  }

  private getDeviceCapabilities(vendorId: number, productId: number): SDRCapabilities {
    // Return appropriate capabilities based on device type
    // This is a simplified version - real implementation would have device-specific capabilities
    return {
      minFrequency: 24000000,
      maxFrequency: 1766000000,
      maxBandwidth: 3200000,
      sampleRates: [250000, 1024000, 1536000, 1792000, 1920000, 2048000, 2160000, 2560000, 2880000, 3200000],
      gainRange: { min: 0, max: 49.6 },
      hasFullDuplex: false,
      hasDiversityRx: false
    };
  }

  private async sendDeviceCommand(device: SDRDevice, command: string, value: any): Promise<void> {
    if (!device.usbDevice) {
      throw new Error('USB device not available');
    }

    // This is a simplified command structure
    // Real implementation would use device-specific protocols
    const commandData = new TextEncoder().encode(JSON.stringify({ command, value }));

    try {
      await device.usbDevice.transferOut(1, commandData);
    } catch (error) {
      throw new Error(`USB communication failed: ${error}`);
    }
  }

  private async startDataReadLoop(device: SDRDevice): Promise<void> {
    if (!device.usbDevice) return;

    // Simulate IQ data streaming
    const interval = setInterval(async () => {
      try {
        // In real implementation, this would read from USB bulk endpoints
        const mockIQData = this.generateMockIQData(2048);

        const callbacks = this.dataCallbacks.get(device.id) || [];
        callbacks.forEach(callback => callback(mockIQData));
      } catch (error) {
        console.error('Data read error:', error);
        clearInterval(interval);
      }
    }, 100); // 10 FPS for simulation
  }

  private generateMockIQData(samples: number): Float32Array {
    const data = new Float32Array(samples * 2); // I and Q interleaved

    for (let i = 0; i < samples; i++) {
      // Generate mock signal with some noise
      const frequency = 0.05;
      const signal = Math.sin(2 * Math.PI * frequency * i) * 0.5;
      const noise = (Math.random() - 0.5) * 0.1;

      data[i * 2] = signal + noise;     // I component
      data[i * 2 + 1] = noise;          // Q component
    }

    return data;
  }

  private handleUSBConnect(event: USBConnectionEvent): void {
    console.log('USB device connected:', event.device);
    this.refreshDeviceList();
  }

  private handleUSBDisconnect(event: USBConnectionEvent): void {
    console.log('USB device disconnected:', event.device);

    // Find and update device status
    const device = Array.from(this.devices.values())
      .find(d => d.usbDevice === event.device);

    if (device) {
      device.connectionStatus = ConnectionStatus.DISCONNECTED;
      this.devices.set(device.id, device);
      this.notifyDeviceCallbacks('disconnected', device);
    }
  }

  private notifyDeviceCallbacks(event: keyof typeof this.deviceCallbacks, device: SDRDevice): void {
    const callbacks = this.deviceCallbacks[event];
    callbacks.forEach(callback => {
      try {
        callback(device);
      } catch (error) {
        console.error(`Device callback error:`, error);
      }
    });
  }
}