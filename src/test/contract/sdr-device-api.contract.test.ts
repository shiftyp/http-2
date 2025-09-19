/**
 * Contract Test: SDR Device API
 * Tests the core SDR device management API contracts
 *
 * CRITICAL: These tests MUST FAIL initially (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SDRDevice, SDRCapabilities, SDRDeviceType } from '../../lib/sdr-support/index.js';
import { SDRDeviceManager } from '../../lib/sdr-support/sdr-device-manager/index.js';

describe('SDR Device API Contracts', () => {
  let deviceManager: SDRDeviceManager;

  beforeEach(async () => {
    // Initialize SDR device manager
    deviceManager = new SDRDeviceManager();
    await deviceManager.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await deviceManager.cleanup();
  });

  describe('Device Discovery Contract', () => {
    it('should enumerate available SDR devices', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      expect(devices).toBeDefined();
      expect(Array.isArray(devices)).toBe(true);

      // Each device should have required properties
      devices.forEach(device => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('vendorId');
        expect(device).toHaveProperty('productId');
        expect(device).toHaveProperty('capabilities');
        expect(device).toHaveProperty('connected');
      });
    });

    it('should request user permission for new SDR device', async () => {
      // This test MUST FAIL initially
      const mockDevice = await deviceManager.requestDevice(['RTL_SDR']);

      expect(mockDevice).toBeDefined();
      expect(mockDevice.type).toBe('RTL_SDR');
      expect(mockDevice.vendorId).toBe(0x0bda);
      expect(mockDevice.connected).toBe(false);
    });

    it('should validate device capabilities', async () => {
      // This test MUST FAIL initially
      const capabilities: SDRCapabilities = {
        minFrequency: 24000000,
        maxFrequency: 1766000000,
        maxBandwidth: 3200000,
        sampleRates: [250000, 1024000, 1536000, 1792000, 1920000, 2048000, 2160000, 2560000, 2880000, 3200000],
        gainRange: { min: 0, max: 49.6 },
        hasFullDuplex: false,
        hasDiversityRx: false
      };

      const isValid = deviceManager.validateCapabilities(capabilities);
      expect(isValid).toBe(true);

      // Test invalid capabilities
      const invalidCapabilities = {
        ...capabilities,
        minFrequency: capabilities.maxFrequency + 1000000
      };

      const isInvalid = deviceManager.validateCapabilities(invalidCapabilities);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Device Connection Contract', () => {
    it('should connect to SDR device', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        const connected = await deviceManager.connectDevice(device.id);

        expect(connected).toBe(true);
        expect(device.connected).toBe(true);
      }
    });

    it('should disconnect from SDR device', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);
        const disconnected = await deviceManager.disconnectDevice(device.id);

        expect(disconnected).toBe(true);
        expect(device.connected).toBe(false);
      }
    });

    it('should handle device connection errors gracefully', async () => {
      // This test MUST FAIL initially
      const invalidDeviceId = 'nonexistent-device-id';

      await expect(deviceManager.connectDevice(invalidDeviceId))
        .rejects.toThrow('Device not found');
    });
  });

  describe('Device Configuration Contract', () => {
    it('should configure device frequency', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);

        const frequency = 144390000; // 2m band
        const configured = await deviceManager.setFrequency(device.id, frequency);

        expect(configured).toBe(true);

        const currentFreq = await deviceManager.getFrequency(device.id);
        expect(currentFreq).toBe(frequency);
      }
    });

    it('should configure device sample rate', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);

        const sampleRate = 2048000; // 2.048 MSPS
        const configured = await deviceManager.setSampleRate(device.id, sampleRate);

        expect(configured).toBe(true);

        const currentRate = await deviceManager.getSampleRate(device.id);
        expect(currentRate).toBe(sampleRate);
      }
    });

    it('should configure device gain settings', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);

        const gain = 20.7; // dB
        const configured = await deviceManager.setGain(device.id, gain);

        expect(configured).toBe(true);

        const currentGain = await deviceManager.getGain(device.id);
        expect(currentGain).toBeCloseTo(gain, 1);
      }
    });
  });

  describe('Data Streaming Contract', () => {
    it('should start IQ data streaming', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);

        const streamStarted = await deviceManager.startStreaming(device.id);
        expect(streamStarted).toBe(true);

        const isStreaming = await deviceManager.isStreaming(device.id);
        expect(isStreaming).toBe(true);
      }
    });

    it('should receive IQ data samples', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);
        await deviceManager.startStreaming(device.id);

        // Wait for data
        const samples = await new Promise((resolve) => {
          deviceManager.onDataReceived(device.id, (iqData: Float32Array) => {
            resolve(iqData);
          });
        });

        expect(samples).toBeDefined();
        expect(samples instanceof Float32Array).toBe(true);
        expect((samples as Float32Array).length).toBeGreaterThan(0);
      }
    });

    it('should stop IQ data streaming', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);
        await deviceManager.startStreaming(device.id);

        const streamStopped = await deviceManager.stopStreaming(device.id);
        expect(streamStopped).toBe(true);

        const isStreaming = await deviceManager.isStreaming(device.id);
        expect(isStreaming).toBe(false);
      }
    });
  });

  describe('Error Handling Contract', () => {
    it('should handle WebUSB not supported', async () => {
      // Mock navigator.usb as undefined
      const originalUSB = navigator.usb;
      (navigator as any).usb = undefined;

      const unsupportedManager = new SDRDeviceManager();

      await expect(unsupportedManager.initialize())
        .rejects.toThrow('WebUSB not supported');

      // Restore
      (navigator as any).usb = originalUSB;
    });

    it('should handle device permission denied', async () => {
      // This test MUST FAIL initially
      // Mock WebUSB requestDevice to throw permission error
      const originalRequestDevice = navigator.usb.requestDevice;
      navigator.usb.requestDevice = vi.fn().mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      await expect(deviceManager.requestDevice(['RTL_SDR']))
        .rejects.toThrow('Permission denied');

      // Restore
      navigator.usb.requestDevice = originalRequestDevice;
    });

    it('should handle device communication errors', async () => {
      // This test MUST FAIL initially
      const devices = await deviceManager.enumerateDevices();

      if (devices.length > 0) {
        const device = devices[0];
        await deviceManager.connectDevice(device.id);

        // Force device disconnect
        await deviceManager.disconnectDevice(device.id);

        // Try to configure disconnected device
        await expect(deviceManager.setFrequency(device.id, 144390000))
          .rejects.toThrow('Device not connected');
      }
    });
  });
});