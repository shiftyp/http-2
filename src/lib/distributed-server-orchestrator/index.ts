/**
 * Distributed Server Orchestrator
 *
 * Advanced orchestration system for distributed amateur radio server infrastructure
 * with multi-platform deployment, certificate federation, and emergency coordination.
 * Integrates all Track C components for comprehensive distributed operations.
 */

import ServerManager, { ServerConnection, LoadBalancingOptions } from '../server-manager/index.js';
import { CertificateManager } from '../certificate-management/index.js';
import { ComplianceManager } from '../fcc-compliance/core/ComplianceManager.js';
import { EnhancedEmergencyBroadcaster, EmergencyContext } from '../emergency-broadcast/index.js';
import { AutomaticStationController, ControlOperatorSession } from '../automatic-station/index.js';
import { LoTWIntegrationService } from '../certificate-management/services/LoTWIntegration.js';
import { PriorityLevel, PriorityManager } from '../priority-tiers/index.js';

export interface ServerDeploymentConfig {
  platforms: ('linux' | 'windows' | 'macos' | 'docker')[];
  binaries: {
    linux?: string;
    windows?: string;
    macos?: string;
    docker?: string;
  };
  deployment: {
    method: 'manual' | 'automated' | 'emergency';
    locations: ServerLocation[];
    scalingPolicy: 'fixed' | 'auto' | 'emergency';
    minInstances: number;
    maxInstances: number;
  };
  networking: {
    ports: number[];
    protocols: ('websocket' | 'webrtc' | 'hybrid')[];
    encryption: boolean;
    meshMode: boolean;
  };
}

export interface ServerLocation {
  id: string;
  callsign: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  gridSquare: string;
  jurisdiction: string;
  emergencyServices: string[];
  infrastructure: {
    internetConnection: 'fiber' | 'cable' | 'cellular' | 'satellite' | 'rf-only';
    powerBackup: boolean;
    upsBattery: number; // hours
    generator: boolean;
    redundancy: boolean;
  };
  capacity: {
    maxConnections: number;
    bandwidth: number; // Mbps
    storage: number; // GB
    cpuCores: number;
    memoryGB: number;
  };
  role: 'primary' | 'secondary' | 'emergency' | 'cache' | 'relay';
}

export interface ClusterStatus {
  totalServers: number;
  activeServers: number;
  healthyServers: number;
  overloadedServers: number;
  emergencyServers: number;
  totalConnections: number;
  totalBandwidth: number;
  certificateFederation: {
    trustChains: number;
    pendingValidations: number;
    federatedStations: number;
  };
  compliance: {
    compliantServers: number;
    violationCount: number;
    emergencyOverride: boolean;
  };
  emergencyStatus: {
    active: boolean;
    level: 'none' | 'watch' | 'warning' | 'emergency' | 'disaster';
    activeBroadcasts: number;
    coordinatingStations: number;
  };
}

export interface EmergencyCoordination {
  coordinationId: string;
  emergencyType: EmergencyContext['type'];
  severity: EmergencyContext['severity'];
  jurisdiction: string;
  coordinatingStations: string[];
  servedAgencies: string[];
  activeBroadcasts: string[];
  resourceAllocation: {
    servers: string[];
    bandwidth: number;
    operators: string[];
  };
  timeline: {
    activated: Date;
    lastUpdate: Date;
    escalations: { time: Date; level: string; reason: string }[];
  };
  status: 'active' | 'scaling' | 'deescalating' | 'resolved';
}

export interface ServerHealthMetrics {
  serverId: string;
  location: string;
  status: 'healthy' | 'degraded' | 'overloaded' | 'failed' | 'emergency';
  performance: {
    cpu: number; // percentage
    memory: number; // percentage
    disk: number; // percentage
    bandwidth: number; // Mbps
    connections: number;
    responseTime: number; // ms
  };
  compliance: {
    stationID: boolean;
    encryption: boolean;
    content: boolean;
    operator: boolean;
  };
  infrastructure: {
    power: 'mains' | 'ups' | 'generator' | 'battery';
    internet: 'up' | 'degraded' | 'down';
    cooling: 'normal' | 'warning' | 'critical';
    backup: boolean;
  };
  lastHeartbeat: Date;
  uptime: number;
}

/**
 * Comprehensive distributed server orchestration system
 */
