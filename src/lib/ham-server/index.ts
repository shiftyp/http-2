/**
 * HTTP Server for Ham Radio Network
 * Implements HTTP/1.1 server functionality optimized for radio transmission
 */

import { logbook } from '../logbook';
import { HamRadioCompressor } from '../compression';
import { cryptoManager } from '../crypto';
import { renderComponentForRadio, renderComponentFromRadio, ProtobufComponentData } from '../react-renderer';
import React from 'react';

export interface HTTPRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  version: string;
  headers: Map<string, string>;
  body?: Buffer;
  callsign: string;
  timestamp: number;
  requestId: string;
}

export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Map<string, string>;
  body: Buffer | string | ProtobufComponentData[];
  etag?: string;
  compressed?: boolean;
  isProtobuf?: boolean;
}

export interface RouteHandler {
  (request: HTTPRequest): Promise<HTTPResponse> | HTTPResponse;
}

export interface ServerConfig {
  callsign: string;
  gridSquare?: string;
  qth?: string;
  maxBodySize: number;
  compressionThreshold: number;
  cacheDuration: number;
  requireSignatures: boolean;
  useProtobuf: boolean;
  componentRegistry: Record<string, React.ComponentType<any>>;
}

/**
 * HTTP Server implementation for ham radio networks
 * Provides full HTTP/1.1 functionality with radio-specific optimizations
 */
export class HTTPServer {
  private routes: Map<string, Map<string, RouteHandler>> = new Map();
  private middleware: Array<(req: HTTPRequest, res: HTTPResponse) => void> = [];
  private compressor = new HamRadioCompressor();
  private config: ServerConfig;
  private isActive = false;
  private requestCache: Map<string, HTTPResponse> = new Map();
  
