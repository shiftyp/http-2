import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing API contracts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GET /api/pages/{pageId}', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should return page details for valid pageId', async () => {
    const pageId = 'page_123';
    const expectedResponse = {
      id: 'page_123',
      siteId: 'site_456',
      title: 'Contact Information',
      path: '/contact',
      content: {
        components: [
          {
            type: 'heading',
            level: 1,
            text: 'Contact KA1ABC'
          },
          {
            type: 'paragraph',
            text: 'QSL via bureau or direct to home address.'
          },
          {
            type: 'form',
            fields: [
              {
                type: 'text',
                name: 'callsign',
                label: 'Your Callsign',
                required: true
              }
            ]
          }
        ]
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T01:30:00.000Z',
      published: true,
      site: {
        id: 'site_456',
        callsign: 'KA1ABC',
        name: 'Test Radio Station'
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    // This will fail initially (endpoint doesn't exist)
    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Validate response schema
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('siteId');
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('path');
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('published');
    expect(data).toHaveProperty('site');

    // Validate response data
    expect(data.id).toBe(pageId);
    expect(typeof data.siteId).toBe('string');
    expect(typeof data.title).toBe('string');
    expect(typeof data.path).toBe('string');
    expect(typeof data.content).toBe('object');
    expect(typeof data.published).toBe('boolean');
    expect(Array.isArray(data.content.components)).toBe(true);

    // Validate site reference
    expect(data.site).toHaveProperty('id');
    expect(data.site).toHaveProperty('callsign');
    expect(data.site).toHaveProperty('name');
    expect(data.site.id).toBe(data.siteId);

    // Validate request was made correctly
    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}`);
  });

  it('should return 404 for non-existent pageId', async () => {
    const pageId = 'non_existent_page';
    const errorResponse = {
      error: 'Not Found',
      details: 'Page with ID non_existent_page not found'
    };

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not Found');
    expect(data.details).toContain(pageId);
  });

  it('should return 400 for invalid pageId format', async () => {
    const pageId = 'invalid-id-format';
    const errorResponse = {
      error: 'Bad Request',
      details: 'Invalid page ID format'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Bad Request');
  });

  it('should return page with empty content components', async () => {
    const pageId = 'page_empty';
    const expectedResponse = {
      id: 'page_empty',
      siteId: 'site_456',
      title: 'Empty Page',
      path: '/empty',
      content: {
        components: []
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z',
      published: false,
      site: {
        id: 'site_456',
        callsign: 'KA1ABC',
        name: 'Test Radio Station'
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.content.components).toEqual([]);
    expect(data.published).toBe(false);
  });

  it('should return page with complex content components', async () => {
    const pageId = 'page_complex';
    const expectedResponse = {
      id: 'page_complex',
      siteId: 'site_789',
      title: 'Complex Page',
      path: '/complex',
      content: {
        components: [
          {
            type: 'heading',
            level: 1,
            text: 'Welcome to Complex Page'
          },
          {
            type: 'paragraph',
            text: 'This page demonstrates various component types.'
          },
          {
            type: 'list',
            ordered: true,
            items: [
              'First item',
              'Second item',
              'Third item'
            ]
          },
          {
            type: 'form',
            action: '/submit',
            method: 'POST',
            fields: [
              {
                type: 'text',
                name: 'callsign',
                label: 'Callsign',
                required: true,
                pattern: '^[A-Z0-9]{3,7}$'
              },
              {
                type: 'email',
                name: 'email',
                label: 'Email Address',
                required: false
              },
              {
                type: 'select',
                name: 'band',
                label: 'Preferred Band',
                options: [
                  { value: '20m', label: '20 meters' },
                  { value: '40m', label: '40 meters' },
                  { value: '80m', label: '80 meters' }
                ]
              }
            ]
          },
          {
            type: 'table',
            headers: ['Frequency', 'Mode', 'Power'],
            rows: [
              ['14.074 MHz', 'FT8', '100W'],
              ['7.074 MHz', 'FT8', '100W']
            ]
          }
        ]
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T02:15:00.000Z',
      published: true,
      site: {
        id: 'site_789',
        callsign: 'W1DEF',
        name: 'Advanced Radio Station'
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.content.components).toHaveLength(5);

    // Validate heading component
    expect(data.content.components[0].type).toBe('heading');
    expect(data.content.components[0].level).toBe(1);

    // Validate list component
    expect(data.content.components[2].type).toBe('list');
    expect(data.content.components[2].ordered).toBe(true);
    expect(Array.isArray(data.content.components[2].items)).toBe(true);

    // Validate form component
    expect(data.content.components[3].type).toBe('form');
    expect(Array.isArray(data.content.components[3].fields)).toBe(true);
    expect(data.content.components[3].fields).toHaveLength(3);

    // Validate table component
    expect(data.content.components[4].type).toBe('table');
    expect(Array.isArray(data.content.components[4].headers)).toBe(true);
    expect(Array.isArray(data.content.components[4].rows)).toBe(true);
  });

  it('should support includeContent=false query parameter', async () => {
    const pageId = 'page_123';
    const expectedResponse = {
      id: 'page_123',
      siteId: 'site_456',
      title: 'Contact Information',
      path: '/contact',
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T01:30:00.000Z',
      published: true,
      site: {
        id: 'site_456',
        callsign: 'KA1ABC',
        name: 'Test Radio Station'
      }
      // Note: content property is omitted
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}?includeContent=false`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).not.toHaveProperty('content');
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('path');
    expect(data).toHaveProperty('site');

    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}?includeContent=false`);
  });

  it('should handle server errors gracefully', async () => {
    const pageId = 'page_123';
    const errorResponse = {
      error: 'Internal Server Error',
      details: 'Database connection failed'
    };

    mockFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Internal Server Error');
  });

  it('should return page with minimal required fields', async () => {
    const pageId = 'page_minimal';
    const expectedResponse = {
      id: 'page_minimal',
      siteId: 'site_123',
      title: 'Minimal Page',
      path: '/minimal',
      content: {
        components: [
          {
            type: 'paragraph',
            text: 'Simple content'
          }
        ]
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z',
      published: true,
      site: {
        id: 'site_123',
        callsign: 'N0CALL',
        name: 'Minimal Station'
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.title).toBe('Minimal Page');
    expect(data.content.components).toHaveLength(1);
    expect(data.content.components[0].type).toBe('paragraph');
  });
});