/**
 * Carrier Enable/Disable Control Logic for OFDM
 *
 * Manages dynamic carrier activation based on channel conditions,
 * interference, and power constraints.
 */

export interface CarrierState {
  id: number;
  enabled: boolean;
  reason: DisableReason | null;
  disabledAt?: number;
  autoRecoverAt?: number;
  priority: number; // 0-1, higher = more important
}

export type DisableReason =
  | 'low-snr'
  | 'high-interference'
  | 'power-constraint'
  | 'manual-disable'
  | 'pilot-collision'
  | 'frequency-notch';

export interface ControlPolicy {
  minSNR: number;
  maxBER: number;
  interferenceThreshold: number;
  powerBudget: number; // Total power constraint
  autoRecovery: boolean;
  recoveryDelayMs: number;
  priorityThreshold: number; // Minimum priority to keep carrier active
}

export interface InterferenceReport {
  carrierId: number;
  level: number; // dB above noise floor
  type: 'narrowband' | 'wideband' | 'impulse';
  frequency: number; // Hz
}

export class CarrierControl {
  private carriers: Map<number, CarrierState> = new Map();
  private policy: ControlPolicy;
  private interferenceMap: Map<number, InterferenceReport> = new Map();
  private powerAllocation: Map<number, number> = new Map();
  private notchFilters: Set<number> = new Set();
  private recoveryQueue: Map<number, NodeJS.Timeout> = new Map();

  constructor(numCarriers: number = 48, policy: Partial<ControlPolicy> = {}) {
    this.policy = {
      minSNR: 3,
      maxBER: 1e-3,
      interferenceThreshold: 10, // dB above noise
      powerBudget: 48, // Watts or relative units
      autoRecovery: true,
      recoveryDelayMs: 5000,
      priorityThreshold: 0.1,
      ...policy
    };

    this.initializeCarriers(numCarriers);
  }

  /**
   * Initialize carrier states
   */
  private initializeCarriers(numCarriers: number): void {
    for (let i = 0; i < numCarriers; i++) {
      const isPilot = i % 6 === 0;

      this.carriers.set(i, {
        id: i,
        enabled: true,
        reason: null,
        priority: isPilot ? 1.0 : 0.5 // Pilots have highest priority
      });

      // Initial power allocation (equal distribution)
      this.powerAllocation.set(i, this.policy.powerBudget / numCarriers);
    }
  }

  /**
   * Evaluate carrier and determine if it should be enabled
   */
  evaluateCarrier(
    carrierId: number,
    snr: number,
    ber: number,
    interferenceLevel: number = 0
  ): boolean {
    const state = this.carriers.get(carrierId);
    if (!state) return false;

    // Check each condition
    const conditions = this.checkConditions(carrierId, snr, ber, interferenceLevel);

    // Determine new state
    const shouldBeEnabled = conditions.allPassed && !this.isInNotch(carrierId);

    // Update carrier state
    if (shouldBeEnabled && !state.enabled) {
      this.enableCarrier(carrierId, 'conditions-met');
    } else if (!shouldBeEnabled && state.enabled) {
      this.disableCarrier(carrierId, conditions.failureReason);
    }

    return shouldBeEnabled;
  }

  /**
   * Check all conditions for carrier
   */
  private checkConditions(
    carrierId: number,
    snr: number,
    ber: number,
    interferenceLevel: number
  ): { allPassed: boolean; failureReason: DisableReason | null } {
    const state = this.carriers.get(carrierId)!;

    // Priority check
    if (state.priority < this.policy.priorityThreshold) {
      return { allPassed: false, failureReason: 'power-constraint' };
    }

    // SNR check
    if (snr < this.policy.minSNR) {
      return { allPassed: false, failureReason: 'low-snr' };
    }

    // BER check
    if (ber > this.policy.maxBER) {
      return { allPassed: false, failureReason: 'low-snr' };
    }

    // Interference check
    if (interferenceLevel > this.policy.interferenceThreshold) {
      return { allPassed: false, failureReason: 'high-interference' };
    }

    // Notch filter check
    if (this.isInNotch(carrierId)) {
      return { allPassed: false, failureReason: 'frequency-notch' };
    }

    return { allPassed: true, failureReason: null };
  }

  /**
   * Enable carrier
   */
  private enableCarrier(carrierId: number, reason: string): void {
    const state = this.carriers.get(carrierId);
    if (!state) return;

    state.enabled = true;
    state.reason = null;
    delete state.disabledAt;
    delete state.autoRecoverAt;

    // Cancel any pending recovery
    const timeout = this.recoveryQueue.get(carrierId);
    if (timeout) {
      clearTimeout(timeout);
      this.recoveryQueue.delete(carrierId);
    }

    console.log(`Carrier ${carrierId} enabled: ${reason}`);
  }

  /**
   * Disable carrier
   */
  disableCarrier(carrierId: number, reason: DisableReason): void {
    const state = this.carriers.get(carrierId);
    if (!state) return;

    // Don't disable critical pilots
    if (state.priority === 1.0 && reason !== 'manual-disable') {
      return;
    }

    state.enabled = false;
    state.reason = reason;
    state.disabledAt = Date.now();

    // Schedule auto-recovery if enabled
    if (this.policy.autoRecovery && reason !== 'manual-disable') {
      state.autoRecoverAt = Date.now() + this.policy.recoveryDelayMs;
      this.scheduleRecovery(carrierId);
    }

    // Redistribute power
    this.redistributePower();

    console.log(`Carrier ${carrierId} disabled: ${reason}`);
  }

