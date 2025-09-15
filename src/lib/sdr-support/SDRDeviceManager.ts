/**
 * SDR Device Manager
 * Manages SDR device connections, configuration, and coordination
 */

import { SDRDevice, SDRDeviceType, ConnectionStatus, SDRDeviceFactory } from './models/SDRDevice';
import { SDRCapabilities, DeviceCapabilitiesManager } from './models/SDRCapabilities';
import { MonitoringConfiguration } from './models/MonitoringConfiguration';

export interface DeviceConnectionOptions {
  /** Auto-connect on device detection */
  autoConnect?: boolean;

  /** Connection timeout in milliseconds */
  timeout?: number;

  /** Retry attempts on connection failure */
  retryAttempts?: number;

  /** Device-specific configuration */
  deviceConfig?: Record<string, any>;
}

export interface DeviceCoordinationSettings {
  /** Enable multi-device coordination */
  enableCoordination: boolean;

  /** Primary device selection strategy */
  primaryDeviceStrategy: PrimaryDeviceStrategy;

  /** Frequency allocation method */
  frequencyAllocation: FrequencyAllocationMethod;

  /** Bandwidth sharing configuration */
  bandwidthSharing: BandwidthSharingConfig;

  /** Redundancy settings */
  redundancy: RedundancySettings;
}

export interface BandwidthSharingConfig {
  /** Maximum bandwidth per device in Hz */
  maxBandwidthPerDevice: number;

  /** Overlap allowance for critical frequencies */
  overlapTolerance: number;

  /** Priority-based allocation */
  priorityAllocation: boolean;
}

export interface RedundancySettings {
  /** Enable redundant monitoring */
  enableRedundancy: boolean;

  /** Minimum devices for redundancy */
  minRedundantDevices: number;

  /** Critical frequency redundancy factor */
  criticalFrequencyRedundancy: number;
}

export enum PrimaryDeviceStrategy {
  HIGHEST_BANDWIDTH = 'HIGHEST_BANDWIDTH',
  LOWEST_NOISE_FLOOR = 'LOWEST_NOISE_FLOOR',
  MOST_RELIABLE = 'MOST_RELIABLE',
  USER_SELECTED = 'USER_SELECTED'
}

export enum FrequencyAllocationMethod {
  ROUND_ROBIN = 'ROUND_ROBIN',
  CAPABILITY_BASED = 'CAPABILITY_BASED',
  LOAD_BALANCED = 'LOAD_BALANCED',
  PRIORITY_BASED = 'PRIORITY_BASED'
}

export class SDRDeviceManager {
  private connectedDevices: Map<string, SDRDevice> = new Map();
  private deviceCallbacks: Map<string, DeviceEventCallback[]> = new Map();
  private coordinationSettings: DeviceCoordinationSettings;
  private isScanning = false;

  constructor(coordinationSettings?: Partial<DeviceCoordinationSettings>) {
    this.coordinationSettings = {
      enableCoordination: true,
      primaryDeviceStrategy: PrimaryDeviceStrategy.HIGHEST_BANDWIDTH,
      frequencyAllocation: FrequencyAllocationMethod.CAPABILITY_BASED,
      bandwidthSharing: {
        maxBandwidthPerDevice: 20000000, // 20 MHz
        overlapTolerance: 0.1,
        priorityAllocation: true
      },
      redundancy: {
        enableRedundancy: false,
        minRedundantDevices: 2,
        criticalFrequencyRedundancy: 2
      },
      ...coordinationSettings
    };

    this.setupDeviceDetection();
  }

