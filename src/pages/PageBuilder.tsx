import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  getClientRect
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { renderComponentForRadio } from '../lib/react-renderer';
import { HamRadioCompressor } from '../lib/compression';
import { ProtobufLivePreview } from '../components/ProtobufLivePreview';
import { db } from '../lib/database';
import { GridCanvas } from '../components/PageBuilder/GridCanvas';
import { ComponentPalette } from '../components/PageBuilder/ComponentPalette';
import { PropertyEditor } from '../components/PageBuilder/PropertyEditor';
import { PreviewPanel } from '../components/PageBuilder/PreviewPanel';

// Types
export interface PageComponent {
  id: string;
  type: ComponentType;
  gridArea: GridPosition;
  properties: ComponentProps;
  style?: ComponentStyle;
  children?: PageComponent[];
  locked?: boolean;
}

export enum ComponentType {
  TEXT = 'text',
  HEADING = 'heading',
  PARAGRAPH = 'paragraph',
  IMAGE = 'image',
  FORM = 'form',
  INPUT = 'input',
  BUTTON = 'button',
  LINK = 'link',
  TABLE = 'table',
  LIST = 'list',
  CONTAINER = 'container',
  DIVIDER = 'divider'
}

export interface GridPosition {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface ComponentProps {
  content?: string;
  name?: string;
  value?: any;
  placeholder?: string;
  required?: boolean;
  href?: string;
  src?: string;
  alt?: string;
  type?: string;
  [key: string]: any;
}

export interface ComponentStyle {
  basic: {
    textAlign?: 'left' | 'center' | 'right';
    fontSize?: 'small' | 'medium' | 'large';
    fontWeight?: 'normal' | 'bold';
  };
  advanced?: {
    color?: string;
    backgroundColor?: string;
    padding?: string;
    margin?: string;
    border?: string;
    customCSS?: string;
  };
}

export interface Page {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  description?: string;
  components: PageComponent[];
  layout: GridLayout;
  metadata: PageMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface GridLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: ResponsiveBreakpoint[];
}

export interface ResponsiveBreakpoint {
  maxWidth: number;
  columns: number;
  stackComponents?: boolean;
}

export interface PageMetadata {
  compressedSize: number;
  componentCount: number;
  lastValidation?: Date;
  bandwidthValid: boolean;
}

const PageBuilder: React.FC = () => {
  const [components, setComponents] = useState<PageComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<PageComponent | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('New Page');
  const [pageSlug, setPageSlug] = useState('new-page');
  const [previewMode, setPreviewMode] = useState(false);
  const [compressionStats, setCompressionStats] = useState<any>(null);
  const [undoStack, setUndoStack] = useState<PageComponent[][]>([]);
  const [redoStack, setRedoStack] = useState<PageComponent[][]>([]);
  const [ariaStatus, setAriaStatus] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  // React renderer for component-to-radio conversion with bandwidth optimization
  const compressor = new HamRadioCompressor();

  // Grid layout configuration
  const [gridLayout, setGridLayout] = useState<GridLayout>({
    columns: 12,
    rows: 12,
    gap: 8,
    responsive: [
      { maxWidth: 768, columns: 4, stackComponents: true },
      { maxWidth: 1024, columns: 8 },
      { maxWidth: 1440, columns: 12 }
    ]
  });

  // Custom collision detection using top-left corner
  const topLeftCornerCollision = (args: any) => {
    const { active, droppableContainers, pointerCoordinates } = args;

    if (!pointerCoordinates) return [];

    const collisions = [];

    for (const container of droppableContainers.values()) {
      const { rect } = container;
      if (!rect) continue;

      // Use pointer coordinates directly for top-left positioning
      if (
        pointerCoordinates.x >= rect.left &&
        pointerCoordinates.x <= rect.right &&
        pointerCoordinates.y >= rect.top &&
        pointerCoordinates.y <= rect.bottom
      ) {
        collisions.push({
          id: container.id,
          data: container.data
        });
      }
    }

    return collisions;
  };

  // Enhanced drag and drop sensors with accessibility
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Debug sensor events
  useEffect(() => {
    console.log('Sensors configured:', sensors.length);
  }, [sensors]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 DnD Context: Drag started!', event.active.id, event.active.data);
    setActiveId(event.active.id as string);
  };

  // Handle drag over (for debugging)
  const handleDragOver = (event: any) => {
    console.log('🎯 DnD Context: Drag over:', event);
  };

  // Handle drag cancel (for debugging)
  const handleDragCancel = () => {
    console.log('🎯 DnD Context: Drag cancelled');
    setActiveId(null);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    // Save state for undo
    saveUndoState();

    // Handle component drop from palette
    if (active.data.current?.isNew) {
      const newComponent: PageComponent = {
        id: `component-${Date.now()}`,
        type: active.data.current.type,
        gridArea: over.data.current?.gridPosition || { row: 1, col: 1, rowSpan: 1, colSpan: 3 },
        properties: getDefaultProps(active.data.current.type),
        style: {
          basic: {
            fontSize: 'medium',
            fontWeight: 'normal',
            textAlign: 'left'
          }
        }
      };
      setComponents([...components, newComponent]);
    }
    // Handle component reposition
    else {
      const draggedComponent = components.find(c => c.id === active.id);
      if (draggedComponent && over.data.current?.gridPosition) {
        const updatedComponents = components.map(c =>
          c.id === active.id
            ? {
                ...c,
                gridArea: {
                  ...over.data.current.gridPosition,
                  rowSpan: c.gridArea.rowSpan,
                  colSpan: c.gridArea.colSpan
                }
              }
            : c
        );
        setComponents(updatedComponents);
      }
    }

    setActiveId(null);
  };

  // Get default properties for component type
  const getDefaultProps = (type: ComponentType): ComponentProps => {
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
      default:
        return {};
    }
  };

