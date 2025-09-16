# Unlicensed Mode Quickstart Guide

Get started with the amateur radio HTTP system as an unlicensed user in 5 minutes, or upgrade to full licensed mode with certificate registration.

## Overview

The unlicensed mode enables users without amateur radio licenses to participate in the ham radio HTTP network via internet-only protocols while maintaining FCC compliance. Licensed users can transmit on radio frequencies and relay messages for unlicensed users.

### Operating Modes
- **Unlicensed Mode**: Internet-only communication (WebRTC/WebSocket), radio monitoring, no RF transmission
- **Licensed Mode**: Full radio transmission, internet communication, message relay capabilities
- **Monitor-Only**: Receive and decode all amateur radio traffic without transmission capability

## Prerequisites

- Node.js 18+ installed
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)
- Network connectivity for internet modes
- Optional: SDR device for radio monitoring (RTL-SDR, HackRF, LimeSDR, PlutoSDR, SDRplay)
- Optional: Amateur radio transceiver for licensed mode

## Quick Setup

### 1. Start the System

```bash
# Terminal 1: Start main application
npm run dev:https

# Terminal 2: Start signaling server for WebRTC mode
cd signaling-server
npm start

# Terminal 3: Run integration tests (optional)
npm run test:integration
```

### 2. Initialize as Unlicensed User

```javascript
import {
  UserModeManager,
  CertificateValidator,
  MonitorReceiver,
  RelayManager
} from './src/lib/unlicensed-mode/index.js';

// Start in unlicensed mode
const userMode = new UserModeManager({
  initialMode: 'unlicensed',
  persistAcrossSessions: true,
  enableRateLimiting: true,
  enableMonitoring: true
});

await userMode.initialize();
console.log('Operating in unlicensed mode with internet-only features');
```

### 3. Set Up Radio Monitoring (Optional)

```javascript
import { MonitorReceiver } from './src/lib/monitor-receiver/index.js';

// Configure SDR for monitoring
const monitor = new MonitorReceiver({
  deviceType: 'RTL-SDR', // or 'HackRF', 'LimeSDR', etc.
  bands: ['20m', '40m', '2m'], // Amateur radio bands to monitor
  decodingModes: ['QPSK', 'FT8', 'PSK31'],
  waterfallDisplay: true,
  autoDecoding: true
});

// Start monitoring all amateur radio traffic
await monitor.startMonitoring();
console.log('Monitoring amateur radio bands (receive-only)');
```

## Testing Scenarios

### Scenario 1: Unlicensed User Communication

Test internet-only communication capabilities for unlicensed users.

```javascript
// Test rate-limited internet communication
const testUnlicensedUser = async () => {
  // 1. Verify unlicensed mode restrictions
  const capabilities = await userMode.getCapabilities();
  assert.equal(capabilities.radioTransmission, false);
  assert.equal(capabilities.webrtcCommunication, true);

  // 2. Test WebRTC peer discovery
  const peers = await userMode.discoverInternetPeers();
  console.log(`Found ${peers.length} internet peers`);

  // 3. Test rate limiting
  for (let i = 0; i < 35; i++) {
    try {
      await userMode.sendMessage('test message');
    } catch (error) {
      console.log(`Rate limit triggered at request ${i + 1}`);
      break;
    }
  }

  // 4. Test message relay through licensed stations
  const relayPath = await userMode.createRelayPath({
    destination: 'licensed-user-123',
    pathType: 'internet'
  });
  await userMode.sendRelayMessage(relayPath.pathId, 'Hello via relay!');
};

await testUnlicensedUser();
```

### Scenario 2: Certificate Registration and Upgrade

Test the process of upgrading from unlicensed to licensed mode.

```javascript
// Test certificate-based upgrade to licensed mode
const testLicenseUpgrade = async () => {
  // 1. Start in unlicensed mode
  assert.equal(await userMode.getStatus(), 'unlicensed');

  // 2. Get upgrade information
  const upgradeInfo = await userMode.getUpgradePrompt();
  console.log('Licensing benefits:', upgradeInfo.benefits);

  // 3. Register certificate (mock for testing)
  const mockCertificate = generateMockCertificate('KA1ABC');
  const validationResult = await CertificateValidator.validate({
    callsign: 'KA1ABC',
    certificateData: mockCertificate
  });

  // 4. Switch to licensed mode
  if (validationResult.isValid) {
    await userMode.switchMode({
      targetMode: 'licensed',
      callsign: 'KA1ABC',
      certificateData: mockCertificate
    });

    // 5. Verify new capabilities
    const newCapabilities = await userMode.getCapabilities();
    assert.equal(newCapabilities.radioTransmission, true);
    assert.equal(newCapabilities.messageRelay, true);
  }
};

await testLicenseUpgrade();
```

