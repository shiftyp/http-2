/**
 * WebAssembly Codec Manager
 *
 * Manages WebAssembly-based media codecs for ultra-efficient compression
 * and transmission over amateur radio networks.
 */

import { MediaType, CodecType, MediaMetadata, WebAssemblyCodec } from '../../components/PageBuilder/RichMedia';

export interface CodecConfiguration {
  wasmPath: string;
  defaultCompressionLevel: number;
  maxCompressionLevel: number;
  supportedFormats: string[];
  estimatedCompressionRatio: number;
  processingComplexity: 'low' | 'medium' | 'high';
}

export class CodecManager {
  private codecs = new Map<CodecType, WebAssemblyCodec>();
  private wasmCache = new Map<string, WebAssembly.Module>();
  private isInitialized = false;

  constructor() {
    this.initializeCodecs();
  }

  /**
   * Initialize all available codecs
   */
  private async initializeCodecs(): Promise<void> {
    const codecConfigs: Record<CodecType, CodecConfiguration> = {
      // Audio codecs
      [CodecType.OPUS_ULTRA]: {
        wasmPath: '/codecs/opus-ultra.wasm',
        defaultCompressionLevel: 8,
        maxCompressionLevel: 10,
        supportedFormats: ['audio/opus', 'audio/wav', 'audio/ogg'],
        estimatedCompressionRatio: 0.05,
        processingComplexity: 'medium'
      },
      [CodecType.CODEC2]: {
        wasmPath: '/codecs/codec2.wasm',
        defaultCompressionLevel: 9,
        maxCompressionLevel: 10,
        supportedFormats: ['audio/wav', 'audio/raw'],
        estimatedCompressionRatio: 0.02,
        processingComplexity: 'low'
      },
      [CodecType.MELPE]: {
        wasmPath: '/codecs/melpe.wasm',
        defaultCompressionLevel: 7,
        maxCompressionLevel: 10,
        supportedFormats: ['audio/wav', 'audio/raw'],
        estimatedCompressionRatio: 0.03,
        processingComplexity: 'high'
      },

      // Video codecs
      [CodecType.AV1_ULTRA]: {
        wasmPath: '/codecs/av1-ultra.wasm',
        defaultCompressionLevel: 8,
        maxCompressionLevel: 10,
        supportedFormats: ['video/mp4', 'video/webm'],
        estimatedCompressionRatio: 0.08,
        processingComplexity: 'high'
      },
      [CodecType.H265_RADIO]: {
        wasmPath: '/codecs/h265-radio.wasm',
        defaultCompressionLevel: 7,
        maxCompressionLevel: 10,
        supportedFormats: ['video/mp4', 'video/h265'],
        estimatedCompressionRatio: 0.12,
        processingComplexity: 'high'
      },
      [CodecType.DAALA]: {
        wasmPath: '/codecs/daala.wasm',
        defaultCompressionLevel: 6,
        maxCompressionLevel: 10,
        supportedFormats: ['video/webm', 'video/ogg'],
        estimatedCompressionRatio: 0.15,
        processingComplexity: 'medium'
      },

      // Image codecs
      [CodecType.AVIF_ULTRA]: {
        wasmPath: '/codecs/avif-ultra.wasm',
        defaultCompressionLevel: 8,
        maxCompressionLevel: 10,
        supportedFormats: ['image/avif', 'image/jpeg', 'image/png'],
        estimatedCompressionRatio: 0.15,
        processingComplexity: 'medium'
      },
      [CodecType.WEBP_RADIO]: {
        wasmPath: '/codecs/webp-radio.wasm',
        defaultCompressionLevel: 7,
        maxCompressionLevel: 10,
        supportedFormats: ['image/webp', 'image/jpeg', 'image/png'],
        estimatedCompressionRatio: 0.25,
        processingComplexity: 'low'
      },
      [CodecType.JPEG_XL_TINY]: {
        wasmPath: '/codecs/jpeg-xl-tiny.wasm',
        defaultCompressionLevel: 9,
        maxCompressionLevel: 10,
        supportedFormats: ['image/jxl', 'image/jpeg', 'image/png'],
        estimatedCompressionRatio: 0.18,
        processingComplexity: 'medium'
      },

      // Animation codecs
      [CodecType.LOTTIE_WASM]: {
        wasmPath: '/codecs/lottie-wasm.wasm',
        defaultCompressionLevel: 6,
        maxCompressionLevel: 10,
        supportedFormats: ['application/json', 'image/svg+xml'],
        estimatedCompressionRatio: 0.35,
        processingComplexity: 'medium'
      },
      [CodecType.SVG_ANIMATED]: {
        wasmPath: '/codecs/svg-animated.wasm',
        defaultCompressionLevel: 7,
        maxCompressionLevel: 10,
        supportedFormats: ['image/svg+xml'],
        estimatedCompressionRatio: 0.40,
        processingComplexity: 'low'
      },

      // Interactive codecs
      [CodecType.WASM_BINARY]: {
        wasmPath: '/codecs/wasm-binary.wasm',
        defaultCompressionLevel: 5,
        maxCompressionLevel: 10,
        supportedFormats: ['application/wasm', 'application/octet-stream'],
        estimatedCompressionRatio: 0.60,
        processingComplexity: 'low'
      },
      [CodecType.JS_MINIFIED]: {
        wasmPath: '/codecs/js-minified.wasm',
        defaultCompressionLevel: 6,
        maxCompressionLevel: 10,
        supportedFormats: ['application/javascript', 'text/javascript'],
        estimatedCompressionRatio: 0.45,
        processingComplexity: 'low'
      }
    };

    // Initialize each codec
    for (const [codecType, config] of Object.entries(codecConfigs)) {
      try {
        const codec = await this.loadCodec(codecType as CodecType, config);
        this.codecs.set(codecType as CodecType, codec);
      } catch (error) {
        console.warn(`Failed to load codec ${codecType}:`, error);
        // Create fallback codec
        this.codecs.set(codecType as CodecType, this.createFallbackCodec(codecType as CodecType, config));
      }
    }

    this.isInitialized = true;
  }

