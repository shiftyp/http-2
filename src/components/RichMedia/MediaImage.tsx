/**
 * Media Image Component (T014)
 * 
 * Optimized image display with progressive loading,
 * bandwidth adaptation, and JPEG quality control.
 */

import React, { useState, useEffect, useRef } from 'react';
import { mediaCache } from '../../lib/media-cache/index.js';
import { JPEGEncoder, ProgressiveJPEGScanner } from '../../lib/media-codecs/jpeg.js';
import type { EncodingOptions } from '../../lib/media-codecs/index.js';

export interface MediaImageProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  quality?: number;
  progressive?: boolean;
  maxSize?: number;
  placeholder?: string;
  lazy?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (loaded: number, total: number) => void;
}

interface ImageState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  data?: string;
  error?: Error;
  progress: number;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt = '',
  width,
  height,
  quality = 75,
  progressive = true,
  maxSize,
  placeholder,
  lazy = true,
  onLoad,
  onError,
  onProgress
}) => {
  const [state, setState] = useState<ImageState>({
    status: 'idle',
    progress: 0
  });
  
  const [displaySrc, setDisplaySrc] = useState<string>(placeholder || '');
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const progressiveScannerRef = useRef<ProgressiveJPEGScanner | null>(null);
  const encoder = useRef(new JPEGEncoder());

  /**
   * Load image from cache or network
   */
  const loadImage = async () => {
    setState(prev => ({ ...prev, status: 'loading' }));
    
    try {
      // Check cache first
      const cached = await mediaCache.get(src);
      
      if (cached) {
        const blob = new Blob([cached.data], { type: cached.mimeType });
        const url = URL.createObjectURL(blob);
        setDisplaySrc(url);
        setState({
          status: 'loaded',
          data: url,
          progress: 100
        });
        onLoad?.();
        return;
      }
      
      // Load from network
      await loadFromNetwork();
    } catch (error) {
      setState({
        status: 'error',
        error: error as Error,
        progress: 0
      });
      onError?.(error as Error);
    }
  };

  /**
   * Load image from network with progressive support
   */
  const loadFromNetwork = async () => {
    if (!progressive) {
      // Standard loading
      const response = await fetch(src);
      const blob = await response.blob();
      
      // Optimize if needed
      if (maxSize && blob.size > maxSize) {
        const optimized = await optimizeImage(blob);
        const url = URL.createObjectURL(optimized);
        setDisplaySrc(url);
      } else {
        const url = URL.createObjectURL(blob);
        setDisplaySrc(url);
      }
      
      setState({
        status: 'loaded',
        data: displaySrc,
        progress: 100
      });
      onLoad?.();
      
      // Cache for future use
      const arrayBuffer = await blob.arrayBuffer();
      await mediaCache.store(src, new Uint8Array(arrayBuffer), blob.type);
    } else {
      // Progressive loading
      await loadProgressively();
    }
  };

  /**
   * Load image progressively
   */
  const loadProgressively = async () => {
    progressiveScannerRef.current = new ProgressiveJPEGScanner();
    const response = await fetch(src);
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    const reader = response.body.getReader();
    const contentLength = Number(response.headers.get('Content-Length')) || 0;
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      // Update progress
      const progress = contentLength > 0 
        ? Math.round((receivedLength / contentLength) * 100)
        : 0;
      
      setState(prev => ({ ...prev, progress }));
      onProgress?.(receivedLength, contentLength);
      
      // Try to display progressive scan
      if (progressive && progressiveScannerRef.current) {
        progressiveScannerRef.current.addScan(value);
        const currentImage = await progressiveScannerRef.current.getCurrentImage();
        
        if (currentImage) {
          const canvas = document.createElement('canvas');
          canvas.width = currentImage.width;
          canvas.height = currentImage.height;
          const ctx = canvas.getContext('2d');
          ctx?.putImageData(currentImage, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              setDisplaySrc(url);
            }
          }, 'image/jpeg', quality / 100);
        }
      }
    }
    
    // Final assembly
    const fullData = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      fullData.set(chunk, position);
      position += chunk.length;
    }
    
    const blob = new Blob([fullData], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    setDisplaySrc(url);
    
    setState({
      status: 'loaded',
      data: url,
      progress: 100
    });
    onLoad?.();
    
    // Cache the image
    await mediaCache.store(src, fullData, 'image/jpeg');
  };

  /**
   * Optimize image size
   */
  const optimizeImage = async (blob: Blob): Promise<Blob> => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      img.onload = async () => {
        URL.revokeObjectURL(url);
        
        const canvas = document.createElement('canvas');
        
        // Calculate optimal dimensions
        let targetWidth = img.width;
        let targetHeight = img.height;
        
        if (width && height) {
          targetWidth = width;
          targetHeight = height;
        } else if (width) {
          targetWidth = width;
          targetHeight = (img.height / img.width) * width;
        } else if (height) {
          targetHeight = height;
          targetWidth = (img.width / img.height) * height;
        }
        
        // Resize if needed
        if (maxSize && blob.size > maxSize) {
          const ratio = Math.sqrt(maxSize / blob.size);
          targetWidth *= ratio;
          targetHeight *= ratio;
        }
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Convert to optimized JPEG
        const imageData = ctx?.getImageData(0, 0, targetWidth, targetHeight);
        
        if (imageData) {
          const options: EncodingOptions = {
            quality,
            progressive,
            maxSize
          };
          
          const encoded = await encoder.current.encode(imageData, options);
          resolve(new Blob([encoded], { type: 'image/jpeg' }));
        } else {
          resolve(blob);
        }
      };
      
      img.src = url;
    });
  };

  /**
   * Setup lazy loading
   */
  useEffect(() => {
    if (!lazy || !imgRef.current) {
      loadImage();
      return;
    }
    
    // Setup intersection observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px'
      }
    );
    
    observerRef.current.observe(imgRef.current);
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, lazy]);

  /**
   * Cleanup URLs on unmount
   */
  useEffect(() => {
    return () => {
      if (state.data && state.data.startsWith('blob:')) {
        URL.revokeObjectURL(state.data);
      }
      if (displaySrc && displaySrc.startsWith('blob:')) {
        URL.revokeObjectURL(displaySrc);
      }
    };
  }, [state.data, displaySrc]);

  return (
    <div className="media-image-container" style={{ width, height }}>
      {state.status === 'loading' && (
        <div className="loading-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          {state.progress > 0 && (
            <span className="progress-text">{state.progress}%</span>
          )}
        </div>
      )}
      
      <img
        ref={imgRef}
        src={displaySrc || placeholder}
        alt={alt}
        width={width}
        height={height}
        loading={lazy ? 'lazy' : 'eager'}
        style={{
          opacity: state.status === 'loaded' ? 1 : 0.5,
          transition: 'opacity 0.3s ease'
        }}
        onError={() => {
          if (state.status !== 'error') {
            setState({
              status: 'error',
              error: new Error('Failed to load image'),
              progress: 0
            });
            onError?.(new Error('Failed to load image'));
          }
        }}
      />
      
      {state.status === 'error' && (
        <div className="error-message">
          <span>⚠️ Failed to load image</span>
          <button onClick={loadImage}>Retry</button>
        </div>
      )}
      
      <style jsx>{`
        .media-image-container {
          position: relative;
          display: inline-block;
        }
        
        .loading-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 10px;
          border-radius: 4px;
          z-index: 1;
        }
        
        .progress-bar {
          width: 100px;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #4CAF50;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          display: block;
          text-align: center;
          margin-top: 5px;
          font-size: 12px;
        }
        
        .error-message {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(244, 67, 54, 0.9);
          color: white;
          padding: 10px;
          border-radius: 4px;
          text-align: center;
        }
        
        .error-message button {
          margin-top: 5px;
          padding: 5px 10px;
          background: white;
          color: #f44336;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default MediaImage;