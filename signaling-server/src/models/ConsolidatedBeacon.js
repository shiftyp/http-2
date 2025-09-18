/**
 * T019: ConsolidatedBeacon Model
 * Represents a content item with multiple access paths
 */

class ConsolidatedBeacon {
  constructor(data = {}) {
    // Primary key
    this.contentHash = data.contentHash || '';

    // Content metadata
    this.callsign = data.callsign || '';
    this.url = data.url || null;
    this.size = data.size || 0;
    this.mimeType = data.mimeType || 'application/octet-stream';
    this.chunks = data.chunks || null; // Array of chunk indices for RF

    // Priority and retention
    this.priorityTier = data.priorityTier || 5; // Default P5_Routine
    this.createdAt = data.createdAt || new Date();
    this.expiresAt = data.expiresAt || this.calculateExpiry();
    this.lastHeard = data.lastHeard || new Date();

    // Access paths (ordered by quality)
    this.paths = data.paths || [];

    // Availability modes
    this.hasWebRTC = data.hasWebRTC || false;
    this.hasRFChunks = data.hasRFChunks || false;

    // Metadata
    this.metadata = data.metadata || {};
  }

  /**
   * Calculate expiration based on priority tier
   */
  calculateExpiry() {
    const now = new Date();
    const ttlHours = {
      0: 30 * 24,  // P0: 30 days
      1: 14 * 24,  // P1: 14 days
      2: 7 * 24,   // P2: 7 days
      3: 14 * 24,  // P3: 14 days
      4: 3 * 24,   // P4: 3 days
      5: 6         // P5: 6 hours
    };

    const hours = ttlHours[this.priorityTier] || 6;
    return new Date(now.getTime() + (hours * 3600000));
  }

  /**
   * Convert to database row format
   */
  toRow() {
    return {
      content_hash: this.contentHash,
      callsign: this.callsign,
      url: this.url,
      size: this.size,
      mime_type: this.mimeType,
      chunks: this.chunks ? JSON.stringify(this.chunks) : null,
      priority_tier: this.priorityTier,
      created_at: this.createdAt.toISOString(),
      expires_at: this.expiresAt.toISOString(),
      last_heard: this.lastHeard.toISOString(),
      paths: JSON.stringify(this.paths),
      has_webrtc: this.hasWebRTC ? 1 : 0,
      has_rf_chunks: this.hasRFChunks ? 1 : 0,
      metadata: JSON.stringify(this.metadata)
    };
  }

  /**
   * Create from database row
   */
  static fromRow(row) {
    if (!row) return null;

    return new ConsolidatedBeacon({
      contentHash: row.content_hash,
      callsign: row.callsign,
      url: row.url,
      size: row.size,
      mimeType: row.mime_type,
      chunks: row.chunks ? JSON.parse(row.chunks) : null,
      priorityTier: row.priority_tier,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      lastHeard: new Date(row.last_heard),
      paths: row.paths ? JSON.parse(row.paths) : [],
      hasWebRTC: Boolean(row.has_webrtc),
      hasRFChunks: Boolean(row.has_rf_chunks),
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    });
  }

  /**
   * Validate beacon data
   */
  validate() {
    const errors = [];

    // Validate content hash (64 hex chars)
    if (!/^[a-fA-F0-9]{64}$/.test(this.contentHash)) {
      errors.push('Invalid content hash format');
    }

    // Validate callsign
    if (!/^[A-Z]{1,2}[0-9]{1}[A-Z]{1,4}$/.test(this.callsign)) {
      errors.push('Invalid callsign format');
    }

    // Validate priority tier
    if (this.priorityTier < 0 || this.priorityTier > 5) {
      errors.push('Priority tier must be 0-5');
    }

    // Validate paths
    if (this.paths.length > 10) {
      errors.push('Maximum 10 paths allowed');
    }

    this.paths.forEach((path, i) => {
      if (!path.path || !Array.isArray(path.path)) {
        errors.push(`Path ${i} missing route array`);
      }
      if (path.path && path.path.length > 7) {
        errors.push(`Path ${i} exceeds maximum 7 hops`);
      }
    });

    return errors;
  }

  /**
   * Add or update a path
   */
  addPath(pathRecord) {
    const pathKey = pathRecord.path.join('-');
    const existingIndex = this.paths.findIndex(p => p.path.join('-') === pathKey);

    if (existingIndex >= 0) {
      // Update existing path
      this.paths[existingIndex].lastHeard = pathRecord.lastHeard || new Date();
      this.paths[existingIndex].signalQuality = Math.max(
        this.paths[existingIndex].signalQuality,
        pathRecord.signalQuality || 0
      );
    } else {
      // Add new path
      this.paths.push({
        path: pathRecord.path,
        lastHeard: pathRecord.lastHeard || new Date(),
        hopCount: pathRecord.path.length,
        signalQuality: pathRecord.signalQuality || 0.5,
        qualityScore: 0 // Will be calculated
      });
    }

    // Recalculate quality scores and sort
    this.updatePathQuality();

    // Prune old paths and limit to 10
    this.prunePaths();

    // Update last heard
    this.lastHeard = new Date();
  }

  /**
   * Calculate quality scores for all paths
   */
  updatePathQuality() {
    const now = Date.now();

    this.paths.forEach(path => {
      const recencyWeight = 0.4;
      const hopWeight = 0.3;
      const signalWeight = 0.3;

      // Recency score (0-1, where 1 is most recent)
      const ageMinutes = (now - new Date(path.lastHeard).getTime()) / 60000;
      const recencyScore = Math.max(0, 1 - (ageMinutes / 60)); // Decay over 1 hour

      // Hop score (fewer hops = higher score)
      const hopScore = 1 / (1 + path.hopCount);

      // Signal score (already 0-1)
      const signalScore = path.signalQuality || 0.5;

      path.qualityScore =
        (recencyScore * recencyWeight) +
        (hopScore * hopWeight) +
        (signalScore * signalWeight);
    });

    // Sort by quality score (highest first)
    this.paths.sort((a, b) => b.qualityScore - a.qualityScore);
  }

  /**
   * Remove dead paths and limit to 10
   */
  prunePaths() {
    const cutoffTime = Date.now() - 3600000; // 1 hour

    this.paths = this.paths
      .filter(p => new Date(p.lastHeard).getTime() > cutoffTime)
      .slice(0, 10);
  }

  /**
   * Check if beacon has expired
   */
  isExpired() {
    return new Date() > this.expiresAt;
  }

  /**
   * Convert to JSON for API response
   */
  toJSON() {
    return {
      contentHash: this.contentHash,
      callsign: this.callsign,
      url: this.url,
      size: this.size,
      mimeType: this.mimeType,
      chunks: this.chunks,
      priorityTier: this.priorityTier,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      lastHeard: this.lastHeard.toISOString(),
      paths: this.paths,
      hasWebRTC: this.hasWebRTC,
      hasRFChunks: this.hasRFChunks,
      metadata: this.metadata
    };
  }
}

module.exports = ConsolidatedBeacon;