  /**
   * Scans for available SDR devices
   */
  async scanForDevices(): Promise<SDRDevice[]> {
    if (this.isScanning) {
      throw new Error('Device scan already in progress');
    }

    this.isScanning = true;
    const foundDevices: SDRDevice[] = [];

    try {
      // Check if WebUSB is supported
      if (!navigator.usb) {
        throw new Error('WebUSB not supported in this browser');
      }

      // Get already paired devices
      const pairedDevices = await navigator.usb.getDevices();

      for (const usbDevice of pairedDevices) {
        const sdrDevice = SDRDeviceFactory.fromUSBDevice(usbDevice);
        if (sdrDevice) {
          foundDevices.push(sdrDevice);
        }
      }

      // Request new device access
      try {
        const newDevice = await navigator.usb.requestDevice({
          filters: this.getUSBFilters()
        });

        const sdrDevice = SDRDeviceFactory.fromUSBDevice(newDevice);
        if (sdrDevice && !foundDevices.find(d => d.id === sdrDevice.id)) {
          foundDevices.push(sdrDevice);
        }
      } catch (error) {
        // User cancelled device selection or no new devices
        console.info('No new devices selected:', error);
      }

      return foundDevices;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Connects to an SDR device
   */
  async connectDevice(
    device: SDRDevice,
    options: DeviceConnectionOptions = {}
  ): Promise<void> {
    const {
      autoConnect = true,
      timeout = 30000,
      retryAttempts = 3,
      deviceConfig = {}
    } = options;

    if (this.connectedDevices.has(device.id)) {
      throw new Error(`Device ${device.id} is already connected`);
    }

    let attempts = 0;

    while (attempts <= retryAttempts) {
      try {
        device.connectionStatus = ConnectionStatus.CONNECTING;
        this.notifyDeviceEvent(device.id, 'connecting', device);

        // Find USB device
        const usbDevices = await navigator.usb.getDevices();
        const usbDevice = usbDevices.find(usb =>
          usb.vendorId === device.vendorId && usb.productId === device.productId
        );

        if (!usbDevice) {
          throw new Error('USB device not found');
        }

        // Open USB connection
        if (!usbDevice.opened) {
          await usbDevice.open();
        }

        // Select configuration
        if (usbDevice.configuration === null) {
          await usbDevice.selectConfiguration(1);
        }

        // Claim interface (usually interface 0 for SDR devices)
        const interfaceNumber = 0;
        await usbDevice.claimInterface(interfaceNumber);

        // Device-specific initialization
        await this.initializeDevice(device, usbDevice, deviceConfig);

        // Update device status
        device.connectionStatus = ConnectionStatus.CONNECTED;
        device.lastSeen = new Date();

        // Add to connected devices
        this.connectedDevices.set(device.id, device);

        // Update coordination if enabled
        if (this.coordinationSettings.enableCoordination) {
          await this.updateDeviceCoordination();
        }

        this.notifyDeviceEvent(device.id, 'connected', device);
        return;

      } catch (error) {
        attempts++;
        device.connectionStatus = ConnectionStatus.ERROR;

        if (attempts > retryAttempts) {
          this.notifyDeviceEvent(device.id, 'error', device, error as Error);
          throw new Error(`Failed to connect to device ${device.id}: ${error}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  /**
   * Disconnects an SDR device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} is not connected`);
    }

    try {
      device.connectionStatus = ConnectionStatus.DISCONNECTING;
      this.notifyDeviceEvent(deviceId, 'disconnecting', device);

      // Find and close USB device
      const usbDevices = await navigator.usb.getDevices();
      const usbDevice = usbDevices.find(usb =>
        usb.vendorId === device.vendorId && usb.productId === device.productId
      );

      if (usbDevice && usbDevice.opened) {
        // Release interface
        await usbDevice.releaseInterface(0);
        await usbDevice.close();
      }

      // Update device status
      device.connectionStatus = ConnectionStatus.DISCONNECTED;
      device.lastSeen = new Date();

      // Remove from connected devices
      this.connectedDevices.delete(deviceId);

      // Update coordination
      if (this.coordinationSettings.enableCoordination) {
        await this.updateDeviceCoordination();
      }

      this.notifyDeviceEvent(deviceId, 'disconnected', device);

    } catch (error) {
      device.connectionStatus = ConnectionStatus.ERROR;
      this.notifyDeviceEvent(deviceId, 'error', device, error as Error);
      throw error;
    }
  }

  /**
   * Configures device for monitoring
   */
  async configureDevice(
    deviceId: string,
    config: MonitoringConfiguration
  ): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} is not connected`);
    }

    // Validate configuration against device capabilities
    const validation = DeviceCapabilitiesManager.validateConfiguration(
      device.capabilities,
      config
    );

    if (!validation.compatible) {
      throw new Error(`Configuration incompatible: ${validation.issues.join(', ')}`);
    }

    // Apply configuration
    device.currentConfiguration = config;
    device.lastConfigured = new Date();

    // Device-specific configuration
    await this.applyDeviceConfiguration(device, config);

    this.notifyDeviceEvent(deviceId, 'configured', device);
  }

  /**
   * Gets all connected devices
   */
  getConnectedDevices(): SDRDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Gets device by ID
   */
  getDevice(deviceId: string): SDRDevice | undefined {
    return this.connectedDevices.get(deviceId);
  }

  /**
   * Gets primary device for coordination
   */
  getPrimaryDevice(): SDRDevice | undefined {
    const devices = this.getConnectedDevices();
    if (devices.length === 0) return undefined;

    switch (this.coordinationSettings.primaryDeviceStrategy) {
      case PrimaryDeviceStrategy.HIGHEST_BANDWIDTH:
        return devices.reduce((best, current) =>
          current.capabilities.maxBandwidth > best.capabilities.maxBandwidth ? current : best
        );

      case PrimaryDeviceStrategy.LOWEST_NOISE_FLOOR:
        return devices.reduce((best, current) =>
          current.capabilities.noiseFloor < best.capabilities.noiseFloor ? current : best
        );

      case PrimaryDeviceStrategy.MOST_RELIABLE:
        return devices.reduce((best, current) => {
          const currentUptime = current.lastSeen ?
            Date.now() - current.lastSeen.getTime() : Infinity;
          const bestUptime = best.lastSeen ?
            Date.now() - best.lastSeen.getTime() : Infinity;
          return currentUptime < bestUptime ? current : best;
        });

      default:
        return devices[0];
    }
  }

  /**
   * Allocates frequency ranges across devices
   */
  async allocateFrequencies(
    monitoringConfigs: MonitoringConfiguration[]
  ): Promise<Map<string, MonitoringConfiguration[]>> {
    const allocation = new Map<string, MonitoringConfiguration[]>();
    const devices = this.getConnectedDevices();

    if (devices.length === 0) {
      throw new Error('No connected devices available for frequency allocation');
    }

    // Initialize allocation map
    for (const device of devices) {
      allocation.set(device.id, []);
    }

    // Sort configurations by priority
    const sortedConfigs = [...monitoringConfigs].sort((a, b) => {
      const priorityA = a.frequencyRanges.reduce((max, range) =>
        Math.max(max, range.priority), 0);
      const priorityB = b.frequencyRanges.reduce((max, range) =>
        Math.max(max, range.priority), 0);
      return priorityB - priorityA;
    });

    // Allocate based on strategy
    switch (this.coordinationSettings.frequencyAllocation) {
      case FrequencyAllocationMethod.CAPABILITY_BASED:
        this.allocateByCapability(devices, sortedConfigs, allocation);
        break;

      case FrequencyAllocationMethod.LOAD_BALANCED:
        this.allocateByLoad(devices, sortedConfigs, allocation);
        break;

      case FrequencyAllocationMethod.ROUND_ROBIN:
        this.allocateRoundRobin(devices, sortedConfigs, allocation);
        break;

      default:
        this.allocateByPriority(devices, sortedConfigs, allocation);
    }

    // Apply redundancy if enabled
    if (this.coordinationSettings.redundancy.enableRedundancy) {
      this.applyRedundancy(devices, allocation);
    }

    return allocation;
  }

  /**
   * Registers device event callback
   */
  onDeviceEvent(deviceId: string, callback: DeviceEventCallback): void {
    if (!this.deviceCallbacks.has(deviceId)) {
      this.deviceCallbacks.set(deviceId, []);
    }
    this.deviceCallbacks.get(deviceId)!.push(callback);
  }

  /**
   * Removes device event callback
   */
  offDeviceEvent(deviceId: string, callback: DeviceEventCallback): void {
    const callbacks = this.deviceCallbacks.get(deviceId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index >= 0) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Disposes of all resources
   */
  async dispose(): Promise<void> {
    // Disconnect all devices
    const disconnectPromises = Array.from(this.connectedDevices.keys())
      .map(deviceId => this.disconnectDevice(deviceId));

    await Promise.allSettled(disconnectPromises);

    // Clear callbacks
    this.deviceCallbacks.clear();
  }

  // Private methods

  private setupDeviceDetection(): void {
    if (navigator.usb) {
      navigator.usb.addEventListener('connect', (event) => {
        this.handleDeviceConnect(event.device);
      });

      navigator.usb.addEventListener('disconnect', (event) => {
        this.handleDeviceDisconnect(event.device);
      });
    }
  }

  private async handleDeviceConnect(usbDevice: USBDevice): Promise<void> {
    const sdrDevice = SDRDeviceFactory.fromUSBDevice(usbDevice);
    if (sdrDevice) {
      this.notifyDeviceEvent(sdrDevice.id, 'detected', sdrDevice);
    }
  }

  private async handleDeviceDisconnect(usbDevice: USBDevice): Promise<void> {
    // Find corresponding SDR device
    for (const [deviceId, device] of this.connectedDevices) {
      if (device.vendorId === usbDevice.vendorId &&
          device.productId === usbDevice.productId) {
        device.connectionStatus = ConnectionStatus.DISCONNECTED;
        this.connectedDevices.delete(deviceId);
        this.notifyDeviceEvent(deviceId, 'disconnected', device);
        break;
      }
    }
  }

  private getUSBFilters(): USBDeviceFilter[] {
    return [
      // RTL-SDR devices
      { vendorId: 0x0bda, productId: 0x2838 },
      { vendorId: 0x0bda, productId: 0x2832 },

      // HackRF devices
      { vendorId: 0x1d50, productId: 0x6089 },

      // LimeSDR devices
      { vendorId: 0x1d50, productId: 0x6108 },
      { vendorId: 0x04b4, productId: 0x00f1 },

      // PlutoSDR devices
      { vendorId: 0x0456, productId: 0xb673 },

      // SDRplay devices
      { vendorId: 0x1df7, productId: 0x2500 },
      { vendorId: 0x1df7, productId: 0x3000 }
    ];
  }

  private async initializeDevice(
    device: SDRDevice,
    usbDevice: USBDevice,
    config: Record<string, any>
  ): Promise<void> {
    // Device-specific initialization based on type
    switch (device.type) {
      case SDRDeviceType.RTL_SDR:
        await this.initializeRTLSDR(device, usbDevice, config);
        break;
      case SDRDeviceType.HACKRF:
        await this.initializeHackRF(device, usbDevice, config);
        break;
      case SDRDeviceType.LIMESDR:
        await this.initializeLimeSDR(device, usbDevice, config);
        break;
      case SDRDeviceType.PLUTOSDR:
        await this.initializePlutoSDR(device, usbDevice, config);
        break;
      case SDRDeviceType.SDRPLAY:
        await this.initializeSDRplay(device, usbDevice, config);
        break;
      default:
        throw new Error(`Unsupported device type: ${device.type}`);
    }
  }

  private async initializeRTLSDR(
    device: SDRDevice,
    usbDevice: USBDevice,
    config: Record<string, any>
  ): Promise<void> {
    // RTL-SDR specific initialization
    // This would include setting up the R820T2 tuner, configuring sample rate, etc.
    // For now, this is a placeholder for the actual implementation
    console.log(`Initializing RTL-SDR device ${device.id}`);
  }

  private async initializeHackRF(
    device: SDRDevice,
    usbDevice: USBDevice,
    config: Record<string, any>
  ): Promise<void> {
    // HackRF specific initialization
    console.log(`Initializing HackRF device ${device.id}`);
  }

  private async initializeLimeSDR(
    device: SDRDevice,
    usbDevice: USBDevice,
    config: Record<string, any>
  ): Promise<void> {
    // LimeSDR specific initialization
    console.log(`Initializing LimeSDR device ${device.id}`);
  }

  private async initializePlutoSDR(
    device: SDRDevice,
    usbDevice: USBDevice,
    config: Record<string, any>
  ): Promise<void> {
    // PlutoSDR specific initialization
    console.log(`Initializing PlutoSDR device ${device.id}`);
  }

  private async initializeSDRplay(
    device: SDRDevice,
    usbDevice: USBDevice,
    config: Record<string, any>
  ): Promise<void> {
    // SDRplay specific initialization
    console.log(`Initializing SDRplay device ${device.id}`);
  }

  private async applyDeviceConfiguration(
    device: SDRDevice,
    config: MonitoringConfiguration
  ): Promise<void> {
    // Apply configuration to device
    // This would include setting frequency, sample rate, gain, etc.
    console.log(`Applying configuration to device ${device.id}`);
  }

  private async updateDeviceCoordination(): Promise<void> {
    // Update device coordination when devices are added/removed
    const devices = this.getConnectedDevices();
    console.log(`Updating coordination for ${devices.length} devices`);
  }

  private allocateByCapability(
    devices: SDRDevice[],
    configs: MonitoringConfiguration[],
    allocation: Map<string, MonitoringConfiguration[]>
  ): void {
    // Allocate based on device capabilities
    for (const config of configs) {
      const bestDevice = this.findBestDeviceForConfig(devices, config);
      if (bestDevice) {
        allocation.get(bestDevice.id)!.push(config);
      }
    }
  }

  private allocateByLoad(
    devices: SDRDevice[],
    configs: MonitoringConfiguration[],
    allocation: Map<string, MonitoringConfiguration[]>
  ): void {
    // Allocate to balance load across devices
    for (const config of configs) {
      const leastLoadedDevice = devices.reduce((best, current) => {
        const currentLoad = allocation.get(current.id)!.length;
        const bestLoad = allocation.get(best.id)!.length;
        return currentLoad < bestLoad ? current : best;
      });
      allocation.get(leastLoadedDevice.id)!.push(config);
    }
  }

  private allocateRoundRobin(
    devices: SDRDevice[],
    configs: MonitoringConfiguration[],
    allocation: Map<string, MonitoringConfiguration[]>
  ): void {
    // Round-robin allocation
    let deviceIndex = 0;
    for (const config of configs) {
      const device = devices[deviceIndex % devices.length];
      allocation.get(device.id)!.push(config);
      deviceIndex++;
    }
  }

  private allocateByPriority(
    devices: SDRDevice[],
    configs: MonitoringConfiguration[],
    allocation: Map<string, MonitoringConfiguration[]>
  ): void {
    // Allocate high-priority configs to best devices
    const primaryDevice = this.getPrimaryDevice();
    if (primaryDevice) {
      for (const config of configs) {
        allocation.get(primaryDevice.id)!.push(config);
      }
    }
  }

  private applyRedundancy(
    devices: SDRDevice[],
    allocation: Map<string, MonitoringConfiguration[]>
  ): void {
    // Apply redundancy settings
    if (devices.length < this.coordinationSettings.redundancy.minRedundantDevices) {
      return;
    }

    // Add redundant monitoring for critical frequencies
    const redundancyFactor = this.coordinationSettings.redundancy.criticalFrequencyRedundancy;
    // Implementation would add redundant allocations here
  }

  private findBestDeviceForConfig(
    devices: SDRDevice[],
    config: MonitoringConfiguration
  ): SDRDevice | undefined {
    // Find the best device for a specific configuration
    return devices.find(device => {
      const validation = DeviceCapabilitiesManager.validateConfiguration(
        device.capabilities,
        config
      );
      return validation.compatible;
    });
  }

  private notifyDeviceEvent(
    deviceId: string,
    event: DeviceEvent,
    device: SDRDevice,
    error?: Error
  ): void {
    const callbacks = this.deviceCallbacks.get(deviceId) || [];
    for (const callback of callbacks) {
      try {
        callback(event, device, error);
      } catch (callbackError) {
        console.error('Device event callback error:', callbackError);
      }
    }
  }
}

export type DeviceEvent = 'detected' | 'connecting' | 'connected' | 'configured' |
                         'disconnecting' | 'disconnected' | 'error';

export type DeviceEventCallback = (
  event: DeviceEvent,
  device: SDRDevice,
  error?: Error
) => void;

export default SDRDeviceManager;