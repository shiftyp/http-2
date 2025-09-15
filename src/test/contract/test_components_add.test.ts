import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing API contracts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('POST /api/pages/{pageId}/components', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should add a text component to the page', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'text',
      content: 'Welcome to KA1ABC radio station',
      position: { row: 0, column: 0 },
      properties: {
        fontSize: 'medium',
        alignment: 'left',
        color: 'black'
      }
    };

    const expectedResponse = {
      id: 'comp_456',
      pageId: 'page_123',
      type: 'text',
      content: 'Welcome to KA1ABC radio station',
      position: { row: 0, column: 0 },
      properties: {
        fontSize: 'medium',
        alignment: 'left',
        color: 'black'
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z'
    };

    mockFetch.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
    const data = await response.json();

    // Validate response schema
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('pageId');
    expect(data).toHaveProperty('type');
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('position');
    expect(data).toHaveProperty('properties');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');

    // Validate response data
    expect(data.pageId).toBe(pageId);
    expect(data.type).toBe(payload.type);
    expect(data.content).toBe(payload.content);
    expect(data.position).toEqual(payload.position);
    expect(data.properties).toEqual(payload.properties);
    expect(typeof data.id).toBe('string');
    expect(data.id).toMatch(/^comp_/);

    // Validate request was made correctly
    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  });

  it('should add a form component with multiple fields', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'form',
      content: {
        title: 'Contact Form',
        action: '/submit-contact',
        method: 'POST',
        fields: [
          {
            type: 'text',
            name: 'callsign',
            label: 'Your Callsign',
            required: true,
            placeholder: 'e.g. KA1ABC'
          },
          {
            type: 'email',
            name: 'email',
            label: 'Email Address',
            required: false,
            placeholder: 'your@email.com'
          },
          {
            type: 'textarea',
            name: 'message',
            label: 'QSL Message',
            required: true,
            rows: 4
          }
        ]
      },
      position: { row: 1, column: 0 },
      properties: {
        backgroundColor: 'white',
        border: '1px solid gray'
      }
    };

    const expectedResponse = {
      id: 'comp_789',
      pageId: 'page_123',
      type: 'form',
      content: payload.content,
      position: { row: 1, column: 0 },
      properties: payload.properties,
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z'
    };

    mockFetch.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
    const data = await response.json();

    expect(data.type).toBe('form');
    expect(data.content.fields).toHaveLength(3);
    expect(data.content.fields[0].type).toBe('text');
    expect(data.content.fields[0].required).toBe(true);
    expect(data.content.fields[2].type).toBe('textarea');
  });

  it('should add an image component', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'image',
      content: {
        src: '/images/qsl-card.jpg',
        alt: 'QSL Card Design',
        width: 200,
        height: 150
      },
      position: { row: 2, column: 0 },
      properties: {
        border: '2px solid black',
        borderRadius: '5px'
      }
    };

    const expectedResponse = {
      id: 'comp_img001',
      pageId: 'page_123',
      type: 'image',
      content: payload.content,
      position: { row: 2, column: 0 },
      properties: payload.properties,
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z'
    };

    mockFetch.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
    const data = await response.json();

    expect(data.type).toBe('image');
    expect(data.content.src).toBe('/images/qsl-card.jpg');
    expect(data.content.width).toBe(200);
    expect(data.content.height).toBe(150);
  });

  it('should reject component with missing type', async () => {
    const pageId = 'page_123';
    const payload = {
      content: 'Some content',
      position: { row: 0, column: 0 }
      // Missing type
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Component type is required'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject component with invalid type', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'invalid-component-type',
      content: 'Some content',
      position: { row: 0, column: 0 }
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Invalid component type: invalid-component-type'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject component with missing position', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'text',
      content: 'Some content'
      // Missing position
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Component position is required'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject component with invalid grid position', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'text',
      content: 'Some content',
      position: { row: -1, column: 0 } // Invalid negative row
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Grid position must be non-negative'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject component with position collision', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'text',
      content: 'Some content',
      position: { row: 0, column: 0 } // Position already occupied
    };

    const errorResponse = {
      error: 'Conflict',
      details: 'Another component already exists at this position'
    };

    mockFetch.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Conflict');
  });

  it('should reject component for non-existent page', async () => {
    const pageId = 'non_existent_page';
    const payload = {
      type: 'text',
      content: 'Some content',
      position: { row: 0, column: 0 }
    };

    const errorResponse = {
      error: 'Not Found',
      details: 'Page with ID non_existent_page not found'
    };

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not Found');
  });

  it('should validate form component field properties', async () => {
    const pageId = 'page_123';
    const payload = {
      type: 'form',
      content: {
        title: 'Contact Form',
        action: '/submit',
        fields: [
          {
            type: 'text',
            name: 'callsign',
            label: 'Your Callsign',
            required: true,
            validation: {
              pattern: '^[A-Z0-9]{3,7}$',
              message: 'Invalid callsign format'
            }
          }
        ]
      },
      position: { row: 0, column: 0 },
      properties: {}
    };

    const expectedResponse = {
      id: 'comp_form001',
      pageId: 'page_123',
      type: 'form',
      content: payload.content,
      position: { row: 0, column: 0 },
      properties: payload.properties,
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T00:00:00.000Z'
    };

    mockFetch.mockResolvedValueOnce({
      status: 201,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
    const data = await response.json();

    expect(data.type).toBe('form');
    expect(data.content.fields[0]).toHaveProperty('validation');
    expect(data.content.fields[0].validation.pattern).toBe('^[A-Z0-9]{3,7}$');
  });

  it('should reject malformed JSON', async () => {
    const pageId = 'page_123';
    const errorResponse = {
      error: 'Bad Request',
      details: 'Invalid JSON payload'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components`, {
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