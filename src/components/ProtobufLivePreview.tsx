/**
 * Compact Protobuf Live Preview for Page Builder
 * Shows real-time protobuf compression stats and sends data via postMessage (simulates radio)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { renderComponentForRadio, renderComponentFromRadio, ProtobufComponentData } from '../lib/react-renderer';

interface ProtobufLivePreviewProps {
  components: any[]; // Page components from the builder
  isVisible?: boolean;
  enableTransmission?: boolean; // Enable actual protobuf transmission test
}

interface CompressionStats {
  totalComponents: number;
  originalSize: number;
  compressedSize: number;
  totalRatio: number;
  largestComponent: { type: string; size: number; ratio: number } | null;
  estimatedTransmissionTime: number; // at 2400 bps
}

// Mock component for testing page builder components
const MockPageComponent: React.FC<{ component: any }> = ({ component }) => {
  switch (component.type) {
    case 'text':
    case 'heading':
    case 'paragraph':
      return <div>{component.properties?.text || 'Sample text'}</div>;
    case 'image':
      return <img src={component.properties?.src || 'data:image/svg+xml,<svg/>'} alt={component.properties?.alt || 'Image'} />;
    case 'form':
      return <form><input placeholder="Sample input" /></form>;
    case 'button':
      return <button>{component.properties?.text || 'Button'}</button>;
    case 'list':
      return <ul><li>Sample list item</li></ul>;
    default:
      return <div>Component: {component.type}</div>;
  }
};

export const ProtobufLivePreview: React.FC<ProtobufLivePreviewProps> = ({
  components,
  isVisible = true,
  enableTransmission = true
}) => {
  const [compressionStats, setCompressionStats] = useState<CompressionStats | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protobufData, setProtobufData] = useState<ProtobufComponentData[]>([]);
  const [previewWindow, setPreviewWindow] = useState<Window | null>(null);
  const [transmissionLog, setTransmissionLog] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // Analyze components for protobuf compression
  const analyzeComponents = useMemo(() => async () => {
    if (!components.length) {
      setCompressionStats(null);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const results: ProtobufComponentData[] = [];
      let totalOriginal = 0;
      let totalCompressed = 0;
      let largestComponent: { type: string; size: number; ratio: number } | null = null;

      for (const component of components) {
        try {
          // Create a mock React element for this component
          const mockElement = React.createElement(MockPageComponent, { component });

          // Render to protobuf
          const result = await renderComponentForRadio(MockPageComponent, { component }, {
            componentType: component.type || 'UnknownComponent'
          });

          results.push(result);
          totalOriginal += result.originalSize;
          totalCompressed += result.compressedSize;

          // Track largest component
          if (!largestComponent || result.compressedSize > largestComponent.size) {
            largestComponent = {
              type: component.type || 'Unknown',
              size: result.compressedSize,
              ratio: result.ratio
            };
          }
        } catch (componentError) {
          console.warn(`Failed to analyze component ${component.type}:`, componentError);
        }
      }

      const totalRatio = totalOriginal > 0 ? totalOriginal / totalCompressed : 1;
      const estimatedTransmissionTime = (totalCompressed * 8) / 2400; // seconds at 2400 bps

      setCompressionStats({
        totalComponents: components.length,
        originalSize: totalOriginal,
        compressedSize: totalCompressed,
        totalRatio,
        largestComponent,
        estimatedTransmissionTime
      });

      // Store protobuf data for transmission
      setProtobufData(results);
    } catch (error) {
      console.error('Failed to analyze components:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [components]);

  // Re-analyze when components change
  useEffect(() => {
    analyzeComponents();
  }, [analyzeComponents]);

  // Simulate radio transmission via postMessage
  const simulateTransmission = () => {
    if (!protobufData.length) return;

    const log: string[] = [];
    log.push(`🔄 Starting transmission of ${protobufData.length} components...`);

    // Open preview window or use existing one
    let targetWindow = previewWindow;
    if (!targetWindow || targetWindow.closed) {
      targetWindow = window.open('', 'protobuf-preview', 'width=600,height=400,scrollbars=yes');
      if (targetWindow) {
        setPreviewWindow(targetWindow);

        // Setup receiver window
        targetWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Ham Radio Receiver</title>
              <style>
                body { font-family: monospace; background: #000; color: #0f0; padding: 20px; }
                .component { border: 1px solid #333; margin: 10px 0; padding: 10px; }
                .stats { background: #001; padding: 10px; border: 1px solid #0ff; margin: 10px 0; }
              </style>
            </head>
            <body>
              <h1>📡 Ham Radio Receiver - Protobuf Hydration</h1>
              <div id="transmission-log"></div>
              <div id="components-container"></div>

              <script>
                const log = document.getElementById('transmission-log');
                const container = document.getElementById('components-container');

                window.addEventListener('message', (event) => {
                  if (event.data.type === 'PROTOBUF_TRANSMISSION') {
                    const { protobufData, componentIndex, totalComponents } = event.data;

                    log.innerHTML += '<div>📦 Received component ' + (componentIndex + 1) + '/' + totalComponents + ': ' + protobufData.componentType + ' (' + protobufData.compressedSize + ' bytes)</div>';

                    // In a real implementation, this would use renderComponentFromRadio
                    // For demo, just show the received data
                    const componentDiv = document.createElement('div');
                    componentDiv.className = 'component';
                    componentDiv.innerHTML = '<h3>Component: ' + protobufData.componentType + '</h3>' +
                                           '<div>Protobuf Size: ' + protobufData.compressedSize + ' bytes</div>' +
                                           '<div>Compression: ' + protobufData.ratio.toFixed(2) + 'x</div>' +
                                           '<div>Schema ID: ' + protobufData.componentSchema + '</div>';
                    container.appendChild(componentDiv);
                  }

                  if (event.data.type === 'TRANSMISSION_COMPLETE') {
                    log.innerHTML += '<div style="color: #0ff;"><strong>✅ Transmission Complete!</strong></div>';
                    const stats = document.createElement('div');
                    stats.className = 'stats';
                    stats.innerHTML = '<h3>📊 Transmission Stats</h3>' +
                                    '<div>Total Components: ' + event.data.stats.totalComponents + '</div>' +
                                    '<div>Total Compressed Size: ' + event.data.stats.compressedSize + ' bytes</div>' +
                                    '<div>Transmission Time @ 2400bps: ' + event.data.stats.transmissionTime.toFixed(1) + 's</div>' +
                                    '<div>Bandwidth Saved: ' + ((1 - event.data.stats.compressedSize / event.data.stats.originalSize) * 100).toFixed(0) + '%</div>';
                    container.appendChild(stats);
                  }
                });
              </script>
            </body>
          </html>
        `);
        targetWindow.document.close();
      }
    }

    if (!targetWindow) {
      log.push('❌ Failed to open preview window');
      setTransmissionLog(log);
      return;
    }

    // Send each component via postMessage (simulating radio packets)
    protobufData.forEach((data, index) => {
      setTimeout(() => {
        targetWindow!.postMessage({
          type: 'PROTOBUF_TRANSMISSION',
          protobufData: {
            componentType: data.componentType,
            compressedSize: data.compressedSize,
            originalSize: data.originalSize,
            ratio: data.ratio,
            componentSchema: data.componentSchema,
            // Note: In real transmission, we'd send the actual protobufData: data.protobufData
            // but for demo purposes, we're just sending metadata
          },
          componentIndex: index,
          totalComponents: protobufData.length
        }, '*');

        log.push(`📡 Transmitted ${data.componentType} (${data.compressedSize} bytes)`);
        if (index === protobufData.length - 1) {
          setTimeout(() => {
            targetWindow!.postMessage({
              type: 'TRANSMISSION_COMPLETE',
              stats: compressionStats
            }, '*');
          }, 100);
        }
      }, index * 500); // Simulate transmission delay
    });

    log.push(`⚡ Transmitting over simulated ham radio link...`);
    setTransmissionLog(log);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: '280px',
      backgroundColor: '#001',
      border: '1px solid #0f0',
      borderRadius: '4px',
      padding: '10px',
      fontSize: '11px',
      color: '#0f0',
      fontFamily: 'monospace',
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
        borderBottom: '1px solid #333',
        paddingBottom: '5px'
      }}>
        <strong style={{ color: '#0ff', fontSize: '12px' }}>📡 Radio Transmission</strong>
        {isAnalyzing && <span style={{ color: '#ff0' }}>⚡ Analyzing...</span>}
      </div>

      {error && (
        <div style={{ color: '#f00', marginBottom: '8px' }}>
          Error: {error}
        </div>
      )}

      {!compressionStats && !error && !isAnalyzing && (
        <div style={{ color: '#888', textAlign: 'center', padding: '10px 0' }}>
          Add components to see transmission stats
        </div>
      )}

      {compressionStats && (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <div>📦 Components: <strong>{compressionStats.totalComponents}</strong></div>
            <div>📊 JSON size: <strong>{compressionStats.originalSize}B</strong></div>
            <div>🗜️ Protobuf: <strong style={{ color: '#0ff' }}>{compressionStats.compressedSize}B</strong></div>
            <div>📈 Compression: <strong style={{ color: '#ff0' }}>{compressionStats.totalRatio.toFixed(1)}x</strong></div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '8px',
            fontSize: '10px'
          }}>
            <div style={{ textAlign: 'center', padding: '4px', border: '1px solid #333' }}>
              <div style={{ color: '#0ff' }}>{compressionStats.estimatedTransmissionTime.toFixed(1)}s</div>
              <div style={{ color: '#888' }}>@ 2400 bps</div>
            </div>
            <div style={{ textAlign: 'center', padding: '4px', border: '1px solid #333' }}>
              <div style={{ color: '#0ff' }}>
                {((1 - compressionStats.compressedSize / compressionStats.originalSize) * 100).toFixed(0)}%
              </div>
              <div style={{ color: '#888' }}>Saved</div>
            </div>
          </div>

          {compressionStats.largestComponent && (
            <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
              Largest: {compressionStats.largestComponent.type}
              ({compressionStats.largestComponent.size}B)
            </div>
          )}

          {enableTransmission && (
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={simulateTransmission}
                disabled={!protobufData.length || isAnalyzing}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: protobufData.length ? '#0f0' : '#333',
                  color: protobufData.length ? '#000' : '#666',
                  border: '1px solid #0f0',
                  borderRadius: '2px',
                  cursor: protobufData.length ? 'pointer' : 'not-allowed',
                  fontSize: '10px',
                  marginBottom: '4px'
                }}
              >
                📡 Simulate Radio Transmission
              </button>

              {transmissionLog.length > 0 && (
                <div style={{
                  fontSize: '8px',
                  color: '#888',
                  maxHeight: '60px',
                  overflowY: 'auto',
                  border: '1px solid #333',
                  padding: '4px',
                  backgroundColor: '#002'
                }}>
                  {transmissionLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{
            marginTop: '8px',
            padding: '4px',
            backgroundColor: '#002',
            border: '1px solid #333',
            borderRadius: '2px',
            fontSize: '9px',
            color: '#888'
          }}>
            💡 Components sent as binary protobuf data + schemas cached in PWA
            {enableTransmission && <div>📡 Click transmission button to test via postMessage</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProtobufLivePreview;