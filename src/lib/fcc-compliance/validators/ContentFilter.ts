/**
 * Content Filter
 *
 * Implements FCC §97.113 content restrictions including business
 * communications, music, and prohibited content filtering.
 */

import { ContentFilterConfig, ContentAnalysisResult, ComplianceViolation, ViolationType } from '../types.js';

export interface ContentFilterResult {
  compliant: boolean;
  violations: ComplianceViolation[];
  warnings: string[];
  shouldBlock: boolean;
  modified: boolean;
  originalContent?: string;
  filteredContent?: string;
}

export class ContentFilter {
  private config: ContentFilterConfig;
  private isEnabled = false;
  private eventListeners: Map<string, Function[]> = new Map();

  // Content analysis patterns
  private musicPatterns = [
    /\b(mp3|wav|flac|aac|ogg|m4a)\b/i,
    /\b(music|song|album|artist|band|lyrics)\b/i,
    /\b(spotify|apple music|pandora|youtube music)\b/i,
    /\b(copyright|ascap|bmi|riaa)\b/i
  ];

  private businessPatterns = [
    /\b(buy|sell|purchase|price|cost|payment|invoice)\b/i,
    /\b(business|commercial|advertisement|promotion)\b/i,
    /\b(sale|discount|offer|deal|marketing)\b/i,
    /\$\d+|\d+\s*dollars?/i,
    /\b(llc|inc|corp|company|enterprise)\b/i
  ];

  private profanityWords = [
    // Basic profanity filter - would be more comprehensive in production
    'damn', 'hell', 'crap', 'shit', 'fuck', 'bitch', 'ass', 'bastard'
  ];

  constructor(config: ContentFilterConfig) {
    this.config = config;
  }

