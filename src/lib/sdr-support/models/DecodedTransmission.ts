/**
 * DecodedTransmission Model
 * Successfully decoded HTTP-over-radio transmission
 */

import { SignalQuality } from './SpectrumData';

export interface DecodedTransmission {
  /** Unique transmission ID */
  id: string;

  /** Transmitting station callsign */
  sourceCallsign: string;

  /** Received frequency in Hz */
  frequency: number;

  /** Decode timestamp */
  timestamp: Date;

  /** Signal quality metrics */
  signalQuality: SignalQuality;

  /** Content type */
  contentType: ContentType;

  /** Decoded payload data */
  payload: Uint8Array;

  /** Cryptographic verification status */
  verified: boolean;

  /** Cached in auto-discovery cache */
  cached: boolean;

  /** Payload size in bytes */
  payloadSize: number;

  /** Transmission metadata */
  metadata: TransmissionMetadata;

  /** Decoding results */
  decodingResults?: DecodingResults;
}

export interface TransmissionMetadata {
  /** Protocol version */
  protocolVersion: string;

  /** Encoding type used */
  encoding: EncodingType;

  /** Compression algorithm used */
  compression?: CompressionType;

  /** Error correction method */
  errorCorrection: ErrorCorrectionType;

  /** Transmission sequence number */
  sequenceNumber?: number;

  /** Total parts in multi-part transmission */
  totalParts?: number;

  /** Current part number */
  partNumber?: number;

  /** Checksum/hash of payload */
  payloadHash: string;

  /** Digital signature */
  signature?: string;

  /** Transmission flags */
  flags: TransmissionFlags;
}

export interface DecodingResults {
  /** Decoding duration in milliseconds */
  decodingTime: number;

  /** Number of error correction attempts */
  errorCorrectionAttempts: number;

  /** Number of corrected errors */
  correctedErrors: number;

  /** Bit error rate before correction */
  bitErrorRate: number;

  /** Symbol error rate */
  symbolErrorRate: number;

  /** Confidence in decoded data */
  decodingConfidence: number;

  /** Reed-Solomon correction stats */
  reedSolomonStats?: ReedSolomonStats;

  /** Forward error correction stats */
  fecStats?: FECStats;

  /** Decoding algorithm used */
  algorithm: DecodingAlgorithm;
}

export interface ReedSolomonStats {
  /** Codeword length */
  codewordLength: number;

  /** Information length */
  informationLength: number;

  /** Number of correctable errors */
  correctableErrors: number;

  /** Number of detected errors */
  detectedErrors: number;

  /** Number of corrected errors */
  correctedErrors: number;

  /** Correction success rate */
  correctionSuccessRate: number;
}

export interface FECStats {
  /** Code rate (k/n) */
  codeRate: number;

  /** Constraint length */
  constraintLength: number;

  /** Viterbi path metric */
  pathMetric?: number;

  /** Number of decoded bits */
  decodedBits: number;

  /** Number of corrected bits */
  correctedBits: number;
}

export interface TransmissionFlags {
  /** Emergency priority transmission */
  emergency: boolean;

  /** Multi-part transmission */
  multipart: boolean;

  /** Acknowledgment requested */
  ackRequested: boolean;

  /** Compressed payload */
  compressed: boolean;

  /** Encrypted payload */
  encrypted: boolean;

  /** Mesh routing information included */
  meshRouting: boolean;

  /** Broadcast transmission */
  broadcast: boolean;

  /** Relay transmission */
  relay: boolean;
}

export enum ContentType {
  CHUNK = 'CHUNK',
  CQ_BEACON = 'CQ_BEACON',
  ROUTE_UPDATE = 'ROUTE_UPDATE',
  MESH_ANNOUNCEMENT = 'MESH_ANNOUNCEMENT',
  EMERGENCY_MESSAGE = 'EMERGENCY_MESSAGE',
  HTTP_REQUEST = 'HTTP_REQUEST',
  HTTP_RESPONSE = 'HTTP_RESPONSE',
  FILE_TRANSFER = 'FILE_TRANSFER',
  TELEMETRY = 'TELEMETRY',
  CONTROL = 'CONTROL'
}

