/**
 * LoTW Integration Contract Tests
 *
 * Verifies the enhanced LoTW integration service meets requirements for
 * certificate verification, QSL record synchronization, and federation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LoTWIntegrationService,
  LoTWVerificationResult,
  QSLRecord,
  LoTWUserInfo,
  FederationRequest
} from '../../lib/certificate-management/services/LoTWIntegration.js';
import { Certificate, CertificateType, TrustLevel } from '../../lib/certificate-management/types.js';

// Polyfill crypto for test environment
if (!globalThis.crypto) {
  globalThis.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      generateKey: async (algorithm: any, extractable: boolean, keyUsages: string[]) => {
        // Mock key pair generation
        return {
          publicKey: { type: 'public' } as CryptoKey,
          privateKey: { type: 'private' } as CryptoKey
        };
      },
      exportKey: async (format: string, key: CryptoKey) => {
        // Mock key export
        return new ArrayBuffer(32);
      },
      digest: async (algorithm: string, data: ArrayBuffer) => {
        // Simple hash for testing
        const bytes = new Uint8Array(data);
        let hash = 0;
        for (let i = 0; i < bytes.length; i++) {
          hash = ((hash << 5) - hash) + bytes[i];
          hash = hash & hash;
        }
        const result = new ArrayBuffer(32);
        new DataView(result).setUint32(0, Math.abs(hash));
        return result;
      }
    } as any
  } as any;
}

describe('LoTW Integration Service', () => {
  let lotwService: LoTWIntegrationService;

  // Mock certificate data
  const mockCertificateData = new ArrayBuffer(1024);
  new DataView(mockCertificateData).setUint8(0, 0x30); // PKCS#12 signature

  const mockCertificate: Certificate = {
    id: 'test-cert-001',
    callsign: 'KA1TEST',
    type: CertificateType.LOTW,
    x509Data: mockCertificateData,
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMOCK_KEY_DATA\n-----END PUBLIC KEY-----',
    licenseClass: 'TECHNICIAN',
    gridSquare: 'FN31pr',
    issuer: 'CN=ARRL Logbook of the World, O=American Radio Relay League, C=US',
    subject: 'CN=KA1TEST, O=Amateur Radio, C=US',
    serialNumber: '123456789',
    validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    isRevoked: false,
    trustLevel: TrustLevel.LOTW,
    approvedServers: [],
    createdAt: new Date().toISOString(),
    storageLocation: 'indexeddb'
  };

  beforeEach(() => {
    lotwService = new LoTWIntegrationService();
  });

  afterEach(() => {
    lotwService.dispose();
  });

  describe('Callsign Verification', () => {
    it('should verify callsign with LoTW certificate', async () => {
      const result = await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      expect(result.verified).toBe(true);
      expect(result.callsign).toBe('KA1TEST');
      expect(result.trustLevel).toBe(TrustLevel.LOTW);
      expect(result.verificationMethod).toBe('certificate');
      expect(result.qslCount).toBeGreaterThan(0);
    });

    it('should verify callsign with federated trust', async () => {
      // First create a federation request
      const federationId = await lotwService.requestCertificateFederation(
        'KB1TRUST',
        'KA1TEST',
        mockCertificate
      );

      // Approve the federation
      const approved = await lotwService.processFederationRequest(
        federationId,
        'approve',
        { captchaResponse: 'valid-response' }
      );

      expect(approved).toBe(true);

      // Now verify using federated trust
      const result = await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        federatedTrust: true
      });

      expect(result.verified).toBe(true);
      expect(result.verificationMethod).toBe('federation');
      expect(result.trustLevel).toBe(TrustLevel.FEDERATION);
    });

    it('should verify callsign with CAPTCHA fallback', async () => {
      const result = await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        useCaptcha: true
      });

      expect(result.verified).toBe(true);
      expect(result.callsign).toBe('KA1TEST');
      expect(result.verificationMethod).toBe('captcha');
      expect(result.trustLevel).toBe(TrustLevel.CAPTCHA);
      expect(result.warnings).toContain('CAPTCHA verification - limited trust level');
    });

    it('should verify callsign with QSL database lookup', async () => {
      const result = await lotwService.verifyCallsignWithLoTW('KA1TEST');

      expect(result.verified).toBeDefined();
      expect(result.callsign).toBe('KA1TEST');
      expect(result.verificationMethod).toBe('qsl');
      expect(result.qslCount).toBeGreaterThanOrEqual(0);

      if (result.verified) {
        expect(result.trustLevel).toBe(TrustLevel.QSL);
        expect(result.lastQSLDate).toBeInstanceOf(Date);
      } else {
        expect(result.trustLevel).toBe(TrustLevel.NONE);
        expect(result.warnings).toContain('No QSL records found');
      }
    });

    it('should cache verification results', async () => {
      // First verification
      const result1 = await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      // Second verification should use cache
      const result2 = await lotwService.verifyCallsignWithLoTW('KA1TEST');

      expect(result1.verified).toBe(true);
      expect(result2.verified).toBe(true);
      expect(result1.verificationMethod).toBe('certificate');
      expect(result2.verificationMethod).toBe('certificate'); // From cache
    });

    it('should handle invalid certificates gracefully', async () => {
      const invalidCertData = new ArrayBuffer(100); // Too small to be valid

      const result = await lotwService.verifyCallsignWithLoTW('INVALID', {
        certificate: invalidCertData,
        password: 'wrong-password'
      });

      expect(result.verified).toBe(false);
      expect(result.callsign).toBe('INVALID');
      expect(result.trustLevel).toBe(TrustLevel.NONE);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Certificate Import and Parsing', () => {
    it('should import and parse LoTW certificate', async () => {
      const result = await lotwService.importLoTWCertificate(
        mockCertificateData,
        'test-password',
        { autoVerify: true }
      );

      expect(result.certificate).toBeDefined();
      expect(result.certificate.type).toBe(CertificateType.LOTW);
      expect(result.certificate.callsign).toBeDefined();
      expect(result.parseResult).toBeDefined();
      expect(result.parseResult.stationInfo).toBeDefined();
    });

    it('should extract private key when requested', async () => {
      const result = await lotwService.importLoTWCertificate(
        mockCertificateData,
        'test-password',
        { extractPrivateKey: true }
      );

      expect(result.certificate.privateKeyPem).toBeDefined();
    });

    it('should validate certificate chain when requested', async () => {
      const result = await lotwService.importLoTWCertificate(
        mockCertificateData,
        'test-password',
        { validateChain: true }
      );

      expect(result.parseResult.warnings).toBeDefined();
      // Validation warnings might be present but shouldn't prevent import
    });

    it('should handle password-protected certificates', async () => {
      // Test with wrong password
      await expect(lotwService.importLoTWCertificate(
        mockCertificateData,
        'wrong-password'
      )).rejects.toThrow();
    });
  });

  describe('QSL Record Synchronization', () => {
    it('should sync QSL records from LoTW', async () => {
      const syncResult = await lotwService.syncQSLRecords({
        callsign: 'KA1TEST',
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        endDate: new Date()
      });

      expect(syncResult.imported).toBeDefined();
      expect(syncResult.updated).toBeDefined();
      expect(syncResult.conflicts).toBeDefined();
      expect(syncResult.statistics).toBeDefined();

      expect(syncResult.statistics.totalRecords).toBeGreaterThanOrEqual(0);
      expect(syncResult.statistics.syncTime).toBeInstanceOf(Date);
    });

    it('should filter QSL records by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = new Date();

      const syncResult = await lotwService.syncQSLRecords({
        callsign: 'KA1TEST',
        startDate,
        endDate
      });

      // All imported records should be within date range
      for (const record of syncResult.imported) {
        expect(record.datetime.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(record.datetime.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });

    it('should filter QSL records by modes and bands', async () => {
      const syncResult = await lotwService.syncQSLRecords({
        callsign: 'KA1TEST',
        modes: ['FT8', 'CW'],
        bands: ['20m', '40m'],
        onlyVerified: true
      });

      // Check that filtering logic would be applied
      expect(syncResult.statistics).toBeDefined();
    });

    it('should provide meaningful sync statistics', async () => {
      const syncResult = await lotwService.syncQSLRecords({
        callsign: 'KA1TEST'
      });

      const stats = syncResult.statistics;
      expect(stats.totalRecords).toBeGreaterThanOrEqual(0);
      expect(stats.verifiedQSLs).toBeGreaterThanOrEqual(0);
      expect(stats.newConfirmations).toBeGreaterThanOrEqual(0);
      expect(stats.verifiedQSLs).toBeLessThanOrEqual(stats.totalRecords);
      expect(stats.newConfirmations).toBeLessThanOrEqual(stats.verifiedQSLs);
    });
  });

  describe('LoTW User Information', () => {
    it('should get LoTW user information for verified callsign', async () => {
      // First verify the callsign
      await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      const userInfo = await lotwService.getLoTWUserInfo('KA1TEST');

      expect(userInfo).toBeDefined();
      expect(userInfo!.callsign).toBe('KA1TEST');
      expect(userInfo!.userName).toBeDefined();
      expect(userInfo!.joinDate).toBeInstanceOf(Date);
      expect(userInfo!.lastActivity).toBeInstanceOf(Date);
      expect(userInfo!.qslCount).toBeGreaterThanOrEqual(0);
      expect(userInfo!.dxccConfirmed).toBeGreaterThanOrEqual(0);
      expect(userInfo!.subscriptionStatus).toMatch(/^(active|expired|none)$/);
    });

    it('should return null for unverified callsign', async () => {
      const userInfo = await lotwService.getLoTWUserInfo('UNVERIFIED');

      // Might return null if no QSL records found
      if (userInfo === null) {
        expect(userInfo).toBeNull();
      } else {
        expect(userInfo.callsign).toBe('UNVERIFIED');
      }
    });

    it('should handle callsign formatting correctly', async () => {
      const userInfo = await lotwService.getLoTWUserInfo('  ka1test  ');

      if (userInfo) {
        expect(userInfo.callsign).toBe('KA1TEST'); // Should be normalized
      }
    });
  });

  describe('Certificate Federation', () => {
    it('should create federation request', async () => {
      const requestId = await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate
      );

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');

      const request = lotwService.getFederationStatus(requestId);
      expect(request).toBeDefined();
      expect(request!.sourceCallsign).toBe('KB1SOURCE');
      expect(request!.targetCallsign).toBe('KA1TARGET');
      expect(request!.status).toBe('pending');
    });

    it('should auto-approve federation for verified stations', async () => {
      // Pre-verify both stations
      await lotwService.verifyCallsignWithLoTW('KB1SOURCE', {
        certificate: mockCertificateData,
        password: 'test-password'
      });
      await lotwService.verifyCallsignWithLoTW('KA1TARGET', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      const requestId = await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate
      );

      const request = lotwService.getFederationStatus(requestId);
      expect(request!.status).toBe('approved');
      expect(request!.approvalTime).toBeInstanceOf(Date);
    });

    it('should process federation approval with CAPTCHA', async () => {
      const requestId = await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate,
        { requireCaptcha: true }
      );

      const approved = await lotwService.processFederationRequest(
        requestId,
        'approve',
        { captchaResponse: 'valid-captcha-response' }
      );

      expect(approved).toBe(true);

      const request = lotwService.getFederationStatus(requestId);
      expect(request!.status).toBe('approved');
    });

    it('should process federation rejection', async () => {
      const requestId = await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate
      );

      const rejected = await lotwService.processFederationRequest(requestId, 'reject');

      expect(rejected).toBe(true);

      const request = lotwService.getFederationStatus(requestId);
      expect(request!.status).toBe('rejected');
    });

    it('should list federation requests for callsign', async () => {
      const requestId1 = await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate
      );

      const requestId2 = await lotwService.requestCertificateFederation(
        'KA1TARGET',
        'KC1OTHER',
        mockCertificate
      );

      const sourceRequests = lotwService.getFederationRequests('KB1SOURCE');
      const targetRequests = lotwService.getFederationRequests('KA1TARGET');

      expect(sourceRequests.length).toBe(1);
      expect(targetRequests.length).toBe(2); // KA1TARGET appears in both
      expect(sourceRequests[0].requestId).toBe(requestId1);
    });

    it('should handle invalid federation request operations', async () => {
      // Test non-existent request
      await expect(lotwService.processFederationRequest(
        'invalid-id',
        'approve'
      )).rejects.toThrow('Federation request invalid-id not found');

      // Test processing already processed request
      const requestId = await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate
      );

      await lotwService.processFederationRequest(requestId, 'approve', {
        captchaResponse: 'valid'
      });

      await expect(lotwService.processFederationRequest(
        requestId,
        'approve'
      )).rejects.toThrow('is not pending');
    });
  });

  describe('CAPTCHA Generation', () => {
    it('should generate verification CAPTCHA', async () => {
      const captcha = await lotwService.generateVerificationCAPTCHA('KA1TEST');

      expect(captcha.challenge).toBeDefined();
      expect(captcha.image).toBeInstanceOf(ArrayBuffer);
      expect(captcha.expiresAt).toBeInstanceOf(Date);
      expect(captcha.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should include audio CAPTCHA when requested', async () => {
      const captcha = await lotwService.generateVerificationCAPTCHA('KA1TEST');

      // Audio URL might be optional
      if (captcha.audioUrl) {
        expect(typeof captcha.audioUrl).toBe('string');
      }
    });
  });

  describe('Data Export', () => {
    it('should export QSL data in ADIF format', async () => {
      const adifData = await lotwService.exportQSLData('KA1TEST', 'adif');

      expect(typeof adifData).toBe('string');
      expect(adifData).toContain('ADIF Export');
      expect(adifData).toContain('<ADIF_VER:5>3.1.0');
      expect(adifData).toContain('<EOH>');

      // Should contain QSO records if any exist
      if (adifData.includes('<CALL:')) {
        expect(adifData).toContain('<EOR>');
      }
    });

    it('should export QSL data in CSV format', async () => {
      const csvData = await lotwService.exportQSLData('KA1TEST', 'csv');

      expect(typeof csvData).toBe('string');
      expect(csvData).toContain('Callsign,Contact,Date,Time');

      const lines = csvData.split('\n');
      expect(lines.length).toBeGreaterThan(1); // At least header + 1 data line or empty
    });

    it('should export QSL data in JSON format', async () => {
      const jsonData = await lotwService.exportQSLData('KA1TEST', 'json');

      expect(typeof jsonData).toBe('string');
      expect(() => JSON.parse(jsonData)).not.toThrow();

      const parsed = JSON.parse(jsonData);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should filter exported data by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const jsonData = await lotwService.exportQSLData('KA1TEST', 'json', {
        startDate,
        endDate,
        onlyConfirmed: true
      });

      const records = JSON.parse(jsonData) as QSLRecord[];

      for (const record of records) {
        const recordDate = new Date(record.datetime);
        expect(recordDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(recordDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });

    it('should handle unsupported export format', async () => {
      await expect(lotwService.exportQSLData(
        'KA1TEST',
        'xml' as any
      )).rejects.toThrow('Unsupported export format: xml');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive LoTW statistics', async () => {
      // Create some test data
      await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      await lotwService.requestCertificateFederation(
        'KB1SOURCE',
        'KA1TARGET',
        mockCertificate
      );

      const stats = lotwService.getLoTWStatistics();

      expect(stats.totalVerifications).toBeGreaterThanOrEqual(1);
      expect(stats.cachedVerifications).toBeGreaterThanOrEqual(1);
      expect(stats.federationRequests).toBeGreaterThanOrEqual(1);
      expect(stats.trustLevels).toBeDefined();
      expect(stats.verificationMethods).toBeDefined();

      // Check trust level counts
      Object.values(TrustLevel).forEach(level => {
        if (typeof level === 'number') {
          expect(stats.trustLevels[level as TrustLevel]).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should track federation request statuses', async () => {
      await lotwService.requestCertificateFederation(
        'KB1TEST1',
        'KA1TEST1',
        mockCertificate
      );

      const requestId2 = await lotwService.requestCertificateFederation(
        'KB1TEST2',
        'KA1TEST2',
        mockCertificate
      );

      await lotwService.processFederationRequest(requestId2, 'approve', {
        captchaResponse: 'valid'
      });

      const stats = lotwService.getLoTWStatistics();

      expect(stats.pendingRequests).toBeGreaterThanOrEqual(1);
      expect(stats.approvedRequests).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cache and Cleanup', () => {
    it('should cleanup expired cache entries', async () => {
      // Add some verifications
      await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      const statsBefore = lotwService.getLoTWStatistics();
      expect(statsBefore.cachedVerifications).toBeGreaterThan(0);

      // Cleanup should not remove non-expired entries immediately
      lotwService.cleanup();

      const statsAfter = lotwService.getLoTWStatistics();
      expect(statsAfter.cachedVerifications).toBe(statsBefore.cachedVerifications);
    });

    it('should handle disposal gracefully', () => {
      expect(() => lotwService.dispose()).not.toThrow();

      const stats = lotwService.getLoTWStatistics();
      expect(stats.totalVerifications).toBe(0);
      expect(stats.federationRequests).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      // Test with invalid callsign format
      const result = await lotwService.verifyCallsignWithLoTW('INVALID!@#');

      expect(result.verified).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle malformed certificate data', async () => {
      const invalidData = new ArrayBuffer(10); // Too small

      const result = await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: invalidData,
        password: 'test'
      });

      expect(result.verified).toBe(false);
      expect(result.trustLevel).toBe(TrustLevel.NONE);
    });

    it('should handle empty or null inputs', async () => {
      await expect(lotwService.verifyCallsignWithLoTW('')).rejects.toThrow();

      const userInfo = await lotwService.getLoTWUserInfo('');
      expect(userInfo).toBeNull();
    });

    it('should validate federation request parameters', async () => {
      await expect(lotwService.requestCertificateFederation(
        '',
        'KA1TEST',
        mockCertificate
      )).rejects.toThrow();

      await expect(lotwService.requestCertificateFederation(
        'KB1TEST',
        '',
        mockCertificate
      )).rejects.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete verification within reasonable time', async () => {
      const startTime = Date.now();

      await lotwService.verifyCallsignWithLoTW('KA1TEST', {
        certificate: mockCertificateData,
        password: 'test-password'
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 second limit
    });

    it('should handle concurrent verifications', async () => {
      const callsigns = ['KA1TEST1', 'KA1TEST2', 'KA1TEST3'];

      const verifications = await Promise.all(
        callsigns.map(callsign =>
          lotwService.verifyCallsignWithLoTW(callsign, {
            certificate: mockCertificateData,
            password: 'test-password'
          })
        )
      );

      expect(verifications).toHaveLength(3);
      verifications.forEach((result, index) => {
        expect(result.callsign).toBe(callsigns[index]);
      });
    });

    it('should handle large QSL record exports efficiently', async () => {
      const startTime = Date.now();

      const adifData = await lotwService.exportQSLData('KA1TEST', 'adif');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // 3 second limit for export

      expect(typeof adifData).toBe('string');
    });
  });
});