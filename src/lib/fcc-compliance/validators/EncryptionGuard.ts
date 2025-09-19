/**
 * Encryption Guard
 *
 * Implements FCC §97.113(a)(4) encryption restrictions by monitoring
 * and blocking encryption in RF transmission mode while allowing
 * digital signatures and encryption in WebRTC mode.
 */

import { EncryptionControlConfig, TransmissionMode } from '../types.js';

export interface EncryptionCheckResult {
  compliant: boolean;
  hasEncryption: boolean;
  encryptionType?: string;
  signaturesOnly: boolean;
  blocked: boolean;
  reason?: string;
}

export class EncryptionGuard {
  private config: EncryptionControlConfig;
  private currentMode: TransmissionMode = TransmissionMode.RF;
  private isEnabled = false;
  private eventListeners: Map<string, Function[]> = new Map();

  // Crypto function interceptors
  private originalSubtle: SubtleCrypto;
  private interceptedFunctions: Map<string, Function> = new Map();

  constructor(config: EncryptionControlConfig) {
    this.config = config;
    this.originalSubtle = crypto.subtle;
    this.setupCryptoInterception();
  }

  /**
   * Enable encryption monitoring and blocking
   */
  enable(): void {
    if (this.isEnabled) {
      return;
    }

    this.isEnabled = true;

    if (this.config.cryptoFunctionMonitoring) {
      this.installCryptoInterceptors();
    }
  }

  /**
   * Disable encryption monitoring
   */
  disable(): void {
    if (!this.isEnabled) {
      return;
    }

    this.isEnabled = false;
    this.restoreCryptoFunctions();
  }

  /**
   * Set current transmission mode
   */
  setTransmissionMode(mode: TransmissionMode): void {
    this.currentMode = mode;
  }

