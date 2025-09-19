/**
 * React Renderer for Ham Radio HTTP
 *
 * Server-side rendering to compressed data for efficient radio transmission
 * Client-side hydration from compressed data
 */

import React from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { HamRadioCompressor } from '../compression';

/**
 * Pure binary field encoder (no protobuf/JSON overhead)
 * Encodes components as fixed-position binary fields
 */
class BinaryFieldEncoder {
  private buffer: number[] = [];

  /**
   * Component type mapping (4 bits = 16 component types max)
   */
  private componentTypes = {
    'text': 0x1, 'heading': 0x2, 'paragraph': 0x3, 'image': 0x4,
    'form': 0x5, 'button': 0x6, 'input': 0x7, 'list': 0x8,
    'link': 0x9, 'container': 0xA, 'divider': 0xB, 'table': 0xC,
    'Unknown': 0xF
  };

  /**
   * Text field IDs (4 bits = 16 text fields max)
   */
  private textFieldIds = {
    'text': 0x1, 'src': 0x2, 'href': 0x3, 'alt': 0x4,
    'value': 0x5, 'placeholder': 0x6, 'title': 0x7, 'label': 0x8
  };

  writeComponentType(componentType: string): void {
    const typeId = this.componentTypes[componentType as keyof typeof this.componentTypes] || 0xF;
    this.buffer.push(typeId);
  }

  writeBitmask(property: string, value: number): void {
    // Store bitmask values in single bytes
    this.buffer.push(value & 0xFF);
  }

  writeTextField(fieldName: string, text: string | undefined): void {
    if (!text || !text.trim()) {
      // Empty field: just write field ID + 0 length
      const fieldId = this.textFieldIds[fieldName as keyof typeof this.textFieldIds] || 0;
      this.buffer.push((fieldId << 4) | 0); // Field ID in upper 4 bits, length 0 in lower 4 bits
      return;
    }

    // Compress the text using ham radio techniques
    const compressed = this.compressTextForBinary(text);
    const compressedBytes = new TextEncoder().encode(compressed);

    const fieldId = this.textFieldIds[fieldName as keyof typeof this.textFieldIds] || 0;

    if (compressedBytes.length < 16) {
      // Short text: pack field ID + length in 1 byte, then data
      this.buffer.push((fieldId << 4) | compressedBytes.length);
      this.buffer.push(...compressedBytes);
    } else {
      // Long text: field ID + 15 (marker), then 2-byte length, then data
      this.buffer.push((fieldId << 4) | 15); // 15 = extended length marker
      this.buffer.push(compressedBytes.length & 0xFF);
      this.buffer.push((compressedBytes.length >> 8) & 0xFF);
      this.buffer.push(...compressedBytes);
    }
  }

