/**
 * MonitoringConfiguration Model
 * User-defined monitoring settings and frequency allocations
 */

export interface MonitoringConfiguration {
  /** Configuration profile ID */
  id: string;

  /** User-friendly profile name */
  name: string;

  /** Active monitoring status */
  enabled: boolean;

  /** Frequency ranges to monitor */
  frequencyRanges: FrequencyRange[];

  /** Processing priority (1-10, emergency override priority) */
  priority: number;

  /** Assigned SDR device ID */
  deviceAssignment: string;

  /** Allocated bandwidth in Hz */
  bandwidthAllocation: number;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

export interface FrequencyRange {
  /** Center frequency in Hz */
  centerFrequency: number;

  /** Monitoring bandwidth in Hz */
  bandwidth: number;

  /** Amateur radio band designation */
  band: AmateurRadioBand;

  /** Monitoring purpose */
  purpose: MonitoringPurpose;

  /** Enable automatic content decoding */
  decodingEnabled: boolean;

  /** Processing priority within device (1-10) */
  priority: number;
}

export enum AmateurRadioBand {
  BAND_160M = '160M',
  BAND_80M = '80M',
  BAND_40M = '40M',
  BAND_30M = '30M',
  BAND_20M = '20M',
  BAND_17M = '17M',
  BAND_15M = '15M',
  BAND_12M = '12M',
  BAND_10M = '10M',
  BAND_6M = '6M',
  BAND_2M = '2M',
  BAND_70CM = '70CM'
}

export enum MonitoringPurpose {
  CONTENT_DISCOVERY = 'CONTENT_DISCOVERY',
  EMERGENCY = 'EMERGENCY',
  MESH_COORDINATION = 'MESH_COORDINATION',
  EXPERIMENTATION = 'EXPERIMENTATION',
  GENERAL_MONITORING = 'GENERAL_MONITORING'
}

/**
 * Validation rules for monitoring configurations
 */
export class MonitoringConfigurationValidator {
  static validate(config: Partial<MonitoringConfiguration>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!config.id) errors.push('Configuration ID is required');
    if (!config.name || config.name.length === 0) errors.push('Name is required');
    if (!config.deviceAssignment) errors.push('Device assignment is required');
    if (!config.frequencyRanges || config.frequencyRanges.length === 0) {
      errors.push('At least one frequency range is required');
    }

    // Priority validation
    if (config.priority !== undefined && (config.priority < 1 || config.priority > 10)) {
      errors.push('Priority must be between 1 and 10');
    }

    // Emergency priority restrictions
    if (config.priority && config.priority >= 8) {
      const hasEmergencyPurpose = config.frequencyRanges?.some(
        range => range.purpose === MonitoringPurpose.EMERGENCY
      );
      if (!hasEmergencyPurpose) {
        errors.push('High priority (8-10) requires emergency purpose');
      }
    }

    // Frequency range validation
    if (config.frequencyRanges) {
      config.frequencyRanges.forEach((range, index) => {
        const rangeErrors = this.validateFrequencyRange(range, index);
        errors.push(...rangeErrors);
      });

      // Check for overlapping ranges
      const overlaps = this.findOverlappingRanges(config.frequencyRanges);
      if (overlaps.length > 0) {
        overlaps.forEach(overlap => {
          errors.push(`Frequency ranges ${overlap.index1} and ${overlap.index2} overlap`);
        });
      }
    }

