import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Database } from '../../lib/database';
import { RadioJSXCompiler } from '../../lib/jsx-radio';
import { HamRadioCompressor } from '../../lib/compression';
import './setup';

/**
 * Integration test for applying templates to pages
 * Tests complete user workflow from browsing templates to customizing content
 * Using REAL components, only mocking browser APIs
 */

interface Template {
  id: string;
  name: string;
  category: string;
  preview: string;
  components: Array<{
    type: string;
    gridArea: { row: number; col: number; rowSpan: number; colSpan: number };
    properties: Record<string, any>;
  }>;
}

interface Page {
  id: string;
  title: string;
  slug: string;
  templateId?: string;
  components: any[];
  metadata: {
    compressedSize: number;
    bandwidthValid: boolean;
  };
}

describe('Visual Page Builder - Apply Template (Real Components)', () => {
  let database: Database;
  let jsxCompiler: RadioJSXCompiler;
  let compressor: HamRadioCompressor;
  let templates: Map<string, Template>;
  let pages: Map<string, Page>;

  beforeEach(async () => {
    // Use real components
    database = new Database();
    jsxCompiler = new RadioJSXCompiler();
    compressor = new HamRadioCompressor();

    // Initialize database (mocked IndexedDB in setup.ts)
    await database.init();

    // Initialize template and page storage
    templates = new Map();
    pages = new Map();

    // Add default templates
    const contactTemplate: Template = {
      id: 'template-contact-1',
      name: 'Basic Contact',
      category: 'contact',
      preview: '<div>Contact template preview</div>',
      components: [
        {
          type: 'HEADING',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: 'Contact Us', level: 1 }
        },
        {
          type: 'FORM',
          gridArea: { row: 1, col: 0, rowSpan: 4, colSpan: 12 },
          properties: { action: '/submit', method: 'POST' }
        },
        {
          type: 'INPUT',
          gridArea: { row: 2, col: 0, rowSpan: 1, colSpan: 6 },
          properties: { name: 'callsign', placeholder: 'Your Callsign', required: true }
        },
        {
          type: 'INPUT',
          gridArea: { row: 2, col: 6, rowSpan: 1, colSpan: 6 },
          properties: { name: 'email', type: 'email', placeholder: 'Email', required: false }
        }
      ]
    };

    const blogTemplate: Template = {
      id: 'template-blog-1',
      name: 'Simple Blog',
      category: 'blog',
      preview: '<div>Blog template preview</div>',
      components: [
        {
          type: 'HEADING',
          gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
          properties: { text: 'Latest Updates', level: 1 }
        },
        {
          type: 'CONTAINER',
          gridArea: { row: 1, col: 0, rowSpan: 3, colSpan: 8 },
          properties: { className: 'content' }
        },
        {
          type: 'LIST',
          gridArea: { row: 1, col: 8, rowSpan: 3, colSpan: 4 },
          properties: { items: ['Archives', 'Categories', 'Tags'] }
        }
      ]
    };

    templates.set(contactTemplate.id, contactTemplate);
    templates.set(blogTemplate.id, blogTemplate);
  });

  describe('Browse and Select Templates', () => {
    it('should list available templates by category', () => {
      // Get all templates
      const allTemplates = Array.from(templates.values());
      expect(allTemplates).toHaveLength(2);

      // Filter by category
      const contactTemplates = allTemplates.filter(t => t.category === 'contact');
      expect(contactTemplates).toHaveLength(1);
      expect(contactTemplates[0].name).toBe('Basic Contact');

      const blogTemplates = allTemplates.filter(t => t.category === 'blog');
      expect(blogTemplates).toHaveLength(1);
      expect(blogTemplates[0].name).toBe('Simple Blog');
    });

    it('should preview template before applying', () => {
      const template = templates.get('template-contact-1');
      expect(template).toBeDefined();
      expect(template?.preview).toContain('Contact template preview');
      expect(template?.components).toHaveLength(4);
    });
  });

  describe('Apply Template to Page', () => {
    it('should apply template components to new page', async () => {
      const template = templates.get('template-contact-1')!;

      // Create new page from template
      const newPage: Page = {
        id: `page-${Date.now()}`,
        title: 'Contact Us',
        slug: '/contact',
        templateId: template.id,
        components: [...template.components],
        metadata: {
          compressedSize: 0,
          bandwidthValid: true
        }
      };

      // Compile components with real JSX compiler
      const compiledComponents = jsxCompiler.compile({
        type: 'div',
        props: {},
        children: newPage.components.map(c => ({
          type: c.type.toLowerCase(),
          props: c.properties,
          children: []
        }))
      });

      // Compress with real compressor
      const compressed = compressor.compress(JSON.stringify(compiledComponents));
      newPage.metadata.compressedSize = compressed.length;

      // Check bandwidth constraints (2KB for HF bands)
      newPage.metadata.bandwidthValid = compressed.length < 2048;

      // Save to database
      await database.savePage({
        slug: newPage.slug,
        content: JSON.stringify(newPage),
        compressed: compressed
      });

      pages.set(newPage.id, newPage);

      // Verify page was created correctly
      expect(newPage.components).toHaveLength(4);
      expect(newPage.templateId).toBe('template-contact-1');
      expect(newPage.metadata.bandwidthValid).toBe(true);

      // Verify it was saved to database
      const savedPage = await database.getPage(newPage.slug);
      expect(savedPage).toBeDefined();
    });

    it('should allow customizing template after applying', async () => {
      // Apply blog template
      const template = templates.get('template-blog-1')!;

      const page: Page = {
        id: `page-${Date.now()}`,
        title: 'Ham Radio Blog',
        slug: '/blog',
        templateId: template.id,
        components: [...template.components],
        metadata: {
          compressedSize: 0,
          bandwidthValid: true
        }
      };

      // Customize heading text
      page.components[0].properties.text = 'KA1ABC Ham Radio Blog';

      // Add custom content to container
      const containerIndex = page.components.findIndex(c => c.type === 'CONTAINER');
      page.components[containerIndex].properties.children = [
        {
          type: 'PARAGRAPH',
          properties: { text: 'Welcome to my ham radio blog!' }
        }
      ];

      // Update list items
      const listIndex = page.components.findIndex(c => c.type === 'LIST');
      page.components[listIndex].properties.items = [
        'DX Reports',
        'Equipment Reviews',
        'Antenna Projects'
      ];

      // Compile and compress with real components
      const compiled = jsxCompiler.compile({
        type: 'div',
        props: {},
        children: page.components.map(c => ({
          type: c.type.toLowerCase(),
          props: c.properties,
          children: c.properties.children || []
        }))
      });

      const compressed = compressor.compress(JSON.stringify(compiled));
      page.metadata.compressedSize = compressed.length;
      page.metadata.bandwidthValid = compressed.length < 2048;

      await database.savePage({
        slug: page.slug,
        content: JSON.stringify(page),
        compressed: compressed
      });

      pages.set(page.id, page);

      // Verify customizations
      expect(page.components[0].properties.text).toBe('KA1ABC Ham Radio Blog');
      expect(page.components[listIndex].properties.items).toContain('DX Reports');
      expect(page.metadata.bandwidthValid).toBe(true);
    });

    it('should maintain template link for updates', () => {
      const template = templates.get('template-contact-1')!;

      const page: Page = {
        id: `page-${Date.now()}`,
        title: 'Contact',
        slug: '/contact',
        templateId: template.id,
        components: [...template.components],
        metadata: {
          compressedSize: 0,
          bandwidthValid: true
        }
      };

      pages.set(page.id, page);

      // Find all pages using this template
      const pagesUsingTemplate = Array.from(pages.values())
        .filter(p => p.templateId === template.id);

      expect(pagesUsingTemplate).toHaveLength(1);
      expect(pagesUsingTemplate[0].id).toBe(page.id);
    });
  });

  describe('Template Validation', () => {
    it('should validate component grid positions do not overlap', () => {
      const template = templates.get('template-contact-1')!;

      // Check for overlapping components
      const gridMap = new Map<string, any>();
      let hasOverlap = false;

      for (const component of template.components) {
        const { row, col, rowSpan, colSpan } = component.gridArea;

        for (let r = row; r < row + rowSpan; r++) {
          for (let c = col; c < col + colSpan; c++) {
            const key = `${r}-${c}`;
            if (gridMap.has(key)) {
              hasOverlap = true;
              break;
            }
            gridMap.set(key, component);
          }
        }
      }

      expect(hasOverlap).toBe(false);
    });

    it('should ensure template fits within bandwidth constraints', async () => {
      const template = templates.get('template-blog-1')!;

      // Compile template with real compiler
      const compiled = jsxCompiler.compile({
        type: 'div',
        props: {},
        children: template.components.map(c => ({
          type: c.type.toLowerCase(),
          props: c.properties,
          children: []
        }))
      });

      // Compress with real compressor
      const compressed = compressor.compress(JSON.stringify(compiled));

      // Should be under 2KB for HF bands
      expect(compressed.length).toBeLessThan(2048);
    });

    it('should reject template with invalid component types', () => {
      const validTypes = ['HEADING', 'PARAGRAPH', 'TEXT', 'IMAGE', 'FORM',
                         'INPUT', 'BUTTON', 'LINK', 'LIST', 'TABLE',
                         'CONTAINER', 'DIVIDER'];

      const invalidTemplate: Template = {
        id: 'invalid-1',
        name: 'Invalid',
        category: 'test',
        preview: '',
        components: [
          {
            type: 'INVALID_TYPE',
            gridArea: { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
            properties: {}
          }
        ]
      };

      // Validate component types
      const allValid = invalidTemplate.components.every(c =>
        validTypes.includes(c.type)
      );

      expect(allValid).toBe(false);
    });
  });

  afterEach(async () => {
    // Clean up
    await database.close();
    vi.clearAllMocks();
  });
});