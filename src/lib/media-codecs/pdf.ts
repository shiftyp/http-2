/**
 * PDF Document Encoder/Decoder
 * 
 * PDF compression and text extraction for efficient
 * document transmission over narrow-band.
 */

import type { MediaCodec, EncodingOptions } from './index.js';

export interface PDFDocument {
  pages: PDFPage[];
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export interface PDFPage {
  text: string;
  images?: ImageData[];
  width: number;
  height: number;
}

export class PDFEncoder implements MediaCodec<PDFDocument | Blob> {
  /**
   * Encode PDF document
   */
  async encode(
    data: PDFDocument | Blob,
    options: EncodingOptions = {}
  ): Promise<Uint8Array> {
    const {
      quality = 75,
      maxSize = Infinity
    } = options;

    if (data instanceof Blob) {
      // Re-compress existing PDF
      return await this.recompressPDF(data, quality, maxSize);
    }

    // Generate PDF from document structure
    return await this.generatePDF(data, quality, maxSize);
  }

  /**
   * Decode PDF to document structure
   */
  async decode(
    data: Uint8Array,
    options?: any
  ): Promise<PDFDocument> {
    // Extract text and images from PDF
    return await this.parsePDF(data);
  }

  /**
   * Get media type
   */
  getMediaType(): string {
    return 'application/pdf';
  }

  /**
   * Estimate encoded size
   */
  estimateSize(
    data: PDFDocument | Blob,
    options?: EncodingOptions
  ): number {
    if (data instanceof Blob) {
      return data.size;
    }

    // Estimate based on text and images
    let size = 0;
    
    for (const page of data.pages) {
      // Text: ~1 byte per character
      size += page.text.length;
      
      // Images: rough estimate
      if (page.images) {
        for (const img of page.images) {
          size += (img.width * img.height * 3) / 10; // Compressed estimate
        }
      }
    }

    // Add PDF overhead
    size *= 1.2;

    return Math.floor(size);
  }

  /**
   * Generate PDF from document structure
   */
  private async generatePDF(
    doc: PDFDocument,
    quality: number,
    maxSize: number
  ): Promise<Uint8Array> {
    // Simplified PDF generation
    const lines: string[] = [];
    
    // PDF header
    lines.push('%PDF-1.4');
    lines.push('%\xE2\xE3\xCF\xD3');

    // Document catalog
    lines.push('1 0 obj');
    lines.push('<< /Type /Catalog /Pages 2 0 R >>');
    lines.push('endobj');

    // Pages object
    lines.push('2 0 obj');
    lines.push(`<< /Type /Pages /Count ${doc.pages.length} /Kids [`);
    for (let i = 0; i < doc.pages.length; i++) {
      lines.push(`${3 + i * 2} 0 R `);
    }
    lines.push('] >>');
    lines.push('endobj');

    // Add each page
    let objNum = 3;
    for (const page of doc.pages) {
      // Page object
      lines.push(`${objNum} 0 obj`);
      lines.push(`<< /Type /Page /Parent 2 0 R /Contents ${objNum + 1} 0 R`);
      lines.push(`   /MediaBox [0 0 ${page.width} ${page.height}]`);
      lines.push('   /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>');
      lines.push('>>');
      lines.push('endobj');
      objNum++;

      // Content stream
      const content = this.formatPageContent(page);
      lines.push(`${objNum} 0 obj`);
      lines.push(`<< /Length ${content.length} >>`);
      lines.push('stream');
      lines.push(content);
      lines.push('endstream');
      lines.push('endobj');
      objNum++;
    }

    // Cross-reference table
    const xref = lines.join('\n').length;
    lines.push('xref');
    lines.push(`0 ${objNum}`);
    lines.push('0000000000 65535 f');
    // Add object offsets (simplified)
    for (let i = 1; i < objNum; i++) {
      lines.push('0000000000 00000 n');
    }

    // Trailer
    lines.push('trailer');
    lines.push(`<< /Size ${objNum} /Root 1 0 R >>`);
    lines.push('startxref');
    lines.push(String(xref));
    lines.push('%%EOF');

    const pdfContent = lines.join('\n');
    const encoded = new TextEncoder().encode(pdfContent);

    // Compress if needed
    if (encoded.length > maxSize) {
      return await this.compressPDFContent(doc, maxSize, quality);
    }

    return encoded;
  }

