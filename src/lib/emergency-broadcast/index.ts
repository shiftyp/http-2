/**
 * Enhanced Emergency Broadcasting System
 *
 * Advanced priority-based emergency broadcasting with multi-channel coordination,
 * automatic acknowledgment tracking, and FCC compliance integration.
 * Integrates with existing priority tiers and dynamic data systems.
 */

import { PriorityLevel, PriorityMessage, PriorityManager, EmergencyBroadcaster } from '../priority-tiers/index.js';
import { DynamicDataManager, UpdatePriority, DynamicUpdate } from '../dynamic-data/index.js';
import { ComplianceManager } from '../fcc-compliance/index.js';

export interface EmergencyContext {
  type: 'weather' | 'health' | 'safety' | 'disaster' | 'infrastructure' | 'security';
  severity: 'minor' | 'moderate' | 'major' | 'critical' | 'catastrophic';
  jurisdiction: string;
  coordinates?: { lat: number; lon: number };
  radius?: number; // kilometers
  evacuationZone?: boolean;
  shelterInPlace?: boolean;
  emergencyServices?: string[];
}

export interface BroadcastChannel {
  id: string;
  name: string;
  frequency?: number;
  mode: 'RF' | 'WebRTC' | 'hybrid';
  priority: PriorityLevel;
  maxRetries: number;
  retryInterval: number;
  acknowledgmentRequired: boolean;
  geographicScope: 'local' | 'regional' | 'national' | 'global';
}

export interface EmergencyBroadcastConfig {
  callsign: string;
  licenseClass: 'NOVICE' | 'TECHNICIAN' | 'GENERAL' | 'ADVANCED' | 'EXTRA';
  emergencyAuthority?: string;
  defaultChannels: BroadcastChannel[];
  complianceEnabled: boolean;
  automaticRebroadcast: boolean;
  acknowledgmentTimeout: number; // milliseconds
  maxHops: number;
}

export interface BroadcastStatus {
  id: string;
  message: PriorityMessage;
  channels: string[];
  status: 'pending' | 'broadcasting' | 'acknowledged' | 'expired' | 'failed';
  attempts: number;
  acknowledged: Map<string, Date>;
  lastBroadcast: Date;
  nextRetry?: Date;
  error?: string;
}

/**
 * Enhanced Emergency Broadcasting System with multi-channel coordination
 */
export class EnhancedEmergencyBroadcaster {
  private channels = new Map<string, BroadcastChannel>();
  private broadcasts = new Map<string, BroadcastStatus>();
  private dynamicDataManager: DynamicDataManager;
  private complianceManager?: ComplianceManager;
  private broadcastTimer?: number;

  constructor(
    private config: EmergencyBroadcastConfig,
    private onBroadcast: (message: PriorityMessage, channel: BroadcastChannel) => Promise<boolean>
  ) {
    this.dynamicDataManager = new DynamicDataManager();

    // Initialize default channels
    for (const channel of config.defaultChannels) {
      this.channels.set(channel.id, channel);
    }

    this.startBroadcastProcessor();
  }

  /**
   * Initialize with FCC compliance manager
   */
  async initialize(complianceManager?: ComplianceManager): Promise<void> {
    this.complianceManager = complianceManager;

    if (this.complianceManager && typeof this.complianceManager.start === 'function') {
      await this.complianceManager.start();
    }

    console.log(`🚨 Enhanced Emergency Broadcasting System initialized for ${this.config.callsign}`);
  }

