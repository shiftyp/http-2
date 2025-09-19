/**
 * Encryption Guard
 *
 * Monitors and blocks content encryption based on transmission mode
 * to ensure FCC Part 97 compliance (§97.113).
 */

export interface EncryptionOperation {
  operation: 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'hash' | 'ecdh' | 'generateKey';
  algorithm?: string;
  keyId?: string;
  dataSize?: number;
  timestamp: number;
  stackTrace?: string;
}

export interface EncryptionViolation {
  operation: EncryptionOperation;
  blocked: boolean;
  regulation: string;
  reason: string;
  transmissionMode: 'RF' | 'WEBRTC' | 'HYBRID';
  severity: 'WARNING' | 'VIOLATION' | 'CRITICAL';
}

export interface EncryptionGuardConfig {
  blockInRfMode: boolean; // Default: true
  allowSignatures: boolean; // Default: true (authentication ≠ encryption)
  allowHashing: boolean; // Default: true
  logAllOperations: boolean; // Default: true
  strictMode: boolean; // Default: false (blocks everything in RF mode)
}

export class EncryptionGuard extends EventTarget {
  private config: EncryptionGuardConfig;
  private currentMode: 'RF' | 'WEBRTC' | 'HYBRID' = 'WEBRTC';
  private originalCrypto: any = null;
  private blockedOperations: EncryptionOperation[] = [];
  private violationCount: number = 0;
  private isHooked: boolean = false;

  // Define blocked and allowed operations
  private readonly BLOCKED_IN_RF = ['encrypt', 'decrypt', 'ecdh'];
  private readonly ALWAYS_ALLOWED = ['sign', 'verify', 'hash'];
  private readonly KEY_OPERATIONS = ['generateKey', 'importKey', 'exportKey'];

  constructor(config: Partial<EncryptionGuardConfig> = {}) {
    super();
    this.config = {
      blockInRfMode: true,
      allowSignatures: true,
      allowHashing: true,
      logAllOperations: true,
      strictMode: false,
      ...config
    };
  }

  /**
   * Initialize encryption guard and hook into Web Crypto API
   */
  initialize(): void {
    if (this.isHooked) {
      console.warn('Encryption guard already initialized');
      return;
    }

    this.hookWebCryptoAPI();
    this.isHooked = true;

    console.log('🔒 FCC Encryption Guard initialized');
    this.dispatchEvent(new CustomEvent('encryption-guard-initialized'));
  }

  /**
   * Update current transmission mode
   */
  setTransmissionMode(mode: 'RF' | 'WEBRTC' | 'HYBRID'): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;

    console.log(`📡 Transmission mode changed: ${previousMode} → ${mode}`);

    // Log mode change
    this.dispatchEvent(new CustomEvent('transmission-mode-changed', {
      detail: { previousMode, currentMode: mode, encryptionBlocking: this.isBlockingActive() }
    }));

