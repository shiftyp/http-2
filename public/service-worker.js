// HTTP-over-Radio Service Worker
// Enables offline functionality and content caching

const CACHE_VERSION = '2.0.0';
const STATIC_CACHE = `static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-v${CACHE_VERSION}`;
const CONTENT_CACHE = `content-v${CACHE_VERSION}`;

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
  console.log('[SW] Installing service worker version', CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES).catch(err => {
        console.warn('[SW] Some static files failed to cache:', err);
        // Don't fail the install if some files can't be cached
      });
    })
  );

  // Activate immediately to replace old service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version', CACHE_VERSION);

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Keep current version caches
              return !cacheName.includes(CACHE_VERSION);
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - intelligent caching strategy
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

  // Different strategies for different types of requests
  if (isStaticAsset(url)) {
    // Cache-first for static assets (images, fonts, etc.)
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isAppResource(url)) {
    // Network-first for app resources (JS, CSS) to get updates
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  } else if (isNavigationRequest(request)) {
    // Network-first for navigation, fallback to cached index.html
    event.respondWith(navigationStrategy(request));
  } else {
    // Default: network-first with cache fallback
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache-first failed:', error);
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Network-first strategy for app resources
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Only cache successful responses
      const cache = await caches.open(cacheName);
      // Don't cache if it's a React dev server response with source maps
      if (!isDevServerResponse(networkResponse)) {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Navigation strategy for page requests
async function navigationStrategy(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Navigation network failed, using cached index:', error);
    // Fallback to cached index.html
    const cachedIndex = await caches.match('/index.html');
    return cachedIndex || new Response('App not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Helper functions
function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);
}

function isAppResource(url) {
  return /\.(js|css|ts|tsx)$/i.test(url.pathname) ||
         url.pathname.startsWith('/src/') ||
         url.pathname.includes('/@') || // Vite dev server
         url.pathname.includes('node_modules');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

function isDevServerResponse(response) {
  // Don't cache Vite dev server responses
  return response.headers.get('server')?.includes('vite') ||
         response.url.includes('/@vite/') ||
         response.url.includes('?v=') || // Vite versioning
         response.headers.get('content-type')?.includes('application/javascript') &&
         response.url.includes('localhost');
}

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // Skip waiting and activate immediately
    self.skipWaiting();
    event.ports[0]?.postMessage({ type: 'SKIP_WAITING_COMPLETE' });
  } else if (event.data && event.data.type === 'CACHE_CONTENT') {
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