# Page Builder Migration Contract

**Component**: Page Builder System
**Original**: `src/components/PageBuilder/`
**Target**: Chakra UI + DndKit Integration
**Priority**: Critical (complex system integration)

## Scope Definition

### Components in Scope
- `GridCanvas.tsx` - Main canvas with drag-drop grid
- `ComponentPalette.tsx` - Draggable component library
- `PropertyEditor.tsx` - Component property modal
- `PreviewPanel.tsx` - Live preview display

### Integration Points
- **DndKit**: Drag-and-drop functionality preservation
- **Chakra UI**: Component styling and accessibility
- **Grid System**: CSS Grid layout maintenance
- **Modal System**: Property editor modal

## Original System Architecture

### Current Grid Canvas
```typescript
interface GridCanvasProps {
  components: PageComponent[];
  gridLayout: GridLayout;
  selectedComponent: PageComponent | null;
  onSelectComponent: (component: PageComponent | null) => void;
  onUpdateComponent: (id: string, updates: Partial<PageComponent>) => void;
}
```

### Current Component Rendering
- Custom component rendering with Tailwind classes
- DndKit integration for drag-and-drop
- Grid positioning with CSS Grid
- Resize handles for component sizing

## Chakra UI Migration Contract

### Enhanced Grid Canvas
```typescript
import { Box, Grid, useColorModeValue } from '@chakra-ui/react';
import { useDndMonitor, DragEndEvent } from '@dnd-kit/core';

interface ChakraGridCanvasProps extends GridCanvasProps {
  theme?: 'light' | 'dark';
  accessibility?: AccessibilityConfig;
  responsive?: ResponsiveConfig;
}
```

### Component Rendering Enhancement
```typescript
interface ChakraPageComponent extends PageComponent {
  chakraProps: Record<string, any>;
  accessibilityProps: AccessibilityProps;
  responsiveProps: ResponsiveProps;
}
```

## Visual Integration Requirements

### Grid System Preservation
- **CSS Grid**: Maintain existing grid-template-columns/rows
- **Gap Management**: Convert to Chakra spacing tokens
- **Cell Highlighting**: Use Chakra color scheme for drop zones
- **Grid Indicators**: Chakra-styled grid lines and dimensions

### Drag-and-Drop Visual Feedback
- **Drag Overlay**: Chakra Card component for drag preview
- **Drop Zones**: Chakra Box with hover states
- **Selection Indicators**: Chakra outline styles
- **Resize Handles**: Chakra-styled resize controls

### Component Palette Enhancement
```typescript
interface ChakraPaletteItem {
  component: ComponentType;
  chakraIcon: React.ComponentType;
  chakraProps: PaletteItemProps;
  accessibility: {
    label: string;
    description: string;
    keyboardShortcut?: string;
  };
}
```

## DndKit Integration Contract

### Compatibility Requirements
- **Draggable Elements**: Must work with Chakra components
- **Collision Detection**: Preserve existing collision algorithms
- **Sensors**: Maintain mouse, touch, and keyboard sensors
- **Modifiers**: Grid snapping and boundary restrictions

### Enhanced Accessibility
```typescript
interface DragAccessibilityConfig {
  announcements: {
    onDragStart: (id: string) => string;
    onDragMove: (id: string, position: Position) => string;
    onDragEnd: (id: string, position: Position) => string;
  };
  keyboardShortcuts: {
    select: string[];
    move: string[];
    resize: string[];
    delete: string[];
  };
}
```

## Property Editor Migration

### Modal Enhancement
```typescript
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton
} from '@chakra-ui/react';

interface ChakraPropertyEditorProps {
  isOpen: boolean;
  onClose: () => void;
  component: ChakraPageComponent;
  onUpdate: (updates: ComponentUpdates) => void;
  formValidation: ValidationConfig;
}
```

### Form Integration
- **Form Controls**: Chakra FormControl, FormLabel, FormErrorMessage
- **Input Types**: Text, Number, Select, Switch, ColorPicker
- **Validation**: Real-time validation with Chakra error states
- **Responsive**: Modal adapts to mobile/tablet layouts

## Performance Requirements

### Bundle Size Management
- **Before**: Page Builder (~50KB)
- **After**: Page Builder + Chakra integration (~65KB)
- **Increase**: ~15KB (acceptable for accessibility gains)

### Render Performance
- **Grid Rendering**: <50ms for 12x12 grid
- **Component Updates**: <16ms per component change
- **Drag Performance**: 60fps during drag operations
- **Modal Opening**: <200ms transition time

## Accessibility Enhancements

### Keyboard Navigation
```typescript
interface KeyboardConfig {
  gridNavigation: {
    arrows: 'move-selection' | 'move-component';
    tab: 'next-component';
    escape: 'deselect';
    enter: 'edit-properties';
    delete: 'remove-component';
  };
  componentManipulation: {
    shift_arrows: 'resize-component';
    ctrl_c: 'copy-component';
    ctrl_v: 'paste-component';
    ctrl_z: 'undo';
    ctrl_y: 'redo';
  };
}
```

### Screen Reader Support
- **Grid Announcements**: Position and size information
- **Drag Feedback**: Real-time position updates
- **Component Information**: Type, properties, relationships
- **Action Feedback**: Success/error messages for operations

## Testing Contract

### Integration Tests Required
```typescript
describe('Page Builder Chakra Integration', () => {
  test('maintains drag-and-drop functionality', () => {});
  test('preserves grid layout behavior', () => {});
  test('enhances accessibility features', () => {});
  test('integrates modal system correctly', () => {});
  test('supports keyboard navigation', () => {});
  test('renders components with Chakra styling', () => {});
});
```

### Visual Regression Tests
- Grid layout rendering
- Component palette display
- Drag-and-drop visual feedback
- Modal responsiveness
- Component selection states

### Accessibility Tests
- Keyboard navigation paths
- Screen reader announcements
- ARIA attribute correctness
- Focus management
- Color contrast compliance

## Migration Strategy

### Phase 1: Foundation
1. **Theme Integration**: Apply Chakra theme to grid canvas
2. **Basic Components**: Migrate simple palette items
3. **Modal System**: Convert property editor to Chakra Modal

### Phase 2: DndKit Integration
1. **Drag Overlays**: Implement Chakra drag previews
2. **Drop Zones**: Style with Chakra hover states
3. **Accessibility**: Add keyboard navigation and announcements

### Phase 3: Advanced Features
1. **Component Rendering**: Enhance with Chakra components
2. **Responsive Design**: Improve mobile/tablet experience
3. **Performance**: Optimize for large grids

## Risk Mitigation

### High-Risk Areas
- **DndKit Compatibility**: CSS-in-JS might affect drag positioning
- **Performance**: Additional Chakra components might slow rendering
- **Grid Layout**: CSS Grid might conflict with Chakra layout

### Mitigation Strategies
- **Feature Flags**: Gradual rollout with ability to revert
- **Performance Monitoring**: Real-time performance metrics
- **Compatibility Testing**: Extensive browser and device testing
- **Backup Components**: Keep original components during transition

## Success Criteria

- ✅ All drag-and-drop functionality preserved
- ✅ Enhanced accessibility (keyboard nav, screen readers)
- ✅ Improved visual consistency with Chakra design system
- ✅ Performance maintained or improved
- ✅ Mobile/tablet experience enhanced
- ✅ Component library integration seamless
- ✅ Property editing improved with better forms
- ✅ Grid system flexibility maintained