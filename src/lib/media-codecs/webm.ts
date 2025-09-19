/**
 * WebM Video Encoder/Decoder
 * 
 * VP8/VP9 video encoding for narrow-band transmission
 * with keyframe optimization and adaptive quality.
 */

import type { MediaCodec, EncodingOptions } from './index.js';

export interface VideoFrame {
  width: number;
  height: number;
  timestamp: number;
  data: ImageData | HTMLCanvasElement | HTMLVideoElement;
}

export class WebMEncoder implements MediaCodec<VideoFrame[] | Blob> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Encode video to WebM
   */
  async encode(
    data: VideoFrame[] | Blob,
    options: EncodingOptions = {}
  ): Promise<Uint8Array> {
    const {
      quality = 30,  // Target bitrate in kbps
      maxSize = Infinity
    } = options;

    // Handle blob input (existing video)
    if (data instanceof Blob) {
      return await this.reencodeVideo(data, quality, maxSize);
    }

    // Encode frames
    return await this.encodeFrames(data, quality, maxSize);
  }

  /**
   * Decode WebM to frames
   */
  async decode(
    data: Uint8Array,
    options?: any
  ): Promise<VideoFrame[]> {
    const blob = new Blob([data], { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = async () => {
        const frames = await this.extractFrames(video);
        URL.revokeObjectURL(url);
        resolve(frames);
      };
      video.onerror = reject;
      video.src = url;
    });
  }

  /**
   * Get media type
   */
  getMediaType(): string {
    return 'video/webm';
  }

  /**
   * Estimate encoded size
   */
  estimateSize(
    data: VideoFrame[] | Blob,
    options?: EncodingOptions
  ): number {
    const bitrate = (options?.quality || 30) * 1000; // bits per second
    
    if (data instanceof Blob) {
      // Use existing size as estimate
      return data.size * (bitrate / 100000); // Rough scaling
    }

    // Calculate from frames
    const duration = data.length / 10; // Assume 10 fps
    return Math.floor((bitrate * duration) / 8);
  }

  /**
   * Encode frames to WebM
   */
  private async encodeFrames(
    frames: VideoFrame[],
    bitrate: number,
    maxSize: number
  ): Promise<Uint8Array> {
    if (frames.length === 0) {
      return new Uint8Array(0);
    }

    // Determine output dimensions
    const { width, height } = this.getOptimalDimensions(
      frames[0].width,
      frames[0].height,
      bitrate
    );

    // Use MediaRecorder API if available
    if ('MediaRecorder' in window && MediaRecorder.isTypeSupported('video/webm')) {
      return await this.encodeWithMediaRecorder(frames, width, height, bitrate * 1000);
    }

    // Fallback to frame sequence
    return await this.encodeFrameSequence(frames, width, height);
  }

  /**
   * Encode using MediaRecorder API
   */
  private async encodeWithMediaRecorder(
    frames: VideoFrame[],
    width: number,
    height: number,
    bitrate: number
  ): Promise<Uint8Array> {
    this.canvas.width = width;
    this.canvas.height = height;

    const stream = this.canvas.captureStream(10); // 10 fps
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: bitrate
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        resolve(new Uint8Array(arrayBuffer));
      };

      // Start recording
      recorder.start();

      // Draw frames
      let frameIndex = 0;
      const drawFrame = () => {
        if (frameIndex >= frames.length) {
          recorder.stop();
          return;
        }

        const frame = frames[frameIndex++];
        this.drawFrame(frame, width, height);

        setTimeout(drawFrame, 100); // 10 fps
      };

      drawFrame();
    });
  }

  /**
   * Fallback frame sequence encoder
   */
  private async encodeFrameSequence(
    frames: VideoFrame[],
    width: number,
    height: number
  ): Promise<Uint8Array> {
    // Simplified: encode key frames as JPEG sequence
    const keyframeInterval = 10;
    const encoded: Uint8Array[] = [];

    for (let i = 0; i < frames.length; i++) {
      if (i % keyframeInterval === 0) {
        // Encode keyframe
        this.canvas.width = width;
        this.canvas.height = height;
        this.drawFrame(frames[i], width, height);
        
        const blob = await new Promise<Blob>((resolve) => {
          this.canvas.toBlob(
            (blob) => resolve(blob!),
            'image/jpeg',
            0.7
          );
        });
        
        const arrayBuffer = await blob.arrayBuffer();
        encoded.push(new Uint8Array(arrayBuffer));
      }
    }

    // Concatenate frames (simplified container)
    const totalLength = encoded.reduce((sum, frame) => sum + frame.length + 4, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const frame of encoded) {
      // Write frame size
      const view = new DataView(result.buffer, offset, 4);
      view.setUint32(0, frame.length, true);
      offset += 4;
      
      // Write frame data
      result.set(frame, offset);
      offset += frame.length;
    }

    return result;
  }

  /**
   * Draw frame to canvas
   */
  private drawFrame(
    frame: VideoFrame,
    width: number,
    height: number
  ): void {
    if (frame.data instanceof ImageData) {
      this.ctx.putImageData(frame.data, 0, 0);
    } else if (frame.data instanceof HTMLCanvasElement) {
      this.ctx.drawImage(frame.data, 0, 0, width, height);
    } else if (frame.data instanceof HTMLVideoElement) {
      this.ctx.drawImage(frame.data, 0, 0, width, height);
    }
  }

  /**
   * Re-encode existing video
   */
  private async reencodeVideo(
    blob: Blob,
    targetBitrate: number,
    maxSize: number
  ): Promise<Uint8Array> {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = async () => {
        const frames = await this.extractFrames(video);
        URL.revokeObjectURL(url);
        
        // Re-encode at target bitrate
        const encoded = await this.encodeFrames(frames, targetBitrate, maxSize);
        resolve(encoded);
      };
      video.onerror = reject;
      video.src = url;
    });
  }

  /**
   * Extract frames from video
   */
  private async extractFrames(video: HTMLVideoElement): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];
    const fps = 10;
    const duration = video.duration;
    const frameCount = Math.floor(duration * fps);

    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;

    for (let i = 0; i < frameCount; i++) {
      video.currentTime = i / fps;
      
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });

      this.ctx.drawImage(video, 0, 0);
      const imageData = this.ctx.getImageData(
        0, 0,
        this.canvas.width,
        this.canvas.height
      );

      frames.push({
        width: this.canvas.width,
        height: this.canvas.height,
        timestamp: i / fps,
        data: imageData
      });
    }

    return frames;
  }

  /**
   * Get optimal dimensions for bitrate
   */
  private getOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    bitrate: number
  ): { width: number; height: number } {
    // Target pixels based on bitrate
    const pixelsPerKbps = 2000; // Rough estimate
    const targetPixels = bitrate * pixelsPerKbps;
    const originalPixels = originalWidth * originalHeight;

    if (originalPixels <= targetPixels) {
      return { width: originalWidth, height: originalHeight };
    }

    // Scale down
    const scale = Math.sqrt(targetPixels / originalPixels);
    const width = Math.floor(originalWidth * scale / 2) * 2; // Even number
    const height = Math.floor(originalHeight * scale / 2) * 2;

    return { width, height };
  }
}

