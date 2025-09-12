import { compress as brotliCompress, decompress as brotliDecompress } from 'brotli-wasm';

export interface CompressedPayload {
  type: 'template' | 'delta' | 'full' | 'binary';
  encoding: 'json' | 'binary' | 'brotli';
  data: Uint8Array | any;
  template?: number;
  styles?: number[];
  scripts?: number[];
}

export class HamRadioCompressor {
  private dictionary: Map<string, number> = new Map();
  private reverseDictionary: Map<number, string> = new Map();
  private templates: Map<number, string> = new Map();
  private styles: Map<number, string> = new Map();
  private scripts: Map<number, string> = new Map();
  private dictId = 0;

  constructor() {
    this.initializeHamDictionary();
    this.loadBuiltinTemplates();
  }

  private initializeHamDictionary(): void {
    const commonTerms = [
      'frequency', 'callsign', 'QSO', 'QSL', 'QTH', 'RST', '73', '88',
      'CQ', 'DX', 'band', 'meter', 'MHz', 'kHz', 'antenna', 'radio',
      'power', 'watts', 'mode', 'SSB', 'CW', 'FM', 'AM', 'digital',
      'RTTY', 'PSK31', 'FT8', 'JS8', 'packet', 'APRS', 'grid', 'square',
      'propagation', 'ionosphere', 'skip', 'groundwave', 'local', 'DXpedition',
      'contest', 'field', 'day', 'emergency', 'ARES', 'RACES', 'repeater',
      'simplex', 'duplex', 'offset', 'CTCSS', 'tone', 'squelch', 'roger',
      'copy', 'break', 'over', 'out', 'standing', 'by', 'mobile', 'portable',
      'base', 'station', 'shack', 'rig', 'transceiver', 'receiver', 'transmitter',
      'amplifier', 'tuner', 'SWR', 'coax', 'dipole', 'yagi', 'vertical', 'beam',
      'rotor', 'tower', 'ground', 'radial', 'balun', 'feedline', 'impedance',
      'resistance', 'reactance', 'capacitance', 'inductance', 'resonance'
    ];

    commonTerms.forEach(term => {
      this.dictionary.set(term, this.dictId);
      this.reverseDictionary.set(this.dictId, term);
      this.dictId++;
    });
  }

  private loadBuiltinTemplates(): void {
    // Basic page template
    this.templates.set(1, `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>{{title}}</title><style>{{styles}}</style></head>
      <body><header><h1>{{callsign}}</h1><nav>{{nav}}</nav></header><main>{{content}}</main></body></html>
    `);

    // Blog post template
    this.templates.set(2, `
      <article><h2>{{title}}</h2><time>{{date}}</time><div>{{content}}</div></article>
    `);

    // QSO log entry template
    this.templates.set(3, `
      <tr><td>{{date}}</td><td>{{time}}</td><td>{{callsign}}</td><td>{{freq}}</td><td>{{mode}}</td><td>{{rst}}</td></tr>
    `);

    // Basic styles
    this.styles.set(1, 'body{font-family:monospace;background:#000;color:#0f0;margin:0;padding:10px}');
    this.styles.set(2, 'h1,h2{color:#0ff}a{color:#ff0}table{width:100%;border:1px solid #0f0}');
    
    // Minimal scripts
    this.scripts.set(1, 'document.querySelectorAll("a").forEach(a=>a.onclick=e=>{e.preventDefault();loadPage(a.href)})');
  }

  compressHTML(html: string): CompressedPayload {
    // Try template matching first
    const templateMatch = this.findMatchingTemplate(html);
    if (templateMatch) {
      return {
        type: 'template',
        encoding: 'json',
        data: templateMatch.data,
        template: templateMatch.id,
        styles: templateMatch.styles,
        scripts: templateMatch.scripts
      };
    }

    // Minify HTML
    const minified = this.minifyHTML(html);
    
    // Apply dictionary compression
    const compressed = this.applyDictionaryCompression(minified);

    // Brotli compress if still large
    if (compressed.length > 1000) {
      const brotli = brotliCompress(new TextEncoder().encode(compressed));
      return {
        type: 'full',
        encoding: 'brotli',
        data: brotli
      };
    }

    return {
      type: 'full',
      encoding: 'json',
      data: compressed
    };
  }

