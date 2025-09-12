import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable/DataTable';
import { createFunctionManager } from '../lib/function-runtime';
import { createORM } from '../lib/orm';
import './DatabaseManager.css';

const DatabaseManager: React.FC = () => {
  const [functions, setFunctions] = useState<any[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [queryMode, setQueryMode] = useState(false);
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState<any[]>([]);

  useEffect(() => {
    loadFunctions();
  }, []);

  useEffect(() => {
    if (selectedFunction) {
      loadTables();
    }
  }, [selectedFunction]);

  const loadFunctions = async () => {
    try {
      const manager = await createFunctionManager();
      const funcs = await manager.listFunctions();
      setFunctions(funcs);
      if (funcs.length > 0 && !selectedFunction) {
        setSelectedFunction(funcs[0].path);
      }
    } catch (error) {
      console.error('Failed to load functions:', error);
    }
  };

  const loadTables = async () => {
    if (!selectedFunction) return;
    
    try {
      const orm = await createORM(selectedFunction);
      const tableList = await orm.getTables();
      setTables(tableList);
      if (tableList.length > 0 && !selectedTable) {
        setSelectedTable(tableList[0]);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const executeQuery = async () => {
    if (!selectedFunction || !query) return;
    
    try {
      const orm = await createORM(selectedFunction);
      
      // Parse simple SQL-like syntax
      const parts = query.toLowerCase().split(' ');
      if (parts[0] === 'select' && parts.includes('from')) {
        const tableIndex = parts.indexOf('from') + 1;
        const tableName = parts[tableIndex];
        
        const table = await orm.table(tableName);
        const results = await table.all();
        setQueryResults(results);
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      setQueryResults([]);
    }
  };

  return (
    <div className="database-manager">
      <h2>Database Manager</h2>
      
      <div className="database-controls">
        <div className="control-group">
          <label>Function:</label>
          <select 
            value={selectedFunction} 
            onChange={(e) => setSelectedFunction(e.target.value)}
          >
            <option value="">Select a function...</option>
            {functions.map(func => (
              <option key={func.path} value={func.path}>
                {func.name || func.path}
              </option>
            ))}
          </select>
        </div>
        
        {selectedFunction && (
          <div className="control-group">
            <label>Table:</label>
            <select 
              value={selectedTable} 
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">Select a table...</option>
              {tables.map(table => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="control-group">
          <button onClick={() => setQueryMode(!queryMode)}>
            {queryMode ? 'Table View' : 'Query Mode'}
          </button>
        </div>
      </div>
      
      {queryMode ? (
        <div className="query-builder">
          <h3>Query Builder</h3>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter SQL-like query (e.g., SELECT * FROM messages WHERE read = false)"
            rows={5}
          />
          <button onClick={executeQuery}>Execute Query</button>
          
          {queryResults.length > 0 && (
            <div className="query-results">
              <h4>Results ({queryResults.length} rows)</h4>
              <pre>{JSON.stringify(queryResults, null, 2)}</pre>
            </div>
          )}
        </div>
      ) : (
        selectedFunction && selectedTable && (
          <DataTable
            functionId={selectedFunction}
            tableName={selectedTable}
            editable={true}
            pageSize={25}
          />
        )
      )}
      
      {!selectedFunction && (
        <div className="empty-state">
          <p>No server functions found. Create a function first to manage its database.</p>
        </div>
      )}
    </div>
  );
};

export default DatabaseManager;