/**
 * IndexedDB Schema for OFDM Data Storage
 *
 * Defines database structure for storing OFDM transmission data,
 * carrier metrics, and chunk transmission history.
 */

export interface OFDMDatabase {
  name: string;
  version: number;
  stores: {
    transmissions: TransmissionRecord;
    carrierMetrics: CarrierMetric;
    chunkHistory: ChunkHistory;
    modulationProfiles: ModulationProfile;
    systemConfig: SystemConfig;
  };
}

export interface TransmissionRecord {
  id: string; // Primary key
  timestamp: number;
  callsign: string;
  mode: 'transmit' | 'receive';
  dataSize: number; // bytes
  duration: number; // ms
  avgSNR: number;
  avgBER: number;
  throughput: number; // bps
  modulationUsed: string[];
  success: boolean;
  metadata?: Record<string, any>;
}

export interface CarrierMetric {
  id: string; // carrierId_timestamp
  carrierId: number;
  timestamp: number;
  snr: number;
  ber: number;
  modulation: string;
  powerLevel: number;
  enabled: boolean;
  successRate: number;
  failureCount: number;
}

export interface ChunkHistory {
  id: string; // chunkId
  pieceIndex: number;
  totalPieces: number;
  size: number;
  hash: string;
  rarity: number;
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  completedAt?: number;
  carrierId?: number;
  transmissionTime?: number;
  status: 'pending' | 'transmitting' | 'completed' | 'failed';
}

export interface ModulationProfile {
  id: string; // modulation scheme name
  scheme: string;
  bitsPerSymbol: number;
  requiredSNR: number;
  targetBER: number;
  usageCount: number;
  successRate: number;
  avgThroughput: number;
}

export interface SystemConfig {
  id: string; // config name
  key: string;
  value: any;
  updatedAt: number;
  description?: string;
}

