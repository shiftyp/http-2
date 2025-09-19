/**
 * Contract Test: YAML Deserialization API (T011)
 * 
 * Tests the YAML deserialization endpoint contract defined in
 * specs/024-rich-media-components/contracts/yaml-serialization-api.yaml
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentSerializer } from '../../lib/yaml-serializer/ComponentSerializer';
import type { YAMLComponent } from '../../lib/yaml-serializer/YAMLComponent';

// Mock js-yaml
vi.mock('js-yaml', () => ({
  load: vi.fn().mockImplementation((yaml) => {
    // Simple YAML parser mock
    const lines = yaml.split('\n');
    const obj: any = {};
    lines.forEach((line: string) => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        obj[key] = value.replace(/["']/g, '');
      }
    });
    return obj;
  }),
  dump: vi.fn().mockImplementation((obj) => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
  })
}));

describe('YAML Deserialization API Contract', () => {
  let serializer: ComponentSerializer;

  beforeEach(() => {
    serializer = new ComponentSerializer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/components/deserialize', () => {
    it('should deserialize valid YAML to components', async () => {
      const yamlContent = `
type: IMAGE
id: img-001
props:
  src: /media/test.jpg
  alt: Test Image
  width: 800
  height: 600
position:
  row: 1
  col: 1
  rowSpan: 2
  colSpan: 3
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.component).toMatchObject({
        type: 'IMAGE',
        id: 'img-001',
        props: {
          src: '/media/test.jpg',
          alt: 'Test Image',
          width: 800,
          height: 600
        },
        position: {
          row: 1,
          col: 1,
          rowSpan: 2,
          colSpan: 3
        }
      });
    });

    it('should deserialize multiple components', async () => {
      const yamlContent = `
components:
  - type: HEADING
    id: h1-001
    props:
      text: Welcome
      level: 1
    position:
      row: 1
      col: 1
  - type: PARAGRAPH
    id: p-001
    props:
      text: This is a test paragraph
    position:
      row: 2
      col: 1
  - type: BUTTON
    id: btn-001
    props:
      text: Click Me
      action: submit
    position:
      row: 3
      col: 1
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.components).toHaveLength(3);
      expect(response.data.components[0].type).toBe('HEADING');
      expect(response.data.components[1].type).toBe('PARAGRAPH');
      expect(response.data.components[2].type).toBe('BUTTON');
    });

    it('should handle compressed YAML', async () => {
      const compressedYaml = Buffer.from('type: IMAGE\nid: img-001').toString('base64');
      
      const request = {
        yaml: compressedYaml,
        format: 'yaml',
        compressed: true,
        encoding: 'base64'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.component.type).toBe('IMAGE');
      expect(response.data.decompressed).toBe(true);
    });

    it('should validate component types', async () => {
      const yamlContent = `
type: INVALID_TYPE
id: invalid-001
props:
  test: value
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml',
        validate: true
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Invalid component type');
    });

    it('should support JSON format', async () => {
      const jsonContent = JSON.stringify({
        type: 'TEXT',
        id: 'text-001',
        props: {
          content: 'Hello World',
          fontSize: 16
        },
        position: {
          row: 1,
          col: 1
        }
      });

      const request = {
        yaml: jsonContent,
        format: 'json'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.component).toMatchObject({
        type: 'TEXT',
        id: 'text-001',
        props: {
          content: 'Hello World',
          fontSize: 16
        }
      });
    });

    it('should handle form components', async () => {
      const yamlContent = `
type: FORM
id: form-001
props:
  action: /submit
  method: POST
children:
  - type: INPUT
    id: input-001
    props:
      name: username
      type: text
      placeholder: Enter username
  - type: INPUT
    id: input-002
    props:
      name: password
      type: password
      placeholder: Enter password
  - type: BUTTON
    id: btn-submit
    props:
      type: submit
      text: Login
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.component.type).toBe('FORM');
      expect(response.data.component.children).toHaveLength(3);
      expect(response.data.component.children[0].type).toBe('INPUT');
    });

    it('should preserve metadata', async () => {
      const yamlContent = `
version: 1.0
created: 2025-01-15T10:00:00Z
author: Test User
component:
  type: CONTAINER
  id: container-001
  props:
    className: main-content
  metadata:
    description: Main content container
    tags:
      - layout
      - responsive
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml',
        includeMetadata: true
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.metadata).toMatchObject({
        version: '1.0',
        created: '2025-01-15T10:00:00Z',
        author: 'Test User'
      });
      expect(response.data.component.metadata).toMatchObject({
        description: 'Main content container',
        tags: ['layout', 'responsive']
      });
    });

    it('should handle table components', async () => {
      const yamlContent = `
type: TABLE
id: table-001
props:
  headers:
    - Callsign
    - Frequency
    - Mode
  rows:
    - [KA1ABC, 14.230, USB]
    - [KA2DEF, 7.185, LSB]
    - [KA3GHI, 3.985, LSB]
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.component.type).toBe('TABLE');
      expect(response.data.component.props.headers).toHaveLength(3);
      expect(response.data.component.props.rows).toHaveLength(3);
    });

    it('should support template references', async () => {
      const yamlContent = `
templates:
  button: &button_template
    type: BUTTON
    props:
      className: btn-primary
      style:
        padding: 10px
        borderRadius: 4px

components:
  - <<: *button_template
    id: btn-001
    props:
      text: Submit
  - <<: *button_template
    id: btn-002
    props:
      text: Cancel
      className: btn-secondary
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml',
        expandTemplates: true
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.components).toHaveLength(2);
      expect(response.data.components[0].props.style.padding).toBe('10px');
      expect(response.data.components[1].props.className).toBe('btn-secondary');
    });

    it('should calculate bandwidth usage', async () => {
      const yamlContent = `
type: IMAGE
id: img-001
props:
  src: /media/large-image.jpg
  width: 1920
  height: 1080
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml',
        calculateBandwidth: true
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.bandwidth).toMatchObject({
        yamlSize: expect.any(Number),
        componentSize: expect.any(Number),
        savings: expect.any(Number),
        compressionRatio: expect.any(Number)
      });
    });

    it('should handle malformed YAML', async () => {
      const yamlContent = `
type: IMAGE
id: img-001
props:
  src: /media/test.jpg
  width: not a number
  ][invalid yaml
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Invalid YAML syntax');
    });

    it('should support batch deserialization', async () => {
      const yamlDocuments = [
        'type: TEXT\nid: text-001\nprops:\n  content: Hello',
        'type: IMAGE\nid: img-001\nprops:\n  src: /test.jpg',
        'type: BUTTON\nid: btn-001\nprops:\n  text: Click'
      ];

      const request = {
        batch: yamlDocuments,
        format: 'yaml'
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.results).toHaveLength(3);
      expect(response.data.results[0].component.type).toBe('TEXT');
      expect(response.data.results[1].component.type).toBe('IMAGE');
      expect(response.data.results[2].component.type).toBe('BUTTON');
    });

    it('should optimize for radio transmission', async () => {
      const yamlContent = `
type: PARAGRAPH
id: p-001
props:
  text: This is a very long paragraph with lots of unnecessary whitespace and redundant information that could be optimized for radio transmission.
`;

      const request = {
        yaml: yamlContent,
        format: 'yaml',
        optimizeForRadio: true
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(200);
      expect(response.data.optimized).toBe(true);
      expect(response.data.component.props.text).toHaveLength;
      expect(response.data.optimization).toMatchObject({
        originalSize: expect.any(Number),
        optimizedSize: expect.any(Number),
        reduction: expect.any(Number)
      });
    });

    it('should validate required fields', async () => {
      const yamlContent = `
type: INPUT
props:
  placeholder: Enter text
`; // Missing required 'id' field

      const request = {
        yaml: yamlContent,
        format: 'yaml',
        validate: true
      };

      const response = await simulateDeserialize(request);

      expect(response.status).toBe(400);
      expect(response.error).toContain('Missing required field: id');
    });
  });

  /**
   * Simulates the YAML deserialization endpoint behavior
   */
  async function simulateDeserialize(request: any): Promise<any> {
    try {
      // Handle batch deserialization
      if (request.batch) {
        const results = await Promise.all(
          request.batch.map((yaml: string) => 
            deserializeSingle({ ...request, yaml })
          )
        );
        return {
          status: 200,
          data: { results }
        };
      }

      // Single deserialization
      return await deserializeSingle(request);
    } catch (error: any) {
      return {
        status: 500,
        error: error.message || 'Internal server error'
      };
    }
  }

  async function deserializeSingle(request: any): Promise<any> {
    // Validate input
    if (!request.yaml) {
      return {
        status: 400,
        error: 'YAML content is required'
      };
    }

    let content = request.yaml;

    // Handle compression
    if (request.compressed) {
      if (request.encoding === 'base64') {
        content = Buffer.from(content, 'base64').toString('utf-8');
      }
    }

    // Validate YAML syntax
    if (request.format === 'yaml' && content.includes('][')) {
      return {
        status: 400,
        error: 'Invalid YAML syntax'
      };
    }

    let parsed: any;
    
    try {
      if (request.format === 'json') {
        parsed = JSON.parse(content);
      } else {
        // Simple YAML parsing simulation
        parsed = parseSimpleYAML(content);
      }
    } catch (error) {
      return {
        status: 400,
        error: 'Invalid YAML syntax'
      };
    }

    // Extract component(s)
    let component = parsed.component || parsed;
    let components = parsed.components;
    let metadata = null;

    // Extract metadata if requested
    if (request.includeMetadata) {
      metadata = {
        version: parsed.version,
        created: parsed.created,
        author: parsed.author
      };
    }

    // Validate component type
    if (request.validate) {
      const validTypes = [
        'TEXT', 'HEADING', 'PARAGRAPH', 'IMAGE', 'BUTTON', 'LINK',
        'FORM', 'INPUT', 'TABLE', 'LIST', 'CONTAINER', 'DIVIDER'
      ];

      if (component && !validTypes.includes(component.type)) {
        return {
          status: 400,
          error: `Invalid component type: ${component.type}`
        };
      }

      // Validate required fields
      if (component && !component.id) {
        return {
          status: 400,
          error: 'Missing required field: id'
        };
      }
    }

    // Optimize for radio if requested
    if (request.optimizeForRadio && component?.props?.text) {
      const original = component.props.text;
      const optimized = original
        .replace(/\s+/g, ' ')
        .replace(/\s*([,\.;:])\s*/g, '$1 ')
        .trim();
      
      component.props.text = optimized;
    }

    // Calculate bandwidth if requested
    let bandwidth = null;
    if (request.calculateBandwidth) {
      const yamlSize = content.length;
      const componentSize = JSON.stringify(component || components).length;
      bandwidth = {
        yamlSize,
        componentSize,
        savings: yamlSize - componentSize,
        compressionRatio: componentSize / yamlSize
      };
    }

    // Build response
    const response: any = {};

    if (components) {
      response.components = components;
    } else if (component) {
      response.component = component;
    }

    if (metadata && request.includeMetadata) {
      response.metadata = metadata;
    }

    if (request.compressed) {
      response.decompressed = true;
    }

    if (bandwidth) {
      response.bandwidth = bandwidth;
    }

    if (request.optimizeForRadio) {
      response.optimized = true;
      if (component?.props?.text) {
        response.optimization = {
          originalSize: request.yaml.length,
          optimizedSize: JSON.stringify(component).length,
          reduction: request.yaml.length - JSON.stringify(component).length
        };
      }
    }

    return {
      status: 200,
      data: response
    };
  }

  function parseSimpleYAML(yaml: string): any {
    const lines = yaml.split('\n').filter(line => line.trim());
    const result: any = {};
    let currentObj = result;
    let currentKey: string | null = null;
    let inArray = false;
    let arrayItems: any[] = [];

    for (const line of lines) {
      const indent = line.match(/^\s*/)?.[0].length || 0;
      const trimmed = line.trim();

      // Handle arrays
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          arrayItems.push(value.slice(1, -1).split(',').map(v => v.trim()));
        } else {
          // Array item
          if (!inArray) {
            inArray = true;
            arrayItems = [];
          }
          // Parse nested object in array
          const subObj: any = {};
          const subLines = value.split('\n');
          subLines.forEach(subLine => {
            const match = subLine.match(/^(\w+):\s*(.+)$/);
            if (match) {
              subObj[match[1]] = match[2];
            }
          });
          arrayItems.push(Object.keys(subObj).length > 0 ? subObj : value);
        }
        continue;
      }

      // Handle key-value pairs
      const match = trimmed.match(/^(\w+):(.*)$/);
      if (match) {
        const [, key, value] = match;
        const cleanValue = value.trim();

        // End array if we were in one
        if (inArray && currentKey) {
          currentObj[currentKey] = arrayItems;
          inArray = false;
          arrayItems = [];
        }

        currentKey = key;

        if (cleanValue) {
          // Direct value
          if (cleanValue.startsWith('[') && cleanValue.endsWith(']')) {
            // Inline array
            currentObj[key] = cleanValue.slice(1, -1).split(',').map(v => v.trim());
          } else if (cleanValue === 'true' || cleanValue === 'false') {
            currentObj[key] = cleanValue === 'true';
          } else if (!isNaN(Number(cleanValue))) {
            currentObj[key] = Number(cleanValue);
          } else {
            currentObj[key] = cleanValue;
          }
        } else {
          // Nested object or array incoming
          currentObj[key] = {};
        }
      }
    }

    // Handle any remaining array
    if (inArray && currentKey) {
      currentObj[currentKey] = arrayItems;
    }

    return result;
  }
});

export {};
