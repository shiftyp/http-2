/**
 * Path Selector - Intelligent path selection for routing
 */

export interface PathSelectorConfig {
  db: IDBDatabase;
  preferRFOnLastBeacon?: boolean;
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

export class PathSelector {
  private db: IDBDatabase;
  private preferRFOnLastBeacon: boolean;

  constructor(config: PathSelectorConfig) {
    this.db = config.db;
    this.preferRFOnLastBeacon = config.preferRFOnLastBeacon ?? false;
  }

  async selectPath(targetStation: string, updateId: string): Promise<DeliveryPath | null> {
    // Mock implementation - in real version would analyze beacon data
    return {
      station: targetStation,
      mode: 'RF',
      hops: ['origin', targetStation],
      hopCount: 1,
      reason: 'mock path selection'
    };
  }
}