  /**
   * Broadcast emergency message across all appropriate channels
   */
  async broadcastEmergency(
    content: string,
    context: EmergencyContext,
    options: {
      priority?: PriorityLevel;
      channels?: string[];
      requireAcknowledgment?: boolean;
      geographicScope?: 'local' | 'regional' | 'national' | 'global';
      override?: boolean;
    } = {}
  ): Promise<string> {
    // Determine priority based on severity if not specified
    const priority = options.priority ?? this.determinePriorityFromSeverity(context.severity);

    // Check FCC compliance for emergency override
    if (this.complianceManager && priority <= PriorityLevel.P1_URGENT) {
      const complianceCheck = await this.complianceManager.checkEmergencyOverride({
        data: new TextEncoder().encode(content),
        priority,
        source: this.config.callsign
      });

      if (!complianceCheck.allowed && !options.override) {
        throw new Error(`Emergency broadcast blocked by FCC compliance: ${complianceCheck.reason}`);
      }
    }

    // Create priority message
    const message = PriorityManager.createMessage(content, {
      level: priority,
      category: context.type,
      source: this.config.callsign,
      broadcast: true,
      override: options.override || priority === PriorityLevel.P0_EMERGENCY
    });

    // Add emergency context to message
    (message as any).emergencyContext = context;

    // Create dynamic update for distribution
    const dynamicUpdate = await this.dynamicDataManager.createEmergencyUpdate(
      content,
      context.type,
      this.config.callsign,
      context.jurisdiction
    );

    // Determine channels to use
    const targetChannels = this.selectChannels(
      priority,
      context,
      options.channels,
      options.geographicScope
    );

    if (targetChannels.length === 0) {
      throw new Error('No suitable broadcast channels available');
    }

    // Create broadcast status
    const broadcastStatus: BroadcastStatus = {
      id: message.id,
      message,
      channels: targetChannels.map(c => c.id),
      status: 'pending',
      attempts: 0,
      acknowledged: new Map(),
      lastBroadcast: new Date()
    };

    this.broadcasts.set(message.id, broadcastStatus);

    // Immediate broadcast for P0 emergency
    if (priority === PriorityLevel.P0_EMERGENCY) {
      await this.executeBroadcast(message.id);

      // Trigger emergency alert
      this.triggerEmergencyAlert(message, context);
    }

    console.log(`🚨 Emergency broadcast queued: ${PriorityManager.getPriorityName(priority)} - ${context.type} in ${context.jurisdiction}`);

    return message.id;
  }

  /**
   * Acknowledge receipt of emergency broadcast
   */
  acknowledgeEmergencyBroadcast(messageId: string, station: string): boolean {
    const broadcast = this.broadcasts.get(messageId);
    if (!broadcast) {
      return false;
    }

    broadcast.acknowledged.set(station, new Date());

    // Check if sufficient acknowledgments received
    const requiredAcks = this.getRequiredAcknowledgments(broadcast);
    if (broadcast.acknowledged.size >= requiredAcks) {
      broadcast.status = 'acknowledged';
      console.log(`✅ Emergency broadcast ${messageId} acknowledged by ${broadcast.acknowledged.size} stations`);
    }

    return true;
  }

  /**
   * Get current emergency broadcast statistics
   */
  getEmergencyStatistics() {
    const stats = {
      totalBroadcasts: this.broadcasts.size,
      activeBroadcasts: 0,
      acknowledgedBroadcasts: 0,
      failedBroadcasts: 0,
      emergencyMessages: 0,
      urgentMessages: 0,
      channels: this.channels.size,
      avgAcknowledgmentTime: 0,
      lastEmergencyBroadcast: null as Date | null
    };

    let totalAckTime = 0;
    let ackCount = 0;

    for (const broadcast of this.broadcasts.values()) {
      switch (broadcast.status) {
        case 'pending':
        case 'broadcasting':
          stats.activeBroadcasts++;
          break;
        case 'acknowledged':
          stats.acknowledgedBroadcasts++;
          break;
        case 'failed':
          stats.failedBroadcasts++;
          break;
      }

      if (broadcast.message.priority.level === PriorityLevel.P0_EMERGENCY) {
        stats.emergencyMessages++;
        if (!stats.lastEmergencyBroadcast || broadcast.lastBroadcast > stats.lastEmergencyBroadcast) {
          stats.lastEmergencyBroadcast = broadcast.lastBroadcast;
        }
      } else if (broadcast.message.priority.level === PriorityLevel.P1_URGENT) {
        stats.urgentMessages++;
      }

      // Calculate acknowledgment time
      if (broadcast.acknowledged.size > 0) {
        const firstAck = Math.min(...Array.from(broadcast.acknowledged.values()).map(d => d.getTime()));
        const ackTime = firstAck - broadcast.lastBroadcast.getTime();
        totalAckTime += ackTime;
        ackCount++;
      }
    }

    if (ackCount > 0) {
      stats.avgAcknowledgmentTime = totalAckTime / ackCount;
    }

    return stats;
  }

