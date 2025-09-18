import { HTTPProtocol, HTTPPacket } from '../http-protocol';
import { RadioControl } from '../radio-control';

export interface MeshNode {
  callsign: string;
  address: string; // IPv6-like address for mesh routing
  lastSeen: number;
  signalStrength: number;
  snr: number;
  hops: number;
  capabilities: {
    relay: boolean;
    store: boolean;
    gateway: boolean;
    modes: string[];
  };
  metrics: {
    packetsRelayed: number;
    packetsDropped: number;
    bytesTransferred: number;
    uptime: number;
  };
}

export interface RoutingTableEntry {
  destination: string;
  nextHop: string;
  metric: number; // Cost metric (lower is better)
  sequenceNumber: number;
  lastUpdated: number;
  linkQuality: number; // 0-100
  hopCount: number;
}

export interface MeshPacket extends HTTPPacket {
  routing: {
    source: string;
    destination: string;
    ttl: number;
    hopCount: number;
    messageId: string;
    ackRequired: boolean;
  };
}

export interface RouteRequest {
  type: 'RREQ';
  source: string;
  destination: string;
  sequenceNumber: number;
  hopCount: number;
  messageId: string;
  timestamp: number;
}

export interface RouteReply {
  type: 'RREP';
  source: string;
  destination: string;
  sequenceNumber: number;
  hopCount: number;
  lifetime: number;
  messageId: string;
}

export interface RouteError {
  type: 'RERR';
  unreachableDestinations: string[];
  source: string;
}

// AODV (Ad hoc On-Demand Distance Vector) implementation
export class AODVRouter {
  private routingTable: Map<string, RoutingTableEntry> = new Map();
  private sequenceNumber: number = 0;
  private messageCache: Map<string, number> = new Map(); // MessageID -> timestamp
  private pendingRequests: Map<string, RouteRequest[]> = new Map();
  private myCallsign: string;
  private myAddress: string;

  constructor(callsign: string) {
    this.myCallsign = callsign;
    this.myAddress = this.generateMeshAddress(callsign);

    // Periodic route table maintenance
    setInterval(() => this.maintainRoutes(), 30000);
  }

  getAddress(): string {
    return this.myAddress;
  }

  addNeighbor(address: string, signalStrength: number, lastSeen: number): void {
    // Add direct neighbor to routing table with hop count 1
    const route: RoutingTableEntry = {
      destination: address,
      nextHop: address,
      metric: Math.abs(signalStrength), // Use signal strength as metric (lower is better)
      sequenceNumber: 0,
      lastUpdated: lastSeen,
      linkQuality: this.calculateLinkQuality(signalStrength),
      hopCount: 1
    };
    this.routingTable.set(address, route);
  }

  removeNeighbor(address: string): void {
    // Remove direct neighbor and any routes through them
    const toRemove: string[] = [];
    for (const [dest, route] of this.routingTable) {
      if (route.nextHop === address || dest === address) {
        toRemove.push(dest);
      }
    }
    toRemove.forEach(dest => this.routingTable.delete(dest));
  }

  private calculateLinkQuality(signalStrength: number): number {
    // Convert signal strength to link quality percentage
    // -30 dBm = 100%, -90 dBm = 0%
    const quality = Math.max(0, Math.min(100, ((signalStrength + 90) / 60) * 100));
    return Math.round(quality);
  }

  private generateMeshAddress(callsign: string): string {
    // Generate a unique mesh address from callsign
    // Format: fe80::xxxx:xxxx:xxxx:xxxx (like IPv6 link-local)
    const hash = this.hashCallsign(callsign);
    const parts = [];
    for (let i = 0; i < 4; i++) {
      parts.push(((hash >> (i * 16)) & 0xFFFF).toString(16).padStart(4, '0'));
    }
    return `fe80::${parts.join(':')}`;
  }

