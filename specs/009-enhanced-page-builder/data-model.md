# Data Model: Enhanced Page Builder

## Entity Definitions

### PageComponent (Enhanced)
Core component entity with hierarchical nesting support.

```typescript
interface PageComponent {
  id: string;                    // Unique identifier
  type: ComponentType;           // Component type enum
  gridArea: GridPosition;        // Grid positioning
  properties: ComponentProps;    // Type-specific properties
  style?: ComponentStyle;        // Visual styling
  children?: PageComponent[];    // Nested child components (NEW)
  locked?: boolean;             // Lock editing/movement
}
```

**Key Enhancements**:
- `children` array enables unlimited nesting depth
- Optional field maintains backward compatibility
- Recursive structure supports complex hierarchies

**Validation Rules**:
- `children` array must not contain circular references
- Child components inherit parent container constraints
- Empty children array equivalent to undefined

### ComponentChildren
Logical collection representing child component management.

```typescript
interface ComponentChildren {
  parent: PageComponent;         // Parent component reference
  children: PageComponent[];     // Ordered child array
  count: number;                // Child count for UI display
}
```

**Operations**:
- `addChild(component: PageComponent)`: Append new child
- `removeChild(id: string)`: Remove child by ID
- `reorderChildren(fromIndex: number, toIndex: number)`: Change order
- `getChild(id: string)`: Retrieve specific child

### ComponentHierarchy
Tree structure representing complete component relationships.

```typescript
interface ComponentHierarchy {
  root: PageComponent[];         // Top-level components
  depth: number;                // Maximum nesting depth
  totalComponents: number;       // All components count
}
```

**Tree Operations**:
- `findComponent(id: string)`: Locate component at any level
- `getParent(childId: string)`: Find parent of given child
- `getPath(id: string)`: Get breadcrumb path to component
- `flatten()`: Convert to flat array for operations

### PropertyEditorState (New)
State management for property editor child interactions.

```typescript
interface PropertyEditorState {
  selectedComponent: PageComponent;
  activeTab: 'basic' | 'advanced' | 'position' | 'children';
  childEditingMode: boolean;
  childSelection: PageComponent | null;
}
```

**State Transitions**:
- Select parent → View children tab
- Select child → Edit child properties
- Add child → Update children array
- Delete child → Warn if has grandchildren

## Relationships

### Parent-Child Relationships
- **One-to-Many**: Parent component can have multiple children
- **Hierarchical**: Children can have their own children (unlimited depth)
- **Ordered**: Children maintain insertion/reorder sequence
- **Cascade Delete**: Deleting parent removes all descendants

### Component-Property Relationships
- **Context-Sensitive**: Child properties may differ from standalone
- **Inheritance**: Some styling properties inherit from parent
- **Isolation**: Property changes affect only target component

### Grid-Hierarchy Relationships
- **Parent Positioning**: Parent uses grid coordinates
- **Child Layout**: Children use parent's internal layout system
- **Movement**: Moving parent moves entire hierarchy
- **Resize**: Resizing parent may affect child layout

## State Transitions

### Child Component Lifecycle
1. **Creation**: Added to parent's children array
2. **Active**: Rendered within parent container
3. **Selected**: Available for property editing
4. **Modified**: Properties updated independently
5. **Removed**: Deleted from parent's children array

### Hierarchy Operations
1. **Add Child**:
   - Validate parent can accept children
   - Create new component with default properties
   - Append to parent's children array
   - Update UI to show new child

2. **Edit Child**:
   - Switch PropertyEditor context to child
   - Load child properties
   - Allow independent editing
   - Preserve parent-child relationship

3. **Delete Child**:
   - Count nested grandchildren
   - Show warning if grandchildren exist
   - Remove from parent's children array
   - Update child count indicators

4. **Move Parent**:
   - Update parent grid position
   - Preserve all child relationships
   - Maintain child relative positions

## Validation Rules

### Structural Validation
- No component can contain itself (prevent cycles)
- Children array length has no enforced limit
- Child types must be compatible with parent container
- Grid positions must be valid for parent container

### Property Validation
- Child properties validated against component type
- Parent container properties affect child rendering
- Style inheritance follows CSS-like precedence
- Required properties must be present for all components

### Hierarchy Validation
- Tree structure must be acyclic
- All child IDs must be unique within component tree
- Parent references must be valid
- Orphaned children not allowed in hierarchy

## Performance Considerations

### Serialization
- Nested structure increases JSON payload size
- Compression benefits from repeated child patterns
- Template compilation optimizes repeated child types
- Delta updates minimize transmission for child-only changes

### Rendering
- Recursive rendering requires optimization
- Child components cached to prevent re-render
- React keys prevent unnecessary DOM updates
- Memoization for static child content

### Memory Management
- Deep hierarchies increase memory footprint
- Child component cleanup on parent deletion
- Property editor state cleanup on component deselection
- Undo/redo stack considers hierarchy changes

## Migration Strategy

### Backward Compatibility
- Existing PageComponent instances work unchanged
- `children` property optional and defaults to undefined
- Existing serialization handles missing children gracefully
- No database schema changes required

### Data Transformation
- No transformation needed for existing components
- New components created with empty children array if container type
- Export/import handles nested structures automatically
- Version indicators track hierarchy support