  /**
   * Register new broadcast channel
   */
  registerChannel(channel: BroadcastChannel): void {
    this.channels.set(channel.id, channel);
    console.log(`📡 Registered broadcast channel: ${channel.name} (${channel.mode})`);
  }

  /**
   * Remove broadcast channel
   */
  removeChannel(channelId: string): boolean {
    const removed = this.channels.delete(channelId);
    if (removed) {
      console.log(`🚫 Removed broadcast channel: ${channelId}`);
    }
    return removed;
  }

  /**
   * Get all active emergency broadcasts
   */
  getActiveBroadcasts(): BroadcastStatus[] {
    return Array.from(this.broadcasts.values())
      .filter(b => b.status === 'pending' || b.status === 'broadcasting')
      .sort((a, b) => a.message.priority.level - b.message.priority.level);
  }

  /**
   * Cancel emergency broadcast
   */
  cancelBroadcast(messageId: string): boolean {
    const broadcast = this.broadcasts.get(messageId);
    if (!broadcast) {
      return false;
    }

    if (broadcast.status === 'pending' || broadcast.status === 'broadcasting') {
      this.broadcasts.delete(messageId);
      console.log(`🛑 Cancelled emergency broadcast: ${messageId}`);
      return true;
    }

    return false;
  }

  /**
   * Emergency shutdown - cancel all broadcasts
   */
  async emergencyShutdown(): Promise<void> {
    console.warn('🚨 Emergency shutdown of broadcasting system');

    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = undefined;
    }

    this.broadcasts.clear();

    if (this.complianceManager && typeof this.complianceManager.dispose === 'function') {
      await this.complianceManager.dispose();
    }

