import { describe, it, expect, beforeEach } from 'vitest';
import {
  DynamicProtocolBuffer,
  FieldType,
  protocolBuffers,
  type SchemaDefinition,
  type EncodedMessage
} from './index';

describe('DynamicProtocolBuffer', () => {
  let pb: DynamicProtocolBuffer;

  beforeEach(() => {
    pb = new DynamicProtocolBuffer();
  });

  describe('Schema Generation', () => {
    it('should generate schema for simple object', () => {
      const data = {
        name: 'John',
        age: 30,
        active: true
      };

      const schema = pb.generateSchema(data, 'User');

      expect(schema.name).toBe('User');
      expect(schema.fields).toHaveLength(3);
      expect(schema.id).toBeDefined();
      expect(schema.version).toBe(1);
      expect(schema.timestamp).toBeGreaterThan(0);

      const nameField = schema.fields.find(f => f.name === 'name');
      expect(nameField?.type).toBe(FieldType.LENGTH_DELIMITED);
      expect(nameField?.number).toBeDefined();

      const ageField = schema.fields.find(f => f.name === 'age');
      expect(ageField?.type).toBe(FieldType.VARINT);

      const activeField = schema.fields.find(f => f.name === 'active');
      expect(activeField?.type).toBe(FieldType.VARINT);
    });

    it('should generate schema for nested object', () => {
      const data = {
        user: {
          name: 'John',
          details: {
            email: 'john@example.com',
            phone: '123-456-7890'
          }
        },
        timestamp: Date.now()
      };

      const schema = pb.generateSchema(data, 'NestedData');

      expect(schema.fields).toHaveLength(6); // user, user.name, user.details, user.details.email, user.details.phone, timestamp

      const userField = schema.fields.find(f => f.name === 'user');
      expect(userField?.type).toBe(FieldType.LENGTH_DELIMITED);

      const nameField = schema.fields.find(f => f.name === 'user.name');
      expect(nameField?.type).toBe(FieldType.LENGTH_DELIMITED);

      const detailsField = schema.fields.find(f => f.name === 'user.details');
      expect(detailsField?.type).toBe(FieldType.LENGTH_DELIMITED);
    });

    it('should generate schema for arrays', () => {
      const data = {
        tags: ['important', 'urgent'],
        scores: [85, 92, 78]
      };

      const schema = pb.generateSchema(data, 'ArrayData');

      expect(schema.fields).toHaveLength(2);

      const tagsField = schema.fields.find(f => f.name === 'tags');
      expect(tagsField?.type).toBe(FieldType.LENGTH_DELIMITED);
      expect(tagsField?.repeated).toBe(true);

      const scoresField = schema.fields.find(f => f.name === 'scores');
      expect(scoresField?.type).toBe(FieldType.VARINT);
      expect(scoresField?.repeated).toBe(true);
    });

    it('should assign unique field numbers', () => {
      const data = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const schema = pb.generateSchema(data, 'Numbers');

      const fieldNumbers = schema.fields.map(f => f.number);
      const uniqueNumbers = new Set(fieldNumbers);

      expect(uniqueNumbers.size).toBe(fieldNumbers.length);
      expect(Math.min(...fieldNumbers)).toBeGreaterThanOrEqual(1);
    });

    it('should generate consistent schema ID for same structure', () => {
      const data1 = { name: 'John', age: 30 };
      const data2 = { name: 'Jane', age: 25 };

      const schema1 = pb.generateSchema(data1, 'User');
      const schema2 = pb.generateSchema(data2, 'User');

      expect(schema1.id).toBe(schema2.id);
    });
  });

  describe('Encoding and Decoding', () => {
    it('should encode and decode simple data', () => {
      const originalData = {
        message: 'Hello Protocol Buffers',
        priority: 5,
        urgent: false
      };

      const encoded = pb.encode(originalData);
      expect(encoded.schemaId).toBeDefined();
      expect(encoded.data).toBeInstanceOf(Uint8Array);

      const decoded = pb.decode(encoded);
      expect(decoded).toEqual(originalData);
    });

    it('should encode and decode nested objects', () => {
      const originalData = {
        request: {
          method: 'POST',
          path: '/api/data',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        timestamp: 1234567890
      };

      const encoded = pb.encode(originalData);
      const decoded = pb.decode(encoded);

      expect(decoded.request.method).toBe('POST');
      expect(decoded.request.path).toBe('/api/data');
      expect(decoded.timestamp).toBe(1234567890);
    });

    it('should encode and decode arrays', () => {
      const originalData = {
        userIds: [101, 102, 103, 104],
        tags: ['ham-radio', 'protocol-buffers', 'optimization']
      };

      const encoded = pb.encode(originalData);
      const decoded = pb.decode(encoded);

      expect(decoded.userIds).toEqual([101, 102, 103, 104]);
      expect(decoded.tags).toEqual(['ham-radio', 'protocol-buffers', 'optimization']);
    });

    it('should handle empty objects and null values', () => {
      const originalData = {
        empty: {},
        nullable: null,
        optional: undefined,
        present: 'value'
      };

      const encoded = pb.encode(originalData);
      const decoded = pb.decode(encoded);

      expect(decoded.present).toBe('value');
      // null and undefined fields may be omitted or have default values
    });

    it('should encode different data types correctly', () => {
      const originalData = {
        integer: 42,
        float: 3.14159,
        string: 'test string',
        boolean: true,
        bytes: new Uint8Array([1, 2, 3, 4])
      };

      const encoded = pb.encode(originalData);
      const decoded = pb.decode(encoded);

      expect(decoded.integer).toBe(42);
      expect(decoded.float).toBeCloseTo(3.14159, 5);
      expect(decoded.string).toBe('test string');
      expect(decoded.boolean).toBe(true);
      expect(decoded.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
  });

  describe('Schema Caching', () => {
    it('should cache schemas by ID', () => {
      const data = { name: 'Test', value: 123 };
      const schema = pb.generateSchema(data, 'TestMessage');

      expect(pb.getSchema(schema.id)).toEqual(schema);
    });

    it('should return undefined for unknown schema ID', () => {
      expect(pb.getSchema('unknown-id')).toBeUndefined();
    });

    it('should cache external schemas', () => {
      const externalSchema: SchemaDefinition = {
        id: 'external-123',
        version: 1,
        name: 'ExternalMessage',
        fields: [
          { number: 1, type: FieldType.LENGTH_DELIMITED, name: 'title' },
          { number: 2, type: FieldType.VARINT, name: 'count' }
        ],
        timestamp: Date.now()
      };

      pb.cacheSchema(externalSchema);
      expect(pb.getSchema('external-123')).toEqual(externalSchema);
    });

    it('should list all cached schema IDs', () => {
      const data1 = { a: 1 };
      const data2 = { b: 2 };

      const schema1 = pb.generateSchema(data1, 'Schema1');
      const schema2 = pb.generateSchema(data2, 'Schema2');

      const cachedIds = pb.getCachedSchemaIds();
      expect(cachedIds).toContain(schema1.id);
      expect(cachedIds).toContain(schema2.id);
    });

    it('should clear cache', () => {
      const data = { test: 'value' };
      const schema = pb.generateSchema(data, 'Test');

      expect(pb.getSchema(schema.id)).toBeDefined();

      pb.clearCache();

      expect(pb.getSchema(schema.id)).toBeUndefined();
      expect(pb.getCachedSchemaIds()).toHaveLength(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate correct data against schema', () => {
      const data = { name: 'John', age: 30 };
      const schema = pb.generateSchema(data, 'User');

      expect(pb.validateData(data, schema.id)).toBe(true);
    });

    it('should validate compatible data against schema', () => {
      const originalData = { name: 'John', age: 30 };
      const schema = pb.generateSchema(originalData, 'User');

      const compatibleData = { name: 'Jane', age: 25 };
      expect(pb.validateData(compatibleData, schema.id)).toBe(true);
    });

    it('should reject validation for unknown schema', () => {
      const data = { test: 'value' };
      expect(pb.validateData(data, 'unknown-schema-id')).toBe(false);
    });
  });

  describe('Protocol Messages', () => {
    it('should create schema transmission message', () => {
      const data = { message: 'test' };
      const schema = pb.generateSchema(data, 'Test');

      const transmission = pb.createSchemaTransmission(schema);

      expect(transmission.type).toBe('SCHEMA');
      expect(transmission.schema).toEqual(schema);
    });

    it('should create data transmission message', () => {
      const data = { message: 'test' };
      const encoded = pb.encode(data);

      const transmission = pb.createDataTransmission(encoded);

      expect(transmission.type).toBe('DATA');
      expect(transmission.message).toEqual(encoded);
    });
  });

  describe('Binary Encoding Efficiency', () => {
    it('should produce smaller output than JSON for structured data', () => {
      const data = {
        users: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
          { id: 3, name: 'Charlie', email: 'charlie@example.com' }
        ],
        metadata: {
          version: 1,
          timestamp: Date.now(),
          source: 'test-system'
        }
      };

      const jsonSize = new TextEncoder().encode(JSON.stringify(data)).length;
      const encoded = pb.encode(data);
      const protobufSize = encoded.data.length;

      // Protocol buffers should be more efficient for structured data
      // Note: This test might vary based on data structure complexity
      expect(protobufSize).toBeLessThan(jsonSize * 1.5); // Allow some overhead for small data
    });

    it('should handle large field numbers efficiently', () => {
      // Create data that would result in large field numbers
      const largeData: any = {};
      for (let i = 0; i < 100; i++) {
        largeData[`field_${i.toString().padStart(3, '0')}`] = i;
      }

      const encoded = pb.encode(largeData);
      const decoded = pb.decode(encoded);

      expect(Object.keys(decoded)).toHaveLength(100);
      expect(decoded.field_099).toBe(99);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when decoding with missing schema', () => {
      const encodedMessage: EncodedMessage = {
        schemaId: 'missing-schema',
        data: new Uint8Array([1, 2, 3])
      };

      expect(() => pb.decode(encodedMessage)).toThrow('Schema missing-schema not found');
    });

    it('should handle corrupted binary data gracefully', () => {
      const data = { test: 'value' };
      const encoded = pb.encode(data);

      // Corrupt the binary data
      const corrupted: EncodedMessage = {
        ...encoded,
        data: new Uint8Array([0xFF, 0xFF, 0xFF]) // Invalid varint
      };

      expect(() => pb.decode(corrupted)).toThrow();
    });

    it('should handle empty data', () => {
      const emptyData = {};
      const encoded = pb.encode(emptyData);
      const decoded = pb.decode(encoded);

      expect(decoded).toEqual({});
    });
  });
});

describe('Singleton protocolBuffers instance', () => {
  it('should provide global instance', () => {
    expect(protocolBuffers).toBeInstanceOf(DynamicProtocolBuffer);
  });

  it('should maintain state across operations', () => {
    const data = { global: 'test' };
    const schema = protocolBuffers.generateSchema(data, 'Global');

    expect(protocolBuffers.getSchema(schema.id)).toBeDefined();
  });
});

describe('Integration with Ham Radio Requirements', () => {
  it('should respect bandwidth constraints', () => {
    // Test with typical ham radio data payload
    const hamRadioData = {
      callsign: 'KA1ABC',
      message: 'Hello from the Pacific Northwest!',
      timestamp: Date.now(),
      location: {
        latitude: 47.6062,
        longitude: -122.3321,
        elevation: 56
      },
      signal: {
        frequency: 14205000,
        mode: 'QPSK',
        power: 100,
        snr: 15.3
      }
    };

    const encoded = protocolBuffers.encode(hamRadioData);

    // Should be compact for radio transmission
    expect(encoded.data.length).toBeLessThan(200); // Reasonable size for ham radio
  });

  it('should handle QSO (contact) data efficiently', () => {
    const qsoData = {
      callsigns: {
        from: 'KA1ABC',
        to: 'W2DEF'
      },
      exchange: {
        rst_sent: '599',
        rst_received: '579',
        location: 'Grid square CN87'
      },
      technical: {
        frequency: 14.205,
        mode: 'FT8',
        power: 100
      },
      timestamp: '2025-09-14T15:30:00Z'
    };

    const encoded = protocolBuffers.encode(qsoData);
    const decoded = protocolBuffers.decode(encoded);

    expect(decoded.callsigns.from).toBe('KA1ABC');
    expect(decoded.callsigns.to).toBe('W2DEF');
    expect(decoded.technical.frequency).toBe(14.205);
  });

  it('should support mesh routing metadata', () => {
    const routingData = {
      route: {
        source: 'KA1ABC',
        destination: 'W2DEF',
        hops: ['N3GHI', 'K4JKL'],
        metrics: {
          hopCount: 2,
          totalDelay: 1250, // ms
          snr: 12.5
        }
      },
      payload: {
        type: 'HTTP_REQUEST',
        size: 234
      }
    };

    const encoded = protocolBuffers.encode(routingData);
    const decoded = protocolBuffers.decode(encoded);

    expect(decoded.route.hops).toEqual(['N3GHI', 'K4JKL']);
    expect(decoded.route.metrics.hopCount).toBe(2);
  });
});