// Note: compression library integration available but not used in this implementation

export interface SitemapEntry {
  url: string;
  size: number;
  etag: string;
  lastModified: number;
  contentType: string;
}

export interface CQSitemapMessage {
  type: 'SITEMAP_BROADCAST';
  originatorCallsign: string;
  sequenceNumber: number;
  ttl: number;
  hopCount: number;
  messageId: string;
  timestamp: number;
  sitemap: SitemapEntry[];
}

export interface SitemapCache {
  callsign: string;
  lastUpdated: number;
  entries: SitemapEntry[];
  isStale: boolean;
  isActive: boolean;
}

export interface CompressedSitemapEntry {
  u: string; // url (compressed)
  s: number; // size
  e: string; // etag (compressed)
  m: number; // lastModified
  t: string; // contentType (compressed)
}

export interface SitemapBroadcastConfig {
  periodicInterval: number; // 5 minutes (300000ms)
  eventDampening: number; // 30 seconds (30000ms)
  maxTTL: number; // 8-10 hops
  maxSitemapSize: number; // 200 bytes compressed
  compressionRatio: number; // 15x target
}

export const DEFAULT_CONFIG: SitemapBroadcastConfig = {
  periodicInterval: 300000, // 5 minutes
  eventDampening: 30000, // 30 seconds
  maxTTL: 8,
  maxSitemapSize: 200,
  compressionRatio: 15
};

export const SITEMAP_TIMEOUTS = {
  periodic_broadcast: 300000, // 5 minutes
  event_dampening: 30000, // 30 seconds
  cache_questionable: 900000, // 15 minutes
  cache_extended: 1800000, // 30 minutes for active stations
  message_dedup: 60000 // 1 minute message cache
};

export class CQSitemaps {
  private config: SitemapBroadcastConfig;
  private callsign: string;
  private sequenceNumber: number = 0;
  private messageCache: Map<string, number> = new Map();
  private sitemapCache: Map<string, SitemapCache> = new Map();
  private contentInventory: SitemapEntry[] = [];
  private broadcastInterval?: number;
  private lastBroadcast: number = 0;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(callsign: string, config: Partial<SitemapBroadcastConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callsign = callsign;

    // Start cleanup interval
    setInterval(() => this.cleanupCaches(), 60000); // Every minute
  }

  // Content inventory management
  async updateContentInventory(entries: SitemapEntry[]): Promise<void> {
    const hasChanged = this.hasInventoryChanged(entries);
    this.contentInventory = [...entries];

    if (hasChanged) {
      await this.scheduleEventBroadcast();
    }
  }

  private hasInventoryChanged(newEntries: SitemapEntry[]): boolean {
    if (newEntries.length !== this.contentInventory.length) {
      return true;
    }

    const oldMap = new Map(this.contentInventory.map(e => [e.url, e.etag]));
    return newEntries.some(entry => oldMap.get(entry.url) !== entry.etag);
  }

  // Broadcasting methods
  async broadcastSitemap(): Promise<CQSitemapMessage> {
    this.sequenceNumber++;

    const message: CQSitemapMessage = {
      type: 'SITEMAP_BROADCAST',
      originatorCallsign: this.callsign,
      sequenceNumber: this.sequenceNumber,
      ttl: this.config.maxTTL,
      hopCount: 0,
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      sitemap: await this.compressSitemap(this.contentInventory)
    };

    // Cache our own message to prevent loops
    this.messageCache.set(message.messageId, Date.now());
    this.lastBroadcast = Date.now();

    this.emit('sitemap-broadcast', message);
    return message;
  }

  async handleSitemapMessage(message: CQSitemapMessage, sender: string): Promise<boolean> {
    // Check for duplicates
    if (this.messageCache.has(message.messageId)) {
      return false;
    }

    // Check TTL
    if (message.ttl <= 0) {
      return false;
    }

    // Cache the message to prevent loops
    this.messageCache.set(message.messageId, Date.now());

    // Cache the sitemap
    await this.cacheSitemap(message.originatorCallsign, message.sitemap, message.timestamp);

    // Forward if TTL allows
    if (message.ttl > 1) {
      const forwardedMessage: CQSitemapMessage = {
        ...message,
        ttl: message.ttl - 1,
        hopCount: message.hopCount + 1
      };

      // Emit for mesh layer to handle forwarding
      this.emit('sitemap-forward', forwardedMessage);
    }

    this.emit('sitemap-received', { message, sender });
    return true;
  }

