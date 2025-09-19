/**
 * Server Manager
 *
 * Manages distributed amateur radio servers including discovery, connection management,
 * load balancing, and failover for WebRTC application transfer.
 * Task T059 per distributed servers implementation plan.
 */

import { ServerInfo } from '../server-discovery/index.js';
import { serverDiscovery } from '../server-discovery/index.js';

export interface ServerManagerConfig {
  maxConnections?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ServerConnection {
  server: ServerInfo;
  websocket: WebSocket;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastPing: number;
  responseTime: number;
  connectionTime: number;
  errorCount: number;
  messageCount: number;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  totalMessages: number;
  uptime: number;
}

export interface LoadBalancingOptions {
  strategy: 'round-robin' | 'least-connections' | 'best-response-time' | 'random';
  healthThreshold?: number;
  maxResponseTime?: number;
}

/**
 * Manages connections to distributed amateur radio servers
 */
export class ServerManager extends EventTarget {
  private config: Required<ServerManagerConfig>;
  private connections = new Map<string, ServerConnection>();
  private healthCheckTimer: number | null = null;
  private roundRobinIndex = 0;
  private startTime = Date.now();

  constructor(config: ServerManagerConfig = {}) {
    super();
    this.config = {
      maxConnections: config.maxConnections || 10,
      connectionTimeout: config.connectionTimeout || 5000,
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 2000
    };

    this.startHealthCheck();
  }

  /**
   * Initialize server manager and discover servers
   */
  async initialize(): Promise<void> {
    try {
      // Discover available servers
      const servers = await serverDiscovery.discoverAll();

      if (servers.length === 0) {
        console.warn('No servers discovered during initialization');
        return;
      }

      // Connect to initial servers (up to maxConnections)
      const serversToConnect = servers.slice(0, this.config.maxConnections);

      await Promise.allSettled(
        serversToConnect.map(server => this.connect(server))
      );

      this.dispatchEvent(new CustomEvent('initialized', {
        detail: {
          discoveredServers: servers.length,
          connectedServers: this.getActiveConnections().length
        }
      }));

    } catch (error) {
      console.error('Server manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Connect to a specific server
   */
  async connect(server: ServerInfo): Promise<ServerConnection> {
    if (this.connections.has(server.id)) {
      const existing = this.connections.get(server.id)!;
      if (existing.status === 'connected') {
        return existing;
      }
    }

    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const connectionStart = Date.now();
    const connection: ServerConnection = {
      server,
      websocket: new WebSocket(server.signalingUrl),
      status: 'connecting',
      lastPing: 0,
      responseTime: 0,
      connectionTime: connectionStart,
      errorCount: 0,
      messageCount: 0
    };

    this.connections.set(server.id, connection);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.websocket.close();
        this.connections.delete(server.id);
        reject(new Error(`Connection timeout to ${server.endpoint}`));
      }, this.config.connectionTimeout);

      connection.websocket.onopen = () => {
        clearTimeout(timeout);
        connection.status = 'connected';
        connection.connectionTime = Date.now() - connectionStart;

        this.setupConnectionHandlers(connection);

        this.dispatchEvent(new CustomEvent('server-connected', {
          detail: { server, connection }
        }));

        resolve(connection);
      };

      connection.websocket.onerror = (error) => {
        clearTimeout(timeout);
        connection.status = 'error';
        connection.errorCount++;

        this.dispatchEvent(new CustomEvent('server-connection-error', {
          detail: { server, error }
        }));

        reject(error);
      };

      connection.websocket.onclose = () => {
        connection.status = 'disconnected';
        this.handleDisconnection(connection);
      };
    });
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    connection.websocket.close();
    this.connections.delete(serverId);

    this.dispatchEvent(new CustomEvent('server-disconnected', {
      detail: { server: connection.server }
    }));
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnections = Array.from(this.connections.keys()).map(
      serverId => this.disconnect(serverId)
    );

    await Promise.allSettled(disconnections);
  }

