/**
 * Tests for Database Library
 * Tests IndexedDB wrapper, data persistence, and caching
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { Database, DBConfig, DB_CONFIG } from './index';

// Mock the logbook module with exportLogbook and other missing methods
vi.mock('../logbook', () => ({
  logbook: {
    open: vi.fn(),
    savePage: vi.fn(),
    getPage: vi.fn(),
    listPages: vi.fn(),
    recordNode: vi.fn(),
    getActiveNodes: vi.fn(),
    cleanup: vi.fn(),
    logQSO: vi.fn(),
    findQSOs: vi.fn(),
    saveSetting: vi.fn(),
    getSetting: vi.fn(),
    exportLogbook: vi.fn(),
    importLogbook: vi.fn(),
    close: vi.fn()
  }
}));

import { logbook } from '../logbook';

// Type the mocked functions
const mockedLogbook = {
  open: logbook.open as MockedFunction<typeof logbook.open>,
  savePage: logbook.savePage as MockedFunction<typeof logbook.savePage>,
  getPage: logbook.getPage as MockedFunction<typeof logbook.getPage>,
  listPages: logbook.listPages as MockedFunction<typeof logbook.listPages>,
  recordNode: logbook.recordNode as MockedFunction<typeof logbook.recordNode>,
  getActiveNodes: logbook.getActiveNodes as MockedFunction<typeof logbook.getActiveNodes>,
  cleanup: logbook.cleanup as MockedFunction<typeof logbook.cleanup>,
  logQSO: logbook.logQSO as MockedFunction<typeof logbook.logQSO>,
  findQSOs: logbook.findQSOs as MockedFunction<typeof logbook.findQSOs>,
  saveSetting: logbook.saveSetting as MockedFunction<typeof logbook.saveSetting>,
  getSetting: logbook.getSetting as MockedFunction<typeof logbook.getSetting>,
  exportLogbook: (logbook as any).exportLogbook as MockedFunction<any>,
  importLogbook: (logbook as any).importLogbook as MockedFunction<any>,
  close: (logbook as any).close as MockedFunction<any>
};

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(db).toBeDefined();
      expect((db as any).config).toEqual(DB_CONFIG);
    });

    it('should initialize with custom config', () => {
      const customConfig: DBConfig = {
        name: 'custom-db',
        version: 2,
        stores: []
      };

      const customDb = new Database(customConfig);
      expect((customDb as any).config).toEqual(customConfig);
    });

    it('should open logbook on init', async () => {
      await db.init();
      expect(mockedLogbook.open).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await db.init();
      await db.init();
      await db.init();

      expect(mockedLogbook.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pages Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should save a page', async () => {
      const page = {
        id: 'test-page',
        path: '/test',
        title: 'Test Page',
        content: '<h1>Test</h1>',
        author: 'KA1ABC'
      };

      await db.savePage(page);

      expect(mockedLogbook.savePage).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/test',
          title: 'Test Page',
          author: 'KA1ABC'
        })
      );
    });

    it('should get a page', async () => {
      const mockPage = {
        path: '/test',
        title: 'Test Page',
        content: JSON.stringify({ id: 'test', data: 'content' }),
        lastUpdated: '2024-01-01',
        author: 'KA1ABC'
      };

      mockedLogbook.getPage.mockResolvedValue(mockPage as any);

      const page = await db.getPage('/test');

      expect(mockedLogbook.getPage).toHaveBeenCalledWith('/test');
      expect(page).toMatchObject({
        id: 'test',
        data: 'content',
        path: '/test'
      });
    });

    it('should return null for non-existent page', async () => {
      mockedLogbook.getPage.mockResolvedValue(null);

      const page = await db.getPage('/nonexistent');

      expect(page).toBeNull();
    });

    it('should handle non-JSON page content', async () => {
      const mockPage = {
        path: '/plain',
        title: 'Plain Page',
        content: 'Plain text content',
        lastUpdated: '2024-01-01'
      };

      mockedLogbook.getPage.mockResolvedValue(mockPage as any);

      const page = await db.getPage('/plain');

      expect(page).toEqual(mockPage);
    });

    it('should get all pages', async () => {
      const mockPages = [
        {
          path: '/page1',
          content: JSON.stringify({ id: '1', title: 'Page 1' })
        },
        {
          path: '/page2',
          content: JSON.stringify({ id: '2', title: 'Page 2' })
        }
      ];

      mockedLogbook.listPages.mockResolvedValue(mockPages as any);

      const pages = await db.getAllPages();

      expect(pages).toHaveLength(2);
      expect(pages[0]).toMatchObject({ id: '1', title: 'Page 1', path: '/page1' });
      expect(pages[1]).toMatchObject({ id: '2', title: 'Page 2', path: '/page2' });
    });

    it('should warn when deleting page (not implemented)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await db.deletePage('test-id');

      expect(warnSpy).toHaveBeenCalledWith('Page deletion not yet implemented');
      warnSpy.mockRestore();
    });
  });

  describe('Server Apps Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should save a server app', async () => {
      const app = {
        id: 'test-app',
        path: '/api/test',
        name: 'Test App',
        code: 'function handler() { return "ok"; }',
        author: 'KB2XYZ'
      };

      await db.saveServerApp(app);

      expect(mockedLogbook.savePage).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'app:/api/test',
          title: 'Test App'
        })
      );
    });

    it('should get a server app', async () => {
      const mockApp = {
        path: 'app:/api/test',
        content: JSON.stringify({
          id: 'test-app',
          name: 'Test App',
          code: 'console.log("test");'
        })
      };

      mockedLogbook.getPage.mockResolvedValue(mockApp as any);

      const app = await db.getServerApp('/api/test');

      expect(mockedLogbook.getPage).toHaveBeenCalledWith('app:/api/test');
      expect(app).toMatchObject({
        id: 'test-app',
        name: 'Test App'
      });
    });

    it('should get all server apps', async () => {
      const mockPages = [
        {
          path: 'app:/api/app1',
          content: JSON.stringify({ id: 'app1', name: 'App 1' })
        },
        {
          path: 'app:/api/app2',
          content: JSON.stringify({ id: 'app2', name: 'App 2' })
        },
        {
          path: '/regular/page',
          content: JSON.stringify({ id: 'page', name: 'Not an app' })
        }
      ];

      mockedLogbook.listPages.mockResolvedValue(mockPages as any);

      const apps = await db.getAllServerApps();

      expect(apps).toHaveLength(2);
      expect(apps[0]).toMatchObject({ id: 'app1', name: 'App 1' });
      expect(apps[1]).toMatchObject({ id: 'app2', name: 'App 2' });
    });
  });

  describe('Mesh Nodes Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should save a mesh node', async () => {
      const node = {
        callsign: 'W1AW',
        signalStrength: 75,
        frequency: '14.074',
        gridSquare: 'FN31'
      };

      await db.saveMeshNode(node);

      expect(mockedLogbook.recordNode).toHaveBeenCalledWith(
        expect.objectContaining({
          callsign: 'W1AW',
          signalStrength: 75,
          frequency: '14.074',
          gridSquare: 'FN31'
        })
      );
    });

    it('should get a mesh node', async () => {
      const mockNodes = [
        { callsign: 'W1AW', signalStrength: 75 },
        { callsign: 'W2AW', signalStrength: 60 }
      ];

      mockedLogbook.getActiveNodes.mockResolvedValue(mockNodes as any);

      const node = await db.getMeshNode('W1AW');

      expect(node).toEqual({ callsign: 'W1AW', signalStrength: 75 });
    });

    it('should get active mesh nodes', async () => {
      const mockNodes = [
        { callsign: 'W1AW', lastHeard: new Date().toISOString() },
        { callsign: 'W2AW', lastHeard: new Date().toISOString() }
      ];

      mockedLogbook.getActiveNodes.mockResolvedValue(mockNodes as any);

      const nodes = await db.getActiveMeshNodes(600000); // 10 minutes

      expect(mockedLogbook.getActiveNodes).toHaveBeenCalledWith(600000 / (60 * 60 * 1000));
      expect(nodes).toEqual(mockNodes);
    });

    it('should cleanup stale mesh nodes', async () => {
      await db.cleanupStaleMeshNodes(3600000); // 1 hour

      expect(mockedLogbook.cleanup).toHaveBeenCalledWith(3600000 / (24 * 60 * 60 * 1000));
    });

    it('should use default max age for node cleanup', async () => {
      await db.cleanupStaleMeshNodes();

      expect(mockedLogbook.cleanup).toHaveBeenCalledWith(3600000 / (24 * 60 * 60 * 1000));
    });
  });

  describe('Messages Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should save a message', async () => {
      const message = {
        from: 'KA1ABC',
        to: 'KB2XYZ',
        subject: 'Test Message',
        body: 'Hello World',
        status: 'sent'
      };

      await db.saveMessage(message);

      expect(mockedLogbook.savePage).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching(/^msg:\d+:[a-z0-9]+$/),
          title: 'Message from KA1ABC to KB2XYZ',
          author: 'KA1ABC'
        })
      );
    });

    it('should add timestamp to message if not present', async () => {
      const message = {
        from: 'KA1ABC',
        to: 'KB2XYZ',
        body: 'Test'
      };

      await db.saveMessage(message);

      const savedCall = mockedLogbook.savePage.mock.calls[0][0];
      const savedMessage = JSON.parse(savedCall.content);

      expect(savedMessage.timestamp).toBeDefined();
      expect(typeof savedMessage.timestamp).toBe('number');
    });

    it('should get messages with filters', async () => {
      const mockPages = [
        {
          path: 'msg:1:abc',
          content: JSON.stringify({ from: 'KA1ABC', to: 'KB2XYZ', timestamp: 1000 })
        },
        {
          path: 'msg:2:def',
          content: JSON.stringify({ from: 'KA1ABC', to: 'W1AW', timestamp: 2000 })
        },
        {
          path: 'msg:3:ghi',
          content: JSON.stringify({ from: 'W2AW', to: 'KB2XYZ', timestamp: 3000 })
        }
      ];

      mockedLogbook.listPages.mockResolvedValue(mockPages as any);

      // Filter by from
      const fromMessages = await db.getMessages({ from: 'KA1ABC' });
      expect(fromMessages).toHaveLength(2);

      // Filter by to
      const toMessages = await db.getMessages({ to: 'KB2XYZ' });
      expect(toMessages).toHaveLength(2);

      // Filter with limit
      const limitedMessages = await db.getMessages({ limit: 1 });
      expect(limitedMessages).toHaveLength(1);
      expect(limitedMessages[0].timestamp).toBe(3000); // Should be newest first
    });

    it('should handle invalid message content', async () => {
      const mockPages = [
        {
          path: 'msg:1:abc',
          content: 'invalid json'
        },
        {
          path: 'msg:2:def',
          content: JSON.stringify({ from: 'KA1ABC', to: 'KB2XYZ' })
        }
      ];

      mockedLogbook.listPages.mockResolvedValue(mockPages as any);

      const messages = await db.getMessages({});

      expect(messages).toHaveLength(1); // Only valid message
      expect(messages[0].from).toBe('KA1ABC');
    });

    it('should mark message as read (logging only)', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await db.markMessageAsRead(123);

      expect(logSpy).toHaveBeenCalledWith('Message 123 marked as read');
      logSpy.mockRestore();
    });
  });

  describe('QSO Log Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should log a QSO', async () => {
      const qso = {
        callsign: 'W1AW',
        frequency: '14.074',
        mode: 'FT8',
        rstSent: '599',
        rstReceived: '579',
        qth: 'Newington, CT',
        name: 'Hiram',
        notes: 'ARRL HQ'
      };

      await db.logQSO(qso);

      expect(mockedLogbook.logQSO).toHaveBeenCalledWith(
        expect.objectContaining({
          callsign: 'W1AW',
          frequency: '14.074',
          mode: 'FT8',
          rstSent: '599',
          rstReceived: '579'
        })
      );
    });

    it('should use default RST values', async () => {
      const qso = {
        callsign: 'W1AW',
        frequency: '14.074',
        mode: 'FT8'
      };

      await db.logQSO(qso);

      expect(mockedLogbook.logQSO).toHaveBeenCalledWith(
        expect.objectContaining({
          rstSent: '59',
          rstReceived: '59'
        })
      );
    });

    it('should get QSO log with filters', async () => {
      const mockQSOs = [
        { callsign: 'W1AW', frequency: '14.074', mode: 'FT8' },
        { callsign: 'W2AW', frequency: '7.074', mode: 'FT8' },
        { callsign: 'W1AW', frequency: '3.573', mode: 'CW' }
      ];

      mockedLogbook.findQSOs.mockResolvedValue(mockQSOs as any);

      // Filter by callsign
      const qsos = await db.getQSOLog({ callsign: 'W1AW' });

      expect(mockedLogbook.findQSOs).toHaveBeenCalledWith('W1AW');
      expect(qsos).toHaveLength(3); // All QSOs returned for testing

      // Filter by band
      const band20m = await db.getQSOLog({ band: '20m' });
      expect(band20m).toHaveLength(1);

      // Filter with limit
      const limited = await db.getQSOLog({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should correctly identify band from frequency', () => {
      const bandTests = [
        { freq: 1.830, band: '160m' },
        { freq: 3.573, band: '80m' },
        { freq: 7.074, band: '40m' },
        { freq: 10.136, band: '30m' },
        { freq: 14.074, band: '20m' },
        { freq: 18.100, band: '17m' },
        { freq: 21.074, band: '15m' },
        { freq: 24.915, band: '12m' },
        { freq: 28.074, band: '10m' },
        { freq: 50.313, band: '6m' },
        { freq: 144.174, band: '2m' },
        { freq: 432.100, band: '70cm' }
      ];

      bandTests.forEach(test => {
        expect((db as any).getBand(test.freq)).toBe(test.band);
      });
    });
  });

  describe('Certificate Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should save a certificate', async () => {
      const cert = {
        callsign: 'KA1ABC',
        publicKey: 'public-key-data',
        expiry: '2025-12-31',
        issuer: 'W1AW'
      };

      await db.saveCertificate(cert);

      expect(mockedLogbook.saveSetting).toHaveBeenCalledWith('cert:KA1ABC', cert);
      expect((db as any).certificateCache.get('KA1ABC')).toEqual(cert);
    });

    it('should get certificate from cache', async () => {
      const cert = {
        callsign: 'KA1ABC',
        publicKey: 'cached-key'
      };

      (db as any).certificateCache.set('KA1ABC', cert);

      const retrieved = await db.getCertificate('KA1ABC');

      expect(retrieved).toEqual(cert);
      expect(mockedLogbook.getSetting).not.toHaveBeenCalled();
    });

    it('should get certificate from storage', async () => {
      const cert = {
        callsign: 'KB2XYZ',
        publicKey: 'stored-key'
      };

      mockedLogbook.getSetting.mockResolvedValue(cert);

      const retrieved = await db.getCertificate('KB2XYZ');

      expect(mockedLogbook.getSetting).toHaveBeenCalledWith('cert:KB2XYZ');
      expect(retrieved).toEqual(cert);
      expect((db as any).certificateCache.get('KB2XYZ')).toEqual(cert);
    });

    it('should get valid certificates', async () => {
      const now = Date.now();
      mockedLogbook.exportLogbook.mockResolvedValue({
        settings: {
          'cert:KA1ABC': { callsign: 'KA1ABC', expiry: now + 100000 },
          'cert:KB2XYZ': { callsign: 'KB2XYZ', expiry: now + 200000 },
          'cert:OLD': { callsign: 'OLD', expiry: now - 100000 },
          'other:setting': { data: 'not a cert' }
        }
      });

      const certs = await db.getValidCertificates();

      expect(certs).toHaveLength(2);
      expect(certs[0].callsign).toBe('KA1ABC');
      expect(certs[1].callsign).toBe('KB2XYZ');
    });
  });

  describe('Settings Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should save a setting', async () => {
      await db.setSetting('theme', 'dark');

      expect(mockedLogbook.saveSetting).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should get a setting', async () => {
      mockedLogbook.getSetting.mockResolvedValue('light');

      const value = await db.getSetting('theme');

      expect(mockedLogbook.getSetting).toHaveBeenCalledWith('theme');
      expect(value).toBe('light');
    });

    it('should get all settings', async () => {
      mockedLogbook.exportLogbook.mockResolvedValue({
        settings: {
          theme: 'dark',
          callsign: 'KA1ABC'
        }
      });

      const settings = await db.getAllSettings();

      expect(settings).toEqual({
        theme: 'dark',
        callsign: 'KA1ABC'
      });
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      await db.init();
    });

    it('should cache content', async () => {
      const url = 'http://example.radio/page';
      const content = '<html>...</html>';

      await db.cacheContent(url, content);

      expect(mockedLogbook.savePage).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'cache:http://example.radio/page'
        })
      );
    });

    it('should get cached content', async () => {
      const mockCache = {
        path: 'cache:http://example.radio/page',
        content: JSON.stringify({
          url: 'http://example.radio/page',
          content: '<html>cached</html>',
          timestamp: Date.now() - 10000
        })
      };

      mockedLogbook.getPage.mockResolvedValue(mockCache as any);

      const cached = await db.getCachedContent('http://example.radio/page');

      expect(cached).toBeDefined();
      expect(cached).toBe('<html>cached</html>');
    });

    it('should return null for non-existent cache', async () => {
      mockedLogbook.getPage.mockResolvedValue(null);

      const cached = await db.getCachedContent('http://example.radio/page');

      expect(cached).toBeNull();
    });

    it('should clear old cache entries', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await db.clearCache(3600000); // 1 hour

      expect(mockedLogbook.cleanup).toHaveBeenCalledWith(3600000 / (24 * 60 * 60 * 1000));
      expect(logSpy).toHaveBeenCalledWith('Cache cleared');
      logSpy.mockRestore();
    });
  });

  describe('Helper Methods', () => {
    it('should ensure initialization before operations', async () => {
      const uninitializedDb = new Database();

      // Any operation should trigger init
      mockedLogbook.listPages.mockResolvedValue([]);

      await uninitializedDb.getAllPages();

      expect(mockedLogbook.open).toHaveBeenCalled();
    });

    it('should calculate cache size', async () => {
      const mockPages = [
        { path: 'cache:url1', content: 'x'.repeat(1000) },
        { path: 'cache:url2', content: 'y'.repeat(2000) },
        { path: 'page:normal', content: 'z'.repeat(500) }
      ];

      mockedLogbook.listPages.mockResolvedValue(mockPages as any);

      const size = await db.getCacheSize();

      expect(size).toBeGreaterThan(0);
    });
  });
});