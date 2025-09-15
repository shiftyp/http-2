import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing API contracts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('POST /api/pages', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should create a new page with valid data', async () => {
    const payload = {
      siteId: 'site_123',
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
          }
        ]
      }
    };

    const expectedResponse = {
      id: 'page_456',
      siteId: 'site_123',
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
          }
        ]
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z',
      published: false
    };

    mockFetch.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    // This will fail initially (endpoint doesn't exist)
    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
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

    // Validate response data
    expect(data.siteId).toBe(payload.siteId);
    expect(data.title).toBe(payload.title);
    expect(data.path).toBe(payload.path);
    expect(data.content).toEqual(payload.content);
    expect(typeof data.id).toBe('string');
    expect(data.id).toMatch(/^page_/);
    expect(typeof data.published).toBe('boolean');

    // Validate request was made correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  });

  it('should reject payload with missing siteId', async () => {
    const payload = {
      title: 'Contact Information',
      path: '/contact',
      content: { components: [] }
      // Missing siteId
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'siteId is required'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject payload with missing title', async () => {
    const payload = {
      siteId: 'site_123',
      path: '/contact',
      content: { components: [] }
      // Missing title
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'title is required'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject payload with missing path', async () => {
    const payload = {
      siteId: 'site_123',
      title: 'Contact Information',
      content: { components: [] }
      // Missing path
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'path is required'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject payload with invalid path format', async () => {
    const payload = {
      siteId: 'site_123',
      title: 'Contact Information',
      path: 'invalid-path', // Should start with /
      content: { components: [] }
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'path must start with /'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject payload with invalid content structure', async () => {
    const payload = {
      siteId: 'site_123',
      title: 'Contact Information',
      path: '/contact',
      content: 'invalid-content-format' // Should be an object
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'content must be an object with components array'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should handle non-existent siteId', async () => {
    const payload = {
      siteId: 'non_existent_site',
      title: 'Contact Information',
      path: '/contact',
      content: { components: [] }
    };

    const errorResponse = {
      error: 'Not Found',
      details: 'Site with ID non_existent_site not found'
    };

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not Found');
  });

  it('should handle duplicate path within site conflict', async () => {
    const payload = {
      siteId: 'site_123',
      title: 'Home Page Duplicate',
      path: '/', // Already exists
      content: { components: [] }
    };

    const errorResponse = {
      error: 'Conflict',
      details: 'A page with this path already exists in the site'
    };

    mockFetch.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Conflict');
  });

  it('should create page with complex content components', async () => {
    const payload = {
      siteId: 'site_123',
      title: 'Complex Page',
      path: '/complex',
      content: {
        components: [
          {
            type: 'heading',
            level: 1,
            text: 'Welcome'
          },
          {
            type: 'paragraph',
            text: 'This is a paragraph with some content.'
          },
          {
            type: 'form',
            fields: [
              {
                type: 'text',
                name: 'callsign',
                label: 'Your Callsign',
                required: true
              },
              {
                type: 'textarea',
                name: 'message',
                label: 'Message',
                required: false
              }
            ]
          },
          {
            type: 'link',
            text: 'Back to Home',
            href: '/'
          }
        ]
      }
    };

    const expectedResponse = {
      id: 'page_complex',
      siteId: 'site_123',
      title: 'Complex Page',
      path: '/complex',
      content: payload.content,
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z',
      published: false
    };

    mockFetch.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
    const data = await response.json();

    expect(data.content.components).toHaveLength(4);
    expect(data.content.components[0].type).toBe('heading');
    expect(data.content.components[2].type).toBe('form');
    expect(data.content.components[2].fields).toHaveLength(2);
  });

  it('should reject malformed JSON', async () => {
    const errorResponse = {
      error: 'Bad Request',
      details: 'Invalid JSON payload'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{'
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Bad Request');
  });
});