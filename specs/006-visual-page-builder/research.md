# Visual Page Builder Research

## 1. CSS Grid Layout Strategies for Visual Builders

### Decision: CSS Grid with Template-Based Positioning
**Rationale:**
- Leverages existing JSX-to-radio template compilation
- CSS Grid provides precise control for visual builders
- Template-based approach fits 2KB bandwidth constraint

**Alternatives Considered:**
- react-grid-layout: Too heavy (~50KB)
- Flexbox-based: Less precise positioning control
- Absolute positioning: Poor responsive behavior

## 2. React Drag-and-Drop Libraries

### Decision: dnd-kit with Custom Bandwidth-Optimized Layer
**Rationale:**
- Smallest core (~10KB), no external dependencies
- Modern React patterns with performance focus
- Extensible for ham radio optimizations

**Alternatives Considered:**
- react-beautiful-dnd: Limited to list reordering
- pragmatic-drag-and-drop: Less smooth UX
- react-dnd: Larger bundle, harder to optimize

## 3. IndexedDB Schema Design

### Decision: Document-Component-Template Hierarchy with Compression
**Rationale:**
- Extends existing database structure
- Optimizes for 2KB transmission constraint
- Supports efficient querying and caching

**Schema:**
- Sites: One per callsign
- Pages: Multiple per site
- Components: Grid-positioned elements
- Templates: Reusable layouts
- Functions: Backend action mappings

**Alternatives Considered:**
- Flat component storage: Poor query performance
- Relational approach: Too much overhead
- Pure JSON: Doesn't leverage compression

## 4. HTML Bandwidth Optimization

### Decision: Multi-Layer Compression with Template Compilation
**Rationale:**
- Extends existing HamRadioCompressor
- Template-based for repetitive components
- Achieves 6-20x compression ratios

**Stages:**
1. Component template compilation
2. Atomic CSS generation
3. Binary serialization for extreme compression

**Alternatives Considered:**
- Standard minification: Only 20-30% compression
- Gzip only: Not optimal for structured output
- Custom binary format: Too complex

## 5. Undo/Redo Implementation

### Decision: Hybrid Command-Memento Pattern with Compression
**Rationale:**
- Command pattern for granular operations
- Memento snapshots at strategic points
- Compressed storage for memory efficiency

**Alternatives Considered:**
- Pure Command Pattern: Complex for bulk operations
- Pure Memento Pattern: Excessive memory usage
- Event Sourcing: Overkill for client-side

## 6. Backend Function Linking

### Decision: Action Binding System with Visual Connectors
**Rationale:**
- Visual representation of data flow
- Type-safe function signatures
- Bandwidth-optimized action serialization

**Implementation Approach:**

### Visual Action Connectors
```typescript
interface ActionBinding {
  componentId: string;
  event: 'click' | 'submit' | 'change' | 'load';
  action: {
    type: 'server' | 'local' | 'navigation';
    handler: string; // Function name or URL
    params?: ParamMapping[];
  };
}

interface ParamMapping {
  source: 'component' | 'form' | 'global';
  sourceId?: string;
  sourcePath: string; // e.g., "value", "form.email"
  targetParam: string; // Function parameter name
}
```

### Function Registry
```typescript
// Server functions exposed to page builder
export const ServerFunctions = {
  // Decorated functions with metadata
  '@endpoint(/api/submit-form)': {
    name: 'submitForm',
    description: 'Submit contact form',
    params: [
      { name: 'email', type: 'string', required: true },
      { name: 'message', type: 'string', required: true }
    ],
    returns: { type: 'object', schema: '...' }
  },

  '@endpoint(/api/get-status)': {
    name: 'getStationStatus',
    description: 'Get current station status',
    params: [],
    returns: { type: 'object' }
  }
};
```

### Visual Function Picker
```typescript
export function FunctionPicker({ onSelect }: FunctionPickerProps) {
  return (
    <div className="function-picker">
      <CategoryList>
        <Category name="Data" icon="database">
          {dataFunctions.map(fn => (
            <FunctionCard
              key={fn.name}
              function={fn}
              onClick={() => onSelect(fn)}
            />
          ))}
        </Category>
        <Category name="Forms" icon="form">
          {formFunctions.map(fn => ...)}
        </Category>
        <Category name="Navigation" icon="link">
          {navFunctions.map(fn => ...)}
        </Category>
      </CategoryList>
    </div>
  );
}
```