### Scenario 3: Radio Monitoring and Decoding

Test radio monitoring capabilities for unlicensed users.

```javascript
// Test radio monitoring without transmission
const testRadioMonitoring = async () => {
  // 1. Configure monitoring for all amateur bands
  const monitorConfig = {
    bands: ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m', '70cm'],
    decodingModes: ['QPSK', 'FT8', 'FT4', 'PSK31', 'RTTY', 'CW'],
    receiveAllTraffic: true, // Per amateur radio open communication standards
    enableAlerts: false
  };

  await monitor.updateConfiguration(monitorConfig);

  // 2. Test signal detection and decoding
  const testSignal = generateTestQPSKSignal('CQ CQ DE KA1ABC');
  const decodedMessage = await monitor.decodeSignal(testSignal);
  assert.equal(decodedMessage.callsign, 'KA1ABC');
  assert.equal(decodedMessage.content, 'CQ CQ DE KA1ABC');

  // 3. Verify transmission blocking
  try {
    await monitor.transmitSignal('Test transmission');
    assert.fail('Should not allow transmission in unlicensed mode');
  } catch (error) {
    assert.equal(error.message, 'Radio transmission not available in unlicensed mode');
  }

  // 4. Test waterfall display
  const waterfallData = await monitor.getWaterfallData('20m');
  assert.isTrue(waterfallData.length > 0);
  console.log('Waterfall display data available');
};

await testRadioMonitoring();
```

### Scenario 4: Compliance Logging and Audit

Test compliance logging for regulatory requirements.

```javascript
// Test compliance logging and audit trails
const testComplianceLogging = async () => {
  // 1. Verify compliance logging is active
  const complianceLogger = userMode.getComplianceLogger();
  const initialLogCount = await complianceLogger.getLogCount();

  // 2. Perform various operations and verify logging
  await userMode.switchMode({ targetMode: 'unlicensed' }); // Mode switch
  await userMode.sendMessage('test message'); // Rate-limited operation
  await monitor.startMonitoring(); // Monitoring activity

  // 3. Check log entries were created
  const finalLogCount = await complianceLogger.getLogCount();
  assert.isTrue(finalLogCount > initialLogCount);

  // 4. Test log export for regulatory submission
  const exportData = await complianceLogger.exportLogs({
    format: 'adif',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    endDate: new Date(),
    anonymizeData: false
  });

  assert.isTrue(exportData.recordCount > 0);
  console.log(`Exported ${exportData.recordCount} compliance records`);
};

await testComplianceLogging();
```

## Verification Steps

### 1. Verify Unlicensed Mode Restrictions

```bash
# Check that radio transmission is disabled
curl -X POST http://localhost:3000/api/v1/transmission/rf \
  -H "Content-Type: application/json" \
  -d '{"frequency": 14230000, "message": "test"}'

# Expected: 403 Forbidden - Radio transmission not available in unlicensed mode
```

### 2. Verify Internet Communication Works

```bash
# Test WebRTC peer discovery
curl http://localhost:3000/api/v1/webrtc/peers

# Expected: 200 OK with list of available internet peers
```

### 3. Verify Rate Limiting

```bash
# Test rate limit enforcement (30 requests/minute for unlicensed users)
for i in {1..35}; do
  curl -X POST http://localhost:3000/api/v1/messages \
    -H "Content-Type: application/json" \
    -d '{"content": "test message '$i'", "protocol": "WebRTC"}'
  sleep 1
done

# Expected: First 30 succeed, then 429 Too Many Requests
```

### 4. Verify Certificate Validation

```bash
# Test certificate validation endpoint
curl -X POST http://localhost:3000/api/v1/certificates/validate \
  -H "Content-Type: application/json" \
  -d '{
    "callsign": "KA1ABC",
    "certificateData": "LS0tLS1CRUdJTi..."
  }'

# Expected: 200 OK with validation result
```

### 5. Verify Monitoring Configuration

```bash
# Test monitoring setup for unlicensed users
curl -X PUT http://localhost:3000/api/v1/monitoring/configuration \
  -H "Content-Type: application/json" \
  -d '{
    "isEnabled": true,
    "decodingModes": ["QPSK", "FT8"],
    "waterfallDisplay": true,
    "receiveAllTraffic": true
  }'

# Expected: 200 OK with updated configuration
```

### 6. Verify Compliance Logging

```bash
# Check compliance logs are being created
curl "http://localhost:3000/api/v1/compliance/logs?limit=10"

# Expected: 200 OK with recent compliance log entries

# Export compliance data
curl -X POST http://localhost:3000/api/v1/compliance/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "startDate": "2025-09-15T00:00:00Z",
    "endDate": "2025-09-16T23:59:59Z"
  }'

# Expected: 200 OK with exported compliance data
```

