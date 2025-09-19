import { HTTPProtocol, HTTPPacket } from '../http-protocol';
import { RadioControl } from '../radio-control';
import { OFDMModem, type OFDMConfiguration, type TransmissionResult } from '../ofdm-modem';

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
    ofdm: boolean; // OFDM capability
    ofdmCarriers?: number; // Number of OFDM carriers supported
  };
  metrics: {
    packetsRelayed: number;
    packetsDropped: number;
    bytesTransferred: number;
    uptime: number;
    ofdmThroughput?: number; // OFDM throughput in bps
    ofdmErrors?: number; // OFDM transmission errors
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
  transmissionMode: 'QPSK' | 'OFDM' | 'AUTO'; // Preferred transmission mode
  ofdmCapable: boolean; // Whether destination supports OFDM
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
  private activeDiscoveries: Map<string, { timeout: NodeJS.Timeout, interval: NodeJS.Timeout }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private myCallsign: string;
  private myAddress: string;
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_ROUTING_TABLE_SIZE = 500;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(callsign: string) {
    this.myCallsign = callsign;
    this.myAddress = this.generateMeshAddress(callsign);

    // Periodic route table maintenance with cleanup tracking
    this.cleanupInterval = setInterval(() => this.maintainRoutes(), 30000);
  }

  // Cleanup method to prevent memory leaks
  cleanup(): void {
    // Clear all active route discoveries
    for (const [destination, { timeout, interval }] of this.activeDiscoveries) {
      clearTimeout(timeout);
      clearInterval(interval);
    }
    this.activeDiscoveries.clear();

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear caches to prevent memory leaks
    this.messageCache.clear();
    this.pendingRequests.clear();
    this.routingTable.clear();
  }

  // Clean up old entries from message cache
  private cleanupMessageCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [messageId, timestamp] of this.messageCache) {
      if (now - timestamp > this.CACHE_TTL) {
        toDelete.push(messageId);
      }
    }

    toDelete.forEach(messageId => this.messageCache.delete(messageId));

    // Enforce cache size limit
    if (this.messageCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.messageCache.entries());
      entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp
      const toRemove = entries.slice(0, this.messageCache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([messageId]) => this.messageCache.delete(messageId));
    }
  }

  // Clean up routing table to prevent unbounded growth
  private cleanupRoutingTable(): void {
    if (this.routingTable.size > this.MAX_ROUTING_TABLE_SIZE) {
      const entries = Array.from(this.routingTable.entries());
      entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated); // Sort by age
      const toRemove = entries.slice(0, this.routingTable.size - this.MAX_ROUTING_TABLE_SIZE);
      toRemove.forEach(([dest]) => this.routingTable.delete(dest));
    }
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

    // Cache the request to prevent loops (with cleanup)
    this.messageCache.set(rreq.messageId, Date.now());
    this.cleanupMessageCache();

    // Broadcast RREQ
    await this.broadcastRouteRequest(rreq);

    // Wait for RREP with proper cleanup
    return new Promise((resolve) => {
      let isResolved = false;

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve(null);
        }
      }, 10000); // 10 second timeout

      const checkInterval = setInterval(() => {
        if (isResolved) {
          clearInterval(checkInterval);
          return;
        }

        const route = this.routingTable.get(destination);
        if (route) {
          isResolved = true;
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(route);
        }
      }, 100);

      // Store references for cleanup
      if (!this.activeDiscoveries) {
        this.activeDiscoveries = new Map();
      }
      this.activeDiscoveries.set(destination, { timeout, interval: checkInterval });
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
        // Forward RREQ with broadcast storm prevention
        const forwardedRreq = {
          ...rreq,
          hopCount: rreq.hopCount + 1
        };

        // Prevent broadcast storms with stricter limits and delay
        if (forwardedRreq.hopCount < 7) { // Reduced max hops
          // Add random delay to prevent synchronized broadcasts
          const delay = Math.random() * 100 + 50; // 50-150ms delay
          setTimeout(() => {
            this.broadcastRouteRequest(forwardedRreq);
          }, delay);
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
    sequenceNumber: number,
    ofdmCapable: boolean = false
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
        hopCount,
        transmissionMode: ofdmCapable ? 'AUTO' : 'QPSK',
        ofdmCapable
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

      // Send RERR for stale routes (only if we have valid neighbors)
      if (this.routingTable.size > 0) {
        const rerr: RouteError = {
          type: 'RERR',
          unreachableDestinations: staleRoutes,
          source: this.myAddress
        };

        this.broadcastRouteError(rerr);
      }
    }

    // Clean up caches using dedicated methods
    this.cleanupMessageCache();
    this.cleanupRoutingTable();
  }

  private generateMessageId(): string {
    return `${this.myCallsign}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async broadcastRouteRequest(rreq: RouteRequest): Promise<void> {
    // Prevent duplicate broadcasts of the same request
    if (this.messageCache.has(rreq.messageId)) {
      return; // Already processed this request
    }

    // Rate limiting: prevent too many broadcasts in short time
    const recentBroadcasts = Array.from(this.messageCache.values())
      .filter(timestamp => Date.now() - timestamp < 1000); // 1 second window

    if (recentBroadcasts.length > 5) {
      console.log('Rate limiting: too many recent broadcasts');
      return;
    }

    // Implementation would broadcast via radio
    console.log('Broadcasting RREQ:', rreq);

    // Cache this broadcast to prevent loops
    this.messageCache.set(rreq.messageId, Date.now());
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
  private ofdmModem?: OFDMModem;
  private myNode: MeshNode;
  private messageQueue: Map<string, MeshPacket[]> = new Map();
  private retryQueue: Map<string, { packet: MeshPacket; retries: number }> = new Map();
  private ofdmEnabled: boolean = false;

  constructor(
    callsign: string,
    protocol: HTTPProtocol,
    radio: RadioControl,
    ofdmModem?: OFDMModem
  ) {
    this.router = new AODVRouter(callsign);
    this.protocol = protocol;
    this.radio = radio;
    this.ofdmModem = ofdmModem;
    this.ofdmEnabled = !!ofdmModem;

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
        modes: this.ofdmEnabled
          ? ['HTTP-1000', 'HTTP-4800', 'HTTP-5600', 'HTTP-11200', 'OFDM-100K', 'OFDM-200K']
          : ['HTTP-1000', 'HTTP-4800', 'HTTP-5600', 'HTTP-11200'],
        ofdm: this.ofdmEnabled,
        ofdmCarriers: this.ofdmModem?.getCarrierCount()
      },
      metrics: {
        packetsRelayed: 0,
        packetsDropped: 0,
        bytesTransferred: 0,
        uptime: 0,
        ofdmThroughput: 0,
        ofdmErrors: 0
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
      const route = this.router.getRoutingTable().find(r => r.nextHop === nextHop);
      const useOFDM = this.shouldUseOFDM(route);

      if (useOFDM && this.ofdmModem) {
        return await this.transmitViaOFDM(packet, nextHop);
      } else {
        return await this.transmitViaQPSK(packet, nextHop);
      }
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

  /**
   * Transmit packet using OFDM for high throughput
   */
  private async transmitViaOFDM(packet: MeshPacket, nextHop: string): Promise<boolean> {
    if (!this.ofdmModem) return false;

    try {
      const packetData = new TextEncoder().encode(JSON.stringify(packet));

      // Use OFDM for high-speed transmission
      const result = await this.ofdmModem.transmit(packetData);

      if (result.success) {
        this.myNode.metrics.bytesTransferred += packetData.length;

        // Update OFDM metrics
        if (this.myNode.metrics.ofdmThroughput !== undefined) {
          this.myNode.metrics.ofdmThroughput = result.throughput;
        }

        console.log(`OFDM transmission successful: ${result.throughput} bps, SNR: ${result.averageSNR.toFixed(1)} dB`);
        return true;
      } else {
        if (this.myNode.metrics.ofdmErrors !== undefined) {
          this.myNode.metrics.ofdmErrors++;
        }

        // Fallback to QPSK if OFDM fails
        console.log('OFDM transmission failed, falling back to QPSK');
        return await this.transmitViaQPSK(packet, nextHop);
      }
    } catch (error) {
      console.error('OFDM transmission error:', error);

      // Fallback to QPSK
      return await this.transmitViaQPSK(packet, nextHop);
    }
  }

  /**
   * Transmit packet using traditional QPSK
   */
  private async transmitViaQPSK(packet: MeshPacket, nextHop: string): Promise<boolean> {
    try {
      // Set radio frequency for next hop (would need frequency allocation logic)
      // await this.radio.setFrequency(this.getFrequencyForNode(nextHop));

      // Transmit packet via HTTP protocol
      await this.protocol.sendRequest(
        'MESH',
        `/relay/${nextHop}`,
        {
          'X-Mesh-Source': packet.routing.source,
          'X-Mesh-Destination': packet.routing.destination,
          'X-Mesh-TTL': packet.routing.ttl.toString(),
          'X-Mesh-Hops': packet.routing.hopCount.toString(),
          'X-Mesh-Mode': 'QPSK'
        },
        packet
      );

      this.myNode.metrics.bytesTransferred += JSON.stringify(packet).length;
      return true;
    } catch (error) {
      console.error('QPSK transmission error:', error);
      return false;
    }
  }

  /**
   * Determine whether to use OFDM based on route capabilities and conditions
   */
  private shouldUseOFDM(route?: RoutingTableEntry): boolean {
    if (!this.ofdmEnabled || !this.ofdmModem) {
      return false;
    }

    // Use OFDM if:
    // 1. Route indicates OFDM capability
    // 2. Link quality is good enough (>70%)
    // 3. SNR is sufficient for OFDM operation
    if (route) {
      return route.ofdmCapable &&
             route.linkQuality > 70 &&
             route.transmissionMode !== 'QPSK';
    }

    // Default to OFDM if conditions are good
    return this.myNode.snr > 15; // Minimum SNR for OFDM
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
      ofdmConfig: this.ofdmModem ? {
        carriers: this.ofdmModem.getCarrierCount(),
        bandwidth: this.ofdmModem.getBandwidth(),
        dataRate: this.ofdmModem.getConfiguration().dataRate
      } : null,
      timestamp: Date.now()
    };

    if (this.ofdmEnabled && this.ofdmModem) {
      // Send beacon via OFDM for better propagation
      try {
        const beaconData = new TextEncoder().encode(JSON.stringify(beacon));
        await this.ofdmModem.transmit(beaconData);
      } catch (error) {
        // Fallback to HTTP protocol
        await this.sendBeaconViaHTTP(beacon);
      }
    } else {
      await this.sendBeaconViaHTTP(beacon);
    }
  }

  private async sendBeaconViaHTTP(beacon: any): Promise<void> {
    await this.protocol.sendRequest(
      'BEACON',
      '/mesh/beacon',
      {
        'X-Mesh-Type': 'BEACON',
        'X-Mesh-OFDM': this.ofdmEnabled.toString()
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
    const ofdmStats = this.ofdmModem ? this.ofdmModem.getStatistics() : null;

    return {
      nodes: this.nodes.size,
      routes: this.router.getRoutingTable().length,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, q) => sum + q.length, 0),
      retryQueue: this.retryQueue.size,
      metrics: this.myNode.metrics,
      totalNodes: this.nodes.size, // Expected by integration tests
      ofdm: {
        enabled: this.ofdmEnabled,
        carriers: this.ofdmModem?.getCarrierCount() || 0,
        bandwidth: this.ofdmModem?.getBandwidth() || 0,
        stats: ofdmStats,
        ofdmCapableRoutes: this.router.getRoutingTable().filter(r => r.ofdmCapable).length
      }
    };
  }

  /**
   * Get OFDM-specific network information
   */
  getOFDMNetworkInfo(): {
    enabled: boolean;
    modemConfig?: OFDMConfiguration;
    ofdmNodes: number;
    averageOFDMThroughput: number;
    totalOFDMErrors: number;
  } {
    const ofdmNodes = Array.from(this.nodes.values()).filter(n => n.capabilities.ofdm).length;
    const ofdmThroughputs = Array.from(this.nodes.values())
      .map(n => n.metrics.ofdmThroughput || 0)
      .filter(t => t > 0);

    const averageThroughput = ofdmThroughputs.length > 0
      ? ofdmThroughputs.reduce((sum, t) => sum + t, 0) / ofdmThroughputs.length
      : 0;

    const totalErrors = Array.from(this.nodes.values())
      .reduce((sum, n) => sum + (n.metrics.ofdmErrors || 0), 0);

    return {
      enabled: this.ofdmEnabled,
      modemConfig: this.ofdmModem?.getConfiguration(),
      ofdmNodes,
      averageOFDMThroughput: averageThroughput,
      totalOFDMErrors: totalErrors
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