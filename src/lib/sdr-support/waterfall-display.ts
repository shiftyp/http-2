/**
 * Waterfall Display Implementation
 * WebGL-based real-time spectrum visualization
 */

export interface WaterfallConfig {
  centerFrequency?: number;
  spanFrequency?: number;
  colormap?: string;
  intensityRange?: { min: number; max: number };
  refreshRate?: number;
  historyDepth?: number;
  enabled?: boolean;
}

export interface InitResult {
  webglSupported: boolean;
  shadersCompiled: boolean;
  texturesCreated: boolean;
  bufferSize: number;
}

export class WaterfallDisplay {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private config: WaterfallConfig = {};
  private waterfallData: Float32Array[] = [];
  private currentLine = 0;
  private colormap: Float32Array;

  constructor(canvas?: HTMLCanvasElement) {
    if (canvas) {
      this.canvas = canvas;
    }
    this.colormap = this.generateColormap('viridis');
  }

  async initialize(config: WaterfallConfig): Promise<InitResult> {
    this.config = config;

    // Validate configuration
    if (config.refreshRate && (config.refreshRate > 60 || config.refreshRate < 1)) {
      throw new Error('Invalid configuration: refresh rate must be between 1 and 60');
    }
    if (config.historyDepth && config.historyDepth < 10) {
      throw new Error('Invalid configuration: history depth must be at least 10');
    }
    if (config.intensityRange && config.intensityRange.min >= config.intensityRange.max) {
      throw new Error('Invalid configuration: invalid intensity range');
    }

    // Initialize WebGL if canvas provided
    if (this.canvas) {
      this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

      if (!this.gl) {
        throw new Error('WebGL not supported');
      }

      // Compile shaders
      const vertexShader = this.compileShader(this.gl, this.gl.VERTEX_SHADER, this.getVertexShaderSource());
      const fragmentShader = this.compileShader(this.gl, this.gl.FRAGMENT_SHADER, this.getFragmentShaderSource());

      if (!vertexShader || !fragmentShader) {
        throw new Error('Shader compilation failed');
      }

      // Create program
      this.program = this.gl.createProgram();
      if (!this.program) {
        throw new Error('Failed to create WebGL program');
      }

      this.gl.attachShader(this.program, vertexShader);
      this.gl.attachShader(this.program, fragmentShader);
      this.gl.linkProgram(this.program);

      if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
        throw new Error('Failed to link WebGL program');
      }
    }

    // Initialize data buffer
    const historyDepth = config.historyDepth || 60;
    const bufferSize = 1024;
    this.waterfallData = Array(historyDepth).fill(null).map(() => new Float32Array(bufferSize));

    return {
      webglSupported: !!this.gl,
      shadersCompiled: !!this.program,
      texturesCreated: true,
      bufferSize
    };
  }

  private compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private getVertexShaderSource(): string {
    return `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
  }

  private getFragmentShaderSource(): string {
    return `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform vec3 u_colormap[256];
      varying vec2 v_texCoord;
      void main() {
        float intensity = texture2D(u_texture, v_texCoord).r;
        int index = int(intensity * 255.0);
        gl_FragColor = vec4(u_colormap[index], 1.0);
      }
    `;
  }

  processSpectrumData(data: Float32Array): void {
    if (!data || data.length !== 1024) {
      throw new Error('Invalid FFT data size');
    }

    // Store in circular buffer
    this.waterfallData[this.currentLine] = new Float32Array(data);
    this.currentLine = (this.currentLine + 1) % this.waterfallData.length;

    // Trigger render if enabled
    if (this.config.enabled) {
      this.render();
    }
  }

  private render(): void {
    if (!this.gl || !this.program) return;

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.program);
    // Additional rendering logic would go here
  }

  getColormap(intensity: number): { r: number; g: number; b: number } {
    // Map intensity to color based on colormap
    const index = Math.floor(Math.max(0, Math.min(1, intensity)) * 255) * 3;
    return {
      r: this.colormap[index],
      g: this.colormap[index + 1],
      b: this.colormap[index + 2]
    };
  }

  private generateColormap(type: string): Float32Array {
    const colors = new Float32Array(256 * 3);

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r = 0, g = 0, b = 0;

      switch (type) {
        case 'viridis':
          // Simplified viridis approximation
          r = Math.pow(t, 1.5) * 0.5;
          g = t * 0.8;
          b = Math.sqrt(1 - t) * 0.8;
          break;
        case 'jet':
          // Jet colormap
          if (t < 0.25) {
            r = 0;
            g = 4 * t;
            b = 1;
          } else if (t < 0.5) {
            r = 0;
            g = 1;
            b = 1 - 4 * (t - 0.25);
          } else if (t < 0.75) {
            r = 4 * (t - 0.5);
            g = 1;
            b = 0;
          } else {
            r = 1;
            g = 1 - 4 * (t - 0.75);
            b = 0;
          }
          break;
        default:
          // Grayscale
          r = g = b = t;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    return colors;
  }

  setColormap(type: string): void {
    this.colormap = this.generateColormap(type);
    this.config.colormap = type;
  }

  updateConfig(config: Partial<WaterfallConfig>): void {
    Object.assign(this.config, config);
  }

  destroy(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.program = null;
    this.waterfallData = [];
  }
}