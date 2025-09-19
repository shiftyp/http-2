/**
 * OFDM Persistence Layer (T031)
 * 
 * IndexedDB persistence for OFDM carrier metrics,
 * transmission history, and performance statistics.
 */

import { openDatabase } from './index.js';
import type { CarrierHealth } from '../carrier-health-monitor/index.js';
import type { SubcarrierAllocation } from '../parallel-chunk-manager/index.js';

export interface OFDMMetricRecord {
  id: string;
  timestamp: Date;
  carrierId: number;
  snr: number;
  ber: number;
  modulation: string;
  powerLevel: number;
  enabled: boolean;
  packetsTransmitted: number;
  packetsReceived: number;
  errorsDetected: number;
}

export interface TransmissionRecord {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
  totalBytes: number;
  bytesTransmitted: number;
  carriers: number[];
  averageThroughput: number;
  peakThroughput: number;
  retransmissions: number;
  metadata?: Record<string, any>;
}

export interface ChunkHistoryRecord {
  id: string;
  chunkId: string;
  carrierId: number;
  timestamp: Date;
  status: 'pending' | 'transmitting' | 'completed' | 'failed';
  size: number;
  duration: number;
  attempts: number;
  snr: number;
  modulation: string;
}

export interface AggregateStats {
  totalTransmissions: number;
  successfulTransmissions: number;
  failedTransmissions: number;
  totalBytesTransmitted: number;
  averageThroughput: number;
  averageSnr: number;
  carrierUtilization: Map<number, number>;
  modulationDistribution: Map<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * OFDM Persistence Manager
 */
export class OFDMPersistence {
  private db: IDBDatabase | null = null;
  private metricsCache = new Map<string, OFDMMetricRecord>();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    this.db = await openDatabase('ofdm-metrics', 2, {
      upgrade: (db, oldVersion) => {
        // Carrier metrics store
        if (!db.objectStoreNames.contains('carrier_metrics')) {
          const metricsStore = db.createObjectStore('carrier_metrics', {
            keyPath: 'id'
          });
          metricsStore.createIndex('timestamp', 'timestamp');
          metricsStore.createIndex('carrierId', 'carrierId');
          metricsStore.createIndex('carrier_time', ['carrierId', 'timestamp']);
        }

        // Transmission records store
        if (!db.objectStoreNames.contains('transmissions')) {
          const txStore = db.createObjectStore('transmissions', {
            keyPath: 'id'
          });
          txStore.createIndex('startTime', 'startTime');
          txStore.createIndex('status', 'status');
          txStore.createIndex('status_time', ['status', 'startTime']);
        }

        // Chunk history store
        if (!db.objectStoreNames.contains('chunk_history')) {
          const chunkStore = db.createObjectStore('chunk_history', {
            keyPath: 'id'
          });
          chunkStore.createIndex('chunkId', 'chunkId');
          chunkStore.createIndex('carrierId', 'carrierId');
          chunkStore.createIndex('timestamp', 'timestamp');
          chunkStore.createIndex('status', 'status');
        }

        // Aggregate stats store (for performance)
        if (!db.objectStoreNames.contains('aggregate_stats')) {
          const statsStore = db.createObjectStore('aggregate_stats', {
            keyPath: 'id',
            autoIncrement: true
          });
          statsStore.createIndex('timeRange', 'timeRange.start');
        }
      }
    });

    // Start flush interval
    this.startFlushInterval();
  }

  /**
   * Record carrier metrics
   */
  async recordCarrierMetrics(metrics: CarrierHealth[]): Promise<void> {
    const records: OFDMMetricRecord[] = metrics.map(m => ({
      id: `metric_${m.id}_${Date.now()}`,
      timestamp: new Date(),
      carrierId: m.id,
      snr: m.snr,
      ber: m.ber,
      modulation: m.modulation,
      powerLevel: m.powerLevel,
      enabled: m.enabled,
      packetsTransmitted: m.packetsTransmitted,
      packetsReceived: m.packetsReceived,
      errorsDetected: m.errorsDetected
    }));

    // Add to cache
    for (const record of records) {
      this.metricsCache.set(record.id, record);
    }

    // Flush if cache is full
    if (this.metricsCache.size >= this.MAX_CACHE_SIZE) {
      await this.flushMetrics();
    }
  }

