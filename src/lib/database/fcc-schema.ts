/**
 * FCC Compliance IndexedDB Schema
 *
 * Database schema for storing FCC compliance data including audit logs,
 * callsign records, and compliance events per task T002.
 */

export const FCC_COMPLIANCE_DB = 'fcc_compliance';
export const FCC_COMPLIANCE_VERSION = 1;

export const FCC_STORES = {
  COMPLIANCE_LOG: 'compliance_log',
  CALLSIGN_RECORDS: 'callsign_records',
  STATION_ID_EVENTS: 'station_id_events',
  VIOLATION_HISTORY: 'violation_history'
} as const;

export interface ComplianceLogEntry {
  logId: string;
  timestamp: number;
  eventType: 'STATION_ID' | 'ENCRYPTION_BLOCK' | 'CONTENT_FILTER' | 'CALLSIGN_VALIDATION' | 'VIOLATION';
  description: string;
  operatorCallsign: string;
  transmissionMode: 'RF' | 'WEBRTC' | 'HYBRID';
  severity: 'INFO' | 'WARNING' | 'VIOLATION';
  details: any;
  resolved: boolean;
}

export interface CallsignRecord {
  callsign: string;
  licenseClass: 'NOVICE' | 'TECHNICIAN' | 'GENERAL' | 'ADVANCED' | 'EXTRA';
  firstName: string;
  lastName: string;
  country: string;
  isValid: boolean;
  expirationDate: number;
  grantDate: number;
  source: 'FCC' | 'QRZ' | 'LOCAL';
  cacheTimestamp: number;
}

export interface StationIdEvent {
  eventId: string;
  callsign: string;
  timestamp: number;
  method: 'CW' | 'PHONE' | 'DIGITAL';
  automatic: boolean;
  transmissionEnd: boolean;
  transmissionId?: string;
}

export interface ViolationRecord {
  violationId: string;
  timestamp: number;
  regulation: string;
  description: string;
  severity: 'WARNING' | 'VIOLATION' | 'CRITICAL';
  operatorCallsign: string;
  transmissionMode: 'RF' | 'WEBRTC' | 'HYBRID';
  resolved: boolean;
  details: any;
}

/**
 * Initialize FCC compliance database with proper schema
 */
export function initializeFCCDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FCC_COMPLIANCE_DB, FCC_COMPLIANCE_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open FCC compliance database: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;

      // Create compliance log store
      if (!db.objectStoreNames.contains(FCC_STORES.COMPLIANCE_LOG)) {
        const logStore = db.createObjectStore(FCC_STORES.COMPLIANCE_LOG, {
          keyPath: 'logId'
        });

        // Indexes for efficient querying
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
        logStore.createIndex('eventType', 'eventType', { unique: false });
        logStore.createIndex('operatorCallsign', 'operatorCallsign', { unique: false });
        logStore.createIndex('severity', 'severity', { unique: false });
        logStore.createIndex('timestamp_eventType', ['timestamp', 'eventType'], { unique: false });
      }

      // Create callsign records store
      if (!db.objectStoreNames.contains(FCC_STORES.CALLSIGN_RECORDS)) {
        const callsignStore = db.createObjectStore(FCC_STORES.CALLSIGN_RECORDS, {
          keyPath: 'callsign'
        });

        // Indexes for callsign validation
        callsignStore.createIndex('country', 'country', { unique: false });
        callsignStore.createIndex('licenseClass', 'licenseClass', { unique: false });
        callsignStore.createIndex('expirationDate', 'expirationDate', { unique: false });
        callsignStore.createIndex('isValid', 'isValid', { unique: false });
      }

      // Create station ID events store
      if (!db.objectStoreNames.contains(FCC_STORES.STATION_ID_EVENTS)) {
        const stationIdStore = db.createObjectStore(FCC_STORES.STATION_ID_EVENTS, {
          keyPath: 'eventId'
        });

        // Indexes for station ID tracking
        stationIdStore.createIndex('callsign', 'callsign', { unique: false });
        stationIdStore.createIndex('timestamp', 'timestamp', { unique: false });
        stationIdStore.createIndex('transmissionId', 'transmissionId', { unique: false });
        stationIdStore.createIndex('automatic', 'automatic', { unique: false });
      }

      // Create violation history store
      if (!db.objectStoreNames.contains(FCC_STORES.VIOLATION_HISTORY)) {
        const violationStore = db.createObjectStore(FCC_STORES.VIOLATION_HISTORY, {
          keyPath: 'violationId'
        });

        // Indexes for violation tracking
        violationStore.createIndex('timestamp', 'timestamp', { unique: false });
        violationStore.createIndex('regulation', 'regulation', { unique: false });
        violationStore.createIndex('severity', 'severity', { unique: false });
        violationStore.createIndex('operatorCallsign', 'operatorCallsign', { unique: false });
        violationStore.createIndex('resolved', 'resolved', { unique: false });
      }

      console.log('FCC compliance database schema initialized');
    };
  });
}