  // Find next available grid position
  const findNextAvailablePosition = (): GridPosition => {
    const occupiedCells = new Set<string>();

    // Mark all occupied cells
    components.forEach(component => {
      const { row, col, rowSpan, colSpan } = component.gridArea;
      for (let r = row; r < row + rowSpan; r++) {
        for (let c = col; c < col + colSpan; c++) {
          occupiedCells.add(`${r}-${c}`);
        }
      }
    });

    // Find first available position
    for (let row = 1; row <= gridLayout.rows; row++) {
      for (let col = 1; col <= gridLayout.columns - 2; col++) { // Leave space for default 3-col span
        const position = { row, col, rowSpan: 1, colSpan: 3 };
        let canPlace = true;

        // Check if this position is available
        for (let r = row; r < row + position.rowSpan; r++) {
          for (let c = col; c < col + position.colSpan; c++) {
            if (c > gridLayout.columns || occupiedCells.has(`${r}-${c}`)) {
              canPlace = false;
              break;
            }
          }
          if (!canPlace) break;
        }

        if (canPlace) {
          return position;
        }
      }
    }

    // If no space found, place at end
    return { row: 1, col: 1, rowSpan: 1, colSpan: 3 };
  };

  // Handle keyboard component insertion
  const handleKeyboardInsert = (type: ComponentType) => {
    saveUndoState();

    const newComponent: PageComponent = {
      id: `component-${Date.now()}`,
      type,
      gridArea: findNextAvailablePosition(),
      properties: getDefaultProps(type),
      style: {
        basic: {
          fontSize: 'medium',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }
    };

    setComponents([...components, newComponent]);
    setSelectedComponent(newComponent); // Auto-select newly inserted component

    // Announce to screen readers
    const position = newComponent.gridArea;
    setAriaStatus(`${type} component added at row ${position.row}, column ${position.col} and selected`);
  };

  // Save state for undo
  const saveUndoState = () => {
    setUndoStack([...undoStack, [...components]]);
    setRedoStack([]);
  };

  // Focus management for property editor modal
  useEffect(() => {
    if (selectedComponent && modalRef.current) {
      // Announce modal opening
      setAriaStatus(`Properties panel opened for ${selectedComponent.type} component`);

      // Add a short delay to ensure the modal is fully rendered
      const timer = setTimeout(() => {
        const firstInput = modalRef.current?.querySelector('input, textarea, select') as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);

      // Escape key handler to close modal
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setSelectedComponent(null);
          setAriaStatus('Properties panel closed');
        }
      };

      document.addEventListener('keydown', handleEscape);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [selectedComponent]);

  // Undo action
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setRedoStack([...redoStack, [...components]]);
      setComponents(previousState);
      setUndoStack(undoStack.slice(0, -1));
      setAriaStatus('Action undone');
    }
  };