  /**
   * Schedule automatic recovery
   */
  private scheduleRecovery(carrierId: number): void {
    const timeout = setTimeout(() => {
      const state = this.carriers.get(carrierId);
      if (state && !state.enabled) {
        // Try to re-enable
        this.enableCarrier(carrierId, 'auto-recovery');
      }
      this.recoveryQueue.delete(carrierId);
    }, this.policy.recoveryDelayMs);

    this.recoveryQueue.set(carrierId, timeout);
  }

  /**
   * Report interference on carrier
   */
  reportInterference(report: InterferenceReport): void {
    this.interferenceMap.set(report.carrierId, report);

    // Evaluate if carrier should be disabled
    const state = this.carriers.get(report.carrierId);
    if (state && state.enabled) {
      if (report.level > this.policy.interferenceThreshold) {
        this.disableCarrier(report.carrierId, 'high-interference');
      }
    }
  }

  /**
   * Set notch filter at carrier frequency
   */
  setNotchFilter(carrierId: number, enable: boolean): void {
    if (enable) {
      this.notchFilters.add(carrierId);
      this.disableCarrier(carrierId, 'frequency-notch');
    } else {
      this.notchFilters.delete(carrierId);
      // Carrier will be re-enabled on next evaluation
    }
  }

  /**
   * Check if carrier is in notch filter band
   */
  private isInNotch(carrierId: number): boolean {
    return this.notchFilters.has(carrierId);
  }

  /**
   * Redistribute power among enabled carriers
   */
  private redistributePower(): void {
    const enabledCarriers = Array.from(this.carriers.values())
      .filter(c => c.enabled);

    if (enabledCarriers.length === 0) return;

    // Weight power by priority
    const totalPriority = enabledCarriers.reduce((sum, c) => sum + c.priority, 0);

    for (const carrier of enabledCarriers) {
      const powerShare = (carrier.priority / totalPriority) * this.policy.powerBudget;
      this.powerAllocation.set(carrier.id, powerShare);
    }
  }

  /**
   * Get power allocation for carrier
   */
  getPowerAllocation(carrierId: number): number {
    return this.powerAllocation.get(carrierId) || 0;
  }

  /**
   * Set carrier priority
   */
  setCarrierPriority(carrierId: number, priority: number): void {
    const state = this.carriers.get(carrierId);
    if (state) {
      state.priority = Math.max(0, Math.min(1, priority));
      this.redistributePower();
    }
  }

  /**
   * Manually control carrier
   */
  manualControl(carrierId: number, enable: boolean): void {
    if (enable) {
      this.enableCarrier(carrierId, 'manual-enable');
    } else {
      this.disableCarrier(carrierId, 'manual-disable');
    }
  }

  /**
   * Get carrier state
   */
  getCarrierState(carrierId: number): CarrierState | undefined {
    return this.carriers.get(carrierId);
  }

  /**
   * Get all carrier states
   */
  getAllCarrierStates(): CarrierState[] {
    return Array.from(this.carriers.values());
  }

  /**
   * Get enabled carriers
   */
  getEnabledCarriers(): number[] {
    return Array.from(this.carriers.entries())
      .filter(([_, state]) => state.enabled)
      .map(([id, _]) => id);
  }

  /**
   * Get disabled carriers by reason
   */
  getDisabledCarriers(reason?: DisableReason): Array<{ id: number; state: CarrierState }> {
    return Array.from(this.carriers.entries())
      .filter(([_, state]) => !state.enabled && (!reason || state.reason === reason))
      .map(([id, state]) => ({ id, state }));
  }

  /**
   * Get control statistics
   */
  getStatistics(): {
    totalCarriers: number;
    enabledCount: number;
    disabledCount: number;
    disabledByReason: Record<DisableReason, number>;
    averagePower: number;
    pendingRecoveries: number;
  } {
    const stats = {
      totalCarriers: this.carriers.size,
      enabledCount: 0,
      disabledCount: 0,
      disabledByReason: {
        'low-snr': 0,
        'high-interference': 0,
        'power-constraint': 0,
        'manual-disable': 0,
        'pilot-collision': 0,
        'frequency-notch': 0
      } as Record<DisableReason, number>,
      averagePower: 0,
      pendingRecoveries: this.recoveryQueue.size
    };

    let totalPower = 0;
    let enabledCarriers = 0;

    for (const state of this.carriers.values()) {
      if (state.enabled) {
        stats.enabledCount++;
        const power = this.powerAllocation.get(state.id) || 0;
        totalPower += power;
        enabledCarriers++;
      } else {
        stats.disabledCount++;
        if (state.reason) {
          stats.disabledByReason[state.reason]++;
        }
      }
    }

    stats.averagePower = enabledCarriers > 0 ? totalPower / enabledCarriers : 0;

    return stats;
  }

  /**
   * Update control policy
   */
  updatePolicy(updates: Partial<ControlPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    this.redistributePower();
  }

  /**
   * Reset controller
   */
  reset(): void {
    // Cancel all recovery timeouts
    for (const timeout of this.recoveryQueue.values()) {
      clearTimeout(timeout);
    }
    this.recoveryQueue.clear();

    // Reset all carriers to enabled
    for (const state of this.carriers.values()) {
      state.enabled = true;
      state.reason = null;
      delete state.disabledAt;
      delete state.autoRecoverAt;
    }

    this.interferenceMap.clear();
    this.notchFilters.clear();
    this.redistributePower();
  }
}

export { CarrierControl as default };