/**
 * Store compliance log entry
 */
export async function storeComplianceLog(entry: ComplianceLogEntry): Promise<void> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.COMPLIANCE_LOG], 'readwrite');
    const store = transaction.objectStore(FCC_STORES.COMPLIANCE_LOG);

    const request = store.add(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to store compliance log: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Retrieve compliance log entries
 */
export async function getComplianceLog(
  startTime?: number,
  endTime?: number,
  eventType?: ComplianceLogEntry['eventType'],
  limit: number = 100
): Promise<ComplianceLogEntry[]> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.COMPLIANCE_LOG], 'readonly');
    const store = transaction.objectStore(FCC_STORES.COMPLIANCE_LOG);

    let request: IDBRequest;

    if (startTime && endTime) {
      const index = store.index('timestamp');
      request = index.getAll(IDBKeyRange.bound(startTime, endTime));
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      let results = request.result as ComplianceLogEntry[];

      // Filter by event type if specified
      if (eventType) {
        results = results.filter(entry => entry.eventType === eventType);
      }

      // Sort by timestamp (newest first) and limit
      results.sort((a, b) => b.timestamp - a.timestamp);
      results = results.slice(0, limit);

      resolve(results);
    };

    request.onerror = () => reject(new Error(`Failed to retrieve compliance log: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Store callsign record
 */
export async function storeCallsignRecord(record: CallsignRecord): Promise<void> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.CALLSIGN_RECORDS], 'readwrite');
    const store = transaction.objectStore(FCC_STORES.CALLSIGN_RECORDS);

    const request = store.put(record); // Use put to allow updates

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to store callsign record: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get callsign record
 */
export async function getCallsignRecord(callsign: string): Promise<CallsignRecord | null> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.CALLSIGN_RECORDS], 'readonly');
    const store = transaction.objectStore(FCC_STORES.CALLSIGN_RECORDS);

    const request = store.get(callsign);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => reject(new Error(`Failed to get callsign record: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Store station ID event
 */
export async function storeStationIdEvent(event: StationIdEvent): Promise<void> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.STATION_ID_EVENTS], 'readwrite');
    const store = transaction.objectStore(FCC_STORES.STATION_ID_EVENTS);

    const request = store.add(event);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to store station ID event: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get station ID events for a callsign
 */