  private hashCallsign(callsign: string): number {
    let hash = 0;
    for (let i = 0; i < callsign.length; i++) {
      hash = ((hash << 5) - hash) + callsign.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    return Math.abs(hash);
  }

  async discoverRoute(destination: string): Promise<RoutingTableEntry | null> {
    // Check if we already have a route
    const existingRoute = this.routingTable.get(destination);
    if (existingRoute && this.isRouteValid(existingRoute)) {
      return existingRoute;
    }

    // Initiate route discovery
    const rreq: RouteRequest = {
      type: 'RREQ',
      source: this.myAddress,
      destination,
      sequenceNumber: ++this.sequenceNumber,
      hopCount: 0,
      messageId: this.generateMessageId(),
      timestamp: Date.now()
    };

    // Cache the request to prevent loops
    this.messageCache.set(rreq.messageId, Date.now());

    // Broadcast RREQ
    await this.broadcastRouteRequest(rreq);

    // Wait for RREP
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 10000); // 10 second timeout

      const checkInterval = setInterval(() => {
        const route = this.routingTable.get(destination);
        if (route) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(route);
        }
      }, 100);
    });
  }

  handleRouteRequest(rreq: RouteRequest, sender: string): void {
    // Check if we've seen this request before
    if (this.messageCache.has(rreq.messageId)) {
      return;
    }
    this.messageCache.set(rreq.messageId, Date.now());

    // Update reverse route to source
    this.updateRoute(rreq.source, sender, rreq.hopCount + 1, rreq.sequenceNumber);

    // Check if we are the destination
    if (rreq.destination === this.myAddress) {
      // Send RREP back to source
      const rrep: RouteReply = {
        type: 'RREP',
        source: this.myAddress,
        destination: rreq.source,
        sequenceNumber: ++this.sequenceNumber,
        hopCount: 0,
        lifetime: 300000, // 5 minutes
        messageId: this.generateMessageId()
      };
      
      this.sendRouteReply(rrep, sender);
    } else {
      // Check if we have a route to destination
      const route = this.routingTable.get(rreq.destination);
      if (route && this.isRouteValid(route)) {
        // Send RREP on behalf of destination
        const rrep: RouteReply = {
          type: 'RREP',
          source: rreq.destination,
          destination: rreq.source,
          sequenceNumber: route.sequenceNumber,
          hopCount: route.hopCount,
          lifetime: 300000,
          messageId: this.generateMessageId()
        };
        
        this.sendRouteReply(rrep, sender);
      } else {
        // Forward RREQ
        const forwardedRreq = {
          ...rreq,
          hopCount: rreq.hopCount + 1
        };
        
        if (forwardedRreq.hopCount < 10) { // Max 10 hops
          this.broadcastRouteRequest(forwardedRreq);
        }
      }
    }
  }

  handleRouteReply(rrep: RouteReply, sender: string): void {
    // Update route to destination
    this.updateRoute(rrep.source, sender, rrep.hopCount + 1, rrep.sequenceNumber);

    // Check if we are the original requester
    if (rrep.destination !== this.myAddress) {
      // Forward RREP towards destination
      const route = this.routingTable.get(rrep.destination);
      if (route) {
        this.forwardRouteReply(rrep, route.nextHop);
      }
    }
  }

  handleRouteError(rerr: RouteError): void {
    // Remove invalid routes
    for (const dest of rerr.unreachableDestinations) {
      this.routingTable.delete(dest);
    }

    // Propagate RERR to affected neighbors
    const affectedNeighbors = new Set<string>();
    for (const [dest, route] of this.routingTable) {
      if (rerr.unreachableDestinations.includes(route.nextHop)) {
        affectedNeighbors.add(route.nextHop);
        this.routingTable.delete(dest);
      }
    }

    if (affectedNeighbors.size > 0) {
      this.broadcastRouteError(rerr);
    }
  }

  private updateRoute(
    destination: string,
    nextHop: string,
    hopCount: number,
    sequenceNumber: number
  ): void {
    const existingRoute = this.routingTable.get(destination);
    
    // Update if: new route, newer sequence, or better metric
    if (!existingRoute ||
        sequenceNumber > existingRoute.sequenceNumber ||
        (sequenceNumber === existingRoute.sequenceNumber && hopCount < existingRoute.hopCount)) {
      
      this.routingTable.set(destination, {
        destination,
        nextHop,
        metric: hopCount * 100, // Simple hop-based metric
        sequenceNumber,
        lastUpdated: Date.now(),
        linkQuality: 100, // Will be updated based on actual link quality
        hopCount
      });
    }
  }

  private isRouteValid(route: RoutingTableEntry): boolean {
    const age = Date.now() - route.lastUpdated;
    return age < 300000; // 5 minute timeout
  }

  private maintainRoutes(): void {
    // Remove stale routes
    const now = Date.now();
    const staleRoutes: string[] = [];

    for (const [dest, route] of this.routingTable) {
      if (!this.isRouteValid(route)) {
        staleRoutes.push(dest);
      }
    }

    if (staleRoutes.length > 0) {
      for (const dest of staleRoutes) {
        this.routingTable.delete(dest);
      }

      // Send RERR for stale routes
      const rerr: RouteError = {
        type: 'RERR',
        unreachableDestinations: staleRoutes,
        source: this.myAddress
      };
      
      this.broadcastRouteError(rerr);
    }

    // Clean up old message cache
    for (const [id, timestamp] of this.messageCache) {
      if (now - timestamp > 60000) { // 1 minute
        this.messageCache.delete(id);
      }
    }
  }

  private generateMessageId(): string {
    return `${this.myCallsign}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async broadcastRouteRequest(rreq: RouteRequest): Promise<void> {
    // Implementation would broadcast via radio
    console.log('Broadcasting RREQ:', rreq);
  }

  private async sendRouteReply(rrep: RouteReply, nextHop: string): Promise<void> {
    // Implementation would send via radio to specific station
    console.log('Sending RREP to', nextHop, ':', rrep);
  }

  private async forwardRouteReply(rrep: RouteReply, nextHop: string): Promise<void> {
    // Implementation would forward via radio
    console.log('Forwarding RREP to', nextHop, ':', rrep);
  }

  private async broadcastRouteError(rerr: RouteError): Promise<void> {
    // Implementation would broadcast via radio
    console.log('Broadcasting RERR:', rerr);
  }

  getRoutingTable(): RoutingTableEntry[] {
    return Array.from(this.routingTable.values());
  }

  getRouteMetrics(destination: string): any {
    const route = this.routingTable.get(destination);
    if (!route) return null;

    return {
      destination: route.destination,
      nextHop: route.nextHop,
      hopCount: route.hopCount,
      linkQuality: route.linkQuality,
      age: Date.now() - route.lastUpdated,
      metric: route.metric
    };
  }
}

// Main mesh networking class
export class MeshNetwork {
  private nodes: Map<string, MeshNode> = new Map();
  private router: AODVRouter;
  private protocol: HTTPProtocol;
  private radio: RadioControl;
  private myNode: MeshNode;
  private messageQueue: Map<string, MeshPacket[]> = new Map();
  private retryQueue: Map<string, { packet: MeshPacket; retries: number }> = new Map();

  constructor(
    callsign: string,
    protocol: HTTPProtocol,
    radio: RadioControl
  ) {
    this.router = new AODVRouter(callsign);
    this.protocol = protocol;
    this.radio = radio;

    this.myNode = {
      callsign,
      address: this.router['myAddress'],
      lastSeen: Date.now(),
      signalStrength: 0,
      snr: 0,
      hops: 0,
      capabilities: {
        relay: true,
        store: true,
        gateway: false,
        modes: ['HTTP-1000', 'HTTP-4800', 'HTTP-5600', 'HTTP-11200']
      },
      metrics: {
        packetsRelayed: 0,
        packetsDropped: 0,
        bytesTransferred: 0,
        uptime: 0
      }
    };

    // Start periodic tasks
    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Beacon transmission
    setInterval(() => this.sendBeacon(), 60000); // Every minute

    // Process retry queue
    setInterval(() => this.processRetryQueue(), 5000); // Every 5 seconds

    // Update node metrics
    setInterval(() => this.updateNodeMetrics(), 10000); // Every 10 seconds
  }

  async sendPacket(destination: string, packet: HTTPPacket): Promise<boolean> {
    // Find route to destination
    const route = await this.router.discoverRoute(destination);
    if (!route) {
      console.error('No route to destination:', destination);
      return false;
    }

    // Wrap in mesh packet
    const meshPacket: MeshPacket = {
      ...packet,
      routing: {
        source: this.myNode.address,
        destination,
        ttl: 10,
        hopCount: 0,
        messageId: this.generateMessageId(),
        ackRequired: true
      }
    };

    // Send packet via next hop
    return await this.transmitPacket(meshPacket, route.nextHop);
  }

  async relayPacket(packet: MeshPacket): Promise<void> {
    // Check TTL
    if (packet.routing.ttl <= 0) {
      this.myNode.metrics.packetsDropped++;
      return;
    }

    // Decrement TTL and increment hop count
    packet.routing.ttl--;
    packet.routing.hopCount++;

    // Check if we are the destination
    if (packet.routing.destination === this.myNode.address) {
      await this.handleIncomingPacket(packet);
      return;
    }

    // Find next hop
    const route = await this.router.discoverRoute(packet.routing.destination);
    if (!route) {
      // Store and forward if enabled
      if (this.myNode.capabilities.store) {
        this.storePacket(packet);
      } else {
        this.myNode.metrics.packetsDropped++;
      }
      return;
    }

    // Relay packet
    await this.transmitPacket(packet, route.nextHop);
    this.myNode.metrics.packetsRelayed++;
  }

  private async transmitPacket(packet: MeshPacket, nextHop: string): Promise<boolean> {
    try {
      // Set radio frequency for next hop (would need frequency allocation logic)
      // await this.radio.setFrequency(this.getFrequencyForNode(nextHop));

      // Transmit packet
      await this.protocol.sendRequest(
        'MESH',
        `/relay/${nextHop}`,
        {
          'X-Mesh-Source': packet.routing.source,
          'X-Mesh-Destination': packet.routing.destination,
          'X-Mesh-TTL': packet.routing.ttl.toString(),
          'X-Mesh-Hops': packet.routing.hopCount.toString()
        },
        packet
      );

      this.myNode.metrics.bytesTransferred += JSON.stringify(packet).length;
      return true;
    } catch (error) {
      console.error('Failed to transmit packet:', error);
      
      // Add to retry queue
      this.retryQueue.set(packet.routing.messageId, {
        packet,
        retries: 0
      });
      
      return false;
    }
  }

  private async handleIncomingPacket(packet: MeshPacket): Promise<void> {
    // Process packet locally
    console.log('Received packet for local processing:', packet);

    // Send ACK if required
    if (packet.routing.ackRequired) {
      await this.sendAck(packet.routing.source, packet.routing.messageId);
    }

    // Dispatch to application layer
    const event = new CustomEvent('mesh-packet-received', {
      detail: packet
    });
    window.dispatchEvent(event);
  }

  private storePacket(packet: MeshPacket): void {
    const dest = packet.routing.destination;
    if (!this.messageQueue.has(dest)) {
      this.messageQueue.set(dest, []);
    }
    
    this.messageQueue.get(dest)!.push(packet);

    // Limit queue size
    const queue = this.messageQueue.get(dest)!;
    if (queue.length > 10) {
      queue.shift(); // Remove oldest
      this.myNode.metrics.packetsDropped++;
    }
  }

  private async processRetryQueue(): Promise<void> {
    for (const [id, item] of this.retryQueue) {
      if (item.retries >= 3) {
        // Max retries reached
        this.retryQueue.delete(id);
        this.myNode.metrics.packetsDropped++;
        continue;
      }

      // Try to find route again
      const route = await this.router.discoverRoute(item.packet.routing.destination);
      if (route) {
        const success = await this.transmitPacket(item.packet, route.nextHop);
        if (success) {
          this.retryQueue.delete(id);
        } else {
          item.retries++;
        }
      } else {
        item.retries++;
      }
    }
  }

  private async sendBeacon(): Promise<void> {
    const beacon = {
      type: 'BEACON',
      callsign: this.myNode.callsign,
      address: this.myNode.address,
      capabilities: this.myNode.capabilities,
      timestamp: Date.now()
    };

    await this.protocol.sendRequest(
      'BEACON',
      '/mesh/beacon',
      {
        'X-Mesh-Type': 'BEACON'
      },
      beacon
    );
  }

  private async sendAck(destination: string, messageId: string): Promise<void> {
    const ack = {
      type: 'ACK',
      messageId,
      source: this.myNode.address,
      timestamp: Date.now()
    };

    const route = await this.router.discoverRoute(destination);
    if (route) {
      await this.protocol.sendRequest(
        'ACK',
        `/mesh/ack/${destination}`,
        {
          'X-Mesh-Type': 'ACK'
        },
        ack
      );
    }
  }

  private updateNodeMetrics(): void {
    // Update uptime
    this.myNode.metrics.uptime = Date.now();

    // Clean up stale nodes
    const now = Date.now();
    for (const [callsign, node] of this.nodes) {
      if (now - node.lastSeen > 600000) { // 10 minutes
        this.nodes.delete(callsign);
      }
    }

    // Process stored messages for nodes that came online
    for (const [dest, queue] of this.messageQueue) {
      this.router.discoverRoute(dest).then(route => {
        if (route && queue.length > 0) {
          const packet = queue.shift()!;
          this.transmitPacket(packet, route.nextHop);
        }
      });
    }
  }

  private generateMessageId(): string {
    return `${this.myNode.callsign}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // Public API
  getNodes(): MeshNode[] {
    return Array.from(this.nodes.values());
  }

  getMyNode(): MeshNode {
    return this.myNode;
  }

  getRoutingTable(): RoutingTableEntry[] {
    return this.router.getRoutingTable();
  }

  getNetworkStats(): any {
    return {
      nodes: this.nodes.size,
      routes: this.router.getRoutingTable().length,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, q) => sum + q.length, 0),
      retryQueue: this.retryQueue.size,
      metrics: this.myNode.metrics,
      totalNodes: this.nodes.size // Expected by integration tests
    };
  }

  // Method expected by integration tests
  async discoverRoute(destination: string): Promise<RoutingTableEntry | null> {
    return await this.router.discoverRoute(destination);
  }

  setRelayEnabled(enabled: boolean): void {
    this.myNode.capabilities.relay = enabled;
  }

  setStoreEnabled(enabled: boolean): void {
    this.myNode.capabilities.store = enabled;
  }
}