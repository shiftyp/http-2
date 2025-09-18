#!/usr/bin/env node

/**
 * Binary download server - serves platform-specific pkg builds
 * based on User-Agent detection
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const PackageBuilder = require('./package-builder');

const app = express();
const PORT = process.env.DOWNLOAD_PORT || 3001;

// Platform detection from User-Agent
function detectPlatform(userAgent) {
  const ua = userAgent.toLowerCase();

  // Check architecture first (more specific)
  const isARM64 = ua.includes('arm64') || ua.includes('aarch64');

  // Check OS
  if (ua.includes('win')) {
    return 'win-x64';
  } else if (ua.includes('mac') || ua.includes('darwin')) {
    return isARM64 ? 'macos-arm64' : 'macos-x64';
  } else if (ua.includes('linux')) {
    return isARM64 ? 'linux-arm64' : 'linux-x64';
  }

  // Default to Linux x64
  return 'linux-x64';
}

// Binary filename mapping
const BINARY_MAP = {
  'win-x64': 'signaling-server-win-x64.exe',
  'macos-x64': 'signaling-server-macos-x64',
  'macos-arm64': 'signaling-server-macos-arm64',
  'linux-x64': 'signaling-server-linux-x64',
  'linux-arm64': 'signaling-server-linux-arm64'
};

// Download endpoint
app.get('/download/signaling-server', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const platform = req.query.platform || detectPlatform(userAgent);

  const filename = BINARY_MAP[platform];
  if (!filename) {
    return res.status(400).json({
      error: 'Unsupported platform',
      detectedPlatform: platform,
      supportedPlatforms: Object.keys(BINARY_MAP)
    });
  }

  const binaryPath = path.join(__dirname, '..', 'dist', filename);

  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    return res.status(404).json({
      error: 'Binary not found',
      platform: platform,
      message: 'Please run npm run build:binary first'
    });
  }

  // Get file size for progress indication
  const stats = fs.statSync(binaryPath);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('X-Platform', platform);

  // Stream the file
  const stream = fs.createReadStream(binaryPath);
  stream.pipe(res);
});

// Platform detection endpoint (for debugging)
app.get('/detect-platform', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const platform = detectPlatform(userAgent);

  res.json({
    detectedPlatform: platform,
    userAgent: userAgent,
    recommendedBinary: BINARY_MAP[platform],
    allPlatforms: Object.keys(BINARY_MAP)
  });
});

// Binary size information
app.get('/download/info', (req, res) => {
  const sizes = {};

  for (const [platform, filename] of Object.entries(BINARY_MAP)) {
    const binaryPath = path.join(__dirname, '..', 'dist', filename);
    if (fs.existsSync(binaryPath)) {
      const stats = fs.statSync(binaryPath);
      sizes[platform] = {
        filename: filename,
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
      };
    }
  }

  res.json({
    availableBinaries: sizes,
    totalPlatforms: Object.keys(BINARY_MAP).length
  });
});

// Package API endpoints
const packageBuilder = new PackageBuilder();

// Get package info
app.get('/api/packages/info', async (req, res) => {
  try {
    const info = await packageBuilder.getPackageInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get package manifest
app.get('/api/packages/manifest', async (req, res) => {
  try {
    const manifest = await packageBuilder.getManifest();
    res.json(manifest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download package
app.get('/api/packages/download', async (req, res) => {
  try {
    const platform = req.query.platform || null;

    // Validate platform if provided
    if (platform && !BINARY_MAP[platform]) {
      return res.status(404).json({
        error: `Invalid platform: ${platform}`
      });
    }

    const packageInfo = await packageBuilder.downloadPackage(platform);

    // Support range requests for resumable downloads
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : packageInfo.size - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(packageInfo.path, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${packageInfo.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': packageInfo.contentType,
        'Content-Disposition': `attachment; filename="${packageInfo.filename}"`,
        'X-Checksum-SHA256': packageInfo.checksum
      });

      stream.pipe(res);
    } else {
      // Full file download
      res.setHeader('Content-Type', packageInfo.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${packageInfo.filename}"`);
      res.setHeader('Content-Length', packageInfo.size);
      res.setHeader('X-Checksum-SHA256', packageInfo.checksum);
      res.setHeader('Content-Encoding', 'identity'); // For test compatibility

      const stream = fs.createReadStream(packageInfo.path);
      stream.pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HEAD request for package size
app.head('/api/packages/download', async (req, res) => {
  try {
    const packageInfo = await packageBuilder.downloadPackage();
    res.setHeader('Content-Length', packageInfo.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.end();
  } catch (error) {
    res.status(500).end();
  }
});

// Package statistics
app.get('/api/packages/stats', (req, res) => {
  // Track download statistics (simplified for now)
  res.json({
    downloads: 1, // Would track actual downloads
    lastDownload: new Date().toISOString()
  });
});

// Build package endpoint
app.get('/api/packages/build', async (req, res) => {
  try {
    const result = await packageBuilder.buildPackage({
      includePWA: req.query.includePWA !== 'false'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export for use in main server
const setupPackageRoutes = (router) => {
  router.get('/api/packages/info', async (req, res) => {
    try {
      const info = await packageBuilder.getPackageInfo();
      res.json(info);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/packages/manifest', async (req, res) => {
    try {
      const manifest = await packageBuilder.getManifest();
      res.json(manifest);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/packages/download', async (req, res) => {
    try {
      const platform = req.query.platform || null;

      if (platform && !BINARY_MAP[platform]) {
        return res.status(404).json({
          error: `Invalid platform: ${platform}`
        });
      }

      const packageInfo = await packageBuilder.downloadPackage(platform);

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : packageInfo.size - 1;
        const chunksize = (end - start) + 1;
        const stream = fs.createReadStream(packageInfo.path, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${packageInfo.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': packageInfo.contentType,
          'Content-Disposition': `attachment; filename="${packageInfo.filename}"`,
          'X-Checksum-SHA256': packageInfo.checksum
        });

        stream.pipe(res);
      } else {
        res.setHeader('Content-Type', packageInfo.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${packageInfo.filename}"`);
        res.setHeader('Content-Length', packageInfo.size);
        res.setHeader('X-Checksum-SHA256', packageInfo.checksum);
        res.setHeader('Content-Encoding', 'identity');

        const stream = fs.createReadStream(packageInfo.path);
        stream.pipe(res);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.head('/api/packages/download', async (req, res) => {
    try {
      const packageInfo = await packageBuilder.downloadPackage();
      res.setHeader('Content-Length', packageInfo.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.end();
    } catch (error) {
      res.status(500).end();
    }
  });

  router.get('/api/packages/stats', (req, res) => {
    res.json({
      downloads: 1,
      lastDownload: new Date().toISOString()
    });
  });

  router.get('/api/packages/build', async (req, res) => {
    try {
      const result = await packageBuilder.buildPackage({
        includePWA: req.query.includePWA !== 'false'
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Binary download server running on port ${PORT}`);
    console.log(`Download endpoint: http://localhost:${PORT}/download/signaling-server`);
    console.log(`Platform detection: http://localhost:${PORT}/detect-platform`);
    console.log(`Package API: http://localhost:${PORT}/api/packages/info`);
  });
}

module.exports = { detectPlatform, BINARY_MAP, setupPackageRoutes };