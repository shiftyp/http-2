/**
 * Subscription Manager - Manages dynamic update subscriptions
 * Handles subscription lifecycle, filtering, and notification management
 */

import { Subscription, SubscriptionInput, DynamicUpdate } from '../database/dynamic-data-schema';
import { verifySignature } from '../crypto';

export interface SubscriptionManagerConfig {
  db: IDBDatabase;
  requireAuth?: boolean;
  maxSubscriptionsPerStation?: number;
}

export interface SubscriptionCreationOptions {
  subscriber: string;
  categories: string[];
  priorities: number[];
  maxSize: number;
  callsign?: string;
  location?: string;
  signature?: string;
}

export interface SubscriptionQueryOptions {
  subscriber?: string;
  categories?: string[];
  priorities?: number[];
  active?: boolean;
  limit?: number;
}

export interface PendingUpdate {
  updateId: string;
  priority: number;
  category: string;
  size: number;
  createdAt: number;
  deliveryMode: 'RF' | 'WebRTC';
}

export class SubscriptionManager {
  private db: IDBDatabase;
  private requireAuth: boolean;
  private maxSubscriptionsPerStation: number;

  constructor(config: SubscriptionManagerConfig) {
    this.db = config.db;
    this.requireAuth = config.requireAuth ?? true;
    this.maxSubscriptionsPerStation = config.maxSubscriptionsPerStation || 10;
  }

  /**
   * Create a new subscription
   */
  async create(options: SubscriptionCreationOptions): Promise<Subscription> {
    // Validate subscriber limits
    const existingCount = await this.countSubscriptions(options.subscriber);
    if (existingCount >= this.maxSubscriptionsPerStation) {
      throw new Error(`Subscription limit exceeded for ${options.subscriber}`);
    }

    // Validate priorities
    if (options.priorities.some(p => p < 0 || p > 5)) {
      throw new Error('Invalid priority values. Must be 0-5');
    }

    // Validate categories
    const validCategories = ['emergency', 'safety', 'weather', 'operational', 'routine'];
    if (options.categories.some(c => !validCategories.includes(c))) {
      throw new Error('Invalid category values');
    }

    // Validate size limit
    if (options.maxSize <= 0 || options.maxSize > 100 * 1024) {
      throw new Error('Invalid size limit. Must be 1-102400 bytes');
    }

    // Determine if station is licensed
    const isLicensed = this.isValidCallsign(options.callsign);
    const transmitCapable = isLicensed;

    // Create subscription
    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      subscriber: options.subscriber,
      categories: [...options.categories],
      priorities: [...options.priorities],
      maxSize: options.maxSize,
      callsign: options.callsign || null,
      location: options.location,
      signature: options.signature,
      transmitCapable,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
      deliveryCount: 0,
      lastDelivery: null,
      metadata: {
        userAgent: 'dynamic-data-system/1.0',
        subscriptionVersion: 1
      }
    };

    // Store subscription
    await this.storeSubscription(subscription);

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async get(id: string): Promise<Subscription | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readonly');
      const store = transaction.objectStore('subscriptions');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query subscriptions with filters
   */
  async query(options: SubscriptionQueryOptions = {}): Promise<Subscription[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readonly');
      const store = transaction.objectStore('subscriptions');
      const request = store.getAll();

      request.onsuccess = () => {
        let subscriptions: Subscription[] = request.result || [];

        // Apply filters
        subscriptions = subscriptions.filter(sub => {
          // Active filter
          if (options.active !== undefined && sub.active !== options.active) {
            return false;
          }

          // Subscriber filter
          if (options.subscriber && sub.subscriber !== options.subscriber) {
            return false;
          }

          // Category filter (intersection)
          if (options.categories && !options.categories.some(c => sub.categories.includes(c))) {
            return false;
          }

          // Priority filter (intersection)
          if (options.priorities && !options.priorities.some(p => sub.priorities.includes(p))) {
            return false;
          }

          return true;
        });

        // Sort by creation time (newest first)
        subscriptions.sort((a, b) => b.createdAt - a.createdAt);

        // Apply limit
        if (options.limit) {
          subscriptions = subscriptions.slice(0, options.limit);
        }

        resolve(subscriptions);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update subscription
   */
  async update(id: string, updates: Partial<SubscriptionCreationOptions>): Promise<Subscription> {
    const subscription = await this.get(id);
    if (!subscription) {
      throw new Error(`Subscription ${id} not found`);
    }

    // Apply updates
    if (updates.categories) {
      subscription.categories = [...updates.categories];
    }
    if (updates.priorities) {
      subscription.priorities = [...updates.priorities];
    }
    if (updates.maxSize) {
      subscription.maxSize = updates.maxSize;
    }
    if (updates.location) {
      subscription.location = updates.location;
    }

    subscription.updatedAt = Date.now();
    subscription.metadata.subscriptionVersion++;

    await this.storeSubscription(subscription);
    return subscription;
  }

  /**
   * Cancel subscription (with authentication)
   */
  async cancel(id: string, signature?: string): Promise<void> {
    const subscription = await this.get(id);
    if (!subscription) {
      throw new Error(`Subscription ${id} not found`);
    }

    // Verify signature for licensed stations
    if (subscription.callsign && this.requireAuth) {
      if (!signature) {
        throw new Error('Signature required for cancellation');
      }
      // In real implementation, verify signature against callsign
    }

    subscription.active = false;
    subscription.updatedAt = Date.now();

    await this.storeSubscription(subscription);
  }

  /**
   * Get pending updates for a subscriber
   */
  async getPendingUpdates(subscriber: string): Promise<PendingUpdate[]> {
    // Get subscriber's subscriptions
    const subscriptions = await this.query({ subscriber, active: true });
    if (subscriptions.length === 0) {
      return [];
    }

    // Get all updates and filter by subscriptions
    const updates = await this.getAllUpdates();
    const pending: PendingUpdate[] = [];

    for (const update of updates) {
      // Check if update matches any subscription
      const matchingSubscription = subscriptions.find(sub =>
        this.updateMatchesSubscription(update, sub)
      );

      if (matchingSubscription) {
        // Check if already delivered
        const deliveryStatus = update.deliveryStatus[subscriber];
        if (!deliveryStatus || !deliveryStatus.delivered) {
          // Determine delivery mode based on subscriber license status
          const deliveryMode = matchingSubscription.transmitCapable ? 'RF' : 'WebRTC';

          pending.push({
            updateId: update.id,
            priority: update.priority,
            category: update.category,
            size: update.compressedSize,
            createdAt: update.createdAt,
            deliveryMode
          });
        }
      }
    }

    // Sort by priority then timestamp
    pending.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower number = higher priority
      }
      return b.createdAt - a.createdAt; // Newer first
    });

