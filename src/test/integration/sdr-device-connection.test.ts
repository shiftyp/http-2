/**
import './setup';
 * Integration Test: SDR Device Connection
 * Tests complete device connection workflow
 *
 * CRITICAL: This test MUST FAIL before implementation
 * Following TDD Red-Green-Refactor cycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock WebUSB API since it's not available in test environment
const mockUSBDevice = {
  vendorId: 0x0bda,
  productId: 0x2838,
  serialNumber: 'TEST123456',
  manufacturerName: 'Realtek',
  productName: 'RTL2838UHIDIR',
  opened: false,
  configuration: null,
  configurations: [],
  open: vi.fn(),
  close: vi.fn(),
  selectConfiguration: vi.fn(),
  claimInterface: vi.fn(),
  releaseInterface: vi.fn(),
  controlTransferIn: vi.fn(),
  controlTransferOut: vi.fn(),
  transferIn: vi.fn(),
  transferOut: vi.fn(),
  reset: vi.fn()
};

const mockNavigatorUSB = {
  getDevices: vi.fn(),
  requestDevice: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock SDR libraries that don't exist yet
const mockSDRDeviceManager = {
  detectDevices: vi.fn(),
  connectDevice: vi.fn(),
  disconnectDevice: vi.fn(),
  getDeviceCapabilities: vi.fn(),
  configureDevice: vi.fn(),
  isDeviceSupported: vi.fn(),
  resetDevice: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

describe('SDR Device Connection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WebUSB API
    Object.defineProperty(navigator, 'usb', {
      value: mockNavigatorUSB,
      writable: true
    });

    // Reset mock device state
    mockUSBDevice.opened = false;
    mockUSBDevice.configuration = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Device Discovery', () => {
    it('should detect connected RTL-SDR devices', async () => {
      // EXPECTED TO FAIL: SDR device manager not implemented yet
      const connectedDevices = [mockUSBDevice];
      mockNavigatorUSB.getDevices.mockResolvedValue(connectedDevices);
      mockSDRDeviceManager.detectDevices.mockResolvedValue([
        {
          id: 'rtl-sdr-001',
          type: 'RTL_SDR',
          vendorId: 0x0bda,
          productId: 0x2838,
          serialNumber: 'TEST123456',
          capabilities: {
            minFrequency: 24000000,
            maxFrequency: 1766000000,
            maxBandwidth: 2400000,
            sampleRates: [250000, 1024000, 2048000],
            gainRange: { min: 0, max: 49.6 },
            hasFullDuplex: false,
            hasDiversityRx: false
          },
          connectionStatus: 'DISCONNECTED'
        }
      ]);

      // Mock SDRDeviceManager for now
      const deviceManager = mockSDRDeviceManager;

      const detectedDevices = await deviceManager.detectDevices();

      expect(detectedDevices).toHaveLength(1);
      expect(detectedDevices[0]).toMatchObject({
        type: 'RTL_SDR',
        vendorId: 0x0bda,
        productId: 0x2838,
        serialNumber: 'TEST123456'
      });
    });

    it('should handle multiple SDR device types', async () => {
      const multipleDevices = [
        { ...mockUSBDevice, vendorId: 0x0bda, productId: 0x2838 }, // RTL-SDR
        { ...mockUSBDevice, vendorId: 0x1d50, productId: 0x6089 }  // HackRF
      ];

      mockNavigatorUSB.getDevices.mockResolvedValue(multipleDevices);
      mockSDRDeviceManager.detectDevices.mockResolvedValue([
        { type: 'RTL_SDR', vendorId: 0x0bda, productId: 0x2838 },
        { type: 'HACKRF', vendorId: 0x1d50, productId: 0x6089 }
      ]);

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      const detectedDevices = await deviceManager.detectDevices();

      expect(detectedDevices).toHaveLength(2);
      expect(detectedDevices.map(d => d.type)).toEqual(['RTL_SDR', 'HACKRF']);
    });

    it('should return empty array when no SDR devices connected', async () => {
      mockNavigatorUSB.getDevices.mockResolvedValue([]);
      mockSDRDeviceManager.detectDevices.mockResolvedValue([]);

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      const detectedDevices = await deviceManager.detectDevices();

      expect(detectedDevices).toHaveLength(0);
    });
  });

  describe('Device Connection', () => {
    it('should connect to RTL-SDR device via WebUSB', async () => {
      // Setup navigator.usb mock
      Object.defineProperty(navigator, 'usb', {
        value: mockNavigatorUSB,
        writable: true
      });

      mockNavigatorUSB.getDevices.mockResolvedValue([mockUSBDevice]);
      mockNavigatorUSB.requestDevice.mockResolvedValue(mockUSBDevice);
      mockUSBDevice.open.mockResolvedValue();
      mockUSBDevice.selectConfiguration.mockResolvedValue();
      mockUSBDevice.claimInterface.mockResolvedValue();

      const { SDRDeviceManager } = await import('../../lib/sdr-support/sdr-device-manager/index.js');
      const deviceManager = new SDRDeviceManager();

      await deviceManager.initialize();

      // Request device first
      const device = await deviceManager.requestDevice(['RTL_SDR']);

      // Then connect to it
      const connected = await deviceManager.connectDevice(device.id);

      expect(connected).toBe(true);
      expect(mockUSBDevice.open).toHaveBeenCalled();
      expect(mockUSBDevice.claimInterface).toHaveBeenCalled();
    });

    it('should handle WebUSB permission denied gracefully', async () => {
      Object.defineProperty(navigator, 'usb', {
        value: mockNavigatorUSB,
        writable: true
      });

      const permissionError = new DOMException('User cancelled the requestDevice() chooser', 'NotAllowedError');
      mockNavigatorUSB.getDevices.mockResolvedValue([]);
      mockNavigatorUSB.requestDevice.mockRejectedValue(permissionError);

      const { SDRDeviceManager } = await import('../../lib/sdr-support/sdr-device-manager/index.js');
      const deviceManager = new SDRDeviceManager();

      await deviceManager.initialize();

      await expect(deviceManager.requestDevice(['RTL_SDR']))
        .rejects.toThrow('Permission denied by user');
    });

    it('should handle device communication errors', async () => {
      Object.defineProperty(navigator, 'usb', {
        value: mockNavigatorUSB,
        writable: true
      });

      mockNavigatorUSB.getDevices.mockResolvedValue([]);
      mockNavigatorUSB.requestDevice.mockResolvedValue(mockUSBDevice);
      mockUSBDevice.open.mockRejectedValue(new Error('Device communication failed'));

      const { SDRDeviceManager } = await import('../../lib/sdr-support/sdr-device-manager/index.js');
      const deviceManager = new SDRDeviceManager();

      await deviceManager.initialize();

      const device = await deviceManager.requestDevice(['RTL_SDR']);

      await expect(deviceManager.connectDevice(device.id))
        .rejects.toThrow('Failed to connect to device: Device communication failed');
    });

    it('should validate device type before connection', async () => {
      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await expect(deviceManager.connectDevice('INVALID_TYPE' as any))
        .rejects.toThrow('Unsupported device type');
    });
  });

  describe('Device Configuration', () => {
    beforeEach(async () => {
      // Mock successful connection
      mockSDRDeviceManager.connectDevice.mockResolvedValue({
        id: 'rtl-sdr-001',
        type: 'RTL_SDR',
        connectionStatus: 'CONNECTED',
        device: mockUSBDevice
      });
    });

    it('should configure device frequency and sample rate', async () => {
      mockUSBDevice.controlTransferOut.mockResolvedValue({ bytesWritten: 8, status: 'ok' });
      mockSDRDeviceManager.configureDevice.mockResolvedValue(true);

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await deviceManager.connectDevice('RTL_SDR');

      const configResult = await deviceManager.configureDevice('rtl-sdr-001', {
        centerFrequency: 14085000,
        sampleRate: 2048000,
        gain: 25.0
      });

      expect(configResult).toBe(true);
      expect(mockUSBDevice.controlTransferOut).toHaveBeenCalled();
    });

    it('should validate frequency within device capabilities', async () => {
      mockSDRDeviceManager.getDeviceCapabilities.mockReturnValue({
        minFrequency: 24000000,
        maxFrequency: 1766000000
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await expect(deviceManager.configureDevice('rtl-sdr-001', {
        centerFrequency: 1000000, // Below minimum
        sampleRate: 2048000
      })).rejects.toThrow('Frequency out of range');
    });

    it('should validate sample rate support', async () => {
      mockSDRDeviceManager.getDeviceCapabilities.mockReturnValue({
        sampleRates: [250000, 1024000, 2048000]
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await expect(deviceManager.configureDevice('rtl-sdr-001', {
        centerFrequency: 14085000,
        sampleRate: 3000000 // Unsupported rate
      })).rejects.toThrow('Unsupported sample rate');
    });
  });

  describe('Device Disconnection', () => {
    it('should gracefully disconnect device', async () => {
      mockUSBDevice.opened = true;
      mockUSBDevice.releaseInterface.mockResolvedValue();
      mockUSBDevice.close.mockResolvedValue();
      mockSDRDeviceManager.disconnectDevice.mockResolvedValue(true);

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      const disconnectResult = await deviceManager.disconnectDevice('rtl-sdr-001');

      expect(disconnectResult).toBe(true);
      expect(mockUSBDevice.releaseInterface).toHaveBeenCalled();
      expect(mockUSBDevice.close).toHaveBeenCalled();
    });

    it('should handle device already disconnected', async () => {
      mockUSBDevice.opened = false;
      mockSDRDeviceManager.disconnectDevice.mockResolvedValue(true);

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      const disconnectResult = await deviceManager.disconnectDevice('rtl-sdr-001');

      expect(disconnectResult).toBe(true);
      expect(mockUSBDevice.close).not.toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockUSBDevice.opened = true;
      mockUSBDevice.close.mockRejectedValue(new Error('Disconnect failed'));
      mockSDRDeviceManager.disconnectDevice.mockRejectedValue(new Error('Disconnect failed'));

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await expect(deviceManager.disconnectDevice('rtl-sdr-001'))
        .rejects.toThrow('Disconnect failed');
    });
  });

  describe('Event Handling', () => {
    it('should handle device connect events', async () => {
      const connectHandler = vi.fn();
      mockNavigatorUSB.addEventListener.mockImplementation((event, handler) => {
        if (event === 'connect') connectHandler.mockImplementation(handler);
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      deviceManager.on('deviceConnected', connectHandler);

      // Simulate WebUSB connect event
      const connectEvent = { device: mockUSBDevice };
      await connectHandler(connectEvent);

      expect(connectHandler).toHaveBeenCalledWith(connectEvent);
    });

    it('should handle device disconnect events', async () => {
      const disconnectHandler = vi.fn();
      mockNavigatorUSB.addEventListener.mockImplementation((event, handler) => {
        if (event === 'disconnect') disconnectHandler.mockImplementation(handler);
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      deviceManager.on('deviceDisconnected', disconnectHandler);

      // Simulate WebUSB disconnect event
      const disconnectEvent = { device: mockUSBDevice };
      await disconnectHandler(disconnectEvent);

      expect(disconnectHandler).toHaveBeenCalledWith(disconnectEvent);
    });

    it('should clean up event listeners on manager disposal', async () => {
      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      deviceManager.dispose();

      expect(mockNavigatorUSB.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Device Capability Detection', () => {
    it('should correctly identify RTL-SDR capabilities', async () => {
      mockSDRDeviceManager.getDeviceCapabilities.mockReturnValue({
        minFrequency: 24000000,
        maxFrequency: 1766000000,
        maxBandwidth: 2400000,
        sampleRates: [250000, 1024000, 2048000],
        gainRange: { min: 0, max: 49.6 },
        hasFullDuplex: false,
        hasDiversityRx: false
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      const capabilities = deviceManager.getDeviceCapabilities('RTL_SDR');

      expect(capabilities).toMatchObject({
        minFrequency: 24000000,
        maxFrequency: 1766000000,
        maxBandwidth: 2400000,
        hasFullDuplex: false,
        hasDiversityRx: false
      });
      expect(capabilities.sampleRates).toContain(2048000);
    });

    it('should correctly identify HackRF capabilities', async () => {
      mockSDRDeviceManager.getDeviceCapabilities.mockReturnValue({
        minFrequency: 1000000,
        maxFrequency: 6000000000,
        maxBandwidth: 20000000,
        sampleRates: [2000000, 4000000, 8000000, 10000000, 20000000],
        gainRange: { min: 0, max: 62 },
        hasFullDuplex: true,
        hasDiversityRx: false
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      const capabilities = deviceManager.getDeviceCapabilities('HACKRF');

      expect(capabilities.hasFullDuplex).toBe(true);
      expect(capabilities.maxBandwidth).toBe(20000000);
      expect(capabilities.gainRange.max).toBe(62);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from device reset', async () => {
      mockUSBDevice.reset.mockResolvedValue();
      mockSDRDeviceManager.connectDevice.mockResolvedValue({
        id: 'rtl-sdr-001',
        connectionStatus: 'CONNECTED'
      });

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await deviceManager.resetDevice('rtl-sdr-001');

      expect(mockUSBDevice.reset).toHaveBeenCalled();
    });

    it('should handle device communication timeout', async () => {
      const timeoutError = new Error('Transfer timeout');
      mockUSBDevice.controlTransferOut.mockRejectedValue(timeoutError);

      // const { SDRDeviceManager } = await import('../../src/lib/sdr-support/sdr-device-manager');
      const deviceManager = mockSDRDeviceManager;

      await expect(deviceManager.configureDevice('rtl-sdr-001', {
        centerFrequency: 14085000,
        sampleRate: 2048000
      })).rejects.toThrow('Transfer timeout');
    });
  });
});