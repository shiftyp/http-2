import React, { forwardRef } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { PageComponent, ComponentType, GridLayout, GridPosition } from '../../pages/PageBuilder';

// Simple markdown to JSX renderer
const renderMarkdownContent = (markdown: string): JSX.Element[] => {
  const lines = markdown.split('\n');
  const elements: JSX.Element[] = [];
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // Headings
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      const HeadingTag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      elements.push(
        React.createElement(HeadingTag, {
          key: `heading-${currentIndex++}`,
          className: `font-bold mb-2 ${level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm'}`
        }, content)
      );
    }
    // Tables
    else if (line.includes('|') && lines[i + 1]?.includes('|')) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].includes('|')) {
        const tableLine = lines[j].trim();
        if (!tableLine.match(/^\|[\s\-\|]+\|$/)) { // Skip separator rows
          tableLines.push(tableLine);
        }
        j++;
      }

      if (tableLines.length > 0) {
        const rows = tableLines.map(row =>
          row.split('|').map(cell => cell.trim()).filter(cell => cell)
        );

        elements.push(
          <table key={`table-${currentIndex++}`} className="border-collapse border border-gray-600 mb-2 text-xs">
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="border border-gray-600 px-2 py-1">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      i = j - 1;
    }
    // Lists
    else if (line.startsWith('-') || line.startsWith('*')) {
      const listItems: string[] = [];
      let j = i;
      while (j < lines.length && (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('*'))) {
        listItems.push(lines[j].trim().replace(/^[\-\*]\s*/, ''));
        j++;
      }

      elements.push(
        <ul key={`list-${currentIndex++}`} className="list-disc list-inside mb-2 space-y-1">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm">{item}</li>
          ))}
        </ul>
      );
      i = j - 1;
    }
    // Links
    else if (line.includes('[') && line.includes('](')) {
      const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const [, linkText, url] = linkMatch;
        elements.push(
          <a key={`link-${currentIndex++}`} href={url} className="text-blue-400 hover:underline block mb-2">
            {linkText}
          </a>
        );
      }
    }
    // Regular paragraphs
    else {
      let content = line;
      // Process bold and italic
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

      elements.push(
        <p key={`paragraph-${currentIndex++}`} className="mb-2 text-sm"
           dangerouslySetInnerHTML={{ __html: content }} />
      );
    }
  }

  return elements;
};

interface GridCellProps {
  row: number;
  col: number;
  occupied: boolean;
}

const GridCell: React.FC<GridCellProps> = ({ row, col, occupied }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${row}-${col}`,
    data: {
      gridPosition: { row, col, rowSpan: 1, colSpan: 1 }
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        border border-gray-700 border-dashed
        ${occupied ? 'bg-gray-800' : 'bg-gray-900'}
        ${isOver ? 'bg-blue-900 bg-opacity-50 border-blue-500' : ''}
        hover:bg-gray-800 transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500
      `}
      style={{
        gridRow: row,
        gridColumn: col,
        minHeight: '40px'
      }}
      role="button"
      tabIndex={0}
      aria-label={`Grid cell ${row}, ${col}${occupied ? ' (occupied)' : ' (empty)'}`}
    />
  );
};

interface DraggableComponentProps {
  component: PageComponent;
  selected: boolean;
  onSelect: () => void;
  onResize?: (id: string, newGridArea: GridPosition) => void;
}

