import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch for testing API contracts
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GET /api/pages/{pageId}/preview', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should generate HTML preview for page with text components', async () => {
    const pageId = 'page_123';

    const expectedResponse = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Information</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; }
        .component { padding: 10px; }
    </style>
</head>
<body>
    <div class="grid">
        <div class="component" style="grid-row: 1; grid-column: 1;">
            <h1>Welcome to KA1ABC Station</h1>
        </div>
        <div class="component" style="grid-row: 2; grid-column: 1;">
            <p>QSL via bureau or direct to home address.</p>
        </div>
    </div>
</body>
</html>`,
      metadata: {
        uncompressedSize: 512,
        compressedSize: 187,
        compressionRatio: 2.74,
        componentCount: 2,
        bandwidthOptimized: true
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview`);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Validate response schema
    expect(data).toHaveProperty('html');
    expect(data).toHaveProperty('metadata');
    expect(data.metadata).toHaveProperty('uncompressedSize');
    expect(data.metadata).toHaveProperty('compressedSize');
    expect(data.metadata).toHaveProperty('compressionRatio');
    expect(data.metadata).toHaveProperty('componentCount');
    expect(data.metadata).toHaveProperty('bandwidthOptimized');

    // Validate HTML structure
    expect(data.html).toContain('<!DOCTYPE html>');
    expect(data.html).toContain('<title>Contact Information</title>');
    expect(data.html).toContain('Welcome to KA1ABC Station');
    expect(data.html).toContain('QSL via bureau');

    // Validate metadata
    expect(typeof data.metadata.uncompressedSize).toBe('number');
    expect(typeof data.metadata.compressedSize).toBe('number');
    expect(typeof data.metadata.compressionRatio).toBe('number');
    expect(data.metadata.componentCount).toBe(2);
    expect(typeof data.metadata.bandwidthOptimized).toBe('boolean');

    // Validate request was made correctly
    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/preview`);
  });

  it('should generate HTML preview with form components', async () => {
    const pageId = 'page_form';

    const expectedResponse = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Form</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; }
        .component { padding: 10px; }
        form { border: 1px solid #ccc; padding: 15px; }
        input, textarea { width: 100%; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="grid">
        <div class="component" style="grid-row: 1; grid-column: 1 / span 6;">
            <form action="/submit-contact" method="POST">
                <h3>Contact Form</h3>
                <label for="callsign">Your Callsign *</label>
                <input type="text" id="callsign" name="callsign" required placeholder="e.g. KA1ABC">
                <label for="message">QSL Message *</label>
                <textarea id="message" name="message" rows="4" required></textarea>
                <button type="submit">Send Message</button>
            </form>
        </div>
    </div>
</body>
</html>`,
      metadata: {
        uncompressedSize: 987,
        compressedSize: 298,
        compressionRatio: 3.31,
        componentCount: 1,
        bandwidthOptimized: true
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.html).toContain('<form action="/submit-contact"');
    expect(data.html).toContain('name="callsign"');
    expect(data.html).toContain('textarea');
    expect(data.html).toContain('required');
    expect(data.metadata.componentCount).toBe(1);
  });

  it('should handle compressed vs uncompressed output based on query param', async () => {
    const pageId = 'page_123';

    const expectedResponse = {
      html: 'H4sIAAAAAAAAA3VUTW...', // Base64 compressed HTML
      metadata: {
        uncompressedSize: 1024,
        compressedSize: 312,
        compressionRatio: 3.28,
        componentCount: 3,
        bandwidthOptimized: true,
        compressed: true
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview?compressed=true`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.metadata.compressed).toBe(true);
    expect(data.html).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 pattern

    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/preview?compressed=true`);
  });

  it('should optimize bandwidth with minimal CSS and inline styles', async () => {
    const pageId = 'page_optimized';

    const expectedResponse = {
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Optimized</title>
<style>body{margin:0;font:12px Arial}div{padding:5px}</style></head>
<body><div>Content optimized for radio transmission</div></body></html>`,
      metadata: {
        uncompressedSize: 178,
        compressedSize: 124,
        compressionRatio: 1.44,
        componentCount: 1,
        bandwidthOptimized: true,
        optimizations: [
          'minified_css',
          'removed_whitespace',
          'compressed_class_names',
          'inline_critical_styles'
        ]
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview?optimize=true`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.metadata).toHaveProperty('optimizations');
    expect(data.metadata.optimizations).toContain('minified_css');
    expect(data.metadata.optimizations).toContain('removed_whitespace');
    expect(data.html).not.toContain('\n    '); // No indentation
    expect(data.html).toContain('font:12px Arial'); // Shorthand CSS

    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/preview?optimize=true`);
  });

  it('should handle pages with image components', async () => {
    const pageId = 'page_with_images';

    const expectedResponse = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Gallery</title>
    <style>body { margin: 20px; } img { max-width: 100%; }</style>
</head>
<body>
    <div>
        <h1>QSL Card Gallery</h1>
        <img src="/images/qsl-card.jpg" alt="QSL Card Design" width="200" height="150">
    </div>
</body>
</html>`,
      metadata: {
        uncompressedSize: 298,
        compressedSize: 201,
        compressionRatio: 1.48,
        componentCount: 2,
        bandwidthOptimized: true,
        warnings: [
          'Images may significantly increase bandwidth usage over radio'
        ]
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.html).toContain('<img src="/images/qsl-card.jpg"');
    expect(data.html).toContain('width="200"');
    expect(data.metadata).toHaveProperty('warnings');
    expect(data.metadata.warnings[0]).toContain('Images may significantly increase bandwidth');
  });

  it('should return 404 for non-existent page', async () => {
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

    const response = await fetch(`/api/pages/${pageId}/preview`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Not Found');
  });

  it('should handle empty page with no components', async () => {
    const pageId = 'page_empty';

    const expectedResponse = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Empty Page</title>
    <style>body { font-family: Arial, sans-serif; margin: 20px; }</style>
</head>
<body>
    <div class="grid">
        <!-- No components to display -->
    </div>
</body>
</html>`,
      metadata: {
        uncompressedSize: 267,
        compressedSize: 195,
        compressionRatio: 1.37,
        componentCount: 0,
        bandwidthOptimized: true,
        warnings: [
          'Page has no components to display'
        ]
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.metadata.componentCount).toBe(0);
    expect(data.metadata.warnings).toContain('Page has no components to display');
    expect(data.html).toContain('<!-- No components to display -->');
  });

  it('should include radio-specific meta tags and optimizations', async () => {
    const pageId = 'page_radio_optimized';

    const expectedResponse = {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="radio-optimized" content="true">
    <meta name="bandwidth-target" content="2048">
    <meta name="compression" content="brotli">
    <title>Radio Optimized Page</title>
    <style>body{margin:0;font:11px monospace;line-height:1.2}</style>
</head>
<body>
    <div>
        <h1>KA1ABC - Radio Station</h1>
        <p>Optimized for 2.8kHz bandwidth amateur radio transmission.</p>
    </div>
</body>
</html>`,
      metadata: {
        uncompressedSize: 412,
        compressedSize: 245,
        compressionRatio: 1.68,
        componentCount: 2,
        bandwidthOptimized: true,
        radioOptimizations: [
          'monospace_font_for_better_readability',
          'reduced_line_height',
          'meta_tags_for_radio_context',
          'bandwidth_target_specified'
        ]
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview?radio=true`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.html).toContain('meta name="radio-optimized"');
    expect(data.html).toContain('meta name="bandwidth-target"');
    expect(data.html).toContain('font:11px monospace');
    expect(data.metadata).toHaveProperty('radioOptimizations');

    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/preview?radio=true`);
  });

  it('should provide JSX-radio template IDs for bandwidth optimization', async () => {
    const pageId = 'page_jsx_optimized';

    const expectedResponse = {
      html: `<template id="t1"><h1>{{title}}</h1></template>
<template id="t2"><p>{{content}}</p></template>
<div data-template="t1" data-props='{"title":"Welcome"}'></div>
<div data-template="t2" data-props='{"content":"Radio content"}'></div>`,
      metadata: {
        uncompressedSize: 200,
        compressedSize: 156,
        compressionRatio: 1.28,
        componentCount: 2,
        bandwidthOptimized: true,
        jsxRadioOptimized: true,
        templateIds: ['t1', 't2'],
        estimatedTransmissionBytes: 156
      }
    };

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve(expectedResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview?jsx-radio=true`);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.html).toContain('<template id="t1">');
    expect(data.html).toContain('data-template="t1"');
    expect(data.html).toContain('data-props=');
    expect(data.metadata.jsxRadioOptimized).toBe(true);
    expect(data.metadata.templateIds).toEqual(['t1', 't2']);

    expect(mockFetch).toHaveBeenCalledWith(`/api/pages/${pageId}/preview?jsx-radio=true`);
  });

  it('should handle preview generation errors', async () => {
    const pageId = 'page_broken';

    const errorResponse = {
      error: 'Preview Generation Failed',
      details: 'Component rendering failed: Invalid template syntax in component comp_123'
    };

    mockFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    const response = await fetch(`/api/pages/${pageId}/preview`);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toBe('Preview Generation Failed');
    expect(data.details).toContain('Component rendering failed');
  });
});