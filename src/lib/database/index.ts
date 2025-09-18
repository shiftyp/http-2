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
        { name: 'by_last_heard', keyPath: 'lastHeard' },
        { name: 'by_frequency', keyPath: 'frequency' }
      ]
    },
    {
      name: 'messages',
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'by_from', keyPath: 'from' },
        { name: 'by_to', keyPath: 'to' },
        { name: 'by_timestamp', keyPath: 'timestamp' }
      ]
    },
    {
      name: 'qsos',
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'by_callsign', keyPath: 'callsign' },
        { name: 'by_frequency', keyPath: 'frequency' },
        { name: 'by_timestamp', keyPath: 'timestamp' }
      ]
    },
    {
      name: 'settings',
      keyPath: 'key',
      indexes: [
        { name: 'by_category', keyPath: 'category' }
      ]
    },
    {
      name: 'certificates',
      keyPath: 'callsign',
      indexes: [
        { name: 'by_expires', keyPath: 'expiresAt' }
      ]
    }
  ]
};

export class Database {
  private config: DBConfig;
  private initialized = false;
  private messageCache = new Map<string, any[]>();
  private certificateCache = new Map<string, any>();

  constructor(config: DBConfig = DB_CONFIG) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize the logbook API
      await logbook.open();
      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Page operations
  async savePage(page: any): Promise<void> {
    await this.ensureInitialized();

    const pageEntry: PageEntry = {
      path: page.path || page.id,
      title: page.title || 'Untitled',
      content: JSON.stringify({
        id: page.id,
        title: page.title,
        components: page.components || [],
        layout: page.layout,
        metadata: page.metadata,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        siteId: page.siteId,
        slug: page.slug
      }),
      lastUpdated: new Date().toISOString(),
      author: page.author || page.siteId
    };

    await logbook.savePage(pageEntry);
  }

  async getPage(path: string): Promise<any> {
    await this.ensureInitialized();
    const page = await logbook.getPage(path);

    if (!page) return null;

    // Try to parse content as JSON, fallback to raw content
    try {
      const parsed = JSON.parse(page.content);
      // If parsed successfully and has an id, it's a structured page with components
      if (parsed.id) {
        return {
          ...parsed,
          path: page.path,
          lastModified: page.lastUpdated || parsed.updatedAt
        };
      }
      // Otherwise return the parsed content with page metadata
      return {
        ...parsed,
        path: page.path,
        lastModified: page.lastUpdated
      };
    } catch {
      // If not JSON, return the page as-is
      return {
        ...page,
        lastModified: page.lastUpdated
      };
    }
  }

  async getAllPages(): Promise<any[]> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();

    return pages.map(page => {
      try {
        const parsed = JSON.parse(page.content);
        return {
          ...parsed,
          path: page.path,
          lastModified: page.lastUpdated
        };
      } catch {
        return {
          ...page,
          lastModified: page.lastUpdated
        };
      }
    });
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

  async getActiveMeshNodes(maxAge?: number): Promise<MeshNode[]> {
    await this.ensureInitialized();
    // Convert maxAge from milliseconds to hours
    const hours = maxAge ? maxAge / (60 * 60 * 1000) : 1;
    return await logbook.getActiveNodes(hours);
  }

  async getMessages(options: { limit?: number; from?: string; to?: string; unread?: boolean } = {}): Promise<any[]> {
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
    if (options.from) {
      messages = messages.filter(msg => msg.from === options.from);
    }
    if (options.to) {
      messages = messages.filter(msg => msg.to === options.to);
    }
    if (options.unread !== undefined) {
      messages = messages.filter(msg => msg.unread === options.unread);
    }

    // Sort by timestamp (newest first)
    messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Apply limit
    if (options.limit) {
      messages = messages.slice(0, options.limit);
    }

    return messages;
  }

  async getQSOLog(options: { limit?: number; callsign?: string; frequency?: number } = {}): Promise<QSOEntry[]> {
    await this.ensureInitialized();
    let qsos = await logbook.findQSOs();

    // Apply filters
    if (options.callsign) {
      qsos = qsos.filter(qso => qso.callsign === options.callsign);
    }
    if (options.frequency) {
      qsos = qsos.filter(qso => qso.frequency === options.frequency);
    }

    return qsos.slice(0, options.limit || 100);
  }

