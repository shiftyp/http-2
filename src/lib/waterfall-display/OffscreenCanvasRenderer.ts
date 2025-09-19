/**
 * Offscreen Canvas Renderer
 * Worker-based rendering for improved performance
 */

import type { DisplayBuffer } from './models/DisplayBuffer.js';
import type { WaterfallConfiguration } from './models/WaterfallConfiguration.js';

export class OffscreenCanvasRenderer {
  private worker: Worker | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private config: WaterfallConfiguration | null = null;
  private isInitialized = false;
  private renderQueue: DisplayBuffer[] = [];
  private isProcessing = false;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    // Check for OffscreenCanvas support
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas not supported');
    }

    // Create offscreen canvas
    this.offscreenCanvas = canvas.transferControlToOffscreen();

    // Create and configure worker
    await this.createWorker();

    this.isInitialized = true;
  }

  private async createWorker(): Promise<void> {
    const workerCode = `
      let gl = null;
      let program = null;
      let vertexBuffer = null;
      let dataTexture = null;
      let colormapTexture = null;
      let config = null;

      const vertexShaderSource = \`#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texCoord = a_texCoord;
        }
      \`;

      const fragmentShaderSource = \`#version 300 es
        precision highp float;
        uniform sampler2D u_dataTexture;
        uniform sampler2D u_colormapTexture;
        uniform float u_minDb;
        uniform float u_maxDb;
        in vec2 v_texCoord;
        out vec4 outColor;
        void main() {
          float spectrumValue = texture(u_dataTexture, v_texCoord).r;
          float normalizedValue = clamp((spectrumValue - u_minDb) / (u_maxDb - u_minDb), 0.0, 1.0);
          vec4 color = texture(u_colormapTexture, vec2(normalizedValue, 0.5));
          outColor = color;
        }
      \`;

      function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error('Shader compilation failed: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
      }

      function initializeWebGL(canvas) {
        gl = canvas.getContext('webgl2');
        if (!gl) throw new Error('WebGL2 not supported in worker');

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error('Shader program link failed');
        }

        // Create quad geometry
        const vertices = new Float32Array([
          -1.0, -1.0,  0.0, 1.0,
           1.0, -1.0,  1.0, 1.0,
          -1.0,  1.0,  0.0, 0.0,
           1.0,  1.0,  1.0, 0.0
        ]);

        vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Create textures
        dataTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, dataTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        colormapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colormapTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.disable(gl.DEPTH_TEST);
      }

      function renderFrame(displayBuffer) {
        if (!gl || !program) return false;

        try {
          // Update data texture
          gl.bindTexture(gl.TEXTURE_2D, dataTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, displayBuffer.width, displayBuffer.height, 0, gl.RED, gl.FLOAT, displayBuffer.data);

          // Clear and render
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(program);

          // Set uniforms
          gl.uniform1f(gl.getUniformLocation(program, 'u_minDb'), config.minDb);
          gl.uniform1f(gl.getUniformLocation(program, 'u_maxDb'), config.maxDb);

          // Bind textures
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dataTexture);
          gl.uniform1i(gl.getUniformLocation(program, 'u_dataTexture'), 0);

          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, colormapTexture);
          gl.uniform1i(gl.getUniformLocation(program, 'u_colormapTexture'), 1);

          // Draw
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          return true;
        } catch (error) {
          self.postMessage({ type: 'error', error: error.message });
          return false;
        }
      }

      self.onmessage = function(e) {
        const { type, data } = e.data;

        switch (type) {
          case 'initialize':
            try {
              initializeWebGL(data.canvas);
              self.postMessage({ type: 'initialized' });
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message });
            }
            break;

          case 'configure':
            config = data.config;
            if (gl && config) {
              gl.viewport(0, 0, config.width, config.height);

              // Update colormap texture
              const colormapData = generateColormapData(config.colormap);
              gl.bindTexture(gl.TEXTURE_2D, colormapTexture);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colormapData);
            }
            self.postMessage({ type: 'configured' });
            break;

          case 'render':
            const success = renderFrame(data.displayBuffer);
            self.postMessage({ type: 'rendered', success });
            break;

          case 'cleanup':
            if (gl) {
              if (program) gl.deleteProgram(program);
              if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
              if (dataTexture) gl.deleteTexture(dataTexture);
              if (colormapTexture) gl.deleteTexture(colormapTexture);
            }
            self.postMessage({ type: 'cleaned' });
            break;
        }
      };

      function generateColormapData(colormap) {
        const size = 256;
        const data = new Uint8Array(size * 4);

        for (let i = 0; i < size; i++) {
          const t = i / (size - 1);
          let r, g, b;

          if (colormap === 'viridis') {
            r = Math.max(0, Math.min(255, Math.round(255 * (0.267 + t * (1.246 * t * t - 2.162 * t + 1.165)))));
            g = Math.max(0, Math.min(255, Math.round(255 * (0.005 + t * (2.810 * t * t - 3.200 * t + 1.058)))));
            b = Math.max(0, Math.min(255, Math.round(255 * (0.329 + t * (2.449 * t * t - 5.359 * t + 2.268)))));
          } else {
            // Default grayscale
            r = g = b = Math.round(255 * t);
          }

          data[i * 4] = r;
          data[i * 4 + 1] = g;
          data[i * 4 + 2] = b;
          data[i * 4 + 3] = 255;
        }

        return data;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Failed to create worker'));
        return;
      }

      this.worker.onmessage = (e) => {
        const { type, error } = e.data;
        if (type === 'initialized') {
          resolve();
        } else if (type === 'error') {
          reject(new Error(error));
        }
      };

      this.worker.onerror = (error) => {
        reject(error);
      };

      // Initialize worker with offscreen canvas
      this.worker.postMessage({
        type: 'initialize',
        data: { canvas: this.offscreenCanvas }
      }, [this.offscreenCanvas]);
    });
  }

  async configure(config: WaterfallConfiguration): Promise<void> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('Offscreen renderer not initialized');
    }

    this.config = config;

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Configuration timeout'));
      }, 5000);

      this.worker.onmessage = (e) => {
        const { type, error } = e.data;
        clearTimeout(timeout);

        if (type === 'configured') {
          resolve();
        } else if (type === 'error') {
          reject(new Error(error));
        }
      };

      this.worker.postMessage({
        type: 'configure',
        data: { config }
      });
    });
  }

  async render(displayBuffer: DisplayBuffer): Promise<boolean> {
    if (!this.isInitialized || !this.worker || !this.config) {
      return false;
    }

    // Add to render queue
    this.renderQueue.push(displayBuffer);

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processRenderQueue();
    }

    return true;
  }

  private async processRenderQueue(): Promise<void> {
    if (this.isProcessing || this.renderQueue.length === 0 || !this.worker) {
      return;
    }

    this.isProcessing = true;

    while (this.renderQueue.length > 0) {
      const displayBuffer = this.renderQueue.shift()!;

      try {
        await this.renderFrame(displayBuffer);
      } catch (error) {
        console.error('Offscreen rendering failed:', error);
      }
    }

    this.isProcessing = false;
  }

  private renderFrame(displayBuffer: DisplayBuffer): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Render timeout'));
      }, 100); // 100ms timeout for 60 FPS target

      this.worker.onmessage = (e) => {
        const { type, success, error } = e.data;
        clearTimeout(timeout);

        if (type === 'rendered') {
          resolve(success);
        } else if (type === 'error') {
          reject(new Error(error));
        }
      };

      // Send render command with buffer data
      this.worker.postMessage({
        type: 'render',
        data: { displayBuffer: {
          width: displayBuffer.width,
          height: displayBuffer.height,
          data: displayBuffer.data
        }}
      });
    });
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      this.worker.postMessage({ type: 'cleanup' });
      this.worker.terminate();
      this.worker = null;
    }

    this.canvas = null;
    this.offscreenCanvas = null;
    this.config = null;
    this.renderQueue = [];
    this.isProcessing = false;
    this.isInitialized = false;
  }
}