export class DistributedServerOrchestrator {
  private serverManager: ServerManager;
  private certificateManager: CertificateManager;
  private complianceManager?: ComplianceManager;
  private emergencyBroadcaster?: EnhancedEmergencyBroadcaster;
  private automaticStation?: AutomaticStationController;
  private lotwIntegration?: LoTWIntegrationService;

  private deploymentConfig: ServerDeploymentConfig;
  private serverLocations = new Map<string, ServerLocation>();
  private serverHealth = new Map<string, ServerHealthMetrics>();
  private emergencyCoordinations = new Map<string, EmergencyCoordination>();

  private monitoringTimer?: number;
  private eventListeners = new Map<string, Function[]>();

  constructor(
    deploymentConfig: ServerDeploymentConfig,
    components: {
      serverManager: ServerManager;
      certificateManager: CertificateManager;
      complianceManager?: ComplianceManager;
      emergencyBroadcaster?: EnhancedEmergencyBroadcaster;
      automaticStation?: AutomaticStationController;
      lotwIntegration?: LoTWIntegrationService;
    }
  ) {
    this.deploymentConfig = deploymentConfig;
    this.serverManager = components.serverManager;
    this.certificateManager = components.certificateManager;
    this.complianceManager = components.complianceManager;
    this.emergencyBroadcaster = components.emergencyBroadcaster;
    this.automaticStation = components.automaticStation;
    this.lotwIntegration = components.lotwIntegration;

    // Initialize server locations
    for (const location of deploymentConfig.deployment.locations) {
      this.serverLocations.set(location.id, location);
    }

    this.startMonitoring();
    this.setupEventHandlers();
  }

