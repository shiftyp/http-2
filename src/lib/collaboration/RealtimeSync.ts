/**
 * Realtime Sync Manager
 *
 * Manages real-time collaboration for the Visual Page Builder using
 * operational transforms and WebRTC for low-latency synchronization.
 */

import { PageComponent } from '../../pages/PageBuilder';
import { CollaborationUser, CollaborationState } from '../../components/PageBuilder/CollaborationPanel';

export enum OperationType {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  MOVE = 'move',
  CURSOR = 'cursor'
}

export interface Operation {
  id: string;
  type: OperationType;
  componentId: string;
  userId: string;
  timestamp: number;
  data: any;
  position?: number;
}

export interface TransformResult {
  transformed: Operation;
  discard: boolean;
}

export class RealtimeSync {
  private sessionId: string;
  private currentUser: CollaborationUser;
  private users = new Map<string, CollaborationUser>();
  private components = new Map<string, PageComponent>();
  private operationHistory: Operation[] = [];
  private pendingOperations: Operation[] = [];
  private isConnected = false;
  private eventListeners = new Map<string, Function[]>();

  // WebRTC connections for real-time sync
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();

  constructor(sessionId: string, currentUser: CollaborationUser) {
    this.sessionId = sessionId;
    this.currentUser = currentUser;
    this.users.set(currentUser.id, currentUser);

    this.setupWebRTCConfiguration();
  }

  /**
   * Initialize collaboration session
   */
  async initialize(initialComponents: PageComponent[]): Promise<void> {
    // Store initial components
    initialComponents.forEach(component => {
      this.components.set(component.id, { ...component });
    });

    // Connect to signaling server
    await this.connectToSignalingServer();

    this.isConnected = true;
    this.emit('connected', { sessionId: this.sessionId, user: this.currentUser });
  }

  /**
   * Add a new component
   */
  async addComponent(component: PageComponent): Promise<void> {
    const operation: Operation = {
      id: crypto.randomUUID(),
      type: OperationType.INSERT,
      componentId: component.id,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: component,
      position: this.getInsertPosition(component)
    };

    await this.applyOperation(operation);
    await this.broadcastOperation(operation);
  }

  /**
   * Update an existing component
   */
  async updateComponent(componentId: string, updates: Partial<PageComponent>): Promise<void> {
    const existingComponent = this.components.get(componentId);
    if (!existingComponent) {
      throw new Error(`Component ${componentId} not found`);
    }

    const operation: Operation = {
      id: crypto.randomUUID(),
      type: OperationType.UPDATE,
      componentId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: {
        before: { ...existingComponent },
        after: { ...existingComponent, ...updates }
      }
    };

    await this.applyOperation(operation);
    await this.broadcastOperation(operation);
  }

  /**
   * Delete a component
   */
  async deleteComponent(componentId: string): Promise<void> {
    const existingComponent = this.components.get(componentId);
    if (!existingComponent) {
      throw new Error(`Component ${componentId} not found`);
    }

    const operation: Operation = {
      id: crypto.randomUUID(),
      type: OperationType.DELETE,
      componentId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: existingComponent
    };

    await this.applyOperation(operation);
    await this.broadcastOperation(operation);
  }

  /**
   * Move a component to a new position
   */
  async moveComponent(componentId: string, newGridArea: any): Promise<void> {
    const existingComponent = this.components.get(componentId);
    if (!existingComponent) {
      throw new Error(`Component ${componentId} not found`);
    }

    const operation: Operation = {
      id: crypto.randomUUID(),
      type: OperationType.MOVE,
      componentId,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: {
        from: existingComponent.gridArea,
        to: newGridArea
      }
    };

    await this.applyOperation(operation);
    await this.broadcastOperation(operation);
  }

  /**
   * Update cursor position
   */
  async updateCursor(x: number, y: number, componentId?: string): Promise<void> {
    const operation: Operation = {
      id: crypto.randomUUID(),
      type: OperationType.CURSOR,
      componentId: componentId || '',
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data: { x, y, componentId }
    };

    // Don't store cursor operations in history
    await this.broadcastOperation(operation);
  }

  /**
   * Handle incoming operation from another user
   */
  async handleRemoteOperation(operation: Operation): Promise<void> {
    // Transform operation against pending operations
    let transformedOp = operation;

    for (const pendingOp of this.pendingOperations) {
      const result = this.transformOperations(transformedOp, pendingOp);
      if (result.discard) return;
      transformedOp = result.transformed;
    }

    // Apply the transformed operation
    await this.applyOperation(transformedOp, false);

    // Update operation history
    this.operationHistory.push(transformedOp);
    this.emit('operation-applied', transformedOp);
  }

  /**
   * Get current collaboration state
   */
  getCollaborationState(): CollaborationState {
    const conflicts = this.detectConflicts();

    return {
      sessionId: this.sessionId,
      users: Array.from(this.users.values()),
      isConnected: this.isConnected,
      conflicts
    };
  }

  /**
   * Get current components
   */
  getComponents(): PageComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Add user to session
   */
  addUser(user: CollaborationUser): void {
    this.users.set(user.id, user);
    this.emit('user-joined', user);

    // Establish WebRTC connection if not exists
    if (!this.peerConnections.has(user.id)) {
      this.createPeerConnection(user.id);
    }
  }

