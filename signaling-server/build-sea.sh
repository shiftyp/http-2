#!/bin/bash

# Build using Node.js Single Executable Application (requires Node 20+)
echo "Building Node.js SEA (Single Executable Application)..."

# Check Node version
NODE_VERSION=$(node -v | cut -d. -f1 | cut -dv -f2)
if [ "$NODE_VERSION" -lt "20" ]; then
  echo "Error: Node.js 20+ required for SEA. Current version: $(node -v)"
  exit 1
fi

# Create bundled JavaScript
echo "Creating bundle..."
cat > bundle.js << 'EOF'
// Bundle all dependencies inline
const fs = require('fs');
const path = require('path');

// Inject the main server code
EOF
cat server.js >> bundle.js

# Generate blob
node --experimental-sea-config sea-config.json

# Copy Node executable and inject blob
cp $(which node) signaling-server
npx postject signaling-server NODE_SEA_BLOB signaling-server.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Make executable
chmod +x signaling-server

echo "Single executable created: ./signaling-server"
echo "Run with: ./signaling-server"