const DraggableComponentView: React.FC<DraggableComponentProps> = ({
  component,
  selected,
  onSelect,
  onResize
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: component.id,
    data: { component }
  });

  const style = {
    gridRow: `${component.gridArea.row} / span ${component.gridArea.rowSpan}`,
    gridColumn: `${component.gridArea.col} / span ${component.gridArea.colSpan}`,
    // Position using top-left corner instead of center
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transformOrigin: 'top left',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : selected ? 10 : 1,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none'
  };

  const renderChildComponent = (child: PageComponent, index: number, depth: number = 1) => {
    const { type, properties } = child;
    const indentClass = depth > 1 ? `ml-${Math.min(depth - 1, 4) * 2}` : '';
    const depthIndicator = depth > 1 ? `[L${depth}]` : '';

    const baseElement = (() => {
      switch (type) {
        case ComponentType.HEADING:
          return (
            <h3 key={child.id} className={`text-lg font-bold mb-2 ${indentClass}`}>
              {depthIndicator && <span className="text-xs text-gray-400 mr-1">{depthIndicator}</span>}
              {properties.content || 'Heading'}
            </h3>
          );
        case ComponentType.PARAGRAPH:
          return (
            <p key={child.id} className={`mb-2 ${indentClass}`}>
              {depthIndicator && <span className="text-xs text-gray-400 mr-1">{depthIndicator}</span>}
              {properties.content || 'Paragraph text'}
            </p>
          );
        case ComponentType.TEXT:
          return (
            <span key={child.id} className={`block mb-1 ${indentClass}`}>
              {depthIndicator && <span className="text-xs text-gray-400 mr-1">{depthIndicator}</span>}
              {properties.content || 'Text'}
            </span>
          );
        case ComponentType.BUTTON:
          return (
            <button key={child.id} className={`px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded mr-2 mb-2 ${indentClass}`}>
              {depthIndicator && <span className="text-xs text-gray-400 mr-1">{depthIndicator}</span>}
              {properties.content || 'Button'}
            </button>
          );
        case ComponentType.LINK:
          return (
            <a key={child.id} href={properties.href || '#'} className={`text-blue-400 hover:underline mr-2 mb-2 inline-block ${indentClass}`}>
              {depthIndicator && <span className="text-xs text-gray-400 mr-1">{depthIndicator}</span>}
              {properties.content || 'Link'}
            </a>
          );
        case ComponentType.INPUT:
          return (
            <div key={child.id} className={`mb-2 ${indentClass}`}>
              {depthIndicator && <div className="text-xs text-gray-400 mb-1">{depthIndicator} Input</div>}
              <input
                type={properties.type || 'text'}
                placeholder={properties.placeholder || 'Input'}
                className="px-2 py-1 bg-gray-800 border border-gray-600 rounded w-full"
              />
            </div>
          );
        case ComponentType.DIVIDER:
          return (
            <div key={child.id} className={`my-2 ${indentClass}`}>
              {depthIndicator && <div className="text-xs text-gray-400 mb-1">{depthIndicator} Divider</div>}
              <hr className="border-gray-600" />
            </div>
          );
        case ComponentType.CONTAINER:
          return (
            <div key={child.id} className={`p-2 border border-gray-600 rounded mb-2 bg-gray-800/20 ${indentClass}`}>
              <div className="text-xs text-gray-400 mb-1">
                {depthIndicator} Container ({(child.children || []).length} children)
              </div>
              {child.children && child.children.length > 0 ? (
                <div className="space-y-1">
                  {child.children.map((grandchild, grandIndex) =>
                    renderChildComponent(grandchild, grandIndex, depth + 1)
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">Empty container</div>
              )}
            </div>
          );
        case ComponentType.MARKDOWN:
          return (
            <div key={child.id} className={`mb-2 ${indentClass}`}>
              {depthIndicator && <div className="text-xs text-gray-400 mb-1">{depthIndicator} Markdown</div>}
              <pre className="p-2 bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap">
                {properties.content || 'Markdown content'}
              </pre>
            </div>
          );
        default:
          return (
            <div key={child.id} className={`mb-2 ${indentClass}`}>
              {depthIndicator && <span className="text-xs text-gray-400 mr-1">{depthIndicator}</span>}
              {properties.content || 'Component'}
            </div>
          );
      }
    })();

    // Wrap with additional nesting indicators for deep nesting
    if (depth > 2) {
      return (
        <div key={child.id} className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 to-transparent"></div>
          <div className="pl-2">{baseElement}</div>
        </div>
      );
    }

    return baseElement;
  };

  const renderComponentContent = () => {
    const { type, properties, children } = component;

    switch (type) {
      case ComponentType.HEADING:
        return <h2 className="text-xl font-bold">{properties.content || 'Heading'}</h2>;
      case ComponentType.PARAGRAPH:
        return <p>{properties.content || 'Paragraph text'}</p>;
      case ComponentType.TEXT:
        return <span>{properties.content || 'Text'}</span>;
      case ComponentType.BUTTON:
        return (
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">
            {properties.content || 'Button'}
          </button>
        );
      case ComponentType.LINK:
        return (
          <a href={properties.href || '#'} className="text-blue-400 hover:underline">
            {properties.content || 'Link'}
          </a>
        );
      case ComponentType.INPUT:
        return (
          <input
            type={properties.type || 'text'}
            placeholder={properties.placeholder || 'Input'}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded"
          />
        );
      case ComponentType.IMAGE:
        return (
          <div className="bg-gray-700 p-4 text-center rounded">
            <span className="text-3xl">🖼️</span>
            <p className="text-sm mt-2">{properties.alt || 'Image'}</p>
          </div>
        );
      case ComponentType.DIVIDER:
        return <hr className="border-gray-600" />;
      case ComponentType.FORM:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20 bg-gradient-to-br from-blue-900/10 to-purple-900/10">
            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400">🔖 Form</div>
                  <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                    {children.length} field{children.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-blue-500/30">
                  {children.map((child, index) => renderChildComponent(child, index, 1))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-600 rounded">
                <div className="mb-2">📝</div>
                <div>Form Container</div>
                <div className="text-xs mt-1">Add form fields via Properties panel</div>
              </div>
            )}
          </div>
        );
      case ComponentType.TABLE:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20 bg-gradient-to-br from-green-900/10 to-blue-900/10">
            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400">📊 Table</div>
                  <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                    {children.length} row{children.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="space-y-1 pl-2 border-l-2 border-green-500/30">
                  {children.map((child, index) => renderChildComponent(child, index, 1))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-600 rounded">
                <div className="mb-2">📊</div>
                <div>Table Structure</div>
                <div className="text-xs mt-1">Add table rows via Properties panel</div>
              </div>
            )}
          </div>
        );
      case ComponentType.LIST:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20 bg-gradient-to-br from-purple-900/10 to-pink-900/10">
            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400">📋 List</div>
                  <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                    {children.length} item{children.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <ul className="space-y-1 pl-2 border-l-2 border-purple-500/30">
                  {children.map((child, index) => (
                    <li key={child.id} className="flex items-start space-x-2">
                      <span className="text-purple-400 mt-1 text-xs">•</span>
                      <div className="flex-1">{renderChildComponent(child, index, 1)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-600 rounded">
                <div className="mb-2">📋</div>
                <div>List Structure</div>
                <div className="text-xs mt-1">Add list items via Properties panel</div>
              </div>
            )}
          </div>
        );
      case ComponentType.CONTAINER:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20 bg-gradient-to-br from-gray-800/30 to-gray-700/20 relative">
            {/* Container depth indicator */}
            <div className="absolute top-1 right-1 text-xs text-gray-500 bg-gray-800 px-1 rounded">
              L1
            </div>

            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-400">📦 Container</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                      {children.length} component{children.length !== 1 ? 's' : ''}
                    </div>
                    {children.some(child => child.children && child.children.length > 0) && (
                      <div className="text-xs text-blue-400" title="Contains nested components">
                        🔗
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 pl-3 border-l-2 border-gray-500/30">
                  {children.map((child, index) => renderChildComponent(child, index, 1))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-600 rounded">
                <div className="mb-2">📦</div>
                <div className="font-medium">Empty Container</div>
                <div className="text-xs mt-1">Drop components here or add via Properties panel</div>
              </div>
            )}
          </div>
        );
      case ComponentType.MARKDOWN:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20 bg-gray-900/50">
            <div className="text-xs text-gray-400 mb-2">📑 Markdown (rendered)</div>
            <div className="markdown-content text-sm text-white max-h-40 overflow-y-auto">
              {renderMarkdownContent(properties.content || 'Enter markdown content...')}
            </div>
          </div>
        );
      default:
        return <div>{properties.content || 'Component'}</div>;
    }
  };

  const handleResize = (direction: 'right' | 'bottom' | 'corner', event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onResize) return;

    const startMouseX = event.clientX;
    const startMouseY = event.clientY;
    const startGridArea = { ...component.gridArea };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startMouseX;
      const deltaY = e.clientY - startMouseY;

      // Convert pixel deltas to grid increments (rough approximation)
      const gridDeltaX = Math.round(deltaX / 100); // Adjust based on your grid cell size
      const gridDeltaY = Math.round(deltaY / 60);  // Adjust based on your grid cell height

      let newGridArea = { ...startGridArea };

      if (direction === 'right' || direction === 'corner') {
        newGridArea.colSpan = Math.max(1, startGridArea.colSpan + gridDeltaX);
      }
      if (direction === 'bottom' || direction === 'corner') {
        newGridArea.rowSpan = Math.max(1, startGridArea.rowSpan + gridDeltaY);
      }

      onResize(component.id, newGridArea);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(component.locked ? {} : { ...listeners, ...attributes })}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`
        relative p-2 rounded select-none
        ${component.locked ? 'cursor-not-allowed opacity-75' : 'cursor-move'}
        ${selected
          ? 'ring-2 ring-blue-500 bg-blue-900 bg-opacity-20 shadow-lg'
          : 'bg-gray-800 hover:bg-gray-700'
        }
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500
      `}
      tabIndex={0}
      role="button"
      aria-label={`${component.type} component${selected ? ' (selected)' : ''}`}
      aria-describedby={selected ? `${component.id}-description` : undefined}
    >
      {renderComponentContent()}

      {/* Component info for screen readers */}
      {selected && (
        <div id={`${component.id}-description`} className="sr-only">
          {component.type} at row {component.gridArea.row}, column {component.gridArea.col},
          spanning {component.gridArea.rowSpan} rows and {component.gridArea.colSpan} columns
        </div>
      )}

      {/* Resize handles - only show when selected */}
      {selected && !component.locked && (
        <>
          {/* Right resize handle */}
          <div
            className="absolute top-1/2 -right-1 w-2 h-6 bg-blue-500 cursor-e-resize transform -translate-y-1/2 opacity-75 hover:opacity-100 focus:opacity-100"
            onMouseDown={(e) => handleResize('right', e)}
            tabIndex={0}
            role="button"
            aria-label="Resize component width"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Could implement keyboard resizing here
              }
            }}
          />

          {/* Bottom resize handle */}
          <div
            className="absolute left-1/2 -bottom-1 w-6 h-2 bg-blue-500 cursor-s-resize transform -translate-x-1/2 opacity-75 hover:opacity-100 focus:opacity-100"
            onMouseDown={(e) => handleResize('bottom', e)}
            tabIndex={0}
            role="button"
            aria-label="Resize component height"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Could implement keyboard resizing here
              }
            }}
          />

          {/* Corner resize handle */}
          <div
            className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize opacity-75 hover:opacity-100 focus:opacity-100"
            onMouseDown={(e) => handleResize('corner', e)}
            tabIndex={0}
            role="button"
            aria-label="Resize component width and height"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Could implement keyboard resizing here
              }
            }}
          />
        </>
      )}

      {component.locked && (
        <span className="absolute top-1 right-1 text-xs" aria-label="Component is locked">🔒</span>
      )}
    </div>
  );
};

