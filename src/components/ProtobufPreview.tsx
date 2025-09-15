/**
 * Protobuf Preview Component
 * Tests the complete protobuf cycle: render -> compress -> decompress -> render
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  renderComponentForRadio,
  renderComponentFromRadio,
  ProtobufComponentData
} from '../lib/react-renderer';

interface PreviewProps {
  ComponentToTest: React.ComponentType<any>;
  componentProps: any;
  componentType?: string;
}

// Sample test components
export const TestCard: React.FC<{ title: string; content: string; count: number }> = ({ title, content, count }) => (
  <div className="card">
    <h2>{title}</h2>
    <p>{content}</p>
    <span>Count: {count}</span>
  </div>
);

export const TestForm: React.FC<{ fields: Array<{ name: string; type: string; value: any }> }> = ({ fields }) => (
  <form>
    {fields.map((field, index) => (
      <div key={index}>
        <label>{field.name}</label>
        <input type={field.type} defaultValue={field.value} />
      </div>
    ))}
  </form>
);

export const TestQSOLog: React.FC<{ callsign: string; frequency: number; mode: string; rst: string }> = ({ callsign, frequency, mode, rst }) => (
  <div className="qso-entry">
    <span>Callsign: {callsign}</span>
    <span>Freq: {frequency} MHz</span>
    <span>Mode: {mode}</span>
    <span>RST: {rst}</span>
  </div>
);

// Component registry for the PWA
const ComponentRegistry = {
  TestCard,
  TestForm,
  TestQSOLog
};

export const ProtobufPreview: React.FC<PreviewProps> = ({ ComponentToTest, componentProps, componentType }) => {
  const [protobufData, setProtobufData] = useState<ProtobufComponentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [renderStats, setRenderStats] = useState<{
    originalSize: number;
    compressedSize: number;
    ratio: number;
    componentType: string;
  } | null>(null);

  const originalRef = useRef<HTMLDivElement>(null);
  const decompressedRef = useRef<HTMLDivElement>(null);

  // Test the protobuf cycle
  const testProtobufCycle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting protobuf cycle test...');

      // Step 1: Render component to protobuf data
      console.log('Step 1: Rendering component to protobuf...');
      const startTime = performance.now();

      const data = await renderComponentForRadio(ComponentToTest, componentProps, {
        componentType: componentType || ComponentToTest.name
      });

      const renderTime = performance.now() - startTime;

      console.log('Protobuf data generated:', {
        componentType: data.componentType,
        protobufSize: data.protobufData.length,
        originalSize: data.originalSize,
        ratio: data.ratio,
        renderTime: renderTime.toFixed(2) + 'ms'
      });

      setProtobufData(data);
      setRenderStats({
        originalSize: data.originalSize,
        compressedSize: data.compressedSize,
        ratio: data.ratio,
        componentType: data.componentType
      });

      // Step 2: "Transmit" the data (simulate radio transmission)
      console.log('Step 2: Simulating radio transmission...');
      console.log('Transmitted data size:', data.protobufData.length, 'bytes');

      // Step 3: Render from protobuf data
      console.log('Step 3: Rendering from protobuf data...');
      const decompressStartTime = performance.now();

      if (decompressedRef.current) {
        // Clear the container
        decompressedRef.current.innerHTML = '';

        await renderComponentFromRadio(data, ComponentRegistry, decompressedRef.current);

        const decompressTime = performance.now() - decompressStartTime;
        console.log('Decompression and render time:', decompressTime.toFixed(2) + 'ms');
        console.log('Protobuf cycle completed successfully!');
      }
    } catch (err) {
      console.error('Protobuf cycle failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Render original component for comparison
  useEffect(() => {
    if (originalRef.current) {
      const root = (globalThis as any).ReactDOM?.createRoot?.(originalRef.current);
      if (root) {
        root.render(React.createElement(ComponentToTest, componentProps));
      }
    }
  }, [ComponentToTest, componentProps]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Protobuf Preview - Ham Radio Transmission Test</h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={testProtobufCycle}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: isLoading ? '#666' : '#0f0',
            color: isLoading ? '#ccc' : '#000',
            border: '1px solid #0f0',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Testing...' : 'Test Protobuf Cycle'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#f00', marginBottom: '20px', padding: '10px', border: '1px solid #f00' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {renderStats && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #0ff', backgroundColor: '#001' }}>
          <h3>Transmission Stats</h3>
          <ul>
            <li><strong>Component:</strong> {renderStats.componentType}</li>
            <li><strong>Original Size:</strong> {renderStats.originalSize} bytes (JSON equivalent)</li>
            <li><strong>Protobuf Size:</strong> {renderStats.compressedSize} bytes</li>
            <li><strong>Compression:</strong> {renderStats.ratio.toFixed(2)}x smaller</li>
            <li><strong>Bandwidth Saved:</strong> {((1 - renderStats.compressedSize / renderStats.originalSize) * 100).toFixed(1)}%</li>
          </ul>
        </div>
      )}

      {protobufData && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ff0', backgroundColor: '#110' }}>
          <h3>Protobuf Data (Binary)</h3>
          <div style={{ fontSize: '12px', wordBreak: 'break-all', maxHeight: '100px', overflow: 'auto' }}>
            {Array.from(protobufData.protobufData).map(byte => byte.toString(16).padStart(2, '0')).join(' ')}
          </div>
          <p><strong>Schema ID:</strong> {protobufData.componentSchema}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3>Original Component</h3>
          <div
            ref={originalRef}
            style={{
              border: '1px solid #0f0',
              padding: '10px',
              minHeight: '100px',
              backgroundColor: '#001'
            }}
          />
        </div>

        <div>
          <h3>After Protobuf Transmission</h3>
          <div
            ref={decompressedRef}
            style={{
              border: '1px solid #f0f',
              padding: '10px',
              minHeight: '100px',
              backgroundColor: '#001'
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
        <h4>How it works:</h4>
        <ol>
          <li>Component is rendered to protobuf binary data (not HTML)</li>
          <li>Only component type and props are transmitted over radio</li>
          <li>Receiving station reconstructs component using local PWA components</li>
          <li>Massive bandwidth savings compared to full HTML</li>
        </ol>
      </div>
    </div>
  );
};

// Example usage components
export const TestCardPreview: React.FC = () => (
  <ProtobufPreview
    ComponentToTest={TestCard}
    componentProps={{
      title: "QSO with W2ABC",
      content: "Great contact on 20 meters, 59 both ways. Station running 100W into dipole at 30ft.",
      count: 42
    }}
    componentType="TestCard"
  />
);

export const TestFormPreview: React.FC = () => (
  <ProtobufPreview
    ComponentToTest={TestForm}
    componentProps={{
      fields: [
        { name: "Callsign", type: "text", value: "KA1ABC" },
        { name: "Frequency", type: "number", value: 14.205 },
        { name: "Mode", type: "text", value: "QPSK" },
        { name: "Power", type: "number", value: 100 }
      ]
    }}
    componentType="TestForm"
  />
);

export const TestQSOLogPreview: React.FC = () => (
  <ProtobufPreview
    ComponentToTest={TestQSOLog}
    componentProps={{
      callsign: "W2DEF",
      frequency: 21.205,
      mode: "QPSK",
      rst: "599"
    }}
    componentType="TestQSOLog"
  />
);