  async getCacheSize(): Promise<number> {
    await this.ensureInitialized();
    // Estimate cache size - this is approximate
    const pages = await this.getAllPages();
    const qsos = await this.getQSOLog();
    return pages.length * 1024 + qsos.length * 256; // Rough estimate in bytes
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
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

  async deleteMessage(messageId: string): Promise<void> {
    await this.ensureInitialized();
    // This would need to be implemented in logbook as deletePage
    console.warn('Message deletion not yet implemented');
  }

  async getMessage(messageId: string): Promise<any> {
    await this.ensureInitialized();
    const message = await logbook.getPage(messageId);
    if (!message) return null;

    try {
      return JSON.parse(message.content);
    } catch {
      return message;
    }
  }

  // QSO Log operations
  async saveQSO(qso: any): Promise<void> {
    await this.ensureInitialized();

    const qsoEntry: QSOEntry = {
      callsign: qso.callsign,
      frequency: qso.frequency,
      mode: qso.mode || 'SSB',
      rstSent: qso.rstSent || '59',
      rstReceived: qso.rstReceived || '59',
      timestamp: qso.timestamp || new Date().toISOString(),
      gridSquare: qso.gridSquare,
      notes: qso.notes,
      power: qso.power
    };

    await logbook.logQSO(qsoEntry);
  }

  // Settings operations - store as pages with settings: prefix
  async saveSetting(key: string, value: any): Promise<void> {
    await this.ensureInitialized();
    const settingEntry: PageEntry = {
      path: `settings:${key}`,
      title: `Setting: ${key}`,
      content: JSON.stringify({ key, value, timestamp: Date.now() }),
      lastUpdated: new Date().toISOString(),
      author: 'system'
    };
    await logbook.savePage(settingEntry);
  }

  async getSetting(key: string, defaultValue?: any): Promise<any> {
    await this.ensureInitialized();
    const setting = await logbook.getPage(`settings:${key}`);
    if (!setting) return defaultValue;

    try {
      const parsed = JSON.parse(setting.content);
      return parsed.value;
    } catch {
      return defaultValue;
    }
  }

  async getAllSettings(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    const settings: Record<string, any> = {};

    pages
      .filter(page => page.path.startsWith('settings:'))
      .forEach(page => {
        try {
          const parsed = JSON.parse(page.content);
          const key = page.path.replace('settings:', '');
          settings[key] = parsed.value;
        } catch {
          // Skip invalid settings
        }
      });

    return settings;
  }

  async deleteSetting(key: string): Promise<void> {
    await this.ensureInitialized();
    // This would need to be implemented in logbook as deletePage
    console.warn('Setting deletion not yet implemented');
  }

  // Certificate operations - store as pages with cert: prefix
  async saveCertificate(cert: any): Promise<void> {
    await this.ensureInitialized();
    const certEntry: PageEntry = {
      path: `cert:${cert.callsign || cert.id}`,
      title: `Certificate: ${cert.callsign}`,
      content: JSON.stringify(cert),
      lastUpdated: new Date().toISOString(),
      author: cert.callsign
    };
    await logbook.savePage(certEntry);
  }

  async getCertificate(callsign: string): Promise<any> {
    await this.ensureInitialized();

    // Check cache first
    if (this.certificateCache.has(callsign)) {
      return this.certificateCache.get(callsign);
    }

    const cert = await logbook.getPage(`cert:${callsign}`);
    if (!cert) return null;

    try {
      const parsed = JSON.parse(cert.content);
      this.certificateCache.set(callsign, parsed);
      return parsed;
    } catch {
      return cert;
    }
  }

  async getCertificateFromStorage(callsign: string): Promise<any> {
    await this.ensureInitialized();
    const cert = await logbook.getPage(`cert:${callsign}`);
    if (!cert) return null;

    try {
      return JSON.parse(cert.content);
    } catch {
      return cert;
    }
  }

  async getValidCertificates(): Promise<any[]> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    const now = Date.now();

    return pages
      .filter(page => page.path.startsWith('cert:'))
      .map(page => {
        try {
          return JSON.parse(page.content);
        } catch {
          return null;
        }
      })
      .filter(cert => {
        if (!cert) return false;
        if (!cert.expiresAt) return true;
        return new Date(cert.expiresAt).getTime() > now;
      });
  }

