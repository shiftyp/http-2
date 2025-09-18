/**
 * T024-T029: ContentRegistry Service
 * Manages CQ beacon storage with consolidation and TTL
 */

const ConsolidatedBeacon = require('../models/ConsolidatedBeacon');

class ContentRegistry {
  constructor(database) {
    this.db = database;
    this.cache = new Map(); // LRU cache for frequent queries
    this.cacheLimit = 100;
  }

  /**
   * T026: Implement path consolidation algorithm
   * Announce a new beacon or update existing
   */
  async announceBeacon(beaconUpdate) {
    const { contentHash, callsign, path, metadata, signalQuality, timestamp } = beaconUpdate;

    // Check if content already exists
    let beacon = await this.getContent(contentHash);
    let consolidated = false;

    if (beacon) {
      // Existing beacon - add/update path
      beacon.addPath({
        path,
        lastHeard: timestamp || new Date(),
        signalQuality: signalQuality || 0.5
      });

      // Update metadata if provided
      if (metadata) {
        if (metadata.size) beacon.size = metadata.size;
        if (metadata.mimeType) beacon.mimeType = metadata.mimeType;
        if (metadata.priority !== undefined) {
          beacon.priorityTier = metadata.priority;
          beacon.expiresAt = beacon.calculateExpiry();
        }
        if (metadata.url) beacon.url = metadata.url;
        if (metadata.chunks) {
          beacon.chunks = metadata.chunks;
          beacon.hasRFChunks = true;
        }
      }

      consolidated = true;
    } else {
      // New beacon
      beacon = new ConsolidatedBeacon({
        contentHash,
        callsign,
        url: metadata?.url,
        size: metadata?.size || 0,
        mimeType: metadata?.mimeType || 'application/octet-stream',
        chunks: metadata?.chunks,
        priorityTier: metadata?.priority || 5,
        paths: [{
          path,
          lastHeard: timestamp || new Date(),
          hopCount: path.length,
          signalQuality: signalQuality || 0.5
        }],
        hasRFChunks: Boolean(metadata?.chunks),
        metadata: metadata || {}
      });

      beacon.updatePathQuality();
    }

    // Validate before saving
    const errors = beacon.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Save to database
    await this.saveBeacon(beacon);

    // Update cache
    this.cache.set(contentHash, beacon);
    this.limitCache();

    // Update station trust
    await this.updateStationTrust(callsign, 'announce');

    return {
      success: true,
      contentHash,
      consolidated,
      pathCount: beacon.paths.length
    };
  }

