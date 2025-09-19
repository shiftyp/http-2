import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { ColorPicker } from '../ui/ColorPicker';
import { FontSelectorExtended } from '../ui/FontSelector';
import { SpacingControls } from '../ui/SpacingControls';
import { PageComponent, ComponentType } from '../../pages/PageBuilder';
import { RichMediaComponent } from './RichMedia';

interface PropertyEditorProps {
  component: PageComponent;
  onUpdate: (updates: Partial<PageComponent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddChild?: (childComponent: PageComponent) => void;
  onRemoveChild?: (childId: string) => void;
  onSelectChild?: (childComponent: PageComponent) => void;
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  component,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddChild,
  onRemoveChild,
  onSelectChild
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'position' | 'children'>('basic');
  const [localProperties, setLocalProperties] = useState(component.properties);

  // Sync local state when component changes
  useEffect(() => {
    setLocalProperties(component.properties);
  }, [component.id]); // Only sync when component ID changes, not on every property change

  // Debounced update function
  const debouncedUpdate = useCallback(() => {
    const timeoutId = setTimeout(() => {
      onUpdate({
        properties: localProperties
      });
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [localProperties, onUpdate]);

  // Trigger debounced update when local properties change
  useEffect(() => {
    const cleanup = debouncedUpdate();
    return cleanup;
  }, [localProperties]);

  const updateProperties = (key: string, value: any) => {
    setLocalProperties(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateStyle = (category: 'basic' | 'advanced', key: string, value: any) => {
    const currentStyle = component.style || { basic: {}, advanced: {} };
    onUpdate({
      style: {
        basic: currentStyle.basic || {},
        advanced: currentStyle.advanced || {},
        [category]: {
          ...(currentStyle[category] || {}),
          [key]: value
        }
      }
    });
  };

  const updateGridArea = (key: string, value: number) => {
    onUpdate({
      gridArea: {
        ...component.gridArea,
        [key]: value
      }
    });
  };

  const addChildComponent = (type: ComponentType) => {
    const newChild: PageComponent = {
      id: `child-${Date.now()}`,
      type,
      gridArea: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
      properties: getDefaultPropsForType(type),
      style: {
        basic: {
          fontSize: 'medium',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }
    };

    const updatedChildren = [...(component.children || []), newChild];
    onUpdate({ children: updatedChildren });
  };

  const removeChildComponent = (childId: string) => {
    const updatedChildren = (component.children || []).filter(child => child.id !== childId);
    onUpdate({ children: updatedChildren });
    if (onRemoveChild) onRemoveChild(childId);
  };

  const getDefaultPropsForType = (type: ComponentType) => {
    switch (type) {
      case ComponentType.HEADING:
        return { content: 'New Heading' };
      case ComponentType.TEXT:
      case ComponentType.PARAGRAPH:
        return { content: 'Enter your text here...' };
      case ComponentType.BUTTON:
        return { content: 'Click Me' };
      case ComponentType.LINK:
        return { content: 'Link Text', href: '#' };
      case ComponentType.INPUT:
        return { placeholder: 'Enter text...', type: 'text' };
      case ComponentType.IMAGE:
        return { alt: 'Image', src: '/placeholder.jpg' };
      case ComponentType.RICH_MEDIA:
        return { richMedia: null };
      case ComponentType.MARKDOWN:
        return {
          content: '# Sample Heading\n\nThis is a **paragraph** with some text.\n\n- List item 1\n- List item 2\n\n[Link text](https://example.com)\n\n| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'
        };
      default:
        return {};
    }
  };

  // Markdown conversion function
  const convertMarkdownToComponents = () => {
    const markdownContent = localProperties.content || '';
    const lines = markdownContent.split('\n');
    const newComponents: PageComponent[] = [];
    let currentRow = component.gridArea.row;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      // Headings (# ## ###)
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const content = line.replace(/^#+\s*/, '');

        newComponents.push({
          id: `md-heading-${Date.now()}-${i}`,
          type: ComponentType.HEADING,
          gridArea: {
            row: currentRow++,
            col: component.gridArea.col,
            rowSpan: 1,
            colSpan: component.gridArea.colSpan
          },
          properties: { content },
          style: {
            basic: {
              fontSize: level === 1 ? 'large' : level === 2 ? 'medium' : 'small',
              fontWeight: 'bold',
              textAlign: 'left'
            }
          }
        });
      }
      // Tables
      else if (line.includes('|')) {
        const tableRows: string[] = [];
        let j = i;

        // Collect all table rows
        while (j < lines.length && lines[j].trim().includes('|')) {
          const tableLine = lines[j].trim();
          if (!tableLine.match(/^\|[\s\-\|]+\|$/)) { // Skip separator rows
            tableRows.push(tableLine);
          }
          j++;
        }

        if (tableRows.length > 0) {
          // Create table content
          const tableContent = tableRows.map(row =>
            row.split('|').map(cell => cell.trim()).filter(cell => cell).join(' | ')
          ).join('\n');

          newComponents.push({
            id: `md-table-${Date.now()}-${i}`,
            type: ComponentType.TABLE,
            gridArea: {
              row: currentRow++,
              col: component.gridArea.col,
              rowSpan: 1,
              colSpan: component.gridArea.colSpan
            },
            properties: { content: tableContent },
            style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } }
          });
        }

        i = j;
        continue;
      }
      // Lists (- or * bullets)
      else if (line.startsWith('-') || line.startsWith('*')) {
        const listItems: string[] = [];
        let j = i;

        // Collect all list items
        while (j < lines.length && (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('*'))) {
          listItems.push(lines[j].trim().replace(/^[\-\*]\s*/, ''));
          j++;
        }

        if (listItems.length > 0) {
          newComponents.push({
            id: `md-list-${Date.now()}-${i}`,
            type: ComponentType.LIST,
            gridArea: {
              row: currentRow++,
              col: component.gridArea.col,
              rowSpan: 1,
              colSpan: component.gridArea.colSpan
            },
            properties: { content: listItems.join('\n') },
            style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } }
          });
        }

        i = j;
        continue;
      }
      // Links [text](url)
      else if (line.includes('[') && line.includes('](')) {
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const [, linkText, url] = linkMatch;

          newComponents.push({
            id: `md-link-${Date.now()}-${i}`,
            type: ComponentType.LINK,
            gridArea: {
              row: currentRow++,
              col: component.gridArea.col,
              rowSpan: 1,
              colSpan: component.gridArea.colSpan
            },
            properties: { content: linkText, href: url },
            style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } }
          });
        }
      }
      // Regular paragraphs
      else {
        // Process bold and italic formatting
        let content = line;
        content = content.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markers
        content = content.replace(/\*(.*?)\*/g, '$1'); // Remove italic markers

        newComponents.push({
          id: `md-paragraph-${Date.now()}-${i}`,
          type: ComponentType.PARAGRAPH,
          gridArea: {
            row: currentRow++,
            col: component.gridArea.col,
            rowSpan: 1,
            colSpan: component.gridArea.colSpan
          },
          properties: { content },
          style: { basic: { fontSize: 'medium', fontWeight: 'normal', textAlign: 'left' } }
        });
      }

      i++;
    }

