const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

/**
 * Certificate Bootstrap Module
 * Handles initial certificate establishment for fresh deployments
 */
class CertificateBootstrap {
  constructor(dbPath = null, certsPath = './certificates') {
    // Use environment variable if set, otherwise default
    this.dbPath = path.resolve(dbPath || process.env.CERT_DB_PATH || './data/certificates.db');
    this.certsPath = path.resolve(certsPath);
    this.db = null;
    this.initializeDatabase();
    this.initializeDirectories();
  }

  /**
   * Initialize database
   */
  initializeDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Open or create database
    this.db = new Database(this.dbPath);
    
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        callsign TEXT NOT NULL,
        certificate_pem TEXT NOT NULL,
        trust_level INTEGER DEFAULT 0,
        type TEXT DEFAULT 'self-signed',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        description TEXT,
        emergency_use BOOLEAN DEFAULT 0,
        is_root BOOLEAN DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS trust_chain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certificate_id TEXT NOT NULL,
        parent_id TEXT,
        depth INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (certificate_id) REFERENCES certificates(id),
        FOREIGN KEY (parent_id) REFERENCES certificates(id)
      );
      
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /**
   * Initialize directories
   */
  initializeDirectories() {
    if (!fs.existsSync(this.certsPath)) {
      fs.mkdirSync(this.certsPath, { recursive: true });
    }
  }

  /**
   * Get bootstrap status
   */
  getStatus() {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM certificates');
    const result = countStmt.get();
    const certificateCount = result.count;
    
    const bootstrapNeeded = certificateCount === 0;
    
    // Get certificates list
    const certificates = [];
    if (certificateCount > 0) {
      const certsStmt = this.db.prepare(`
        SELECT id, callsign, trust_level, created_at, is_root 
        FROM certificates 
        ORDER BY created_at DESC
      `);
      const certs = certsStmt.all();
      
      certs.forEach(cert => {
        certificates.push({
          id: cert.id,
          callsign: cert.callsign,
          trustLevel: cert.trust_level,
          createdAt: new Date(cert.created_at * 1000).toISOString(),
          isRoot: cert.is_root === 1
        });
      });
    }
    
    // Get root certificate
    let rootCertificate = null;
    let trustChainDepth = 0;
    
    if (!bootstrapNeeded) {
      const rootStmt = this.db.prepare('SELECT * FROM certificates WHERE is_root = 1 LIMIT 1');
      const root = rootStmt.get();
      
      if (root) {
        rootCertificate = {
          id: root.id,
          callsign: root.callsign
        };
        
        // Calculate trust chain depth
        const depthStmt = this.db.prepare('SELECT MAX(depth) as max_depth FROM trust_chain');
        const depthResult = depthStmt.get();
        trustChainDepth = (depthResult.max_depth || 0) + 1;
      }
    }
    
    return {
      bootstrapNeeded,
      certificateCount,
      certificates,
      trustChainDepth,
      rootCertificate,
      serverReady: certificateCount > 0,
      timestamp: new Date().toISOString(),
      message: bootstrapNeeded ? 
        'Certificate bootstrap required. Please provide root certificate.' : 
        'Server certificates initialized.'
    };
  }

  /**
   * Bootstrap with root certificate
   */
  bootstrap(certificateData) {
    const { certificatePem, callsign, description, emergencyUse } = certificateData;

    // Validate required fields
    if (!certificatePem || !callsign) {
      throw new Error('Certificate and callsign are required');
    }

    // Validate callsign format (simplified)
    if (!this.validateCallsign(callsign)) {
      throw new Error('Invalid callsign format');
    }

    // Validate certificate format
    if (!this.validateCertificate(certificatePem)) {
      throw new Error('invalid certificate format');
    }

    // Check if already bootstrapped
    const status = this.getStatus();
    if (!status.bootstrapNeeded) {
      throw new Error('System already bootstrapped. Use certificate request process.');
    }
    
    // Generate certificate ID
    const certificateId = this.generateCertificateId();
    
    // Insert root certificate
    const insertStmt = this.db.prepare(`
      INSERT INTO certificates (
        id, callsign, certificate_pem, trust_level, 
        type, description, emergency_use, is_root
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      certificateId,
      callsign,
      certificatePem,
      3, // Highest trust level for root
      'root',
      description || 'Root certificate',
      emergencyUse ? 1 : 0,
      1 // Mark as root
    );
    
    // Create trust chain entry
    const chainStmt = this.db.prepare(`
      INSERT INTO trust_chain (certificate_id, parent_id, depth)
      VALUES (?, NULL, 0)
    `);
    
    chainStmt.run(certificateId);
    
    // Save certificate to file
    const certPath = path.join(this.certsPath, `${certificateId}.pem`);
    fs.writeFileSync(certPath, certificatePem);
    
    return {
      success: true,
      certificateId,
      trustLevel: 3,
      message: 'Certificate bootstrap complete. System is now ready.',
      emergencyMode: emergencyUse || false
    };
  }

  /**
   * Initialize with configuration
   */
  initialize(initData) {
    const { rootCertificate, config = {}, emergencyMode = false } = initData;
    
    // Check if already initialized
    const status = this.getStatus();
    if (!status.bootstrapNeeded) {
      throw new Error('System already initialized');
    }
    
    // Validate configuration
    const validatedConfig = this.validateConfig(config);
    
    // Bootstrap with root certificate
    const bootstrapResult = this.bootstrap(rootCertificate);
    
    // Save configuration
    Object.entries(validatedConfig).forEach(([key, value]) => {
      const configStmt = this.db.prepare(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
      );
      configStmt.run(key, JSON.stringify(value));
    });
    
    return {
      success: true,
      rootCertificateId: bootstrapResult.certificateId,
      config: validatedConfig,
      emergencyMode,
      message: emergencyMode ? 
        'Emergency mode initialization complete.' :
        'Certificate system initialized successfully.'
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    const defaults = {
      trustChainMaxDepth: 5,
      requireEmergencyCapability: false,
      allowSelfSigned: true
    };
    
    const validated = { ...defaults, ...config };
    
    // Validate trust chain depth
    if (validated.trustChainMaxDepth > 10) {
      throw new Error('Maximum trust chain depth exceeded (limit: 10)');
    }
    
    return validated;
  }

  /**
   * Validate callsign format
   */
  validateCallsign(callsign) {
    // Basic amateur radio callsign pattern
    // Allows 1-2 letters, 1 digit, 1-3 letters
    const pattern = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return pattern.test(callsign.toUpperCase());
  }

  /**
   * Validate certificate format
   */
  validateCertificate(certificatePem) {
    return certificatePem.includes('-----BEGIN CERTIFICATE-----') &&
           certificatePem.includes('-----END CERTIFICATE-----');
  }

  /**
   * Generate certificate ID
   */
  generateCertificateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Handle certificate request (after bootstrap)
   */
  handleRequest(requestData) {
    const { callsign, certificatePem, requestType, captchaSolution } = requestData;
    
    // Check if bootstrapped
    const status = this.getStatus();
    if (status.bootstrapNeeded) {
      throw new Error('System not bootstrapped. Bootstrap required first.');
    }
    
    // TODO: Validate CAPTCHA solution
    // This would integrate with the CAPTCHA system
    
    // Create pending request
    const requestId = crypto.randomBytes(8).toString('hex');
    
    return {
      requestId,
      status: 'pending_review',
      message: 'Certificate request submitted for review.'
    };
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = CertificateBootstrap;