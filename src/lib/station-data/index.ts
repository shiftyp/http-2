/**
 * Station data export/import for backup and migration
 * Handles all station-specific data including logbooks, messages, settings
 */

import { db } from '../database';
import { logbook } from '../logbook';
import { cryptoManager } from '../crypto';

export interface StationData {
  version: string;
  exported: string;
  callsign: string;
  data: {
    qsoLog?: any[];
    pages?: any[];
    meshNodes?: any[];
    messages?: any[];
    certificates?: any[];
    settings?: Record<string, any>;
    serverApps?: any[];
    cache?: any[];
  };
  metadata: {
    itemCount: number;
    exportSize: number;
    checksum: string;
  };
}

export interface ExportOptions {
  includeQSOs?: boolean;
  includePages?: boolean;
  includeMeshNodes?: boolean;
  includeMessages?: boolean;
  includeCertificates?: boolean;
  includeSettings?: boolean;
  includeServerApps?: boolean;
  includeCache?: boolean;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  callsignFilter?: string;
}

export interface ImportOptions {
  overwrite?: boolean;
  merge?: boolean;
  validateChecksum?: boolean;
  dryRun?: boolean;
}

export class StationDataManager {
  private version = '1.0.0';

  /**
   * Export station data based on options
   */
  async exportData(callsign: string, options: ExportOptions = {}): Promise<StationData> {
    // Default to exporting everything except cache
    const opts: ExportOptions = {
      includeQSOs: true,
      includePages: true,
      includeMeshNodes: true,
      includeMessages: true,
      includeCertificates: true,
      includeSettings: true,
      includeServerApps: true,
      includeCache: false,
      ...options
    };

    const data: StationData = {
      version: this.version,
      exported: new Date().toISOString(),
      callsign,
      data: {},
      metadata: {
        itemCount: 0,
        exportSize: 0,
        checksum: ''
      }
    };

    // Export QSO Log
    if (opts.includeQSOs) {
      const qsos = await this.exportQSOs(opts);
      if (qsos.length > 0) {
        data.data.qsoLog = qsos;
        data.metadata.itemCount += qsos.length;
      }
    }

    // Export Pages
    if (opts.includePages) {
      const pages = await this.exportPages();
      if (pages.length > 0) {
        data.data.pages = pages;
        data.metadata.itemCount += pages.length;
      }
    }

    // Export Mesh Nodes
    if (opts.includeMeshNodes) {
      const nodes = await this.exportMeshNodes();
      if (nodes.length > 0) {
        data.data.meshNodes = nodes;
        data.metadata.itemCount += nodes.length;
      }
    }

    // Export Messages
    if (opts.includeMessages) {
      const messages = await this.exportMessages(callsign);
      if (messages.length > 0) {
        data.data.messages = messages;
        data.metadata.itemCount += messages.length;
      }
    }

    // Export Certificates
    if (opts.includeCertificates) {
      const certs = await this.exportCertificates();
      if (certs.length > 0) {
        data.data.certificates = certs;
        data.metadata.itemCount += certs.length;
      }
    }

    // Export Settings
    if (opts.includeSettings) {
      const settings = await this.exportSettings();
      if (Object.keys(settings).length > 0) {
        data.data.settings = settings;
        data.metadata.itemCount += Object.keys(settings).length;
      }
    }

    // Export Server Apps
    if (opts.includeServerApps) {
      const apps = await this.exportServerApps();
      if (apps.length > 0) {
        data.data.serverApps = apps;
        data.metadata.itemCount += apps.length;
      }
    }

    // Export Cache (optional)
    if (opts.includeCache) {
      const cache = await this.exportCache();
      if (cache.length > 0) {
        data.data.cache = cache;
        data.metadata.itemCount += cache.length;
      }
    }

    // Calculate size and checksum
    const jsonStr = JSON.stringify(data.data);
    data.metadata.exportSize = new Blob([jsonStr]).size;
    data.metadata.checksum = await this.calculateChecksum(jsonStr);

    return data;
  }

