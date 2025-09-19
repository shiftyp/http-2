# Quickstart: Automatic Shutdown

## Overview
Quick setup and testing guide for FCC Part 97.213 compliant automatic shutdown system. This demonstrates remote control, control operator monitoring, and fail-safe shutdown mechanisms.

## Prerequisites
- Authenticated amateur radio operator with control operator privileges
- Hardware fail-safe device connected via serial port
- Existing FCC compliance system operational
- Station configuration for automatic operation

## 5-Minute Demo Scenarios

### Scenario 1: Remote Control Operator Session
**Goal**: Establish authenticated control operator session for automatic station operation

```typescript
// 1. Authenticate as control operator
const authResponse = await fetch('/remote-control/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    callsign: 'W1AW',
    signature: await signChallenge(challenge, privateKey),
    timestamp: Date.now(),
    challenge: challenge
  })
});

const { sessionToken } = await authResponse.json();

// 2. Start control operator monitoring session
const sessionResponse = await fetch('/automatic-station/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    operatorCallsign: 'W1AW',
    operatorCredentials: {
      publicKey: operatorPublicKey,
      signature: operatorSignature
    },
    sessionDuration: 3600 // 1 hour
  })
});

// 3. Enable automatic operation mode
const modeResponse = await fetch('/automatic-station/operation-mode', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    requestedMode: 'automatic',
    operatorSignature: await signMessage('enable_automatic', privateKey),
    reason: 'Normal automatic operation'
  })
});

console.log('Automatic station operation enabled with control operator monitoring');
```

### Scenario 2: Emergency Shutdown Command
**Goal**: Demonstrate immediate emergency shutdown capability

```typescript
// 1. Trigger emergency shutdown
const shutdownResponse = await fetch('/fail-safe/emergency-shutdown', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    shutdownReason: 'equipment_fault',
    emergencyOverride: true,
    operatorSignature: await signMessage('emergency_shutdown', privateKey),
    timestamp: Date.now(),
    additionalInfo: 'High SWR detected, immediate shutdown required'
  })
});

const shutdownData = await shutdownResponse.json();
console.log(`Emergency shutdown initiated: ${shutdownData.shutdownId}`);
console.log(`Estimated completion: ${shutdownData.estimatedCompletion}s`);

// 2. Monitor shutdown progress
const statusResponse = await fetch('/remote-control/status', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
});

const status = await statusResponse.json();
console.log(`System state: ${status.systemState}`);
console.log(`Transmission active: ${status.transmissionActive}`);
```

### Scenario 3: Control Operator Acknowledgment
**Goal**: Demonstrate periodic operator acknowledgment requirement

```typescript
// 1. Check acknowledgment requirements
const sessionStatus = await fetch('/automatic-station/session', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
});

const session = await sessionStatus.json();
console.log(`Next acknowledgment due: ${new Date(session.nextAcknowledgmentDue)}`);

// 2. Provide operator acknowledgment
const ackResponse = await fetch('/automatic-station/acknowledge', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    operatorPresent: true,
    stationStatus: 'normal',
    timestamp: Date.now(),
    signature: await signMessage('operator_acknowledgment', privateKey),
    notes: 'All systems operating normally, monitoring active'
  })
});

const acknowledgment = await ackResponse.json();
console.log(`Acknowledgment recorded: ${acknowledgment.acknowledgmentId}`);
console.log(`Session extended: ${acknowledgment.sessionExtended}`);
```

### Scenario 4: Equipment Monitoring and Fail-Safe
**Goal**: Test equipment monitoring and automatic fail-safe mechanisms

```typescript
// 1. Check equipment monitoring status
const equipmentResponse = await fetch('/fail-safe/equipment-monitor', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
});

const equipment = await equipmentResponse.json();
console.log('Equipment Status:');
console.log(`  RF Power: ${equipment.parameters.rfPower.current}W (threshold: ${equipment.parameters.rfPower.threshold}W)`);
console.log(`  SWR: ${equipment.parameters.swr.current} (threshold: ${equipment.parameters.swr.threshold})`);
console.log(`  Temperature: ${equipment.parameters.temperature.current}°C`);

// 2. Configure monitoring thresholds
const configResponse = await fetch('/fail-safe/equipment-monitor', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    monitoringEnabled: true,
    updateInterval: 5, // 5 seconds
    thresholds: {
      rfPowerMax: 100,
      swrMax: 3.0,
      temperatureMax: 80,
      frequencyTolerance: 0.001
    },
    alertSettings: {
      warningEnabled: true,
      criticalEnabled: true,
      shutdownOnCritical: true
    }
  })
});

// 3. Test hardware watchdog heartbeat
const heartbeatResponse = await fetch('/fail-safe/hardware-watchdog', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    timestamp: Date.now(),
    systemHealth: 'healthy',
    operatorPresent: true,
    transmissionActive: false
  })
});

console.log('Hardware watchdog heartbeat sent');
```

### Scenario 5: Emergency Communication Override
**Goal**: Test emergency communication exception to automatic shutdown

