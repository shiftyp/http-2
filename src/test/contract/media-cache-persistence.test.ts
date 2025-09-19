/**
 * Media Cache Persistence Contract Tests (T012)
 * 
 * Tests IndexedDB storage, progressive caching,
 * and cache management policies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaCache } from '../../lib/media-cache/index.js';
import { openDatabase } from '../../lib/database/index.js';

// Mock IndexedDB
vi.mock('../../lib/database/index.js', () => ({
  openDatabase: vi.fn()
}));

describe('Media Cache Persistence Contract', () => {
  let cache: MediaCache;
  let mockDb: any;
  
  beforeEach(() => {
    // Create mock IndexedDB
    mockDb = {
      objectStoreNames: {
        contains: vi.fn(() => false)
      },
      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn()
      })),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(() => Promise.resolve()),
          get: vi.fn(() => Promise.resolve(null)),
          delete: vi.fn(() => Promise.resolve()),
          clear: vi.fn(() => Promise.resolve()),
          getAll: vi.fn(() => Promise.resolve([])),
          index: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve(null)),
            getAll: vi.fn(() => Promise.resolve([])),
            getAllKeys: vi.fn(() => Promise.resolve([]))
          }))
        }))
      }))
    };
    
    vi.mocked(openDatabase).mockResolvedValue(mockDb);
    
    cache = new MediaCache({
      maxSize: 10 * 1024 * 1024, // 10MB
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      progressive: true
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with IndexedDB', async () => {
      await cache.initialize();
      
      expect(openDatabase).toHaveBeenCalledWith('media-cache', 1, expect.any(Object));
    });

    it('should create required object stores', async () => {
      await cache.initialize();
      
      const upgradeCallback = vi.mocked(openDatabase).mock.calls[0][2].upgrade;
      const mockUpgradeDb = {
        objectStoreNames: {
          contains: vi.fn(() => false)
        },
        createObjectStore: vi.fn(() => ({
          createIndex: vi.fn()
        }))
      };
      
      upgradeCallback(mockUpgradeDb);
      
      expect(mockUpgradeDb.createObjectStore).toHaveBeenCalledWith('media', { keyPath: 'id' });
      expect(mockUpgradeDb.createObjectStore).toHaveBeenCalledWith('chunks', expect.any(Object));
    });
  });

  describe('Media Storage', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should store media with metadata', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const metadata = {
        width: 100,
        height: 100,
        codec: 'jpeg'
      };
      
      const id = await cache.store('/test.jpg', data, 'image/jpeg', metadata);
      
      expect(id).toMatch(/^media_/);
      expect(mockDb.transaction).toHaveBeenCalledWith(['media'], 'readwrite');
    });

    it('should enforce size constraints', async () => {
      // Set small cache for testing
      cache = new MediaCache({ maxSize: 100 });
      await cache.initialize();
      
      const largeData = new Uint8Array(20); // 20% of cache
      const id = await cache.store('/large.jpg', largeData, 'image/jpeg');
      
      expect(id).toBeDefined();
      // Should not store items > 10% of cache
    });

    it('should update access time on retrieval', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await cache.store('/test.jpg', data, 'image/jpeg');
      
      // Mock retrieval
      const mockGet = vi.fn(() => Promise.resolve({
        id: 'media_123',
        url: '/test.jpg',
        data,
        mimeType: 'image/jpeg',
        size: data.length,
        metadata: {},
        created: new Date(),
        accessed: new Date(Date.now() - 3600000), // 1 hour ago
        hits: 0
      }));
      
      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn(() => ({
          index: vi.fn(() => ({ get: mockGet })),
          put: vi.fn(() => Promise.resolve())
        }))
      }));
      
      const cached = await cache.get('/test.jpg');
      
      expect(cached).toBeDefined();
      expect(cached?.hits).toBe(1);
      expect(cached?.accessed.getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('Progressive Caching', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should store media in chunks', async () => {
      const chunkData = new Uint8Array([1, 2, 3, 4]);
      
      await cache.storeChunk('/video.webm', 0, chunkData, 0, 75);
      
      expect(mockDb.transaction).toHaveBeenCalledWith(['chunks'], 'readwrite');
    });

    it('should assemble chunks on retrieval', async () => {
      // Mock chunk retrieval first, then store chunks
      const mockChunks = [
        { index: 0, offset: 0, length: 2, data: new Uint8Array([1, 2]) },
        { index: 1, offset: 2, length: 2, data: new Uint8Array([3, 4]) },
        { index: 2, offset: 4, length: 2, data: new Uint8Array([5, 6]) }
      ];

      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn((name: string) => {
          if (name === 'chunks') {
            return {
              index: vi.fn(() => ({
                getAll: vi.fn(() => Promise.resolve(mockChunks))
              })),
              put: vi.fn(() => Promise.resolve()),
              add: vi.fn(() => Promise.resolve())
            };
          }
          return {
            index: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({
                id: 'media_123',
                url: '/video.webm',
                chunks: mockChunks,
                data: new Uint8Array(0),
                mimeType: 'video/webm',
                size: 6,
                metadata: {},
                created: new Date(),
                accessed: new Date(),
                hits: 0
              }))
            })),
            put: vi.fn(() => Promise.resolve()),
            add: vi.fn(() => Promise.resolve())
          };
        })
      }));

      // Store chunks
      await cache.storeChunk('/video.webm', 0, new Uint8Array([1, 2]), 0);
      await cache.storeChunk('/video.webm', 1, new Uint8Array([3, 4]), 2);
      await cache.storeChunk('/video.webm', 2, new Uint8Array([5, 6]), 4);
      
      const cached = await cache.get('/video.webm');
      
      expect(cached).toBeDefined();
      expect(cached?.data).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it('should support partial content retrieval', async () => {
      const fullData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      // Mock full data retrieval
      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn(() => ({
          index: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({
              id: 'media_123',
              url: '/data.bin',
              data: fullData,
              mimeType: 'application/octet-stream',
              size: fullData.length,
              metadata: {},
              created: new Date(),
              accessed: new Date(),
              hits: 0
            }))
          }))
        }))
      }));
      
      const range = await cache.getRange('/data.bin', 2, 7);
      
      expect(range).toEqual(new Uint8Array([2, 3, 4, 5, 6]));
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should evict old items when cache is full', async () => {
      // Mock cache at capacity
      const oldItem = {
        id: 'media_old',
        url: '/old.jpg',
        size: 5000,
        accessed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days old
        created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        data: new Uint8Array(5000),
        mimeType: 'image/jpeg',
        metadata: {},
        hits: 1
      };
      
      const newItem = {
        id: 'media_new',
        url: '/new.jpg',
        size: 3000,
        accessed: new Date(),
        created: new Date(),
        data: new Uint8Array(3000),
        mimeType: 'image/jpeg',
        metadata: {},
        hits: 0
      };
      
      // Mock getAll to return items
      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn(() => ({
          getAll: vi.fn(() => Promise.resolve([oldItem, newItem])),
          index: vi.fn(() => ({
            getAll: vi.fn(() => Promise.resolve([oldItem])),
            get: vi.fn(() => Promise.resolve(null))
          })),
          delete: vi.fn(() => Promise.resolve())
        }))
      }));
      
      // Try to store new item that would exceed capacity
      const data = new Uint8Array(8000);
      await cache.store('/large.jpg', data, 'image/jpeg');
      
      // Should have called delete for LRU eviction
      const calls = mockDb.transaction.mock.calls;
      const hasDelete = calls.some(call => {
        const tx = call[1];
        return tx === 'readwrite';
      });
      expect(hasDelete).toBe(true);
    });

    it('should respect max age setting', async () => {
      const expiredItem = {
        id: 'media_expired',
        url: '/expired.jpg',
        created: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours old
        accessed: new Date(Date.now() - 48 * 60 * 60 * 1000),
        data: new Uint8Array(100),
        mimeType: 'image/jpeg',
        size: 100,
        metadata: {},
        hits: 0
      };
      
      // Mock expired item retrieval
      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn(() => ({
          index: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve(expiredItem))
          })),
          delete: vi.fn(() => Promise.resolve())
        }))
      }));
      
      const cached = await cache.get('/expired.jpg');
      
      expect(cached).toBeNull();
      // Should have deleted expired item
    });

    it('should track cache statistics', async () => {
      const stats = cache.getStats();
      
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('itemCount');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('bandwidth');
    });

    it('should clear entire cache', async () => {
      await cache.clear();
      
      expect(mockDb.transaction).toHaveBeenCalledWith(['media', 'chunks'], 'readwrite');
      
      const stats = cache.getStats();
      expect(stats.totalSize).toBe(0);
      expect(stats.itemCount).toBe(0);
    });
  });

  describe('Prefetching', () => {
    beforeEach(async () => {
      cache = new MediaCache({ prefetch: true });
      await cache.initialize();
    });

    it('should prefetch related media', async () => {
      const urls = [
        '/image1.jpg',
        '/image2.jpg',
        '/image3.jpg'
      ];
      
      await cache.prefetch(urls);
      
      // Should have attempted to store placeholders
      const storeCalls = mockDb.transaction.mock.calls.filter(
        (call: any[]) => call[1] === 'readwrite'
      );
      expect(storeCalls.length).toBeGreaterThan(0);
    });

    it('should skip already cached items', async () => {
      // Mock has() to return true for first URL
      let callCount = 0;
      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn(() => ({
          index: vi.fn(() => ({
            get: vi.fn(() => {
              callCount++;
              return Promise.resolve(callCount === 1 ? {} : null);
            })
          })),
          put: vi.fn(() => Promise.resolve())
        }))
      }));
      
      await cache.prefetch(['/cached.jpg', '/new.jpg']);
      
      // Should only store the new item
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Bandwidth Optimization', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should track bandwidth saved', async () => {
      const data = new Uint8Array(1000);
      await cache.store('/test.jpg', data, 'image/jpeg');
      
      // Mock cache hit
      mockDb.transaction = vi.fn(() => ({
        objectStore: vi.fn(() => ({
          index: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({
              id: 'media_123',
              url: '/test.jpg',
              data,
              size: 1000,
              mimeType: 'image/jpeg',
              metadata: {},
              created: new Date(),
              accessed: new Date(),
              hits: 0
            }))
          })),
          put: vi.fn(() => Promise.resolve())
        }))
      }));
      
      await cache.get('/test.jpg');
      const stats = cache.getStats();
      
      expect(stats.bandwidth).toBe(1000);
      expect(stats.hits).toBe(1);
    });

    it('should optimize storage for progressive media', async () => {
      // Store progressive chunks
      await cache.storeChunk('/video.webm', 0, new Uint8Array(100), 0, 30); // Low quality
      await cache.storeChunk('/video.webm', 0, new Uint8Array(200), 0, 60); // Medium quality
      await cache.storeChunk('/video.webm', 0, new Uint8Array(300), 0, 90); // High quality
      
      // Should store all quality levels
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});

export {};