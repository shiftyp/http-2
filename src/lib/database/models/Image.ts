/**
 * Image Entity Model for Ham Radio Web Communication
 *
 * Represents an image stored in the system with compression metadata
 * and transmission information for ham radio constraints.
 */

export interface Image {
  id: string;
  filename: string;
  originalBlob: Blob;
  compressedBlob: Blob;

  // Image properties
  dimensions: {
    width: number;
    height: number;
  };
  format: 'jpeg' | 'webp' | 'png';
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;

  // Compression metadata
  quality: number;
  compressionProfile: string; // thumbnail, small, medium
  processingTime: number;
  checksum: string;

  // Progressive transmission data
  progressiveChunks?: ProgressiveChunkData[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: string; // callsign
  description?: string;
  tags?: string[];

  // Ham radio specific
  isEmergency: boolean;
  isCommercial: boolean;
  contentType: 'weather-map' | 'diagram' | 'photo' | 'chart' | 'other';
  fccCompliant: boolean;

  // Transmission history
  transmissionSessions: string[]; // IDs of related TransmissionSession entities
  receptionSessions: string[]; // IDs of related ReceptionSession entities
}

export interface ProgressiveChunkData {
  chunkId: number;
  qualityLevel: number;
  data: Uint8Array;
  size: number;
  checksum: string;
  isBase: boolean;
}

export interface ImageValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
  suggestedFixes?: string[];
}

export class ImageEntity implements Image {
  id: string;
  filename: string;
  originalBlob: Blob;
  compressedBlob: Blob;
  dimensions: { width: number; height: number };
  format: 'jpeg' | 'webp' | 'png';
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  quality: number;
  compressionProfile: string;
  processingTime: number;
  checksum: string;
  progressiveChunks?: ProgressiveChunkData[];
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: string;
  description?: string;
  tags?: string[];
  isEmergency: boolean;
  isCommercial: boolean;
  contentType: 'weather-map' | 'diagram' | 'photo' | 'chart' | 'other';
  fccCompliant: boolean;
  transmissionSessions: string[];
  receptionSessions: string[];

  constructor(data: Partial<Image>) {
    this.id = data.id || this.generateId();
    this.filename = data.filename || '';
    this.originalBlob = data.originalBlob || new Blob();
    this.compressedBlob = data.compressedBlob || new Blob();
    this.dimensions = data.dimensions || { width: 0, height: 0 };
    this.format = data.format || 'jpeg';
    this.originalSize = data.originalSize || 0;
    this.compressedSize = data.compressedSize || 0;
    this.compressionRatio = data.compressionRatio || 1;
    this.quality = data.quality || 0.8;
    this.compressionProfile = data.compressionProfile || 'medium';
    this.processingTime = data.processingTime || 0;
    this.checksum = data.checksum || '';
    this.progressiveChunks = data.progressiveChunks;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.uploadedBy = data.uploadedBy || '';
    this.description = data.description;
    this.tags = data.tags || [];
    this.isEmergency = data.isEmergency || false;
    this.isCommercial = data.isCommercial || false;
    this.contentType = data.contentType || 'other';
    this.fccCompliant = data.fccCompliant !== false; // Default to true unless explicitly false
    this.transmissionSessions = data.transmissionSessions || [];
    this.receptionSessions = data.receptionSessions || [];
  }

  /**
   * Generate a unique ID for the image
   */
  private generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate the image entity for ham radio compliance
   */
  validate(): ImageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestedFixes: string[] = [];

    // Required fields validation
    if (!this.filename) {
      errors.push('Filename is required');
      suggestedFixes.push('Provide a descriptive filename');
    }

    if (!this.uploadedBy || !this.isValidCallsign(this.uploadedBy)) {
      errors.push('Valid callsign is required for uploadedBy field');
      suggestedFixes.push('Provide a valid amateur radio callsign (e.g., KA1ABC)');
    }

