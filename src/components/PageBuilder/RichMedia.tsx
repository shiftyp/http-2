/**
 * Rich Media Components
 *
 * Advanced multimedia components with WebAssembly codec support for
 * efficient compression and transmission over amateur radio networks.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

export enum MediaType {
  AUDIO = 'audio',
  VIDEO = 'video',
  IMAGE = 'image',
  ANIMATION = 'animation',
  INTERACTIVE = 'interactive'
}

export enum CodecType {
  // Audio codecs
  OPUS_ULTRA = 'opus-ultra',    // Ultra-low bitrate Opus
  CODEC2 = 'codec2',            // Open-source speech codec
  MELPE = 'melpe',              // Military Enhanced LPC

  // Video codecs
  AV1_ULTRA = 'av1-ultra',      // Ultra-low bitrate AV1
  H265_RADIO = 'h265-radio',    // H.265 optimized for radio
  DAALA = 'daala',              // Xiph.org experimental codec

  // Image codecs
  AVIF_ULTRA = 'avif-ultra',    // Ultra-compressed AVIF
  WEBP_RADIO = 'webp-radio',    // WebP optimized for radio
  JPEG_XL_TINY = 'jpeg-xl-tiny', // JPEG XL ultra-compressed

  // Animation codecs
  LOTTIE_WASM = 'lottie-wasm',  // Lottie with WASM compression
  SVG_ANIMATED = 'svg-animated', // Compressed animated SVG

  // Interactive codecs
  WASM_BINARY = 'wasm-binary',  // Raw WebAssembly binary
  JS_MINIFIED = 'js-minified'   // Minified JavaScript
}

export interface MediaMetadata {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration?: number;         // For audio/video in seconds
  dimensions?: {            // For image/video
    width: number;
    height: number;
  };
  sampleRate?: number;      // For audio
  channels?: number;        // For audio
  frameRate?: number;       // For video
  bandwidth: number;        // Required bandwidth in bytes/second
  transmissionTime: number; // Estimated transmission time in seconds
}

export interface RichMediaProps {
  type: MediaType;
  codec: CodecType;
  data: ArrayBuffer | string;
  metadata: MediaMetadata;
  fallbackContent?: string;  // Text fallback for bandwidth limits
  compressionLevel: number;  // 1-10 scale
  enableStreaming: boolean;  // Stream vs download
  cacheable: boolean;        // Can be cached for offline use
}

export interface MediaComponentProps {
  media: RichMediaProps;
  onCompressionChange?: (level: number) => void;
  onCodecChange?: (codec: CodecType) => void;
  onMetadataUpdate?: (metadata: MediaMetadata) => void;
  bandwidthLimit: number;    // Maximum allowed bandwidth
  transmissionMode: 'rf' | 'webrtc' | 'hybrid';
}

// WebAssembly codec interface
export interface WebAssemblyCodec {
  name: string;
  type: MediaType;
  wasmModule?: WebAssembly.Module;
  isLoaded: boolean;
  compress(data: ArrayBuffer, level: number): Promise<ArrayBuffer>;
  decompress(data: ArrayBuffer): Promise<ArrayBuffer>;
  getMetadata(data: ArrayBuffer): Promise<MediaMetadata>;
  estimateBandwidth(data: ArrayBuffer, mode: string): Promise<number>;
}

export const RichMediaComponent: React.FC<MediaComponentProps> = ({
  media,
  onCompressionChange,
  onCodecChange,
  onMetadataUpdate,
  bandwidthLimit,
  transmissionMode
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState(media.compressionLevel);
  const [selectedCodec, setSelectedCodec] = useState(media.codec);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Bandwidth validation
  const isWithinBandwidthLimit = media.metadata.bandwidth <= bandwidthLimit;
  const bandwidthStatus = isWithinBandwidthLimit ? 'valid' : 'exceeded';

  // Available codecs for each media type
  const getAvailableCodecs = (type: MediaType): CodecType[] => {
    switch (type) {
      case MediaType.AUDIO:
        return [CodecType.OPUS_ULTRA, CodecType.CODEC2, CodecType.MELPE];
      case MediaType.VIDEO:
        return [CodecType.AV1_ULTRA, CodecType.H265_RADIO, CodecType.DAALA];
      case MediaType.IMAGE:
        return [CodecType.AVIF_ULTRA, CodecType.WEBP_RADIO, CodecType.JPEG_XL_TINY];
      case MediaType.ANIMATION:
        return [CodecType.LOTTIE_WASM, CodecType.SVG_ANIMATED];
      case MediaType.INTERACTIVE:
        return [CodecType.WASM_BINARY, CodecType.JS_MINIFIED];
      default:
        return [];
    }
  };

  // Handle compression level change
  const handleCompressionChange = async (level: number) => {
    setCompressionLevel(level);
    setIsLoading(true);
    setError(null);

    try {
      // Simulate compression with WebAssembly codec
      const compressedData = await simulateCompression(media.data, level, selectedCodec);
      const newMetadata = await generateMetadata(compressedData, media.type);

      if (onCompressionChange) {
        onCompressionChange(level);
      }

      if (onMetadataUpdate) {
        onMetadataUpdate(newMetadata);
      }

      // Update preview
      await updatePreview(compressedData);

    } catch (err) {
      setError(`Compression failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle codec change
  const handleCodecChange = async (codec: CodecType) => {
    setSelectedCodec(codec);
    setIsLoading(true);
    setError(null);

    try {
      // Recompress with new codec
      const compressedData = await simulateCompression(media.data, compressionLevel, codec);
      const newMetadata = await generateMetadata(compressedData, media.type);

      if (onCodecChange) {
        onCodecChange(codec);
      }

      if (onMetadataUpdate) {
        onMetadataUpdate(newMetadata);
      }

      await updatePreview(compressedData);

    } catch (err) {
      setError(`Codec change failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulate WebAssembly compression
  const simulateCompression = async (
    data: ArrayBuffer | string,
    level: number,
    codec: CodecType
  ): Promise<ArrayBuffer> => {
    // Simulate compression delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Calculate compression ratio based on level and codec
    const baseRatio = getCompressionRatio(codec);
    const levelMultiplier = 0.5 + (level / 10) * 0.5; // 0.5 to 1.0
    const finalRatio = baseRatio * levelMultiplier;

    // Simulate compressed data (in reality this would use actual WASM codecs)
    const inputSize = typeof data === 'string' ?
      new TextEncoder().encode(data).length :
      data.byteLength;

    const compressedSize = Math.floor(inputSize * finalRatio);
    return new ArrayBuffer(compressedSize);
  };

  // Get compression ratio for different codecs
  const getCompressionRatio = (codec: CodecType): number => {
    switch (codec) {
      case CodecType.OPUS_ULTRA: return 0.05;    // 95% compression
      case CodecType.CODEC2: return 0.02;        // 98% compression
      case CodecType.AV1_ULTRA: return 0.08;     // 92% compression
      case CodecType.AVIF_ULTRA: return 0.15;    // 85% compression
      case CodecType.WEBP_RADIO: return 0.25;    // 75% compression
      case CodecType.LOTTIE_WASM: return 0.35;   // 65% compression
      case CodecType.WASM_BINARY: return 0.60;   // 40% compression
      default: return 0.50;                      // 50% compression
    }
  };

  // Generate metadata for compressed data
  const generateMetadata = async (
    compressedData: ArrayBuffer,
    type: MediaType
  ): Promise<MediaMetadata> => {
    const originalSize = typeof media.data === 'string' ?
      new TextEncoder().encode(media.data).length :
      media.data.byteLength;

    const compressedSize = compressedData.byteLength;
    const compressionRatio = originalSize / compressedSize;

    // Estimate bandwidth requirements based on transmission mode
    const baseBandwidth = compressedSize / (transmissionMode === 'rf' ? 2 : 8); // bytes/second
    const transmissionTime = compressedSize / baseBandwidth;

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      bandwidth: baseBandwidth,
      transmissionTime,
      dimensions: type === MediaType.IMAGE || type === MediaType.VIDEO ?
        { width: 320, height: 240 } : undefined,
      duration: type === MediaType.AUDIO || type === MediaType.VIDEO ? 10 : undefined,
      sampleRate: type === MediaType.AUDIO ? 16000 : undefined,
      channels: type === MediaType.AUDIO ? 1 : undefined,
      frameRate: type === MediaType.VIDEO ? 15 : undefined
    };
  };

  // Update preview based on media type
  const updatePreview = async (data: ArrayBuffer) => {
    switch (media.type) {
      case MediaType.IMAGE:
        // Convert ArrayBuffer to data URL for preview
        const blob = new Blob([data], { type: 'image/webp' });
        const url = URL.createObjectURL(blob);
        setPreviewData(url);
        break;

      case MediaType.AUDIO:
        // Create audio preview
        const audioBlob = new Blob([data], { type: 'audio/opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setPreviewData(audioUrl);
        break;

      case MediaType.VIDEO:
        // Create video preview
        const videoBlob = new Blob([data], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);
        setPreviewData(videoUrl);
        break;

      default:
        setPreviewData(null);
    }
  };

  // Initialize preview on mount
  useEffect(() => {
    updatePreview(media.data as ArrayBuffer);
  }, [media.data, media.type]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Rich Media: {media.type.charAt(0).toUpperCase() + media.type.slice(1)}
          </h3>
          <Badge
            variant={bandwidthStatus === 'valid' ? 'success' : 'danger'}
            className="ml-2"
          >
            {bandwidthStatus === 'valid' ? '✓ Bandwidth OK' : '⚠ Bandwidth Exceeded'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-900 bg-opacity-50 rounded border border-red-600">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Codec Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Codec</label>
            <Select
              value={selectedCodec}
              onChange={(e) => handleCodecChange(e.target.value as CodecType)}
              disabled={isLoading}
            >
              {getAvailableCodecs(media.type).map(codec => (
                <option key={codec} value={codec}>
                  {codec.toUpperCase().replace('-', ' ')}
                </option>
              ))}
            </Select>
          </div>

          {/* Compression Level */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Compression Level: {compressionLevel}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={compressionLevel}
              onChange={(e) => handleCompressionChange(parseInt(e.target.value))}
              disabled={isLoading}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Quality</span>
              <span>Compression</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="border border-gray-600 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-3">Preview</h4>

          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2">Processing...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Media Preview */}
              {media.type === MediaType.IMAGE && previewData && (
                <img
                  src={previewData}
                  alt="Media preview"
                  className="max-w-full h-auto rounded border border-gray-600"
                  style={{ maxHeight: '200px' }}
                />
              )}

              {media.type === MediaType.AUDIO && previewData && (
                <audio
                  ref={audioRef}
                  src={previewData}
                  controls
                  className="w-full"
                />
              )}

              {media.type === MediaType.VIDEO && previewData && (
                <video
                  ref={videoRef}
                  src={previewData}
                  controls
                  className="w-full rounded border border-gray-600"
                  style={{ maxHeight: '200px' }}
                />
              )}

              {/* Fallback Content */}
              {!previewData && media.fallbackContent && (
                <div className="p-3 bg-gray-800 rounded border border-gray-600">
                  <p className="text-sm text-gray-300">{media.fallbackContent}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400">Original Size</div>
            <div className="font-medium">{formatBytes(media.metadata.originalSize)}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400">Compressed</div>
            <div className="font-medium">{formatBytes(media.metadata.compressedSize)}</div>
          </div>

          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400">Ratio</div>
            <div className="font-medium">{media.metadata.compressionRatio.toFixed(1)}:1</div>
          </div>

          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400">TX Time</div>
            <div className="font-medium">{formatDuration(media.metadata.transmissionTime)}</div>
          </div>
        </div>

        {/* Advanced Metadata */}
        {(media.metadata.dimensions || media.metadata.duration) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {media.metadata.dimensions && (
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">Dimensions</div>
                <div className="font-medium">
                  {media.metadata.dimensions.width}×{media.metadata.dimensions.height}
                </div>
              </div>
            )}

            {media.metadata.duration && (
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">Duration</div>
                <div className="font-medium">{formatDuration(media.metadata.duration)}</div>
              </div>
            )}

            {media.metadata.sampleRate && (
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">Sample Rate</div>
                <div className="font-medium">{media.metadata.sampleRate / 1000}kHz</div>
              </div>
            )}

            {media.metadata.frameRate && (
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">Frame Rate</div>
                <div className="font-medium">{media.metadata.frameRate}fps</div>
              </div>
            )}
          </div>
        )}

        {/* Transmission Settings */}
        <div className="border-t border-gray-600 pt-4">
          <h4 className="text-sm font-medium mb-3">Transmission Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="streaming"
                checked={media.enableStreaming}
                className="rounded"
              />
              <label htmlFor="streaming" className="text-sm">Enable Streaming</label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cacheable"
                checked={media.cacheable}
                className="rounded"
              />
              <label htmlFor="cacheable" className="text-sm">Cache for Offline</label>
            </div>

            <div className="text-sm">
              <span className="text-gray-400">Mode: </span>
              <span className="font-medium">{transmissionMode.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RichMediaComponent;