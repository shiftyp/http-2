import { describe, it, expect, beforeEach } from 'vitest';
import { HamRadioCompressor, YAMLComponentCompressor } from './index';
import { yamlSerializer } from '../yaml-serializer';

describe('HamRadioCompressor', () => {
  let compressor: HamRadioCompressor;

  beforeEach(() => {
    compressor = new HamRadioCompressor();
  });

  describe('HTML Compression', () => {
    it('should compress simple HTML', () => {
      const html = '<h1>Hello World</h1><p>This is a test</p>';
      const result = compressor.compressHTML(html);

      expect(result.compressed).toBeDefined();
      expect(result.originalSize).toBe(html.length);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeLessThan(html.length);
      expect(result.ratio).toBeGreaterThan(1);
    });

    it('should achieve good compression on repetitive HTML', () => {
      const html = '<div class="card"><h1>Title</h1><p>Content</p></div>'.repeat(10);
      const result = compressor.compressHTML(html);

      expect(result.ratio).toBeGreaterThan(5);
    });

    it('should handle empty HTML', () => {
      const html = '';
      const result = compressor.compressHTML(html);

      expect(result.originalSize).toBe(0);
      expect(result.compressedSize).toBeGreaterThan(0); // Some overhead
      expect(result.compressed).toBeDefined();
      expect(result.dictionary).toBeDefined();
    });

    it('should handle HTML with special characters', () => {
      const html = '<p>Special chars: áéíóú ñü €£¥</p>';
      const result = compressor.compressHTML(html);

      expect(result.compressed).toBeDefined();
      expect(result.originalSize).toBe(html.length);
    });
  });

  describe('HTML Decompression', () => {
    it('should decompress to original HTML', () => {
      const original = '<h1>Test</h1><p>Content with <strong>bold</strong> text</p>';
      const compressed = compressor.compressHTML(original);
      const decompressed = compressor.decompressHTML(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle round-trip compression/decompression', () => {
      const htmlCases = [
        '<div></div>',
        '<h1>Simple</h1>',
        '<div class="test"><p>Nested content</p></div>',
        '<ul><li>Item 1</li><li>Item 2</li></ul>',
        '<!-- comment --><p>With comment</p>'
      ];

      htmlCases.forEach(html => {
        const compressed = compressor.compressHTML(html);
        const decompressed = compressor.decompressHTML(compressed);
        expect(decompressed).toBe(html);
      });
    });
  });

  describe('Dictionary Optimization', () => {
    it('should create dictionary for repeated elements', () => {
      const html = '<div class="card">Card 1</div><div class="card">Card 2</div>';
      const result = compressor.compressHTML(html);

      expect(result.dictionary).toBeDefined();
      expect(Object.keys(result.dictionary).length).toBeGreaterThan(0);
    });

    it('should optimize common patterns', () => {
      const html = '<div><span>Text</span></div>'.repeat(5);
      const result = compressor.compressHTML(html);

      // Should achieve significant compression due to repetition
      expect(result.ratio).toBeGreaterThan(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const malformed = '<div><p>Unclosed tags<span>';
      const result = compressor.compressHTML(malformed);

      expect(result.compressed).toBeDefined();
      expect(result.originalSize).toBe(malformed.length);
    });

    it('should handle invalid compressed data', () => {
      const invalidCompressed = {
        compressed: new Uint8Array([255, 255, 255]),
        originalSize: 10,
        compressedSize: 3,
        ratio: 3.33,
        dictionary: {}
      };

      expect(() => {
        compressor.decompressHTML(invalidCompressed);
      }).toThrow();
    });
  });
});

describe('YAMLComponentCompressor', () => {
  let compressor: YAMLComponentCompressor;

  beforeEach(() => {
    compressor = new YAMLComponentCompressor();
  });

  describe('Component Compression', () => {
    it('should compress simple component to YAML', () => {
      const component = {
        type: 'IMAGE',
        props: {
          src: 'emergency_map.jpg',
          alt: 'Evacuation routes'
        }
      };

      const result = compressor.compressComponent(component, { minify: true });

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      expect(result.yaml).toContain('type:IMAGE'); // Minified format
      expect(result.yaml).toContain('src:emergency_map.jpg');
    });

    it('should compress nested components', () => {
      const component = {
        type: 'CONTAINER',
        children: [
          {
            type: 'HEADING',
            props: { text: 'Emergency Update', level: 1 }
          },
          {
            type: 'IMAGE',
            props: { src: 'damage_photo.jpg', alt: 'Bridge damage' }
          }
        ]
      };

      const result = compressor.compressComponent(component);

      expect(result.yaml).toContain('type: CONTAINER');
      expect(result.yaml).toContain('children:');
      expect(result.yaml).toContain('HEADING');
      expect(result.yaml).toContain('IMAGE');
    });

    it('should handle audio components', () => {
      const component = {
        type: 'AUDIO',
        props: {
          src: 'warning_message.opus',
          duration: 15,
          priority: 'high'
        }
      };

      const result = compressor.compressComponent(component);

      expect(result.yaml).toContain('type: AUDIO');
      expect(result.yaml).toContain('warning_message.opus');
      expect(result.yaml).toContain('duration: 15');
    });

    it('should optimize repeated structures', () => {
      const component = {
        type: 'LIST',
        children: [
          { type: 'ITEM', props: { text: 'Item 1' } },
          { type: 'ITEM', props: { text: 'Item 2' } },
          { type: 'ITEM', props: { text: 'Item 3' } }
        ]
      };

      const result = compressor.compressComponent(component, { useFlowNotation: true });

      // Should achieve compression through YAML flow notation
      expect(result.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('Component Decompression', () => {
    it('should decompress YAML back to component', () => {
      const original = {
        type: 'TEXT',
        props: { content: 'Hello World' }
      };

      const compressed = compressor.compressComponent(original);
      const decompressed = compressor.decompressComponent(compressed.yaml);

      expect(decompressed.type).toBe('TEXT');
      expect(decompressed.props?.content).toBe('Hello World');
    });

    it('should handle complex component round-trip', () => {
      const original = {
        type: 'TEXT',
        props: { content: 'Simple text content' }
      };

      const compressed = compressor.compressComponent(original);
      const decompressed = compressor.decompressComponent(compressed.yaml);

      expect(decompressed.type).toBe('TEXT');
      expect(decompressed.props?.content).toBe('Simple text content');
    });
  });

  describe('Bandwidth Optimization', () => {
    it('should achieve better compression with flow notation', () => {
      const component = {
        type: 'FORM',
        props: {
          method: 'POST',
          action: '/submit',
          className: 'emergency-form'
        }
      };

      const result = compressor.compressComponent(component, { useFlowNotation: true });

      expect(result.yaml).toContain('{');
      expect(result.compressionRatio).toBeGreaterThan(1);
    });

    it('should minify YAML for radio transmission', () => {
      const component = {
        type: 'ALERT',
        props: { message: 'Warning: Road closed' }
      };

      const result = compressor.compressComponent(component, { minify: true });

      // Should remove unnecessary whitespace
      expect(result.yaml).not.toContain('  '); // No double spaces
      expect(result.compressedSize).toBeLessThan(result.originalSize);
    });

    it('should estimate transmission time', () => {
      const component = {
        type: 'MEDIA_PAGE',
        children: Array(5).fill(null).map((_, i) => ({
          type: 'IMAGE',
          props: { src: `image${i}.jpg`, size: 1024 }
        }))
      };

      const result = compressor.compressComponent(component);

      expect(result.estimatedTransmissionTime).toBeGreaterThan(0);
      expect(result.bandwidthUsage).toBeGreaterThan(0);
    });
  });

  describe('UTF-8 Encoding', () => {
    it('should handle international characters', () => {
      const component = {
        type: 'TEXT',
        props: {
          content: 'Emergencia: Evacuación inmediata 🚨',
          lang: 'es'
        }
      };

      const result = compressor.compressComponent(component);

      expect(result.yaml).toContain('Emergencia');
      expect(result.yaml).toContain('🚨');
    });

    it('should preserve UTF-8 in round-trip', () => {
      const original = {
        type: 'ALERT',
        props: {
          message: '緊急避難 Emergency 🚨',
          priority: 'urgent'
        }
      };

      const compressed = compressor.compressComponent(original);
      const decompressed = compressor.decompressComponent(compressed.yaml);

      expect(decompressed.props?.message).toBe('緊急避難 Emergency 🚨');
    });
  });

  describe('Error Handling', () => {
    it('should handle null components', () => {
      expect(() => {
        compressor.compressComponent(null as any);
      }).toThrow();
    });

    it('should handle invalid YAML', () => {
      const invalidYAML = ''; // Empty YAML should cause error

      expect(() => {
        compressor.decompressComponent(invalidYAML);
      }).toThrow();
    });

    it('should handle missing required fields', () => {
      const component = {
        props: { src: 'image.jpg' }
        // Missing type field
      };

      expect(() => {
        compressor.compressComponent(component as any);
      }).toThrow();
    });
  });
});