export enum EncodingType {
  BINARY = 'BINARY',
  BASE64 = 'BASE64',
  ASCII = 'ASCII',
  UTF8 = 'UTF8',
  PACKET_RADIO = 'PACKET_RADIO',
  PSK31 = 'PSK31',
  RTTY = 'RTTY',
  CUSTOM = 'CUSTOM'
}

export enum CompressionType {
  NONE = 'NONE',
  GZIP = 'GZIP',
  LZ4 = 'LZ4',
  BROTLI = 'BROTLI',
  CUSTOM = 'CUSTOM'
}

export enum ErrorCorrectionType {
  NONE = 'NONE',
  CHECKSUM = 'CHECKSUM',
  CRC16 = 'CRC16',
  CRC32 = 'CRC32',
  REED_SOLOMON = 'REED_SOLOMON',
  TURBO_CODE = 'TURBO_CODE',
  LDPC = 'LDPC',
  CONVOLUTIONAL = 'CONVOLUTIONAL'
}

export enum DecodingAlgorithm {
  DIRECT = 'DIRECT',
  VITERBI = 'VITERBI',
  TURBO = 'TURBO',
  BELIEF_PROPAGATION = 'BELIEF_PROPAGATION',
  CHASE = 'CHASE',
  CUSTOM = 'CUSTOM'
}

/**
 * Transmission validation and processing utilities
 */
