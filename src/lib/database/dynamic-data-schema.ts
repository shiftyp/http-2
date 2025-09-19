/**
 * IndexedDB Schema for Dynamic Data System
 */

export const DYNAMIC_DATA_DB_NAME = 'http-radio-dynamic-data';
export const DYNAMIC_DATA_DB_VERSION = 1;

export interface DynamicUpdateRecord {
  id: string;
  version: number;
  etag: string;
  data: Uint8Array;
  contentType: string;
  compression: 'none' | 'lz77' | 'gzip';
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  category: string;
  created: number; // timestamp
  expires: number; // timestamp
  originator: string;
  subscribers: string[];
  signature: string;
  size: number;
}

export interface SubscriptionRecord {
  id: string;
  stationId: string;
  channel: string;
  created: number;
  active: boolean;
  licensed: boolean;
}

export interface RetryRequestRecord {
  id: string;
  updateId: string;
  version: number;
  requester: string;
  signature: string;
  timestamp: number;
  fulfilled: boolean;
  fulfiller?: string;
}

export interface UpdateCacheRecord {
  updateId: string;
  stationId: string;
  received: number;
  lastAccessed: number;
  size: number;
  priority: number;
}

export interface BeaconPathRecord {
  id: string; // origin_target
  originStation: string;
  targetStation: string;
  lastHeard: number;
  hopCount: number;
  signalStrength: number;
  mode: 'RF' | 'WebRTC';
}

export interface UpdateHolderRecord {
  id: string; // updateId_stationId
  updateId: string;
  stationId: string;
  receivedAt: number;
  available: boolean;
  licensed: boolean;
}

export function createDynamicDataSchema(db: IDBDatabase): void {
  // Dynamic updates store
  if (!db.objectStoreNames.contains('updates')) {
    const updateStore = db.createObjectStore('updates', { keyPath: 'id' });
    updateStore.createIndex('priority', 'priority', { unique: false });
    updateStore.createIndex('expires', 'expires', { unique: false });
    updateStore.createIndex('category', 'category', { unique: false });
    updateStore.createIndex('etag', 'etag', { unique: false });
  }

  // Subscriptions store
  if (!db.objectStoreNames.contains('subscriptions')) {
    const subStore = db.createObjectStore('subscriptions', { keyPath: 'id' });
    subStore.createIndex('channel', 'channel', { unique: false });
    subStore.createIndex('stationId', 'stationId', { unique: false });
    subStore.createIndex('active', 'active', { unique: false });
    subStore.createIndex('station_channel', ['stationId', 'channel'], { unique: true });
  }

  // Retry requests store
  if (!db.objectStoreNames.contains('retryRequests')) {
    const retryStore = db.createObjectStore('retryRequests', { keyPath: 'id' });
    retryStore.createIndex('updateId', 'updateId', { unique: false });
    retryStore.createIndex('requester', 'requester', { unique: false });
    retryStore.createIndex('fulfilled', 'fulfilled', { unique: false });
    retryStore.createIndex('timestamp', 'timestamp', { unique: false });
  }

  // Update cache metadata store
  if (!db.objectStoreNames.contains('updateCache')) {
    const cacheStore = db.createObjectStore('updateCache', { keyPath: 'updateId' });
    cacheStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    cacheStore.createIndex('size', 'size', { unique: false });
    cacheStore.createIndex('priority', 'priority', { unique: false });
    cacheStore.createIndex('stationId', 'stationId', { unique: false });
  }

  // Beacon paths store
  if (!db.objectStoreNames.contains('beaconPaths')) {
    const pathStore = db.createObjectStore('beaconPaths', { keyPath: 'id' });
    pathStore.createIndex('originStation', 'originStation', { unique: false });
    pathStore.createIndex('targetStation', 'targetStation', { unique: false });
    pathStore.createIndex('lastHeard', 'lastHeard', { unique: false });
    pathStore.createIndex('mode', 'mode', { unique: false });
  }

  // Update holders store
  if (!db.objectStoreNames.contains('updateHolders')) {
    const holderStore = db.createObjectStore('updateHolders', { keyPath: 'id' });
    holderStore.createIndex('updateId', 'updateId', { unique: false });
    holderStore.createIndex('stationId', 'stationId', { unique: false });
    holderStore.createIndex('licensed', 'licensed', { unique: false });
    holderStore.createIndex('available', 'available', { unique: false });
  }
}

export async function openDynamicDataDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DYNAMIC_DATA_DB_NAME, DYNAMIC_DATA_DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open dynamic data database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createDynamicDataSchema(db);
    };
  });
}

// Expiration times by priority (in milliseconds)
export const PRIORITY_EXPIRATION = {
  0: 30 * 24 * 60 * 60 * 1000,  // P0: 30 days
  1: 7 * 24 * 60 * 60 * 1000,   // P1: 7 days
  2: 24 * 60 * 60 * 1000,        // P2: 24 hours
  3: 60 * 60 * 1000,             // P3: 1 hour
  4: 60 * 60 * 1000,             // P4: 1 hour
  5: 60 * 60 * 1000,             // P5: 1 hour
};

// Helper to calculate expiration time
export function calculateExpiration(priority: number): number {
  const now = Date.now();
  const duration = PRIORITY_EXPIRATION[priority as keyof typeof PRIORITY_EXPIRATION] || PRIORITY_EXPIRATION[5];
  return now + duration;
}