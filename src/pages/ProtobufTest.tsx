/**
 * Protobuf Test Page
 * Test the complete protobuf transmission cycle for ham radio components
 */

import React, { useState } from 'react';
import {
  ProtobufPreview,
  TestCardPreview,
  TestFormPreview,
  TestQSOLogPreview,
  TestCard,
  TestForm,
  TestQSOLog
} from '../components/ProtobufPreview';

type TestComponent = 'card' | 'form' | 'qso' | 'custom';

export const ProtobufTest: React.FC = () => {
  const [activeTest, setActiveTest] = useState<TestComponent>('card');
  const [customProps, setCustomProps] = useState('{}');
  const [customPropsError, setCustomPropsError] = useState<string | null>(null);

  const parseCustomProps = () => {
    try {
      const parsed = JSON.parse(customProps);
      setCustomPropsError(null);
      return parsed;
    } catch (error) {
      setCustomPropsError(error instanceof Error ? error.message : 'Invalid JSON');
      return {};
    }
  };

  const renderTestComponent = () => {
    switch (activeTest) {
      case 'card':
        return <TestCardPreview />;
      case 'form':
        return <TestFormPreview />;
      case 'qso':
        return <TestQSOLogPreview />;
      case 'custom':
        return (
          <ProtobufPreview
            ComponentToTest={TestCard}
            componentProps={parseCustomProps()}
            componentType="CustomTestCard"
          />
        );
      default:
        return <TestCardPreview />;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#0f0',
      fontFamily: 'monospace',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h1 style={{ color: '#0ff', fontSize: '2em', marginBottom: '10px' }}>
            Protobuf Transmission Test
          </h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Test React components for ham radio transmission using protobuf compression
          </p>
        </div>

        {/* Test Selection */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            {[
              { key: 'card', label: 'QSO Card', desc: 'Contact information display' },
              { key: 'form', label: 'Form Fields', desc: 'Input form with multiple fields' },
              { key: 'qso', label: 'QSO Entry', desc: 'Single QSO log entry' },
              { key: 'custom', label: 'Custom Props', desc: 'Test with custom data' }
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setActiveTest(key as TestComponent)}
                style={{
                  padding: '10px 15px',
                  backgroundColor: activeTest === key ? '#0f0' : 'transparent',
                  color: activeTest === key ? '#000' : '#0f0',
                  border: '1px solid #0f0',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
                title={desc}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom Props Editor */}
          {activeTest === 'custom' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                Custom Props (JSON):
              </label>
              <textarea
                value={customProps}
                onChange={(e) => setCustomProps(e.target.value)}
                placeholder='{"title": "Custom Title", "content": "Custom content", "count": 123}'
                style={{
                  width: '100%',
                  height: '80px',
                  backgroundColor: '#111',
                  color: '#0f0',
                  border: '1px solid #333',
                  padding: '10px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical'
                }}
              />
              {customPropsError && (
                <div style={{ color: '#f00', fontSize: '11px', marginTop: '5px' }}>
                  {customPropsError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Component */}
        <div style={{
          border: '1px solid #333',
          borderRadius: '5px',
          backgroundColor: '#001',
          overflow: 'hidden'
        }}>
          {renderTestComponent()}
        </div>

        {/* Information Panel */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          border: '1px solid #333',
          borderRadius: '5px',
          backgroundColor: '#001'
        }}>
          <h3 style={{ color: '#0ff', marginBottom: '15px' }}>
            Ham Radio Protobuf Benefits
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '15px'
          }}>
            <div>
              <h4 style={{ color: '#ff0', fontSize: '14px', marginBottom: '5px' }}>
                Bandwidth Efficiency
              </h4>
              <p style={{ fontSize: '12px', color: '#ccc' }}>
                Protobuf typically achieves 60-80% size reduction vs JSON,
                critical for 2.8kHz ham radio bandwidth
              </p>
            </div>

            <div>
              <h4 style={{ color: '#ff0', fontSize: '14px', marginBottom: '5px' }}>
                Component Reuse
              </h4>
              <p style={{ fontSize: '12px', color: '#ccc' }}>
                Components already exist in PWA - only props/state transmitted,
                not full HTML markup
              </p>
            </div>

            <div>
              <h4 style={{ color: '#ff0', fontSize: '14px', marginBottom: '5px' }}>
                Schema Efficiency
              </h4>
              <p style={{ fontSize: '12px', color: '#ccc' }}>
                Schemas cached in PWA for known components,
                only sent once per session
              </p>
            </div>

            <div>
              <h4 style={{ color: '#ff0', fontSize: '14px', marginBottom: '5px' }}>
                Type Safety
              </h4>
              <p style={{ fontSize: '12px', color: '#ccc' }}>
                Strong typing ensures data integrity over
                noisy radio channels
              </p>
            </div>
          </div>

          <div style={{ marginTop: '20px', fontSize: '11px', color: '#666' }}>
            <strong>Transmission Flow:</strong>
            <br />
            1. Server renders React component → protobuf binary data
            <br />
            2. Binary data transmitted over radio (60-80% smaller than JSON)
            <br />
            3. Client receives binary data → reconstructs using local components
            <br />
            4. Full React component rendered in browser
          </div>
        </div>

        {/* Technical Stats */}
        <div style={{
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px'
        }}>
          <div style={{
            padding: '15px',
            border: '1px solid #333',
            borderRadius: '3px',
            backgroundColor: '#001',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', color: '#0ff', fontWeight: 'bold' }}>2.8 kHz</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Ham Radio Bandwidth</div>
          </div>

          <div style={{
            padding: '15px',
            border: '1px solid #333',
            borderRadius: '3px',
            backgroundColor: '#001',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', color: '#0ff', fontWeight: 'bold' }}>60-80%</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Size Reduction</div>
          </div>

          <div style={{
            padding: '15px',
            border: '1px solid #333',
            borderRadius: '3px',
            backgroundColor: '#001',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', color: '#0ff', fontWeight: 'bold' }}>&lt;10ms</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Encode/Decode Time</div>
          </div>

          <div style={{
            padding: '15px',
            border: '1px solid #333',
            borderRadius: '3px',
            backgroundColor: '#001',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', color: '#0ff', fontWeight: 'bold' }}>No JSON</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Pure Binary</div>
          </div>
        </div>

        <div style={{
          marginTop: '30px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#555'
        }}>
          🎯 Optimized for FCC Part 97 compliant amateur radio digital modes
          <br />
          📡 Compatible with QPSK, PSK31, and other narrow-band modes
        </div>
      </div>
    </div>
  );
};

export default ProtobufTest;