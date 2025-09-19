/**
 * Media Document Component (T030)
 * 
 * PDF document viewer with text extraction,
 * page navigation, and bandwidth-optimized rendering.
 */

import React, { useState, useEffect, useRef } from 'react';
import { mediaCache } from '../../lib/media-cache/index.js';
import { PDFEncoder, PDFTextExtractor } from '../../lib/media-codecs/pdf.js';
import type { PDFDocument } from '../../lib/media-codecs/pdf.js';

export interface MediaDocumentProps {
  src: string;
  width?: number;
  height?: number;
  textOnly?: boolean;
  extractText?: boolean;
  maxPages?: number;
  quality?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onPageChange?: (page: number, total: number) => void;
}

interface DocumentState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  document?: PDFDocument;
  currentPage: number;
  totalPages: number;
  extractedText?: string;
  error?: Error;
}

export const MediaDocument: React.FC<MediaDocumentProps> = ({
  src,
  width = 600,
  height = 800,
  textOnly = false,
  extractText = false,
  maxPages,
  quality = 75,
  onLoad,
  onError,
  onPageChange
}) => {
  const [state, setState] = useState<DocumentState>({
    status: 'idle',
    currentPage: 0,
    totalPages: 0
  });

  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const encoder = useRef(new PDFEncoder());
  const textExtractor = useRef(new PDFTextExtractor());

  /**
   * Load document from cache or network
   */
  const loadDocument = async () => {
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      // Check cache first
      const cached = await mediaCache.get(src);
      
      if (cached) {
        await processDocument(cached.data);
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
   * Load document from network
   */
  const loadFromNetwork = async () => {
    const response = await fetch(src);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Process document
    await processDocument(data);

    // Cache for future use
    await mediaCache.store(src, data, blob.type);
  };

  /**
   * Process PDF document
   */
  const processDocument = async (data: Uint8Array) => {
    // Decode PDF
    const document = await encoder.current.decode(data);
    
    // Apply page limit if specified
    if (maxPages && document.pages.length > maxPages) {
      document.pages = document.pages.slice(0, maxPages);
    }

    // Extract text if requested
    if (extractText || textOnly) {
      const text = await textExtractor.current.extractText(data);
      setState(prev => ({ ...prev, extractedText: text }));
    }

    // Render pages to images if not text-only
    if (!textOnly) {
      await renderPagesToImages(document);
    }

    setState(prev => ({
      ...prev,
      status: 'ready',
      document,
      totalPages: document.pages.length,
      currentPage: document.pages.length > 0 ? 1 : 0
    }));

    onLoad?.();
    
    if (document.pages.length > 0) {
      onPageChange?.(1, document.pages.length);
    }
  };

  /**
   * Render PDF pages to images
   */
  const renderPagesToImages = async (document: PDFDocument) => {
    const images: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    for (const page of document.pages) {
      canvas.width = page.width;
      canvas.height = page.height;
      
      // Clear canvas
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Render text content
      ctx.fillStyle = 'black';
      ctx.font = '14px Arial';
      
      // Simple text rendering (would use proper PDF rendering in production)
      const lines = page.text.split('\n');
      let y = 30;
      
      for (const line of lines) {
        // Word wrap
        const words = line.split(' ');
        let currentLine = '';
        const maxWidth = canvas.width - 40;
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine) {
            ctx.fillText(currentLine, 20, y);
            currentLine = word;
            y += 20;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          ctx.fillText(currentLine, 20, y);
          y += 20;
        }
        
        y += 10; // Paragraph spacing
      }
      
      // Render images if present
      if (page.images) {
        for (const img of page.images) {
          ctx.putImageData(img, 20, y);
          y += img.height + 20;
        }
      }
      
      // Convert to image
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality / 100);
      });
      
      const url = URL.createObjectURL(blob);
      images.push(url);
    }
    
    setPageImages(images);
  };

  /**
   * Navigate to specific page
   */
  const goToPage = (pageNumber: number) => {
    if (!state.document) return;
    
    const page = Math.max(1, Math.min(pageNumber, state.totalPages));
    setState(prev => ({ ...prev, currentPage: page }));
    onPageChange?.(page, state.totalPages);
  };

  /**
   * Next page
   */
  const nextPage = () => {
    if (state.currentPage < state.totalPages) {
      goToPage(state.currentPage + 1);
    }
  };

  /**
   * Previous page
   */
  const previousPage = () => {
    if (state.currentPage > 1) {
      goToPage(state.currentPage - 1);
    }
  };

  /**
   * Download text version
   */
  const downloadText = () => {
    if (!state.extractedText) return;
    
    const blob = new Blob([state.extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Search in document
   */
  const searchInDocument = (query: string): number[] => {
    if (!state.document) return [];
    
    const matches: number[] = [];
    
    state.document.pages.forEach((page, index) => {
      if (page.text.toLowerCase().includes(query.toLowerCase())) {
        matches.push(index + 1);
      }
    });
    
    return matches;
  };

  /**
   * Load document on mount
   */
  useEffect(() => {
    loadDocument();

    return () => {
      // Cleanup blob URLs
      pageImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [src]);

  // Render text-only mode
  if (textOnly && state.extractedText) {
    return (
      <div 
        className="media-document-text"
        style={{ width, height, overflow: 'auto' }}
      >
        <div className="text-controls">
          <button onClick={downloadText}>💾 Download Text</button>
          <span className="page-indicator">
            Text-only mode
          </span>
        </div>
        
        <div className="text-content">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', padding: '20px' }}>
            {state.extractedText}
          </pre>
        </div>
        
        <style jsx>{`
          .media-document-text {
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
          }
          
          .text-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #ddd;
            background: #f5f5f5;
          }
          
          .text-controls button {
            padding: 5px 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          
          .text-content {
            padding: 20px;
            height: calc(100% - 50px);
            overflow-y: auto;
          }
        `}</style>
      </div>
    );
  }

  // Render full document viewer
  return (
    <div className="media-document-container" style={{ width, height }}>
      {state.status === 'loading' && (
        <div className="loading-state">
          <div className="spinner" />
          <div>Loading document...</div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="error-state">
          ⚠️ Error: {state.error?.message}
          <button onClick={loadDocument}>Retry</button>
        </div>
      )}

      {state.status === 'ready' && state.document && (
        <>
          <div className="document-controls">
            <button 
              onClick={previousPage}
              disabled={state.currentPage <= 1}
            >
              ◀
            </button>
            
            <span className="page-indicator">
              Page {state.currentPage} of {state.totalPages}
            </span>
            
            <button 
              onClick={nextPage}
              disabled={state.currentPage >= state.totalPages}
            >
              ▶
            </button>
            
            <input
              type="number"
              min="1"
              max={state.totalPages}
              value={state.currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value))}
              className="page-input"
            />
            
            {state.extractedText && (
              <button onClick={downloadText} className="download-btn">
                💾 Text
              </button>
            )}
          </div>

          <div className="document-viewer">
            {pageImages.length > 0 ? (
              <img
                src={pageImages[state.currentPage - 1]}
                alt={`Page ${state.currentPage}`}
                style={{ 
                  maxWidth: '100%',
                  maxHeight: 'calc(100% - 60px)',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div className="page-content">
                <h3>
                  {state.document.metadata?.title || 'Document'}
                </h3>
                {state.document.metadata?.author && (
                  <p>Author: {state.document.metadata.author}</p>
                )}
                <div className="page-text">
                  {state.document.pages[state.currentPage - 1]?.text}
                </div>
              </div>
            )}
          </div>

          {state.totalPages > 1 && (
            <div className="page-thumbnails">
              {Array.from({ length: Math.min(state.totalPages, 10) }, (_, i) => (
                <button
                  key={i}
                  className={`thumbnail ${state.currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => goToPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              {state.totalPages > 10 && <span>...</span>}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .media-document-container {
          display: flex;
          flex-direction: column;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #f5f5f5;
          overflow: hidden;
        }

        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #4CAF50;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-state button {
          margin-top: 10px;
          padding: 5px 15px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .document-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: white;
          border-bottom: 1px solid #ddd;
        }

        .document-controls button {
          padding: 5px 10px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .document-controls button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .page-input {
          width: 60px;
          padding: 5px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .download-btn {
          margin-left: auto;
        }

        .document-viewer {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: auto;
          background: white;
        }

        .page-content {
          max-width: 600px;
          padding: 40px;
        }

        .page-content h3 {
          margin-bottom: 20px;
          font-size: 24px;
        }

        .page-text {
          white-space: pre-wrap;
          line-height: 1.6;
        }

        .page-thumbnails {
          display: flex;
          gap: 5px;
          padding: 10px;
          background: white;
          border-top: 1px solid #ddd;
          overflow-x: auto;
        }

        .thumbnail {
          min-width: 30px;
          height: 30px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          font-size: 12px;
        }

        .thumbnail.active {
          background: #4CAF50;
          color: white;
        }

        .thumbnail:hover:not(.active) {
          background: #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default MediaDocument;