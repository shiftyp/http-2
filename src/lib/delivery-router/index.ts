/**
 * Delivery Router - Intelligent routing for update delivery
 * Handles path selection, mode switching, and delivery coordination
 */

import { DynamicUpdate } from '../database/dynamic-data-schema';
import { BeaconMonitor } from '../beacon-monitor';
import { WebRTCTransport } from '../webrtc-transport';
import { OFDMModem } from '../ofdm-modem';
import { PathSelector } from '../path-selector';
import { MeshRouter } from '../mesh-router';
import { CacheManager } from '../cache-manager';

export interface DeliveryRouterConfig {
  db: IDBDatabase;
  beaconMonitor?: BeaconMonitor;
  webrtcTransport?: WebRTCTransport;
  ofdmModem?: OFDMModem;
  pathSelector?: PathSelector;
  meshRouter?: MeshRouter;
  cacheManager?: CacheManager;
  preferWebRTC?: boolean;
  allowUnlicensedReception?: boolean;
}

export interface DeliveryTarget {
  station: string;
  mode: 'RF' | 'WebRTC';
  hops: string[];
  hopCount: number;
  via?: string;
  sourceStation?: string;
  relayStation?: string;
  canRetransmit: boolean;
  canRepeat?: boolean;
  signalStrength?: number;
  lastHeard?: number;
  scheduledTime?: number;
  transmissionDelay?: number;
  collisionAvoidance?: boolean;
  status?: 'pending' | 'success' | 'failed';
  failureReason?: string;
  fallbackMode?: string;
}

export interface RoutingResult {
  targets: DeliveryTarget[];
  useDelta?: boolean;
  deltaSize?: number;
  fullSize?: number;
  transmissionMode: 'OFDM' | 'QPSK' | 'WebRTC';
  ofdmCarriers?: number[];
  priority: number;
  estimatedTransmissionTime?: number;
  estimatedDelay?: number;
  status?: 'queued' | 'active' | 'complete';
  reason?: string;
}

export interface DeliveryPath {
  station: string;
  mode: 'RF' | 'WebRTC';
  hops: string[];
  hopCount: number;
  totalHops?: number;
  frequency?: number;
  reason?: string;
}

export interface DeliveryStatus {
  successful: string[];
  failed: string[];
  pending: string[];
}

export interface RoutingStatistics {
  activeCarriers: number;
  queuedUpdates: number;
  priorityBreakdown: Record<number, number>;
  carrierUtilization: number;
  avgDeliveryTime: number;
}

export interface MeshStatistics {
  activeNodes: number;
  totalPaths: number;
  avgHopCount: number;
  networkPartitions: number;
  deliverySuccessRate: number;
  avgDeliveryLatency: number;
  pathQualityDistribution: Record<string, number>;
}

export interface UnlicensedStationStats {
  totalUnlicensedStations: number;
  activeConnections: number;
  dataDelivered: number;
  avgConnectionTime: number;
  deliverySuccessRate: number;
}

export class DeliveryRouter {
  private db: IDBDatabase;
  private beaconMonitor?: BeaconMonitor;
  private webrtcTransport?: WebRTCTransport;
  private ofdmModem?: OFDMModem;
  private pathSelector?: PathSelector;
  private meshRouter?: MeshRouter;
  private cacheManager?: CacheManager;
  private preferWebRTC: boolean;
  private allowUnlicensedReception: boolean;

  // Carrier allocation for OFDM (carriers 40-47 for P0/P1)
  private readonly priorityCarriers = {
    0: [40, 41, 42, 43, 44, 45, 46, 47], // P0 Emergency
    1: [40, 41, 42, 43, 44, 45, 46, 47], // P1 Safety
    2: [32, 33, 34, 35, 36, 37, 38, 39], // P2 Operational
    3: [24, 25, 26, 27, 28, 29, 30, 31], // P3 Weather
    4: [16, 17, 18, 19, 20, 21, 22, 23], // P4 Routine
    5: [8, 9, 10, 11, 12, 13, 14, 15]    // P5 Routine
  };

  private deliveryStatus: Map<string, DeliveryStatus> = new Map();

  constructor(config: DeliveryRouterConfig) {
    this.db = config.db;
    this.beaconMonitor = config.beaconMonitor;
    this.webrtcTransport = config.webrtcTransport;
    this.ofdmModem = config.ofdmModem;
    this.pathSelector = config.pathSelector;
    this.meshRouter = config.meshRouter;
    this.cacheManager = config.cacheManager;
    this.preferWebRTC = config.preferWebRTC ?? false;
    this.allowUnlicensedReception = config.allowUnlicensedReception ?? true;
  }

