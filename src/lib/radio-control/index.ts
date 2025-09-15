/**
 * Web Serial API wrapper for CAT (Computer Aided Transceiver) control
 * Supports common ham radio models from Icom, Yaesu, and Kenwood
 */

export interface RadioConfig {
  manufacturer: 'icom' | 'yaesu' | 'kenwood' | 'generic';
  model: string;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl: 'none' | 'hardware';
}

export interface RadioStatus {
  connected: boolean;
  frequency?: number;  // Hz
  mode?: string;       // USB, LSB, FM, AM, CW, etc.
  power?: number;      // Watts
  swr?: number;        // Standing Wave Ratio
  signalStrength?: number; // S-meter reading
  vfoA?: number;       // VFO A frequency
  vfoB?: number;       // VFO B frequency
  activeVfo?: 'A' | 'B';
}

export interface CATCommand {
  command: Uint8Array;
  responseLength?: number;
  parseResponse?: (data: Uint8Array) => any;
}

// Common radio configurations
export const RADIO_CONFIGS: Record<string, RadioConfig> = {
  'IC-7300': {
    manufacturer: 'icom',
    model: 'IC-7300',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  'IC-705': {
    manufacturer: 'icom',
    model: 'IC-705',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  'FT-991A': {
    manufacturer: 'yaesu',
    model: 'FT-991A',
    baudRate: 38400,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  'TS-590SG': {
    manufacturer: 'kenwood',
    model: 'TS-590SG',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  'Flex-6000': {
    manufacturer: 'kenwood',  // Flex supports Kenwood CAT commands
    model: 'Flex-6000',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  'Flex-Yaesu': {
    manufacturer: 'yaesu',    // Flex also supports Yaesu CAT commands
    model: 'Flex-6000-Yaesu',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  }
};

export class RadioControl {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private config: RadioConfig;
  private status: RadioStatus = { connected: false };
  private readBuffer: Uint8Array = new Uint8Array(1024);
  private bufferIndex = 0;

  constructor(config: RadioConfig) {
    this.config = config;
  }

  /**
   * Check if Web Serial API is supported
   */
  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Request and connect to a serial port
   */
  async connect(): Promise<void> {
    if (!RadioControl.isSupported()) {
      throw new Error('Web Serial API not supported in this browser');
    }

    try {
      // Request port access
      this.port = await navigator.serial.requestPort();
      
      // Open the port with specified configuration
      await this.port.open({
        baudRate: this.config.baudRate,
        dataBits: this.config.dataBits,
        stopBits: this.config.stopBits,
        parity: this.config.parity,
        flowControl: this.config.flowControl
      });

      // Setup reader and writer
      if (this.port.readable && this.port.writable) {
        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();
        this.status.connected = true;
        
        // Start reading loop
        this.startReading();
        
        // Get initial status
        await this.getStatus();
      }
    } catch (error) {
      console.error('Failed to connect to radio:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the radio
   */
  async disconnect(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }

      if (this.writer) {
        await this.writer.close();
        this.writer.releaseLock();
        this.writer = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.status.connected = false;
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  /**
   * Start reading data from the serial port
   */
  private async startReading(): Promise<void> {
    if (!this.reader) return;

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        // Process received data
        this.processReceivedData(value);
      }
    } catch (error) {
      console.error('Read error:', error);
    }
  }

  /**
   * Process data received from the radio
   */
  private processReceivedData(data: Uint8Array): void {
    // Add to buffer
    for (let i = 0; i < data.length; i++) {
      if (this.bufferIndex < this.readBuffer.length) {
        this.readBuffer[this.bufferIndex++] = data[i];
      }
    }
    
    // Process complete messages based on manufacturer
    this.processCAResponse();
  }

  /**
   * Send a CAT command to the radio
   */
  async sendCommand(command: CATCommand): Promise<any> {
    if (!this.writer) {
      throw new Error('Not connected to radio');
    }

    try {
      // Clear buffer before sending
      this.bufferIndex = 0;
      
      // Send command
      await this.writer.write(command.command);
      
      // Wait for response if expected
      if (command.responseLength) {
        await this.waitForResponse(command.responseLength);
        
        if (command.parseResponse) {
          const response = this.readBuffer.slice(0, command.responseLength);
          return command.parseResponse(response);
        }
      }
    } catch (error) {
      console.error('Failed to send command:', error);
      throw error;
    }
  }

  /**
   * Wait for a response of specified length
   */
  private async waitForResponse(length: number, timeout = 1000): Promise<void> {
    const startTime = Date.now();
    
    while (this.bufferIndex < length) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Response timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Process manufacturer-specific CAT responses
   */
  private processCAResponse(): void {
    switch (this.config.manufacturer) {
      case 'icom':
        this.processIcomResponse();
        break;
      case 'yaesu':
        this.processYaesuResponse();
        break;
      case 'kenwood':
        this.processKenwoodResponse();
        break;
    }
  }

  /**
   * Process Icom CI-V responses
   */
  private processIcomResponse(): void {
    // Icom uses 0xFE 0xFE as start and 0xFD as end
    if (this.bufferIndex >= 6) {
      if (this.readBuffer[0] === 0xFE && this.readBuffer[1] === 0xFE) {
        // Find end marker
        for (let i = 2; i < this.bufferIndex; i++) {
          if (this.readBuffer[i] === 0xFD) {
            // Complete message found
            const message = this.readBuffer.slice(0, i + 1);
            this.parseIcomMessage(message);
            
            // Remove processed message from buffer
            this.readBuffer.copyWithin(0, i + 1, this.bufferIndex);
            this.bufferIndex -= (i + 1);
            break;
          }
        }
      }
    }
  }

  /**
   * Parse Icom CI-V message
   */
  private parseIcomMessage(message: Uint8Array): void {
    // Message format: FE FE [to] [from] [command] [data...] FD
    const command = message[4];
    
    switch (command) {
      case 0x03: // Read frequency
        this.status.frequency = this.parseIcomFrequency(message.slice(5, -1));
        break;
      case 0x04: // Read mode
        this.status.mode = this.parseIcomMode(message[5]);
        break;
    }
  }

  /**
   * Parse Icom frequency (BCD format)
   */
  private parseIcomFrequency(data: Uint8Array): number {
    let freq = 0;
    let multiplier = 1;
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      freq += ((byte & 0x0F) * multiplier);
      freq += ((byte >> 4) * multiplier * 10);
      multiplier *= 100;
    }
    
    return freq;
  }

  /**
   * Parse Icom mode
   */
  private parseIcomMode(mode: number): string {
    const modes: Record<number, string> = {
      0x00: 'LSB',
      0x01: 'USB',
      0x02: 'AM',
      0x03: 'CW',
      0x04: 'RTTY',
      0x05: 'FM',
      0x07: 'CW-R',
      0x08: 'RTTY-R'
    };
    return modes[mode] || 'Unknown';
  }

  /**
   * Process Yaesu CAT responses
   */
  private processYaesuResponse(): void {
    // Yaesu uses semicolon-terminated commands
    for (let i = 0; i < this.bufferIndex; i++) {
      if (this.readBuffer[i] === 0x3B) { // ';'
        const message = this.readBuffer.slice(0, i + 1);
        this.parseYaesuMessage(message);
        
        // Remove processed message
        this.readBuffer.copyWithin(0, i + 1, this.bufferIndex);
        this.bufferIndex -= (i + 1);
        break;
      }
    }
  }

  /**
   * Parse Yaesu CAT message
   */
  private parseYaesuMessage(message: Uint8Array): void {
    const text = new TextDecoder().decode(message);
    
    if (text.startsWith('FA')) {
      // VFO-A frequency
      this.status.vfoA = parseInt(text.substring(2, 10));
    } else if (text.startsWith('FB')) {
      // VFO-B frequency
      this.status.vfoB = parseInt(text.substring(2, 10));
    } else if (text.startsWith('MD')) {
      // Mode
      this.status.mode = this.parseYaesuMode(text.charAt(2));
    }
  }

  /**
   * Parse Yaesu mode
   */
  private parseYaesuMode(mode: string): string {
    const modes: Record<string, string> = {
      '1': 'LSB',
      '2': 'USB',
      '3': 'CW-U',
      '4': 'FM',
      '5': 'AM',
      '6': 'RTTY-L',
      '7': 'CW-L',
      '8': 'DATA-L',
      '9': 'RTTY-U',
      'A': 'DATA-FM',
      'B': 'FM-N',
      'C': 'DATA-U',
      'D': 'AM-N',
      'E': 'C4FM'
    };
    return modes[mode] || 'Unknown';
  }

  /**
   * Process Kenwood responses
   */
  private processKenwoodResponse(): void {
    // Kenwood uses semicolon-terminated commands like Yaesu
    this.processYaesuResponse(); // Similar format
  }

  /**
   * Get current radio status
   */
  async getStatus(): Promise<RadioStatus> {
    if (!this.status.connected) {
      return this.status;
    }

    try {
      // Get frequency and mode based on manufacturer
      switch (this.config.manufacturer) {
        case 'icom':
          await this.getIcomStatus();
          break;
        case 'yaesu':
          await this.getYaesuStatus();
          break;
        case 'kenwood':
          await this.getKenwoodStatus();
          break;
      }
    } catch (error) {
      console.error('Failed to get status:', error);
    }

    return this.status;
  }

  /**
   * Get Icom radio status
   */
  private async getIcomStatus(): Promise<void> {
    // Read frequency: FE FE [radio] E0 03 FD
    await this.sendCommand({
      command: new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x03, 0xFD]),
      responseLength: 11
    });

    // Read mode: FE FE [radio] E0 04 FD
    await this.sendCommand({
      command: new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x04, 0xFD]),
      responseLength: 8
    });
  }

  /**
   * Get Yaesu radio status
   */
  private async getYaesuStatus(): Promise<void> {
    // Read VFO-A frequency
    await this.sendCommand({
      command: new TextEncoder().encode('FA;'),
      responseLength: 11
    });

    // Read mode
    await this.sendCommand({
      command: new TextEncoder().encode('MD0;'),
      responseLength: 4
    });
  }

  /**
   * Get Kenwood radio status
   */
  private async getKenwoodStatus(): Promise<void> {
    // Read frequency
    await this.sendCommand({
      command: new TextEncoder().encode('FA;'),
      responseLength: 14
    });

    // Read mode
    await this.sendCommand({
      command: new TextEncoder().encode('MD;'),
      responseLength: 4
    });
  }

  /**
   * Set frequency
   */
  async setFrequency(frequency: number): Promise<void> {
    switch (this.config.manufacturer) {
      case 'icom':
        await this.setIcomFrequency(frequency);
        break;
      case 'yaesu':
        await this.setYaesuFrequency(frequency);
        break;
      case 'kenwood':
        await this.setKenwoodFrequency(frequency);
        break;
    }
    
    this.status.frequency = frequency;
  }

  /**
   * Set Icom frequency
   */
  private async setIcomFrequency(frequency: number): Promise<void> {
    // Convert frequency to BCD
    const bcd = this.frequencyToBCD(frequency);
    const command = new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x05, ...bcd, 0xFD]);
    await this.sendCommand({ command });
  }

  /**
   * Set Yaesu frequency
   */
  private async setYaesuFrequency(frequency: number): Promise<void> {
    const freqStr = frequency.toString().padStart(8, '0');
    const command = new TextEncoder().encode(`FA${freqStr};`);
    await this.sendCommand({ command });
  }

  /**
   * Set Kenwood frequency
   */
  private async setKenwoodFrequency(frequency: number): Promise<void> {
    const freqStr = frequency.toString().padStart(11, '0');
    const command = new TextEncoder().encode(`FA${freqStr};`);
    await this.sendCommand({ command });
  }

  /**
   * Convert frequency to BCD format for Icom
   */
  private frequencyToBCD(frequency: number): Uint8Array {
    const bcd: number[] = [];
    let freq = frequency;
    
    for (let i = 0; i < 5; i++) {
      const low = freq % 10;
      freq = Math.floor(freq / 10);
      const high = freq % 10;
      freq = Math.floor(freq / 10);
      bcd.push((high << 4) | low);
    }
    
    return new Uint8Array(bcd);
  }

  /**
   * Set operating mode
   */
  async setMode(mode: string): Promise<void> {
    switch (this.config.manufacturer) {
      case 'icom':
        await this.setIcomMode(mode);
        break;
      case 'yaesu':
        await this.setYaesuMode(mode);
        break;
      case 'kenwood':
        await this.setKenwoodMode(mode);
        break;
    }
    
    this.status.mode = mode;
  }

  /**
   * Set Icom mode
   */
  private async setIcomMode(mode: string): Promise<void> {
    const modes: Record<string, number> = {
      'LSB': 0x00,
      'USB': 0x01,
      'AM': 0x02,
      'CW': 0x03,
      'RTTY': 0x04,
      'FM': 0x05
    };
    
    const modeCode = modes[mode] || 0x01; // Default to USB
    const command = new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x06, modeCode, 0xFD]);
    await this.sendCommand({ command });
  }

  /**
   * Set Yaesu mode
   */
  private async setYaesuMode(mode: string): Promise<void> {
    const modes: Record<string, string> = {
      'LSB': '1',
      'USB': '2',
      'CW': '3',
      'FM': '4',
      'AM': '5',
      'RTTY': '6'
    };
    
    const modeCode = modes[mode] || '2'; // Default to USB
    const command = new TextEncoder().encode(`MD0${modeCode};`);
    await this.sendCommand({ command });
  }

  /**
   * Set Kenwood mode
   */
  private async setKenwoodMode(mode: string): Promise<void> {
    const modes: Record<string, string> = {
      'LSB': '1',
      'USB': '2',
      'CW': '3',
      'FM': '4',
      'AM': '5',
      'RTTY': '6'
    };
    
    const modeCode = modes[mode] || '2';
    const command = new TextEncoder().encode(`MD${modeCode};`);
    await this.sendCommand({ command });
  }

  /**
   * Key/unkey the transmitter (PTT)
   */
  async setPTT(on: boolean): Promise<void> {
    switch (this.config.manufacturer) {
      case 'icom':
        // Icom: FE FE [radio] E0 1C 00 [on/off] FD
        const pttValue = on ? 0x01 : 0x00;
        await this.sendCommand({
          command: new Uint8Array([0xFE, 0xFE, 0x94, 0xE0, 0x1C, 0x00, pttValue, 0xFD])
        });
        break;
        
      case 'yaesu':
        // Yaesu: TX; for transmit, RX; for receive
        const cmd = on ? 'TX;' : 'RX;';
        await this.sendCommand({
          command: new TextEncoder().encode(cmd)
        });
        break;
        
      case 'kenwood':
        // Kenwood: TX; for transmit, RX; for receive
        const kenwoodCmd = on ? 'TX;' : 'RX;';
        await this.sendCommand({
          command: new TextEncoder().encode(kenwoodCmd)
        });
        break;
    }
  }

  /**
   * Get current status
   */
  getCurrentStatus(): RadioStatus {
    return { ...this.status };
  }

  /**
   * Get current frequency in Hz
   */
  getFrequency(): number | undefined {
    return this.status.frequency;
  }

  /**
   * Get current mode
   */
  getMode(): string | undefined {
    return this.status.mode;
  }

  /**
   * Get current power output in watts
   */
  getPower(): number | undefined {
    return this.status.power;
  }

  /**
   * Get current SWR
   */
  getSWR(): number | undefined {
    return this.status.swr;
  }

  /**
   * Transmit data over radio
   * This is a high-level method that handles PTT and data transmission
   */
  async transmit(data: Uint8Array): Promise<void> {
    if (!this.status.connected) {
      throw new Error('Radio not connected');
    }

    try {
      // Key the transmitter
      await this.setPTT(true);

      // Wait for TX to stabilize (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));

      // In a real implementation, this would interface with the sound card
      // to modulate and transmit the data
      console.log(`Transmitting ${data.length} bytes`);

      // Simulate transmission time based on data rate
      // Assuming ~1200 baud for packet radio
      const transmissionTime = (data.length * 8 / 1200) * 1000;
      await new Promise(resolve => setTimeout(resolve, transmissionTime));

      // Unkey the transmitter
      await this.setPTT(false);

    } catch (error) {
      // Make sure we unkey on error
      await this.setPTT(false);
      throw error;
    }
  }

  /**
   * Start receiving data over radio
   * In a real implementation, this would set up audio processing for demodulation
   */
  startReceive(onData: (data: Uint8Array) => void): void {
    // In a real implementation, this would:
    // 1. Set up Web Audio API for audio capture
    // 2. Implement demodulation (PSK31, RTTY, etc.)
    // 3. Call onData when valid data is received

    // For testing, this is a no-op
    console.log('Started receiving data over radio');
  }
}

// Export a singleton instance for the application
let radioInstance: RadioControl | null = null;

export function getRadioControl(config?: RadioConfig): RadioControl {
  if (!radioInstance && config) {
    radioInstance = new RadioControl(config);
  }
  if (!radioInstance) {
    throw new Error('Radio control not initialized');
  }
  return radioInstance;
}

export function resetRadioControl(): void {
  if (radioInstance) {
    radioInstance.disconnect();
    radioInstance = null;
  }
}