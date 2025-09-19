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
import { BinaryLivePreview } from '../components/ProtobufLivePreview';
import { db } from '../lib/database';
import { GridCanvas } from '../components/PageBuilder/GridCanvas';
import { ComponentPalette } from '../components/PageBuilder/ComponentPalette';
import { PropertyEditor } from '../components/PageBuilder/PropertyEditor';
import { PreviewPanel } from '../components/PageBuilder/PreviewPanel';
import { CollaborationPanel, CollaborationUser, CollaborationState } from '../components/PageBuilder/CollaborationPanel';
import RealtimeSync from '../lib/collaboration/RealtimeSync';
import { RichMediaComponent, RichMediaProps } from '../components/PageBuilder/RichMedia';
import MediaUploader from '../components/PageBuilder/MediaUploader';

// Markdown to HTML converter for preview
const convertMarkdownToHTML = (markdown: string, baseStyle: string): string => {
  const lines = markdown.split('\n');
  const htmlElements: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
      htmlElements.push(`<${tag} style="${baseStyle}font-weight: bold; margin-bottom: 8px;">${content}</${tag}>`);
    }
    // Tables
    else if (line.includes('|')) {
      const tableRows: string[] = [];
      let j = i;

      while (j < lines.length && lines[j].trim().includes('|')) {
        const tableLine = lines[j].trim();
        if (!tableLine.match(/^\|[\s\-\|]+\|$/)) { // Skip separator rows
          tableRows.push(tableLine);
        }
        j++;
      }

      if (tableRows.length > 0) {
        const rows = tableRows.map(row =>
          row.split('|').map(cell => cell.trim()).filter(cell => cell)
        );

        let tableHTML = `<table style="${baseStyle}border-collapse: collapse; border: 1px solid #666; margin-bottom: 8px;">`;
        rows.forEach(row => {
          tableHTML += '<tr>';
          row.forEach(cell => {
            tableHTML += `<td style="border: 1px solid #666; padding: 4px 8px; font-size: 14px;">${cell}</td>`;
          });
          tableHTML += '</tr>';
        });
        tableHTML += '</table>';
        htmlElements.push(tableHTML);
      }

      i = j;
      continue;
    }
    // Lists
    else if (line.startsWith('-') || line.startsWith('*')) {
      const listItems: string[] = [];
      let j = i;

      while (j < lines.length && (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('*'))) {
        listItems.push(lines[j].trim().replace(/^[\-\*]\s*/, ''));
        j++;
      }

      if (listItems.length > 0) {
        let listHTML = `<ul style="${baseStyle}margin-bottom: 8px; padding-left: 20px;">`;
        listItems.forEach(item => {
          listHTML += `<li style="margin-bottom: 4px;">${item}</li>`;
        });
        listHTML += '</ul>';
        htmlElements.push(listHTML);
      }

      i = j;
      continue;
    }
    // Links
    else if (line.includes('[') && line.includes('](')) {
      const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const [, linkText, url] = linkMatch;
        htmlElements.push(`<a href="${url}" style="${baseStyle}color: #60a5fa; text-decoration: underline; display: block; margin-bottom: 8px;">${linkText}</a>`);
      }
    }
    // Regular paragraphs
    else {
      let content = line;
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
      htmlElements.push(`<p style="${baseStyle}margin-bottom: 8px;">${content}</p>`);
    }

    i++;
  }

  return htmlElements.join('\n');
};