  private compressTextForBinary(text: string): string {
    // Apply ham radio text compression
    if (text.trim() === 'Enter your text here...') {
      return 'DT'; // 2 bytes instead of 25
    }

    // Calculate segmentation overhead cost
    const SEGMENT_OVERHEAD = 3; // "x:" prefix + "|" separator ≈ 3 bytes per segment

    // Try segmented encoding vs single encoding
    const segments = this.segmentTextByEncoding(text);
    const originalBytes = new TextEncoder().encode(text).length;

    // Calculate segmented compression
    let segmentedSize = 0;
    const encodedSegments: string[] = [];

    for (const segment of segments) {
      let encoded: string;
      switch (segment.encoding) {
        case 'morse':
          encoded = this.encodeMorseSegment(segment.text);
          break;
        case 'ascii':
          encoded = this.encodeASCIISegment(segment.text);
          break;
        case 'utf8':
          encoded = this.encodeUTF8Segment(segment.text);
          break;
        default:
          encoded = segment.text;
      }

      const segmentWithOverhead = `${segment.encoding[0]}:${encoded}`;
      segmentedSize += new TextEncoder().encode(segmentWithOverhead).length + 1; // +1 for separator
      encodedSegments.push(segmentWithOverhead);
    }

    // Try single-encoding approaches
    const singleMorseSize = this.isSimpleText(text) ?
      new TextEncoder().encode(this.encodeMorseSegment(text)).length + 2 : // +2 for "m:" prefix
      Number.MAX_SAFE_INTEGER;

    const singleASCIISize = new TextEncoder().encode(`a:${this.encodeASCIISegment(text)}`).length;

    const singleUTF8Size = new TextEncoder().encode(`u:${this.encodeUTF8Segment(text)}`).length;

    // Choose the most efficient encoding
    const options = [
      { method: 'segmented', size: segmentedSize, data: encodedSegments.join('|'), segments: segments.length },
      { method: 'morse', size: singleMorseSize, data: `m:${this.encodeMorseSegment(text)}`, segments: 1 },
      { method: 'ascii', size: singleASCIISize, data: `a:${this.encodeASCIISegment(text)}`, segments: 1 },
      { method: 'utf8', size: singleUTF8Size, data: `u:${this.encodeUTF8Segment(text)}`, segments: 1 }
    ];

    const best = options.reduce((prev, curr) => curr.size < prev.size ? curr : prev);

    console.log(`📻 Adaptive encoding: ${originalBytes} bytes → ${best.size} bytes (${(originalBytes/best.size).toFixed(2)}x)`);
    console.log(`  Best method: ${best.method} (${best.segments} segments), overhead saved by avoiding ${segments.length - best.segments} extra segments`);

    return best.data;
  }

  private segmentTextByEncoding(text: string): Array<{text: string, encoding: 'morse' | 'ascii' | 'utf8'}> {
    const segments: Array<{text: string, encoding: 'morse' | 'ascii' | 'utf8'}> = [];
    let currentSegment = '';
    let currentEncoding: 'morse' | 'ascii' | 'utf8' | null = null;

    for (const char of text) {
      const charEncoding = this.getOptimalCharEncoding(char);

      if (currentEncoding === null || currentEncoding === charEncoding) {
        currentSegment += char;
        currentEncoding = charEncoding;
      } else {
        // Encoding type changed, finish current segment
        if (currentSegment) {
          segments.push({ text: currentSegment, encoding: currentEncoding });
        }
        currentSegment = char;
        currentEncoding = charEncoding;
      }
    }

    // Add final segment
    if (currentSegment && currentEncoding) {
      segments.push({ text: currentSegment, encoding: currentEncoding });
    }

    return segments;
  }

  private getOptimalCharEncoding(char: string): 'morse' | 'ascii' | 'utf8' {
    // Morse code: letters, numbers, basic punctuation
    if (/[A-Za-z0-9\s.,?'-]/.test(char)) {
      return 'morse';
    }

    // ASCII: printable ASCII characters
    if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) {
      return 'ascii';
    }

    // UTF-8: everything else
    return 'utf8';
  }

  private encodeMorseSegment(text: string): string {
    const morseEncoded = this.encodeToMorseBinary(text);
    return btoa(String.fromCharCode(...morseEncoded));
  }

  private encodeASCIISegment(text: string): string {
    // Apply ham radio dictionary compression for ASCII text
    const hamTerms = {
      'frequency': 'freq', 'callsign': 'call', 'station': 'stn', 'radio': 'rig',
      'antenna': 'ant', 'power': 'pwr', 'signal': 'sig', 'transmission': 'tx',
      'reception': 'rx', 'amateur': 'ham', 'emergency': 'em', 'repeater': 'rptr',
      'the': 't', 'and': '&', 'you': 'u', 'for': '4', 'with': 'w'
    };

    let compressed = text;
    Object.entries(hamTerms).forEach(([term, abbrev]) => {
      compressed = compressed.replace(new RegExp(`\\b${term}\\b`, 'gi'), abbrev);
    });

    return compressed.replace(/\s+/g, ' ').trim();
  }