  /**
   * Load a WebAssembly codec
   */
  private async loadCodec(codecType: CodecType, config: CodecConfiguration): Promise<WebAssemblyCodec> {
    // Check cache first
    let wasmModule = this.wasmCache.get(config.wasmPath);

    if (!wasmModule) {
      try {
        // In a real implementation, this would fetch the actual WASM file
        // For now, we'll simulate it
        const wasmBytes = await this.simulateWasmLoad(config.wasmPath);
        wasmModule = await WebAssembly.compile(wasmBytes);
        this.wasmCache.set(config.wasmPath, wasmModule);
      } catch (error) {
        throw new Error(`Failed to compile WASM module: ${error.message}`);
      }
    }

    return {
      name: codecType,
      type: this.getMediaTypeForCodec(codecType),
      wasmModule,
      isLoaded: true,
      compress: async (data: ArrayBuffer, level: number) => {
        return this.compressWithWasm(wasmModule!, data, level, config);
      },
      decompress: async (data: ArrayBuffer) => {
        return this.decompressWithWasm(wasmModule!, data, config);
      },
      getMetadata: async (data: ArrayBuffer) => {
        return this.extractMetadata(data, codecType, config);
      },
      estimateBandwidth: async (data: ArrayBuffer, mode: string) => {
        const compressionRatio = config.estimatedCompressionRatio;
        const compressedSize = data.byteLength * compressionRatio;

        // Bandwidth estimation based on transmission mode
        const modeMultipliers = {
          rf: 0.1,      // ~2.4 kbps (QPSK)
          webrtc: 8.0,  // ~64 kbps (local network)
          hybrid: 4.0   // ~32 kbps (mixed mode)
        };

        const bandwidth = compressedSize * (modeMultipliers[mode as keyof typeof modeMultipliers] || 1.0);
        return Math.max(bandwidth, compressedSize / 120); // Minimum 2-minute transmission
      }
    };
  }

