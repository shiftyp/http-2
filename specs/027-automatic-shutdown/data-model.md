# Data Model: Automatic Shutdown

## Overview
Data entities required for FCC Part 97.213 compliant automatic station operation, including remote control, operator monitoring, and fail-safe shutdown mechanisms.

## Core Entities

### RemoteControlManager
**Purpose**: Handles authenticated remote control commands and multi-channel communication

**Key Attributes**:
- `controlChannels`: Array of active control channels (WebSocket, RF, DTMF)
- `authenticatedCommands`: Queue of validated commands awaiting execution
- `commandHistory`: Audit trail of all remote control actions
- `activeOperators`: List of currently authenticated control operators

**Relationships**:
- **Manages** → ControlOperatorSession (1:many)
- **Processes** → ShutdownEvent (1:many)
- **Integrates** → ComplianceManager (from existing FCC compliance system)

**State Transitions**:
- Idle → Authenticating → Authorized → Executing → Complete
- Emergency state bypasses authentication for immediate shutdown

### AutomaticStationController
**Purpose**: Manages automatic operation modes and control operator monitoring requirements

**Key Attributes**:
- `operationMode`: Current mode (manual, automatic, emergency)
- `controlOperatorRequired`: Boolean indicating if operator oversight needed
- `lastOperatorAcknowledgment`: Timestamp of most recent operator check-in
- `acknowledgedOperator`: Callsign of operator providing oversight
- `automaticOperationTimeout`: Maximum time for unattended operation

**Relationships**:
- **Requires** → ControlOperatorSession (1:1)
- **Triggers** → FailSafeShutdown (1:1)
- **Logs** → ShutdownEvent (1:many)

**State Transitions**:
- Manual → Automatic (requires operator authentication)
- Automatic → Emergency (triggered by fault conditions)
- Any → Shutdown (operator command or timeout)

### FailSafeShutdown
**Purpose**: Implements emergency shutdown mechanisms and equipment monitoring

**Key Attributes**:
- `hardwareWatchdog`: Serial connection status for hardware fail-safe
- `monitoredParameters`: Equipment parameters being tracked
- `shutdownThresholds`: Configurable limits for automatic shutdown
- `emergencyOverrideActive`: Boolean for emergency communication exception
- `lastHeartbeat`: Timestamp of last hardware watchdog communication

**Relationships**:
- **Monitors** → EquipmentMonitor (1:1)
- **Controls** → EmergencyOverride (1:1)
- **Creates** → ShutdownEvent (1:many)

**State Transitions**:
- Armed → Monitoring → Triggered → Executing → Complete
- Emergency override can pause transition from Triggered to Executing

### ControlOperatorSession
**Purpose**: Tracks control operator presence, authentication, and monitoring status

**Key Attributes**:
- `operatorCallsign`: Amateur radio callsign of control operator
- `sessionToken`: Cryptographic token for session authentication
- `sessionStart`: Timestamp when operator session began
- `lastActivity`: Timestamp of most recent operator interaction
- `acknowledgmentRequired`: Boolean indicating if operator check-in needed
- `sessionTimeout`: Maximum session duration without activity

**Relationships**:
- **Authenticates** → RemoteControlManager (1:1)
- **Monitors** → AutomaticStationController (1:1)
- **Logs** → ShutdownEvent (1:many)

**State Transitions**:
- Unauthenticated → Authenticating → Active → Warning → Expired
- Active sessions require periodic renewal to prevent timeout

### ShutdownEvent
**Purpose**: Logs all shutdown events with cause, timestamp, and operator information

**Key Attributes**:
- `eventId`: Unique identifier for the shutdown event
- `timestamp`: When the shutdown event occurred
- `shutdownCause`: Reason for shutdown (operator command, timeout, fault, etc.)
- `initiatingOperator`: Callsign of operator who initiated shutdown (if applicable)
- `systemState`: Complete system status at time of shutdown
- `emergencyOverride`: Boolean indicating if emergency override was active

**Relationships**:
- **Created by** → RemoteControlManager, AutomaticStationController, FailSafeShutdown (many:1)
- **References** → ControlOperatorSession (many:1)

**State Transitions**:
- Created → Logged → Archived (immutable audit trail)

