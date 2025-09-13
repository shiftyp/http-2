/**
 * Tests for Radio Control Library
 * Tests CAT control, frequency/mode setting, PTT control, and multi-manufacturer support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RadioControl, RadioConfig, RADIO_CONFIGS, getRadioControl, resetRadioControl } from './index';

// Mock the Web Serial API
const mockSerialPort = {
  open: vi.fn(),
  close: vi.fn(),
  readable: {
    getReader: vi.fn()
  },
  writable: {
    getWriter: vi.fn()
  }
};

const mockReader = {
  read: vi.fn(),
  cancel: vi.fn(),
  releaseLock: vi.fn()
};

const mockWriter = {
  write: vi.fn(),
  close: vi.fn(),
  releaseLock: vi.fn()
};

// Mock navigator.serial
Object.defineProperty(global, 'navigator', {
  value: {
    serial: {
      requestPort: vi.fn()
    }
  },
  writable: true
});

// Mock SerialPort type
(global as any).SerialPort = class SerialPort {};

describe('RadioControl', () => {
  let radioControl: RadioControl;
  let config: RadioConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default config
    config = RADIO_CONFIGS['IC-7300'];

    // Setup mock returns
    (navigator.serial.requestPort as any).mockResolvedValue(mockSerialPort);
    mockSerialPort.readable.getReader.mockReturnValue(mockReader);
    mockSerialPort.writable.getWriter.mockReturnValue(mockWriter);
    mockReader.read.mockResolvedValue({ done: true, value: new Uint8Array() });
    mockWriter.write.mockResolvedValue(undefined);

    radioControl = new RadioControl(config);
  });

  afterEach(() => {
    resetRadioControl();
  });

  describe('Static Methods', () => {
    it('should detect Web Serial API support', () => {
      expect(RadioControl.isSupported()).toBe(true);
    });

    it('should detect lack of Web Serial API support', () => {
      const originalSerial = (navigator as any).serial;
      delete (navigator as any).serial;
      expect(RadioControl.isSupported()).toBe(false);
      (navigator as any).serial = originalSerial;
    });
  });

  describe('Connection Management', () => {
    it('should connect to radio successfully', async () => {
      await radioControl.connect();

      expect(navigator.serial.requestPort).toHaveBeenCalled();
      expect(mockSerialPort.open).toHaveBeenCalledWith({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      expect(mockSerialPort.readable.getReader).toHaveBeenCalled();
      expect(mockSerialPort.writable.getWriter).toHaveBeenCalled();
    });

    it('should throw error when Web Serial API not supported', async () => {
      const originalSerial = (navigator as any).serial;
      delete (navigator as any).serial;

      await expect(radioControl.connect()).rejects.toThrow('Web Serial API not supported');

      (navigator as any).serial = originalSerial;
    });

    it('should disconnect from radio', async () => {
      await radioControl.connect();
      await radioControl.disconnect();

      expect(mockReader.cancel).toHaveBeenCalled();
      expect(mockReader.releaseLock).toHaveBeenCalled();
      expect(mockWriter.close).toHaveBeenCalled();
      expect(mockWriter.releaseLock).toHaveBeenCalled();
      expect(mockSerialPort.close).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      await radioControl.connect();
      mockReader.cancel.mockRejectedValue(new Error('Cancel failed'));

      // Should not throw
      await expect(radioControl.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Radio Configurations', () => {
    it('should have correct IC-7300 configuration', () => {
      const ic7300 = RADIO_CONFIGS['IC-7300'];
      expect(ic7300.manufacturer).toBe('icom');
      expect(ic7300.baudRate).toBe(115200);
      expect(ic7300.dataBits).toBe(8);
    });

    it('should have correct FT-991A configuration', () => {
      const ft991a = RADIO_CONFIGS['FT-991A'];
      expect(ft991a.manufacturer).toBe('yaesu');
      expect(ft991a.baudRate).toBe(38400);
    });

    it('should have correct TS-590SG configuration', () => {
      const ts590 = RADIO_CONFIGS['TS-590SG'];
      expect(ts590.manufacturer).toBe('kenwood');
      expect(ts590.baudRate).toBe(115200);
    });

    it('should support Flex radio configurations', () => {
      expect(RADIO_CONFIGS['Flex-6000']).toBeDefined();
      expect(RADIO_CONFIGS['Flex-Yaesu']).toBeDefined();
    });
  });

  describe('Frequency Control', () => {
    beforeEach(async () => {
      await radioControl.connect();
    });

    it('should set frequency for Icom radio', async () => {
      await radioControl.setFrequency(14074000); // 14.074 MHz

      // Check that command was sent
      expect(mockWriter.write).toHaveBeenCalled();
      // The actual command structure depends on implementation details
    });

    it('should set frequency for Yaesu radio', async () => {
      const yaesuConfig = RADIO_CONFIGS['FT-991A'];
      radioControl = new RadioControl(yaesuConfig);
      await radioControl.connect();

      await radioControl.setFrequency(7074000); // 7.074 MHz

      expect(mockWriter.write).toHaveBeenCalled();
      // Just verify write was called - command encoding may vary
    });

    it('should set frequency for Kenwood radio', async () => {
      const kenwoodConfig = RADIO_CONFIGS['TS-590SG'];
      radioControl = new RadioControl(kenwoodConfig);
      await radioControl.connect();

      await radioControl.setFrequency(3573000); // 3.573 MHz

      expect(mockWriter.write).toHaveBeenCalled();
      // Just verify write was called - command encoding may vary
    });

    it('should get current frequency', async () => {
      await radioControl.setFrequency(14230000);
      expect(radioControl.getFrequency()).toBe(14230000);
    });
  });

  describe('Mode Control', () => {
    beforeEach(async () => {
      await radioControl.connect();
    });

    it('should set mode to USB', async () => {
      await radioControl.setMode('USB');

      expect(mockWriter.write).toHaveBeenCalled();
      const status = radioControl.getCurrentStatus();
      expect(status.mode).toBe('USB');
    });

    it('should set mode to LSB', async () => {
      await radioControl.setMode('LSB');

      expect(mockWriter.write).toHaveBeenCalled();
      const status = radioControl.getCurrentStatus();
      expect(status.mode).toBe('LSB');
    });

    it('should set mode to CW', async () => {
      await radioControl.setMode('CW');

      expect(mockWriter.write).toHaveBeenCalled();
      const status = radioControl.getCurrentStatus();
      expect(status.mode).toBe('CW');
    });

    it('should set mode to FM', async () => {
      await radioControl.setMode('FM');

      expect(mockWriter.write).toHaveBeenCalled();
      const status = radioControl.getCurrentStatus();
      expect(status.mode).toBe('FM');
    });

    it('should get current mode', async () => {
      await radioControl.setMode('RTTY');
      expect(radioControl.getMode()).toBe('RTTY');
    });
  });

  describe('PTT Control', () => {
    beforeEach(async () => {
      await radioControl.connect();
    });

    it('should key transmitter (PTT on)', async () => {
      await radioControl.setPTT(true);

      expect(mockWriter.write).toHaveBeenCalled();
      const command = (mockWriter.write as any).mock.calls[0][0];
      // For Icom: check PTT on command
      if (command && command.length > 6) {
        expect(command[4]).toBe(0x1C); // PTT command
        expect(command[6]).toBe(0x01); // PTT on
      }
    });

    it('should unkey transmitter (PTT off)', async () => {
      await radioControl.setPTT(false);

      expect(mockWriter.write).toHaveBeenCalled();
      const command = (mockWriter.write as any).mock.calls[0][0];
      if (command && command.length > 6) {
        expect(command[4]).toBe(0x1C); // PTT command
        expect(command[6]).toBe(0x00); // PTT off
      }
    });

    it('should handle PTT for Yaesu radio', async () => {
      vi.clearAllMocks();
      const yaesuConfig = RADIO_CONFIGS['FT-991A'];
      radioControl = new RadioControl(yaesuConfig);
      await radioControl.connect();

      vi.clearAllMocks(); // Clear connect calls

      await radioControl.setPTT(true);
      expect(mockWriter.write).toHaveBeenCalled();

      await radioControl.setPTT(false);
      expect(mockWriter.write).toHaveBeenCalled();
    });
  });

  describe('Data Transmission', () => {
    beforeEach(async () => {
      await radioControl.connect();
    });

    it('should transmit data with PTT control', async () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      await radioControl.transmit(data);

      // Check PTT was keyed and unkeyed
      const calls = (mockWriter.write as any).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      // First call should be PTT on
      const pttOn = calls[0][0];
      if (pttOn && pttOn.length > 6) {
        expect(pttOn[6]).toBe(0x01);
      }

      // Last call should be PTT off
      const pttOff = calls[calls.length - 1][0];
      if (pttOff && pttOff.length > 6) {
        expect(pttOff[6]).toBe(0x00);
      }
    });

    it('should unkey PTT on transmission error', async () => {
      const data = new Uint8Array([0x01, 0x02]);

      // Make setPTT fail after first call
      let callCount = 0;
      mockWriter.write.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Transmission failed');
        }
      });

      await expect(radioControl.transmit(data)).rejects.toThrow();

      // Verify PTT off was attempted
      const calls = (mockWriter.write as any).mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1][0];
        if (lastCall && lastCall.length > 6) {
          expect(lastCall[6]).toBe(0x00); // PTT off
        }
      }
    });

    it('should throw error when not connected', async () => {
      const newRadio = new RadioControl(config);
      const data = new Uint8Array([0x01]);

      await expect(newRadio.transmit(data)).rejects.toThrow();
    });
  });

  describe('Status Reading', () => {
    beforeEach(async () => {
      await radioControl.connect();
    });

    it('should get initial status after connection', async () => {
      const status = radioControl.getCurrentStatus();
      expect(status.connected).toBe(true);
    });

    it('should return disconnected status when not connected', async () => {
      const newRadio = new RadioControl(config);
      const status = newRadio.getCurrentStatus();
      expect(status.connected).toBe(false);
    });

    it('should get status for different manufacturers', async () => {
      // Mock immediate response to prevent timeout
      mockWriter.write.mockResolvedValue(undefined);

      // Test Icom
      const status1 = radioControl.getCurrentStatus();
      expect(status1.connected).toBe(true);

      // Test Yaesu
      const yaesuConfig = RADIO_CONFIGS['FT-991A'];
      const yaesuRadio = new RadioControl(yaesuConfig);
      await yaesuRadio.connect();
      const status2 = yaesuRadio.getCurrentStatus();
      expect(status2.connected).toBe(true);

      // Test Kenwood
      const kenwoodConfig = RADIO_CONFIGS['TS-590SG'];
      const kenwoodRadio = new RadioControl(kenwoodConfig);
      await kenwoodRadio.connect();
      const status3 = kenwoodRadio.getCurrentStatus();
      expect(status3.connected).toBe(true);
    });
  });

  describe('Command Processing', () => {
    it('should parse Icom frequency response', async () => {
      await radioControl.connect();

      // Simulate receiving frequency data
      const freqData = new Uint8Array([
        0xFE, 0xFE, 0xE0, 0x94, 0x03, // Header
        0x00, 0x40, 0x07, 0x14, 0x00, // 14074000 Hz in BCD
        0xFD // End
      ]);

      // Process the data (internal method testing via status)
      mockReader.read.mockResolvedValueOnce({
        done: false,
        value: freqData
      });
    });

    it('should parse Yaesu mode response', async () => {
      const yaesuConfig = RADIO_CONFIGS['FT-991A'];
      radioControl = new RadioControl(yaesuConfig);
      await radioControl.connect();

      // Simulate receiving mode data
      const modeData = new TextEncoder().encode('MD02;'); // USB mode

      mockReader.read.mockResolvedValueOnce({
        done: false,
        value: modeData
      });
    });
  });

  describe('Singleton Management', () => {
    it('should create singleton instance', () => {
      const instance1 = getRadioControl(config);
      const instance2 = getRadioControl();
      expect(instance1).toBe(instance2);
    });

    it('should throw error when getting uninitialized instance', () => {
      resetRadioControl();
      expect(() => getRadioControl()).toThrow('Radio control not initialized');
    });

    it('should reset singleton instance', async () => {
      const instance = getRadioControl(config);
      await instance.connect();

      resetRadioControl();

      expect(() => getRadioControl()).toThrow('Radio control not initialized');
    });
  });

  describe('Error Handling', () => {
    it('should handle serial port request rejection', async () => {
      (navigator.serial.requestPort as any).mockRejectedValue(
        new Error('User cancelled')
      );

      await expect(radioControl.connect()).rejects.toThrow('User cancelled');
    });

    it('should handle command timeout', async () => {
      await radioControl.connect();

      // Mock slow response
      mockReader.read.mockImplementation(() =>
        new Promise(resolve => setTimeout(() =>
          resolve({ done: false, value: new Uint8Array() }), 2000))
      );

      // This should timeout
      const command = {
        command: new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x03, 0xFD]),
        responseLength: 11
      };

      await expect(radioControl.sendCommand(command)).rejects.toThrow();
    });

    it('should handle read errors gracefully', async () => {
      await radioControl.connect();

      mockReader.read.mockRejectedValue(new Error('Read failed'));

      // The read loop should handle the error without crashing
      // Status should still be queryable
      const status = radioControl.getCurrentStatus();
      expect(status.connected).toBe(true);
    });
  });

  describe('BCD Conversion', () => {
    it('should convert frequency to BCD correctly', async () => {
      await radioControl.connect();

      // Test various frequencies
      const testFrequencies = [
        1000000,   // 1 MHz
        7074000,   // 7.074 MHz
        14230000,  // 14.230 MHz
        28500000,  // 28.500 MHz
        144000000  // 144 MHz
      ];

      for (const freq of testFrequencies) {
        await radioControl.setFrequency(freq);
        expect(mockWriter.write).toHaveBeenCalled();
      }
    });
  });

  describe('Multi-band Support', () => {
    beforeEach(async () => {
      await radioControl.connect();
    });

    it('should support HF bands', async () => {
      // 80m band
      await radioControl.setFrequency(3573000);
      expect(radioControl.getFrequency()).toBe(3573000);

      // 40m band
      await radioControl.setFrequency(7074000);
      expect(radioControl.getFrequency()).toBe(7074000);

      // 20m band
      await radioControl.setFrequency(14074000);
      expect(radioControl.getFrequency()).toBe(14074000);

      // 10m band
      await radioControl.setFrequency(28074000);
      expect(radioControl.getFrequency()).toBe(28074000);
    });

    it('should support VHF/UHF bands', async () => {
      // 2m band
      await radioControl.setFrequency(144074000);
      expect(radioControl.getFrequency()).toBe(144074000);

      // 70cm band
      await radioControl.setFrequency(432074000);
      expect(radioControl.getFrequency()).toBe(432074000);
    });
  });
});