export class TransmissionProcessor {
  /**
   * Validates a decoded transmission
   */
  static validate(transmission: DecodedTransmission): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!transmission.id) errors.push('Transmission ID is required');
    if (!transmission.sourceCallsign) errors.push('Source callsign is required');
    if (!this.isValidCallsign(transmission.sourceCallsign)) {
      errors.push('Invalid callsign format');
    }

    if (transmission.frequency <= 0) errors.push('Frequency must be positive');
    if (!transmission.timestamp) errors.push('Timestamp is required');
    if (!transmission.payload || transmission.payload.length === 0) {
      errors.push('Payload is required');
    }

    if (transmission.payloadSize !== transmission.payload.length) {
      errors.push('Payload size mismatch');
    }

    // Validate signal quality
    if (transmission.signalQuality) {
      const qualityErrors = this.validateSignalQuality(transmission.signalQuality);
      errors.push(...qualityErrors);
    }

    // Validate metadata
    if (transmission.metadata) {
      const metadataErrors = this.validateMetadata(transmission.metadata);
      errors.push(...metadataErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates amateur radio callsign format
   */
  private static isValidCallsign(callsign: string): boolean {
    // Basic amateur radio callsign validation
    const callsignRegex = /^[A-Z0-9]{3,7}$/;
    return callsignRegex.test(callsign);
  }

  /**
   * Validates signal quality parameters
   */
  private static validateSignalQuality(quality: SignalQuality): string[] {
    const errors: string[] = [];

    if (quality.snr < -20 || quality.snr > 60) {
      errors.push('SNR should be between -20 and 60 dB');
    }

    if (quality.rssi < -150 || quality.rssi > 0) {
      errors.push('RSSI should be between -150 and 0 dB');
    }

    if (quality.symbolErrorRate && (quality.symbolErrorRate < 0 || quality.symbolErrorRate > 1)) {
      errors.push('Symbol error rate must be between 0 and 1');
    }

    return errors;
  }

  /**
   * Validates transmission metadata
   */
  private static validateMetadata(metadata: TransmissionMetadata): string[] {
    const errors: string[] = [];

    if (!metadata.protocolVersion) {
      errors.push('Protocol version is required');
    }

    if (!metadata.payloadHash) {
      errors.push('Payload hash is required');
    }

    if (metadata.totalParts && metadata.partNumber) {
      if (metadata.partNumber > metadata.totalParts) {
        errors.push('Part number cannot exceed total parts');
      }
      if (metadata.partNumber < 1) {
        errors.push('Part number must be positive');
      }
    }

    return errors;
  }

  /**
   * Verifies payload integrity using hash
   */
  static verifyPayloadIntegrity(transmission: DecodedTransmission): boolean {
    if (!transmission.metadata.payloadHash) return false;

    // Calculate hash of actual payload
    const calculatedHash = this.calculatePayloadHash(transmission.payload);
    return calculatedHash === transmission.metadata.payloadHash;
  }

  /**
   * Calculates SHA-256 hash of payload
   */
  private static calculatePayloadHash(payload: Uint8Array): string {
    // In a real implementation, this would use Web Crypto API
    // For now, return a simplified hash
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) - hash + payload[i]) & 0xffffffff;
    }
    return `sha256-${hash.toString(16)}`;
  }

  /**
   * Extracts HTTP data from transmission payload
   */
  static extractHttpData(transmission: DecodedTransmission): HttpData | null {
    if (transmission.contentType !== ContentType.HTTP_REQUEST &&
        transmission.contentType !== ContentType.HTTP_RESPONSE) {
      return null;
    }

    try {
      const textDecoder = new TextDecoder();
      const httpText = textDecoder.decode(transmission.payload);

      return this.parseHttpMessage(httpText, transmission.contentType);
    } catch (error) {
      console.error('Failed to extract HTTP data:', error);
      return null;
    }
  }

  /**
   * Parses HTTP message from text
   */
  private static parseHttpMessage(httpText: string, contentType: ContentType): HttpData {
    const lines = httpText.split('\r\n');
    const headers: Record<string, string> = {};
    let bodyStartIndex = -1;

    // Find headers and body separator
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '') {
        bodyStartIndex = i + 1;
        break;
      }

      const headerMatch = lines[i].match(/^([^:]+):\s*(.+)$/);
      if (headerMatch) {
        headers[headerMatch[1].toLowerCase()] = headerMatch[2];
      }
    }

    const body = bodyStartIndex >= 0 ? lines.slice(bodyStartIndex).join('\r\n') : '';

    if (contentType === ContentType.HTTP_REQUEST) {
      const requestMatch = lines[0].match(/^(\w+)\s+([^\s]+)\s+HTTP\/(.+)$/);
      return {
        type: 'request',
        method: requestMatch?.[1] || 'GET',
        path: requestMatch?.[2] || '/',
        version: requestMatch?.[3] || '1.1',
        headers,
        body
      };
    } else {
      const responseMatch = lines[0].match(/^HTTP\/([^\s]+)\s+(\d+)\s*(.*)$/);
      return {
        type: 'response',
        version: responseMatch?.[1] || '1.1',
        statusCode: parseInt(responseMatch?.[2] || '200'),
        statusText: responseMatch?.[3] || 'OK',
        headers,
        body
      };
    }
  }

  /**
   * Calculates transmission efficiency metrics
   */
  static calculateEfficiency(transmission: DecodedTransmission): TransmissionEfficiency {
    const totalBits = transmission.payloadSize * 8;
    const correctedErrors = transmission.decodingResults?.correctedErrors || 0;
    const errorRate = transmission.decodingResults?.bitErrorRate || 0;

    const dataEfficiency = transmission.metadata.compression !== CompressionType.NONE ?
      this.estimateCompressionRatio(transmission) : 1.0;

    const errorCorrectionOverhead = this.calculateECOverhead(transmission.metadata.errorCorrection);

    return {
      dataEfficiency,
      errorCorrectionOverhead,
      totalEfficiency: dataEfficiency * (1 - errorCorrectionOverhead),
      bitErrorRate: errorRate,
      correctedErrors,
      throughput: this.calculateThroughput(transmission)
    };
  }

  /**
   * Estimates compression ratio
   */
  private static estimateCompressionRatio(transmission: DecodedTransmission): number {
    // Estimate based on compression type and content
    switch (transmission.metadata.compression) {
      case CompressionType.GZIP:
        return 0.7; // 30% compression typical
      case CompressionType.LZ4:
        return 0.8; // 20% compression, faster
      case CompressionType.BROTLI:
        return 0.6; // 40% compression
      default:
        return 1.0;
    }
  }

  /**
   * Calculates error correction overhead
   */
  private static calculateECOverhead(ecType: ErrorCorrectionType): number {
    switch (ecType) {
      case ErrorCorrectionType.CHECKSUM:
      case ErrorCorrectionType.CRC16:
        return 0.02; // 2% overhead
      case ErrorCorrectionType.CRC32:
        return 0.04; // 4% overhead
      case ErrorCorrectionType.REED_SOLOMON:
        return 0.25; // 25% overhead typical
      case ErrorCorrectionType.TURBO_CODE:
        return 0.33; // 33% overhead
      case ErrorCorrectionType.CONVOLUTIONAL:
        return 0.50; // 50% overhead
      default:
        return 0.0;
    }
  }

  /**
   * Calculates transmission throughput
   */
  private static calculateThroughput(transmission: DecodedTransmission): number {
    const decodingTime = transmission.decodingResults?.decodingTime || 1000; // ms
    const bitsTransmitted = transmission.payloadSize * 8;

    // bits per second
    return (bitsTransmitted / decodingTime) * 1000;
  }
}

