import { MeshNetwork, MeshNode, RoutingTableEntry } from '../mesh-networking';
import { MeshNetworkVisualizer } from './mesh-visualizer';
import {
  StationNode,
  ConnectionLink,
  TrafficFlow,
  NodeId,
  CallSign,
  GPSCoordinates,
  StationEquipment,
  RFCharacteristics,
  PropagationConditions
} from './types';

export class MeshVisualizationIntegration {
  private meshNetwork: MeshNetwork;
  private visualizer: MeshNetworkVisualizer;
  private nodeMapping = new Map<string, NodeId>();
  private updateInterval: number | null = null;
  private isActive = false;

  constructor(meshNetwork: MeshNetwork, visualizer: MeshNetworkVisualizer) {
    this.meshNetwork = meshNetwork;
    this.visualizer = visualizer;

    this.setupEventListeners();
  }

  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.syncInitialState();

    this.updateInterval = window.setInterval(() => {
      this.syncNetworkState();
    }, 5000);
  }

  stop(): void {
    this.isActive = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private syncInitialState(): void {
    const myNode = this.meshNetwork.getMyNode();
    this.addOrUpdateNode(myNode);

    const otherNodes = this.meshNetwork.getNodes();
    for (const node of otherNodes) {
      this.addOrUpdateNode(node);
    }

    const routingTable = this.meshNetwork.getRoutingTable();
    this.updateConnections(routingTable);
  }

  private syncNetworkState(): void {
    if (!this.isActive) return;

    try {
      const myNode = this.meshNetwork.getMyNode();
      this.addOrUpdateNode(myNode);

      const nodes = this.meshNetwork.getNodes();
      const activeCallsigns = new Set<string>();

      for (const node of nodes) {
        activeCallsigns.add(node.callsign);
        this.addOrUpdateNode(node);
      }

      activeCallsigns.add(myNode.callsign);

      this.cleanupStaleNodes(activeCallsigns);

      const routingTable = this.meshNetwork.getRoutingTable();
      this.updateConnections(routingTable);

      const networkStats = this.meshNetwork.getNetworkStats();
      this.updateNetworkHealth(networkStats);
    } catch (error) {
      console.error('Error syncing network state:', error);
    }
  }

  private addOrUpdateNode(meshNode: MeshNode): void {
    const existingNodeId = this.nodeMapping.get(meshNode.callsign);

    if (existingNodeId) {
      const updates = this.convertMeshNodeToUpdates(meshNode);
      this.visualizer.updateStation(existingNodeId, updates);
    } else {
      const visualNode = this.convertMeshNodeToStationNode(meshNode);
      const nodeId = this.visualizer.addStation(
        visualNode.callsign,
        visualNode.coordinates,
        visualNode.equipment,
        visualNode.rfCharacteristics
      );

      this.nodeMapping.set(meshNode.callsign, nodeId);

      this.visualizer.updateStation(nodeId, {
        capabilities: visualNode.capabilities,
        metrics: visualNode.metrics,
        status: visualNode.status
      });
    }
  }

  private convertMeshNodeToStationNode(meshNode: MeshNode): StationNode {
    const coordinates: GPSCoordinates = this.estimateCoordinatesFromAddress(meshNode.address);

    const equipment: StationEquipment = {
      manufacturer: 'Unknown',
      model: 'Mesh Node',
      power: 100,
      antenna: 'Unknown',
      bands: this.determineBandsFromModes(meshNode.capabilities.modes),
      modes: meshNode.capabilities.modes.map(mode => this.convertModeToProtocol(mode))
    };

    const rfCharacteristics: RFCharacteristics = {
      frequency: this.estimateFrequencyFromSnr(meshNode.snr),
      band: this.determineBandFromHops(meshNode.hops),
      power: 100,
      signalStrength: meshNode.signalStrength,
      snr: meshNode.snr,
      noiseFloor: -120,
      bandwidth: 2800,
      modulation: 'QPSK'
    };

    return {
      id: `mesh-${meshNode.callsign.toLowerCase()}`,
      callsign: meshNode.callsign,
      status: this.determineNodeStatus(meshNode),
      coordinates,
      equipment,
      rfCharacteristics,
      lastSeen: meshNode.lastSeen,
      capabilities: {
        relay: meshNode.capabilities.relay,
        store: meshNode.capabilities.store,
        gateway: meshNode.capabilities.gateway,
        modes: equipment.modes
      },
      metrics: {
        packetsRelayed: meshNode.metrics.packetsRelayed,
        packetsDropped: meshNode.metrics.packetsDropped,
        bytesTransferred: meshNode.metrics.bytesTransferred,
        uptime: meshNode.metrics.uptime
      }
    };
  }

  private convertMeshNodeToUpdates(meshNode: MeshNode): Partial<StationNode> {
    return {
      status: this.determineNodeStatus(meshNode),
      lastSeen: meshNode.lastSeen,
      rfCharacteristics: {
        frequency: this.estimateFrequencyFromSnr(meshNode.snr),
        band: this.determineBandFromHops(meshNode.hops),
        power: 100,
        signalStrength: meshNode.signalStrength,
        snr: meshNode.snr,
        noiseFloor: -120,
        bandwidth: 2800,
        modulation: 'QPSK'
      },
      metrics: {
        packetsRelayed: meshNode.metrics.packetsRelayed,
        packetsDropped: meshNode.metrics.packetsDropped,
        bytesTransferred: meshNode.metrics.bytesTransferred,
        uptime: meshNode.metrics.uptime
      }
    };
  }

  private updateConnections(routingTable: RoutingTableEntry[]): void {
    const activeLinks = new Set<string>();

    for (const route of routingTable) {
      const sourceNodeId = this.nodeMapping.get(this.getMyCallsign());
      const destCallsign = this.extractCallsignFromAddress(route.destination);
      const destinationNodeId = this.nodeMapping.get(destCallsign);

      if (!sourceNodeId || !destinationNodeId) continue;

      const linkId = this.generateLinkId(sourceNodeId, destinationNodeId);
      activeLinks.add(linkId);

      const existingLink = this.visualizer.getConnection(linkId);

      if (!existingLink) {
        const propagation: PropagationConditions = {
          distance: route.hopCount * 50,
          azimuth: Math.random() * 360,
          pathLoss: this.calculatePathLossFromMetric(route.metric),
          fadingMargin: 10,
          multipath: route.hopCount > 1,
          atmosphericNoise: Math.max(0, 20 - route.linkQuality / 5)
        };

        const rfCharacteristics: RFCharacteristics = {
          frequency: 14230000,
          band: 'HF',
          power: 100,
          signalStrength: -60 - (route.metric / 10),
          snr: route.linkQuality / 5,
          noiseFloor: -120,
          bandwidth: 2800,
          modulation: 'QPSK'
        };

        try {
          this.visualizer.establishConnection(
            sourceNodeId,
            destinationNodeId,
            'rf',
            'HTTP-QPSK',
            rfCharacteristics,
            propagation
          );
        } catch (error) {
          console.warn(`Failed to establish connection ${linkId}:`, error);
        }
      } else {
        this.visualizer.updateConnection(linkId, {
          quality: route.linkQuality / 100,
          lastActive: Date.now(),
          isActive: Date.now() - route.lastUpdated < 60000,
          metrics: {
            ...existingLink.metrics,
            throughput: this.estimateThroughputFromQuality(route.linkQuality)
          }
        });
      }
    }

    this.cleanupStaleLinks(activeLinks);
  }

  private cleanupStaleNodes(activeCallsigns: Set<string>): void {
    for (const [callsign, nodeId] of this.nodeMapping) {
      if (!activeCallsigns.has(callsign)) {
        this.visualizer.removeStation(nodeId);
        this.nodeMapping.delete(callsign);
      }
    }
  }

  private cleanupStaleLinks(activeLinks: Set<string>): void {
    const topology = this.visualizer.getTopology();

    for (const [linkId, link] of topology.links) {
      if (!activeLinks.has(linkId) && Date.now() - link.lastActive > 120000) {
        this.visualizer.removeConnection(linkId);
      }
    }
  }

  private updateNetworkHealth(networkStats: any): void {
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('mesh-packet-received', (event: any) => {
        this.handleMeshPacketReceived(event.detail);
      });
    }
  }

  private handleMeshPacketReceived(packet: any): void {
    if (!this.isActive) return;

    const sourceCallsign = this.extractCallsignFromAddress(packet.routing?.source || '');
    const destCallsign = this.extractCallsignFromAddress(packet.routing?.destination || '');

    const sourceNodeId = this.nodeMapping.get(sourceCallsign);
    const destNodeId = this.nodeMapping.get(destCallsign);

    if (!sourceNodeId || !destNodeId) return;

    const traffic: TrafficFlow = {
      id: `traffic-${packet.routing?.messageId || Date.now()}`,
      routeId: `route-${sourceNodeId}-${destNodeId}`,
      source: sourceNodeId,
      destination: destNodeId,
      direction: 'sourceToDestination',
      priority: this.determinePriorityFromPacket(packet),
      startTime: Date.now(),
      bytesTransmitted: JSON.stringify(packet).length,
      packetsTransmitted: 1,
      currentThroughput: this.estimatePacketThroughput(packet),
      isActive: true
    };

    this.visualizer.addTrafficFlow(traffic);

    setTimeout(() => {
      this.visualizer.endTrafficFlow(traffic.id);
    }, 3000);
  }

  private estimateCoordinatesFromAddress(address: string): GPSCoordinates {
    const hash = this.simpleHash(address);

    return {
      latitude: 40.0 + ((hash % 1000) / 1000) * 10,
      longitude: -75.0 + (((hash >> 10) % 1000) / 1000) * 10,
      altitude: 0,
      accuracy: 1000
    };
  }

  private determineBandsFromModes(modes: string[]): ('HF' | 'VHF' | 'UHF')[] {
    const bands: ('HF' | 'VHF' | 'UHF')[] = [];

    for (const mode of modes) {
      if (mode.includes('HF') || mode.includes('HTTP')) {
        bands.push('HF');
      } else if (mode.includes('VHF')) {
        bands.push('VHF');
      } else if (mode.includes('UHF')) {
        bands.push('UHF');
      }
    }

    return bands.length > 0 ? bands : ['HF'];
  }

  private convertModeToProtocol(mode: string): 'VARA' | 'Winlink' | 'PacketRadio' | 'HTTP-QPSK' {
    if (mode.includes('HTTP')) return 'HTTP-QPSK';
    if (mode.includes('VARA')) return 'VARA';
    if (mode.includes('Winlink')) return 'Winlink';
    return 'PacketRadio';
  }

  private determineNodeStatus(meshNode: MeshNode): 'active' | 'inactive' | 'unreachable' {
    const age = Date.now() - meshNode.lastSeen;

    if (age < 60000) return 'active';
    if (age < 300000) return 'inactive';
    return 'unreachable';
  }

  private estimateFrequencyFromSnr(snr: number): number {
    if (snr > 20) return 28000000;
    if (snr > 10) return 21000000;
    return 14230000;
  }

  private determineBandFromHops(hops: number): 'HF' | 'VHF' | 'UHF' {
    if (hops > 3) return 'HF';
    if (hops > 1) return 'VHF';
    return 'UHF';
  }

  private extractCallsignFromAddress(address: string): string {
    const parts = address.split('-');
    return parts[0] || 'UNKNOWN';
  }

  private getMyCallsign(): string {
    const myNode = this.meshNetwork.getMyNode();
    return myNode.callsign;
  }

  private generateLinkId(sourceNodeId: NodeId, destinationNodeId: NodeId): string {
    const sorted = [sourceNodeId, destinationNodeId].sort();
    return `link-${sorted[0]}-${sorted[1]}`;
  }

  private calculatePathLossFromMetric(metric: number): number {
    return Math.min(150, metric * 0.5);
  }

  private estimateThroughputFromQuality(linkQuality: number): number {
    return Math.max(100, linkQuality * 50);
  }

  private determinePriorityFromPacket(packet: any): 'low' | 'normal' | 'high' | 'emergency' {
    if (packet.headers && packet.headers['X-Priority']) {
      const priority = packet.headers['X-Priority'].toLowerCase();
      if (['emergency', 'urgent'].includes(priority)) return 'emergency';
      if (['high', 'important'].includes(priority)) return 'high';
      if (['low', 'bulk'].includes(priority)) return 'low';
    }
    return 'normal';
  }

  private estimatePacketThroughput(packet: any): number {
    const size = JSON.stringify(packet).length;
    return Math.max(100, size * 8);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}