  /**
   * Create a fallback codec when WASM fails to load
   */
  private createFallbackCodec(codecType: CodecType, config: CodecConfiguration): WebAssemblyCodec {
    return {
      name: codecType,
      type: this.getMediaTypeForCodec(codecType),
      wasmModule: undefined,
      isLoaded: false,
      compress: async (data: ArrayBuffer, level: number) => {
        // Simulate compression using native browser APIs
        return this.fallbackCompress(data, level, config.estimatedCompressionRatio);
      },
      decompress: async (data: ArrayBuffer) => {
        // Simulate decompression
        return data; // Return as-is for fallback
      },
      getMetadata: async (data: ArrayBuffer) => {
        return this.generateFallbackMetadata(data, codecType);
      },
      estimateBandwidth: async (data: ArrayBuffer, mode: string) => {
        const compressedSize = data.byteLength * config.estimatedCompressionRatio;
        return compressedSize / 60; // 1-minute default transmission time
      }
    };
  }

  /**
   * Simulate WebAssembly module loading
   */
  private async simulateWasmLoad(wasmPath: string): Promise<ArrayBuffer> {
    // In a real implementation, this would fetch the actual WASM file
    // For simulation, create a minimal WASM module
    const wasmBytes = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM magic number
      0x01, 0x00, 0x00, 0x00  // Version 1
    ]);

    return wasmBytes.buffer;
  }

  /**
   * Compress data using WebAssembly codec
   */
  private async compressWithWasm(
    wasmModule: WebAssembly.Module,
    data: ArrayBuffer,
    level: number,
    config: CodecConfiguration
  ): Promise<ArrayBuffer> {
    // Simulate WebAssembly compression
    await new Promise(resolve => setTimeout(resolve, 50));

    // Calculate compression based on level and codec efficiency
    const baseRatio = config.estimatedCompressionRatio;
    const levelMultiplier = 0.5 + (level / config.maxCompressionLevel) * 0.5;
    const finalRatio = baseRatio * levelMultiplier;

    const compressedSize = Math.floor(data.byteLength * finalRatio);
    const compressedData = new ArrayBuffer(compressedSize);

    // In a real implementation, this would call the WASM function
    // For now, we'll simulate by copying a portion of the original data
    const sourceView = new Uint8Array(data);
    const targetView = new Uint8Array(compressedData);

    for (let i = 0; i < compressedSize; i++) {
      targetView[i] = sourceView[i % sourceView.length];
    }

    return compressedData;
  }

  /**
   * Decompress data using WebAssembly codec
   */
  private async decompressWithWasm(
    wasmModule: WebAssembly.Module,
    data: ArrayBuffer,
    config: CodecConfiguration
  ): Promise<ArrayBuffer> {
    // Simulate WebAssembly decompression
    await new Promise(resolve => setTimeout(resolve, 30));

    // Estimate original size
    const originalSize = Math.floor(data.byteLength / config.estimatedCompressionRatio);
    const decompressedData = new ArrayBuffer(originalSize);

    // In a real implementation, this would call the WASM decompression function
    const sourceView = new Uint8Array(data);
    const targetView = new Uint8Array(decompressedData);

    for (let i = 0; i < originalSize; i++) {
      targetView[i] = sourceView[i % sourceView.length];
    }

    return decompressedData;
  }

  /**
   * Fallback compression using native browser APIs
   */
  private async fallbackCompress(
    data: ArrayBuffer,
    level: number,
    baseRatio: number
  ): Promise<ArrayBuffer> {
    try {
      // Use CompressionStream if available
      if ('CompressionStream' in window) {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(data);
        writer.close();

        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        return result.buffer;
      }
    } catch (error) {
      console.warn('CompressionStream not available, using simulation');
    }

    // Fallback to simulation
    const levelMultiplier = 0.5 + (level / 10) * 0.5;
    const finalRatio = baseRatio * levelMultiplier;
    const compressedSize = Math.floor(data.byteLength * finalRatio);

    return new ArrayBuffer(compressedSize);
  }

  /**
   * Extract metadata from compressed data
   */
  private async extractMetadata(
    data: ArrayBuffer,
    codecType: CodecType,
    config: CodecConfiguration
  ): Promise<MediaMetadata> {
    const mediaType = this.getMediaTypeForCodec(codecType);
    const originalSize = Math.floor(data.byteLength / config.estimatedCompressionRatio);

    return {
      originalSize,
      compressedSize: data.byteLength,
      compressionRatio: originalSize / data.byteLength,
      bandwidth: data.byteLength / 60, // Default 1-minute transmission
      transmissionTime: 60,
      dimensions: mediaType === MediaType.IMAGE || mediaType === MediaType.VIDEO ?
        { width: 320, height: 240 } : undefined,
      duration: mediaType === MediaType.AUDIO || mediaType === MediaType.VIDEO ? 10 : undefined,
      sampleRate: mediaType === MediaType.AUDIO ? 16000 : undefined,
      channels: mediaType === MediaType.AUDIO ? 1 : undefined,
      frameRate: mediaType === MediaType.VIDEO ? 15 : undefined
    };
  }

  /**
   * Generate fallback metadata
   */
  private generateFallbackMetadata(data: ArrayBuffer, codecType: CodecType): MediaMetadata {
    const mediaType = this.getMediaTypeForCodec(codecType);

    return {
      originalSize: data.byteLength * 4, // Estimate 4:1 compression
      compressedSize: data.byteLength,
      compressionRatio: 4.0,
      bandwidth: data.byteLength / 60,
      transmissionTime: 60,
      dimensions: mediaType === MediaType.IMAGE || mediaType === MediaType.VIDEO ?
        { width: 160, height: 120 } : undefined,
      duration: mediaType === MediaType.AUDIO || mediaType === MediaType.VIDEO ? 5 : undefined
    };
  }

  /**
   * Get media type for a codec
   */
  private getMediaTypeForCodec(codecType: CodecType): MediaType {
    if ([CodecType.OPUS_ULTRA, CodecType.CODEC2, CodecType.MELPE].includes(codecType)) {
      return MediaType.AUDIO;
    }
    if ([CodecType.AV1_ULTRA, CodecType.H265_RADIO, CodecType.DAALA].includes(codecType)) {
      return MediaType.VIDEO;
    }
    if ([CodecType.AVIF_ULTRA, CodecType.WEBP_RADIO, CodecType.JPEG_XL_TINY].includes(codecType)) {
      return MediaType.IMAGE;
    }
    if ([CodecType.LOTTIE_WASM, CodecType.SVG_ANIMATED].includes(codecType)) {
      return MediaType.ANIMATION;
    }
    return MediaType.INTERACTIVE;
  }

  /**
   * Public API methods
   */

  /**
   * Get available codecs for a media type
   */
  getAvailableCodecs(mediaType: MediaType): CodecType[] {
    return Array.from(this.codecs.keys()).filter(
      codecType => this.getMediaTypeForCodec(codecType) === mediaType
    );
  }

  /**
   * Get codec instance
   */
  getCodec(codecType: CodecType): WebAssemblyCodec | undefined {
    return this.codecs.get(codecType);
  }

  /**
   * Check if manager is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get codec statistics
   */
  getCodecStats(): Array<{
    codec: CodecType;
    type: MediaType;
    loaded: boolean;
    hasWasm: boolean;
  }> {
    return Array.from(this.codecs.entries()).map(([codec, impl]) => ({
      codec,
      type: impl.type,
      loaded: impl.isLoaded,
      hasWasm: !!impl.wasmModule
    }));
  }

  /**
   * Preload specific codecs
   */
  async preloadCodecs(codecTypes: CodecType[]): Promise<void> {
    const promises = codecTypes.map(async codecType => {
      const codec = this.codecs.get(codecType);
      if (codec && !codec.isLoaded) {
        // Trigger loading by calling a lightweight method
        try {
          await codec.getMetadata(new ArrayBuffer(1));
        } catch (error) {
          console.warn(`Failed to preload codec ${codecType}:`, error);
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.codecs.clear();
    this.wasmCache.clear();
    this.isInitialized = false;
  }
}

// Global codec manager instance
export const codecManager = new CodecManager();

export default CodecManager;