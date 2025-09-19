# Quickstart: FCC Compliance Implementation

## Prerequisites
- Valid amateur radio license
- Browser with IndexedDB support
- Existing HTTP-over-radio system running

## Quick Demo: Automatic FCC Compliance

### 1. Initialize Compliance System
```javascript
// Initialize the FCC compliance manager
const compliance = new ComplianceManager({
  operatorCallsign: 'KA1ABC',
  licenseClass: 'GENERAL',
  emergencyMode: false
});

// Connect to transmission mode detection
await compliance.initialize();
console.log('FCC compliance system active');
```

### 2. Station Identification Demo
```javascript
// Start a transmission - compliance system automatically begins timing
const session = await radioTransmitter.startTransmission();
console.log('Transmission started - 10-minute ID timer active');

// Simulate 9 minutes of transmission
await new Promise(resolve => setTimeout(resolve, 9 * 60 * 1000));

// System automatically transmits station ID before 10-minute deadline
compliance.on('station-id-sent', (event) => {
  console.log(`Station ID transmitted: ${event.callsign} at ${event.timestamp}`);
});

// End transmission - system sends final station ID
await session.end();
// Output: "Station ID transmitted: KA1ABC at [timestamp]"
```

### 3. Encryption Blocking Demo
```javascript
// Switch to RF mode - encryption should be blocked
await transmissionMode.setMode('RF');

// Attempt to encrypt content - this will be blocked
try {
  const encrypted = await cryptoManager.encryptData('secret message', publicKey);
} catch (error) {
  console.log('✅ Encryption blocked:', error.message);
  // Output: "FCC VIOLATION: Content encryption forbidden on amateur radio"
}

// Digital signatures are still allowed
const signature = await cryptoManager.signData('public message', privateKey);
console.log('✅ Digital signature allowed:', signature);

// Switch to WebRTC - encryption now allowed
await transmissionMode.setMode('WEBRTC');
const encrypted = await cryptoManager.encryptData('secret message', publicKey);
console.log('✅ Encryption allowed in WebRTC mode');
```

### 4. Content Filtering Demo
```javascript
// Attempt to transmit music file - will be blocked
const musicFile = new File(['music data'], 'song.mp3', { type: 'audio/mpeg' });

try {
  await compliance.validateContent(musicFile);
} catch (error) {
  console.log('✅ Music file blocked:', error.message);
  // Output: "FCC VIOLATION: Music files prohibited on amateur radio"
}

// Text with business content - will be flagged
const businessText = "Buy our new radio for only $299! Great profit opportunity!";
const result = await compliance.filterText(businessText);
console.log('⚠️ Business content flagged:', result.warnings);
// Output: ["Commercial content detected: 'Buy', 'profit'"]

// Emergency mode allows most content
compliance.setEmergencyMode(true);
const emergencyResult = await compliance.filterText(businessText);
console.log('✅ Emergency override active:', emergencyResult.passed);
```

### 5. Callsign Validation Demo
```javascript
// Validate legitimate amateur callsign
const validation = await compliance.validateCallsign('W1AW');
console.log('✅ Valid callsign:', validation);
/* Output: {
  callsign: 'W1AW',
  valid: true,
  licenseClass: 'EXTRA',
  country: 'US',
  source: 'FCC'
} */

// Attempt to validate invalid callsign
const invalid = await compliance.validateCallsign('INVALID');
console.log('❌ Invalid callsign:', invalid.valid); // false

// Mesh network will reject relay from invalid callsign
try {
  await meshNetwork.relayMessage(message, { sourceCallsign: 'INVALID' });
} catch (error) {
  console.log('✅ Relay blocked:', error.message);
  // Output: "Invalid source callsign - relay refused"
}
```

