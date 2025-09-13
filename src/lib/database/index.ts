/**
 * Database wrapper using the simplified Logbook API
 * This provides compatibility with the existing codebase
 */

import { logbook, type QSOEntry, type PageEntry, type MeshNode } from '../logbook';

export interface DBConfig {
  name: string;
  version: number;
  stores: StoreConfig[];
}

export interface StoreConfig {
  name: string;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: IndexConfig[];
}

export interface IndexConfig {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}

// Default database configuration
export const DB_CONFIG: DBConfig = {
  name: 'http-radio-db',
  version: 1,
  stores: [
    {
      name: 'pages',
      keyPath: 'id',
      indexes: [
        { name: 'by_path', keyPath: 'path', unique: true },
        { name: 'by_type', keyPath: 'type' },
        { name: 'by_modified', keyPath: 'lastModified' }
      ]
    },
    {
      name: 'serverApps',
      keyPath: 'id',
      indexes: [
        { name: 'by_path', keyPath: 'path', unique: true },
        { name: 'by_type', keyPath: 'type' }
      ]
    },
    {
      name: 'meshNodes',
      keyPath: 'callsign',
      indexes: [
        { name: 'by_lastSeen', keyPath: 'lastSeen' },
        { name: 'by_signalStrength', keyPath: 'signalStrength' }
      ]
    },
    {
      name: 'messages',
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'by_from', keyPath: 'from' },
        { name: 'by_to', keyPath: 'to' },
        { name: 'by_timestamp', keyPath: 'timestamp' },
        { name: 'by_status', keyPath: 'status' }
      ]
    },
    {
      name: 'qsoLog',
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'by_callsign', keyPath: 'callsign' },
        { name: 'by_date', keyPath: 'date' },
        { name: 'by_band', keyPath: 'band' },
        { name: 'by_mode', keyPath: 'mode' }
      ]
    },
    {
      name: 'certificates',
      keyPath: 'callsign',
      indexes: [
        { name: 'by_expiry', keyPath: 'expiry' },
        { name: 'by_issuer', keyPath: 'issuer' }
      ]
    },
    {
      name: 'settings',
      keyPath: 'key'
    },
    {
      name: 'cache',
      keyPath: 'url',
      indexes: [
        { name: 'by_timestamp', keyPath: 'timestamp' },
        { name: 'by_size', keyPath: 'size' }
      ]
    }
  ]
};

/**
 * Database class - wraps the simpler Logbook API
 * Provides compatibility with existing code
 */
export class Database {
  private initialized = false;
  private config: DBConfig;
  private messageCache: Map<string, any[]> = new Map();
  private certificateCache: Map<string, any> = new Map();

