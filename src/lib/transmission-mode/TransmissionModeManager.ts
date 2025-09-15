/**
 * Transmission Mode Manager
 *
 * Manages switching between RF and WebRTC transmission modes for ham radio networks.
 * Integrates BitTorrent chunking protocol (spec 013) with WebRTC swarm coordination (spec 014).
 */

export enum TransmissionMode {
  RF = 'RF',
  WebRTC = 'WebRTC',
  HYBRID = 'HYBRID'
}

export interface TransmissionModeConfig {
  mode: TransmissionMode;
  autoFallback: boolean;
  webrtcEnabled: boolean;
  rfEnabled: boolean;
  fallbackTimeoutMs: number;
  signalingServerUrl?: string;
}

export interface ModeCapabilities {
  maxBandwidth: number; // bytes/second
  latency: number; // milliseconds
  reliability: number; // 0-1 scale
  connectionType: 'local' | 'internet' | 'rf';
}

export interface ConnectionStatus {
  mode: TransmissionMode;
  webrtcPeers: number;
  rfPeers: number;
  uptime: number;
  lastModeSwitch: Date;
  capabilities: ModeCapabilities;
}

/**
 * Central transmission mode coordinator for both BitTorrent and WebRTC specs
 */
export class TransmissionModeManager {
  private currentMode: TransmissionMode = TransmissionMode.RF;
  private config: TransmissionModeConfig;
  private fallbackTimer?: NodeJS.Timeout;
  private listeners: ((status: ConnectionStatus) => void)[] = [];

  constructor(config: TransmissionModeConfig) {
    this.config = config;
    this.currentMode = config.mode; // Initialize with configured mode
  }

  /**
   * Get current transmission mode
   */
  getCurrentMode(): TransmissionMode {
    return this.currentMode;
  }

  /**
   * Switch to specific transmission mode
   */
  async switchToMode(mode: TransmissionMode): Promise<boolean> {
    if (!this.isModeSupported(mode)) {
      throw new Error(`Transmission mode ${mode} not supported in current configuration`);
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    try {
      await this.configureMode(mode);
      this.notifyModeChange();
      return true;
    } catch (error) {
      // Rollback on failure
      this.currentMode = previousMode;
      throw error;
    }
  }

  /**
   * Enable automatic fallback from WebRTC to RF
   */
  enableAutoFallback(): void {
    if (this.currentMode === TransmissionMode.WebRTC) {
      this.fallbackTimer = setTimeout(() => {
        if (this.shouldFallbackToRF()) {
          this.switchToMode(TransmissionMode.RF);
        }
      }, this.config.fallbackTimeoutMs);
    }
  }

  /**
   * Disable automatic fallback
   */
  disableAutoFallback(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = undefined;
    }
  }

  /**
   * Get connection status across all modes
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      mode: this.currentMode,
      webrtcPeers: this.getWebRTCPeerCount(),
      rfPeers: this.getRFPeerCount(),
      uptime: this.getUptime(),
      lastModeSwitch: this.getLastModeSwitch(),
      capabilities: this.getCurrentCapabilities()
    };
  }

  /**
   * Subscribe to mode change notifications
   */
  onModeChange(listener: (status: ConnectionStatus) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Unsubscribe from mode change notifications
   */
  offModeChange(listener: (status: ConnectionStatus) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Check if mode is supported based on configuration
   */
  private isModeSupported(mode: TransmissionMode): boolean {
    switch (mode) {
      case TransmissionMode.RF:
        return this.config.rfEnabled;
      case TransmissionMode.WebRTC:
        return this.config.webrtcEnabled;
      case TransmissionMode.HYBRID:
        return this.config.webrtcEnabled && this.config.rfEnabled;
      default:
        return false;
    }
  }

  /**
   * Configure system for specific transmission mode
   */
  private async configureMode(mode: TransmissionMode): Promise<void> {
    switch (mode) {
      case TransmissionMode.RF:
        await this.configureRFMode();
        break;
      case TransmissionMode.WebRTC:
        await this.configureWebRTCMode();
        break;
      case TransmissionMode.HYBRID:
        await this.configureHybridMode();
        break;
    }
  }

  /**
   * Configure RF-only mode (BitTorrent chunks)
   */
  private async configureRFMode(): Promise<void> {
    // Enable BitTorrent chunking protocol
    // Enable CQ beacon content routing
    // Enable spectrum monitoring
    // Disable WebRTC connections
  }

  /**
   * Configure WebRTC-only mode (direct downloads)
   */
  private async configureWebRTCMode(): Promise<void> {
    // Enable WebRTC peer connections
    // Enable signaling server connection
    // Enable direct content downloads
    // Configure fallback monitoring
  }

  /**
   * Configure hybrid mode (both WebRTC and RF)
   */
  private async configureHybridMode(): Promise<void> {
    // Enable both WebRTC and RF protocols
    // Configure intelligent routing
    // Enable seamless mode switching
  }

  /**
   * Check if should fallback from WebRTC to RF
   */
  private shouldFallbackToRF(): boolean {
    // Check WebRTC connection health
    // Check peer availability
    // Check network conditions
    return false; // Placeholder
  }

  /**
   * Get current WebRTC peer count
   */
  private getWebRTCPeerCount(): number {
    // Query WebRTC transport layer
    return 0; // Placeholder
  }

  /**
   * Get current RF peer count
   */
  private getRFPeerCount(): number {
    // Query mesh networking layer
    return 0; // Placeholder
  }

  /**
   * Get system uptime
   */
  private getUptime(): number {
    return Date.now(); // Placeholder
  }

  /**
   * Get last mode switch timestamp
   */
  private getLastModeSwitch(): Date {
    return new Date(); // Placeholder
  }

  /**
   * Get capabilities for current mode
   */
  private getCurrentCapabilities(): ModeCapabilities {
    switch (this.currentMode) {
      case TransmissionMode.RF:
        return {
          maxBandwidth: 1800, // 14.4kbps
          latency: 2000,
          reliability: 0.7,
          connectionType: 'rf'
        };
      case TransmissionMode.WebRTC:
        return {
          maxBandwidth: 1048576, // 1MB/s
          latency: 50,
          reliability: 0.9,
          connectionType: 'local'
        };
      case TransmissionMode.HYBRID:
        return {
          maxBandwidth: 1048576, // Best of both
          latency: 50,
          reliability: 0.95,
          connectionType: 'local'
        };
    }
  }

  /**
   * Notify listeners of mode changes
   */
  private notifyModeChange(): void {
    const status = this.getConnectionStatus();
    this.listeners.forEach(listener => listener(status));
  }
}