# Deployment Guide - HTTP-over-Radio

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Build Configuration](#build-configuration)
3. [Deployment Platforms](#deployment-platforms)
4. [Production Setup](#production-setup)
5. [Security Configuration](#security-configuration)
6. [Performance Tuning](#performance-tuning)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Troubleshooting](#troubleshooting)

## Deployment Overview

HTTP-over-Radio is a Progressive Web App (PWA) that can be deployed as static files to any web server. The application runs entirely in the browser and requires no backend infrastructure.

### Deployment Architecture

```
┌─────────────────────────────────────┐
│         CDN / Web Server            │
│  ┌─────────────────────────────┐    │
│  │   Static Files (dist/)      │    │
│  │  - index.html               │    │
│  │  - assets/                  │    │
│  │  - service-worker.js        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────┐
│         User Browser                │
│  ┌─────────────────────────────┐    │
│  │      PWA Application        │    │
│  │  - React App                │    │
│  │  - Service Worker           │    │
│  │  - IndexedDB Storage        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
              ↓ Web Serial API
┌─────────────────────────────────────┐
│        Amateur Radio                │
└─────────────────────────────────────┘
```

## Build Configuration

### Production Build

```bash
# Install dependencies
npm ci --production=false

# Run tests
npm run test
npm run test:e2e

# Type checking
npm run typecheck

# Build for production
npm run build

# Preview build locally
npm run preview
```

### Build Output

```
dist/
├── index.html
├── manifest.json
├── service-worker.js
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── icons/
├── favicon.ico
└── robots.txt
```

### Environment Variables

Create `.env.production`:

```env
# Application Configuration
VITE_APP_TITLE=HTTP-over-Radio
VITE_APP_VERSION=1.0.0

# Default Settings
VITE_DEFAULT_FREQUENCY=14078000
VITE_DEFAULT_MODE=HTTP-4800
VITE_DEFAULT_BANDWIDTH=2800

# Feature Flags
VITE_MESH_ENABLED=true
VITE_CRYPTO_ENABLED=true
VITE_SERVER_APPS_ENABLED=true

# Analytics (optional)
VITE_GA_TRACKING_ID=UA-XXXXXXXXX-X
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Deployment Platforms

### Netlify

1. **Deploy via Git**
   ```toml
   # netlify.toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200

   [[headers]]
     for = "/*"
     [headers.values]
       X-Frame-Options = "DENY"
       X-Content-Type-Options = "nosniff"
       X-XSS-Protection = "1; mode=block"
   ```

2. **Deploy via CLI**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

### Vercel

1. **Deploy via Git**
   ```json
   // vercel.json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/" }
     ],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           {
             "key": "X-Content-Type-Options",
             "value": "nosniff"
           },
           {
             "key": "X-Frame-Options",
             "value": "DENY"
           }
         ]
       }
     ]
   }
   ```

2. **Deploy via CLI**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

### GitHub Pages

1. **Setup GitHub Actions**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             
         - name: Install dependencies
           run: npm ci
           
         - name: Build
           run: npm run build
           env:
             PUBLIC_URL: /http-over-radio
             
         - name: Deploy
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

### Self-Hosted (Nginx)

```nginx
# /etc/nginx/sites-available/http-radio
server {
    listen 80;
    server_name radio.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name radio.example.com;

    ssl_certificate /etc/ssl/certs/radio.example.com.crt;
    ssl_certificate_key /etc/ssl/private/radio.example.com.key;

    root /var/www/http-radio/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    # Service Worker
    location /service-worker.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  http-radio:
    build: .
    ports:
      - "8080:80"
    environment:
      - NGINX_HOST=radio.example.com
    restart: unless-stopped
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - web

networks:
  web:
    external: true
```

## Production Setup

### SSL/TLS Configuration

1. **Let's Encrypt with Certbot**
   ```bash
   sudo certbot --nginx -d radio.example.com
   ```

2. **Cloudflare SSL**
   - Enable "Full (strict)" SSL mode
   - Enable "Always Use HTTPS"
   - Set minimum TLS version to 1.2

### CDN Configuration

#### Cloudflare
```
Page Rules:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 year

Cache Rules:
- /service-worker.js: No cache
- /index.html: 5 minutes
- /assets/*: 1 year
```

#### AWS CloudFront
```json
{
  "Origins": [{
    "DomainName": "radio.example.com",
    "OriginPath": "",
    "CustomOriginConfig": {
      "OriginProtocolPolicy": "https-only"
    }
  }],
  "DefaultCacheBehavior": {
    "TargetOriginId": "radio.example.com",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89e-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "CustomErrorResponses": [{
    "ErrorCode": 404,
    "ResponseCode": 200,
    "ResponsePagePath": "/index.html"
  }]
}
```

### Database Backup

```javascript
// backup.js - Run periodically
async function backupIndexedDB() {
  const db = await openDB('http-radio-db');
  const backup = {};
  
  const stores = ['pages', 'serverApps', 'meshNodes', 'messages', 'qsoLog'];
  
  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    backup[storeName] = await store.getAll();
  }
  
  // Upload to cloud storage
  await uploadBackup(backup);
}
```

## Security Configuration

### Content Security Policy

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com;
  worker-src 'self' blob:;
">
```

### CORS Configuration

```nginx
# Allow specific origins for API access
location /api/ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://radio.example.com';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
        add_header 'Access-Control-Max-Age' 86400;
        return 204;
    }
}
```

### Security Headers

```javascript
// middleware/security.js
export function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'serial=(), usb=()');
  next();
}
```

## Performance Tuning

### Asset Optimization

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@tanstack/react-table', 'monaco-editor'],
          'radio-lib': ['./src/lib/radio', './src/lib/modem'],
          'compression-lib': ['./src/lib/compression']
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log']
      }
    }
  }
});
```

### Service Worker Caching

```javascript
// service-worker.js
const CACHE_STRATEGY = {
  '/api/': 'NetworkFirst',
  '/assets/': 'CacheFirst',
  '/': 'StaleWhileRevalidate'
};

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const strategy = getStrategy(url.pathname);
  
  event.respondWith(
    strategy === 'CacheFirst' 
      ? cacheFirst(event.request)
      : strategy === 'NetworkFirst'
      ? networkFirst(event.request)
      : staleWhileRevalidate(event.request)
  );
});
```

### Lazy Loading

```typescript
// App.tsx
const RadioOps = lazy(() => 
  import(/* webpackChunkName: "radio" */ './pages/RadioOps')
);

