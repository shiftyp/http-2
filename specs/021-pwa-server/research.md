# Phase 0 Research: PWA Server Technical Investigation

## Static File Serving Strategies with Express

### Express.static Middleware Approach
**Recommended Strategy**: Use `express.static` middleware for efficient PWA asset serving

```javascript
// Integration with existing Express app
app.use(express.static('pwa-assets', {
  // Cache control for PWA assets
  maxAge: '1d',
  etag: true,
  lastModified: true,

  // Support for service worker
  setHeaders: (res, path) => {
    if (path.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
```

**Key Benefits**:
- Minimal overhead on existing signaling server
- Built-in MIME type detection
- Efficient caching headers
- Support for range requests
- Gzip compression support

**Considerations**:
- Service worker requires special cache headers
- PWA manifest needs proper MIME type (`application/manifest+json`)
- Assets must be properly organized in directory structure

### PWA-Specific Requirements
- **Service Worker**: Must serve with `Cache-Control: no-cache`
- **Manifest**: Proper MIME type for `manifest.json`
- **Icons**: Support for various sizes and formats
- **Offline Assets**: Ensure all critical resources are available

## PWA Manifest and Service Worker Serving Requirements

### Manifest.json Serving
```javascript
// Ensure proper MIME type for manifest
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(pwaAssetsPath, 'manifest.json'));
});
```

**Critical Requirements**:
- MIME type: `application/manifest+json`
- CORS headers for cross-origin requests
- Proper JSON formatting
- Icon path resolution

### Service Worker Considerations
```javascript
// Service worker with no-cache headers
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(pwaAssetsPath, 'sw.js'));
});
```

**Requirements**:
- No caching to ensure updates
- Proper scope headers
- HTTPS for service worker registration (development exception)
- Error handling for missing files

### PWA Asset Structure
```
pwa-assets/
├── index.html           # Main application entry
├── manifest.json        # PWA manifest
├── sw.js               # Service worker
├── assets/
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript bundles
│   └── icons/          # PWA icons
└── static/             # Static resources
```

## Platform Binary Packaging Approaches

### PKG (Vercel) Integration
**Current Implementation**: Already using PKG for multi-platform builds

```json
// package.json PKG configuration
{
  "pkg": {
    "scripts": ["src/**/*.js", "server.js"],
    "assets": [
      "package.json",
      "node_modules/better-sqlite3/build/Release/**/*",
      "pwa-assets/**/*"  // Add PWA assets
    ],
    "targets": [
      "node18-linux-x64",
      "node18-macos-x64",
      "node18-win-x64",
      "node18-linux-arm64",
      "node18-macos-arm64"
    ]
  }
}
```

**PWA Integration Strategy**:
1. Copy built PWA files to `signaling-server/pwa-assets/`
2. Include in PKG assets configuration
3. Reference assets using `__dirname` or `process.pkg.defaultEntrypoint`
4. Handle asset path resolution in packaged binaries

### Asset Path Resolution in PKG
```javascript
// Handle asset paths in packaged vs development
const getAssetPath = () => {
  if (process.pkg) {
    // Running as packaged binary
    return path.join(path.dirname(process.execPath), 'pwa-assets');
  } else {
    // Running from source
    return path.join(__dirname, 'pwa-assets');
  }
};
```

### Binary Size Optimization
- **Compression**: Use gzip for text assets
- **Tree Shaking**: Remove unused PWA code
- **Asset Optimization**: Minify CSS/JS, optimize images
- **Selective Inclusion**: Only include production assets

## Server Package Distribution Methods

### Package Structure Design
```
server-package/
├── binaries/
│   ├── linux-x64/
│   │   └── signaling-server
│   ├── linux-arm64/
│   │   └── signaling-server
│   ├── macos-x64/
│   │   └── signaling-server
│   ├── macos-arm64/
│   │   └── signaling-server
│   └── windows-x64/
│       └── signaling-server.exe
├── pwa-assets/
│   └── [PWA build output]
├── scripts/
│   ├── start-linux.sh
│   ├── start-macos.sh
│   └── start-windows.bat
├── config/
│   └── server-config.json
├── README.md
└── package-manifest.json
```

### Download Server Implementation
```javascript
// Express endpoint for package download
app.get('/download/server-package', async (req, res) => {
  const packagePath = await buildServerPackage();
  const stats = fs.statSync(packagePath);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', 'attachment; filename="ham-radio-server.zip"');

  const stream = fs.createReadStream(packagePath);
  stream.pipe(res);
});
```

### Package Integrity Verification
- **Checksums**: SHA-256 hashes for all binaries
- **Manifest**: JSON file with version and integrity data
- **Signature**: Optional cryptographic signing
- **Verification**: Client-side integrity checking

### Resumable Downloads
```javascript
// Support for partial downloads
app.get('/download/server-package', (req, res) => {
  const range = req.headers.range;
  const stats = fs.statSync(packagePath);

  if (range) {
    // Handle range request for resumable downloads
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', end - start + 1);

    const stream = fs.createReadStream(packagePath, { start, end });
    stream.pipe(res);
  } else {
    // Full download
    res.setHeader('Content-Length', stats.size);
    const stream = fs.createReadStream(packagePath);
    stream.pipe(res);
  }
});
```