  /**
   * Remove user from session
   */
  removeUser(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      this.cleanupPeerConnection(userId);
      this.emit('user-left', user);
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Apply an operation to the local state
   */
  private async applyOperation(operation: Operation, isLocal = true): Promise<void> {
    switch (operation.type) {
      case OperationType.INSERT:
        this.components.set(operation.componentId, operation.data);
        break;

      case OperationType.UPDATE:
        const existing = this.components.get(operation.componentId);
        if (existing) {
          this.components.set(operation.componentId, {
            ...existing,
            ...operation.data.after
          });
        }
        break;

      case OperationType.DELETE:
        this.components.delete(operation.componentId);
        break;

      case OperationType.MOVE:
        const component = this.components.get(operation.componentId);
        if (component) {
          component.gridArea = operation.data.to;
          this.components.set(operation.componentId, component);
        }
        break;

      case OperationType.CURSOR:
        const user = this.users.get(operation.userId);
        if (user) {
          user.cursor = operation.data;
          this.users.set(operation.userId, user);
        }
        break;
    }

    if (isLocal) {
      this.operationHistory.push(operation);
      this.pendingOperations.push(operation);
    }

    this.emit('state-changed', {
      operation,
      components: this.getComponents(),
      users: Array.from(this.users.values())
    });
  }

  /**
   * Broadcast operation to all connected users
   */
  private async broadcastOperation(operation: Operation): Promise<void> {
    const message = JSON.stringify({
      type: 'operation',
      operation
    });

    // Send via WebRTC data channels
    for (const [userId, channel] of this.dataChannels) {
      if (channel.readyState === 'open' && userId !== this.currentUser.id) {
        try {
          channel.send(message);
        } catch (error) {
          console.warn(`Failed to send to ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Transform two operations for conflict resolution
   */
  private transformOperations(op1: Operation, op2: Operation): TransformResult {
    // Simplified operational transform logic
    // In a full implementation, this would be much more sophisticated

    if (op1.componentId !== op2.componentId) {
      return { transformed: op1, discard: false };
    }

    // Same component operations need transformation
    if (op1.type === OperationType.UPDATE && op2.type === OperationType.UPDATE) {
      // Merge updates based on timestamp
      if (op1.timestamp > op2.timestamp) {
        return { transformed: op1, discard: false };
      } else {
        return { transformed: op1, discard: true };
      }
    }

    if (op1.type === OperationType.DELETE || op2.type === OperationType.DELETE) {
      // If either operation is delete, the other becomes invalid
      return { transformed: op1, discard: op1.type !== OperationType.DELETE };
    }

    return { transformed: op1, discard: false };
  }

  /**
   * Detect editing conflicts
   */
  private detectConflicts(): Array<{ componentId: string; users: string[]; timestamp: Date }> {
    const conflicts: Array<{ componentId: string; users: string[]; timestamp: Date }> = [];
    const componentUsers = new Map<string, Set<string>>();

    // Check recent operations for conflicts
    const recentOps = this.operationHistory.filter(
      op => Date.now() - op.timestamp < 5000 // Last 5 seconds
    );

    for (const op of recentOps) {
      if (op.type === OperationType.CURSOR) continue;

      if (!componentUsers.has(op.componentId)) {
        componentUsers.set(op.componentId, new Set());
      }
      componentUsers.get(op.componentId)!.add(op.userId);
    }

    // Find components with multiple editors
    for (const [componentId, users] of componentUsers) {
      if (users.size > 1) {
        conflicts.push({
          componentId,
          users: Array.from(users),
          timestamp: new Date()
        });
      }
    }

    return conflicts;
  }

  /**
   * Setup WebRTC configuration
   */
  private setupWebRTCConfiguration(): void {
    // WebRTC configuration for peer-to-peer connections
    // In production, would use TURN servers for NAT traversal
  }

  /**
   * Connect to signaling server
   */
  private async connectToSignalingServer(): Promise<void> {
    // Connect to WebSocket signaling server for session coordination
    // This would handle initial handshaking and peer discovery
  }

  /**
   * Create peer connection for a user
   */
  private async createPeerConnection(userId: string): Promise<void> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Create data channel for real-time communication
    const dataChannel = peerConnection.createDataChannel('collaboration', {
      ordered: true
    });

    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${userId}`);
    };

    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'operation') {
        this.handleRemoteOperation(message.operation);
      }
    };

    this.peerConnections.set(userId, peerConnection);
    this.dataChannels.set(userId, dataChannel);
  }

  /**
   * Clean up peer connection
   */
  private cleanupPeerConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
    }

    this.dataChannels.delete(userId);
  }

  /**
   * Get insert position for new component
   */
  private getInsertPosition(component: PageComponent): number {
    return this.components.size;
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in collaboration event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Dispose of the sync manager
   */
  dispose(): void {
    // Clean up all peer connections
    for (const userId of this.peerConnections.keys()) {
      this.cleanupPeerConnection(userId);
    }

    this.eventListeners.clear();
    this.isConnected = false;
  }
}

export default RealtimeSync;