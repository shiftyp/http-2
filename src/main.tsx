import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { serviceWorkerManager } from './lib/cache/ServiceWorkerManager';

// Initialize service worker with enhanced management
serviceWorkerManager.initialize().then(swInfo => {
  if (swInfo) {
    console.log('[Main] Service worker initialized:', swInfo.state);

    // Handle updates
    serviceWorkerManager.on('update_available', () => {
      console.log('[Main] Service worker update available');
      // In development, automatically update
      if (serviceWorkerManager.isDevelopment()) {
        serviceWorkerManager.reloadWithCacheBypass();
      }
    });

    // Handle cache clearing
    serviceWorkerManager.on('caches_cleared', () => {
      console.log('[Main] Caches cleared');
    });

    // Handle offline/online
    serviceWorkerManager.on('offline', () => {
      console.log('[Main] App is offline');
    });

    serviceWorkerManager.on('online', () => {
      console.log('[Main] App is online');
    });
  }
}).catch(error => {
  console.error('[Main] Service worker initialization failed:', error);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);