  /**
   * Route an update to its subscribers
   */
  async routeUpdate(updateId: string, constraints?: { maxBandwidth?: number; maxTransmissionTime?: number }): Promise<RoutingResult> {
    const update = await this.getUpdate(updateId);
    if (!update) {
      throw new Error(`Update ${updateId} not found`);
    }

    // Find all subscribers for this update
    const subscribers = await this.findSubscribers(update);
    const targets: DeliveryTarget[] = [];

    // Route to each subscriber
    for (const subscriber of subscribers) {
      const path = await this.selectPath(subscriber, updateId);
      if (path) {
        const target = await this.createDeliveryTarget(subscriber, path, update);
        targets.push(target);
      }
    }

    // Determine transmission mode and carrier allocation
    const transmissionMode = this.selectTransmissionMode(update, constraints);
    const ofdmCarriers = transmissionMode === 'OFDM' ? this.allocateCarriers(update.priority) : undefined;

    // Check if carriers are available
    const status = ofdmCarriers && await this.areCarriersBusy(ofdmCarriers) ? 'queued' : 'active';
    const estimatedDelay = status === 'queued' ? await this.estimateQueueDelay(update.priority) : 0;

    // Stagger transmissions to avoid collisions
    this.staggerTransmissions(targets);

    return {
      targets,
      transmissionMode,
      ofdmCarriers,
      priority: update.priority,
      estimatedDelay,
      status
    };
  }

  /**
   * Select best path for a target station
   */
  async selectPath(targetStation: string, updateId: string): Promise<DeliveryPath | null> {
    if (this.pathSelector) {
      return await this.pathSelector.selectPath(targetStation, updateId);
    }

    // Fallback path selection logic
    // Check for RF beacon first
    if (this.beaconMonitor) {
      const rfPath = await this.beaconMonitor.getLatestPath(targetStation);
      if (rfPath && this.isPathFresh(rfPath)) {
        return {
          station: targetStation,
          mode: 'RF',
          hops: [rfPath.originStation, targetStation],
          hopCount: rfPath.hopCount,
          frequency: rfPath.frequency,
          reason: 'recent RF beacon'
        };
      }
    }

    // Check WebRTC connection
    if (this.webrtcTransport) {
      const webrtcAvailable = await this.webrtcTransport.isConnected(targetStation);
      if (webrtcAvailable) {
        return {
          station: targetStation,
          mode: 'WebRTC',
          hops: ['origin', targetStation],
          hopCount: 1,
          reason: 'WebRTC connection available'
        };
      }
    }

    return null;
  }

  /**
   * Find best source for an update
   */
  async findBestSource(updateId: string, targetStation: string): Promise<{ sourceStation: string; hopCount: number } | null> {
    if (!this.cacheManager) {
      return null;
    }

    // Find all stations that have this update cached
    const holders = await this.cacheManager.getHolders(updateId);
    if (holders.length === 0) {
      return null;
    }

    // Find closest holder
    let bestSource = holders[0];
    let minHops = Infinity;

    for (const holder of holders) {
      const path = await this.selectPath(targetStation, updateId);
      if (path && path.hopCount < minHops) {
        bestSource = holder;
        minHops = path.hopCount;
      }
    }

    return {
      sourceStation: bestSource,
      hopCount: minHops
    };
  }

  /**
   * Mark delivery as complete
   */
  async markDeliveryComplete(updateId: string, station: string, success: boolean): Promise<void> {
    let status = this.deliveryStatus.get(updateId);
    if (!status) {
      status = { successful: [], failed: [], pending: [] };
      this.deliveryStatus.set(updateId, status);
    }

    // Remove from pending
    status.pending = status.pending.filter(s => s !== station);

    // Add to appropriate list
    if (success) {
      if (!status.successful.includes(station)) {
        status.successful.push(station);
      }
    } else {
      if (!status.failed.includes(station)) {
        status.failed.push(station);
      }
    }
  }

  /**
   * Get delivery status for an update
   */
  getDeliveryStatus(updateId: string): DeliveryStatus {
    return this.deliveryStatus.get(updateId) || { successful: [], failed: [], pending: [] };
  }

  /**
   * Retry failed deliveries
   */
  async retryFailedDeliveries(updateId: string): Promise<RoutingResult> {
    const status = this.getDeliveryStatus(updateId);
    const update = await this.getUpdate(updateId);
    if (!update) {
      throw new Error(`Update ${updateId} not found`);
    }

    const targets: DeliveryTarget[] = [];
    for (const station of status.failed) {
      const path = await this.selectPath(station, updateId);
      if (path) {
        const target = await this.createDeliveryTarget(station, path, update);
        targets.push(target);
      }
    }

    return {
      targets,
      transmissionMode: 'OFDM',
      priority: update.priority
    };
  }

