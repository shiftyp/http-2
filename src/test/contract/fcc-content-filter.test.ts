/**
 * Contract Test: FCC Content Filter
 *
 * Tests content filtering for FCC compliance including music files,
 * business content, and profanity detection.
 * Task T008 per FCC compliance implementation plan.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Type definitions based on the FCC compliance contract
interface ContentFilter {
  initialize(): Promise<void>;
  filterContent(content: string, mimeType?: string): Promise<FilterResult>;
  setFilterLevel(level: 'STRICT' | 'MODERATE' | 'PERMISSIVE'): void;
  setEmergencyMode(enabled: boolean): void;
  getFilterStats(): FilterStats;
  dispose(): void;
}

interface FilterResult {
  passed: boolean;
  warnings: string[];
  blockedReasons: string[];
  emergencyOverride: boolean;
}

interface FilterStats {
  totalScanned: number;
  blocked: number;
  warned: number;
  passed: number;
  emergencyOverrides: number;
}

// Mock implementation for testing
class MockContentFilter implements ContentFilter {
  private filterLevel: 'STRICT' | 'MODERATE' | 'PERMISSIVE' = 'MODERATE';
  private emergencyMode = false;
  private stats: FilterStats = {
    totalScanned: 0,
    blocked: 0,
    warned: 0,
    passed: 0,
    emergencyOverrides: 0
  };

  async initialize(): Promise<void> {
    // Initialize filter
  }

  async filterContent(content: string, mimeType?: string): Promise<FilterResult> {
    this.stats.totalScanned++;

    const warnings: string[] = [];
    const blockedReasons: string[] = [];

    // Check MIME type restrictions
    if (mimeType) {
      if (mimeType.startsWith('audio/') && !this.emergencyMode) {
        blockedReasons.push('Music files prohibited on amateur radio (§97.113)');
      }
    }

    // Check for business content
    const businessKeywords = ['sale', 'profit', 'business', 'commercial', 'buy', 'sell', 'price', '$'];
    const businessMatches = businessKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword.toLowerCase())
    );

    if (businessMatches.length > 0 && !this.emergencyMode) {
      if (this.filterLevel === 'STRICT') {
        blockedReasons.push(`Commercial content detected: ${businessMatches.join(', ')}`);
      } else {
        warnings.push(`Commercial content detected: ${businessMatches.join(', ')}`);
      }
    }

    // Check for profanity
    const profanityWords = ['damn', 'hell', 'shit', 'fuck'];
    const profanityMatches = profanityWords.filter(word =>
      content.toLowerCase().includes(word.toLowerCase())
    );

    if (profanityMatches.length > 0) {
      if (this.filterLevel === 'STRICT') {
        blockedReasons.push(`Profanity detected: ${profanityMatches.length} word(s)`);
      } else {
        warnings.push(`Profanity detected: ${profanityMatches.length} word(s)`);
      }
    }

    const passed = blockedReasons.length === 0;

    // Update stats
    if (passed) {
      if (warnings.length > 0) {
        this.stats.warned++;
      } else {
        this.stats.passed++;
      }
    } else {
      if (this.emergencyMode) {
        this.stats.emergencyOverrides++;
      } else {
        this.stats.blocked++;
      }
    }

    return {
      passed: passed || this.emergencyMode,
      warnings,
      blockedReasons,
      emergencyOverride: this.emergencyMode && blockedReasons.length > 0
    };
  }

  setFilterLevel(level: 'STRICT' | 'MODERATE' | 'PERMISSIVE'): void {
    this.filterLevel = level;
  }

  setEmergencyMode(enabled: boolean): void {
    this.emergencyMode = enabled;
  }

  getFilterStats(): FilterStats {
    return { ...this.stats };
  }

  dispose(): void {
    this.stats = {
      totalScanned: 0,
      blocked: 0,
      warned: 0,
      passed: 0,
      emergencyOverrides: 0
    };
  }
}

describe('FCC Content Filter Contract', () => {
  let contentFilter: ContentFilter;

  beforeEach(async () => {
    contentFilter = new MockContentFilter();
    await contentFilter.initialize();
  });

  afterEach(() => {
    contentFilter.dispose();
  });

  describe('Requirement: Block music files (§97.113)', () => {
    it('should block audio/* MIME types', async () => {
      const result = await contentFilter.filterContent('music content', 'audio/mpeg');

      expect(result.passed).toBe(false);
      expect(result.blockedReasons).toContain('Music files prohibited on amateur radio (§97.113)');
    });

    it('should block various audio formats', async () => {
      const audioFormats = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg'];

      for (const format of audioFormats) {
        const result = await contentFilter.filterContent('audio content', format);
        expect(result.passed).toBe(false);
      }
    });

    it('should allow non-audio content', async () => {
      const result = await contentFilter.filterContent('regular text content', 'text/plain');

      expect(result.passed).toBe(true);
      expect(result.blockedReasons).toHaveLength(0);
    });
  });

  describe('Requirement: Detect business/commercial content', () => {
    it('should detect commercial keywords', async () => {
      const commercialContent = 'For sale: radio equipment at great price! Buy now for profit!';
      const result = await contentFilter.filterContent(commercialContent);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Commercial content detected');
    });

    it('should detect various business terms', async () => {
      const businessTerms = ['sale', 'profit', 'business', 'commercial', 'buy', 'sell', 'price'];

      for (const term of businessTerms) {
        const content = `This message contains ${term} information`;
        const result = await contentFilter.filterContent(content);

        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it('should allow non-commercial content', async () => {
      const content = 'CQ CQ CQ de W1AW - testing HTTP over radio';
      const result = await contentFilter.filterContent(content);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Requirement: Profanity detection', () => {
    it('should detect profanity in content', async () => {
      const profaneContent = 'This damn radio is not working';
      const result = await contentFilter.filterContent(profaneContent);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Profanity detected');
    });

    it('should be case insensitive', async () => {
      const content = 'DAMN this is frustrating';
      const result = await contentFilter.filterContent(content);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Filter levels', () => {
    it('should block commercial content in STRICT mode', async () => {
      contentFilter.setFilterLevel('STRICT');

      const content = 'For sale: antenna system';
      const result = await contentFilter.filterContent(content);

      expect(result.passed).toBe(false);
      expect(result.blockedReasons.length).toBeGreaterThan(0);
    });

    it('should warn about commercial content in MODERATE mode', async () => {
      contentFilter.setFilterLevel('MODERATE');

      const content = 'For sale: antenna system';
      const result = await contentFilter.filterContent(content);

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should be permissive in PERMISSIVE mode', async () => {
      contentFilter.setFilterLevel('PERMISSIVE');

      const content = 'For sale: antenna system with profanity damn';
      const result = await contentFilter.filterContent(content);

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Emergency mode override', () => {
    it('should allow blocked content in emergency mode', async () => {
      contentFilter.setEmergencyMode(true);

      const result = await contentFilter.filterContent('Emergency traffic', 'audio/mpeg');

      expect(result.passed).toBe(true);
      expect(result.emergencyOverride).toBe(true);
    });

    it('should still detect violations but override them', async () => {
      contentFilter.setEmergencyMode(true);

      const result = await contentFilter.filterContent('Emergency sale of supplies', 'audio/wav');

      expect(result.passed).toBe(true);
      expect(result.emergencyOverride).toBe(true);
      expect(result.blockedReasons.length).toBeGreaterThan(0); // Still detected
    });

    it('should not override when emergency mode is disabled', async () => {
      contentFilter.setEmergencyMode(false);

      const result = await contentFilter.filterContent('Regular traffic', 'audio/mpeg');

      expect(result.passed).toBe(false);
      expect(result.emergencyOverride).toBe(false);
    });
  });

  describe('Statistics tracking', () => {
    it('should track scanning statistics', async () => {
      await contentFilter.filterContent('Clean content');
      await contentFilter.filterContent('Commercial sale content');
      await contentFilter.filterContent('Music content', 'audio/mp3');

      const stats = contentFilter.getFilterStats();

      expect(stats.totalScanned).toBe(3);
      expect(stats.passed).toBe(1);
      expect(stats.warned).toBe(1);
      expect(stats.blocked).toBe(1);
    });

    it('should track emergency overrides', async () => {
      contentFilter.setEmergencyMode(true);

      await contentFilter.filterContent('Emergency music', 'audio/wav');
      await contentFilter.filterContent('Emergency sale');

      const stats = contentFilter.getFilterStats();

      expect(stats.emergencyOverrides).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty content', async () => {
      const result = await contentFilter.filterContent('');

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.blockedReasons).toHaveLength(0);
    });

    it('should handle content without MIME type', async () => {
      const result = await contentFilter.filterContent('Regular content');

      expect(result.passed).toBe(true);
    });

    it('should handle unknown MIME types', async () => {
      const result = await contentFilter.filterContent('Content', 'application/unknown');

      expect(result.passed).toBe(true);
    });

    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(10000);
      const result = await contentFilter.filterContent(longContent);

      expect(result.passed).toBe(true);
    });
  });

  describe('Performance requirements', () => {
    it('should filter content within reasonable time', async () => {
      const start = Date.now();

      await contentFilter.filterContent('Test content for performance measurement');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should be under 50ms per spec
    });
  });
});