  private encodeUTF8Segment(text: string): string {
    // For UTF-8 segments, just compress whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  private isSimpleText(text: string): boolean {
    // Check if text is suitable for Morse encoding (alphanumeric + basic punctuation)
    return /^[A-Za-z0-9\s.,?'-]+$/.test(text);
  }

  private encodeToMorseBinary(text: string): Uint8Array {
    // International Morse Code table
    const morseTable: Record<string, string> = {
      'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
      'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
      'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
      'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
      'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
      '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
      '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
      "'": '.----.', '-': '-....-', ' ': '/'
    };

    // Convert text to Morse code
    let morseCode = '';
    for (const char of text.toUpperCase()) {
      const morse = morseTable[char];
      if (morse) {
        morseCode += morse + ' '; // Space between characters
      }
    }

    // Pack Morse code into bits: . = 0, - = 1, space = 00, / = 11
    const bits: number[] = [];
    for (const char of morseCode) {
      switch (char) {
        case '.': bits.push(0); break;
        case '-': bits.push(1); break;
        case ' ': bits.push(0, 0); break; // Character separator
        case '/': bits.push(1, 1); break; // Word separator
      }
    }

    // Pack bits into bytes
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < bits.length; j++) {
        byte |= (bits[i + j] << (7 - j));
      }
      bytes.push(byte);
    }

    return new Uint8Array(bytes);
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export interface HydrationData {
  html: string;
  state?: any;
  props?: any;
}

export interface ProtobufComponentData {
  componentType: string; // Component type/name that exists in PWA
  protobufData: Uint8Array; // Binary protobuf data for component props/state
  componentSchema: string; // Schema ID for known component types
  originalSize: number; // Size before protobuf encoding (for metrics)
  compressedSize: number; // Size after protobuf encoding
  ratio: number; // Compression ratio
}

// Alias for backward compatibility
export type CompressedHydrationData = ProtobufComponentData;

export interface RenderOptions {
  compress?: boolean;
  includeState?: boolean;
  staticMarkup?: boolean;
  title?: string;
  meta?: Record<string, string>;
  useProtobuf?: boolean; // Use protobuf for component data
  componentType?: string; // Component type for schema lookup
}

// Legacy interfaces for compatibility
export interface VirtualDOM {
  tag: string;
  props: Record<string, any>;
  children: (VirtualDOM | string)[];
  key?: string;
}

export interface DeltaUpdate {
  type: 'insert' | 'replace' | 'remove' | 'update';
  path: string;
  data?: any;
  props?: Record<string, any>;
}

/**
 * Server-side React renderer for ham radio transmission
 */
export class ReactSSRRenderer {
  private compressor: HamRadioCompressor;

  constructor() {
    this.compressor = new HamRadioCompressor();
  }

  /**
   * Render React component to compressed data for radio transmission
   * Only sends component type and props, not HTML (components exist in PWA)
   */
  async renderToProtobuf(
    element: React.ReactElement,
    options: RenderOptions = {}
  ): Promise<ProtobufComponentData> {
    console.log('🚀 NEW BINARY ENCODER CALLED!', { element, options });

    const {
      includeState = false,
      componentType
    } = options;

    // Extract component data
    const resolvedComponentType = componentType ||
                                  element.type?.displayName ||
                                  element.type?.name ||
                                  (typeof element.type === 'string' ? element.type : 'Unknown');

    const componentData = {
      props: this.extractProps(element),
      state: includeState ? this.extractState(element) : undefined
    };

    // Create data to encode - only props and optional state
    const dataToEncode = {
      ...componentData.props,
      ...(componentData.state && { __state: componentData.state })
    };

    // Debug what data we're receiving
    console.log('Raw component data:', dataToEncode);

    // Apply bitmask optimization for known properties
    const optimizedData = this.applyBitmaskOptimization(dataToEncode);
    console.log('Optimized data:', optimizedData);

    // Calculate original size for metrics
    const originalSize = new TextEncoder().encode(JSON.stringify(dataToEncode)).length;

    // Encode entire component as single binary field (bypass protobuf)
    const binaryData = this.encodeComponentBinary(optimizedData, resolvedComponentType);

    console.log(`Binary encoding for ${resolvedComponentType}: JSON ${originalSize} bytes -> Binary ${binaryData.length} bytes (${(originalSize / binaryData.length).toFixed(2)}x compression)`);

    return {
      componentType: resolvedComponentType,
      protobufData: binaryData,
      componentSchema: 'binary-component',
      originalSize,
      compressedSize: binaryData.length,
      ratio: originalSize / binaryData.length
    };
  }