  /**
   * Format page content
   */
  private formatPageContent(page: PDFPage): string {
    const lines: string[] = [];
    
    lines.push('BT'); // Begin text
    lines.push('/F1 12 Tf'); // Font and size
    lines.push('50 750 Td'); // Position

    // Add text with word wrapping
    const words = page.text.split(' ');
    let currentLine = '';
    const maxWidth = 80;

    for (const word of words) {
      if (currentLine.length + word.length > maxWidth) {
        lines.push(`(${currentLine}) Tj`);
        lines.push('0 -15 Td'); // Next line
        currentLine = word;
      } else {
        currentLine += (currentLine ? ' ' : '') + word;
      }
    }
    
    if (currentLine) {
      lines.push(`(${currentLine}) Tj`);
    }

    lines.push('ET'); // End text

    return lines.join('\n');
  }

  /**
   * Parse PDF to document structure
   */
  private async parsePDF(data: Uint8Array): Promise<PDFDocument> {
    const text = new TextDecoder().decode(data);
    
    // Simplified parsing - extract text between BT and ET
    const pages: PDFPage[] = [];
    const textMatches = text.matchAll(/BT([\s\S]*?)ET/g);
    
    for (const match of textMatches) {
      const pageText = match[1]
        .replace(/\\/g, '')
        .replace(/\(([^)]*)\)\s*Tj/g, '$1')
        .replace(/[\r\n]+/g, ' ')
        .trim();
      
      pages.push({
        text: pageText,
        width: 612,  // Letter size
        height: 792
      });
    }

    // Extract metadata if present
    const metadata: any = {};
    const titleMatch = text.match(/\/Title\s*\(([^)]*)\)/);
    if (titleMatch) metadata.title = titleMatch[1];
    
    const authorMatch = text.match(/\/Author\s*\(([^)]*)\)/);
    if (authorMatch) metadata.author = authorMatch[1];

    return {
      pages: pages.length > 0 ? pages : [{ text: '', width: 612, height: 792 }],
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    };
  }

  /**
   * Recompress existing PDF
   */
  private async recompressPDF(
    blob: Blob,
    quality: number,
    maxSize: number
  ): Promise<Uint8Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Parse and reconstruct with lower quality
    const doc = await this.parsePDF(data);
    return await this.generatePDF(doc, quality, maxSize);
  }

  /**
   * Compress PDF content
   */
  private async compressPDFContent(
    doc: PDFDocument,
    maxSize: number,
    quality: number
  ): Promise<Uint8Array> {
    // Reduce text content
    const compressed: PDFDocument = {
      ...doc,
      pages: doc.pages.map(page => ({
        ...page,
        text: this.truncateText(page.text, maxSize / doc.pages.length),
        images: [] // Remove images if size constrained
      }))
    };

    return await this.generatePDF(compressed, quality, maxSize);
  }

  /**
   * Truncate text to fit size
   */
  private truncateText(text: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    let truncated = text;
    
    while (encoder.encode(truncated).length > maxBytes && truncated.length > 0) {
      // Remove last sentence
      const lastPeriod = truncated.lastIndexOf('.');
      if (lastPeriod > 0) {
        truncated = truncated.substring(0, lastPeriod + 1);
      } else {
        // Remove last word
        truncated = truncated.substring(0, truncated.lastIndexOf(' '));
      }
    }

    return truncated;
  }
}

/**
 * Text extractor for efficient transmission
 */
export class PDFTextExtractor {
  /**
   * Extract plain text from PDF
   */
  async extractText(pdfData: Uint8Array): Promise<string> {
    const encoder = new PDFEncoder();
    const doc = await encoder.decode(pdfData);
    
    return doc.pages
      .map(page => page.text)
      .join('\n\n');
  }

  /**
   * Extract text summary
   */
  async extractSummary(
    pdfData: Uint8Array,
    maxLength: number = 500
  ): Promise<string> {
    const text = await this.extractText(pdfData);
    
    if (text.length <= maxLength) {
      return text;
    }

    // Extract first paragraph or sentences
    const sentences = text.split(/[.!?]+/);
    let summary = '';
    
    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) {
        break;
      }
      summary += sentence + '. ';
    }

    return summary.trim();
  }
}