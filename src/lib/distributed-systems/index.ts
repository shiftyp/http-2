/**
 * Distributed Systems Library
 *
 * Complete distributed amateur radio systems management including server discovery,
 * connection management, dynamic data updates, and subscription handling.
 *
 * @module DistributedSystems
 */

// Server Management
export { ServerDiscovery, serverDiscovery } from '../server-discovery/index.js';
import ServerManagerClass from '../server-manager/index.js';
export { default as ServerManager } from '../server-manager/index.js';

// Dynamic Data Management
import UpdateManagerClass from '../update-manager/index.js';
export { default as UpdateManager } from '../update-manager/index.js';
import SubscriptionRegistryClass from '../subscription-registry/index.js';
export { default as SubscriptionRegistry } from '../subscription-registry/index.js';

// Certificate Management
import { CertificateManager } from '../certificate-management/index.js';
export {
  CertificateManager,
  CertificateService,
  PKCS12Parser,
  CAPTCHAGenerator,
  TrustChainValidator,
  CertificateStore
} from '../certificate-management/index.js';

// FCC Compliance
import { createComplianceManager } from '../fcc-compliance/index.js';
export { ComplianceManager } from '../fcc-compliance/index.js';
export { StationIDTimer } from '../fcc-compliance/index.js';
export { EncryptionGuard } from '../fcc-compliance/index.js';
export { ContentFilter } from '../fcc-compliance/index.js';
export { ComplianceLogger } from '../fcc-compliance/index.js';

// Export types
export type { ServerInfo, DiscoveryOptions } from '../server-discovery/index.js';
export type {
  ServerManagerConfig,
  ServerConnection,
  ConnectionStats,
  LoadBalancingOptions
} from '../server-manager/index.js';

export type {
  UpdateManagerConfig,
  UpdateCreationOptions,
  VersionCreationOptions,
  UpdateQueryOptions
} from '../update-manager/index.js';

export type {
  SubscriptionRegistryConfig,
  SubscriptionCreateOptions,
  SubscriptionQueryOptions,
  SubscriptionStats
} from '../subscription-registry/index.js';

export type {
  ComplianceConfig,
  ComplianceStatus,
  ComplianceReport
} from '../fcc-compliance/index.js';

// Unified Distributed Systems Manager
export class DistributedSystemsManager {
  public readonly serverManager: import('../server-manager/index.js').default;
  public readonly updateManager: import('../update-manager/index.js').default;
  public readonly subscriptionRegistry: import('../subscription-registry/index.js').default;
  public readonly certificateManager: import('../certificate-management/index.js').CertificateManager;
  public readonly complianceManager: import('../fcc-compliance/index.js').ComplianceManager;

  private db: IDBDatabase | null = null;

  constructor(config: {
    callsign: string;
    licenseClass: 'NOVICE' | 'TECHNICIAN' | 'GENERAL' | 'ADVANCED' | 'EXTRA';
    emergencyMode?: boolean;
  }) {
    // Initialize managers
    this.serverManager = new ServerManagerClass();
    this.certificateManager = new CertificateManager();
    this.complianceManager = createComplianceManager(config.callsign, {
      emergencyMode: config.emergencyMode || false
    });

    // These will be initialized after database setup
    this.updateManager = null as any;
    this.subscriptionRegistry = null as any;
  }

  /**
   * Initialize the entire distributed systems stack
   */
  async initialize(): Promise<void> {
    try {
      // Initialize database first
      await this.initializeDatabase();

      // Initialize certificate management
      await this.certificateManager.initialize();

      // Initialize FCC compliance
      if (typeof this.complianceManager.start === 'function') {
        await this.complianceManager.start();
      }

      // Initialize dynamic data managers
      if (this.db) {
        this.updateManager = new UpdateManagerClass({
          db: this.db,
          requireSignature: true
        });

        this.subscriptionRegistry = new SubscriptionRegistryClass({
          db: this.db
        });
      }

      // Initialize server management
      await this.serverManager.initialize();

      console.log('🚀 Distributed systems initialized successfully');

    } catch (error) {
      console.error('Failed to initialize distributed systems:', error);
      throw error;
    }
  }

