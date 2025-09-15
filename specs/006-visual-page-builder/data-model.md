# Visual Page Builder Data Model

## Core Entities

### Site
```typescript
interface Site {
  id: string;                    // UUID
  callsign: string;              // Owner's callsign (e.g., "KA1ABC")
  name: string;                  // Site display name
  description?: string;          // Site description
  pages: string[];               // Page IDs in order
  homePage: string;              // Default page ID
  globalStyles?: StyleSet;       // Site-wide styles
  metadata: SiteMetadata;
  createdAt: Date;
  updatedAt: Date;
}

interface SiteMetadata {
  version: string;               // Site format version
  totalSize: number;             // Total size in bytes
  compressionRatio: number;      // Average compression ratio
  lastPublished?: Date;
}
```

### Page
```typescript
interface Page {
  id: string;                    // UUID
  siteId: string;                // Parent site
  slug: string;                  // URL path (e.g., "about")
  title: string;
  description?: string;
  components: PageComponent[];   // Ordered component list
  layout: GridLayout;            // Grid configuration
  actions: ActionBinding[];      // Event-action bindings
  templateId?: string;           // Source template if any
  metadata: PageMetadata;
  createdAt: Date;
  updatedAt: Date;
}

interface PageMetadata {
  compressedSize: number;        // Size after compression
  componentCount: number;
  lastValidation?: Date;
  bandwidthValid: boolean;       // Fits in 2KB limit
}
```

### PageComponent
```typescript
interface PageComponent {
  id: string;                    // Component instance ID
  type: ComponentType;           // text, form, image, etc.
  gridArea: GridPosition;        // Grid placement
  properties: ComponentProps;     // Type-specific properties
  style?: ComponentStyle;        // Visual styling
  children?: PageComponent[];    // Nested components
  locked?: boolean;              // Prevent editing
}

enum ComponentType {
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

interface ComponentProps {
  // Base properties
  content?: string;              // Text content
  name?: string;                 // Form field name
  value?: any;                   // Current value
  placeholder?: string;
  required?: boolean;

  // Type-specific properties
  [key: string]: any;
}

interface ComponentStyle {
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
```

### GridLayout
```typescript
interface GridLayout {
  columns: number;               // Number of columns (default 12)
  rows: number;                  // Number of rows (auto-expand)
  gap: number;                   // Gap between cells (px)
  responsive: ResponsiveBreakpoint[];
}

interface GridPosition {
  row: number;                   // Start row
  col: number;                   // Start column
  rowSpan: number;               // Height in grid cells
  colSpan: number;               // Width in grid cells
}

interface ResponsiveBreakpoint {
  maxWidth: number;              // Screen width threshold
  columns: number;               // Columns at this breakpoint
  stackComponents?: boolean;     // Stack vertically on mobile
}
```

### Template
```typescript
interface PageTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  thumbnail?: string;            // Base64 preview image
  layout: GridLayout;
  components: TemplateComponent[];
  styles?: StyleSet;
  author: string;                // Callsign of creator
  isPublic: boolean;             // Available for sharing
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

enum TemplateCategory {
  LANDING = 'landing',
  BLOG = 'blog',
  CONTACT = 'contact',
  GALLERY = 'gallery',
  CUSTOM = 'custom'
}

interface TemplateComponent {
  type: ComponentType;
  gridArea: GridPosition;
  defaultProps: ComponentProps;
  style?: ComponentStyle;
  placeholder?: string;          // Instructions for user
}
```

