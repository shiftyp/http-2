import { QPSKModem } from '../qpsk-modem';
import { HamRadioCompressor } from '../compression';
import { DistributedSystemsManager } from '../distributed-systems/index.js';
import { ComplianceManager } from '../fcc-compliance/index.js';
import { PriorityManager, EmergencyBroadcaster, PriorityLevel, type PriorityMessage } from '../priority-tiers/index.js';

export interface HTTPRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
}

export interface HTTPResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
}

export interface HTTPPacket {
  version: number;
  type: 'request' | 'response' | 'delta' | 'stream' | 'schema';
  id: string;
  sequence: number;
  flags: {
    compressed: boolean;
    encrypted: boolean;
    fragmented: boolean;
    lastFragment: boolean;
    deltaUpdate: boolean;
    protobufEncoded?: boolean;
  };
  payload: Uint8Array;
  header?: {
    version: number;
    type: 'REQUEST' | 'RESPONSE' | 'DELTA' | 'STREAM';
    source: string;
    destination: string;
    timestamp: number;
    sequence: number;
  };
}

export interface VirtualDOM {
  tag: string;
  props: Record<string, any>;
  children: (VirtualDOM | string)[];
  key?: string;
}

export interface DeltaUpdate {
  type: 'insert' | 'replace' | 'remove' | 'update';
  path: string;
  data?: any;
  props?: Record<string, any>;
}

export class ReactLikeRenderer {
  private currentTree: VirtualDOM | null = null;
  private componentState: Map<string, any> = new Map();
  private eventHandlers: Map<string, Function> = new Map();

  renderToString(vdom: VirtualDOM): string {
    if (!vdom) return '';
    
    if (typeof vdom === 'string') return vdom;
    
    const { tag, props, children } = vdom;
    const attrs = Object.entries(props || {})
      .filter(([key]) => key !== 'children' && !key.startsWith('on'))
      .map(([key, val]) => `${key}="${val}"`)
      .join(' ');
    
    const childrenHtml = children
      .map(child => this.renderToString(child as VirtualDOM))
      .join('');
    
    return `<${tag}${attrs ? ' ' + attrs : ''}>${childrenHtml}</${tag}>`;
  }

  diff(oldTree: VirtualDOM | null, newTree: VirtualDOM): DeltaUpdate[] {
    const updates: DeltaUpdate[] = [];
    
    if (!oldTree) {
      updates.push({
        type: 'replace',
        path: 'root',
        data: this.renderToString(newTree)
      });
      return updates;
    }
    
    this.diffNode(oldTree, newTree, 'root', updates);
    return updates;
  }

