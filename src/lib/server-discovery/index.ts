/**
 * Server discovery library for finding distributed ham radio servers
 * Supports multiple discovery methods within browser constraints
 */

export interface ServerInfo {
  id: string;
  callsign?: string;
  endpoint: string;
  signalingUrl: string;
  discoveryMethod: 'localhost' | 'mdns' | 'manual' | 'cq' | 'peer' | 'cached';
  capabilities: string[];
  state: 'unclaimed' | 'claimed' | 'active' | 'unreachable';
  lastSeen: Date;
  connectionQuality?: number;
}

export interface DiscoveryOptions {
  timeout?: number;
  maxAttempts?: number;
  includeCached?: boolean;
}

export class ServerDiscovery {
  private readonly COMMON_PORTS = [8080, 8081, 8082, 3000, 3001, 9090, 8888];
  private readonly DISCOVERY_TIMEOUT = 5000;
  private readonly CACHE_KEY = 'discovered-servers';
  private discoveredServers: Map<string, ServerInfo> = new Map();

  constructor() {
    this.loadCachedServers();
  }

  /**
   * Discover all available servers using multiple methods
   */
  async discoverAll(options: DiscoveryOptions = {}): Promise<ServerInfo[]> {
    const { timeout = this.DISCOVERY_TIMEOUT, includeCached = true } = options;

    const discoveryMethods = [
      this.discoverLocalhost(),
      this.discoverViaWebRTC(),
      includeCached ? this.tryKnownServers() : Promise.resolve([])
    ];

    try {
      const results = await Promise.race([
        Promise.allSettled(discoveryMethods),
        this.timeout(timeout)
      ]);

      const servers: ServerInfo[] = [];

      if (Array.isArray(results)) {
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            servers.push(...result.value);
          }
        });
      }

      // Deduplicate servers
      const uniqueServers = this.deduplicateServers(servers);

      // Cache successful discoveries
      uniqueServers.forEach(server => {
        this.discoveredServers.set(server.endpoint, server);
      });
      this.saveCachedServers();

      return uniqueServers;
    } catch (error) {
      console.error('Discovery failed:', error);
      return [];
    }
  }

  /**
   * Discover servers on localhost
   */
  async discoverLocalhost(): Promise<ServerInfo[]> {
    const servers: ServerInfo[] = [];

    for (const port of this.COMMON_PORTS) {
      try {
        const server = await this.checkEndpoint(`http://localhost:${port}`);
        if (server) {
          servers.push(server);
        }
      } catch {
        // Port not available, continue
      }
    }

    return servers;
  }

  /**
   * Discover local network IPs via WebRTC and scan for servers
   */
  async discoverViaWebRTC(): Promise<ServerInfo[]> {
    const localIPs = await this.getLocalIPsViaWebRTC();
    const servers: ServerInfo[] = [];

    for (const ip of localIPs) {
      // Try common server IPs on the same subnet
      const subnet = ip.substring(0, ip.lastIndexOf('.'));
      const candidates = [
        `${subnet}.1`,    // Often router/server
        `${subnet}.100`,  // Common server IP
        `${subnet}.200`,  // Common server IP
        ip               // The discovered IP itself
      ];

      for (const candidateIP of candidates) {
        for (const port of [8080, 8081, 3000]) {
          try {
            const server = await this.checkEndpoint(`http://${candidateIP}:${port}`);
            if (server) {
              servers.push(server);
            }
          } catch {
            // Not available
          }
        }
      }
    }

    return servers;
  }

  /**
   * Try previously discovered servers from cache
   */
  async tryKnownServers(): Promise<ServerInfo[]> {
    const servers: ServerInfo[] = [];
    const cached = Array.from(this.discoveredServers.values());

    for (const cachedServer of cached) {
      try {
        // Verify server is still alive
        const server = await this.checkEndpoint(cachedServer.endpoint);
        if (server) {
          server.discoveryMethod = 'cached';
          servers.push(server);
        }
      } catch {
        // Server no longer available
        this.discoveredServers.delete(cachedServer.endpoint);
      }
    }

    return servers;
  }

  /**
   * Scan QR code for server information
   */
  async scanQRCode(): Promise<ServerInfo | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Create video element for QR scanning
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      // Use BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code']
        });

        const codes = await detector.detect(video);

        // Stop video stream
        stream.getTracks().forEach(track => track.stop());

        if (codes.length > 0) {
          const data = JSON.parse(codes[0].rawValue);

          if (data.type === 'SIGNALING_SERVER') {
            return {
              id: this.generateId(),
              callsign: data.owner,
              endpoint: data.endpoint || this.extractEndpoint(data.url),
              signalingUrl: data.url,
              discoveryMethod: 'manual',
              capabilities: data.capabilities || [],
              state: 'active',
              lastSeen: new Date()
            };
          }
        }
      }

      // Fallback: Show manual entry if BarcodeDetector not available
      stream.getTracks().forEach(track => track.stop());
      return null;
    } catch (error) {
      console.error('QR code scanning failed:', error);
      return null;
    }
  }

  /**
   * Manually add a server by URL
   */
  async addManualServer(url: string): Promise<ServerInfo | null> {
    try {
      // Extract HTTP endpoint from WebSocket URL if needed
      const endpoint = url.startsWith('ws://') || url.startsWith('wss://')
        ? url.replace(/^wss?:\/\//, 'http://').replace(/\/ws\/signal$/, '')
        : url;

      const server = await this.checkEndpoint(endpoint);

      if (server) {
        server.discoveryMethod = 'manual';
        server.signalingUrl = url.includes('/signal') ? url : `${url}/ws/signal`;

        this.discoveredServers.set(server.endpoint, server);
        this.saveCachedServers();

        return server;
      }

      return null;
    } catch (error) {
      console.error('Failed to add manual server:', error);
      return null;
    }
  }

  /**
   * Check if an endpoint is a valid server
   */
  private async checkEndpoint(endpoint: string): Promise<ServerInfo | null> {
    try {
      const response = await fetch(`${endpoint}/api/info`, {
        signal: AbortSignal.timeout(2000)
      });

      if (!response.ok) {
        return null;
      }

      const info = await response.json();

      // Check if it's a signaling server
      if (info.type === 'signaling' || info.capabilities?.includes('signaling')) {
        const wsEndpoint = endpoint.replace('http://', 'ws://');

        return {
          id: this.generateId(),
          callsign: info.callsign,
          endpoint,
          signalingUrl: info.signalingUrl || `${wsEndpoint}/ws/signal`,
          discoveryMethod: endpoint.includes('localhost') ? 'localhost' : 'mdns',
          capabilities: info.capabilities || [],
          state: info.state || 'active',
          lastSeen: new Date(),
          connectionQuality: 100 // Will be updated based on actual connection
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get local IP addresses via WebRTC
   */
  private async getLocalIPsViaWebRTC(): Promise<string[]> {
    return new Promise((resolve) => {
      const ips = new Set<string>();
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const timeout = setTimeout(() => {
        pc.close();
        resolve(Array.from(ips));
      }, 2000);

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timeout);
          pc.close();
          resolve(Array.from(ips));
          return;
        }

        const candidate = event.candidate.candidate;
        const match = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(candidate);

        if (match && match[0]) {
          const ip = match[0];
          // Filter for private IPs only
          if (this.isPrivateIP(ip)) {
            ips.add(ip);
          }
        }
      };

      // Create data channel to trigger ICE gathering
      pc.createDataChannel('');

      // Create and set offer to start gathering
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
      });
    });
  }

  /**
   * Check if an IP is private (local network)
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);

    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  /**
   * Deduplicate servers by endpoint
   */
  private deduplicateServers(servers: ServerInfo[]): ServerInfo[] {
    const unique = new Map<string, ServerInfo>();

    servers.forEach(server => {
      const existing = unique.get(server.endpoint);

      // Keep the most recently seen or highest quality
      if (!existing ||
          server.lastSeen > existing.lastSeen ||
          (server.connectionQuality || 0) > (existing.connectionQuality || 0)) {
        unique.set(server.endpoint, server);
      }
    });

    return Array.from(unique.values());
  }

  /**
   * Load cached servers from localStorage
   */
  private loadCachedServers(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);

      if (cached) {
        const servers = JSON.parse(cached) as ServerInfo[];

        servers.forEach(server => {
          // Convert date strings back to Date objects
          server.lastSeen = new Date(server.lastSeen);

          // Only cache servers seen in the last 7 days
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);

          if (server.lastSeen > weekAgo) {
            this.discoveredServers.set(server.endpoint, server);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load cached servers:', error);
    }
  }

  /**
   * Save discovered servers to cache
   */
  private saveCachedServers(): void {
    try {
      const servers = Array.from(this.discoveredServers.values());

      // Keep only the most recent 20 servers
      const recent = servers
        .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
        .slice(0, 20);

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to save cached servers:', error);
    }
  }

  /**
   * Extract HTTP endpoint from signaling URL
   */
  private extractEndpoint(signalingUrl: string): string {
    return signalingUrl
      .replace(/^wss?:\/\//, 'http://')
      .replace(/\/ws\/signal$/, '')
      .replace(/\/signal$/, '');
  }

  /**
   * Generate unique ID for server
   */
  private generateId(): string {
    return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Discovery timeout')), ms);
    });
  }

  /**
   * Connect to a discovered server
   */
  async connectToServer(server: ServerInfo): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(server.signalingUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);

        // Update server state
        server.state = 'active';
        server.lastSeen = new Date();
        server.connectionQuality = 100;

        this.discoveredServers.set(server.endpoint, server);
        this.saveCachedServers();

        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);

        // Update server state
        server.state = 'unreachable';
        server.connectionQuality = 0;

        reject(error);
      };
    });
  }

  /**
   * Get all discovered servers
   */
  getDiscoveredServers(): ServerInfo[] {
    return Array.from(this.discoveredServers.values());
  }

  /**
   * Clear cached servers
   */
  clearCache(): void {
    this.discoveredServers.clear();
    localStorage.removeItem(this.CACHE_KEY);
  }
}

// Export singleton instance
export const serverDiscovery = new ServerDiscovery();