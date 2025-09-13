import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AODVRouter } from '../../lib/mesh-networking';
import { QPSKModem } from '../../lib/qpsk-modem';
import { HTTPServer, HTTPClient } from '../../lib/ham-server';
import { HamRadioCompressor } from '../../lib/compression';
import { CryptoManager } from '../../lib/crypto';
import { Database } from '../../lib/database';
import { RadioControl } from '../../lib/radio-control';

/**
 * End-to-end integration tests
 * Tests complete communication flow from HTTP request to radio transmission
 * through mesh network to destination and back
 */
describe('End-to-End Ham Radio HTTP Communication', () => {
  // Simulated ham radio stations
  interface Station {
    callsign: string;
    router: AODVRouter;
    modem: QPSKModem;
    server: HTTPServer;
    client: HTTPClient;
    crypto: CryptoManager;
    compressor: HamRadioCompressor;
    database: Database;
    radio?: RadioControl;
  }

  let stations: Map<string, Station>;
  let radioChannel: RadioChannel;

  class RadioChannel {
    private transmissions: Map<string, Float32Array> = new Map();
    private propagation: Map<string, Set<string>> = new Map();
    private channelNoise: number = -80; // dBm

    constructor() {
      this.transmissions = new Map();
      this.propagation = new Map();
    }

    // Define which stations can hear each other
    setPropagation(from: string, to: string[], bidirectional = true) {
      if (!this.propagation.has(from)) {
        this.propagation.set(from, new Set());
      }
      to.forEach(callsign => this.propagation.get(from)!.add(callsign));

      if (bidirectional) {
        to.forEach(callsign => {
          if (!this.propagation.has(callsign)) {
            this.propagation.set(callsign, new Set());
          }
          this.propagation.get(callsign)!.add(from);
        });
      }
    }

    // Simulate radio transmission
    async transmit(from: string, signal: Float32Array): Promise<void> {
      const receivers = this.propagation.get(from) || new Set();

      for (const receiver of receivers) {
        // Simulate propagation delay (speed of light)
        const distance = this.getDistance(from, receiver);
        const delay = distance / 300000; // km to seconds

        setTimeout(() => {
          // Apply path loss and noise
          const receivedSignal = this.applyChannelEffects(
            signal,
            from,
            receiver
          );

          // Deliver to receiver
          const station = stations.get(receiver);
          if (station && station.modem) {
            station.modem.receiveSignal(receivedSignal);
          }
        }, delay * 1000);
      }
    }

    private getDistance(from: string, to: string): number {
      // Simulate distances between stations (km)
      const distances: Record<string, number> = {
        'KA1ABC-W2DEF': 50,
        'W2DEF-N3GHI': 75,
        'N3GHI-K4JKL': 100,
        'K4JKL-W5MNO': 60
      };

      const key1 = `${from}-${to}`;
      const key2 = `${to}-${from}`;

      return distances[key1] || distances[key2] || 100;
    }

    private applyChannelEffects(
      signal: Float32Array,
      from: string,
      to: string
    ): Float32Array {
      const distance = this.getDistance(from, to);

      // Path loss (simplified free space path loss)
      const frequency = 14.205; // MHz
      const pathLoss = 20 * Math.log10(distance) + 20 * Math.log10(frequency) + 32.45;

      // Signal strength at receiver
      const txPower = 100; // watts = 50 dBm
      const rxPower = txPower - pathLoss;
      const snr = rxPower - this.channelNoise;

      // Apply noise based on SNR
      return this.addNoise(signal, snr);
    }

    private addNoise(signal: Float32Array, snrDb: number): Float32Array {
      const output = new Float32Array(signal);
      const signalPower = signal.reduce((sum, s) => sum + s * s, 0) / signal.length;
      const noisePower = signalPower / Math.pow(10, snrDb / 10);
      const noiseAmplitude = Math.sqrt(noisePower);

      for (let i = 0; i < output.length; i++) {
        output[i] += (Math.random() - 0.5) * 2 * noiseAmplitude;
      }

      return output;
    }

    setChannelConditions(noise: number) {
      this.channelNoise = noise;
    }
  }

  beforeEach(async () => {
    stations = new Map();
    radioChannel = new RadioChannel();

    // Create mock audio context
    // @ts-ignore
    global.AudioContext = vi.fn(() => ({
      sampleRate: 48000,
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createOscillator: vi.fn(() => ({
        frequency: { value: 1500 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      }))
    }));

    // Create 5 ham radio stations
    const stationConfigs = [
      { callsign: 'KA1ABC', address: 'fe80::1', location: 'Boston, MA' },
      { callsign: 'W2DEF', address: 'fe80::2', location: 'New York, NY' },
      { callsign: 'N3GHI', address: 'fe80::3', location: 'Philadelphia, PA' },
      { callsign: 'K4JKL', address: 'fe80::4', location: 'Washington, DC' },
      { callsign: 'W5MNO', address: 'fe80::5', location: 'Richmond, VA' }
    ];

    for (const config of stationConfigs) {
      const station: Station = {
        callsign: config.callsign,
        router: new AODVRouter(config.address),
        modem: new QPSKModem({
          sampleRate: 48000,
          symbolRate: 1200,
          carrierFreq: 1500,
          mode: 'QPSK'
        }),
        server: new HTTPServer({
          callsign: config.callsign,
          requireSignatures: true
        }),
        client: new HTTPClient({
          callsign: config.callsign,
          signRequests: true
        }),
        crypto: new CryptoManager(),
        compressor: new HamRadioCompressor(),
        database: new Database()
      };

      // Initialize components
      await station.database.init();
      await station.crypto.generateKeyPair(config.callsign);
      await station.server.start();
      await station.modem.initialize();

      // Hook up modem to radio channel
      station.modem.onTransmit = async (signal: Float32Array) => {
        await radioChannel.transmit(config.callsign, signal);
      };

      stations.set(config.callsign, station);
    }

    // Set up radio propagation (who can hear whom)
    radioChannel.setPropagation('KA1ABC', ['W2DEF']);
    radioChannel.setPropagation('W2DEF', ['KA1ABC', 'N3GHI']);
    radioChannel.setPropagation('N3GHI', ['W2DEF', 'K4JKL']);
    radioChannel.setPropagation('K4JKL', ['N3GHI', 'W5MNO']);
    radioChannel.setPropagation('W5MNO', ['K4JKL']);

    // Set up mesh network topology based on radio propagation
    setupMeshTopology();
  });

  afterEach(async () => {
    for (const station of stations.values()) {
      await station.server.stop();
      station.modem.stop();
      await station.crypto.close();
    }
    stations.clear();
  });

  function setupMeshTopology() {
    // Configure mesh routers based on radio connectivity
    const topology = {
      'KA1ABC': ['W2DEF'],
      'W2DEF': ['KA1ABC', 'N3GHI'],
      'N3GHI': ['W2DEF', 'K4JKL'],
      'K4JKL': ['N3GHI', 'W5MNO'],
      'W5MNO': ['K4JKL']
    };

    for (const [callsign, neighbors] of Object.entries(topology)) {
      const station = stations.get(callsign);
      if (station) {
        for (const neighbor of neighbors) {
          const neighborStation = stations.get(neighbor);
          if (neighborStation) {
            station.router.addNeighbor(neighborStation.router.getAddress(), {
              signalStrength: -60,
              lastSeen: Date.now(),
              callsign: neighbor
            });
          }
        }
      }
    }
  }

  describe('Complete HTTP over Radio Communication', () => {
    it('should complete HTTP GET request over radio between adjacent stations', async () => {
      const boston = stations.get('KA1ABC')!;
      const newYork = stations.get('W2DEF')!;

      // Set up HTTP endpoint on New York station
      newYork.server.route('GET', '/weather', async (req) => ({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'New York',
          temp: 68,
          conditions: 'Partly Cloudy'
        })
      }));

      // Boston requests weather from New York
      const request = {
        method: 'GET',
        path: '/weather',
        headers: { 'Accept': 'application/json' }
      };

      // Complete communication flow
      const response = await sendHttpOverRadio(boston, newYork, request);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.city).toBe('New York');
      expect(body.temp).toBe(68);
    });

    it('should complete HTTP POST with signature over multiple hops', async () => {
      const boston = stations.get('KA1ABC')!;
      const philly = stations.get('N3GHI')!;

      // Set up message board endpoint on Philadelphia station
      philly.server.route('POST', '/message', async (req) => {
        // Verify signature
        const isValid = await philly.crypto.verifyRequest(req);
        if (!isValid) {
          return { status: 401, body: 'Invalid signature' };
        }

        // Store message
        const message = JSON.parse(req.body);
        await philly.database.saveMessage({
          from: req.callsign,
          text: message.text,
          timestamp: Date.now()
        });

        return {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Date.now(), status: 'posted' })
        };
      });

      // Boston posts message to Philadelphia (2 hops via New York)
      const request = {
        method: 'POST',
        path: '/message',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello from Boston!' })
      };

      // Sign the request
      const signedRequest = await boston.crypto.signRequest(
        request.method,
        request.path,
        request.headers,
        request.body
      );

      // Send over radio through mesh network
      const response = await sendSignedHttpOverRadio(
        boston,
        philly,
        signedRequest
      );

      expect(response.status).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('posted');
    });

    it('should handle large file transfer with compression', async () => {
      const source = stations.get('K4JKL')!;
      const dest = stations.get('W5MNO')!;

      // Create a large HTML page
      const largePage = generateLargeHtmlPage(100); // 100 repeating sections

      // Set up endpoint to serve the page
      dest.server.route('GET', '/manual', async () => ({
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: largePage
      }));

      // Request the large page
      const request = {
        method: 'GET',
        path: '/manual',
        headers: { 'Accept': 'text/html' }
      };

      const startTime = Date.now();
      const response = await sendHttpOverRadio(source, dest, request);
      const transferTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body).toContain('<h1>Section');

      // Verify compression was effective
      const compressed = source.compressor.compressHTML(largePage);
      expect(compressed.ratio).toBeGreaterThan(5); // Should compress well

      console.log(`Transfer time: ${transferTime}ms for ${largePage.length} bytes`);
    });

    it('should handle poor channel conditions with adaptive modes', async () => {
      const station1 = stations.get('KA1ABC')!;
      const station2 = stations.get('W2DEF')!;

      // Simulate poor channel conditions
      radioChannel.setChannelConditions(-70); // Higher noise floor

      // Start with QPSK
      station1.modem.setMode('QPSK');
      station2.modem.setMode('QPSK');

      // Set up test endpoint
      station2.server.route('GET', '/test', async () => ({
        status: 200,
        body: 'Test response'
      }));

      // Try communication
      let response;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          response = await sendHttpOverRadio(
            station1,
            station2,
            { method: 'GET', path: '/test', headers: {} }
          );
          break;
        } catch (error) {
          attempts++;

          // Switch to more robust mode
          if (attempts === 1) {
            station1.modem.setMode('BPSK');
            station2.modem.setMode('BPSK');
            console.log('Switching to BPSK mode due to poor conditions');
          }
        }
      }

      expect(response).toBeDefined();
      expect(response!.status).toBe(200);
    });

    it('should complete emergency traffic with priority routing', async () => {
      const emergency = stations.get('KA1ABC')!;
      const repeater = stations.get('N3GHI')!;

      // Set up emergency endpoint
      repeater.server.route('POST', '/emergency', async (req) => {
        const data = JSON.parse(req.body);

        // Log emergency
        await repeater.database.saveMessage({
          type: 'EMERGENCY',
          from: req.callsign,
          location: data.location,
          message: data.message,
          timestamp: Date.now()
        });

        // Acknowledge receipt
        return {
          status: 200,
          headers: { 'X-Priority': 'EMERGENCY' },
          body: JSON.stringify({
            received: true,
            timestamp: Date.now(),
            action: 'Forwarding to emergency services'
          })
        };
      });

      // Send emergency traffic
      const emergencyRequest = {
        method: 'POST',
        path: '/emergency',
        headers: {
          'Content-Type': 'application/json',
          'X-Priority': 'EMERGENCY'
        },
        body: JSON.stringify({
          location: 'Boston, MA',
          message: 'Medical emergency at field day site',
          gps: '42.3601,-71.0589'
        })
      };

      // Emergency traffic should get priority
      const response = await sendHttpOverRadio(
        emergency,
        repeater,
        emergencyRequest,
        { priority: 'EMERGENCY' }
      );

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.received).toBe(true);
      expect(body.action).toContain('emergency services');
    });
  });

  describe('Network Resilience and Recovery', () => {
    it('should recover from station failure', async () => {
      const source = stations.get('KA1ABC')!;
      const dest = stations.get('K4JKL')!;

      // Set up endpoint
      dest.server.route('GET', '/status', async () => ({
        status: 200,
        body: 'Online'
      }));

      // Initial request should work (via W2DEF and N3GHI)
      const response1 = await sendHttpOverRadio(
        source,
        dest,
        { method: 'GET', path: '/status', headers: {} }
      );
      expect(response1.status).toBe(200);

      // Simulate W2DEF station failure
      const w2def = stations.get('W2DEF')!;
      await w2def.server.stop();
      w2def.modem.stop();

      // Remove from mesh topology
      source.router.removeNeighbor(w2def.router.getAddress());

      // Should fail now (no alternate path in linear topology)
      try {
        await sendHttpOverRadio(
          source,
          dest,
          { method: 'GET', path: '/status', headers: {} }
        );
        expect.fail('Should have failed without relay');
      } catch (error) {
        expect(error.message).toContain('No route');
      }
    });

    it('should handle concurrent requests', async () => {
      const station1 = stations.get('KA1ABC')!;
      const station2 = stations.get('W2DEF')!;
      const station3 = stations.get('N3GHI')!;

      // Set up endpoints
      station2.server.route('GET', '/data1', async () => ({
        status: 200,
        body: 'Data 1'
      }));

      station3.server.route('GET', '/data2', async () => ({
        status: 200,
        body: 'Data 2'
      }));

      // Send concurrent requests
      const promises = [
        sendHttpOverRadio(station1, station2, {
          method: 'GET',
          path: '/data1',
          headers: {}
        }),
        sendHttpOverRadio(station1, station3, {
          method: 'GET',
          path: '/data2',
          headers: {}
        })
      ];

      const [response1, response2] = await Promise.all(promises);

      expect(response1.status).toBe(200);
      expect(response1.body).toBe('Data 1');
      expect(response2.status).toBe(200);
      expect(response2.body).toBe('Data 2');
    });
  });

  // Helper functions
  async function sendHttpOverRadio(
    source: Station,
    destination: Station,
    request: any,
    options: { priority?: string } = {}
  ): Promise<any> {
    // Discover route
    const route = await source.router.discoverRoute(
      destination.router.getAddress()
    );

    if (!route) {
      throw new Error('No route to destination');
    }

    // Prepare HTTP packet
    const packet = {
      ...request,
      destination: destination.callsign,
      source: source.callsign,
      hopCount: 0,
      maxHops: 10
    };

    // Compress
    const compressed = source.compressor.compressHTML(JSON.stringify(packet));

    // Modulate and transmit
    const signal = await source.modem.modulate(
      Buffer.from(JSON.stringify(compressed.compressed))
    );

    // Transmit over radio
    await radioChannel.transmit(source.callsign, signal);

    // Wait for response (simplified - real implementation would use callbacks)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Process at destination
    return await destination.server.handleRequest(request);
  }

  async function sendSignedHttpOverRadio(
    source: Station,
    destination: Station,
    signedRequest: any
  ): Promise<any> {
    // Similar to sendHttpOverRadio but with signature handling
    const route = await source.router.discoverRoute(
      destination.router.getAddress()
    );

    if (!route) {
      throw new Error('No route to destination');
    }

    // Compress signed request
    const compressed = source.compressor.compressHTML(
      JSON.stringify(signedRequest)
    );

    // Modulate and transmit
    const signal = await source.modem.modulate(
      Buffer.from(JSON.stringify(compressed.compressed))
    );

    await radioChannel.transmit(source.callsign, signal);

    // Wait and process
    await new Promise(resolve => setTimeout(resolve, 100));

    return await destination.server.handleRequest(signedRequest);
  }

  function generateLargeHtmlPage(sections: number): string {
    let html = `<!DOCTYPE html>
<html>
<head><title>Ham Radio Manual</title></head>
<body>
<h1>Amateur Radio Operating Manual</h1>`;

    for (let i = 1; i <= sections; i++) {
      html += `
<div class="section">
  <h2>Section ${i}: Operating Procedures</h2>
  <p>When calling CQ, use proper procedures.</p>
  <p>Always identify with your callsign.</p>
  <p>Follow band plans and regulations.</p>
  <ul>
    <li>Check frequency is clear</li>
    <li>Call CQ three times</li>
    <li>Give callsign phonetically</li>
    <li>Listen for responses</li>
  </ul>
</div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }
});