### ActionBinding
```typescript
interface ActionBinding {
  id: string;
  componentId: string;           // Source component
  event: EventType;              // Triggering event
  action: Action;                // What to execute
  params?: ParamMapping[];       // Parameter mappings
  condition?: ActionCondition;   // Optional conditional
}

enum EventType {
  CLICK = 'click',
  SUBMIT = 'submit',
  CHANGE = 'change',
  FOCUS = 'focus',
  BLUR = 'blur',
  LOAD = 'load'
}

interface Action {
  type: 'server' | 'local' | 'navigation';
  handler: string;               // Function name or URL
  description?: string;
}

interface ParamMapping {
  source: 'component' | 'form' | 'page' | 'global';
  sourceId?: string;             // Component/form ID
  sourcePath: string;            // Property path
  targetParam: string;           // Function parameter
  transform?: string;            // Optional transform
}

interface ActionCondition {
  type: 'simple' | 'expression';
  field?: string;
  operator?: '==' | '!=' | '>' | '<' | 'contains';
  value?: any;
  expression?: string;           // For complex conditions
}
```

### EditHistory
```typescript
interface EditHistory {
  id: string;
  pageId: string;
  sessionId: string;
  operations: EditOperation[];
  maxSize: number;               // Max operations to keep
  currentIndex: number;          // For undo/redo
}

interface EditOperation {
  id: string;
  type: OperationType;
  timestamp: Date;
  componentId?: string;
  previousState?: any;           // For undo
  newState?: any;                // For redo
  compressed?: boolean;          // If state is compressed
}

enum OperationType {
  ADD_COMPONENT = 'add_component',
  REMOVE_COMPONENT = 'remove_component',
  MOVE_COMPONENT = 'move_component',
  UPDATE_PROPS = 'update_props',
  UPDATE_STYLE = 'update_style',
  APPLY_TEMPLATE = 'apply_template',
  BULK_OPERATION = 'bulk_operation'
}
```

### ServerFunction
```typescript
interface ServerFunction {
  id: string;
  name: string;                  // Display name
  endpoint: string;              // API endpoint
  description: string;
  category: FunctionCategory;
  params: FunctionParam[];
  returns: ReturnType;
  requiresAuth?: boolean;
  rateLimit?: number;            // Calls per minute
}

enum FunctionCategory {
  DATA = 'data',
  FORM = 'form',
  NAVIGATION = 'navigation',
  UTILITY = 'utility',
  CUSTOM = 'custom'
}

interface FunctionParam {
  name: string;
  type: ParamType;
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: ParamValidation;
}

enum ParamType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array'
}

interface ParamValidation {
  pattern?: string;              // Regex pattern
  min?: number;
  max?: number;
  enum?: any[];
}

interface ReturnType {
  type: ParamType;
  description?: string;
  schema?: object;               // JSON schema
}
```

## Relationships

```
Site (1) ─────> (*) Page
  │                  │
  │                  ├─> (*) PageComponent
  │                  ├─> (1) GridLayout
  │                  ├─> (*) ActionBinding
  │                  └─> (1) EditHistory
  │
  └─> (*) PageTemplate
            │
            ├─> (*) TemplateComponent
            └─> (1) GridLayout

ActionBinding ────> ServerFunction
     │
     └─> (*) ParamMapping
```

## IndexedDB Stores

```typescript
const PAGE_BUILDER_STORES = {
  sites: {
    keyPath: 'id',
    indexes: ['callsign', 'updatedAt']
  },
  pages: {
    keyPath: 'id',
    indexes: ['siteId', 'slug', 'updatedAt']
  },
  components: {
    keyPath: 'id',
    indexes: ['pageId', 'type', 'gridArea']
  },
  templates: {
    keyPath: 'id',
    indexes: ['category', 'author', 'isPublic', 'usageCount']
  },
  actions: {
    keyPath: 'id',
    indexes: ['pageId', 'componentId', 'event']
  },
  functions: {
    keyPath: 'id',
    indexes: ['category', 'endpoint']
  },
  history: {
    keyPath: 'id',
    indexes: ['pageId', 'sessionId', 'timestamp']
  }
};
```

## Size Constraints

- **Page**: Max 2KB compressed
- **Component**: ~50-200 bytes each
- **Site**: Max 100 pages
- **Template**: Max 1KB
- **History**: Max 50 operations per session