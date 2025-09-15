import React, { useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ComponentType } from '../../pages/PageBuilder';

interface DraggableComponentProps {
  type: ComponentType;
  label: string;
  icon: string;
  onKeyboardInsert?: (type: ComponentType) => void;
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ type, label, icon, onKeyboardInsert }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: {
      isNew: true,
      type
    }
  });

  useEffect(() => {
    console.log('🔧 ComponentPalette Item:', type, { hasListeners: !!listeners, isDragging });
  }, [type, listeners, isDragging]);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none'
  } : {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none'
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onKeyboardInsert?.(type);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center space-x-2 p-3 bg-gray-800 hover:bg-gray-700 focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 rounded cursor-move transition-colors select-none"
      tabIndex={0}
      role="button"
      aria-label={`Add ${label} component. Press Enter or Space to insert, or drag to position on grid.`}
      onKeyDown={handleKeyDown}
    >
      <span className="text-xl" aria-hidden="true">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
};

interface ComponentPaletteProps {
  onKeyboardInsert?: (type: ComponentType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onKeyboardInsert }) => {
  const components = [
    { type: ComponentType.HEADING, label: 'Heading', icon: '📝' },
    { type: ComponentType.PARAGRAPH, label: 'Paragraph', icon: '📄' },
    { type: ComponentType.TEXT, label: 'Text', icon: '✏️' },
    { type: ComponentType.BUTTON, label: 'Button', icon: '🔘' },
    { type: ComponentType.LINK, label: 'Link', icon: '🔗' },
    { type: ComponentType.IMAGE, label: 'Image', icon: '🖼️' },
    { type: ComponentType.FORM, label: 'Form', icon: '📋' },
    { type: ComponentType.INPUT, label: 'Input', icon: '⌨️' },
    { type: ComponentType.TABLE, label: 'Table', icon: '📊' },
    { type: ComponentType.LIST, label: 'List', icon: '📝' },
    { type: ComponentType.CONTAINER, label: 'Container', icon: '📦' },
    { type: ComponentType.DIVIDER, label: 'Divider', icon: '➖' }
  ];

  return (
    <div className="space-y-2" role="toolbar" aria-label="Component Palette">
      <div className="text-xs text-gray-400 mb-3 px-1">
        Drag to position or press Enter/Space to insert at next available grid cell
      </div>
      {components.map(({ type, label, icon }) => (
        <DraggableComponent
          key={type}
          type={type}
          label={label}
          icon={icon}
          onKeyboardInsert={onKeyboardInsert}
        />
      ))}
    </div>
  );
};