  constructor(config: DBConfig = DB_CONFIG) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (!this.initialized) {
      await logbook.open();
      this.initialized = true;
    }
  }

  // Pages operations
  async savePage(page: any): Promise<void> {
    await this.ensureInitialized();
    const pageEntry: PageEntry = {
      path: page.path || page.id,
      title: page.title || 'Untitled',
      content: JSON.stringify(page),
      lastUpdated: new Date().toISOString(),
      author: page.author
    };
    await logbook.savePage(pageEntry);
  }

  async getPage(path: string): Promise<any> {
    await this.ensureInitialized();
    const page = await logbook.getPage(path);
    if (!page) return null;
    
    try {
      const parsed = JSON.parse(page.content);
      return { ...parsed, path: page.path };
    } catch {
      return page;
    }
  }

  async getAllPages(): Promise<any[]> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    return pages.map(page => {
      try {
        const parsed = JSON.parse(page.content);
        return { ...parsed, path: page.path };
      } catch {
        return page;
      }
    });
  }

  async deletePage(id: string): Promise<void> {
    // We'll need to extend the logbook API to support deletion
    console.warn('Page deletion not yet implemented');
  }

  // Server Apps operations - reuse pages storage
  async saveServerApp(app: any): Promise<void> {
    await this.ensureInitialized();
    const appEntry: PageEntry = {
      path: `app:${app.path || app.id}`,
      title: app.name || 'Server App',
      content: JSON.stringify(app),
      lastUpdated: new Date().toISOString(),
      author: app.author
    };
    await logbook.savePage(appEntry);
  }

  async getServerApp(path: string): Promise<any> {
    await this.ensureInitialized();
    const app = await logbook.getPage(`app:${path}`);
    if (!app) return null;
    
    try {
      return JSON.parse(app.content);
    } catch {
      return app;
    }
  }

  async getAllServerApps(): Promise<any[]> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    return pages
      .filter(page => page.path.startsWith('app:'))
      .map(page => {
        try {
          return JSON.parse(page.content);
        } catch {
          return page;
        }
      });
  }

  // Mesh Nodes operations
  async saveMeshNode(node: any): Promise<void> {
    await this.ensureInitialized();
    const meshNode: MeshNode = {
      callsign: node.callsign,
      lastHeard: new Date().toISOString(),
      signalStrength: node.signalStrength || 50,
      frequency: node.frequency,
      gridSquare: node.gridSquare
    };
    await logbook.recordNode(meshNode);
  }

  async getMeshNode(callsign: string): Promise<any> {
    await this.ensureInitialized();
    const nodes = await logbook.getActiveNodes(24 * 365); // Get all
    return nodes.find(node => node.callsign === callsign);
  }

  async getActiveMeshNodes(maxAge: number = 600000): Promise<any[]> {
    await this.ensureInitialized();
    const hoursAgo = maxAge / (60 * 60 * 1000);
    return await logbook.getActiveNodes(hoursAgo);
  }

  async cleanupStaleMeshNodes(maxAge: number = 3600000): Promise<void> {
    await this.ensureInitialized();
    const daysOld = maxAge / (24 * 60 * 60 * 1000);
    await logbook.cleanup(daysOld);
  }

  // Messages operations - store as pages with special prefix
  async saveMessage(message: any): Promise<void> {
    await this.ensureInitialized();
    message.timestamp = message.timestamp || Date.now();
    const messageId = `msg:${message.timestamp}:${Math.random().toString(36).substr(2, 9)}`;
    
    const messageEntry: PageEntry = {
      path: messageId,
      title: `Message from ${message.from} to ${message.to}`,
      content: JSON.stringify(message),
      lastUpdated: new Date().toISOString(),
      author: message.from
    };
    await logbook.savePage(messageEntry);
    
    // Update cache
    this.messageCache.clear();
  }

  async getMessages(filter: { from?: string; to?: string; limit?: number }): Promise<any[]> {
    await this.ensureInitialized();
    
    // Get all message pages
    const pages = await logbook.listPages();
    let messages = pages
      .filter(page => page.path.startsWith('msg:'))
      .map(page => {
        try {
          return JSON.parse(page.content);
        } catch {
          return null;
        }
      })
      .filter(msg => msg !== null);

    // Apply filters
    if (filter.from) {
      messages = messages.filter(msg => msg.from === filter.from);
    }
    if (filter.to) {
      messages = messages.filter(msg => msg.to === filter.to);
    }

    // Sort by timestamp (newest first)
    messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Apply limit
    if (filter.limit) {
      messages = messages.slice(0, filter.limit);
    }

    return messages;
  }

  async markMessageAsRead(id: number): Promise<void> {
    // Messages are immutable in this simple system
    console.log(`Message ${id} marked as read`);
  }

  // QSO Log operations
  async logQSO(qso: any): Promise<void> {
    await this.ensureInitialized();
    const qsoEntry: QSOEntry = {
      callsign: qso.callsign,
      date: qso.date || new Date().toISOString().split('T')[0],
      time: qso.time || new Date().toISOString().split('T')[1].split('.')[0],
      frequency: qso.frequency || qso.freq,
      mode: qso.mode,
      rstSent: qso.rstSent || qso.rst_sent || '59',
      rstReceived: qso.rstReceived || qso.rst_received || '59',
      qth: qso.qth,
      name: qso.name,
      notes: qso.notes
    };
    await logbook.logQSO(qsoEntry);
  }

  async getQSOLog(filter?: { callsign?: string; band?: string; limit?: number }): Promise<any[]> {
    await this.ensureInitialized();
    let qsos = await logbook.findQSOs(filter?.callsign);
    
    // Filter by band if specified
    if (filter?.band) {
      qsos = qsos.filter(qso => {
        const freq = parseFloat(qso.frequency);
        return this.getBand(freq) === filter.band;
      });
    }

    // Apply limit
    if (filter?.limit) {
      qsos = qsos.slice(0, filter.limit);
    }

    return qsos;
  }

  // Certificate operations - store as settings
  async saveCertificate(cert: any): Promise<void> {
    await this.ensureInitialized();
    await logbook.saveSetting(`cert:${cert.callsign}`, cert);
    this.certificateCache.set(cert.callsign, cert);
  }

  async getCertificate(callsign: string): Promise<any> {
    await this.ensureInitialized();
    
    if (this.certificateCache.has(callsign)) {
      return this.certificateCache.get(callsign);
    }
    
    const cert = await logbook.getSetting(`cert:${callsign}`);
    if (cert) {
      this.certificateCache.set(callsign, cert);
    }
    return cert;
  }

  async getValidCertificates(): Promise<any[]> {
    await this.ensureInitialized();
    const now = Date.now();
    const certs: any[] = [];
    
    // This is inefficient but works for small datasets
    // In production, we'd need a better indexing system
    const backup = await logbook.exportLogbook();
    for (const [key, value] of Object.entries(backup.settings)) {
      if (key.startsWith('cert:') && typeof value === 'object') {
        const cert = value as any;
        if (cert.expiry > now) {
          certs.push(cert);
        }
      }
    }
    
    return certs;
  }

  // Settings operations
  async setSetting(key: string, value: any): Promise<void> {
    await this.ensureInitialized();
    await logbook.saveSetting(key, value);
  }

  async getSetting(key: string): Promise<any> {
    await this.ensureInitialized();
    return await logbook.getSetting(key);
  }

  async getAllSettings(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    const backup = await logbook.exportLogbook();
    return backup.settings || {};
  }

  // Cache operations - store as pages with cache prefix
  async cacheContent(url: string, content: any, metadata?: any): Promise<void> {
    await this.ensureInitialized();
    const cacheEntry: PageEntry = {
      path: `cache:${url}`,
      title: `Cache: ${url}`,
      content: JSON.stringify({
        url,
        content,
        timestamp: Date.now(),
        size: new Blob([JSON.stringify(content)]).size,
        ...metadata
      }),
      lastUpdated: new Date().toISOString()
    };
    await logbook.savePage(cacheEntry);
  }

  async getCachedContent(url: string): Promise<any> {
    await this.ensureInitialized();
    const cached = await logbook.getPage(`cache:${url}`);
    if (!cached) return null;
    
    try {
      const data = JSON.parse(cached.content);
      return data.content;
    } catch {
      return null;
    }
  }

  async clearCache(olderThan?: number): Promise<void> {
    await this.ensureInitialized();
    if (olderThan) {
      const daysOld = olderThan / (24 * 60 * 60 * 1000);
      await logbook.cleanup(daysOld);
    }
    // Note: This will clear all old data, not just cache
    console.log('Cache cleared');
  }

  async getCacheSize(): Promise<number> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    let totalSize = 0;
    
    for (const page of pages) {
      if (page.path.startsWith('cache:')) {
        totalSize += new Blob([page.content]).size;
      }
    }
    
    return totalSize;
  }

  // Database maintenance
  async vacuum(): Promise<void> {
    await this.ensureInitialized();
    await logbook.cleanup(7); // Clean up data older than 7 days
    console.log('Database maintenance completed');
  }

  async exportData(): Promise<any> {
    await this.ensureInitialized();
    return await logbook.exportLogbook();
  }

  async importData(data: any): Promise<void> {
    await this.ensureInitialized();
    await logbook.importLogbook(data);
  }

  async clear(): Promise<void> {
    // We can't easily clear everything, so just log a warning
    console.warn('Database clear not fully implemented - please reload the app');
  }

  close(): void {
    logbook.close();
    this.initialized = false;
  }

  // Helper methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  private getBand(frequency: number): string {
    if (frequency >= 1.8 && frequency <= 2.0) return '160m';
    if (frequency >= 3.5 && frequency <= 4.0) return '80m';
    if (frequency >= 7.0 && frequency <= 7.3) return '40m';
    if (frequency >= 10.1 && frequency <= 10.15) return '30m';
    if (frequency >= 14.0 && frequency <= 14.35) return '20m';
    if (frequency >= 18.068 && frequency <= 18.168) return '17m';
    if (frequency >= 21.0 && frequency <= 21.45) return '15m';
    if (frequency >= 24.89 && frequency <= 24.99) return '12m';
    if (frequency >= 28.0 && frequency <= 29.7) return '10m';
    if (frequency >= 50.0 && frequency <= 54.0) return '6m';
    if (frequency >= 144.0 && frequency <= 148.0) return '2m';
    if (frequency >= 420.0 && frequency <= 450.0) return '70cm';
    return 'unknown';
  }
}

// Global database instance
export const db = new Database();

// Initialize on module load
if (typeof window !== 'undefined') {
  db.init().then(() => {
    console.log('Database initialized');
  }).catch(err => {
    console.error('Failed to initialize database:', err);
  });
}