  // Legacy method names for compatibility
  async renderToCompressedData(element: React.ReactElement, options: RenderOptions = {}): Promise<ProtobufComponentData> {
    return this.renderToProtobuf(element, options);
  }

  async renderToCompressedHTML(element: React.ReactElement, options: RenderOptions = {}): Promise<ProtobufComponentData> {
    return this.renderToProtobuf(element, options);
  }


  /**
   * Render React component to minimal HTML for radio (no document wrapper)
   */
  renderToRadioHTML(element: React.ReactElement): string {
    return renderToString(element);
  }

  /**
   * Extract serializable state from React element tree
   */
  private extractState(element: React.ReactElement): any {
    // This would be enhanced to extract actual state
    // For now, return props as a basic state representation
    return this.extractProps(element);
  }

  /**
   * Extract props from React element for hydration
   */
  private extractProps(element: React.ReactElement): any {
    if (!element || !element.props) return {};

    // Filter out non-serializable props (functions, components, etc)
    const serializableProps: any = {};
    for (const [key, value] of Object.entries(element.props)) {
      if (this.isSerializable(value)) {
        serializableProps[key] = value;
      }
    }

    return serializableProps;
  }

  /**
   * Apply bitmask optimization for known property values
   */
  private applyBitmaskOptimization(data: any): any {
    const propertyBitmasks = {
      align: { 'left': 0x01, 'center': 0x02, 'right': 0x03, 'justify': 0x04 },
      size: { 'small': 0x01, 'medium': 0x02, 'large': 0x03, 'xl': 0x04 },
      variant: { 'primary': 0x01, 'secondary': 0x02, 'success': 0x03, 'warning': 0x04, 'danger': 0x05 }
    };

    const componentTypeBits = {
      'text': 0x01, 'heading': 0x02, 'paragraph': 0x03, 'image': 0x04,
      'form': 0x05, 'button': 0x06, 'input': 0x07, 'list': 0x08,
      'link': 0x09, 'container': 0x0A, 'divider': 0x0B
    };

    const optimized = { ...data };

    // Convert known properties to bitmasks
    Object.entries(propertyBitmasks).forEach(([prop, bitmask]) => {
      if (optimized[prop] && bitmask[optimized[prop] as keyof typeof bitmask]) {
        optimized[`${prop}_bit`] = bitmask[optimized[prop] as keyof typeof bitmask];
        delete optimized[prop]; // Remove original string value
      }
    });

    // Only keep essential content properties, remove all theming/styling
    const essentialProps = ['text', 'src', 'href', 'alt', 'value', 'placeholder', 'align', 'size', 'variant'];
    const filtered: any = {};

    essentialProps.forEach(prop => {
      if (optimized[prop] && typeof optimized[prop] === 'string' && optimized[prop].trim()) {
        filtered[prop] = optimized[prop];
      }
    });

    // Keep bitmask properties
    Object.keys(optimized).forEach(key => {
      if (key.endsWith('_bit')) {
        filtered[key] = optimized[key];
      }
    });

    return filtered;
  }

