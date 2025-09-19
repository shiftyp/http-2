/**
 * CompressionProfile Model (T018)
 * 
 * Configuration profiles for media compression,
 * optimized for different transmission scenarios.
 */

export type MediaFormat = 'jpeg' | 'webp' | 'png' | 'opus' | 'webm' | 'pdf';
export type CompressionAlgorithm = 'mozjpeg' | 'libwebp' | 'opus' | 'vp9' | 'deflate' | 'lz77';
export type QualityPreset = 'emergency' | 'low' | 'medium' | 'high' | 'lossless';
export type OptimizationTarget = 'size' | 'quality' | 'speed' | 'balanced';

export interface CompressionSettings {
  // Quality settings
  quality: number; // 1-100
  lossless: boolean;
  progressive: boolean;
  
  // Size constraints
  maxSize?: number; // bytes
  targetSize?: number; // bytes
  maxDimensions?: {
    width: number;
    height: number;
  };
  
  // Format-specific settings
  jpeg?: {
    chroma: 'yuv420' | 'yuv422' | 'yuv444';
    dct: 'int' | 'fast' | 'float';
    trellis: boolean;
    optimize: boolean;
    smoothing: number; // 0-100
  };
  
  webp?: {
    method: number; // 0-6, 6 = slowest/best
    autoFilter: boolean;
    sharpness: number; // 0-7
    alpha: boolean;
  };
  
  opus?: {
    bitrate: number; // bps
    vbr: boolean;
    bandwidth: 'narrowband' | 'mediumband' | 'wideband' | 'superwideband' | 'fullband';
    application: 'voip' | 'audio' | 'lowdelay';
    complexity: number; // 0-10
  };
  
  webm?: {
    bitrate: number; // bps
    keyframeInterval: number; // seconds
    passes: 1 | 2;
    crf: number; // 0-63, lower = better quality
    speed: number; // 0-8, higher = faster
  };
}

export interface PerformanceConstraints {
  maxEncodingTime: number; // ms
  maxMemoryUsage: number; // bytes
  cpuIntensive: boolean;
  parallelProcessing: boolean;
  useWebAssembly: boolean;
}

export interface RadioConstraints {
  fccCompliant: boolean;
  maxBandwidth: number; // Hz
  transmissionMode: 'RF' | 'WebRTC' | 'Hybrid';
  errorTolerance: 'low' | 'medium' | 'high';
  retransmissionCost: number; // relative cost 1-10
}

export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  qualityScore?: number; // SSIM, PSNR, etc.
  encodingTime: number; // ms
  decodingTime?: number; // ms
  cpuUsage: number; // %
  memoryUsage: number; // bytes
  psnr?: number; // dB for images/video
  ssim?: number; // 0-1 for images/video
}

/**
 * Main CompressionProfile interface
 */
export interface CompressionProfile {
  // Identification
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Target media types
  supportedFormats: MediaFormat[];
  primaryFormat: MediaFormat;
  
  // Configuration
  preset: QualityPreset;
  algorithm: CompressionAlgorithm;
  target: OptimizationTarget;
  settings: CompressionSettings;
  
  // Constraints
  performance: PerformanceConstraints;
  radio: RadioConstraints;
  
  // Usage context
  useCase: string;
  scenarios: string[];
  
  // Validation
  enabled: boolean;
  tested: boolean;
  lastUpdated: Date;
  
  // Statistics (populated during use)
  usage?: {
    timesUsed: number;
    averageRatio: number;
    averageTime: number;
    successRate: number;
    lastUsed?: Date;
  };
}

/**
 * Predefined compression profiles
 */