  private minifyHTML(html: string): string {
    return html
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/> </g, '><') // Remove spaces between tags
      .replace(/<(\w+)([^>]*?)\/>/g, '<$1$2>') // Self-closing to normal
      .replace(/<(meta|link|input|img|br|hr)([^>]*?)>/g, '<$1$2/>') // Add self-closing
      .trim();
  }

  private findMatchingTemplate(html: string): any {
    // Simple template matching - in production would use proper parsing
    for (const [id, template] of this.templates) {
      const regex = template
        .replace(/{{(\w+)}}/g, '(.+?)')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const match = html.match(new RegExp(regex));
      if (match) {
        const placeholders = [...template.matchAll(/{{(\w+)}}/g)].map(m => m[1]);
        const data: any = {};
        placeholders.forEach((key, i) => {
          data[key] = match[i + 1];
        });
        return { id, data, styles: [1, 2], scripts: [1] };
      }
    }
    return null;
  }

  private applyDictionaryCompression(text: string): string {
    let compressed = text;
    
    // Replace dictionary terms with tokens
    for (const [term, id] of this.dictionary) {
      const token = `\x01${String.fromCharCode(id)}\x02`;
      compressed = compressed.replace(new RegExp(term, 'gi'), token);
    }
    
    return compressed;
  }

  decompressHTML(payload: CompressedPayload): string {
    switch (payload.type) {
      case 'template':
        return this.expandTemplate(payload);
      
      case 'delta':
        return this.applyDelta(payload);
      
      case 'full':
        if (payload.encoding === 'brotli') {
          const decompressed = brotliDecompress(payload.data as Uint8Array);
          return this.expandDictionary(new TextDecoder().decode(decompressed));
        }
        return this.expandDictionary(payload.data as string);
      
      case 'binary':
        return this.parseBinary(payload.data as Uint8Array);
      
      default:
        throw new Error(`Unknown payload type: ${payload.type}`);
    }
  }

  private expandTemplate(payload: CompressedPayload): string {
    const template = this.templates.get(payload.template!);
    if (!template) throw new Error(`Template ${payload.template} not found`);
    
    let html = template;
    const data = payload.data as any;
    
    for (const [key, value] of Object.entries(data)) {
      html = html.replace(`{{${key}}}`, value as string);
    }
    
    // Add styles
    if (payload.styles) {
      const styles = payload.styles.map(id => this.styles.get(id)).join('');
      html = html.replace('{{styles}}', styles);
    }
    
    return html;
  }

  private applyDelta(payload: CompressedPayload): string {
    // Would implement JSON Patch or similar
    throw new Error('Delta compression not yet implemented');
  }

  private expandDictionary(text: string): string {
    let expanded = text;
    
    // Replace tokens with dictionary terms
    const tokenRegex = /\x01(.)\x02/g;
    expanded = expanded.replace(tokenRegex, (match, char) => {
      const id = char.charCodeAt(0);
      return this.reverseDictionary.get(id) || match;
    });
    
    return expanded;
  }

  private parseBinary(data: Uint8Array): string {
    const view = new DataView(data.buffer);
    let offset = 0;
    let html = '';
    
    while (offset < data.length) {
      const type = view.getUint8(offset++);
      const length = view.getUint16(offset, true);
      offset += 2;
      
      const chunk = data.slice(offset, offset + length);
      offset += length;
      
      switch (type) {
        case 0x01: // HTML fragment
          html += new TextDecoder().decode(chunk);
          break;
        case 0x02: // JSON data
          const json = JSON.parse(new TextDecoder().decode(chunk));
          html += this.expandTemplate({ type: 'template', ...json } as any);
          break;
        case 0x03: // Style reference
          const styleId = view.getUint16(offset - length, true);
          html += `<style>${this.styles.get(styleId)}</style>`;
          break;
        case 0x04: // Script reference
          const scriptId = view.getUint16(offset - length, true);
          html += `<script>${this.scripts.get(scriptId)}</script>`;
          break;
      }
    }
    
    return html;
  }

  compressCSS(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/:\s+/g, ':') // Remove space after colon
      .replace(/;\s+/g, ';') // Remove space after semicolon
      .replace(/\{\s+/g, '{') // Remove space after brace
      .replace(/\s+\}/g, '}') // Remove space before brace
      .replace(/;\}/g, '}') // Remove last semicolon
      .trim();
  }

  compressJS(js: string): string {
    // Basic minification - in production would use proper minifier
    return js
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([=+\-*\/%&|^!<>?:,;{}()\[\]])\s*/g, '$1') // Remove spaces around operators
      .trim();
  }

  // Generate atomic CSS classes
  generateAtomicCSS(): Map<string, string> {
    const atomic = new Map<string, string>();
    
    // Margin/Padding
    for (let i = 0; i <= 10; i++) {
      atomic.set(`m${i}`, `margin:${i}px`);
      atomic.set(`p${i}`, `padding:${i}px`);
      atomic.set(`mt${i}`, `margin-top:${i}px`);
      atomic.set(`mb${i}`, `margin-bottom:${i}px`);
      atomic.set(`ml${i}`, `margin-left:${i}px`);
      atomic.set(`mr${i}`, `margin-right:${i}px`);
    }
    
    // Text alignment
    atomic.set('tl', 'text-align:left');
    atomic.set('tc', 'text-align:center');
    atomic.set('tr', 'text-align:right');
    
    // Display
    atomic.set('db', 'display:block');
    atomic.set('di', 'display:inline');
    atomic.set('dib', 'display:inline-block');
    atomic.set('dn', 'display:none');
    atomic.set('df', 'display:flex');
    
    // Flexbox
    atomic.set('fdr', 'flex-direction:row');
    atomic.set('fdc', 'flex-direction:column');
    atomic.set('jcc', 'justify-content:center');
    atomic.set('aic', 'align-items:center');
    
    // Colors (ham radio theme)
    atomic.set('cg', 'color:#0f0'); // Green
    atomic.set('cc', 'color:#0ff'); // Cyan
    atomic.set('cy', 'color:#ff0'); // Yellow
    atomic.set('cr', 'color:#f00'); // Red
    atomic.set('bgb', 'background:#000'); // Black
    atomic.set('bgd', 'background:#111'); // Dark
    
    return atomic;
  }

  // Bandwidth-adaptive compression
  selectCompressionLevel(bandwidth: number, size: number): 'full' | 'medium' | 'minimal' {
    const transferTime = (size * 8) / bandwidth;
    
    if (transferTime < 5) return 'full';
    if (transferTime < 30) return 'medium';
    return 'minimal';
  }

  // Create minimal page representation
  createMinimalPage(title: string, content: string): string {
    return JSON.stringify({
      t: 1, // Template ID
      d: {
        title: this.compressDictionaryText(title),
        content: this.compressDictionaryText(content)
      },
      s: [1] // Style IDs
    });
  }

  private compressDictionaryText(text: string): any {
    const words = text.split(' ');
    const compressed: any[] = [];
    
    for (const word of words) {
      const id = this.dictionary.get(word.toLowerCase());
      compressed.push(id !== undefined ? id : word);
    }
    
    return compressed;
  }
}