    // Bandwidth allocation validation
    if (config.bandwidthAllocation !== undefined && config.bandwidthAllocation <= 0) {
      errors.push('Bandwidth allocation must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  private static validateFrequencyRange(range: FrequencyRange, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Range ${index + 1}:`;

    if (range.centerFrequency <= 0) {
      errors.push(`${prefix} Center frequency must be positive`);
    }

    if (range.bandwidth <= 0) {
      errors.push(`${prefix} Bandwidth must be positive`);
    }

    if (range.priority < 1 || range.priority > 10) {
      errors.push(`${prefix} Priority must be between 1 and 10`);
    }

    // Validate frequency is within amateur radio bands
    if (!this.isValidAmateurFrequency(range.centerFrequency, range.band)) {
      errors.push(`${prefix} Frequency ${range.centerFrequency} Hz not valid for band ${range.band}`);
    }

    return errors;
  }

  private static isValidAmateurFrequency(frequency: number, band: AmateurRadioBand): boolean {
    const bandRanges = {
      [AmateurRadioBand.BAND_160M]: { min: 1800000, max: 2000000 },
      [AmateurRadioBand.BAND_80M]: { min: 3500000, max: 4000000 },
      [AmateurRadioBand.BAND_40M]: { min: 7000000, max: 7300000 },
      [AmateurRadioBand.BAND_30M]: { min: 10100000, max: 10150000 },
      [AmateurRadioBand.BAND_20M]: { min: 14000000, max: 14350000 },
      [AmateurRadioBand.BAND_17M]: { min: 18068000, max: 18168000 },
      [AmateurRadioBand.BAND_15M]: { min: 21000000, max: 21450000 },
      [AmateurRadioBand.BAND_12M]: { min: 24890000, max: 24990000 },
      [AmateurRadioBand.BAND_10M]: { min: 28000000, max: 29700000 },
      [AmateurRadioBand.BAND_6M]: { min: 50000000, max: 54000000 },
      [AmateurRadioBand.BAND_2M]: { min: 144000000, max: 148000000 },
      [AmateurRadioBand.BAND_70CM]: { min: 420000000, max: 450000000 }
    };

    const range = bandRanges[band];
    return range ? frequency >= range.min && frequency <= range.max : false;
  }

  private static findOverlappingRanges(ranges: FrequencyRange[]): Array<{ index1: number; index2: number }> {
    const overlaps: Array<{ index1: number; index2: number }> = [];

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const range1 = ranges[i];
        const range2 = ranges[j];

        const range1Min = range1.centerFrequency - range1.bandwidth / 2;
        const range1Max = range1.centerFrequency + range1.bandwidth / 2;
        const range2Min = range2.centerFrequency - range2.bandwidth / 2;
        const range2Max = range2.centerFrequency + range2.bandwidth / 2;

        if (range1Min < range2Max && range1Max > range2Min) {
          overlaps.push({ index1: i, index2: j });
        }
      }
    }

    return overlaps;
  }
}

/**
 * Factory for creating monitoring configurations
 */