```typescript
// 1. Activate emergency override for emergency traffic
const overrideResponse = await fetch('/fail-safe/emergency-override', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    emergencyCallsign: 'W1AW',
    overrideReason: 'Emergency health and welfare traffic for hurricane response',
    overrideType: 'emergency_traffic',
    maxDuration: 1800, // 30 minutes
    operatorSignature: await signMessage('emergency_override', privateKey)
  })
});

const override = await overrideResponse.json();
console.log(`Emergency override activated: ${override.overrideId}`);
console.log(`Active until: ${new Date(override.expiresAt)}`);

// 2. Check override status
const overrideStatus = await fetch('/fail-safe/emergency-override', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
});

const status = await overrideStatus.json();
console.log(`Override active: ${status.overrideActive}`);
console.log(`Time remaining: ${status.timeRemaining}s`);

// 3. Deactivate override when emergency ends
const deactivateResponse = await fetch('/fail-safe/emergency-override', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`
  },
  body: JSON.stringify({
    operatorSignature: await signMessage('deactivate_override', privateKey),
    reason: 'Emergency traffic concluded, normal operations resuming'
  })
});

console.log('Emergency override deactivated');
```

## Complete Integration Test

### Full Automatic Station Lifecycle
```typescript
async function testAutomaticStationLifecycle() {
  console.log('=== Automatic Station Lifecycle Test ===');

  // 1. Operator Authentication
  console.log('1. Authenticating control operator...');
  const sessionToken = await authenticateOperator('W1AW');

  // 2. Start Monitoring Session
  console.log('2. Starting control operator session...');
  await startControlSession(sessionToken, 3600);

  // 3. Enable Automatic Operation
  console.log('3. Enabling automatic operation...');
  await setOperationMode(sessionToken, 'automatic');

  // 4. Configure Equipment Monitoring
  console.log('4. Configuring equipment monitoring...');
  await configureEquipmentMonitoring(sessionToken);

  // 5. Test Periodic Acknowledgment
  console.log('5. Testing operator acknowledgment...');
  await provideOperatorAcknowledgment(sessionToken);

  // 6. Simulate Equipment Fault
  console.log('6. Simulating equipment fault...');
  await simulateEquipmentFault();

  // 7. Test Emergency Override
  console.log('7. Testing emergency override...');
  await testEmergencyOverride(sessionToken);

  // 8. Test Emergency Shutdown
  console.log('8. Testing emergency shutdown...');
  await triggerEmergencyShutdown(sessionToken);

  // 9. Verify System State
  console.log('9. Verifying final system state...');
  const finalStatus = await getSystemStatus(sessionToken);
  console.log(`Final state: ${finalStatus.systemState}`);

  console.log('=== Test Complete ===');
}

// Run the complete test
testAutomaticStationLifecycle().then(() => {
  console.log('All automatic shutdown features verified successfully!');
}).catch(error => {
  console.error('Test failed:', error);
});
```

## Hardware Setup Requirements

### Fail-Safe Hardware Device
```typescript
// Example Arduino-based fail-safe controller
const failSafeConfig = {
  serialPort: '/dev/ttyUSB0',
  baudRate: 9600,
  heartbeatInterval: 30000, // 30 seconds
  timeoutThreshold: 60000,  // 60 seconds
  relayPin: 7,              // Digital pin controlling RF relay
  statusLED: 13             // Status indicator LED
};

// Initialize hardware watchdog connection
const hardwareWatchdog = new HardwareWatchdog(failSafeConfig);
await hardwareWatchdog.connect();
```

### Station Integration Points
```typescript
// Integration with existing compliance system
const automaticStationConfig = {
  complianceManager: existingComplianceManager,
  stationIdTimer: existingStationIdTimer,
  transmissionMode: existingTransmissionMode,
  meshNetworking: existingMeshNetworking,

  // New automatic station components
  remoteControl: new RemoteControlManager(),
  automaticStation: new AutomaticStationController(),
  failSafeShutdown: new FailSafeShutdown(hardwareWatchdog),
  controlOperator: new ControlOperatorManager()
};
```

## Validation Checklist

### FCC Part 97.213 Compliance
- [ ] Control operator can immediately shut down station remotely
- [ ] Automatic operation requires active control operator monitoring
- [ ] Station automatically shuts down when control operator monitoring lapses
- [ ] Hardware fail-safe mechanisms independent of software
- [ ] All automatic operations logged for FCC audit
- [ ] Emergency communication can override automatic shutdown
- [ ] Third-party traffic requires control operator oversight in automatic mode

### Performance Verification
- [ ] Emergency shutdown completes within 3 seconds
- [ ] Control operator status updates within 1 second
- [ ] Command authentication completes within 100ms
- [ ] Hardware watchdog heartbeat every 30 seconds
- [ ] Session timeout properly enforced
- [ ] Equipment monitoring detects fault conditions

### Integration Testing
- [ ] Coordinates with existing FCC compliance system
- [ ] Integrates with station identification requirements
- [ ] Respects transmission mode (RF vs WebRTC) operation
- [ ] Maintains audit trail in compliance logs
- [ ] Emergency override properly logged and tracked

This quickstart demonstrates all critical automatic shutdown functionality required for FCC Part 97.213 compliance while ensuring seamless integration with the existing amateur radio system.