  /**
   * Initialize IndexedDB for dynamic data management
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('distributed-systems', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for dynamic data
        if (!db.objectStoreNames.contains('updates')) {
          const updatesStore = db.createObjectStore('updates', { keyPath: 'id' });
          updatesStore.createIndex('by_category', 'category', { unique: false });
          updatesStore.createIndex('by_priority', 'priority', { unique: false });
          updatesStore.createIndex('by_originator', 'originator', { unique: false });
        }

        if (!db.objectStoreNames.contains('subscriptions')) {
          const subscriptionsStore = db.createObjectStore('subscriptions', { keyPath: 'id' });
          subscriptionsStore.createIndex('by_callsign', 'callsign', { unique: false });
          subscriptionsStore.createIndex('by_category', 'categories', { unique: false, multiEntry: true });
        }

        if (!db.objectStoreNames.contains('cache_entries')) {
          const cacheStore = db.createObjectStore('cache_entries', { keyPath: 'id' });
          cacheStore.createIndex('by_update', 'updateId', { unique: false });
          cacheStore.createIndex('by_station', 'station', { unique: false });
        }
      };
    });
  }

  /**
   * Coordinate emergency broadcast across all systems
   */
  async broadcastEmergencyUpdate(content: any, options: {
    priority: number;
    category: string;
    geographicScope: 'local' | 'regional' | 'national' | 'global';
    acknowledgmentRequired: boolean;
  }): Promise<string | null> {
    try {
      // Check FCC compliance first
      if (options.priority <= 1) { // P0 or P1 emergency
        const complianceCheck = await this.complianceManager.checkEmergencyOverride({
          data: new TextEncoder().encode(JSON.stringify(content)),
          priority: options.priority,
          source: this.serverManager.constructor.name
        });

        if (!complianceCheck.allowed) {
          console.warn('Emergency broadcast blocked by FCC compliance:', complianceCheck.reason);
          return null;
        }
      }

      // Create update with emergency priority
      const contentData = new TextEncoder().encode(JSON.stringify(content));
      const update = await this.updateManager.create({
        category: options.category,
        priority: options.priority,
        data: contentData,
        originator: 'EMERGENCY-SYSTEM',
        subscribers: [], // Emergency broadcasts to all
        compress: true
      });

      // Create subscription for emergency recipients
      const emergencySubscription = await this.subscriptionRegistry.create({
        callsign: 'EMERGENCY-BROADCAST',
        categories: [options.category],
        priorities: [options.priority],
        keywords: ['emergency', 'urgent'],
        maxSize: contentData.length * 2,
        ttl: 15 * 60 * 1000, // 15 minutes for emergency
        delivery: {
          queueSize: 100,
          retryCount: 10,
          retryDelayMs: 5000
        }
      });

      // Broadcast via server manager to all connected servers
      const broadcast = {
        type: 'emergency-broadcast',
        updateId: update.id,
        subscriptionId: emergencySubscription.id,
        priority: options.priority,
        category: options.category,
        content,
        timestamp: Date.now(),
        scope: options.geographicScope,
        acknowledgmentRequired: options.acknowledgmentRequired
      };

      const broadcastResults = await this.serverManager.broadcast(broadcast);
      console.log(`Emergency broadcast sent to ${broadcastResults.length} servers`);

      return update.id;
    } catch (error) {
      console.error('Emergency broadcast failed:', error);
      return null;
    }
  }

  /**
   * Coordinate certificate federation across servers
   */
  async federateCertificate(certificate: any, servers?: string[]): Promise<boolean> {
    try {
      // Validate certificate first
      const validation = await this.certificateManager.service.validateCertificate(certificate);
      if (!validation.valid) {
        console.warn('Certificate federation failed: invalid certificate');
        return false;
      }

      // Create federation message
      const federationMessage = {
        type: 'certificate-federation',
        certificate,
        validation,
        timestamp: Date.now(),
        source: this.certificateManager.service.constructor.name
      };

      // Send to specific servers or broadcast to all
      if (servers && servers.length > 0) {
        const results = await Promise.allSettled(
          servers.map(serverId => this.serverManager.sendToServer(serverId, federationMessage))
        );
        const successful = results.filter(r => r.status === 'fulfilled').length;
        console.log(`Certificate federated to ${successful}/${servers.length} servers`);
        return successful > 0;
      } else {
        const broadcastResults = await this.serverManager.broadcast(federationMessage);
        console.log(`Certificate federated to ${broadcastResults.length} servers`);
        return broadcastResults.length > 0;
      }
    } catch (error) {
      console.error('Certificate federation failed:', error);
      return false;
    }
  }

