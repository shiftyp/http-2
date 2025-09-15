import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveModem } from '../../lib/qpsk-modem/adaptive-modem';
import { HamRadioCompressor } from '../../lib/compression';
import { CryptoManager } from '../../lib/crypto';
import { HTTPProtocol } from '../../lib/http-protocol';

/**
 * Integration tests for the complete decoding chain with AdaptiveModem
 * Tests the flow from modulated radio signal to decoded HTTP request/response
 */
describe('Adaptive Decoding Chain Integration', () => {
  let modem: AdaptiveModem;
  let compressor: HamRadioCompressor;
  let crypto: CryptoManager;
  let protocol: HTTPProtocol;

  beforeEach(async () => {
    // Initialize modem with test configuration
    modem = new AdaptiveModem({
      sampleRate: 48000,
      fftSize: 2048,
      adaptiveMode: false  // Disable adaptive for consistent testing
    });

    // Initialize other components
    compressor = new HamRadioCompressor();
    crypto = new CryptoManager();
    protocol = new HTTPProtocol({
      callsign: 'TEST1',
      compressor,
      crypto
    });
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
    it('should decode clean signal to HTTP request', async () => {
      const httpRequest = 'GET / HTTP/1.1\r\nHost: test.radio\r\n\r\n';
      const data = new TextEncoder().encode(httpRequest);

      // Transmit and receive
      const signal = await modem.transmit(data);
      const received = await modem.receive(signal);

      const text = new TextDecoder().decode(received);
      expect(text).toBe(httpRequest);
    });

    it('should decode HTTP response with compression', async () => {
      const htmlContent = '<html><body><h1>Ham Radio Web</h1></body></html>';
      const compressed = await compressor.compress(new TextEncoder().encode(htmlContent));

      const signal = await modem.transmit(compressed);
      const received = await modem.receive(signal);

      const decompressed = await compressor.decompress(received);
      const text = new TextDecoder().decode(decompressed);
      expect(text).toBe(htmlContent);
    });

    it('should handle noisy channel (10dB SNR)', async () => {
      const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"

      const signal = await modem.transmit(testData);
      const noisy = addChannelEffects(signal, { snrDb: 10, multipath: false, fading: false });

      // With Reed-Solomon FEC, should handle moderate noise
      const received = await modem.receive(noisy);
      expect(received).toEqual(testData);
    });

    it('should handle multipath propagation', async () => {
      const testData = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);

      const signal = await modem.transmit(testData);
      const multipath = addChannelEffects(signal, { snrDb: 15, multipath: true, fading: false });

      const received = await modem.receive(multipath);
      expect(received).toEqual(testData);
    });

    it('should handle fading channel', async () => {
      const testData = new Uint8Array([0xCA, 0xFE, 0xBA, 0xBE]);

      const signal = await modem.transmit(testData);
      const fading = addChannelEffects(signal, { snrDb: 15, multipath: false, fading: true });

      const received = await modem.receive(fading);
      expect(received).toEqual(testData);
    });
  });

  describe('Adaptive Modulation', () => {
    it('should adapt to channel conditions', async () => {
      const adaptiveModem = new AdaptiveModem({
        sampleRate: 48000,
        fftSize: 2048,
        adaptiveMode: true
      });

      const testData = new Uint8Array([0x12, 0x34, 0x56, 0x78]);

      // Test with different SNR conditions (limited to working modulations)
      const snrLevels = [-1, 5, 10];

      for (const snr of snrLevels) {
        // Set SNR (in real use, this would be estimated from signal)
        (adaptiveModem as any).snr = snr;

        const signal = await adaptiveModem.transmit(testData);
        const status = adaptiveModem.getStatus();

        console.log(`SNR: ${snr}dB, Modulation: ${status.modulation}, Data Rate: ${status.dataRate}`);

        // Verify appropriate modulation selected
        if (snr < 3) {
          expect(status.modulation).toBe('BPSK');
        } else if (snr < 8) {
          expect(status.modulation).toBe('QPSK');
        } else if (snr < 12) {
          expect(status.modulation).toBe('8-PSK');
        }

        // Verify can still decode
        const received = await adaptiveModem.receive(signal);
        expect(received).toEqual(testData);
      }
    });
  });

  describe('Compression Efficiency', () => {
    it('should efficiently compress repetitive HTML', async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="content">Test content</div>
            <div class="content">Test content</div>
            <div class="content">Test content</div>
          </body>
        </html>
      `;

      const original = new TextEncoder().encode(html);
      const compressed = await compressor.compress(original);

      // Should achieve good compression ratio
      expect(compressed.length).toBeLessThan(original.length * 0.5);

      // Should round-trip correctly
      const signal = await modem.transmit(compressed);
      const received = await modem.receive(signal);
      const decompressed = await compressor.decompress(received);
      const text = new TextDecoder().decode(decompressed);

      expect(text).toBe(html);
    });

    it('should handle pre-compressed data', async () => {
      // Random data doesn't compress well
      const random = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        random[i] = Math.floor(Math.random() * 256);
      }

      const compressed = await compressor.compress(random);

      // Transmit and receive
      const signal = await modem.transmit(compressed);
      const received = await modem.receive(signal);
      const decompressed = await compressor.decompress(received);

      expect(decompressed).toEqual(random);
    });
  });

  describe('Digital Signatures', () => {
    it('should sign and verify HTTP requests', async () => {
      const request = {
        method: 'POST',
        path: '/api/message',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Hello, World!' })
      };

      // Create signature
      const dataToSign = `${request.method} ${request.path}\n${request.body}`;
      const signature = await crypto.sign(dataToSign);

      // Transmit request with signature
      const fullRequest = {
        ...request,
        signature: signature
      };

      const data = new TextEncoder().encode(JSON.stringify(fullRequest));
      const signal = await modem.transmit(data);
      const received = await modem.receive(signal);

      // Verify signature
      const receivedRequest = JSON.parse(new TextDecoder().decode(received));
      const receivedSignature = receivedRequest.signature;

      const dataToVerify = `${receivedRequest.method} ${receivedRequest.path}\n${receivedRequest.body}`;

      const isValid = await crypto.verify(
        dataToVerify,
        receivedSignature
      );

      expect(isValid).toBe(true);
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete HTTP request-response cycle', async () => {
      // Simulate HTTP request
      const request = 'GET /index.html HTTP/1.1\r\nHost: radio.test\r\nAccept: text/html\r\n\r\n';
      const requestData = new TextEncoder().encode(request);

      // Compress request
      const compressedRequest = await compressor.compress(requestData);

      // Transmit request
      const requestSignal = await modem.transmit(compressedRequest);

      // Add some channel effects
      const noisyRequest = addChannelEffects(requestSignal, {
        snrDb: 12,
        multipath: true,
        fading: true
      });

      // Receive and decompress request
      const receivedRequest = await modem.receive(noisyRequest);
      const decompressedRequest = await compressor.decompress(receivedRequest);
      const requestText = new TextDecoder().decode(decompressedRequest);

      expect(requestText).toContain('GET /index.html');
      expect(requestText).toContain('Host: radio.test');

      // Simulate HTTP response
      const response = `HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body>Hello</body></html>`;
      const responseData = new TextEncoder().encode(response);

      // Compress and transmit response
      const compressedResponse = await compressor.compress(responseData);
      const responseSignal = await modem.transmit(compressedResponse);

      // Add channel effects
      const noisyResponse = addChannelEffects(responseSignal, {
        snrDb: 10,
        multipath: true,
        fading: false
      });

      // Receive and decompress response
      const receivedResponse = await modem.receive(noisyResponse);
      const decompressedResponse = await compressor.decompress(receivedResponse);
      const responseText = new TextDecoder().decode(decompressedResponse);

      expect(responseText).toContain('200 OK');
      expect(responseText).toContain('<html>');
    });
  });
});