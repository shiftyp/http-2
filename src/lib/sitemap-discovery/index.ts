import { SitemapEntry, SitemapCache, CQSitemaps } from '../cq-sitemaps';

export interface ContentDiscoveryQuery {
  pattern?: string; // glob pattern like "*.html" or exact URL
  contentType?: string; // filter by content type
  maxAge?: number; // max age in milliseconds
  includeStale?: boolean; // include stale cache entries
  station?: string; // filter by specific station
  minSize?: number; // minimum content size
  maxSize?: number; // maximum content size
}

export interface ContentResult {
  url: string;
  size: number;
  etag: string;
  lastModified: number;
  contentType: string;
  station: string; // which station has this content
  isStale: boolean; // is the cache entry stale
  isActive: boolean; // is the station currently active
  age: number; // age of cache entry in milliseconds
}

export interface ContentMetadata {
  totalEntries: number;
  totalSize: number;
  stations: string[];
  contentTypes: Record<string, number>;
  staleness: {
    fresh: number;
    stale: number;
    expired: number;
  };
}

export class SitemapDiscovery {
  private cqSitemaps: CQSitemaps;

  constructor(cqSitemaps: CQSitemaps) {
    this.cqSitemaps = cqSitemaps;
  }

  // Main query interface
  async queryContent(query: ContentDiscoveryQuery = {}): Promise<ContentResult[]> {
    const results: ContentResult[] = [];
    const now = Date.now();
    const maxAge = query.maxAge || Infinity;

    // Get all cached sitemaps
    const caches = this.cqSitemaps.getAllCachedSitemaps();

    for (const cache of caches) {
      // Skip if station filter doesn't match
      if (query.station && cache.callsign !== query.station) {
        continue;
      }

      // Skip stale entries unless explicitly requested
      if (cache.isStale && !query.includeStale) {
        continue;
      }

      // Check cache age
      const age = now - cache.lastUpdated;
      if (age > maxAge) {
        continue;
      }

      // Process each entry in the cache
      for (const entry of cache.entries) {
        // Apply filters
        if (!this.matchesFilters(entry, query)) {
          continue;
        }

        const result: ContentResult = {
          ...entry,
          station: cache.callsign,
          isStale: cache.isStale,
          isActive: cache.isActive,
          age: age
        };

        results.push(result);
      }
    }

    // Sort results by freshness and relevance
    return this.sortResults(results, query);
  }

  // Get all available content (no filtering)
  async getAvailableContent(): Promise<ContentResult[]> {
    return this.queryContent({ includeStale: true });
  }

  // Find content by specific type
  async findContentByType(contentType: string, includeStale: boolean = false): Promise<ContentResult[]> {
    return this.queryContent({ contentType, includeStale });
  }

  // Find content by URL pattern
  async findContentByPattern(pattern: string, includeStale: boolean = false): Promise<ContentResult[]> {
    return this.queryContent({ pattern, includeStale });
  }

  // Get content from specific station
  async getStationContent(station: string, includeStale: boolean = false): Promise<ContentResult[]> {
    return this.queryContent({ station, includeStale });
  }

  // Get metadata about available content
  async getContentMetadata(): Promise<ContentMetadata> {
    const allContent = await this.getAvailableContent();
    const now = Date.now();

    const metadata: ContentMetadata = {
      totalEntries: allContent.length,
      totalSize: allContent.reduce((sum, item) => sum + item.size, 0),
      stations: [...new Set(allContent.map(item => item.station))],
      contentTypes: {},
      staleness: {
        fresh: 0,
        stale: 0,
        expired: 0
      }
    };

    // Count content types
    for (const item of allContent) {
      metadata.contentTypes[item.contentType] =
        (metadata.contentTypes[item.contentType] || 0) + 1;
    }

    // Count staleness
    for (const item of allContent) {
      if (item.age < 900000) { // 15 minutes
        metadata.staleness.fresh++;
      } else if (item.age < 1800000) { // 30 minutes
        metadata.staleness.stale++;
      } else {
        metadata.staleness.expired++;
      }
    }

    return metadata;
  }

  // Find best station for specific content
  async findBestStationForContent(url: string): Promise<ContentResult | null> {
    const results = await this.queryContent({ pattern: url, includeStale: false });

    if (results.length === 0) {
      return null;
    }

    // Sort by freshness and activity
    results.sort((a, b) => {
      // Prefer active stations
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      // Prefer fresher content
      return a.age - b.age;
    });

    return results[0];
  }

