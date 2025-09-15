/**
 * CompressionProfile Entity Model for Ham Radio Web Communication
 *
 * Represents compression settings and profiles optimized for
 * different ham radio transmission scenarios and band conditions.
 */

export interface CompressionProfileData {
  id: string;
  name: string;
  description: string;

  // Target constraints
  targetSize: number; // bytes
  maxDimensions: {
    width: number;
    height: number;
  };

  // Quality settings for progressive transmission
  qualitySettings: number[]; // Array of quality levels (0.1 to 1.0)

  // Format settings
  format: 'jpeg' | 'webp';
  fallbackFormat: 'jpeg';

  // Transmission settings
  chunkSize: number; // bytes per chunk
  progressiveEnabled: boolean;

  // Band-specific optimizations
  bandType: 'HF' | 'VHF' | 'UHF' | 'Microwave';
  bandwidthTarget: number; // bps
  errorCorrectionLevel: 'none' | 'low' | 'medium' | 'high';

  // Advanced settings
  adaptiveQuality: boolean;
  prioritizeBase: boolean; // Prioritize base quality for quick preview
  emergencyOptimized: boolean; // Optimized for emergency communications

  // Usage tracking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // callsign
  isSystemProfile: boolean; // Built-in vs user-created
  usageCount: number;

  // Performance metrics
  averageCompressionRatio: number;
  averageTransmissionTime: number;
  successRate: number; // percentage of successful transmissions

  // Validation rules
  maxFileSize: number; // Maximum input file size
  supportedFormats: string[]; // Input formats this profile can handle
}

export interface CompressionSettings {
  quality: number;
  progressive: boolean;
  optimizeFor: 'size' | 'quality' | 'speed';
  stripMetadata: boolean;
  dithering: boolean;
}

export interface BandOptimization {
  chunkSizeMultiplier: number;
  qualityReduction: number;
  errorToleranceIncrease: number;
  retransmissionThreshold: number;
}

export class CompressionProfile implements CompressionProfileData {
  id: string;
  name: string;
  description: string;
  targetSize: number;
  maxDimensions: { width: number; height: number };
  qualitySettings: number[];
  format: 'jpeg' | 'webp';
  fallbackFormat: 'jpeg';
  chunkSize: number;
  progressiveEnabled: boolean;
  bandType: 'HF' | 'VHF' | 'UHF' | 'Microwave';
  bandwidthTarget: number;
  errorCorrectionLevel: 'none' | 'low' | 'medium' | 'high';
  adaptiveQuality: boolean;
  prioritizeBase: boolean;
  emergencyOptimized: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isSystemProfile: boolean;
  usageCount: number;
  averageCompressionRatio: number;
  averageTransmissionTime: number;
  successRate: number;
  maxFileSize: number;
  supportedFormats: string[];

