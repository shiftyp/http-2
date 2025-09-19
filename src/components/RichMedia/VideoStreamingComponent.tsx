/**
 * Video Streaming Component
 *
 * React component for video streaming with bandwidth optimization
 * and radio transmission compatibility.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RichMediaManager, MediaMetadata, PlaybackState, StreamingQuality } from '../../lib/rich-media/index.js';
import { Card } from '../ui/Card.js';

export interface VideoStreamingProps {
  mediaManager: RichMediaManager;
  bandwidth?: number; // Available bandwidth in kbps
  radioMode?: boolean; // Optimize for radio transmission
  onBandwidthUpdate?: (requirement: number) => void;
  className?: string;
}

export interface VideoUploadOptions {
  maxResolution: { width: number; height: number };
  maxBitrate: number; // kbps
  targetFileSize: number; // bytes
  compressionLevel: 'STANDARD' | 'AGGRESSIVE' | 'ULTRA';
}

export const VideoStreamingComponent: React.FC<VideoStreamingProps> = ({
  mediaManager,
  bandwidth = 256,
  radioMode = true,
  onBandwidthUpdate,
  className = ''
}) => {
  const [videos, setVideos] = useState<MediaMetadata[]>([]);
  const [currentVideo, setCurrentVideo] = useState<MediaMetadata | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [streamingQuality, setStreamingQuality] = useState<StreamingQuality>('ADAPTIVE');
  const [bandwidthUsage, setBandwidthUsage] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load existing videos on mount
  useEffect(() => {
    const loadVideos = () => {
      const allMedia = mediaManager.getAllMedia();
      const videoMedia = allMedia.filter(media => media.type === 'VIDEO');
      setVideos(videoMedia);
    };

    loadVideos();

    // Listen for media uploads
    const handleMediaUpload = (event: CustomEvent) => {
      const { metadata } = event.detail;
      if (metadata.type === 'VIDEO') {
        setVideos(prev => [...prev, metadata]);
      }
    };

    mediaManager.addEventListener('media-uploaded', handleMediaUpload);
    return () => mediaManager.removeEventListener('media-uploaded', handleMediaUpload);
  }, [mediaManager]);

  // Listen for streaming events
  useEffect(() => {
    const handleStreamingProgress = (event: CustomEvent) => {
      const { mediaId, playbackState: newState } = event.detail;
      if (currentVideo && currentVideo.id === mediaId) {
        setPlaybackState(newState);
        setBandwidthUsage(newState.bandwidth);

        if (onBandwidthUpdate) {
          onBandwidthUpdate(newState.bandwidth);
        }
      }
    };

    const handleQualityChange = (event: CustomEvent) => {
      const { mediaId, quality, bandwidth: newBandwidth } = event.detail;
      if (currentVideo && currentVideo.id === mediaId) {
        setStreamingQuality(quality);
        setBandwidthUsage(newBandwidth);
      }
    };

    mediaManager.addEventListener('streaming-progress', handleStreamingProgress);
    mediaManager.addEventListener('quality-changed', handleQualityChange);

    return () => {
      mediaManager.removeEventListener('streaming-progress', handleStreamingProgress);
      mediaManager.removeEventListener('quality-changed', handleQualityChange);
    };
  }, [currentVideo, mediaManager, onBandwidthUpdate]);

  const getRadioOptimizedUploadOptions = (): VideoUploadOptions => {
    return {
      maxResolution: bandwidth < 128 ? { width: 320, height: 240 } : { width: 480, height: 360 },
      maxBitrate: Math.min(bandwidth * 0.8, 256), // Use 80% of available bandwidth
      targetFileSize: radioMode ? 1024 * 1024 : 10 * 1024 * 1024, // 1MB for radio, 10MB otherwise
      compressionLevel: radioMode ? 'AGGRESSIVE' : 'STANDARD'
    };
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    setError('');
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadOptions = getRadioOptimizedUploadOptions();

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const metadata = await mediaManager.uploadMedia(file, {
        compressionLevel: uploadOptions.compressionLevel,
        targetBandwidth: uploadOptions.maxBitrate,
        radioMode,
        maxFileSize: uploadOptions.targetFileSize,
        allowedFormats: ['video/mp4', 'video/webm', 'video/avi', 'video/mov']
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      console.log(`Video uploaded: ${metadata.title}`);
      console.log(`Original size: ${(metadata.originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Compressed size: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Compression ratio: ${((1 - metadata.fileSize / metadata.originalSize) * 100).toFixed(1)}%`);

      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

    } catch (error) {
      console.error('Video upload failed:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startVideoStreaming = async (video: MediaMetadata) => {
    try {
      setCurrentVideo(video);
      setError('');

      // Calculate bandwidth requirement
      const requirement = mediaManager.calculateBandwidthRequirement(video.id, streamingQuality);
      if (requirement > bandwidth) {
        setError(`Video requires ${requirement} kbps but only ${bandwidth} kbps available`);
        return;
      }

      await mediaManager.startStreaming(video.id, streamingQuality);

      if (onBandwidthUpdate) {
        onBandwidthUpdate(requirement);
      }

    } catch (error) {
      console.error('Failed to start video streaming:', error);
      setError(error instanceof Error ? error.message : 'Streaming failed');
    }
  };

  const stopVideoStreaming = () => {
    if (currentVideo) {
      mediaManager.stopStreaming(currentVideo.id);
      setCurrentVideo(null);
      setPlaybackState(null);
      setBandwidthUsage(0);

      if (onBandwidthUpdate) {
        onBandwidthUpdate(0);
      }
    }
  };

  const changeStreamingQuality = (quality: StreamingQuality) => {
    setStreamingQuality(quality);
    if (currentVideo) {
      // Restart streaming with new quality
      mediaManager.stopStreaming(currentVideo.id);
      setTimeout(() => {
        mediaManager.startStreaming(currentVideo.id, quality);
      }, 100);
    }
  };

  const deleteVideo = (videoId: string) => {
    if (currentVideo && currentVideo.id === videoId) {
      stopVideoStreaming();
    }
    mediaManager.deleteMedia(videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityColor = (quality: StreamingQuality): string => {
    switch (quality) {
      case 'LOW': return 'text-yellow-600';
      case 'MEDIUM': return 'text-blue-600';
      case 'HIGH': return 'text-green-600';
      case 'ADAPTIVE': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`video-streaming-component ${className}`}>
      <Card className="mb-4">
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Video Streaming</h3>

          {/* Upload Section */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={isUploading}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Upload Video'}
              </button>

              {radioMode && (
                <span className="text-sm text-gray-600">
                  Radio Mode: Max {formatFileSize(getRadioOptimizedUploadOptions().targetFileSize)}
                </span>
              )}
            </div>

            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm mt-2">{error}</div>
            )}
          </div>

          {/* Current Streaming */}
          {currentVideo && playbackState && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{currentVideo.title}</h4>
                <button
                  onClick={stopVideoStreaming}
                  className="text-red-600 hover:text-red-800"
                >
                  Stop
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span>{formatDuration(playbackState.currentTime)} / {formatDuration(playbackState.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Buffered:</span>
                  <span>{playbackState.buffered.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality:</span>
                  <span className={getQualityColor(streamingQuality)}>{streamingQuality}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bandwidth:</span>
                  <span>{bandwidthUsage.toFixed(1)} kbps</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(playbackState.currentTime / playbackState.duration) * 100}%` }}
                />
              </div>

              {/* Quality controls */}
              <div className="flex gap-2 mt-3">
                {(['LOW', 'MEDIUM', 'HIGH', 'ADAPTIVE'] as StreamingQuality[]).map(quality => (
                  <button
                    key={quality}
                    onClick={() => changeStreamingQuality(quality)}
                    className={`px-2 py-1 text-xs rounded ${
                      streamingQuality === quality
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    {quality}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video Library */}
          <div>
            <h4 className="font-medium mb-2">Video Library ({videos.length})</h4>

            {videos.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No videos uploaded yet
              </div>
            ) : (
              <div className="space-y-2">
                {videos.map(video => (
                  <div key={video.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{video.title}</div>
                      <div className="text-sm text-gray-600">
                        {formatFileSize(video.fileSize)} • {formatDuration(video.duration || 0)}
                        {video.resolution && (
                          <span> • {video.resolution.width}×{video.resolution.height}</span>
                        )}
                        {video.bitrate && (
                          <span> • {video.bitrate} kbps</span>
                        )}
                      </div>
                      {video.radioOptimized && (
                        <div className="text-xs text-green-600">Radio Optimized</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startVideoStreaming(video)}
                        disabled={currentVideo?.id === video.id}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {currentVideo?.id === video.id ? 'Playing' : 'Play'}
                      </button>
                      <button
                        onClick={() => deleteVideo(video.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bandwidth Info */}
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Available Bandwidth:</span>
                <span className="font-medium">{bandwidth} kbps</span>
              </div>
              <div className="flex justify-between">
                <span>Current Usage:</span>
                <span className="font-medium">{bandwidthUsage.toFixed(1)} kbps</span>
              </div>
              <div className="flex justify-between">
                <span>Remaining:</span>
                <span className="font-medium">{(bandwidth - bandwidthUsage).toFixed(1)} kbps</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VideoStreamingComponent;