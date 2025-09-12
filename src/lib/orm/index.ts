/**
 * Simplified ORM for IndexedDB
 * Provides a query builder interface similar to popular ORMs
 */

export type FieldType = 
  | 'autoincrement'
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'json'
  | 'blob';

export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: any;
  index?: boolean;
}

export type TableSchema = Record<string, FieldType | FieldDefinition>;

export interface DatabaseExport {
  version: number;
  tables: Record<string, {
    schema: TableSchema;
    data: any[];
  }>;
  timestamp: string;
}

export class QueryBuilder {
  private db: IDBDatabase;
  private storeName: string;
  private conditions: Array<{
    field: string;
    operator: string;
    value: any;
  }> = [];
  private sortField?: string;
  private sortDirection: 'asc' | 'desc' = 'asc';
  private limitValue?: number;
  private offsetValue?: number;

  constructor(db: IDBDatabase, storeName: string) {
    this.db = db;
    this.storeName = storeName;
  }

  where(field: string): QueryBuilder {
    this.conditions.push({ field, operator: '', value: undefined });
    return this;
  }

  equals(value: any): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = '=';
      lastCondition.value = value;
    }
    return this;
  }

  notEquals(value: any): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = '!=';
      lastCondition.value = value;
    }
    return this;
  }

  above(value: any): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = '>';
      lastCondition.value = value;
    }
    return this;
  }

  below(value: any): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = '<';
      lastCondition.value = value;
    }
    return this;
  }

  between(lower: any, upper: any): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = 'between';
      lastCondition.value = [lower, upper];
    }
    return this;
  }

  contains(value: string): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = 'contains';
      lastCondition.value = value;
    }
    return this;
  }

  startsWith(value: string): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = 'startsWith';
      lastCondition.value = value;
    }
    return this;
  }

  in(values: any[]): QueryBuilder {
    const lastCondition = this.conditions[this.conditions.length - 1];
    if (lastCondition) {
      lastCondition.operator = 'in';
      lastCondition.value = values;
    }
    return this;
  }

  orderBy(field: string): QueryBuilder {
    this.sortField = field;
    return this;
  }

  asc(): QueryBuilder {
    this.sortDirection = 'asc';
    return this;
  }

  desc(): QueryBuilder {
    this.sortDirection = 'desc';
    return this;
  }

  limit(n: number): QueryBuilder {
    this.limitValue = n;
    return this;
  }

  offset(n: number): QueryBuilder {
    this.offsetValue = n;
    return this;
  }

  private applyConditions(record: any): boolean {
    for (const condition of this.conditions) {
      const fieldValue = record[condition.field];
      
      switch (condition.operator) {
        case '=':
          if (fieldValue !== condition.value) return false;
          break;
        case '!=':
          if (fieldValue === condition.value) return false;
          break;
        case '>':
          if (fieldValue <= condition.value) return false;
          break;
        case '<':
          if (fieldValue >= condition.value) return false;
          break;
        case 'between':
          if (fieldValue < condition.value[0] || fieldValue > condition.value[1]) return false;
          break;
        case 'contains':
          if (!String(fieldValue).includes(condition.value)) return false;
          break;
        case 'startsWith':
          if (!String(fieldValue).startsWith(condition.value)) return false;
          break;
        case 'in':
          if (!condition.value.includes(fieldValue)) return false;
          break;
      }
    }
    return true;
  }

  async toArray(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result || [];
        
        // Apply conditions
        if (this.conditions.length > 0) {
          results = results.filter(record => this.applyConditions(record));
        }
        
        // Apply sorting
        if (this.sortField) {
          results.sort((a, b) => {
            const aVal = a[this.sortField!];
            const bVal = b[this.sortField!];
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return this.sortDirection === 'asc' ? comparison : -comparison;
          });
        }
        
        // Apply offset and limit
        if (this.offsetValue !== undefined) {
          results = results.slice(this.offsetValue);
        }
        if (this.limitValue !== undefined) {
          results = results.slice(0, this.limitValue);
        }
        
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async first(): Promise<any> {
    const results = await this.limit(1).toArray();
    return results[0] || null;
  }

  async count(): Promise<number> {
    const results = await this.toArray();
    return results.length;
  }

  async update(changes: any): Promise<number> {
    const records = await this.toArray();
    let updated = 0;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      for (const record of records) {
        const updatedRecord = { ...record, ...changes, updated: new Date() };
        const request = store.put(updatedRecord);
        request.onsuccess = () => updated++;
      }

      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(): Promise<number> {
    const records = await this.toArray();
    let deleted = 0;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      for (const record of records) {
        const request = store.delete(record.id || record.path || record.callsign);
        request.onsuccess = () => deleted++;
      }

      tx.oncomplete = () => resolve(deleted);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export class Table {
  private db: IDBDatabase;
  private name: string;
  private schema: TableSchema;
  private functionId: string;

  constructor(db: IDBDatabase, functionId: string, name: string, schema: TableSchema) {
    this.db = db;
    this.functionId = functionId;
    this.name = name;
    this.schema = schema;
  }

  private getStoreName(): string {
    return 'function-data';
  }

  async insert(record: any): Promise<number> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = tx.objectStore(this.getStoreName());
      
      const data = {
        functionId: this.functionId,
        tableName: this.name,
        data: record,
        created: new Date(),
        updated: new Date()
      };
      
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async insertMany(records: any[]): Promise<number[]> {
    const ids: number[] = [];
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = tx.objectStore(this.getStoreName());
      
      for (const record of records) {
        const data = {
          functionId: this.functionId,
          tableName: this.name,
          data: record,
          created: new Date(),
          updated: new Date()
        };
        
        const request = store.add(data);
        request.onsuccess = () => ids.push(request.result as number);
      }
      
      tx.oncomplete = () => resolve(ids);
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(id: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.getStoreName()], 'readonly');
      const store = tx.objectStore(this.getStoreName());
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async update(id: any, changes: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = tx.objectStore(this.getStoreName());
      const request = store.get(id);
      
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          record.data = { ...record.data, ...changes };
          record.updated = new Date();
          const updateRequest = store.put(record);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Record not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = tx.objectStore(this.getStoreName());
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  where(field: string): QueryBuilder {
    const builder = new QueryBuilder(this.db, this.getStoreName());
    // Pre-filter by function and table
    return builder.where('functionId').equals(this.functionId)
      .where('tableName').equals(this.name)
      .where(field);
  }

  async all(): Promise<any[]> {
    return this.where('functionId').equals(this.functionId).toArray();
  }

  async count(): Promise<number> {
    return this.where('functionId').equals(this.functionId).count();
  }

  async clear(): Promise<void> {
    await this.where('functionId').equals(this.functionId).delete();
  }

  getSchema(): TableSchema {
    return this.schema;
  }
}

export class ORM {
  private db: IDBDatabase;
  private functionId: string;
  private tables: Map<string, Table> = new Map();

  constructor(db: IDBDatabase, functionId: string) {
    this.db = db;
    this.functionId = functionId;
  }

  async table(name: string, schema?: TableSchema): Promise<Table> {
    if (this.tables.has(name)) {
      return this.tables.get(name)!;
    }

    if (!schema) {
      // Load existing schema from database
      const tx = this.db.transaction(['function-databases'], 'readonly');
      const store = tx.objectStore('function-databases');
      const request = store.get(this.functionId);
      
      const dbInfo = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (dbInfo) {
        const tableInfo = dbInfo.tables.find((t: any) => t.name === name);
        if (tableInfo) {
          schema = tableInfo.fields;
        }
      }
    }

    if (!schema) {
      throw new Error(`Table ${name} does not exist and no schema provided`);
    }

    // Save schema if new
    await this.saveSchema(name, schema);

    const table = new Table(this.db, this.functionId, name, schema);
    this.tables.set(name, table);
    return table;
  }

  private async saveSchema(tableName: string, schema: TableSchema): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['function-databases'], 'readwrite');
      const store = tx.objectStore('function-databases');
      const request = store.get(this.functionId);

      request.onsuccess = () => {
        let dbInfo = request.result || {
          functionId: this.functionId,
          tables: [],
          version: 1,
          created: new Date(),
          updated: new Date()
        };

        const existingTable = dbInfo.tables.find((t: any) => t.name === tableName);
        if (!existingTable) {
          dbInfo.tables.push({
            name: tableName,
            fields: schema,
            indexes: [],
            recordCount: 0
          });
          dbInfo.updated = new Date();
          
          const updateRequest = store.put(dbInfo);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async dropTable(name: string): Promise<void> {
    // Delete all records for this table
    const table = await this.table(name);
    await table.clear();

    // Remove from schema
    const tx = this.db.transaction(['function-databases'], 'readwrite');
    const store = tx.objectStore('function-databases');
    const request = store.get(this.functionId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const dbInfo = request.result;
        if (dbInfo) {
          dbInfo.tables = dbInfo.tables.filter((t: any) => t.name !== name);
          dbInfo.updated = new Date();
          
          const updateRequest = store.put(dbInfo);
          updateRequest.onsuccess = () => {
            this.tables.delete(name);
            resolve();
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTables(): Promise<string[]> {
    const tx = this.db.transaction(['function-databases'], 'readonly');
    const store = tx.objectStore('function-databases');
    const request = store.get(this.functionId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const dbInfo = request.result;
        resolve(dbInfo ? dbInfo.tables.map((t: any) => t.name) : []);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async export(): Promise<DatabaseExport> {
    const tables = await this.getTables();
    const exportData: DatabaseExport = {
      version: 1,
      tables: {},
      timestamp: new Date().toISOString()
    };

    for (const tableName of tables) {
      const table = await this.table(tableName);
      const data = await table.all();
      exportData.tables[tableName] = {
        schema: table.getSchema(),
        data
      };
    }

    return exportData;
  }

  async import(data: DatabaseExport): Promise<void> {
    for (const [tableName, tableData] of Object.entries(data.tables)) {
      const table = await this.table(tableName, tableData.schema);
      await table.clear();
      await table.insertMany(tableData.data);
    }
  }
}

// Factory function to create ORM instance
export async function createORM(functionId: string): Promise<ORM> {
  const dbRequest = indexedDB.open('ham-radio-pwa', 1);
  
  return new Promise((resolve, reject) => {
    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      resolve(new ORM(db, functionId));
    };
    dbRequest.onerror = () => reject(dbRequest.error);
  });
}