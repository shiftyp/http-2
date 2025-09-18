/**
 * SQLite Database Initialization with better-sqlite3
 * T006: Setup SQLite database initialization script
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseWrapper {
  constructor(dbPath = path.join(__dirname, '../../cq-registry.db')) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async connect() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      console.log(`Connected to SQLite database at ${this.dbPath}`);
    } catch (err) {
      console.error('Failed to connect to database:', err);
      throw err;
    }
  }

  async initialize() {
    await this.connect();
    await this.createTables();
    await this.createIndexes();
    return this.db;
  }

  async createTables() {
    const schemas = [
      // Consolidated beacons table with JSON columns
      `CREATE TABLE IF NOT EXISTS consolidated_beacons (
        content_hash TEXT PRIMARY KEY,
        callsign TEXT NOT NULL,
        url TEXT,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        chunks TEXT, -- JSON array
        priority_tier INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        last_heard DATETIME DEFAULT CURRENT_TIMESTAMP,
        paths TEXT NOT NULL, -- JSON array of path objects
        has_webrtc BOOLEAN DEFAULT 0,
        has_rf_chunks BOOLEAN DEFAULT 0,
        metadata TEXT -- JSON object
      )`,

      // Station trust tracking
      `CREATE TABLE IF NOT EXISTS station_trust (
        callsign TEXT PRIMARY KEY,
        trust_score REAL DEFAULT 50.0,
        beacon_count INTEGER DEFAULT 0,
        verified_count INTEGER DEFAULT 0,
        conflict_count INTEGER DEFAULT 0,
        max_entries INTEGER DEFAULT 10,
        is_verified BOOLEAN DEFAULT 0,
        can_set_emergency BOOLEAN DEFAULT 0,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Priority votes for network consensus
      `CREATE TABLE IF NOT EXISTS priority_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_hash TEXT NOT NULL,
        callsign TEXT NOT NULL,
        priority_tier INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        weight REAL DEFAULT 1.0,
        FOREIGN KEY (content_hash) REFERENCES consolidated_beacons(content_hash) ON DELETE CASCADE,
        UNIQUE(content_hash, callsign)
      )`
    ];

    for (const schema of schemas) {
      this.db.exec(schema);
    }
  }

  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_priority_expires ON consolidated_beacons(priority_tier, expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_callsign ON consolidated_beacons(callsign)',
      'CREATE INDEX IF NOT EXISTS idx_last_heard ON consolidated_beacons(last_heard)',
      'CREATE INDEX IF NOT EXISTS idx_expires ON consolidated_beacons(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_votes_hash ON priority_votes(content_hash)',
      'CREATE INDEX IF NOT EXISTS idx_trust_verified ON station_trust(is_verified)'
    ];

    for (const index of indexes) {
      this.db.exec(index);
    }
  }

  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params);
      return Promise.resolve(row);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      return Promise.resolve(rows);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  close() {
    try {
      if (this.db) {
        this.db.close();
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

module.exports = DatabaseWrapper;