### EquipmentMonitor
**Purpose**: Monitors station equipment status and operating parameters

**Key Attributes**:
- `monitoredParameters`: Map of parameter names to current values
- `thresholdSettings`: Configurable limits for each monitored parameter
- `lastUpdate`: Timestamp of most recent parameter reading
- `faultConditions`: Array of currently detected fault conditions
- `monitoringEnabled`: Boolean control for parameter monitoring

**Relationships**:
- **Monitored by** → FailSafeShutdown (1:1)
- **Triggers** → ShutdownEvent (1:many)

**State Transitions**:
- Normal → Warning → Fault → Shutdown
- Parameters can transition independently with aggregate fault detection

### EmergencyOverride
**Purpose**: Manages emergency communication exceptions to automatic shutdown

**Key Attributes**:
- `overrideActive`: Boolean indicating if emergency override is engaged
- `emergencyCallsign`: Callsign of station handling emergency traffic
- `overrideReason`: Description of emergency situation
- `overrideStartTime`: When emergency override was activated
- `maxOverrideDuration`: Maximum time emergency override can remain active

**Relationships**:
- **Controlled by** → FailSafeShutdown (1:1)
- **Logs** → ShutdownEvent (1:many)
- **Integrates** → ComplianceManager (for emergency logging)

**State Transitions**:
- Inactive → Activating → Active → Deactivating → Inactive
- Override can be manually deactivated or timeout automatically

## Data Flow Architecture

### Command Processing Flow
```
RemoteControlManager receives command
    ↓
Authenticates via ControlOperatorSession
    ↓
Validates against current AutomaticStationController state
    ↓
Executes command or triggers FailSafeShutdown
    ↓
Logs action via ShutdownEvent
```

### Monitoring Flow
```
EquipmentMonitor reads parameters
    ↓
FailSafeShutdown evaluates thresholds
    ↓
AutomaticStationController checks operator session
    ↓
Triggers shutdown if conditions met
    ↓
EmergencyOverride can pause shutdown for emergency traffic
```

### Session Management Flow
```
ControlOperatorSession authenticates operator
    ↓
AutomaticStationController enables automatic operation
    ↓
Periodic acknowledgment required from operator
    ↓
Session timeout triggers automatic shutdown
```

## Integration Points

### FCC Compliance System
- **ComplianceManager**: Coordinates with automatic station requirements
- **StationIDTimer**: Includes control operator identification
- **ComplianceLog**: All automatic station events logged for audit

### Transmission System
- **TransmissionMode**: Automatic station aware of RF vs WebRTC operation
- **MeshNetworking**: Control operator oversight for automatic relay decisions

## Validation Rules

### Control Operator Requirements
- Active ControlOperatorSession required for automatic operation
- Session must be renewed within timeout period
- Acknowledgment required at configurable intervals
- Only licensed amateur radio operators can establish sessions

### Shutdown Event Logging
- All shutdown events must be immutably logged
- Events must include complete system state snapshot
- Emergency overrides require enhanced logging detail
- Audit trail must be exportable for FCC inspection

### Fail-Safe Operation
- Hardware watchdog must receive heartbeat within timeout
- Any monitored parameter exceeding threshold triggers evaluation
- Emergency override requires manual activation and has maximum duration
- System fails safe (shutdown) if any component becomes unavailable

## Performance Requirements

### Real-Time Constraints
- Emergency shutdown: Complete within 3 seconds
- Status updates: Refresh within 1 second
- Command authentication: Process within 100ms
- Session monitoring: Check every 30 seconds

### Data Persistence
- All entities persisted in IndexedDB for offline operation
- Critical events (shutdowns) immediately persisted
- Session data survives browser restart
- Configuration settings maintained across sessions

## Security Considerations

### Authentication
- ECDSA signatures for all remote commands
- Time-limited session tokens with renewal
- Multi-factor authentication for initial operator login
- Command replay protection via nonce validation

### Authorization
- Only authenticated control operators can initiate automatic operation
- Emergency override requires elevated privileges
- All privileged actions logged with operator identification
- Session isolation prevents cross-contamination

This data model ensures comprehensive FCC Part 97.213 compliance while providing the flexibility needed for various automatic station operation scenarios.