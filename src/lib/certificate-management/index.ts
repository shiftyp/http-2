/**
 * Certificate Management Library
 *
 * Complete amateur radio certificate management system supporting X.509 certificates
 * with amateur radio extensions, PKCS#12 LoTW certificates, and trust chain validation.
 *
 * @module CertificateManagement
 */

// Core types and interfaces
export * from './types.js';
export * from './db-schema.js';

// Core services
export { default as CertificateService } from './services/CertificateService.js';
export { default as PKCS12Parser } from './services/PKCS12Parser.js';
export { default as CAPTCHAGenerator } from './services/CAPTCHAGenerator.js';
export { default as TrustChainValidator } from './services/TrustChainValidator.js';
export { default as CertificateStore } from './services/CertificateStore.js';

// Export service types
export type {
  CertificateGenerationOptions,
  CertificateValidationResult
} from './services/CertificateService.js';

export type {
  PKCS12ParseResult,
  PKCS12ParseOptions
} from './services/PKCS12Parser.js';

export type {
  CAPTCHAGenerationOptions
} from './services/CAPTCHAGenerator.js';

export type {
  TrustValidationResult,
  TrustChainOptions
} from './services/TrustChainValidator.js';

export type {
  CertificateSearchOptions,
  RequestSearchOptions
} from './services/CertificateStore.js';

// Import services
import CertificateService from './services/CertificateService.js';
import CertificateStore from './services/CertificateStore.js';
import PKCS12Parser from './services/PKCS12Parser.js';
import CAPTCHAGenerator from './services/CAPTCHAGenerator.js';
import TrustChainValidator from './services/TrustChainValidator.js';

// Convenience class for unified certificate management
export class CertificateManager {
  public readonly service: CertificateService;
  public readonly store: CertificateStore;
  public readonly parser: PKCS12Parser;
  public readonly captcha: CAPTCHAGenerator;
  public readonly validator: TrustChainValidator;

  constructor() {
    this.service = new CertificateService();
    this.store = new CertificateStore();
    this.parser = new PKCS12Parser();
    this.captcha = new CAPTCHAGenerator();
    this.validator = new TrustChainValidator(this.service);
  }

  /**
   * Initialize the certificate management system
   */
  async initialize(): Promise<void> {
    // All services auto-initialize when needed
    console.log('Certificate management system initialized');
  }

  /**
   * Clean up all services
   */
  dispose(): void {
    this.service.dispose();
    this.store.dispose();
    this.validator.dispose();
  }
}

// Default export for convenience
export default CertificateManager;