  // Get stations that have specific content
  async getStationsWithContent(url: string): Promise<string[]> {
    const results = await this.queryContent({ pattern: url, includeStale: true });
    return [...new Set(results.map(r => r.station))];
  }

  // Check if content is available
  async isContentAvailable(url: string, requireActive: boolean = true): Promise<boolean> {
    const query: ContentDiscoveryQuery = {
      pattern: url,
      includeStale: !requireActive
    };

    const results = await this.queryContent(query);

    if (requireActive) {
      return results.some(r => r.isActive);
    }

    return results.length > 0;
  }

  // Get content recommendations (similar content)
  async getContentRecommendations(url: string, limit: number = 10): Promise<ContentResult[]> {
    const pathParts = url.split('/');
    const extension = url.split('.').pop() || '';

    // Find content with similar paths or same extension
    const allContent = await this.getAvailableContent();

    const scored = allContent.map(item => {
      let score = 0;

      // Same directory
      const itemDir = item.url.split('/').slice(0, -1).join('/');
      const urlDir = pathParts.slice(0, -1).join('/');
      if (itemDir === urlDir) score += 3;

      // Same extension
      const itemExt = item.url.split('.').pop() || '';
      if (itemExt === extension) score += 2;

      // Same content type
      const expectedType = this.getContentTypeFromExtension(extension);
      if (item.contentType === expectedType) score += 1;

      // Prefer active stations
      if (item.isActive) score += 1;

      return { item, score };
    })
    .filter(s => s.score > 0 && s.item.url !== url)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.item);

    return scored;
  }

  // Get network statistics
  async getNetworkStats(): Promise<any> {
    const metadata = await this.getContentMetadata();
    const caches = this.cqSitemaps.getAllCachedSitemaps();

    return {
      totalStations: metadata.stations.length,
      activeStations: caches.filter(c => c.isActive).length,
      totalContent: metadata.totalEntries,
      totalSize: metadata.totalSize,
      averageContentPerStation: Math.round(metadata.totalEntries / metadata.stations.length),
      contentTypes: metadata.contentTypes,
      staleness: metadata.staleness,
      cacheStats: {
        fresh: caches.filter(c => !c.isStale).length,
        stale: caches.filter(c => c.isStale).length,
        active: caches.filter(c => c.isActive).length
      }
    };
  }

  // Private helper methods
  private matchesFilters(entry: SitemapEntry, query: ContentDiscoveryQuery): boolean {
    // Pattern matching (glob-style)
    if (query.pattern && !this.matchesPattern(entry.url, query.pattern)) {
      return false;
    }

    // Content type matching
    if (query.contentType && entry.contentType !== query.contentType) {
      return false;
    }

    // Size filtering
    if (query.minSize !== undefined && entry.size < query.minSize) {
      return false;
    }

    if (query.maxSize !== undefined && entry.size > query.maxSize) {
      return false;
    }

    return true;
  }

  private matchesPattern(url: string, pattern: string): boolean {
    // Simple glob pattern matching
    if (pattern === url) return true;

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  }

  private sortResults(results: ContentResult[], query: ContentDiscoveryQuery): ContentResult[] {
    return results.sort((a, b) => {
      // Primary sort: active stations first
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }

      // Secondary sort: fresher content first
      if (a.age !== b.age) {
        return a.age - b.age;
      }

      // Tertiary sort: larger content first (assuming more complete)
      return b.size - a.size;
    });
  }

  private getContentTypeFromExtension(extension: string): string {
    const typeMap: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'txt': 'text/plain'
    };

    return typeMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  // Cache management methods
  async refreshStationCache(station: string): Promise<boolean> {
    // This would trigger a new sitemap request to the station
    // For now, just mark as needing refresh
    const cache = this.cqSitemaps.getSitemapCache(station);
    if (cache) {
      cache.isStale = true;
      return true;
    }
    return false;
  }

  async invalidateStationCache(station: string): Promise<void> {
    this.cqSitemaps.markStationInactive(station);
  }

  // Export/import for debugging
  async exportDiscoveryData(): Promise<any> {
    const metadata = await this.getContentMetadata();
    const stats = await this.getNetworkStats();
    const allContent = await this.getAvailableContent();

    return {
      timestamp: Date.now(),
      metadata,
      stats,
      content: allContent,
      version: '1.0.0'
    };
  }
}