export async function getStationIdEvents(
  callsign: string,
  startTime?: number,
  endTime?: number
): Promise<StationIdEvent[]> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.STATION_ID_EVENTS], 'readonly');
    const store = transaction.objectStore(FCC_STORES.STATION_ID_EVENTS);
    const index = store.index('callsign');

    const request = index.getAll(callsign);

    request.onsuccess = () => {
      let results = request.result as StationIdEvent[];

      // Filter by time range if specified
      if (startTime && endTime) {
        results = results.filter(event =>
          event.timestamp >= startTime && event.timestamp <= endTime
        );
      }

      // Sort by timestamp
      results.sort((a, b) => b.timestamp - a.timestamp);

      resolve(results);
    };

    request.onerror = () => reject(new Error(`Failed to get station ID events: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Store violation record
 */
export async function storeViolationRecord(violation: ViolationRecord): Promise<void> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.VIOLATION_HISTORY], 'readwrite');
    const store = transaction.objectStore(FCC_STORES.VIOLATION_HISTORY);

    const request = store.add(violation);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to store violation record: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get violation history
 */
export async function getViolationHistory(
  operatorCallsign?: string,
  startTime?: number,
  endTime?: number
): Promise<ViolationRecord[]> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FCC_STORES.VIOLATION_HISTORY], 'readonly');
    const store = transaction.objectStore(FCC_STORES.VIOLATION_HISTORY);

    let request: IDBRequest;

    if (operatorCallsign) {
      const index = store.index('operatorCallsign');
      request = index.getAll(operatorCallsign);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      let results = request.result as ViolationRecord[];

      // Filter by time range if specified
      if (startTime && endTime) {
        results = results.filter(violation =>
          violation.timestamp >= startTime && violation.timestamp <= endTime
        );
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => b.timestamp - a.timestamp);

      resolve(results);
    };

    request.onerror = () => reject(new Error(`Failed to get violation history: ${request.error}`));

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Clear all FCC compliance data (for testing/reset)
 */
export async function clearFCCData(): Promise<void> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.values(FCC_STORES), 'readwrite');

    let completedStores = 0;
    const totalStores = Object.values(FCC_STORES).length;

    for (const storeName of Object.values(FCC_STORES)) {
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        completedStores++;
        if (completedStores === totalStores) {
          resolve();
        }
      };

      request.onerror = () => reject(new Error(`Failed to clear store ${storeName}: ${request.error}`));
    }

    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get database statistics
 */
export async function getFCCDatabaseStats(): Promise<{
  complianceLogCount: number;
  callsignRecordCount: number;
  stationIdEventCount: number;
  violationCount: number;
}> {
  const db = await initializeFCCDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.values(FCC_STORES), 'readonly');

    const stats = {
      complianceLogCount: 0,
      callsignRecordCount: 0,
      stationIdEventCount: 0,
      violationCount: 0
    };

    let completedCounts = 0;
    const totalCounts = 4;

    // Count compliance log entries
    const logRequest = transaction.objectStore(FCC_STORES.COMPLIANCE_LOG).count();
    logRequest.onsuccess = () => {
      stats.complianceLogCount = logRequest.result;
      completedCounts++;
      if (completedCounts === totalCounts) resolve(stats);
    };

    // Count callsign records
    const callsignRequest = transaction.objectStore(FCC_STORES.CALLSIGN_RECORDS).count();
    callsignRequest.onsuccess = () => {
      stats.callsignRecordCount = callsignRequest.result;
      completedCounts++;
      if (completedCounts === totalCounts) resolve(stats);
    };

    // Count station ID events
    const stationIdRequest = transaction.objectStore(FCC_STORES.STATION_ID_EVENTS).count();
    stationIdRequest.onsuccess = () => {
      stats.stationIdEventCount = stationIdRequest.result;
      completedCounts++;
      if (completedCounts === totalCounts) resolve(stats);
    };

    // Count violations
    const violationRequest = transaction.objectStore(FCC_STORES.VIOLATION_HISTORY).count();
    violationRequest.onsuccess = () => {
      stats.violationCount = violationRequest.result;
      completedCounts++;
      if (completedCounts === totalCounts) resolve(stats);
    };

    transaction.onerror = () => reject(new Error(`Failed to get database stats: ${transaction.error}`));
    transaction.oncomplete = () => db.close();
  });
}