    if (!this.originalBlob || this.originalBlob.size === 0) {
      errors.push('Original image data is required');
      suggestedFixes.push('Upload a valid image file');
    }

    if (!this.compressedBlob || this.compressedBlob.size === 0) {
      errors.push('Compressed image data is required');
      suggestedFixes.push('Process the image through compression pipeline');
    }

    // Ham radio compliance validation
    if (this.isCommercial) {
      errors.push('Commercial content is not allowed on amateur radio');
      suggestedFixes.push('Ensure image content is non-commercial');
    }

    // Size and compression validation
    if (this.compressedSize > 50000) { // 50KB limit for reasonable transmission
      warnings.push('Compressed image is quite large and may take long to transmit');
      suggestedFixes.push('Consider reducing quality or dimensions');
    }

    if (this.compressionRatio < 2) {
      warnings.push('Low compression ratio - image may not be optimized for ham radio');
      suggestedFixes.push('Try different compression settings or image format');
    }

    // Dimension validation
    if (this.dimensions.width > 800 || this.dimensions.height > 600) {
      warnings.push('Image dimensions are large for ham radio transmission');
      suggestedFixes.push('Consider resizing to 320x240 or smaller');
    }

    // Progressive chunks validation
    if (this.progressiveChunks) {
      const hasBaseChunk = this.progressiveChunks.some(chunk => chunk.isBase);
      if (!hasBaseChunk) {
        errors.push('Progressive transmission requires a base quality chunk');
        suggestedFixes.push('Regenerate progressive chunks with base quality');
      }
    }

    return {
      isValid: errors.length === 0,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestedFixes: suggestedFixes.length > 0 ? suggestedFixes : undefined
    };
  }

  /**
   * Validate amateur radio callsign format
   */
  private isValidCallsign(callsign: string): boolean {
    // Basic US callsign validation (can be extended for international)
    const callsignRegex = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignRegex.test(callsign.toUpperCase());
  }

  /**
   * Update the entity and set updatedAt timestamp
   */
  update(updates: Partial<Image>): void {
    Object.assign(this, updates);
    this.updatedAt = new Date();
  }

  /**
   * Convert to JSON representation for storage
   */
  toJSON(): Omit<Image, 'originalBlob' | 'compressedBlob'> & {
    originalBlobArrayBuffer: ArrayBuffer;
    compressedBlobArrayBuffer: ArrayBuffer;
  } {
    // Convert blobs to ArrayBuffers for IndexedDB storage
    return {
      ...this,
      originalBlob: undefined as any,
      compressedBlob: undefined as any,
      originalBlobArrayBuffer: new ArrayBuffer(0), // Will be populated by async method
      compressedBlobArrayBuffer: new ArrayBuffer(0) // Will be populated by async method
    };
  }

  /**
   * Create instance from JSON representation
   */
  static fromJSON(data: any): ImageEntity {
    const imageData = { ...data };

    // Convert ArrayBuffers back to Blobs if present
    if (data.originalBlobArrayBuffer) {
      imageData.originalBlob = new Blob([data.originalBlobArrayBuffer]);
    }
    if (data.compressedBlobArrayBuffer) {
      imageData.compressedBlob = new Blob([data.compressedBlobArrayBuffer]);
    }

    return new ImageEntity(imageData);
  }

  /**
   * Calculate transmission time estimate at given bandwidth
   */
  estimateTransmissionTime(bandwidthBps: number): number {
    return (this.compressedSize * 8) / bandwidthBps; // seconds
  }

  /**
   * Get bandwidth savings compared to original
   */
  getBandwidthSavings(): number {
    if (this.originalSize === 0) return 0;
    return ((this.originalSize - this.compressedSize) / this.originalSize) * 100;
  }

  /**
   * Check if image is suitable for emergency transmission
   */
  isSuitableForEmergency(): boolean {
    return (
      this.compressedSize <= 10000 && // Under 10KB for emergency
      this.compressionRatio >= 3 && // Good compression
      this.fccCompliant &&
      !this.isCommercial
    );
  }
}