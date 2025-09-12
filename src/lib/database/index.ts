// IndexedDB wrapper for HTTP-over-Radio
import { ORM, QueryBuilder } from '../orm';

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

// Database schema for HTTP-over-Radio
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

export class Database {
  private db: IDBDatabase | null = null;
  private config: DBConfig;
  private orm: ORM;

  constructor(config: DBConfig = DB_CONFIG) {
    this.config = config;
    this.orm = new ORM(config.name);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create stores
        for (const storeConfig of this.config.stores) {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement
            });

            // Create indexes
            if (storeConfig.indexes) {
              for (const index of storeConfig.indexes) {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique,
                  multiEntry: index.multiEntry
                });
              }
            }
          }
        }
      };
    });
  }

  // Pages operations
  async savePage(page: any): Promise<void> {
    return this.orm.table('pages').put(page);
  }

  async getPage(path: string): Promise<any> {
    return this.orm.table('pages')
      .where('path')
      .equals(path)
      .first();
  }

  async getAllPages(): Promise<any[]> {
    return this.orm.table('pages').toArray();
  }

  async deletePage(id: string): Promise<void> {
    return this.orm.table('pages').delete(id);
  }

  // Server Apps operations
  async saveServerApp(app: any): Promise<void> {
    return this.orm.table('serverApps').put(app);
  }

  async getServerApp(path: string): Promise<any> {
    return this.orm.table('serverApps')
      .where('path')
      .equals(path)
      .first();
  }

  async getAllServerApps(): Promise<any[]> {
    return this.orm.table('serverApps').toArray();
  }

  // Mesh Nodes operations
  async saveMeshNode(node: any): Promise<void> {
    node.lastSeen = Date.now();
    return this.orm.table('meshNodes').put(node);
  }

  async getMeshNode(callsign: string): Promise<any> {
    return this.orm.table('meshNodes').get(callsign);
  }

  async getActiveMeshNodes(maxAge: number = 600000): Promise<any[]> {
    const cutoff = Date.now() - maxAge;
    return this.orm.table('meshNodes')
      .where('lastSeen')
      .above(cutoff)
      .toArray();
  }

  async cleanupStaleMeshNodes(maxAge: number = 3600000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const staleNodes = await this.orm.table('meshNodes')
      .where('lastSeen')
      .below(cutoff)
      .toArray();
    
    for (const node of staleNodes) {
      await this.orm.table('meshNodes').delete(node.callsign);
    }
  }

  // Messages operations
  async saveMessage(message: any): Promise<void> {
    message.timestamp = message.timestamp || Date.now();
    return this.orm.table('messages').add(message);
  }

  async getMessages(filter: { from?: string; to?: string; limit?: number }): Promise<any[]> {
    let query = this.orm.table('messages');
    
    if (filter.from) {
      query = query.where('from').equals(filter.from);
    } else if (filter.to) {
      query = query.where('to').equals(filter.to);
    }
    
    query = query.orderBy('timestamp').reverse();
    
    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    
    return query.toArray();
  }

  async markMessageAsRead(id: number): Promise<void> {
    const message = await this.orm.table('messages').get(id);
    if (message) {
      message.status = 'read';
      await this.orm.table('messages').put(message);
    }
  }

  // QSO Log operations
  async logQSO(qso: any): Promise<void> {
    qso.date = qso.date || new Date().toISOString();
    return this.orm.table('qsoLog').add(qso);
  }

  async getQSOLog(filter?: { callsign?: string; band?: string; limit?: number }): Promise<any[]> {
    let query = this.orm.table('qsoLog');
    
    if (filter?.callsign) {
      query = query.where('callsign').equals(filter.callsign);
    } else if (filter?.band) {
      query = query.where('band').equals(filter.band);
    }
    
    query = query.orderBy('date').reverse();
    
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }
    
    return query.toArray();
  }

  // Certificate operations
  async saveCertificate(cert: any): Promise<void> {
    return this.orm.table('certificates').put(cert);
  }

  async getCertificate(callsign: string): Promise<any> {
    return this.orm.table('certificates').get(callsign);
  }

  async getValidCertificates(): Promise<any[]> {
    const now = Date.now();
    return this.orm.table('certificates')
      .where('expiry')
      .above(now)
      .toArray();
  }

  // Settings operations
  async setSetting(key: string, value: any): Promise<void> {
    return this.orm.table('settings').put({ key, value });
  }

  async getSetting(key: string): Promise<any> {
    const setting = await this.orm.table('settings').get(key);
    return setting?.value;
  }

  async getAllSettings(): Promise<Record<string, any>> {
    const settings = await this.orm.table('settings').toArray();
    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    return result;
  }

  // Cache operations
  async cacheContent(url: string, content: any, metadata?: any): Promise<void> {
    const cacheEntry = {
      url,
      content,
      timestamp: Date.now(),
      size: new Blob([JSON.stringify(content)]).size,
      ...metadata
    };
    return this.orm.table('cache').put(cacheEntry);
  }

  async getCachedContent(url: string): Promise<any> {
    const entry = await this.orm.table('cache').get(url);
    return entry?.content;
  }

  async clearCache(olderThan?: number): Promise<void> {
    if (olderThan) {
      const cutoff = Date.now() - olderThan;
      const oldEntries = await this.orm.table('cache')
        .where('timestamp')
        .below(cutoff)
        .toArray();
      
      for (const entry of oldEntries) {
        await this.orm.table('cache').delete(entry.url);
      }
    } else {
      await this.orm.table('cache').clear();
    }
  }

  async getCacheSize(): Promise<number> {
    const entries = await this.orm.table('cache').toArray();
    return entries.reduce((total, entry) => total + (entry.size || 0), 0);
  }

  // Database maintenance
  async vacuum(): Promise<void> {
    // Clean up old data
    await this.cleanupStaleMeshNodes();
    await this.clearCache(7 * 24 * 60 * 60 * 1000); // Clear cache older than 7 days
    
    // Compact database (browser will handle this automatically)
    console.log('Database maintenance completed');
  }

  async exportData(): Promise<any> {
    const data: any = {};
    
    for (const store of this.config.stores) {
      data[store.name] = await this.orm.table(store.name).toArray();
    }
    
    return data;
  }

  async importData(data: any): Promise<void> {
    for (const [storeName, records] of Object.entries(data)) {
      if (Array.isArray(records)) {
        for (const record of records) {
          await this.orm.table(storeName).put(record);
        }
      }
    }
  }

  async clear(): Promise<void> {
    for (const store of this.config.stores) {
      await this.orm.table(store.name).clear();
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
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