export class CompressionProfiles {
  /**
   * Emergency/disaster communications profile
   */
  static readonly EMERGENCY: CompressionProfile = {
    id: 'emergency',
    name: 'Emergency Communications',
    description: 'Maximum compression for emergency traffic',
    version: '1.0.0',
    supportedFormats: ['jpeg', 'opus', 'webm'],
    primaryFormat: 'jpeg',
    preset: 'emergency',
    algorithm: 'mozjpeg',
    target: 'size',
    settings: {
      quality: 15,
      lossless: false,
      progressive: false,
      maxSize: 1024, // 1KB max
      maxDimensions: { width: 320, height: 240 },
      jpeg: {
        chroma: 'yuv420',
        dct: 'fast',
        trellis: false,
        optimize: true,
        smoothing: 20
      },
      opus: {
        bitrate: 16000,
        vbr: true,
        bandwidth: 'narrowband',
        application: 'voip',
        complexity: 0
      }
    },
    performance: {
      maxEncodingTime: 2000,
      maxMemoryUsage: 16 * 1024 * 1024, // 16MB
      cpuIntensive: false,
      parallelProcessing: false,
      useWebAssembly: true
    },
    radio: {
      fccCompliant: true,
      maxBandwidth: 2800,
      transmissionMode: 'RF',
      errorTolerance: 'high',
      retransmissionCost: 8
    },
    useCase: 'Emergency disaster communications',
    scenarios: ['disaster', 'emergency', 'health-welfare'],
    enabled: true,
    tested: true,
    lastUpdated: new Date('2025-01-15')
  };
  
  /**
   * Low bandwidth HF profile
   */
  static readonly HF_LOW: CompressionProfile = {
    id: 'hf-low',
    name: 'HF Low Bandwidth',
    description: 'Optimized for HF radio conditions',
    version: '1.0.0',
    supportedFormats: ['jpeg', 'webp', 'opus'],
    primaryFormat: 'webp',
    preset: 'low',
    algorithm: 'libwebp',
    target: 'balanced',
    settings: {
      quality: 25,
      lossless: false,
      progressive: true,
      maxSize: 2048, // 2KB
      webp: {
        method: 6,
        autoFilter: true,
        sharpness: 3,
        alpha: false
      },
      opus: {
        bitrate: 24000,
        vbr: true,
        bandwidth: 'mediumband',
        application: 'voip',
        complexity: 5
      }
    },
    performance: {
      maxEncodingTime: 5000,
      maxMemoryUsage: 32 * 1024 * 1024,
      cpuIntensive: true,
      parallelProcessing: true,
      useWebAssembly: true
    },
    radio: {
      fccCompliant: true,
      maxBandwidth: 2800,
      transmissionMode: 'RF',
      errorTolerance: 'medium',
      retransmissionCost: 6
    },
    useCase: 'HF radio with poor propagation',
    scenarios: ['hf', 'poor-conditions', 'long-distance'],
    enabled: true,
    tested: true,
    lastUpdated: new Date('2025-01-15')
  };
  
  /**
   * Medium quality profile for normal operations
   */
  static readonly NORMAL: CompressionProfile = {
    id: 'normal',
    name: 'Normal Quality',
    description: 'Balanced quality and size for regular use',
    version: '1.0.0',
    supportedFormats: ['jpeg', 'webp', 'opus', 'webm'],
    primaryFormat: 'jpeg',
    preset: 'medium',
    algorithm: 'mozjpeg',
    target: 'balanced',
    settings: {
      quality: 50,
      lossless: false,
      progressive: true,
      maxSize: 5120, // 5KB
      maxDimensions: { width: 800, height: 600 },
      jpeg: {
        chroma: 'yuv420',
        dct: 'int',
        trellis: true,
        optimize: true,
        smoothing: 0
      }
    },
    performance: {
      maxEncodingTime: 10000,
      maxMemoryUsage: 64 * 1024 * 1024,
      cpuIntensive: true,
      parallelProcessing: true,
      useWebAssembly: true
    },
    radio: {
      fccCompliant: true,
      maxBandwidth: 3000,
      transmissionMode: 'Hybrid',
      errorTolerance: 'medium',
      retransmissionCost: 4
    },
    useCase: 'Regular amateur radio communications',
    scenarios: ['routine', 'local', 'net'],
    enabled: true,
    tested: true,
    lastUpdated: new Date('2025-01-15')
  };
  
