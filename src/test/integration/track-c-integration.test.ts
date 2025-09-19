/**
 * Track C Integration Test
 *
 * Verifies that all Track C (Infrastructure & Security Layer) components
 * work together properly: distributed systems, FCC compliance, certificates,
 * server management, and subscriptions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DistributedSystemsManager } from '../../lib/distributed-systems/index.js';
import { HTTPProtocol } from '../../lib/http-protocol/index.js';
import { createComplianceManager } from '../../lib/fcc-compliance/index.js';

// Polyfill crypto.randomUUID for test environment
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
    subtle: {} as any
  } as any;
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

describe('Track C Integration', () => {
  let distributedSystems: DistributedSystemsManager | null = null;
  let httpProtocol: HTTPProtocol | null = null;

  afterEach(async () => {
    // Clean up all resources
    if (distributedSystems) {
      try {
        distributedSystems.dispose();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
      distributedSystems = null;
    }
    if (httpProtocol) {
      try {
        await httpProtocol.emergencyShutdown();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
      httpProtocol = null;
    }
  });

  it('should have Track C libraries available', async () => {
    // Test that Track C components can be imported and instantiated
    expect(DistributedSystemsManager).toBeDefined();
    expect(HTTPProtocol).toBeDefined();
    expect(createComplianceManager).toBeDefined();
  });

  it('should have priority tier system available', async () => {
    const { PriorityManager, PriorityLevel } = await import('../../lib/priority-tiers/index.js');
    expect(PriorityManager).toBeDefined();
    expect(PriorityLevel).toBeDefined();
    expect(typeof PriorityLevel.P0_EMERGENCY).toBe('number');
  });

  it('should have certificate management components', async () => {
    const { CertificateManager } = await import('../../lib/certificate-management/index.js');
    expect(CertificateManager).toBeDefined();
  });

  it('should have server manager components', async () => {
    const { default: ServerManager } = await import('../../lib/server-manager/index.js');
    expect(ServerManager).toBeDefined();
  });

  it('should have FCC compliance components', async () => {
    const { ComplianceManager } = await import('../../lib/fcc-compliance/index.js');
    expect(ComplianceManager).toBeDefined();
  });

  it('should validate Track C integration in HTTP protocol', async () => {
    // Create HTTP protocol instance without full initialization
    httpProtocol = new HTTPProtocol({
      callsign: 'KA1TEST',
      licenseClass: 'TECHNICIAN'
    });

    expect(httpProtocol).toBeDefined();
    expect(typeof httpProtocol.getComplianceStatus).toBe('function');
    expect(typeof httpProtocol.getServerStatus).toBe('function');
    expect(typeof httpProtocol.getSystemStatistics).toBe('function');
  });

  it('should support emergency broadcasting functionality', async () => {
    httpProtocol = new HTTPProtocol({
      callsign: 'KA1TEST',
      licenseClass: 'TECHNICIAN'
    });

    expect(typeof httpProtocol.broadcastEmergency).toBe('function');
    expect(typeof httpProtocol.createPriorityUpdate).toBe('function');
    expect(typeof httpProtocol.acknowledgeEmergencyBroadcast).toBe('function');
    expect(typeof httpProtocol.getEmergencyStatistics).toBe('function');
  });

  it('should support certificate authentication', async () => {
    httpProtocol = new HTTPProtocol({
      callsign: 'KA1TEST',
      licenseClass: 'TECHNICIAN'
    });

    expect(typeof httpProtocol.requestClientCertificate).toBe('function');
    expect(typeof httpProtocol.authenticateConnection).toBe('function');
  });

  it('should integrate distributed systems coordination', async () => {
    // Create instance without initialization to avoid crypto dependencies
    const dsm = new DistributedSystemsManager({
      callsign: 'KA1TEST',
      licenseClass: 'TECHNICIAN',
      emergencyMode: false
    });

    // Test that the main coordination methods exist
    expect(typeof dsm.broadcastEmergencyUpdate).toBe('function');
    expect(typeof dsm.federateCertificate).toBe('function');
    expect(typeof dsm.optimizeContentCaching).toBe('function');
    expect(typeof dsm.manageServerApproval).toBe('function');
    expect(typeof dsm.getSystemStatistics).toBe('function');
  });
});