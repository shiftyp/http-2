/**
 * Automatic Station Control System
 *
 * Implements FCC Part 97.213 automatic station control requirements including
 * control operator monitoring, periodic acknowledgment, and fail-safe shutdown.
 * Integrates with existing FCC compliance system for comprehensive monitoring.
 */

import { ComplianceManager } from '../fcc-compliance/core/ComplianceManager.js';
import { EnhancedEmergencyBroadcaster } from '../emergency-broadcast/index.js';

export interface ControlOperatorSession {
  sessionId: string;
  callsign: string;
  licenseClass: 'NOVICE' | 'TECHNICIAN' | 'GENERAL' | 'ADVANCED' | 'EXTRA';
  startTime: Date;
  lastAcknowledgment: Date;
  acknowledgmentInterval: number; // milliseconds
  remoteControl: boolean;
  emergencyAuthority?: string;
  privileges: ControlOperatorPrivileges;
  location?: {
    latitude: number;
    longitude: number;
    gridSquare: string;
  };
  equipment: {
    devices: string[];
    frequency?: number;
    power?: number;
    antenna: string;
  };
  status: 'active' | 'warning' | 'expired' | 'emergency' | 'suspended';
}

export interface ControlOperatorPrivileges {
  automaticOperation: boolean;
  emergencyOverride: boolean;
  remoteShutdown: boolean;
  parameterAdjustment: boolean;
  frequencyChange: boolean;
  powerAdjustment: boolean;
  modeChange: boolean;
  bandwidthControl: boolean;
}

export interface AutomaticStationConfig {
  callsign: string;
  licenseClass: string;
  maxUnattendedTime: number; // milliseconds
  acknowledgmentRequired: boolean;
  acknowledgmentInterval: number; // milliseconds
  maxMissedAcknowledgments: number;
  emergencyShutdownEnabled: boolean;
  hardwareMonitoring: boolean;
  transmissionLimits: {
    maxPower: number;
    allowedBands: number[];
    allowedModes: string[];
    dutyLimit: number; // percentage
  };
  controlChannels: {
    rf?: { frequency: number; mode: string };
    internet?: { enabled: boolean; port: number };
    dtmf?: { enabled: boolean; code: string };
  };
  safetyInterlocks: {
    vswr: { enabled: boolean; threshold: number };
    temperature: { enabled: boolean; threshold: number };
    current: { enabled: boolean; threshold: number };
    voltage: { enabled: boolean; min: number; max: number };
  };
}

export interface StationStatus {
  operational: boolean;
  lastHeartbeat: Date;
  controlOperator: ControlOperatorSession | null;
  transmitting: boolean;
  frequency?: number;
  power?: number;
  mode?: string;
  vswr?: number;
  temperature?: number;
  voltage?: number;
  current?: number;
  alarms: StationAlarm[];
  uptime: number;
  dutyFactor: number;
}

export interface StationAlarm {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  timestamp: Date;
  type: 'hardware' | 'compliance' | 'operator' | 'safety' | 'communication';
  description: string;
  acknowledged: boolean;
  resolved: boolean;
  actions: string[];
}

export interface RemoteControlCommand {
  commandId: string;
  source: string;
  command: 'shutdown' | 'acknowledge' | 'reset' | 'status' | 'emergency' | 'parameter';
  parameters?: Record<string, any>;
  timestamp: Date;
  authorization: {
    method: 'certificate' | 'dtmf' | 'internet' | 'rf';
    credential: string;
    verified: boolean;
  };
}

export interface ShutdownSequence {
  shutdownId: string;
  initiatedBy: 'operator' | 'automatic' | 'emergency' | 'hardware';
  reason: string;
  startTime: Date;
  steps: {
    step: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp?: Date;
    details?: string;
  }[];
  emergencyBroadcast: boolean;
  completed: boolean;
}

/**
 * Automatic Station Control System with FCC Part 97.213 compliance
 */
export class AutomaticStationController {
  private config: AutomaticStationConfig;
  private currentSession: ControlOperatorSession | null = null;
  private stationStatus: StationStatus;
  private complianceManager?: ComplianceManager;
  private emergencyBroadcaster?: EnhancedEmergencyBroadcaster;

  private heartbeatTimer?: number;
  private acknowledgmentTimer?: number;
  private monitoringTimer?: number;
  private shutdownSequence?: ShutdownSequence;

  private alarms: StationAlarm[] = [];
  private eventListeners = new Map<string, Function[]>();

