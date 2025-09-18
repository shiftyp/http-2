# Quickstart Guide: PWA Server Deployment

## Overview

This guide walks you through downloading, deploying, and configuring the Ham Radio WebRTC server with integrated PWA support. The server provides emergency preparedness capabilities by serving the complete PWA application locally, ensuring network resilience when internet infrastructure is unavailable.

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+), macOS (10.15+), or Windows 10+
- **Memory**: 512 MB minimum, 1 GB recommended
- **Disk Space**: 500 MB minimum (1 GB for logs and data)
- **Network**: Port 8080 available for server operation

### Ham Radio Requirements
- **Valid Amateur Radio License**: Required for emergency operations
- **ECDSA Certificate**: For secure mesh networking (can be generated during setup)
- **Emergency Communications Plan**: Knowledge of your local emergency protocols

## Step 1: Download Server Package

### Option A: Station Setup Wizard (Recommended)

1. **Open the Ham Radio WebRTC PWA** in your browser
2. **Navigate to Station Setup** if not already there
3. **Find the Server Download section** with emergency preparedness messaging:
   ```
   Emergency Server Deployment
   Licensed stations are encouraged to download and maintain
   their own server for emergency preparedness, ensuring
   network resilience when internet infrastructure is unavailable.
   ```
4. **Click "Download Server Package"**
5. **Monitor download progress** (approximately 50 MB)
6. **Verify package integrity** when download completes

### Option B: Direct Download

If you have access to the signaling server:

```bash
# Download package information
curl http://localhost:8080/api/packages/info

# Download complete server package
curl -o ham-radio-server.zip \
     -H "Accept: application/zip" \
     http://localhost:8080/api/packages/download

# Verify package integrity
curl -X POST http://localhost:8080/api/packages/verify \
     -H "Content-Type: application/json" \
     -d '{"checksum": "your-package-checksum", "algorithm": "sha256"}'
```

## Step 2: Extract and Install

### All Platforms

1. **Create installation directory**:
   ```bash
   # Linux/macOS
   mkdir -p ~/ham-radio-server
   cd ~/ham-radio-server

   # Windows (PowerShell)
   New-Item -ItemType Directory -Path "$env:USERPROFILE\ham-radio-server"
   Set-Location "$env:USERPROFILE\ham-radio-server"
   ```

2. **Extract server package**:
   ```bash
   # Linux/macOS
   unzip ../ham-radio-server.zip

   # Windows
   Expand-Archive ..\ham-radio-server.zip -DestinationPath .
   ```

3. **Verify extraction**:
   ```bash
   # You should see this structure:
   ham-radio-server/
   ├── binaries/
   │   ├── linux-x64/signaling-server
   │   ├── linux-arm64/signaling-server
   │   ├── macos-x64/signaling-server
   │   ├── macos-arm64/signaling-server
   │   └── windows-x64/signaling-server.exe
   ├── pwa-assets/
   │   ├── index.html
   │   ├── manifest.json
   │   ├── sw.js
   │   └── assets/
   ├── scripts/
   │   ├── start-linux.sh
   │   ├── start-macos.sh
   │   └── start-windows.bat
   ├── config/
   │   └── server-config.json
   └── README.md
   ```

## Step 3: Platform-Specific Setup

### Linux

1. **Make binary executable**:
   ```bash
   chmod +x binaries/linux-x64/signaling-server
   # or for ARM64:
   chmod +x binaries/linux-arm64/signaling-server
   ```

2. **Create systemd service** (optional):
   ```bash
   sudo tee /etc/systemd/system/ham-radio-server.service > /dev/null <<EOF
   [Unit]
   Description=Ham Radio WebRTC Signaling Server
   After=network.target

   [Service]
   Type=simple
   User=ham-radio
   WorkingDirectory=/home/ham-radio/ham-radio-server
   ExecStart=/home/ham-radio/ham-radio-server/binaries/linux-x64/signaling-server
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   EOF

   sudo systemctl enable ham-radio-server
   ```

### macOS

1. **Make binary executable**:
   ```bash
   chmod +x binaries/macos-x64/signaling-server
   # or for Apple Silicon:
   chmod +x binaries/macos-arm64/signaling-server
   ```

2. **Handle Gatekeeper** (if needed):
   ```bash
   # If macOS blocks the binary:
   xattr -dr com.apple.quarantine binaries/macos-x64/signaling-server
   ```