## Certificate Bootstrapping Patterns

### First-Time Setup Detection
```javascript
// Check if certificate store is empty
const hasCertificates = () => {
  const certStore = path.join(configDir, 'certificates');
  return fs.existsSync(certStore) && fs.readdirSync(certStore).length > 0;
};

// Bootstrap endpoint only when needed
if (!hasCertificates()) {
  app.post('/api/bootstrap/certificate', handleCertificateBootstrap);
}
```

### Certificate Upload Interface
```javascript
// Handle root certificate upload
app.post('/api/bootstrap/certificate', async (req, res) => {
  try {
    const { certificate, callsign } = req.body;

    // Validate certificate format
    const isValid = await validateECDSACertificate(certificate);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid certificate format' });
    }

    // Store as root certificate
    await storeCertificate(certificate, callsign, { isRoot: true });

    res.json({ success: true, message: 'Root certificate established' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Web Crypto API Integration
```javascript
// Certificate validation using Web Crypto API
const validateECDSACertificate = async (certPem) => {
  try {
    // Parse certificate
    const cert = parsePEMCertificate(certPem);

    // Verify signature algorithm is ECDSA
    if (cert.signatureAlgorithm !== 'ecdsa-with-SHA256') {
      return false;
    }

    // Validate public key format
    const publicKey = await crypto.subtle.importKey(
      'spki',
      cert.publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    return true;
  } catch (error) {
    return false;
  }
};
```

### Trust Chain Establishment
- **Root Certificate**: First certificate becomes trust anchor
- **Chain Validation**: Subsequent certificates verified against root
- **Revocation**: Support for certificate revocation lists
- **Backup**: Secure storage and backup procedures

## Emergency Preparedness Messaging Strategies

### Messaging Framework
**Core Message**: "Licensed stations are encouraged to download and maintain their own server for emergency preparedness, ensuring network resilience when internet infrastructure is unavailable."

### Progressive Disclosure
1. **Initial Context**: Brief explanation during station setup
2. **Detailed Information**: Expandable sections with emergency scenarios
3. **Documentation**: Complete emergency procedures guide
4. **Training**: Practice scenarios for emergency deployment

### Emergency Scenarios Addressed
- **Internet Outage**: Complete loss of internet connectivity
- **Infrastructure Damage**: Physical network infrastructure destruction
- **Isolated Operations**: Remote locations without connectivity
- **Disaster Response**: Coordinated emergency communications

### Messaging Components
```typescript
// Emergency preparedness messages
const emergencyMessages = {
  setup: {
    title: "Emergency Server Deployment",
    brief: "Download local server for emergency preparedness",
    detail: "In emergency situations, your local server ensures continued network operation when internet infrastructure is unavailable."
  },
  download: {
    title: "Building Network Resilience",
    description: "Licensed operators maintaining local servers create a distributed network that remains operational during disasters."
  },
  deployment: {
    title: "Emergency Activation Ready",
    description: "Your server is configured for immediate activation during emergency situations."
  }
};
```

### User Interface Integration
- **Progressive Disclosure**: Expandable information panels
- **Visual Indicators**: Emergency preparedness icons and badges
- **Context Sensitivity**: Show relevant information based on setup stage
- **Documentation Links**: Easy access to complete emergency procedures

## Technical Architecture Decisions

### Single Port Strategy
**Decision**: Serve PWA on same port as WebSocket (8080)
**Rationale**:
- Simplified deployment and configuration
- Reduced firewall complexity
- Consistent access pattern for users
- Lower resource overhead

### Express Middleware Integration
**Decision**: Extend existing Express app rather than separate server
**Rationale**:
- Leverage existing infrastructure
- Shared configuration and logging
- Minimal additional dependencies
- Consistent error handling

### Asset Embedding Strategy
**Decision**: Embed PWA assets in binary packages
**Rationale**:
- Self-contained deployment packages
- No external dependencies for PWA serving
- Simplified distribution and installation
- Offline-first operation capability

### Certificate Bootstrap Approach
**Decision**: Web interface for certificate establishment
**Rationale**:
- User-friendly certificate management
- No command-line requirements
- Visual validation feedback
- Integration with existing PWA interface

## Implementation Recommendations

### Development Approach
1. **Test-Driven**: Write tests before implementation
2. **Incremental**: Build features progressively
3. **Contract-First**: Define APIs before implementation
4. **Documentation-Parallel**: Document as you build

### Quality Assurance
- **Multi-Platform Testing**: Verify on all target platforms
- **Offline Testing**: Ensure complete offline operation
- **Load Testing**: Validate performance under load
- **Security Review**: Certificate and file serving security

### Performance Considerations
- **Asset Caching**: Efficient caching strategies
- **Compression**: Gzip for text assets
- **Lazy Loading**: Progressive PWA loading
- **Resource Optimization**: Minimal memory footprint

---

*Research Document Version 1.0*
*Phase 0: Technical Investigation Complete*
*Created: 2025-09-18*