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
import { protocolBuffers } from '../protocol-buffers';

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

    // Calculate original size for metrics (what JSON would be)
    const originalJSON = JSON.stringify(dataToEncode);
    const originalSize = new TextEncoder().encode(originalJSON).length;

    // Generate schema for this component type
    const schemaName = `${resolvedComponentType}Props`;
    const schema = protocolBuffers.generateSchema(dataToEncode, schemaName);

    // Encode the data using protobuf
    const encoded = protocolBuffers.encode(dataToEncode, schema.id);
    const protobufSize = encoded.data.length;
    const ratio = originalSize / protobufSize;

    console.log(`Protobuf encoding for ${resolvedComponentType}: JSON ${originalSize} bytes -> Protobuf ${protobufSize} bytes (${ratio.toFixed(2)}x compression)`);

    return {
      componentType: resolvedComponentType,
      protobufData: encoded.data,
      componentSchema: schema.id,
      originalSize,
      compressedSize: protobufSize,
      ratio
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
      // Decode component props/state from protobuf
      const encodedMessage = {
        schemaId: compressedData.componentSchema,
        data: compressedData.protobufData,
        compressed: false
      };

      const decodedData = protocolBuffers.decode(encodedMessage);

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