// Convert markdown to radio transmission components
const convertMarkdownToComponents = (markdown: string, styleObj: any, baseKey: string): any[] => {
  const lines = markdown.split('\n');
  const components: any[] = [];
  let componentIndex = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('#')) {
      const content = line.replace(/^#+\s*/, '');
      components.push({
        type: 'heading',
        properties: { text: content, style: styleObj },
        key: `${baseKey}-heading-${componentIndex++}`
      });
    }
    // Tables
    else if (line.includes('|')) {
      const tableRows: string[] = [];
      let j = i;

      while (j < lines.length && lines[j].trim().includes('|')) {
        const tableLine = lines[j].trim();
        if (!tableLine.match(/^\|[\s\-\|]+\|$/)) { // Skip separator rows
          tableRows.push(tableLine);
        }
        j++;
      }

      if (tableRows.length > 0) {
        const tableContent = tableRows.map(row =>
          row.split('|').map(cell => cell.trim()).filter(cell => cell).join(' | ')
        ).join('\n');

        components.push({
          type: 'table',
          properties: { text: tableContent, style: styleObj },
          key: `${baseKey}-table-${componentIndex++}`
        });
      }

      i = j;
      continue;
    }
    // Lists
    else if (line.startsWith('-') || line.startsWith('*')) {
      const listItems: string[] = [];
      let j = i;

      while (j < lines.length && (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('*'))) {
        listItems.push(lines[j].trim().replace(/^[\-\*]\s*/, ''));
        j++;
      }

      if (listItems.length > 0) {
        components.push({
          type: 'list',
          properties: { text: listItems.join('\n'), style: styleObj },
          key: `${baseKey}-list-${componentIndex++}`
        });
      }

      i = j;
      continue;
    }
    // Links
    else if (line.includes('[') && line.includes('](')) {
      const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const [, linkText, url] = linkMatch;
        components.push({
          type: 'link',
          properties: { text: linkText, href: url, style: styleObj },
          key: `${baseKey}-link-${componentIndex++}`
        });
      }
    }
    // Regular paragraphs
    else {
      let content = line;
      content = content.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markers for transmission
      content = content.replace(/\*(.*?)\*/g, '$1'); // Remove italic markers for transmission

      components.push({
        type: 'paragraph',
        properties: { text: content, style: styleObj },
        key: `${baseKey}-paragraph-${componentIndex++}`
      });
    }

    i++;
  }

  return components;
};

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
  DIVIDER = 'divider',
  MARKDOWN = 'markdown',
  RICH_MEDIA = 'rich_media'
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
  richMedia?: RichMediaProps; // For rich media components
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
  columnSizes: string[]; // Array of CSS grid sizes (e.g., ['1fr', '1fr', '1fr'])
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

  // Collaboration state
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [currentUser] = useState<CollaborationUser>({
    id: crypto.randomUUID(),
    callsign: localStorage.getItem('callsign') || 'NOCALL',
    color: '#60a5fa',
    isActive: true,
    lastSeen: new Date(),
    permissions: 'admin'
  });
  const [collaborationState, setCollaborationState] = useState<CollaborationState>({
    sessionId: '',
    users: [currentUser],
    isConnected: false,
    conflicts: []
  });
  const [realtimeSync, setRealtimeSync] = useState<RealtimeSync | null>(null);

  // Rich media state
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [transmissionMode, setTransmissionMode] = useState<'rf' | 'webrtc' | 'hybrid'>('hybrid');
  const bandwidthLimit = transmissionMode === 'rf' ? 2048 : 1024 * 1024; // 2KB for RF, 1MB for WebRTC

  const gridRef = useRef<HTMLDivElement>(null);
  // React renderer for component-to-radio conversion with bandwidth optimization
  const compressor = new HamRadioCompressor();

  // Grid layout configuration - start with single column
  const [gridLayout, setGridLayout] = useState<GridLayout>({
    columns: 1,
    rows: 12,
    gap: 8,
    columnSizes: ['1fr'], // Single column taking full width
    responsive: [
      { maxWidth: 768, columns: 1, stackComponents: true },
      { maxWidth: 1024, columns: 2 },
      { maxWidth: 1440, columns: 3 }
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

  // Initialize collaboration when enabled
  useEffect(() => {
    if (collaborationEnabled && !realtimeSync) {
      const sessionId = crypto.randomUUID();
      const sync = new RealtimeSync(sessionId, currentUser);

      // Set up event listeners
      sync.on('connected', (data) => {
        setCollaborationState(prev => ({
          ...prev,
          sessionId: data.sessionId,
          isConnected: true
        }));
      });

      sync.on('user-joined', (user) => {
        setCollaborationState(prev => ({
          ...prev,
          users: [...prev.users.filter(u => u.id !== user.id), user]
        }));
      });

      sync.on('user-left', (user) => {
        setCollaborationState(prev => ({
          ...prev,
          users: prev.users.filter(u => u.id !== user.id)
        }));
      });

      sync.on('state-changed', (data) => {
        setComponents(data.components);
        setCollaborationState(prev => ({
          ...prev,
          users: data.users,
          conflicts: sync.getCollaborationState().conflicts
        }));
      });

      sync.on('operation-applied', (operation) => {
        // Update components from remote operations
        setComponents(sync.getComponents());
      });

      // Initialize with current components
      sync.initialize(components);
      setRealtimeSync(sync);
    }

    return () => {
      if (realtimeSync && !collaborationEnabled) {
        realtimeSync.dispose();
        setRealtimeSync(null);
      }
    };
  }, [collaborationEnabled, components, currentUser, realtimeSync]);


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
        gridArea: over.data.current?.gridPosition || { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        properties: getDefaultProps(active.data.current.type),
        style: {
          basic: {
            fontSize: 'medium',
            fontWeight: 'normal',
            textAlign: 'left'
          }
        }
      };
      const updatedComponents = [...components, newComponent];
      setComponents(updatedComponents);

      // Sync with collaboration if enabled
      if (realtimeSync && collaborationEnabled) {
        realtimeSync.addComponent(newComponent);
      }
    }
    // Handle component reposition
    else {
      const draggedComponent = components.find(c => c.id === active.id);
      if (draggedComponent && over.data.current?.gridPosition) {
        const newGridArea = {
          ...over.data.current.gridPosition,
          rowSpan: draggedComponent.gridArea.rowSpan,
          colSpan: draggedComponent.gridArea.colSpan
        };
        const updatedComponents = components.map(c =>
          c.id === active.id ? { ...c, gridArea: newGridArea } : c
        );
        setComponents(updatedComponents);

        // Sync with collaboration if enabled
        if (realtimeSync && collaborationEnabled) {
          realtimeSync.moveComponent(active.id as string, newGridArea);
        }
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
      case ComponentType.RICH_MEDIA:
        return { richMedia: null }; // Will be set when media is processed
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
      for (let col = 1; col <= gridLayout.columnSizes.length; col++) { // Check all available columns
        const position = { row, col, rowSpan: 1, colSpan: gridLayout.columnSizes.length };
        let canPlace = true;

        // Check if this position is available
        for (let r = row; r < row + position.rowSpan; r++) {
          for (let c = col; c < col + position.colSpan; c++) {
            if (c > gridLayout.columnSizes.length || occupiedCells.has(`${r}-${c}`)) {
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
    return { row: 1, col: 1, rowSpan: 1, colSpan: gridLayout.columnSizes.length };
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
    const updatedComponents = components.map(c =>
      c.id === id ? { ...c, ...updates } : c
    );
    setComponents(updatedComponents);

    // Sync with collaboration if enabled
    if (realtimeSync && collaborationEnabled) {
      const component = updatedComponents.find(c => c.id === id);
      if (component) {
        realtimeSync.updateComponent(id, updates);
      }
    }
  };

  // Collaboration event handlers
  const handleUserInvite = async (callsign: string) => {
    if (!realtimeSync) return;

    // In a real implementation, this would send an invitation
    // For now, we'll simulate adding a user
    const newUser: CollaborationUser = {
      id: crypto.randomUUID(),
      callsign: callsign.toUpperCase(),
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      isActive: true,
      lastSeen: new Date(),
      permissions: 'edit'
    };

    realtimeSync.addUser(newUser);
  };

  const handlePermissionChange = (userId: string, permission: CollaborationUser['permissions']) => {
    setCollaborationState(prev => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === userId ? { ...user, permissions: permission } : user
      )
    }));
  };

  const handleKickUser = (userId: string) => {
    if (!realtimeSync) return;
    realtimeSync.removeUser(userId);
  };

  const handleResolveConflict = (componentId: string, resolution: 'merge' | 'mine' | 'theirs') => {
    // Find and resolve the conflict
    setCollaborationState(prev => ({
      ...prev,
      conflicts: prev.conflicts.filter(c => c.componentId !== componentId)
    }));

    // In a real implementation, this would apply the resolution strategy
    console.log(`Resolving conflict for ${componentId} with strategy: ${resolution}`);
  };

  // Handle media processing from uploader
  const handleMediaProcessed = (media: RichMediaProps) => {
    // Create a new rich media component
    const newComponent: PageComponent = {
      id: `component-${Date.now()}`,
      type: ComponentType.RICH_MEDIA,
      gridArea: findNextAvailablePosition(),
      properties: { richMedia: media },
      style: {
        basic: {
          fontSize: 'medium',
          fontWeight: 'normal',
          textAlign: 'left'
        }
      }
    };

    saveUndoState();
    const updatedComponents = [...components, newComponent];
    setComponents(updatedComponents);

    // Sync with collaboration if enabled
    if (realtimeSync && collaborationEnabled) {
      realtimeSync.addComponent(newComponent);
    }

    // Close uploader
    setShowMediaUploader(false);

    // Select the new component for editing
    setSelectedComponent(newComponent);
  };

  // Column management functions
  const addColumnLeft = () => {
    const newColumnSizes = ['1fr', ...gridLayout.columnSizes];
    const newLayout = {
      ...gridLayout,
      columns: gridLayout.columns + 1,
      columnSizes: newColumnSizes
    };

    // Shift existing components to the right
    const updatedComponents = components.map(comp => ({
      ...comp,
      gridArea: {
        ...comp.gridArea,
        col: comp.gridArea.col + 1
      }
    }));

    setGridLayout(newLayout);
    setComponents(updatedComponents);
  };

  const addColumnRight = () => {
    const newColumnSizes = [...gridLayout.columnSizes, '1fr'];
    const newLayout = {
      ...gridLayout,
      columns: gridLayout.columns + 1,
      columnSizes: newColumnSizes
    };

    setGridLayout(newLayout);
  };

  const removeColumn = (columnIndex: number) => {
    if (gridLayout.columns <= 1) return; // Keep at least one column

    const newColumnSizes = gridLayout.columnSizes.filter((_, index) => index !== columnIndex);
    const newLayout = {
      ...gridLayout,
      columns: gridLayout.columns - 1,
      columnSizes: newColumnSizes
    };

    // Remove components in the deleted column and adjust positions
    const updatedComponents = components
      .filter(comp => comp.gridArea.col !== columnIndex + 1) // Remove components in deleted column
      .map(comp => ({
        ...comp,
        gridArea: {
          ...comp.gridArea,
          col: comp.gridArea.col > columnIndex + 1 ? comp.gridArea.col - 1 : comp.gridArea.col
        }
      }));

    setGridLayout(newLayout);
    setComponents(updatedComponents);
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
    const updatedComponents = components.filter(c => c.id !== id);
    setComponents(updatedComponents);
    setSelectedComponent(null);
    setAriaStatus(`${component.type} component deleted`);

    // Sync with collaboration if enabled
    if (realtimeSync && collaborationEnabled) {
      realtimeSync.deleteComponent(id);
    }
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
          col: Math.min(component.gridArea.col + component.gridArea.colSpan, gridLayout.columnSizes.length - component.gridArea.colSpan)
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
        case ComponentType.RICH_MEDIA:
          // Rich media components are transmitted as compressed data
          if (properties.richMedia) {
            return {
              type: 'media',
              properties: {
                mediaType: properties.richMedia.type,
                codec: properties.richMedia.codec,
                compressedSize: properties.richMedia.metadata.compressedSize,
                fallback: properties.richMedia.fallbackContent,
                style: styleObj
              },
              key
            };
          }
          return null;
        case ComponentType.MARKDOWN:
          // Markdown component is for editing only - don't transmit over radio
          return null;
        default:
          return { type: 'text', properties: { text: properties.content || '', style: styleObj }, key };
      }
    }).filter(component => component !== null);
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
        case ComponentType.RICH_MEDIA:
          // Rich media shows fallback content in HTML preview
          if (properties.richMedia) {
            return `<div style="${styleStr}" class="rich-media-preview">
              <div class="media-info">[${properties.richMedia.type.toUpperCase()}]</div>
              <div class="media-fallback">${properties.richMedia.fallbackContent || 'Rich Media Content'}</div>
              <div class="media-meta">${properties.richMedia.codec} - ${(properties.richMedia.metadata.compressedSize / 1024).toFixed(1)}KB</div>
            </div>`;
          }
          return `<div style="${styleStr}">Rich Media (Not Configured)</div>`;
        case ComponentType.MARKDOWN:
          // Markdown component shows converted content in preview
          return convertMarkdownToHTML(properties.content || '', styleStr);
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
                  onClick={() => setCollaborationEnabled(!collaborationEnabled)}
                  className={collaborationEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}
                  aria-label={collaborationEnabled ? 'Disable collaboration' : 'Enable collaboration'}
                  title="Toggle Collaboration Mode"
                >
                  {collaborationEnabled ? '👥 Collaboration ON' : '👤 Collaboration OFF'}
                </Button>
                <Button
                  onClick={() => setShowMediaUploader(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                  aria-label="Upload rich media"
                  title="Add Rich Media"
                >
                  🎬 Add Media
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
            tabIndex={selectedComponent ? -1 : 0}
            role="region"
            aria-label={previewMode ? "Page Preview" : "Design Canvas"}
            aria-describedby="canvas-status canvas-instructions"
            aria-live="polite"
            onKeyDown={(e) => {
              // Don't handle any shortcuts when property modal is open
              if (selectedComponent) {
                return;
              }

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

                // Update cursor position for collaboration
                if (realtimeSync && collaborationEnabled) {
                  realtimeSync.updateCursor(newComponent.gridArea.col * 100, newComponent.gridArea.row * 100, newComponent.id);
                }
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
                    newGridArea.col = Math.min(gridLayout.columnSizes.length - newGridArea.colSpan + 1, newGridArea.col + 1);
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
                    newGridArea.colSpan = Math.min(gridLayout.columnSizes.length - newGridArea.col + 1, newGridArea.colSpan + 1);
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
                {/* Column Controls */}
                <div className="flex items-center justify-center mb-4 gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                  <Button
                    onClick={addColumnLeft}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                    aria-label="Add column to the left"
                  >
                    ← Add Column
                  </Button>
                  <div className="flex items-center gap-1 px-3 py-1 bg-gray-700 rounded text-xs text-gray-300">
                    <span>{gridLayout.columnSizes.length} columns</span>
                    <span className="text-gray-500">({gridLayout.columnSizes.join(', ')})</span>
                  </div>
                  <Button
                    onClick={addColumnRight}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                    aria-label="Add column to the right"
                  >
                    Add Column →
                  </Button>
                  {gridLayout.columnSizes.length > 1 && (
                    <Button
                      onClick={() => removeColumn(gridLayout.columnSizes.length - 1)}
                      className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                      aria-label="Remove last column"
                    >
                      ✕ Remove
                    </Button>
                  )}
                </div>
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

            {/* Transmission Mode Selector */}
            <div className="absolute bottom-4 right-4 bg-surface border border-gray-700 rounded-lg p-3 shadow-lg">
              <div className="text-xs text-gray-400 mb-2">Transmission Mode</div>
              <select
                value={transmissionMode}
                onChange={(e) => setTransmissionMode(e.target.value as 'rf' | 'webrtc' | 'hybrid')}
                className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1"
              >
                <option value="rf">RF Mode (2KB limit)</option>
                <option value="webrtc">WebRTC Mode (1MB limit)</option>
                <option value="hybrid">Hybrid Mode (auto-switch)</option>
              </select>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Collaboration Panel */}
        {collaborationEnabled && (
          <aside
            className="w-80 bg-surface border-l border-gray-700 overflow-y-auto"
            role="complementary"
            aria-label="Collaboration Panel"
          >
            <CollaborationPanel
              collaborationState={collaborationState}
              currentUser={currentUser}
              onUserInvite={handleUserInvite}
              onPermissionChange={handlePermissionChange}
              onKickUser={handleKickUser}
              onResolveConflict={handleResolveConflict}
            />
          </aside>
        )}

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

      {/* Media Uploader Modal */}
      {showMediaUploader && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-uploader-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMediaUploader(false);
            }
          }}
        >
          <div className="bg-surface border border-gray-700 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 id="media-uploader-title" className="text-lg font-semibold">
                Add Rich Media
              </h3>
              <button
                onClick={() => setShowMediaUploader(false)}
                className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
                aria-label="Close media uploader"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <MediaUploader
                onMediaProcessed={handleMediaProcessed}
                bandwidthLimit={bandwidthLimit}
                transmissionMode={transmissionMode}
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

      {/* Binary Live Preview */}
      <BinaryLivePreview
        components={generateReactComponents()}
        isVisible={components.length > 0 && !selectedComponent}
        enableTransmission={true}
      />
    </DndContext>
  );
};

export default PageBuilder;