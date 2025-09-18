#!/bin/bash

# Build self-contained binaries for all platforms
echo "Building self-contained signaling server binaries..."

# Install dependencies
npm ci --production

# Build binaries using pkg
npx pkg . \
  --targets node18-linux-x64,node18-macos-x64,node18-win-x64,node18-linux-arm64,node18-macos-arm64 \
  --out-path dist

# Rename outputs for clarity
cd dist
mv ham-radio-webrtc-signaling-linux signaling-server-linux-x64 2>/dev/null || true
mv ham-radio-webrtc-signaling-macos signaling-server-macos-x64 2>/dev/null || true
mv ham-radio-webrtc-signaling-win.exe signaling-server-win-x64.exe 2>/dev/null || true
mv ham-radio-webrtc-signaling-linux-arm64 signaling-server-linux-arm64 2>/dev/null || true
mv ham-radio-webrtc-signaling-macos-arm64 signaling-server-macos-arm64 2>/dev/null || true

echo "Binaries created in dist/"
ls -lh

echo ""
echo "Usage:"
echo "  Linux:   ./dist/signaling-server-linux-x64"
echo "  macOS:   ./dist/signaling-server-macos-x64"
echo "  Windows: dist\\signaling-server-win-x64.exe"
echo "  ARM64:   ./dist/signaling-server-linux-arm64"
echo ""
echo "Set PORT environment variable to change port (default 8080)"