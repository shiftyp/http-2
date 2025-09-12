# ORM and Database Interface for Server Functions

## Overview
Server functions need a simple way to persist and query data. This document describes the ORM wrapper for IndexedDB and the spreadsheet-like interface for managing database tables.

## ORM Architecture

### Simple ORM Wrapper
The ORM provides a simplified interface over IndexedDB, similar to lightweight ORMs like Dexie.js or TypeORM-lite.

```typescript
// Example usage in a server function
export default async function handleContact(request, context) {
  const { db } = context;
  
  // Define or get existing table
  const messages = await db.table('messages', {
    id: 'autoincrement',
    from: 'string',
    subject: 'string',
    message: 'text',
    received: 'datetime',
    read: 'boolean'
  });
  
  // Insert new record
  await messages.insert({
    from: request.body.from,
    subject: request.body.subject,
    message: request.body.message,
    received: new Date(),
    read: false
  });
  
  // Query records
  const unread = await messages
    .where('read').equals(false)
    .orderBy('received').desc()
    .limit(10)
    .toArray();
  
  // Update records
  await messages
    .where('id').equals(messageId)
    .update({ read: true });
  
  // Delete records
  await messages
    .where('received').below(thirtyDaysAgo)
    .delete();
}
```

### ORM API

```typescript
interface ORM {
  // Table management
  table(name: string, schema?: TableSchema): Promise<Table>;
  dropTable(name: string): Promise<void>;
  getTables(): Promise<string[]>;
  
  // Transactions
  transaction(tables: string[], mode: 'readonly' | 'readwrite'): Transaction;
  
  // Backup/Restore
  export(): Promise<DatabaseExport>;
  import(data: DatabaseExport): Promise<void>;
}

interface Table {
  // CRUD operations
  insert(record: any): Promise<number>;
  insertMany(records: any[]): Promise<number[]>;
  get(id: any): Promise<any>;
  update(id: any, changes: any): Promise<void>;
  delete(id: any): Promise<void>;
  
  // Query builder
  where(field: string): QueryBuilder;
  orderBy(field: string): QueryBuilder;
  all(): Promise<any[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
  
  // Schema
  getSchema(): TableSchema;
  addIndex(field: string): Promise<void>;
}

interface QueryBuilder {
  equals(value: any): QueryBuilder;
  notEquals(value: any): QueryBuilder;
  above(value: any): QueryBuilder;
  below(value: any): QueryBuilder;
  between(lower: any, upper: any): QueryBuilder;
  startsWith(value: string): QueryBuilder;
  contains(value: string): QueryBuilder;
  in(values: any[]): QueryBuilder;
  
  // Sorting
  asc(): QueryBuilder;
  desc(): QueryBuilder;
  
  // Limiting
  limit(n: number): QueryBuilder;
  offset(n: number): QueryBuilder;
  
  // Execution
  toArray(): Promise<any[]>;
  first(): Promise<any>;
  count(): Promise<number>;
  update(changes: any): Promise<number>;
  delete(): Promise<number>;
}
```

### Schema Types

```typescript
type FieldType = 
  | 'autoincrement'  // Auto-incrementing integer
  | 'string'         // Short text (indexed)
  | 'text'           // Long text (not indexed)
  | 'number'         // Numeric value
  | 'boolean'        // True/false
  | 'datetime'       // Date/time value
  | 'json'           // JSON object
  | 'blob'           // Binary data

interface TableSchema {
  [fieldName: string]: FieldType | FieldDefinition;
}

interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: any;
  index?: boolean;
}
```

## Spreadsheet Interface

### UI Component
A React component that provides Excel-like editing capabilities for database tables.

```typescript
interface DataTableProps {
  functionId: string;     // Which function's data to show
  tableName: string;      // Which table to display
  editable?: boolean;     // Allow inline editing
  pageSize?: number;      // Rows per page
  onSave?: (changes: any[]) => void;
}
```

### Features

