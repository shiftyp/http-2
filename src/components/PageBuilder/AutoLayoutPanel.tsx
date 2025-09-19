/**
 * Auto Layout Panel
 *
 * Provides intelligent layout suggestions and auto-arrangement features
 * for the Visual Page Builder.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { PageComponent, GridLayout } from '../../pages/PageBuilder';
import { AutoLayoutEngine, LayoutSuggestion, AutoLayoutOptions } from '../../lib/grid-layout/AutoLayoutEngine';

interface AutoLayoutPanelProps {
  components: PageComponent[];
  gridLayout: GridLayout;
  onApplyLayout: (suggestion: LayoutSuggestion) => void;
  onOptionsChange?: (options: AutoLayoutOptions) => void;
}

export const AutoLayoutPanel: React.FC<AutoLayoutPanelProps> = ({
  components,
  gridLayout,
  onApplyLayout,
  onOptionsChange
}) => {
  const [suggestions, setSuggestions] = useState<LayoutSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<LayoutSuggestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions] = useState<AutoLayoutOptions>({
    prioritizeReadability: true,
    minimizeWhitespace: true,
    groupRelatedComponents: true,
    respectManualPositions: false
  });

  const autoLayoutEngine = new AutoLayoutEngine();

  useEffect(() => {
    generateSuggestions();
  }, [components, gridLayout, options]);

  const generateSuggestions = async () => {
    if (components.length === 0) {
      setSuggestions([]);
      return;
    }

    setIsGenerating(true);
    try {
      // Simulate async processing for better UX
      await new Promise(resolve => setTimeout(resolve, 300));

      const newSuggestions = autoLayoutEngine.generateSuggestions(
        components,
        gridLayout,
        options
      );

      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Failed to generate layout suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOptionsChange = (newOptions: Partial<AutoLayoutOptions>) => {
    const updatedOptions = { ...options, ...newOptions };
    setOptions(updatedOptions);
    onOptionsChange?.(updatedOptions);
  };

  const handleApplySuggestion = (suggestion: LayoutSuggestion) => {
    onApplyLayout(suggestion);
    setSelectedSuggestion(null);
  };

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 80) return 'text-green-400';
    if (efficiency >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getEfficiencyBadgeVariant = (efficiency: number): 'success' | 'warning' | 'info' => {
    if (efficiency >= 80) return 'success';
    if (efficiency >= 60) return 'warning';
    return 'info';
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Auto Layout</h3>
          <Button
            onClick={generateSuggestions}
            disabled={isGenerating || components.length === 0}
            className="text-sm px-3 py-1"
          >
            {isGenerating ? '⚡ Analyzing...' : '🔄 Refresh'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Layout Options */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300">Layout Preferences</h4>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.prioritizeReadability}
                onChange={(e) => handleOptionsChange({ prioritizeReadability: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm">Prioritize readability</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.minimizeWhitespace}
                onChange={(e) => handleOptionsChange({ minimizeWhitespace: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm">Minimize whitespace</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.groupRelatedComponents}
                onChange={(e) => handleOptionsChange({ groupRelatedComponents: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm">Group related components</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.respectManualPositions}
                onChange={(e) => handleOptionsChange({ respectManualPositions: e.target.checked })}
                className="rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm">Respect manual positions</span>
            </label>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          {/* Loading State */}
          {isGenerating && (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-gray-400">Analyzing layout possibilities...</p>
            </div>
          )}

          {/* No Components */}
          {!isGenerating && components.length === 0 && (
            <Alert variant="info">
              <p>Add components to see layout suggestions</p>
            </Alert>
          )}

          {/* No Suggestions */}
          {!isGenerating && components.length > 0 && suggestions.length === 0 && (
            <Alert variant="warning">
              <p>Current layout is already optimal! No improvements suggested.</p>
            </Alert>
          )}

          {/* Layout Suggestions */}
          {!isGenerating && suggestions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-300">
                Suggestions ({suggestions.length})
              </h4>

              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedSuggestion?.id === suggestion.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="font-medium">{suggestion.name}</h5>
                      <p className="text-sm text-gray-400 mt-1">{suggestion.description}</p>
                    </div>
                    <Badge variant={getEfficiencyBadgeVariant(suggestion.efficiency)}>
                      {Math.round(suggestion.efficiency)}%
                    </Badge>
                  </div>

                  {/* Preview */}
                  {suggestion.preview && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-400 mb-1">Layout preview:</div>
                      <pre className="text-xs font-mono bg-gray-900 p-2 rounded border overflow-x-auto">
                        {suggestion.preview}
                      </pre>
                    </div>
                  )}

                  {/* Changes Summary */}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>{suggestion.changes.length} components affected</span>
                    {selectedSuggestion?.id === suggestion.id && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplySuggestion(suggestion);
                        }}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700"
                      >
                        Apply Layout
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Suggestion Details */}
          {selectedSuggestion && (
            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
              <h5 className="font-medium mb-2">Changes Preview</h5>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedSuggestion.changes.slice(0, 5).map((change, index) => (
                  <div key={index} className="text-xs">
                    <div className="font-mono text-blue-400">Component {change.componentId.slice(-8)}</div>
                    <div className="text-gray-400 pl-2">
                      {change.oldPosition.row},{change.oldPosition.col} → {change.newPosition.row},{change.newPosition.col}
                    </div>
                    <div className="text-gray-500 pl-2 italic">{change.reason}</div>
                  </div>
                ))}
                {selectedSuggestion.changes.length > 5 && (
                  <div className="text-xs text-gray-500">
                    ... and {selectedSuggestion.changes.length - 5} more changes
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {components.length > 0 && !isGenerating && (
          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  // Apply compact layout directly
                  const compactSuggestion = suggestions.find(s => s.id === 'compact-layout');
                  if (compactSuggestion) handleApplySuggestion(compactSuggestion);
                }}
                disabled={!suggestions.find(s => s.id === 'compact-layout')}
                className="text-xs py-2"
              >
                📦 Compact
              </Button>
              <Button
                onClick={() => {
                  // Apply reading flow layout directly
                  const readingSuggestion = suggestions.find(s => s.id === 'reading-flow');
                  if (readingSuggestion) handleApplySuggestion(readingSuggestion);
                }}
                disabled={!suggestions.find(s => s.id === 'reading-flow')}
                className="text-xs py-2"
              >
                📖 Reading
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AutoLayoutPanel;