  constructor(data: Partial<CompressionProfileData>) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.description = data.description || '';
    this.targetSize = data.targetSize || 5000;
    this.maxDimensions = data.maxDimensions || { width: 320, height: 240 };
    this.qualitySettings = data.qualitySettings || [0.1, 0.3, 0.5, 0.8];
    this.format = data.format || 'jpeg';
    this.fallbackFormat = 'jpeg';
    this.chunkSize = data.chunkSize || 512;
    this.progressiveEnabled = data.progressiveEnabled !== false;
    this.bandType = data.bandType || 'VHF';
    this.bandwidthTarget = data.bandwidthTarget || 2400;
    this.errorCorrectionLevel = data.errorCorrectionLevel || 'medium';
    this.adaptiveQuality = data.adaptiveQuality !== false;
    this.prioritizeBase = data.prioritizeBase !== false;
    this.emergencyOptimized = data.emergencyOptimized || false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.createdBy = data.createdBy || '';
    this.isSystemProfile = data.isSystemProfile || false;
    this.usageCount = data.usageCount || 0;
    this.averageCompressionRatio = data.averageCompressionRatio || 0;
    this.averageTransmissionTime = data.averageTransmissionTime || 0;
    this.successRate = data.successRate || 100;
    this.maxFileSize = data.maxFileSize || 5 * 1024 * 1024; // 5MB
    this.supportedFormats = data.supportedFormats || ['jpeg', 'jpg', 'png', 'webp'];
  }

  /**
   * Generate unique profile ID
   */
  private generateId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get compression settings for a specific quality level
   */
  getCompressionSettings(qualityLevel: number): CompressionSettings {
    return {
      quality: qualityLevel,
      progressive: this.progressiveEnabled,
      optimizeFor: this.emergencyOptimized ? 'size' : 'quality',
      stripMetadata: true, // Always strip for ham radio to save bandwidth
      dithering: qualityLevel < 0.3 // Use dithering for very low quality
    };
  }

  /**
   * Get band-specific optimizations
   */
  getBandOptimization(): BandOptimization {
    switch (this.bandType) {
      case 'HF':
        return {
          chunkSizeMultiplier: 0.5, // Smaller chunks for HF
          qualityReduction: 0.2, // Reduce quality for reliability
          errorToleranceIncrease: 0.3,
          retransmissionThreshold: 0.15
        };
      case 'VHF':
        return {
          chunkSizeMultiplier: 1.0, // Standard chunks
          qualityReduction: 0.1,
          errorToleranceIncrease: 0.1,
          retransmissionThreshold: 0.05
        };
      case 'UHF':
        return {
          chunkSizeMultiplier: 1.5, // Larger chunks possible
          qualityReduction: 0.0,
          errorToleranceIncrease: 0.05,
          retransmissionThreshold: 0.02
        };
      case 'Microwave':
        return {
          chunkSizeMultiplier: 2.0, // Much larger chunks
          qualityReduction: 0.0,
          errorToleranceIncrease: 0.0,
          retransmissionThreshold: 0.01
        };
      default:
        return {
          chunkSizeMultiplier: 1.0,
          qualityReduction: 0.1,
          errorToleranceIncrease: 0.1,
          retransmissionThreshold: 0.05
        };
    }
  }

  /**
   * Calculate effective chunk size for this band
   */
  getEffectiveChunkSize(): number {
    const optimization = this.getBandOptimization();
    return Math.round(this.chunkSize * optimization.chunkSizeMultiplier);
  }

  /**
   * Get adjusted quality settings for band conditions
   */
  getAdjustedQualitySettings(): number[] {
    const optimization = this.getBandOptimization();
    return this.qualitySettings.map(quality =>
      Math.max(0.05, quality - optimization.qualityReduction)
    );
  }

  /**
   * Estimate transmission time for given file size
   */
  estimateTransmissionTime(fileSizeBytes: number): number {
    const overhead = 1.2; // 20% protocol overhead
    const effectiveSize = fileSizeBytes * overhead;
    return (effectiveSize * 8) / this.bandwidthTarget; // seconds
  }

  /**
   * Check if profile is suitable for emergency use
   */
  isSuitableForEmergency(): boolean {
    return this.emergencyOptimized &&
           this.targetSize <= 10000 && // Under 10KB
           this.maxDimensions.width <= 320 &&
           this.maxDimensions.height <= 240 &&
           this.estimateTransmissionTime(this.targetSize) <= 30; // Under 30 seconds
  }

  /**
   * Validate profile settings
   */
  validate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!this.name.trim()) {
      errors.push('Profile name is required');
    }

    if (!this.createdBy || !this.isValidCallsign(this.createdBy)) {
      errors.push('Valid callsign required for createdBy field');
    }

    // Settings validation
    if (this.targetSize <= 0) {
      errors.push('Target size must be positive');
    }

    if (this.targetSize > 100000) {
      warnings.push('Target size over 100KB may be too large for ham radio');
    }

    if (this.maxDimensions.width <= 0 || this.maxDimensions.height <= 0) {
      errors.push('Maximum dimensions must be positive');
    }

    if (this.qualitySettings.length === 0) {
      errors.push('At least one quality setting is required');
    }

    if (this.qualitySettings.some(q => q < 0.05 || q > 1.0)) {
      errors.push('Quality settings must be between 0.05 and 1.0');
    }

    if (this.chunkSize <= 0) {
      errors.push('Chunk size must be positive');
    }

    if (this.chunkSize > 2048) {
      warnings.push('Large chunk sizes may cause transmission issues on HF');
    }

    if (this.bandwidthTarget <= 0) {
      errors.push('Bandwidth target must be positive');
    }

    // Emergency optimization warnings
    if (this.emergencyOptimized) {
      if (this.targetSize > 15000) {
        warnings.push('Emergency profiles should target under 15KB');
      }
      if (this.estimateTransmissionTime(this.targetSize) > 60) {
        warnings.push('Emergency transmission should complete under 60 seconds');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update usage statistics
   */
  recordUsage(compressionRatio: number, transmissionTimeSeconds: number, success: boolean): void {
    this.usageCount++;

    // Update rolling averages
    const weight = 1 / this.usageCount;
    this.averageCompressionRatio = (this.averageCompressionRatio * (1 - weight)) + (compressionRatio * weight);
    this.averageTransmissionTime = (this.averageTransmissionTime * (1 - weight)) + (transmissionTimeSeconds * weight);

    // Update success rate
    const successRate = success ? 100 : 0;
    this.successRate = (this.successRate * (1 - weight)) + (successRate * weight);

    this.updatedAt = new Date();
  }

  /**
   * Clone profile with modifications
   */
  clone(modifications: Partial<CompressionProfileData> = {}): CompressionProfile {
    const clonedData = {
      ...this.toJSON(),
      id: '', // Generate new ID
      name: `${this.name} (Copy)`,
      isSystemProfile: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      ...modifications
    };

    return new CompressionProfile(clonedData);
  }

  /**
   * Update profile settings
   */
  update(updates: Partial<CompressionProfileData>): void {
    Object.assign(this, updates);
    this.updatedAt = new Date();
  }

  /**
   * Validate amateur radio callsign format
   */
  private isValidCallsign(callsign: string): boolean {
    const callsignRegex = /^[A-Z]{1,2}[0-9][A-Z]{1,3}$/;
    return callsignRegex.test(callsign.toUpperCase());
  }

  /**
   * Convert to JSON for storage
   */
  toJSON(): CompressionProfileData {
    return { ...this };
  }

  /**
   * Create instance from JSON
   */
  static fromJSON(data: any): CompressionProfile {
    return new CompressionProfile(data);
  }

  /**
   * Create predefined system profiles
   */
  static createSystemProfiles(): CompressionProfile[] {
    return [
      // Emergency profile - absolute minimum for urgent communications
      new CompressionProfile({
        id: 'emergency',
        name: 'Emergency',
        description: 'Optimized for emergency communications - smallest size, fastest transmission',
        targetSize: 2000,
        maxDimensions: { width: 160, height: 120 },
        qualitySettings: [0.05, 0.1],
        format: 'jpeg',
        chunkSize: 256,
        bandType: 'HF',
        bandwidthTarget: 1200,
        emergencyOptimized: true,
        prioritizeBase: true,
        isSystemProfile: true,
        createdBy: 'SYSTEM'
      }),

      // Thumbnail profile - quick previews
      new CompressionProfile({
        id: 'thumbnail',
        name: 'Thumbnail',
        description: 'Small thumbnails for quick preview - good for weather maps',
        targetSize: 3000,
        maxDimensions: { width: 200, height: 150 },
        qualitySettings: [0.1, 0.3],
        format: 'jpeg',
        chunkSize: 512,
        bandType: 'VHF',
        bandwidthTarget: 2400,
        prioritizeBase: true,
        isSystemProfile: true,
        createdBy: 'SYSTEM'
      }),

      // Standard profile - good quality/size balance
      new CompressionProfile({
        id: 'standard',
        name: 'Standard',
        description: 'Balanced quality and size - suitable for most applications',
        targetSize: 8000,
        maxDimensions: { width: 320, height: 240 },
        qualitySettings: [0.1, 0.3, 0.5, 0.8],
        format: 'jpeg',
        chunkSize: 512,
        bandType: 'VHF',
        bandwidthTarget: 2400,
        isSystemProfile: true,
        createdBy: 'SYSTEM'
      }),

      // High quality profile - for important diagrams
      new CompressionProfile({
        id: 'high-quality',
        name: 'High Quality',
        description: 'Higher quality for technical diagrams and detailed images',
        targetSize: 25000,
        maxDimensions: { width: 640, height: 480 },
        qualitySettings: [0.1, 0.3, 0.5, 0.8, 0.9],
        format: 'webp',
        fallbackFormat: 'jpeg',
        chunkSize: 1024,
        bandType: 'UHF',
        bandwidthTarget: 9600,
        isSystemProfile: true,
        createdBy: 'SYSTEM'
      }),

      // HF optimized profile
      new CompressionProfile({
        id: 'hf-optimized',
        name: 'HF Optimized',
        description: 'Optimized for HF band conditions - very small chunks, robust error correction',
        targetSize: 5000,
        maxDimensions: { width: 240, height: 180 },
        qualitySettings: [0.1, 0.2, 0.4],
        format: 'jpeg',
        chunkSize: 256,
        bandType: 'HF',
        bandwidthTarget: 1200,
        errorCorrectionLevel: 'high',
        adaptiveQuality: true,
        isSystemProfile: true,
        createdBy: 'SYSTEM'
      })
    ];
  }
}