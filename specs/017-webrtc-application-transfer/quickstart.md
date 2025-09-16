# Quickstart: Distributed Servers

## Prerequisites

- Ham Radio PWA installed and running
- Valid amateur radio certificate file (.p12, .pem, or .crt)
- Windows, macOS, or Linux operating system
- Local network connection (for peer discovery)

## Quick Setup (5 minutes)

### Step 1: Install PWA and Download Server

1. Open the Ham Radio PWA in your browser
2. Navigate to Settings → Distributed Servers
3. Upload your amateur radio certificate when prompted
4. Click "Download Server" for your operating system
5. Save the server binary to a convenient location

### Step 2: Run the Server

#### Windows
```cmd
# Open Command Prompt or PowerShell
cd path\to\downloaded\file
ham-server.exe

# Allow through Windows Firewall when prompted
```

#### macOS
```bash
# Open Terminal
cd ~/Downloads
chmod +x ham-server-darwin
./ham-server-darwin

# If blocked by Gatekeeper:
xattr -d com.apple.quarantine ham-server-darwin
./ham-server-darwin
```

#### Linux
```bash
# Open Terminal
cd ~/Downloads
chmod +x ham-server-linux
./ham-server-linux
```

### Step 3: Initialize Your Server

1. Server starts in "unclaimed" state
2. Open http://localhost:8080 in your browser
3. Click "Initialize Server" in the PWA
4. Your station data transfers automatically
5. Server is now claimed and operational

### Step 4: Share Your Server

After initialization, the PWA displays:

1. **QR Code**: Other operators can scan to connect
2. **Server URL**: `ws://192.168.1.100:8080/signal`
3. **Local Name**: `w1aw.local:8080`

Share any of these with other operators to enable connections.

## Testing Your Setup

### Test 1: Server Status
```bash
curl http://localhost:8080/api/status
```

Expected response:
```json
{
  "state": "active",
  "owner": "YOUR_CALLSIGN",
  "version": "1.0.0-20250916123456",
  "signaling": {
    "url": "ws://192.168.1.100:8080/signal",
    "connected": 0
  }
}
```

### Test 2: Certificate Verification
```bash
curl http://localhost:8080/api/info
```

Expected response:
```json
{
  "type": "signaling",
  "version": "1.0.0-20250916123456",
  "capabilities": ["signaling", "webrtc", "ca", "mesh"],
  "callsign": "YOUR_CALLSIGN",
  "signalingUrl": "ws://192.168.1.100:8080/signal"
}
```

### Test 3: Local Discovery

1. Have another operator run their server on the same network
2. Both servers should auto-discover via mDNS
3. Check discovered peers:

```bash
curl http://localhost:8080/api/local-servers
```

Expected response:
```json
{
  "servers": [
    {
      "callsign": "OTHER_CALLSIGN",
      "endpoint": "192.168.1.101:8080",
      "signalingUrl": "ws://192.168.1.101:8080/signal",
      "capabilities": ["signaling", "webrtc"]
    }
  ]
}
```

### Test 4: WebRTC Signaling

1. Open PWA on two different devices/browsers
2. Both connect to your signaling server
3. Initiate P2P connection between them
4. Verify data transfer works

## Common Operations

### Connect to Another Server

#### Via QR Code
1. Click "Connect to Server" in PWA
2. Select "Scan QR Code"
3. Point camera at server QR code
4. Connection established automatically

#### Via URL
1. Click "Connect to Server" in PWA
2. Select "Manual Entry"
3. Enter: `ws://192.168.1.100:8080/signal`
4. Click "Connect"

### Issue a Certificate (CA Mode)

If your server can act as a Certificate Authority:

1. Another operator requests certificate from you
2. You verify their identity/license
3. Click "Issue Certificate" in PWA
4. Enter their callsign and license class
5. Certificate generated and sent

### Coordinate with Other Servers

1. Navigate to Server Coordination in PWA
2. Add peer server endpoint
3. Servers exchange certificate lists automatically
4. Content catalogs sync periodically

## Offline Operation

When internet is lost:

1. Servers detect outage within 30 seconds
2. Automatic switch to distributed mode
3. Discovery continues via mDNS and RF
4. All features work without internet
5. When internet returns, seamless transition back

## Troubleshooting

### Server Won't Start
- **Port in use**: Change port with `--port 8081`
- **Permission denied**: Run with appropriate permissions
- **Certificate invalid**: Ensure certificate is properly formatted

### Can't Connect to Server
- **Firewall blocking**: Allow server through firewall
- **Wrong URL**: Verify IP address and port
- **Network isolation**: Ensure on same network

### Discovery Not Working
- **mDNS blocked**: Check router settings
- **Firewall**: Allow UDP port 5353
- **Multiple interfaces**: Specify with `--interface eth0`

### Certificate Issues
- **Chain validation failed**: Ensure complete chain provided
- **Untrusted root**: Add root CA to trust store
- **Expired certificate**: Certificates don't expire in this system

## Command Line Options

```bash
ham-server --help

Options:
  --port <number>        HTTP/WS port (default: 8080)
  --cert-dir <path>      Certificate storage directory
  --no-mdns             Disable mDNS advertisement
  --interface <name>     Network interface for mDNS
  --verbose             Enable debug logging
  --version             Show version and exit
```

## Quick Commands Reference

```bash
# Start server on custom port
ham-server --port 8081

# Start with verbose logging
ham-server --verbose

# Use specific network interface
ham-server --interface eth0

# Specify certificate directory
ham-server --cert-dir ~/.ham-radio/certs
```

## Security Notes

1. **Certificates**: Never share your private key
2. **Firewall**: Only open required ports
3. **Trust**: Verify certificates before trusting
4. **Updates**: Keep server binary updated with PWA

## Next Steps

1. Join the mesh network with other operators
2. Set up content synchronization
3. Configure as Certificate Authority (if licensed)
4. Integrate with radio for RF discovery
5. Participate in emergency communications drills

## Getting Help

- Check server logs: `ham-server --verbose`
- PWA diagnostics: Settings → Diagnostics
- Community forum: http://hamradio.community
- Technical docs: See `/specs/017-distributed-servers/`

## Success Checklist

- [ ] Server downloaded and running
- [ ] Server initialized with your callsign
- [ ] Status endpoint returns active state
- [ ] QR code displayed in PWA
- [ ] Can connect from another device
- [ ] Local discovery working (if multiple servers)
- [ ] WebRTC signaling tested
- [ ] Offline mode tested