/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache the signing list with network-first strategy
registerRoute(
  ({ url }) => url.pathname === '/signing-list.json',
  new NetworkFirst({
    cacheName: 'signing-list',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

// Cache static pages (HTML/Markdown) with stale-while-revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/pages/'),
  new StaleWhileRevalidate({
    cacheName: 'static-pages',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Cache server function code with cache-first strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/functions/'),
  new CacheFirst({
    cacheName: 'server-functions',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  })
);

// Cache API responses with network-first strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  })
);

// Cache images with cache-first strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Handle offline fallback
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.match('/offline.html');
        return cache || new Response('Offline - Please check your connection');
      })
    );
  }
});

// Background sync for queued transmissions
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === 'transmission-queue') {
    syncEvent.waitUntil(processTransmissionQueue());
  }
});

async function processTransmissionQueue(): Promise<void> {
  // Open IndexedDB and process queued transmissions
  const db = await openDatabase();
  const tx = db.transaction('transmissions', 'readwrite');
  const store = tx.objectStore('transmissions');
  const index = store.index('status');
  
  const request = index.getAll('queued');
  const queuedTransmissions = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  for (const transmission of queuedTransmissions) {
    try {
      // Process transmission when online
      await processTransmission(transmission);
      
      // Update status
      transmission.status = 'completed';
      await store.put(transmission);
    } catch (error) {
      console.error('Failed to process transmission:', error);
      transmission.status = 'failed';
      transmission.lastError = error instanceof Error ? error.message : 'Unknown error';
      await store.put(transmission);
    }
  }
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ham-radio-pwa', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function processTransmission(transmission: any): Promise<void> {
  // This will be implemented when radio control is ready
  console.log('Processing transmission:', transmission);
  // Simulate processing
  return new Promise(resolve => setTimeout(resolve, 1000));
}

// Listen for skip waiting event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Log service worker lifecycle
self.addEventListener('install', () => {
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', () => {
  console.log('Service Worker: Activated');
});