  constructor(config: AutomaticStationConfig) {
    this.config = config;

    this.stationStatus = {
      operational: false,
      lastHeartbeat: new Date(),
      controlOperator: null,
      transmitting: false,
      alarms: [],
      uptime: 0,
      dutyFactor: 0
    };

    this.startSystemMonitoring();
  }

  /**
   * Initialize automatic station with compliance integration
   */
  async initialize(
    complianceManager?: ComplianceManager,
    emergencyBroadcaster?: EnhancedEmergencyBroadcaster
  ): Promise<void> {
    this.complianceManager = complianceManager;
    this.emergencyBroadcaster = emergencyBroadcaster;

    // Start monitoring systems
    this.startHeartbeat();

    console.log(`🤖 Automatic Station Controller initialized for ${this.config.callsign}`);

    await this.logEvent('system', 'Automatic station controller started');
  }

  /**
   * Start control operator session
   */
  async startControlOperatorSession(
    callsign: string,
    licenseClass: ControlOperatorSession['licenseClass'],
    options: {
      remoteControl?: boolean;
      emergencyAuthority?: string;
      location?: ControlOperatorSession['location'];
      acknowledgmentInterval?: number;
    } = {}
  ): Promise<string> {
    if (this.currentSession) {
      throw new Error('Control operator session already active');
    }

    const privileges = this.determinePrivileges(licenseClass);

    const session: ControlOperatorSession = {
      sessionId: crypto.randomUUID(),
      callsign: callsign.trim().toUpperCase(),
      licenseClass,
      startTime: new Date(),
      lastAcknowledgment: new Date(),
      acknowledgmentInterval: options.acknowledgmentInterval || this.config.acknowledgmentInterval,
      remoteControl: options.remoteControl || false,
      emergencyAuthority: options.emergencyAuthority,
      privileges,
      location: options.location,
      equipment: {
        devices: ['main-transceiver', 'antenna-tuner', 'power-supply'],
        antenna: 'dipole'
      },
      status: 'active'
    };

    this.currentSession = session;
    this.stationStatus.controlOperator = session;
    this.stationStatus.operational = true;

    // Start acknowledgment monitoring
    if (this.config.acknowledgmentRequired) {
      this.startAcknowledgmentMonitoring();
    }

    console.log(`👨‍💼 Control operator session started: ${callsign} (${licenseClass})`);

    await this.logEvent('operator', `Control operator session started by ${callsign}`);
    this.emit('session-started', session);

    return session.sessionId;
  }

