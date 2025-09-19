/**
 * YAML Serializer for Rich Media Components
 * 
 * Compact YAML-based serialization for bandwidth-efficient
 * transmission of rich media component definitions.
 */

export interface YAMLComponent {
  type: string;
  props?: Record<string, any>;
  children?: YAMLComponent[];
  media?: {
    url?: string;
    data?: string; // Base64 or reference
    codec?: string;
    size?: number;
  };
}

export interface SerializationOptions {
  compress?: boolean;
  includeMedia?: boolean;
  maxDepth?: number;
  minify?: boolean;
}

/**
 * YAML Serializer
 */
export class YAMLSerializer {
  private references = new Map<string, any>();
  private refCounter = 0;

  /**
   * Serialize component to YAML
   */
  serialize(
    component: YAMLComponent,
    options: SerializationOptions = {}
  ): string {
    const {
      compress = true,
      includeMedia = false,
      maxDepth = 10,
      minify = true
    } = options;

    this.references.clear();
    this.refCounter = 0;

    const yaml = this.componentToYAML(component, 0, maxDepth, includeMedia);
    
    if (minify) {
      return this.minifyYAML(yaml);
    }

    return yaml;
  }

  /**
   * Deserialize YAML to component
   */
  deserialize(yaml: string): YAMLComponent {
    this.references.clear();
    return this.yamlToComponent(yaml);
  }

  /**
   * Convert component to YAML
   */
  private componentToYAML(
    component: YAMLComponent,
    depth: number,
    maxDepth: number,
    includeMedia: boolean
  ): string {
    if (depth > maxDepth) {
      return '~truncated~';
    }

    const lines: string[] = [];
    const indent = '  '.repeat(depth);

    // Type
    lines.push(`${indent}type: ${component.type}`);

    // Props
    if (component.props && Object.keys(component.props).length > 0) {
      lines.push(`${indent}props:`);
      for (const [key, value] of Object.entries(component.props)) {
        const serialized = this.serializeValue(value, depth + 1);
        lines.push(`${indent}  ${key}: ${serialized}`);
      }
    }

    // Media
    if (component.media && includeMedia) {
      lines.push(`${indent}media:`);
      
      if (component.media.url) {
        lines.push(`${indent}  url: ${component.media.url}`);
      }
      
      if (component.media.data) {
        // Store as reference for deduplication
        const ref = this.getOrCreateReference(component.media.data);
        lines.push(`${indent}  data: &${ref}`);
      }
      
      if (component.media.codec) {
        lines.push(`${indent}  codec: ${component.media.codec}`);
      }
      
      if (component.media.size) {
        lines.push(`${indent}  size: ${component.media.size}`);
      }
    }

    // Children
    if (component.children && component.children.length > 0) {
      lines.push(`${indent}children:`);
      for (const child of component.children) {
        lines.push(`${indent}  - `);
        const childYAML = this.componentToYAML(child, depth + 2, maxDepth, includeMedia);
        lines.push(childYAML);
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert YAML to component
   */
  private yamlToComponent(yaml: string): YAMLComponent {
    const lines = yaml.split('\n').filter(line => line.trim());
    const component: YAMLComponent = { type: '' };
    let currentSection: string | null = null;
    let currentIndent = 0;

    for (const line of lines) {
      const indent = line.search(/\S/);
      const trimmed = line.trim();

      if (trimmed.startsWith('type:')) {
        component.type = trimmed.substring(5).trim();
      } else if (trimmed === 'props:') {
        currentSection = 'props';
        component.props = {};
        currentIndent = indent;
      } else if (trimmed === 'media:') {
        currentSection = 'media';
        component.media = {};
        currentIndent = indent;
      } else if (trimmed === 'children:') {
        currentSection = 'children';
        component.children = [];
        currentIndent = indent;
      } else if (currentSection === 'props' && indent > currentIndent) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        component.props![key] = this.deserializeValue(value);
      } else if (currentSection === 'media' && indent > currentIndent) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        
        if (key === 'data' && value.startsWith('&')) {
          // Reference
          const ref = value.substring(1);
          component.media![key] = this.references.get(ref) || value;
        } else {
          component.media![key] = this.deserializeValue(value);
        }
      } else if (currentSection === 'children' && trimmed.startsWith('- ')) {
        // Parse child component (simplified)
        const childYAML = this.extractChildYAML(lines, lines.indexOf(line));
        component.children!.push(this.yamlToComponent(childYAML));
      }
    }

    return component;
  }

  /**
   * Serialize value
   */
  private serializeValue(value: any, depth: number): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'boolean') {
      return value.toString();
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'string') {
      // Quote if contains special chars
      if (value.includes(':') || value.includes('#') || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    
    if (Array.isArray(value)) {
      return '[' + value.map(v => this.serializeValue(v, depth)).join(', ') + ']';
    }
    
    if (typeof value === 'object') {
      // Inline object
      const pairs = Object.entries(value)
        .map(([k, v]) => `${k}: ${this.serializeValue(v, depth)}`);
      return '{' + pairs.join(', ') + '}';
    }
    
    return String(value);
  }

  /**
   * Deserialize value
   */
  private deserializeValue(value: string): any {
    const trimmed = value.trim();
    
    if (trimmed === 'null') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // Quoted string
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"');
    }
    
    // Array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const items = trimmed.slice(1, -1).split(',');
      return items.map(item => this.deserializeValue(item.trim()));
    }
    
