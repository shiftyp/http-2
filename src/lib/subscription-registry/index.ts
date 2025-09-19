/**
 * Subscription Registry
 *
 * Manages dynamic update subscriptions for distributed amateur radio networks.
 * Handles subscription lifecycle, preferences, and delivery tracking.
 * Task T062 per dynamic data implementation plan.
 */

import {
  Subscription,
  SubscriptionFilter,
  type SubscriptionInput
} from '../database/dynamic-data-schema.js';

export interface SubscriptionRegistryConfig {
  db: IDBDatabase;
  maxSubscriptions?: number;
  defaultTtl?: number; // milliseconds
}

export interface SubscriptionCreateOptions {
  callsign: string;
  categories: string[];
  priorities: number[];
  keywords?: string[];
  maxSize?: number;
  ttl?: number;
  delivery: {
    queueSize: number;
    retryCount: number;
    retryDelayMs: number;
  };
  filters?: SubscriptionFilter[];
}

export interface SubscriptionQueryOptions {
  callsign?: string;
  categories?: string[];
  priorities?: number[];
  active?: boolean;
  limit?: number;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<number, number>;
  avgDeliveryRate: number;
}

/**
 * Registry for managing dynamic update subscriptions
 */
export class SubscriptionRegistry {
  private db: IDBDatabase;
  private maxSubscriptions: number;
  private defaultTtl: number;

