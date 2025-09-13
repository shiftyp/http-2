# User Guide - HTTP Over Ham Radio

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Operations](#basic-operations)
3. [Digital Logbook](#digital-logbook)
4. [Mesh Networking](#mesh-networking)
5. [Content Creation](#content-creation)
6. [Data Transfer](#data-transfer)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements

- **Browser**: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
- **Radio Equipment**:
  - HF/VHF/UHF transceiver with SSB capability
  - USB cable for CAT control (optional but recommended)
  - Audio interface (built-in USB or external)
- **Amateur Radio License**: Valid license for your country

### Installation

#### Option 1: Online Installation (Recommended)

1. Visit the application URL in your browser
2. When prompted, click "Install" to add as PWA
3. The app will be available offline after installation

#### Option 2: Local Development

```bash
git clone https://github.com/yourusername/http-2.git
cd http-2
npm install
npm run dev
```

Open http://localhost:5173 in your browser

### Initial Configuration

1. **Station Setup**
   - Navigate to Settings → Station Info
   - Enter your callsign (required)
   - Set your grid square (optional)
   - Configure station details

2. **Radio Connection**
   - Go to Settings → Radio
   - Click "Connect Radio"
   - Select your radio's serial port
   - Configure baud rate (usually 9600 or 19200)

3. **Audio Setup**
   - Settings → Audio
   - Select input/output devices
   - Adjust levels using the VU meter
   - Test with local loopback

## Basic Operations

### Transmitting Content

1. **Create a Page**
   - Click "New Page" in the dashboard
   - Enter content using the editor
   - Preview compression ratio
   - Save to local storage

2. **Send Page**
   - Select the page to transmit
   - Choose transmission mode:
     - QPSK-750 (poor conditions)
     - QPSK-1500 (average conditions)
     - QPSK-2800 (good conditions)
   - Click "Transmit"
   - Monitor progress indicator

3. **Monitor Transmission**
   - Watch the waterfall display
   - Check S-meter for signal strength
   - View acknowledgment status

### Receiving Content

1. **Auto-Receive Mode**
   - Enable "Auto RX" in the dashboard
   - Set squelch level appropriately
   - Incoming pages appear automatically

2. **Manual Reception**
   - Click "Start Receiving"
   - Tune to the correct frequency
   - Pages are decoded and stored

3. **View Received Pages**
   - Navigate to "Received" tab
   - Click to view full content
   - Option to save or forward

## Digital Logbook

### Logging QSOs

1. **Manual Entry**
   ```
   Dashboard → Logbook → New QSO
   - Callsign: [Other station's call]
   - Frequency: [Auto-filled from radio]
   - Mode: [Auto-detected]
   - RST Sent/Received: [Signal reports]
   - Comments: [Optional notes]
   ```

2. **Auto-Logging**
   - Enable "Auto-log QSOs" in settings
   - Contacts are logged automatically
   - Review and edit as needed

### Logbook Features

- **Search**: Find QSOs by call, date, band
- **Statistics**: QSO count, DXCC entities, grids worked
- **Export**: ADIF format for other logging programs
- **Import**: Bring in existing ADIF logs
- **Awards Tracking**: DXCC, WAS, WAZ progress

### Contest Support

1. Select contest from dropdown
2. Use quick-entry mode
3. Auto-increment serial numbers
4. Generate Cabrillo logs

## Mesh Networking

### Joining a Mesh Network

1. **Network Discovery**
   - Enable mesh mode in settings
   - Set network name (SSID)
   - Enter shared key (if encrypted)

2. **Node Configuration**
   - Set your node ID (usually callsign)
   - Configure hop limit (typically 3-5)
   - Enable routing advertisements

3. **Routing Table**
   - View active routes
   - See neighbor nodes
   - Monitor link quality

### Mesh Operations

- **Multi-hop Messages**: Automatically routed through network
- **Store-and-Forward**: Messages queued when destination offline
- **Network Mapping**: Visual display of mesh topology
- **Bandwidth Management**: Automatic rate limiting

## Content Creation

### Using the Editor

1. **Rich Text Editor**
   - Format text with markdown
   - Insert images (compressed automatically)
   - Add tables and lists
   - Preview final size

2. **JSX Components**
   ```jsx
   // Create reusable components
   <WeatherReport
     temp="72F"
     conditions="Sunny"
   />
   ```

3. **Compression Preview**
   - Real-time compression ratio
   - Estimated transmission time
   - Bandwidth usage indicator

### Content Types

- **Text Pages**: Articles, bulletins, messages
- **Forms**: Data collection with validation
- **Tables**: Structured data display
- **Images**: Automatically compressed
- **Server Apps**: Interactive JavaScript applications

## Data Transfer

### Station-to-Station Transfer (Planned Feature)

1. **Preparing for Transfer**
   - Select data to transfer:
     - Logbook entries
     - Messages
     - Settings
     - Pages
   - Review total size

2. **Using QR Codes**
   - Generate QR code on source device
   - Scan with destination device
   - Confirm transfer details
   - Monitor progress

3. **Using Shortcodes**
   - Generate 6-character code
   - Enter on destination device
   - Verify fingerprint
   - Begin transfer

### Backup and Restore

1. **Local Backup**
   - Settings → Backup
   - Choose data to backup
   - Save to file

2. **Restore**
   - Settings → Restore
   - Select backup file
   - Choose items to restore
   - Merge or replace options

## Advanced Features

### Cryptographic Operations

1. **Digital Signatures**
   - All transmissions signed automatically
   - Verify sender identity
   - Prevent tampering

2. **Key Management**
   - Generate key pairs
   - Export public key
   - Import trusted keys
   - Revoke compromised keys

### Bandwidth Optimization

1. **Adaptive Rate Control**
   - Automatic SNR detection
   - Dynamic rate adjustment
   - Fall-back modes

2. **Compression Tuning**
   - Template optimization
   - Dictionary management
   - Custom compression rules

### Server Applications

1. **Installing Apps**
   - Browse app directory
   - Click to install
   - Configure permissions

2. **Creating Apps**
   ```javascript
   // Simple server app
   export default {
     name: "Weather",
     handle(request) {
       return {
         temperature: "72F",
         conditions: "Sunny"
       };
     }
   };
   ```

### API Integration

Connect to external services:
- Weather data
- Propagation reports
- DX clusters
- APRS gateways

## Troubleshooting

### Connection Issues

**Problem**: Can't connect to radio
- **Solution**: Check USB cable, verify COM port, ensure radio is on

**Problem**: No audio input/output
- **Solution**: Check audio device selection, adjust levels, verify cables

**Problem**: Web Serial not available
- **Solution**: Use Chrome or Edge browser, enable experimental features

### Performance Issues

**Problem**: Slow page loading
- **Solution**: Clear cache, reduce image sizes, optimize content

**Problem**: Poor decode rate
- **Solution**: Adjust audio levels, check for RF interference, reduce data rate

**Problem**: High CPU usage
- **Solution**: Close unused tabs, disable waterfall display, reduce FFT size

### Mesh Network Issues

**Problem**: Can't find other nodes
- **Solution**: Verify frequency, check network key, ensure mesh enabled

**Problem**: Routes not updating
- **Solution**: Increase beacon rate, check hop limit, verify routing table

### Data Issues

**Problem**: Lost logbook entries
- **Solution**: Check IndexedDB storage, restore from backup

**Problem**: Corrupted pages
- **Solution**: Clear page cache, re-receive content

## Tips and Best Practices

### Operating Tips

1. **Frequency Selection**
   - Use established digital frequencies
   - Check band plans for your region
   - Avoid QRM from other modes

2. **Signal Optimization**
   - Keep audio levels in green zone
   - Use minimum power necessary
   - Ensure good antenna match

3. **Network Etiquette**
   - Identify regularly
   - Keep transmissions brief
   - Respect bandwidth limitations

### Performance Optimization

1. **Content Best Practices**
   - Compress images before uploading
   - Use templates for repeated content
   - Minimize external resources

2. **Mesh Configuration**
   - Limit hop count to reduce latency
   - Use directional antennas when possible
   - Configure appropriate timeouts

### Security Considerations

1. **Key Security**
   - Backup private keys securely
   - Don't share private keys
   - Rotate keys periodically

2. **Content Verification**
   - Verify signatures on received content
   - Check sender callsign
   - Report suspicious activity

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New page |
| `Ctrl+S` | Save page |
| `Ctrl+T` | Transmit |
| `Ctrl+R` | Start receiving |
| `Ctrl+L` | Open logbook |
| `Ctrl+,` | Settings |
| `F1` | Help |
| `F5` | Refresh |
| `F11` | Fullscreen |

## Getting Help

- **In-App Help**: Press F1 or click Help menu
- **Documentation**: Available offline in app
- **Community Forum**: GitHub Discussions
- **Bug Reports**: GitHub Issues
- **Ham Radio Net**: Thursdays 8PM ET on 14.230 MHz

---

*Last updated: 2025-09-13*