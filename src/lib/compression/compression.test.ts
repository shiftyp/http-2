import { describe, it, expect, beforeEach } from 'vitest';
import { HamRadioCompressor, RadioJSXCompiler, h } from './index';

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

describe('RadioJSXCompiler', () => {
  let compiler: RadioJSXCompiler;

  beforeEach(() => {
    compiler = new RadioJSXCompiler();
  });

  describe('JSX Compilation', () => {
    it('should compile simple JSX element', () => {
      const jsx = h('div', {}, ['Hello World']);
      const result = compiler.compile(jsx);

      expect(result.templates).toBeDefined();
      expect(result.compiled).toBeDefined();
      expect(typeof result.compiled.t).toBe('string');
      expect(Array.isArray(result.compiled.d)).toBe(true);
    });

    it('should compile nested JSX elements', () => {
      const jsx = h('div', { className: 'container' }, [
        h('h1', {}, ['Title']),
        h('p', {}, ['Content'])
      ]);
      const result = compiler.compile(jsx);

      expect(result.templates).toBeDefined();
      expect(result.compiled.d).toContain('Title');
      expect(result.compiled.d).toContain('Content');
    });

    it('should handle JSX with props', () => {
      const jsx = h('button', { 
        className: 'btn btn-primary',
        onClick: 'handleClick',
        disabled: true
      }, ['Click me']);
      
      const result = compiler.compile(jsx);
      expect(result.compiled.d).toContain('btn btn-primary');
      expect(result.compiled.d).toContain('Click me');
    });

    it('should optimize repeated structures', () => {
      const jsx = h('ul', {}, [
        h('li', {}, ['Item 1']),
        h('li', {}, ['Item 2']),
        h('li', {}, ['Item 3'])
      ]);
      
      const result = compiler.compile(jsx);
      
      // Should have template for <li> elements
      const templateKeys = Object.keys(result.templates);
      expect(templateKeys.length).toBeGreaterThan(0);
    });
  });

  describe('JSX Decompilation', () => {
    it('should decompile to original JSX structure', () => {
      const original = h('div', {}, ['Test']);
      const compiled = compiler.compile(original);
      const decompiled = compiler.decompile(compiled);

      expect(decompiled.type).toBe('div');
      expect(decompiled.children).toContain('Test');
    });

    it('should handle complex JSX round-trip', () => {
      const original = h('div', { className: 'card' }, [
        h('h2', {}, ['Card Title']),
        h('p', {}, ['Card content with some text'])
      ]);

      const compiled = compiler.compile(original);
      const decompiled = compiler.decompile(compiled);

      expect(decompiled.type).toBe('div');
      expect(decompiled.props.className).toBe('card');
      expect(decompiled.children).toHaveLength(2);
    });
  });

  describe('Component Registration', () => {
    it('should register custom components', () => {
      const cardTemplate = {
        pattern: '<div class="card">{0}</div>',
        props: ['children']
      };

      compiler.registerComponent('Card', cardTemplate);

      const jsx = h('Card', {}, ['Card content']);
      const result = compiler.compile(jsx);

      expect(result.templates['Card']).toBeDefined();
    });

    it('should use registered components in compilation', () => {
      compiler.registerComponent('Button', {
        pattern: '<button class="btn {0}" {1}>{2}</button>',
        props: ['variant', 'props', 'children']
      });

      const jsx = h('Button', { variant: 'primary' }, ['Click']);
      const result = compiler.compile(jsx);

      expect(result.compiled.t).toBe('Button');
      expect(result.compiled.d).toContain('primary');
      expect(result.compiled.d).toContain('Click');
    });
  });

  describe('Compression Performance', () => {
    it('should achieve significant compression on repeated JSX', () => {
      const jsx = h('div', {}, 
        Array(10).fill(null).map((_, i) => 
          h('div', { className: 'item' }, [`Item ${i + 1}`])
        )
      );

      const compiled = compiler.compile(jsx);
      const originalSize = JSON.stringify(jsx).length;
      const compressedSize = JSON.stringify(compiled).length;

      expect(compressedSize).toBeLessThan(originalSize);
    });

    it('should handle large JSX structures efficiently', () => {
      const largeJSX = h('div', {},
        Array(100).fill(null).map((_, i) =>
          h('div', { key: i, className: 'row' }, [
            h('span', {}, [`Cell ${i}`]),
            h('button', { onClick: 'click' }, ['Action'])
          ])
        )
      );

      const start = performance.now();
      const result = compiler.compile(largeJSX);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete in <100ms
      expect(result.compiled).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle null JSX elements', () => {
      expect(() => {
        compiler.compile(null as any);
      }).toThrow();
    });

    it('should handle invalid compiled data', () => {
      const invalid = {
        templates: {},
        compiled: { t: 'nonexistent', d: [] }
      };

      expect(() => {
        compiler.decompile(invalid);
      }).toThrow();
    });

    it('should handle circular references safely', () => {
      const jsx: any = h('div', {}, []);
      jsx.children.push(jsx); // Create circular reference

      expect(() => {
        compiler.compile(jsx);
      }).toThrow();
    });
  });
});

describe('h() JSX Helper', () => {
  it('should create JSX elements', () => {
    const element = h('div', { className: 'test' }, ['content']);

    expect(element.type).toBe('div');
    expect(element.props.className).toBe('test');
    expect(element.children).toEqual(['content']);
  });

  it('should handle elements without props', () => {
    const element = h('p', null, ['text']);

    expect(element.type).toBe('p');
    expect(element.props).toEqual({});
    expect(element.children).toEqual(['text']);
  });

  it('should handle elements without children', () => {
    const element = h('br', { className: 'break' });

    expect(element.type).toBe('br');
    expect(element.props.className).toBe('break');
    expect(element.children).toEqual([]);
  });

  it('should handle nested children', () => {
    const element = h('div', {}, [
      h('span', {}, ['nested']),
      'text node'
    ]);

    expect(element.children).toHaveLength(2);
    expect(element.children[0].type).toBe('span');
    expect(element.children[1]).toBe('text node');
  });
});