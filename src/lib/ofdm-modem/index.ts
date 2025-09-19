/**
 * OFDM Modem - Mock implementation for testing
 */

export interface OFDMModemConfig {
  carriers: number;
  bandwidth: number;
}

export class OFDMModem {
  private carriers: number;
  private bandwidth: number;

  constructor(config: OFDMModemConfig) {
    this.carriers = config.carriers;
    this.bandwidth = config.bandwidth;
  }

  async transmit(data: Uint8Array, carriers: number[]): Promise<boolean> {
    return true;
  }

  getCarrierCount(): number {
    return this.carriers;
  }

  getBandwidth(): number {
    return this.bandwidth;
  }
}