  // Cache operations
  async cacheContent(key: string, data: any, ttl?: number): Promise<void> {
    await this.ensureInitialized();
    const cacheEntry: PageEntry = {
      path: `cache:${key}`,
      title: `Cache: ${key}`,
      content: JSON.stringify({
        data,
        cachedAt: Date.now(),
        ttl: ttl || 3600000, // Default 1 hour
        expiresAt: Date.now() + (ttl || 3600000)
      }),
      lastUpdated: new Date().toISOString(),
      author: 'cache'
    };
    await logbook.savePage(cacheEntry);
  }

  async getCachedContent(key: string): Promise<any> {
    await this.ensureInitialized();
    const cached = await logbook.getPage(`cache:${key}`);
    if (!cached) return null;

    try {
      const parsed = JSON.parse(cached.content);
      // Check if expired
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  async clearOldCache(maxAge: number = 3600000): Promise<void> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    const now = Date.now();

    // In a real implementation, we'd delete expired cache entries
    // For now, just log what would be deleted
    const expired = pages
      .filter(page => page.path.startsWith('cache:'))
      .filter(page => {
        try {
          const parsed = JSON.parse(page.content);
          return parsed.expiresAt && parsed.expiresAt < now;
        } catch {
          return false;
        }
      });

    console.log(`Would delete ${expired.length} expired cache entries`);
  }

  // Message operations with filters
  async getMessagesWithFilters(filters: { from?: string; to?: string; unread?: boolean } = {}): Promise<any[]> {
    const messages = await this.getMessages();

    return messages.filter(msg => {
      if (filters.from && msg.from !== filters.from) return false;
      if (filters.to && msg.to !== filters.to) return false;
      if (filters.unread !== undefined && msg.unread !== filters.unread) return false;
      return true;
    });
  }

  async markMessageAsRead(messageId: number | string): Promise<void> {
    // This is a placeholder - in reality would update the message
    console.log(`Message ${messageId} marked as read`);
  }

  // QSO operations with filters
  async logQSO(qso: QSOEntry): Promise<void> {
    await this.ensureInitialized();
    await logbook.logQSO(qso);
  }

  async getQSOLogWithFilters(filters: { callsign?: string; frequency?: number } = {}): Promise<QSOEntry[]> {
    await this.ensureInitialized();
    const qsos = await logbook.findQSOs();

    return qsos.filter(qso => {
      if (filters.callsign && qso.callsign !== filters.callsign) return false;
      if (filters.frequency && qso.frequency !== filters.frequency) return false;
      return true;
    });
  }

  async getAllCertificates(): Promise<any[]> {
    await this.ensureInitialized();
    const pages = await logbook.listPages();
    return pages
      .filter(page => page.path.startsWith('cert:'))
      .map(page => {
        try {
          return JSON.parse(page.content);
        } catch {
          return page;
        }
      });
  }

  // Backup and restore operations
  async exportData(): Promise<string> {
    await this.ensureInitialized();
    const data = {
      pages: await logbook.listPages(),
      qsos: await logbook.findQSOs(),
      nodes: await logbook.getActiveNodes(24 * 365),
      exportTimestamp: Date.now()
    };

    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    await this.ensureInitialized();
    const data = JSON.parse(jsonData);

    // Import pages
    if (data.pages) {
      for (const page of data.pages) {
        await logbook.savePage(page);
      }
    }

    // Import QSOs
    if (data.qsos) {
      for (const qso of data.qsos) {
        await logbook.recordQSO(qso);
      }
    }

    // Import nodes
    if (data.nodes) {
      for (const node of data.nodes) {
        await logbook.recordNode(node);
      }
    }
  }

  close(): void {
    logbook.close();
    this.initialized = false;
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

// Initialize on module load (except in test environment)
if (typeof window !== 'undefined' && !import.meta.env?.VITEST) {
  db.init().then(() => {
    console.log('Database initialized');
  }).catch(err => {
    console.error('Failed to initialize database:', err);
  });
}