    // Object
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const obj: Record<string, any> = {};
      const pairs = trimmed.slice(1, -1).split(',');
      
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split(':');
        obj[key.trim()] = this.deserializeValue(valueParts.join(':').trim());
      }
      
      return obj;
    }
    
    return trimmed;
  }

  /**
   * Extract child YAML
   */
  private extractChildYAML(lines: string[], startIndex: number): string {
    const childLines: string[] = [];
    const baseIndent = lines[startIndex].search(/\S/);
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S/);
      
      if (indent <= baseIndent && line.trim()) {
        break;
      }
      
      childLines.push(line);
    }
    
    return childLines.join('\n');
  }

  /**
   * Minify YAML
   */
  private minifyYAML(yaml: string): string {
    return yaml
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .join('\n');
  }

  /**
   * Get or create reference
   */
  private getOrCreateReference(data: string): string {
    for (const [ref, value] of this.references) {
      if (value === data) {
        return ref;
      }
    }

    const ref = `ref${this.refCounter++}`;
    this.references.set(ref, data);
    return ref;
  }
}

/**
 * Compact binary serializer for extreme bandwidth constraints
 */
export class BinarySerializer {
  private typeMap = new Map<string, number>([
    ['image', 1],
    ['audio', 2],
    ['video', 3],
    ['document', 4],
    ['container', 5],
    ['text', 6]
  ]);

  /**
   * Serialize to binary
   */
  serialize(component: YAMLComponent): Uint8Array {
    const buffer = new ArrayBuffer(1024); // Initial size
    const view = new DataView(buffer);
    let offset = 0;

    // Write type
    const typeId = this.typeMap.get(component.type) || 0;
    view.setUint8(offset++, typeId);

    // Write props count
    const propCount = Object.keys(component.props || {}).length;
    view.setUint8(offset++, propCount);

    // Write props
    if (component.props) {
      for (const [key, value] of Object.entries(component.props)) {
        // Write key length and key
        const keyBytes = new TextEncoder().encode(key);
        view.setUint8(offset++, keyBytes.length);
        new Uint8Array(buffer, offset, keyBytes.length).set(keyBytes);
        offset += keyBytes.length;

        // Write value (simplified)
        const valueBytes = new TextEncoder().encode(String(value));
        view.setUint16(offset, valueBytes.length, true);
        offset += 2;
        new Uint8Array(buffer, offset, valueBytes.length).set(valueBytes);
        offset += valueBytes.length;
      }
    }

    // Write children count
    const childCount = component.children?.length || 0;
    view.setUint8(offset++, childCount);

    // Return trimmed buffer
    return new Uint8Array(buffer, 0, offset);
  }

  /**
   * Deserialize from binary
   */
  deserialize(data: Uint8Array): YAMLComponent {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // Read type
    const typeId = view.getUint8(offset++);
    const type = Array.from(this.typeMap.entries())
      .find(([_, id]) => id === typeId)?.[0] || 'unknown';

    // Read props
    const propCount = view.getUint8(offset++);
    const props: Record<string, any> = {};

    for (let i = 0; i < propCount; i++) {
      // Read key
      const keyLength = view.getUint8(offset++);
      const keyBytes = new Uint8Array(data.buffer, data.byteOffset + offset, keyLength);
      const key = new TextDecoder().decode(keyBytes);
      offset += keyLength;

      // Read value
      const valueLength = view.getUint16(offset, true);
      offset += 2;
      const valueBytes = new Uint8Array(data.buffer, data.byteOffset + offset, valueLength);
      const value = new TextDecoder().decode(valueBytes);
      offset += valueLength;

      props[key] = value;
    }

    // Read children count
    const childCount = view.getUint8(offset++);

    return {
      type,
      props: Object.keys(props).length > 0 ? props : undefined,
      children: childCount > 0 ? [] : undefined
    };
  }
}

// Export singleton instances
export const yamlSerializer = new YAMLSerializer();
export const binarySerializer = new BinarySerializer();