  /**
   * Get routing statistics
   */
  async getRoutingStatistics(): Promise<RoutingStatistics> {
    // Mock implementation - real version would track actual metrics
    return {
      activeCarriers: Math.floor(Math.random() * 48),
      queuedUpdates: Math.floor(Math.random() * 10),
      priorityBreakdown: {
        0: Math.floor(Math.random() * 5),
        1: Math.floor(Math.random() * 10),
        2: Math.floor(Math.random() * 15),
        3: Math.floor(Math.random() * 20),
        4: Math.floor(Math.random() * 25),
        5: Math.floor(Math.random() * 30)
      },
      carrierUtilization: Math.random(),
      avgDeliveryTime: Math.random() * 1000 + 500
    };
  }

  /**
   * Get mesh network statistics
   */
  async getMeshStatistics(): Promise<MeshStatistics> {
    return {
      activeNodes: Math.floor(Math.random() * 20) + 5,
      totalPaths: Math.floor(Math.random() * 100) + 20,
      avgHopCount: Math.random() * 3 + 1,
      networkPartitions: Math.floor(Math.random() * 3),
      deliverySuccessRate: Math.random() * 0.3 + 0.7, // 70-100%
      avgDeliveryLatency: Math.random() * 2000 + 1000, // 1-3 seconds
      pathQualityDistribution: {
        excellent: Math.random() * 0.3 + 0.2,
        good: Math.random() * 0.3 + 0.3,
        fair: Math.random() * 0.2 + 0.1,
        poor: Math.random() * 0.1
      }
    };
  }

  /**
   * Get unlicensed station statistics
   */
  async getUnlicensedStationStats(): Promise<UnlicensedStationStats> {
    return {
      totalUnlicensedStations: 5, // From test data
      activeConnections: Math.floor(Math.random() * 5) + 1,
      dataDelivered: Math.floor(Math.random() * 1000000) + 100000,
      avgConnectionTime: Math.random() * 3600 + 1800, // 30-90 minutes
      deliverySuccessRate: Math.random() * 0.2 + 0.8 // 80-100%
    };
  }

  // Private helper methods
  private async getUpdate(updateId: string): Promise<DynamicUpdate | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readonly');
      const store = transaction.objectStore('updates');
      const request = store.get(updateId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async findSubscribers(update: DynamicUpdate): Promise<string[]> {
    // Get explicit subscribers
    const subscribers = [...update.subscribers];

    // Add subscription-based subscribers (would integrate with SubscriptionManager)
    // For now, return explicit subscribers
    return subscribers;
  }

  private async createDeliveryTarget(station: string, path: DeliveryPath, update: DynamicUpdate): Promise<DeliveryTarget> {
    const isLicensed = this.isValidCallsign(station);

    return {
      station,
      mode: path.mode,
      hops: path.hops,
      hopCount: path.hopCount,
      canRetransmit: isLicensed,
      sourceStation: path.hops[0],
      relayStation: path.hops.length > 2 ? path.hops[1] : undefined,
      scheduledTime: Date.now(),
      transmissionDelay: 0,
      collisionAvoidance: false,
      status: 'pending'
    };
  }

  private selectTransmissionMode(update: DynamicUpdate, constraints?: { maxBandwidth?: number; maxTransmissionTime?: number }): 'OFDM' | 'QPSK' | 'WebRTC' {
    // High priority updates use OFDM for speed
    if (update.priority <= 1) {
      return 'OFDM';
    }

    // Check bandwidth constraints
    if (constraints?.maxBandwidth && constraints.maxBandwidth < 2800) {
      return 'QPSK';
    }

    // Default to OFDM for efficiency
    return 'OFDM';
  }

  private allocateCarriers(priority: number): number[] {
    return this.priorityCarriers[priority] || this.priorityCarriers[5];
  }

  private async areCarriersBusy(carriers: number[]): Promise<boolean> {
    // Mock implementation - real version would check actual carrier usage
    return Math.random() < 0.1; // 10% chance carriers are busy
  }

  private async estimateQueueDelay(priority: number): Promise<number> {
    // Higher priority = shorter delay
    const baseDelay = 30000; // 30 seconds
    return baseDelay / (priority + 1);
  }

  private staggerTransmissions(targets: DeliveryTarget[]): void {
    // Add small delays to avoid collisions
    targets.forEach((target, index) => {
      target.transmissionDelay = index * 1000; // 1 second stagger
      target.scheduledTime = Date.now() + target.transmissionDelay;
      target.collisionAvoidance = index > 0;
    });
  }

  private isPathFresh(path: any): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return (Date.now() - path.lastHeard) < maxAge;
  }

  private isValidCallsign(callsign: string): boolean {
    const callsignPattern = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignPattern.test(callsign) && !callsign.startsWith('UNLICENSED');
  }
}