## Certificate Registration Process

### For Licensed Amateur Radio Operators

1. **Obtain Digital Certificate**
   ```bash
   # Register with certificate authority (placeholder process)
   curl -X POST https://hamcerts.example.com/register \
     -H "Content-Type: application/json" \
     -d '{
       "callsign": "YOUR_CALLSIGN",
       "licenseClass": "General",
       "email": "your@email.com"
     }'
   ```

2. **Upload Certificate to System**
   ```javascript
   const certificate = await loadCertificateFile('your-certificate.pem');
   const result = await userMode.registerCertificate({
     callsign: 'YOUR_CALLSIGN',
     certificateData: certificate,
     issuer: 'Ham Radio Certificate Authority'
   });

   if (result.success) {
     console.log('Certificate registered successfully');
   }
   ```

3. **Switch to Licensed Mode**
   ```javascript
   await userMode.switchMode({
     targetMode: 'licensed',
     callsign: 'YOUR_CALLSIGN',
     certificateData: certificate,
     persistAcrossSessions: true
   });
   ```

## Common Operations

### Check Current Mode and Capabilities
```javascript
const status = await userMode.getStatus();
const capabilities = await userMode.getCapabilities();

console.log(`Current mode: ${status}`);
console.log('Available features:', capabilities.features.map(f => f.feature));
```

### Start Radio Monitoring
```javascript
await monitor.startMonitoring();
const bands = await monitor.getMonitoredBands();
console.log('Monitoring bands:', bands);
```

### Send Message via Relay
```javascript
const relayPath = await relayManager.createPath({
  destination: 'target-user-id',
  pathType: 'internet'
});

const result = await relayManager.sendMessage({
  pathId: relayPath.pathId,
  content: 'Hello from unlicensed user!',
  contentType: 'text/plain'
});

console.log('Message sent via relay:', result.messageId);
```

### Export Compliance Logs
```javascript
const exportData = await complianceLogger.exportLogs({
  format: 'adif',
  startDate: new Date('2025-09-01'),
  endDate: new Date(),
  includeEventData: true
});

console.log(`Exported ${exportData.recordCount} compliance records`);
```

## Rate Limits for Unlicensed Users

- **API Requests**: 30/minute, 500/hour, 2000/day
- **Message Size**: 2KB maximum per message
- **Concurrent Connections**: 5 WebRTC peers maximum
- **Relay Sessions**: 3 active relay paths maximum

Licensed users have no rate limits due to certificate-based trust.

## Troubleshooting

### "Certificate validation failed"
1. Verify callsign format is correct (e.g., KA1ABC)
2. Check certificate is not expired or revoked
3. Ensure certificate authority is recognized
4. Try re-downloading certificate from issuer

### "Rate limit exceeded"
1. Wait for rate limit window to reset
2. Reduce message frequency
3. Consider upgrading to licensed mode
4. Check for automatic retry loops

### "SDR device not detected"
1. Verify device is connected via USB
2. Check device drivers are installed
3. Ensure browser has WebUSB permissions
4. Try different USB port or cable

### "WebRTC connection failed"
1. Check signaling server is running (`cd signaling-server && npm start`)
2. Verify network connectivity
3. Check firewall/NAT settings
4. Try different STUN/TURN servers

### "Monitoring not working"
1. Verify unlicensed mode is active
2. Check SDR device configuration
3. Ensure antenna is connected
4. Verify amateur radio bands are configured

## Next Steps

1. **Explore Monitoring**: Set up SDR device and monitor amateur radio traffic
2. **Join Mesh Network**: Connect to internet-based mesh nodes
3. **Content Creation**: Use visual page builder for internet-accessible content
4. **Get Licensed**: Consider obtaining amateur radio license for full features
5. **Compliance**: Regularly export compliance logs for record-keeping

## Educational Resources

### Amateur Radio Licensing
- [ARRL License Manual](https://www.arrl.org/licensing-education-training)
- [Ham Radio Prep](https://www.hamradioprep.com/)
- [Local VE Sessions](https://www.arrl.org/find-an-amateur-radio-license-exam-session)

### Technical Resources
- [FCC Part 97 Rules](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97)
- [Amateur Radio Bands](https://www.arrl.org/band-plan)
- [Digital Modes](https://www.arrl.org/digital-modes)

### Hardware Resources
- [SDR Getting Started](https://www.rtl-sdr.com/about-rtl-sdr/)
- [Antenna Basics](https://www.arrl.org/antenna-basics)
- [Equipment Reviews](https://www.arrl.org/product-review)

---

*For technical support, consult the [main documentation](../../README.md) or join the amateur radio community forums.*