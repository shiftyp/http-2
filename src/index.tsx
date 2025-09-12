import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize the database on app start
import { initDatabase } from './services/database/schema';

// Initialize database before rendering
initDatabase().then(() => {
  console.log('Database initialized');
}).catch(error => {
  console.error('Failed to initialize database:', error);
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Check for Web Serial API support
if (!('serial' in navigator)) {
  console.warn('Web Serial API not supported. Radio control features will be disabled.');
}

// Check for Web Audio API support
if (!('AudioContext' in window || 'webkitAudioContext' in window)) {
  console.warn('Web Audio API not supported. Audio processing features will be disabled.');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);