  /**
   * Coordinate content caching based on priority and subscription patterns
   */
  async optimizeContentCaching(): Promise<void> {
    try {
      // Get high-priority updates
      const highPriorityUpdates = await this.updateManager.query({
        priorities: [0, 1, 2],
        limit: 100
      });

      // Get active subscriptions
      const activeSubscriptions = await this.subscriptionRegistry.query({
        status: 'active',
        limit: 100
      });

      // Analyze subscription patterns to predict caching needs
      const categoryDemand = new Map<string, number>();
      const priorityDemand = new Map<number, number>();

      for (const subscription of activeSubscriptions) {
        for (const category of subscription.categories) {
          categoryDemand.set(category, (categoryDemand.get(category) || 0) + 1);
        }
        for (const priority of subscription.priorities) {
          priorityDemand.set(priority, (priorityDemand.get(priority) || 0) + 1);
        }
      }

      // Create caching recommendations
      const cachingRecommendations = {
        type: 'caching-optimization',
        timestamp: Date.now(),
        recommendations: {
          highDemandCategories: Array.from(categoryDemand.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([category, demand]) => ({ category, demand })),
          priorityDistribution: Array.from(priorityDemand.entries())
            .map(([priority, demand]) => ({ priority, demand })),
          suggestedCacheSize: Math.max(1024 * 1024, activeSubscriptions.length * 50 * 1024), // 50KB per subscription minimum
          expiredContent: await this.updateManager.cleanup()
        }
      };

      // Broadcast recommendations to servers
      await this.serverManager.broadcast(cachingRecommendations);
      console.log('Content caching optimization completed');

    } catch (error) {
      console.error('Content caching optimization failed:', error);
    }
  }

  /**
   * Coordinate server approval and ban management
   */
  async manageServerApproval(serverId: string, action: 'approve' | 'ban' | 'unban', reason?: string): Promise<boolean> {
    try {
      const approvalMessage = {
        type: 'server-approval',
        action,
        serverId,
        reason,
        timestamp: Date.now(),
        authority: this.certificateManager.service.constructor.name
      };

      // Update local server status
      const connection = this.serverManager.getConnection(serverId);
      if (connection) {
        if (action === 'ban') {
          await this.serverManager.disconnect(serverId);
        } else if (action === 'approve' || action === 'unban') {
          // Server can be reconnected
        }
      }

      // Broadcast approval status to network
      const broadcastResults = await this.serverManager.broadcast(approvalMessage);
      console.log(`Server ${action} for ${serverId} broadcasted to ${broadcastResults.length} servers`);

      return true;
    } catch (error) {
      console.error(`Server ${action} failed:`, error);
      return false;
    }
  }

  /**
   * Get system-wide statistics
   */
  async getSystemStatistics(): Promise<{
    servers: import('../server-manager/index.js').ConnectionStats;
    subscriptions: import('../subscription-registry/index.js').SubscriptionStats;
    updates: any;
    certificates: any;
    compliance: any;
    integration: {
      certificateFederation: boolean;
      emergencyBroadcast: boolean;
      complianceMonitoring: boolean;
      contentCaching: boolean;
    };
  }> {
    const [
      serverStats,
      subscriptionStats,
      updateStats,
      certificateStats,
      complianceReport
    ] = await Promise.all([
      this.serverManager.getStatistics(),
      this.subscriptionRegistry?.getStatistics() || { totalSubscriptions: 0, activeSubscriptions: 0, expiredSubscriptions: 0, categoryBreakdown: {}, priorityBreakdown: {}, avgDeliveryRate: 0 },
      this.updateManager?.getStatistics() || { totalUpdates: 0, activeUpdates: 0, expiredUpdates: 0 },
      this.certificateManager.service.getStatistics(),
      typeof this.complianceManager.getComplianceStatus === 'function'
        ? this.complianceManager.getComplianceStatus()
        : { compliant: false, status: 'unknown' }
    ]);

    return {
      servers: serverStats,
      subscriptions: subscriptionStats,
      updates: updateStats,
      certificates: certificateStats,
      compliance: complianceReport,
      integration: {
        certificateFederation: true,
        emergencyBroadcast: true,
        complianceMonitoring: this.complianceManager ? true : false,
        contentCaching: true
      }
    };
  }

  /**
   * Emergency shutdown of all systems
   */
  async emergencyShutdown(): Promise<void> {
    console.warn('🚨 Emergency shutdown initiated');

    // Disconnect from all servers
    await this.serverManager.disconnectAll();

    // Stop compliance monitoring
    if (typeof this.complianceManager.dispose === 'function') {
      await this.complianceManager.dispose();
    }

    // Close database
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    console.log('🛑 Emergency shutdown complete');
  }

  /**
   * Dispose and cleanup all systems
   */
  dispose(): void {
    this.serverManager.dispose();
    this.certificateManager.dispose();
    if (typeof this.complianceManager.dispose === 'function') {
      this.complianceManager.dispose();
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Default export for convenience
export default DistributedSystemsManager;