  constructor(config: SubscriptionRegistryConfig) {
    this.db = config.db;
    this.maxSubscriptions = config.maxSubscriptions || 1000;
    this.defaultTtl = config.defaultTtl || 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  /**
   * Create a new subscription
   */
  async create(options: SubscriptionCreateOptions): Promise<Subscription> {
    // Validate callsign
    this.validateCallsign(options.callsign);

    // Check subscription limit
    const existingCount = await this.countByCallsign(options.callsign);
    if (existingCount >= this.maxSubscriptions) {
      throw new Error(`Subscription limit exceeded for ${options.callsign}`);
    }

    // Validate priorities
    this.validatePriorities(options.priorities);

    // Validate categories
    this.validateCategories(options.categories);

    const now = Date.now();
    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      callsign: options.callsign,
      categories: [...options.categories],
      priorities: [...options.priorities],
      keywords: options.keywords || [],
      maxSize: options.maxSize || 50 * 1024, // 50KB default
      createdAt: now,
      updatedAt: now,
      expiresAt: now + (options.ttl || this.defaultTtl),
      isActive: true,
      delivery: {
        queueSize: Math.min(options.delivery.queueSize, 100), // Max 100 queued
        retryCount: Math.min(options.delivery.retryCount, 5), // Max 5 retries
        retryDelayMs: Math.max(options.delivery.retryDelayMs, 1000), // Min 1 second
        lastDeliveryAt: 0,
        deliveryCount: 0,
        failureCount: 0
      },
      filters: options.filters || [],
      metadata: {
        version: 1,
        source: 'USER',
        lastModified: now
      }
    };

    await this.store(subscription);
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

      request.onsuccess = () => {
        const subscription = request.result;
        if (subscription && !this.isExpired(subscription)) {
          resolve(subscription);
        } else {
          resolve(null);
        }
      };

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

      let request: IDBRequest;

      if (options.callsign) {
        const index = store.index('by_callsign');
        request = index.getAll(options.callsign);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        let subscriptions: Subscription[] = request.result || [];

        // Apply filters
        subscriptions = subscriptions.filter(sub => {
          // Active filter
          if (options.active !== undefined) {
            if (options.active && (!sub.isActive || this.isExpired(sub))) {
              return false;
            }
            if (!options.active && (sub.isActive && !this.isExpired(sub))) {
              return false;
            }
          }

          // Category filter
          if (options.categories) {
            const hasMatchingCategory = options.categories.some(cat =>
              sub.categories.includes(cat)
            );
            if (!hasMatchingCategory) {
              return false;
            }
          }

          // Priority filter
          if (options.priorities) {
            const hasMatchingPriority = options.priorities.some(pri =>
              sub.priorities.includes(pri)
            );
            if (!hasMatchingPriority) {
              return false;
            }
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
   * Get subscriptions for a specific callsign
   */
  async getByCallsign(callsign: string): Promise<Subscription[]> {
    return this.query({ callsign, active: true });
  }

  /**
   * Find matching subscriptions for an update
   */
  async findMatching(updateCategory: string, updatePriority: number, updateKeywords: string[] = []): Promise<Subscription[]> {
    const allSubscriptions = await this.query({ active: true });

    return allSubscriptions.filter(sub => {
      // Check category match
      if (!sub.categories.includes(updateCategory) && !sub.categories.includes('*')) {
        return false;
      }

      // Check priority match
      if (!sub.priorities.includes(updatePriority) && !sub.priorities.includes(-1)) { // -1 = all priorities
        return false;
      }

      // Check keyword match if subscription has keywords
      if (sub.keywords.length > 0) {
        const hasKeywordMatch = sub.keywords.some(keyword =>
          updateKeywords.some(updateKeyword =>
            updateKeyword.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        if (!hasKeywordMatch) {
          return false;
        }
      }

      // Apply custom filters
      if (sub.filters.length > 0) {
        const passesFilters = sub.filters.every(filter =>
          this.applyFilter(filter, updateCategory, updatePriority, updateKeywords)
        );
        if (!passesFilters) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Update subscription
   */
  async update(id: string, updates: Partial<SubscriptionCreateOptions>): Promise<Subscription> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Subscription ${id} not found`);
    }

    const updated: Subscription = {
      ...existing,
      updatedAt: Date.now(),
      metadata: {
        ...existing.metadata,
        version: existing.metadata.version + 1,
        lastModified: Date.now()
      }
    };

    // Apply updates
    if (updates.categories) {
      this.validateCategories(updates.categories);
      updated.categories = [...updates.categories];
    }

    if (updates.priorities) {
      this.validatePriorities(updates.priorities);
      updated.priorities = [...updates.priorities];
    }

    if (updates.keywords) {
      updated.keywords = [...updates.keywords];
    }

    if (updates.maxSize !== undefined) {
      updated.maxSize = updates.maxSize;
    }

    if (updates.delivery) {
      updated.delivery = {
        ...updated.delivery,
        queueSize: Math.min(updates.delivery.queueSize, 100),
        retryCount: Math.min(updates.delivery.retryCount, 5),
        retryDelayMs: Math.max(updates.delivery.retryDelayMs, 1000)
      };
    }

    if (updates.filters) {
      updated.filters = [...updates.filters];
    }

    if (updates.ttl) {
      updated.expiresAt = updated.createdAt + updates.ttl;
    }

    await this.store(updated);
    return updated;
  }

  /**
   * Update delivery statistics
   */
  async updateDeliveryStats(id: string, success: boolean): Promise<void> {
    const subscription = await this.get(id);
    if (!subscription) {
      throw new Error(`Subscription ${id} not found`);
    }

    subscription.delivery.lastDeliveryAt = Date.now();

    if (success) {
      subscription.delivery.deliveryCount++;
    } else {
      subscription.delivery.failureCount++;
    }

    subscription.updatedAt = Date.now();
    await this.store(subscription);
  }

  /**
   * Deactivate subscription
   */
  async deactivate(id: string): Promise<void> {
    const subscription = await this.get(id);
    if (!subscription) {
      throw new Error(`Subscription ${id} not found`);
    }

    subscription.isActive = false;
    subscription.updatedAt = Date.now();
    await this.store(subscription);
  }

  /**
   * Reactivate subscription
   */
  async reactivate(id: string, extendTtl?: number): Promise<void> {
    const subscription = await this.get(id);
    if (!subscription) {
      throw new Error(`Subscription ${id} not found`);
    }

    subscription.isActive = true;
    subscription.updatedAt = Date.now();

    if (extendTtl) {
      subscription.expiresAt = Date.now() + extendTtl;
    } else if (this.isExpired(subscription)) {
      // If expired, extend by default TTL
      subscription.expiresAt = Date.now() + this.defaultTtl;
    }

    await this.store(subscription);
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

  /**
   * Clean up expired subscriptions
   */
  async cleanup(): Promise<number> {
    const allSubscriptions = await this.query();
    const expired = allSubscriptions.filter(sub => this.isExpired(sub));

    for (const subscription of expired) {
      await this.delete(subscription.id);
    }

    return expired.length;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<SubscriptionStats> {
    const allSubscriptions = await this.query();
    const activeSubscriptions = allSubscriptions.filter(sub =>
      sub.isActive && !this.isExpired(sub)
    );

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    activeSubscriptions.forEach(sub => {
      sub.categories.forEach(cat => {
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });
    });

    // Priority breakdown
    const priorityBreakdown: Record<number, number> = {};
    activeSubscriptions.forEach(sub => {
      sub.priorities.forEach(pri => {
        priorityBreakdown[pri] = (priorityBreakdown[pri] || 0) + 1;
      });
    });

    // Calculate average delivery rate
    const totalDeliveries = activeSubscriptions.reduce((sum, sub) =>
      sum + sub.delivery.deliveryCount, 0
    );
    const totalAttempts = activeSubscriptions.reduce((sum, sub) =>
      sum + sub.delivery.deliveryCount + sub.delivery.failureCount, 0
    );
    const avgDeliveryRate = totalAttempts > 0 ? totalDeliveries / totalAttempts : 0;

    return {
      totalSubscriptions: allSubscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      expiredSubscriptions: allSubscriptions.length - activeSubscriptions.length,
      categoryBreakdown,
      priorityBreakdown,
      avgDeliveryRate
    };
  }

  /**
   * Export subscriptions for backup
   */
  async export(callsign?: string): Promise<Subscription[]> {
    if (callsign) {
      return this.getByCallsign(callsign);
    }
    return this.query();
  }

  /**
   * Import subscriptions from backup
   */
  async import(subscriptions: Subscription[]): Promise<number> {
    let imported = 0;

    for (const subscription of subscriptions) {
      try {
        // Validate before importing
        this.validateCallsign(subscription.callsign);
        this.validateCategories(subscription.categories);
        this.validatePriorities(subscription.priorities);

        await this.store(subscription);
        imported++;
      } catch (error) {
        console.warn(`Failed to import subscription ${subscription.id}:`, error);
      }
    }

    return imported;
  }

  // Private helper methods

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateCallsign(callsign: string): void {
    const callsignPattern = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    if (!callsignPattern.test(callsign)) {
      throw new Error(`Invalid callsign format: ${callsign}`);
    }
  }

  private validateCategories(categories: string[]): void {
    if (categories.length === 0) {
      throw new Error('At least one category is required');
    }

    for (const category of categories) {
      if (typeof category !== 'string' || category.length === 0) {
        throw new Error(`Invalid category: ${category}`);
      }
    }
  }

  private validatePriorities(priorities: number[]): void {
    if (priorities.length === 0) {
      throw new Error('At least one priority is required');
    }

    for (const priority of priorities) {
      if (!Number.isInteger(priority) || priority < -1 || priority > 5) {
        throw new Error(`Invalid priority: ${priority}. Must be -1 (all) or 0-5`);
      }
    }
  }

  private isExpired(subscription: Subscription): boolean {
    return Date.now() > subscription.expiresAt;
  }

  private async countByCallsign(callsign: string): Promise<number> {
    const subscriptions = await this.query({ callsign });
    return subscriptions.length;
  }

  private applyFilter(filter: SubscriptionFilter, category: string, priority: number, keywords: string[]): boolean {
    switch (filter.type) {
      case 'CATEGORY_EXCLUDE':
        return !filter.values.includes(category);

      case 'CATEGORY_INCLUDE':
        return filter.values.includes(category);

      case 'PRIORITY_EXCLUDE':
        return !filter.values.includes(priority.toString());

      case 'PRIORITY_INCLUDE':
        return filter.values.includes(priority.toString());

      case 'KEYWORD_EXCLUDE':
        return !filter.values.some(filterKeyword =>
          keywords.some(keyword =>
            keyword.toLowerCase().includes(filterKeyword.toLowerCase())
          )
        );

      case 'KEYWORD_INCLUDE':
        return filter.values.some(filterKeyword =>
          keywords.some(keyword =>
            keyword.toLowerCase().includes(filterKeyword.toLowerCase())
          )
        );

      case 'SIZE_LIMIT':
        // Would need update size to apply this filter
        return true;

      default:
        return true;
    }
  }

  private async store(subscription: Subscription): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readwrite');
      const store = transaction.objectStore('subscriptions');
      const request = store.put(subscription);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export default SubscriptionRegistry;