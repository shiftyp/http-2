/**
 * Beacon Monitor - RF beacon monitoring and path tracking
 * Tracks signal quality and path availability for routing decisions
 */

export interface BeaconMonitorConfig {
  db: IDBDatabase;
  beaconInterval?: number;
}

export interface BeaconPath {
  originStation: string;
  targetStation: string;
  mode: 'RF' | 'WebRTC';
  hopCount: number;
  signalStrength: number;
  lastHeard: number;
  frequency?: number;
  bandwidth?: number;
}

export interface PathQualityMetrics {
  avgSignalStrength: number;
  signalVariance: number;
  reliabilityScore: number;
  dayNightPattern: Record<string, number>;
  bestTimeSlots: number[];
}

export interface CoverageStatistics {
  totalStations: number;
  bandCoverage: Record<number, number>;
  avgSignalStrength: number;
  coverageRadius: number;
  bestBands: number[];
  reachabilityMatrix: Record<string, Record<string, number>>;
}

export class BeaconMonitor {
  private db: IDBDatabase;
  private beaconInterval: number;

  constructor(config: BeaconMonitorConfig) {
    this.db = config.db;
    this.beaconInterval = config.beaconInterval || 30000; // 30 seconds default
  }

  /**
   * Record a beacon path observation
   */
  async recordPath(path: BeaconPath): Promise<void> {
    const pathRecord = {
      id: this.generatePathId(),
      ...path,
      recordedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['beacon_paths'], 'readwrite');
      const store = transaction.objectStore('beacon_paths');
      const request = store.put(pathRecord);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get latest path to a station
   */
  async getLatestPath(targetStation: string): Promise<BeaconPath | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['beacon_paths'], 'readonly');
      const store = transaction.objectStore('beacon_paths');
      const request = store.getAll();

      request.onsuccess = () => {
        const paths = request.result || [];
        const targetPaths = paths
          .filter(p => p.targetStation === targetStation)
          .sort((a, b) => b.lastHeard - a.lastHeard);

        resolve(targetPaths.length > 0 ? targetPaths[0] : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get quality metrics for a path
   */
  async getQualityMetrics(originStation: string, targetStation: string): Promise<PathQualityMetrics> {
    const paths = await this.getPathHistory(originStation, targetStation);

    if (paths.length === 0) {
      return {
        avgSignalStrength: 0,
        signalVariance: 0,
        reliabilityScore: 0,
        dayNightPattern: {},
        bestTimeSlots: []
      };
    }

    const signals = paths.map(p => p.signalStrength);
    const avgSignalStrength = signals.reduce((sum, s) => sum + s, 0) / signals.length;

    const variance = signals.reduce((sum, s) => sum + Math.pow(s - avgSignalStrength, 2), 0) / signals.length;

    // Calculate reliability based on consistency and recency
    const reliabilityScore = Math.max(0, Math.min(1, avgSignalStrength / 30 - variance / 100));

    // Day/night pattern analysis
    const dayNightPattern = this.analyzeDayNightPattern(paths);

    // Find best time slots (hourly)
    const bestTimeSlots = this.findBestTimeSlots(paths);

    return {
      avgSignalStrength,
      signalVariance: variance,
      reliabilityScore,
      dayNightPattern,
      bestTimeSlots
    };
  }

  /**
   * Get coverage statistics
   */
  async getCoverageStatistics(): Promise<CoverageStatistics> {
    const allPaths = await this.getAllPaths();
    const stations = new Set<string>();
    const bandCoverage: Record<number, number> = {};
    const signalStrengths: number[] = [];

    for (const path of allPaths) {
      stations.add(path.originStation);
      stations.add(path.targetStation);

      if (path.frequency) {
        const band = Math.floor(path.frequency);
        bandCoverage[band] = (bandCoverage[band] || 0) + 1;
      }

      signalStrengths.push(path.signalStrength);
    }

    const avgSignalStrength = signalStrengths.length > 0
      ? signalStrengths.reduce((sum, s) => sum + s, 0) / signalStrengths.length
      : 0;

    const bestBands = Object.entries(bandCoverage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([band]) => parseInt(band));

    return {
      totalStations: stations.size,
      bandCoverage,
      avgSignalStrength,
      coverageRadius: this.estimateCoverageRadius(allPaths),
      bestBands,
      reachabilityMatrix: this.buildReachabilityMatrix(allPaths)
    };
  }

  // Private helper methods
  private generatePathId(): string {
    return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getPathHistory(originStation: string, targetStation: string): Promise<BeaconPath[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['beacon_paths'], 'readonly');
      const store = transaction.objectStore('beacon_paths');
      const request = store.getAll();

      request.onsuccess = () => {
        const paths = request.result || [];
        const filtered = paths.filter(p =>
          p.originStation === originStation && p.targetStation === targetStation
        );
        resolve(filtered);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getAllPaths(): Promise<BeaconPath[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['beacon_paths'], 'readonly');
      const store = transaction.objectStore('beacon_paths');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private analyzeDayNightPattern(paths: BeaconPath[]): Record<string, number> {
    const pattern: Record<string, number> = { day: 0, night: 0 };

    for (const path of paths) {
      const hour = new Date(path.lastHeard).getHours();
      const isDaytime = hour >= 6 && hour <= 18;

      if (isDaytime) {
        pattern.day += path.signalStrength;
      } else {
        pattern.night += path.signalStrength;
      }
    }

    const dayCount = paths.filter(p => {
      const hour = new Date(p.lastHeard).getHours();
      return hour >= 6 && hour <= 18;
    }).length;

    const nightCount = paths.length - dayCount;

    if (dayCount > 0) pattern.day /= dayCount;
    if (nightCount > 0) pattern.night /= nightCount;

    return pattern;
  }

  private findBestTimeSlots(paths: BeaconPath[]): number[] {
    const hourlySignals: Record<number, number[]> = {};

    for (const path of paths) {
      const hour = new Date(path.lastHeard).getHours();
      if (!hourlySignals[hour]) {
        hourlySignals[hour] = [];
      }
      hourlySignals[hour].push(path.signalStrength);
    }

    const hourlyAvg = Object.entries(hourlySignals).map(([hour, signals]) => ({
      hour: parseInt(hour),
      avg: signals.reduce((sum, s) => sum + s, 0) / signals.length
    }));

    return hourlyAvg
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(h => h.hour);
  }

  private estimateCoverageRadius(paths: BeaconPath[]): number {
    // Simple estimation based on hop counts and signal strengths
    const maxHops = Math.max(...paths.map(p => p.hopCount), 0);
    return maxHops * 50; // Assume ~50km per hop
  }

  private buildReachabilityMatrix(paths: BeaconPath[]): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};

    for (const path of paths) {
      if (!matrix[path.originStation]) {
        matrix[path.originStation] = {};
      }
      matrix[path.originStation][path.targetStation] = path.signalStrength;
    }

    return matrix;
  }
}