3. **Create LaunchAgent** (optional):
   ```bash
   tee ~/Library/LaunchAgents/com.hamradio.signaling-server.plist > /dev/null <<EOF
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.hamradio.signaling-server</string>
       <key>ProgramArguments</key>
       <array>
           <string>/Users/your-username/ham-radio-server/binaries/macos-x64/signaling-server</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/Users/your-username/ham-radio-server</string>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
   </dict>
   </plist>
   EOF

   launchctl load ~/Library/LaunchAgents/com.hamradio.signaling-server.plist
   ```

### Windows

1. **Test binary execution**:
   ```powershell
   # Test the server runs
   .\binaries\windows-x64\signaling-server.exe --version
   ```

2. **Create Windows Service** (optional):
   ```powershell
   # Using NSSM (Non-Sucking Service Manager)
   # Download NSSM first, then:
   nssm install HamRadioServer "$PWD\binaries\windows-x64\signaling-server.exe"
   nssm set HamRadioServer AppDirectory "$PWD"
   nssm set HamRadioServer DisplayName "Ham Radio WebRTC Server"
   nssm set HamRadioServer Description "Ham Radio emergency communications server"
   nssm start HamRadioServer
   ```

## Step 4: Initial Configuration

### Basic Configuration

1. **Edit server configuration**:
   ```json
   // config/server-config.json
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
       "enabled": true,
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
   ```

2. **Create necessary directories**:
   ```bash
   mkdir -p certificates logs
   ```

### Firewall Configuration

**Linux (UFW)**:
```bash
sudo ufw allow 8080/tcp comment "Ham Radio WebRTC Server"
```

**macOS**:
```bash
# Add firewall rule through System Preferences > Security & Privacy > Firewall
# Or using command line:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/signaling-server
```

**Windows**:
```powershell
# Add Windows Firewall rule
New-NetFirewallRule -DisplayName "Ham Radio WebRTC Server" -Direction Inbound -Port 8080 -Protocol TCP -Action Allow
```

## Step 5: First Startup and Certificate Bootstrap

### Start the Server

1. **Run the appropriate startup script**:
   ```bash
   # Linux/macOS
   ./scripts/start-linux.sh
   # or
   ./scripts/start-macos.sh

   # Windows
   .\scripts\start-windows.bat
   ```

2. **Or run the binary directly**:
   ```bash
   # Linux x64
   ./binaries/linux-x64/signaling-server

   # macOS x64
   ./binaries/macos-x64/signaling-server

   # Windows
   .\binaries\windows-x64\signaling-server.exe
   ```

3. **Verify server startup**:
   ```
   Ham Radio WebRTC Signaling Server listening on port 8080
   Health check: http://localhost:8080/health
   Statistics: http://localhost:8080/stats
   PWA available at: http://localhost:8080/
   Bootstrap needed: http://localhost:8080/api/bootstrap/status
   ```

### Bootstrap Root Certificate

Since this is a fresh deployment, you'll need to establish a root certificate:

1. **Check bootstrap status**:
   ```bash
   curl http://localhost:8080/api/bootstrap/status
   ```

2. **Access PWA interface**:
   - Open your browser to `http://localhost:8080/`
   - You should see the Ham Radio WebRTC PWA
   - Look for certificate bootstrap prompts

3. **Bootstrap certificate via API** (if needed):
   ```bash
   # Generate or obtain an ECDSA certificate for your callsign
   # Then upload it:
   curl -X POST http://localhost:8080/api/bootstrap/certificate \
        -H "Content-Type: application/json" \
        -d '{
          "certificatePem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
          "callsign": "YOUR_CALLSIGN",
          "description": "Root certificate for emergency operations",
          "emergencyUse": true
        }'
   ```

4. **Verify certificate installation**:
   ```bash
   curl http://localhost:8080/api/bootstrap/trust-chain
   ```

## Step 6: Verify PWA Serving

### Test PWA Access

1. **Open browser to server**:
   ```
   http://localhost:8080/
   ```

2. **Verify PWA functionality**:
   - [ ] Main page loads correctly
   - [ ] PWA manifest loads: `http://localhost:8080/manifest.json`
   - [ ] Service worker registers: `http://localhost:8080/sw.js`
   - [ ] Static assets load: `http://localhost:8080/assets/...`

3. **Test offline capability**:
   - Disconnect from internet
   - Refresh the PWA - it should still work
   - Test core functionality offline

### Health Checks

1. **Server health**:
   ```bash
   curl http://localhost:8080/health
   # Expected: {"status":"ok","networks":0,"stations":0,"uptime":...}
   ```