  private diffNode(
    oldNode: VirtualDOM,
    newNode: VirtualDOM,
    path: string,
    updates: DeltaUpdate[]
  ): void {
    // Different tags - replace entire node
    if (oldNode.tag !== newNode.tag) {
      updates.push({
        type: 'replace',
        path,
        data: this.renderToString(newNode)
      });
      return;
    }
    
    // Check props
    const propUpdates: Record<string, any> = {};
    const allProps = new Set([
      ...Object.keys(oldNode.props || {}),
      ...Object.keys(newNode.props || {})
    ]);
    
    for (const prop of allProps) {
      if (oldNode.props?.[prop] !== newNode.props?.[prop]) {
        propUpdates[prop] = newNode.props?.[prop];
      }
    }
    
    if (Object.keys(propUpdates).length > 0) {
      updates.push({
        type: 'update',
        path,
        props: propUpdates
      });
    }
    
    // Check children
    const oldChildren = oldNode.children || [];
    const newChildren = newNode.children || [];
    
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${path}[${i}]`;
      
      if (i >= oldChildren.length) {
        // Insert new child
        updates.push({
          type: 'insert',
          path: childPath,
          data: this.renderToString(newChildren[i] as VirtualDOM)
        });
      } else if (i >= newChildren.length) {
        // Remove old child
        updates.push({
          type: 'remove',
          path: childPath
        });
      } else if (typeof oldChildren[i] === 'string' && typeof newChildren[i] === 'string') {
        // Text nodes
        if (oldChildren[i] !== newChildren[i]) {
          updates.push({
            type: 'replace',
            path: childPath,
            data: newChildren[i]
          });
        }
      } else if (typeof oldChildren[i] === 'object' && typeof newChildren[i] === 'object') {
        // Recurse for element nodes
        this.diffNode(
          oldChildren[i] as VirtualDOM,
          newChildren[i] as VirtualDOM,
          childPath,
          updates
        );
      } else {
        // Type mismatch - replace
        updates.push({
          type: 'replace',
          path: childPath,
          data: this.renderToString(newChildren[i] as VirtualDOM)
        });
      }
    }
  }

  applyDeltas(deltas: DeltaUpdate[]): void {
    for (const delta of deltas) {
      const element = this.findElement(delta.path);
      if (!element) continue;
      
      switch (delta.type) {
        case 'replace':
          element.outerHTML = delta.data;
          break;
        
        case 'update':
          for (const [prop, value] of Object.entries(delta.props || {})) {
            if (prop.startsWith('on')) {
              // Event handler
              const eventName = prop.slice(2).toLowerCase();
              element.addEventListener(eventName, () => {
                this.handleEvent(value);
              });
            } else {
              element.setAttribute(prop, value);
            }
          }
          break;
        
        case 'insert':
          element.insertAdjacentHTML('beforeend', delta.data);
          break;
        
        case 'remove':
          element.remove();
          break;
      }
    }
  }

  private findElement(path: string): Element | null {
    if (path === 'root') return document.body;
    
    const parts = path.split(/[\[\]]+/).filter(Boolean);
    let element: Element | null = document.body;
    
    for (let i = 1; i < parts.length; i++) {
      const index = parseInt(parts[i]);
      if (!isNaN(index)) {
        element = element?.children[index] || null;
      }
    }
    
    return element;
  }

  private handleEvent(handlerId: string): void {
    const handler = this.eventHandlers.get(handlerId);
    if (handler) {
      handler();
    }
  }
}

export class HTTPProtocol {
  private modem: QPSKModem;
  private compressor: HamRadioCompressor;
  private crypto?: any;
  private renderer: ReactLikeRenderer;
  private packetBuffer: Map<string, HTTPPacket[]> = new Map();
  private sequenceNumber: number = 0;
  private currentVDOM: VirtualDOM | null = null;
  private callsign: string;
  private requestHandler?: (request: HTTPRequest, respond: (response: HTTPResponse) => void) => void;
  private radio: any;
  private meshNetwork: any;
  private responseHandlers: Map<number, { resolve: (response: any) => void; reject: (error: any) => void }> = new Map();
  private distributedSystems?: DistributedSystemsManager;
  private complianceManager?: ComplianceManager;
  private emergencyBroadcaster?: EmergencyBroadcaster;

  constructor(options: {
    callsign: string;
    compressor?: HamRadioCompressor;
    crypto?: any;
    modemConfig?: any;
    licenseClass?: 'NOVICE' | 'TECHNICIAN' | 'GENERAL' | 'ADVANCED' | 'EXTRA';
    emergencyMode?: boolean;
  }) {
    this.callsign = options.callsign;
    this.compressor = options.compressor || new HamRadioCompressor();
    this.crypto = options.crypto;
    this.renderer = new ReactLikeRenderer();

    // Initialize modem only if modemConfig is provided
    if (options.modemConfig) {
      this.modem = new QPSKModem(options.modemConfig);
    } else {
      // Create a default modem for testing
      this.modem = new QPSKModem({
        mode: 'QPSK',
        sampleRate: 48000,
        symbolRate: 2400,
        centerFrequency: 1500,
        fftSize: 2048
      });
    }

    // Initialize distributed systems if callsign is provided
    if (options.callsign) {
      this.distributedSystems = new DistributedSystemsManager({
        callsign: options.callsign,
        licenseClass: options.licenseClass || 'TECHNICIAN',
        emergencyMode: options.emergencyMode || false
      });
    }
  }

  /**
   * Initialize distributed systems and FCC compliance
   */
  async initialize(): Promise<void> {
    if (this.distributedSystems) {
      await this.distributedSystems.initialize();
      this.complianceManager = this.distributedSystems.complianceManager;

      // Set up compliance violation handler
      this.complianceManager.on('violation', (violation: any) => {
        console.warn('FCC compliance violation detected:', violation);
        // Implement automatic corrective action if needed
      });

      // Set up automatic shutdown handler
      this.complianceManager.on('emergency-shutdown', () => {
        console.error('Emergency shutdown initiated due to compliance violation');
        this.emergencyShutdown();
      });

      // Initialize emergency broadcaster
      this.emergencyBroadcaster = new EmergencyBroadcaster(
        // Broadcast handler
        async (message: PriorityMessage, config) => {
          console.log(`Broadcasting ${PriorityManager.getPriorityName(message.priority.level)} message:`, message.id);

          // Check FCC compliance for emergency override
          if (message.priority.override && this.complianceManager) {
            const overrideCheck = await this.complianceManager.checkEmergencyOverride({
              data: new TextEncoder().encode(JSON.stringify(message.content)),
              priority: message.priority.level,
              source: message.priority.source
            });

            if (!overrideCheck.allowed) {
              console.warn('Emergency override blocked by FCC compliance:', overrideCheck.reason);
              return false;
            }
          }

          // Create HTTP packet for broadcast
          const packet = this.createPacket('REQUEST', {
            method: 'POST',
            path: '/emergency-broadcast',
            headers: {
              'X-Priority': message.priority.level.toString(),
              'X-Emergency': message.priority.level <= PriorityLevel.P1_URGENT ? 'true' : 'false',
              'X-Message-ID': message.id,
              'X-Source': message.priority.source,
              'Content-Type': 'application/json'
            },
            body: message.content
          }, 'BROADCAST');

          // Transmit via distributed systems or direct radio
          try {
            await this.transmitPacket(packet);
            return true;
          } catch (error) {
            console.error('Emergency broadcast failed:', error);
            return false;
          }
        },

        // Emergency override handler
        async (message: PriorityMessage) => {
          console.warn('🚨 EMERGENCY OVERRIDE ACTIVATED 🚨');
          console.log('Emergency message:', message.content);

          // Trigger emergency protocols
          if (this.complianceManager) {
            await this.complianceManager.triggerEmergencyMode();
          }

          // Additional emergency actions can be added here
        }
      );
    }
  }

  /**
   * Emergency shutdown of all systems
   */
  async emergencyShutdown(): Promise<void> {
    if (this.emergencyBroadcaster) {
      this.emergencyBroadcaster.dispose();
    }

    if (this.distributedSystems) {
      await this.distributedSystems.emergencyShutdown();
    }

    // Stop modem
    if (this.modem) {
      this.modem.stop();
    }

    // Clear all handlers
    this.requestHandler = undefined;
    this.responseHandlers.clear();
  }

  /**
   * Get distributed systems statistics
   */
  async getSystemStatistics(): Promise<any> {
    if (this.distributedSystems) {
      return await this.distributedSystems.getSystemStatistics();
    }
    return null;
  }

  /**
   * Check FCC compliance status
   */
  getComplianceStatus(): any {
    if (this.complianceManager) {
      return this.complianceManager.getStatus();
    }
    return { compliant: false, reason: 'Compliance manager not initialized' };
  }

  /**
   * Request and validate client certificate
   */
  async requestClientCertificate(callsign: string): Promise<boolean> {
    if (!this.distributedSystems) {
      return false;
    }

    try {
      // Check if we already have a valid certificate
      const existing = await this.distributedSystems.certificateManager.store.findByCallsign(callsign);
      if (existing && existing.length > 0) {
        const cert = existing[0];
        const validation = await this.distributedSystems.certificateManager.service.validateCertificate(cert.certificate);
        if (validation.valid) {
          return true;
        }
      }

      // Generate certificate request with CAPTCHA
      const captcha = await this.distributedSystems.certificateManager.captcha.generate({
        complexity: 5,
        includeAudio: false
      });

      // Store pending request
      await this.distributedSystems.certificateManager.store.storeCertificateRequest({
        id: crypto.randomUUID(),
        callsign,
        timestamp: Date.now(),
        status: 'pending',
        captcha: captcha.challenge,
        requestData: {
          subject: { CN: callsign },
          subjectAltName: [`callsign:${callsign}`],
          keyUsage: ['digitalSignature', 'keyEncipherment'],
          extendedKeyUsage: ['clientAuth']
        }
      });

      console.log('Certificate request created for', callsign);
      return false; // Not yet available, request created
    } catch (error) {
      console.error('Failed to request client certificate:', error);
      return false;
    }
  }

  /**
   * Authenticate connection using certificate
   */
  async authenticateConnection(callsign: string, certificate?: any): Promise<boolean> {
    if (!this.distributedSystems) {
      return false;
    }

    try {
      if (!certificate) {
        // Try to find existing certificate
        const certs = await this.distributedSystems.certificateManager.store.findByCallsign(callsign);
        if (certs.length === 0) {
          return await this.requestClientCertificate(callsign);
        }
        certificate = certs[0].certificate;
      }

      // Validate certificate
      const validation = await this.distributedSystems.certificateManager.service.validateCertificate(certificate);
      if (!validation.valid) {
        console.warn('Certificate validation failed:', validation.errors);
        return false;
      }

      // Validate trust chain
      const trustResult = await this.distributedSystems.certificateManager.validator.validateTrustChain(certificate);
      if (!trustResult.valid) {
        console.warn('Trust chain validation failed:', trustResult.errors);
        return false;
      }

      console.log('Certificate authentication successful for', callsign);
      return true;
    } catch (error) {
      console.error('Certificate authentication failed:', error);
      return false;
    }
  }

  /**
   * Broadcast emergency message
   */
  async broadcastEmergency(content: string, options: {
    category?: string;
    priority?: PriorityLevel;
    override?: boolean;
  } = {}): Promise<string | null> {
    if (!this.emergencyBroadcaster) {
      throw new Error('Emergency broadcaster not initialized');
    }

    const message = PriorityManager.createMessage(content, {
      level: options.priority || PriorityLevel.P0_EMERGENCY,
      category: options.category || 'emergency',
      source: this.callsign,
      broadcast: true,
      override: options.override || true
    });

    await this.emergencyBroadcaster.queueBroadcast(message);
    return message.id;
  }

  /**
   * Create priority update for distribution
   */
  async createPriorityUpdate(content: any, options: {
    priority: PriorityLevel;
    category: string;
    subscribers?: string[];
    ttl?: number;
  }): Promise<string | null> {
    if (!this.distributedSystems) {
      throw new Error('Distributed systems not initialized');
    }

    try {
      // Create priority message
      const message = PriorityManager.createMessage(content, {
        level: options.priority,
        category: options.category,
        source: this.callsign,
        ttl: options.ttl,
        broadcast: options.priority <= PriorityLevel.P2_HIGH
      });

      // Store in update manager
      const contentData = new TextEncoder().encode(JSON.stringify(content));
      const update = await this.distributedSystems.updateManager.create({
        category: options.category,
        priority: options.priority,
        data: contentData,
        originator: this.callsign,
        subscribers: options.subscribers || [],
        compress: true
      });

      // Queue for emergency broadcast if high priority
      if (this.emergencyBroadcaster && message.priority.broadcast) {
        await this.emergencyBroadcaster.queueBroadcast(message);
      }

      return update.id;
    } catch (error) {
      console.error('Failed to create priority update:', error);
      return null;
    }
  }

  /**
   * Acknowledge emergency broadcast receipt
   */
  acknowledgeEmergencyBroadcast(messageId: string): void {
    if (this.emergencyBroadcaster) {
      this.emergencyBroadcaster.acknowledgeMessage(messageId, this.callsign);
    }
  }

  /**
   * Get emergency broadcast statistics
   */
  getEmergencyStatistics(): any {
    if (this.emergencyBroadcaster) {
      return this.emergencyBroadcaster.getStatistics();
    }
    return {
      pendingBroadcasts: 0,
      emergencyMessages: 0,
      urgentMessages: 0,
      totalAttempts: 0,
      acknowledgedMessages: 0
    };
  }

  /**
   * Subscribe to dynamic updates
   */
  async subscribe(options: {
    categories: string[];
    priorities: number[];
    keywords?: string[];
    maxSize?: number;
    ttl?: number;
  }): Promise<string | null> {
    if (!this.distributedSystems) {
      throw new Error('Distributed systems not initialized');
    }

    try {
      const subscription = await this.distributedSystems.subscriptionRegistry.create({
        callsign: this.callsign,
        categories: options.categories,
        priorities: options.priorities,
        keywords: options.keywords,
        maxSize: options.maxSize,
        ttl: options.ttl,
        delivery: {
          queueSize: 50,
          retryCount: 3,
          retryDelayMs: 2000
        }
      });

      return subscription.id;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from updates
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    if (!this.distributedSystems) {
      return false;
    }

    try {
      await this.distributedSystems.subscriptionRegistry.delete(subscriptionId);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  /**
   * Get distributed servers status
   */
  getServerStatus(): any {
    if (!this.distributedSystems) {
      return { connected: false, servers: [] };
    }

    const connections = this.distributedSystems.serverManager.getActiveConnections();
    return {
      connected: connections.length > 0,
      servers: connections.map(conn => ({
        id: conn.server.id,
        endpoint: conn.server.endpoint,
        status: conn.status,
        responseTime: conn.responseTime,
        messageCount: conn.messageCount
      }))
    };
  }

  createPacket(type: 'REQUEST' | 'RESPONSE' | 'DELTA' | 'STREAM', payload: HTTPRequest | HTTPResponse, destination: string): HTTPPacket {
    return {
      version: 1,
      type: type.toLowerCase() as HTTPPacket['type'],
      id: this.generatePacketId(),
      sequence: this.sequenceNumber++,
      flags: {
        compressed: false,
        encrypted: false,
        fragmented: false,
        lastFragment: true,
        deltaUpdate: false
      },
      payload: new TextEncoder().encode(JSON.stringify(payload)),
      header: {
        version: 1,
        type,
        source: this.callsign,
        destination,
        timestamp: Date.now(),
        sequence: this.sequenceNumber - 1
      }
    };
  }

  async handleReceivedData(data: Uint8Array): Promise<void> {
    // Try to parse as binary packet first
    if (data.length >= 16) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const version = view.getUint8(0);

      // If it looks like a binary packet (version 1)
      if (version === 1) {
        try {
          const packet = this.deserializePacket(data);
          if (packet) {
            return this.handlePacket(packet);
          }
        } catch (error) {
          console.error('Failed to deserialize binary packet:', error);
        }
      }
    }

    // Try to parse as JSON
    try {
      const jsonStr = new TextDecoder().decode(data);
      const packet = JSON.parse(jsonStr) as HTTPPacket;
      return this.handlePacket(packet);
    } catch (error) {
      console.error('Failed to parse received data as JSON:', error);
    }
  }

  async handlePacket(packet: HTTPPacket): Promise<void> {
    // Handle response packets
    if (packet.header && packet.header.type === 'RESPONSE') {
      const handler = this.responseHandlers.get(packet.sequence);
      if (handler) {
        try {
          const response = JSON.parse(new TextDecoder().decode(packet.payload)) as HTTPResponse;
          handler.resolve(response);
          this.responseHandlers.delete(packet.sequence);
        } catch (error) {
          handler.reject(error);
          this.responseHandlers.delete(packet.sequence);
        }
      }
      return;
    }

    // Handle request packets
    if (packet.header && packet.header.type === 'REQUEST' && this.requestHandler) {
      try {
        const request = JSON.parse(new TextDecoder().decode(packet.payload)) as HTTPRequest;

        const respond = (response: HTTPResponse) => {
          const responsePacket = this.createPacket('RESPONSE', response, packet.header!.source);
          responsePacket.sequence = packet.sequence; // Match request sequence
          this.transmitPacket(responsePacket);
        };

        this.requestHandler(request, respond);
      } catch (error) {
        console.error('Error handling request packet:', error);
      }
    }
  }

  setRequestHandler(handler: (request: HTTPRequest, respond: (response: HTTPResponse) => void) => void): void {
    this.requestHandler = handler;
  }

  async sendRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    useProtocolBuffers: boolean = false
  ): Promise<void> {
    const request = {
      method,
      path,
      headers,
      body: body || undefined,
      timestamp: Date.now()
    };

    if (useProtocolBuffers && body) {
      // JSON compression mode: compress the body directly
      const compressor = new HamRadioCompressor();
      const jsonString = JSON.stringify(body);
      const compressedData = await compressor.compress(jsonString);
      const encodedPayload = compressedData;

      // Send data packet
      const dataPacket: HTTPPacket = {
        version: 1,
        type: 'request',
        id: this.generatePacketId(),
        sequence: this.sequenceNumber++,
        flags: {
          compressed: true,
          encrypted: false,
          fragmented: false,
          lastFragment: true,
          deltaUpdate: false,
          protobufEncoded: false
        },
        payload: encodedPayload
      };

      await this.transmitPacket(dataPacket);
    } else {
      // Standard JSON mode
      const payload = new TextEncoder().encode(JSON.stringify(request));
      const compressed = this.compressor.compressHTML(new TextDecoder().decode(payload));

      const packet: HTTPPacket = {
        version: 1,
        type: 'request',
        id: this.generatePacketId(),
        sequence: this.sequenceNumber++,
        flags: {
          compressed: true,
          encrypted: false,
          fragmented: false,
          lastFragment: true,
          deltaUpdate: false,
          protobufEncoded: false
        },
        payload: new TextEncoder().encode(JSON.stringify(compressed.compressed))
      };

      await this.transmitPacket(packet);
    }
  }

  async sendResponse(
    vdom: VirtualDOM,
    statusCode: number = 200,
    headers: Record<string, string> = {}
  ): Promise<void> {
    // Calculate delta if we have previous state
    if (this.currentVDOM) {
      const deltas = this.renderer.diff(this.currentVDOM, vdom);
      
      if (deltas.length < 10) {
        // Send delta update if small enough
        await this.sendDeltaUpdate(deltas, statusCode, headers);
        this.currentVDOM = vdom;
        return;
      }
    }

    // Send full response
    const html = this.renderer.renderToString(vdom);
    const compressed = this.compressor.compressHTML(html);
    
    const response = {
      statusCode,
      headers,
      body: compressed,
      timestamp: Date.now()
    };

    const payload = new TextEncoder().encode(JSON.stringify(response));
    
    const packet: HTTPPacket = {
      version: 1,
      type: 'response',
      id: this.generatePacketId(),
      sequence: this.sequenceNumber++,
      flags: {
        compressed: true,
        encrypted: false,
        fragmented: false,
        lastFragment: true,
        deltaUpdate: false
      },
      payload
    };

    await this.transmitPacket(packet);
    this.currentVDOM = vdom;
  }

  private async sendDeltaUpdate(
    deltas: DeltaUpdate[],
    statusCode: number,
    headers: Record<string, string>
  ): Promise<void> {
    const deltaPayload = {
      statusCode,
      headers,
      deltas,
      timestamp: Date.now()
    };

    const payload = new TextEncoder().encode(JSON.stringify(deltaPayload));
    
    const packet: HTTPPacket = {
      version: 1,
      type: 'delta',
      id: this.generatePacketId(),
      sequence: this.sequenceNumber++,
      flags: {
        compressed: false,
        encrypted: false,
        fragmented: false,
        lastFragment: true,
        deltaUpdate: true
      },
      payload
    };

    await this.transmitPacket(packet);
  }

  private async transmitPacket(packet: HTTPPacket): Promise<void> {
    // Check FCC compliance before transmission
    if (this.complianceManager) {
      const complianceCheck = await this.complianceManager.checkTransmission({
        data: packet.payload,
        destination: packet.header?.destination || 'BROADCAST',
        type: packet.type
      });

      if (!complianceCheck.allowed) {
        throw new Error(`Transmission blocked by FCC compliance: ${complianceCheck.reason}`);
      }
    }

    const serialized = this.serializePacket(packet);

    // Try distributed transmission first
    if (this.distributedSystems && packet.header?.destination) {
      try {
        await this.distributedSystems.serverManager.sendMessage(
          { packet: Array.from(serialized) },
          { strategy: 'best-response-time' }
        );
        return;
      } catch (error) {
        console.warn('Distributed transmission failed, falling back to direct radio:', error);
      }
    }

    // Fallback to direct radio transmission
    const maxPayloadSize = 2048; // bytes per transmission

    if (serialized.length > maxPayloadSize) {
      const fragments = this.fragmentPacket(serialized, maxPayloadSize);

      for (let i = 0; i < fragments.length; i++) {
        const fragPacket: HTTPPacket = {
          ...packet,
          sequence: this.sequenceNumber++,
          flags: {
            ...packet.flags,
            fragmented: true,
            lastFragment: i === fragments.length - 1
          },
          payload: fragments[i]
        };

        await this.modem.transmit(this.serializePacket(fragPacket));

        // Wait for ACK or timeout
        await this.waitForAck(fragPacket.id, fragPacket.sequence);
      }
    } else {
      await this.modem.transmit(serialized);
      await this.waitForAck(packet.id, packet.sequence);
    }
  }

  private serializePacket(packet: HTTPPacket): Uint8Array {
    const header = new ArrayBuffer(16);
    const view = new DataView(header);
    
    // Version (1 byte)
    view.setUint8(0, packet.version);
    
    // Type (1 byte)
    const typeMap: Record<string, number> = {
      'request': 0x01,
      'response': 0x02,
      'delta': 0x03,
      'stream': 0x04,
      'schema': 0x05
    };
    view.setUint8(1, typeMap[packet.type]);
    
    // ID (8 bytes)
    const idBytes = new TextEncoder().encode(packet.id.slice(0, 8));
    for (let i = 0; i < 8; i++) {
      view.setUint8(2 + i, idBytes[i] || 0);
    }
    
    // Sequence (2 bytes)
    view.setUint16(10, packet.sequence, true);
    
    // Flags (1 byte)
    let flags = 0;
    if (packet.flags.compressed) flags |= 0x01;
    if (packet.flags.encrypted) flags |= 0x02;
    if (packet.flags.fragmented) flags |= 0x04;
    if (packet.flags.lastFragment) flags |= 0x08;
    if (packet.flags.deltaUpdate) flags |= 0x10;
    if (packet.flags.protobufEncoded) flags |= 0x20;
    view.setUint8(12, flags);
    
    // Payload length (2 bytes)
    view.setUint16(13, packet.payload.length, true);
    
    // Reserved (1 byte)
    view.setUint8(15, 0);
    
    // Combine header and payload
    const result = new Uint8Array(header.byteLength + packet.payload.length);
    result.set(new Uint8Array(header), 0);
    result.set(packet.payload, header.byteLength);
    
    return result;
  }

  private fragmentPacket(data: Uint8Array, maxSize: number): Uint8Array[] {
    const fragments: Uint8Array[] = [];
    
    for (let i = 0; i < data.length; i += maxSize) {
      fragments.push(data.slice(i, Math.min(i + maxSize, data.length)));
    }
    
    return fragments;
  }

  private async waitForAck(id: string, sequence: number): Promise<void> {
    // Implement ACK waiting logic
    return new Promise((resolve) => {
      setTimeout(resolve, 100); // Placeholder
    });
  }

  private generatePacketId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  startReceive(onPacket: (packet: HTTPPacket) => void): void {
    this.modem.startReceive((data) => {
      const packet = this.deserializePacket(data);

      // Handle schema packets - no longer needed since we use direct JSON compression
      if (packet.type === 'schema') {
        // Schema packets are no longer used, skip them
        return;
      }

      if (packet.flags.fragmented) {
        // Store fragment
        if (!this.packetBuffer.has(packet.id)) {
          this.packetBuffer.set(packet.id, []);
        }

        this.packetBuffer.get(packet.id)!.push(packet);

        if (packet.flags.lastFragment) {
          // Reassemble
          const fragments = this.packetBuffer.get(packet.id)!;
          const reassembled = this.reassemblePacket(fragments);
          this.packetBuffer.delete(packet.id);
          onPacket(reassembled);
        }
      } else {
        onPacket(packet);
      }
    });
  }

  private deserializePacket(data: Uint8Array): HTTPPacket {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const version = view.getUint8(0);
    const type = view.getUint8(1);

    const idBytes = data.slice(2, 10);
    const id = new TextDecoder().decode(idBytes).replace(/\0/g, '');

    const sequence = view.getUint16(10, true);
    const flags = view.getUint8(12);
    const payloadLength = view.getUint16(13, true);

    const typeMap: Record<number, HTTPPacket['type']> = {
      0x01: 'request',
      0x02: 'response',
      0x03: 'delta',
      0x04: 'stream',
      0x05: 'schema'
    };

    const headerTypeMap: Record<number, 'REQUEST' | 'RESPONSE' | 'DELTA' | 'STREAM'> = {
      0x01: 'REQUEST',
      0x02: 'RESPONSE',
      0x03: 'DELTA',
      0x04: 'STREAM'
    };

    return {
      version,
      type: typeMap[type],
      id,
      sequence,
      flags: {
        compressed: !!(flags & 0x01),
        encrypted: !!(flags & 0x02),
        fragmented: !!(flags & 0x04),
        lastFragment: !!(flags & 0x08),
        deltaUpdate: !!(flags & 0x10),
        protobufEncoded: !!(flags & 0x20)
      },
      payload: data.slice(16, 16 + payloadLength),
      header: {
        version,
        type: headerTypeMap[type] || 'REQUEST',
        source: '', // Will be filled from payload if needed
        destination: '',
        timestamp: Date.now(),
        sequence
      }
    };
  }

  private reassemblePacket(fragments: HTTPPacket[]): HTTPPacket {
    fragments.sort((a, b) => a.sequence - b.sequence);
    
    const payloads = fragments.map(f => f.payload);
    const totalLength = payloads.reduce((sum, p) => sum + p.length, 0);
    
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const payload of payloads) {
      combined.set(payload, offset);
      offset += payload.length;
    }
    
    return {
      ...fragments[0],
      flags: {
        ...fragments[0].flags,
        fragmented: false,
        lastFragment: true
      },
      payload: combined
    };
  }

  // Methods expected by integration tests
  encodeRequest(request: any): Uint8Array {
    // Format expected by tests
    const formattedRequest = {
      type: 'REQUEST',
      method: request.method,
      url: request.url,
      headers: request.headers || {},
      body: request.body
    };

    const payload = new TextEncoder().encode(JSON.stringify(formattedRequest));
    return payload;
  }

  encodeResponse(response: any): Uint8Array {
    // Format expected by tests
    const formattedResponse = {
      type: 'RESPONSE',
      status: response.status,
      statusText: response.statusText,
      headers: response.headers || {},
      body: response.body
    };

    const payload = new TextEncoder().encode(JSON.stringify(formattedResponse));
    return payload;
  }

  async decodePacket(data: Uint8Array): Promise<any> {
    // Handle empty data
    if (!data || data.length === 0) {
      return undefined;
    }

    try {
      // Direct JSON decoding for tests
      const decoded = JSON.parse(new TextDecoder().decode(data));
      return decoded;
    } catch {
      // Fallback to standard packet deserialization
      const packet = this.deserializePacket(data);
      if (packet.payload) {
        // Handle compressed JSON data
        if (packet.flags.compressed && packet.type !== 'schema') {
          try {
            // Decompress the data using HamRadioCompressor
            const compressor = new HamRadioCompressor();
            const decompressedString = await compressor.decompress(packet.payload);
            return JSON.parse(decompressedString);
          } catch (error) {
            return { error: `JSON decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
          }
        }

        try {
          const jsonData = JSON.parse(new TextDecoder().decode(packet.payload));
          return jsonData;
        } catch {
          return packet.payload;
        }
      }
      return null;
    }
  }

  // Methods expected by integration tests
  setRadio(radio: any): void {
    // Store radio instance for transmission
    this.radio = radio;
  }

  setMeshNetwork(meshNetwork: any): void {
    // Store mesh network for routing
    this.meshNetwork = meshNetwork;
  }

  onRequest(handler: (request: any, respond: (response: any) => void) => void): void {
    // Store request handler (alias for setRequestHandler)
    this.requestHandler = handler;
  }

  // Overloaded sendRequest for integration tests
  async sendRequest(request: HTTPRequest, destination: string): Promise<HTTPResponse>;
  async sendRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    useProtocolBuffers?: boolean
  ): Promise<void>;
  async sendRequest(
    requestOrMethod: HTTPRequest | string,
    destinationOrPath?: string,
    headers?: Record<string, string>,
    body?: any,
    useProtocolBuffers: boolean = false
  ): Promise<HTTPResponse | void> {
    // Handle the integration test signature
    if (typeof requestOrMethod === 'object' && destinationOrPath) {
      const request = requestOrMethod as HTTPRequest;
      const destination = destinationOrPath;

      return new Promise((resolve, reject) => {
        const packet = this.createPacket('REQUEST', request, destination);

        // Store response handler
        this.responseHandlers.set(packet.sequence, { resolve, reject });

        // Set timeout for response
        setTimeout(() => {
          if (this.responseHandlers.has(packet.sequence)) {
            this.responseHandlers.delete(packet.sequence);
            reject(new Error('Request timeout'));
          }
        }, 10000);

        // Transmit packet
        if (this.radio) {
          // Serialize packet for radio transmission
          const serialized = this.serializePacket(packet);
          this.radio.transmit(serialized);
        } else if (this.meshNetwork) {
          this.meshNetwork.sendPacket(packet, destination);
        } else {
          this.transmitPacket(packet);
        }
      });
    }

    // Handle original signature
    const method = requestOrMethod as string;
    const path = destinationOrPath as string;
    const requestPayload = {
      method,
      path,
      headers: headers || {},
      body: body || undefined,
      timestamp: Date.now()
    };

    if (useProtocolBuffers && body) {
      // JSON compression mode: compress the body directly
      const compressor = new HamRadioCompressor();
      const jsonString = JSON.stringify(body);
      const compressedData = await compressor.compress(jsonString);

      // Create packet with compressed data
      const dataPacket: HTTPPacket = {
        version: 1,
        type: 'request',
        id: this.generatePacketId(),
        sequence: this.sequenceNumber++,
        flags: {
          compressed: true,
          encrypted: false,
          fragmented: false,
          lastFragment: true,
          deltaUpdate: false,
          protobufEncoded: false
        },
        payload: compressedData
      };

      await this.transmitPacket(dataPacket);
    } else {
      const payload = new TextEncoder().encode(JSON.stringify(requestPayload));

      const packet: HTTPPacket = {
        version: 1,
        type: 'request',
        id: this.generatePacketId(),
        sequence: this.sequenceNumber++,
        flags: {
          compressed: false,
          encrypted: false,
          fragmented: false,
          lastFragment: true,
          deltaUpdate: false,
          protobufEncoded: false
        },
        payload
      };

      await this.transmitPacket(packet);
    }
  }
}