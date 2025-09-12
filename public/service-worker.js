// HTTP-over-Radio Service Worker
// Enables offline functionality and content caching

const CACHE_NAME = 'http-radio-v1';
const STATIC_CACHE = 'static-v1';
const CONTENT_CACHE = 'content-v1';

// Files to cache on install
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/favicon-32x32.png',
  '/assets/icons/favicon-16x16.png',
  '/assets/icons/apple-touch-icon.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES);
    })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && 
                   cacheName !== STATIC_CACHE && 
                   cacheName !== CONTENT_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Try to fetch from network
      return fetch(request)
        .then((response) => {
          // Don't cache bad responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the response
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          
          return response;
        })
        .catch(() => {
          // Network failed, return offline page if it's a navigation request
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          // Return offline placeholder for other requests
          return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
    })
  );
});

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_CONTENT') {
    // Cache content received via radio
    cacheRadioContent(event.data.payload);
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear specific cache
    clearCache(event.data.cacheName);
  } else if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    // Get cache size
    getCacheSize().then(size => {
      event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
    });
  }
});

// Cache content received via radio
async function cacheRadioContent(payload) {
  const { path, content, metadata } = payload;
  
  // Create a Response object
  const response = new Response(content, {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': metadata.type === 'html' ? 'text/html' : 'application/json',
      'X-Radio-Source': metadata.source || 'mesh',
      'X-Radio-Timestamp': metadata.timestamp || Date.now().toString(),
      'X-Radio-Compressed': metadata.compressed || 'false'
    })
  });
  
  // Cache the response
  const cache = await caches.open(CONTENT_CACHE);
  await cache.put(new Request(path), response);
  
  console.log('[SW] Cached radio content:', path);
}

// Clear specific cache
async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
    console.log('[SW] Cleared cache:', cacheName);
  } else {
    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] Cleared all caches');
  }
}

// Get total cache size
async function getCacheSize() {
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
}

// Background sync for mesh network
self.addEventListener('sync', (event) => {
  if (event.tag === 'mesh-beacon') {
    event.waitUntil(sendMeshBeacon());
  } else if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

// Send mesh network beacon
async function sendMeshBeacon() {
  // Get stored callsign and metadata
  const metadata = await getStationMetadata();
  
  if (!metadata.callsign) {
    console.log('[SW] No callsign set, skipping beacon');
    return;
  }
  
  // Broadcast beacon to all clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'MESH_BEACON',
      payload: {
        callsign: metadata.callsign,
        gridSquare: metadata.gridSquare,
        timestamp: Date.now()
      }
    });
  });
  
  console.log('[SW] Sent mesh beacon for', metadata.callsign);
}

// Sync content with mesh network
async function syncContent() {
  // Get list of cached content
  const cache = await caches.open(CONTENT_CACHE);
  const requests = await cache.keys();
  
  const contentList = [];
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      contentList.push({
        path: new URL(request.url).pathname,
        size: blob.size,
        type: response.headers.get('Content-Type'),
        timestamp: response.headers.get('X-Radio-Timestamp')
      });
    }
  }
  
  // Notify clients about available content
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'CONTENT_LIST',
      payload: contentList
    });
  });
  
  console.log('[SW] Synced content list:', contentList.length, 'items');
}

// Get station metadata from IndexedDB
async function getStationMetadata() {
  // In a real implementation, this would read from IndexedDB
  // For now, we'll return placeholder data
  return {
    callsign: 'KJ4ABC',
    gridSquare: 'EM74',
    realName: 'John Doe'
  };
}

// Push event - handle push notifications (future feature)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification('HTTP-over-Radio', {
        body: data.message || 'New content received',
        icon: '/assets/icons/favicon-32x32.png',
        badge: '/assets/icons/favicon-16x16.png',
        tag: 'http-radio-notification',
        data: data
      })
    );
  }
});

// Notification click - handle notification interactions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

console.log('[SW] Service Worker loaded');