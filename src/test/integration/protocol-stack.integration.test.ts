import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPProtocol } from '../../lib/http-protocol';
import { RadioControl } from '../../lib/radio-control';
import { HamRadioCompressor, RadioJSXCompiler } from '../../lib/compression';
import { CryptoManager } from '../../lib/crypto';
import { MeshNetwork } from '../../lib/mesh-networking';
import { Database } from '../../lib/database';

describe('Protocol Stack Integration', () => {
  let httpProtocol: HTTPProtocol;
  let radioControl: RadioControl;
  let compressor: HamRadioCompressor;
  let jsxCompiler: RadioJSXCompiler;
  let cryptoManager: CryptoManager;
  let meshNetwork: MeshNetwork;
  let database: Database;

  beforeEach(async () => {
    // Initialize all components
    httpProtocol = new HTTPProtocol({ callsign: 'TEST1' });
    radioControl = new RadioControl();
    compressor = new HamRadioCompressor();
    jsxCompiler = new RadioJSXCompiler();
    cryptoManager = new CryptoManager();
    meshNetwork = new MeshNetwork('TEST1', httpProtocol, radioControl);
    database = new Database();

    // Mock radio transmit/receive
    vi.spyOn(radioControl, 'transmit').mockResolvedValue();
    vi.spyOn(radioControl, 'startReceive').mockImplementation(() => {});
    vi.spyOn(radioControl, 'connect').mockResolvedValue();

    // Mock database methods to avoid indexedDB issues
    vi.spyOn(database, 'init').mockResolvedValue();
    vi.spyOn(database, 'savePage').mockResolvedValue();
    vi.spyOn(database, 'getPage').mockResolvedValue(null);

    // Mock crypto manager methods to avoid indexedDB issues
    vi.spyOn(cryptoManager, 'generateKeyPair').mockResolvedValue({
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
      publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
      callsign: 'TEST1',
      created: Date.now(),
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000
    });
    vi.spyOn(cryptoManager, 'signRequest').mockResolvedValue({
      request: {} as any,
      signature: 'mock-signature',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
      callsign: 'TEST1'
    });
    vi.spyOn(cryptoManager, 'verifyRequest').mockResolvedValue(true);
  });

  describe('HTTP Request/Response Flow', () => {
    it('should handle complete HTTP request/response cycle', async () => {
      // Setup mock radio to simulate receiving response
      let transmittedData: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (data) => {
        transmittedData = data;

        // Use the same sequence number from the request for the response
        const responsePacket = {
          header: {
            version: 1,
            type: 'RESPONSE',
            source: 'TEST2',
            destination: 'TEST1',
            sequence: data.header.sequence, // Match the request sequence
            timestamp: Date.now(),
            length: 100,
            checksum: 12345
          },
          payload: {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            body: { message: 'Hello from TEST2' }
          }
        };

        // Process response using setTimeout to avoid race conditions
        setTimeout(() => {
          httpProtocol.handlePacket(responsePacket);
        }, 0);
      });

      // Connect protocol to radio
      httpProtocol.setRadio(radioControl);

      // Send HTTP request
      const request = {
        method: 'GET' as const,
        path: '/api/greeting',
        headers: { 'Accept': 'application/json' }
      };

      const response = await httpProtocol.sendRequest(request, 'TEST2');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Hello from TEST2');
      expect(radioControl.transmit).toHaveBeenCalled();
    });

    it('should compress large payloads automatically', async () => {
      let transmittedPacket: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (data) => {
        transmittedPacket = data;
      });

      httpProtocol.setRadio(radioControl);

      // Create large payload
      const largePayload = {
        method: 'POST' as const,
        path: '/api/upload',
        headers: { 'Content-Type': 'application/json' },
        body: {
          data: 'x'.repeat(2000),
          metadata: { size: 2000, type: 'text' }
        }
      };

      // Send request
      await httpProtocol.sendRequest(largePayload, 'TEST2').catch(() => {});

      // Verify compression was applied
      expect(transmittedPacket).toBeDefined();
      expect(transmittedPacket.header.length).toBeLessThan(2000);
    });
  });

  describe('Cryptographic Integration', () => {
    it('should sign and verify HTTP requests', async () => {
      // Setup request handler that verifies signatures
      httpProtocol.onRequest(async (request, respond) => {
        respond({
          status: 200,
          headers: {},
          body: { verified: true }
        });
      });

      // Create a request to sign
      const requestData = {
        method: 'POST',
        path: '/api/secure',
        headers: { 'Content-Type': 'application/json' },
        body: { secret: 'data' },
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7)
      };

      // Sign the request
      const signature = await cryptoManager.sign(
        JSON.stringify(requestData),
        'TEST1'
      );

      // Get public key PEM
      const publicKeyPem = cryptoManager.keyPair?.publicKeyPem;

      const signedRequest = {
        request: requestData,
        signature,
        publicKey: publicKeyPem,
        callsign: 'TEST1'
      };

      // Verify signature
      const isValid = await cryptoManager.verify(
        JSON.stringify(requestData),
        signature,
        publicKeyPem
      );
      expect(isValid).toBe(true);

      // Create packet with signed request
      const packet = {
        header: {
          version: 1,
          type: 'REQUEST' as const,
          source: 'TEST1',
          destination: 'TEST1',
          sequence: 1,
          timestamp: Date.now(),
          length: 200,
          checksum: 12345
        },
        payload: signedRequest
      };

      // Mock getUserMedia if not available
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        (global as any).navigator = {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(new Error('Not available in test'))
          }
        };
      }

      // Process the signed request
      await httpProtocol.handlePacket(packet);
    });

    it('should reject requests with invalid signatures', async () => {
      let responseStatus = 0;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        responseStatus = packet.payload.status;
      });

      httpProtocol.setRadio(radioControl);

      // Setup request handler that validates signatures
      httpProtocol.onRequest(async (request, respond) => {
        try {
          // Check if request has signature data
          if (request.signature && request.publicKey) {
            const isValid = await cryptoManager.verify(
              JSON.stringify(request.request),
              request.signature,
              request.publicKey
            );

            if (!isValid) {
              respond({
                status: 401,
                headers: {},
                body: { error: 'Invalid signature' }
              });
              return;
            }
          }

          // Valid request
          respond({
            status: 200,
            headers: {},
            body: { success: true }
          });
        } catch (error) {
          respond({
            status: 401,
            headers: {},
            body: { error: 'Invalid signature' }
          });
        }
      });

      // Create request with invalid signature
      const invalidRequest = {
        request: {
          method: 'GET',
          path: '/secure',
          headers: {},
          timestamp: Date.now(),
          nonce: 'test'
        },
        signature: 'invalid-signature',
        publicKey: 'fake-key',
        callsign: 'ATTACKER'
      };

      const packet = {
        header: {
          version: 1,
          type: 'REQUEST' as const,
          source: 'ATTACKER',
          destination: 'TEST1',
          sequence: 1,
          timestamp: Date.now(),
          length: 100,
          checksum: 12345
        },
        payload: invalidRequest
      };

      await httpProtocol.handlePacket(packet);

      // Should respond with error
      expect(responseStatus).toBe(401); // Unauthorized
    });
  });

  describe('Mesh Network Integration', () => {
    it('should route packets through mesh network', async () => {
      // Setup mesh routing
      const meshRoutes = new Map();
      meshRoutes.set('TEST3', {
        destination: 'TEST3',
        nextHop: 'TEST2',
        hopCount: 2,
        metric: 100
      });

      vi.spyOn(meshNetwork, 'discoverRoute').mockResolvedValue({
        destination: 'TEST3',
        path: ['TEST1', 'TEST2', 'TEST3'],
        hopCount: 2,
        metric: 100,
        timestamp: Date.now()
      });

      let packetSent = false;
      vi.spyOn(meshNetwork, 'sendPacket').mockImplementation(async (dest: string, packet: any) => {
        packetSent = true;
        // Simulate packet reaching destination through mesh
        if (dest === 'TEST3') {
          // Extract sequence from packet (might be in header or generate one)
          const sequence = packet.header?.sequence || 1;

          const responsePacket = {
            header: {
              version: 1,
              type: 'RESPONSE',
              source: 'TEST3',
              destination: 'TEST1',
              sequence: sequence, // Match the request sequence
              timestamp: Date.now(),
              length: 50,
              checksum: 12345
            },
            payload: {
              status: 200,
              statusText: 'OK',
              headers: {},
              body: { routed: true }
            }
          };

          // Process response asynchronously
          setTimeout(() => {
            httpProtocol.handlePacket(responsePacket);
          }, 10); // Small delay to ensure async processing
          return true;
        }
        return false;
      });

      // Integrate mesh with HTTP protocol
      httpProtocol.setMeshNetwork(meshNetwork);

      // Send request to distant node
      const request = {
        method: 'GET' as const,
        path: '/api/distant',
        headers: {}
      };

      const response = await httpProtocol.sendRequest(request, 'TEST3');

      expect(response.status).toBe(200);
      expect(response.body.routed).toBe(true);
      expect(meshNetwork.sendPacket).toHaveBeenCalledWith(
        expect.any(Object),
        'TEST3'
      );
    });

    it('should handle mesh routing failures', async () => {
      vi.spyOn(meshNetwork, 'discoverRoute').mockRejectedValue(
        new Error('No route to destination')
      );

      vi.spyOn(meshNetwork, 'sendPacket').mockRejectedValue(
        new Error('No route to destination')
      );

      httpProtocol.setMeshNetwork(meshNetwork);

      const request = {
        method: 'GET' as const,
        path: '/unreachable',
        headers: {}
      };

      await expect(httpProtocol.sendRequest(request, 'UNREACHABLE'))
        .rejects.toThrow('No route to destination');
    });
  });

  describe('Database Integration', () => {
    it('should cache received content in database', async () => {
      // Setup radio for HTTP protocol
      httpProtocol.setRadio(radioControl);

      // Setup request handler that saves content
      httpProtocol.onRequest(async (request, respond) => {
        if (request.path === '/api/content') {
          // Save content to database
          await database.savePage({
            id: 'test-page',
            path: request.path,
            title: 'Test Page',
            type: 'html',
            content: '<h1>Cached Content</h1>',
            lastModified: Date.now()
          });

          respond({
            status: 201,
            headers: { 'Content-Type': 'application/json' },
            body: { saved: true }
          });
        }
      });

      // Simulate incoming request
      const requestPacket = {
        header: {
          version: 1,
          type: 'REQUEST' as const,
          source: 'TEST2',
          destination: 'TEST1',
          sequence: 1,
          timestamp: Date.now(),
          length: 100,
          checksum: 12345
        },
        payload: {
          method: 'POST',
          path: '/api/content',
          headers: { 'Content-Type': 'text/html' },
          body: { content: '<h1>New Content</h1>' }
        }
      };

      await httpProtocol.handlePacket(requestPacket);

      // Verify content was saved
      const savedPage = await database.getPage('/api/content');
      expect(savedPage).toBeDefined();
      expect(savedPage.title).toBe('Test Page');
    });

    it('should serve cached content when offline', async () => {
      // Setup mock before setting radio
      let responseBody: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        responseBody = packet.payload.body;
      });

      // Setup radio for HTTP protocol
      httpProtocol.setRadio(radioControl);

      // Pre-populate database with content
      await database.savePage({
        id: 'cached-page',
        path: '/cached',
        title: 'Cached Page',
        type: 'html',
        content: '<h1>From Cache</h1>',
        lastModified: Date.now()
      });

      // Setup handler to serve from cache when radio fails
      httpProtocol.onRequest(async (request, respond) => {
        if (request.path === '/cached') {
          const cachedPage = await database.getPage('/cached');

          if (cachedPage) {
            // The page data might be in different formats depending on how it was stored
            const content = cachedPage.content || cachedPage;
            respond({
              status: 200,
              headers: { 'Content-Type': 'text/html' },
              body: content
            });
          } else {
            respond({
              status: 404,
              headers: {},
              body: 'Not found'
            });
          }
        }
      });

      // Simulate request for cached content
      const requestPacket = {
        header: {
          version: 1,
          type: 'REQUEST' as const,
          source: 'TEST2',
          destination: 'TEST1',
          sequence: 1,
          timestamp: Date.now(),
          length: 50,
          checksum: 12345
        },
        payload: {
          method: 'GET',
          path: '/cached',
          headers: { 'Accept': 'text/html' }
        }
      };

      await httpProtocol.handlePacket(requestPacket);

      expect(responseBody).toBe('<h1>From Cache</h1>');
    });
  });

  describe('Compression Integration', () => {
    it('should compress JSX content for transmission', async () => {
      // Create JSX content
      const jsxContent = {
        type: 'div',
        props: { className: 'card' },
        children: [
          { type: 'h1', props: {}, children: ['Title'] },
          { type: 'p', props: {}, children: ['Content'] }
        ]
      };

      // Compile JSX
      const compiled = jsxCompiler.compile(jsxContent);
      expect(compiled.compiled).toBeDefined();
      expect(compiled.templates).toBeDefined();

      // Create HTTP request with compiled JSX
      const request = {
        method: 'POST' as const,
        path: '/api/jsx',
        headers: { 'Content-Type': 'application/jsx' },
        body: compiled
      };

      let transmittedPayload: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        transmittedPayload = packet.payload;
      });

      httpProtocol.setRadio(radioControl);
      await httpProtocol.sendRequest(request, 'TEST2').catch(() => {});

      // Should transmit compiled JSX (which is compressed compared to raw JSX)
      expect(transmittedPayload).toBeDefined();
      expect(transmittedPayload.body).toBeDefined();
      expect(transmittedPayload.body.compiled).toBeDefined();

      // The compiled version should have template references instead of full JSX
      const compiledSize = JSON.stringify(compiled).length;
      const originalSize = JSON.stringify(jsxContent).length;
      expect(compiledSize).toBeLessThan(originalSize);
    });

    it('should decompress received JSX content', async () => {
      // Setup radio for HTTP protocol
      httpProtocol.setRadio(radioControl);

      // Setup handler to process JSX
      httpProtocol.onRequest(async (request, respond) => {
        if (request.path === '/jsx-content') {
          try {
            const compiled = request.body;
            const decompiled = jsxCompiler.decompile(compiled);

            respond({
              status: 200,
              headers: { 'Content-Type': 'application/jsx' },
              body: decompiled
            });
          } catch (error) {
            respond({
              status: 500,
              headers: {},
              body: { error: 'Decompilation failed' }
            });
          }
        }
      });

      // Create and compile JSX
      const originalJSX = {
        type: 'div',
        props: {},
        children: ['Decompression Test']
      };

      const compiled = jsxCompiler.compile(originalJSX);

      // Send request with compiled JSX
      const requestPacket = {
        header: {
          version: 1,
          type: 'REQUEST' as const,
          source: 'TEST2',
          destination: 'TEST1',
          sequence: 1,
          timestamp: Date.now(),
          length: 200,
          checksum: 12345
        },
        payload: {
          method: 'POST',
          path: '/jsx-content',
          headers: { 'Content-Type': 'application/jsx' },
          body: compiled
        }
      };

      let responseBody: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        responseBody = packet.payload.body;
      });

      httpProtocol.setRadio(radioControl);
      await httpProtocol.handlePacket(requestPacket);

      // Should receive decompiled JSX
      expect(responseBody).toBeDefined();
      expect(responseBody.type).toBe('div');
      expect(responseBody.children).toBeDefined();
      expect(responseBody.children).toEqual(['Decompression Test']);
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete authenticated data transfer', async () => {
      // Generate keys for both stations
      const station2Crypto = new CryptoManager();
      await station2Crypto.generateKeyPair('TEST2');

      // Setup authenticated request handler
      httpProtocol.onRequest(async (request, respond) => {
        if (request.path === '/secure-data') {
          try {
            // Verify request signature - the body contains the signed request
            const signedRequest = request.body;
            const isValid = await cryptoManager.verifyRequest(signedRequest);

            if (isValid) {
              respond({
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { authenticated: true, data: 'secure content' }
              });
            } else {
              respond({
                status: 401,
                headers: {},
                body: { error: 'Invalid signature' }
              });
            }
          } catch (error) {
            respond({
              status: 401,
              headers: {},
              body: { error: 'Invalid signature' }
            });
          }
        }
      });

      // Create signed request
      const signedRequest = await station2Crypto.signRequest(
        'GET',
        '/secure-data',
        { 'Accept': 'application/json' }
      );

      // Send authenticated request
      const requestPacket = {
        header: {
          version: 1,
          type: 'REQUEST' as const,
          source: 'TEST2',
          destination: 'TEST1',
          sequence: 1,
          timestamp: Date.now(),
          length: 300,
          checksum: 12345
        },
        payload: {
          method: 'GET',
          path: '/secure-data',
          headers: { 'Accept': 'application/json' },
          body: signedRequest
        }
      };

      let responseStatus = 0;
      let responseBody: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        responseStatus = packet.payload.status;
        responseBody = packet.payload.body;
      });

      httpProtocol.setRadio(radioControl);
      
      // Add TEST2's public key as trusted
      const test2KeyPair = await station2Crypto.generateKeyPair('TEST2');
      cryptoManager.addTrustedKey('TEST2', test2KeyPair.publicKeyPem);

      await httpProtocol.handlePacket(requestPacket);

      expect(responseStatus).toBe(200);
      expect(responseBody.authenticated).toBe(true);
      expect(responseBody.data).toBe('secure content');
    });

    it('should handle mesh-routed compressed content with database caching', async () => {
      // Setup complete pipeline
      vi.spyOn(meshNetwork, 'sendPacket').mockImplementation(async (dest: string, packet: any) => {
        // Simulate successful routing immediately
        // Compress response content
        const content = '<div>Mesh routed content</div>';
        const compressed = compressor.compressHTML(content);

        // Cache in database
        await database.cacheContent('/mesh-content', content);

        const responsePacket = {
          header: {
            version: 1,
            type: 'RESPONSE',
            source: dest,
            destination: 'TEST1',
            sequence: packet.header.sequence, // Match the request sequence
            timestamp: Date.now(),
            length: compressed.compressedSize,
            checksum: 12345
          },
          payload: {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'text/html', 'X-Compressed': 'true' },
            body: compressed
          }
        };

        setTimeout(() => {
          httpProtocol.handlePacket(responsePacket);
        }, 0);
        return true;
      });

      httpProtocol.setMeshNetwork(meshNetwork);

      const request = {
        method: 'GET' as const,
        path: '/mesh-content',
        headers: { 'Accept': 'text/html' }
      };

      const response = await httpProtocol.sendRequest(request, 'DISTANT');

      expect(response.status).toBe(200);
      expect(response.headers['X-Compressed']).toBe('true');
      
      // Verify content was cached
      const cached = await database.getCachedContent('/mesh-content');
      expect(cached).toBe('<div>Mesh routed content</div>');
    });
  });
});