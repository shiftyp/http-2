/**
 * Priority Tiers Library
 *
 * Disaster-oriented content classification system with P0-P5 priority levels
 * and TTL management for emergency broadcasting over amateur radio networks.
 *
 * @module PriorityTiers
 */

export enum PriorityLevel {
  P0_EMERGENCY = 0,      // Life-threatening emergencies
  P1_URGENT = 1,         // Time-critical health/safety
  P2_HIGH = 2,           // Important operational updates
  P3_NORMAL = 3,         // Standard communications
  P4_LOW = 4,            // Routine information
  P5_DEFER = 5           // Non-critical, background data
}

export interface PriorityMetadata {
  level: PriorityLevel;
  ttl: number;           // Time-to-live in milliseconds
  category: string;      // Emergency type or content category
  source: string;        // Originating callsign
  timestamp: number;     // Creation time
  broadcast: boolean;    // Requires emergency broadcast
  override: boolean;     // Override FCC compliance for emergency
}

export interface PriorityMessage {
  id: string;
  priority: PriorityMetadata;
  content: any;
  size: number;
  checksum: string;
  encrypted: boolean;
  signature?: string;
}

export interface BroadcastConfig {
  maxRetries: number;
  retryInterval: number;
  acknowledgmentRequired: boolean;
  geographicScope: 'local' | 'regional' | 'national' | 'global';
  emergencyServices: boolean;
}

/**
 * Priority classification and TTL management system
 */
export class PriorityManager {
  private static readonly TTL_DEFAULTS = new Map<PriorityLevel, number>([
    [PriorityLevel.P0_EMERGENCY, 15 * 60 * 1000],   // 15 minutes
    [PriorityLevel.P1_URGENT, 60 * 60 * 1000],      // 1 hour
    [PriorityLevel.P2_HIGH, 4 * 60 * 60 * 1000],    // 4 hours
    [PriorityLevel.P3_NORMAL, 24 * 60 * 60 * 1000], // 24 hours
    [PriorityLevel.P4_LOW, 7 * 24 * 60 * 60 * 1000], // 7 days
    [PriorityLevel.P5_DEFER, 30 * 24 * 60 * 60 * 1000] // 30 days
  ]);

  private static readonly EMERGENCY_KEYWORDS = [
    'emergency', 'medical', 'fire', 'rescue', 'disaster', 'evacuation',
    'earthquake', 'flood', 'tornado', 'hurricane', 'accident', 'injury',
    'missing', 'trapped', 'help', 'sos', 'mayday', 'urgent', 'critical'
  ];

  /**
   * Classify content priority automatically
   */
  static classifyContent(content: string, metadata?: Partial<PriorityMetadata>): PriorityLevel {
    const text = content.toLowerCase();

    // Check for emergency keywords
    const hasEmergencyKeywords = this.EMERGENCY_KEYWORDS.some(keyword =>
      text.includes(keyword)
    );

    // Check for explicit priority indicators
    if (text.includes('p0') || text.includes('emergency')) {
      return PriorityLevel.P0_EMERGENCY;
    }
    if (text.includes('p1') || text.includes('urgent')) {
      return PriorityLevel.P1_URGENT;
    }
    if (text.includes('p2') || text.includes('high')) {
      return PriorityLevel.P2_HIGH;
    }
    if (text.includes('p4') || text.includes('low')) {
      return PriorityLevel.P4_LOW;
    }
    if (text.includes('p5') || text.includes('defer')) {
      return PriorityLevel.P5_DEFER;
    }

    // Auto-classify based on keywords
    if (hasEmergencyKeywords) {
      return PriorityLevel.P0_EMERGENCY;
    }

    // Check metadata for classification hints
    if (metadata?.category) {
      const category = metadata.category.toLowerCase();
      if (category.includes('emergency') || category.includes('medical')) {
        return PriorityLevel.P0_EMERGENCY;
      }
      if (category.includes('urgent') || category.includes('safety')) {
        return PriorityLevel.P1_URGENT;
      }
      if (category.includes('operational') || category.includes('important')) {
        return PriorityLevel.P2_HIGH;
      }
    }

    // Default to normal priority
    return PriorityLevel.P3_NORMAL;
  }

