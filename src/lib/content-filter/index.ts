/**
 * Content Filter
 *
 * Scans and filters content to prevent transmission of prohibited material
 * per FCC regulations. Task T027 per FCC compliance implementation plan.
 */

export interface FilterResult {
  passed: boolean;
  warnings: string[];
  blockedReasons: string[];
  emergencyOverride: boolean;
}

export interface FilterStats {
  totalScanned: number;
  blocked: number;
  warned: number;
  passed: number;
  emergencyOverrides: number;
}

export interface ContentFilterConfig {
  filterLevel: 'STRICT' | 'MODERATE' | 'PERMISSIVE';
  emergencyMode: boolean;
  blockedMimeTypes: string[];
  businessKeywords: string[];
  profanityList: string[];
  maxContentLength: number; // bytes
  scanTimeoutMs: number; // maximum scan time
}

export class ContentFilter extends EventTarget {
  private config: ContentFilterConfig;
  private stats: FilterStats = {
    totalScanned: 0,
    blocked: 0,
    warned: 0,
    passed: 0,
    emergencyOverrides: 0
  };

  constructor(config: Partial<ContentFilterConfig> = {}) {
    super();
    this.config = {
      filterLevel: 'MODERATE',
      emergencyMode: false,
      blockedMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/aac',
        'audio/flac',
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/wmv'
      ],
      businessKeywords: [
        'sale', 'profit', 'business', 'commercial', 'buy', 'sell', 'price',
        'cost', 'money', 'payment', 'purchase', 'discount', 'offer',
        'deal', 'marketing', 'advertisement', 'promotion', 'invoice'
      ],
      profanityList: [
        'damn', 'hell', 'shit', 'fuck', 'bitch', 'ass', 'crap',
        'piss', 'bastard', 'asshole'
      ],
      maxContentLength: 10 * 1024 * 1024, // 10MB
      scanTimeoutMs: 50, // 50ms per spec requirement
      ...config
    };
  }

  /**
   * Initialize content filter
   */
  async initialize(): Promise<void> {
    // Initialize filter components
    this.dispatchEvent(new CustomEvent('filter-initialized', {
      detail: { filterLevel: this.config.filterLevel }
    }));
  }

  /**
   * Filter content for FCC compliance
   */
  async filterContent(content: string, mimeType?: string): Promise<FilterResult> {
    const startTime = performance.now();
    this.stats.totalScanned++;

    try {
      // Check content length
      if (content.length > this.config.maxContentLength) {
        return this.createBlockedResult([
          `Content too large: ${content.length} bytes (max: ${this.config.maxContentLength})`
        ]);
      }

      const warnings: string[] = [];
      const blockedReasons: string[] = [];

      // Check MIME type restrictions
      if (mimeType) {
        const mimeResult = this.checkMimeType(mimeType);
        if (mimeResult.blocked) {
          blockedReasons.push(...mimeResult.reasons);
        } else if (mimeResult.warnings.length > 0) {
          warnings.push(...mimeResult.warnings);
        }
      }

      // Check text content
      const textResult = this.analyzeTextContent(content);
      warnings.push(...textResult.warnings);

      // Apply filter level rules
      if (this.config.filterLevel === 'STRICT') {
        blockedReasons.push(...textResult.blockedInStrict);
      } else if (this.config.filterLevel === 'MODERATE') {
        // Some text warnings become blocks in moderate mode
        const seriousWarnings = textResult.warnings.filter(w =>
          w.includes('Commercial content') && textResult.businessScore > 3
        );
        blockedReasons.push(...seriousWarnings);
      }

      // Check scan time performance
      const scanTime = performance.now() - startTime;
      if (scanTime > this.config.scanTimeoutMs) {
        console.warn(`Content filter scan time: ${scanTime.toFixed(1)}ms (target: <${this.config.scanTimeoutMs}ms)`);
      }

      // Determine final result
      const passed = blockedReasons.length === 0;
      const emergencyOverride = this.config.emergencyMode && blockedReasons.length > 0;

      const result: FilterResult = {
        passed: passed || emergencyOverride,
        warnings,
        blockedReasons,
        emergencyOverride
      };

      // Update statistics
      this.updateStats(result);

      // Dispatch events
      this.dispatchEvent(new CustomEvent('content-filtered', {
        detail: {
          passed: result.passed,
          warnings: warnings.length,
          blocked: blockedReasons.length,
          emergencyOverride,
          scanTimeMs: scanTime
        }
      }));

      return result;

    } catch (error) {
      console.error('Content filtering error:', error);
      return this.createBlockedResult(['Content filter error - blocking for safety']);
    }
  }

  private checkMimeType(mimeType: string): {
    blocked: boolean;
    warnings: string[];
    reasons: string[];
  } {
    const warnings: string[] = [];
    const reasons: string[] = [];

    // Check against blocked MIME types
    const isBlocked = this.config.blockedMimeTypes.some(blocked => {
      if (blocked.endsWith('*')) {
        return mimeType.startsWith(blocked.slice(0, -1));
      }
      return mimeType === blocked;
    });

    if (isBlocked && !this.config.emergencyMode) {
      if (mimeType.startsWith('audio/')) {
        reasons.push('Music files prohibited on amateur radio (§97.113)');
      } else if (mimeType.startsWith('video/')) {
        reasons.push('Video files prohibited on amateur radio (§97.113)');
      } else {
        reasons.push(`MIME type ${mimeType} prohibited on amateur radio`);
      }
    }

    // Check for potentially problematic but not strictly prohibited types
    if (mimeType.startsWith('application/') && mimeType.includes('encrypted')) {
      warnings.push('Encrypted content detected - may violate FCC regulations');
    }

    return {
      blocked: reasons.length > 0,
      warnings,
      reasons
    };
  }

  private analyzeTextContent(content: string): {
    warnings: string[];
    blockedInStrict: string[];
    businessScore: number;
    profanityScore: number;
  } {
    const warnings: string[] = [];
    const blockedInStrict: string[] = [];
    let businessScore = 0;
    let profanityScore = 0;

    const lowerContent = content.toLowerCase();

    // Business content detection
    const businessMatches = this.config.businessKeywords.filter(keyword =>
      lowerContent.includes(keyword.toLowerCase())
    );

    if (businessMatches.length > 0) {
      businessScore = businessMatches.length;
      const warning = `Commercial content detected: ${businessMatches.slice(0, 3).join(', ')}${businessMatches.length > 3 ? '...' : ''}`;
      warnings.push(warning);

      if (this.config.filterLevel === 'STRICT') {
        blockedInStrict.push(warning);
      }
    }

    // Profanity detection
    const profanityMatches = this.config.profanityList.filter(word =>
      lowerContent.includes(word.toLowerCase())
    );

    if (profanityMatches.length > 0) {
      profanityScore = profanityMatches.length;
      const warning = `Profanity detected: ${profanityMatches.length} word(s)`;
      warnings.push(warning);

      if (this.config.filterLevel === 'STRICT') {
        blockedInStrict.push(warning);
      }
    }

    // Pattern detection for suspicious content
    const patterns = [
      { regex: /\$\d+/g, warning: 'Price references detected' },
      { regex: /\b\d{3}-\d{3}-\d{4}\b/g, warning: 'Phone numbers detected' },
      { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, warning: 'Email addresses detected' },
      { regex: /https?:\/\/[^\s]+/g, warning: 'URLs detected' }
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern.regex);
      if (matches && matches.length > 0) {
        warnings.push(`${pattern.warning} (${matches.length})`);
      }
    }

    // Check for excessive capitalization (shouting)
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.5 && content.length > 20) {
      warnings.push('Excessive capitalization detected');
    }

    return {
      warnings,
      blockedInStrict,
      businessScore,
      profanityScore
    };
  }

  private createBlockedResult(reasons: string[]): FilterResult {
    this.stats.blocked++;

    return {
      passed: false,
      warnings: [],
      blockedReasons: reasons,
      emergencyOverride: false
    };
  }

  private updateStats(result: FilterResult): void {
    if (result.emergencyOverride) {
      this.stats.emergencyOverrides++;
    } else if (result.passed) {
      if (result.warnings.length > 0) {
        this.stats.warned++;
      } else {
        this.stats.passed++;
      }
    } else {
      this.stats.blocked++;
    }
  }

  /**
   * Set filter level
   */
  setFilterLevel(level: 'STRICT' | 'MODERATE' | 'PERMISSIVE'): void {
    this.config.filterLevel = level;

    this.dispatchEvent(new CustomEvent('filter-level-changed', {
      detail: { level }
    }));
  }

  /**
   * Set emergency mode
   */
  setEmergencyMode(enabled: boolean): void {
    this.config.emergencyMode = enabled;

    this.dispatchEvent(new CustomEvent('emergency-mode-changed', {
      detail: { enabled }
    }));
  }

  /**
   * Get filter statistics
   */
  getFilterStats(): FilterStats {
    return { ...this.stats };
  }

  /**
   * Add custom business keyword
   */
  addBusinessKeyword(keyword: string): void {
    if (!this.config.businessKeywords.includes(keyword.toLowerCase())) {
      this.config.businessKeywords.push(keyword.toLowerCase());
    }
  }

  /**
   * Remove business keyword
   */
  removeBusinessKeyword(keyword: string): void {
    const index = this.config.businessKeywords.indexOf(keyword.toLowerCase());
    if (index > -1) {
      this.config.businessKeywords.splice(index, 1);
    }
  }

  /**
   * Add custom profanity word
   */
  addProfanityWord(word: string): void {
    if (!this.config.profanityList.includes(word.toLowerCase())) {
      this.config.profanityList.push(word.toLowerCase());
    }
  }

  /**
   * Remove profanity word
   */
  removeProfanityWord(word: string): void {
    const index = this.config.profanityList.indexOf(word.toLowerCase());
    if (index > -1) {
      this.config.profanityList.splice(index, 1);
    }
  }

  /**
   * Add blocked MIME type
   */
  addBlockedMimeType(mimeType: string): void {
    if (!this.config.blockedMimeTypes.includes(mimeType)) {
      this.config.blockedMimeTypes.push(mimeType);
    }
  }

  /**
   * Remove blocked MIME type
   */
  removeBlockedMimeType(mimeType: string): void {
    const index = this.config.blockedMimeTypes.indexOf(mimeType);
    if (index > -1) {
      this.config.blockedMimeTypes.splice(index, 1);
    }
  }

  /**
   * Test filter performance
   */
  async testPerformance(testContent: string, iterations: number = 100): Promise<{
    averageTime: number;
    maxTime: number;
    minTime: number;
    passedTarget: boolean;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.filterContent(testContent);
      const duration = performance.now() - start;
      times.push(duration);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const passedTarget = averageTime <= this.config.scanTimeoutMs;

    return {
      averageTime,
      maxTime,
      minTime,
      passedTarget
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalScanned: 0,
      blocked: 0,
      warned: 0,
      passed: 0,
      emergencyOverrides: 0
    };

    this.dispatchEvent(new CustomEvent('stats-reset'));
  }

  /**
   * Export current configuration
   */
  exportConfig(): ContentFilterConfig {
    return { ...this.config };
  }

  /**
   * Import configuration
   */
  importConfig(config: ContentFilterConfig): void {
    this.config = { ...config };

    this.dispatchEvent(new CustomEvent('config-imported', {
      detail: { filterLevel: this.config.filterLevel }
    }));
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.resetStats();
  }
}

export { ContentFilter as default };