#### Grid Display
```
┌─────────────────────────────────────────────────────┐
│  Messages Table (guestbook function)                 │
├─────────────────────────────────────────────────────┤
│ [+ Add Row] [↻ Refresh] [⬇ Export CSV] [🗑 Delete]  │
├────┬──────────┬────────────┬──────────────┬────────┤
│ ID │ From     │ Subject    │ Message      │ Date   │
├────┼──────────┼────────────┼──────────────┼────────┤
│ 1  │ KA1ABC   │ Hello      │ Testing 123  │ 1/15   │
│ 2  │ W1XYZ    │ QSO        │ Thanks for.. │ 1/16   │
│ 3  │ KB2DEF   │ Emergency  │ Need help... │ 1/16   │
├────┴──────────┴────────────┴──────────────┴────────┤
│ Page 1 of 3  [<] [1] [2] [3] [>]  (25 records)     │
└─────────────────────────────────────────────────────┘
```

#### Inline Editing
- Double-click cell to edit
- Tab/Enter to move between cells
- Escape to cancel edit
- Auto-save on blur

#### Filtering and Sorting
```
┌─────────────────────────────────────────────────────┐
│ Filter: [From contains "ABC"___] [+ Add Filter]     │
│ Sort: [Date ↓] [Secondary: From ↑]                  │
└─────────────────────────────────────────────────────┘
```

#### Column Operations
- Resize columns by dragging
- Reorder columns
- Hide/show columns
- Pin columns to left/right

### Implementation

```typescript
// DataTable component
export const DataTable: React.FC<DataTableProps> = ({
  functionId,
  tableName,
  editable = true,
  pageSize = 25
}) => {
  const [data, setData] = useState<any[]>([]);
  const [schema, setSchema] = useState<TableSchema>();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort>();
  const [selectedRows, setSelectedRows] = useState<Set<number>>();
  
  // Load data from IndexedDB
  useEffect(() => {
    loadTableData();
  }, [functionId, tableName, page, filters, sort]);
  
  const loadTableData = async () => {
    const db = await getDatabase(functionId);
    const table = await db.table(tableName);
    
    let query = table.where('1').equals(1); // Start with all
    
    // Apply filters
    filters.forEach(filter => {
      query = applyFilter(query, filter);
    });
    
    // Apply sort
    if (sort) {
      query = query.orderBy(sort.field);
      if (sort.direction === 'desc') {
        query = query.desc();
      }
    }
    
    // Pagination
    const results = await query
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    
    setData(results);
    setSchema(await table.getSchema());
  };
  
  const handleCellEdit = async (rowId: number, field: string, value: any) => {
    const db = await getDatabase(functionId);
    const table = await db.table(tableName);
    await table.update(rowId, { [field]: value });
    await loadTableData();
  };
  
  const handleAddRow = async () => {
    const newRow = createEmptyRow(schema);
    const db = await getDatabase(functionId);
    const table = await db.table(tableName);
    await table.insert(newRow);
    await loadTableData();
  };
  
  const handleDeleteRows = async () => {
    const db = await getDatabase(functionId);
    const table = await db.table(tableName);
    
    for (const rowId of selectedRows) {
      await table.delete(rowId);
    }
    
    setSelectedRows(new Set());
    await loadTableData();
  };
  
  const exportCSV = () => {
    const csv = convertToCSV(data, schema);
    downloadFile('export.csv', csv);
  };
  
  return (
    <div className="data-table">
      <Toolbar>
        <Button onClick={handleAddRow}>Add Row</Button>
        <Button onClick={loadTableData}>Refresh</Button>
        <Button onClick={exportCSV}>Export CSV</Button>
        <Button onClick={handleDeleteRows} disabled={!selectedRows.size}>
          Delete Selected
        </Button>
      </Toolbar>
      
      <FilterBar filters={filters} onChange={setFilters} />
      
      <Grid
        data={data}
        schema={schema}
        editable={editable}
        onCellEdit={handleCellEdit}
        onSelectionChange={setSelectedRows}
        sort={sort}
        onSortChange={setSort}
      />
      
      <Pagination
        page={page}
        pageSize={pageSize}
        totalRecords={totalCount}
        onChange={setPage}
      />
    </div>
  );
};
```

## Database Explorer

### Function Database View
Each server function gets its own isolated database namespace:

```
┌─────────────────────────────────────────────────────┐
│  Database Explorer                                   │
├─────────────────────────────────────────────────────┤
│ Function: [guestbook ▼]                             │
│                                                      │
│ Tables:                                              │
│ ├── 📊 messages (142 records)                       │
│ ├── 📊 users (28 records)                          │
│ └── 📊 settings (1 record)                         │
│                                                      │
│ [Create Table] [Import Data] [Export All]           │
└─────────────────────────────────────────────────────┘
```

### SQL-like Query Interface
For advanced users, provide a query builder:

```typescript
// Query builder UI
const QueryBuilder = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>();
  
  const executeQuery = async () => {
    // Parse SQL-like syntax
    const parsed = parseQuery(query);
    
    // Convert to ORM calls
    const db = await getDatabase(currentFunction);
    const table = await db.table(parsed.table);
    
    let q = table.where(parsed.where.field);
    
    // Build query
    switch (parsed.where.operator) {
      case '=': q = q.equals(parsed.where.value); break;
      case '>': q = q.above(parsed.where.value); break;
      case '<': q = q.below(parsed.where.value); break;
      case 'LIKE': q = q.contains(parsed.where.value); break;
    }
    
    if (parsed.orderBy) {
      q = q.orderBy(parsed.orderBy.field);
      if (parsed.orderBy.direction === 'DESC') {
        q = q.desc();
      }
    }
    
    if (parsed.limit) {
      q = q.limit(parsed.limit);
    }
    
    const results = await q.toArray();
    setResults(results);
  };
  
  return (
    <div className="query-builder">
      <textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="SELECT * FROM messages WHERE read = false ORDER BY date DESC LIMIT 10"
      />
      <button onClick={executeQuery}>Execute</button>
      {results && <DataGrid data={results} />}
    </div>
  );
};
```

## Integration with Server Functions

### Function Context Enhancement

```typescript
interface FunctionContext {
  // Existing context...
  
  // Enhanced database access
  db: ORM;  // ORM instance for this function
  
  // Direct table access shortcuts
  tables: {
    [name: string]: Table;
  };
}

// Usage in server function
export default async function handler(request, context) {
  const { db, tables } = context;
  
  // Direct table access
  const messages = tables.messages || await db.table('messages', {
    id: 'autoincrement',
    from: 'string',
    message: 'text',
    timestamp: 'datetime'
  });
  
  // Use ORM
  const recent = await messages
    .where('timestamp')
    .above(new Date(Date.now() - 86400000))
    .orderBy('timestamp')
    .desc()
    .toArray();
  
  return context.respond.json(recent);
}
```

## Storage Implementation

### IndexedDB Structure
```
function-data/
├── guestbook/
│   ├── __schema__/        # Table schemas
│   │   ├── messages
│   │   └── users
│   ├── messages/          # Table data
│   │   ├── 1
│   │   ├── 2
│   │   └── ...
│   └── users/             # Table data
│       ├── 1
│       └── ...
└── contact-form/
    └── ...
```

### Migration System

```typescript
interface Migration {
  version: number;
  up: (db: ORM) => Promise<void>;
  down: (db: ORM) => Promise<void>;
}

// Example migration
const migration_001: Migration = {
  version: 1,
  async up(db) {
    const messages = await db.table('messages', {
      id: 'autoincrement',
      from: 'string',
      message: 'text'
    });
    
    // Add new field to existing table
    await messages.addColumn('read', 'boolean', false);
  },
  
  async down(db) {
    const messages = await db.table('messages');
    await messages.dropColumn('read');
  }
};
```

## Benefits

1. **Familiar Interface**: SQL-like queries and spreadsheet editing
2. **Type Safety**: TypeScript interfaces for schema definition
3. **Performance**: Indexes and query optimization
4. **Offline First**: All data stored locally in IndexedDB
5. **Data Isolation**: Each function has its own database namespace
6. **Easy Export**: CSV/JSON export for data portability
7. **Visual Management**: See and edit data without coding

---
*This architecture provides server functions with powerful data persistence capabilities while maintaining simplicity and offline-first principles.*