  /**
   * Send message to a specific server
   */
  async sendToServer(serverId: string, message: any): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverId} not connected`);
    }

    const messageData = JSON.stringify(message);
    connection.websocket.send(messageData);
    connection.messageCount++;
  }

  /**
   * Send message using load balancing
   */
  async sendMessage(message: any, options: LoadBalancingOptions = { strategy: 'round-robin' }): Promise<string> {
    const connection = this.selectConnection(options);
    if (!connection) {
      throw new Error('No available servers for message delivery');
    }

    await this.sendToServer(connection.server.id, message);
    return connection.server.id;
  }

  /**
   * Broadcast message to all connected servers
   */
  async broadcast(message: any): Promise<string[]> {
    const activeConnections = this.getActiveConnections();
    const sentTo: string[] = [];

    await Promise.allSettled(
      activeConnections.map(async connection => {
        try {
          await this.sendToServer(connection.server.id, message);
          sentTo.push(connection.server.id);
        } catch (error) {
          console.error(`Failed to send to ${connection.server.id}:`, error);
        }
      })
    );

    return sentTo;
  }

  /**
   * Get connection by server ID
   */
  getConnection(serverId: string): ServerConnection | null {
    return this.connections.get(serverId) || null;
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ServerConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.status === 'connected'
    );
  }

  /**
   * Get all connections
   */
  getAllConnections(): ServerConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Select optimal connection based on load balancing strategy
   */
  private selectConnection(options: LoadBalancingOptions): ServerConnection | null {
    const activeConnections = this.getActiveConnections();

    if (activeConnections.length === 0) {
      return null;
    }

    // Filter by health threshold
    const healthyConnections = activeConnections.filter(conn => {
      if (options.healthThreshold !== undefined) {
        const quality = conn.server.connectionQuality || 0;
        return quality >= options.healthThreshold;
      }
      return true;
    });

    // Filter by response time threshold
    const goodConnections = healthyConnections.filter(conn => {
      if (options.maxResponseTime !== undefined) {
        return conn.responseTime <= options.maxResponseTime;
      }
      return true;
    });

    const candidateConnections = goodConnections.length > 0 ? goodConnections : healthyConnections;

    if (candidateConnections.length === 0) {
      return activeConnections[0]; // Fallback to any active connection
    }

    switch (options.strategy) {
      case 'round-robin':
        const connection = candidateConnections[this.roundRobinIndex % candidateConnections.length];
        this.roundRobinIndex++;
        return connection;

      case 'least-connections':
        return candidateConnections.reduce((best, current) =>
          current.messageCount < best.messageCount ? current : best
        );

      case 'best-response-time':
        return candidateConnections.reduce((best, current) =>
          current.responseTime < best.responseTime ? current : best
        );

      case 'random':
        const randomIndex = Math.floor(Math.random() * candidateConnections.length);
        return candidateConnections[randomIndex];

      default:
        return candidateConnections[0];
    }
  }

  /**
   * Setup event handlers for a connection
   */
  private setupConnectionHandlers(connection: ServerConnection): void {
    connection.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(connection, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    connection.websocket.onerror = (error) => {
      connection.errorCount++;
      connection.status = 'error';

      this.dispatchEvent(new CustomEvent('connection-error', {
        detail: { connection, error }
      }));
    };

    connection.websocket.onclose = () => {
      this.handleDisconnection(connection);
    };
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(connection: ServerConnection, message: any): void {
    // Handle ping/pong for connection health
    if (message.type === 'ping') {
      const pongMessage = { type: 'pong', timestamp: Date.now() };
      connection.websocket.send(JSON.stringify(pongMessage));
      return;
    }

    if (message.type === 'pong') {
      connection.responseTime = Date.now() - connection.lastPing;
      return;
    }

    // Dispatch message event for application handling
    this.dispatchEvent(new CustomEvent('message-received', {
      detail: { connection, message }
    }));
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(connection: ServerConnection): void {
    connection.status = 'disconnected';

    this.dispatchEvent(new CustomEvent('server-disconnected', {
      detail: { server: connection.server }
    }));

    // Attempt reconnection after delay
    setTimeout(() => {
      this.attemptReconnection(connection);
    }, this.config.retryDelay);
  }

  /**
   * Attempt to reconnect to a disconnected server
   */
  private async attemptReconnection(connection: ServerConnection): Promise<void> {
    if (connection.errorCount >= this.config.retryAttempts) {
      console.warn(`Max retry attempts reached for ${connection.server.endpoint}`);
      this.connections.delete(connection.server.id);
      return;
    }

    try {
      await this.connect(connection.server);
    } catch (error) {
      console.error(`Reconnection failed for ${connection.server.endpoint}:`, error);
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval) as unknown as number;
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const activeConnections = this.getActiveConnections();

    activeConnections.forEach(connection => {
      if (connection.websocket.readyState === WebSocket.OPEN) {
        const pingMessage = { type: 'ping', timestamp: Date.now() };
        connection.lastPing = Date.now();
        connection.websocket.send(JSON.stringify(pingMessage));
      }
    });

    // Clean up stale connections
    this.cleanupStaleConnections();
  }

  /**
   * Clean up connections that haven't responded to pings
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = this.config.healthCheckInterval * 2;

    Array.from(this.connections.values()).forEach(connection => {
      if (connection.status === 'connected' &&
          connection.lastPing > 0 &&
          now - connection.lastPing > staleThreshold &&
          connection.responseTime === 0) {
        console.warn(`Cleaning up stale connection to ${connection.server.endpoint}`);
        connection.websocket.close();
      }
    });
  }

  /**
   * Get connection statistics
   */
  getStatistics(): ConnectionStats {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(conn => conn.status === 'connected');
    const failedConnections = connections.filter(conn => conn.status === 'error');

    const totalResponseTimes = activeConnections
      .filter(conn => conn.responseTime > 0)
      .reduce((sum, conn) => sum + conn.responseTime, 0);

    const averageResponseTime = activeConnections.length > 0
      ? totalResponseTimes / activeConnections.length
      : 0;

    const totalMessages = connections.reduce((sum, conn) => sum + conn.messageCount, 0);

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      failedConnections: failedConnections.length,
      averageResponseTime,
      totalMessages,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Discover and connect to new servers
   */
  async discoverAndConnect(): Promise<void> {
    const servers = await serverDiscovery.discoverAll();
    const connectedEndpoints = new Set(
      Array.from(this.connections.values()).map(conn => conn.server.endpoint)
    );

    const newServers = servers.filter(server =>
      !connectedEndpoints.has(server.endpoint) &&
      this.connections.size < this.config.maxConnections
    );

    if (newServers.length > 0) {
      await Promise.allSettled(
        newServers.map(server => this.connect(server))
      );

      this.dispatchEvent(new CustomEvent('servers-discovered', {
        detail: { newServers: newServers.length }
      }));
    }
  }

  /**
   * Update server manager configuration
   */
  updateConfig(config: Partial<ServerManagerConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health check with new interval if changed
    if (config.healthCheckInterval && this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.startHealthCheck();
    }
  }

  /**
   * Get best server for a specific task
   */
  getBestServer(criteria: {
    minQuality?: number;
    maxResponseTime?: number;
    requiredCapabilities?: string[];
  } = {}): ServerConnection | null {
    const activeConnections = this.getActiveConnections();

    const candidates = activeConnections.filter(conn => {
      // Check quality threshold
      if (criteria.minQuality !== undefined) {
        const quality = conn.server.connectionQuality || 0;
        if (quality < criteria.minQuality) {
          return false;
        }
      }

      // Check response time threshold
      if (criteria.maxResponseTime !== undefined) {
        if (conn.responseTime > criteria.maxResponseTime) {
          return false;
        }
      }

      // Check required capabilities
      if (criteria.requiredCapabilities) {
        const hasCapabilities = criteria.requiredCapabilities.every(cap =>
          conn.server.capabilities.includes(cap)
        );
        if (!hasCapabilities) {
          return false;
        }
      }

      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Return the one with best combination of quality and response time
    return candidates.reduce((best, current) => {
      const currentScore = (current.server.connectionQuality || 0) / (current.responseTime + 1);
      const bestScore = (best.server.connectionQuality || 0) / (best.responseTime + 1);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.disconnectAll();
  }
}

export default ServerManager;