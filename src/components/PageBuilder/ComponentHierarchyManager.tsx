/**
 * Component Hierarchy Manager
 *
 * Advanced component nesting management with validation, optimization,
 * and bandwidth analysis for the Visual Page Builder.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { PageComponent, ComponentType } from '../../pages/PageBuilder';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

interface ComponentHierarchyManagerProps {
  component: PageComponent;
  onUpdate: (updates: Partial<PageComponent>) => void;
  onSelect: (component: PageComponent) => void;
  maxDepth?: number;
  maxChildrenPerLevel?: number;
  bandwidthLimit?: number;
}

interface HierarchyAnalysis {
  totalComponents: number;
  maxDepth: number;
  bandwidthEstimate: number;
  validationErrors: ValidationError[];
  performanceWarnings: PerformanceWarning[];
  optimizationSuggestions: OptimizationSuggestion[];
}

interface ValidationError {
  componentId: string;
  message: string;
  severity: 'error' | 'warning';
  path: string[];
}

interface PerformanceWarning {
  type: 'depth' | 'children' | 'bandwidth' | 'redundancy';
  message: string;
  affectedComponents: string[];
  recommendation: string;
}

interface OptimizationSuggestion {
  type: 'combine' | 'split' | 'flatten' | 'compress';
  description: string;
  estimatedSavings: number;
  priority: 'low' | 'medium' | 'high';
}

export const ComponentHierarchyManager: React.FC<ComponentHierarchyManagerProps> = ({
  component,
  onUpdate,
  onSelect,
  maxDepth = 4,
  maxChildrenPerLevel = 15,
  bandwidthLimit = 2048
}) => {
  const [activeView, setActiveView] = useState<'tree' | 'analysis' | 'optimization'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([component.id]));

  // Comprehensive hierarchy analysis
  const hierarchyAnalysis = useMemo((): HierarchyAnalysis => {
    const analysis: HierarchyAnalysis = {
      totalComponents: 0,
      maxDepth: 0,
      bandwidthEstimate: 0,
      validationErrors: [],
      performanceWarnings: [],
      optimizationSuggestions: []
    };

    const analyzeComponent = (comp: PageComponent, depth: number = 0, path: string[] = []): void => {
      analysis.totalComponents++;
      analysis.maxDepth = Math.max(analysis.maxDepth, depth);

      const currentPath = [...path, comp.id];
      const bandwidthEstimate = estimateComponentBandwidth(comp);
      analysis.bandwidthEstimate += bandwidthEstimate;

      // Validation checks
      if (depth > maxDepth) {
        analysis.validationErrors.push({
          componentId: comp.id,
          message: `Exceeds maximum depth of ${maxDepth} levels`,
          severity: 'error',
          path: currentPath
        });
      }

      if (comp.children && comp.children.length > maxChildrenPerLevel) {
        analysis.validationErrors.push({
          componentId: comp.id,
          message: `Too many children (${comp.children.length}/${maxChildrenPerLevel})`,
          severity: 'warning',
          path: currentPath
        });
      }

      // Content validation
      if (requiresContent(comp.type) && !comp.properties.content?.trim()) {
        analysis.validationErrors.push({
          componentId: comp.id,
          message: 'Content is required for this component type',
          severity: 'error',
          path: currentPath
        });
      }

      // Performance warnings
      if (comp.children && comp.children.length > 10) {
        analysis.performanceWarnings.push({
          type: 'children',
          message: `Component has many children (${comp.children.length})`,
          affectedComponents: [comp.id],
          recommendation: 'Consider breaking into multiple containers or using pagination'
        });
      }

      if (bandwidthEstimate > bandwidthLimit * 0.2) {
        analysis.performanceWarnings.push({
          type: 'bandwidth',
          message: 'Component uses significant bandwidth',
          affectedComponents: [comp.id],
          recommendation: 'Optimize content or enable compression'
        });
      }

      // Optimization suggestions
      if (comp.children && hasDuplicateContent(comp.children)) {
        analysis.optimizationSuggestions.push({
          type: 'combine',
          description: 'Detected duplicate content that could be consolidated',
          estimatedSavings: bandwidthEstimate * 0.3,
          priority: 'medium'
        });
      }

      if (depth > 2 && comp.children && comp.children.length === 1) {
        analysis.optimizationSuggestions.push({
          type: 'flatten',
          description: 'Single-child container could be flattened',
          estimatedSavings: 50,
          priority: 'low'
        });
      }

      // Recursive analysis
      if (comp.children) {
        comp.children.forEach(child => analyzeComponent(child, depth + 1, currentPath));
      }
    };

    analyzeComponent(component);
    return analysis;
  }, [component, maxDepth, maxChildrenPerLevel, bandwidthLimit]);

  const estimateComponentBandwidth = (comp: PageComponent): number => {
    const baseSize = 80; // Base component overhead
    const contentSize = (comp.properties.content || '').length * 2; // UTF-8 consideration
    const propertiesSize = JSON.stringify(comp.properties).length;
    const childrenSize = (comp.children || []).reduce((total, child) =>
      total + estimateComponentBandwidth(child), 0);

    return baseSize + contentSize + propertiesSize + childrenSize;
  };

  const requiresContent = (type: ComponentType): boolean => {
    return [
      ComponentType.HEADING,
      ComponentType.PARAGRAPH,
      ComponentType.TEXT,
      ComponentType.BUTTON,
      ComponentType.LINK
    ].includes(type);
  };

  const hasDuplicateContent = (children: PageComponent[]): boolean => {
    const contentMap = new Map<string, number>();
    children.forEach(child => {
      const content = child.properties.content || '';
      if (content.trim()) {
        contentMap.set(content, (contentMap.get(content) || 0) + 1);
      }
    });
    return Array.from(contentMap.values()).some(count => count > 1);
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderTreeNode = (comp: PageComponent, depth: number = 0): React.ReactNode => {
    const hasChildren = comp.children && comp.children.length > 0;
    const isExpanded = expandedNodes.has(comp.id);
    const indentLevel = depth * 20;
    const bandwidth = estimateComponentBandwidth(comp);
    const errors = hierarchyAnalysis.validationErrors.filter(e => e.componentId === comp.id);

    return (
      <div key={comp.id} className="relative">
        {/* Tree lines */}
        {depth > 0 && (
          <div
            className="absolute left-2 top-0 bottom-0 w-px bg-gray-600"
            style={{ left: `${indentLevel - 10}px` }}
          />
        )}

        {/* Node content */}
        <div
          className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
            comp.id === component.id
              ? 'bg-blue-900/30 border border-blue-500/50'
              : 'hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${indentLevel + 8}px` }}
          onClick={() => onSelect(comp)}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpansion(comp.id);
              }}
              className="mr-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          {!hasChildren && <div className="w-6" />}

          {/* Component icon and type */}
          <div className="flex items-center space-x-2 flex-1">
            <span className="text-lg">
              {getComponentIcon(comp.type)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {comp.type.toUpperCase()}
                </Badge>
                <span className="truncate text-sm font-medium">
                  {comp.properties.content || comp.properties.placeholder || `${comp.type} ${comp.id.slice(-4)}`}
                </span>
              </div>
              {errors.length > 0 && (
                <div className="text-xs text-red-400 mt-1">
                  {errors.map(error => error.message).join(', ')}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              {hasChildren && (
                <span className="bg-gray-700 px-2 py-1 rounded">
                  {comp.children!.length} child{comp.children!.length !== 1 ? 'ren' : ''}
                </span>
              )}
              <span className="bg-gray-700 px-2 py-1 rounded">
                {bandwidth}B
              </span>
              {errors.length > 0 && (
                <span className="text-red-400">⚠️ {errors.length}</span>
              )}
            </div>
          </div>
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {comp.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getComponentIcon = (type: ComponentType): string => {
    const icons = {
      [ComponentType.HEADING]: '📝',
      [ComponentType.PARAGRAPH]: '📄',
      [ComponentType.TEXT]: '🔤',
      [ComponentType.BUTTON]: '🔘',
      [ComponentType.LINK]: '🔗',
      [ComponentType.INPUT]: '📝',
      [ComponentType.IMAGE]: '🖼️',
      [ComponentType.FORM]: '📋',
      [ComponentType.TABLE]: '📊',
      [ComponentType.LIST]: '📋',
      [ComponentType.CONTAINER]: '📦',
      [ComponentType.DIVIDER]: '➖',
      [ComponentType.MARKDOWN]: '📑',
      [ComponentType.RICH_MEDIA]: '🎥'
    };
    return icons[type] || '🔧';
  };

  const renderAnalysisView = () => (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{hierarchyAnalysis.totalComponents}</div>
            <div className="text-sm text-gray-400">Total Components</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{hierarchyAnalysis.maxDepth}</div>
            <div className="text-sm text-gray-400">Max Depth</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">{hierarchyAnalysis.bandwidthEstimate}B</div>
            <div className="text-sm text-gray-400">Bandwidth Usage</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{hierarchyAnalysis.validationErrors.length}</div>
            <div className="text-sm text-gray-400">Issues Found</div>
          </CardContent>
        </Card>
      </div>

      {/* Validation errors */}
      {hierarchyAnalysis.validationErrors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Validation Issues</h4>
          <div className="space-y-2">
            {hierarchyAnalysis.validationErrors.map((error, index) => (
              <Alert key={index} variant={error.severity === 'error' ? 'error' : 'warning'}>
                <div className="text-sm">
                  <strong>{error.message}</strong>
                  <div className="text-xs mt-1 opacity-75">
                    Path: {error.path.join(' → ')}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Performance warnings */}
      {hierarchyAnalysis.performanceWarnings.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Performance Warnings</h4>
          <div className="space-y-2">
            {hierarchyAnalysis.performanceWarnings.map((warning, index) => (
              <Alert key={index} variant="warning">
                <div className="text-sm">
                  <strong>{warning.message}</strong>
                  <div className="text-xs mt-1 opacity-75">
                    Recommendation: {warning.recommendation}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderOptimizationView = () => (
    <div className="space-y-4">
      {hierarchyAnalysis.optimizationSuggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">✨</div>
          <div className="font-medium">Component hierarchy is well optimized!</div>
          <div className="text-sm mt-1">No optimization suggestions at this time.</div>
        </div>
      ) : (
        <div>
          <h4 className="text-sm font-medium mb-4">Optimization Suggestions</h4>
          <div className="space-y-3">
            {hierarchyAnalysis.optimizationSuggestions.map((suggestion, index) => (
              <Card key={index} className={`border-l-4 ${
                suggestion.priority === 'high' ? 'border-red-400' :
                suggestion.priority === 'medium' ? 'border-yellow-400' : 'border-green-400'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}>
                          {suggestion.priority.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{suggestion.type}</span>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">{suggestion.description}</div>
                      <div className="text-xs text-green-400">
                        Estimated savings: ~{Math.round(suggestion.estimatedSavings)}B
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="ml-4">
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Component Hierarchy</h3>
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveView('tree')}
              className={`px-3 py-1 rounded text-sm ${
                activeView === 'tree'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setActiveView('analysis')}
              className={`px-3 py-1 rounded text-sm ${
                activeView === 'analysis'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Analysis
            </button>
            <button
              onClick={() => setActiveView('optimization')}
              className={`px-3 py-1 rounded text-sm ${
                activeView === 'optimization'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Optimize
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="h-full overflow-auto">
        {activeView === 'tree' && (
          <div className="space-y-1">
            {renderTreeNode(component)}
          </div>
        )}
        {activeView === 'analysis' && renderAnalysisView()}
        {activeView === 'optimization' && renderOptimizationView()}
      </CardContent>
    </Card>
  );
};