export class OFDMSchema {
  private dbName: string = 'ofdm-database';
  private dbVersion: number = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open OFDM database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createSchema(db);
      };
    });
  }

  /**
   * Create database schema
   */
  private createSchema(db: IDBDatabase): void {
    // Transmissions store
    if (!db.objectStoreNames.contains('transmissions')) {
      const transmissionStore = db.createObjectStore('transmissions', {
        keyPath: 'id'
      });
      transmissionStore.createIndex('timestamp', 'timestamp', { unique: false });
      transmissionStore.createIndex('callsign', 'callsign', { unique: false });
      transmissionStore.createIndex('mode', 'mode', { unique: false });
      transmissionStore.createIndex('success', 'success', { unique: false });
    }

    // Carrier metrics store
    if (!db.objectStoreNames.contains('carrierMetrics')) {
      const metricsStore = db.createObjectStore('carrierMetrics', {
        keyPath: 'id'
      });
      metricsStore.createIndex('carrierId', 'carrierId', { unique: false });
      metricsStore.createIndex('timestamp', 'timestamp', { unique: false });
      metricsStore.createIndex('modulation', 'modulation', { unique: false });
      metricsStore.createIndex('enabled', 'enabled', { unique: false });
    }

    // Chunk history store
    if (!db.objectStoreNames.contains('chunkHistory')) {
      const chunkStore = db.createObjectStore('chunkHistory', {
        keyPath: 'id'
      });
      chunkStore.createIndex('pieceIndex', 'pieceIndex', { unique: false });
      chunkStore.createIndex('status', 'status', { unique: false });
      chunkStore.createIndex('rarity', 'rarity', { unique: false });
      chunkStore.createIndex('attempts', 'attempts', { unique: false });
      chunkStore.createIndex('carrierId', 'carrierId', { unique: false });
    }

    // Modulation profiles store
    if (!db.objectStoreNames.contains('modulationProfiles')) {
      const profileStore = db.createObjectStore('modulationProfiles', {
        keyPath: 'id'
      });
      profileStore.createIndex('scheme', 'scheme', { unique: true });
      profileStore.createIndex('bitsPerSymbol', 'bitsPerSymbol', { unique: false });
      profileStore.createIndex('requiredSNR', 'requiredSNR', { unique: false });
    }

    // System config store
    if (!db.objectStoreNames.contains('systemConfig')) {
      const configStore = db.createObjectStore('systemConfig', {
        keyPath: 'id'
      });
      configStore.createIndex('key', 'key', { unique: true });
      configStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
  }

  /**
   * Save transmission record
   */
  async saveTransmission(record: TransmissionRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['transmissions'], 'readwrite');
    const store = transaction.objectStore('transmissions');

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save carrier metrics
   */
  async saveCarrierMetrics(metrics: CarrierMetric[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['carrierMetrics'], 'readwrite');
    const store = transaction.objectStore('carrierMetrics');

    const promises = metrics.map(metric => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put(metric);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
  }

  /**
   * Save chunk history
   */
  async saveChunkHistory(chunk: ChunkHistory): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['chunkHistory'], 'readwrite');
    const store = transaction.objectStore('chunkHistory');

    return new Promise((resolve, reject) => {
      const request = store.put(chunk);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get transmission history
   */
  async getTransmissionHistory(
    limit: number = 100,
    filter?: { callsign?: string; mode?: string; success?: boolean }
  ): Promise<TransmissionRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['transmissions'], 'readonly');
    const store = transaction.objectStore('transmissions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const records: TransmissionRecord[] = [];
      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && records.length < limit) {
          const record = cursor.value;

          // Apply filters
          if (!filter ||
              (!filter.callsign || record.callsign === filter.callsign) &&
              (!filter.mode || record.mode === filter.mode) &&
              (filter.success === undefined || record.success === filter.success)) {
            records.push(record);
          }

          cursor.continue();
        } else {
          resolve(records);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get carrier metrics history
   */
  async getCarrierMetrics(
    carrierId: number,
    startTime?: number,
    endTime?: number
  ): Promise<CarrierMetric[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['carrierMetrics'], 'readonly');
    const store = transaction.objectStore('carrierMetrics');
    const index = store.index('carrierId');

    return new Promise((resolve, reject) => {
      const metrics: CarrierMetric[] = [];
      const request = index.openCursor(IDBKeyRange.only(carrierId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const metric = cursor.value;

          if ((!startTime || metric.timestamp >= startTime) &&
              (!endTime || metric.timestamp <= endTime)) {
            metrics.push(metric);
          }

          cursor.continue();
        } else {
          resolve(metrics);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get chunk statistics
   */
  async getChunkStatistics(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    avgAttempts: number;
    avgTransmissionTime: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['chunkHistory'], 'readonly');
    const store = transaction.objectStore('chunkHistory');

    return new Promise((resolve, reject) => {
      const stats = {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        totalAttempts: 0,
        totalTransmissionTime: 0,
        completedWithTime: 0
      };

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const chunk = cursor.value;
          stats.total++;
          stats.totalAttempts += chunk.attempts;

          switch (chunk.status) {
            case 'completed':
              stats.completed++;
              if (chunk.transmissionTime) {
                stats.totalTransmissionTime += chunk.transmissionTime;
                stats.completedWithTime++;
              }
              break;
            case 'failed':
              stats.failed++;
              break;
            case 'pending':
            case 'transmitting':
              stats.pending++;
              break;
          }

          cursor.continue();
        } else {
          resolve({
            total: stats.total,
            completed: stats.completed,
            failed: stats.failed,
            pending: stats.pending,
            avgAttempts: stats.total > 0 ? stats.totalAttempts / stats.total : 0,
            avgTransmissionTime: stats.completedWithTime > 0
              ? stats.totalTransmissionTime / stats.completedWithTime
              : 0
          });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save system configuration
   */
  async saveConfig(key: string, value: any, description?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const config: SystemConfig = {
      id: key,
      key,
      value,
      updatedAt: Date.now(),
      description
    };

    const transaction = this.db.transaction(['systemConfig'], 'readwrite');
    const store = transaction.objectStore('systemConfig');

    return new Promise((resolve, reject) => {
      const request = store.put(config);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get system configuration
   */
  async getConfig(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['systemConfig'], 'readonly');
    const store = transaction.objectStore('systemConfig');

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const config = request.result;
        resolve(config ? config.value : undefined);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear old data
   */
  async clearOldData(daysToKeep: number = 7): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    // Clear old transmissions
    await this.clearOldRecords('transmissions', 'timestamp', cutoffTime);

    // Clear old carrier metrics
    await this.clearOldRecords('carrierMetrics', 'timestamp', cutoffTime);

    // Clear old incomplete chunks
    const transaction = this.db.transaction(['chunkHistory'], 'readwrite');
    const store = transaction.objectStore('chunkHistory');

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const chunk = cursor.value;

          if (chunk.status === 'failed' && chunk.lastAttempt < cutoffTime) {
            cursor.delete();
          }

          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear old records from a store
   */
  private async clearOldRecords(
    storeName: string,
    indexName: string,
    cutoffTime: number
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const range = IDBKeyRange.upperBound(cutoffTime);

    return new Promise((resolve, reject) => {
      const request = index.openKeyCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursor>).result;

        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export { OFDMSchema as default };