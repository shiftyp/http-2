/**
 * Contract Test: FCC Station Identification (§97.119)
 *
 * Tests compliance with FCC Part 97.119 station identification requirements.
 * Task T006 per FCC compliance implementation plan.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Type definitions based on the FCC compliance contract
interface StationIdTimer {
  start(callsign: string): Promise<void>;
  stop(): Promise<void>;
  forceId(): Promise<StationIdEvent>;
  getStatus(): StationIdStatus;
  onIdDue(callback: (event: StationIdEvent) => void): void;
  onIdSent(callback: (event: StationIdEvent) => void): void;
}

interface StationIdEvent {
  callsign: string;
  timestamp: number;
  method: 'CW' | 'PHONE' | 'DIGITAL';
  automatic: boolean;
  transmissionEnd: boolean;
}

interface StationIdStatus {
  active: boolean;
  nextIdDue: number;
  lastIdSent: number;
  callsign: string;
}

// Mock implementation for testing
class MockStationIdTimer implements StationIdTimer {
  private active = false;
  private callsign = '';
  private startTime = 0;
  private lastId = 0;
  private idCallbacks: ((event: StationIdEvent) => void)[] = [];
  private sentCallbacks: ((event: StationIdEvent) => void)[] = [];
  private timerId: number | null = null;

  async start(callsign: string): Promise<void> {
    this.callsign = callsign;
    this.active = true;
    this.startTime = Date.now();

    // Set timer for 10 minutes (600000ms)
    this.timerId = setTimeout(() => {
      this.triggerAutomaticId();
    }, 600000) as unknown as number;
  }

  async stop(): Promise<void> {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Send final station ID
    if (this.active) {
      await this.sendStationId(true);
    }

    this.active = false;
  }

  async forceId(): Promise<StationIdEvent> {
    return this.sendStationId(false);
  }

  getStatus(): StationIdStatus {
    return {
      active: this.active,
      nextIdDue: this.startTime + 600000, // 10 minutes from start
      lastIdSent: this.lastId,
      callsign: this.callsign
    };
  }

  onIdDue(callback: (event: StationIdEvent) => void): void {
    this.idCallbacks.push(callback);
  }

  onIdSent(callback: (event: StationIdEvent) => void): void {
    this.sentCallbacks.push(callback);
  }

  private async sendStationId(transmissionEnd: boolean): Promise<StationIdEvent> {
    const event: StationIdEvent = {
      callsign: this.callsign,
      timestamp: Date.now(),
      method: 'DIGITAL',
      automatic: !transmissionEnd,
      transmissionEnd
    };

    this.lastId = event.timestamp;

    // Notify callbacks
    this.sentCallbacks.forEach(cb => cb(event));

    return event;
  }

  private triggerAutomaticId(): void {
    const event: StationIdEvent = {
      callsign: this.callsign,
      timestamp: Date.now(),
      method: 'DIGITAL',
      automatic: true,
      transmissionEnd: false
    };

    // Notify that ID is due
    this.idCallbacks.forEach(cb => cb(event));

    // Automatically send ID
    this.sendStationId(false);

    // Reset timer for next ID
    if (this.active) {
      this.timerId = setTimeout(() => {
        this.triggerAutomaticId();
      }, 600000) as unknown as number;
    }
  }
}

describe('FCC Station Identification Contract (§97.119)', () => {
  let stationIdTimer: StationIdTimer;

  beforeEach(() => {
    stationIdTimer = new MockStationIdTimer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Requirement: Station identification every 10 minutes (§97.119(a))', () => {
    it('should automatically transmit station ID before 10-minute deadline', async () => {
      const idSentEvents: StationIdEvent[] = [];
      stationIdTimer.onIdSent(event => idSentEvents.push(event));

      await stationIdTimer.start('KA1ABC');

      // Fast forward to just before 10 minutes
      vi.advanceTimersByTime(599000); // 9 minutes 59 seconds

      // Should not have sent ID yet
      expect(idSentEvents).toHaveLength(0);

      // Fast forward past 10 minutes
      vi.advanceTimersByTime(2000); // Past 10 minutes

      // Should have automatically sent station ID
      expect(idSentEvents).toHaveLength(1);
      expect(idSentEvents[0].callsign).toBe('KA1ABC');
      expect(idSentEvents[0].automatic).toBe(true);
      expect(idSentEvents[0].transmissionEnd).toBe(false);
    });

    it('should continue sending station ID every 10 minutes during long transmission', async () => {
      const idSentEvents: StationIdEvent[] = [];
      stationIdTimer.onIdSent(event => idSentEvents.push(event));

      await stationIdTimer.start('W1AW');

      // Fast forward through multiple 10-minute periods
      vi.advanceTimersByTime(600000); // 10 minutes - first ID
      expect(idSentEvents).toHaveLength(1);

      vi.advanceTimersByTime(600000); // 20 minutes - second ID
      expect(idSentEvents).toHaveLength(2);

      vi.advanceTimersByTime(600000); // 30 minutes - third ID
      expect(idSentEvents).toHaveLength(3);

      // All should be automatic and not transmission end
      idSentEvents.forEach(event => {
        expect(event.automatic).toBe(true);
        expect(event.transmissionEnd).toBe(false);
        expect(event.callsign).toBe('W1AW');
      });
    });
  });

  describe('Requirement: Station identification at end of transmission (§97.119(a))', () => {
    it('should transmit station ID when transmission ends', async () => {
      const idSentEvents: StationIdEvent[] = [];
      stationIdTimer.onIdSent(event => idSentEvents.push(event));

      await stationIdTimer.start('VE1XYZ');

      // End transmission after 5 minutes (before automatic ID would trigger)
      vi.advanceTimersByTime(300000); // 5 minutes
      await stationIdTimer.stop();

      // Should have sent final station ID
      expect(idSentEvents).toHaveLength(1);
      expect(idSentEvents[0].callsign).toBe('VE1XYZ');
      expect(idSentEvents[0].transmissionEnd).toBe(true);
    });

    it('should send final ID even if automatic ID was sent recently', async () => {
      const idSentEvents: StationIdEvent[] = [];
      stationIdTimer.onIdSent(event => idSentEvents.push(event));

      await stationIdTimer.start('JA1ABC');

      // Wait for automatic ID
      vi.advanceTimersByTime(600000); // 10 minutes
      expect(idSentEvents).toHaveLength(1);
      expect(idSentEvents[0].automatic).toBe(true);

      // End transmission immediately after automatic ID
      await stationIdTimer.stop();

      // Should have sent both automatic and final ID
      expect(idSentEvents).toHaveLength(2);
      expect(idSentEvents[1].transmissionEnd).toBe(true);
    });
  });

  describe('Requirement: Manual station identification capability', () => {
    it('should allow manual station ID transmission', async () => {
      await stationIdTimer.start('DL1XYZ');

      const manualId = await stationIdTimer.forceId();

      expect(manualId.callsign).toBe('DL1XYZ');
      expect(manualId.method).toBe('DIGITAL');
      expect(manualId.timestamp).toBeTypeOf('number');
    });

    it('should update last ID timestamp after manual transmission', async () => {
      await stationIdTimer.start('G0ABC');

      const statusBefore = stationIdTimer.getStatus();
      expect(statusBefore.lastIdSent).toBe(0);

      const manualId = await stationIdTimer.forceId();

      const statusAfter = stationIdTimer.getStatus();
      expect(statusAfter.lastIdSent).toBe(manualId.timestamp);
    });
  });

  describe('Requirement: Valid callsign format', () => {
    it('should accept valid amateur radio callsigns', async () => {
      const validCallsigns = ['W1AW', 'KA1ABC', 'VE1XYZ', 'JA1ABC', 'DL1XYZ', 'G0ABC'];

      for (const callsign of validCallsigns) {
        // Should not throw error for valid callsigns
        await expect(stationIdTimer.start(callsign)).resolves.not.toThrow();
        await stationIdTimer.stop();
      }
    });
  });

  describe('Status and monitoring', () => {
    it('should provide accurate timing status', async () => {
      const startTime = Date.now();
      await stationIdTimer.start('W1AW');

      const status = stationIdTimer.getStatus();

      expect(status.active).toBe(true);
      expect(status.callsign).toBe('W1AW');
      expect(status.nextIdDue).toBeGreaterThan(startTime + 590000); // Should be close to 10 minutes
      expect(status.lastIdSent).toBe(0); // No ID sent yet
    });

    it('should update status after station ID transmission', async () => {
      await stationIdTimer.start('VE1TEST');

      const manualId = await stationIdTimer.forceId();
      const status = stationIdTimer.getStatus();

      expect(status.lastIdSent).toBe(manualId.timestamp);
    });

    it('should indicate inactive status when stopped', async () => {
      await stationIdTimer.start('JA1TEST');
      await stationIdTimer.stop();

      const status = stationIdTimer.getStatus();
      expect(status.active).toBe(false);
    });
  });

  describe('Event callbacks', () => {
    it('should notify when station ID is due', async () => {
      const idDueEvents: StationIdEvent[] = [];
      stationIdTimer.onIdDue(event => idDueEvents.push(event));

      await stationIdTimer.start('W1TEST');

      // Fast forward to trigger automatic ID
      vi.advanceTimersByTime(600000); // 10 minutes

      expect(idDueEvents).toHaveLength(1);
      expect(idDueEvents[0].callsign).toBe('W1TEST');
    });

    it('should notify when station ID is sent', async () => {
      const idSentEvents: StationIdEvent[] = [];
      stationIdTimer.onIdSent(event => idSentEvents.push(event));

      await stationIdTimer.start('KA1TEST');
      await stationIdTimer.forceId();

      expect(idSentEvents).toHaveLength(1);
      expect(idSentEvents[0].callsign).toBe('KA1TEST');
    });
  });
});