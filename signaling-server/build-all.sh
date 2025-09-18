#!/bin/bash

# Ham Radio Signaling Server - Complete Build Script
# This script builds the PWA, packages the server for all platforms,
# and creates a distribution package ready for deployment.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Ham Radio Signaling Server Build${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if we're in the signaling-server directory
if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
    echo -e "${RED}Error: Must run this script from the signaling-server directory${NC}"
    exit 1
fi

# Step 1: Build the PWA
echo -e "${YELLOW}Step 1: Building PWA...${NC}"
cd ..
if [ -f "package.json" ]; then
    npm run build
    echo -e "${GREEN}✓ PWA build complete${NC}"
else
    echo -e "${RED}Error: Cannot find main package.json${NC}"
    exit 1
fi
cd signaling-server

# Step 2: Prepare PWA assets directory
echo -e "${YELLOW}Step 2: Preparing PWA assets...${NC}"
rm -rf pwa-assets
mkdir -p pwa-assets

# Copy PWA build files
if [ -d "../dist" ]; then
    cp -r ../dist/* pwa-assets/
    echo -e "${GREEN}✓ PWA assets copied${NC}"
else
    echo -e "${RED}Warning: PWA dist directory not found. Creating minimal PWA files...${NC}"
    # Create minimal PWA files for testing
    cat > pwa-assets/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Ham Radio WebRTC</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="manifest" href="/manifest.json">
</head>
<body>
    <div id="root">
        <h1>Ham Radio WebRTC Signaling Server</h1>
        <p>Emergency Communications System</p>
    </div>
</body>
</html>
EOF

    cat > pwa-assets/manifest.json << 'EOF'
{
  "name": "Ham Radio WebRTC",
  "short_name": "Ham Radio",
  "description": "Emergency communications system for amateur radio",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2196F3",
  "icons": []
}
EOF
    echo -e "${YELLOW}Created minimal PWA files${NC}"
fi

# Step 3: Install dependencies if needed
echo -e "${YELLOW}Step 3: Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Install pkg if not present
if ! npm list pkg --depth=0 > /dev/null 2>&1; then
    echo "Installing pkg for binary building..."
    npm install --save-dev pkg
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"

# Step 4: Create distribution directories
echo -e "${YELLOW}Step 4: Creating distribution structure...${NC}"
mkdir -p dist
mkdir -p dist/ham-radio-server/binaries
mkdir -p dist/ham-radio-server/pwa-assets
mkdir -p dist/ham-radio-server/scripts
mkdir -p dist/ham-radio-server/config
mkdir -p dist/ham-radio-server/certificates
echo -e "${GREEN}✓ Distribution directories created${NC}"

# Step 5: Build binaries for all platforms
echo -e "${YELLOW}Step 5: Building platform binaries...${NC}"
echo "This may take several minutes..."

# Build each platform
platforms=("linux-x64" "linux-arm64" "macos-x64" "macos-arm64" "win-x64")
for platform in "${platforms[@]}"; do
    echo -e "Building for ${platform}..."
    if npm run build:${platform} > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ${platform} built successfully${NC}"
    else
        echo -e "${YELLOW}⚠ ${platform} build failed (may not be supported on this system)${NC}"
    fi
done

# Step 6: Copy binaries to distribution
echo -e "${YELLOW}Step 6: Copying binaries to distribution...${NC}"
if ls dist/signaling-server-* 1> /dev/null 2>&1; then
    cp dist/signaling-server-* dist/ham-radio-server/binaries/
    echo -e "${GREEN}✓ Binaries copied${NC}"
else
    echo -e "${RED}Warning: No binaries found in dist/. Build may have failed.${NC}"
fi

# Step 7: Copy PWA assets to distribution
echo -e "${YELLOW}Step 7: Copying PWA assets to distribution...${NC}"
cp -r pwa-assets/* dist/ham-radio-server/pwa-assets/
echo -e "${GREEN}✓ PWA assets copied${NC}"

# Step 8: Create startup scripts
echo -e "${YELLOW}Step 8: Creating startup scripts...${NC}"

# Linux startup script
cat > dist/ham-radio-server/scripts/start-linux.sh << 'EOF'
#!/bin/bash
echo "Starting Ham Radio WebRTC Signaling Server..."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."

if [ -f "binaries/signaling-server-linux-x64" ]; then
    ./binaries/signaling-server-linux-x64
elif [ -f "binaries/signaling-server-linux-arm64" ]; then
    ./binaries/signaling-server-linux-arm64
else
    echo "Error: Linux binary not found"
    exit 1
fi
EOF
chmod +x dist/ham-radio-server/scripts/start-linux.sh

# macOS startup script
cat > dist/ham-radio-server/scripts/start-macos.sh << 'EOF'
#!/bin/bash
echo "Starting Ham Radio WebRTC Signaling Server..."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."

# Detect architecture
if [[ $(uname -m) == 'arm64' ]]; then
    if [ -f "binaries/signaling-server-macos-arm64" ]; then
        ./binaries/signaling-server-macos-arm64
    else
        echo "Error: macOS ARM64 binary not found"
        exit 1
    fi
else
    if [ -f "binaries/signaling-server-macos-x64" ]; then
        ./binaries/signaling-server-macos-x64
    else
        echo "Error: macOS x64 binary not found"
        exit 1
    fi
fi
EOF
chmod +x dist/ham-radio-server/scripts/start-macos.sh

# Windows startup script
cat > dist/ham-radio-server/scripts/start-windows.bat << 'EOF'
@echo off
echo Starting Ham Radio WebRTC Signaling Server...
cd /d "%~dp0\.."
if exist "binaries\signaling-server-win-x64.exe" (
    binaries\signaling-server-win-x64.exe
) else (
    echo Error: Windows binary not found
    pause
    exit /b 1
)
EOF

# Emergency startup script
cat > dist/ham-radio-server/scripts/emergency-start.sh << 'EOF'
#!/bin/bash
echo "=========================================="
echo " EMERGENCY HAM RADIO SERVER ACTIVATION"
echo "=========================================="
echo ""
echo "Starting server in emergency mode..."
echo "No internet connection required."
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."

# Detect platform and architecture
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        BINARY="binaries/signaling-server-linux-arm64"
    else
        BINARY="binaries/signaling-server-linux-x64"
    fi
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        BINARY="binaries/signaling-server-macos-arm64"
    else
        BINARY="binaries/signaling-server-macos-x64"
    fi
else
    echo "Unsupported platform: $OS $ARCH"
    exit 1
fi

if [ -f "$BINARY" ]; then
    $BINARY --emergency --port 8080 --no-bootstrap
else
    echo "Error: Binary not found: $BINARY"
    exit 1
fi
EOF
chmod +x dist/ham-radio-server/scripts/emergency-start.sh

echo -e "${GREEN}✓ Startup scripts created${NC}"

# Step 9: Create configuration template
echo -e "${YELLOW}Step 9: Creating configuration template...${NC}"
cat > dist/ham-radio-server/config/server-config.json << 'EOF'
{
  "server": {
    "port": 8080,
    "bindAddress": "0.0.0.0",
    "pwaAssetsPath": "./pwa-assets"
  },
  "certificates": {
    "storePath": "./certificates",
    "requireBootstrap": true
  },
  "emergency": {
    "enabled": false,
    "contact": {
      "callsign": "YOUR_CALLSIGN",
      "frequency": "144.390 MHz",
      "notes": "Primary emergency frequency"
    }
  },
  "logging": {
    "level": "info",
    "console": true,
    "filePath": "./logs/server.log"
  }
}
EOF
echo -e "${GREEN}✓ Configuration template created${NC}"

# Step 10: Create README
echo -e "${YELLOW}Step 10: Creating documentation...${NC}"
cat > dist/ham-radio-server/README.md << 'EOF'
# Ham Radio WebRTC Signaling Server

## Quick Start

### Regular Operation
1. Extract this package to your desired location
2. Run the appropriate script for your platform:
   - **Linux**: `./scripts/start-linux.sh`
   - **macOS**: `./scripts/start-macos.sh`
   - **Windows**: `scripts\start-windows.bat`
3. Access the PWA at http://localhost:8080

### Emergency Deployment
For rapid deployment in emergency situations:
```bash
./scripts/emergency-start.sh
```

## Configuration
Edit `config/server-config.json` to customize:
- Server port (default: 8080)
- Your callsign
- Emergency contact frequency
- Logging preferences

## First-Time Setup
1. Start the server
2. Open http://localhost:8080 in your browser
3. If prompted, provide a root certificate to bootstrap the trust chain
4. Configure your station settings

## Directory Structure
- `binaries/` - Platform-specific server executables
- `pwa-assets/` - Web application files
- `scripts/` - Startup scripts for each platform
- `config/` - Server configuration
- `certificates/` - Certificate storage (created on first run)
- `logs/` - Server logs (created on first run)

## System Requirements
- **Memory**: 512 MB minimum
- **Disk**: 500 MB minimum
- **Network**: Port 8080 available
- **OS**: Linux, macOS, or Windows

## Emergency Communications
This server is designed for emergency preparedness. Licensed amateur radio
operators are encouraged to maintain local servers to ensure network
resilience when internet infrastructure is unavailable.

## Troubleshooting

### Port Already in Use
Change the port in `config/server-config.json` or stop the conflicting service.

### Certificate Issues
Delete the `certificates/` directory to reset and re-bootstrap.

### Binary Won't Run
- **Linux/macOS**: Make sure the binary is executable: `chmod +x binaries/signaling-server-*`
- **macOS**: Clear quarantine: `xattr -cr binaries/`
- **Windows**: Allow in Windows Defender if prompted

## Support
For issues and documentation, visit the project repository.

---
*Emergency Preparedness for Amateur Radio Operators*
*Version 1.0*
EOF
echo -e "${GREEN}✓ Documentation created${NC}"

# Step 11: Create the distribution ZIP
echo -e "${YELLOW}Step 11: Creating distribution package...${NC}"
cd dist
zip -r ham-radio-server.zip ham-radio-server/ > /dev/null 2>&1
ZIP_SIZE=$(du -h ham-radio-server.zip | cut -f1)
cd ..
echo -e "${GREEN}✓ Distribution package created (${ZIP_SIZE})${NC}"

# Step 12: Create checksum file
echo -e "${YELLOW}Step 12: Generating checksums...${NC}"
cd dist
if command -v sha256sum > /dev/null 2>&1; then
    sha256sum ham-radio-server.zip > ham-radio-server.zip.sha256
    echo -e "${GREEN}✓ SHA256 checksum generated${NC}"
elif command -v shasum > /dev/null 2>&1; then
    shasum -a 256 ham-radio-server.zip > ham-radio-server.zip.sha256
    echo -e "${GREEN}✓ SHA256 checksum generated${NC}"
else
    echo -e "${YELLOW}⚠ Checksum tool not found${NC}"
fi
cd ..

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}Package location:${NC} $(pwd)/dist/ham-radio-server.zip"
echo -e "${GREEN}Package size:${NC} ${ZIP_SIZE}"
echo ""
echo "Available files in dist/:"
ls -lh dist/*.zip 2>/dev/null || echo "No ZIP files found"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the package locally by extracting and running"
echo "2. Upload to GitHub Releases or distribution server"
echo "3. Share with amateur radio emergency groups"
echo ""
echo -e "${GREEN}73! (Best regards in ham radio)${NC}"