  constructor(config: Partial<ServerConfig> & { callsign: string }) {
    this.config = {
      callsign: config.callsign,
      maxBodySize: config.maxBodySize || 8192,              // 8KB default max body
      compressionThreshold: config.compressionThreshold || 1024,      // Compress responses > 1KB
      cacheDuration: config.cacheDuration || 300000,           // 5 minute cache
      requireSignatures: config.requireSignatures || false,        // Digital signatures optional
      useProtobuf: config.useProtobuf || true,               // Enable protobuf by default
      componentRegistry: config.componentRegistry || {},      // React components for protobuf
      gridSquare: config.gridSquare,
      qth: config.qth
    };
    
    // Initialize HTTP method maps
    ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].forEach(method => {
      this.routes.set(method, new Map());
    });
  }
  
  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Server already running');
    }
    
    this.isActive = true;
    
    // Load persisted routes from database
    await this.loadPersistedRoutes();
    
    // Register default routes
    this.registerDefaultRoutes();
    
    // Initialize crypto if signatures required
    if (this.config.requireSignatures) {
      const keyPair = await cryptoManager.loadKeyPair(this.config.callsign);
      if (!keyPair) {
        await cryptoManager.generateKeyPair(this.config.callsign);
      }
    }
    
    console.log(`HTTP Server initialized for ${this.config.callsign}`);
    console.log(`Routes: ${this.getRouteCount()} registered`);
    console.log(`Compression: ${this.config.compressionThreshold} bytes threshold`);
    console.log(`Protobuf: ${this.config.useProtobuf ? 'Enabled' : 'Disabled'}`);
    console.log(`Signatures: ${this.config.requireSignatures ? 'Required' : 'Optional'}`);
    console.log(`Components: ${Object.keys(this.config.componentRegistry).length} registered`);
  }
  
  /**
   * Stop the HTTP server
   */
  stop(): void {
    this.isActive = false;
    this.requestCache.clear();
    console.log('HTTP Server stopped');
  }
  
  /**
   * Register a route handler
   */
  route(method: string, path: string, handler: RouteHandler): void {
    const methodMap = this.routes.get(method.toUpperCase());
    if (!methodMap) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    methodMap.set(path, handler);
    console.log(`Route registered: ${method.toUpperCase()} ${path}`);
  }
  
  /**
   * Register middleware
   */
  use(middleware: (req: HTTPRequest, res: HTTPResponse) => void): void {
    this.middleware.push(middleware);
  }

  /**
   * Register a React component for protobuf rendering
   */
  registerComponent(name: string, component: React.ComponentType<any>): void {
    this.config.componentRegistry[name] = component;
    console.log(`React component registered: ${name}`);
  }

  /**
   * Render a React element to protobuf for radio transmission
   */
  async renderToProtobuf(element: React.ReactElement, componentType: string): Promise<ProtobufComponentData> {
    if (!this.config.useProtobuf) {
      throw new Error('Protobuf rendering disabled');
    }

    try {
      return await renderComponentForRadio(
        element.type as React.ComponentType<any>,
        element.props,
        { componentType }
      );
    } catch (error) {
      console.error('Protobuf rendering failed:', error);
      throw new Error(`Protobuf rendering failed: ${error}`);
    }
  }

  /**
   * Create a protobuf response for React components
   */
  async createProtobufResponse(
    status: number,
    statusText: string,
    components: React.ReactElement[],
    componentTypes?: string[]
  ): Promise<HTTPResponse> {
    if (!this.config.useProtobuf) {
      throw new Error('Protobuf responses disabled');
    }

    try {
      const protobufData: ProtobufComponentData[] = [];

      for (let i = 0; i < components.length; i++) {
        const component = components[i];
        const componentType = componentTypes?.[i] || component.type.name || 'UnknownComponent';

        const data = await this.renderToProtobuf(component, componentType);
        protobufData.push(data);
      }

      const headers = new Map<string, string>();
      headers.set('Content-Type', 'application/x-protobuf');
      headers.set('Content-Encoding', 'protobuf');
      headers.set('X-Component-Count', protobufData.length.toString());

      // Calculate total size
      const totalSize = protobufData.reduce((sum, data) => sum + data.compressedSize, 0);
      headers.set('Content-Length', totalSize.toString());

      return {
        status,
        statusText,
        headers,
        body: protobufData,
        isProtobuf: true,
        compressed: true
      };
    } catch (error) {
      console.error('Protobuf response creation failed:', error);
      return this.createResponse(500, 'Internal Server Error',
        `Protobuf rendering failed: ${error}`);
    }
  }
  
  /**
   * Process incoming HTTP request
   */
  async handleRequest(request: HTTPRequest): Promise<HTTPResponse> {
    if (!this.isActive) {
      return this.createResponse(503, 'Service Unavailable', 'Server not active');
    }
    
    // Check request cache (idempotency)
    const cacheKey = `${request.requestId}:${request.callsign}`;
    if (this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey)!;
      cached.headers.set('X-Cache', 'HIT');
      return cached;
    }
    
    // Validate request size
    if (request.body && request.body.length > this.config.maxBodySize) {
      return this.createResponse(413, 'Payload Too Large', 
        `Maximum body size: ${this.config.maxBodySize} bytes`);
    }
    
    // Verify signature if required
    if (this.config.requireSignatures && request.headers.has('X-Signature')) {
      const signature = request.headers.get('X-Signature')!;
      const publicKey = request.headers.get('X-Public-Key')!;
      
      const signedRequest = {
        request: {
          method: request.method,
          path: request.path,
          headers: Object.fromEntries(request.headers),
          body: request.body?.toString(),
          timestamp: request.timestamp,
          nonce: request.headers.get('X-Nonce') || ''
        },
        signature,
        publicKey,
        callsign: request.callsign
      };
      
      const valid = await cryptoManager.verifyRequest(signedRequest);
      if (!valid) {
        return this.createResponse(401, 'Unauthorized', 'Invalid signature');
      }
    }
    
    // Find route handler
    const methodMap = this.routes.get(request.method);
    if (!methodMap) {
      return this.createResponse(405, 'Method Not Allowed', 
        `Method ${request.method} not supported`);
    }
    
    // Try exact match first, then pattern matching
    let handler = methodMap.get(request.path);
    
    if (!handler) {
      // Try wildcard routes
      for (const [pattern, routeHandler] of methodMap) {
        if (this.matchRoute(pattern, request.path)) {
          handler = routeHandler;
          break;
        }
      }
    }
    
    if (!handler) {
      return this.createResponse(404, 'Not Found', 
        `No handler for ${request.method} ${request.path}`);
    }
    
    try {
      // Execute handler
      let response = await handler(request);
      
      // Apply middleware
      for (const mw of this.middleware) {
        mw(request, response);
      }
      
      // Add server headers
      response.headers.set('X-Callsign', this.config.callsign);
      response.headers.set('X-Server', 'Ham-HTTP/1.0');
      response.headers.set('Date', new Date().toUTCString());
      
      // Handle protobuf or traditional compression
      if (response.body) {
        if (response.isProtobuf) {
          // Already compressed protobuf data
          response.headers.set('Content-Encoding', 'protobuf');
          response.headers.set('Content-Type', 'application/x-protobuf');
          response.compressed = true;
        } else if (Buffer.byteLength(response.body.toString()) > this.config.compressionThreshold) {
          // Traditional HTML compression
          const compressed = this.compressor.compressHTML(response.body.toString());
          response.body = JSON.stringify(compressed);
          response.headers.set('Content-Encoding', 'ham-compressed');
          response.compressed = true;
        }
      }
      
      // Generate ETag for caching
      if (!response.etag && response.body) {
        response.etag = this.generateETag(response.body.toString());
        response.headers.set('ETag', response.etag);
      }
      
      // Cache successful responses
      if (response.status >= 200 && response.status < 300) {
        this.requestCache.set(cacheKey, response);
        
        // Clean old cache entries
        setTimeout(() => {
          this.requestCache.delete(cacheKey);
        }, this.config.cacheDuration);
      }
      
      return response;
      
    } catch (error) {
      console.error(`Handler error: ${error}`);
      return this.createResponse(500, 'Internal Server Error', 
        `Handler error: ${error}`);
    }
  }
  
  /**
   * Create an HTTP response
   */
  private createResponse(status: number, statusText: string, body?: string): HTTPResponse {
    const headers = new Map<string, string>();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Content-Length', body ? Buffer.byteLength(body).toString() : '0');
    
    return {
      status,
      statusText,
      headers,
      body: body || ''
    };
  }
  
  /**
   * Match route patterns (supports wildcards)
   */
  private matchRoute(pattern: string, path: string): boolean {
    if (pattern === path) return true;
    
    // Convert route pattern to regex
    // /api/* matches /api/anything
    // /api/:id matches /api/123 and captures id
    const regexPattern = pattern
      .replace(/:[^/]+/g, '([^/]+)')  // Named parameters
      .replace(/\*/g, '.*');           // Wildcards
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }
  
  /**
   * Generate ETag for content
   */
  private generateETag(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${hash.toString(16)}"`;
  }
  
  /**
   * Register default system routes
   */
  private registerDefaultRoutes(): void {
    // Station information endpoint
    this.route('GET', '/', (req) => {
      const html = this.generateStationHTML();
      return this.createResponse(200, 'OK', html);
    });
    
    // API status endpoint
    this.route('GET', '/api/status', (req) => {
      const status = {
        callsign: this.config.callsign,
        gridSquare: this.config.gridSquare,
        qth: this.config.qth,
        server: 'Ham-HTTP/1.0',
        uptime: process.uptime ? process.uptime() : 0,
        routes: this.getRouteCount(),
        cache: this.requestCache.size,
        timestamp: new Date().toISOString()
      };
      
      const response = this.createResponse(200, 'OK', JSON.stringify(status));
      response.headers.set('Content-Type', 'application/json');
      return response;
    });
    
    // QSO log endpoint
    this.route('GET', '/api/log', async (req) => {
      const limit = parseInt(req.headers.get('X-Limit') || '100');
      const qsos = await logbook.findQSOs();
      const data = qsos.slice(0, limit);

      // Check if client supports protobuf
      const acceptsProtobuf = req.headers.get('Accept')?.includes('application/x-protobuf');

      if (this.config.useProtobuf && acceptsProtobuf) {
        // Create React components for each QSO
        const qsoComponents = data.map(qso =>
          React.createElement(this.config.componentRegistry.QSOCard, {
            callsign: qso.callsign,
            frequency: qso.frequency,
            mode: qso.mode,
            rst: qso.rst,
            notes: qso.notes
          })
        );

        return await this.createProtobufResponse(200, 'OK', qsoComponents);
      } else {
        // Fallback to JSON
        const response = this.createResponse(200, 'OK', JSON.stringify(data));
        response.headers.set('Content-Type', 'application/json');
        return response;
      }
    });
    
    // Mesh nodes endpoint
    this.route('GET', '/api/mesh', async (req) => {
      const nodes = await logbook.getActiveNodes(1);

      // Check if client supports protobuf
      const acceptsProtobuf = req.headers.get('Accept')?.includes('application/x-protobuf');

      if (this.config.useProtobuf && acceptsProtobuf) {
        // Create React components for each mesh node
        const nodeComponents = nodes.map(node =>
          React.createElement(this.config.componentRegistry.MeshNode, {
            callsign: node.callsign,
            gridSquare: node.gridSquare,
            snr: node.snr,
            lastSeen: node.lastSeen
          })
        );

        return await this.createProtobufResponse(200, 'OK', nodeComponents);
      } else {
        // Fallback to JSON
        const response = this.createResponse(200, 'OK', JSON.stringify(nodes));
        response.headers.set('Content-Type', 'application/json');
        return response;
      }
    });
    
    // OPTIONS for CORS preflight
    this.route('OPTIONS', '*', (req) => {
      const response = this.createResponse(204, 'No Content');
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Callsign, X-Signature');
      return response;
    });
  }
  
  /**
   * Load persisted routes from database
   */
  private async loadPersistedRoutes(): Promise<void> {
    const pages = await logbook.listPages();
    
    for (const page of pages) {
      if (!page.path.startsWith('/api/') && 
          !page.path.startsWith('app:') && 
          !page.path.startsWith('msg:') && 
          !page.path.startsWith('cache:')) {
        
        this.route('GET', page.path, (req) => {
          return this.createResponse(200, 'OK', page.content);
        });
      }
    }
  }
  
  /**
   * Get total route count
   */
  private getRouteCount(): number {
    let count = 0;
    for (const methodMap of this.routes.values()) {
      count += methodMap.size;
    }
    return count;
  }
  
  /**
   * Generate station information HTML
   */
  private generateStationHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.config.callsign} HTTP Server</title>
  <style>
    body { font-family: 'Courier New', monospace; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; }
    .info { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .endpoint { font-family: monospace; background: #e0e0e0; padding: 2px 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>${this.config.callsign} HTTP Server</h1>
  
  <div class="info">
    <table>
      <tr><th>Callsign</th><td>${this.config.callsign}</td></tr>
      <tr><th>Grid Square</th><td>${this.config.gridSquare || 'Not configured'}</td></tr>
      <tr><th>QTH</th><td>${this.config.qth || 'Not configured'}</td></tr>
      <tr><th>Server</th><td>Ham-HTTP/1.0</td></tr>
      <tr><th>Compression</th><td>Enabled (${this.config.compressionThreshold} bytes threshold)</td></tr>
      <tr><th>Signatures</th><td>${this.config.requireSignatures ? 'Required' : 'Optional'}</td></tr>
    </table>
  </div>
  
  <h2>Available Endpoints</h2>
  <table>
    <tr><th>Method</th><th>Path</th><th>Description</th></tr>
    <tr><td>GET</td><td class="endpoint">/</td><td>This page</td></tr>
    <tr><td>GET</td><td class="endpoint">/api/status</td><td>Server status (JSON)</td></tr>
    <tr><td>GET</td><td class="endpoint">/api/log</td><td>QSO log (JSON)</td></tr>
    <tr><td>GET</td><td class="endpoint">/api/mesh</td><td>Active mesh nodes (JSON)</td></tr>
  </table>
  
  <h2>HTTP Headers</h2>
  <p>All responses include:</p>
  <ul>
    <li><code>X-Callsign</code>: Station callsign</li>
    <li><code>X-Server</code>: Server version</li>
    <li><code>ETag</code>: Content hash for caching</li>
    <li><code>Content-Encoding</code>: Compression method if applied</li>
  </ul>
  
  <p>Request headers:</p>
  <ul>
    <li><code>X-Callsign</code>: Your callsign (required)</li>
    <li><code>X-Request-ID</code>: Unique request ID for idempotency</li>
    <li><code>X-Signature</code>: Digital signature (if signatures enabled)</li>
    <li><code>If-None-Match</code>: ETag for conditional requests</li>
  </ul>
</body>
</html>`;
  }
}

/**
 * HTTP Client for making requests to other stations
 */
export class HTTPClient {
  private config: ServerConfig;
  private compressor = new HamRadioCompressor();
  
  constructor(config: ServerConfig) {
    this.config = config;
  }
  
  /**
   * Make an HTTP request to another station
   */
  async request(
    method: string,
    url: string,
    options?: {
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }
  ): Promise<HTTPResponse> {
    const requestId = this.generateRequestId();
    const timestamp = Date.now();
    
    // Build request
    const request: HTTPRequest = {
      method: method as any,
      path: url,
      version: 'HTTP/1.1',
      headers: new Map(Object.entries(options?.headers || {})),
      body: options?.body ? Buffer.from(options.body) : undefined,
      callsign: this.config.callsign,
      timestamp,
      requestId
    };
    
    // Add required headers
    request.headers.set('X-Callsign', this.config.callsign);
    request.headers.set('X-Request-ID', requestId);
    request.headers.set('User-Agent', 'Ham-HTTP-Client/1.0');
    
    // Sign request if configured
    if (this.config.requireSignatures) {
      const signed = await cryptoManager.signRequest(
        request.method,
        request.path,
        Object.fromEntries(request.headers),
        request.body?.toString()
      );
      
      request.headers.set('X-Signature', signed.signature);
      request.headers.set('X-Public-Key', signed.publicKey);
      request.headers.set('X-Nonce', signed.request.nonce);
    }
    
    // This would normally send over radio
    // For now, return a mock response
    return this.createResponse(200, 'OK', 'Response would come from radio transmission');
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.config.callsign}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Create a response object
   */
  private createResponse(status: number, statusText: string, body: string): HTTPResponse {
    return {
      status,
      statusText,
      headers: new Map(),
      body
    };
  }
}

// Default React components for ham radio
const DefaultComponents = {
  QSOCard: ({ callsign, frequency, mode, rst, notes }: any) => React.createElement('div', { className: 'qso-card' }, [
    React.createElement('h3', { key: 'call' }, `QSO with ${callsign}`),
    React.createElement('p', { key: 'freq' }, `Frequency: ${frequency} MHz`),
    React.createElement('p', { key: 'mode' }, `Mode: ${mode}`),
    React.createElement('p', { key: 'rst' }, `RST: ${rst}`),
    notes && React.createElement('p', { key: 'notes' }, notes)
  ].filter(Boolean)),

  StatusUpdate: ({ status, timestamp, callsign }: any) => React.createElement('div', { className: 'status-update' }, [
    React.createElement('strong', { key: 'call' }, callsign),
    React.createElement('span', { key: 'time' }, ` - ${new Date(timestamp).toLocaleTimeString()}`),
    React.createElement('p', { key: 'status' }, status)
  ]),

  MeshNode: ({ callsign, gridSquare, snr, lastSeen }: any) => React.createElement('div', { className: 'mesh-node' }, [
    React.createElement('h4', { key: 'call' }, callsign),
    React.createElement('p', { key: 'grid' }, `Grid: ${gridSquare}`),
    React.createElement('p', { key: 'snr' }, `SNR: ${snr}dB`),
    React.createElement('small', { key: 'seen' }, `Last seen: ${new Date(lastSeen).toLocaleString()}`)
  ])
};

// Export singleton instances
export const httpServer = new HTTPServer({
  callsign: 'NOCALL',
  maxBodySize: 8192,
  compressionThreshold: 1024,
  cacheDuration: 300000,
  requireSignatures: false,
  useProtobuf: true,
  componentRegistry: DefaultComponents
});

export const httpClient = new HTTPClient({
  callsign: 'NOCALL',
  maxBodySize: 8192,
  compressionThreshold: 1024,
  cacheDuration: 300000,
  requireSignatures: false
});