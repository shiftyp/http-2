/**
 * Media Audio Component (T015)
 * 
 * Opus audio playback with bandwidth adaptation,
 * low-bitrate optimization, and voice enhancement.
 */

import React, { useState, useEffect, useRef } from 'react';
import { mediaCache } from '../../lib/media-cache/index.js';
import { OpusEncoder } from '../../lib/media-codecs/opus.js';

export interface MediaAudioProps {
  src: string;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  bitrate?: number;
  voiceOptimized?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

interface AudioState {
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  duration: number;
  currentTime: number;
  buffered: number;
  volume: number;
  error?: Error;
}

export const MediaAudio: React.FC<MediaAudioProps> = ({
  src,
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  preload = 'metadata',
  bitrate = 16,
  voiceOptimized = true,
  onPlay,
  onPause,
  onEnded,
  onError,
  onProgress
}) => {
  const [state, setState] = useState<AudioState>({
    status: 'idle',
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 1
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const encoder = useRef(new OpusEncoder());
  const [audioUrl, setAudioUrl] = useState<string>('');

  /**
   * Initialize audio context
   */
  const initAudioContext = () => {
    if (!audioContextRef.current && audioRef.current) {
      audioContextRef.current = new AudioContext({
        sampleRate: voiceOptimized ? 8000 : 48000
      });

      // Create audio nodes
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(
        audioRef.current
      );
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      // Connect nodes
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      // Apply voice optimization if enabled
      if (voiceOptimized) {
        applyVoiceOptimization();
      }
    }
  };

  /**
   * Apply voice optimization filters
   */
  const applyVoiceOptimization = () => {
    if (!audioContextRef.current || !sourceNodeRef.current) return;

    // Create filters for voice optimization
    const highpass = audioContextRef.current.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80; // Remove low frequency noise

    const lowpass = audioContextRef.current.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3000; // Focus on voice frequencies

    const compressor = audioContextRef.current.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Reconnect with filters
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current
      .connect(highpass)
      .connect(lowpass)
      .connect(compressor)
      .connect(analyserRef.current!);
  };

  /**
   * Load audio from cache or network
   */
  const loadAudio = async () => {
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      // Check cache first
      const cached = await mediaCache.get(src);
      
      if (cached) {
        const blob = new Blob([cached.data], { type: cached.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
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
   * Load audio from network
   */
  const loadFromNetwork = async () => {
    const response = await fetch(src);
    const blob = await response.blob();

    // Optimize for narrow-band if needed
    if (bitrate < 32 || voiceOptimized) {
      const optimized = await optimizeAudio(blob);
      const url = URL.createObjectURL(optimized);
      setAudioUrl(url);
    } else {
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    }

    setState(prev => ({ ...prev, status: 'ready' }));

    // Cache for future use
    const arrayBuffer = await blob.arrayBuffer();
    await mediaCache.store(src, new Uint8Array(arrayBuffer), blob.type);
  };

  /**
   * Optimize audio for narrow-band
   */
  const optimizeAudio = async (blob: Blob): Promise<Blob> => {
    // Decode audio
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Extract channel data
    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    // Encode with Opus at target bitrate
    const encoded = await encoder.current.encode(channels, {
      quality: bitrate,
      maxSize: Math.floor(audioBuffer.duration * bitrate * 1000 / 8)
    });

    return new Blob([encoded], { type: 'audio/opus' });
  };

  /**
   * Play audio
   */
  const play = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setState(prev => ({ ...prev, status: 'playing' }));
      onPlay?.();
    }
  };

  /**
   * Pause audio
   */
  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState(prev => ({ ...prev, status: 'paused' }));
      onPause?.();
    }
  };

  /**
   * Toggle play/pause
   */
  const togglePlayPause = () => {
    if (state.status === 'playing') {
      pause();
    } else {
      play();
    }
  };

  /**
   * Seek to position
   */
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  };

  /**
   * Set volume
   */
  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
      setState(prev => ({ ...prev, volume }));
    }
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
   * Get audio visualization data
   */
  const getVisualizationData = (): Uint8Array | null => {
    if (!analyserRef.current) return null;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    return dataArray;
  };

  /**
   * Setup audio element event listeners
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setState(prev => ({
        ...prev,
        duration: audio.duration,
        status: 'ready'
      }));
      initAudioContext();
    };

    const handleTimeUpdate = () => {
      setState(prev => ({
        ...prev,
        currentTime: audio.currentTime
      }));
      onProgress?.(audio.currentTime, audio.duration);
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const buffered = audio.buffered.end(audio.buffered.length - 1);
        setState(prev => ({ ...prev, buffered }));
      }
    };

    const handleEnded = () => {
      setState(prev => ({ ...prev, status: 'paused' }));
      onEnded?.();
    };

    const handleError = () => {
      const error = new Error(`Audio error: ${audio.error?.message || 'Unknown error'}`);
      setState(prev => ({ ...prev, status: 'error', error }));
      onError?.(error);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onProgress, onEnded, onError]);

  /**
   * Load audio on mount or src change
   */
  useEffect(() => {
    loadAudio();

    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [src]);

  /**
   * Handle autoplay
   */
  useEffect(() => {
    if (autoplay && state.status === 'ready' && audioRef.current) {
      play();
    }
  }, [autoplay, state.status]);

  if (!controls) {
    return (
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        preload={preload}
      />
    );
  }

  return (
    <div className="media-audio-container">
      <audio
        ref={audioRef}
        src={audioUrl}
        loop={loop}
        muted={muted}
        preload={preload}
        style={{ display: 'none' }}
      />

      <div className="audio-player">
        {state.status === 'loading' && (
          <div className="loading">Loading audio...</div>
        )}

        {state.status === 'error' && (
          <div className="error">
            ⚠️ Error: {state.error?.message}
            <button onClick={loadAudio}>Retry</button>
          </div>
        )}

        {(state.status === 'ready' || state.status === 'playing' || state.status === 'paused') && (
          <>
            <div className="controls">
              <button
                className="play-pause"
                onClick={togglePlayPause}
                aria-label={state.status === 'playing' ? 'Pause' : 'Play'}
              >
                {state.status === 'playing' ? '⏸' : '▶'}
              </button>

              <div className="time">
                <span>{formatTime(state.currentTime)}</span>
                <span> / </span>
                <span>{formatTime(state.duration)}</span>
              </div>

              <input
                type="range"
                className="seek"
                min="0"
                max={state.duration || 0}
                value={state.currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
              />

              <input
                type="range"
                className="volume"
                min="0"
                max="1"
                step="0.1"
                value={state.volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume"
              />
            </div>

            <div className="progress">
              <div
                className="progress-bar"
                style={{ width: `${(state.currentTime / state.duration) * 100}%` }}
              />
              <div
                className="buffered-bar"
                style={{ width: `${(state.buffered / state.duration) * 100}%` }}
              />
            </div>

            {voiceOptimized && (
              <div className="voice-indicator">
                🎙️ Voice Optimized ({bitrate}kbps)
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .media-audio-container {
          width: 100%;
          max-width: 500px;
        }

        .audio-player {
          background: #f5f5f5;
          border-radius: 8px;
          padding: 15px;
        }

        .loading, .error {
          text-align: center;
          padding: 20px;
        }

        .error button {
          margin-left: 10px;
          padding: 5px 10px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .play-pause {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #4CAF50;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .play-pause:hover {
          background: #45a049;
        }

        .time {
          font-size: 12px;
          color: #666;
          white-space: nowrap;
        }

        .seek {
          flex: 1;
          height: 4px;
        }

        .volume {
          width: 80px;
          height: 4px;
        }

        .progress {
          position: relative;
          height: 4px;
          background: #ddd;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-bar, .buffered-bar {
          position: absolute;
          height: 100%;
          left: 0;
          top: 0;
        }

        .buffered-bar {
          background: #ccc;
        }

        .progress-bar {
          background: #4CAF50;
          transition: width 0.1s;
        }

        .voice-indicator {
          font-size: 11px;
          color: #666;
          text-align: center;
          margin-top: 8px;
        }

        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }

        input[type="range"]::-webkit-slider-track {
          background: #ddd;
          height: 4px;
          border-radius: 2px;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          background: #4CAF50;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default MediaAudio;