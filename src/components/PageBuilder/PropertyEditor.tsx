import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { PageComponent, ComponentType } from '../../pages/PageBuilder';

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
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Text Color</label>
          <Input
            value={component.style?.advanced?.color || ''}
            onChange={(e) => updateStyle('advanced', 'color', e.target.value)}
            placeholder="#ffffff or white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Background Color</label>
          <Input
            value={component.style?.advanced?.backgroundColor || ''}
            onChange={(e) => updateStyle('advanced', 'backgroundColor', e.target.value)}
            placeholder="#000000 or black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Padding</label>
          <Input
            value={component.style?.advanced?.padding || ''}
            onChange={(e) => updateStyle('advanced', 'padding', e.target.value)}
            placeholder="e.g., 10px or 10px 20px"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Margin</label>
          <Input
            value={component.style?.advanced?.margin || ''}
            onChange={(e) => updateStyle('advanced', 'margin', e.target.value)}
            placeholder="e.g., 10px or 10px 20px"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Border</label>
          <Input
            value={component.style?.advanced?.border || ''}
            onChange={(e) => updateStyle('advanced', 'border', e.target.value)}
            placeholder="e.g., 1px solid #ccc"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Custom CSS</label>
          <textarea
            value={component.style?.advanced?.customCSS || ''}
            onChange={(e) => updateStyle('advanced', 'customCSS', e.target.value)}
            placeholder="Enter custom CSS..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
            rows={4}
          />
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

  const renderChildrenProperties = () => {
    const children = component.children || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Child Components ({children.length})</h4>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addChildComponent(e.target.value as ComponentType);
                e.target.value = '';
              }
            }}
            className="text-xs px-2 py-1 bg-gray-700 border border-gray-600 rounded"
            defaultValue=""
          >
            <option value="">Add Child...</option>
            <option value={ComponentType.HEADING}>Heading</option>
            <option value={ComponentType.PARAGRAPH}>Paragraph</option>
            <option value={ComponentType.TEXT}>Text</option>
            <option value={ComponentType.BUTTON}>Button</option>
            <option value={ComponentType.LINK}>Link</option>
            <option value={ComponentType.INPUT}>Input</option>
            <option value={ComponentType.IMAGE}>Image</option>
            <option value={ComponentType.DIVIDER}>Divider</option>
          </select>
        </div>

        {children.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-600 rounded">
            No child components. Add one using the dropdown above.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {children.map((child, index) => (
              <div
                key={child.id}
                className="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    {child.type.toUpperCase()}
                  </span>
                  <span className="text-sm truncate max-w-24">
                    {child.properties?.content || child.properties?.placeholder || `${child.type} ${index + 1}`}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onSelectChild && onSelectChild(child)}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                    title="Edit this child"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeChildComponent(child.id)}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
                    title="Delete this child"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {children.length > 0 && (
          <div className="text-xs text-gray-400">
            Children inherit the parent's grid position and are rendered nested inside.
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