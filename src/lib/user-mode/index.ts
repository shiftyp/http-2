/**
 * User mode management for licensed vs unlicensed users
 * Controls feature access based on certificate presence
 */

import { certificateVerifier, type Certificate } from '../certificate-verifier';

export type UserMode = 'licensed' | 'unlicensed';

export interface UserModeContext {
  mode: UserMode;
  certificate: Certificate | null;
  callsign: string | null;
  licenseClass: 'Technician' | 'General' | 'Extra' | null;
  canTransmit: boolean;
  canHostServer: boolean;
  canIssue: boolean;
  canRelay: boolean;
}

export interface RestrictedFeature {
  name: string;
  requiresLicense: boolean;
  message: string;
}

export class UserModeManager {
  private mode: UserMode = 'unlicensed';
  private certificate: Certificate | null = null;
  private readonly CERT_STORAGE_KEY = 'user-certificate';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize user mode by checking for certificate
   */
  private async initialize(): Promise<void> {
    try {
      // Check IndexedDB for stored certificate
      const storedCert = await this.loadStoredCertificate();

      if (storedCert) {
        // Validate the stored certificate
        const result = await certificateVerifier.verifyCertificate(storedCert);

        if (result.valid) {
          this.certificate = storedCert;
          this.mode = 'licensed';
        } else {
          // Invalid certificate, clear it
          await this.clearCertificate();
          this.mode = 'unlicensed';
        }
      } else {
        this.mode = 'unlicensed';
      }
    } catch (error) {
      console.error('Failed to initialize user mode:', error);
      this.mode = 'unlicensed';
    }
  }

  /**
   * Get current user context
   */
  getContext(): UserModeContext {
    const isLicensed = this.mode === 'licensed';

    return {
      mode: this.mode,
      certificate: this.certificate,
      callsign: this.certificate?.extensions?.callsign || null,
      licenseClass: this.certificate?.extensions?.licenseClass || null,
      canTransmit: isLicensed,
      canHostServer: isLicensed,
      canIssue: isLicensed && (this.certificate?.extensions?.canIssue || false),
      canRelay: isLicensed
    };
  }

  /**
   * Set user certificate
   */
  async setCertificate(cert: Certificate): Promise<boolean> {
    try {
      // Validate certificate
      const result = await certificateVerifier.verifyCertificate(cert);

      if (!result.valid) {
        throw new Error(result.reason || 'Invalid certificate');
      }

      // Store certificate
      this.certificate = cert;
      this.mode = 'licensed';
      await this.storeCertificate(cert);

      // Notify UI of mode change
      this.notifyModeChange();

      return true;
    } catch (error) {
      console.error('Failed to set certificate:', error);
      return false;
    }
  }

  /**
   * Clear user certificate (revert to unlicensed)
   */
  async clearCertificate(): Promise<void> {
    this.certificate = null;
    this.mode = 'unlicensed';

    // Clear from storage
    const db = await this.openDatabase();
    const tx = db.transaction(['user'], 'readwrite');
    const store = tx.objectStore('user');
    await store.delete(this.CERT_STORAGE_KEY);

    this.notifyModeChange();
  }

  /**
   * Check if a feature is restricted
   */
  isFeatureRestricted(feature: string): RestrictedFeature | null {
    const restrictions: Record<string, RestrictedFeature> = {
      transmit: {
        name: 'Transmit',
        requiresLicense: true,
        message: 'Transmitting requires an amateur radio license'
      },
      server: {
        name: 'Run Server',
        requiresLicense: true,
        message: 'Running a server requires an amateur radio license'
      },
      createContent: {
        name: 'Create Content',
        requiresLicense: true,
        message: 'Creating content requires an amateur radio license'
      },
      relay: {
        name: 'Relay Traffic',
        requiresLicense: true,
        message: 'Relaying traffic requires an amateur radio license'
      },
      issueCA: {
        name: 'Issue Certificates',
        requiresLicense: true,
        message: 'Issuing certificates requires an amateur radio license with CA privileges'
      }
    };

    const restriction = restrictions[feature];

    if (restriction && restriction.requiresLicense && this.mode === 'unlicensed') {
      return restriction;
    }

    // Additional check for CA features
    if (feature === 'issueCA' && this.mode === 'licensed' && !this.certificate?.extensions?.canIssue) {
      return {
        name: 'Issue Certificates',
        requiresLicense: true,
        message: 'Your certificate does not have CA privileges'
      };
    }

    return null;
  }

  /**
   * Get licensing information resources
   */
  getLicensingInfo(): {
    title: string;
    description: string;
    links: Array<{ text: string; url: string }>;
  } {
    return {
      title: 'Get Your Amateur Radio License',
      description: 'To access all features, you need an amateur radio license. This ensures compliance with FCC regulations and enables you to transmit on amateur radio frequencies.',
      links: [
        {
          text: 'ARRL - Getting Licensed',
          url: 'http://www.arrl.org/getting-licensed'
        },
        {
          text: 'Find an Exam Session',
          url: 'http://www.arrl.org/exam-session-search'
        },
        {
          text: 'Study Guides',
          url: 'https://www.kb6nu.com/study-guides/'
        },
        {
          text: 'Practice Exams',
          url: 'https://hamexam.org/'
        }
      ]
    };
  }

  /**
   * Load stored certificate from IndexedDB
   */
  private async loadStoredCertificate(): Promise<Certificate | null> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(['user'], 'readonly');
      const store = tx.objectStore('user');
      const request = store.get(this.CERT_STORAGE_KEY);

      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Store certificate in IndexedDB
   */
  private async storeCertificate(cert: Certificate): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction(['user'], 'readwrite');
    const store = tx.objectStore('user');

    await store.put(cert, this.CERT_STORAGE_KEY);
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('distributed-servers', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('user')) {
          db.createObjectStore('user');
        }
      };
    });
  }

  /**
   * Notify UI of mode change
   */
  private notifyModeChange(): void {
    // Dispatch custom event for UI components to listen to
    window.dispatchEvent(new CustomEvent('userModeChange', {
      detail: this.getContext()
    }));
  }

  /**
   * Check if user can perform an action
   */
  canPerformAction(action: string): boolean {
    const context = this.getContext();

    switch (action) {
      case 'transmit':
        return context.canTransmit;
      case 'hostServer':
        return context.canHostServer;
      case 'issueCA':
        return context.canIssue;
      case 'relay':
        return context.canRelay;
      case 'browse':
        return true; // Always allowed
      case 'cache':
        return true; // Always allowed
      case 'receiveWebRTC':
        return true; // Always allowed
      default:
        return this.mode === 'licensed';
    }
  }

  /**
   * Get statistics for unlicensed vs licensed users
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    licensedUsers: number;
    unlicensedUsers: number;
    percentageLicensed: number;
  }> {
    // In a real implementation, this would query a backend or analytics service
    // For now, return mock data
    return {
      totalUsers: 1000,
      licensedUsers: 750,
      unlicensedUsers: 250,
      percentageLicensed: 75
    };
  }
}

// Export singleton instance
export const userModeManager = new UserModeManager();

// React Hook for user mode
export function useUserMode(): UserModeContext {
  const [context, setContext] = useState(userModeManager.getContext());

  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      setContext(event.detail);
    };

    window.addEventListener('userModeChange', handleModeChange as EventListener);

    return () => {
      window.removeEventListener('userModeChange', handleModeChange as EventListener);
    };
  }, []);

  return context;
}

// Import React dependencies only if available
let useState: any, useEffect: any;
try {
  const React = require('react');
  useState = React.useState;
  useEffect = React.useEffect;
} catch {
  // React not available, hook won't work
}