  /**
   * Import station data with options
   */
  async importData(data: StationData, options: ImportOptions = {}): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const opts: ImportOptions = {
      overwrite: false,
      merge: true,
      validateChecksum: true,
      dryRun: false,
      ...options
    };

    const result = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // Validate version
    if (data.version !== this.version) {
      result.errors.push(`Version mismatch: expected ${this.version}, got ${data.version}`);
      if (!this.isCompatibleVersion(data.version)) {
        result.success = false;
        return result;
      }
    }

    // Validate checksum
    if (opts.validateChecksum) {
      const jsonStr = JSON.stringify(data.data);
      const checksum = await this.calculateChecksum(jsonStr);
      if (checksum !== data.metadata.checksum) {
        result.errors.push('Checksum validation failed');
        result.success = false;
        return result;
      }
    }

    // Dry run - just validate without importing
    if (opts.dryRun) {
      return {
        ...result,
        imported: data.metadata.itemCount,
        skipped: 0
      };
    }

    // Import QSO Log
    if (data.data.qsoLog) {
      const { imported, skipped } = await this.importQSOs(data.data.qsoLog, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    // Import Pages
    if (data.data.pages) {
      const { imported, skipped } = await this.importPages(data.data.pages, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    // Import Mesh Nodes
    if (data.data.meshNodes) {
      const { imported, skipped } = await this.importMeshNodes(data.data.meshNodes, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    // Import Messages
    if (data.data.messages) {
      const { imported, skipped } = await this.importMessages(data.data.messages, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    // Import Certificates
    if (data.data.certificates) {
      const { imported, skipped } = await this.importCertificates(data.data.certificates, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    // Import Settings
    if (data.data.settings) {
      const { imported, skipped } = await this.importSettings(data.data.settings, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    // Import Server Apps
    if (data.data.serverApps) {
      const { imported, skipped } = await this.importServerApps(data.data.serverApps, opts);
      result.imported += imported;
      result.skipped += skipped;
    }

    return result;
  }

  /**
   * Export to ADIF format (for QSO logs)
   */
  async exportToADIF(callsignFilter?: string): Promise<string> {
    const qsos = await logbook.findQSOs(callsignFilter);
    return logbook.exportADIF(qsos);
  }

  /**
   * Import from ADIF format
   */
  async importFromADIF(adifData: string): Promise<number> {
    const qsos = this.parseADIF(adifData);
    let imported = 0;

    for (const qso of qsos) {
      await logbook.logQSO(qso);
      imported++;
    }

    return imported;
  }

  // Private export methods
  private async exportQSOs(options: ExportOptions): Promise<any[]> {
    let qsos = await db.getQSOLog();

    // Apply date range filter
    if (options.dateRange) {
      qsos = qsos.filter(qso => {
        const date = new Date(qso.date);
        if (options.dateRange!.start && date < options.dateRange!.start) return false;
        if (options.dateRange!.end && date > options.dateRange!.end) return false;
        return true;
      });
    }

    // Apply callsign filter
    if (options.callsignFilter) {
      qsos = qsos.filter(qso => qso.callsign.includes(options.callsignFilter!));
    }

    return qsos;
  }

  private async exportPages(): Promise<any[]> {
    return await db.getAllPages();
  }

  private async exportMeshNodes(): Promise<any[]> {
    return await db.getActiveMeshNodes(Infinity);
  }

  private async exportMessages(callsign: string): Promise<any[]> {
    const sent = await db.getMessages({ from: callsign });
    const received = await db.getMessages({ to: callsign });
    return [...sent, ...received];
  }

  private async exportCertificates(): Promise<any[]> {
    return await db.getValidCertificates();
  }

  private async exportSettings(): Promise<Record<string, any>> {
    return await db.getAllSettings();
  }

  private async exportServerApps(): Promise<any[]> {
    return await db.getAllServerApps();
  }

  private async exportCache(): Promise<any[]> {
    // Not implemented - cache is typically not exported
    return [];
  }

  // Private import methods
  private async importQSOs(qsos: any[], options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const qso of qsos) {
      try {
        await db.logQSO(qso);
        imported++;
      } catch (err) {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  private async importPages(pages: any[], options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const page of pages) {
      const existing = await db.getPage(page.path || page.id);

      if (existing && !options.overwrite) {
        skipped++;
        continue;
      }

      await db.savePage(page);
      imported++;
    }

    return { imported, skipped };
  }

  private async importMeshNodes(nodes: any[], options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const node of nodes) {
      try {
        await db.saveMeshNode(node);
        imported++;
      } catch (err) {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  private async importMessages(messages: any[], options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const message of messages) {
      try {
        await db.saveMessage(message);
        imported++;
      } catch (err) {
        skipped++;
      }
    }

    return { imported, skipped };
  }

  private async importCertificates(certs: any[], options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const cert of certs) {
      const existing = await db.getCertificate(cert.callsign);

      if (existing && !options.overwrite) {
        skipped++;
        continue;
      }

      await db.saveCertificate(cert);
      imported++;
    }

    return { imported, skipped };
  }

  private async importSettings(settings: Record<string, any>, options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const [key, value] of Object.entries(settings)) {
      const existing = await db.getSetting(key);

      if (existing !== undefined && !options.overwrite) {
        skipped++;
        continue;
      }

      await db.setSetting(key, value);
      imported++;
    }

    return { imported, skipped };
  }

  private async importServerApps(apps: any[], options: ImportOptions): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const app of apps) {
      const existing = await db.getServerApp(app.path || app.id);

      if (existing && !options.overwrite) {
        skipped++;
        continue;
      }

      await db.saveServerApp(app);
      imported++;
    }

    return { imported, skipped };
  }

  // Utility methods
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private isCompatibleVersion(version: string): boolean {
    const [major] = version.split('.');
    const [currentMajor] = this.version.split('.');
    return major === currentMajor;
  }

  private parseADIF(adifData: string): any[] {
    const qsos: any[] = [];
    const records = adifData.split('<EOR>');

    for (const record of records) {
      if (!record.trim()) continue;

      const qso: any = {};
      const fieldRegex = /<(\w+):(\d+)(?::(\w))?>([^<]*)/g;
      let match;

      while ((match = fieldRegex.exec(record)) !== null) {
        const [_, field, length, type, value] = match;
        const fieldName = field.toLowerCase();

        switch (fieldName) {
          case 'call':
            qso.callsign = value;
            break;
          case 'qso_date':
            qso.date = this.parseADIFDate(value);
            break;
          case 'time_on':
            qso.time = this.parseADIFTime(value);
            break;
          case 'freq':
            qso.frequency = value;
            break;
          case 'mode':
            qso.mode = value;
            break;
          case 'rst_sent':
            qso.rstSent = value;
            break;
          case 'rst_rcvd':
            qso.rstReceived = value;
            break;
          case 'qth':
            qso.qth = value;
            break;
          case 'name':
            qso.name = value;
            break;
          case 'comment':
            qso.notes = value;
            break;
        }
      }

      if (qso.callsign) {
        qsos.push(qso);
      }
    }

    return qsos;
  }

  private parseADIFDate(dateStr: string): string {
    // ADIF date format: YYYYMMDD
    if (dateStr.length === 8) {
      const year = dateStr.substr(0, 4);
      const month = dateStr.substr(4, 2);
      const day = dateStr.substr(6, 2);
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  }

  private parseADIFTime(timeStr: string): string {
    // ADIF time format: HHMM or HHMMSS
    if (timeStr.length >= 4) {
      const hour = timeStr.substr(0, 2);
      const minute = timeStr.substr(2, 2);
      const second = timeStr.length >= 6 ? timeStr.substr(4, 2) : '00';
      return `${hour}:${minute}:${second}`;
    }
    return timeStr;
  }

  /**
   * Create a backup file
   */
  async createBackup(callsign: string): Promise<Blob> {
    const data = await this.exportData(callsign);
    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Restore from backup file
   */
  async restoreBackup(file: File): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as StationData;
      return await this.importData(data);
    } catch (err) {
      return {
        success: false,
        imported: 0,
        errors: [`Failed to parse backup file: ${err}`]
      };
    }
  }
}