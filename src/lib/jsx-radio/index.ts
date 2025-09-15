// JSX Radio - React-compatible renderer optimized for radio transmission bandwidth
import * as React from 'react';

// Re-export React elements for compatibility
export { React };
export const h = React.createElement;
export const Fragment = React.Fragment;

export type VNode = React.ReactElement;

// Component registry for custom components
export class ComponentRegistry {
  private static components = new Map<string, React.ComponentType>();

  static register(name: string, component: React.ComponentType): void {
    this.components.set(name, component);
  }

  static get(name: string): React.ComponentType | undefined {
    return this.components.get(name);
  }

  static has(name: string): boolean {
    return this.components.has(name);
  }
}

export class RadioJSXCompiler {
  private templates: Map<string, number> = new Map();
  private templateId = 1000;

  compile(element: React.ReactElement): any {
    // Check if this structure matches a template
    const templateKey = this.generateTemplateKey(element);
    let compiled;

    if (this.templates.has(templateKey)) {
      compiled = {
        t: this.templates.get(templateKey),
        d: this.extractData(element)
      };
    } else {
      // If repeated structure, create a template
      const similar = this.findSimilarStructure(element);
      if (similar) {
        const templateId = this.templateId++;
        this.templates.set(templateKey, templateId);
        compiled = {
          t: templateId,
          d: this.extractData(element)
        };
      } else {
        // Otherwise, compile to minimal representation
        compiled = this.compileNode(element);
      }
    }

    // Return consistent format expected by tests
    return {
      templates: Object.fromEntries(this.templates),
      compiled: compiled.t ? compiled : { t: 'inline', d: [compiled] }
    };
  }

  private compileNode(node: React.ReactElement | string | number | boolean | null): any {
    if (node === null || node === undefined) {
      return null;
    }

    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      return node;
    }

    const compiled: any = {
      $: typeof node.type === 'string' ? node.type : (node.type as any).name || 'Component'
    };

    if (node.props && Object.keys(node.props).length > 0) {
      const { children, ...otherProps } = node.props;
      if (Object.keys(otherProps).length > 0) {
        compiled.p = this.compressProps(otherProps);
      }
      if (children) {
        const childArray = React.Children.toArray(children);
        if (childArray.length > 0) {
          compiled.c = childArray.map(child => this.compileNode(child as any));
        }
      }
    }

    return compiled;
  }

  decompile(input: any): React.ReactElement | string | null {
    // Handle the test format with templates and compiled properties
    const compiled = input.compiled || input;

    if (compiled === null || compiled === undefined) {
      return null;
    }

    if (typeof compiled === 'string' || typeof compiled === 'number' || typeof compiled === 'boolean') {
      return compiled as any;
    }

    // Handle inline compilation
    if (compiled.t === 'inline' && compiled.d) {
      return this.decompile(compiled.d[0]);
    }

    // Handle template references
    if (compiled.t !== undefined && compiled.t !== 'inline') {
      return this.expandTemplate(compiled);
    }

    // Handle regular compiled nodes
    const type = compiled.$;
    const props = compiled.p ? this.expandProps(compiled.p) : {};
    const children = compiled.c ? compiled.c.map((c: any) => this.decompile(c)) : [];

    return React.createElement(type, props, ...children);
  }

  private compressProps(props: Record<string, any>): any {
    // Common prop shortcuts
    const shortcuts: Record<string, string> = {
      className: 'c',
      onClick: 'o',
      onChange: 'h',
      value: 'v',
      href: 'r',
      src: 's',
      id: 'i',
      name: 'n',
      type: 't',
      placeholder: 'p',
      disabled: 'd',
      checked: 'k',
      style: 'y'
    };

    const compressed: any = {};
    for (const [key, value] of Object.entries(props)) {
      const shortKey = shortcuts[key] || key;
      compressed[shortKey] = value;
    }
    return compressed;
  }

  private expandProps(compressed: any): any {
    // Reverse of compressProps
    const expansions: Record<string, string> = {
      c: 'className',
      o: 'onClick',
      h: 'onChange',
      v: 'value',
      r: 'href',
      s: 'src',
      i: 'id',
      n: 'name',
      t: 'type',
      p: 'placeholder',
      d: 'disabled',
      k: 'checked',
      y: 'style'
    };

    const expanded: any = {};
    for (const [key, value] of Object.entries(compressed)) {
      const fullKey = expansions[key] || key;
      expanded[fullKey] = value;
    }
    return expanded;
  }

  private generateTemplateKey(element: React.ReactElement): string {
    if (!element || typeof element === 'string') return '';

    const structure = {
      type: typeof element.type === 'string' ? element.type : (element.type as any).name || 'Component',
      props: Object.keys(element.props || {}).filter(k => k !== 'children'),
      childTypes: React.Children.map(element.props?.children, c =>
        typeof c === 'string' ? 'text' :
        (c && typeof c === 'object' && 'type' in c) ?
          (typeof c.type === 'string' ? c.type : 'component') :
          'unknown'
      ) || []
    };

    return JSON.stringify(structure);
  }

  private findSimilarStructure(element: React.ReactElement): boolean {
    // Simple heuristic: if we see the same tag with children more than 3 times
    // Could be made more sophisticated
    return false;
  }

  private extractData(element: React.ReactElement): any {
    // Extract variable data from React element
    const { children, ...props } = element.props || {};
    return {
      props,
      text: this.extractTextContent(children)
    };
  }

  private extractTextContent(children: any): string[] {
    const texts: string[] = [];
    React.Children.forEach(children, child => {
      if (typeof child === 'string' || typeof child === 'number') {
        texts.push(String(child));
      } else if (React.isValidElement(child)) {
        texts.push(...this.extractTextContent(child.props.children));
      }
    });
    return texts;
  }

  private expandTemplate(compiled: any): React.ReactElement {
    // This would look up the template and expand it with the provided data
    // For now, return a placeholder
    return React.createElement('div', { className: 'template' }, `Template ${compiled.t}`);
  }

  registerComponent(name: string, component: React.ComponentType): void {
    ComponentRegistry.register(name, component);
  }
}