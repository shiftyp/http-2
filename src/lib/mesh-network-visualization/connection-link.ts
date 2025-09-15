import {
  ConnectionLink,
  NodeId,
  ConnectionType,
  Protocol,
  RFCharacteristics,
  PropagationConditions,
  Timestamp,
  RFBand,
  PowerLevel,
  SignalStrength,
  SNR
} from './types';

export class ConnectionLinkManager {
  private links = new Map<string, ConnectionLink>();
  private linkIdCounter = 0;

  establishLink(
    sourceNodeId: NodeId,
    destinationNodeId: NodeId,
    connectionType: ConnectionType,
    protocol: Protocol,
    rfCharacteristics: RFCharacteristics,
    propagation: PropagationConditions
  ): ConnectionLink {
    const id = this.generateLinkId(sourceNodeId, destinationNodeId);

    const link: ConnectionLink = {
      id,
      sourceNodeId,
      destinationNodeId,
      connectionType,
      protocol,
      rfCharacteristics,
      propagation,
      quality: this.calculateLinkQuality(rfCharacteristics, propagation),
      established: Date.now(),
      lastActive: Date.now(),
      isActive: true,
      metrics: {
        throughput: 0,
        packetsSent: 0,
        packetsReceived: 0,
        errors: 0
      }
    };

    this.links.set(id, link);
    return link;
  }

  updateLink(linkId: string, updates: Partial<ConnectionLink>): ConnectionLink | null {
    const link = this.links.get(linkId);
    if (!link) return null;

    const updatedLink = { ...link, ...updates, lastActive: Date.now() };
    this.links.set(linkId, updatedLink);
    return updatedLink;
  }

  updateLinkQuality(linkId: string, rfCharacteristics: RFCharacteristics, propagation: PropagationConditions): boolean {
    const link = this.links.get(linkId);
    if (!link) return false;

    link.rfCharacteristics = rfCharacteristics;
    link.propagation = propagation;
    link.quality = this.calculateLinkQuality(rfCharacteristics, propagation);
    link.lastActive = Date.now();

    this.links.set(linkId, link);
    return true;
  }

  updateLinkMetrics(linkId: string, metrics: Partial<ConnectionLink['metrics']>): boolean {
    const link = this.links.get(linkId);
    if (!link) return false;

    link.metrics = { ...link.metrics, ...metrics };
    link.lastActive = Date.now();

    if (metrics.throughput !== undefined) {
      link.isActive = metrics.throughput > 0;
    }

    this.links.set(linkId, link);
    return true;
  }

  setLinkActive(linkId: string, isActive: boolean): boolean {
    const link = this.links.get(linkId);
    if (!link) return false;

    link.isActive = isActive;
    if (isActive) {
      link.lastActive = Date.now();
    }

    this.links.set(linkId, link);
    return true;
  }

  getLink(linkId: string): ConnectionLink | null {
    return this.links.get(linkId) || null;
  }

  getAllLinks(): ConnectionLink[] {
    return Array.from(this.links.values());
  }

  getActiveLinks(): ConnectionLink[] {
    return this.getAllLinks().filter(link => link.isActive);
  }

  getLinksByNode(nodeId: NodeId): ConnectionLink[] {
    return this.getAllLinks().filter(link =>
      link.sourceNodeId === nodeId || link.destinationNodeId === nodeId
    );
  }

  getLinksBetweenNodes(nodeId1: NodeId, nodeId2: NodeId): ConnectionLink[] {
    return this.getAllLinks().filter(link =>
      (link.sourceNodeId === nodeId1 && link.destinationNodeId === nodeId2) ||
      (link.sourceNodeId === nodeId2 && link.destinationNodeId === nodeId1)
    );
  }

  getLinksByProtocol(protocol: Protocol): ConnectionLink[] {
    return this.getAllLinks().filter(link => link.protocol === protocol);
  }

  getLinksByConnectionType(connectionType: ConnectionType): ConnectionLink[] {
    return this.getAllLinks().filter(link => link.connectionType === connectionType);
  }

  removeLink(linkId: string): boolean {
    return this.links.delete(linkId);
  }

  removeLinksForNode(nodeId: NodeId): string[] {
    const removedLinkIds: string[] = [];

    for (const [linkId, link] of this.links) {
      if (link.sourceNodeId === nodeId || link.destinationNodeId === nodeId) {
        this.links.delete(linkId);
        removedLinkIds.push(linkId);
      }
    }

    return removedLinkIds;
  }

