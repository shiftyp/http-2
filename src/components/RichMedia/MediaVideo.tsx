/**
 * Media Video Component (T029)
 * 
 * WebM video playback with keyframe optimization,
 * adaptive quality, and bandwidth-aware streaming.
 */

import React, { useState, useEffect, useRef } from 'react';
import { mediaCache } from '../../lib/media-cache/index.js';
import { WebMEncoder, KeyframeExtractor } from '../../lib/media-codecs/webm.js';

export interface MediaVideoProps {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  quality?: number;
  keyframeOnly?: boolean;
  maxBitrate?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

interface VideoState {
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  duration: number;
  currentTime: number;
  buffered: number;
  quality: string;
  bitrate: number;
  error?: Error;
}

export const MediaVideo: React.FC<MediaVideoProps> = ({
  src,
  poster,
  width,
  height,
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  quality = 30,
  keyframeOnly = false,
  maxBitrate = 100,
  onPlay,
  onPause,
  onEnded,
  onError,
  onProgress
}) => {
  const [state, setState] = useState<VideoState>({
    status: 'idle',
    duration: 0,
    currentTime: 0,
    buffered: 0,
    quality: 'auto',
    bitrate: 0
  });

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [keyframes, setKeyframes] = useState<string[]>([]);
  const [currentKeyframe, setCurrentKeyframe] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const encoder = useRef(new WebMEncoder());
  const extractor = useRef(new KeyframeExtractor());

  /**
   * Load video from cache or network
   */
  const loadVideo = async () => {
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      // Check cache first
      const cached = await mediaCache.get(src);
      
      if (cached) {
        const blob = new Blob([cached.data], { type: cached.mimeType });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        
        if (keyframeOnly) {
          await extractKeyframes(blob);
        }
        
        setState(prev => ({ ...prev, status: 'ready' }));
        return;
      }

      // Load from network
      await loadFromNetwork();
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error as Error
      }));
      onError?.(error as Error);
    }
  };

  /**
   * Load video from network
   */
  const loadFromNetwork = async () => {
    const response = await fetch(src);
    const blob = await response.blob();

    // Optimize for bandwidth if needed
    if (blob.size > maxBitrate * 1000) {
      const optimized = await optimizeVideo(blob);
      const url = URL.createObjectURL(optimized);
      setVideoUrl(url);
      
      if (keyframeOnly) {
        await extractKeyframes(optimized);
      }
    } else {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      
      if (keyframeOnly) {
        await extractKeyframes(blob);
      }
    }

    setState(prev => ({ ...prev, status: 'ready' }));

    // Cache for future use
    const arrayBuffer = await blob.arrayBuffer();
    await mediaCache.store(src, new Uint8Array(arrayBuffer), blob.type);
  };

  /**
   * Optimize video for bandwidth
   */
  const optimizeVideo = async (blob: Blob): Promise<Blob> => {
    // Re-encode at lower bitrate
    const encoded = await encoder.current.encode(blob, {
      quality,
      maxSize: maxBitrate * 1000
    });
    
    return new Blob([encoded], { type: 'video/webm' });
  };

  /**
   * Extract keyframes for low-bandwidth mode
   */
  const extractKeyframes = async (blob: Blob) => {
    const frames = await extractor.current.extractKeyframes(blob, 2); // Every 2 seconds
    
    // Convert frames to images
    const keyframeUrls: string[] = [];
    
    for (const frame of frames) {
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx && frame.data instanceof ImageData) {
        ctx.putImageData(frame.data, 0, 0);
        
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
        });
        
        const url = URL.createObjectURL(blob);
        keyframeUrls.push(url);
      }
    }
    
    setKeyframes(keyframeUrls);
  };

  /**
   * Play video or keyframe slideshow
   */
  const play = () => {
    if (keyframeOnly && keyframes.length > 0) {
      // Start keyframe slideshow
      setState(prev => ({ ...prev, status: 'playing' }));
      startKeyframePlayback();
    } else if (videoRef.current) {
      videoRef.current.play();
      setState(prev => ({ ...prev, status: 'playing' }));
    }
    onPlay?.();
  };

  /**
   * Pause video or slideshow
   */
  const pause = () => {
    if (keyframeOnly) {
      setState(prev => ({ ...prev, status: 'paused' }));
    } else if (videoRef.current) {
      videoRef.current.pause();
      setState(prev => ({ ...prev, status: 'paused' }));
    }
    onPause?.();
  };

  /**
   * Start keyframe playback
   */
  const startKeyframePlayback = () => {
    let frameIndex = currentKeyframe;
    
    const interval = setInterval(() => {
      if (state.status !== 'playing') {
        clearInterval(interval);
        return;
      }
      
      frameIndex = (frameIndex + 1) % keyframes.length;
      setCurrentKeyframe(frameIndex);
      
      // Simulate progress
      const progress = frameIndex / keyframes.length;
      setState(prev => ({
        ...prev,
        currentTime: progress * prev.duration
      }));
      
      onProgress?.(progress * state.duration, state.duration);
      
      if (frameIndex === keyframes.length - 1 && !loop) {
        clearInterval(interval);
        setState(prev => ({ ...prev, status: 'paused' }));
        onEnded?.();
      }
    }, 2000); // 2 seconds per keyframe
  };

  /**
   * Seek to position
   */
  const seek = (time: number) => {
    if (keyframeOnly) {
      const frameIndex = Math.floor((time / state.duration) * keyframes.length);
      setCurrentKeyframe(Math.min(frameIndex, keyframes.length - 1));
      setState(prev => ({ ...prev, currentTime: time }));
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  /**
   * Calculate video bitrate
   */
  const calculateBitrate = () => {
    if (!videoRef.current) return 0;
    
    const video = videoRef.current;
    const bytes = video.buffered.length > 0
      ? video.buffered.end(0) * 1000 // Rough estimate
      : 0;
    const seconds = video.currentTime || 1;
    
    return Math.floor((bytes * 8) / seconds / 1000); // kbps
  };

  /**
   * Format time display
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Setup video element event listeners
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setState(prev => ({
        ...prev,
        duration: video.duration,
        status: 'ready'
      }));
    };

    const handleTimeUpdate = () => {
      setState(prev => ({
        ...prev,
        currentTime: video.currentTime,
        bitrate: calculateBitrate()
      }));
      onProgress?.(video.currentTime, video.duration);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setState(prev => ({ ...prev, buffered }));
      }
    };

    const handleEnded = () => {
      setState(prev => ({ ...prev, status: 'paused' }));
      onEnded?.();
    };

    const handleError = () => {
      const error = new Error(`Video error: ${video.error?.message || 'Unknown error'}`);
      setState(prev => ({ ...prev, status: 'error', error }));
      onError?.(error);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [onProgress, onEnded, onError]);

  /**
   * Load video on mount
   */
  useEffect(() => {
    loadVideo();

    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
      keyframes.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [src]);

  /**
   * Handle autoplay
   */
  useEffect(() => {
    if (autoplay && state.status === 'ready') {
      play();
    }
  }, [autoplay, state.status]);

  // Render keyframe mode
  if (keyframeOnly && keyframes.length > 0) {
    return (
      <div className="media-video-keyframe" style={{ width, height, position: 'relative' }}>
        <img
          src={keyframes[currentKeyframe]}
          alt="Video keyframe"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        
        {controls && (
          <div className="keyframe-controls">
            <button onClick={state.status === 'playing' ? pause : play}>
              {state.status === 'playing' ? '⏸' : '▶'}
            </button>
            <span>{currentKeyframe + 1} / {keyframes.length}</span>
            <input
              type="range"
              min="0"
              max={keyframes.length - 1}
              value={currentKeyframe}
              onChange={(e) => setCurrentKeyframe(parseInt(e.target.value))}
            />
          </div>
        )}
        
        <div className="bandwidth-indicator">
          📡 Keyframe mode ({keyframes.length} frames)
        </div>
      </div>
    );
  }

  // Render video mode
  return (
    <div className="media-video-container" style={{ width, height, position: 'relative' }}>
      {state.status === 'loading' && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div>Loading video...</div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="error-overlay">
          ⚠️ Error: {state.error?.message}
          <button onClick={loadVideo}>Retry</button>
        </div>
      )}

      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        width={width}
        height={height}
        controls={controls}
        loop={loop}
        muted={muted}
        style={{ width: '100%', height: '100%' }}
      />

      {state.bitrate > 0 && (
        <div className="bitrate-indicator">
          {state.bitrate} kbps
        </div>
      )}

      <style jsx>{`
        .media-video-container, .media-video-keyframe {
          background: #000;
        }

        .loading-overlay, .error-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          color: white;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-overlay button {
          margin-top: 10px;
          padding: 5px 15px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .keyframe-controls {
          position: absolute;
          bottom: 10px;
          left: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .keyframe-controls button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #4CAF50;
          color: white;
          font-size: 18px;
          cursor: pointer;
        }

        .keyframe-controls input {
          flex: 1;
        }

        .bandwidth-indicator, .bitrate-indicator {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default MediaVideo;