  /**
   * Save beacon to database
   */
  async saveBeacon(beacon) {
    const row = beacon.toRow();

    const sql = `
      INSERT OR REPLACE INTO consolidated_beacons (
        content_hash, callsign, url, size, mime_type, chunks,
        priority_tier, created_at, expires_at, last_heard,
        paths, has_webrtc, has_rf_chunks, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(sql, [
      row.content_hash,
      row.callsign,
      row.url,
      row.size,
      row.mime_type,
      row.chunks,
      row.priority_tier,
      row.created_at,
      row.expires_at,
      row.last_heard,
      row.paths,
      row.has_webrtc,
      row.has_rf_chunks,
      row.metadata
    ]);
  }

  /**
   * Get content by hash
   */
  async getContent(contentHash) {
    // Check cache first
    if (this.cache.has(contentHash)) {
      return this.cache.get(contentHash);
    }

    const sql = 'SELECT * FROM consolidated_beacons WHERE content_hash = ?';
    const row = await this.db.get(sql, [contentHash]);

    if (!row) return null;

    const beacon = ConsolidatedBeacon.fromRow(row);

    // Update cache
    this.cache.set(contentHash, beacon);
    this.limitCache();

    return beacon;
  }

  /**
   * Search content with filters
   */
  async searchContent(filters = {}) {
    let sql = 'SELECT * FROM consolidated_beacons WHERE 1=1';
    const params = [];

    if (filters.hash) {
      sql += ' AND content_hash = ?';
      params.push(filters.hash);
    }

    if (filters.callsign) {
      sql += ' AND callsign = ?';
      params.push(filters.callsign);
    }

    if (filters.priority !== undefined) {
      sql += ' AND priority_tier <= ?';
      params.push(filters.priority);
    }

    sql += ' ORDER BY priority_tier ASC, last_heard DESC LIMIT 100';

    const rows = await this.db.all(sql, params);
    return rows.map(row => ConsolidatedBeacon.fromRow(row));
  }

  /**
   * Batch query content
   */
  async batchQuery(hashes) {
    const result = {};

    for (const hash of hashes) {
      const beacon = await this.getContent(hash);
      result[hash] = beacon ? beacon.toJSON() : null;
    }

    return result;
  }

  /**
   * T027: Implement TTL expiration logic
   * Remove expired content based on priority TTL
   */
  async expireContent() {
    const now = new Date().toISOString();
    const sql = 'DELETE FROM consolidated_beacons WHERE expires_at < ?';
    const result = await this.db.run(sql, [now]);

    // Clear cache of expired items
    for (const [hash, beacon] of this.cache) {
      if (beacon.isExpired()) {
        this.cache.delete(hash);
      }
    }

    return result.changes;
  }

  /**
   * T028: Implement storage eviction
   * Evict low priority content when approaching storage limit
   */
  async evictLowPriority() {
    // Check current storage size
    const countSql = 'SELECT COUNT(*) as count FROM consolidated_beacons';
    const { count } = await this.db.get(countSql);

    // 500,000 entries is approximately 1GB
    if (count < 450000) return 0; // 90% threshold

    // Delete lowest priority, oldest content
    const deleteSql = `
      DELETE FROM consolidated_beacons
      WHERE content_hash IN (
        SELECT content_hash
        FROM consolidated_beacons
        ORDER BY priority_tier DESC, last_heard ASC
        LIMIT ?
      )
    `;

    const toDelete = count - 400000; // Reduce to 80% capacity
    const result = await this.db.run(deleteSql, [toDelete]);

    return result.changes;
  }

  /**
   * T029: Implement conflict resolution
   * Resolve metadata conflicts between stations
   */
  async resolveConflicts(contentHash, newMetadata, reportingStation) {
    const beacon = await this.getContent(contentHash);
    if (!beacon) return null;

    const conflicts = beacon.metadata.conflicts || [];

    // Check for conflicts
    if (newMetadata.size && Math.abs(newMetadata.size - beacon.size) > beacon.size * 0.1) {
      conflicts.push({
        field: 'size',
        existing: beacon.size,
        reported: newMetadata.size,
        station: reportingStation,
        timestamp: new Date()
      });
    }

    if (newMetadata.mimeType && newMetadata.mimeType !== beacon.mimeType) {
      conflicts.push({
        field: 'mimeType',
        existing: beacon.mimeType,
        reported: newMetadata.mimeType,
        station: reportingStation,
        timestamp: new Date()
      });
    }

    // Apply majority consensus or trust most recent
    if (conflicts.length > 0) {
      beacon.metadata.conflicts = conflicts;

      // For now, trust most recent update
      if (newMetadata.size) beacon.size = newMetadata.size;
      if (newMetadata.mimeType) beacon.mimeType = newMetadata.mimeType;

      await this.saveBeacon(beacon);

      // Update station trust (penalize for conflicts)
      await this.updateStationTrust(reportingStation, 'conflict');
    }

    return conflicts;
  }

  /**
   * Update station trust score
   */
  async updateStationTrust(callsign, action) {
    const sql = `
      INSERT INTO station_trust (callsign, beacon_count)
      VALUES (?, 1)
      ON CONFLICT(callsign) DO UPDATE SET
        beacon_count = beacon_count + 1,
        ${action === 'conflict' ? 'conflict_count = conflict_count + 1,' : ''}
        last_active = CURRENT_TIMESTAMP
    `;

    await this.db.run(sql, [callsign]);
  }

  /**
   * Get station trust information
   */
  async getStationTrust(callsign) {
    const sql = 'SELECT * FROM station_trust WHERE callsign = ?';
    const row = await this.db.get(sql, [callsign]);

    if (!row) {
      return {
        callsign,
        trustScore: 50,
        beaconCount: 0,
        verifiedCount: 0,
        conflictCount: 0,
        maxEntries: 10,
        isVerified: false,
        canSetEmergency: false,
        firstSeen: null,
        lastActive: null
      };
    }

    // Calculate trust score
    const verifiedRatio = row.verified_count / Math.max(1, row.beacon_count);
    const conflictRatio = row.conflict_count / Math.max(1, row.beacon_count);
    row.trust_score = Math.max(0, Math.min(100,
      50 + (verifiedRatio * 50) - (conflictRatio * 30)
    ));

    return {
      callsign: row.callsign,
      trustScore: row.trust_score,
      beaconCount: row.beacon_count,
      verifiedCount: row.verified_count,
      conflictCount: row.conflict_count,
      maxEntries: row.is_verified ? 50 : 10,
      isVerified: Boolean(row.is_verified),
      canSetEmergency: Boolean(row.can_set_emergency),
      firstSeen: row.first_seen,
      lastActive: row.last_active
    };
  }

  /**
   * Delete content by hash
   */
  async deleteContent(contentHash) {
    const sql = 'DELETE FROM consolidated_beacons WHERE content_hash = ?';
    const result = await this.db.run(sql, [contentHash]);

    // Remove from cache
    this.cache.delete(contentHash);

    return result.changes > 0;
  }

  /**
   * Limit cache size
   */
  limitCache() {
    if (this.cache.size > this.cacheLimit) {
      const toDelete = this.cache.size - this.cacheLimit;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < toDelete; i++) {
        this.cache.delete(keys[i]);
      }
    }
  }

  /**
   * Get registry statistics
   */
  async getStats() {
    const stats = await this.db.get(`
      SELECT
        COUNT(*) as totalEntries,
        COUNT(DISTINCT callsign) as uniqueStations,
        SUM(CASE WHEN priority_tier = 0 THEN 1 ELSE 0 END) as emergencyContent,
        SUM(CASE WHEN priority_tier <= 3 THEN 1 ELSE 0 END) as priorityContent,
        AVG(json_array_length(paths)) as avgPathsPerContent
      FROM consolidated_beacons
    `);

    return stats;
  }
}

module.exports = ContentRegistry;