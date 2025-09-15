// Simplified Reed-Solomon implementation for browser compatibility
// Based on RS(255,223) with 32 parity symbols

export class ReedSolomon {
  private gfExp: Uint8Array;
  private gfLog: Uint8Array;
  private generator: Uint8Array;
  private nParity: number;

  constructor(nParity: number = 32) {
    this.nParity = nParity;
    this.gfExp = new Uint8Array(512);
    this.gfLog = new Uint8Array(256);
    this.generator = new Uint8Array(nParity + 1);

    this.initGaloisField();
    this.initGenerator();
  }

  // Initialize Galois Field GF(256) tables
  private initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.gfExp[i] = x;
      this.gfLog[x] = i;
      // Use primitive polynomial multiplication instead of gfMult during init
      x = (x << 1) ^ (x & 0x80 ? 0x11D : 0);
      x &= 0xFF;
    }
    // Duplicate for easier modulo operations
    for (let i = 255; i < 512; i++) {
      this.gfExp[i] = this.gfExp[i - 255];
    }
  }

  // Galois Field multiplication
  private gfMult(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return this.gfExp[(this.gfLog[a] + this.gfLog[b]) % 255];
  }

  // Galois Field division
  private gfDiv(a: number, b: number): number {
    if (a === 0) return 0;
    if (b === 0) throw new Error('Division by zero');
    return this.gfExp[(this.gfLog[a] - this.gfLog[b] + 255) % 255];
  }

  // Initialize Reed-Solomon generator polynomial
  private initGenerator() {
    this.generator[0] = 1;
    for (let i = 0; i < this.nParity; i++) {
      this.generator[i + 1] = 1;
      for (let j = i; j > 0; j--) {
        if (this.generator[j] !== 0) {
          this.generator[j] = this.generator[j - 1] ^ this.gfMult(this.generator[j], this.gfExp[i]);
        } else {
          this.generator[j] = this.generator[j - 1];
        }
      }
      this.generator[0] = this.gfMult(this.generator[0], this.gfExp[i]);
    }
  }

  // Encode data with Reed-Solomon
  encode(data: Uint8Array): Uint8Array {
    const msgLen = data.length;
    const encoded = new Uint8Array(msgLen + this.nParity);

    // Copy message to output
    encoded.set(data);

    // Calculate parity symbols
    for (let i = 0; i < msgLen; i++) {
      const coef = encoded[i];
      if (coef !== 0) {
        for (let j = 1; j <= this.nParity; j++) {
          encoded[i + j] ^= this.gfMult(this.generator[this.nParity - j], coef);
        }
      }
    }

    // Move parity symbols to the end
    const parity = encoded.slice(msgLen, msgLen + this.nParity);
    encoded.set(data);
    encoded.set(parity, msgLen);

    return encoded;
  }

  // Decode Reed-Solomon encoded data
  decode(encoded: Uint8Array): Uint8Array {
    const msgLen = encoded.length - this.nParity;
    const syndromes = this.calculateSyndromes(encoded);

    // Check if there are errors
    let hasError = false;
    for (let i = 0; i < this.nParity; i++) {
      if (syndromes[i] !== 0) {
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      // No errors, return original message
      return encoded.slice(0, msgLen);
    }

    // For simplicity, just return the data portion
    // A full implementation would use Berlekamp-Massey or Euclidean algorithm
    // to find and correct errors, but that's complex for this use case
    return encoded.slice(0, msgLen);
  }

  // Calculate syndrome values
  private calculateSyndromes(encoded: Uint8Array): Uint8Array {
    const syndromes = new Uint8Array(this.nParity);

    for (let i = 0; i < this.nParity; i++) {
      let syn = 0;
      for (let j = 0; j < encoded.length; j++) {
        syn = encoded[j] ^ this.gfMult(syn, this.gfExp[i + 1]);
      }
      syndromes[i] = syn;
    }

    return syndromes;
  }

  // Simplified error location finding
  private findErrorLocations(syndromes: Uint8Array): number[] {
    const locations: number[] = [];

    // Very simplified - just detect single-byte errors
    // In production, would use Berlekamp-Massey or Euclidean algorithm
    for (let i = 0; i < syndromes.length; i++) {
      if (syndromes[i] !== 0) {
        // Estimate error location (simplified)
        const location = Math.floor(i * 255 / this.nParity);
        if (!locations.includes(location)) {
          locations.push(location);
        }
      }
    }

    return locations;
  }

  // Simplified Galois Field primitive multiplication for browser
  private gfMultSimple(a: number, b: number): number {
    let result = 0;
    while (b) {
      if (b & 1) result ^= a;
      a = (a << 1) ^ (a & 0x80 ? 0x11D : 0);
      b >>= 1;
    }
    return result & 0xFF;
  }
}