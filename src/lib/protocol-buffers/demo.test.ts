import { describe, it, expect } from 'vitest';
import { runProtocolBuffersDemo, qslConfirmation, meshRoutingInfo } from './demo';
import { protocolBuffers } from './index';

describe('Protocol Buffers Demo', () => {
  it('should run the complete demo without errors', () => {
    // Capture console output
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      consoleLogs.push(args.join(' '));
    };

    try {
      runProtocolBuffersDemo();

      // Restore console
      console.log = originalLog;

      // Verify demo ran successfully
      expect(consoleLogs.length).toBeGreaterThan(35); // At least 35 log statements
      expect(consoleLogs[0]).toContain('Protocol Buffers for Ham Radio - Demo Starting');
      expect(consoleLogs[consoleLogs.length - 1]).toContain('Full compliance with FCC Part 97');
    } finally {
      console.log = originalLog;
    }
  });

  it('should demonstrate bandwidth savings', () => {
    const originalSize = JSON.stringify(qslConfirmation).length;
    const encoded = protocolBuffers.encode(qslConfirmation);

    expect(encoded.data.length).toBeLessThan(originalSize);

    const savings = (originalSize - encoded.data.length) / originalSize;
    expect(savings).toBeGreaterThan(0.1); // At least 10% savings
  });

  it('should demonstrate schema reuse', () => {
    const schema1 = protocolBuffers.generateSchema(qslConfirmation, 'QSL');

    // Create data with same structure as qslConfirmation
    const similarQslData = {
      qso: {
        date: '2025-09-15',
        time: '1630Z',
        frequency: 21.205,
        mode: 'PSK31',
        callsigns: {
          from: 'N1XYZ',
          to: 'W2ABC'
        },
        rst_exchange: {
          sent: '599',
          received: '599'
        },
        location: {
          grid_square: 'FN20',
          coordinates: {
            latitude: 40.7128,
            longitude: -74.0060
          }
        }
      },
      operator: {
        name: 'Jane Doe',
        license_class: 'Extra'
      },
      confirmation: {
        method: 'PAPER',
        timestamp: Date.now(),
        verified: false
      }
    };

    const schema2 = protocolBuffers.generateSchema(similarQslData, 'QSL');

    // Same structure should generate same schema ID
    expect(schema1.id).toBe(schema2.id);
  });

  it('should demonstrate schema transmission and caching', () => {
    const schema = protocolBuffers.generateSchema(meshRoutingInfo, 'MeshRouting');
    const transmission = protocolBuffers.createSchemaTransmission(schema);

    expect(transmission.type).toBe('SCHEMA');
    expect(transmission.schema.id).toBe(schema.id);

    // Clear cache and verify schema is gone
    protocolBuffers.clearCache();
    expect(protocolBuffers.getSchema(schema.id)).toBeUndefined();

    // Cache from transmission and verify it's back
    protocolBuffers.cacheSchema(transmission.schema);
    expect(protocolBuffers.getSchema(schema.id)).toEqual(schema);
  });

  it('should maintain data integrity through encode/decode cycle', () => {
    const originalData = {
      station: 'KA1ABC',
      message: 'Hello from the ham radio mesh network!',
      timestamp: 1694700000000,
      technical: {
        frequency: 14.205,
        mode: 'QPSK',
        power: 100,
        snr: 15.3
      },
      routing: {
        hops: ['N3GHI', 'K4JKL'],
        total_delay: 1250
      }
    };

    const encoded = protocolBuffers.encode(originalData);
    const decoded = protocolBuffers.decode(encoded);

    expect(decoded.station).toBe(originalData.station);
    expect(decoded.message).toBe(originalData.message);
    expect(decoded.timestamp).toBe(originalData.timestamp);
    expect(decoded.technical.frequency).toBe(originalData.technical.frequency);
    expect(decoded.routing.hops).toEqual(originalData.routing.hops);
  });

  it('should handle FCC Part 97 compliance requirements', () => {
    const emergencyTraffic = {
      priority: 'EMERGENCY',
      type: 'HEALTH_AND_WELFARE',
      originator: 'KC1XYZ',
      content: {
        incident_id: 'FIRE-2025-0914-001',
        location: 'Mount Baker National Forest',
        status: 'EVACUATIONS_UNDERWAY',
        contact: 'Emergency Coordinator W7ABC'
      }
    };

    // Encode and decode
    const encoded = protocolBuffers.encode(emergencyTraffic);
    const decoded = protocolBuffers.decode(encoded);

    // All emergency information should be preserved and readable
    expect(decoded.priority).toBe('EMERGENCY');
    expect(decoded.content.incident_id).toBe('FIRE-2025-0914-001');
    expect(decoded.content.location).toBe('Mount Baker National Forest');

    // Data should be compact for emergency transmission
    const jsonSize = JSON.stringify(emergencyTraffic).length;
    expect(encoded.data.length).toBeLessThan(jsonSize);
  });
});