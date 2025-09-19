/**
 * Bandwidth Monitor
 *
 * Advanced bandwidth monitoring and optimization suggestions for the
 * Visual Page Builder, specifically optimized for amateur radio transmission.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { PageComponent, ComponentType } from '../../pages/PageBuilder';
import { HamRadioCompressor } from '../../lib/compression';

interface BandwidthAnalysis {
  totalSize: number;
  compressedSize: number;
  compressionRatio: number;
  transmissionTime: {
    qpsk2400: number;   // seconds at 2400 bps
    qpsk14400: number;  // seconds at 14400 bps
    ofdm100k: number;   // seconds at 100 kbps
  };
  componentBreakdown: ComponentAnalysis[];
  optimizationSuggestions: OptimizationSuggestion[];
  bandwidthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  isWithinLimits: {
    rf: boolean;      // 2KB limit
    webrtc: boolean;  // 1MB limit
  };
}

interface ComponentAnalysis {
  id: string;
  type: ComponentType;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  percentOfTotal: number;
  optimizationPotential: number; // 0-100
  suggestions: string[];
}

interface OptimizationSuggestion {
  type: 'compression' | 'removal' | 'simplification' | 'splitting';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings: number; // bytes
  affectedComponents: string[];
  autoApplicable: boolean;
}

interface BandwidthMonitorProps {
  components: PageComponent[];
  transmissionMode: 'rf' | 'webrtc' | 'hybrid';
  onOptimizationApply?: (suggestion: OptimizationSuggestion) => void;
  onComponentOptimize?: (componentId: string, optimizations: string[]) => void;
}

export const BandwidthMonitor: React.FC<BandwidthMonitorProps> = ({
  components,
  transmissionMode,
  onOptimizationApply,
  onComponentOptimize
}) => {
  const [analysis, setAnalysis] = useState<BandwidthAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'components' | 'suggestions'>('overview');
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(false);

  const compressor = useMemo(() => new HamRadioCompressor(), []);

  const bandwidthLimits = {
    rf: 2048,      // 2KB for RF mode
    webrtc: 1048576, // 1MB for WebRTC mode
    hybrid: 2048   // Use RF limits for hybrid mode
  };

  useEffect(() => {
    analyzeComponents();
  }, [components, transmissionMode]);

  const analyzeComponents = async () => {
    if (components.length === 0) {
      setAnalysis(null);
      return;
    }

    setIsAnalyzing(true);

    try {
      // Simulate analysis delay for better UX
      await new Promise(resolve => setTimeout(resolve, 200));

      const componentAnalyses: ComponentAnalysis[] = [];
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;

      // Analyze each component
      for (const component of components) {
        const componentData = JSON.stringify(component);
        const originalSize = new TextEncoder().encode(componentData).length;

        // Use ham radio compressor
        const compressed = await compressor.compress(componentData);
        const compressedSize = compressed.compressedSize;

        const analysis: ComponentAnalysis = {
          id: component.id,
          type: component.type,
          originalSize,
          compressedSize,
          compressionRatio: originalSize / compressedSize,
          percentOfTotal: 0, // Will be calculated after totals
          optimizationPotential: calculateOptimizationPotential(component),
          suggestions: generateComponentSuggestions(component, originalSize, compressedSize)
        };

        componentAnalyses.push(analysis);
        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;
      }

      // Calculate percentages
      componentAnalyses.forEach(analysis => {
        analysis.percentOfTotal = (analysis.compressedSize / totalCompressedSize) * 100;
      });

      // Generate optimization suggestions
      const optimizationSuggestions = generateOptimizationSuggestions(
        componentAnalyses,
        totalCompressedSize,
        bandwidthLimits[transmissionMode]
      );

      // Calculate transmission times
      const transmissionTime = {
        qpsk2400: totalCompressedSize * 8 / 2400,
        qpsk14400: totalCompressedSize * 8 / 14400,
        ofdm100k: totalCompressedSize * 8 / 100000
      };

      // Determine bandwidth grade
      const limit = bandwidthLimits[transmissionMode];
      const usage = totalCompressedSize / limit;
      let bandwidthGrade: 'A' | 'B' | 'C' | 'D' | 'F';

      if (usage <= 0.5) bandwidthGrade = 'A';
      else if (usage <= 0.7) bandwidthGrade = 'B';
      else if (usage <= 0.9) bandwidthGrade = 'C';
      else if (usage <= 1.0) bandwidthGrade = 'D';
      else bandwidthGrade = 'F';

      const result: BandwidthAnalysis = {
        totalSize: totalOriginalSize,
        compressedSize: totalCompressedSize,
        compressionRatio: totalOriginalSize / totalCompressedSize,
        transmissionTime,
        componentBreakdown: componentAnalyses,
        optimizationSuggestions,
        bandwidthGrade,
        isWithinLimits: {
          rf: totalCompressedSize <= bandwidthLimits.rf,
          webrtc: totalCompressedSize <= bandwidthLimits.webrtc
        }
      };

      setAnalysis(result);

      // Auto-apply optimizations if enabled
      if (autoOptimizeEnabled && optimizationSuggestions.some(s => s.autoApplicable)) {
        const autoSuggestions = optimizationSuggestions.filter(s => s.autoApplicable && s.priority === 'high');
        for (const suggestion of autoSuggestions.slice(0, 2)) { // Limit to 2 auto-optimizations
          onOptimizationApply?.(suggestion);
        }
      }

    } catch (error) {
      console.error('Failed to analyze bandwidth:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateOptimizationPotential = (component: PageComponent): number => {
    let potential = 0;

    // Check for optimization opportunities
    if (component.properties.content && component.properties.content.length > 500) {
      potential += 30; // Long text can be compressed more
    }

    if (component.type === ComponentType.IMAGE && !component.properties.optimized) {
      potential += 50; // Images have high optimization potential
    }

    if (component.children && component.children.length > 5) {
      potential += 20; // Complex nesting can be simplified
    }

    if (component.style?.advanced?.customCSS) {
      potential += 15; // Custom CSS can be optimized
    }

    return Math.min(100, potential);
  };

  const generateComponentSuggestions = (
    component: PageComponent,
    originalSize: number,
    compressedSize: number
  ): string[] => {
    const suggestions: string[] = [];

    if (originalSize > 1000) {
      suggestions.push('Consider splitting into smaller components');
    }

    if (component.type === ComponentType.IMAGE) {
      suggestions.push('Optimize image compression and format');
    }

    if (component.properties.content && component.properties.content.length > 500) {
      suggestions.push('Shorten content or use abbreviations');
    }

    if (component.style?.advanced?.customCSS) {
      suggestions.push('Simplify custom CSS styles');
    }

    if (compressedSize / originalSize > 0.8) {
      suggestions.push('Content is not compressing well - consider restructuring');
    }

    return suggestions;
  };

  const generateOptimizationSuggestions = (
    components: ComponentAnalysis[],
    totalSize: number,
    limit: number
  ): OptimizationSuggestion[] => {
    const suggestions: OptimizationSuggestion[] = [];

    // If over limit, suggest removing largest components
    if (totalSize > limit) {
      const largest = components
        .sort((a, b) => b.compressedSize - a.compressedSize)
        .slice(0, 3);

      suggestions.push({
        type: 'removal',
        priority: 'high',
        title: 'Remove Large Components',
        description: `Remove or simplify the largest components to fit within ${formatBytes(limit)} limit`,
        potentialSavings: largest.reduce((sum, c) => sum + c.compressedSize, 0),
        affectedComponents: largest.map(c => c.id),
        autoApplicable: false
      });
    }

    // Suggest compression for poorly compressing components
    const poorCompression = components.filter(c => c.compressionRatio < 2);
    if (poorCompression.length > 0) {
      suggestions.push({
        type: 'compression',
        priority: 'medium',
        title: 'Improve Compression',
        description: 'Some components are not compressing well and could be optimized',
        potentialSavings: poorCompression.reduce((sum, c) => sum + c.compressedSize * 0.3, 0),
        affectedComponents: poorCompression.map(c => c.id),
        autoApplicable: true
      });
    }

    // Suggest simplification for complex components
    const complex = components.filter(c => c.optimizationPotential > 50);
    if (complex.length > 0) {
      suggestions.push({
        type: 'simplification',
        priority: 'medium',
        title: 'Simplify Complex Components',
        description: 'Reduce complexity of components with high optimization potential',
        potentialSavings: complex.reduce((sum, c) => sum + c.compressedSize * 0.2, 0),
        affectedComponents: complex.map(c => c.id),
        autoApplicable: false
      });
    }

    return suggestions.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      case 'F': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getBadgeVariant = (grade: string): 'success' | 'warning' | 'danger' | 'info' => {
    switch (grade) {
      case 'A': case 'B': return 'success';
      case 'C': return 'warning';
      case 'D': case 'F': return 'danger';
      default: return 'info';
    }
  };

  if (!analysis && !isAnalyzing) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-400">Add components to see bandwidth analysis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bandwidth Monitor</h3>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-1 text-xs">
              <input
                type="checkbox"
                checked={autoOptimizeEnabled}
                onChange={(e) => setAutoOptimizeEnabled(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span>Auto-optimize</span>
            </label>
            <Button
              onClick={analyzeComponents}
              disabled={isAnalyzing}
              className="text-sm px-3 py-1"
            >
              {isAnalyzing ? '📊 Analyzing...' : '🔄 Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800 rounded p-1">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'components', label: '🧩 Components' },
            { id: 'suggestions', label: '💡 Optimize' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                selectedView === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isAnalyzing && (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">Analyzing bandwidth usage...</p>
          </div>
        )}

        {analysis && !isAnalyzing && (
          <>
            {/* Overview Tab */}
            {selectedView === 'overview' && (
              <div className="space-y-4">
                {/* Grade and Status */}
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getGradeColor(analysis.bandwidthGrade)} mb-2`}>
                    {analysis.bandwidthGrade}
                  </div>
                  <Badge variant={getBadgeVariant(analysis.bandwidthGrade)}>
                    {analysis.isWithinLimits[transmissionMode] ? 'Within Limits' : 'Over Limit'}
                  </Badge>
                </div>

                {/* Size Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 p-3 rounded">
                    <div className="text-sm text-gray-400">Compressed Size</div>
                    <div className="text-lg font-semibold">{formatBytes(analysis.compressedSize)}</div>
                    <div className="text-xs text-gray-500">
                      Limit: {formatBytes(bandwidthLimits[transmissionMode])}
                    </div>
                  </div>

                  <div className="bg-gray-800 p-3 rounded">
                    <div className="text-sm text-gray-400">Compression</div>
                    <div className="text-lg font-semibold">{analysis.compressionRatio.toFixed(1)}x</div>
                    <div className="text-xs text-gray-500">
                      {formatBytes(analysis.totalSize)} → {formatBytes(analysis.compressedSize)}
                    </div>
                  </div>
                </div>

                {/* Transmission Times */}
                <div>
                  <div className="text-sm font-medium mb-2">Transmission Time</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>QPSK 2400 bps:</span>
                      <span className="font-mono">{formatTime(analysis.transmissionTime.qpsk2400)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>QPSK 14400 bps:</span>
                      <span className="font-mono">{formatTime(analysis.transmissionTime.qpsk14400)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>OFDM 100 kbps:</span>
                      <span className="font-mono">{formatTime(analysis.transmissionTime.ofdm100k)}</span>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {!analysis.isWithinLimits[transmissionMode] && (
                  <Alert variant="warning">
                    <p>Page exceeds {transmissionMode.toUpperCase()} bandwidth limit. Consider optimizing or removing components.</p>
                  </Alert>
                )}
              </div>
            )}

            {/* Components Tab */}
            {selectedView === 'components' && (
              <div className="space-y-3">
                {analysis.componentBreakdown
                  .sort((a, b) => b.compressedSize - a.compressedSize)
                  .map((component) => (
                    <div key={component.id} className="bg-gray-800 p-3 rounded">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {component.type} ({component.id.slice(-8)})
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatBytes(component.compressedSize)} ({component.percentOfTotal.toFixed(1)}%)
                          </div>
                        </div>
                        <Badge variant={component.optimizationPotential > 50 ? 'warning' : 'info'}>
                          {component.optimizationPotential}% opt
                        </Badge>
                      </div>

                      {component.suggestions.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-400 mb-1">Suggestions:</div>
                          <ul className="text-xs space-y-1">
                            {component.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-gray-300">• {suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Suggestions Tab */}
            {selectedView === 'suggestions' && (
              <div className="space-y-3">
                {analysis.optimizationSuggestions.length === 0 ? (
                  <Alert variant="success">
                    <p>No optimizations needed! Your page is already well optimized.</p>
                  </Alert>
                ) : (
                  analysis.optimizationSuggestions.map((suggestion, index) => (
                    <div key={index} className="bg-gray-800 p-3 rounded">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">{suggestion.title}</span>
                            <Badge variant={
                              suggestion.priority === 'high' ? 'danger' :
                              suggestion.priority === 'medium' ? 'warning' : 'info'
                            }>
                              {suggestion.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {suggestion.description}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-green-400">
                            -{formatBytes(suggestion.potentialSavings)}
                          </div>
                          {suggestion.autoApplicable && (
                            <Button
                              onClick={() => onOptimizationApply?.(suggestion)}
                              className="text-xs px-2 py-1 mt-1"
                            >
                              Apply
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        Affects {suggestion.affectedComponents.length} component(s)
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BandwidthMonitor;