  /**
   * Get default TTL for priority level
   */
  static getDefaultTTL(level: PriorityLevel): number {
    return this.TTL_DEFAULTS.get(level) || 24 * 60 * 60 * 1000; // 24 hours default
  }

  /**
   * Check if message has expired
   */
  static isExpired(message: PriorityMessage): boolean {
    const now = Date.now();
    const expiration = message.priority.timestamp + message.priority.ttl;
    return now > expiration;
  }

  /**
   * Get remaining TTL for message
   */
  static getRemainingTTL(message: PriorityMessage): number {
    const now = Date.now();
    const expiration = message.priority.timestamp + message.priority.ttl;
    return Math.max(0, expiration - now);
  }

  /**
   * Create priority message
   */
  static createMessage(
    content: any,
    options: {
      level?: PriorityLevel;
      category?: string;
      source: string;
      ttl?: number;
      broadcast?: boolean;
      override?: boolean;
    }
  ): PriorityMessage {
    const level = options.level || this.classifyContent(
      typeof content === 'string' ? content : JSON.stringify(content),
      { category: options.category }
    );

    const ttl = options.ttl || this.getDefaultTTL(level);
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const size = new TextEncoder().encode(contentStr).length;

    // Generate checksum
    const checksum = this.generateChecksum(contentStr);

    return {
      id: crypto.randomUUID(),
      priority: {
        level,
        ttl,
        category: options.category || 'general',
        source: options.source,
        timestamp: Date.now(),
        broadcast: options.broadcast || (level <= PriorityLevel.P1_URGENT),
        override: options.override || (level === PriorityLevel.P0_EMERGENCY)
      },
      content,
      size,
      checksum,
      encrypted: false
    };
  }

  /**
   * Generate simple checksum for content integrity
   */
  private static generateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get broadcast configuration for priority level
   */
  static getBroadcastConfig(level: PriorityLevel): BroadcastConfig {
    switch (level) {
      case PriorityLevel.P0_EMERGENCY:
        return {
          maxRetries: 10,
          retryInterval: 30000, // 30 seconds
          acknowledgmentRequired: true,
          geographicScope: 'regional',
          emergencyServices: true
        };

      case PriorityLevel.P1_URGENT:
        return {
          maxRetries: 5,
          retryInterval: 60000, // 1 minute
          acknowledgmentRequired: true,
          geographicScope: 'local',
          emergencyServices: false
        };

      case PriorityLevel.P2_HIGH:
        return {
          maxRetries: 3,
          retryInterval: 300000, // 5 minutes
          acknowledgmentRequired: false,
          geographicScope: 'local',
          emergencyServices: false
        };

      default:
        return {
          maxRetries: 1,
          retryInterval: 600000, // 10 minutes
          acknowledgmentRequired: false,
          geographicScope: 'local',
          emergencyServices: false
        };
    }
  }

  /**
   * Sort messages by priority and age
   */
  static sortByPriority(messages: PriorityMessage[]): PriorityMessage[] {
    return messages
      .filter(msg => !this.isExpired(msg))
      .sort((a, b) => {
        // First sort by priority level (lower number = higher priority)
        if (a.priority.level !== b.priority.level) {
          return a.priority.level - b.priority.level;
        }

        // Then sort by timestamp (newer first for same priority)
        return b.priority.timestamp - a.priority.timestamp;
      });
  }

