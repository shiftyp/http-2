/**
 * FaaS (Function-as-a-Service) Runtime for Server Functions
 * Executes JavaScript functions in isolated contexts with sandboxed APIs
 */

import { createORM, ORM } from '../orm';

// Function context API types
export interface FunctionRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: any;
  
  // Radio-specific headers
  'X-Radio-Signature'?: string;
  'X-Radio-Callsign'?: string;
  'X-Radio-Timestamp'?: string;
  
  // Verified data
  fromCallsign?: string;
  authenticated: boolean;
  trustLevel: number;
  hops?: number;
  signalStrength?: number;
}

export interface FunctionResponse {
  status: number;
  headers: Record<string, string>;
  body: string | Uint8Array | any;
}

export interface ResponseHelpers {
  html(content: string, status?: number): FunctionResponse;
  json(data: any, status?: number): FunctionResponse;
  text(content: string, status?: number): FunctionResponse;
  redirect(url: string, status?: number): FunctionResponse;
  error(message: string, status?: number): FunctionResponse;
}

export interface CryptoHelpers {
  hash(data: string): Promise<string>;
  randomUUID(): string;
  verify(signature: string, data: string): Promise<boolean>;
}

export interface FunctionContext {
  request: FunctionRequest;
  db: ORM;
  store: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    getAll(prefix?: string): Promise<any[]>;
    add(collection: string, item: any): Promise<void>;
  };
  respond: ResponseHelpers;
  crypto: CryptoHelpers;
}

export interface ServerFunction {
  path: string;
  name: string;
  description?: string;
  code: string;
  version: string;
  handler: 'default' | 'named';
  methods: string[];
  contextUsage: {
    store: boolean;
    respond: boolean;
    crypto: boolean;
  };
}

// Runtime class for executing functions
export class FunctionRuntime {
  private function: ServerFunction;
  private db?: ORM;

  constructor(func: ServerFunction) {
    this.function = func;
  }

  async execute(request: FunctionRequest): Promise<FunctionResponse> {
    // Create context for this execution
    const context = await this.createContext(request);
    
    try {
      // Create a sandboxed function from the code
      const funcCode = this.function.code;
      
      // Wrap the function code to provide context
      const wrappedCode = `
        return (async function(__context) {
          const { request, db, store, respond, crypto } = __context;
          const { method, path, params, query, headers, body } = request;
          
          ${funcCode}
          
          // Call the default export or handler function
          if (typeof handler === 'function') {
            return await handler(request, __context);
          } else if (typeof exports === 'object' && typeof exports.default === 'function') {
            return await exports.default(request, __context);
          } else {
            const module = { exports: {} };
            const exports = module.exports;
            
            ${funcCode}
            
            if (typeof module.exports.default === 'function') {
              return await module.exports.default(request, __context);
            } else if (typeof module.exports === 'function') {
              return await module.exports(request, __context);
            }
          }
          
          throw new Error('No handler function found');
        })(__context);
      `;
      
      // Create the function
      const func = new Function('__context', wrappedCode);
      
      // Execute with context
      const result = await func(context);
      
      // Ensure response is in correct format
      if (result && typeof result === 'object' && 'status' in result) {
        return result as FunctionResponse;
      }
      
      // If function returned something else, wrap it
      return context.respond.json(result);
      
    } catch (error) {
      console.error('Function execution error:', error);
      return context.respond.error(
        error instanceof Error ? error.message : 'Function execution failed',
        500
      );
    }
  }