  startPeriodicBroadcast(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    this.broadcastInterval = setInterval(async () => {
      if (this.contentInventory.length > 0) {
        await this.broadcastSitemap();
      }
    }, this.config.periodicInterval) as any;
  }

  stopPeriodicBroadcast(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = undefined;
    }
  }

  private async scheduleEventBroadcast(): Promise<void> {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcast;

    if (timeSinceLastBroadcast >= this.config.eventDampening) {
      // Broadcast immediately
      await this.broadcastSitemap();
    } else {
      // Schedule broadcast after dampening period
      const delay = this.config.eventDampening - timeSinceLastBroadcast;
      setTimeout(async () => {
        await this.broadcastSitemap();
      }, delay);
    }
  }

  // Cache management
  async cacheSitemap(callsign: string, entries: SitemapEntry[], timestamp: number): Promise<void> {
    const existingCache = this.sitemapCache.get(callsign);

    // Only update if newer
    if (existingCache && existingCache.lastUpdated >= timestamp) {
      return;
    }

    // Check if entries are already compressed (from network) or raw (from local)
    const normalizedEntries = entries.every(e => e.url.length <= 5)
      ? await this.decompressSitemap(entries) // Decompress if from network
      : entries; // Use as-is if already normal

    const cache: SitemapCache = {
      callsign,
      lastUpdated: timestamp,
      entries: normalizedEntries,
      isStale: false,
      isActive: true
    };

    this.sitemapCache.set(callsign, cache);
    this.emit('cache-updated', { callsign, cache });
  }

  getSitemapCache(callsign: string): SitemapCache | null {
    return this.sitemapCache.get(callsign) || null;
  }

  getAllCachedSitemaps(): SitemapCache[] {
    return Array.from(this.sitemapCache.values());
  }

  clearStaleEntries(): void {
    const now = Date.now();
    const staleCutoff = now - SITEMAP_TIMEOUTS.cache_questionable;
    const expiredCutoff = now - SITEMAP_TIMEOUTS.cache_extended;

    for (const [callsign, cache] of this.sitemapCache) {
      if (cache.lastUpdated < expiredCutoff) {
        // Remove completely expired entries
        this.sitemapCache.delete(callsign);
        this.emit('cache-expired', { callsign });
      } else if (cache.lastUpdated < staleCutoff) {
        // Mark as stale but keep
        cache.isStale = true;
        cache.isActive = false;
      }
    }
  }

  markStationActive(callsign: string): void {
    const cache = this.sitemapCache.get(callsign);
    if (cache) {
      cache.isActive = true;
      cache.isStale = false;
      this.emit('station-active', { callsign });
    }
  }

  markStationInactive(callsign: string): void {
    const cache = this.sitemapCache.get(callsign);
    if (cache) {
      cache.isActive = false;
      this.emit('station-inactive', { callsign });
    }
  }

  // Compression methods
  private async compressSitemap(entries: SitemapEntry[]): Promise<SitemapEntry[]> {
    // Convert to compressed format
    const compressed = entries.map(entry => ({
      u: this.compressUrl(entry.url),
      s: entry.size,
      e: this.compressEtag(entry.etag),
      m: entry.lastModified,
      t: this.compressContentType(entry.contentType)
    }));

    // Check if we need to truncate to meet size limits
    let serialized = JSON.stringify(compressed);
    let truncatedEntries = compressed;

    // If too large, progressively reduce entries
    while (serialized.length > this.config.maxSitemapSize && truncatedEntries.length > 0) {
      const maxEntries = Math.max(1, Math.floor(truncatedEntries.length * 0.8));
      truncatedEntries = compressed.slice(0, maxEntries);
      serialized = JSON.stringify(truncatedEntries);
    }

    // Convert back to SitemapEntry format for compatibility
    return truncatedEntries.map(c => ({
      url: c.u,
      size: c.s,
      etag: c.e,
      lastModified: c.m,
      contentType: c.t
    }));
  }

  private async decompressSitemap(entries: SitemapEntry[]): Promise<SitemapEntry[]> {
    // Decompress entries (reverse of compression)
    return entries.map(entry => ({
      url: this.decompressUrl(entry.url),
      size: entry.size,
      etag: this.decompressEtag(entry.etag),
      lastModified: entry.lastModified,
      contentType: this.decompressContentType(entry.contentType)
    }));
  }

  private compressUrl(url: string): string {
    // More aggressive URL compression
    let compressed = url;

    // Remove common prefixes and suffixes
    compressed = compressed.replace(/^\//, ''); // Remove leading slash
    compressed = compressed.replace(/\.html$/, ''); // Remove .html
    compressed = compressed.replace(/\.css$/, ''); // Remove .css
    compressed = compressed.replace(/\.js$/, ''); // Remove .js
    compressed = compressed.replace(/index$/, ''); // Remove index

    // Use shorter representation for common patterns
    compressed = compressed.replace(/about$/, 'a');
    compressed = compressed.replace(/contact$/, 'c');
    compressed = compressed.replace(/blog$/, 'b');
    compressed = compressed.replace(/style$/, 's');

    return compressed || '/';
  }

  private decompressUrl(compressed: string): string {
    // Reverse URL compression
    let url = compressed;

    // Restore common patterns
    if (url === 'a') url = 'about';
    if (url === 'c') url = 'contact';
    if (url === 'b') url = 'blog';
    if (url === 's') url = 'style';

    // Add back leading slash
    if (!url.startsWith('/')) {
      url = '/' + url;
    }

    // Guess file extension based on content or default to .html
    if (!url.includes('.') && url !== '/') {
      url += '.html';
    }

    return url;
  }

  private compressEtag(etag: string): string {
    // More aggressive etag compression - just use first 4 chars
    return etag.replace(/"/g, '').substring(0, 4);
  }

  private decompressEtag(compressed: string): string {
    // Add quotes back
    return `"${compressed}"`;
  }

  private compressContentType(contentType: string): string {
    // Use single character codes for common types
    const typeMap: Record<string, string> = {
      'text/html': 'h',
      'text/css': 'c',
      'application/javascript': 'j',
      'image/png': 'p',
      'image/jpeg': 'J',
      'application/json': 'n',
      'text/plain': 't'
    };
    return typeMap[contentType] || 'o'; // 'o' for other
  }

  private decompressContentType(compressed: string): string {
    // Reverse content type compression
    const reverseMap: Record<string, string> = {
      'h': 'text/html',
      'c': 'text/css',
      'j': 'application/javascript',
      'p': 'image/png',
      'J': 'image/jpeg',
      'n': 'application/json',
      't': 'text/plain',
      'o': 'application/octet-stream'
    };
    return reverseMap[compressed] || 'application/octet-stream';
  }

  // Utility methods
  private generateMessageId(): string {
    return `${this.callsign}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private cleanupCaches(): void {
    // Clean up old message cache entries
    const now = Date.now();
    const cutoff = now - SITEMAP_TIMEOUTS.message_dedup;

    for (const [id, timestamp] of this.messageCache) {
      if (timestamp < cutoff) {
        this.messageCache.delete(id);
      }
    }

    // Clean up stale sitemap entries
    this.clearStaleEntries();
  }

  // Event system
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Diagnostics
  getStats(): any {
    return {
      callsign: this.callsign,
      sequenceNumber: this.sequenceNumber,
      contentInventory: this.contentInventory.length,
      cachedSitemaps: this.sitemapCache.size,
      messageCache: this.messageCache.size,
      lastBroadcast: this.lastBroadcast,
      isPeriodicBroadcastActive: !!this.broadcastInterval,
      config: this.config
    };
  }

  // Cleanup
  destroy(): void {
    this.stopPeriodicBroadcast();
    this.messageCache.clear();
    this.sitemapCache.clear();
    this.eventHandlers.clear();
  }
}