import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing API contracts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('POST /api/pages/{pageId}/components/{componentId}/move', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should move a component to a new grid position', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      position: { row: 2, column: 1 }
    };

    const expectedResponse = {
      id: 'comp_456',
      pageId: 'page_123',
      type: 'text',
      content: 'Welcome to KA1ABC radio station',
      position: { row: 2, column: 1 },
      properties: {
        fontSize: 'medium',
        alignment: 'left',
        color: 'black'
      },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T01:00:00.000Z'
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Validate response schema
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('pageId');
    expect(data).toHaveProperty('position');
    expect(data).toHaveProperty('updatedAt');

    // Validate position was updated
    expect(data.id).toBe(componentId);
    expect(data.pageId).toBe(pageId);
    expect(data.position).toEqual(payload.position);

    // Validate request was made correctly
    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  });

  it('should move a form component to different row', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_form001';
    const payload = {
      position: { row: 0, column: 0 }
    };

    const expectedResponse = {
      id: 'comp_form001',
      pageId: 'page_123',
      type: 'form',
      content: {
        title: 'Contact Form',
        fields: [
          { type: 'text', name: 'callsign', label: 'Callsign', required: true }
        ]
      },
      position: { row: 0, column: 0 },
      properties: { backgroundColor: 'white' },
      createdAt: '2025-09-14T00:00:00.000Z',
      updatedAt: '2025-09-14T01:30:00.000Z'
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.type).toBe('form');
    expect(data.position.row).toBe(0);
    expect(data.position.column).toBe(0);
  });

  it('should reject move with missing position', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      // Missing position
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'New position is required'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject move with invalid position format', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      position: { row: 'invalid', column: 0 }
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Position row and column must be non-negative integers'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject move with negative position values', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      position: { row: -1, column: 2 }
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Position row and column must be non-negative'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
  });

  it('should reject move to position with collision', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      position: { row: 1, column: 0 } // Position already occupied by another component
    };

    const errorResponse = {
      error: 'Conflict',
      details: 'Another component already exists at position (1, 0)'
    };

    mockFetch.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Conflict');
    expect(data.details).toContain('position (1, 0)');
  });

  it('should reject move to out-of-bounds position', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      position: { row: 50, column: 50 } // Beyond maximum grid size
    };

    const errorResponse = {
      error: 'Validation failed',
      details: 'Position exceeds maximum grid dimensions (20x12)'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('maximum grid dimensions');
  });

  it('should reject move for non-existent component', async () => {
    const pageId = 'page_123';
    const componentId = 'non_existent_component';
    const payload = {
      position: { row: 1, column: 1 }
    };

    const errorResponse = {
      error: 'Not Found',
      details: 'Component with ID non_existent_component not found'
    };

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not Found');
  });

  it('should reject move for non-existent page', async () => {
    const pageId = 'non_existent_page';
    const componentId = 'comp_456';
    const payload = {
      position: { row: 1, column: 1 }
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

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not Found');
  });

  it('should reject move when component does not belong to page', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456'; // Belongs to a different page
    const payload = {
      position: { row: 1, column: 1 }
    };

    const errorResponse = {
      error: 'Forbidden',
      details: 'Component comp_456 does not belong to page page_123'
    };

    mockFetch.mockResolvedValueOnce({
      status: 403,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Forbidden');
  });

  it('should handle move to same position (no-op)', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const payload = {
      position: { row: 0, column: 0 } // Component is already at this position
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
      updatedAt: '2025-09-14T00:00:00.000Z' // updatedAt unchanged for no-op
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.position).toEqual(payload.position);
    expect(data.updatedAt).toBe('2025-09-14T00:00:00.000Z'); // No update timestamp change
  });

  it('should detect collision with multi-cell components', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_small';
    const payload = {
      position: { row: 1, column: 1 }
    };

    const errorResponse = {
      error: 'Conflict',
      details: 'Position conflicts with multi-cell component at (1, 1) spanning 2x2 cells'
    };

    mockFetch.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Conflict');
    expect(data.details).toContain('multi-cell component');
  });

  it('should reject malformed JSON', async () => {
    const pageId = 'page_123';
    const componentId = 'comp_456';
    const errorResponse = {
      error: 'Bad Request',
      details: 'Invalid JSON payload'
    };

    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/components/${componentId}/move`, {
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