/** @jsxImportSource . */

export interface RadioElement {
  type: string | ComponentFunction;
  props: Record<string, any>;
  children: (RadioElement | string | number)[];
}

export type ComponentFunction = (props: any) => RadioElement;

export interface CompiledComponent {
  id: number;
  hash: string;
  template: string;
  props: string[];
  children: boolean;
}

// JSX Factory
export function h(
  type: string | ComponentFunction,
  props: Record<string, any> | null,
  ...children: any[]
): RadioElement {
  return {
    type,
    props: props || {},
    children: children.flat().filter(c => c != null)
  };
}

// Fragment support
export const Fragment = ({ children }: { children: any }) => children;

// Component registry for deduplication
export class ComponentRegistry {
  private components: Map<string, CompiledComponent> = new Map();
  private componentId = 1000; // Start at 1000 to avoid conflicts with built-in templates
  private stringTable: Map<string, number> = new Map();
  private stringId = 0;

  // Register common components
  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    // Pre-register common components as templates
    this.register('Page', `<html><head>{{head}}</head><body>{{children}}</body></html>`);
    this.register('Header', `<header><h1>{{title}}</h1><nav>{{nav}}</nav></header>`);
    this.register('Article', `<article><h2>{{title}}</h2><time>{{date}}</time>{{children}}</article>`);
    this.register('Card', `<div class="card"><h3>{{title}}</h3>{{children}}</div>`);
    this.register('Button', `<button onclick="{{onClick}}">{{children}}</button>`);
    this.register('Link', `<a href="{{href}}">{{children}}</a>`);
    this.register('Form', `<form method="{{method}}" action="{{action}}">{{children}}</form>`);
    this.register('Input', `<input type="{{type}}" name="{{name}}" value="{{value}}"/>`);
    this.register('QSOLog', `<tr><td>{{date}}</td><td>{{time}}</td><td>{{call}}</td><td>{{freq}}</td><td>{{mode}}</td></tr>`);
  }

  register(name: string, template: string): number {
    const hash = this.hashTemplate(template);
    
    if (!this.components.has(hash)) {
      const props = [...template.matchAll(/{{(\w+)}}/g)].map(m => m[1]);
      const component: CompiledComponent = {
        id: this.componentId++,
        hash,
        template,
        props,
        children: props.includes('children')
      };
      
      this.components.set(hash, component);
      this.components.set(name, component); // Also store by name
    }
    
    return this.components.get(hash)!.id;
  }

  private hashTemplate(template: string): string {
    let hash = 0;
    for (let i = 0; i < template.length; i++) {
      const char = template.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  getComponent(idOrName: number | string): CompiledComponent | undefined {
    if (typeof idOrName === 'number') {
      for (const comp of this.components.values()) {
        if (comp.id === idOrName) return comp;
      }
    }
    return this.components.get(idOrName as string);
  }

  // String interning for repeated values
  internString(str: string): number {
    if (!this.stringTable.has(str)) {
      this.stringTable.set(str, this.stringId++);
    }
    return this.stringTable.get(str)!;
  }

  getString(id: number): string | undefined {
    for (const [str, strId] of this.stringTable) {
      if (strId === id) return str;
    }
    return undefined;
  }
}

// Compiler to convert JSX to compressed format
export class RadioJSXCompiler {
  private registry: ComponentRegistry;

  constructor(registry?: ComponentRegistry) {
    this.registry = registry || new ComponentRegistry();
  }

  compile(element: RadioElement): any {
    if (typeof element === 'string' || typeof element === 'number') {
      // Intern common strings
      const str = element.toString();
      if (str.length > 10) {
        return { s: this.registry.internString(str) };
      }
      return str;
    }

    if (typeof element.type === 'function') {
      // Expand function components
      const result = element.type(element.props);
      return this.compile(result);
    }

    // Check if this matches a registered component
    const component = this.registry.getComponent(element.type);
    
    if (component) {
      // Use component template
      const data: any = { c: component.id };
      
      // Only include props that the template uses
      for (const prop of component.props) {
        if (prop === 'children') {
          data.ch = element.children.map(c => this.compile(c));
        } else if (element.props[prop] !== undefined) {
          data[prop] = element.props[prop];
        }
      }
      
      return data;
    }

    // Fallback to regular element
    const compiled: any = { t: element.type };
    
    // Compress props
    if (Object.keys(element.props).length > 0) {
      compiled.p = this.compressProps(element.props);
    }
    
    // Compress children
    if (element.children.length > 0) {
      compiled.ch = element.children.map(c => this.compile(c));
    }
    
    return compiled;
  }

  private compressProps(props: Record<string, any>): any {
    const compressed: any = {};
    
    for (const [key, value] of Object.entries(props)) {
      // Use short keys for common props
      const shortKey = this.getShortKey(key);
      
      // Compress values
      if (typeof value === 'string' && value.length > 10) {
        compressed[shortKey] = { s: this.registry.internString(value) };
      } else {
        compressed[shortKey] = value;
      }
    }
    
    return compressed;
  }

  private getShortKey(key: string): string {
    const shortKeys: Record<string, string> = {
      className: 'c',
      onClick: 'oc',
      onChange: 'och',
      onSubmit: 'os',
      href: 'h',
      src: 's',
      alt: 'a',
      title: 't',
      type: 'ty',
      name: 'n',
      value: 'v',
      placeholder: 'ph',
      disabled: 'd',
      checked: 'ch',
      selected: 'se'
    };
    
    return shortKeys[key] || key;
  }

  decompile(compiled: any): string {
    if (typeof compiled === 'string' || typeof compiled === 'number') {
      return compiled.toString();
    }

    if (compiled.s !== undefined) {
      // String reference
      return this.registry.getString(compiled.s) || '';
    }

    if (compiled.c !== undefined) {
      // Component reference
      const component = this.registry.getComponent(compiled.c);
      if (!component) return '';
      
      let html = component.template;
      
      // Replace template variables
      for (const prop of component.props) {
        if (prop === 'children' && compiled.ch) {
          const children = compiled.ch.map((c: any) => this.decompile(c)).join('');
          html = html.replace('{{children}}', children);
        } else if (compiled[prop] !== undefined) {
          html = html.replace(`{{${prop}}}`, compiled[prop]);
        }
      }
      
      return html;
    }

    // Regular element
    const tag = compiled.t;
    const props = this.decompressProps(compiled.p || {});
    const children = (compiled.ch || []).map((c: any) => this.decompile(c)).join('');
    
    const attrs = Object.entries(props)
      .map(([key, val]) => `${key}="${val}"`)
      .join(' ');
    
    return `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`;
  }

  private decompressProps(compressed: any): Record<string, any> {
    const props: Record<string, any> = {};
    
    const longKeys: Record<string, string> = {
      c: 'className',
      oc: 'onClick',
      och: 'onChange',
      os: 'onSubmit',
      h: 'href',
      s: 'src',
      a: 'alt',
      t: 'title',
      ty: 'type',
      n: 'name',
      v: 'value',
      ph: 'placeholder',
      d: 'disabled',
      ch: 'checked',
      se: 'selected'
    };
    
    for (const [key, value] of Object.entries(compressed)) {
      const longKey = longKeys[key] || key;
      
      if (value && typeof value === 'object' && value.s !== undefined) {
        props[longKey] = this.registry.getString(value.s) || '';
      } else {
        props[longKey] = value;
      }
    }
    
    return props;
  }
}

// React-like hooks for state management
export class RadioComponent {
  private state: Map<string, any> = new Map();
  private effects: Array<() => void> = [];
  private updateCallbacks: Array<() => void> = [];

  useState<T>(initial: T): [T, (value: T) => void] {
    const key = `state_${this.state.size}`;
    
    if (!this.state.has(key)) {
      this.state.set(key, initial);
    }
    
    const setValue = (value: T) => {
      this.state.set(key, value);
      this.triggerUpdate();
    };
    
    return [this.state.get(key), setValue];
  }

  useEffect(effect: () => void, deps?: any[]): void {
    this.effects.push(effect);
  }

  private triggerUpdate(): void {
    for (const callback of this.updateCallbacks) {
      callback();
    }
  }

  onUpdate(callback: () => void): void {
    this.updateCallbacks.push(callback);
  }
}

// Example components using the JSX system
export const QSOLogEntry = ({ date, time, callsign, frequency, mode, rst }: any) => (
  <tr>
    <td>{date}</td>
    <td>{time}</td>
    <td>{callsign}</td>
    <td>{frequency}</td>
    <td>{mode}</td>
    <td>{rst}</td>
  </tr>
);

export const HamRadioPage = ({ callsign, logs }: any) => (
  <html>
    <head>
      <title>{callsign} Station</title>
    </head>
    <body>
      <Header title={`${callsign} Amateur Radio Station`} nav={
        <>
          <Link href="/">Home</Link>
          <Link href="/log">Logbook</Link>
          <Link href="/qsl">QSL Cards</Link>
        </>
      } />
      <main>
        <Article title="Recent QSOs" date={new Date().toISOString()}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Callsign</th>
                <th>Frequency</th>
                <th>Mode</th>
                <th>RST</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => <QSOLogEntry {...log} />)}
            </tbody>
          </table>
        </Article>
      </main>
    </body>
  </html>
);

