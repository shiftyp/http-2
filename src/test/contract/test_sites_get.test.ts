import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing API contracts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GET /api/sites', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should return list of all sites', async () => {
    const expectedResponse = {
      sites: [
        {
          id: 'site_123',
          callsign: 'KA1ABC',
          name: 'Test Radio Station 1',
          createdAt: '2025-09-14T00:00:00.000Z',
          updatedAt: '2025-09-14T00:00:00.000Z',
          pages: [
            {
              id: 'page_456',
              title: 'Home Page',
              path: '/',
              createdAt: '2025-09-14T00:00:00.000Z',
              updatedAt: '2025-09-14T00:00:00.000Z'
            }
          ]
        },
        {
          id: 'site_789',
          callsign: 'W1DEF',
          name: 'Test Radio Station 2',
          createdAt: '2025-09-14T01:00:00.000Z',
          updatedAt: '2025-09-14T01:00:00.000Z',
          pages: []
        }
      ],
      total: 2
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    // This will fail initially (endpoint doesn't exist)
    const response = await fetch('/api/sites');

    expect(response.status).toBe(200);
    const data = await response.json();

    // Validate response schema
    expect(data).toHaveProperty('sites');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.sites)).toBe(true);
    expect(typeof data.total).toBe('number');

    // Validate site objects
    data.sites.forEach((site: any) => {
      expect(site).toHaveProperty('id');
      expect(site).toHaveProperty('callsign');
      expect(site).toHaveProperty('name');
      expect(site).toHaveProperty('createdAt');
      expect(site).toHaveProperty('updatedAt');
      expect(site).toHaveProperty('pages');
      expect(Array.isArray(site.pages)).toBe(true);
      expect(typeof site.id).toBe('string');
      expect(site.id).toMatch(/^site_/);
    });

    expect(data.total).toBe(data.sites.length);

    // Validate request was made correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/sites');
  });

  it('should return empty list when no sites exist', async () => {
    const expectedResponse = {
      sites: [],
      total: 0
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch('/api/sites');

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('sites');
    expect(data).toHaveProperty('total');
    expect(data.sites).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('should support pagination with limit parameter', async () => {
    const expectedResponse = {
      sites: [
        {
          id: 'site_123',
          callsign: 'KA1ABC',
          name: 'Test Radio Station 1',
          createdAt: '2025-09-14T00:00:00.000Z',
          updatedAt: '2025-09-14T00:00:00.000Z',
          pages: []
        }
      ],
      total: 10,
      limit: 1,
      offset: 0,
      hasMore: true
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch('/api/sites?limit=1');

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty('sites');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('offset');
    expect(data).toHaveProperty('hasMore');

    expect(data.limit).toBe(1);
    expect(data.offset).toBe(0);
    expect(data.hasMore).toBe(true);
    expect(data.sites.length).toBe(1);

    expect(mockFetch).toHaveBeenCalledWith('/api/sites?limit=1');
  });

  it('should support pagination with limit and offset parameters', async () => {
    const expectedResponse = {
      sites: [
        {
          id: 'site_456',
          callsign: 'W1DEF',
          name: 'Test Radio Station 2',
          createdAt: '2025-09-14T01:00:00.000Z',
          updatedAt: '2025-09-14T01:00:00.000Z',
          pages: []
        }
      ],
      total: 10,
      limit: 1,
      offset: 1,
      hasMore: true
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch('/api/sites?limit=1&offset=1');

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.limit).toBe(1);
    expect(data.offset).toBe(1);
    expect(data.hasMore).toBe(true);
    expect(data.sites.length).toBe(1);

    expect(mockFetch).toHaveBeenCalledWith('/api/sites?limit=1&offset=1');
  });

  it('should support filtering by callsign', async () => {
    const expectedResponse = {
      sites: [
        {
          id: 'site_123',
          callsign: 'KA1ABC',
          name: 'Test Radio Station 1',
          createdAt: '2025-09-14T00:00:00.000Z',
          updatedAt: '2025-09-14T00:00:00.000Z',
          pages: []
        }
      ],
      total: 1
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch('/api/sites?callsign=KA1ABC');

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.sites.length).toBe(1);
    expect(data.sites[0].callsign).toBe('KA1ABC');
    expect(data.total).toBe(1);

    expect(mockFetch).toHaveBeenCalledWith('/api/sites?callsign=KA1ABC');
  });

  it('should return 400 for invalid limit parameter', async () => {
    const errorResponse = {
      error: 'Bad Request',
      details: 'limit must be a positive integer'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/sites?limit=invalid');

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Bad Request');
  });

  it('should return 400 for invalid offset parameter', async () => {
    const errorResponse = {
      error: 'Bad Request',
      details: 'offset must be a non-negative integer'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/sites?offset=-1');

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Bad Request');
  });

  it('should handle server errors gracefully', async () => {
    const errorResponse = {
      error: 'Internal Server Error',
      details: 'Database connection failed'
    };

    mockFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/sites');

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Internal Server Error');
  });
});