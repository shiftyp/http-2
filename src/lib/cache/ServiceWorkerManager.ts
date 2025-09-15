/**
 * Service Worker Manager
 * Utilities for managing service worker and cache lifecycle
 */

export interface ServiceWorkerInfo {
  /** Service worker registration */
  registration: ServiceWorkerRegistration;

  /** Current service worker state */
  state: ServiceWorkerState;

  /** Available actions */
  actions: ServiceWorkerActions;
}

export interface ServiceWorkerActions {
  /** Update to new service worker */
  update: () => Promise<void>;

  /** Skip waiting and activate immediately */
  skipWaiting: () => Promise<void>;

  /** Clear all caches */
  clearCaches: () => Promise<void>;

  /** Unregister service worker */
  unregister: () => Promise<void>;
}

export enum ServiceWorkerState {
  INSTALLING = 'installing',
  WAITING = 'waiting',
  ACTIVE = 'active',
  REDUNDANT = 'redundant',
  NOT_FOUND = 'not_found'
}

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private eventListeners: Map<string, Function[]> = new Map();

  /**
   * Initialize service worker with enhanced update handling
   */
  async initialize(): Promise<ServiceWorkerInfo | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SWM] Service Worker not supported');
      return null;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      console.log('[SWM] Service Worker registered:', this.registration.scope);

      // Set up update detection
      this.setupUpdateDetection();

      // Set up message handling
      this.setupMessageHandling();

      return {
        registration: this.registration,
        state: this.getServiceWorkerState(),
        actions: this.createActions()
      };

    } catch (error) {
      console.error('[SWM] Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Check for service worker updates manually
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      return this.updateAvailable;
    } catch (error) {
      console.error('[SWM] Update check failed:', error);
      return false;
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log('[SWM] Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );

      console.log('[SWM] All caches cleared');
      this.emit('caches_cleared');
    } catch (error) {
      console.error('[SWM] Failed to clear caches:', error);
      throw error;
    }
  }

  /**
   * Force reload with cache bypass
   */
  reloadWithCacheBypass(): void {
    // Clear caches first, then reload
    this.clearAllCaches().then(() => {
      window.location.reload();
    }).catch(() => {
      // Force reload even if cache clearing fails
      window.location.reload();
    });
  }

  /**
   * Get current cache size
   */
  async getCacheSize(): Promise<number> {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('[SWM] Failed to calculate cache size:', error);
      return 0;
    }
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<{ name: string; size: number; entries: number }[]> {
    try {
      const cacheNames = await caches.keys();
      const cacheInfo = [];

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        let cacheSize = 0;

        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            cacheSize += blob.size;
          }
        }

        cacheInfo.push({
          name: cacheName,
          size: cacheSize,
          entries: requests.length
        });
      }

      return cacheInfo;
    } catch (error) {
      console.error('[SWM] Failed to get cache info:', error);
      return [];
    }
  }

  /**
   * Send message to service worker
   */
  async sendMessage(message: any): Promise<any> {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active service worker controller');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
    });
  }

  /**
   * Register event listener
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Check if development mode
   */
  isDevelopment(): boolean {
    return import.meta.env.DEV ||
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  }

  // Private methods

  private setupUpdateDetection(): void {
    if (!this.registration) return;

    // Check for waiting service worker
    if (this.registration.waiting) {
      console.log('[SWM] Service worker waiting');
      this.updateAvailable = true;
      this.emit('update_available', this.registration.waiting);
    }

    // Listen for new service worker installing
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        console.log('[SWM] New service worker installing');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SWM] New service worker installed and waiting');
            this.updateAvailable = true;
            this.emit('update_available', newWorker);
          }
        });
      }
    });

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SWM] Service worker controller changed');
      this.emit('controller_changed');

      // In development, reload immediately
      if (this.isDevelopment()) {
        window.location.reload();
      }
    });
  }

  private setupMessageHandling(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, payload } = event.data || {};

      switch (type) {
        case 'CACHE_UPDATED':
          this.emit('cache_updated', payload);
          break;
        case 'OFFLINE':
          this.emit('offline');
          break;
        case 'ONLINE':
          this.emit('online');
          break;
        default:
          this.emit('message', event.data);
      }
    });
  }

  private getServiceWorkerState(): ServiceWorkerState {
    if (!this.registration) {
      return ServiceWorkerState.NOT_FOUND;
    }

    if (this.registration.installing) {
      return ServiceWorkerState.INSTALLING;
    }

    if (this.registration.waiting) {
      return ServiceWorkerState.WAITING;
    }

    if (this.registration.active) {
      return ServiceWorkerState.ACTIVE;
    }

    return ServiceWorkerState.REDUNDANT;
  }

  private createActions(): ServiceWorkerActions {
    return {
      update: async () => {
        if (this.registration) {
          await this.registration.update();
        }
      },

      skipWaiting: async () => {
        if (this.registration?.waiting) {
          await this.sendMessage({ type: 'SKIP_WAITING' });
        }
      },

      clearCaches: () => this.clearAllCaches(),

      unregister: async () => {
        if (this.registration) {
          await this.registration.unregister();
          this.registration = null;
        }
      }
    };
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event) || [];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error('[SWM] Event listener error:', error);
      }
    }
  }
}

// Global instance
export const serviceWorkerManager = new ServiceWorkerManager();

export default ServiceWorkerManager;