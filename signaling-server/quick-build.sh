#!/bin/bash

# Quick build script - builds only for current platform
# For full multi-platform build, use ./build-all.sh

set -e

echo "Quick Build - Current Platform Only"
echo "====================================="

# Detect current platform
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        PLATFORM="linux-arm64"
    else
        PLATFORM="linux-x64"
    fi
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        PLATFORM="macos-arm64"
    else
        PLATFORM="macos-x64"
    fi
else
    echo "Unsupported platform: $OS $ARCH"
    exit 1
fi

echo "Detected platform: $PLATFORM"

# Build PWA
echo "Building PWA..."
cd ..
npm run build
cd signaling-server

# Copy PWA assets
echo "Copying PWA assets..."
rm -rf pwa-assets
mkdir -p pwa-assets
cp -r ../dist/* pwa-assets/ 2>/dev/null || echo "PWA dist not found, using minimal files"

# Build binary for current platform
echo "Building binary for $PLATFORM..."
npm run build:$PLATFORM

# Create simple package
echo "Creating package..."
mkdir -p dist/quick-deploy
cp dist/signaling-server-$PLATFORM* dist/quick-deploy/server 2>/dev/null || true
cp -r pwa-assets dist/quick-deploy/

# Create start script
cat > dist/quick-deploy/start.sh << 'EOF'
#!/bin/bash
echo "Starting Ham Radio Server..."
chmod +x ./server 2>/dev/null
./server
EOF
chmod +x dist/quick-deploy/start.sh

echo ""
echo "Quick build complete!"
echo "To run: cd dist/quick-deploy && ./start.sh"
echo ""
echo "For full multi-platform build, use: ./build-all.sh"
