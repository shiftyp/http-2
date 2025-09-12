import { DBSchema, IDBPDatabase, openDB } from 'idb';

// Database version for migrations
export const DB_VERSION = 1;
export const DB_NAME = 'ham-radio-pwa';

// Define the database schema
export interface HamRadioDBSchema extends DBSchema {
  // Configuration
  'config': {
    key: string;
    value: {
      key: string;
      value: any;
    };
  };
  
  // Radio station configuration
  'station': {
    key: string;
    value: {
      callsign: string;
      operatorName?: string;
      gridSquare?: string;
      radioModel?: string;
      serialPort?: string;
      audioInput?: string;
      audioOutput?: string;
      connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
      lastSeen: Date;
    };
  };
  
  // Static pages (Markdown/HTML)
  'static-pages': {
    key: string;
    value: {
      path: string;
      format: 'markdown' | 'html';
      content: string;
      metadata?: Record<string, any>;
      size: number;
      checksum: string;
      created: Date;
      updated: Date;
    };
    indexes: { 'by-path': string };
  };
  
  // Server functions (JavaScript)
  'server-functions': {
    key: string;
    value: {
      path: string;
      name: string;
      description?: string;
      code: string;
      version: string;
      handler: 'default' | 'named';
      methods: string[];
      contextUsage: {
        store: boolean;
        respond: boolean;
        crypto: boolean;
      };
      created: Date;
      updated: Date;
      lastExecuted?: Date;
      executionCount: number;
    };
    indexes: { 'by-path': string };
  };
  
  // Function databases (schemas)
  'function-databases': {
    key: string;
    value: {
      functionId: string;
      tables: Array<{
        name: string;
        fields: Record<string, any>;
        indexes: string[];
        recordCount: number;
      }>;
      version: number;
      created: Date;
      updated: Date;
    };
    indexes: { 'by-function': string };
  };
  
  // Function data (ORM storage)
  'function-data': {
    key: string;
    value: {
      id: string | number;
      functionId: string;
      tableName: string;
      data: Record<string, any>;
      created: Date;
      updated: Date;
      version?: number;
    };
    indexes: { 
      'by-function-table': [string, string];
      'by-function': string;
    };
  };
  
  // Data table views (spreadsheet configs)
  'data-table-views': {
    key: string;
    value: {
      id: string;
      functionId: string;
      tableName: string;
      columns: Array<{
        field: string;
        label: string;
        width: number;
        visible: boolean;
        pinned?: 'left' | 'right';
        format?: string;
      }>;
      filters: Array<{
        field: string;
        operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
        value: any;
      }>;
      sort: Array<{
        field: string;
        direction: 'asc' | 'desc';
      }>;
      pageSize: number;
      currentPage: number;
      name: string;
      isDefault: boolean;
      created: Date;
      updated: Date;
    };
    indexes: { 'by-function-table': [string, string] };
  };
  
  // Signing list entries
  'signing-list': {
    key: string;
    value: {
      callsign: string;
      publicKey: string;
      publicKeyBuffer: ArrayBuffer;
      trustLevel: number;
      verifiedBy?: string[];
      serialNumber: string;
      issuedAt: Date;
      expiresAt: Date;
      revoked: boolean;
      revokedAt?: Date;
      revokedReason?: string;
      name?: string;
      location?: string;
      email?: string;
      addedToList: Date;
      lastUpdated: Date;
      source: 'predistributed' | 'winlink' | 'manual';
    };
    indexes: { 
      'by-trust': number;
      'by-expiry': Date;
    };
  };
  
  // Registration queue (Winlink-style)
  'registration-queue': {
    key: string;
    value: {
      id: string;
      callsign: string;
      publicKey: string;
      requestedAt: Date;
      requestMessage: string;
      status: 'pending' | 'verifying' | 'approved' | 'rejected';
      verifierCallsign?: string;
      verifiedAt?: Date;
      verificationMethod?: 'winlink' | 'phone' | 'inperson';
      verificationNotes?: string;
      broadcastCount: number;
      lastBroadcast: Date;
      nextBroadcast: Date;
      coordinatorCallsign?: string;
      coordinatorFrequency?: number;
    };
    indexes: { 
      'by-status': string;
      'by-date': Date;
    };
  };
  
  // HTTP transmissions queue
  'transmissions': {
    key: string;
    value: {
      id: string;
      type: 'request' | 'response';
      source: string;
      destination: string;
      payload: Uint8Array;
      protocol: 'QPSK' | 'PSK31' | 'PACKET';
      baudRate: number;
      fecType: string;
      status: 'queued' | 'transmitting' | 'completed' | 'failed';
      progress: number;
      retryCount: number;
      maxRetries: number;
      queuedAt: Date;
      startedAt?: Date;
      completedAt?: Date;
      lastError?: string;
      errorCount: number;
    };
    indexes: { 
      'by-status': string;
      'by-date': Date;
    };
  };
  