export class MonitoringConfigurationFactory {
  /**
   * Creates emergency monitoring configuration for multiple bands
   */
  static createEmergencyConfiguration(deviceId: string): MonitoringConfiguration {
    return {
      id: `emergency-${Date.now()}`,
      name: 'Emergency Multi-Band Monitoring',
      enabled: true,
      frequencyRanges: [
        {
          centerFrequency: 3873000,  // 80m emergency
          bandwidth: 10000,
          band: AmateurRadioBand.BAND_80M,
          purpose: MonitoringPurpose.EMERGENCY,
          decodingEnabled: true,
          priority: 10
        },
        {
          centerFrequency: 7040000,  // 40m emergency
          bandwidth: 10000,
          band: AmateurRadioBand.BAND_40M,
          purpose: MonitoringPurpose.EMERGENCY,
          decodingEnabled: true,
          priority: 10
        },
        {
          centerFrequency: 14300000, // 20m emergency
          bandwidth: 10000,
          band: AmateurRadioBand.BAND_20M,
          purpose: MonitoringPurpose.EMERGENCY,
          decodingEnabled: true,
          priority: 10
        }
      ],
      priority: 10,
      deviceAssignment: deviceId,
      bandwidthAllocation: 2400000, // Full bandwidth for emergency
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Creates content discovery configuration
   */
  static createContentDiscoveryConfiguration(deviceId: string): MonitoringConfiguration {
    return {
      id: `content-discovery-${Date.now()}`,
      name: 'Multi-Band Content Discovery',
      enabled: true,
      frequencyRanges: [
        {
          centerFrequency: 7085000,  // 40m HTTP-over-radio
          bandwidth: 10000,
          band: AmateurRadioBand.BAND_40M,
          purpose: MonitoringPurpose.CONTENT_DISCOVERY,
          decodingEnabled: true,
          priority: 5
        },
        {
          centerFrequency: 14085000, // 20m HTTP-over-radio
          bandwidth: 10000,
          band: AmateurRadioBand.BAND_20M,
          purpose: MonitoringPurpose.CONTENT_DISCOVERY,
          decodingEnabled: true,
          priority: 5
        }
      ],
      priority: 5,
      deviceAssignment: deviceId,
      bandwidthAllocation: 1200000, // Half bandwidth
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Creates mesh coordination configuration
   */
  static createMeshCoordinationConfiguration(deviceId: string): MonitoringConfiguration {
    return {
      id: `mesh-coordination-${Date.now()}`,
      name: 'Mesh Network Coordination',
      enabled: true,
      frequencyRanges: [
        {
          centerFrequency: 7035000,  // 40m mesh coordination
          bandwidth: 5000,
          band: AmateurRadioBand.BAND_40M,
          purpose: MonitoringPurpose.MESH_COORDINATION,
          decodingEnabled: true,
          priority: 6
        },
        {
          centerFrequency: 14070000, // 20m mesh coordination
          bandwidth: 5000,
          band: AmateurRadioBand.BAND_20M,
          purpose: MonitoringPurpose.MESH_COORDINATION,
          decodingEnabled: true,
          priority: 6
        }
      ],
      priority: 6,
      deviceAssignment: deviceId,
      bandwidthAllocation: 600000, // Quarter bandwidth
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

/**
 * Utility functions for monitoring configurations
 */
export class MonitoringConfigurationUtils {
  /**
   * Calculates total bandwidth requirement for a configuration
   */
  static calculateTotalBandwidth(config: MonitoringConfiguration): number {
    return config.frequencyRanges.reduce((total, range) => total + range.bandwidth, 0);
  }

  /**
   * Checks if configuration fits within device capabilities
   */
  static validateAgainstCapabilities(
    config: MonitoringConfiguration,
    maxBandwidth: number
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const totalBandwidth = this.calculateTotalBandwidth(config);

    if (totalBandwidth > maxBandwidth) {
      errors.push(
        `Total bandwidth ${totalBandwidth} Hz exceeds device maximum ${maxBandwidth} Hz`
      );
    }

    if (config.bandwidthAllocation > maxBandwidth) {
      errors.push(
        `Bandwidth allocation ${config.bandwidthAllocation} Hz exceeds device maximum ${maxBandwidth} Hz`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Merges multiple configurations for multi-device operation
   */
  static mergeConfigurations(configs: MonitoringConfiguration[]): MonitoringConfiguration {
    if (configs.length === 0) {
      throw new Error('At least one configuration required');
    }

    if (configs.length === 1) {
      return { ...configs[0] };
    }

    // Use highest priority configuration as base
    const primaryConfig = configs.reduce((highest, current) =>
      current.priority > highest.priority ? current : highest
    );

    return {
      ...primaryConfig,
      id: `merged-${Date.now()}`,
      name: `Merged: ${configs.map(c => c.name).join(', ')}`,
      frequencyRanges: configs.flatMap(c => c.frequencyRanges),
      deviceAssignment: configs.map(c => c.deviceAssignment).join(','),
      bandwidthAllocation: Math.max(...configs.map(c => c.bandwidthAllocation)),
      updatedAt: new Date()
    };
  }

  /**
   * Gets configurations by priority level
   */
  static getConfigurationsByPriority(
    configs: MonitoringConfiguration[],
    minPriority: number
  ): MonitoringConfiguration[] {
    return configs
      .filter(config => config.priority >= minPriority)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Finds configurations that monitor a specific frequency
   */
  static findConfigurationsForFrequency(
    configs: MonitoringConfiguration[],
    frequency: number
  ): MonitoringConfiguration[] {
    return configs.filter(config =>
      config.frequencyRanges.some(range => {
        const minFreq = range.centerFrequency - range.bandwidth / 2;
        const maxFreq = range.centerFrequency + range.bandwidth / 2;
        return frequency >= minFreq && frequency <= maxFreq;
      })
    );
  }

  /**
   * Optimizes configurations to minimize bandwidth usage
   */
  static optimizeBandwidthUsage(configs: MonitoringConfiguration[]): MonitoringConfiguration[] {
    // Sort by priority (highest first)
    const sortedConfigs = [...configs].sort((a, b) => b.priority - a.priority);

    // TODO: Implement bandwidth optimization algorithm
    // For now, just return sorted configurations
    return sortedConfigs;
  }
}

export default MonitoringConfiguration;