  // Redo action
  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[redoStack.length - 1];
      setUndoStack([...undoStack, [...components]]);
      setComponents(nextState);
      setRedoStack(redoStack.slice(0, -1));
      setAriaStatus('Action redone');
    }
  };

  // Update component properties
  const updateComponent = (id: string, updates: Partial<PageComponent>) => {
    saveUndoState();
    setComponents(components.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  // Count total nested children recursively
  const countNestedChildren = (component: PageComponent): number => {
    if (!component.children || component.children.length === 0) return 0;

    let count = component.children.length;
    component.children.forEach(child => {
      count += countNestedChildren(child);
    });
    return count;
  };

  // Delete component
  const deleteComponent = (id: string) => {
    const component = components.find(c => c.id === id);
    if (!component) return;

    const childCount = countNestedChildren(component);

    if (childCount > 0) {
      const message = `This component contains ${childCount} nested component${childCount === 1 ? '' : 's'}. Deleting it will also remove all nested components. Are you sure you want to continue?`;

      if (!window.confirm(message)) {
        return;
      }
    }

    saveUndoState();
    setComponents(components.filter(c => c.id !== id));
    setSelectedComponent(null);
    setAriaStatus(`${component.type} component deleted`);
  };

  // Duplicate component
  const duplicateComponent = (id: string) => {
    saveUndoState();
    const component = components.find(c => c.id === id);
    if (component) {
      const newComponent = {
        ...component,
        id: `component-${Date.now()}`,
        gridArea: {
          ...component.gridArea,
          col: Math.min(component.gridArea.col + component.gridArea.colSpan, gridLayout.columns - component.gridArea.colSpan)
        }
      };
      setComponents([...components, newComponent]);
    }
  };

  // Generate React components from page builder components
  const generateReactComponents = () => {
    return components.map((component, index) => {
      const { type, properties, style } = component;
      const styleObj = style ? generateStyleObject(style) : {};
      const key = `component-${index}`;

      switch (type) {
        case ComponentType.HEADING:
          return { type: 'heading', properties: { text: properties.content || '', style: styleObj }, key };
        case ComponentType.PARAGRAPH:
          return { type: 'paragraph', properties: { text: properties.content || '', style: styleObj }, key };
        case ComponentType.BUTTON:
          return { type: 'button', properties: { text: properties.content || '', style: styleObj }, key };
        case ComponentType.LINK:
          return { type: 'link', properties: { text: properties.content || '', href: properties.href || '#', style: styleObj }, key };
        case ComponentType.INPUT:
          return {
            type: 'input',
            properties: {
              inputType: properties.type || 'text',
              placeholder: properties.placeholder || '',
              name: properties.name || '',
              style: styleObj
            },
            key
          };
        case ComponentType.IMAGE:
          return {
            type: 'image',
            properties: {
              src: properties.src || '',
              alt: properties.alt || '',
              style: styleObj
            },
            key
          };
        case ComponentType.DIVIDER:
          return { type: 'divider', properties: { style: styleObj }, key };
        default:
          return { type: 'text', properties: { text: properties.content || '', style: styleObj }, key };
      }
    });
  };

  // Generate preview HTML (for backward compatibility)
  const generatePreview = (): string => {
    // Convert to simple HTML for preview (non-protobuf)
    const htmlElements = components.map(component => {
      const { type, properties, style } = component;
      const styleStr = style ? generateStyleString(style) : '';

      switch (type) {
        case ComponentType.HEADING:
          return `<h2 style="${styleStr}">${properties.content || ''}</h2>`;
        case ComponentType.PARAGRAPH:
          return `<p style="${styleStr}">${properties.content || ''}</p>`;
        case ComponentType.BUTTON:
          return `<button style="${styleStr}">${properties.content || ''}</button>`;
        case ComponentType.LINK:
          return `<a href="${properties.href || '#'}" style="${styleStr}">${properties.content || ''}</a>`;
        case ComponentType.INPUT:
          return `<input type="${properties.type || 'text'}" placeholder="${properties.placeholder || ''}" name="${properties.name || ''}" style="${styleStr}" />`;
        case ComponentType.IMAGE:
          return `<img src="${properties.src || ''}" alt="${properties.alt || ''}" style="${styleStr}" />`;
        case ComponentType.DIVIDER:
          return `<hr style="${styleStr}" />`;
        default:
          return `<div style="${styleStr}">${properties.content || ''}</div>`;
      }
    }).join('\n');

    return `<div class="page-container">${htmlElements}</div>`;
  };

  // Generate style object from component style (for React props)
  const generateStyleObject = (style: ComponentStyle): React.CSSProperties => {
    const styleObj: React.CSSProperties = {};

    if (style.basic.textAlign) styleObj.textAlign = style.basic.textAlign as 'left' | 'center' | 'right';
    if (style.basic.fontSize) {
      const sizes = { small: '14px', medium: '16px', large: '20px' };
      styleObj.fontSize = sizes[style.basic.fontSize];
    }
    if (style.basic.fontWeight) styleObj.fontWeight = style.basic.fontWeight;

    if (style.advanced) {
      if (style.advanced.color) styleObj.color = style.advanced.color;
      if (style.advanced.backgroundColor) styleObj.backgroundColor = style.advanced.backgroundColor;
      if (style.advanced.padding) styleObj.padding = style.advanced.padding;
      if (style.advanced.margin) styleObj.margin = style.advanced.margin;
      if (style.advanced.border) styleObj.border = style.advanced.border;
    }

    return styleObj;
  };

  // Generate style string from component style (for HTML preview)
  const generateStyleString = (style: ComponentStyle): string => {
    const styles: string[] = [];

    if (style.basic.textAlign) styles.push(`text-align: ${style.basic.textAlign}`);
    if (style.basic.fontSize) {
      const sizes = { small: '14px', medium: '16px', large: '20px' };
      styles.push(`font-size: ${sizes[style.basic.fontSize]}`);
    }
    if (style.basic.fontWeight) styles.push(`font-weight: ${style.basic.fontWeight}`);

    if (style.advanced) {
      if (style.advanced.color) styles.push(`color: ${style.advanced.color}`);
      if (style.advanced.backgroundColor) styles.push(`background-color: ${style.advanced.backgroundColor}`);
      if (style.advanced.padding) styles.push(`padding: ${style.advanced.padding}`);
      if (style.advanced.margin) styles.push(`margin: ${style.advanced.margin}`);
      if (style.advanced.padding) styles.push(`padding: ${style.advanced.padding}`);
      if (style.advanced.border) styles.push(`border: ${style.advanced.border}`);
    }

    return styles.join('; ');
  };

  // Save page
  const savePage = async () => {
    const html = generatePreview();
    const compressed = compressor.compressHTML(html);

    const page: Page = {
      id: `page-${Date.now()}`,
      siteId: localStorage.getItem('callsign') || 'NOCALL',
      slug: pageSlug,
      title: pageTitle,
      components,
      layout: gridLayout,
      metadata: {
        compressedSize: compressed.compressedSize,
        componentCount: components.length,
        lastValidation: new Date(),
        bandwidthValid: compressed.compressedSize <= 2048
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to IndexedDB
    try {
      await db.savePage(page);
      setCompressionStats({
        original: compressed.originalSize,
        compressed: compressed.compressedSize,
        ratio: compressed.ratio,
        valid: compressed.compressedSize <= 2048
      });
    } catch (error) {
      console.error('Failed to save page:', error);
    }
  };

  // Validate bandwidth
  const validateBandwidth = () => {
    const html = generatePreview();
    const compressed = compressor.compressHTML(html);

    setCompressionStats({
      original: compressed.originalSize,
      compressed: compressed.compressedSize,
      ratio: compressed.ratio,
      valid: compressed.compressedSize <= 2048
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up draggable item ${active.id}`,
          onDragOver: ({ active, over }) => {
            if (over) {
              return `Draggable item ${active.id} was moved over droppable area ${over.id}`;
            }
            return `Draggable item ${active.id} is no longer over a droppable area`;
          },
          onDragEnd: ({ active, over }) => {
            if (over) {
              return `Draggable item ${active.id} was dropped over droppable area ${over.id}`;
            }
            return `Draggable item ${active.id} was dropped`;
          },
          onDragCancel: ({ active }) => `Dragging was cancelled. Draggable item ${active.id} was dropped`,
        },
      }}
    >
      <div className="flex h-screen bg-background" role="application" aria-label="Page Builder">
        {/* Left Sidebar - Component Palette */}
        <aside
          className="w-64 bg-surface border-r border-gray-700 overflow-y-auto"
          role="complementary"
          aria-label="Component Palette"
        >
          <Card className="m-4">
            <CardHeader>
              <h2 className="text-lg font-semibold">Components</h2>
            </CardHeader>
            <CardContent>
              <ComponentPalette onKeyboardInsert={handleKeyboardInsert} />
            </CardContent>
          </Card>
        </aside>

        {/* Main Canvas - Now takes full remaining width */}
        <main className="flex-1 flex flex-col" role="main" aria-label="Page Editor">
          {/* Toolbar */}
          <div className="bg-surface border-b border-gray-700 p-4" role="toolbar" aria-label="Editor Actions">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Input
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="Page Title"
                  className="w-48"
                  aria-label="Page Title"
                />
                <Input
                  value={pageSlug}
                  onChange={(e) => setPageSlug(e.target.value)}
                  placeholder="page-slug"
                  className="w-36"
                  aria-label="Page URL Slug"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  aria-label="Undo last action"
                  title="Undo (Ctrl+Z)"
                >
                  ↶ Undo
                </Button>
                <Button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  aria-label="Redo last undone action"
                  title="Redo (Ctrl+Y)"
                >
                  ↷ Redo
                </Button>
                <Button
                  onClick={() => setPreviewMode(!previewMode)}
                  aria-label={previewMode ? 'Switch to edit mode' : 'Preview page'}
                  title={previewMode ? 'Edit Mode' : 'Preview Mode'}
                >
                  {previewMode ? '✏️ Edit' : '👁️ Preview'}
                </Button>
                <Button
                  onClick={validateBandwidth}
                  aria-label="Validate page bandwidth usage"
                  title="Check if page meets bandwidth requirements"
                >
                  ✓ Validate
                </Button>
                <Button
                  onClick={savePage}
                  className="bg-green-600 hover:bg-green-700"
                  aria-label="Save current page"
                  title="Save Page (Ctrl+S)"
                >
                  💾 Save Page
                </Button>
                {selectedComponent && (
                  <Button
                    onClick={() => setSelectedComponent(null)}
                    className="bg-blue-600 hover:bg-blue-700"
                    aria-label="Close properties panel"
                    title="Close Properties"
                  >
                    ⚙️ Properties
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Canvas or Preview */}
          <div
            className="flex-1 overflow-auto p-8 bg-gray-900 relative focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label={previewMode ? "Page Preview" : "Design Canvas"}
            aria-describedby="canvas-status canvas-instructions"
            aria-live="polite"
            onKeyDown={(e) => {
              // Keyboard shortcuts
              if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                  case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                      handleRedo();
                    } else {
                      handleUndo();
                    }
                    break;
                  case 'y':
                    e.preventDefault();
                    handleRedo();
                    break;
                  case 's':
                    e.preventDefault();
                    savePage();
                    break;
                  case 'd':
                    e.preventDefault();
                    if (selectedComponent) {
                      duplicateComponent(selectedComponent.id);
                    }
                    break;
                }
              }

              // Arrow keys for component navigation
              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (components.length === 0) return;

                e.preventDefault();
                const currentIndex = selectedComponent
                  ? components.findIndex(c => c.id === selectedComponent.id)
                  : -1;

                let nextIndex = currentIndex;
                switch (e.key) {
                  case 'ArrowDown':
                  case 'ArrowRight':
                    nextIndex = (currentIndex + 1) % components.length;
                    break;
                  case 'ArrowUp':
                  case 'ArrowLeft':
                    nextIndex = currentIndex <= 0 ? components.length - 1 : currentIndex - 1;
                    break;
                }

                const newComponent = components[nextIndex];
                setSelectedComponent(newComponent);
                setAriaStatus(`Selected ${newComponent.type} component at row ${newComponent.gridArea.row}, column ${newComponent.gridArea.col}`);
              }

              // Move selected component with Shift + Arrow keys
              if (selectedComponent && e.shiftKey && !e.ctrlKey && !e.metaKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const newGridArea = { ...selectedComponent.gridArea };

                switch (e.key) {
                  case 'ArrowUp':
                    newGridArea.row = Math.max(1, newGridArea.row - 1);
                    break;
                  case 'ArrowDown':
                    newGridArea.row = Math.min(gridLayout.rows - newGridArea.rowSpan + 1, newGridArea.row + 1);
                    break;
                  case 'ArrowLeft':
                    newGridArea.col = Math.max(1, newGridArea.col - 1);
                    break;
                  case 'ArrowRight':
                    newGridArea.col = Math.min(gridLayout.columns - newGridArea.colSpan + 1, newGridArea.col + 1);
                    break;
                }

                updateComponent(selectedComponent.id, { gridArea: newGridArea });
                setAriaStatus(`Moved ${selectedComponent.type} to row ${newGridArea.row}, column ${newGridArea.col}`);
              }

              // Resize selected component with Ctrl + Shift + Arrow keys
              if (selectedComponent && e.shiftKey && (e.ctrlKey || e.metaKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const newGridArea = { ...selectedComponent.gridArea };

                switch (e.key) {
                  case 'ArrowUp':
                    // Decrease height
                    newGridArea.rowSpan = Math.max(1, newGridArea.rowSpan - 1);
                    break;
                  case 'ArrowDown':
                    // Increase height
                    newGridArea.rowSpan = Math.min(gridLayout.rows - newGridArea.row + 1, newGridArea.rowSpan + 1);
                    break;
                  case 'ArrowLeft':
                    // Decrease width
                    newGridArea.colSpan = Math.max(1, newGridArea.colSpan - 1);
                    break;
                  case 'ArrowRight':
                    // Increase width
                    newGridArea.colSpan = Math.min(gridLayout.columns - newGridArea.col + 1, newGridArea.colSpan + 1);
                    break;
                }

                updateComponent(selectedComponent.id, { gridArea: newGridArea });
                setAriaStatus(`Resized ${selectedComponent.type} to ${newGridArea.colSpan} columns by ${newGridArea.rowSpan} rows`);
              }

              // Delete key
              if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedComponent) {
                  e.preventDefault();
                  deleteComponent(selectedComponent.id);
                }
              }

              // Escape key
              if (e.key === 'Escape') {
                setSelectedComponent(null);
              }

              // Tab key for component selection
              if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
                if (components.length === 0) return;

                e.preventDefault();
                const currentIndex = selectedComponent
                  ? components.findIndex(c => c.id === selectedComponent.id)
                  : -1;

                const nextIndex = e.shiftKey
                  ? (currentIndex <= 0 ? components.length - 1 : currentIndex - 1)
                  : (currentIndex + 1) % components.length;

                setSelectedComponent(components[nextIndex]);
              }
            }}
          >
            {previewMode ? (
              <div role="region" aria-label="Page Preview">
                <PreviewPanel html={generatePreview()} />
              </div>
            ) : (
              <div role="region" aria-label="Design Canvas">
                <GridCanvas
                  ref={gridRef}
                  components={components}
                  gridLayout={gridLayout}
                  selectedComponent={selectedComponent}
                  onSelectComponent={setSelectedComponent}
                  onUpdateComponent={updateComponent}
                />
              </div>
            )}

            {/* Compression Stats */}
            {compressionStats && (
              <div
                className="absolute bottom-4 left-4 bg-surface border border-gray-700 rounded-lg p-3 shadow-lg"
                role="status"
                aria-label="Page size statistics"
              >
                <div className="flex items-center space-x-4 text-sm">
                  <Badge variant={compressionStats.valid ? 'success' : 'danger'}>
                    {compressionStats.valid ? '✓ Valid' : '⚠ Too Large'}
                  </Badge>
                  <span aria-label={`Original size: ${compressionStats.original} bytes`}>
                    Original: {compressionStats.original}B
                  </span>
                  <span aria-label={`Compressed size: ${compressionStats.compressed} bytes`}>
                    Compressed: {compressionStats.compressed}B
                  </span>
                  <span aria-label={`Compression ratio: ${compressionStats.ratio} to 1`}>
                    Ratio: {compressionStats.ratio}x
                  </span>
                </div>
              </div>
            )}

            {/* Keyboard shortcuts help */}
            <div className="absolute top-4 right-4 bg-surface border border-gray-700 rounded-lg p-2 text-xs opacity-75 hover:opacity-100 transition-opacity">
              <details>
                <summary className="cursor-pointer font-semibold">⌨️ Keyboard Shortcuts</summary>
                <div className="mt-2 space-y-1 min-w-56 max-h-64 overflow-y-auto">
                  <div className="font-semibold text-blue-400 border-b border-gray-600 pb-1 mb-2">
                    General
                  </div>
                  <div>Ctrl+Z: Undo</div>
                  <div>Ctrl+Y: Redo</div>
                  <div>Ctrl+S: Save Page</div>
                  <div>Ctrl+D: Duplicate Component</div>
                  <div>Esc: Deselect Component</div>

                  <div className="font-semibold text-blue-400 border-b border-gray-600 pb-1 mb-2 mt-3">
                    Navigation
                  </div>
                  <div>Tab: Select Next Component</div>
                  <div>Shift+Tab: Select Previous</div>
                  <div>Arrow Keys: Navigate Components</div>
                  <div>Enter/Space: Select Component</div>

                  <div className="font-semibold text-blue-400 border-b border-gray-600 pb-1 mb-2 mt-3">
                    Movement
                  </div>
                  <div>Shift+↑: Move Component Up</div>
                  <div>Shift+↓: Move Component Down</div>
                  <div>Shift+←: Move Component Left</div>
                  <div>Shift+→: Move Component Right</div>

                  <div className="font-semibold text-blue-400 border-b border-gray-600 pb-1 mb-2 mt-3">
                    Resizing
                  </div>
                  <div>Ctrl+Shift+↑: Decrease Height</div>
                  <div>Ctrl+Shift+↓: Increase Height</div>
                  <div>Ctrl+Shift+←: Decrease Width</div>
                  <div>Ctrl+Shift+→: Increase Width</div>

                  <div className="font-semibold text-blue-400 border-b border-gray-600 pb-1 mb-2 mt-3">
                    Actions
                  </div>
                  <div>Delete/Backspace: Remove</div>
                  <div>Click: Select & Edit Properties</div>
                </div>
              </details>
            </div>
          </div>
        </main>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId ? (
            <div className="bg-blue-500 p-3 rounded text-white font-bold opacity-75">
              Dragging: {activeId}
            </div>
          ) : null}
        </DragOverlay>
      </div>

      {/* Property Editor Modal */}
      {selectedComponent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="properties-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedComponent(null);
            }
          }}
        >
          <div
            ref={modalRef}
            className="bg-surface border border-gray-700 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            role="document"
          >
            <div className="sticky top-0 bg-surface border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 id="properties-title" className="text-lg font-semibold">
                {selectedComponent.type.charAt(0).toUpperCase() + selectedComponent.type.slice(1)} Properties
              </h3>
              <button
                onClick={() => setSelectedComponent(null)}
                className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
                aria-label="Close properties panel"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <PropertyEditor
                component={selectedComponent}
                onUpdate={(updates) => updateComponent(selectedComponent.id, updates)}
                onDelete={() => {
                  deleteComponent(selectedComponent.id);
                  setSelectedComponent(null);
                }}
                onDuplicate={() => duplicateComponent(selectedComponent.id)}
                onSelectChild={(child) => setSelectedComponent(child)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ARIA status announcements for screen readers */}
      <div className="sr-only">
        <div id="canvas-status" aria-live="polite" aria-atomic="true">
          {ariaStatus}
        </div>
        <div id="component-count-status" aria-live="polite">
          {components.length} components on canvas
        </div>
        <div id="canvas-instructions" aria-live="polite">
          {previewMode
            ? 'Currently in preview mode. Press Edit button to return to design mode.'
            : selectedComponent
            ? `${selectedComponent.type} component selected. Use arrow keys to navigate, Shift+arrows to move, Ctrl+Shift+arrows to resize, Enter to edit properties, Delete to remove.`
            : 'Design canvas ready. Press Tab to navigate component palette, or use arrow keys to select components.'
          }
        </div>
      </div>

      {/* Protobuf Live Preview */}
      <ProtobufLivePreview
        components={generateReactComponents()}
        isVisible={components.length > 0}
        enableTransmission={true}
      />
    </DndContext>
  );
};

export default PageBuilder;