  // Mesh network nodes
  'mesh-nodes': {
    key: string;
    value: {
      callsign: string;
      publicKey: string;
      neighbors: Array<{
        callsign: string;
        linkQuality: number;
        lastSeen: Date;
        hopCount: number;
      }>;
      routes: Array<{
        destination: string;
        nextHop: string;
        hopCount: number;
        metric: number;
        lastUpdated: Date;
      }>;
      capabilities: {
        canRelay: boolean;
        maxBandwidth: number;
        protocols: string[];
      };
      stats: {
        packetsRelayed: number;
        bytesRelayed: number;
        uptime: number;
      };
      lastHeartbeat: Date;
      status: 'online' | 'offline' | 'unknown';
    };
    indexes: { 
      'by-status': string;
      'by-quality': number;
    };
  };
  
  // Transmission logs (FCC compliance)
  'transmission-logs': {
    key: string;
    value: {
      id: string;
      timestamp: Date;
      callsign: string;
      frequency: number;
      mode: string;
      power: number;
      direction: 'transmit' | 'receive';
      remoteCallsign: string;
      duration: number;
      content: string;
    };
    indexes: { 
      'by-date': Date;
      'by-callsign': string;
    };
  };
}

// Initialize the database
export async function initDatabase(): Promise<IDBPDatabase<HamRadioDBSchema>> {
  return openDB<HamRadioDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // Config store
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
      
      // Station store
      if (!db.objectStoreNames.contains('station')) {
        db.createObjectStore('station', { keyPath: 'callsign' });
      }
      
      // Static pages store
      if (!db.objectStoreNames.contains('static-pages')) {
        const store = db.createObjectStore('static-pages', { keyPath: 'path' });
        store.createIndex('by-path', 'path');
      }
      
      // Server functions store
      if (!db.objectStoreNames.contains('server-functions')) {
        const store = db.createObjectStore('server-functions', { keyPath: 'path' });
        store.createIndex('by-path', 'path');
      }
      
      // Function databases store
      if (!db.objectStoreNames.contains('function-databases')) {
        const store = db.createObjectStore('function-databases', { keyPath: 'functionId' });
        store.createIndex('by-function', 'functionId');
      }
      
      // Function data store
      if (!db.objectStoreNames.contains('function-data')) {
        const store = db.createObjectStore('function-data', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('by-function-table', ['functionId', 'tableName']);
        store.createIndex('by-function', 'functionId');
      }
      
      // Data table views store
      if (!db.objectStoreNames.contains('data-table-views')) {
        const store = db.createObjectStore('data-table-views', { keyPath: 'id' });
        store.createIndex('by-function-table', ['functionId', 'tableName']);
      }
      
      // Signing list store
      if (!db.objectStoreNames.contains('signing-list')) {
        const store = db.createObjectStore('signing-list', { keyPath: 'callsign' });
        store.createIndex('by-trust', 'trustLevel');
        store.createIndex('by-expiry', 'expiresAt');
      }
      
      // Registration queue store
      if (!db.objectStoreNames.contains('registration-queue')) {
        const store = db.createObjectStore('registration-queue', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-date', 'requestedAt');
      }
      
      // Transmissions store
      if (!db.objectStoreNames.contains('transmissions')) {
        const store = db.createObjectStore('transmissions', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-date', 'queuedAt');
      }
      
      // Mesh nodes store
      if (!db.objectStoreNames.contains('mesh-nodes')) {
        const store = db.createObjectStore('mesh-nodes', { keyPath: 'callsign' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-quality', 'linkQuality');
      }
      
      // Transmission logs store
      if (!db.objectStoreNames.contains('transmission-logs')) {
        const store = db.createObjectStore('transmission-logs', { keyPath: 'id' });
        store.createIndex('by-date', 'timestamp');
        store.createIndex('by-callsign', 'callsign');
      }
      
      console.log(`Database upgraded from v${oldVersion} to v${newVersion}`);
    },
  });
}

// Database singleton instance
let dbInstance: IDBPDatabase<HamRadioDBSchema> | null = null;

export async function getDatabase(): Promise<IDBPDatabase<HamRadioDBSchema>> {
  if (!dbInstance) {
    dbInstance = await initDatabase();
  }
  return dbInstance;
}

// Helper to clear all data (for testing)
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  const stores = [
    'config', 'station', 'static-pages', 'server-functions',
    'function-databases', 'function-data', 'data-table-views',
    'signing-list', 'registration-queue', 'transmissions',
    'mesh-nodes', 'transmission-logs'
  ] as const;
  
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
}