/**
 * HTTP data structure for extracted HTTP transmissions
 */
export interface HttpData {
  type: 'request' | 'response';
  method?: string;
  path?: string;
  version: string;
  statusCode?: number;
  statusText?: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Transmission efficiency metrics
 */
export interface TransmissionEfficiency {
  /** Data compression efficiency (0-1) */
  dataEfficiency: number;

  /** Error correction overhead (0-1) */
  errorCorrectionOverhead: number;

  /** Overall transmission efficiency (0-1) */
  totalEfficiency: number;

  /** Bit error rate before correction */
  bitErrorRate: number;

  /** Number of corrected errors */
  correctedErrors: number;

  /** Throughput in bits per second */
  throughput: number;
}

/**
 * Factory for creating transmission objects
 */
export class TransmissionFactory {
  /**
   * Creates a transmission from raw decoded data
   */
  static createFromDecodedData(
    sourceCallsign: string,
    frequency: number,
    signalQuality: SignalQuality,
    payload: Uint8Array,
    contentType: ContentType
  ): DecodedTransmission {
    const id = this.generateTransmissionId(sourceCallsign, frequency);
    const payloadHash = TransmissionProcessor.calculatePayloadHash(payload);

    return {
      id,
      sourceCallsign,
      frequency,
      timestamp: new Date(),
      signalQuality,
      contentType,
      payload,
      verified: false, // Will be set after verification
      cached: false,   // Will be set after caching decision
      payloadSize: payload.length,
      metadata: {
        protocolVersion: '1.0',
        encoding: EncodingType.BINARY,
        compression: CompressionType.NONE,
        errorCorrection: ErrorCorrectionType.CRC32,
        payloadHash,
        flags: {
          emergency: false,
          multipart: false,
          ackRequested: false,
          compressed: false,
          encrypted: false,
          meshRouting: false,
          broadcast: true,
          relay: false
        }
      }
    };
  }

  /**
   * Generates unique transmission ID
   */
  private static generateTransmissionId(callsign: string, frequency: number): string {
    const timestamp = Date.now();
    const freqMHz = Math.round(frequency / 1000);
    return `${callsign}-${freqMHz}-${timestamp}`;
  }
}

export default DecodedTransmission;