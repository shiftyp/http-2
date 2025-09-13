# Quick Start Guide

Get up and running with HTTP Over Ham Radio in 5 minutes!

## 🚀 Installation (30 seconds)

### Option A: Visit Hosted App
```
https://your-deployment-url.com
Click "Install" when prompted
```

### Option B: Run Locally
```bash
git clone https://github.com/yourusername/http-2.git
cd http-2
npm install
npm run dev
```

## ⚙️ Initial Setup (2 minutes)

### 1. Enter Your Callsign
```
Settings → Station Info
Callsign: [YOUR_CALL]
Grid Square: [OPTIONAL]
```

### 2. Connect Your Radio (Optional)
```
Settings → Radio
Click "Connect Radio"
Select port (usually /dev/ttyUSB0 or COM3)
```

### 3. Configure Audio
```
Settings → Audio
Select microphone input
Select speaker output
Test with loopback
```

## 📡 First QSO (2 minutes)

### Transmit Your First Page

1. **Create Content**
   ```
   Dashboard → New Page
   Title: "Hello World"
   Content: "This is my first HTTP over Radio transmission!"
   ```

2. **Send It**
   ```
   Select QPSK-1500 mode
   Click "Transmit"
   Watch the waterfall display
   ```

3. **Receive Confirmation**
   ```
   Auto-RX will capture responses
   Check "Received" tab for replies
   ```

## 🎯 Try These Features

### 1. Digital Logbook
```
Logbook → New QSO
- Enter contact details
- Auto-fills from radio
- Export as ADIF
```

### 2. Mesh Networking
```
Settings → Mesh
- Enable mesh mode
- Set network name
- View routing table
```

### 3. Compressed Messaging
```
New Page → Enable Compression
- See 10-20x reduction
- Preview transmission time
- Monitor bandwidth usage
```

## 📊 Quick Reference

### Modes & Speeds

| Mode | Speed | Conditions | Use Case |
|------|-------|------------|----------|
| QPSK-750 | 750 bps | Poor | Long distance, weak signals |
| QPSK-1500 | 1500 bps | Average | General use |
| QPSK-2800 | 2800 bps | Good | Local, strong signals |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+N` | New page |
| `Ctrl+T` | Transmit |
| `Ctrl+R` | Receive |
| `Ctrl+L` | Logbook |

### Common Frequencies

| Band | Frequency | Mode |
|------|-----------|------|
| 20m | 14.085 MHz | USB |
| 40m | 7.080 MHz | LSB |
| 2m | 144.620 MHz | USB |

## 🔧 Quick Troubleshooting

### Can't Connect to Radio?
```bash
# Check serial port
ls /dev/tty* | grep USB

# Or on Windows
mode

# Verify in app
Settings → Radio → Test Connection
```

### No Audio?
```javascript
// Check browser console
navigator.mediaDevices.enumerateDevices()
  .then(devices => console.log(devices));

// Verify in app
Settings → Audio → Test Loopback
```

### Poor Decode?
1. Reduce data rate to QPSK-750
2. Adjust audio levels (aim for -6dB)
3. Check for RF interference
4. Improve antenna system

## 📱 Mobile Operation

### Using a Tablet/Phone
1. Install as PWA for offline use
2. Use Bluetooth CAT control
3. External keyboard recommended
4. Power bank for extended operation

## 🌐 Join the Network

### Find Other Stations
```
Dashboard → Network Explorer
- See active stations
- View their shared content
- Request QSOs
```

### Share Your Content
```
Settings → Sharing
- Make pages public
- Set access permissions
- Enable auto-beacon
```

## 📚 Next Steps

### Learn More
- [Full User Guide](USER_GUIDE.md) - Complete documentation
- [Radio Setup](RADIO_SETUP.md) - Detailed radio configuration
- [Mesh Guide](MESH_GUIDE.md) - Advanced networking

### Get Help
- **In-App**: Press F1 for help
- **Community**: GitHub Discussions
- **Net**: Thursdays 8PM ET, 14.230 MHz

### Contribute
- Report bugs on GitHub
- Share your configurations
- Submit feature requests

## 🎉 You're Ready!

You now know enough to:
- ✅ Send and receive pages
- ✅ Log contacts
- ✅ Join mesh networks
- ✅ Use compression

**Welcome to HTTP Over Ham Radio!**

---

*Need help? Join our Thursday night net on 14.230 MHz*

**73!** 📻