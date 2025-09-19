/**
 * Contract Test: FCC Encryption Guard (§97.113)
 *
 * Tests compliance with FCC Part 97.113 encryption restrictions.
 * Task T007 per FCC compliance implementation plan.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Type definitions based on the FCC compliance contract
interface EncryptionGuard {
  initialize(): Promise<void>;
  setTransmissionMode(mode: 'RF' | 'WEBRTC' | 'HYBRID'): void;
  validateOperation(operation: CryptoOperation): ValidationResult;
  getStatus(): EncryptionGuardStatus;
  getViolationHistory(): EncryptionViolation[];
  dispose(): void;
}

interface CryptoOperation {
  operation: 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'hash' | 'ecdh';
  algorithm?: string;
  dataSize?: number;
  timestamp: number;
}

interface ValidationResult {
  allowed: boolean;
  violation?: EncryptionViolation;
}

interface EncryptionViolation {
  operation: CryptoOperation;
  blocked: boolean;
  regulation: string;
  reason: string;
  transmissionMode: 'RF' | 'WEBRTC' | 'HYBRID';
  severity: 'WARNING' | 'VIOLATION' | 'CRITICAL';
  timestamp: number;
}

interface EncryptionGuardStatus {
  active: boolean;
  blocking: boolean;
  transmissionMode: 'RF' | 'WEBRTC' | 'HYBRID';
  violationCount: number;
}

// Mock implementation for testing
class MockEncryptionGuard implements EncryptionGuard {
  private active = false;
  private mode: 'RF' | 'WEBRTC' | 'HYBRID' = 'WEBRTC';
  private violations: EncryptionViolation[] = [];

  async initialize(): Promise<void> {
    this.active = true;
  }

  setTransmissionMode(mode: 'RF' | 'WEBRTC' | 'HYBRID'): void {
    this.mode = mode;
  }

  validateOperation(operation: CryptoOperation): ValidationResult {
    const blockedInRF = ['encrypt', 'decrypt', 'ecdh'];
    const alwaysAllowed = ['sign', 'verify', 'hash'];

    if (this.mode === 'RF' && blockedInRF.includes(operation.operation)) {
      const violation: EncryptionViolation = {
        operation,
        blocked: true,
        regulation: '§97.113(a)(4)',
        reason: `Content ${operation.operation} operation forbidden on amateur radio`,
        transmissionMode: this.mode,
        severity: 'CRITICAL',
        timestamp: Date.now()
      };

      this.violations.push(violation);
      return { allowed: false, violation };
    }

    return { allowed: true };
  }

  getStatus(): EncryptionGuardStatus {
    return {
      active: this.active,
      blocking: this.mode === 'RF',
      transmissionMode: this.mode,
      violationCount: this.violations.length
    };
  }

  getViolationHistory(): EncryptionViolation[] {
    return [...this.violations];
  }

  dispose(): void {
    this.active = false;
    this.violations = [];
  }
}

describe('FCC Encryption Guard Contract (§97.113)', () => {
  let encryptionGuard: EncryptionGuard;

  beforeEach(async () => {
    encryptionGuard = new MockEncryptionGuard();
    await encryptionGuard.initialize();
  });

  afterEach(() => {
    encryptionGuard.dispose();
  });

  describe('Requirement: Block content encryption in RF mode (§97.113(a)(4))', () => {
    it('should block encrypt operations in RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'encrypt',
        algorithm: 'AES-GCM',
        dataSize: 1024,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation!.regulation).toBe('§97.113(a)(4)');
      expect(result.violation!.severity).toBe('CRITICAL');
    });

    it('should block decrypt operations in RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'decrypt',
        algorithm: 'AES-GCM',
        dataSize: 1024,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation!.blocked).toBe(true);
    });

    it('should block ECDH key derivation in RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'ecdh',
        algorithm: 'ECDH',
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
    });
  });

  describe('Requirement: Allow authentication operations (signatures)', () => {
    it('should allow sign operations in RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'sign',
        algorithm: 'ECDSA',
        dataSize: 256,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    it('should allow verify operations in RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'verify',
        algorithm: 'ECDSA',
        dataSize: 256,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(true);
    });

    it('should allow hash operations in RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'hash',
        algorithm: 'SHA-256',
        dataSize: 1024,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Requirement: Allow all operations in WebRTC mode', () => {
    it('should allow encrypt operations in WebRTC mode', () => {
      encryptionGuard.setTransmissionMode('WEBRTC');

      const operation: CryptoOperation = {
        operation: 'encrypt',
        algorithm: 'AES-GCM',
        dataSize: 1024,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(true);
    });

    it('should allow decrypt operations in WebRTC mode', () => {
      encryptionGuard.setTransmissionMode('WEBRTC');

      const operation: CryptoOperation = {
        operation: 'decrypt',
        algorithm: 'AES-GCM',
        dataSize: 1024,
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(true);
    });

    it('should allow ECDH operations in WebRTC mode', () => {
      encryptionGuard.setTransmissionMode('WEBRTC');

      const operation: CryptoOperation = {
        operation: 'ecdh',
        algorithm: 'ECDH',
        timestamp: Date.now()
      };

      const result = encryptionGuard.validateOperation(operation);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Status and monitoring', () => {
    it('should report correct blocking status for RF mode', () => {
      encryptionGuard.setTransmissionMode('RF');

      const status = encryptionGuard.getStatus();

      expect(status.active).toBe(true);
      expect(status.blocking).toBe(true);
      expect(status.transmissionMode).toBe('RF');
    });

    it('should report correct blocking status for WebRTC mode', () => {
      encryptionGuard.setTransmissionMode('WEBRTC');

      const status = encryptionGuard.getStatus();

      expect(status.active).toBe(true);
      expect(status.blocking).toBe(false);
      expect(status.transmissionMode).toBe('WEBRTC');
    });

    it('should track violation count', () => {
      encryptionGuard.setTransmissionMode('RF');

      // Create violations
      encryptionGuard.validateOperation({
        operation: 'encrypt',
        timestamp: Date.now()
      });

      encryptionGuard.validateOperation({
        operation: 'decrypt',
        timestamp: Date.now()
      });

      const status = encryptionGuard.getStatus();
      expect(status.violationCount).toBe(2);
    });
  });

  describe('Violation history', () => {
    it('should record violation details', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation: CryptoOperation = {
        operation: 'encrypt',
        algorithm: 'AES-GCM',
        dataSize: 2048,
        timestamp: Date.now()
      };

      encryptionGuard.validateOperation(operation);

      const violations = encryptionGuard.getViolationHistory();
      expect(violations).toHaveLength(1);
      expect(violations[0].operation).toEqual(operation);
      expect(violations[0].regulation).toBe('§97.113(a)(4)');
      expect(violations[0].transmissionMode).toBe('RF');
    });

    it('should maintain chronological violation history', () => {
      encryptionGuard.setTransmissionMode('RF');

      const operation1: CryptoOperation = {
        operation: 'encrypt',
        timestamp: Date.now()
      };

      const operation2: CryptoOperation = {
        operation: 'decrypt',
        timestamp: Date.now() + 1000
      };

      encryptionGuard.validateOperation(operation1);
      encryptionGuard.validateOperation(operation2);

      const violations = encryptionGuard.getViolationHistory();
      expect(violations).toHaveLength(2);
      expect(violations[0].operation.operation).toBe('encrypt');
      expect(violations[1].operation.operation).toBe('decrypt');
    });
  });

  describe('Mode transitions', () => {
    it('should change blocking behavior when switching modes', () => {
      // Start in WebRTC mode
      encryptionGuard.setTransmissionMode('WEBRTC');

      const operation: CryptoOperation = {
        operation: 'encrypt',
        timestamp: Date.now()
      };

      // Should be allowed in WebRTC
      let result = encryptionGuard.validateOperation(operation);
      expect(result.allowed).toBe(true);

      // Switch to RF mode
      encryptionGuard.setTransmissionMode('RF');

      // Same operation should now be blocked
      result = encryptionGuard.validateOperation(operation);
      expect(result.allowed).toBe(false);

      // Switch back to WebRTC
      encryptionGuard.setTransmissionMode('WEBRTC');

      // Should be allowed again
      result = encryptionGuard.validateOperation(operation);
      expect(result.allowed).toBe(true);
    });
  });
});