const ContentCreator = lazy(() => 
  import(/* webpackChunkName: "content" */ './pages/ContentCreator')
);

const Settings = lazy(() => 
  import(/* webpackChunkName: "settings" */ './pages/Settings')
);
```

## Monitoring & Analytics

### Google Analytics

```html
<!-- index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Sentry Error Tracking

```javascript
// main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ]
});
```

### Custom Analytics

```typescript
// lib/analytics.ts
export class Analytics {
  static track(event: string, properties?: any) {
    // Send to analytics service
    if (window.gtag) {
      window.gtag('event', event, properties);
    }
    
    // Log to console in dev
    if (import.meta.env.DEV) {
      console.log('Analytics:', event, properties);
    }
  }
  
  static pageView(path: string) {
    this.track('page_view', { page_path: path });
  }
  
  static radioEvent(action: string, details: any) {
    this.track('radio_' + action, details);
  }
}
```

## Troubleshooting

### Common Deployment Issues

| Issue | Solution |
|-------|----------|
| **Service Worker not updating** | Add version query parameter to SW registration |
| **CORS errors** | Check server CORS headers and allowed origins |
| **SSL certificate errors** | Verify certificate chain and expiration |
| **404 on refresh** | Configure server for SPA routing |
| **Large bundle size** | Enable code splitting and tree shaking |
| **Slow initial load** | Implement progressive enhancement |

### Debugging Production Issues

```javascript
// Enable debug mode
localStorage.setItem('debug', 'http-radio:*');

// Check Service Worker status
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs);
});

// Monitor IndexedDB usage
navigator.storage.estimate().then(estimate => {
  console.log('Storage used:', estimate.usage);
  console.log('Storage quota:', estimate.quota);
});

// Network diagnostics
if ('connection' in navigator) {
  console.log('Network type:', navigator.connection.effectiveType);
  console.log('Downlink:', navigator.connection.downlink);
}
```

### Health Check Endpoint

```javascript
// health-check.js
export async function healthCheck() {
  const checks = {
    app: true,
    serviceWorker: false,
    storage: false,
    webSerial: false
  };
  
  // Check Service Worker
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    checks.serviceWorker = !!reg;
  }
  
  // Check IndexedDB
  try {
    const db = await openDB('http-radio-db');
    checks.storage = true;
    db.close();
  } catch (e) {
    checks.storage = false;
  }
  
  // Check Web Serial API
  checks.webSerial = 'serial' in navigator;
  
  return checks;
}
```

### Rollback Procedure

```bash
# Tag releases
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Rollback to previous version
git checkout v0.9.0
npm run build
# Deploy dist/ folder

# Or use platform-specific rollback
netlify rollback
vercel rollback
```

## Maintenance

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Update major versions carefully
npm install package@latest

# Audit for vulnerabilities
npm audit
npm audit fix
```

### Database Migration

```javascript
// migrations/v2.js
export async function migrateToV2() {
  const db = await openDB('http-radio-db', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 2) {
        // Add new object store
        db.createObjectStore('newStore', {
          keyPath: 'id'
        });
        
        // Migrate existing data
        const tx = db.transaction(['oldStore'], 'readwrite');
        // ... migration logic
      }
    }
  });
}
```

### Monitoring Checklist

- [ ] Application loads successfully
- [ ] Service Worker registered
- [ ] IndexedDB accessible
- [ ] Web Serial API available
- [ ] No console errors
- [ ] Performance metrics acceptable
- [ ] Analytics tracking working
- [ ] Error reporting active

---

*Document Version: 1.0.0*  
*Last Updated: 2024*  
*Status: Production Ready*