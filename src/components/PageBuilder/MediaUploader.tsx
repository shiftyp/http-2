/**
 * Media Uploader Component
 *
 * Handles file uploads with automatic codec selection and compression
 * for amateur radio transmission optimization.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { MediaType, CodecType, RichMediaProps, MediaMetadata } from './RichMedia';
import { codecManager } from '../../lib/media-codecs/CodecManager';

interface MediaUploaderProps {
  onMediaProcessed: (media: RichMediaProps) => void;
  bandwidthLimit: number;
  transmissionMode: 'rf' | 'webrtc' | 'hybrid';
  allowedTypes?: MediaType[];
  maxFileSize?: number; // in bytes
}

interface ProcessingState {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  error?: string;
}

interface FileAnalysis {
  file: File;
  detectedType: MediaType;
  recommendedCodec: CodecType;
  estimatedCompressionRatio: number;
  sizeAfterCompression: number;
  willExceedBandwidth: boolean;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onMediaProcessed,
  bandwidthLimit,
  transmissionMode,
  allowedTypes = [MediaType.AUDIO, MediaType.VIDEO, MediaType.IMAGE, MediaType.ANIMATION],
  maxFileSize = 50 * 1024 * 1024 // 50MB default
}) => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    currentStep: '',
    progress: 0
  });
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [selectedCodec, setSelectedCodec] = useState<CodecType | null>(null);
  const [compressionLevel, setCompressionLevel] = useState(7);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File type detection
  const detectMediaType = (file: File): MediaType => {
    const mimeType = file.type.toLowerCase();

    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('image/')) {
      // Check for animated formats
      if (mimeType.includes('gif') || file.name.toLowerCase().includes('animated')) {
        return MediaType.ANIMATION;
      }
      return MediaType.IMAGE;
    }
    if (mimeType.includes('json') && file.name.toLowerCase().includes('lottie')) {
      return MediaType.ANIMATION;
    }
    if (mimeType.includes('javascript') || mimeType.includes('wasm')) {
      return MediaType.INTERACTIVE;
    }
    if (mimeType.includes('svg')) {
      return MediaType.ANIMATION;
    }

    // Fallback based on file extension
    const extension = file.name.toLowerCase().split('.').pop();
    switch (extension) {
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
      case 'm4a':
        return MediaType.AUDIO;
      case 'mp4':
      case 'webm':
      case 'avi':
      case 'mov':
        return MediaType.VIDEO;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
      case 'avif':
        return MediaType.IMAGE;
      case 'gif':
      case 'svg':
      case 'lottie':
        return MediaType.ANIMATION;
      case 'js':
      case 'wasm':
        return MediaType.INTERACTIVE;
      default:
        return MediaType.IMAGE; // Default fallback
    }
  };

  // Recommend optimal codec for file and transmission mode
  const recommendCodec = (mediaType: MediaType, fileSize: number): CodecType => {
    const availableCodecs = codecManager.getAvailableCodecs(mediaType);

    if (availableCodecs.length === 0) {
      throw new Error(`No codecs available for ${mediaType}`);
    }

    // Select codec based on transmission mode and file size
    switch (mediaType) {
      case MediaType.AUDIO:
        if (transmissionMode === 'rf') {
          return CodecType.CODEC2; // Highest compression for RF
        } else if (fileSize > 1024 * 1024) { // > 1MB
          return CodecType.OPUS_ULTRA;
        } else {
          return CodecType.MELPE;
        }

      case MediaType.VIDEO:
        if (transmissionMode === 'rf') {
          return CodecType.AV1_ULTRA; // Best compression for RF
        } else {
          return CodecType.H265_RADIO;
        }

      case MediaType.IMAGE:
        if (transmissionMode === 'rf') {
          return CodecType.AVIF_ULTRA; // Maximum compression
        } else if (fileSize > 512 * 1024) { // > 512KB
          return CodecType.JPEG_XL_TINY;
        } else {
          return CodecType.WEBP_RADIO;
        }

      case MediaType.ANIMATION:
        return fileSize > 100 * 1024 ? CodecType.LOTTIE_WASM : CodecType.SVG_ANIMATED;

      case MediaType.INTERACTIVE:
        return CodecType.WASM_BINARY;

      default:
        return availableCodecs[0];
    }
  };

  // Analyze uploaded file
  const analyzeFile = async (file: File): Promise<FileAnalysis> => {
    const detectedType = detectMediaType(file);

    if (!allowedTypes.includes(detectedType)) {
      throw new Error(`File type ${detectedType} is not allowed`);
    }

    const recommendedCodec = recommendCodec(detectedType, file.size);
    const codec = codecManager.getCodec(recommendedCodec);

    if (!codec) {
      throw new Error(`Codec ${recommendedCodec} not available`);
    }

    // Get file data for analysis
    const arrayBuffer = await file.arrayBuffer();
    const estimatedBandwidth = await codec.estimateBandwidth(arrayBuffer, transmissionMode);

    // Estimate compression
    const estimatedCompressionRatio = 0.8; // Conservative estimate
    const sizeAfterCompression = file.size * estimatedCompressionRatio;
    const willExceedBandwidth = estimatedBandwidth > bandwidthLimit;

    return {
      file,
      detectedType,
      recommendedCodec,
      estimatedCompressionRatio,
      sizeAfterCompression,
      willExceedBandwidth
    };
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize) {
      setProcessingState({
        isProcessing: false,
        currentStep: '',
        progress: 0,
        error: `File size (${formatBytes(file.size)}) exceeds maximum allowed size (${formatBytes(maxFileSize)})`
      });
      return;
    }

    setProcessingState({
      isProcessing: true,
      currentStep: 'Analyzing file...',
      progress: 10,
      error: undefined
    });

    try {
      const analysis = await analyzeFile(file);
      setFileAnalysis(analysis);
      setSelectedCodec(analysis.recommendedCodec);

      setProcessingState({
        isProcessing: false,
        currentStep: 'Analysis complete',
        progress: 100
      });
    } catch (error) {
      setProcessingState({
        isProcessing: false,
        currentStep: '',
        progress: 0,
        error: error.message
      });
    }
  }, [maxFileSize, allowedTypes, bandwidthLimit, transmissionMode]);

  // Process and compress file
  const processFile = async () => {
    if (!fileAnalysis || !selectedCodec) return;

    setProcessingState({
      isProcessing: true,
      currentStep: 'Loading codec...',
      progress: 10
    });

    try {
      const codec = codecManager.getCodec(selectedCodec);
      if (!codec) {
        throw new Error(`Codec ${selectedCodec} not available`);
      }

      setProcessingState({
        isProcessing: true,
        currentStep: 'Reading file...',
        progress: 20
      });

      const arrayBuffer = await fileAnalysis.file.arrayBuffer();

      setProcessingState({
        isProcessing: true,
        currentStep: 'Compressing...',
        progress: 40
      });

      const compressedData = await codec.compress(arrayBuffer, compressionLevel);

      setProcessingState({
        isProcessing: true,
        currentStep: 'Generating metadata...',
        progress: 70
      });

      const metadata = await codec.getMetadata(compressedData);

      setProcessingState({
        isProcessing: true,
        currentStep: 'Finalizing...',
        progress: 90
      });

      // Create fallback content
      const fallbackContent = `${fileAnalysis.file.name} (${formatBytes(metadata.compressedSize)})`;

      const richMedia: RichMediaProps = {
        type: fileAnalysis.detectedType,
        codec: selectedCodec,
        data: compressedData,
        metadata,
        fallbackContent,
        compressionLevel,
        enableStreaming: metadata.compressedSize > 100 * 1024, // Enable streaming for files > 100KB
        cacheable: true
      };

      setProcessingState({
        isProcessing: false,
        currentStep: 'Complete',
        progress: 100
      });

      onMediaProcessed(richMedia);

      // Reset state
      setFileAnalysis(null);
      setSelectedCodec(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setProcessingState({
        isProcessing: false,
        currentStep: '',
        progress: 0,
        error: `Processing failed: ${error.message}`
      });
    }
  };

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get available codecs for current file type
  const getAvailableCodecs = (): CodecType[] => {
    if (!fileAnalysis) return [];
    return codecManager.getAvailableCodecs(fileAnalysis.detectedType);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Media Upload</h3>
          <Badge variant="outline">
            Limit: {formatBytes(bandwidthLimit)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error Display */}
        {processingState.error && (
          <Alert variant="error">
            <p>{processingState.error}</p>
          </Alert>
        )}

        {/* File Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Media File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            disabled={processingState.isProcessing}
            accept={allowedTypes.map(type => {
              switch (type) {
                case MediaType.AUDIO: return 'audio/*';
                case MediaType.VIDEO: return 'video/*';
                case MediaType.IMAGE: return 'image/*';
                case MediaType.ANIMATION: return 'image/gif,image/svg+xml,.lottie';
                case MediaType.INTERACTIVE: return '.js,.wasm';
                default: return '*/*';
              }
            }).join(',')}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-1">
            Max size: {formatBytes(maxFileSize)} |
            Allowed: {allowedTypes.join(', ')} |
            Mode: {transmissionMode.toUpperCase()}
          </p>
        </div>

        {/* Processing Progress */}
        {processingState.isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{processingState.currentStep}</span>
              <span>{processingState.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${processingState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* File Analysis */}
        {fileAnalysis && !processingState.isProcessing && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">File Analysis</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">File:</span>
                  <div className="font-medium">{fileAnalysis.file.name}</div>
                </div>
                <div>
                  <span className="text-gray-400">Size:</span>
                  <div className="font-medium">{formatBytes(fileAnalysis.file.size)}</div>
                </div>
                <div>
                  <span className="text-gray-400">Type:</span>
                  <div className="font-medium">{fileAnalysis.detectedType}</div>
                </div>
                <div>
                  <span className="text-gray-400">After Compression:</span>
                  <div className="font-medium">{formatBytes(fileAnalysis.sizeAfterCompression)}</div>
                </div>
              </div>

              {fileAnalysis.willExceedBandwidth && (
                <Alert variant="warning" className="mt-3">
                  <p>File may exceed bandwidth limit after compression. Consider higher compression or different codec.</p>
                </Alert>
              )}
            </div>

            {/* Codec Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Codec</label>
                <select
                  value={selectedCodec || ''}
                  onChange={(e) => setSelectedCodec(e.target.value as CodecType)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                >
                  {getAvailableCodecs().map(codec => (
                    <option key={codec} value={codec}>
                      {codec.toUpperCase().replace('-', ' ')}
                      {codec === fileAnalysis.recommendedCodec ? ' (Recommended)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Compression Level: {compressionLevel}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Quality</span>
                  <span>Compression</span>
                </div>
              </div>
            </div>

            {/* Process Button */}
            <div className="flex justify-end">
              <Button
                onClick={processFile}
                disabled={!selectedCodec || processingState.isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                Process & Add to Page
              </Button>
            </div>
          </div>
        )}

        {/* Upload Instructions */}
        {!fileAnalysis && !processingState.isProcessing && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-4">📁</div>
            <p className="text-lg mb-2">Select a media file to upload</p>
            <p className="text-sm">
              Files will be automatically compressed using the optimal codec for {transmissionMode.toUpperCase()} transmission
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MediaUploader;