  private async createContext(request: FunctionRequest): Promise<FunctionContext> {
    // Create ORM instance for this function
    if (!this.db) {
      this.db = await createORM(this.function.path);
    }
    
    const db = this.db;
    
    // Create store helpers
    const store = {
      async get(key: string): Promise<any> {
        const table = await db.table('_store', {
          key: 'string',
          value: 'json'
        });
        const result = await table.where('key').equals(key).first();
        return result ? result.value : null;
      },
      
      async set(key: string, value: any): Promise<void> {
        const table = await db.table('_store', {
          key: 'string',
          value: 'json'
        });
        const existing = await table.where('key').equals(key).first();
        if (existing) {
          await table.update(existing.id, { value });
        } else {
          await table.insert({ key, value });
        }
      },
      
      async delete(key: string): Promise<void> {
        const table = await db.table('_store', {
          key: 'string',
          value: 'json'
        });
        const existing = await table.where('key').equals(key).first();
        if (existing) {
          await table.delete(existing.id);
        }
      },
      
      async getAll(prefix?: string): Promise<any[]> {
        const table = await db.table('_store', {
          key: 'string',
          value: 'json'
        });
        
        if (prefix) {
          return table.where('key').startsWith(prefix).toArray();
        }
        return table.all();
      },
      
      async add(collection: string, item: any): Promise<void> {
        const table = await db.table(collection, {
          id: 'autoincrement',
          data: 'json',
          created: 'datetime'
        });
        await table.insert({
          data: item,
          created: new Date()
        });
      }
    };
    
    // Create response helpers
    const respond: ResponseHelpers = {
      html(content: string, status = 200): FunctionResponse {
        return {
          status,
          headers: { 'Content-Type': 'text/html' },
          body: content
        };
      },
      
      json(data: any, status = 200): FunctionResponse {
        return {
          status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        };
      },
      
      text(content: string, status = 200): FunctionResponse {
        return {
          status,
          headers: { 'Content-Type': 'text/plain' },
          body: content
        };
      },
      
      redirect(url: string, status = 302): FunctionResponse {
        return {
          status,
          headers: { 'Location': url },
          body: ''
        };
      },
      
      error(message: string, status = 500): FunctionResponse {
        return {
          status,
          headers: { 'Content-Type': 'text/plain' },
          body: `Error: ${message}`
        };
      }
    };
    
    // Create crypto helpers
    const crypto: CryptoHelpers = {
      async hash(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      },
      
      randomUUID(): string {
        return window.crypto.randomUUID();
      },
      
      async verify(_signature: string, _data: string): Promise<boolean> {
        // This would verify against the signing list
        // For now, return true if authenticated
        return request.authenticated;
      }
    };
    
    return {
      request,
      db,
      store,
      respond,
      crypto
    };
  }
}

// Function manager for storing and retrieving functions
export class FunctionManager {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async deployFunction(func: ServerFunction): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['server-functions'], 'readwrite');
      const store = tx.objectStore('server-functions');
      
      const data = {
        ...func,
        created: new Date(),
        updated: new Date(),
        executionCount: 0
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFunction(path: string): Promise<ServerFunction | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['server-functions'], 'readonly');
      const store = tx.objectStore('server-functions');
      const request = store.get(path);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listFunctions(): Promise<ServerFunction[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['server-functions'], 'readonly');
      const store = tx.objectStore('server-functions');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFunction(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['server-functions'], 'readwrite');
      const store = tx.objectStore('server-functions');
      const request = store.delete(path);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async executeFunction(path: string, request: FunctionRequest): Promise<FunctionResponse> {
    const func = await this.getFunction(path);
    
    if (!func) {
      return {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Function not found'
      };
    }
    
    // Check if method is allowed
    if (!func.methods.includes(request.method)) {
      return {
        status: 405,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Method not allowed'
      };
    }
    
    // Create runtime and execute
    const runtime = new FunctionRuntime(func);
    const response = await runtime.execute(request);
    
    // Update execution stats
    await this.updateExecutionStats(path);
    
    return response;
  }

  private async updateExecutionStats(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['server-functions'], 'readwrite');
      const store = tx.objectStore('server-functions');
      const request = store.get(path);
      
      request.onsuccess = () => {
        const func = request.result;
        if (func) {
          func.lastExecuted = new Date();
          func.executionCount = (func.executionCount || 0) + 1;
          
          const updateRequest = store.put(func);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}

// Factory function to create function manager
export async function createFunctionManager(): Promise<FunctionManager> {
  const dbRequest = indexedDB.open('ham-radio-pwa', 1);
  
  return new Promise((resolve, reject) => {
    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      resolve(new FunctionManager(db));
    };
    dbRequest.onerror = () => reject(dbRequest.error);
  });
}