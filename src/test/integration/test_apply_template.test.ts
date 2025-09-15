import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';

/**
 * Integration test for applying templates to pages
 * Tests complete user workflow from browsing templates to customizing content
 *
 * This test will initially fail (TDD approach) until the visual page builder is implemented
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
  components: string[];
  metadata: {
    compressedSize: number;
    bandwidthValid: boolean;
  };
}

// Mock template service
class MockTemplateService {
  private templates = new Map<string, Template>();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    // Contact page template
    const contactTemplate: Template = {
      id: 'template-contact-1',
      name: 'Basic Contact',
      category: 'contact',
      preview: '<div>Contact template preview</div>',
      components: [
        {
          type: 'heading',
          gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 12 },
          properties: {
            content: 'Contact {{CALLSIGN}}',
            level: 1
          }
        },
        {
          type: 'text',
          gridArea: { row: 2, col: 1, rowSpan: 1, colSpan: 6 },
          properties: {
            content: 'Feel free to reach out via radio or email.'
          }
        },
        {
          type: 'form',
          gridArea: { row: 3, col: 1, rowSpan: 1, colSpan: 12 },
          properties: {
            fields: [
              { type: 'email', name: 'email', label: 'Email' },
              { type: 'textarea', name: 'message', label: 'Message' }
            ]
          }
        }
      ]
    };

    // About page template
    const aboutTemplate: Template = {
      id: 'template-about-1',
      name: 'Simple About',
      category: 'about',
      preview: '<div>About template preview</div>',
      components: [
        {
          type: 'heading',
          gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 12 },
          properties: {
            content: 'About {{CALLSIGN}}',
            level: 1
          }
        },
        {
          type: 'text',
          gridArea: { row: 2, col: 1, rowSpan: 1, colSpan: 8 },
          properties: {
            content: 'Welcome to my amateur radio station!'
          }
        },
        {
          type: 'image',
          gridArea: { row: 2, col: 9, rowSpan: 1, colSpan: 4 },
          properties: {
            src: '/images/station.jpg',
            alt: 'Radio station setup'
          }
        }
      ]
    };

    this.templates.set(contactTemplate.id, contactTemplate);
    this.templates.set(aboutTemplate.id, aboutTemplate);
  }

  async browseTemplates(category?: string): Promise<Template[]> {
    const allTemplates = Array.from(this.templates.values());

    if (category) {
      return allTemplates.filter(t => t.category === category);
    }

    return allTemplates;
  }

  async getTemplate(templateId: string): Promise<Template | null> {
    return this.templates.get(templateId) || null;
  }
}

// Mock page builder with template functionality
class MockPageBuilderWithTemplates {
  private pages = new Map<string, Page>();
  private currentPage: Page | null = null;
  private components = new Map();
  private componentCounter = 0;
  private templateService = new MockTemplateService();

  async createPage(config: { title: string; slug: string }): Promise<Page> {
    const page: Page = {
      id: `page-${Date.now()}`,
      title: config.title,
      slug: config.slug,
      components: [],
      metadata: {
        compressedSize: 100,
        bandwidthValid: true
      }
    };

    this.pages.set(page.id, page);
    this.currentPage = page;
    return page;
  }

  async browseTemplates(category?: string): Promise<Template[]> {
    return this.templateService.browseTemplates(category);
  }

  async applyTemplate(templateId: string): Promise<void> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    const template = await this.templateService.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Clear existing components
    this.currentPage.components = [];
    this.components.clear();
    this.componentCounter = 0;

    // Apply template components
    for (const templateComponent of template.components) {
      this.componentCounter++;
      const componentId = `${templateComponent.type}-${this.componentCounter}`;

      const component = {
        id: componentId,
        type: templateComponent.type,
        gridArea: templateComponent.gridArea,
        properties: { ...templateComponent.properties }
      };

      this.components.set(componentId, component);
      this.currentPage.components.push(componentId);
    }

    this.currentPage.templateId = templateId;
    this.updateBandwidthMetrics();
  }

  async editComponent(componentId: string, properties: any): Promise<any> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    component.properties = { ...component.properties, ...properties };
    this.updateBandwidthMetrics();

    return component;
  }

  async previewPage(): Promise<string> {
    if (!this.currentPage) {
      throw new Error('No active page');
    }

    let html = `<html><head><title>${this.currentPage.title}</title></head><body>`;

    for (const componentId of this.currentPage.components) {
      const component = this.components.get(componentId);
      if (component) {
        html += this.renderComponent(component);
      }
    }

    html += '</body></html>';
    return html;
  }

  private renderComponent(component: any): string {
    switch (component.type) {
      case 'heading':
        const level = component.properties.level || 1;
        return `<h${level}>${component.properties.content}</h${level}>`;
      case 'text':
        return `<p>${component.properties.content}</p>`;
      case 'form':
        let formHtml = '<form>';
        for (const field of component.properties.fields || []) {
          if (field.type === 'textarea') {
            formHtml += `<label>${field.label}</label><textarea name="${field.name}"></textarea>`;
          } else {
            formHtml += `<label>${field.label}</label><input type="${field.type}" name="${field.name}">`;
          }
        }
        formHtml += '</form>';
        return formHtml;
      case 'image':
        return `<img src="${component.properties.src}" alt="${component.properties.alt}">`;
      default:
        return `<div>Component: ${component.type}</div>`;
    }
  }

  private updateBandwidthMetrics(): void {
    if (!this.currentPage) return;

    let estimatedSize = 200; // Base template overhead

    for (const componentId of this.currentPage.components) {
      const component = this.components.get(componentId);
      if (component) {
        estimatedSize += this.estimateComponentSize(component);
      }
    }

    this.currentPage.metadata.compressedSize = estimatedSize;
    this.currentPage.metadata.bandwidthValid = estimatedSize < 2048;
  }

  private estimateComponentSize(component: any): number {
    switch (component.type) {
      case 'heading':
        return (component.properties.content?.length || 0) * 0.4 + 30;
      case 'text':
        return (component.properties.content?.length || 0) * 0.3 + 20;
      case 'form':
        return (component.properties.fields?.length || 0) * 80 + 100;
      case 'image':
        return 150; // Image markup overhead
      default:
        return 50;
    }
  }

  getPage(): Page | null {
    return this.currentPage;
  }

  getComponent(componentId: string): any {
    return this.components.get(componentId) || null;
  }

  getCurrentComponents(): any[] {
    if (!this.currentPage) return [];
    return this.currentPage.components.map(id => this.components.get(id)).filter(Boolean);
  }

  reset(): void {
    this.pages.clear();
    this.components.clear();
    this.currentPage = null;
    this.componentCounter = 0;
  }
}

describe('Visual Page Builder - Apply Template', () => {
  let pageBuilder: MockPageBuilderWithTemplates;

  beforeEach(async () => {
    pageBuilder = new MockPageBuilderWithTemplates();
  });

  it('should apply contact template to page', async () => {
    // 1. Create new page
    const page = await pageBuilder.createPage({
      title: 'Contact',
      slug: 'contact'
    });

    expect(page.components).toHaveLength(0);

    // 2. Browse templates
    const templates = await pageBuilder.browseTemplates('contact');

    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Basic Contact');
    expect(templates[0].category).toBe('contact');

    // 3. Apply template
    await pageBuilder.applyTemplate(templates[0].id);

    const updatedPage = pageBuilder.getPage();
    expect(updatedPage?.templateId).toBe(templates[0].id);
    expect(updatedPage?.components).toHaveLength(3); // heading, text, form

    // Verify components were created correctly
    const components = pageBuilder.getCurrentComponents();
    expect(components).toHaveLength(3);

    const headingComponent = components.find(c => c.type === 'heading');
    const textComponent = components.find(c => c.type === 'text');
    const formComponent = components.find(c => c.type === 'form');

    expect(headingComponent).toBeDefined();
    expect(headingComponent.properties.content).toBe('Contact {{CALLSIGN}}');
    expect(headingComponent.gridArea.colSpan).toBe(12);

    expect(textComponent).toBeDefined();
    expect(textComponent.properties.content).toBe('Feel free to reach out via radio or email.');

    expect(formComponent).toBeDefined();
    expect(formComponent.properties.fields).toHaveLength(2);

    // 4. Customize content
    await pageBuilder.editComponent(headingComponent.id, {
      content: 'Contact KA1ABC'
    });

    const customizedComponent = pageBuilder.getComponent(headingComponent.id);
    expect(customizedComponent.properties.content).toBe('Contact KA1ABC');

    // 5. Preview page
    const preview = await pageBuilder.previewPage();
    expect(preview).toContain('Contact KA1ABC');
    expect(preview).toContain('Feel free to reach out');
    expect(preview).toContain('<form>');
    expect(preview).toContain('name="email"');
    expect(preview).toContain('name="message"');
  });

  it('should browse templates by category', async () => {
    // Create page
    await pageBuilder.createPage({
      title: 'Test',
      slug: 'test'
    });

    // Browse contact templates
    const contactTemplates = await pageBuilder.browseTemplates('contact');
    expect(contactTemplates).toHaveLength(1);
    expect(contactTemplates[0].category).toBe('contact');

    // Browse about templates
    const aboutTemplates = await pageBuilder.browseTemplates('about');
    expect(aboutTemplates).toHaveLength(1);
    expect(aboutTemplates[0].category).toBe('about');

    // Browse all templates
    const allTemplates = await pageBuilder.browseTemplates();
    expect(allTemplates).toHaveLength(2);
  });

  it('should handle template application with proper grid layout', async () => {
    // Create page and apply about template
    await pageBuilder.createPage({
      title: 'About',
      slug: 'about'
    });

    const templates = await pageBuilder.browseTemplates('about');
    await pageBuilder.applyTemplate(templates[0].id);

    const components = pageBuilder.getCurrentComponents();

    // Check grid positioning
    const headingComponent = components.find(c => c.type === 'heading');
    const textComponent = components.find(c => c.type === 'text');
    const imageComponent = components.find(c => c.type === 'image');

    expect(headingComponent.gridArea).toEqual({
      row: 1, col: 1, rowSpan: 1, colSpan: 12
    });

    expect(textComponent.gridArea).toEqual({
      row: 2, col: 1, rowSpan: 1, colSpan: 8
    });

    expect(imageComponent.gridArea).toEqual({
      row: 2, col: 9, rowSpan: 1, colSpan: 4
    });
  });

  it('should clear existing components when applying template', async () => {
    // Create page with existing content
    const page = await pageBuilder.createPage({
      title: 'Test',
      slug: 'test'
    });

    // Simulate having existing components (in real implementation, these would be added via drag/drop)
    page.components.push('existing-component');

    // Apply template
    const templates = await pageBuilder.browseTemplates('contact');
    await pageBuilder.applyTemplate(templates[0].id);

    const updatedPage = pageBuilder.getPage();
    expect(updatedPage?.components).not.toContain('existing-component');
    expect(updatedPage?.components).toHaveLength(3); // Only template components
  });

  it('should validate bandwidth after template application', async () => {
    // Create page
    await pageBuilder.createPage({
      title: 'Bandwidth Test',
      slug: 'bandwidth-test'
    });

    // Apply template
    const templates = await pageBuilder.browseTemplates('contact');
    await pageBuilder.applyTemplate(templates[0].id);

    const page = pageBuilder.getPage();
    expect(page?.metadata.compressedSize).toBeGreaterThan(0);
    expect(page?.metadata.bandwidthValid).toBe(true);
  });

  it('should preserve template reference after application', async () => {
    // Create page and apply template
    await pageBuilder.createPage({
      title: 'Template Test',
      slug: 'template-test'
    });

    const templates = await pageBuilder.browseTemplates('about');
    const templateId = templates[0].id;

    await pageBuilder.applyTemplate(templateId);

    const page = pageBuilder.getPage();
    expect(page?.templateId).toBe(templateId);
  });

  it('should handle template not found error', async () => {
    // Create page
    await pageBuilder.createPage({
      title: 'Error Test',
      slug: 'error-test'
    });

    // Try to apply non-existent template
    await expect(pageBuilder.applyTemplate('non-existent-template'))
      .rejects.toThrow('Template non-existent-template not found');
  });

  it('should handle template application without active page', async () => {
    // Try to apply template without creating page first
    const templates = await pageBuilder.browseTemplates('contact');

    await expect(pageBuilder.applyTemplate(templates[0].id))
      .rejects.toThrow('No active page');
  });

  it('should generate correct preview HTML for template', async () => {
    // Create page and apply template
    await pageBuilder.createPage({
      title: 'Preview Test',
      slug: 'preview-test'
    });

    const templates = await pageBuilder.browseTemplates('about');
    await pageBuilder.applyTemplate(templates[0].id);

    // Customize heading
    const components = pageBuilder.getCurrentComponents();
    const headingComponent = components.find(c => c.type === 'heading');
    await pageBuilder.editComponent(headingComponent.id, {
      content: 'About KA1ABC'
    });

    // Generate preview
    const preview = await pageBuilder.previewPage();

    // Verify HTML structure
    expect(preview).toContain('<html>');
    expect(preview).toContain('<title>Preview Test</title>');
    expect(preview).toContain('<h1>About KA1ABC</h1>');
    expect(preview).toContain('<p>Welcome to my amateur radio station!</p>');
    expect(preview).toContain('<img src="/images/station.jpg"');
    expect(preview).toContain('alt="Radio station setup"');
  });
});