  /**
   * Encode component as pure binary data (no protobuf/JSON)
   * Uses field-based binary encoding with known field positions
   */
  private encodeComponentBinary(data: any, componentType: string): Uint8Array {
    console.log('🔧 Raw binary encoding for:', componentType, data);

    // Create binary field encoder
    const encoder = new BinaryFieldEncoder();

    // Encode component type (1 byte)
    encoder.writeComponentType(componentType);

    // Encode known fields in fixed positions
    encoder.writeTextField('text', data.text);
    encoder.writeTextField('src', data.src);
    encoder.writeTextField('href', data.href);
    encoder.writeTextField('alt', data.alt);
    encoder.writeTextField('value', data.value);
    encoder.writeTextField('placeholder', data.placeholder);

    // Encode bitmask properties (1 byte each)
    encoder.writeBitmask('align', data.align_bit || 0);
    encoder.writeBitmask('size', data.size_bit || 0);
    encoder.writeBitmask('variant', data.variant_bit || 0);

    const result = encoder.getBytes();

    console.log(`📦 Raw binary encoding:`, {
      componentType,
      data,
      jsonSize: JSON.stringify(data).length,
      binarySize: result.length,
      ratio: (JSON.stringify(data).length / result.length).toFixed(2) + 'x',
      binaryHex: Array.from(result).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });

    return result;
  }