  /**
   * Check content for encryption before transmission
   */
  async checkContent(content: string | ArrayBuffer): Promise<EncryptionCheckResult> {
    const result: EncryptionCheckResult = {
      compliant: true,
      hasEncryption: false,
      signaturesOnly: false,
      blocked: false
    };

    // Only enforce in RF mode if configured
    if (this.currentMode !== TransmissionMode.RF || !this.config.rfModeBlocking) {
      return result;
    }

    // Analyze content for encryption markers
    const analysis = await this.analyzeContentForEncryption(content);

    result.hasEncryption = analysis.hasEncryption;
    result.encryptionType = analysis.encryptionType;
    result.signaturesOnly = analysis.signaturesOnly;

    // Check compliance
    if (analysis.hasEncryption) {
      if (analysis.signaturesOnly && this.config.signaturesAllowed) {
        // Digital signatures are allowed
        result.compliant = true;
      } else {
        // Encryption detected in RF mode - violation
        result.compliant = false;
        result.blocked = true;
        result.reason = 'Encryption detected in RF transmission mode (§97.113(a)(4))';

        this.emit('encryption-blocked', {
          mode: this.currentMode,
          encryptionType: analysis.encryptionType,
          timestamp: new Date()
        });
      }
    }

    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: EncryptionControlConfig): void {
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring if needed
    if (this.isEnabled) {
      this.disable();
      this.enable();
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): 'healthy' | 'warning' | 'error' {
    if (!this.isEnabled) {
      return 'warning'; // Should be enabled for compliance
    }

    // Check if crypto interception is working
    if (this.config.cryptoFunctionMonitoring && !this.isCryptoInterceptionActive()) {
      return 'error'; // Crypto monitoring failed
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
   * Analyze content for encryption signatures
   */
  private async analyzeContentForEncryption(content: string | ArrayBuffer): Promise<{
    hasEncryption: boolean;
    encryptionType?: string;
    signaturesOnly: boolean;
    confidence: number;
  }> {
    let hasEncryption = false;
    let encryptionType: string | undefined;
    let signaturesOnly = false;
    let confidence = 0;

    if (typeof content === 'string') {
      // Text content analysis
      const analysis = this.analyzeTextContent(content);
      hasEncryption = analysis.hasEncryption;
      encryptionType = analysis.encryptionType;
      signaturesOnly = analysis.signaturesOnly;
      confidence = analysis.confidence;
    } else {
      // Binary content analysis
      const analysis = this.analyzeBinaryContent(content);
      hasEncryption = analysis.hasEncryption;
      encryptionType = analysis.encryptionType;
      confidence = analysis.confidence;
    }

    return {
      hasEncryption,
      encryptionType,
      signaturesOnly,
      confidence
    };
  }

  /**
   * Analyze text content for encryption markers
   */
  private analyzeTextContent(content: string): {
    hasEncryption: boolean;
    encryptionType?: string;
    signaturesOnly: boolean;
    confidence: number;
  } {
    let hasEncryption = false;
    let encryptionType: string | undefined;
    let signaturesOnly = false;
    let confidence = 0;

    // Check for common encryption markers
    const encryptionMarkers = [
      { pattern: /-----BEGIN PGP MESSAGE-----/, type: 'PGP Encryption', isSignature: false, confidence: 0.95 },
      { pattern: /-----BEGIN PGP SIGNED MESSAGE-----/, type: 'PGP Signature', isSignature: true, confidence: 0.95 },
      { pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/, type: 'Encrypted Private Key', isSignature: false, confidence: 0.9 },
      { pattern: /-----BEGIN CERTIFICATE-----/, type: 'Certificate', isSignature: true, confidence: 0.8 },
      { pattern: /\bAES\b.*\bencrypt/i, type: 'AES Encryption', isSignature: false, confidence: 0.7 },
      { pattern: /\bRSA\b.*\bencrypt/i, type: 'RSA Encryption', isSignature: false, confidence: 0.7 },
      { pattern: /\bsignature\b/i, type: 'Digital Signature', isSignature: true, confidence: 0.6 },
      { pattern: /\bHMAC\b/i, type: 'HMAC', isSignature: true, confidence: 0.5 },
      { pattern: /^[A-Za-z0-9+/]{100,}={0,2}$/, type: 'Base64 (possible encryption)', isSignature: false, confidence: 0.3 }
    ];

    for (const marker of encryptionMarkers) {
      if (marker.pattern.test(content)) {
        hasEncryption = true;
        encryptionType = marker.type;
        signaturesOnly = marker.isSignature;
        confidence = Math.max(confidence, marker.confidence);

        // If we find clear encryption, stop looking
        if (!marker.isSignature && marker.confidence > 0.8) {
          break;
        }
      }
    }

    // Check for high entropy (possible encrypted data)
    if (!hasEncryption && content.length > 100) {
      const entropy = this.calculateEntropy(content);
      if (entropy > 7.5) { // High entropy suggests encryption
        hasEncryption = true;
        encryptionType = 'High entropy data (possible encryption)';
        confidence = Math.min(0.6, (entropy - 7.5) * 2);
      }
    }

    return {
      hasEncryption,
      encryptionType,
      signaturesOnly,
      confidence
    };
  }

  /**
   * Analyze binary content for encryption signatures
   */
  private analyzeBinaryContent(content: ArrayBuffer): {
    hasEncryption: boolean;
    encryptionType?: string;
    confidence: number;
  } {
    const view = new Uint8Array(content);
    let hasEncryption = false;
    let encryptionType: string | undefined;
    let confidence = 0;

    // Check file headers for encrypted formats
    const encryptedHeaders = [
      { signature: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP (possibly encrypted)', confidence: 0.3 },
      { signature: [0x1F, 0x8B], name: 'GZIP', confidence: 0.2 },
      { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], name: '7-Zip', confidence: 0.3 },
      { signature: [0x52, 0x61, 0x72, 0x21], name: 'RAR', confidence: 0.3 }
    ];

    for (const header of encryptedHeaders) {
      if (this.matchesSignature(view, header.signature)) {
        hasEncryption = true;
        encryptionType = header.name;
        confidence = header.confidence;
        break;
      }
    }

    // Check entropy for binary data
    if (!hasEncryption && view.length > 100) {
      const entropy = this.calculateBinaryEntropy(view);
      if (entropy > 7.8) { // Very high entropy suggests encryption
        hasEncryption = true;
        encryptionType = 'High entropy binary data (likely encrypted)';
        confidence = Math.min(0.8, (entropy - 7.8) * 5);
      }
    }

    return {
      hasEncryption,
      encryptionType,
      confidence
    };
  }

  /**
   * Calculate Shannon entropy of text
   */
  private calculateEntropy(text: string): number {
    const frequencies: { [char: string]: number } = {};

    // Count character frequencies
    for (const char of text) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    // Calculate entropy
    let entropy = 0;
    const length = text.length;

    for (const count of Object.values(frequencies)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Calculate entropy for binary data
   */
  private calculateBinaryEntropy(data: Uint8Array): number {
    const frequencies = new Array(256).fill(0);

    // Count byte frequencies
    for (const byte of data) {
      frequencies[byte]++;
    }

    // Calculate entropy
    let entropy = 0;
    const length = data.length;

    for (const count of frequencies) {
      if (count > 0) {
        const probability = count / length;
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  /**
   * Check if binary data matches a signature
   */
  private matchesSignature(data: Uint8Array, signature: number[]): boolean {
    if (data.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (data[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Setup crypto function interception
   */
  private setupCryptoInterception(): void {
    const self = this;

    // Intercept encrypt operations
    this.interceptedFunctions.set('encrypt', async function(algorithm: any, key: CryptoKey, data: BufferSource) {
      if (self.isEnabled && self.currentMode === TransmissionMode.RF && self.config.rfModeBlocking) {
        self.emit('crypto-function-called', {
          function: 'encrypt',
          algorithm: algorithm.name,
          mode: self.currentMode,
          blocked: true,
          timestamp: new Date()
        });

        throw new Error('Encryption blocked in RF transmission mode (FCC §97.113(a)(4))');
      }

      return self.originalSubtle.encrypt.call(self.originalSubtle, algorithm, key, data);
    });

    // Intercept sign operations (allow these)
    this.interceptedFunctions.set('sign', async function(algorithm: any, key: CryptoKey, data: BufferSource) {
      self.emit('crypto-function-called', {
        function: 'sign',
        algorithm: algorithm.name,
        mode: self.currentMode,
        blocked: false,
        timestamp: new Date()
      });

      return self.originalSubtle.sign.call(self.originalSubtle, algorithm, key, data);
    });
  }

  /**
   * Install crypto interceptors
   */
  private installCryptoInterceptors(): void {
    for (const [functionName, interceptor] of this.interceptedFunctions) {
      (crypto.subtle as any)[functionName] = interceptor;
    }
  }

  /**
   * Restore original crypto functions
   */
  private restoreCryptoFunctions(): void {
    crypto.subtle.encrypt = this.originalSubtle.encrypt;
    crypto.subtle.sign = this.originalSubtle.sign;
  }

  /**
   * Check if crypto interception is active
   */
  private isCryptoInterceptionActive(): boolean {
    return crypto.subtle.encrypt !== this.originalSubtle.encrypt;
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
          console.error(`Error in encryption guard event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Dispose of the encryption guard
   */
  dispose(): void {
    this.disable();
    this.eventListeners.clear();
  }
}

export default EncryptionGuard;