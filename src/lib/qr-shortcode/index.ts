/**
 * QR Code and shortcode generation for WebRTC connection establishment
 * Used for local network peer-to-peer transfers only
 */

export interface ConnectionInfo {
  sessionId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidates?: RTCIceCandidateInit[];
  timestamp: number;
  expires: number;
}

export interface ShortcodeConfig {
  length?: number;
  charset?: string;
  expiry?: number; // milliseconds
}

export class QRShortcode {
  private shortcodes: Map<string, ConnectionInfo> = new Map();
  private config: ShortcodeConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ShortcodeConfig = {}) {
    this.config = {
      length: config.length || 6,
      charset: config.charset || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Avoid ambiguous chars
      expiry: config.expiry || 300000 // 5 minutes default
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Generate QR code data URL for connection info
   */
  async generateQRCode(connectionInfo: string): Promise<string> {
    // In a real implementation, would use a QR library like qrcode.js
    // For now, return a data URL placeholder
    const canvas = this.createQRCanvas(connectionInfo);
    return canvas.toDataURL('image/png');
  }

  /**
   * Create a canvas with QR code (simplified implementation)
   */
  private createQRCanvas(data: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    // Create simple pattern based on data hash
    const hash = this.hashString(data);
    const moduleSize = 8;
    const modules = size / moduleSize;

    ctx.fillStyle = 'black';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const index = row * modules + col;
        if (this.getBit(hash, index % (hash.length * 8))) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize - 1, moduleSize - 1);
        }
      }
    }

    // Add positioning markers (corners)
    this.drawPositionMarker(ctx, 0, 0, moduleSize);
    this.drawPositionMarker(ctx, size - 7 * moduleSize, 0, moduleSize);
    this.drawPositionMarker(ctx, 0, size - 7 * moduleSize, moduleSize);

    return canvas;
  }

  /**
   * Draw QR position marker
   */
  private drawPositionMarker(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = 'black';
    ctx.fillRect(x, y, size * 7, size * 7);
    ctx.fillStyle = 'white';
    ctx.fillRect(x + size, y + size, size * 5, size * 5);
    ctx.fillStyle = 'black';
    ctx.fillRect(x + size * 2, y + size * 2, size * 3, size * 3);
  }

  /**
   * Generate shortcode for connection info
   */
  generateShortcode(connectionInfo: ConnectionInfo): string {
    let shortcode: string;

    // Generate unique shortcode
    do {
      shortcode = this.randomShortcode();
    } while (this.shortcodes.has(shortcode));

    // Store with expiry
    connectionInfo.expires = Date.now() + this.config.expiry!;
    this.shortcodes.set(shortcode, connectionInfo);

    return shortcode;
  }

  /**
   * Retrieve connection info by shortcode
   */
  getConnectionInfo(shortcode: string): ConnectionInfo | null {
    const info = this.shortcodes.get(shortcode.toUpperCase());

    if (!info) return null;

    // Check if expired
    if (Date.now() > info.expires) {
      this.shortcodes.delete(shortcode);
      return null;
    }

    return info;
  }

  /**
   * Generate random shortcode
   */
  private randomShortcode(): string {
    let code = '';
    for (let i = 0; i < this.config.length!; i++) {
      const index = Math.floor(Math.random() * this.config.charset!.length);
      code += this.config.charset![index];
    }
    return code;
  }

  /**
   * Hash string to bytes for QR pattern
   */
  private hashString(str: string): Uint8Array {
    // Simple hash for demo - in production would use proper hashing
    const hash = new Uint8Array(32);
    for (let i = 0; i < str.length; i++) {
      hash[i % 32] ^= str.charCodeAt(i);
    }

    // Mix the hash
    for (let i = 0; i < 32; i++) {
      hash[i] = (hash[i] * 31 + hash[(i + 1) % 32]) & 0xFF;
    }

    return hash;
  }

  /**
   * Get bit from hash at position
   */
  private getBit(hash: Uint8Array, position: number): boolean {
    const byteIndex = Math.floor(position / 8);
    const bitIndex = position % 8;
    return (hash[byteIndex % hash.length] & (1 << bitIndex)) !== 0;
  }

  /**
   * Format connection info for display
   */
  formatForDisplay(shortcode: string): string {
    // Format as XXX-XXX for 6-char codes
    if (shortcode.length === 6) {
      return `${shortcode.slice(0, 3)}-${shortcode.slice(3)}`;
    }
    return shortcode;
  }

  /**
   * Parse formatted shortcode
   */
  parseShortcode(formatted: string): string {
    return formatted.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  /**
   * Encode connection info to base64
   */
  encodeConnectionInfo(info: ConnectionInfo): string {
    const json = JSON.stringify(info);
    return btoa(json);
  }

  /**
   * Decode connection info from base64
   */
  decodeConnectionInfo(encoded: string): ConnectionInfo {
    const json = atob(encoded);
    return JSON.parse(json);
  }

  /**
   * Generate shareable URL with connection info
   */
  generateShareURL(baseURL: string, connectionInfo: string): string {
    const encoded = encodeURIComponent(connectionInfo);
    return `${baseURL}#transfer=${encoded}`;
  }

  /**
   * Parse connection info from URL
   */
  parseShareURL(url: string): string | null {
    const match = url.match(/#transfer=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  /**
   * Start cleanup interval for expired codes
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [code, info] of this.shortcodes.entries()) {
        if (now > info.expires) {
          this.shortcodes.delete(code);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Generate visual representation of shortcode
   */
  generateVisualCode(shortcode: string): string {
    // Create ASCII art representation for terminal display
    const lines: string[] = [
      '┌─────────────────┐',
      '│                 │',
      `│   ${this.formatForDisplay(shortcode)}   │`,
      '│                 │',
      '└─────────────────┘'
    ];
    return lines.join('\n');
  }

  /**
   * Validate shortcode format
   */
  isValidShortcode(code: string): boolean {
    const cleaned = this.parseShortcode(code);
    if (cleaned.length !== this.config.length) return false;

    for (const char of cleaned) {
      if (!this.config.charset!.includes(char)) return false;
    }

    return true;
  }

  /**
   * Get all active shortcodes (for debugging)
   */
  getActiveShortcodes(): string[] {
    const now = Date.now();
    return Array.from(this.shortcodes.entries())
      .filter(([_, info]) => now <= info.expires)
      .map(([code, _]) => code);
  }

  /**
   * Clear specific shortcode
   */
  clearShortcode(shortcode: string): boolean {
    return this.shortcodes.delete(shortcode.toUpperCase());
  }

  /**
   * Clear all shortcodes
   */
  clearAll(): void {
    this.shortcodes.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    active: number;
    expired: number;
    totalGenerated: number;
  } {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const info of this.shortcodes.values()) {
      if (now <= info.expires) {
        active++;
      } else {
        expired++;
      }
    }

    return {
      active,
      expired,
      totalGenerated: active + expired
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.shortcodes.clear();
  }
}