  /**
   * Filter messages by criteria
   */
  static filterMessages(
    messages: PriorityMessage[],
    criteria: {
      minLevel?: PriorityLevel;
      maxLevel?: PriorityLevel;
      category?: string;
      source?: string;
      emergencyOnly?: boolean;
      includeExpired?: boolean;
    } = {}
  ): PriorityMessage[] {
    return messages.filter(msg => {
      // Check expiration
      if (!criteria.includeExpired && this.isExpired(msg)) {
        return false;
      }

      // Check priority level range
      if (criteria.minLevel !== undefined && msg.priority.level < criteria.minLevel) {
        return false;
      }
      if (criteria.maxLevel !== undefined && msg.priority.level > criteria.maxLevel) {
        return false;
      }

      // Check category
      if (criteria.category && !msg.priority.category.includes(criteria.category)) {
        return false;
      }

      // Check source
      if (criteria.source && msg.priority.source !== criteria.source) {
        return false;
      }

      // Check emergency only
      if (criteria.emergencyOnly && msg.priority.level > PriorityLevel.P1_URGENT) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get priority level name
   */
  static getPriorityName(level: PriorityLevel): string {
    switch (level) {
      case PriorityLevel.P0_EMERGENCY: return 'P0-EMERGENCY';
      case PriorityLevel.P1_URGENT: return 'P1-URGENT';
      case PriorityLevel.P2_HIGH: return 'P2-HIGH';
      case PriorityLevel.P3_NORMAL: return 'P3-NORMAL';
      case PriorityLevel.P4_LOW: return 'P4-LOW';
      case PriorityLevel.P5_DEFER: return 'P5-DEFER';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Calculate priority score for scheduling
   */
  static calculatePriorityScore(message: PriorityMessage): number {
    const baseScore = (5 - message.priority.level) * 1000;
    const ageBonus = Math.max(0, 1000 - (Date.now() - message.priority.timestamp) / 1000);
    const sizeBonus = Math.max(0, 100 - message.size / 100);

    return baseScore + ageBonus + sizeBonus;
  }
}

/**
 * Emergency broadcast system
 */
export class EmergencyBroadcaster {
  private pendingBroadcasts = new Map<string, {
    message: PriorityMessage;
    config: BroadcastConfig;
    attempts: number;
    lastAttempt: number;
    acknowledged: Set<string>;
  }>();

  private broadcastTimer: number | null = null;

  constructor(
    private onBroadcast: (message: PriorityMessage, config: BroadcastConfig) => Promise<boolean>,
    private onEmergencyOverride?: (message: PriorityMessage) => Promise<void>
  ) {}

  /**
   * Queue message for emergency broadcast
   */
  async queueBroadcast(message: PriorityMessage): Promise<void> {
    if (!message.priority.broadcast) {
      return;
    }

    const config = PriorityManager.getBroadcastConfig(message.priority.level);

    this.pendingBroadcasts.set(message.id, {
      message,
      config,
      attempts: 0,
      lastAttempt: 0,
      acknowledged: new Set()
    });

    // Immediate broadcast for emergency messages
    if (message.priority.level === PriorityLevel.P0_EMERGENCY) {
      await this.broadcastMessage(message.id);

      // Trigger emergency override if available
      if (this.onEmergencyOverride) {
        await this.onEmergencyOverride(message);
      }
    }

    this.scheduleBroadcast();
  }

  /**
   * Acknowledge message receipt
   */
  acknowledgeMessage(messageId: string, station: string): void {
    const broadcast = this.pendingBroadcasts.get(messageId);
    if (broadcast) {
      broadcast.acknowledged.add(station);

      // Remove from queue if sufficient acknowledgments received
      if (broadcast.acknowledged.size >= this.getRequiredAcknowledgments(broadcast.config)) {
        this.pendingBroadcasts.delete(messageId);
      }
    }
  }

  /**
   * Schedule next broadcast attempt
   */
  private scheduleBroadcast(): void {
    if (this.broadcastTimer) {
      return;
    }

    const nextBroadcast = this.getNextBroadcast();
    if (!nextBroadcast) {
      return;
    }

    const delay = Math.max(0, nextBroadcast.config.retryInterval - (Date.now() - nextBroadcast.lastAttempt));

    this.broadcastTimer = setTimeout(async () => {
      this.broadcastTimer = null;
      await this.processBroadcastQueue();
      this.scheduleBroadcast();
    }, delay) as unknown as number;
  }

  /**
   * Process broadcast queue
   */
  private async processBroadcastQueue(): Promise<void> {
    const now = Date.now();
    const toProcess: string[] = [];

    for (const [id, broadcast] of this.pendingBroadcasts) {
      // Check if message has expired
      if (PriorityManager.isExpired(broadcast.message)) {
        this.pendingBroadcasts.delete(id);
        continue;
      }

      // Check if retry interval has passed
      if (broadcast.attempts === 0 || now - broadcast.lastAttempt >= broadcast.config.retryInterval) {
        // Check if max retries exceeded
        if (broadcast.attempts >= broadcast.config.maxRetries) {
          console.warn(`Max retries exceeded for broadcast ${id}`);
          this.pendingBroadcasts.delete(id);
          continue;
        }

        toProcess.push(id);
      }
    }

    // Sort by priority and broadcast
    const sortedMessages = toProcess
      .map(id => ({ id, message: this.pendingBroadcasts.get(id)!.message }))
      .sort((a, b) => a.message.priority.level - b.message.priority.level);

    for (const { id } of sortedMessages) {
      await this.broadcastMessage(id);
    }
  }

  /**
   * Broadcast specific message
   */
  private async broadcastMessage(messageId: string): Promise<void> {
    const broadcast = this.pendingBroadcasts.get(messageId);
    if (!broadcast) {
      return;
    }

    try {
      const success = await this.onBroadcast(broadcast.message, broadcast.config);

      broadcast.attempts++;
      broadcast.lastAttempt = Date.now();

      if (success && !broadcast.config.acknowledgmentRequired) {
        this.pendingBroadcasts.delete(messageId);
      }

      console.log(`Broadcasted ${PriorityManager.getPriorityName(broadcast.message.priority.level)} message ${messageId} (attempt ${broadcast.attempts})`);

    } catch (error) {
      console.error(`Broadcast failed for message ${messageId}:`, error);
      broadcast.attempts++;
      broadcast.lastAttempt = Date.now();
    }
  }

  /**
   * Get next message due for broadcast
   */
  private getNextBroadcast() {
    let next = null;
    let earliestDue = Infinity;

    for (const broadcast of this.pendingBroadcasts.values()) {
      if (PriorityManager.isExpired(broadcast.message)) {
        continue;
      }

      const due = broadcast.lastAttempt + broadcast.config.retryInterval;
      if (due < earliestDue) {
        earliestDue = due;
        next = broadcast;
      }
    }

    return next;
  }

  /**
   * Get required acknowledgment count
   */
  private getRequiredAcknowledgments(config: BroadcastConfig): number {
    switch (config.geographicScope) {
      case 'local': return 1;
      case 'regional': return 3;
      case 'national': return 5;
      case 'global': return 10;
      default: return 1;
    }
  }

  /**
   * Get current broadcast statistics
   */
  getStatistics() {
    const stats = {
      pendingBroadcasts: this.pendingBroadcasts.size,
      emergencyMessages: 0,
      urgentMessages: 0,
      totalAttempts: 0,
      acknowledgedMessages: 0
    };

    for (const broadcast of this.pendingBroadcasts.values()) {
      if (broadcast.message.priority.level === PriorityLevel.P0_EMERGENCY) {
        stats.emergencyMessages++;
      } else if (broadcast.message.priority.level === PriorityLevel.P1_URGENT) {
        stats.urgentMessages++;
      }

      stats.totalAttempts += broadcast.attempts;

      if (broadcast.acknowledged.size > 0) {
        stats.acknowledgedMessages++;
      }
    }

    return stats;
  }

  /**
   * Stop broadcasting and cleanup
   */
  dispose(): void {
    if (this.broadcastTimer) {
      clearTimeout(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    this.pendingBroadcasts.clear();
  }
}

// Export types and utilities
export default PriorityManager;