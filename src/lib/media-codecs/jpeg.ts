/**
 * JPEG Encoder/Decoder
 * 
 * Progressive JPEG encoding for narrow-band transmission
 * with quality adaptation and progressive loading.
 */

import type { MediaCodec, EncodingOptions } from './index.js';

export class JPEGEncoder implements MediaCodec<ImageData | HTMLImageElement | Blob> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Encode image to JPEG
   */
  async encode(
    data: ImageData | HTMLImageElement | Blob,
    options: EncodingOptions = {}
  ): Promise<Uint8Array> {
    const {
      quality = 75,
      progressive = true,
      maxSize = Infinity
    } = options;

    // Load image data
    let imageData: ImageData;
    
    if (data instanceof ImageData) {
      imageData = data;
    } else if (data instanceof HTMLImageElement) {
      this.canvas.width = data.width;
      this.canvas.height = data.height;
      this.ctx.drawImage(data, 0, 0);
      imageData = this.ctx.getImageData(0, 0, data.width, data.height);
    } else if (data instanceof Blob) {
      const img = await this.blobToImage(data);
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx.drawImage(img, 0, 0);
      imageData = this.ctx.getImageData(0, 0, img.width, img.height);
    } else {
      throw new Error('Unsupported image data type');
    }

    // Apply resizing if needed for size constraint
    if (maxSize < Infinity) {
      imageData = await this.resizeForTarget(imageData, maxSize, quality);
    }

    // Encode to JPEG
    const encoded = await this.encodeJPEG(imageData, quality / 100, progressive);

    return new Uint8Array(encoded);
  }

  /**
   * Decode JPEG to ImageData
   */
  async decode(
    data: Uint8Array,
    options?: any
  ): Promise<ImageData> {
    const blob = new Blob([data], { type: 'image/jpeg' });
    const img = await this.blobToImage(blob);
    
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.ctx.drawImage(img, 0, 0);
    
    return this.ctx.getImageData(0, 0, img.width, img.height);
  }

  /**
   * Get media type
   */
  getMediaType(): string {
    return 'image/jpeg';
  }

  /**
   * Estimate encoded size
   */
  estimateSize(
    data: ImageData | HTMLImageElement | Blob,
    options?: EncodingOptions
  ): number {
    const quality = options?.quality || 75;
    let pixels = 0;

    if (data instanceof ImageData) {
      pixels = data.width * data.height;
    } else if (data instanceof HTMLImageElement) {
      pixels = data.width * data.height;
    } else if (data instanceof Blob) {
      // Rough estimate based on file size
      return data.size * (quality / 100);
    }

    // Rough JPEG size estimation
    // ~0.5-2 bytes per pixel depending on quality
    const bytesPerPixel = 0.5 + (1.5 * (quality / 100));
    return Math.floor(pixels * bytesPerPixel);
  }

  /**
   * Encode ImageData to JPEG bytes
   */
  private async encodeJPEG(
    imageData: ImageData,
    quality: number,
    progressive: boolean
  ): Promise<ArrayBuffer> {
    // Use canvas to encode
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.ctx.putImageData(imageData, 0, 0);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) => {
      this.canvas.toBlob(
        (blob) => resolve(blob!),
        'image/jpeg',
        quality
      );
    });

    // Convert to ArrayBuffer
    return blob.arrayBuffer();
  }

  /**
   * Resize image to meet size constraint
   */
  private async resizeForTarget(
    imageData: ImageData,
    maxSize: number,
    quality: number
  ): Promise<ImageData> {
    let scale = 1.0;
    let resized = imageData;

    // Binary search for optimal scale
    let low = 0.1;
    let high = 1.0;

    while (high - low > 0.05) {
      scale = (low + high) / 2;
      
      const width = Math.floor(imageData.width * scale);
      const height = Math.floor(imageData.height * scale);
      
      this.canvas.width = width;
      this.canvas.height = height;
      
      // Draw scaled image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(imageData, 0, 0);
      
      this.ctx.drawImage(tempCanvas, 0, 0, width, height);
      resized = this.ctx.getImageData(0, 0, width, height);
      
      // Estimate size
      const estimatedSize = this.estimateSize(resized, { quality });
      
      if (estimatedSize < maxSize) {
        low = scale;
      } else {
        high = scale;
      }
    }

    return resized;
  }

  /**
   * Convert Blob to HTMLImageElement
   */
  private async blobToImage(blob: Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}

/**
 * Progressive JPEG scanner for partial decoding
 */
export class ProgressiveJPEGScanner {
  private scans: Uint8Array[] = [];
  
  /**
   * Add scan data
   */
  addScan(data: Uint8Array): void {
    this.scans.push(data);
  }

  /**
   * Get current image from available scans
   */
  async getCurrentImage(): Promise<ImageData | null> {
    if (this.scans.length === 0) return null;

    // Concatenate available scans
    const totalLength = this.scans.reduce((sum, scan) => sum + scan.length, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const scan of this.scans) {
      combined.set(scan, offset);
      offset += scan.length;
    }

    try {
      const decoder = new JPEGEncoder();
      return await decoder.decode(combined);
    } catch {
      // Not enough data yet
      return null;
    }
  }

  /**
   * Clear scans
   */
  clear(): void {
    this.scans = [];
  }
}