### Wire-up UI
```typescript
// Visual connection between components and functions
export function ActionWireUp({ component, availableFunctions }) {
  const [connections, setConnections] = useState<ActionBinding[]>([]);

  return (
    <div className="action-wireup">
      <ComponentEvents component={component}>
        {component.events.map(event => (
          <EventRow key={event}>
            <EventName>{event}</EventName>
            <ConnectionLine />
            <FunctionDropZone
              onDrop={(fn) => createBinding(component, event, fn)}
            />
          </EventRow>
        ))}
      </ComponentEvents>

      <ParameterMapper
        bindings={connections}
        onMap={(binding, mapping) => updateMapping(binding, mapping)}
      />
    </div>
  );
}
```

### Bandwidth-Optimized Action Serialization
```typescript
// Compile actions to minimal representation
export class ActionCompiler {
  compile(bindings: ActionBinding[]): CompiledActions {
    return {
      // Use indices instead of strings
      handlers: this.extractUniqueHandlers(bindings),
      bindings: bindings.map(b => ({
        c: this.getComponentIndex(b.componentId),
        e: this.getEventIndex(b.event),
        h: this.getHandlerIndex(b.action.handler),
        p: this.compressParams(b.action.params)
      }))
    };
  }

  // Serialize to bytes for transmission
  serialize(compiled: CompiledActions): Uint8Array {
    const writer = new BinaryWriter();
    writer.writeUint8(compiled.handlers.length);
    compiled.handlers.forEach(h => writer.writeString(h));
    writer.writeUint16(compiled.bindings.length);
    // ... compact binary format
    return writer.toArray();
  }
}
```

### Runtime Execution
```typescript
// Execute actions when events fire
export class ActionExecutor {
  constructor(
    private serverFunctions: Map<string, Function>,
    private localFunctions: Map<string, Function>
  ) {}

  async execute(binding: ActionBinding, event: Event): Promise<void> {
    const params = this.extractParams(binding, event);

    switch (binding.action.type) {
      case 'server':
        await this.callServer(binding.action.handler, params);
        break;
      case 'local':
        this.callLocal(binding.action.handler, params);
        break;
      case 'navigation':
        this.navigate(binding.action.handler, params);
        break;
    }
  }

  private extractParams(binding: ActionBinding, event: Event): any[] {
    return binding.action.params?.map(mapping => {
      switch (mapping.source) {
        case 'component':
          return this.getComponentValue(mapping.sourceId, mapping.sourcePath);
        case 'form':
          return this.getFormValue(event.target as HTMLFormElement, mapping.sourcePath);
        case 'global':
          return this.getGlobalValue(mapping.sourcePath);
      }
    }) || [];
  }
}
```

### Visual Debugging
```typescript
// Show data flow in page builder
export function DataFlowOverlay({ page, bindings }) {
  return (
    <svg className="data-flow-overlay">
      {bindings.map(binding => (
        <FlowArrow
          key={binding.id}
          from={getComponentPosition(binding.componentId)}
          to={getFunctionPosition(binding.action.handler)}
          label={binding.event}
          animated={true}
        />
      ))}
    </svg>
  );
}
```

**Alternatives Considered:**
- Code generation: Too complex for visual builder
- REST-only: Doesn't support local functions
- GraphQL: Overhead too high for 2KB constraint
- Direct JavaScript: Security concerns, not visual

## Integration Points

1. **Component Properties Panel**: Add "Actions" tab for wiring events
2. **Function Browser**: Searchable list of available backend functions
3. **Parameter Mapper**: Visual UI for connecting component data to function params
4. **Test Mode**: Simulate function calls without backend
5. **Validation**: Type checking between components and functions

## Performance Targets

- Function registry: < 100 functions
- Action bindings: < 10 per component
- Serialized size: < 50 bytes per binding
- Runtime overhead: < 5ms per action
- Visual feedback: < 100ms response time