  /**
   * Record transmission
   */
  async recordTransmission(transmission: TransmissionRecord): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['transmissions'], 'readwrite');
    await tx.objectStore('transmissions').put(transmission);
  }

  /**
   * Update transmission status
   */
  async updateTransmission(
    id: string,
    updates: Partial<TransmissionRecord>
  ): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['transmissions'], 'readwrite');
    const store = tx.objectStore('transmissions');
    
    const existing = await store.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      await store.put(updated);
    }
  }

  /**
   * Record chunk history
   */
  async recordChunkHistory(
    allocation: SubcarrierAllocation,
    carrierId: number
  ): Promise<void> {
    const record: ChunkHistoryRecord = {
      id: `chunk_${allocation.chunkId}_${carrierId}_${Date.now()}`,
      chunkId: allocation.chunkId,
      carrierId,
      timestamp: new Date(),
      status: allocation.status,
      size: allocation.size,
      duration: allocation.estimatedDuration,
      attempts: allocation.attempts || 1,
      snr: allocation.quality * 30, // Convert quality to SNR estimate
      modulation: allocation.modulation || 'QPSK'
    };

    if (!this.db) return;

    const tx = this.db.transaction(['chunk_history'], 'readwrite');
    await tx.objectStore('chunk_history').put(record);
  }

  /**
   * Get carrier metrics history
   */
  async getCarrierMetrics(
    carrierId: number,
    startTime?: Date,
    endTime?: Date
  ): Promise<OFDMMetricRecord[]> {
    if (!this.db) return [];

    const tx = this.db.transaction(['carrier_metrics'], 'readonly');
    const index = tx.objectStore('carrier_metrics').index('carrierId');
    
    const allRecords = await index.getAll(carrierId);
    
    // Filter by time range if specified
    if (startTime || endTime) {
      return allRecords.filter(r => {
        const time = r.timestamp.getTime();
        const start = startTime?.getTime() || 0;
        const end = endTime?.getTime() || Date.now();
        return time >= start && time <= end;
      });
    }

    return allRecords;
  }

  /**
   * Get transmission history
   */
  async getTransmissionHistory(
    status?: 'active' | 'completed' | 'failed',
    limit = 100
  ): Promise<TransmissionRecord[]> {
    if (!this.db) return [];

    const tx = this.db.transaction(['transmissions'], 'readonly');
    
    if (status) {
      const index = tx.objectStore('transmissions').index('status');
      const records = await index.getAll(status);
      return records.slice(-limit);
    } else {
      const records = await tx.objectStore('transmissions').getAll();
      return records.slice(-limit);
    }
  }

  /**
   * Get chunk success rate by carrier
   */
  async getChunkSuccessRate(carrierId?: number): Promise<Map<number, number>> {
    if (!this.db) return new Map();

    const tx = this.db.transaction(['chunk_history'], 'readonly');
    let records: ChunkHistoryRecord[];
    
    if (carrierId !== undefined) {
      const index = tx.objectStore('chunk_history').index('carrierId');
      records = await index.getAll(carrierId);
    } else {
      records = await tx.objectStore('chunk_history').getAll();
    }

    // Calculate success rate per carrier
    const carrierStats = new Map<number, { success: number; total: number }>();
    
    for (const record of records) {
      if (!carrierStats.has(record.carrierId)) {
        carrierStats.set(record.carrierId, { success: 0, total: 0 });
      }
      
      const stats = carrierStats.get(record.carrierId)!;
      stats.total++;
      if (record.status === 'completed') {
        stats.success++;
      }
    }

    // Convert to success rate
    const successRates = new Map<number, number>();
    for (const [carrier, stats] of carrierStats) {
      successRates.set(carrier, stats.total > 0 ? stats.success / stats.total : 0);
    }

    return successRates;
  }

  /**
   * Calculate aggregate statistics
   */
  async calculateAggregateStats(
    startTime: Date,
    endTime: Date
  ): Promise<AggregateStats> {
    if (!this.db) {
      return this.getEmptyStats(startTime, endTime);
    }

    // Get transmissions in range
    const txTx = this.db.transaction(['transmissions'], 'readonly');
    const transmissions = await txTx.objectStore('transmissions').getAll();
    const filteredTx = transmissions.filter(t => {
      const time = t.startTime.getTime();
      return time >= startTime.getTime() && time <= endTime.getTime();
    });

    // Get carrier metrics in range
    const metricsTx = this.db.transaction(['carrier_metrics'], 'readonly');
    const metrics = await metricsTx.objectStore('carrier_metrics').getAll();
    const filteredMetrics = metrics.filter(m => {
      const time = m.timestamp.getTime();
      return time >= startTime.getTime() && time <= endTime.getTime();
    });

    // Calculate stats
    const stats: AggregateStats = {
      totalTransmissions: filteredTx.length,
      successfulTransmissions: filteredTx.filter(t => t.status === 'completed').length,
      failedTransmissions: filteredTx.filter(t => t.status === 'failed').length,
      totalBytesTransmitted: filteredTx.reduce((sum, t) => sum + t.bytesTransmitted, 0),
      averageThroughput: 0,
      averageSnr: 0,
      carrierUtilization: new Map(),
      modulationDistribution: new Map(),
      timeRange: { start: startTime, end: endTime }
    };

    // Calculate average throughput
    if (filteredTx.length > 0) {
      const totalThroughput = filteredTx.reduce((sum, t) => sum + t.averageThroughput, 0);
      stats.averageThroughput = totalThroughput / filteredTx.length;
    }

    // Calculate average SNR and distributions
    if (filteredMetrics.length > 0) {
      const totalSnr = filteredMetrics.reduce((sum, m) => sum + m.snr, 0);
      stats.averageSnr = totalSnr / filteredMetrics.length;

      // Carrier utilization
      for (const metric of filteredMetrics) {
        const current = stats.carrierUtilization.get(metric.carrierId) || 0;
        stats.carrierUtilization.set(metric.carrierId, current + 1);
      }

      // Modulation distribution
      for (const metric of filteredMetrics) {
        const current = stats.modulationDistribution.get(metric.modulation) || 0;
        stats.modulationDistribution.set(metric.modulation, current + 1);
      }
    }

    // Store aggregate stats for faster retrieval
    await this.storeAggregateStats(stats);

    return stats;
  }

  /**
   * Store aggregate statistics
   */
  private async storeAggregateStats(stats: AggregateStats): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['aggregate_stats'], 'readwrite');
    await tx.objectStore('aggregate_stats').add({
      ...stats,
      carrierUtilization: Array.from(stats.carrierUtilization.entries()),
      modulationDistribution: Array.from(stats.modulationDistribution.entries())
    });
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(startTime: Date, endTime: Date): AggregateStats {
    return {
      totalTransmissions: 0,
      successfulTransmissions: 0,
      failedTransmissions: 0,
      totalBytesTransmitted: 0,
      averageThroughput: 0,
      averageSnr: 0,
      carrierUtilization: new Map(),
      modulationDistribution: new Map(),
      timeRange: { start: startTime, end: endTime }
    };
  }

  /**
   * Flush metrics cache to database
   */
  private async flushMetrics(): Promise<void> {
    if (!this.db || this.metricsCache.size === 0) return;

    const records = Array.from(this.metricsCache.values());
    const tx = this.db.transaction(['carrier_metrics'], 'readwrite');
    const store = tx.objectStore('carrier_metrics');

    for (const record of records) {
      await store.put(record);
    }

    this.metricsCache.clear();
  }

  /**
   * Start flush interval
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch(console.error);
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Cleanup old records
   */
  async cleanupOldRecords(daysToKeep = 7): Promise<void> {
    if (!this.db) return;

    const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Cleanup carrier metrics
    const metricsTx = this.db.transaction(['carrier_metrics'], 'readwrite');
    const metricsIndex = metricsTx.objectStore('carrier_metrics').index('timestamp');
    const metricsRange = IDBKeyRange.upperBound(cutoffTime);
    const oldMetrics = await metricsIndex.getAllKeys(metricsRange);
    
    for (const key of oldMetrics) {
      await metricsTx.objectStore('carrier_metrics').delete(key);
    }

    // Cleanup transmissions
    const txTx = this.db.transaction(['transmissions'], 'readwrite');
    const txIndex = txTx.objectStore('transmissions').index('startTime');
    const txRange = IDBKeyRange.upperBound(cutoffTime);
    const oldTx = await txIndex.getAllKeys(txRange);
    
    for (const key of oldTx) {
      await txTx.objectStore('transmissions').delete(key);
    }

    // Cleanup chunk history
    const chunkTx = this.db.transaction(['chunk_history'], 'readwrite');
    const chunkIndex = chunkTx.objectStore('chunk_history').index('timestamp');
    const chunkRange = IDBKeyRange.upperBound(cutoffTime);
    const oldChunks = await chunkIndex.getAllKeys(chunkRange);
    
    for (const key of oldChunks) {
      await chunkTx.objectStore('chunk_history').delete(key);
    }
  }

  /**
   * Export data for analysis
   */
  async exportData(
    startTime?: Date,
    endTime?: Date
  ): Promise<{
    metrics: OFDMMetricRecord[];
    transmissions: TransmissionRecord[];
    chunks: ChunkHistoryRecord[];
  }> {
    if (!this.db) {
      return { metrics: [], transmissions: [], chunks: [] };
    }

    const start = startTime?.getTime() || 0;
    const end = endTime?.getTime() || Date.now();

    // Get all data
    const metricsTx = this.db.transaction(['carrier_metrics'], 'readonly');
    const allMetrics = await metricsTx.objectStore('carrier_metrics').getAll();
    const metrics = allMetrics.filter(m => {
      const time = m.timestamp.getTime();
      return time >= start && time <= end;
    });

    const txTx = this.db.transaction(['transmissions'], 'readonly');
    const allTx = await txTx.objectStore('transmissions').getAll();
    const transmissions = allTx.filter(t => {
      const time = t.startTime.getTime();
      return time >= start && time <= end;
    });

    const chunkTx = this.db.transaction(['chunk_history'], 'readonly');
    const allChunks = await chunkTx.objectStore('chunk_history').getAll();
    const chunks = allChunks.filter(c => {
      const time = c.timestamp.getTime();
      return time >= start && time <= end;
    });

    return { metrics, transmissions, chunks };
  }

  /**
   * Close database and cleanup
   */
  async close(): Promise<void> {
    // Flush remaining metrics
    await this.flushMetrics();

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Close database
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const ofdmPersistence = new OFDMPersistence();