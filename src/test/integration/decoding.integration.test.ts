import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './setup';
import { AdaptiveModem } from '../../lib/qpsk-modem/adaptive-modem';
import { HamRadioCompressor } from '../../lib/compression';
import { CryptoManager } from '../../lib/crypto';
import { HTTPProtocol } from '../../lib/http-protocol';

/**
 * Integration tests for the complete decoding chain
 * Tests the flow from modulated radio signal to decoded HTTP request/response
 */
describe('Decoding Chain Integration', () => {
  let modem: AdaptiveModem;
  let compressor: HamRadioCompressor;
  let crypto: CryptoManager;
  let protocol: HTTPProtocol;

  beforeEach(async () => {
    // Initialize adaptive modem with test configuration
    modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: true
    });

    // Initialize other components
    compressor = new HamRadioCompressor();
    crypto = new CryptoManager();
    protocol = new HTTPProtocol({
      callsign: 'TEST1',
      compressor,
      crypto
    });

    // Mock crypto manager to avoid indexedDB issues
    const mockKeyPair = {
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
      publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
      callsign: 'TEST1',
      created: Date.now(),
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000
    };

    (crypto as any).keyPair = mockKeyPair;
    vi.spyOn(crypto, 'generateKeyPair').mockImplementation(async (callsign: string) => {
      (crypto as any).keyPair = mockKeyPair;
      return mockKeyPair;
    });
    vi.spyOn(crypto, 'sign').mockResolvedValue('mock-signature');
    vi.spyOn(crypto, 'verify').mockResolvedValue(true);
    vi.spyOn(crypto, 'close').mockResolvedValue();
  });

  afterEach(() => {
    // Clean up
    modem.stopReceive();
  });

  /**
   * Helper function to simulate channel effects on a signal
   */
  function addChannelEffects(signal: Float32Array, options: {
    snrDb: number;
    multipath: boolean;
    fading: boolean;
  }): Float32Array {
    const output = new Float32Array(signal.length);

    // Add white gaussian noise based on SNR
    const signalPower = signal.reduce((sum, s) => sum + s * s, 0) / signal.length;
    const noisePower = signalPower / Math.pow(10, options.snrDb / 10);
    const noiseAmplitude = Math.sqrt(noisePower);

    for (let i = 0; i < signal.length; i++) {
      // Base signal with noise
      output[i] = signal[i] + (Math.random() - 0.5) * 2 * noiseAmplitude;

      // Add multipath if enabled (simple echo)
      if (options.multipath && i > 100) {
        output[i] += signal[i - 100] * 0.3;
      }

      // Add fading if enabled (simple amplitude variation)
      if (options.fading) {
        const fadingFactor = 0.7 + 0.3 * Math.sin(2 * Math.PI * i / 1000);
        output[i] *= fadingFactor;
      }
    }

    return output;
  }

  describe('Signal to HTTP Decoding', () => {
    it('should decode clean QPSK signal to HTTP request', async () => {
      // Create test HTTP request
      const request = {
        method: 'GET',
        url: 'http://test.radio/data',
        headers: {
          'X-Callsign': 'TEST1',
          'X-Request-ID': 'req-123'
        },
        body: undefined
      };

      // Encode to protocol packet
      const packet = protocol.encodeRequest(request);

      // Modulate to QPSK signal
      const signal = modem.modulate(packet);

      // Demodulate back
      const demodulated = modem.demodulate(signal);

      // Decode protocol packet
      const decoded = protocol.decodePacket(demodulated);

      // Verify the decoded request matches
      expect(decoded.type).toBe('REQUEST');
      expect(decoded.method).toBe('GET');
      expect(decoded.url).toBe('http://test.radio/data');
      expect(decoded.headers['X-Callsign']).toBe('TEST1');
    });

    it('should decode HTTP response with compression', async () => {
      // Create test HTTP response with HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Amateur Radio Web</h1>
          <p>This is a test page transmitted over ham radio.</p>
        </body>
        </html>
      `;

      const response = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/html',
          'ETag': '"abc123"'
        },
        body: htmlContent
      };

      // Encode and compress
      const packet = protocol.encodeResponse(response);

      // Modulate
      const signal = modem.modulate(packet);

      // Demodulate
      const demodulated = modem.demodulate(signal);

      // Decode
      const decoded = protocol.decodePacket(demodulated);

      // Verify
      expect(decoded.type).toBe('RESPONSE');
      expect(decoded.status).toBe(200);
      expect(decoded.headers['Content-Type']).toBe('text/html');
      expect(decoded.body).toContain('Amateur Radio Web');
    });

    it('should handle noisy channel (10dB SNR)', async () => {
      const request = {
        method: 'POST',
        url: 'http://test.radio/submit',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'name=test&value=123'
      };

      const packet = protocol.encodeRequest(request);
      const signal = modem.modulate(packet);

      // Add channel noise
      const noisySignal = addChannelEffects(signal, {
        snrDb: 10,
        multipath: false,
        fading: false
      });

      // Try to demodulate noisy signal
      const demodulated = modem.demodulate(noisySignal);
      const decoded = protocol.decodePacket(demodulated);

      // With FEC, should still decode correctly
      expect(decoded.type).toBe('REQUEST');
      expect(decoded.method).toBe('POST');
      expect(decoded.body).toBe('name=test&value=123');
    });

    it('should handle multipath propagation', async () => {
      const request = {
        method: 'GET',
        url: 'http://test.radio/status',
        headers: {}
      };

      const packet = protocol.encodeRequest(request);
      const signal = modem.modulate(packet);

      // Add multipath effects
      const multipathSignal = addChannelEffects(signal, {
        snrDb: 15,
        multipath: true,
        fading: false
      });

      const demodulated = modem.demodulate(multipathSignal);
      const decoded = protocol.decodePacket(demodulated);

      expect(decoded.type).toBe('REQUEST');
      expect(decoded.url).toBe('http://test.radio/status');
    });

    it('should handle fading channel', async () => {
      const response = {
        status: 304,
        statusText: 'Not Modified',
        headers: {
          'ETag': '"unchanged"'
        },
        body: undefined
      };

      const packet = protocol.encodeResponse(response);
      const signal = modem.modulate(packet);

      // Add fading effects
      const fadingSignal = addChannelEffects(signal, {
        snrDb: 12,
        multipath: false,
        fading: true
      });

      const demodulated = modem.demodulate(fadingSignal);
      const decoded = protocol.decodePacket(demodulated);

      expect(decoded.type).toBe('RESPONSE');
      expect(decoded.status).toBe(304);
      expect(decoded.headers['ETag']).toBe('"unchanged"');
    });
  });

  describe('Modulation Modes', () => {
    it('should decode BPSK modulation', async () => {
      // Create adaptive modem and set to BPSK mode
      const bpskModem = new AdaptiveModem({
        sampleRate: 48000,
        fftSize: 2048,
        adaptiveMode: false
      });

      // Force BPSK mode for poor SNR conditions
      bpskModem.setModulation('BPSK');

      const request = {
        method: 'GET',
        url: 'http://test.radio/',
        headers: {}
      };

      const packet = protocol.encodeRequest(request);
      const signal = bpskModem.modulate(packet);
      const demodulated = bpskModem.demodulate(signal);
      const decoded = protocol.decodePacket(demodulated);

      expect(decoded.type).toBe('REQUEST');
      expect(decoded.url).toBe('http://test.radio/');

      bpskModem.stopReceive();
    });

    it('should decode 16-QAM modulation', async () => {
      // Create adaptive modem and set to 16-QAM mode for high SNR
      const qamModem = new AdaptiveModem({
        sampleRate: 48000,
        fftSize: 2048,
        adaptiveMode: false
      });

      // Force 16-QAM mode for high SNR conditions
      qamModem.setModulation('16-QAM');

      const response = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: 'High speed data transmission test'
      };

      const packet = protocol.encodeResponse(response);
      const signal = qamModem.modulate(packet);
      const demodulated = qamModem.demodulate(signal);
      const decoded = protocol.decodePacket(demodulated);

      expect(decoded.type).toBe('RESPONSE');
      expect(decoded.body).toBe('High speed data transmission test');

      qamModem.stopReceive();
    });
  });

  describe('Error Correction', () => {
    it('should recover from burst errors using FEC', async () => {
      const request = {
        method: 'PUT',
        url: 'http://test.radio/update',
        headers: {
          'If-Match': '"version1"'
        },
        body: JSON.stringify({ data: 'important update' })
      };

      const packet = protocol.encodeRequest(request);
      const signal = modem.modulate(packet);

      // Introduce burst error (corrupt 10 consecutive samples)
      const corruptedSignal = new Float32Array(signal);
      for (let i = 1000; i < 1010; i++) {
        corruptedSignal[i] = 0;
      }

      const demodulated = modem.demodulate(corruptedSignal);
      const decoded = protocol.decodePacket(demodulated);

      // FEC should recover the data
      expect(decoded.type).toBe('REQUEST');
      expect(decoded.method).toBe('PUT');
      expect(JSON.parse(decoded.body)).toEqual({ data: 'important update' });
    });

    it('should handle packet fragmentation and reassembly', async () => {
      // Create large response that requires fragmentation
      const largeBody = 'x'.repeat(5000);
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': largeBody.length.toString()
        },
        body: largeBody
      };

      const packet = protocol.encodeResponse(response);

      // Simulate fragmentation by processing in chunks
      const chunkSize = 1000;
      const fragments = [];
      for (let i = 0; i < packet.length; i += chunkSize) {
        const chunk = packet.slice(i, Math.min(i + chunkSize, packet.length));
        const signal = modem.modulate(chunk);
        const demodulated = modem.demodulate(signal);
        fragments.push(demodulated);
      }

      // Reassemble fragments
      const reassembled = Buffer.concat(fragments);
      const decoded = protocol.decodePacket(reassembled);

      expect(decoded.type).toBe('RESPONSE');
      expect(decoded.body.length).toBe(5000);
    });
  });

  describe('Compression Efficiency', () => {
    it('should efficiently compress repetitive HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Radio Page</title>
        </head>
        <body>
          <div class="container">
            <div class="item">Item 1</div>
            <div class="item">Item 2</div>
            <div class="item">Item 3</div>
            <div class="item">Item 4</div>
            <div class="item">Item 5</div>
          </div>
        </body>
        </html>
      `;

      const compressed = compressor.compressHTML(html);

      // Check compression ratio
      expect(compressed.compressedSize).toBeLessThan(compressed.originalSize);
      expect(compressed.ratio).toBeGreaterThan(3); // Should achieve >3:1 for repetitive content

      // Verify decompression preserves content (HTML minification is expected)
      const decompressed = compressor.decompressHTML(compressed.compressed);

      // Check that key content is preserved
      expect(decompressed).toContain('Radio Page');
      expect(decompressed).toContain('Item 1');
      expect(decompressed).toContain('Item 2');
      expect(decompressed).toContain('Item 3');
      expect(decompressed).toContain('Item 4');
      expect(decompressed).toContain('Item 5');
      expect(decompressed).toContain('class="container"');
      expect(decompressed).toContain('class="item"');
    });

    it('should compress JSON data', () => {
      const json = {
        stations: [
          { callsign: 'KA1ABC', frequency: 14230000, mode: 'USB' },
          { callsign: 'W2DEF', frequency: 14230000, mode: 'USB' },
          { callsign: 'N3GHI', frequency: 14230000, mode: 'USB' }
        ],
        timestamp: Date.now()
      };

      const jsonString = JSON.stringify(json);
      const compressed = compressor.compress(Buffer.from(jsonString));

      // Verify compression
      expect(compressed.length).toBeLessThan(jsonString.length);

      // Verify decompression
      const decompressed = compressor.decompress(compressed);
      expect(decompressed.toString()).toBe(jsonString);
    });
  });

  describe('Digital Signatures', () => {
    it('should verify signed requests', async () => {
      // Generate keypair
      await crypto.generateKeyPair('TEST1');

      const request = {
        method: 'POST',
        url: 'http://test.radio/signed',
        headers: {
          'X-Callsign': 'TEST1'
        },
        body: 'authenticated data'
      };

      // Sign the request
      const signature = await crypto.sign(
        Buffer.from(JSON.stringify(request)),
        'TEST1'
      );

      request.headers['X-Signature'] = signature;

      // Encode, modulate, demodulate, decode
      const packet = protocol.encodeRequest(request);
      const signal = modem.modulate(packet);
      const demodulated = modem.demodulate(signal);
      const decoded = protocol.decodePacket(demodulated);

      // Verify signature
      const isValid = await crypto.verify(
        Buffer.from(JSON.stringify({
          method: decoded.method,
          url: decoded.url,
          headers: { 'X-Callsign': decoded.headers['X-Callsign'] },
          body: decoded.body
        })),
        decoded.headers['X-Signature'],
        'TEST1'
      );

      expect(isValid).toBe(true);
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete request-response cycle', async () => {
      // Client sends request
      const request = {
        method: 'GET',
        url: 'http://server.radio/api/status',
        headers: {
          'Accept': 'application/json',
          'X-Request-ID': 'cycle-test-1'
        }
      };

      // Encode and transmit request
      const reqPacket = protocol.encodeRequest(request);
      const reqSignal = modem.modulate(reqPacket);

      // Add realistic channel effects
      const channelSignal = addChannelEffects(reqSignal, {
        snrDb: 8,
        multipath: true,
        fading: true
      });

      // Server receives and decodes
      const reqDemodulated = modem.demodulate(channelSignal);
      const reqDecoded = protocol.decodePacket(reqDemodulated);

      expect(reqDecoded.type).toBe('REQUEST');
      expect(reqDecoded.headers['X-Request-ID']).toBe('cycle-test-1');

      // Server sends response
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'cycle-test-1'
        },
        body: JSON.stringify({
          status: 'operational',
          uptime: 3600,
          connections: 5
        })
      };

      // Encode and transmit response
      const respPacket = protocol.encodeResponse(response);
      const respSignal = modem.modulate(respPacket);

      // Add channel effects for response
      const respChannelSignal = addChannelEffects(respSignal, {
        snrDb: 8,
        multipath: true,
        fading: true
      });

      // Client receives and decodes
      const respDemodulated = modem.demodulate(respChannelSignal);
      const respDecoded = protocol.decodePacket(respDemodulated);

      expect(respDecoded.type).toBe('RESPONSE');
      expect(respDecoded.status).toBe(200);
      expect(respDecoded.headers['X-Request-ID']).toBe('cycle-test-1');

      const responseData = JSON.parse(respDecoded.body);
      expect(responseData.status).toBe('operational');
      expect(responseData.connections).toBe(5);
    });
  });
});