## Complete Example: Compliant Transmission Session
```javascript
async function compliantTransmissionSession() {
  // 1. Initialize compliance for operator
  const compliance = new ComplianceManager({
    operatorCallsign: 'KA1ABC',
    licenseClass: 'GENERAL'
  });
  await compliance.initialize();

  // 2. Start transmission in RF mode
  await transmissionMode.setMode('RF');
  const session = await radioTransmitter.startSession();
  console.log('📡 RF transmission started - compliance active');

  // 3. Send compliant message
  const message = "CQ CQ CQ de KA1ABC - HTTP over radio test";

  // Content is automatically filtered
  const filtered = await compliance.filterContent(message);
  if (!filtered.passed) {
    console.log('⚠️ Content blocked:', filtered.reasons);
    return;
  }

  // Encryption is automatically blocked in RF mode
  await radioTransmitter.sendMessage(message); // Sent unencrypted
  console.log('✅ Message sent (unencrypted for FCC compliance)');

  // 4. Simulate long transmission - ID timer active
  console.log('📡 Continuing transmission...');

  // System will automatically send station ID before 10-minute deadline
  compliance.on('station-id-due', () => {
    console.log('⏰ Station ID due - transmitting automatically');
  });

  // 5. Relay third-party message with validation
  const relayMessage = {
    from: 'W1AW',
    content: 'Hello from ARRL Headquarters',
    timestamp: Date.now()
  };

  // Callsign is validated before relay
  const validation = await compliance.validateCallsign(relayMessage.from);
  if (validation.valid) {
    await radioTransmitter.relayMessage(relayMessage);
    console.log('✅ Third-party message relayed from valid callsign');
  }

  // 6. End transmission with final station ID
  await session.end();
  console.log('📡 Transmission ended - final station ID sent');

  // 7. Review compliance log
  const log = await compliance.getAuditLog();
  console.log(`📋 Compliance events: ${log.length}`);
  log.forEach(entry => {
    console.log(`${entry.timestamp}: ${entry.eventType} - ${entry.description}`);
  });
}
```

## Compliance Dashboard

### Real-time Monitoring
```javascript
// Display current compliance status
function showComplianceStatus() {
  const status = compliance.getStatus();

  console.log('📊 FCC Compliance Status:');
  console.log(`Operator: ${status.operatorCallsign}`);
  console.log(`Mode: ${status.transmissionMode}`);
  console.log(`Station ID due: ${new Date(status.stationIdTimer.nextDue)}`);
  console.log(`Encryption blocking: ${status.encryptionGuard.blocking}`);
  console.log(`Emergency mode: ${status.emergencyMode}`);
  console.log(`Total violations: ${status.violationCount}`);
}

// Monitor for compliance events
compliance.on('violation', (event) => {
  console.log('🚨 COMPLIANCE VIOLATION:', event);
  showComplianceStatus();
});

compliance.on('warning', (event) => {
  console.log('⚠️ Compliance warning:', event);
});
```

## Performance Expectations

### Station ID Timing
- **Accuracy**: ±100ms of 10-minute deadline
- **Automatic**: No operator intervention required
- **Methods**: Digital ID embedded in protocol

### Encryption Blocking
- **Response time**: <10ms to block crypto operations
- **Coverage**: All encrypt/decrypt functions blocked in RF mode
- **Signatures**: Always allowed (authentication ≠ encryption)

### Content Filtering
- **Scan time**: <50ms per message
- **Music detection**: 100% block rate for audio/* MIME types
- **Business content**: ~90% detection rate with keyword analysis

### Callsign Validation
- **Cache hit**: <5ms response time
- **Online lookup**: <100ms typical
- **Accuracy**: >99% with FCC ULS database

## Troubleshooting

### Station ID Not Working?
- Check operator callsign is set correctly
- Verify transmission mode detection is working
- Ensure audio output is connected for CW/phone ID

### Encryption Errors?
- Confirm current transmission mode
- Check if WebRTC mode is available for encrypted transfers
- Verify digital signatures still work (they should)

### Content Filter Too Strict?
- Adjust filter level: `compliance.setFilterLevel('MODERATE')`
- Enable emergency mode for urgent communications
- Review and override specific warnings

### Callsign Validation Failing?
- Update local database: `await compliance.updateCallsignDatabase()`
- Check internet connection for online validation
- Verify callsign format is correct

## Key Commands
- `compliance.getStatus()` - Current compliance state
- `compliance.getAuditLog()` - FCC inspection log
- `compliance.setEmergencyMode(true)` - Enable emergency override
- `compliance.validateCallsign(call)` - Check callsign validity
- `compliance.forceStationID()` - Manual station identification

## Emergency Procedures
```javascript
// Declare emergency - relaxes content filtering
await compliance.setEmergencyMode(true);
console.log('🚨 Emergency mode active - content filters relaxed');

// Emergency ID format
await compliance.setCallsign('EM1RGY'); // Emergency callsign
await compliance.forceStationID();

// Still blocks encryption (FCC requirement even in emergency)
// Still requires station identification
// Allows business/commercial content for coordination
```

## FCC Inspection Readiness
```javascript
// Generate compliance report for FCC inspection
const report = await compliance.generateFCCReport({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31')
});

console.log('📋 FCC Inspection Report:');
console.log(`Total transmissions: ${report.totalTransmissions}`);
console.log(`Station IDs sent: ${report.stationIDCount}`);
console.log(`Compliance violations: ${report.violationCount}`);
console.log(`Emergency activations: ${report.emergencyCount}`);

// Export log for official inspection
await compliance.exportAuditLog('/path/to/fcc-audit-log.json');
```