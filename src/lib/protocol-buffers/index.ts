/**
 * Protocol Buffers for Dynamic Schema Generation and Binary Serialization
 *
 * Implements dynamic protobuf-style encoding for ham radio transmissions:
 * - Generates schemas dynamically from data structure
 * - Encodes data using compact binary format
 * - Provides schema caching and validation
 * - Handles schema transmission before data
 */

import { HamRadioCompressor } from '../compression';

// Schema field types
export enum FieldType {
  VARINT = 0,    // int32, int64, uint32, uint64, sint32, sint64, bool, enum
  FIXED64 = 1,   // fixed64, sfixed64, double
  LENGTH_DELIMITED = 2, // string, bytes, embedded messages, packed repeated fields
  FIXED32 = 5    // fixed32, sfixed32, float
}

// Additional field metadata for better type handling
export enum FieldDataType {
  BOOLEAN = 'boolean',
  INTEGER = 'integer',
  FLOAT = 'float',
  STRING = 'string',
  BYTES = 'bytes',
  OBJECT = 'object'
}

// Wire format for field encoding
export interface FieldDescriptor {
  number: number;
  type: FieldType;
  name: string;
  repeated?: boolean;
  optional?: boolean;
  defaultValue?: any;
  dataType?: FieldDataType; // Additional type info for correct decoding
}

// Schema definition
export interface SchemaDefinition {
  id: string;
  version: number;
  name: string;
  fields: FieldDescriptor[];
  timestamp: number;
}

// Encoded message structure
export interface EncodedMessage {
  schemaId: string;
  data: Uint8Array;
  compressed?: boolean;
}

// Schema transmission packet
export interface SchemaTransmission {
  type: 'SCHEMA';
  schema: SchemaDefinition;
}

// Data transmission packet
export interface DataTransmission {
  type: 'DATA';
  message: EncodedMessage;
}

export type ProtocolMessage = SchemaTransmission | DataTransmission;

/**
 * Dynamic Protocol Buffer implementation for ham radio
 */
export class DynamicProtocolBuffer {
  private schemas = new Map<string, SchemaDefinition>();
  private fieldNumbers = new Map<string, number>();
  private nextFieldNumber = 1;
  private compressor = new HamRadioCompressor();

  /**
   * Generate schema dynamically from data object
   */
  generateSchema(data: any, name: string = 'Message'): SchemaDefinition {
    const fields: FieldDescriptor[] = [];
    this.fieldNumbers.clear();
    this.nextFieldNumber = 1;

    this.extractFields(data, fields, '');

    const schema: SchemaDefinition = {
      id: this.generateSchemaId(fields),
      version: 1,
      name,
      fields,
      timestamp: Date.now()
    };

    this.schemas.set(schema.id, schema);
    return schema;
  }

