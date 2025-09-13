import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logbook, QSOEntry, PageEntry, MeshNode } from './index';

// Mock IndexedDB
class MockIDBRequest {
  result: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onupgradeneeded: ((event: any) => void) | null = null;

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

class MockIDBDatabase {
  name = 'ham-radio-logbook';
  version = 1;
  objectStoreNames = {
    contains: vi.fn((name: string) => false)
  };

  transaction = vi.fn((stores: string[], mode: string) => {
    const mockStore = {
      add: vi.fn(() => {
        const req = new MockIDBRequest();
        setTimeout(() => req.onsuccess?.({}), 0);
        return req;
      }),
      put: vi.fn(() => {
        const req = new MockIDBRequest();
        setTimeout(() => req.onsuccess?.({}), 0);
        return req;
      }),
      get: vi.fn(() => {
        const req = new MockIDBRequest();
        req.result = null;
        setTimeout(() => req.onsuccess?.({}), 0);
        return req;
      }),
      getAll: vi.fn(() => {
        const req = new MockIDBRequest();
        req.result = [];
        setTimeout(() => req.onsuccess?.({}), 0);
        return req;
      }),
      delete: vi.fn(() => {
        const req = new MockIDBRequest();
        setTimeout(() => req.onsuccess?.({}), 0);
        return req;
      }),
      clear: vi.fn(() => {
        const req = new MockIDBRequest();
        setTimeout(() => req.onsuccess?.({}), 0);
        return req;
      }),
      index: vi.fn((indexName: string) => ({
        getAll: vi.fn(() => {
          const req = new MockIDBRequest();
          req.result = [];
          setTimeout(() => req.onsuccess?.({}), 0);
          return req;
        })
      }))
    };

    return {
      objectStore: vi.fn((name: string) => mockStore)
    };
  });

  createObjectStore = vi.fn((name: string, options: any) => ({
    createIndex: vi.fn()
  }));