  /**
   * High quality profile for good conditions
   */
  static readonly HIGH_QUALITY: CompressionProfile = {
    id: 'high-quality',
    name: 'High Quality',
    description: 'Maximum quality with moderate compression',
    version: '1.0.0',
    supportedFormats: ['jpeg', 'webp', 'opus', 'webm', 'png'],
    primaryFormat: 'webp',
    preset: 'high',
    algorithm: 'libwebp',
    target: 'quality',
    settings: {
      quality: 80,
      lossless: false,
      progressive: true,
      maxSize: 20480, // 20KB
      webp: {
        method: 6,
        autoFilter: true,
        sharpness: 7,
        alpha: true
      },
      opus: {
        bitrate: 64000,
        vbr: true,
        bandwidth: 'fullband',
        application: 'audio',
        complexity: 10
      }
    },
    performance: {
      maxEncodingTime: 30000,
      maxMemoryUsage: 128 * 1024 * 1024,
      cpuIntensive: true,
      parallelProcessing: true,
      useWebAssembly: true
    },
    radio: {
      fccCompliant: true,
      maxBandwidth: 6000,
      transmissionMode: 'WebRTC',
      errorTolerance: 'low',
      retransmissionCost: 2
    },
    useCase: 'High-speed data or internet gateway',
    scenarios: ['broadband', 'internet', 'high-speed'],
    enabled: true,
    tested: true,
    lastUpdated: new Date('2025-01-15')
  };
  
  /**
   * Lossless profile for critical data
   */
  static readonly LOSSLESS: CompressionProfile = {
    id: 'lossless',
    name: 'Lossless Compression',
    description: 'No quality loss, larger files',
    version: '1.0.0',
    supportedFormats: ['png', 'webp', 'opus'],
    primaryFormat: 'png',
    preset: 'lossless',
    algorithm: 'deflate',
    target: 'quality',
    settings: {
      quality: 100,
      lossless: true,
      progressive: false,
      webp: {
        method: 6,
        autoFilter: false,
        sharpness: 0,
        alpha: true
      }
    },
    performance: {
      maxEncodingTime: 60000,
      maxMemoryUsage: 256 * 1024 * 1024,
      cpuIntensive: true,
      parallelProcessing: true,
      useWebAssembly: false
    },
    radio: {
      fccCompliant: true,
      maxBandwidth: 12000,
      transmissionMode: 'WebRTC',
      errorTolerance: 'low',
      retransmissionCost: 1
    },
    useCase: 'Critical documents and technical diagrams',
    scenarios: ['technical', 'legal', 'archival'],
    enabled: true,
    tested: true,
    lastUpdated: new Date('2025-01-15')
  };
  
  /**
   * Get all predefined profiles
   */
  static getAll(): CompressionProfile[] {
    return [this.EMERGENCY, this.HF_LOW, this.NORMAL, this.HIGH_QUALITY, this.LOSSLESS];
  }
  
  /**
   * Get profile by ID
   */
  static getById(id: string): CompressionProfile | null {
    return this.getAll().find(profile => profile.id === id) || null;
  }
  
  /**
   * Get profiles suitable for a format
   */
  static getByFormat(format: MediaFormat): CompressionProfile[] {
    return this.getAll().filter(profile => 
      profile.supportedFormats.includes(format)
    );
  }
  
  /**
   * Get profiles suitable for transmission mode
   */
  static getByMode(mode: 'RF' | 'WebRTC' | 'Hybrid'): CompressionProfile[] {
    return this.getAll().filter(profile => 
      profile.radio.transmissionMode === mode || profile.radio.transmissionMode === 'Hybrid'
    );
  }
}

/**
 * CompressionProfile utilities
 */