  /**
   * Enable content filtering
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable content filtering
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Analyze content for compliance violations
   */
  async analyzeContent(content: string | ArrayBuffer): Promise<ContentFilterResult> {
    if (!this.isEnabled) {
      return {
        compliant: true,
        violations: [],
        warnings: [],
        shouldBlock: false,
        modified: false
      };
    }

    const violations: ComplianceViolation[] = [];
    const warnings: string[] = [];
    let shouldBlock = false;
    let modified = false;
    let filteredContent: string | undefined;

    // Convert binary content to string for analysis
    let textContent: string;
    if (typeof content === 'string') {
      textContent = content;
    } else {
      // Try to decode as UTF-8
      try {
        textContent = new TextDecoder('utf-8').decode(content);
      } catch {
        // If not text, analyze as binary
        return await this.analyzeBinaryContent(content);
      }
    }

    // Perform content analysis
    const analysis = await this.performContentAnalysis(textContent);

    // Check for music content
    if (this.config.blockMusic && analysis.isMusic) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.MUSIC_BLOCKED,
        severity: 'medium',
        timestamp: new Date(),
        description: `Music content detected: ${analysis.details.musicGenre || 'Unknown genre'}`,
        regulation: '§97.113(a)(4)',
        content: textContent.substring(0, 100),
        transmissionMode: 'rf' as any,
        callsign: '', // Will be set by compliance manager
        blocked: true,
        overridden: false
      });
      shouldBlock = true;
    }

    // Check for business content
    if (this.config.blockBusiness && analysis.isBusiness) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.BUSINESS_CONTENT,
        severity: 'high',
        timestamp: new Date(),
        description: `Business communication detected: ${analysis.details.businessType || 'Commercial content'}`,
        regulation: '§97.113(a)(3)',
        content: textContent.substring(0, 100),
        transmissionMode: 'rf' as any,
        callsign: '',
        blocked: true,
        overridden: false
      });
      shouldBlock = true;
    }

    // Check for profanity
    if (this.config.profanityFilter && analysis.hasProfanity) {
      if (this.config.emergencyOverride) {
        // In emergency mode, filter but don't block
        filteredContent = this.filterProfanity(textContent);
        modified = true;
        warnings.push('Profanity filtered due to emergency mode');
      } else {
        violations.push({
          id: crypto.randomUUID(),
          type: ViolationType.CONTENT_FILTERED,
          severity: 'low',
          timestamp: new Date(),
          description: `Profanity detected: ${analysis.details.profanityWords?.join(', ') || 'Various words'}`,
          regulation: '§97.113(a)(4) - Good amateur practice',
          content: textContent.substring(0, 100),
          transmissionMode: 'rf' as any,
          callsign: '',
          blocked: false, // Just filter, don't block
          overridden: false
        });
        filteredContent = this.filterProfanity(textContent);
        modified = true;
      }
    }

    // Check file size limits
    if (this.config.maxFileSize > 0 && textContent.length > this.config.maxFileSize) {
      warnings.push(`Content size ${textContent.length} bytes exceeds limit ${this.config.maxFileSize} bytes`);
    }

    // Check custom blocked words
    const blockedWordFound = this.config.blockedWords.find(word =>
      textContent.toLowerCase().includes(word.toLowerCase())
    );
    if (blockedWordFound) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.CONTENT_FILTERED,
        severity: 'medium',
        timestamp: new Date(),
        description: `Blocked word detected: ${blockedWordFound}`,
        regulation: 'Custom content policy',
        content: textContent.substring(0, 100),
        transmissionMode: 'rf' as any,
        callsign: '',
        blocked: true,
        overridden: false
      });
      shouldBlock = true;
    }

    // Emit events for violations
    if (violations.length > 0) {
      this.emit('content-blocked', {
        violations,
        originalContent: textContent,
        filteredContent,
        timestamp: new Date()
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
      warnings,
      shouldBlock: shouldBlock && !this.config.emergencyOverride,
      modified,
      originalContent: textContent,
      filteredContent
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: ContentFilterConfig): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get health status
   */
  getHealthStatus(): 'healthy' | 'warning' | 'error' {
    if (!this.isEnabled) {
      return 'warning'; // Should be enabled for compliance
    }

    return 'healthy';
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Perform detailed content analysis
   */
  private async performContentAnalysis(content: string): Promise<ContentAnalysisResult> {
    const result: ContentAnalysisResult = {
      isMusic: false,
      isBusiness: false,
      hasProfanity: false,
      hasEncryption: false,
      confidence: 0,
      details: {},
      recommendation: 'allow',
      reasoning: 'Content appears compliant'
    };

    // Check for music content
    const musicScore = this.analyzeForMusic(content);
    if (musicScore.score > 0.5) {
      result.isMusic = true;
      result.details.musicGenre = musicScore.genre;
      result.confidence = Math.max(result.confidence, musicScore.score);
    }

    // Check for business content
    const businessScore = this.analyzeForBusiness(content);
    if (businessScore.score > 0.5) {
      result.isBusiness = true;
      result.details.businessType = businessScore.type;
      result.confidence = Math.max(result.confidence, businessScore.score);
    }

    // Check for profanity
    const profanityResult = this.analyzeForProfanity(content);
    if (profanityResult.found) {
      result.hasProfanity = true;
      result.details.profanityWords = profanityResult.words;
      result.confidence = Math.max(result.confidence, 0.9);
    }

    // Determine recommendation
    if (result.isMusic || result.isBusiness) {
      result.recommendation = 'block';
      result.reasoning = 'Content violates FCC regulations';
    } else if (result.hasProfanity) {
      result.recommendation = 'modify';
      result.reasoning = 'Content contains inappropriate language';
    }

    return result;
  }

  /**
   * Analyze content for music references
   */
  private analyzeForMusic(content: string): { score: number; genre?: string } {
    let score = 0;
    let genre: string | undefined;

    for (const pattern of this.musicPatterns) {
      if (pattern.test(content)) {
        score += 0.3;
      }
    }

    // Check for specific music genres
    const genres = ['rock', 'jazz', 'classical', 'pop', 'country', 'hip-hop', 'electronic'];
    for (const g of genres) {
      if (content.toLowerCase().includes(g)) {
        score += 0.4;
        genre = g;
        break;
      }
    }

    // Check for music file extensions
    if (/\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(content)) {
      score += 0.7;
    }

    return { score: Math.min(1, score), genre };
  }

  /**
   * Analyze content for business communications
   */
  private analyzeForBusiness(content: string): { score: number; type?: string } {
    let score = 0;
    let type: string | undefined;

    for (const pattern of this.businessPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += 0.2;
        if (!type) {
          type = matches[0];
        }
      }
    }

    // Check for monetary amounts
    const moneyMatches = content.match(/\$\d+|\d+\s*dollars?/gi);
    if (moneyMatches) {
      score += 0.5;
      type = 'monetary transaction';
    }

    // Check for business entities
    if (/\b(llc|inc|corp|ltd)\b/i.test(content)) {
      score += 0.6;
      type = 'business entity';
    }

    return { score: Math.min(1, score), type };
  }

  /**
   * Analyze content for profanity
   */
  private analyzeForProfanity(content: string): { found: boolean; words: string[] } {
    const foundWords: string[] = [];
    const lowerContent = content.toLowerCase();

    for (const word of this.profanityWords) {
      if (lowerContent.includes(word)) {
        foundWords.push(word);
      }
    }

    return { found: foundWords.length > 0, words: foundWords };
  }

  /**
   * Filter profanity from content
   */
  private filterProfanity(content: string): string {
    let filtered = content;

    for (const word of this.profanityWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    }

    return filtered;
  }

  /**
   * Analyze binary content
   */
  private async analyzeBinaryContent(content: ArrayBuffer): Promise<ContentFilterResult> {
    const violations: ComplianceViolation[] = [];
    const warnings: string[] = [];

    // Check file size
    if (this.config.maxFileSize > 0 && content.byteLength > this.config.maxFileSize) {
      violations.push({
        id: crypto.randomUUID(),
        type: ViolationType.CONTENT_FILTERED,
        severity: 'medium',
        timestamp: new Date(),
        description: `File size ${content.byteLength} bytes exceeds limit ${this.config.maxFileSize} bytes`,
        regulation: 'Bandwidth conservation',
        transmissionMode: 'rf' as any,
        callsign: '',
        blocked: true,
        overridden: false
      });
    }

    // Check for music file headers
    const view = new Uint8Array(content.slice(0, 16));
    const musicHeaders = [
      { signature: [0x49, 0x44, 0x33], name: 'MP3 (ID3)' },
      { signature: [0xFF, 0xFB], name: 'MP3' },
      { signature: [0x52, 0x49, 0x46, 0x46], name: 'WAV/RIFF' }
    ];

    for (const header of musicHeaders) {
      if (this.matchesSignature(view, header.signature)) {
        violations.push({
          id: crypto.randomUUID(),
          type: ViolationType.MUSIC_BLOCKED,
          severity: 'high',
          timestamp: new Date(),
          description: `Music file detected: ${header.name}`,
          regulation: '§97.113(a)(4)',
          transmissionMode: 'rf' as any,
          callsign: '',
          blocked: true,
          overridden: false
        });
        break;
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      warnings,
      shouldBlock: violations.length > 0 && !this.config.emergencyOverride,
      modified: false
    };
  }

  /**
   * Check if binary data matches a signature
   */
  private matchesSignature(data: Uint8Array, signature: number[]): boolean {
    if (data.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (data[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in content filter event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Dispose of the content filter
   */
  dispose(): void {
    this.eventListeners.clear();
  }
}

export default ContentFilter;