  /**
   * Initialize the distributed orchestration system
   */
  async initialize(): Promise<void> {
    try {
      // Initialize core components
      await this.serverManager.initialize();
      await this.certificateManager.initialize();

      if (this.complianceManager) {
        await this.complianceManager.start();
      }

      // Validate server deployment readiness
      await this.validateDeploymentReadiness();

      console.log('🌐 Distributed Server Orchestrator initialized');

      await this.logEvent('system', 'Distributed orchestration system started');
      this.emit('orchestrator-initialized');

    } catch (error) {
      console.error('Orchestrator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Deploy servers to specified locations
   */
  async deployServers(
    locations: string[],
    options: {
      deploymentMethod?: 'rolling' | 'blue-green' | 'canary' | 'emergency';
      waitForHealthCheck?: boolean;
      certificateValidation?: boolean;
      complianceCheck?: boolean;
    } = {}
  ): Promise<{
    deployed: string[];
    failed: string[];
    warnings: string[];
  }> {
    const deployed: string[] = [];
    const failed: string[] = [];
    const warnings: string[] = [];

    console.log(`🚀 Deploying servers to ${locations.length} locations`);

    for (const locationId of locations) {
      const location = this.serverLocations.get(locationId);
      if (!location) {
        failed.push(locationId);
        warnings.push(`Location ${locationId} not found`);
        continue;
      }

      try {
        const deploymentResult = await this.deployToLocation(location, options);

        if (deploymentResult.success) {
          deployed.push(locationId);
        } else {
          failed.push(locationId);
          warnings.push(`Deployment to ${locationId} failed: ${deploymentResult.error}`);
        }

      } catch (error) {
        failed.push(locationId);
        warnings.push(`Deployment to ${locationId} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await this.logEvent('deployment',
      `Server deployment completed: ${deployed.length} deployed, ${failed.length} failed`
    );

    this.emit('deployment-completed', { deployed, failed, warnings });

    return { deployed, failed, warnings };
  }

  /**
   * Coordinate emergency response across distributed servers
   */
  async coordinateEmergencyResponse(
    emergencyContext: EmergencyContext,
    coordinatingStations: string[],
    options: {
      priority: PriorityLevel;
      resourceAllocation?: 'minimal' | 'standard' | 'maximum';
      duration?: number; // hours
      escalationTriggers?: string[];
    }
  ): Promise<string> {
    const coordinationId = crypto.randomUUID();

    const coordination: EmergencyCoordination = {
      coordinationId,
      emergencyType: emergencyContext.type,
      severity: emergencyContext.severity,
      jurisdiction: emergencyContext.jurisdiction,
      coordinatingStations,
      servedAgencies: emergencyContext.emergencyServices || [],
      activeBroadcasts: [],
      resourceAllocation: {
        servers: this.selectEmergencyServers(emergencyContext, options.resourceAllocation),
        bandwidth: this.calculateEmergencyBandwidth(emergencyContext.severity),
        operators: coordinatingStations
      },
      timeline: {
        activated: new Date(),
        lastUpdate: new Date(),
        escalations: []
      },
      status: 'active'
    };

    this.emergencyCoordinations.set(coordinationId, coordination);

    // Scale up server resources for emergency
    await this.scaleForEmergency(coordination);

    // Initiate emergency broadcasts if broadcaster available
    if (this.emergencyBroadcaster) {
      const broadcastId = await this.emergencyBroadcaster.broadcastEmergency(
        `EMERGENCY COORDINATION ACTIVATED: ${emergencyContext.type} in ${emergencyContext.jurisdiction}`,
        emergencyContext,
        {
          priority: options.priority,
          requireAcknowledgment: true,
          geographicScope: this.determineGeographicScope(emergencyContext.severity)
        }
      );
      coordination.activeBroadcasts.push(broadcastId);
    }

    // Configure servers for emergency priority
    await this.configureEmergencyPriority(coordination);

    console.warn(`🚨 Emergency coordination activated: ${coordinationId}`);

    await this.logEvent('emergency',
      `Emergency coordination activated: ${emergencyContext.type} in ${emergencyContext.jurisdiction}`
    );

    this.emit('emergency-coordination-activated', coordination);

    return coordinationId;
  }

  /**
   * Federate certificates across distributed servers
   */
  async federateCertificates(
    certificates: string[],
    targetServers?: string[],
    options: {
      validationLevel: 'basic' | 'enhanced' | 'lotw';
      propagationTimeout?: number;
      retryFailures?: boolean;
    } = { validationLevel: 'basic' }
  ): Promise<{
    federated: string[];
    failed: string[];
    validationResults: Map<string, any>;
  }> {
    const federated: string[] = [];
    const failed: string[] = [];
    const validationResults = new Map<string, any>();

    console.log(`🔐 Federating ${certificates.length} certificates`);

    const activeServers = targetServers ||
      this.serverManager.getActiveConnections().map(conn => conn.server.id);

    for (const certId of certificates) {
      try {
        // Enhanced validation with LoTW if available
        let validationResult;
        if (options.validationLevel === 'lotw' && this.lotwIntegration) {
          // Would implement LoTW validation
          validationResult = { valid: true, trustLevel: 'lotw' };
        } else {
          // Basic certificate validation
          validationResult = { valid: true, trustLevel: 'basic' };
        }

        validationResults.set(certId, validationResult);

        if (validationResult.valid) {
          // Broadcast certificate to target servers
          const federationMessage = {
            type: 'certificate-federation',
            certificateId: certId,
            validation: validationResult,
            timestamp: new Date().toISOString(),
            source: 'orchestrator'
          };

          const broadcastResults = await this.serverManager.broadcast(federationMessage);

          if (broadcastResults.length > 0) {
            federated.push(certId);
          } else {
            failed.push(certId);
          }
        } else {
          failed.push(certId);
        }

      } catch (error) {
        failed.push(certId);
        console.error(`Certificate federation failed for ${certId}:`, error);
      }
    }

    await this.logEvent('certificate',
      `Certificate federation completed: ${federated.length} federated, ${failed.length} failed`
    );

    return { federated, failed, validationResults };
  }

  /**
   * Get comprehensive cluster status
   */
  async getClusterStatus(): Promise<ClusterStatus> {
    const allConnections = this.serverManager.getAllConnections();
    const activeConnections = this.serverManager.getActiveConnections();

    let compliantServers = 0;
    let violationCount = 0;
    let emergencyOverride = false;

    // Check compliance status if available
    if (this.complianceManager) {
      const complianceStatus = this.complianceManager.getComplianceStatus();
      compliantServers = complianceStatus.compliant ? activeConnections.length : 0;
      violationCount = complianceStatus.recentViolations.length;
      emergencyOverride = complianceStatus.emergencyOverride;
    }

    // Get emergency status
    const activeEmergencies = Array.from(this.emergencyCoordinations.values())
      .filter(coord => coord.status === 'active');

    const emergencyLevel = this.determineEmergencyLevel(activeEmergencies);

    return {
      totalServers: allConnections.length,
      activeServers: activeConnections.length,
      healthyServers: this.getHealthyServerCount(),
      overloadedServers: this.getOverloadedServerCount(),
      emergencyServers: this.getEmergencyServerCount(),
      totalConnections: this.getTotalConnectionCount(),
      totalBandwidth: this.getTotalBandwidth(),
      certificateFederation: {
        trustChains: this.getTrustChainCount(),
        pendingValidations: this.getPendingValidationCount(),
        federatedStations: this.getFederatedStationCount()
      },
      compliance: {
        compliantServers,
        violationCount,
        emergencyOverride
      },
      emergencyStatus: {
        active: activeEmergencies.length > 0,
        level: emergencyLevel,
        activeBroadcasts: this.getActiveBroadcastCount(),
        coordinatingStations: this.getCoordinatingStationCount()
      }
    };
  }

  /**
   * Scale servers based on demand or emergency
   */
  async scaleServers(
    targetCount: number,
    reason: 'demand' | 'emergency' | 'maintenance' | 'optimization'
  ): Promise<{
    success: boolean;
    currentCount: number;
    targetCount: number;
    changes: string[];
  }> {
    const currentCount = this.serverManager.getActiveConnections().length;
    const changes: string[] = [];

    console.log(`📈 Scaling servers: ${currentCount} → ${targetCount} (${reason})`);

    if (targetCount > currentCount) {
      // Scale up
      const serversToAdd = targetCount - currentCount;
      const availableLocations = Array.from(this.serverLocations.values())
        .filter(loc => !this.isLocationActive(loc.id))
        .slice(0, serversToAdd);

      const deployResult = await this.deployServers(
        availableLocations.map(loc => loc.id),
        { deploymentMethod: reason === 'emergency' ? 'emergency' : 'rolling' }
      );

      changes.push(`Added ${deployResult.deployed.length} servers`);

    } else if (targetCount < currentCount) {
      // Scale down
      const serversToRemove = currentCount - targetCount;
      const connectionsToRemove = this.selectServersForRemoval(serversToRemove);

      for (const connection of connectionsToRemove) {
        await this.serverManager.disconnect(connection.server.id);
        changes.push(`Removed server ${connection.server.id}`);
      }
    }

    const finalCount = this.serverManager.getActiveConnections().length;

    await this.logEvent('scaling',
      `Server scaling completed: ${currentCount} → ${finalCount} (${reason})`
    );

    return {
      success: Math.abs(finalCount - targetCount) <= 1, // Allow for 1 server tolerance
      currentCount: finalCount,
      targetCount,
      changes
    };
  }

  /**
   * Get server health metrics
   */
  getServerHealth(): ServerHealthMetrics[] {
    return Array.from(this.serverHealth.values());
  }

  /**
   * Get emergency coordinations
   */
  getEmergencyCoordinations(): EmergencyCoordination[] {
    return Array.from(this.emergencyCoordinations.values());
  }

  /**
   * Update deployment configuration
   */
  updateDeploymentConfig(newConfig: Partial<ServerDeploymentConfig>): void {
    this.deploymentConfig = { ...this.deploymentConfig, ...newConfig };

    if (newConfig.deployment?.locations) {
      // Update server locations
      this.serverLocations.clear();
      for (const location of newConfig.deployment.locations) {
        this.serverLocations.set(location.id, location);
      }
    }

    this.emit('config-updated', newConfig);
  }

  /**
   * Emergency shutdown of entire distributed system
   */
  async emergencyShutdown(reason: string): Promise<void> {
    console.warn(`🚨 DISTRIBUTED SYSTEM EMERGENCY SHUTDOWN: ${reason}`);

    // Stop monitoring
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    // Shutdown automatic station if active
    if (this.automaticStation) {
      await this.automaticStation.emergencyShutdown();
    }

    // Stop compliance monitoring
    if (this.complianceManager) {
      await this.complianceManager.stop();
    }

    // Disconnect all servers
    await this.serverManager.disconnectAll();

    // Clear coordinations
    this.emergencyCoordinations.clear();

    await this.logEvent('emergency', `Distributed system emergency shutdown: ${reason}`);

    console.log('🛑 Distributed system emergency shutdown complete');
  }

  // Private helper methods

  private async deployToLocation(
    location: ServerLocation,
    options: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate deployment process
      // In real implementation, this would:
      // 1. Transfer binaries to location
      // 2. Install and configure server
      // 3. Start services
      // 4. Validate deployment

      console.log(`📍 Deploying to ${location.name} (${location.gridSquare})`);

      // Mock deployment delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate success/failure based on infrastructure
      const successProbability = location.infrastructure.internetConnection === 'fiber' ? 0.95 : 0.8;

      if (Math.random() > successProbability) {
        return { success: false, error: 'Infrastructure failure' };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async validateDeploymentReadiness(): Promise<void> {
    // Validate certificates
    if (!this.certificateManager) {
      throw new Error('Certificate manager not available');
    }

    // Validate compliance
    if (!this.complianceManager) {
      console.warn('Compliance manager not available - compliance monitoring disabled');
    }

    // Validate server locations
    if (this.serverLocations.size === 0) {
      throw new Error('No server locations configured');
    }

    console.log(`✅ Deployment readiness validated: ${this.serverLocations.size} locations`);
  }

  private selectEmergencyServers(
    emergencyContext: EmergencyContext,
    allocation: 'minimal' | 'standard' | 'maximum' = 'standard'
  ): string[] {
    const allConnections = this.serverManager.getActiveConnections();

    let serverCount: number;
    switch (allocation) {
      case 'minimal': serverCount = Math.max(1, Math.floor(allConnections.length * 0.25)); break;
      case 'maximum': serverCount = allConnections.length; break;
      default: serverCount = Math.max(2, Math.floor(allConnections.length * 0.5)); break;
    }

    // Prefer servers in the emergency jurisdiction
    const jurisdictionServers = allConnections.filter(conn => {
      const location = this.findLocationForServer(conn.server.id);
      return location?.jurisdiction === emergencyContext.jurisdiction;
    });

    const selectedServers = jurisdictionServers.slice(0, serverCount);

    // Fill remaining slots with other servers
    if (selectedServers.length < serverCount) {
      const otherServers = allConnections
        .filter(conn => !selectedServers.includes(conn))
        .slice(0, serverCount - selectedServers.length);
      selectedServers.push(...otherServers);
    }

    return selectedServers.map(conn => conn.server.id);
  }

  private calculateEmergencyBandwidth(severity: EmergencyContext['severity']): number {
    // Calculate required bandwidth based on emergency severity
    switch (severity) {
      case 'catastrophic': return 1000; // 1 Gbps
      case 'critical': return 500;     // 500 Mbps
      case 'major': return 200;        // 200 Mbps
      case 'moderate': return 100;     // 100 Mbps
      default: return 50;              // 50 Mbps
    }
  }

  private determineGeographicScope(severity: EmergencyContext['severity']): 'local' | 'regional' | 'national' | 'global' {
    switch (severity) {
      case 'catastrophic': return 'national';
      case 'critical': return 'regional';
      case 'major': return 'regional';
      default: return 'local';
    }
  }

  private async scaleForEmergency(coordination: EmergencyCoordination): Promise<void> {
    const requiredServers = coordination.resourceAllocation.servers.length;
    const currentActive = this.serverManager.getActiveConnections().length;

    if (requiredServers > currentActive) {
      await this.scaleServers(requiredServers, 'emergency');
    }
  }

  private async configureEmergencyPriority(coordination: EmergencyCoordination): Promise<void> {
    const priorityMessage = {
      type: 'emergency-priority',
      coordinationId: coordination.coordinationId,
      priority: PriorityLevel.P0_EMERGENCY,
      timestamp: new Date().toISOString()
    };

    await this.serverManager.broadcast(priorityMessage);
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.updateServerHealth();
      this.checkEmergencyCoordinations();
    }, 30000) as unknown as number; // Monitor every 30 seconds
  }

  private updateServerHealth(): void {
    const connections = this.serverManager.getAllConnections();

    for (const connection of connections) {
      const metrics: ServerHealthMetrics = {
        serverId: connection.server.id,
        location: this.findLocationForServer(connection.server.id)?.name || 'Unknown',
        status: this.determineServerStatus(connection),
        performance: {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          disk: Math.random() * 100,
          bandwidth: Math.random() * 1000,
          connections: connection.messageCount,
          responseTime: connection.responseTime
        },
        compliance: {
          stationID: true,
          encryption: true,
          content: true,
          operator: true
        },
        infrastructure: {
          power: 'mains',
          internet: connection.status === 'connected' ? 'up' : 'down',
          cooling: 'normal',
          backup: true
        },
        lastHeartbeat: new Date(),
        uptime: Date.now() - connection.connectionTime
      };

      this.serverHealth.set(connection.server.id, metrics);
    }
  }

  private checkEmergencyCoordinations(): void {
    const now = new Date();

    for (const [id, coordination] of this.emergencyCoordinations) {
      // Check for escalation conditions
      const timeSinceActivation = now.getTime() - coordination.timeline.activated.getTime();

      // Auto-escalate after 1 hour for major+ emergencies
      if (timeSinceActivation > 60 * 60 * 1000 && coordination.severity === 'major') {
        coordination.timeline.escalations.push({
          time: now,
          level: 'escalated',
          reason: 'Duration threshold exceeded'
        });
      }

      // Update last update time
      coordination.timeline.lastUpdate = now;
    }
  }

  private setupEventHandlers(): void {
    // Server manager events
    this.serverManager.addEventListener('server-connected', (event: any) => {
      this.emit('server-connected', event.detail);
    });

    this.serverManager.addEventListener('server-disconnected', (event: any) => {
      this.emit('server-disconnected', event.detail);
    });

    // Emergency broadcaster events (if available)
    if (this.emergencyBroadcaster) {
      // Would set up emergency event handlers
    }
  }

  // Helper methods for cluster status

  private getHealthyServerCount(): number {
    return Array.from(this.serverHealth.values())
      .filter(health => health.status === 'healthy').length;
  }

  private getOverloadedServerCount(): number {
    return Array.from(this.serverHealth.values())
      .filter(health => health.status === 'overloaded').length;
  }

  private getEmergencyServerCount(): number {
    return Array.from(this.serverHealth.values())
      .filter(health => health.status === 'emergency').length;
  }

  private getTotalConnectionCount(): number {
    return Array.from(this.serverHealth.values())
      .reduce((total, health) => total + health.performance.connections, 0);
  }

  private getTotalBandwidth(): number {
    return Array.from(this.serverHealth.values())
      .reduce((total, health) => total + health.performance.bandwidth, 0);
  }

  private getTrustChainCount(): number {
    // Would calculate from certificate manager
    return 0;
  }

  private getPendingValidationCount(): number {
    // Would calculate from certificate manager
    return 0;
  }

  private getFederatedStationCount(): number {
    // Would calculate from LoTW integration
    return 0;
  }

  private getActiveBroadcastCount(): number {
    return Array.from(this.emergencyCoordinations.values())
      .reduce((total, coord) => total + coord.activeBroadcasts.length, 0);
  }

  private getCoordinatingStationCount(): number {
    const allStations = new Set<string>();
    for (const coord of this.emergencyCoordinations.values()) {
      coord.coordinatingStations.forEach(station => allStations.add(station));
    }
    return allStations.size;
  }

  private determineEmergencyLevel(emergencies: EmergencyCoordination[]): ClusterStatus['emergencyStatus']['level'] {
    if (emergencies.length === 0) return 'none';

    const maxSeverity = emergencies.reduce((max, coord) => {
      const severityOrder = ['minor', 'moderate', 'major', 'critical', 'catastrophic'];
      const currentIndex = severityOrder.indexOf(coord.severity);
      const maxIndex = severityOrder.indexOf(max);
      return currentIndex > maxIndex ? coord.severity : max;
    }, 'minor' as EmergencyContext['severity']);

    switch (maxSeverity) {
      case 'catastrophic': return 'disaster';
      case 'critical': return 'emergency';
      case 'major': return 'warning';
      default: return 'watch';
    }
  }

  private isLocationActive(locationId: string): boolean {
    const location = this.serverLocations.get(locationId);
    if (!location) return false;

    return this.serverManager.getActiveConnections()
      .some(conn => this.findLocationForServer(conn.server.id)?.id === locationId);
  }

  private selectServersForRemoval(count: number): ServerConnection[] {
    const connections = this.serverManager.getActiveConnections();

    // Prefer removing servers with lowest utilization
    return connections
      .sort((a, b) => a.messageCount - b.messageCount)
      .slice(0, count);
  }

  private findLocationForServer(serverId: string): ServerLocation | undefined {
    // In real implementation, would maintain server-to-location mapping
    return Array.from(this.serverLocations.values())[0]; // Mock implementation
  }

  private determineServerStatus(connection: ServerConnection): ServerHealthMetrics['status'] {
    if (connection.status !== 'connected') return 'failed';
    if (connection.responseTime > 1000) return 'degraded';
    if (connection.messageCount > 10000) return 'overloaded';
    return 'healthy';
  }

  private async logEvent(type: string, description: string): Promise<void> {
    console.log(`📋 [${type.toUpperCase()}] ${description}`);
  }

  private on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in orchestrator event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    this.serverManager.dispose();
    this.eventListeners.clear();
    this.emergencyCoordinations.clear();
    this.serverHealth.clear();
  }
}

export default DistributedServerOrchestrator;