    // Alert if entering RF mode with encryption blocking
    if (mode === 'RF' && this.config.blockInRfMode) {
      console.warn('⚠️ Entering RF mode - content encryption will be blocked per FCC regulations');
      this.dispatchEvent(new CustomEvent('encryption-blocking-active'));
    }
  }

  /**
   * Check if encryption blocking is currently active
   */
  isBlockingActive(): boolean {
    return this.config.blockInRfMode && this.currentMode === 'RF';
  }

  /**
   * Validate if a crypto operation is allowed
   */
  validateOperation(operation: EncryptionOperation): { allowed: boolean; violation?: EncryptionViolation } {
    const isBlocked = this.shouldBlockOperation(operation);

    if (isBlocked) {
      const violation: EncryptionViolation = {
        operation,
        blocked: true,
        regulation: '§97.113(a)(4)',
        reason: `Content encryption operation '${operation.operation}' forbidden on amateur radio`,
        transmissionMode: this.currentMode,
        severity: this.getSeverity(operation.operation)
      };

      this.violationCount++;
      this.blockedOperations.push(operation);

      // Log violation
      console.error(`🚨 FCC VIOLATION: ${violation.reason}`);
      this.dispatchEvent(new CustomEvent('encryption-violation', { detail: violation }));

      return { allowed: false, violation };
    }

    // Log allowed operation if configured
    if (this.config.logAllOperations) {
      console.log(`✅ Crypto operation allowed: ${operation.operation} (mode: ${this.currentMode})`);
      this.dispatchEvent(new CustomEvent('encryption-operation-allowed', { detail: operation }));
    }

    return { allowed: true };
  }

  private shouldBlockOperation(operation: EncryptionOperation): boolean {
    // Never block in WebRTC mode (unless strict mode is enabled)
    if (this.currentMode === 'WEBRTC' && !this.config.strictMode) {
      return false;
    }

    // In RF mode, apply blocking rules
    if (this.currentMode === 'RF' && this.config.blockInRfMode) {
      // Always block content encryption operations
      if (this.BLOCKED_IN_RF.includes(operation.operation)) {
        return true;
      }

      // Allow signatures if configured (authentication ≠ encryption)
      if (this.ALWAYS_ALLOWED.includes(operation.operation)) {
        if (operation.operation === 'sign' || operation.operation === 'verify') {
          return !this.config.allowSignatures;
        }
        if (operation.operation === 'hash') {
          return !this.config.allowHashing;
        }
      }

      // Block key generation in strict mode
      if (this.config.strictMode && this.KEY_OPERATIONS.includes(operation.operation)) {
        return true;
      }
    }

    return false;
  }

  private getSeverity(operation: string): 'WARNING' | 'VIOLATION' | 'CRITICAL' {
    if (this.BLOCKED_IN_RF.includes(operation)) {
      return 'CRITICAL'; // Content encryption is always critical
    }
    if (this.KEY_OPERATIONS.includes(operation)) {
      return 'VIOLATION'; // Key operations are violations
    }
    return 'WARNING'; // Other operations are warnings
  }

  /**
   * Hook into Web Crypto API to intercept operations
   */
  private hookWebCryptoAPI(): void {
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('Web Crypto API not available - encryption guard cannot function');
      return;
    }

    // Store original crypto methods
    this.originalCrypto = {
      encrypt: window.crypto.subtle.encrypt.bind(window.crypto.subtle),
      decrypt: window.crypto.subtle.decrypt.bind(window.crypto.subtle),
      sign: window.crypto.subtle.sign.bind(window.crypto.subtle),
      verify: window.crypto.subtle.verify.bind(window.crypto.subtle),
      digest: window.crypto.subtle.digest.bind(window.crypto.subtle),
      generateKey: window.crypto.subtle.generateKey.bind(window.crypto.subtle),
      deriveKey: window.crypto.subtle.deriveKey.bind(window.crypto.subtle),
      deriveBits: window.crypto.subtle.deriveBits.bind(window.crypto.subtle)
    };

    // Hook encrypt operation
    window.crypto.subtle.encrypt = (algorithm: any, key: any, data: any) => {
      const operation: EncryptionOperation = {
        operation: 'encrypt',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        dataSize: data.byteLength,
        timestamp: Date.now(),
        stackTrace: this.config.logAllOperations ? new Error().stack : undefined
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Content encryption forbidden on amateur radio (§97.113)`);
      }

      return this.originalCrypto.encrypt(algorithm, key, data);
    };

    // Hook decrypt operation
    window.crypto.subtle.decrypt = (algorithm: any, key: any, data: any) => {
      const operation: EncryptionOperation = {
        operation: 'decrypt',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        dataSize: data.byteLength,
        timestamp: Date.now(),
        stackTrace: this.config.logAllOperations ? new Error().stack : undefined
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Content decryption forbidden on amateur radio (§97.113)`);
      }

      return this.originalCrypto.decrypt(algorithm, key, data);
    };

    // Hook sign operation (usually allowed)
    window.crypto.subtle.sign = (algorithm: any, key: any, data: any) => {
      const operation: EncryptionOperation = {
        operation: 'sign',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        dataSize: data.byteLength,
        timestamp: Date.now()
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Digital signing blocked in strict mode`);
      }

      return this.originalCrypto.sign(algorithm, key, data);
    };

    // Hook verify operation (usually allowed)
    window.crypto.subtle.verify = (algorithm: any, key: any, signature: any, data: any) => {
      const operation: EncryptionOperation = {
        operation: 'verify',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        dataSize: data.byteLength,
        timestamp: Date.now()
      };

      this.validateOperation(operation); // Log but don't block verification
      return this.originalCrypto.verify(algorithm, key, signature, data);
    };

    // Hook digest operation (usually allowed)
    window.crypto.subtle.digest = (algorithm: any, data: any) => {
      const operation: EncryptionOperation = {
        operation: 'hash',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        dataSize: data.byteLength,
        timestamp: Date.now()
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Hashing blocked in strict mode`);
      }

      return this.originalCrypto.digest(algorithm, data);
    };

    // Hook key generation
    window.crypto.subtle.generateKey = (algorithm: any, extractable: boolean, keyUsages: any[]) => {
      const operation: EncryptionOperation = {
        operation: 'generateKey',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        timestamp: Date.now()
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Key generation blocked in RF mode`);
      }

      return this.originalCrypto.generateKey(algorithm, extractable, keyUsages);
    };

    // Hook ECDH (key derivation - definitely blocked in RF)
    window.crypto.subtle.deriveKey = (algorithm: any, baseKey: any, derivedKeyType: any, extractable: boolean, keyUsages: any[]) => {
      const operation: EncryptionOperation = {
        operation: 'ecdh',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        timestamp: Date.now()
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Key derivation (ECDH) forbidden on amateur radio (§97.113)`);
      }

      return this.originalCrypto.deriveKey(algorithm, baseKey, derivedKeyType, extractable, keyUsages);
    };

    window.crypto.subtle.deriveBits = (algorithm: any, baseKey: any, length: number) => {
      const operation: EncryptionOperation = {
        operation: 'ecdh',
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        timestamp: Date.now()
      };

      const validation = this.validateOperation(operation);
      if (!validation.allowed) {
        throw new Error(`FCC VIOLATION: Bit derivation (ECDH) forbidden on amateur radio (§97.113)`);
      }

      return this.originalCrypto.deriveBits(algorithm, baseKey, length);
    };
  }

  /**
   * Restore original Web Crypto API methods
   */
  unhook(): void {
    if (!this.isHooked || !this.originalCrypto) {
      return;
    }

    // Restore original methods
    window.crypto.subtle.encrypt = this.originalCrypto.encrypt;
    window.crypto.subtle.decrypt = this.originalCrypto.decrypt;
    window.crypto.subtle.sign = this.originalCrypto.sign;
    window.crypto.subtle.verify = this.originalCrypto.verify;
    window.crypto.subtle.digest = this.originalCrypto.digest;
    window.crypto.subtle.generateKey = this.originalCrypto.generateKey;
    window.crypto.subtle.deriveKey = this.originalCrypto.deriveKey;
    window.crypto.subtle.deriveBits = this.originalCrypto.deriveBits;

    this.isHooked = false;
    this.originalCrypto = null;

    console.log('🔓 Encryption guard unhooked');
    this.dispatchEvent(new CustomEvent('encryption-guard-unhooked'));
  }

  /**
   * Get current encryption guard status
   */
  getStatus(): {
    active: boolean;
    blocking: boolean;
    transmissionMode: string;
    violationCount: number;
    blockedOperations: number;
    config: EncryptionGuardConfig;
  } {
    return {
      active: this.isHooked,
      blocking: this.isBlockingActive(),
      transmissionMode: this.currentMode,
      violationCount: this.violationCount,
      blockedOperations: this.blockedOperations.length,
      config: { ...this.config }
    };
  }

  /**
   * Get list of blocked operations
   */
  getBlockedOperations(): EncryptionOperation[] {
    return [...this.blockedOperations];
  }

  /**
   * Clear violation history
   */
  clearViolationHistory(): void {
    this.blockedOperations = [];
    this.violationCount = 0;

    this.dispatchEvent(new CustomEvent('violations-cleared'));
  }

  /**
   * Test encryption blocking (for development/testing)
   */
  async testEncryptionBlocking(): Promise<{
    encryptBlocked: boolean;
    signAllowed: boolean;
    hashAllowed: boolean;
  }> {
    const results = {
      encryptBlocked: false,
      signAllowed: false,
      hashAllowed: false
    };

    // Test encryption (should be blocked in RF mode)
    try {
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        key,
        new TextEncoder().encode('test')
      );
    } catch (error) {
      results.encryptBlocked = error.message.includes('FCC VIOLATION');
    }

    // Test signing (should be allowed)
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify']
      );
      await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        new TextEncoder().encode('test')
      );
      results.signAllowed = true;
    } catch (error) {
      results.signAllowed = false;
    }

    // Test hashing (should be allowed)
    try {
      await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode('test'));
      results.hashAllowed = true;
    } catch (error) {
      results.hashAllowed = false;
    }

    return results;
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.unhook();
    this.blockedOperations = [];
    this.violationCount = 0;
  }
}

export { EncryptionGuard as default };