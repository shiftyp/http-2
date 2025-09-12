// Server Apps / FaaS execution environment for HTTP-over-Radio
// Executes JavaScript functions received via radio in a sandboxed environment

export interface ServerApp {
  id: string;
  path: string;
  handler: string; // JavaScript function code
  metadata: {
    author: string;
    version: string;
    description: string;
    permissions: string[];
  };
}

export interface AppContext {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    params: Record<string, string>;
    query: Record<string, string>;
    body?: any;
  };
  env: {
    callsign: string;
    gridSquare: string;
    timestamp: number;
  };
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}

export class ServerAppExecutor {
  private apps: Map<string, ServerApp> = new Map();
  private sandbox: Worker | null = null;

  constructor() {
    this.initSandbox();
  }

  private initSandbox() {
    // Create Web Worker for sandboxed execution
    const workerCode = `
      // Sandboxed execution environment
      const apps = new Map();
      
      // Limited global scope
      const safeGlobals = {
        console: {
          log: (...args) => postMessage({ type: 'log', data: args }),
          error: (...args) => postMessage({ type: 'error', data: args })
        },
        JSON,
        Math,
        Date,
        String,
        Number,
        Boolean,
        Array,
        Object,
        Promise,
        setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 5000)),
        clearTimeout
      };
      
      self.onmessage = async (event) => {
        const { type, id, code, context } = event.data;
        
        try {
          if (type === 'register') {
            // Create sandboxed function
            const fn = new Function('context', 'globals', \`
              with (globals) {
                return (async () => {
                  \${code}
                })();
              }
            \`);
            
            apps.set(id, fn);
            postMessage({ type: 'registered', id });
            
          } else if (type === 'execute') {
            const fn = apps.get(id);
            if (!fn) {
              throw new Error('App not found: ' + id);
            }
            
            // Execute with timeout
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Execution timeout')), 5000)
            );
            
            const result = await Promise.race([
              fn(context, safeGlobals),
              timeoutPromise
            ]);
            
            postMessage({ type: 'result', id, result });
          }
        } catch (error) {
          postMessage({ 
            type: 'error', 
            id, 
            error: error.message || 'Execution failed' 
          });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.sandbox = new Worker(workerUrl);

    this.sandbox.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === 'log') {
        console.log('[ServerApp]', ...data);
      } else if (type === 'error') {
        console.error('[ServerApp]', ...data);
      }
    };
  }

  async registerApp(app: ServerApp): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    // Validate app permissions
    const allowedPermissions = ['storage', 'network', 'radio'];
    const invalidPerms = app.metadata.permissions.filter(
      p => !allowedPermissions.includes(p)
    );
    
    if (invalidPerms.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
    }

    // Register in sandbox
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Registration timeout'));
      }, 3000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'registered' && event.data.id === app.id) {
          clearTimeout(timeout);
          this.sandbox?.removeEventListener('message', handler);
          this.apps.set(app.id, app);
          resolve();
        } else if (event.data.type === 'error' && event.data.id === app.id) {
          clearTimeout(timeout);
          this.sandbox?.removeEventListener('message', handler);
          reject(new Error(event.data.error));
        }
      };

      this.sandbox.addEventListener('message', handler);
      this.sandbox.postMessage({
        type: 'register',
        id: app.id,
        code: app.handler
      });
    });
  }

  async executeApp(
    appId: string, 
    context: AppContext
  ): Promise<any> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }

    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    // Check permissions
    if (app.metadata.permissions.includes('storage')) {
      // Provide storage access
      context.storage = {
        get: async (key: string) => {
          const stored = localStorage.getItem(`app_${appId}_${key}`);
          return stored ? JSON.parse(stored) : null;
        },
        set: async (key: string, value: any) => {
          localStorage.setItem(`app_${appId}_${key}`, JSON.stringify(value));
        },
        delete: async (key: string) => {
          localStorage.removeItem(`app_${appId}_${key}`);
        }
      };
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, 5000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'result' && event.data.id === appId) {
          clearTimeout(timeout);
          this.sandbox?.removeEventListener('message', handler);
          resolve(event.data.result);
        } else if (event.data.type === 'error' && event.data.id === appId) {
          clearTimeout(timeout);
          this.sandbox?.removeEventListener('message', handler);
          reject(new Error(event.data.error));
        }
      };

      this.sandbox.addEventListener('message', handler);
      this.sandbox.postMessage({
        type: 'execute',
        id: appId,
        context
      });
    });
  }

  async unregisterApp(appId: string): Promise<void> {
    this.apps.delete(appId);
    // Clear app storage
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith(`app_${appId}_`)
    );
    keys.forEach(key => localStorage.removeItem(key));
  }

  getRegisteredApps(): ServerApp[] {
    return Array.from(this.apps.values());
  }

  dispose(): void {
    if (this.sandbox) {
      this.sandbox.terminate();
      this.sandbox = null;
    }
    this.apps.clear();
  }
}

// Example server apps
export const EXAMPLE_APPS: ServerApp[] = [
  {
    id: 'echo',
    path: '/api/echo',
    handler: `
      const { request } = context;
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          message: 'Echo response',
          received: request.body,
          timestamp: new Date().toISOString()
        }
      };
    `,
    metadata: {
      author: 'KJ4ABC',
      version: '1.0.0',
      description: 'Simple echo service',
      permissions: []
    }
  },
  {
    id: 'weather',
    path: '/api/weather',
    handler: `
      const { request, env, storage } = context;
      const grid = request.query.grid || env.gridSquare;
      
      // Check cache
      const cached = await storage.get('weather_' + grid);
      if (cached && cached.timestamp > Date.now() - 3600000) {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: cached.data
        };
      }
      
      // Generate mock weather data
      const weather = {
        grid,
        temp: Math.round(Math.random() * 30 + 50),
        humidity: Math.round(Math.random() * 50 + 30),
        pressure: Math.round(Math.random() * 5 + 29.5 * 100) / 100,
        conditions: ['Clear', 'Cloudy', 'Rain', 'Snow'][Math.floor(Math.random() * 4)]
      };
      
      // Cache result
      await storage.set('weather_' + grid, {
        timestamp: Date.now(),
        data: weather
      });
      
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: weather
      };
    `,
    metadata: {
      author: 'W5XYZ',
      version: '1.0.0',
      description: 'Grid square weather service',
      permissions: ['storage']
    }
  },
  {
    id: 'qso-logger',
    path: '/api/qso',
    handler: `
      const { request, env, storage } = context;
      
      if (request.method === 'GET') {
        // Get QSO log
        const log = await storage.get('qso_log') || [];
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: log
        };
      } else if (request.method === 'POST') {
        // Log new QSO
        const qso = {
          ...request.body,
          operator: env.callsign,
          grid: env.gridSquare,
          timestamp: Date.now()
        };
        
        const log = await storage.get('qso_log') || [];
        log.push(qso);
        await storage.set('qso_log', log);
        
        return {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: { success: true, qso }
        };
      }
      
      return {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Method not allowed' }
      };
    `,
    metadata: {
      author: 'N0CALL',
      version: '1.0.0',
      description: 'QSO logging service',
      permissions: ['storage']
    }
  }
];

// Global executor instance
export const serverAppExecutor = new ServerAppExecutor();