  calculatePathLoss(distance: number, frequency: number, environment: 'urban' | 'suburban' | 'rural' = 'rural'): number {
    const environmentFactors = {
      urban: { a: 3.2, b: 11.75, c: 4.97 },
      suburban: { a: 2.8, b: 11.75, c: 4.97 },
      rural: { a: 2.0, b: 11.75, c: 4.97 }
    };

    const factor = environmentFactors[environment];
    const logFreq = Math.log10(frequency / 1000000);
    const logDist = Math.log10(distance);

    return 20 * logFreq + factor.a * 10 * logDist + factor.b * logDist - factor.c;
  }

  calculateFresnel(distance: number, frequency: number): number {
    const c = 299792458;
    const wavelength = c / (frequency * 1000000);
    return Math.sqrt((distance * 1000 * wavelength) / 4);
  }

  estimatePropagationReliability(
    distance: number,
    frequency: number,
    snr: SNR,
    band: RFBand
  ): number {
    const pathLoss = this.calculatePathLoss(distance, frequency);
    const snrMargin = snr - 10;

    let bandFactor = 1.0;
    switch (band) {
      case 'HF':
        bandFactor = distance > 500 ? 0.7 : 0.9;
        break;
      case 'VHF':
        bandFactor = distance > 150 ? 0.5 : 0.95;
        break;
      case 'UHF':
        bandFactor = distance > 50 ? 0.3 : 0.9;
        break;
    }

    const pathReliability = Math.max(0, Math.min(1, 1 - (pathLoss / 200)));
    const snrReliability = Math.max(0, Math.min(1, snrMargin / 20));

    return pathReliability * snrReliability * bandFactor;
  }

  getOptimalFrequency(distance: number, band: RFBand): number {
    const frequencyRanges = {
      HF: { min: 3000000, max: 30000000 },
      VHF: { min: 30000000, max: 300000000 },
      UHF: { min: 300000000, max: 3000000000 }
    };

    const range = frequencyRanges[band];

    if (band === 'HF') {
      if (distance > 1000) return 14000000;
      if (distance > 500) return 21000000;
      return 28000000;
    }

    return range.min + (range.max - range.min) * 0.3;
  }

  cleanupStaleLinks(maxAgeMs: number = 300000): string[] {
    const now = Date.now();
    const staleLinkIds: string[] = [];

    for (const [linkId, link] of this.links) {
      if (now - link.lastActive > maxAgeMs) {
        staleLinkIds.push(linkId);
        this.links.delete(linkId);
      }
    }

    return staleLinkIds;
  }

  getLinkStatistics() {
    const links = this.getAllLinks();
    const activeCount = links.filter(l => l.isActive).length;
    const rfCount = links.filter(l => l.connectionType === 'rf').length;
    const internetCount = links.filter(l => l.connectionType === 'internet').length;

    const totalThroughput = links.reduce((sum, l) => sum + l.metrics.throughput, 0);
    const totalPackets = links.reduce((sum, l) => sum + l.metrics.packetsSent + l.metrics.packetsReceived, 0);
    const totalErrors = links.reduce((sum, l) => sum + l.metrics.errors, 0);

    const averageQuality = links.length > 0 ?
      links.reduce((sum, l) => sum + l.quality, 0) / links.length : 0;

    return {
      totalLinks: links.length,
      activeLinks: activeCount,
      rfLinks: rfCount,
      internetLinks: internetCount,
      totalThroughput,
      totalPackets,
      totalErrors,
      averageQuality,
      errorRate: totalPackets > 0 ? totalErrors / totalPackets : 0
    };
  }

  private calculateLinkQuality(rf: RFCharacteristics, propagation: PropagationConditions): number {
    const snrFactor = Math.max(0, Math.min(1, (rf.snr + 10) / 40));
    const signalFactor = Math.max(0, Math.min(1, (rf.signalStrength + 100) / 60));

    const pathLossFactor = Math.max(0, Math.min(1, 1 - (propagation.pathLoss / 200)));
    const distanceFactor = Math.max(0, Math.min(1, 1 - (propagation.distance / 1000)));

    const fadingPenalty = propagation.multipath ? 0.8 : 1.0;
    const noisePenalty = Math.max(0.5, 1 - (propagation.atmosphericNoise / 20));

    return (snrFactor * 0.3 + signalFactor * 0.3 + pathLossFactor * 0.2 + distanceFactor * 0.2) *
           fadingPenalty * noisePenalty;
  }

  private generateLinkId(sourceNodeId: NodeId, destinationNodeId: NodeId): string {
    return `link-${sourceNodeId}-${destinationNodeId}-${++this.linkIdCounter}`;
  }
}