    // Replace the markdown component with the converted components
    if (newComponents.length > 0) {
      onUpdate({
        children: newComponents
      });
    }
  };

  const renderBasicProperties = () => {
    const { type, properties } = component;

    return (
      <div className="space-y-4">
        {/* Common properties based on component type */}
        {(type === ComponentType.HEADING ||
          type === ComponentType.PARAGRAPH ||
          type === ComponentType.TEXT ||
          type === ComponentType.BUTTON ||
          type === ComponentType.LINK) && (
          <div>
            <label className="block text-sm font-medium mb-1">Content</label>
            <Input
              value={localProperties.content || ''}
              onChange={(e) => updateProperties('content', e.target.value)}
              placeholder="Enter content..."
            />
          </div>
        )}

        {type === ComponentType.MARKDOWN && (
          <div>
            <label className="block text-sm font-medium mb-1">Markdown Content</label>
            <textarea
              value={localProperties.content || ''}
              onChange={(e) => updateProperties('content', e.target.value)}
              placeholder="Enter markdown content..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white"
              rows={8}
            />
            <div className="mt-2 space-x-2">
              <Button
                onClick={convertMarkdownToComponents}
                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700"
              >
                Convert to Components
              </Button>
              <span className="text-xs text-gray-400">
                Converts markdown to headings, paragraphs, tables, lists, and links
              </span>
            </div>
          </div>
        )}

        {type === ComponentType.LINK && (
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <Input
              value={localProperties.href || ''}
              onChange={(e) => updateProperties('href', e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        {type === ComponentType.IMAGE && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <Input
                value={localProperties.src || ''}
                onChange={(e) => updateProperties('src', e.target.value)}
                placeholder="Image URL..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alt Text</label>
              <Input
                value={localProperties.alt || ''}
                onChange={(e) => updateProperties('alt', e.target.value)}
                placeholder="Alternative text..."
              />
            </div>
          </>
        )}

        {type === ComponentType.INPUT && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={localProperties.type || 'text'}
                onChange={(e) => updateProperties('type', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="password">Password</option>
                <option value="number">Number</option>
                <option value="tel">Phone</option>
                <option value="url">URL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Placeholder</label>
              <Input
                value={localProperties.placeholder || ''}
                onChange={(e) => updateProperties('placeholder', e.target.value)}
                placeholder="Placeholder text..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={localProperties.name || ''}
                onChange={(e) => updateProperties('name', e.target.value)}
                placeholder="Field name..."
              />
            </div>
            <div className="flex items-center space-x-2">
              <Toggle
                checked={localProperties.required || false}
                onChange={(checked) => updateProperties('required', checked)}
              />
              <label className="text-sm">Required</label>
            </div>
          </>
        )}

        {type === ComponentType.RICH_MEDIA && (
          <div>
            <label className="block text-sm font-medium mb-3">Rich Media Content</label>
            {localProperties.richMedia ? (
              <RichMediaComponent
                media={localProperties.richMedia}
                bandwidthLimit={2048} // Default bandwidth limit
                transmissionMode="hybrid"
                onCompressionChange={(level) => {
                  const updatedMedia = {
                    ...localProperties.richMedia,
                    compressionLevel: level
                  };
                  updateProperties('richMedia', updatedMedia);
                }}
                onCodecChange={(codec) => {
                  const updatedMedia = {
                    ...localProperties.richMedia,
                    codec: codec
                  };
                  updateProperties('richMedia', updatedMedia);
                }}
                onMetadataUpdate={(metadata) => {
                  const updatedMedia = {
                    ...localProperties.richMedia,
                    metadata: metadata
                  };
                  updateProperties('richMedia', updatedMedia);
                }}
              />
            ) : (
              <div className="p-4 bg-gray-800 rounded border border-gray-600 text-center">
                <p className="text-gray-400 mb-2">No media content configured</p>
                <p className="text-xs text-gray-500">
                  Use the "Add Media" button in the toolbar to upload and configure rich media content.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Text styling */}
        <div>
          <label className="block text-sm font-medium mb-1">Text Align</label>
          <select
            value={component.style?.basic.textAlign || 'left'}
            onChange={(e) => updateStyle('basic', 'textAlign', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Font Size</label>
          <select
            value={component.style?.basic.fontSize || 'medium'}
            onChange={(e) => updateStyle('basic', 'fontSize', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Font Weight</label>
          <select
            value={component.style?.basic.fontWeight || 'normal'}
            onChange={(e) => updateStyle('basic', 'fontWeight', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
      </div>
    );
  };

  const renderAdvancedProperties = () => {
    const advancedStyle = component.style?.advanced || {};

    return (
      <div className="space-y-6">
        {/* Typography */}
        <div>
          <FontSelectorExtended
            value={{
              fontFamily: advancedStyle.fontFamily,
              fontSize: advancedStyle.fontSize,
              fontWeight: advancedStyle.fontWeight,
              lineHeight: advancedStyle.lineHeight,
              letterSpacing: advancedStyle.letterSpacing
            }}
            onChange={(fontConfig) => {
              Object.entries(fontConfig).forEach(([key, value]) => {
                if (value) updateStyle('advanced', key, value);
              });
            }}
            label="Typography"
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColorPicker
            value={advancedStyle.color || ''}
            onChange={(color) => updateStyle('advanced', 'color', color)}
            label="Text Color"
            placeholder="e.g., #ffffff, white"
          />

          <ColorPicker
            value={advancedStyle.backgroundColor || ''}
            onChange={(color) => updateStyle('advanced', 'backgroundColor', color)}
            label="Background Color"
            placeholder="e.g., #000000, black"
          />
        </div>

        {/* Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpacingControls
            value={advancedStyle.padding || '0'}
            onChange={(padding) => updateStyle('advanced', 'padding', padding)}
            label="Padding"
            type="padding"
          />

          <SpacingControls
            value={advancedStyle.margin || '0'}
            onChange={(margin) => updateStyle('advanced', 'margin', margin)}
            label="Margin"
            type="margin"
          />
        </div>

        {/* Border & Effects */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">Border</label>
            <Input
              value={advancedStyle.border || ''}
              onChange={(e) => updateStyle('advanced', 'border', e.target.value)}
              placeholder="e.g., 1px solid #ccc, 2px dashed red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Border Radius</label>
              <Input
                value={advancedStyle.borderRadius || ''}
                onChange={(e) => updateStyle('advanced', 'borderRadius', e.target.value)}
                placeholder="e.g., 4px, 50%"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Box Shadow</label>
              <Input
                value={advancedStyle.boxShadow || ''}
                onChange={(e) => updateStyle('advanced', 'boxShadow', e.target.value)}
                placeholder="e.g., 0 2px 4px rgba(0,0,0,0.1)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={advancedStyle.opacity || '1'}
                onChange={(e) => updateStyle('advanced', 'opacity', e.target.value)}
                className="w-full"
              />
              <div className="text-xs text-gray-400 mt-1">
                {Math.round((parseFloat(advancedStyle.opacity || '1') * 100))}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Z-Index</label>
              <Input
                type="number"
                value={advancedStyle.zIndex || ''}
                onChange={(e) => updateStyle('advanced', 'zIndex', e.target.value)}
                placeholder="e.g., 10, 999"
              />
            </div>
          </div>
        </div>

        {/* Custom CSS */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Custom CSS</label>
          <textarea
            value={advancedStyle.customCSS || ''}
            onChange={(e) => updateStyle('advanced', 'customCSS', e.target.value)}
            placeholder="Enter custom CSS properties..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 font-mono"
            rows={4}
          />
          <div className="text-xs text-gray-400 mt-1">
            Enter CSS properties like: transform: rotate(45deg); transition: all 0.3s ease;
          </div>
        </div>
      </div>
    );
  };

  const renderPositionProperties = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Row</label>
            <Input
              type="number"
              min="1"
              max="12"
              value={component.gridArea.row}
              onChange={(e) => updateGridArea('row', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Column</label>
            <Input
              type="number"
              min="1"
              max="12"
              value={component.gridArea.col}
              onChange={(e) => updateGridArea('col', parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Row Span</label>
            <Input
              type="number"
              min="1"
              max="12"
              value={component.gridArea.rowSpan}
              onChange={(e) => updateGridArea('rowSpan', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Column Span</label>
            <Input
              type="number"
              min="1"
              max="12"
              value={component.gridArea.colSpan}
              onChange={(e) => updateGridArea('colSpan', parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Toggle
            checked={component.locked || false}
            onChange={(checked) => onUpdate({ locked: checked })}
          />
          <label className="text-sm">Lock Position</label>
        </div>
      </div>
    );
  };

  const moveChildComponent = (childId: string, direction: 'up' | 'down') => {
    const children = component.children || [];
    const currentIndex = children.findIndex(child => child.id === childId);

    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= children.length) return;

    const reorderedChildren = [...children];
    [reorderedChildren[currentIndex], reorderedChildren[newIndex]] =
      [reorderedChildren[newIndex], reorderedChildren[currentIndex]];

    onUpdate({ children: reorderedChildren });
  };

  const duplicateChildComponent = (childId: string) => {
    const children = component.children || [];
    const childToDuplicate = children.find(child => child.id === childId);

    if (!childToDuplicate) return;

    const duplicatedChild: PageComponent = {
      ...childToDuplicate,
      id: `${childToDuplicate.id}-copy-${Date.now()}`,
      children: childToDuplicate.children?.map(grandchild => ({
        ...grandchild,
        id: `${grandchild.id}-copy-${Date.now()}`
      }))
    };

    const updatedChildren = [...children, duplicatedChild];
    onUpdate({ children: updatedChildren });
  };

  const validateChildComponent = (child: PageComponent): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check for required properties
    if ((child.type === ComponentType.HEADING || child.type === ComponentType.PARAGRAPH ||
         child.type === ComponentType.TEXT || child.type === ComponentType.BUTTON) &&
        !child.properties.content) {
      errors.push('Content is required');
    }

    if (child.type === ComponentType.LINK && !child.properties.href) {
      errors.push('URL is required for links');
    }

    if (child.type === ComponentType.IMAGE && (!child.properties.src || !child.properties.alt)) {
      errors.push('Image URL and alt text are required');
    }

    // Check for nesting depth (max 3 levels)
    const getDepth = (comp: PageComponent, depth = 0): number => {
      if (!comp.children || comp.children.length === 0) return depth;
      return Math.max(...comp.children.map(child => getDepth(child, depth + 1)));
    };

    if (getDepth(child) > 2) {
      errors.push('Maximum nesting depth of 3 levels exceeded');
    }

    return { valid: errors.length === 0, errors };
  };

  const getComponentBandwidthEstimate = (child: PageComponent): number => {
    const baseSize = 50; // Base component overhead
    const contentSize = (child.properties.content || '').length;
    const childrenSize = (child.children || []).reduce((total, grandchild) =>
      total + getComponentBandwidthEstimate(grandchild), 0);

    return baseSize + contentSize + childrenSize;
  };

  const renderChildrenProperties = () => {
    const children = component.children || [];
    const totalBandwidth = children.reduce((total, child) => total + getComponentBandwidthEstimate(child), 0);
    const maxChildrenRecommended = 10; // Performance recommendation

    return (
      <div className="space-y-4">
        {/* Header with stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Child Components ({children.length})</h4>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">
                ~{totalBandwidth}B
              </span>
              {children.length > maxChildrenRecommended && (
                <span className="text-xs text-yellow-400" title="Consider reducing children for better performance">
                  ⚠️
                </span>
              )}
            </div>
          </div>

          {/* Add child controls */}
          <div className="flex items-center space-x-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addChildComponent(e.target.value as ComponentType);
                  e.target.value = '';
                }
              }}
              className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded flex-1"
              defaultValue=""
            >
              <option value="">Add Child Component...</option>
              <optgroup label="Text Components">
                <option value={ComponentType.HEADING}>Heading</option>
                <option value={ComponentType.PARAGRAPH}>Paragraph</option>
                <option value={ComponentType.TEXT}>Text</option>
              </optgroup>
              <optgroup label="Interactive Components">
                <option value={ComponentType.BUTTON}>Button</option>
                <option value={ComponentType.LINK}>Link</option>
                <option value={ComponentType.INPUT}>Input</option>
              </optgroup>
              <optgroup label="Media & Layout">
                <option value={ComponentType.IMAGE}>Image</option>
                <option value={ComponentType.DIVIDER}>Divider</option>
                <option value={ComponentType.CONTAINER}>Container</option>
              </optgroup>
            </select>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-600 rounded">
            <div className="mb-2">🧩</div>
            <div className="font-medium mb-1">No child components</div>
            <div className="text-xs">Add components to create a nested hierarchy</div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Children list with enhanced controls */}
            <div className="max-h-80 overflow-y-auto space-y-2 border border-gray-700 rounded p-2">
              {children.map((child, index) => {
                const validation = validateChildComponent(child);
                const bandwidthEstimate = getComponentBandwidthEstimate(child);

                return (
                  <div
                    key={child.id}
                    className={`p-3 rounded border transition-colors ${
                      validation.valid
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        : 'bg-red-900/20 border-red-500/50'
                    }`}
                  >
                    {/* Component header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          validation.valid ? 'bg-gray-700 text-gray-300' : 'bg-red-600 text-white'
                        }`}>
                          {child.type.toUpperCase()}
                        </span>
                        <span className="text-sm truncate max-w-32 font-medium">
                          {child.properties?.content || child.properties?.placeholder || `${child.type} ${index + 1}`}
                        </span>
                        {child.children && child.children.length > 0 && (
                          <span className="text-xs bg-blue-600 text-white px-1 rounded-full">
                            {child.children.length}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-400">{bandwidthEstimate}B</span>
                      </div>
                    </div>

                    {/* Validation errors */}
                    {!validation.valid && (
                      <div className="mb-2">
                        <div className="text-xs text-red-400 space-y-1">
                          {validation.errors.map((error, idx) => (
                            <div key={idx} className="flex items-center space-x-1">
                              <span>⚠️</span>
                              <span>{error}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {/* Move up/down */}
                        <button
                          onClick={() => moveChildComponent(child.id, 'up')}
                          disabled={index === 0}
                          className={`text-xs px-2 py-1 rounded ${
                            index === 0
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-500 text-white'
                          }`}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveChildComponent(child.id, 'down')}
                          disabled={index === children.length - 1}
                          className={`text-xs px-2 py-1 rounded ${
                            index === children.length - 1
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-500 text-white'
                          }`}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => duplicateChildComponent(child.id)}
                          className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-white"
                          title="Duplicate component"
                        >
                          📄
                        </button>
                        <button
                          onClick={() => onSelectChild && onSelectChild(child)}
                          className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                          title="Edit component"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => removeChildComponent(child.id)}
                          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
                          title="Delete component"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary information */}
            <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>Children: {children.length}</div>
                <div>Bandwidth: ~{totalBandwidth}B</div>
                <div>Max Depth: {Math.max(...children.map(child => {
                  const getDepth = (comp: PageComponent, depth = 1): number => {
                    if (!comp.children || comp.children.length === 0) return depth;
                    return Math.max(...comp.children.map(child => getDepth(child, depth + 1)));
                  };
                  return getDepth(child);
                }), 1)}</div>
                <div>Valid: {children.filter(child => validateChildComponent(child).valid).length}/{children.length}</div>
              </div>
            </div>

            {/* Performance warnings */}
            {children.length > maxChildrenRecommended && (
              <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded border border-yellow-500/30">
                ⚠️ Performance tip: Consider using fewer child components ({children.length}/{maxChildrenRecommended}) or breaking into multiple containers.
              </div>
            )}

            {totalBandwidth > 1024 && (
              <div className="text-xs text-orange-400 bg-orange-900/20 p-2 rounded border border-orange-500/30">
                📡 Bandwidth warning: Child components exceed 1KB. Consider optimizing content or using compression.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Properties</h3>
          <span className="text-sm text-gray-400">{component.type}</span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Tabs */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-3 py-1 rounded text-sm ${
              activeTab === 'basic'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Basic
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-3 py-1 rounded text-sm ${
              activeTab === 'advanced'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Advanced
          </button>
          <button
            onClick={() => setActiveTab('position')}
            className={`px-3 py-1 rounded text-sm ${
              activeTab === 'position'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Position
          </button>
          <button
            onClick={() => setActiveTab('children')}
            className={`px-3 py-1 rounded text-sm ${
              activeTab === 'children'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Children {component.children && component.children.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs px-1 rounded-full">
                {component.children.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'basic' && renderBasicProperties()}
          {activeTab === 'advanced' && renderAdvancedProperties()}
          {activeTab === 'position' && renderPositionProperties()}
          {activeTab === 'children' && renderChildrenProperties()}
        </div>

        {/* Actions */}
        <div className="mt-6 pt-6 border-t border-gray-700 space-y-2">
          <Button
            onClick={onDuplicate}
            className="w-full bg-gray-700 hover:bg-gray-600"
          >
            Duplicate Component
          </Button>
          <Button
            onClick={onDelete}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            Delete Component
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};