// Size comparison example
export function demonstrateCompression(): void {
  const compiler = new RadioJSXCompiler();
  
  // Create a sample page
  const page = HamRadioPage({
    callsign: 'KJ4ABC',
    logs: [
      { date: '2024-01-15', time: '14:30', callsign: 'W1AW', frequency: '14.205', mode: 'SSB', rst: '59' },
      { date: '2024-01-15', time: '15:45', callsign: 'VK3ABC', frequency: '14.230', mode: 'SSB', rst: '57' }
    ]
  });
  
  // Compile to compressed format
  const compiled = compiler.compile(page);
  
  // Original HTML size
  const html = compiler.decompile(compiled);
  const originalSize = html.length;
  
  // Compressed JSON size
  const compressedSize = JSON.stringify(compiled).length;
  
  console.log(`Original HTML: ${originalSize} bytes`);
  console.log(`Compressed: ${compressedSize} bytes`);
  console.log(`Compression ratio: ${(100 - (compressedSize / originalSize * 100)).toFixed(1)}%`);
}

// Define standard components that can be referenced by ID
const Header: ComponentFunction = (props) => h('header', null,
  h('h1', null, props.title),
  h('nav', null, props.nav)
);

const Link: ComponentFunction = (props) => h('a', { href: props.href }, props.children);

const Article: ComponentFunction = (props) => h('article', null,
  h('h2', null, props.title),
  h('time', null, props.date),
  props.children
);