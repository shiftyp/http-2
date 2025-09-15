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
  private initialized = false;
  private messageCache = new Map<string, any[]>();

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
      content: page.content || '',
      lastUpdated: new Date().toISOString(),
      author: page.author
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

  async getActiveMeshNodes(): Promise<MeshNode[]> {
    await this.ensureInitialized();
    return await logbook.getActiveNodes(1); // Get nodes active in last hour
  }

  async getMessages(options: { limit?: number } = {}): Promise<any[]> {
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

    // Sort by timestamp (newest first)
    messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Apply limit
    if (options.limit) {
      messages = messages.slice(0, options.limit);
    }

    return messages;
  }

  async getQSOLog(options: { limit?: number } = {}): Promise<QSOEntry[]> {
    await this.ensureInitialized();
    const qsos = await logbook.findQSOs();
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

    await logbook.recordQSO(qsoEntry);
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
    const cert = await logbook.getPage(`cert:${callsign}`);
    if (!cert) return null;

    try {
      return JSON.parse(cert.content);
    } catch {
      return cert;
    }
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