interface GridCanvasProps {
  components: PageComponent[];
  gridLayout: GridLayout;
  selectedComponent: PageComponent | null;
  onSelectComponent: (component: PageComponent | null) => void;
  onUpdateComponent: (id: string, updates: Partial<PageComponent>) => void;
}

export const GridCanvas = forwardRef<HTMLDivElement, GridCanvasProps>(
  ({ components, gridLayout, selectedComponent, onSelectComponent, onUpdateComponent }, ref) => {

    const handleResize = (id: string, newGridArea: GridPosition) => {
      onUpdateComponent(id, { gridArea: newGridArea });
    };
    // Create grid cells
    const gridCells = [];
    const occupiedCells = new Set<string>();

    // Mark occupied cells
    components.forEach(component => {
      const { row, col, rowSpan, colSpan } = component.gridArea;
      for (let r = row; r < row + rowSpan; r++) {
        for (let c = col; c < col + colSpan; c++) {
          occupiedCells.add(`${r}-${c}`);
        }
      }
    });

    // Generate grid cells for visual reference based on actual column count
    const actualColumns = gridLayout.columnSizes.length;
    for (let row = 1; row <= gridLayout.rows; row++) {
      for (let col = 1; col <= actualColumns; col++) {
        const key = `${row}-${col}`;
        gridCells.push(
          <GridCell
            key={key}
            row={row}
            col={col}
            occupied={occupiedCells.has(key)}
          />
        );
      }
    }

    return (
      <div className="relative bg-gray-900 rounded-lg p-4 min-h-[600px]">
        <div
          ref={ref}
          className="relative"
          style={{
            display: 'grid',
            gridTemplateColumns: gridLayout.columnSizes.join(' '),
            gridTemplateRows: `repeat(${gridLayout.rows}, minmax(60px, auto))`,
            gap: `${gridLayout.gap}px`,
            minHeight: '600px'
          }}
          role="grid"
          aria-label={`Design canvas with ${actualColumns} columns and ${gridLayout.rows} rows`}
          aria-describedby="grid-instructions"
        >
          {/* Grid cells for visual reference */}
          {gridCells}

          {/* Draggable components */}
          {components.map(component => (
            <DraggableComponentView
              key={component.id}
              component={component}
              selected={selectedComponent?.id === component.id}
              onSelect={() => onSelectComponent(component)}
              onResize={handleResize}
            />
          ))}
        </div>

        {/* Grid info and instructions */}
        <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
          {actualColumns}×{gridLayout.rows} Grid
        </div>

        <div id="grid-instructions" className="sr-only">
          Drag components from the palette to place them on the grid.
          Click on components to select them and modify their properties.
          Use keyboard shortcuts: Ctrl+Z to undo, Ctrl+Y to redo, Delete to remove selected component.
        </div>

        {/* Empty state message */}
        {components.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-500">
              <div className="text-6xl mb-4">📝</div>
              <div className="text-lg font-semibold mb-2">Start Building Your Page</div>
              <div className="text-sm">Drag components from the left panel to begin</div>
            </div>
          </div>
        )}

        {/* Selection indicator */}
        {selectedComponent && (
          <div className="absolute bottom-2 left-2 text-xs text-blue-400 bg-blue-900 bg-opacity-20 px-2 py-1 rounded">
            Selected: {selectedComponent.type} ({selectedComponent.gridArea.col}, {selectedComponent.gridArea.row})
          </div>
        )}
      </div>
    );
  }
);

GridCanvas.displayName = 'GridCanvas';