/**
 * Opus Audio Encoder/Decoder
 * 
 * Low-bitrate audio codec optimized for voice over narrow-band.
 * Uses Web Audio API for encoding/decoding.
 */

import type { MediaCodec, EncodingOptions } from './index.js';

export class OpusEncoder implements MediaCodec<AudioBuffer | Float32Array[]> {
  private audioContext: AudioContext;
  private sampleRate = 8000; // 8 kHz for narrow-band
  private channels = 1;      // Mono for efficiency

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
  }

  /**
   * Encode audio to Opus
   */
  async encode(
    data: AudioBuffer | Float32Array[],
    options: EncodingOptions = {}
  ): Promise<Uint8Array> {
    const {
      quality = 16,  // Bitrate in kbps
      maxSize = Infinity
    } = options;

    // Convert to AudioBuffer if needed
    let audioBuffer: AudioBuffer;
    
    if (data instanceof AudioBuffer) {
      audioBuffer = data;
    } else {
      audioBuffer = this.arrayToAudioBuffer(data);
    }

    // Resample if needed
    if (audioBuffer.sampleRate !== this.sampleRate) {
      audioBuffer = await this.resample(audioBuffer, this.sampleRate);
    }

    // Convert to mono if stereo
    if (audioBuffer.numberOfChannels > 1) {
      audioBuffer = this.toMono(audioBuffer);
    }

    // Encode using WebCodecs API if available, fallback to WAV
    const encoded = await this.encodeOpus(audioBuffer, quality * 1000);

    // Apply compression if over size limit
    if (encoded.length > maxSize) {
      return await this.reduceQuality(audioBuffer, maxSize, quality);
    }

    return encoded;
  }

  /**
   * Decode Opus to AudioBuffer
   */
  async decode(
    data: Uint8Array,
    options?: any
  ): Promise<AudioBuffer> {
    // Try WebCodecs API first
    if ('AudioDecoder' in window) {
      return await this.decodeWithWebCodecs(data);
    }

    // Fallback to Web Audio API
    return await this.decodeWithWebAudio(data);
  }

  /**
   * Get media type
   */
  getMediaType(): string {
    return 'audio/opus';
  }

  /**
   * Estimate encoded size
   */
  estimateSize(
    data: AudioBuffer | Float32Array[],
    options?: EncodingOptions
  ): number {
    const bitrate = (options?.quality || 16) * 1000; // bits per second
    let duration = 0;

    if (data instanceof AudioBuffer) {
      duration = data.duration;
    } else {
      // Assume 8kHz sample rate
      duration = data[0].length / this.sampleRate;
    }

    return Math.floor((bitrate * duration) / 8); // Convert to bytes
  }

  /**
   * Encode AudioBuffer to Opus
   */
  private async encodeOpus(
    audioBuffer: AudioBuffer,
    bitrate: number
  ): Promise<Uint8Array> {
    // Use WebCodecs API if available
    if ('AudioEncoder' in window) {
      return await this.encodeWithWebCodecs(audioBuffer, bitrate);
    }

    // Fallback to WAV format
    return this.encodeWAV(audioBuffer);
  }

  /**
   * Encode using WebCodecs API
   */
  private async encodeWithWebCodecs(
    audioBuffer: AudioBuffer,
    bitrate: number
  ): Promise<Uint8Array> {
    const encoder = new (window as any).AudioEncoder({
      output: (chunk: any) => {
        // Collect encoded chunks
      },
      error: (e: Error) => {
        console.error('Encoding error:', e);
      }
    });

    await encoder.configure({
      codec: 'opus',
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      bitrate
    });

    // Create AudioData from AudioBuffer
    const audioData = new (window as any).AudioData({
      format: 'f32',
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      numberOfFrames: audioBuffer.length,
      timestamp: 0,
      data: audioBuffer.getChannelData(0)
    });

    encoder.encode(audioData);
    await encoder.flush();
    encoder.close();

    // Return collected chunks (simplified)
    return new Uint8Array(0); // Placeholder
  }

  /**
   * Decode using WebCodecs API
   */
  private async decodeWithWebCodecs(
    data: Uint8Array
  ): Promise<AudioBuffer> {
    // Simplified placeholder
    return this.audioContext.createBuffer(1, this.sampleRate, this.sampleRate);
  }

  /**
   * Decode using Web Audio API
   */
  private async decodeWithWebAudio(
    data: Uint8Array
  ): Promise<AudioBuffer> {
    const arrayBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    );
    
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Fallback WAV encoder
   */
  private encodeWAV(audioBuffer: AudioBuffer): Uint8Array {
    const length = audioBuffer.length * audioBuffer.numberOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels: Float32Array[] = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // RIFF identifier
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length
    setUint32(0x45564157); // "WAVE"

    // Format chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16);          // chunk length
    setUint16(1);           // PCM
    setUint16(audioBuffer.numberOfChannels);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * audioBuffer.numberOfChannels); // byte rate
    setUint16(audioBuffer.numberOfChannels * 2); // block align
    setUint16(16); // bits per sample

    // Data chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // Write interleaved samples
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        const sample = Math.max(-1, Math.min(1, channels[i][offset]));
        view.setInt16(pos, sample * 0x7FFF, true);
        pos += 2;
      }
      offset++;
    }

    return new Uint8Array(buffer);
  }

  /**
   * Convert array to AudioBuffer
   */
  private arrayToAudioBuffer(data: Float32Array[]): AudioBuffer {
    const length = data[0].length;
    const buffer = this.audioContext.createBuffer(
      data.length,
      length,
      this.sampleRate
    );

    for (let channel = 0; channel < data.length; channel++) {
      buffer.copyToChannel(data[channel], channel);
    }

    return buffer;
  }

  /**
   * Resample audio buffer
   */
  private async resample(
    audioBuffer: AudioBuffer,
    targetRate: number
  ): Promise<AudioBuffer> {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.duration * targetRate,
      targetRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    return await offlineContext.startRendering();
  }

  /**
   * Convert to mono
   */
  private toMono(audioBuffer: AudioBuffer): AudioBuffer {
    if (audioBuffer.numberOfChannels === 1) return audioBuffer;

    const mono = this.audioContext.createBuffer(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const output = mono.getChannelData(0);
    
    // Mix all channels
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const input = audioBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        output[i] += input[i] / audioBuffer.numberOfChannels;
      }
    }

    return mono;
  }

  /**
   * Reduce quality to meet size constraint
   */
  private async reduceQuality(
    audioBuffer: AudioBuffer,
    maxSize: number,
    currentQuality: number
  ): Promise<Uint8Array> {
    // Try progressively lower bitrates
    const bitrates = [12, 8, 6, 4]; // kbps
    
    for (const bitrate of bitrates) {
      if (bitrate >= currentQuality) continue;
      
      const encoded = await this.encodeOpus(audioBuffer, bitrate * 1000);
      if (encoded.length <= maxSize) {
        return encoded;
      }
    }

    // If still too large, truncate
    const ratio = maxSize / this.estimateSize(audioBuffer, { quality: 4 });
    const samples = Math.floor(audioBuffer.length * ratio);
    
    const truncated = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      samples,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const source = audioBuffer.getChannelData(channel);
      const dest = truncated.getChannelData(channel);
      dest.set(source.subarray(0, samples));
    }

    return await this.encodeOpus(truncated, 4000);
  }
}