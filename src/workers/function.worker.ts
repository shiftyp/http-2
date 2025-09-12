/**
 * Web Worker for executing server functions in isolation
 */

import { FunctionRequest, FunctionResponse } from '../lib/function-runtime';

interface WorkerMessage {
  type: 'EXECUTE' | 'LOAD' | 'VERIFY';
  id: string;
  functionCode?: string;
  request?: FunctionRequest;
  signature?: string;
}

interface WorkerResponse {
  type: 'RESULT' | 'ERROR' | 'LOADED' | 'VERIFIED';
  id: string;
  result?: FunctionResponse;
  error?: string;
  verified?: boolean;
}

// Store loaded functions
const loadedFunctions = new Map<string, Function>();

// Simple ORM mock for worker context
class WorkerORM {
  private data = new Map<string, any[]>();
  
  async table(name: string) {
    if (!this.data.has(name)) {
      this.data.set(name, []);
    }
    
    const tableData = this.data.get(name)!;
    
    return {
      insert: async (record: any) => {
        const id = tableData.length + 1;
        tableData.push({ id, ...record });
        return id;
      },
      
      get: async (id: number) => {
        return tableData.find(r => r.id === id) || null;
      },
      
      all: async () => {
        return [...tableData];
      },
      
      where: (field: string) => {
        return {
          equals: (value: any) => ({
            toArray: async () => tableData.filter(r => r[field] === value),
            first: async () => tableData.find(r => r[field] === value) || null,
            count: async () => tableData.filter(r => r[field] === value).length
          })
        };
      }
    };
  }
}

// Create context for function execution
function createContext(request: FunctionRequest) {
  const db = new WorkerORM();
  
  const store = {
    _data: new Map<string, any>(),
    
    async get(key: string) {
      return this._data.get(key) || null;
    },
    
    async set(key: string, value: any) {
      this._data.set(key, value);
    },
    
    async delete(key: string) {
      this._data.delete(key);
    },
    
    async getAll(prefix?: string) {
      const results: any[] = [];
      for (const [key, value] of this._data.entries()) {
        if (!prefix || key.startsWith(prefix)) {
          results.push({ key, value });
        }
      }
      return results;
    },
    
    async add(collection: string, item: any) {
      const table = await db.table(collection);
      await table.insert(item);
    }
  };
  
  const respond = {
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
  
  const crypto = {
    async hash(data: string): Promise<string> {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await self.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    randomUUID(): string {
      return self.crypto.randomUUID();
    },
    
    async verify(_signature: string, _data: string): Promise<boolean> {
      // Simplified verification
      return request.authenticated || false;
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

// Execute function with timeout
async function executeFunction(
  functionCode: string,
  request: FunctionRequest,
  timeoutMs = 5000
): Promise<FunctionResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Function execution timeout'));
    }, timeoutMs);
    
    try {
      // Create isolated context
      const context = createContext(request);
      
      // Create function from code
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const func = new AsyncFunction('request', 'context', functionCode);
      
      // Execute function
      func(request, context)
        .then((result: any) => {
          clearTimeout(timeout);
          
          // Ensure result is a proper response
          if (result && typeof result === 'object' && 'status' in result) {
            resolve(result);
          } else {
            resolve(context.respond.json(result));
          }
        })
        .catch((error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
        
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, functionCode, request, signature } = event.data;
  
  try {
    switch (type) {
      case 'LOAD':
        if (functionCode) {
          // Pre-compile and cache the function
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const func = new AsyncFunction('request', 'context', functionCode);
          loadedFunctions.set(id, func);
          
          self.postMessage({
            type: 'LOADED',
            id,
          } as WorkerResponse);
        }
        break;
        
      case 'EXECUTE':
        if (functionCode && request) {
          const result = await executeFunction(functionCode, request);
          
          self.postMessage({
            type: 'RESULT',
            id,
            result
          } as WorkerResponse);
        }
        break;
        
      case 'VERIFY':
        if (signature && request) {
          // Verify request signature
          const verified = await verifySignature(signature, request);
          
          self.postMessage({
            type: 'VERIFIED',
            id,
            verified
          } as WorkerResponse);
        }
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  }
});

// Verify request signature
async function verifySignature(_signature: string, request: FunctionRequest): Promise<boolean> {
  try {
    // Create canonical request string (for future implementation)
    // const canonical = [
    //   request.method,
    //   request.path,
    //   request.headers['X-Radio-Timestamp'] || '',
    //   request.fromCallsign || '',
    //   JSON.stringify(request.body) || ''
    // ].join('\n');
    
    // For now, return true if request is marked as authenticated
    // In production, this would verify against the actual public key
    return request.authenticated || false;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Export for TypeScript
export {};