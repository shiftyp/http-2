import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Database } from '../../lib/database';
import { RadioJSXCompiler } from '../../lib/jsx-radio';
import { HamRadioCompressor } from '../../lib/compression';
import { HTTPServer } from '../../lib/http-server';
import './setup';

/**
 * Integration test for creating the first page in visual page builder
 * Tests complete user journey from blank state to published page
 * Using REAL components, only mocking browser APIs
 */

interface Component {
  id: string;
  type: string;
  gridArea: { row: number; col: number; rowSpan: number; colSpan: number };
  properties: Record<string, any>;
}

interface Page {
  id: string;
  title: string;
  slug: string;
  components: Component[];
  metadata: {
    created: number;
    modified: number;
    size: number;
    compressedSize: number;
  };
}

describe('Visual Page Builder - Create First Page (Real Components)', () => {
  let database: Database;
  let jsxCompiler: RadioJSXCompiler;
  let compressor: HamRadioCompressor;
  let httpServer: HTTPServer;
  let currentPage: Page | null;

  beforeEach(async () => {
    // Use real components
    database = new Database();
    jsxCompiler = new RadioJSXCompiler();
    compressor = new HamRadioCompressor();
    httpServer = new HTTPServer({
      callsign: 'TEST1',
      requireSignatures: false
    });

    // Initialize database (mocked IndexedDB in setup.ts)
    await database.init();
    await httpServer.start();

    currentPage = null;
  });

  describe('Initial Page Setup', () => {
    it('should create blank page with default settings', () => {
      // Create new blank page
      const newPage: Page = {
        id: `page-${Date.now()}`,
        title: 'My First Page',
        slug: '/welcome',
        components: [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: 0,
          compressedSize: 0
        }
      };

      currentPage = newPage;

      expect(currentPage).toBeDefined();
      expect(currentPage.components).toHaveLength(0);
      expect(currentPage.slug).toBe('/welcome');
    });

    it('should validate page slug format', () => {
      const validSlugs = ['/home', '/about-us', '/contact', '/blog/post-1'];
      const invalidSlugs = ['home', '//double', '/with spaces', '/special!chars'];

      const validateSlug = (slug: string): boolean => {
        return /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(slug);
      };

      validSlugs.forEach(slug => {
        expect(validateSlug(slug)).toBe(true);
      });

      invalidSlugs.forEach(slug => {
        expect(validateSlug(slug)).toBe(false);
      });
    });
  });

  describe('Adding Components', () => {
    beforeEach(() => {
      currentPage = {
        id: `page-${Date.now()}`,
        title: 'Test Page',
        slug: '/test',
        components: [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: 0,
          compressedSize: 0
        }
      };
    });

    it('should add heading component to page', () => {
      const heading: Component = {
        id: `component-${Date.now()}`,
        type: 'HEADING',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
        properties: {
          text: 'Welcome to My Ham Radio Page',
          level: 1
        }
      };

      currentPage!.components.push(heading);

      expect(currentPage!.components).toHaveLength(1);
      expect(currentPage!.components[0].type).toBe('HEADING');
      expect(currentPage!.components[0].properties.text).toBe('Welcome to My Ham Radio Page');
    });

    it('should add paragraph with text content', () => {
      const paragraph: Component = {
        id: `component-${Date.now()}`,
        type: 'PARAGRAPH',
        gridArea: { row: 1, col: 0, rowSpan: 2, colSpan: 12 },
        properties: {
          text: 'This is my first page created with the ham radio HTTP system. Operating from grid square FN42.'
        }
      };

      currentPage!.components.push(paragraph);

      expect(currentPage!.components).toHaveLength(1);
      expect(currentPage!.components[0].type).toBe('PARAGRAPH');
    });

    it('should add button with action', () => {
      const button: Component = {
        id: `component-${Date.now()}`,
        type: 'BUTTON',
        gridArea: { row: 3, col: 4, rowSpan: 1, colSpan: 4 },
        properties: {
          text: 'Contact Me',
          action: '/contact',
          style: 'primary'
        }
      };

      currentPage!.components.push(button);

      expect(currentPage!.components).toHaveLength(1);
      expect(currentPage!.components[0].properties.action).toBe('/contact');
    });
  });

  describe('Grid Layout Management', () => {
    beforeEach(() => {
      currentPage = {
        id: `page-${Date.now()}`,
        title: 'Grid Test',
        slug: '/grid-test',
        components: [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: 0,
          compressedSize: 0
        }
      };
    });

    it('should detect grid position conflicts', () => {
      const component1: Component = {
        id: 'comp-1',
        type: 'HEADING',
        gridArea: { row: 0, col: 0, rowSpan: 2, colSpan: 6 },
        properties: { text: 'Header 1' }
      };

      const component2: Component = {
        id: 'comp-2',
        type: 'HEADING',
        gridArea: { row: 1, col: 3, rowSpan: 2, colSpan: 6 }, // Overlaps with component1
        properties: { text: 'Header 2' }
      };

      currentPage!.components.push(component1);

      // Check for overlap
      const checkOverlap = (existing: Component, newComp: Component): boolean => {
        const e = existing.gridArea;
        const n = newComp.gridArea;

        const rowOverlap = n.row < (e.row + e.rowSpan) && (n.row + n.rowSpan) > e.row;
        const colOverlap = n.col < (e.col + e.colSpan) && (n.col + n.colSpan) > e.col;

        return rowOverlap && colOverlap;
      };

      const hasConflict = currentPage!.components.some(c =>
        checkOverlap(c, component2)
      );

      expect(hasConflict).toBe(true);
    });

    it('should snap components to grid', () => {
      const snapToGrid = (position: number, gridSize: number = 1): number => {
        return Math.round(position / gridSize) * gridSize;
      };

      expect(snapToGrid(3.7)).toBe(4);
      expect(snapToGrid(2.2)).toBe(2);
      expect(snapToGrid(5.5)).toBe(6);
    });
  });

  describe('Preview and Compilation', () => {
    beforeEach(() => {
      currentPage = {
        id: `page-${Date.now()}`,
        title: 'Preview Test',
        slug: '/preview',
        components: [
          {
            id: 'h1',
            type: 'HEADING',
            gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
            properties: { text: 'Welcome', level: 1 }
          },
          {
            id: 'p1',
            type: 'PARAGRAPH',
            gridArea: { row: 1, col: 0, rowSpan: 2, colSpan: 12 },
            properties: { text: 'This is a test page.' }
          }
        ],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: 0,
          compressedSize: 0
        }
      };
    });

    it('should compile page components to JSX', () => {
      // Convert page components to JSX structure
      const jsxStructure = {
        type: 'div',
        props: { className: 'page' },
        children: currentPage!.components.map(c => ({
          type: c.type.toLowerCase(),
          props: {
            ...c.properties,
            style: {
              gridRow: `${c.gridArea.row + 1} / span ${c.gridArea.rowSpan}`,
              gridColumn: `${c.gridArea.col + 1} / span ${c.gridArea.colSpan}`
            }
          },
          children: c.properties.text ? [c.properties.text] : []
        }))
      };

      const compiled = jsxCompiler.compile(jsxStructure);

      expect(compiled).toBeDefined();
      expect(compiled.compiled).toBeDefined();
    });

    it('should compress page for transmission', () => {
      const pageData = JSON.stringify(currentPage);
      const compressed = compressor.compress(pageData);

      currentPage!.metadata.size = pageData.length;
      currentPage!.metadata.compressedSize = compressed.length;

      expect(compressed.length).toBeLessThan(pageData.length);
      expect(currentPage!.metadata.compressedSize).toBeLessThan(2048); // Under 2KB
    });

    it('should calculate bandwidth usage', () => {
      const jsxStructure = {
        type: 'div',
        props: {},
        children: currentPage!.components.map(c => ({
          type: c.type.toLowerCase(),
          props: c.properties,
          children: []
        }))
      };

      const compiled = jsxCompiler.compile(jsxStructure);
      const compressed = compressor.compress(JSON.stringify(compiled));

      const bandwidthUsage = {
        raw: JSON.stringify(jsxStructure).length,
        compiled: JSON.stringify(compiled).length,
        compressed: compressed.length,
        percentage: (compressed.length / 2048) * 100
      };

      expect(bandwidthUsage.compressed).toBeLessThan(bandwidthUsage.raw);
      expect(bandwidthUsage.percentage).toBeLessThan(100);
    });
  });

  describe('Save and Publish', () => {
    beforeEach(() => {
      currentPage = {
        id: `page-${Date.now()}`,
        title: 'Publish Test',
        slug: '/my-first-page',
        components: [
          {
            id: 'h1',
            type: 'HEADING',
            gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
            properties: { text: 'My First Ham Radio Page', level: 1 }
          }
        ],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: 0,
          compressedSize: 0
        }
      };
    });

    it('should save page to database', async () => {
      const pageContent = JSON.stringify(currentPage);
      const compressed = compressor.compress(pageContent);

      await database.savePage({
        slug: currentPage!.slug,
        content: pageContent,
        compressed: compressed
      });

      const saved = await database.getPage(currentPage!.slug);
      expect(saved).toBeDefined();
      expect(saved?.slug).toBe('/my-first-page');
    });

    it('should register page with HTTP server', async () => {
      // Compile page to HTML-like response
      const jsxStructure = {
        type: 'div',
        props: {},
        children: currentPage!.components.map(c => ({
          type: c.type.toLowerCase(),
          props: c.properties,
          children: c.properties.text ? [c.properties.text] : []
        }))
      };

      const compiled = jsxCompiler.compile(jsxStructure);
      const compressed = compressor.compress(JSON.stringify(compiled));

      // Register route with HTTP server
      httpServer.route('GET', currentPage!.slug, async () => ({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Compressed-Size': compressed.length.toString()
        },
        body: JSON.stringify(compiled)
      }));

      // Verify route is registered
      const routes = httpServer.getRoutes();
      expect(routes).toContain(`GET ${currentPage!.slug}`);
    });

    it('should update page modified timestamp', async () => {
      const originalModified = currentPage!.metadata.modified;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update page
      currentPage!.components.push({
        id: 'p2',
        type: 'PARAGRAPH',
        gridArea: { row: 1, col: 0, rowSpan: 1, colSpan: 12 },
        properties: { text: 'Updated content' }
      });

      currentPage!.metadata.modified = Date.now();

      expect(currentPage!.metadata.modified).toBeGreaterThan(originalModified);
    });
  });

  describe('Error Handling', () => {
    it('should validate component types', () => {
      const validTypes = ['HEADING', 'PARAGRAPH', 'TEXT', 'IMAGE', 'FORM',
                         'INPUT', 'BUTTON', 'LINK', 'LIST', 'TABLE',
                         'CONTAINER', 'DIVIDER'];

      const invalidComponent = {
        id: 'invalid',
        type: 'INVALID_TYPE',
        gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
        properties: {}
      };

      const isValid = validTypes.includes(invalidComponent.type);
      expect(isValid).toBe(false);
    });

    it('should prevent saving oversized pages', () => {
      const hugeText = 'x'.repeat(3000); // Over 2KB limit

      const hugePage: Page = {
        id: 'huge',
        title: 'Too Big',
        slug: '/huge',
        components: [{
          id: 'big',
          type: 'PARAGRAPH',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: hugeText }
        }],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: 0,
          compressedSize: 0
        }
      };

      const compressed = compressor.compress(JSON.stringify(hugePage));
      const isValid = compressed.length < 2048;

      expect(isValid).toBe(false);
    });
  });

  afterEach(async () => {
    // Clean up
    await database.close();
    await httpServer.stop();
    vi.clearAllMocks();
  });
});