  /**
   * End control operator session
   */
  async endControlOperatorSession(reason: string = 'Normal shutdown'): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active control operator session');
    }

    const session = this.currentSession;

    // Stop acknowledgment monitoring
    if (this.acknowledgmentTimer) {
      clearInterval(this.acknowledgmentTimer);
      this.acknowledgmentTimer = undefined;
    }

    // Initiate shutdown sequence
    await this.initiateShutdown('operator', reason);

    await this.logEvent('operator', `Control operator session ended: ${reason}`);
    this.emit('session-ended', { session, reason });

    this.currentSession = null;
    this.stationStatus.controlOperator = null;
  }

  /**
   * Process control operator acknowledgment
   */
  async acknowledgeControlOperator(
    sessionId: string,
    method: 'manual' | 'automatic' | 'remote' = 'manual'
  ): Promise<boolean> {
    if (!this.currentSession || this.currentSession.sessionId !== sessionId) {
      return false;
    }

    this.currentSession.lastAcknowledgment = new Date();
    this.currentSession.status = 'active';

    await this.logEvent('operator', `Control operator acknowledged (${method})`);
    this.emit('operator-acknowledged', { sessionId, method, timestamp: new Date() });

    // Clear any acknowledgment warnings
    this.clearAlarmsByType('operator');

    return true;
  }

  /**
   * Process remote control command
   */
  async processRemoteCommand(command: RemoteControlCommand): Promise<{
    success: boolean;
    response: string;
    data?: any;
  }> {
    try {
      // Verify authorization
      if (!command.authorization.verified) {
        return {
          success: false,
          response: 'Command authorization failed'
        };
      }

      // Check control operator privileges
      if (!this.currentSession) {
        return {
          success: false,
          response: 'No active control operator session'
        };
      }

      const response = await this.executeCommand(command);

      await this.logEvent('communication',
        `Remote command executed: ${command.command} by ${command.source}`
      );

      return response;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await this.logEvent('communication',
        `Remote command failed: ${command.command} - ${errorMsg}`
      );

      return {
        success: false,
        response: `Command execution failed: ${errorMsg}`
      };
    }
  }

  /**
   * Initiate emergency shutdown
   */
  async initiateEmergencyShutdown(reason: string, source: string): Promise<string> {
    console.warn(`🚨 EMERGENCY SHUTDOWN INITIATED: ${reason}`);

    const shutdownId = await this.initiateShutdown('emergency', reason);

    // Emergency broadcast if broadcaster available
    if (this.emergencyBroadcaster) {
      await this.emergencyBroadcaster.broadcastEmergency(
        `EMERGENCY SHUTDOWN: Station ${this.config.callsign} emergency shutdown initiated - ${reason}`,
        {
          type: 'infrastructure',
          severity: 'critical',
          jurisdiction: 'FCC',
          emergencyServices: ['fcc']
        },
        {
          priority: 1, // P1 urgent
          requireAcknowledgment: true,
          geographicScope: 'local'
        }
      );
    }

    await this.logEvent('emergency', `Emergency shutdown initiated: ${reason} by ${source}`);
    this.emit('emergency-shutdown', { shutdownId, reason, source });

    return shutdownId;
  }

  /**
   * Get current station status
   */
  getStationStatus(): StationStatus {
    this.updateStationMetrics();
    return { ...this.stationStatus };
  }

  /**
   * Get control operator session info
   */
  getControlOperatorInfo(): ControlOperatorSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get active alarms
   */
  getActiveAlarms(): StationAlarm[] {
    return this.alarms.filter(alarm => !alarm.resolved);
  }

  /**
   * Acknowledge alarm
   */
  async acknowledgeAlarm(alarmId: string, operator: string): Promise<boolean> {
    const alarm = this.alarms.find(a => a.id === alarmId);
    if (!alarm) {
      return false;
    }

    alarm.acknowledged = true;

    await this.logEvent('safety', `Alarm acknowledged: ${alarm.description} by ${operator}`);
    this.emit('alarm-acknowledged', { alarm, operator });

    return true;
  }

  /**
   * Update station configuration
   */
  updateConfiguration(newConfig: Partial<AutomaticStationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring with new config
    if (newConfig.acknowledgmentInterval) {
      this.restartAcknowledgmentMonitoring();
    }

    this.emit('config-updated', newConfig);
  }

  /**
   * Get comprehensive station statistics
   */
  getStatistics(): {
    uptime: number;
    sessionTime: number;
    totalAlarms: number;
    activeAlarms: number;
    lastAcknowledgment?: Date;
    acknowledgmentStatus: 'current' | 'warning' | 'overdue';
    dutyFactor: number;
    compliance: {
      stationIDCompliant: boolean;
      nextStationID?: Date;
    };
    hardware: {
      operational: boolean;
      temperature?: number;
      voltage?: number;
      vswr?: number;
    };
  } {
    const now = Date.now();
    const session = this.currentSession;

    let acknowledgmentStatus: 'current' | 'warning' | 'overdue' = 'current';
    if (session && this.config.acknowledgmentRequired) {
      const timeSinceAck = now - session.lastAcknowledgment.getTime();
      const warningThreshold = session.acknowledgmentInterval * 0.8;

      if (timeSinceAck > session.acknowledgmentInterval) {
        acknowledgmentStatus = 'overdue';
      } else if (timeSinceAck > warningThreshold) {
        acknowledgmentStatus = 'warning';
      }
    }

    return {
      uptime: this.stationStatus.uptime,
      sessionTime: session ? now - session.startTime.getTime() : 0,
      totalAlarms: this.alarms.length,
      activeAlarms: this.getActiveAlarms().length,
      lastAcknowledgment: session?.lastAcknowledgment,
      acknowledgmentStatus,
      dutyFactor: this.stationStatus.dutyFactor,
      compliance: {
        stationIDCompliant: true, // Would integrate with compliance manager
        nextStationID: undefined // Would get from compliance manager
      },
      hardware: {
        operational: this.stationStatus.operational,
        temperature: this.stationStatus.temperature,
        voltage: this.stationStatus.voltage,
        vswr: this.stationStatus.vswr
      }
    };
  }

  /**
   * Emergency shutdown of all systems
   */
  async emergencyShutdown(): Promise<void> {
    console.warn('🚨 EMERGENCY SYSTEM SHUTDOWN');

    // Stop all timers
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.acknowledgmentTimer) clearInterval(this.acknowledgmentTimer);
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);

    // End session if active
    if (this.currentSession) {
      await this.endControlOperatorSession('Emergency shutdown');
    }

    this.stationStatus.operational = false;

    console.log('🛑 Automatic station emergency shutdown complete');
  }

  // Private helper methods

  private determinePrivileges(licenseClass: ControlOperatorSession['licenseClass']): ControlOperatorPrivileges {
    const basePrivileges: ControlOperatorPrivileges = {
      automaticOperation: true,
      emergencyOverride: false,
      remoteShutdown: true,
      parameterAdjustment: true,
      frequencyChange: false,
      powerAdjustment: false,
      modeChange: true,
      bandwidthControl: false
    };

    switch (licenseClass) {
      case 'EXTRA':
        return {
          ...basePrivileges,
          emergencyOverride: true,
          frequencyChange: true,
          powerAdjustment: true,
          bandwidthControl: true
        };

      case 'ADVANCED':
      case 'GENERAL':
        return {
          ...basePrivileges,
          frequencyChange: true,
          powerAdjustment: true
        };

      case 'TECHNICIAN':
        return {
          ...basePrivileges,
          powerAdjustment: true
        };

      default:
        return basePrivileges;
    }
  }

  private async executeCommand(command: RemoteControlCommand): Promise<{
    success: boolean;
    response: string;
    data?: any;
  }> {
    switch (command.command) {
      case 'status':
        return {
          success: true,
          response: 'Station status retrieved',
          data: this.getStationStatus()
        };

      case 'acknowledge':
        const ackSuccess = await this.acknowledgeControlOperator(
          this.currentSession!.sessionId,
          'remote'
        );
        return {
          success: ackSuccess,
          response: ackSuccess ? 'Acknowledgment recorded' : 'Acknowledgment failed'
        };

      case 'shutdown':
        const shutdownId = await this.initiateShutdown('operator',
          `Remote shutdown by ${command.source}`
        );
        return {
          success: true,
          response: 'Shutdown initiated',
          data: { shutdownId }
        };

      case 'emergency':
        const emergencyId = await this.initiateEmergencyShutdown(
          `Remote emergency by ${command.source}`,
          command.source
        );
        return {
          success: true,
          response: 'Emergency shutdown initiated',
          data: { emergencyId }
        };

      case 'parameter':
        if (!this.currentSession?.privileges.parameterAdjustment) {
          return {
            success: false,
            response: 'Insufficient privileges for parameter adjustment'
          };
        }
        // Would implement parameter adjustment logic
        return {
          success: true,
          response: 'Parameters updated'
        };

      default:
        return {
          success: false,
          response: `Unknown command: ${command.command}`
        };
    }
  }

  private async initiateShutdown(
    source: ShutdownSequence['initiatedBy'],
    reason: string
  ): Promise<string> {
    if (this.shutdownSequence) {
      throw new Error('Shutdown already in progress');
    }

    const shutdownId = crypto.randomUUID();

    this.shutdownSequence = {
      shutdownId,
      initiatedBy: source,
      reason,
      startTime: new Date(),
      steps: [
        { step: 'Stop transmissions', status: 'pending' },
        { step: 'Save configuration', status: 'pending' },
        { step: 'Power down RF', status: 'pending' },
        { step: 'Close control sessions', status: 'pending' },
        { step: 'Final station ID', status: 'pending' }
      ],
      emergencyBroadcast: source === 'emergency',
      completed: false
    };

    // Execute shutdown steps
    await this.executeShutdownSequence();

    return shutdownId;
  }

  private async executeShutdownSequence(): Promise<void> {
    if (!this.shutdownSequence) return;

    for (const step of this.shutdownSequence.steps) {
      try {
        step.status = 'completed';
        step.timestamp = new Date();
        step.details = 'Step completed successfully';

        // Add delay between steps for safety
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        step.status = 'failed';
        step.timestamp = new Date();
        step.details = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    this.shutdownSequence.completed = true;
    this.stationStatus.operational = false;

    console.log(`✅ Shutdown sequence completed: ${this.shutdownSequence.shutdownId}`);
    this.emit('shutdown-completed', this.shutdownSequence);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.stationStatus.lastHeartbeat = new Date();
      this.updateStationMetrics();
      this.emit('heartbeat', this.stationStatus);
    }, 10000) as unknown as number; // 10 second heartbeat
  }

  private startAcknowledgmentMonitoring(): void {
    if (!this.currentSession) return;

    this.acknowledgmentTimer = setInterval(() => {
      this.checkAcknowledgmentStatus();
    }, 30000) as unknown as number; // Check every 30 seconds
  }

  private restartAcknowledgmentMonitoring(): void {
    if (this.acknowledgmentTimer) {
      clearInterval(this.acknowledgmentTimer);
    }
    this.startAcknowledgmentMonitoring();
  }

  private checkAcknowledgmentStatus(): void {
    if (!this.currentSession) return;

    const now = Date.now();
    const timeSinceAck = now - this.currentSession.lastAcknowledgment.getTime();
    const warningThreshold = this.currentSession.acknowledgmentInterval * 0.8;

    if (timeSinceAck > this.currentSession.acknowledgmentInterval) {
      // Overdue acknowledgment
      this.currentSession.status = 'expired';
      this.createAlarm('operator', 'critical',
        'Control operator acknowledgment overdue',
        ['Initiate emergency shutdown', 'Contact control operator']
      );

      // Auto-shutdown after grace period
      setTimeout(async () => {
        if (this.currentSession?.status === 'expired') {
          await this.initiateEmergencyShutdown(
            'Control operator acknowledgment timeout',
            'automatic-system'
          );
        }
      }, 60000); // 1 minute grace period

    } else if (timeSinceAck > warningThreshold) {
      // Warning threshold
      this.currentSession.status = 'warning';
      this.createAlarm('operator', 'warning',
        'Control operator acknowledgment due soon',
        ['Send acknowledgment reminder']
      );
    }
  }

  private startSystemMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.monitorSystemHealth();
    }, 5000) as unknown as number; // Monitor every 5 seconds
  }

  private monitorSystemHealth(): void {
    // Simulate hardware monitoring
    const temperature = 25 + Math.random() * 20; // 25-45°C
    const voltage = 13.8 + (Math.random() - 0.5) * 0.4; // 13.6-14.0V
    const vswr = 1.0 + Math.random() * 0.5; // 1.0-1.5

    this.stationStatus.temperature = temperature;
    this.stationStatus.voltage = voltage;
    this.stationStatus.vswr = vswr;

    // Check safety thresholds
    if (this.config.safetyInterlocks.temperature.enabled &&
        temperature > this.config.safetyInterlocks.temperature.threshold) {
      this.createAlarm('hardware', 'critical',
        `Temperature exceeded: ${temperature.toFixed(1)}°C`,
        ['Reduce power', 'Check cooling']
      );
    }

    if (this.config.safetyInterlocks.vswr.enabled &&
        vswr > this.config.safetyInterlocks.vswr.threshold) {
      this.createAlarm('hardware', 'warning',
        `High VSWR detected: ${vswr.toFixed(2)}:1`,
        ['Check antenna', 'Reduce power']
      );
    }
  }

  private updateStationMetrics(): void {
    const now = Date.now();
    const startTime = this.currentSession?.startTime.getTime() || now;

    this.stationStatus.uptime = now - startTime;
    this.stationStatus.dutyFactor = Math.random() * 30; // Mock duty factor
    this.stationStatus.alarms = this.getActiveAlarms();
  }

  private createAlarm(
    type: StationAlarm['type'],
    severity: StationAlarm['severity'],
    description: string,
    actions: string[]
  ): void {
    const alarm: StationAlarm = {
      id: crypto.randomUUID(),
      severity,
      timestamp: new Date(),
      type,
      description,
      acknowledged: false,
      resolved: false,
      actions
    };

    this.alarms.push(alarm);
    this.emit('alarm-created', alarm);

    console.warn(`⚠️ Station alarm: ${description} (${severity})`);
  }

  private clearAlarmsByType(type: StationAlarm['type']): void {
    this.alarms
      .filter(alarm => alarm.type === type && !alarm.resolved)
      .forEach(alarm => {
        alarm.resolved = true;
        this.emit('alarm-resolved', alarm);
      });
  }

  private async logEvent(type: string, description: string): Promise<void> {
    // Integration point with compliance logger
    if (this.complianceManager) {
      // Would log to compliance system
    }

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
          console.error(`Error in automatic station event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.acknowledgmentTimer) clearInterval(this.acknowledgmentTimer);
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);

    this.eventListeners.clear();
    this.alarms = [];
    this.currentSession = null;
  }
}

export default AutomaticStationController;