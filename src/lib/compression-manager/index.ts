/**
 * Compression Manager - Mock implementation for testing
 */

export class CompressionManager {
  private algorithm: string;
  private level: number;

  constructor(config: { algorithm: string; level: number }) {
    this.algorithm = config.algorithm;
    this.level = config.level;
  }

  async compress(data: Uint8Array): Promise<Uint8Array> {
    // Simple mock compression - 70% of original size
    const compressed = new Uint8Array(Math.floor(data.length * 0.7));
    compressed.set(data.slice(0, compressed.length));
    return compressed;
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    return data;
  }

  getCompressionRatio(original: number, compressed: number): number {
    return original / compressed;
  }
}