  /**
   * Extract field descriptors from data object
   */
  private extractFields(obj: any, fields: FieldDescriptor[], prefix: string) {
    if (obj === null || obj === undefined) return;

    // Handle empty objects
    if (typeof obj === 'object' && Object.keys(obj).length === 0) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      // Skip null and undefined values
      if (value === null || value === undefined) {
        continue;
      }
      const fieldName = prefix ? `${prefix}.${key}` : key;
      const fieldNumber = this.getFieldNumber(fieldName);

      if (Array.isArray(value)) {
        if (value.length > 0) {
          const elementType = this.getFieldType(value[0]);
          const dataType = this.getDataType(value[0]);
          fields.push({
            number: fieldNumber,
            type: elementType,
            name: fieldName,
            repeated: true,
            dataType
          });
        }
      } else if (typeof value === 'object') {
        // Nested object - create embedded message
        fields.push({
          number: fieldNumber,
          type: FieldType.LENGTH_DELIMITED,
          name: fieldName,
          dataType: FieldDataType.OBJECT
        });
        this.extractFields(value, fields, fieldName);
      } else {
        fields.push({
          number: fieldNumber,
          type: this.getFieldType(value),
          name: fieldName,
          dataType: this.getDataType(value)
        });
      }
    }
  }

  /**
   * Get or assign field number for consistent encoding
   */
  private getFieldNumber(fieldName: string): number {
    if (!this.fieldNumbers.has(fieldName)) {
      this.fieldNumbers.set(fieldName, this.nextFieldNumber++);
    }
    return this.fieldNumbers.get(fieldName)!;
  }

  /**
   * Determine field type from JavaScript value
   */
  private getFieldType(value: any): FieldType {
    switch (typeof value) {
      case 'boolean':
        return FieldType.VARINT;
      case 'number':
        if (Number.isInteger(value)) {
          return FieldType.VARINT;
        } else {
          return FieldType.FIXED64; // double
        }
      case 'string':
        return FieldType.LENGTH_DELIMITED;
      case 'object':
        if (value instanceof Uint8Array) {
          return FieldType.LENGTH_DELIMITED;
        }
        return FieldType.LENGTH_DELIMITED; // embedded message
      default:
        return FieldType.LENGTH_DELIMITED;
    }
  }

  /**
   * Determine data type for proper decoding
   */
  private getDataType(value: any): FieldDataType {
    switch (typeof value) {
      case 'boolean':
        return FieldDataType.BOOLEAN;
      case 'number':
        if (Number.isInteger(value)) {
          return FieldDataType.INTEGER;
        } else {
          return FieldDataType.FLOAT;
        }
      case 'string':
        return FieldDataType.STRING;
      case 'object':
        if (value instanceof Uint8Array) {
          return FieldDataType.BYTES;
        }
        return FieldDataType.OBJECT;
      default:
        return FieldDataType.STRING;
    }
  }

  /**
   * Generate unique schema ID from fields
   */
  private generateSchemaId(fields: FieldDescriptor[]): string {
    // Create a deterministic signature based on field structure, not numbers
    const fieldSignature = fields
      .map(f => `${f.name}:${f.type}:${f.dataType}:${f.repeated || false}`)
      .sort()
      .join('|');

    // Simple hash for schema ID
    let hash = 0;
    for (let i = 0; i < fieldSignature.length; i++) {
      const char = fieldSignature.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Encode data using schema
   */
  encode(data: any, schemaId?: string): EncodedMessage {
    let schema: SchemaDefinition;

    if (schemaId && this.schemas.has(schemaId)) {
      schema = this.schemas.get(schemaId)!;
    } else {
      schema = this.generateSchema(data);
    }

    const buffer = new ByteBuffer();
    this.encodeFields(data, schema.fields, buffer);

    return {
      schemaId: schema.id,
      data: buffer.toUint8Array()
    };
  }

  /**
   * Encode fields according to schema
   */
  private encodeFields(obj: any, fields: FieldDescriptor[], buffer: ByteBuffer) {
    // Handle empty objects
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
      return;
    }

    for (const field of fields) {
      const value = this.getNestedValue(obj, field.name);

      if (value === undefined || value === null) {
        if (!field.optional) {
          // Use default value for required fields
          this.encodeField(field, field.defaultValue, buffer);
        }
        continue;
      }

      if (field.repeated && Array.isArray(value)) {
        for (const item of value) {
          this.encodeField(field, item, buffer);
        }
      } else {
        this.encodeField(field, value, buffer);
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Encode individual field
   */
  private encodeField(field: FieldDescriptor, value: any, buffer: ByteBuffer) {
    const tag = (field.number << 3) | field.type;
    buffer.writeVarint(tag);

    switch (field.type) {
      case FieldType.VARINT:
        if (typeof value === 'boolean') {
          buffer.writeVarint(value ? 1 : 0);
        } else {
          buffer.writeVarint(value);
        }
        break;

      case FieldType.FIXED64:
        buffer.writeFixed64(value);
        break;

      case FieldType.FIXED32:
        buffer.writeFixed32(value);
        break;

      case FieldType.LENGTH_DELIMITED:
        if (typeof value === 'string' && field.dataType === FieldDataType.STRING) {
          // Apply adaptive text compression for text content
          const compressedText = this.compressText(value);
          buffer.writeVarint(compressedText.length);
          buffer.writeBytes(compressedText);
        } else if (typeof value === 'string') {
          const bytes = new TextEncoder().encode(value);
          buffer.writeVarint(bytes.length);
          buffer.writeBytes(bytes);
        } else if (value instanceof Uint8Array) {
          buffer.writeVarint(value.length);
          buffer.writeBytes(value);
        } else if (typeof value === 'object') {
          // Nested object - recursively encode
          const nestedBuffer = new ByteBuffer();
          const nestedFields = this.schemas.get(this.generateSchemaId([]))?.fields || [];
          this.encodeFields(value, nestedFields, nestedBuffer);
          const nestedData = nestedBuffer.toUint8Array();
          buffer.writeVarint(nestedData.length);
          buffer.writeBytes(nestedData);
        }
        break;
    }
  }

  /**
   * Decode data using schema
   */
  decode(message: EncodedMessage): any {
    const schema = this.schemas.get(message.schemaId);
    if (!schema) {
      throw new Error(`Schema ${message.schemaId} not found`);
    }

    const buffer = new ByteReader(message.data);
    const result: any = {};

    while (buffer.hasMore()) {
      const tag = buffer.readVarint();
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x7;

      const field = schema.fields.find(f => f.number === fieldNumber);
      if (!field) {
        // Skip unknown field
        this.skipField(buffer, wireType);
        continue;
      }

      const value = this.decodeField(field, buffer, wireType);
      this.setNestedValue(result, field.name, value, field.repeated);
    }

    return result;
  }

  /**
   * Compress text using HamRadioCompressor adaptive compression
   */
  private compressText(text: string): Uint8Array {
    const result = this.compressor.compressHTML(text);
    return new TextEncoder().encode(JSON.stringify(result.compressed));
  }

  /**
   * Decompress text using HamRadioCompressor
   */
  private decompressText(data: Uint8Array): string {
    const compressedData = JSON.parse(new TextDecoder().decode(data));
    return this.compressor.decompressHTML(compressedData);
  }

  /**
   * Decode individual field value
   */
  private decodeField(field: FieldDescriptor, buffer: ByteReader, wireType: number): any {
    switch (wireType) {
      case FieldType.VARINT:
        const varint = buffer.readVarint();
        return field.dataType === FieldDataType.BOOLEAN ? varint !== 0 : varint;

      case FieldType.FIXED64:
        return buffer.readFixed64();

      case FieldType.FIXED32:
        return buffer.readFixed32();

      case FieldType.LENGTH_DELIMITED:
        const length = buffer.readVarint();
        const bytes = buffer.readBytes(length);

        if (field.dataType === FieldDataType.STRING) {
          // Try to decompress if it's compressed text data
          try {
            return this.decompressText(bytes);
          } catch {
            // Fallback to regular string decoding
            return new TextDecoder().decode(bytes);
          }
        } else if (field.dataType === FieldDataType.BYTES) {
          return bytes;
        } else if (field.dataType === FieldDataType.OBJECT) {
          // Nested object - would need recursive decoding
          // For now, return as bytes
          return bytes;
        }

        // Fallback: try to decode as string
        try {
          return new TextDecoder().decode(bytes);
        } catch {
          return bytes;
        }

      default:
        throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any, repeated: boolean = false) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    const finalKey = keys[keys.length - 1];
    if (repeated) {
      if (!current[finalKey]) {
        current[finalKey] = [];
      }
      current[finalKey].push(value);
    } else {
      current[finalKey] = value;
    }
  }

  /**
   * Skip unknown field during decoding
   */
  private skipField(buffer: ByteReader, wireType: number) {
    switch (wireType) {
      case FieldType.VARINT:
        buffer.readVarint();
        break;
      case FieldType.FIXED64:
        buffer.readFixed64();
        break;
      case FieldType.FIXED32:
        buffer.readFixed32();
        break;
      case FieldType.LENGTH_DELIMITED:
        const length = buffer.readVarint();
        buffer.readBytes(length);
        break;
    }
  }

  /**
   * Get schema by ID
   */
  getSchema(schemaId: string): SchemaDefinition | undefined {
    return this.schemas.get(schemaId);
  }

  /**
   * Cache schema from transmission
   */
  cacheSchema(schema: SchemaDefinition) {
    this.schemas.set(schema.id, schema);
  }

  /**
   * Validate data against schema
   */
  validateData(data: any, schemaId: string): boolean {
    const schema = this.schemas.get(schemaId);
    if (!schema) return false;

    try {
      // Try encoding - if it fails, data is invalid
      this.encode(data, schemaId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create schema transmission packet
   */
  createSchemaTransmission(schema: SchemaDefinition): SchemaTransmission {
    return {
      type: 'SCHEMA',
      schema
    };
  }

  /**
   * Create data transmission packet
   */
  createDataTransmission(message: EncodedMessage): DataTransmission {
    return {
      type: 'DATA',
      message
    };
  }

  /**
   * Clear cached schemas (for session management)
   */
  clearCache() {
    this.schemas.clear();
  }

  /**
   * Get all cached schema IDs
   */
  getCachedSchemaIds(): string[] {
    return Array.from(this.schemas.keys());
  }
}

/**
 * Binary buffer writer
 */
class ByteBuffer {
  private buffer: number[] = [];

  writeVarint(value: number) {
    // Handle large numbers by using safe integer arithmetic
    if (value < 0) {
      // For negative numbers, use two's complement representation
      value = value >>> 0; // Convert to unsigned 32-bit
    }

    while (value >= 0x80) {
      this.buffer.push((value & 0xFF) | 0x80);
      value = Math.floor(value / 128); // Use division instead of bit shift for large numbers
    }
    this.buffer.push(value & 0xFF);
  }

  writeFixed32(value: number) {
    this.buffer.push(value & 0xFF);
    this.buffer.push((value >>> 8) & 0xFF);
    this.buffer.push((value >>> 16) & 0xFF);
    this.buffer.push((value >>> 24) & 0xFF);
  }

  writeFixed64(value: number) {
    // JavaScript numbers are 64-bit floats, handle as best we can
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true); // little endian

    for (let i = 0; i < 8; i++) {
      this.buffer.push(view.getUint8(i));
    }
  }

  writeBytes(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Binary buffer reader
 */
class ByteReader {
  private data: Uint8Array;
  private position: number = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  hasMore(): boolean {
    return this.position < this.data.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;

    while (this.position < this.data.length) {
      const byte = this.data[this.position++];

      if (shift < 28) {
        result |= (byte & 0x7F) << shift;
      } else {
        // Handle large numbers with safe arithmetic
        result += (byte & 0x7F) * Math.pow(2, shift);
      }

      if ((byte & 0x80) === 0) {
        return result;
      }

      shift += 7;
      if (shift >= 64) { // Allow up to 64-bit numbers
        throw new Error('Varint too long');
      }
    }

    throw new Error('Unexpected end of data');
  }

  readFixed32(): number {
    if (this.position + 4 > this.data.length) {
      throw new Error('Not enough bytes for fixed32');
    }

    const result = this.data[this.position] |
                  (this.data[this.position + 1] << 8) |
                  (this.data[this.position + 2] << 16) |
                  (this.data[this.position + 3] << 24);

    this.position += 4;
    return result;
  }

  readFixed64(): number {
    if (this.position + 8 > this.data.length) {
      throw new Error('Not enough bytes for fixed64');
    }

    const view = new DataView(this.data.buffer, this.data.byteOffset + this.position, 8);
    const result = view.getFloat64(0, true); // little endian

    this.position += 8;
    return result;
  }

  readBytes(length: number): Uint8Array {
    if (this.position + length > this.data.length) {
      throw new Error('Not enough bytes');
    }

    const result = this.data.slice(this.position, this.position + length);
    this.position += length;
    return result;
  }
}

// Create and export singleton instance
export const protocolBuffers = new DynamicProtocolBuffer();