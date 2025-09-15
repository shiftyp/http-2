import { QPSKModem } from '../qpsk-modem';
import { HamRadioCompressor } from '../compression';
import { protocolBuffers } from '../protocol-buffers';

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
  private renderer: ReactLikeRenderer;
  private packetBuffer: Map<string, HTTPPacket[]> = new Map();
  private sequenceNumber: number = 0;
  private currentVDOM: VirtualDOM | null = null;
  private callsign: string;
  private requestHandler?: (request: HTTPRequest, respond: (response: HTTPResponse) => void) => void;

  constructor(modemConfig: any) {
    this.modem = new QPSKModem(modemConfig);
    this.compressor = new HamRadioCompressor();
    this.renderer = new ReactLikeRenderer();
    this.callsign = modemConfig.callsign || 'UNKNOWN';
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

  async handlePacket(packet: HTTPPacket): Promise<void> {
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
      // Protocol buffer mode: send schema first, then encoded data
      const schema = protocolBuffers.generateSchema(body, 'RequestData');
      const schemaTransmission = protocolBuffers.createSchemaTransmission(schema);

      // Send schema packet first
      const schemaPayload = new TextEncoder().encode(JSON.stringify(schemaTransmission));
      const schemaPacket: HTTPPacket = {
        version: 1,
        type: 'schema',
        id: this.generatePacketId(),
        sequence: this.sequenceNumber++,
        flags: {
          compressed: false,
          encrypted: false,
          fragmented: false,
          lastFragment: true,
          deltaUpdate: false,
          protobufEncoded: true
        },
        payload: schemaPayload
      };

      await this.transmitPacket(schemaPacket);

      // Encode the data using protocol buffers
      const encoded = protocolBuffers.encode(body, schema.id);
      const encodedPayload = encoded.data; // Use raw binary data

      // Send data packet
      const dataPacket: HTTPPacket = {
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
          protobufEncoded: true
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
    const serialized = this.serializePacket(packet);
    
    // Fragment if too large
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

      // Handle schema packets - cache but don't forward to application
      if (packet.type === 'schema' && packet.flags.protobufEncoded) {
        try {
          const schemaTransmission = JSON.parse(new TextDecoder().decode(packet.payload));
          if (schemaTransmission.schema) {
            protocolBuffers.cacheSchema(schemaTransmission.schema);
          }
        } catch (error) {
          console.warn('Failed to parse schema packet:', error);
        }
        return; // Don't forward schema packets to application
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
    const view = new DataView(data.buffer);
    
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
      payload: data.slice(16, 16 + payloadLength)
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
    const packet = this.createPacket('REQUEST', request, 'destination');
    return this.serializePacket(packet);
  }

  encodeResponse(response: any): Uint8Array {
    const packet = this.createPacket('RESPONSE', response, 'destination');
    return this.serializePacket(packet);
  }

  decodePacket(data: Uint8Array): any {
    const packet = this.deserializePacket(data);
    if (packet.payload) {
      // Handle protocol buffer encoded data with raw binary
      if (packet.flags.protobufEncoded && packet.type !== 'schema') {
        try {
          // For binary protobuf data, we need to reconstruct the EncodedMessage
          // Since we sent raw binary data, we need to get the schema ID from context
          // For now, let's try to decode all cached schemas until one works
          const schemaIds = protocolBuffers.getCachedSchemaIds();

          for (const schemaId of schemaIds) {
            try {
              const encodedMessage = {
                schemaId: schemaId,
                data: packet.payload,
                compressed: false
              };
              const decoded = protocolBuffers.decode(encodedMessage);
              return decoded;
            } catch {
              continue; // Try next schema
            }
          }

          return { error: 'Protocol buffer decode failed: no matching schema found' };
        } catch (error) {
          return { error: `Protocol buffer decode failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
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