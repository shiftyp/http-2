/**
 * YAML Serialization Format Contract Tests (T011)
 * 
 * Tests YAML serialization compliance, bandwidth efficiency,
 * and component structure preservation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  yamlSerializer,
  binarySerializer,
  type YAMLComponent
} from '../../lib/yaml-serializer/index.js';

describe('YAML Serialization Format Contract', () => {
  describe('Component Serialization', () => {
    it('should serialize basic component structure', () => {
      const component: YAMLComponent = {
        type: 'image',
        props: {
          src: '/test.jpg',
          alt: 'Test Image',
          width: 300,
          height: 200
        }
      };
      
      const yaml = yamlSerializer.serialize(component);
      
      expect(yaml).toContain('type: image');
      expect(yaml).toContain('src: /test.jpg');
      expect(yaml).toContain('width: 300');
    });

    it('should serialize nested components', () => {
      const component: YAMLComponent = {
        type: 'container',
        props: { layout: 'flex' },
        children: [
          {
            type: 'text',
            props: { content: 'Hello' }
          },
          {
            type: 'image',
            props: { src: '/img.jpg' }
          }
        ]
      };
      
      const yaml = yamlSerializer.serialize(component);
      
      expect(yaml).toContain('type: container');
      expect(yaml).toContain('children:');
      expect(yaml).toContain('type: text');
      expect(yaml).toContain('type: image');
    });

    it('should serialize media references', () => {
      const component: YAMLComponent = {
        type: 'video',
        media: {
          url: '/video.webm',
          codec: 'vp8',
          size: 1024000
        }
      };
      
      const yaml = yamlSerializer.serialize(component, {
        includeMedia: true
      });
      
      expect(yaml).toContain('media:');
      expect(yaml).toContain('url: /video.webm');
      expect(yaml).toContain('codec: vp8');
      expect(yaml).toContain('size: 1024000');
    });
  });

  describe('Deserialization', () => {
    it('should deserialize to original structure', () => {
      const original: YAMLComponent = {
        type: 'image',
        props: {
          src: '/test.jpg',
          width: 300,
          height: 200
        }
      };
      
      const yaml = yamlSerializer.serialize(original);
      const deserialized = yamlSerializer.deserialize(yaml);
      
      expect(deserialized.type).toBe(original.type);
      expect(deserialized.props?.src).toBe(original.props?.src);
      expect(deserialized.props?.width).toBe(original.props?.width);
    });

    it('should handle complex data types', () => {
      const component: YAMLComponent = {
        type: 'test',
        props: {
          string: 'text',
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { key: 'value' },
          null: null
        }
      };
      
      const yaml = yamlSerializer.serialize(component);
      const deserialized = yamlSerializer.deserialize(yaml);
      
      expect(deserialized.props?.string).toBe('text');
      expect(deserialized.props?.number).toBe(42);
      expect(deserialized.props?.boolean).toBe(true);
      expect(deserialized.props?.array).toEqual([1, 2, 3]);
      expect(deserialized.props?.object).toEqual({ key: 'value' });
      expect(deserialized.props?.null).toBe(null);
    });
  });

  describe('Bandwidth Efficiency', () => {
    it('should minify output when requested', () => {
      const component: YAMLComponent = {
        type: 'container',
        props: {
          layout: 'flex',
          padding: 10
        },
        children: [
          { type: 'text', props: { content: 'Hello' } }
        ]
      };
      
      const normal = yamlSerializer.serialize(component, { minify: false });
      const minified = yamlSerializer.serialize(component, { minify: true });
      
      expect(minified.length).toBeLessThan(normal.length);
      expect(minified).not.toContain('  '); // No extra spaces
    });

    it('should deduplicate repeated data with references', () => {
      const largeData = 'a'.repeat(1000);
      const component: YAMLComponent = {
        type: 'container',
        children: [
          {
            type: 'image',
            media: { data: largeData }
          },
          {
            type: 'image',
            media: { data: largeData } // Same data
          }
        ]
      };
      
      const yaml = yamlSerializer.serialize(component, {
        includeMedia: true
      });
      
      // Should use reference for duplicate data
      expect(yaml).toContain('&ref');
      expect(yaml.split(largeData).length).toBe(2); // Only appears once
    });

    it('should respect max depth to prevent deep nesting', () => {
      const deepComponent: YAMLComponent = {
        type: 'level0',
        children: [
          {
            type: 'level1',
            children: [
              {
                type: 'level2',
                children: [
                  {
                    type: 'level3',
                    children: [
                      { type: 'level4' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const yaml = yamlSerializer.serialize(deepComponent, {
        maxDepth: 3
      });
      
      expect(yaml).toContain('level0');
      expect(yaml).toContain('level1');
      expect(yaml).toContain('level2');
      expect(yaml).toContain('~truncated~');
    });
  });

  describe('Binary Serialization', () => {
    it('should serialize to binary format', () => {
      const component: YAMLComponent = {
        type: 'image',
        props: {
          src: '/test.jpg',
          width: 300
        }
      };
      
      const binary = binarySerializer.serialize(component);
      
      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.length).toBeGreaterThan(0);
      expect(binary.length).toBeLessThan(1000); // Compact
    });

    it('should deserialize from binary format', () => {
      const component: YAMLComponent = {
        type: 'audio',
        props: {
          src: '/audio.opus',
          duration: '10'
        }
      };
      
      const binary = binarySerializer.serialize(component);
      const deserialized = binarySerializer.deserialize(binary);
      
      expect(deserialized.type).toBe('audio');
      expect(deserialized.props?.src).toBe('/audio.opus');
      expect(deserialized.props?.duration).toBe('10');
    });

    it('should be more compact than YAML for simple components', () => {
      const component: YAMLComponent = {
        type: 'text',
        props: {
          content: 'Hello World'
        }
      };
      
      const yaml = yamlSerializer.serialize(component);
      const binary = binarySerializer.serialize(component);
      
      // Binary should be more compact for simple structures
      expect(binary.length).toBeLessThan(yaml.length);
    });
  });

  describe('Special Characters and Edge Cases', () => {
    it('should handle special characters in strings', () => {
      const component: YAMLComponent = {
        type: 'text',
        props: {
          content: 'Line 1\nLine 2',
          special: 'Key: Value # Comment',
          quotes: 'He said "Hello"'
        }
      };
      
      const yaml = yamlSerializer.serialize(component);
      const deserialized = yamlSerializer.deserialize(yaml);
      
      expect(deserialized.props?.content).toBe('Line 1\nLine 2');
      expect(deserialized.props?.special).toBe('Key: Value # Comment');
      expect(deserialized.props?.quotes).toBe('He said "Hello"');
    });

    it('should handle empty components', () => {
      const component: YAMLComponent = {
        type: 'empty'
      };
      
      const yaml = yamlSerializer.serialize(component);
      const deserialized = yamlSerializer.deserialize(yaml);
      
      expect(deserialized.type).toBe('empty');
      expect(deserialized.props).toBeUndefined();
      expect(deserialized.children).toBeUndefined();
    });

    it('should handle very large components efficiently', () => {
      const children = Array.from({ length: 100 }, (_, i) => ({
        type: 'item',
        props: { id: i, data: `Item ${i}` }
      }));
      
      const component: YAMLComponent = {
        type: 'list',
        children
      };
      
      const start = Date.now();
      const yaml = yamlSerializer.serialize(component);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be fast
      expect(yaml).toContain('type: item');
    });
  });

  describe('Media Component Integration', () => {
    it('should serialize image component with metadata', () => {
      const component: YAMLComponent = {
        type: 'image',
        props: {
          src: '/photo.jpg',
          alt: 'Photo',
          width: 800,
          height: 600,
          loading: 'lazy'
        },
        media: {
          codec: 'jpeg',
          size: 150000
        }
      };
      
      const yaml = yamlSerializer.serialize(component, {
        includeMedia: true
      });
      
      expect(yaml).toContain('type: image');
      expect(yaml).toContain('loading: lazy');
      expect(yaml).toContain('codec: jpeg');
    });

    it('should serialize audio component with codec info', () => {
      const component: YAMLComponent = {
        type: 'audio',
        props: {
          controls: true,
          autoplay: false
        },
        media: {
          url: '/sound.opus',
          codec: 'opus',
          size: 50000
        }
      };
      
      const yaml = yamlSerializer.serialize(component, {
        includeMedia: true
      });
      
      expect(yaml).toContain('type: audio');
      expect(yaml).toContain('controls: true');
      expect(yaml).toContain('autoplay: false');
      expect(yaml).toContain('codec: opus');
    });

    it('should serialize video component efficiently', () => {
      const component: YAMLComponent = {
        type: 'video',
        props: {
          width: 640,
          height: 480,
          poster: '/poster.jpg'
        },
        media: {
          url: '/video.webm',
          codec: 'vp8'
        }
      };
      
      const yaml = yamlSerializer.serialize(component, {
        includeMedia: true,
        minify: true
      });
      
      expect(yaml.length).toBeLessThan(200); // Compact representation
      expect(yaml).toContain('video');
      expect(yaml).toContain('vp8');
    });
  });
});

export {};