import React, { forwardRef } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { PageComponent, ComponentType, GridLayout } from '../../pages/PageBuilder';

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

  const renderChildComponent = (child: PageComponent, index: number) => {
    const { type, properties } = child;

    switch (type) {
      case ComponentType.HEADING:
        return <h3 key={child.id} className="text-lg font-bold mb-2">{properties.content || 'Heading'}</h3>;
      case ComponentType.PARAGRAPH:
        return <p key={child.id} className="mb-2">{properties.content || 'Paragraph text'}</p>;
      case ComponentType.TEXT:
        return <span key={child.id} className="block mb-1">{properties.content || 'Text'}</span>;
      case ComponentType.BUTTON:
        return (
          <button key={child.id} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded mr-2 mb-2">
            {properties.content || 'Button'}
          </button>
        );
      case ComponentType.LINK:
        return (
          <a key={child.id} href={properties.href || '#'} className="text-blue-400 hover:underline mr-2 mb-2 inline-block">
            {properties.content || 'Link'}
          </a>
        );
      case ComponentType.INPUT:
        return (
          <input
            key={child.id}
            type={properties.type || 'text'}
            placeholder={properties.placeholder || 'Input'}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded mr-2 mb-2 block w-full"
          />
        );
      case ComponentType.DIVIDER:
        return <hr key={child.id} className="border-gray-600 my-2" />;
      default:
        return <div key={child.id} className="mb-2">{properties.content || 'Component'}</div>;
    }
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
          <div className="p-4 border border-gray-600 rounded min-h-20">
            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 mb-2">Form</div>
                {children.map((child, index) => renderChildComponent(child, index))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">
                Form Container - Add children via Properties panel
              </div>
            )}
          </div>
        );
      case ComponentType.TABLE:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20">
            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 mb-2">Table</div>
                {children.map((child, index) => renderChildComponent(child, index))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">
                Table - Add children via Properties panel
              </div>
            )}
          </div>
        );
      case ComponentType.LIST:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20">
            {children && children.length > 0 ? (
              <ul className="space-y-1">
                <div className="text-xs text-gray-400 mb-2">List</div>
                {children.map((child, index) => (
                  <li key={child.id} className="flex items-center">
                    <span className="mr-2">•</span>
                    {renderChildComponent(child, index)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">
                List - Add children via Properties panel
              </div>
            )}
          </div>
        );
      case ComponentType.CONTAINER:
        return (
          <div className="p-4 border border-gray-600 rounded min-h-20 bg-gray-800/30">
            {children && children.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 mb-2">Container ({children.length} children)</div>
                {children.map((child, index) => renderChildComponent(child, index))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-600">
                Container - Drop components here or add via Properties panel
              </div>
            )}
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

    // Generate grid cells for visual reference
    for (let row = 1; row <= gridLayout.rows; row++) {
      for (let col = 1; col <= gridLayout.columns; col++) {
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
            gridTemplateColumns: `repeat(${gridLayout.columns}, 1fr)`,
            gridTemplateRows: `repeat(${gridLayout.rows}, minmax(60px, auto))`,
            gap: `${gridLayout.gap}px`,
            minHeight: '600px'
          }}
          role="grid"
          aria-label={`Design canvas with ${gridLayout.columns} columns and ${gridLayout.rows} rows`}
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
          {gridLayout.columns}×{gridLayout.rows} Grid
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