/**
 * Keyframe extractor for efficient transmission
 */
export class KeyframeExtractor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Extract keyframes from video
   */
  async extractKeyframes(
    video: HTMLVideoElement | Blob,
    interval: number = 2 // seconds
  ): Promise<VideoFrame[]> {
    let videoElement: HTMLVideoElement;
    let url: string | null = null;

    if (video instanceof Blob) {
      url = URL.createObjectURL(video);
      videoElement = document.createElement('video');
      videoElement.src = url;
      await new Promise((resolve) => {
        videoElement.onloadedmetadata = resolve;
      });
    } else {
      videoElement = video;
    }

    const keyframes: VideoFrame[] = [];
    const duration = videoElement.duration;
    
    for (let time = 0; time < duration; time += interval) {
      videoElement.currentTime = time;
      
      await new Promise((resolve) => {
        videoElement.onseeked = resolve;
      });

      this.canvas.width = videoElement.videoWidth;
      this.canvas.height = videoElement.videoHeight;
      this.ctx.drawImage(videoElement, 0, 0);
      
      const imageData = this.ctx.getImageData(
        0, 0,
        this.canvas.width,
        this.canvas.height
      );

      keyframes.push({
        width: this.canvas.width,
        height: this.canvas.height,
        timestamp: time,
        data: imageData
      });
    }

    if (url) {
      URL.revokeObjectURL(url);
    }

    return keyframes;
  }
}