  /**
   * Check if a value can be serialized to JSON
   */
  private isSerializable(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.every(item => this.isSerializable(item));
    if (typeof value === 'object') {
      try {
        JSON.stringify(value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Wrap component HTML in minimal document structure
   */
  private wrapInDocument(
    componentHTML: string,
    title: string,
    meta: Record<string, string>
  ): string {
    const metaTags = Object.entries(meta)
      .map(([name, content]) => `<meta name="${name}" content="${content}">`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${metaTags}
  <style>
    body{font-family:monospace;background:#000;color:#0f0;margin:0;padding:10px}
    h1,h2{color:#0ff}
    a{color:#ff0}
    form{margin:10px 0}
    input,button{background:#333;color:#0f0;border:1px solid #0f0;padding:5px;margin:2px}
    button:hover{background:#0f0;color:#000}
  </style>
</head>
<body>
  <div id="root">${componentHTML}</div>
  <script>
    // Minimal hydration bootstrap
    window.__HYDRATION_READY__ = true;
  </script>
</body>
</html>`;
  }
}

/**
 * Client-side hydration utilities
 */
export class ReactHydrator {
  private compressor: HamRadioCompressor;

  constructor() {
    this.compressor = new HamRadioCompressor();
  }

  /**
   * Render component from compressed protobuf data directly (no HTML)
   */
  async renderFromCompressed(
    compressedData: CompressedHydrationData,
    ComponentRegistry: Record<string, React.ComponentType<any>>,
    container?: HTMLElement
  ): Promise<void> {
    // Find or create container
    const targetContainer = container || document.getElementById('root');
    if (!targetContainer) {
      throw new Error('No container element found for rendering');
    }

    // Look up the component type in the registry
    const Component = ComponentRegistry[compressedData.componentType];
    if (!Component) {
      throw new Error(`Component type "${compressedData.componentType}" not found in registry`);
    }

    try {
      // Decode component props/state from compressed JSON data
      let decodedData;

      if (compressedData.protobufData) {
        // If we have binary data, assume it's compressed JSON
        const compressor = new HamRadioCompressor();
        const jsonString = await compressor.decompress(compressedData.protobufData);
        decodedData = JSON.parse(jsonString);
      } else {
        // Fallback to direct JSON parsing
        decodedData = compressedData;
      }

      // Extract props and state from decoded data
      const { __state, ...props } = decodedData;

      console.log(`Rendering ${compressedData.componentType} from protobuf:`, {
        protobufBytes: compressedData.protobufData.length,
        originalBytes: compressedData.originalSize,
        ratio: compressedData.ratio.toFixed(2) + 'x',
        propsCount: Object.keys(props).length
      });

      // Create React element with decoded props
      const element = React.createElement(Component, props);

      // Render the component directly
      const root = createRoot(targetContainer);
      root.render(element);

      // Handle state if present (would need context or state management)
      if (__state) {
        console.log('Component state available:', __state);
        // This could be handled with a context provider or state management solution
      }
    } catch (error) {
      console.error('Failed to decode protobuf data for component:', error);
      throw new Error(`Failed to render component ${compressedData.componentType}: ${error}`);
    }
  }

  /**
   * Legacy method: Decompress and hydrate React component from compressed data
   */
  async hydrateFromCompressed(
    compressedData: CompressedHydrationData,
    Component: React.ComponentType<any>,
    container?: HTMLElement
  ): Promise<void> {
    // If new format, use renderFromCompressed with single component
    if (compressedData.protobufData && compressedData.componentSchema && !compressedData.compressed) {
      const registry = { [compressedData.componentType]: Component };
      return this.renderFromCompressed(compressedData, registry, container);
    }

    // Legacy path for backward compatibility
    if (!compressedData.compressed) {
      throw new Error('No compressed HTML data found for legacy hydration');
    }

    // Decompress the HTML
    const decompressedHTML = this.compressor.decompressHTML(compressedData.compressed);

    // Extract the component HTML from the document
    const parser = new DOMParser();
    const doc = parser.parseFromString(decompressedHTML, 'text/html');
    const rootElement = doc.getElementById('root');

    if (!rootElement) {
      throw new Error('No root element found in decompressed HTML');
    }

    // Find or create container
    const targetContainer = container || document.getElementById('root');
    if (!targetContainer) {
      throw new Error('No container element found for hydration');
    }

    // Set initial HTML for hydration
    targetContainer.innerHTML = rootElement.innerHTML;

    // Create React element with props
    const element = React.createElement(Component, compressedData.props || {});

    // Hydrate the component
    hydrateRoot(targetContainer, element);
  }

  /**
   * Hydrate from uncompressed data (for development)
   */
  hydrateFromHTML(
    html: string,
    Component: React.ComponentType<any>,
    props: any = {},
    container?: HTMLElement
  ): void {
    const targetContainer = container || document.getElementById('root');
    if (!targetContainer) {
      throw new Error('No container element found for hydration');
    }

    // Set initial HTML
    targetContainer.innerHTML = html;

    // Create and hydrate React element
    const element = React.createElement(Component, props);
    hydrateRoot(targetContainer, element);
  }

  /**
   * Client-side only rendering (no hydration)
   */
  render(
    Component: React.ComponentType<any>,
    props: any = {},
    container?: HTMLElement
  ): void {
    const targetContainer = container || document.getElementById('root');
    if (!targetContainer) {
      throw new Error('No container element found for rendering');
    }

    const element = React.createElement(Component, props);
    const root = createRoot(targetContainer);
    root.render(element);
  }
}

/**
 * Legacy React-like renderer for backward compatibility
 */
export class ReactLikeRenderer {
  private currentTree: VirtualDOM | null = null;
  private componentState: Map<string, any> = new Map();
  private eventHandlers: Map<string, Function> = new Map();

  renderToString(vdom: VirtualDOM): string {
    if (!vdom) return '';

    if (typeof vdom === 'string') return vdom;

    const { tag, props, children } = vdom;
    const attrs = Object.entries(props || {})
      .filter(([key]) => key !== 'children' && !key.startsWith('on'))
      .map(([key, val]) => `${key}="${val}"`)
      .join(' ');

    const childrenHtml = children
      .map(child => this.renderToString(child as VirtualDOM))
      .join('');

    if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tag)) {
      return `<${tag}${attrs ? ' ' + attrs : ''} />`;
    }

    return `<${tag}${attrs ? ' ' + attrs : ''}>${childrenHtml}</${tag}>`;
  }

  diff(oldTree: VirtualDOM | null, newTree: VirtualDOM): DeltaUpdate[] {
    const updates: DeltaUpdate[] = [];

    if (!oldTree) {
      updates.push({
        type: 'replace',
        path: '/',
        data: newTree
      });
      return updates;
    }

    if (oldTree.tag !== newTree.tag) {
      updates.push({
        type: 'replace',
        path: this.getPath(oldTree),
        data: newTree
      });
      return updates;
    }

    // Check props
    const oldProps = oldTree.props || {};
    const newProps = newTree.props || {};
    const propChanges: Record<string, any> = {};

    for (const key in newProps) {
      if (oldProps[key] !== newProps[key]) {
        propChanges[key] = newProps[key];
      }
    }

    if (Object.keys(propChanges).length > 0) {
      updates.push({
        type: 'update',
        path: this.getPath(oldTree),
        props: propChanges
      });
    }

    // Check children
    const maxLen = Math.max(oldTree.children.length, newTree.children.length);
    for (let i = 0; i < maxLen; i++) {
      const oldChild = oldTree.children[i];
      const newChild = newTree.children[i];

      if (!oldChild) {
        updates.push({
          type: 'insert',
          path: `${this.getPath(oldTree)}/children[${i}]`,
          data: newChild
        });
      } else if (!newChild) {
        updates.push({
          type: 'remove',
          path: `${this.getPath(oldTree)}/children[${i}]`
        });
      } else if (typeof oldChild === 'string' || typeof newChild === 'string') {
        if (oldChild !== newChild) {
          updates.push({
            type: 'replace',
            path: `${this.getPath(oldTree)}/children[${i}]`,
            data: newChild
          });
        }
      } else {
        updates.push(...this.diff(oldChild as VirtualDOM, newChild as VirtualDOM));
      }
    }

    return updates;
  }

  private getPath(vdom: VirtualDOM): string {
    return vdom.key || vdom.tag;
  }

  applyDelta(tree: VirtualDOM, updates: DeltaUpdate[]): VirtualDOM {
    // Deep clone the tree
    const newTree = JSON.parse(JSON.stringify(tree));

    for (const update of updates) {
      // Apply each update to the tree
      // This is simplified - in production would need path resolution
      switch (update.type) {
        case 'replace':
          return update.data as VirtualDOM;
        case 'update':
          Object.assign(newTree.props, update.props);
          break;
        // Additional cases would be implemented
      }
    }

    return newTree;
  }

  setState(componentId: string, newState: any): void {
    this.componentState.set(componentId, newState);
  }

  getState(componentId: string): any {
    return this.componentState.get(componentId);
  }

  registerEventHandler(id: string, handler: Function): void {
    this.eventHandlers.set(id, handler);
  }

  handleEvent(id: string, event: any): any {
    const handler = this.eventHandlers.get(id);
    if (handler) {
      return handler(event);
    }
  }

  hydrate(html: string): VirtualDOM {
    // Simplified HTML to VDOM parser
    // In production, would use a proper parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return this.domToVdom(doc.body.firstChild as Element);
  }

  private domToVdom(element: Element): VirtualDOM {
    if (!element) return { tag: 'div', props: {}, children: [] };

    const props: Record<string, any> = {};
    for (const attr of Array.from(element.attributes)) {
      props[attr.name] = attr.value;
    }

    const children: (VirtualDOM | string)[] = [];
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) children.push(text);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        children.push(this.domToVdom(child as Element));
      }
    }

    return {
      tag: element.tagName.toLowerCase(),
      props,
      children
    };
  }
}

// Singleton instances
export const reactRenderer = new ReactSSRRenderer();
export const reactHydrator = new ReactHydrator();

// Utility functions for protobuf-based transmission
export async function renderComponentForRadio(
  Component: React.ComponentType<any>,
  props: any = {},
  options: RenderOptions = {}
): Promise<ProtobufComponentData> {
  const element = React.createElement(Component, props);
  return reactRenderer.renderToProtobuf(element, options);
}

export function renderComponentFromRadio(
  protobufData: ProtobufComponentData,
  ComponentRegistry: Record<string, React.ComponentType<any>>,
  container?: HTMLElement
): Promise<void> {
  return reactHydrator.renderFromCompressed(protobufData, ComponentRegistry, container);
}

// Legacy functions for backward compatibility
export async function renderPageForRadio(
  Component: React.ComponentType<any>,
  props: any = {},
  options: RenderOptions = {}
): Promise<ProtobufComponentData> {
  return renderComponentForRadio(Component, props, options);
}

export function hydratePageFromRadio(
  compressedData: ProtobufComponentData,
  Component: React.ComponentType<any>,
  container?: HTMLElement
): Promise<void> {
  const registry = { [compressedData.componentType]: Component };
  return reactHydrator.renderFromCompressed(compressedData, registry, container);
}