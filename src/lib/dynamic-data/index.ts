/**
 * Dynamic Data System
 *
 * Emergency update broadcast and priority-based data distribution
 * for amateur radio HTTP communications with P0-P5 priority levels.
 */

export enum UpdatePriority {
  P0_EMERGENCY = 0,    // Life safety emergency
  P1_URGENT = 1,       // Critical infrastructure
  P2_HIGH = 2,         // Important public service
  P3_NORMAL = 3,       // Regular traffic
  P4_LOW = 4,          // Routine updates
  P5_BULK = 5          // Background data
}

export interface DynamicUpdate {
  id: string;
  priority: UpdatePriority;
  category: string;
  content: string | ArrayBuffer;
  contentType: string;

  // Metadata
  createdAt: Date;
  expiresAt: Date;
  version: number;
  checksum: string;

  // Distribution
  sourceCallsign: string;
  targetArea?: string;     // Geographic area
  requiredHops?: number;   // Mesh routing hops

  // Emergency context
  emergencyType?: 'weather' | 'health' | 'safety' | 'disaster';
  jurisdiction?: string;   // Served agency
}

export class DynamicDataManager {
  private updates = new Map<string, DynamicUpdate>();
  private subscriptions = new Map<string, Set<string>>();

  /**
   * Create emergency update (P0 priority)
   */
  async createEmergencyUpdate(
    content: string,
    emergencyType: DynamicUpdate['emergencyType'],
    sourceCallsign: string,
    targetArea?: string
  ): Promise<DynamicUpdate> {
    const update: DynamicUpdate = {
      id: crypto.randomUUID(),
      priority: UpdatePriority.P0_EMERGENCY,
      category: 'emergency',
      content,
      contentType: 'text/plain',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      version: 1,
      checksum: await this.calculateChecksum(content),
      sourceCallsign,
      targetArea,
      emergencyType,
      requiredHops: 10 // Maximum propagation for emergency
    };

    this.updates.set(update.id, update);
    await this.broadcastUpdate(update);

    return update;
  }

  /**
   * Subscribe to updates by category or priority
   */
  subscribe(channel: string, callsign: string): void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callsign);
  }

  /**
   * Get pending updates for a subscription
   */
  getPendingUpdates(channel: string): DynamicUpdate[] {
    return Array.from(this.updates.values())
      .filter(update => this.matchesChannel(update, channel))
      .sort((a, b) => a.priority - b.priority); // P0 first
  }

  private async calculateChecksum(content: string | ArrayBuffer): Promise<string> {
    const data = typeof content === 'string'
      ? new TextEncoder().encode(content)
      : new Uint8Array(content);

    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async broadcastUpdate(update: DynamicUpdate): Promise<void> {
    // Emergency updates broadcast immediately
    if (update.priority === UpdatePriority.P0_EMERGENCY) {
      console.warn(`🚨 EMERGENCY UPDATE: ${update.content} (${update.sourceCallsign})`);
      // Would integrate with mesh broadcasting
    }
  }

  private matchesChannel(update: DynamicUpdate, channel: string): boolean {
    return update.category === channel ||
           channel === 'emergency' && update.priority === UpdatePriority.P0_EMERGENCY;
  }
}

export default DynamicDataManager;