2. **PWA health**:
   ```bash
   curl http://localhost:8080/api/pwa/health
   # Expected: {"healthy":true,"checkedAt":"...","checks":[...]}
   ```

3. **Certificate status**:
   ```bash
   curl http://localhost:8080/api/bootstrap/certificates
   # Expected: List of installed certificates
   ```

## Step 7: Emergency Deployment Configuration

### Quick Emergency Setup

For rapid deployment in emergency situations:

1. **Minimal configuration file**:
   ```json
   {
     "server": {"port": 8080},
     "emergency": {"enabled": true},
     "logging": {"level": "warn", "console": true}
   }
   ```

2. **Emergency startup command**:
   ```bash
   # Linux/macOS emergency start
   ./binaries/linux-x64/signaling-server --emergency --port 8080 --no-bootstrap

   # Windows emergency start
   .\binaries\windows-x64\signaling-server.exe --emergency --port 8080 --no-bootstrap
   ```

3. **Verify emergency mode**:
   - PWA should show emergency interface
   - Simplified configuration options
   - Essential features only

### Network Access Configuration

1. **Local network access**:
   ```bash
   # Find your local IP
   ip addr show # Linux
   ifconfig     # macOS
   ipconfig     # Windows

   # Access from other devices:
   http://YOUR-LOCAL-IP:8080/
   ```

2. **Mesh network integration**:
   - Configure your radio for mesh operations
   - Ensure proper frequency coordination
   - Test WebRTC peer connections

## Troubleshooting

### Common Issues

1. **Port 8080 already in use**:
   ```bash
   # Find what's using the port
   sudo netstat -tulpn | grep :8080  # Linux
   lsof -i :8080                     # macOS
   netstat -ano | findstr :8080      # Windows

   # Change port in config or stop conflicting service
   ```

2. **PWA assets not loading**:
   ```bash
   # Check PWA assets directory exists
   ls -la pwa-assets/

   # Verify permissions
   chmod -R 644 pwa-assets/*
   chmod 755 pwa-assets/
   ```

3. **Certificate bootstrap fails**:
   ```bash
   # Check certificate format
   openssl x509 -in your-cert.pem -text -noout

   # Verify ECDSA algorithm
   # Only ECDSA certificates are supported
   ```

4. **Server won't start**:
   ```bash
   # Check logs
   tail -f logs/server.log

   # Test binary directly
   ./binaries/linux-x64/signaling-server --version

   # Check system requirements
   ldd binaries/linux-x64/signaling-server  # Linux
   ```

### Emergency Recovery

If the server becomes inaccessible:

1. **Reset configuration**:
   ```bash
   # Backup current config
   cp config/server-config.json config/server-config.json.backup

   # Use minimal config
   echo '{"server":{"port":8080},"emergency":{"enabled":true}}' > config/server-config.json
   ```

2. **Clear certificate store** (if needed):
   ```bash
   # Backup certificates
   tar czf certificates-backup.tar.gz certificates/

   # Clear certificates (will require re-bootstrap)
   rm -rf certificates/*
   ```

3. **Factory reset**:
   ```bash
   # Stop server
   # Remove all data
   rm -rf certificates/ logs/ config/server-config.json
   # Restart with default configuration
   ```

## Next Steps

After successful deployment:

1. **Configure station settings** in the PWA
2. **Test emergency communication procedures**
3. **Join or create mesh networks**
4. **Set up regular backup procedures**
5. **Train other operators** on server operation
6. **Document local emergency procedures**

## Security Considerations

- **Certificate Management**: Keep certificates secure and backed up
- **Network Security**: Use firewalls to limit access as appropriate
- **Regular Updates**: Update server and PWA when new versions are available
- **Emergency Protocols**: Ensure compliance with local emergency communication plans

## Additional Resources

- **Ham Radio WebRTC Documentation**: [Project Documentation]
- **Emergency Communications**: [ARRL Emergency Communications Guide]
- **Certificate Management**: [X.509 Certificate Guide for Ham Radio]
- **Mesh Networking**: [AREDN Network Documentation]

---

**Emergency Preparedness Reminder**: Licensed amateur radio operators are encouraged to maintain local server infrastructure to ensure communication capability during emergencies when internet infrastructure may be unavailable. This server enables resilient mesh networking for emergency response coordination.

*Deployment Guide Version 1.0*
*Created: 2025-09-18*
*For PWA Server Feature Implementation*