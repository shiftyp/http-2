import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV === 'production' ? [VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        skipWaiting: false, // Don't skip waiting in production
        clientsClaim: false, // Don't claim clients immediately
        cleanupOutdatedCaches: true,
        navigationFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache API responses only when offline
            urlPattern: /\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 // 1 hour only
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Application resources: network first, cache fallback
            urlPattern: /\.(js|css|html)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-cache',
              networkTimeoutSeconds: 2,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 30 // 30 minutes
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'HTTP-over-Radio',
        short_name: 'HTTP Radio',
        description: 'Progressive Web App for transmitting web content over amateur radio',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'favicon-16x16.png',
            sizes: '16x16',
            type: 'image/png'
          },
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })] : [])
  ],
  css: {
    postcss: './postcss.config.js'
  },
  server: {
    port: 3000,
    https: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});