export class CompressionProfileUtils {
  /**
   * Select optimal profile based on constraints
   */
  static selectOptimal(
    format: MediaFormat,
    fileSize: number,
    constraints: {
      maxOutputSize?: number;
      maxEncodingTime?: number;
      transmissionMode?: 'RF' | 'WebRTC' | 'Hybrid';
      priority?: 'size' | 'quality' | 'speed';
    }
  ): CompressionProfile {
    let candidates = CompressionProfiles.getByFormat(format);
    
    // Filter by transmission mode
    if (constraints.transmissionMode) {
      candidates = candidates.filter(profile => 
        profile.radio.transmissionMode === constraints.transmissionMode ||
        profile.radio.transmissionMode === 'Hybrid'
      );
    }
    
    // Filter by output size constraint
    if (constraints.maxOutputSize) {
      candidates = candidates.filter(profile => 
        !profile.settings.maxSize || 
        profile.settings.maxSize <= constraints.maxOutputSize!
      );
    }
    
    // Filter by encoding time constraint
    if (constraints.maxEncodingTime) {
      candidates = candidates.filter(profile => 
        profile.performance.maxEncodingTime <= constraints.maxEncodingTime!
      );
    }
    
    if (candidates.length === 0) {
      return CompressionProfiles.EMERGENCY; // Fallback
    }
    
    // Sort by priority
    switch (constraints.priority) {
      case 'size':
        return candidates.sort((a, b) => a.settings.quality - b.settings.quality)[0];
      case 'quality':
        return candidates.sort((a, b) => b.settings.quality - a.settings.quality)[0];
      case 'speed':
        return candidates.sort((a, b) => 
          a.performance.maxEncodingTime - b.performance.maxEncodingTime
        )[0];
      default:
        return candidates[0];
    }
  }
  
  /**
   * Estimate compression ratio
   */
  static estimateRatio(
    profile: CompressionProfile,
    format: MediaFormat,
    inputSize: number
  ): number {
    const baseRatios: Record<MediaFormat, number> = {
      jpeg: 0.1,
      webp: 0.08,
      png: 0.7,
      opus: 0.05,
      webm: 0.03,
      pdf: 0.3
    };
    
    let ratio = baseRatios[format] || 0.5;
    
    // Adjust based on quality setting
    const qualityFactor = profile.settings.quality / 100;
    ratio *= (0.5 + qualityFactor * 0.5);
    
    // Adjust for progressive encoding
    if (profile.settings.progressive) {
      ratio *= 1.1;
    }
    
    // Ensure minimum ratio
    return Math.max(ratio, 0.01);
  }
  
  /**
   * Estimate encoding time
   */
  static estimateEncodingTime(
    profile: CompressionProfile,
    inputSize: number
  ): number {
    const baseTimePerMB = {
      'emergency': 500,  // 0.5s per MB
      'low': 1000,       // 1s per MB
      'medium': 2000,    // 2s per MB
      'high': 5000,      // 5s per MB
      'lossless': 10000  // 10s per MB
    };
    
    const baseMsPerMB = baseTimePerMB[profile.preset] || 2000;
    const sizeMB = inputSize / (1024 * 1024);
    
    let estimatedTime = baseMsPerMB * sizeMB;
    
    // Adjust for CPU intensity
    if (profile.performance.cpuIntensive) {
      estimatedTime *= 1.5;
    }
    
    // Adjust for WebAssembly
    if (profile.performance.useWebAssembly) {
      estimatedTime *= 0.7; // WASM is typically faster
    }
    
    return Math.min(estimatedTime, profile.performance.maxEncodingTime);
  }
  
  /**
   * Validate profile configuration
   */
  static validate(profile: CompressionProfile): string[] {
    const errors: string[] = [];
    
    if (!profile.id || !profile.name) {
      errors.push('Profile must have ID and name');
    }
    
    if (profile.settings.quality < 1 || profile.settings.quality > 100) {
      errors.push('Quality must be between 1 and 100');
    }
    
    if (profile.supportedFormats.length === 0) {
      errors.push('Profile must support at least one format');
    }
    
    if (!profile.supportedFormats.includes(profile.primaryFormat)) {
      errors.push('Primary format must be in supported formats');
    }
    
    if (profile.performance.maxEncodingTime <= 0) {
      errors.push('Max encoding time must be positive');
    }
    
    return errors;
  }
  
  /**
   * Create custom profile
   */
  static createCustom(
    baseProfile: CompressionProfile,
    overrides: Partial<CompressionProfile>
  ): CompressionProfile {
    return {
      ...baseProfile,
      ...overrides,
      id: overrides.id || `custom_${Date.now()}`,
      settings: {
        ...baseProfile.settings,
        ...overrides.settings
      },
      performance: {
        ...baseProfile.performance,
        ...overrides.performance
      },
      radio: {
        ...baseProfile.radio,
        ...overrides.radio
      },
      lastUpdated: new Date()
    };
  }
}

export default CompressionProfile;