    console.log('🛑 Emergency broadcasting system shutdown complete');
  }

  /**
   * Determine priority from emergency severity
   */
  private determinePriorityFromSeverity(severity: EmergencyContext['severity']): PriorityLevel {
    switch (severity) {
      case 'catastrophic':
      case 'critical':
        return PriorityLevel.P0_EMERGENCY;
      case 'major':
        return PriorityLevel.P1_URGENT;
      case 'moderate':
        return PriorityLevel.P2_HIGH;
      case 'minor':
        return PriorityLevel.P3_NORMAL;
      default:
        return PriorityLevel.P3_NORMAL;
    }
  }

  /**
   * Select appropriate channels for broadcast
   */
  private selectChannels(
    priority: PriorityLevel,
    context: EmergencyContext,
    requestedChannels?: string[],
    geographicScope?: string
  ): BroadcastChannel[] {
    let availableChannels = Array.from(this.channels.values());

    // Filter by requested channels if specified
    if (requestedChannels && requestedChannels.length > 0) {
      availableChannels = availableChannels.filter(c => requestedChannels.includes(c.id));
    }

    // Filter by geographic scope
    if (geographicScope) {
      availableChannels = availableChannels.filter(c => {
        switch (geographicScope) {
          case 'local': return c.geographicScope === 'local';
          case 'regional': return ['local', 'regional'].includes(c.geographicScope);
          case 'national': return ['local', 'regional', 'national'].includes(c.geographicScope);
          case 'global': return true;
          default: return true;
        }
      });
    }

    // For emergency messages, use all available channels
    if (priority === PriorityLevel.P0_EMERGENCY) {
      return availableChannels;
    }

    // Otherwise, filter by priority
    return availableChannels.filter(c => c.priority >= priority);
  }

  /**
   * Execute broadcast on selected channels
   */
  private async executeBroadcast(messageId: string): Promise<void> {
    const broadcast = this.broadcasts.get(messageId);
    if (!broadcast) {
      return;
    }

    broadcast.status = 'broadcasting';
    broadcast.attempts++;
    broadcast.lastBroadcast = new Date();

    const channels = broadcast.channels
      .map(id => this.channels.get(id))
      .filter(c => c !== undefined) as BroadcastChannel[];

    let successCount = 0;
    const errors: string[] = [];

    for (const channel of channels) {
      try {
        const success = await this.onBroadcast(broadcast.message, channel);
        if (success) {
          successCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${channel.id}: ${errorMsg}`);
      }
    }

    if (successCount === 0) {
      broadcast.status = 'failed';
      broadcast.error = errors.join('; ');
      console.error(`❌ Broadcast failed for ${messageId}: ${broadcast.error}`);
    } else if (successCount < channels.length) {
      console.warn(`⚠️ Partial broadcast success for ${messageId}: ${successCount}/${channels.length}`);
    } else {
      console.log(`✅ Broadcast successful for ${messageId} on ${successCount} channels`);
    }

    // Schedule retry if needed
    if (broadcast.status !== 'failed' && !broadcast.message.priority.broadcast) {
      this.scheduleRetry(messageId);
    }
  }

  /**
   * Schedule retry for failed broadcasts
   */
  private scheduleRetry(messageId: string): void {
    const broadcast = this.broadcasts.get(messageId);
    if (!broadcast) {
      return;
    }

    const channel = this.channels.get(broadcast.channels[0]);
    if (!channel) {
      return;
    }

    if (broadcast.attempts >= channel.maxRetries) {
      broadcast.status = 'failed';
      broadcast.error = 'Maximum retries exceeded';
      return;
    }

    broadcast.nextRetry = new Date(Date.now() + channel.retryInterval);
  }

  /**
   * Get required acknowledgment count
   */
  private getRequiredAcknowledgments(broadcast: BroadcastStatus): number {
    const primaryChannel = this.channels.get(broadcast.channels[0]);
    if (!primaryChannel) {
      return 1;
    }

    switch (primaryChannel.geographicScope) {
      case 'local': return 1;
      case 'regional': return 3;
      case 'national': return 5;
      case 'global': return 10;
      default: return 1;
    }
  }

  /**
   * Trigger emergency alert for P0 messages
   */
  private triggerEmergencyAlert(message: PriorityMessage, context: EmergencyContext): void {
    console.warn(`🚨🚨🚨 EMERGENCY ALERT 🚨🚨🚨`);
    console.warn(`Type: ${context.type.toUpperCase()}`);
    console.warn(`Severity: ${context.severity.toUpperCase()}`);
    console.warn(`Jurisdiction: ${context.jurisdiction}`);
    console.warn(`Message: ${message.content}`);
    console.warn(`Source: ${message.priority.source}`);

    if (context.evacuationZone) {
      console.warn(`⚠️ EVACUATION ZONE ACTIVE`);
    }

    if (context.shelterInPlace) {
      console.warn(`🏠 SHELTER IN PLACE ORDERED`);
    }
  }

  /**
   * Start broadcast processor timer
   */
  private startBroadcastProcessor(): void {
    this.broadcastTimer = setInterval(() => {
      this.processBroadcastQueue();
    }, 5000) as unknown as number; // Check every 5 seconds
  }

  /**
   * Process broadcast queue for retries
   */
  private async processBroadcastQueue(): Promise<void> {
    const now = new Date();

    for (const [messageId, broadcast] of this.broadcasts) {
      // Remove expired broadcasts
      if (PriorityManager.isExpired(broadcast.message)) {
        broadcast.status = 'expired';
        this.broadcasts.delete(messageId);
        continue;
      }

      // Process pending retries
      if (broadcast.status === 'pending' && broadcast.nextRetry && now >= broadcast.nextRetry) {
        await this.executeBroadcast(messageId);
      }
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = undefined;
    }

    this.broadcasts.clear();
    this.channels.clear();
  }
}

export default EnhancedEmergencyBroadcaster;