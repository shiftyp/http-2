/**
 * Station ID Timer
 *
 * Implements FCC §97.119 station identification requirements with
 * automatic 10-minute timer and end-of-transmission identification.
 */

import { StationIDConfig, StationIDTimer as StationIDTimerState, StationIDEvent } from '../types.js';

export class StationIDTimer {
  private config: StationIDConfig;
  private timer: NodeJS.Timeout | null = null;
  private state: StationIDTimerState;
  private isActive = false;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: StationIDConfig) {
    this.config = config;
    this.state = this.initializeState();
  }

  /**
   * Start the station ID timer
   */
  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('Station ID timer already active');
    }

    this.isActive = true;
    this.resetTimer();

    await this.logStationIDEvent('automatic', 'Station ID timer started');
  }

  /**
   * Stop the station ID timer
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isActive = false;

    await this.logStationIDEvent('automatic', 'Station ID timer stopped');
  }

  /**
   * Reset the timer (called when transmission starts)
   */
  resetTimer(): void {
    if (!this.isActive) {
      return;
    }

    // Clear existing timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // Calculate next ID time
    const now = new Date();
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    const nextIDTime = new Date(now.getTime() + intervalMs);

    // Update state
    this.state.lastIDTime = now;
    this.state.nextIDTime = nextIDTime;
    this.state.isOverdue = false;
    this.state.warningTriggered = false;
    this.state.transmissionStartTime = now;

    // Set timer for station ID
    this.timer = setTimeout(() => {
      this.handleTimerExpired();
    }, intervalMs);

    // Set warning timer (1 minute before due)
    const warningTime = intervalMs - (60 * 1000); // 1 minute before
    if (warningTime > 0) {
      setTimeout(() => {
        this.handleWarning();
      }, warningTime);
    }
  }

  /**
   * Force station identification immediately
   */
  async forceStationID(reason: 'manual' | 'end_of_transmission' | 'emergency' = 'manual'): Promise<void> {
    const success = await this.transmitStationID(reason);

    if (success) {
      // Reset timer after successful ID
      this.resetTimer();
    }

    await this.logStationIDEvent(reason, success ? 'Station ID transmitted' : 'Station ID failed');
  }

  /**
   * Mark end of transmission (triggers station ID if enabled)
   */
  async endOfTransmission(): Promise<void> {
    if (this.config.endOfTransmissionID) {
      await this.forceStationID('end_of_transmission');
    }

    // Stop timer if no ongoing transmission
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.state.transmissionStartTime = undefined;
  }

  /**
   * Get current timer state
   */
  getState(): StationIDTimerState {
    // Update overdue status
    const now = new Date();
    this.state.isOverdue = now > this.state.nextIDTime && this.isActive;

    return { ...this.state };
  }

  /**
   * Check if station ID is overdue
   */
  isOverdue(): boolean {
    return new Date() > this.state.nextIDTime && this.isActive;
  }

  /**
   * Get time until next station ID
   */
  getTimeUntilNextID(): number {
    const now = new Date();
    const timeRemaining = this.state.nextIDTime.getTime() - now.getTime();
    return Math.max(0, timeRemaining);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: StationIDConfig): void {
    const oldInterval = this.config.intervalMinutes;
    this.config = newConfig;

    // Update state
    this.state.callsign = newConfig.callsign;
    this.state.intervalMinutes = newConfig.intervalMinutes;

    // Restart timer if interval changed
    if (oldInterval !== newConfig.intervalMinutes && this.isActive) {
      this.resetTimer();
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<'healthy' | 'warning' | 'error'> {
    if (!this.isActive) {
      return 'warning'; // Not running when it should be
    }

    if (this.isOverdue()) {
      return 'error'; // Station ID overdue
    }

    const timeUntilNext = this.getTimeUntilNextID();
    if (timeUntilNext < 60000) { // Less than 1 minute
      return 'warning'; // Getting close to deadline
    }

    return 'healthy';
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
   * Handle timer expiration (station ID due)
   */
  private async handleTimerExpired(): Promise<void> {
    this.state.isOverdue = true;

    // Emit warning event
    this.emit('station-id-due', {
      callsign: this.config.callsign,
      overdueBy: Date.now() - this.state.nextIDTime.getTime()
    });

    // Auto-transmit if enabled
    if (this.config.automaticIDEnabled) {
      const success = await this.transmitStationID('automatic');

      if (success) {
        // Reset timer after successful auto-ID
        this.resetTimer();
      } else {
        // If auto-ID fails, set shorter retry timer
        this.timer = setTimeout(() => {
          this.handleTimerExpired();
        }, 30000); // Retry in 30 seconds
      }
    }
  }

  /**
   * Handle warning (1 minute before station ID due)
   */
  private handleWarning(): void {
    if (!this.state.warningTriggered) {
      this.state.warningTriggered = true;

      this.emit('station-id-warning', {
        callsign: this.config.callsign,
        timeRemaining: this.getTimeUntilNextID()
      });
    }
  }

  /**
   * Transmit station identification
   */
  private async transmitStationID(type: StationIDEvent['type']): Promise<boolean> {
    try {
      // In a real implementation, this would interface with the radio
      // For now, we simulate the transmission

      const callsign = this.config.callsign;
      const controlOperator = this.config.controlOperatorCallsign;

      // Build station ID message
      let idMessage = `DE ${callsign}`;

      if (controlOperator && controlOperator !== callsign) {
        idMessage += ` / ${controlOperator}`;
      }

      // Add emergency callsign if in emergency mode
      if (this.config.emergencyCallsign) {
        idMessage += ` ${this.config.emergencyCallsign}`;
      }

      // Simulate transmission delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Log successful transmission
      const event: StationIDEvent = {
        type,
        callsign: this.config.callsign,
        timestamp: new Date(),
        transmissionDuration: this.state.transmissionStartTime
          ? (Date.now() - this.state.transmissionStartTime.getTime()) / 1000
          : undefined,
        successful: true
      };

      this.emit('station-id-transmitted', event);

      return true;

    } catch (error) {
      // Log failed transmission
      const event: StationIDEvent = {
        type,
        callsign: this.config.callsign,
        timestamp: new Date(),
        successful: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('station-id-failed', event);

      return false;
    }
  }

  /**
   * Initialize timer state
   */
  private initializeState(): StationIDTimerState {
    const now = new Date();
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      callsign: this.config.callsign,
      lastIDTime: new Date(0), // Never transmitted
      nextIDTime: new Date(now.getTime() + this.config.intervalMinutes * 60 * 1000),
      isOverdue: false,
      intervalMinutes: this.config.intervalMinutes,
      warningTriggered: false
    };
  }

  /**
   * Log station ID event
   */
  private async logStationIDEvent(type: StationIDEvent['type'], description: string): Promise<void> {
    // In a real implementation, this would log to the compliance system
    console.log(`[Station ID] ${type.toUpperCase()}: ${description} (${this.config.callsign})`);
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
          console.error(`Error in station ID timer event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get remaining time as human-readable string
   */
  getTimeRemainingString(): string {
    const timeMs = this.getTimeUntilNextID();

    if (timeMs <= 0) {
      return 'OVERDUE';
    }

    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Dispose of the timer
   */
  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isActive = false;
    this.eventListeners.clear();
  }
}

export default StationIDTimer;