# SDR Support Quickstart Guide

## Prerequisites

### Hardware Requirements
- **SDR Device**: One of the supported devices (RTL-SDR dongle recommended for beginners)
  - RTL-SDR: $25-40, 2.4 MHz bandwidth, good for initial testing
  - HackRF One: $300+, 20 MHz bandwidth, advanced features
  - LimeSDR: $300+, 61.44 MHz bandwidth, full-duplex capability
  - PlutoSDR: $200+, 56 MHz bandwidth, advanced DSP features
  - SDRplay RSP: $100+, 8 MHz bandwidth, excellent performance
- **Computer**: Dual-core CPU minimum, 4GB RAM, USB 3.0 port
- **Browser**: Chrome 76+, Edge 79+, or Opera 63+ (WebUSB support required)

### Software Prerequisites
- Modern web browser with WebUSB support
- HTTPS connection (required for WebUSB)
- HTTP-over-radio PWA already installed and configured

## Quick Setup (5 minutes)

### Step 1: Connect SDR Device
1. Connect RTL-SDR dongle to USB 3.0 port
2. Open HTTP-over-radio PWA in Chrome/Edge
3. Navigate to **Settings** → **SDR Configuration**
4. Click **"Connect SDR Device"** button
5. Select your RTL-SDR device from WebUSB dialog
6. Wait for automatic device detection and capability discovery

**Expected Result**: Device appears in connected devices list with green status indicator

### Step 2: Configure Monitoring
1. Click **"Add Monitoring Profile"**
2. Set profile name: `"40m Content Discovery"`
3. Select frequency range: **40m band (7.035-7.045 MHz)**
4. Enable **"Content Discovery"** purpose
5. Set priority: **5** (medium priority)
6. Click **"Save Configuration"**

**Expected Result**: New monitoring profile appears with active status

### Step 3: Start Monitoring
1. Click **"Start Monitoring"** next to your profile
2. Open **SDR Monitor Dashboard**
3. Verify waterfall display shows spectrum activity
4. Check **"Decoded Transmissions"** tab for incoming data

**Expected Result**: Real-time waterfall display with spectrum visualization

### Step 4: Verify Content Discovery
1. Wait for other stations to transmit HTTP-over-radio content
2. Monitor **"Auto-Discovery Cache"** section
3. Look for cached content chunks from other callsigns
4. Verify chunk integrity shows "✓ Verified"

**Expected Result**: Content chunks automatically appear in cache

## Detailed Configuration

### Multi-Band Monitoring Setup
```
Profile 1: "Emergency Monitoring"
- Band: 40m (7.035-7.045 MHz)
- Purpose: Emergency
- Priority: 10 (highest)
- Decoding: Enabled

Profile 2: "20m DX Discovery"
- Band: 20m (14.075-14.085 MHz)
- Purpose: Content Discovery
- Priority: 6
- Decoding: Enabled

Profile 3: "Regional Net"
- Band: 80m (3.575-3.585 MHz)
- Purpose: Mesh Coordination
- Priority: 4
- Decoding: Enabled
```

### Performance Optimization
1. **CPU Usage**: Monitor browser task manager during operation
2. **Memory**: Clear cache periodically to prevent memory bloat
3. **Bandwidth**: Adjust FFT size based on available processing power
4. **Display**: Reduce waterfall refresh rate if performance issues occur

### Advanced Features

#### Multiple SDR Devices
1. Connect second SDR device to different USB port
2. Use **"Add Device"** to detect second device
3. Assign different frequency ranges to each device
4. Monitor multiple bands simultaneously

#### Signal Quality Analysis
1. Enable **"Signal Quality Metrics"** in dashboard
2. Monitor SNR, RSSI, and symbol error rates
3. Use data to optimize antenna and location
4. Track propagation conditions over time

## Testing & Validation

### Functional Tests
1. **Device Connection**: Verify device appears in device list
2. **Frequency Tuning**: Change center frequency, verify waterfall updates
3. **Signal Detection**: Use signal generator or nearby transmission
4. **Content Decoding**: Verify HTTP-over-radio signals decode properly
5. **Cache Operation**: Confirm chunks cache and serve correctly

### Performance Tests
1. **CPU Usage**: Should stay below 50% on recommended hardware
2. **Memory Usage**: Should stabilize below 500MB after initial loading
3. **Decode Latency**: Should decode signals within 100ms
4. **Cache Hit Rate**: Should achieve >60% hit rate with active network

### Integration Tests
1. **Mesh Integration**: Verify cached content integrates with BitTorrent system
2. **CQ Beacon Updates**: Confirm discovered content appears in CQ announcements
3. **Emergency Override**: Test emergency priority switching
4. **Multi-Device**: Verify multiple SDR devices work simultaneously

## Troubleshooting

### Device Connection Issues
- **WebUSB Permission Denied**: Ensure HTTPS and user gesture
- **Device Not Detected**: Check USB drivers and device compatibility
- **Connection Drops**: Use USB 3.0 port, avoid USB hubs

### Performance Issues
- **High CPU Usage**: Reduce FFT size or monitoring bandwidth
- **Memory Leaks**: Restart browser periodically during development
- **Slow Decoding**: Check for conflicting browser extensions

### Signal Quality Issues
- **No Signals Detected**: Verify antenna connection and band activity
- **Poor SNR**: Check antenna positioning and RFI sources
- **Decode Failures**: Verify frequency accuracy and signal strength

## Configuration Examples

### Portable Operation (Battery Conscious)
```json
{
  "monitoring": {
    "refreshRate": 15,
    "historyDepth": 30,
    "fftSize": 1024,
    "priority": "battery_saving"
  },
  "caching": {
    "maxEntries": 100,
    "expirationTime": 1800
  }
}
```

### Base Station Operation (Performance Optimized)
```json
{
  "monitoring": {
    "refreshRate": 60,
    "historyDepth": 120,
    "fftSize": 4096,
    "priority": "performance"
  },
  "caching": {
    "maxEntries": 1000,
    "expirationTime": 3600
  }
}
```

## Next Steps

1. **Experiment** with different SDR devices and configurations
2. **Monitor** multiple bands to understand propagation patterns
3. **Analyze** cached content to optimize mesh network efficiency
4. **Contribute** to the project by reporting discovered optimization opportunities
5. **Integrate** with emergency communication protocols for disaster response

## Support

- **Documentation**: See `/docs/sdr-support/` for detailed technical documentation
- **Issues**: Report problems via project issue tracker
- **Community**: Join amateur radio mesh networking forums for best practices
- **Testing**: Participate in coordinated testing events for validation