  close = vi.fn();
}

const mockDatabase = new MockIDBDatabase();

const mockIndexedDB = {
  open: vi.fn(() => {
    const req = new MockIDBRequest();
    req.result = mockDatabase;
    // Simulate async database open
    setTimeout(() => {
      if (req.onupgradeneeded) {
        req.onupgradeneeded({ target: { result: mockDatabase } });
      }
      if (req.onsuccess) {
        req.onsuccess({});
      }
    }, 0);
    return req;
  })
};

// @ts-ignore
global.indexedDB = mockIndexedDB;

describe('Logbook', () => {
  let logbook: Logbook;

  beforeEach(() => {
    logbook = new Logbook();
    vi.clearAllMocks();
  });

  afterEach(() => {
    logbook.close();
  });

  describe('open()', () => {
    it('should open the logbook database', async () => {
      const openPromise = logbook.open();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(openPromise).resolves.toBeUndefined();
      expect(mockIndexedDB.open).toHaveBeenCalledWith('ham-radio-logbook', 1);
    });

    it('should handle database open errors', async () => {
      // Mock to trigger error
      mockIndexedDB.open.mockImplementationOnce(() => {
        const req = new MockIDBRequest();
        setTimeout(() => {
          if (req.onerror) req.onerror({});
        }, 0);
        return req;
      });

      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await expect(openPromise).rejects.toThrow('Could not open logbook');
    });
  });

  describe('QSO operations', () => {
    beforeEach(async () => {
      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      await openPromise;
    });

    it('should log a QSO entry', async () => {
      const qso: QSOEntry = {
        callsign: 'W1AW',
        date: '2024-01-15',
        time: '14:30:00',
        frequency: '14.205',
        mode: 'SSB',
        rstSent: '59',
        rstReceived: '57',
        qth: 'Connecticut',
        name: 'John'
      };

      await expect(logbook.logQSO(qso)).resolves.toBeUndefined();
    });

    it('should find QSOs by callsign', async () => {
      const result = await logbook.findQSOs('W1AW');
      expect(result).toEqual([]);
    });

    it('should find all QSOs when no callsign specified', async () => {
      const result = await logbook.findQSOs();
      expect(result).toEqual([]);
    });
  });

  describe('Page operations', () => {
    beforeEach(async () => {
      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      await openPromise;
    });

    it('should save a page', async () => {
      const page: PageEntry = {
        path: '/about',
        title: 'About',
        content: '<h1>About</h1>',
        lastUpdated: new Date().toISOString(),
        author: 'KJ4ABC'
      };

      await expect(logbook.savePage(page)).resolves.toBeUndefined();
    });

    it('should get a page by path', async () => {
      const result = await logbook.getPage('/about');
      expect(result).toBeNull();
    });

    it('should list all pages', async () => {
      const result = await logbook.listPages();
      expect(result).toEqual([]);
    });
  });

  describe('Mesh node operations', () => {
    beforeEach(async () => {
      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      await openPromise;
    });

    it('should record a mesh node', async () => {
      const node: MeshNode = {
        callsign: 'N0CALL',
        lastHeard: new Date().toISOString(),
        signalStrength: 75,
        frequency: '14.230',
        gridSquare: 'FN31'
      };

      await expect(logbook.recordNode(node)).resolves.toBeUndefined();
    });

    it('should get active nodes within time window', async () => {
      const result = await logbook.getActiveNodes(1);
      expect(result).toEqual([]);
    });

    it('should use default 1 hour window for active nodes', async () => {
      const result = await logbook.getActiveNodes();
      expect(result).toEqual([]);
    });
  });

  describe('Settings operations', () => {
    beforeEach(async () => {
      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      await openPromise;
    });

    it('should save a setting', async () => {
      await expect(logbook.saveSetting('qth', 'California')).resolves.toBeUndefined();
    });

    it('should get a setting', async () => {
      const result = await logbook.getSetting('qth');
      expect(result).toBeUndefined();
    });
  });

  describe('Cleanup operations', () => {
    beforeEach(async () => {
      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      await openPromise;
    });

    it('should cleanup old entries', async () => {
      await expect(logbook.cleanup(30)).resolves.toBeUndefined();
    });
  });

  describe('Export/Import operations', () => {
    beforeEach(async () => {
      const openPromise = logbook.open();
      await new Promise(resolve => setTimeout(resolve, 10));
      await openPromise;
    });

    it('should export logbook data', async () => {
      const backup = await logbook.exportLogbook();
      
      expect(backup).toHaveProperty('version', 1);
      expect(backup).toHaveProperty('exported');
      expect(backup).toHaveProperty('qsos');
      expect(backup).toHaveProperty('pages');
      expect(backup).toHaveProperty('nodes');
      expect(backup).toHaveProperty('settings');
    });

    it('should import logbook data', async () => {
      const backup = {
        version: 1,
        exported: new Date().toISOString(),
        qsos: [{
          callsign: 'W1AW',
          date: '2024-01-15',
          time: '14:30:00',
          frequency: '14.205',
          mode: 'SSB',
          rstSent: '59',
          rstReceived: '57'
        }],
        pages: [{
          path: '/test',
          title: 'Test',
          content: 'Test content',
          lastUpdated: new Date().toISOString()
        }],
        nodes: [],
        settings: {
          qth: 'California'
        }
      };

      await expect(logbook.importLogbook(backup)).resolves.toBeUndefined();
    });
  });

  describe('close()', () => {
    it('should close the database connection', async () => {
      const openPromise = logbook.open();
      const request = mockIndexedDB.open.mock.results[0].value;
      if (request.onsuccess) request.onsuccess();
      await openPromise;

      logbook.close();
      expect(request.result.close).toHaveBeenCalled();
    });

    it('should handle closing when not open', () => {
      expect(() => logbook.close()).not.toThrow();
    });
  });
});

describe('Helper functions', () => {
  describe('formatQSO', () => {
    it('should format QSO entry for display', async () => {
      const { formatQSO } = await import('./index');
      
      const qso: QSOEntry = {
        callsign: 'W1AW',
        date: '2024-01-15',
        time: '14:30:00',
        frequency: '14.205',
        mode: 'SSB',
        rstSent: '59',
        rstReceived: '57'
      };
      
      const formatted = formatQSO(qso);
      expect(formatted).toBe('2024-01-15 14:30:00 - W1AW on 14.205 MHz (SSB) RST: 59/57');
    });
  });

  describe('workedBefore', () => {
    it('should check if station was worked before', async () => {
      const { workedBefore, logbook } = await import('./index');
      
      // Mock the logbook
      vi.spyOn(logbook, 'findQSOs').mockResolvedValue([]);
      
      const result = await workedBefore('W1AW');
      expect(result).toBe(false);
    });

    it('should return true if QSOs exist', async () => {
      const { workedBefore, logbook } = await import('./index');
      
      // Mock finding QSOs
      vi.spyOn(logbook, 'findQSOs').mockResolvedValue([{
        callsign: 'W1AW',
        date: '2024-01-15',
        time: '14:30:00',
        frequency: '14.205',
        mode: 'SSB',
        rstSent: '59',
        rstReceived: '57'
      }]);
      
      const result = await workedBefore('W1AW');
      expect(result).toBe(true);
    });
  });
});