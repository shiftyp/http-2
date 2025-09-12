import React, { useState, useEffect } from 'react';
import { createORM, ORM } from '../../lib/orm';
import './DataTable.css';

interface DataTableProps {
  functionId: string;
  tableName: string;
  editable?: boolean;
  pageSize?: number;
  onSave?: (changes: any[]) => void;
}

interface Column {
  field: string;
  label: string;
  type: string;
  width?: number;
  editable?: boolean;
}

interface Filter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: any;
}

interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

const DataTable: React.FC<DataTableProps> = ({
  functionId,
  tableName,
  editable = true,
  pageSize = 25,
  onSave
}) => {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [orm, setOrm] = useState<ORM | null>(null);

  // Initialize ORM and load data
  useEffect(() => {
    initializeTable();
  }, [functionId, tableName]);

  // Reload data when filters, sort, or page changes
  useEffect(() => {
    if (orm) {
      loadData();
    }
  }, [orm, page, filters, sort]);

  const initializeTable = async () => {
    try {
      const ormInstance = await createORM(functionId);
      setOrm(ormInstance);
      
      // Get table schema
      const tables = await ormInstance.getTables();
      if (tables.includes(tableName)) {
        const table = await ormInstance.table(tableName);
        const schema = table.getSchema();
        
        // Convert schema to columns
        const cols: Column[] = Object.entries(schema).map(([field, type]) => ({
          field,
          label: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
          type: typeof type === 'string' ? type : type.type,
          editable: field !== 'id' && field !== 'created' && field !== 'updated'
        }));
        
        setColumns(cols);
      }
    } catch (error) {
      console.error('Failed to initialize table:', error);
    }
  };

  const loadData = async () => {
    if (!orm) return;
    
    setLoading(true);
    try {
      const table = await orm.table(tableName);
      let query = table.where('functionId').equals(functionId);
      
      // Apply filters
      filters.forEach(filter => {
        const fieldQuery = query.where(filter.field);
        switch (filter.operator) {
          case 'equals':
            query = fieldQuery.equals(filter.value);
            break;
          case 'contains':
            query = fieldQuery.contains(filter.value);
            break;
          case 'gt':
            query = fieldQuery.above(filter.value);
            break;
          case 'lt':
            query = fieldQuery.below(filter.value);
            break;
        }
      });
      
      // Apply sort
      if (sort) {
        query = query.orderBy(sort.field);
        if (sort.direction === 'desc') {
          query = query.desc();
        }
      }
      
      // Get total count
      const total = await query.count();
      setTotalRecords(total);
      
      // Apply pagination
      query = query.offset((page - 1) * pageSize).limit(pageSize);
      
      // Get data
      const results = await query.toArray();
      setData(results);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = async (rowIndex: number, field: string, value: any) => {
    if (!orm) return;
    
    try {
      const record = data[rowIndex];
      const table = await orm.table(tableName);
      await table.update(record.id, { [field]: value });
      
      // Update local state
      const newData = [...data];
      newData[rowIndex] = { ...record, [field]: value };
      setData(newData);
      
      if (onSave) {
        onSave([{ id: record.id, [field]: value }]);
      }
    } catch (error) {
      console.error('Failed to update cell:', error);
    }
  };

  const handleAddRow = async () => {
    if (!orm) return;
    
    try {
      const table = await orm.table(tableName);
      const newRow: any = {};
      
      // Initialize with default values
      columns.forEach(col => {
        switch (col.type) {
          case 'string':
          case 'text':
            newRow[col.field] = '';
            break;
          case 'number':
            newRow[col.field] = 0;
            break;
          case 'boolean':
            newRow[col.field] = false;
            break;
          case 'datetime':
            newRow[col.field] = new Date().toISOString();
            break;
          default:
            newRow[col.field] = null;
        }
      });
      
      const id = await table.insert(newRow);
      newRow.id = id;
      
      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Failed to add row:', error);
    }
  };

  const handleDeleteRows = async () => {
    if (!orm || selectedRows.size === 0) return;
    
    try {
      const table = await orm.table(tableName);
      
      for (const rowIndex of selectedRows) {
        const record = data[rowIndex];
        if (record) {
          await table.delete(record.id);
        }
      }
      
      setSelectedRows(new Set());
      await loadData();
    } catch (error) {
      console.error('Failed to delete rows:', error);
    }
  };

  const handleSort = (field: string) => {
    if (sort?.field === field) {
      // Toggle direction
      setSort({
        field,
        direction: sort.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // New sort field
      setSort({ field, direction: 'asc' });
    }
  };

  const handleFilterChange = (field: string, operator: Filter['operator'], value: any) => {
    setFilters(prev => {
      const newFilters = prev.filter(f => f.field !== field);
      if (value !== '') {
        newFilters.push({ field, operator, value });
      }
      return newFilters;
    });
    setPage(1); // Reset to first page
  };

  const exportCSV = () => {
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(row => 
      columns.map(c => {
        const value = row[c.field];
        // Escape values with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  if (loading && data.length === 0) {
    return <div className="data-table-loading">Loading...</div>;
  }

  return (
    <div className="data-table-container">
      <div className="data-table-toolbar">
        <div className="toolbar-left">
          <button onClick={handleAddRow} disabled={!editable}>
            + Add Row
          </button>
          <button onClick={loadData}>↻ Refresh</button>
          <button onClick={exportCSV}>⬇ Export CSV</button>
          <button 
            onClick={handleDeleteRows} 
            disabled={selectedRows.size === 0}
            className="danger"
          >
            🗑 Delete Selected ({selectedRows.size})
          </button>
        </div>
        <div className="toolbar-right">
          <span className="record-count">
            {totalRecords} records
          </span>
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRows(new Set(data.map((_, i) => i)));
                    } else {
                      setSelectedRows(new Set());
                    }
                  }}
                />
              </th>
              {columns.map(col => (
                <th 
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  className="sortable"
                >
                  <div className="th-content">
                    <span>{col.label}</span>
                    {sort?.field === col.field && (
                      <span className="sort-indicator">
                        {sort.direction === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="filter-row">
              <th></th>
              {columns.map(col => (
                <th key={`filter-${col.field}`}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    className="filter-input"
                    onChange={(e) => handleFilterChange(col.field, 'contains', e.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr 
                key={row.id || rowIndex}
                className={selectedRows.has(rowIndex) ? 'selected' : ''}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowIndex)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedRows);
                      if (e.target.checked) {
                        newSelected.add(rowIndex);
                      } else {
                        newSelected.delete(rowIndex);
                      }
                      setSelectedRows(newSelected);
                    }}
                  />
                </td>
                {columns.map(col => (
                  <td 
                    key={col.field}
                    className={editingCell?.row === rowIndex && editingCell?.field === col.field ? 'editing' : ''}
                    onDoubleClick={() => {
                      if (editable && col.editable) {
                        setEditingCell({ row: rowIndex, field: col.field });
                        setEditValue(row[col.field] || '');
                      }
                    }}
                  >
                    {editingCell?.row === rowIndex && editingCell?.field === col.field ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          handleCellEdit(rowIndex, col.field, editValue);
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCellEdit(rowIndex, col.field, editValue);
                            setEditingCell(null);
                          } else if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span>{formatCellValue(row[col.field], col.type)}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-table-pagination">
        <button 
          onClick={() => setPage(1)} 
          disabled={page === 1}
        >
          First
        </button>
        <button 
          onClick={() => setPage(page - 1)} 
          disabled={page === 1}
        >
          Previous
        </button>
        <span className="page-info">
          Page {page} of {totalPages}
        </span>
        <button 
          onClick={() => setPage(page + 1)} 
          disabled={page === totalPages}
        >
          Next
        </button>
        <button 
          onClick={() => setPage(totalPages)} 
          disabled={page === totalPages}
        >
          Last
        </button>
      </div>
    </div>
  );
};

function formatCellValue(value: any, type: string): string {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'datetime':
      return new Date(value).toLocaleString();
    case 'boolean':
      return value ? '✓' : '✗';
    case 'json':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

export default DataTable;