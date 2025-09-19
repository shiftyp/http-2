/**
 * Update Manager - Core library for dynamic update creation and management
 * Handles update lifecycle, validation, and metadata management
 */

import { DynamicUpdate, DynamicUpdateInput, Subscription } from '../database/dynamic-data-schema';
import { generateECDSAKeyPair, signData, verifySignature } from '../crypto';
import { compress } from '../compression';

export interface UpdateManagerConfig {
  db: IDBDatabase;
  maxSize?: number;
  requireSignature?: boolean;
  callsign?: string;
}

export interface UpdateCreationOptions {
  category: string;
  priority: number;
  data: Uint8Array;
  originator: string;
  subscribers: string[];
  signature?: string;
  compress?: boolean;
  expiresAt?: Date;
}

export interface VersionCreationOptions {
  baseId: string;
  baseVersion: number;
  data: Uint8Array;
  originator: string;
  priority?: number;
  signature?: string;
  timestamp?: number;
  partitionId?: string;
}

export interface UpdateQueryOptions {
  categories?: string[];
  priorities?: number[];
  minTimestamp?: number;
  maxTimestamp?: number;
  originator?: string;
  limit?: number;
  includeExpired?: boolean;
}

export class UpdateManager {
  private db: IDBDatabase;
  private maxSize: number;
  private requireSignature: boolean;
  private callsign?: string;

  constructor(config: UpdateManagerConfig) {
    this.db = config.db;
    this.maxSize = config.maxSize || 50 * 1024; // 50KB default
    this.requireSignature = config.requireSignature ?? true;
    this.callsign = config.callsign;
  }

  /**
   * Create a new dynamic update
   */
  async create(options: UpdateCreationOptions): Promise<DynamicUpdate> {
    // Validate originator callsign
    if (!this.isValidCallsign(options.originator)) {
      throw new Error('unlicensed station cannot originate updates');
    }

    // Validate data size
    if (options.data.length > this.maxSize) {
      throw new Error(`Update size ${options.data.length} exceeds limit ${this.maxSize}`);
    }

    // Validate priority
    if (options.priority < 0 || options.priority > 5) {
      throw new Error(`Invalid priority ${options.priority}. Must be 0-5`);
    }

    // Compress data if requested
    let finalData = options.data;
    let compressionAlgorithm: string | undefined;
    let compressedSize = options.data.length;

    if (options.compress !== false) {
      try {
        const compressed = await compress(options.data);
        if (compressed.length < options.data.length * 0.9) { // Only use if >10% savings
          finalData = compressed;
          compressionAlgorithm = 'lz77';
          compressedSize = compressed.length;
        }
      } catch (error) {
        // Compression failed, use original data
      }
    }

    // Generate signature if required
    let signature = options.signature;
    if (this.requireSignature && !signature) {
      throw new Error('Signature required for update creation');
    }

    // Create update object
    const now = Date.now();
    const update: DynamicUpdate = {
      id: this.generateUpdateId(),
      version: 1,
      category: options.category,
      priority: options.priority,
      data: finalData,
      originalSize: options.data.length,
      compressedSize,
      compressionAlgorithm,
      originator: options.originator,
      signature,
      subscribers: [...options.subscribers],
      createdAt: now,
      updatedAt: now,
      expiresAt: options.expiresAt?.getTime() || this.calculateExpiration(options.priority),
      transmissionCount: 0,
      retryCount: 0,
      deliveryStatus: {},
      metadata: {
        contentType: this.detectContentType(options.data),
        checksum: await this.calculateChecksum(finalData)
      }
    };

    // Store in database
    await this.storeUpdate(update);

    return update;
  }

  /**
   * Create a new version of an existing update
   */
  async createVersion(options: VersionCreationOptions): Promise<DynamicUpdate> {
    // Get base update
    const baseUpdate = await this.get(options.baseId);
    if (!baseUpdate) {
      throw new Error(`Base update ${options.baseId} not found`);
    }

    // Validate version sequence
    if (options.baseVersion !== baseUpdate.version) {
      throw new Error(`Version mismatch: expected ${baseUpdate.version}, got ${options.baseVersion}`);
    }

    // Validate originator
    if (!this.isValidCallsign(options.originator)) {
      throw new Error('unlicensed station cannot create versions');
    }

    // Create new version
    const newUpdate: DynamicUpdate = {
      ...baseUpdate,
      id: options.baseId, // Same ID for versioning
      version: baseUpdate.version + 1,
      data: options.data,
      originalSize: options.data.length,
      compressedSize: options.data.length,
      priority: options.priority ?? baseUpdate.priority,
      originator: options.originator,
      signature: options.signature,
      updatedAt: options.timestamp || Date.now(),
      transmissionCount: 0,
      retryCount: 0,
      metadata: {
        ...baseUpdate.metadata,
        checksum: await this.calculateChecksum(options.data),
        parentVersion: baseUpdate.version,
        partitionId: options.partitionId
      }
    };

    await this.storeUpdate(newUpdate);
    return newUpdate;
  }

  /**
   * Get update by ID
   */
  async get(id: string): Promise<DynamicUpdate | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readonly');
      const store = transaction.objectStore('updates');
      const request = store.get(id);

