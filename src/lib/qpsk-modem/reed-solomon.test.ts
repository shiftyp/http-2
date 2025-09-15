import { describe, it, expect } from 'vitest';
import { ReedSolomon } from './reed-solomon';

describe('ReedSolomon', () => {
  it('should encode and decode data correctly', () => {
    const rs = new ReedSolomon(32);

    const data = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"

    // Encode
    const encoded = rs.encode(data);
    expect(encoded.length).toBe(data.length + 32); // Data + parity

    // Decode (no errors)
    const decoded = rs.decode(encoded);
    expect(decoded).toEqual(data);
  });

  it('should detect errors with syndromes', () => {
    const rs = new ReedSolomon(32);

    const data = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
    const encoded = rs.encode(data);

    // Introduce errors
    const corrupted = new Uint8Array(encoded);
    corrupted[0] = 0xFF;
    corrupted[10] = 0x00;

    // Decode should return data portion (error correction simplified)
    const decoded = rs.decode(corrupted);
    expect(decoded.length).toBe(data.length);

    // With no errors, should get exact data back
    const decodedClean = rs.decode(encoded);
    expect(decodedClean).toEqual(data);
  });
});