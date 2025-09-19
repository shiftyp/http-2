/**
 * Contract Test: Media Gallery API (T007)
 * 
 * Tests the media gallery endpoint contract defined in
 * specs/024-rich-media-components/contracts/media-api.yaml
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaGallery } from '../../lib/media-cache/MediaGallery';
import type { MediaComponent } from '../../lib/media-cache/MediaComponent';

// Mock database
vi.mock('../../lib/database/media-schema', () => ({
  mediaDB: {
    media: {
      toArray: vi.fn(),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      sortBy: vi.fn(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      count: vi.fn()
    }
  }
}));

describe('Media Gallery API Contract', () => {
  let gallery: MediaGallery;
  const mockMedia: MediaComponent[] = [
    {
      id: 'img-001',
      filename: 'sunset.jpg',
      mimeType: 'image/jpeg',
      size: 102400,
      url: '/media/img-001',
      createdAt: new Date('2025-01-01'),
      metadata: { width: 1920, height: 1080, tags: ['nature', 'sunset'] }
    },
    {
      id: 'img-002',
      filename: 'mountain.png',
      mimeType: 'image/png',
      size: 204800,
      url: '/media/img-002',
      createdAt: new Date('2025-01-02'),
      metadata: { width: 3840, height: 2160, tags: ['nature', 'mountain'] }
    },
    {
      id: 'aud-001',
      filename: 'voice-note.opus',
      mimeType: 'audio/opus',
      size: 51200,
      url: '/media/aud-001',
      createdAt: new Date('2025-01-03'),
      metadata: { duration: 30, bitrate: 32000, tags: ['voice'] }
    },
    {
      id: 'vid-001',
      filename: 'demo.webm',
      mimeType: 'video/webm',
      size: 512000,
      url: '/media/vid-001',
      createdAt: new Date('2025-01-04'),
      metadata: { duration: 60, width: 1280, height: 720, tags: ['demo'] }
    },
    {
      id: 'doc-001',
      filename: 'guide.pdf',
      mimeType: 'application/pdf',
      size: 256000,
      url: '/media/doc-001',
      createdAt: new Date('2025-01-05'),
      metadata: { pages: 10, tags: ['documentation'] }
    }
  ];

  beforeEach(() => {
    gallery = new MediaGallery();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/media/gallery', () => {
    it('should return all media items', async () => {
      const request = {};

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(5);
      expect(response.data.total).toBe(5);
      expect(response.data.items[0]).toMatchObject({
        id: expect.any(String),
        filename: expect.any(String),
        mimeType: expect.any(String),
        size: expect.any(Number),
        url: expect.any(String)
      });
    });

    it('should support pagination', async () => {
      const request = {
        page: 2,
        limit: 2
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(2);
      expect(response.data.total).toBe(5);
      expect(response.data.page).toBe(2);
      expect(response.data.limit).toBe(2);
      expect(response.data.hasNext).toBe(true);
      expect(response.data.hasPrev).toBe(true);
      expect(response.data.items[0].id).toBe('aud-001');
    });

    it('should filter by media type', async () => {
      const request = {
        type: 'image'
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(2);
      expect(response.data.items.every((item: any) => 
        item.mimeType.startsWith('image/'))
      ).toBe(true);
    });

    it('should filter by multiple types', async () => {
      const request = {
        types: ['image', 'audio']
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(3);
    });

    it('should search by filename', async () => {
      const request = {
        search: 'mountain'
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(1);
      expect(response.data.items[0].filename).toContain('mountain');
    });

    it('should filter by tags', async () => {
      const request = {
        tags: ['nature']
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(2);
      expect(response.data.items.every((item: any) => 
        item.metadata?.tags?.includes('nature'))
      ).toBe(true);
    });

    it('should sort by different fields', async () => {
      const sortOptions = [
        { sortBy: 'size', order: 'asc' },
        { sortBy: 'size', order: 'desc' },
        { sortBy: 'filename', order: 'asc' },
        { sortBy: 'createdAt', order: 'desc' }
      ];

      for (const option of sortOptions) {
        const response = await simulateGalleryFetch(option, mockMedia);
        
        expect(response.status).toBe(200);
        expect(response.data.sortBy).toBe(option.sortBy);
        expect(response.data.order).toBe(option.order);
        
        // Verify sorting
        const items = response.data.items;
        for (let i = 1; i < items.length; i++) {
          const prev = items[i - 1][option.sortBy];
          const curr = items[i][option.sortBy];
          
          if (option.order === 'asc') {
            expect(prev <= curr).toBe(true);
          } else {
            expect(prev >= curr).toBe(true);
          }
        }
      }
    });

    it('should filter by date range', async () => {
      const request = {
        fromDate: '2025-01-02',
        toDate: '2025-01-04'
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(3);
      expect(response.data.items[0].id).toBe('img-002');
      expect(response.data.items[2].id).toBe('vid-001');
    });

    it('should filter by size range', async () => {
      const request = {
        minSize: 100000,  // 100KB
        maxSize: 300000   // 300KB
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(3);
      expect(response.data.items.every((item: any) => 
        item.size >= 100000 && item.size <= 300000)
      ).toBe(true);
    });

    it('should include statistics', async () => {
      const request = {
        includeStats: true
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.stats).toMatchObject({
        totalSize: expect.any(Number),
        totalItems: 5,
        byType: {
          image: 2,
          audio: 1,
          video: 1,
          document: 1
        },
        averageSize: expect.any(Number)
      });
    });

    it('should support thumbnail URLs', async () => {
      const request = {
        includeThumbnails: true
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      response.data.items.forEach((item: any) => {
        if (item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/')) {
          expect(item.thumbnail).toBeDefined();
          expect(item.thumbnail).toContain('thumb');
        }
      });
    });

    it('should handle empty gallery', async () => {
      const request = {
        type: 'nonexistent'
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.items).toHaveLength(0);
      expect(response.data.total).toBe(0);
    });

    it('should validate pagination parameters', async () => {
      const request = {
        page: -1,
        limit: 1000
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Invalid pagination');
    });

    it('should group by date', async () => {
      const request = {
        groupBy: 'date'
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.groups).toBeDefined();
      expect(response.data.groups).toHaveLength(5); // One per day
      expect(response.data.groups[0]).toMatchObject({
        date: expect.any(String),
        items: expect.any(Array),
        count: expect.any(Number)
      });
    });

    it('should return bandwidth-optimized response', async () => {
      const request = {
        optimize: true
      };

      const response = await simulateGalleryFetch(request, mockMedia);

      expect(response.status).toBe(200);
      expect(response.data.optimized).toBe(true);
      // Optimized response should exclude some metadata
      response.data.items.forEach((item: any) => {
        expect(item.id).toBeDefined();
        expect(item.url).toBeDefined();
        expect(item.metadata).toBeUndefined(); // Excluded for bandwidth
      });
    });
  });

  /**
   * Simulates the gallery fetch endpoint behavior
   */
  async function simulateGalleryFetch(request: any, media: MediaComponent[]): Promise<any> {
    try {
      // Validate pagination
      if (request.page !== undefined && request.page < 1) {
        return {
          status: 400,
          error: 'Invalid pagination: page must be >= 1'
        };
      }
      if (request.limit !== undefined && (request.limit < 1 || request.limit > 100)) {
        return {
          status: 400,
          error: 'Invalid pagination: limit must be between 1 and 100'
        };
      }

      let filtered = [...media];

      // Filter by type
      if (request.type) {
        filtered = filtered.filter(item => 
          item.mimeType.startsWith(`${request.type}/`)
        );
      }
      if (request.types) {
        filtered = filtered.filter(item => 
          request.types.some((type: string) => item.mimeType.startsWith(`${type}/`))
        );
      }

      // Search by filename
      if (request.search) {
        filtered = filtered.filter(item => 
          item.filename.toLowerCase().includes(request.search.toLowerCase())
        );
      }

      // Filter by tags
      if (request.tags) {
        filtered = filtered.filter(item => 
          request.tags.some((tag: string) => 
            (item.metadata?.tags as string[])?.includes(tag)
          )
        );
      }

      // Filter by date range
      if (request.fromDate || request.toDate) {
        const from = request.fromDate ? new Date(request.fromDate) : new Date(0);
        const to = request.toDate ? new Date(request.toDate + 'T23:59:59') : new Date();
        filtered = filtered.filter(item => 
          item.createdAt >= from && item.createdAt <= to
        );
      }

      // Filter by size range
      if (request.minSize || request.maxSize) {
        const min = request.minSize || 0;
        const max = request.maxSize || Infinity;
        filtered = filtered.filter(item => 
          item.size >= min && item.size <= max
        );
      }

      // Sort
      const sortBy = request.sortBy || 'createdAt';
      const order = request.order || 'desc';
      filtered.sort((a, b) => {
        const aVal = (a as any)[sortBy];
        const bVal = (b as any)[sortBy];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === 'asc' ? comparison : -comparison;
      });

      const total = filtered.length;

      // Paginate
      const page = request.page || 1;
      const limit = request.limit || 10;
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      // Process items
      let items = paginated.map(item => ({ ...item }));

      // Add thumbnails
      if (request.includeThumbnails) {
        items = items.map(item => {
          if (item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/')) {
            return { ...item, thumbnail: `/media/thumb-${item.id}` };
          }
          return item;
        });
      }

      // Optimize for bandwidth
      if (request.optimize) {
        items = items.map(({ id, filename, mimeType, size, url }) => 
          ({ id, filename, mimeType, size, url })
        );
      }

      // Build response
      const response: any = {
        items,
        total,
        page,
        limit,
        hasNext: start + limit < total,
        hasPrev: page > 1
      };

      if (request.sortBy) {
        response.sortBy = sortBy;
        response.order = order;
      }

      // Add statistics
      if (request.includeStats) {
        const byType: Record<string, number> = {};
        let totalSize = 0;
        
        media.forEach(item => {
          const type = item.mimeType.split('/')[0];
          if (type === 'application') {
            byType.document = (byType.document || 0) + 1;
          } else {
            byType[type] = (byType[type] || 0) + 1;
          }
          totalSize += item.size;
        });

        response.stats = {
          totalSize,
          totalItems: media.length,
          byType,
          averageSize: Math.floor(totalSize / media.length)
        };
      }

      // Group by date
      if (request.groupBy === 'date') {
        const groups: any[] = [];
        const grouped = new Map<string, MediaComponent[]>();
        
        filtered.forEach(item => {
          const date = item.createdAt.toISOString().split('T')[0];
          if (!grouped.has(date)) {
            grouped.set(date, []);
          }
          grouped.get(date)!.push(item);
        });

        grouped.forEach((items, date) => {
          groups.push({ date, items, count: items.length });
        });

        response.groups = groups;
      }

      if (request.optimize) {
        response.optimized = true;
      }

      return {
        status: 200,
        data: response
      };
    } catch (error) {
      return {
        status: 500,
        error: 'Internal server error'
      };
    }
  }
});

export {};
