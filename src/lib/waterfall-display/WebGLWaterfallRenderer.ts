/**
 * WebGL Waterfall Renderer
 * High-performance WebGL renderer for real-time waterfall display
 */

import type { DisplayBuffer } from './models/DisplayBuffer.js';
import type { WaterfallConfiguration } from './models/WaterfallConfiguration.js';

export class WebGLWaterfallRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private config: WaterfallConfiguration | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private dataTexture: WebGLTexture | null = null;
  private colormapTexture: WebGLTexture | null = null;
  private isInitialized = false;
  private animationFrameId: number | null = null;

  // Shader source code
  private readonly vertexShaderSource = `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;

    out vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

  private readonly fragmentShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D u_dataTexture;
    uniform sampler2D u_colormapTexture;
    uniform float u_minDb;
    uniform float u_maxDb;
    uniform vec2 u_resolution;
    uniform float u_time;

    in vec2 v_texCoord;
    out vec4 outColor;

    void main() {
      // Sample spectrum data
      float spectrumValue = texture(u_dataTexture, v_texCoord).r;

      // Normalize to [0, 1] range
      float normalizedValue = clamp((spectrumValue - u_minDb) / (u_maxDb - u_minDb), 0.0, 1.0);

      // Sample colormap
      vec4 color = texture(u_colormapTexture, vec2(normalizedValue, 0.5));

      outColor = color;
    }
  `;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    // Get WebGL2 context
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;

    // Initialize WebGL state
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Create shader program
    await this.createShaderProgram();

    // Create geometry
    this.createQuadGeometry();

    // Create textures
    this.createTextures();

    this.isInitialized = true;
  }

  private async createShaderProgram(): Promise<void> {
    if (!this.gl) throw new Error('WebGL context not available');

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderSource);

    this.program = this.gl.createProgram();
    if (!this.program) throw new Error('Failed to create shader program');

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(this.program);
      throw new Error(`Shader program link failed: ${info}`);
    }

    // Clean up shaders
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
  }

  private createShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error('WebGL context not available');

    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
  }

  private createQuadGeometry(): void {
    if (!this.gl || !this.program) throw new Error('WebGL not initialized');

    // Create full-screen quad
    const vertices = new Float32Array([
      // Position  TexCoord
      -1.0, -1.0,  0.0, 1.0,
       1.0, -1.0,  1.0, 1.0,
      -1.0,  1.0,  0.0, 0.0,
       1.0,  1.0,  1.0, 0.0
    ]);

    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    // Set up vertex attributes
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');

    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0);

    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
  }

  private createTextures(): void {
    if (!this.gl) throw new Error('WebGL context not available');

    // Create data texture for spectrum data
    this.dataTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    // Create colormap texture
    this.colormapTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.colormapTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  }

  async configure(config: WaterfallConfiguration): Promise<void> {
    if (!this.isInitialized || !this.gl || !this.canvas) {
      throw new Error('WebGL renderer not initialized');
    }

    this.config = config;

    // Resize canvas and viewport
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    this.gl.viewport(0, 0, config.width, config.height);

    // Update colormap texture
    await this.updateColormapTexture(config.colormap);
  }

  private async updateColormapTexture(colormap: string): Promise<void> {
    if (!this.gl || !this.colormapTexture) return;

    // Generate colormap data (simplified version)
    const colormapData = this.generateColormapData(colormap);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.colormapTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      256,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      colormapData
    );
  }

  private generateColormapData(colormap: string): Uint8Array {
    const size = 256;
    const data = new Uint8Array(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      const color = this.getColorFromMap(t, colormap);

      data[i * 4] = color[0];
      data[i * 4 + 1] = color[1];
      data[i * 4 + 2] = color[2];
      data[i * 4 + 3] = 255;
    }

    return data;
  }

  private getColorFromMap(t: number, colormap: string): [number, number, number] {
    // Simplified colormap implementation (same as CanvasRenderer)
    switch (colormap) {
      case 'viridis':
        const r = Math.max(0, Math.min(255, Math.round(255 * (0.267 + t * (1.246 * t * t - 2.162 * t + 1.165)))));
        const g = Math.max(0, Math.min(255, Math.round(255 * (0.005 + t * (2.810 * t * t - 3.200 * t + 1.058)))));
        const b = Math.max(0, Math.min(255, Math.round(255 * (0.329 + t * (2.449 * t * t - 5.359 * t + 2.268)))));
        return [r, g, b];
      case 'jet':
        let jr = 0, jg = 0, jb = 0;
        if (t < 0.125) {
          jb = 0.5 + 4 * t;
        } else if (t < 0.375) {
          jb = 1;
          jg = 4 * (t - 0.125);
        } else if (t < 0.625) {
          jb = 1 - 4 * (t - 0.375);
          jg = 1;
          jr = 4 * (t - 0.375);
        } else if (t < 0.875) {
          jg = 1 - 4 * (t - 0.625);
          jr = 1;
        } else {
          jr = 1 - 4 * (t - 0.875);
        }
        return [
          Math.round(255 * Math.max(0, Math.min(1, jr))),
          Math.round(255 * Math.max(0, Math.min(1, jg))),
          Math.round(255 * Math.max(0, Math.min(1, jb)))
        ];
      case 'grayscale':
        const intensity = Math.round(255 * t);
        return [intensity, intensity, intensity];
      default:
        // Default to viridis
        const dr = Math.max(0, Math.min(255, Math.round(255 * (0.267 + t * (1.246 * t * t - 2.162 * t + 1.165)))));
        const dg = Math.max(0, Math.min(255, Math.round(255 * (0.005 + t * (2.810 * t * t - 3.200 * t + 1.058)))));
        const db = Math.max(0, Math.min(255, Math.round(255 * (0.329 + t * (2.449 * t * t - 5.359 * t + 2.268)))));
        return [dr, dg, db];
    }
  }

  async render(displayBuffer: DisplayBuffer): Promise<boolean> {
    if (!this.isInitialized || !this.gl || !this.program || !this.config) {
      console.warn('WebGL renderer not properly initialized');
      return false;
    }

    try {
      // Update data texture with spectrum data
      this.updateDataTexture(displayBuffer);

      // Clear canvas
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      // Use shader program
      this.gl.useProgram(this.program);

      // Set uniforms
      this.setUniforms();

      // Bind textures
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture);
      this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_dataTexture'), 0);

      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.colormapTexture);
      this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'u_colormapTexture'), 1);

      // Check for WebGL errors before drawing
      let error = this.gl.getError();
      if (error !== this.gl.NO_ERROR) {
        console.error('WebGL error before draw:', error);
        return false;
      }

      // Draw quad
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      // Check for WebGL errors after drawing
      error = this.gl.getError();
      if (error !== this.gl.NO_ERROR) {
        console.error('WebGL error after draw:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('WebGL rendering failed:', error);
      return false;
    }
  }

  private updateDataTexture(displayBuffer: DisplayBuffer): void {
    if (!this.gl || !this.dataTexture) return;

    const { width, height, data } = displayBuffer;

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R32F,
      width,
      height,
      0,
      this.gl.RED,
      this.gl.FLOAT,
      data
    );
  }

  private setUniforms(): void {
    if (!this.gl || !this.program || !this.config) return;

    const minDbLocation = this.gl.getUniformLocation(this.program, 'u_minDb');
    const maxDbLocation = this.gl.getUniformLocation(this.program, 'u_maxDb');
    const resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
    const timeLocation = this.gl.getUniformLocation(this.program, 'u_time');

    this.gl.uniform1f(minDbLocation, this.config.minDb);
    this.gl.uniform1f(maxDbLocation, this.config.maxDb);
    this.gl.uniform2f(resolutionLocation, this.config.width, this.config.height);
    this.gl.uniform1f(timeLocation, performance.now() / 1000.0);
  }

  async cleanup(): Promise<void> {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.gl) {
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
        this.vertexBuffer = null;
      }
      if (this.dataTexture) {
        this.gl.deleteTexture(this.dataTexture);
        this.dataTexture = null;
      }
      if (this.colormapTexture) {
        this.gl.deleteTexture(this.colormapTexture);
        this.colormapTexture = null;
      }
    }

    this.canvas = null;
    this.gl = null;
    this.config = null;
    this.isInitialized = false;
  }
}