      request.onsuccess = () => {
        const update = request.result;
        if (update && !this.isExpired(update)) {
          resolve(update);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query updates with filters
   */
  async query(options: UpdateQueryOptions = {}): Promise<DynamicUpdate[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readonly');
      const store = transaction.objectStore('updates');
      const request = store.getAll();

      request.onsuccess = () => {
        let updates: DynamicUpdate[] = request.result || [];

        // Apply filters
        updates = updates.filter(update => {
          // Skip expired unless requested
          if (!options.includeExpired && this.isExpired(update)) {
            return false;
          }

          // Category filter
          if (options.categories && !options.categories.includes(update.category)) {
            return false;
          }

          // Priority filter
          if (options.priorities && !options.priorities.includes(update.priority)) {
            return false;
          }

          // Timestamp filters
          if (options.minTimestamp && update.createdAt < options.minTimestamp) {
            return false;
          }

          if (options.maxTimestamp && update.createdAt > options.maxTimestamp) {
            return false;
          }

          // Originator filter
          if (options.originator && update.originator !== options.originator) {
            return false;
          }

          return true;
        });

        // Sort by priority (0=highest) then timestamp (newest first)
        updates.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return b.createdAt - a.createdAt;
        });

        // Apply limit
        if (options.limit) {
          updates = updates.slice(0, options.limit);
        }

        resolve(updates);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get holders (stations that have this update cached)
   */
  async getHolders(updateId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache_entries'], 'readonly');
      const store = transaction.objectStore('cache_entries');
      const index = store.index('by_update');
      const request = index.getAll(updateId);

      request.onsuccess = () => {
        const entries = request.result || [];
        const holders = entries
          .filter(entry => !this.isExpired({ expiresAt: entry.expiresAt }))
          .map(entry => entry.station);
        resolve([...new Set(holders)]); // Remove duplicates
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update delivery status for a subscriber
   */
  async updateDeliveryStatus(updateId: string, subscriber: string, delivered: boolean, timestamp?: number): Promise<void> {
    const update = await this.get(updateId);
    if (!update) {
      throw new Error(`Update ${updateId} not found`);
    }

    update.deliveryStatus[subscriber] = {
      delivered,
      timestamp: timestamp || Date.now()
    };

    await this.storeUpdate(update);
  }

  /**
   * Increment transmission count
   */
  async incrementTransmissionCount(updateId: string): Promise<void> {
    const update = await this.get(updateId);
    if (!update) {
      throw new Error(`Update ${updateId} not found`);
    }

    update.transmissionCount++;
    update.updatedAt = Date.now();

    await this.storeUpdate(update);
  }

  /**
   * Generate delta between two versions
   */
  async generateDelta(baseId: string, baseVersion: number, targetVersion: number): Promise<any> {
    // This would integrate with delta-sync library
    // For now, return placeholder
    throw new Error('Delta generation not implemented - integrate with delta-sync library');
  }

  /**
   * Clean up expired updates
   */
  async cleanup(): Promise<number> {
    const allUpdates = await this.query({ includeExpired: true });
    const expired = allUpdates.filter(update => this.isExpired(update));

    for (const update of expired) {
      await this.delete(update.id);
    }

    return expired.length;
  }

  /**
   * Delete update
   */
  async delete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readwrite');
      const store = transaction.objectStore('updates');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    const allUpdates = await this.query({ includeExpired: true });
    const active = allUpdates.filter(u => !this.isExpired(u));

    return {
      totalUpdates: allUpdates.length,
      activeUpdates: active.length,
      expiredUpdates: allUpdates.length - active.length,
      totalSize: allUpdates.reduce((sum, u) => sum + u.compressedSize, 0),
      avgCompressionRatio: this.calculateAvgCompression(allUpdates),
      priorityBreakdown: this.getPriorityBreakdown(active),
      categoryBreakdown: this.getCategoryBreakdown(active)
    };
  }

  // Private helper methods
  private generateUpdateId(): string {
    return `upd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidCallsign(callsign: string): boolean {
    // Simple callsign validation - real implementation would check FCC database
    const callsignPattern = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignPattern.test(callsign) && !callsign.startsWith('UNLICENSED');
  }

  private calculateExpiration(priority: number): number {
    const now = Date.now();
    const expirationHours = [
      30 * 24,  // P0: 30 days
      7 * 24,   // P1: 7 days
      24,       // P2: 24 hours
      1,        // P3: 1 hour
      1,        // P4: 1 hour
      1         // P5: 1 hour
    ];

    return now + (expirationHours[priority] * 60 * 60 * 1000);
  }

  private isExpired(update: { expiresAt: number }): boolean {
    return Date.now() > update.expiresAt;
  }

  private detectContentType(data: Uint8Array): string {
    // Simple content type detection
    if (data.length >= 4) {
      const header = Array.from(data.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (header.startsWith('7b') || header.startsWith('5b')) { // { or [
        return 'application/json';
      }
      if (header === '89504e47') {
        return 'image/png';
      }
      if (header.startsWith('ffd8ff')) {
        return 'image/jpeg';
      }
    }
    return 'application/octet-stream';
  }

  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async storeUpdate(update: DynamicUpdate): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['updates'], 'readwrite');
      const store = transaction.objectStore('updates');
      const request = store.put(update);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private calculateAvgCompression(updates: DynamicUpdate[]): number {
    const compressed = updates.filter(u => u.compressionAlgorithm);
    if (compressed.length === 0) return 0;

    const totalRatio = compressed.reduce((sum, u) => {
      return sum + (u.compressedSize / u.originalSize);
    }, 0);

    return totalRatio / compressed.length;
  }

  private getPriorityBreakdown(updates: DynamicUpdate[]): Record<number, number> {
    const breakdown: Record<number, number> = {};
    for (let i = 0; i <= 5; i++) {
      breakdown[i] = updates.filter(u => u.priority === i).length;
    }
    return breakdown;
  }

  private getCategoryBreakdown(updates: DynamicUpdate[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const update of updates) {
      breakdown[update.category] = (breakdown[update.category] || 0) + 1;
    }
    return breakdown;
  }
}