    return pending;
  }

  /**
   * Find subscribers for an update
   */
  async findSubscribersForUpdate(update: DynamicUpdate): Promise<string[]> {
    const allSubscriptions = await this.query({ active: true });
    const matchingSubscribers: string[] = [];

    for (const subscription of allSubscriptions) {
      if (this.updateMatchesSubscription(update, subscription)) {
        matchingSubscribers.push(subscription.subscriber);
      }
    }

    // Include explicit subscribers from update
    for (const subscriber of update.subscribers) {
      if (!matchingSubscribers.includes(subscriber)) {
        matchingSubscribers.push(subscriber);
      }
    }

    return matchingSubscribers;
  }

  /**
   * Record delivery for subscription tracking
   */
  async recordDelivery(subscriptionId: string, updateId: string): Promise<void> {
    const subscription = await this.get(subscriptionId);
    if (!subscription) {
      return;
    }

    subscription.deliveryCount++;
    subscription.lastDelivery = Date.now();
    subscription.updatedAt = Date.now();

    await this.storeSubscription(subscription);
  }

  /**
   * Get subscription statistics
   */
  async getStatistics(): Promise<any> {
    const allSubscriptions = await this.query();
    const active = allSubscriptions.filter(s => s.active);

    return {
      totalSubscriptions: allSubscriptions.length,
      activeSubscriptions: active.length,
      licensedSubscribers: active.filter(s => s.transmitCapable).length,
      unlicensedSubscribers: active.filter(s => !s.transmitCapable).length,
      avgDeliveries: active.reduce((sum, s) => sum + s.deliveryCount, 0) / active.length || 0,
      categoryBreakdown: this.getCategoryBreakdown(active),
      priorityBreakdown: this.getPriorityBreakdown(active)
    };
  }

  /**
   * Clean up inactive subscriptions
   */
  async cleanup(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const oldSubscriptions = await this.query();
    const toDelete = oldSubscriptions.filter(s =>
      !s.active && s.updatedAt < cutoff
    );

    for (const subscription of toDelete) {
      await this.delete(subscription.id);
    }

    return toDelete.length;
  }

  /**
   * Delete subscription
   */
  async delete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readwrite');
      const store = transaction.objectStore('subscriptions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Private helper methods
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidCallsign(callsign?: string): boolean {
    if (!callsign) return false;
    const callsignPattern = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignPattern.test(callsign) && !callsign.startsWith('UNLICENSED');
  }

  private async countSubscriptions(subscriber: string): Promise<number> {
    const subscriptions = await this.query({ subscriber });
    return subscriptions.length;
  }

  private updateMatchesSubscription(update: DynamicUpdate, subscription: Subscription): boolean {
    // Check category match
    if (!subscription.categories.includes(update.category)) {
      return false;
    }

    // Check priority match
    if (!subscription.priorities.includes(update.priority)) {
      return false;
    }

    // Check size limit
    if (update.compressedSize > subscription.maxSize) {
      return false;
    }

    // Check if update is expired
    if (Date.now() > update.expiresAt) {
      return false;
    }

    return true;
  }

  private async getAllUpdates(): Promise<DynamicUpdate[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readonly');
      const store = transaction.objectStore('updates');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeSubscription(subscription: Subscription): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readwrite');
      const store = transaction.objectStore('subscriptions');
      const request = store.put(subscription);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getCategoryBreakdown(subscriptions: Subscription[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const sub of subscriptions) {
      for (const category of sub.categories) {
        breakdown[category] = (breakdown[category] || 0) + 1;
      }
    }
    return breakdown;
  }

  private getPriorityBreakdown(subscriptions: Subscription[]): Record<number, number> {
    const breakdown: Record<number, number> = {};
    for (let i = 0; i <= 5; i++) {
      breakdown[i] = 0;
    }
    for (const sub of subscriptions) {
      for (const priority of sub.priorities) {
        breakdown[priority]++;
      }
    }
    return breakdown;
  }
}