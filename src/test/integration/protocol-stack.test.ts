import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPProtocol } from '../../lib/http-protocol';
import { RadioControl } from '../../lib/radio';
import { HamRadioCompressor, RadioJSXCompiler } from '../../lib/compression';
import { CryptoManager } from '../../lib/crypto';
import { MeshNetwork } from '../../lib/mesh';
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
    meshNetwork = new MeshNetwork({ callsign: 'TEST1' });
    database = new Database();

    // Mock radio transmit/receive
    vi.spyOn(radioControl, 'transmit').mockResolvedValue();
    vi.spyOn(radioControl, 'startReceive').mockImplementation(() => {});
    vi.spyOn(radioControl, 'connect').mockResolvedValue();

    // Initialize database
    await database.init();

    // Generate crypto keys
    await cryptoManager.generateKeyPair('TEST1');
  });

  describe('HTTP Request/Response Flow', () => {
    it('should handle complete HTTP request/response cycle', async () => {
      // Setup mock radio to simulate receiving response
      let transmittedData: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (data) => {
        transmittedData = data;
        
        // Simulate response after short delay
        setTimeout(() => {
          const responsePacket = {
            header: {
              version: 1,
              type: 'RESPONSE',
              source: 'TEST2',
              destination: 'TEST1',
              sequence: 1,
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
          
          httpProtocol.handlePacket(responsePacket);
        }, 50);
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

      // Sign a request
      const signedRequest = await cryptoManager.signRequest(
        'POST',
        '/api/secure',
        { 'Content-Type': 'application/json' },
        { secret: 'data' }
      );

      // Verify signature
      const isValid = await cryptoManager.verifyRequest(signedRequest);
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

      // Process the signed request
      await httpProtocol.handlePacket(packet);
    });

    it('should reject requests with invalid signatures', async () => {
      let responseStatus = 0;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        responseStatus = packet.payload.status;
      });

      httpProtocol.setRadio(radioControl);

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

      vi.spyOn(meshNetwork, 'sendPacket').mockImplementation(async (packet, dest) => {
        // Simulate packet reaching destination through mesh
        if (dest === 'TEST3') {
          setTimeout(() => {
            const responsePacket = {
              header: {
                version: 1,
                type: 'RESPONSE',
                source: 'TEST3',
                destination: 'TEST1',
                sequence: 1,
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
            
            httpProtocol.handlePacket(responsePacket);
          }, 100);
        }
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
          
          respond({
            status: 200,
            headers: { 'Content-Type': 'text/html' },
            body: cachedPage.content
          });
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

      let responseBody: any;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        responseBody = packet.payload.body;
      });

      httpProtocol.setRadio(radioControl);
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

      let transmittedSize = 0;
      vi.spyOn(radioControl, 'transmit').mockImplementation(async (packet) => {
        transmittedSize = JSON.stringify(packet).length;
      });

      httpProtocol.setRadio(radioControl);
      await httpProtocol.sendRequest(request, 'TEST2').catch(() => {});

      // Should transmit compressed JSX
      expect(transmittedSize).toBeGreaterThan(0);
      expect(transmittedSize).toBeLessThan(JSON.stringify(jsxContent).length);
    });

    it('should decompress received JSX content', async () => {
      // Setup handler to process JSX
      httpProtocol.onRequest(async (request, respond) => {
        if (request.path === '/jsx-content') {
          const compiled = request.body;
          const decompiled = jsxCompiler.decompile(compiled);
          
          respond({
            status: 200,
            headers: { 'Content-Type': 'application/jsx' },
            body: decompiled
          });
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
      expect(responseBody.type).toBe('div');
      expect(responseBody.children).toContain('Decompression Test');
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
          // Verify request signature
          const isValid = await cryptoManager.verifyRequest(request.body);
          
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
      vi.spyOn(meshNetwork, 'sendPacket').mockImplementation(async (packet, dest) => {
        // Simulate successful routing
        setTimeout(async () => {
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
              sequence: 1,
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
          
          httpProtocol.handlePacket(responsePacket);
        }, 50);
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