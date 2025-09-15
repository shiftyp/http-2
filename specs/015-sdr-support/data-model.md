# SDR Support Data Model

## Core Entities

### SDRDevice
**Purpose**: Represents a connected Software-Defined Radio device
**Fields**:
- `id`: string (unique device identifier)
- `type`: SDRDeviceType (RTL_SDR | HACKRF | LIMESDR | PLUTOSDR | SDRPLAY)
- `vendorId`: number (USB vendor ID)
- `productId`: number (USB product ID)
- `serialNumber`: string (device serial number)
- `capabilities`: SDRCapabilities
- `connectionStatus`: ConnectionStatus (CONNECTED | DISCONNECTED | ERROR)
- `lastSeen`: Date (last successful communication)

**Validation Rules**:
- `id` must be unique across all devices
- `vendorId` and `productId` must match known SDR device combinations
- `serialNumber` required for multi-device support

### SDRCapabilities
**Purpose**: Device-specific capabilities and limitations
**Fields**:
- `minFrequency`: number (Hz, minimum tunable frequency)
- `maxFrequency`: number (Hz, maximum tunable frequency)
- `maxBandwidth`: number (Hz, maximum simultaneous bandwidth)
- `sampleRates`: number[] (supported sample rates in Hz)
- `gainRange`: { min: number, max: number } (gain control range)
- `hasFullDuplex`: boolean (transmit capability)
- `hasDiversityRx`: boolean (multiple receive channels)

### MonitoringConfiguration
**Purpose**: User-defined monitoring settings and frequency allocations
**Fields**:
- `id`: string (configuration profile ID)
- `name`: string (user-friendly profile name)
- `enabled`: boolean (active monitoring status)
- `frequencyRanges`: FrequencyRange[]
- `priority`: number (1-10, emergency override priority)
- `deviceAssignment`: string (assigned SDR device ID)
- `bandwidthAllocation`: number (Hz, allocated bandwidth)
- `createdAt`: Date
- `updatedAt`: Date

**Validation Rules**:
- `frequencyRanges` must not overlap within same device
- `bandwidthAllocation` cannot exceed device `maxBandwidth`
- `priority` 1-3 reserved for emergency frequencies

### FrequencyRange
**Purpose**: Specific frequency band configuration for monitoring
**Fields**:
- `centerFrequency`: number (Hz, center frequency)
- `bandwidth`: number (Hz, monitoring bandwidth)
- `band`: AmateurRadioBand (40M | 20M | 80M | 15M | 30M)
- `purpose`: MonitoringPurpose (CONTENT_DISCOVERY | EMERGENCY | MESH_COORDINATION)
- `decodingEnabled`: boolean (automatic content decoding)
- `priority`: number (processing priority within device)

**State Transitions**:
- Frequency can be dynamically adjusted based on propagation
- Priority can be elevated during emergency conditions

### SpectrumData
**Purpose**: Real-time spectrum analysis data
**Fields**:
- `deviceId`: string (source SDR device)
- `centerFrequency`: number (Hz)
- `bandwidth`: number (Hz)
- `timestamp`: Date
- `fftData`: Float32Array (frequency domain data)
- `signalPeaks`: SignalPeak[] (detected signal peaks)
- `noiseFloor`: number (dB, calculated noise floor)
- `averagePower`: number (dB)

**Validation Rules**:
- `fftData` length must match configured FFT size
- `timestamp` must be within last 5 seconds for real-time data

### SignalPeak
**Purpose**: Detected signal in spectrum data
**Fields**:
- `frequency`: number (Hz, peak frequency)
- `power`: number (dB, signal power)
- `bandwidth`: number (Hz, estimated signal bandwidth)
- `snr`: number (dB, signal-to-noise ratio)
- `confidence`: number (0-1, detection confidence)
- `signalType`: SignalType (QPSK | CW | FM | UNKNOWN)

### DecodedTransmission
**Purpose**: Successfully decoded HTTP-over-radio transmission
**Fields**:
- `id`: string (unique transmission ID)
- `sourceCallsign`: string (transmitting station)
- `frequency`: number (Hz, received frequency)
- `timestamp`: Date (decode timestamp)
- `signalQuality`: SignalQuality
- `contentType`: ContentType (CHUNK | CQ_BEACON | ROUTE_UPDATE)
- `payload`: Uint8Array (decoded data)
- `verified`: boolean (cryptographic verification status)
- `cached`: boolean (stored in auto-discovery cache)

**Validation Rules**:
- `sourceCallsign` must match FCC amateur radio format
- `payload` must pass integrity verification before `verified = true`
- `contentType` determines processing pipeline

### SignalQuality
**Purpose**: Signal quality metrics for decoded transmissions
**Fields**:
- `snr`: number (dB, signal-to-noise ratio)
- `rssi`: number (dB, received signal strength)
- `frequency`: number (Hz, actual received frequency)
- `frequencyOffset`: number (Hz, offset from expected)
- `symbolErrorRate`: number (0-1, symbol error rate)
- `phaseJitter`: number (degrees, phase stability)

### AutoDiscoveryCache
**Purpose**: Cached content chunks discovered via SDR monitoring
**Fields**:
- `chunkId`: string (content chunk identifier)
- `contentHash`: string (SHA-256 hash)
- `sourceCallsign`: string (original transmitter)
- `discoveredAt`: Date (cache timestamp)
- `lastAccessed`: Date (last access for LRU)
- `accessCount`: number (popularity metric)
- `data`: Uint8Array (chunk data)
- `expiresAt`: Date (cache expiration)
- `signalQuality`: SignalQuality (reception quality)

**Validation Rules**:
- `contentHash` must match actual data hash
- `expiresAt` default to 1 hour after `discoveredAt`
- Cache size limited by available storage quota

### WaterfallDisplay
**Purpose**: Visual spectrum display configuration and data
**Fields**:
- `deviceId`: string (source SDR device)
- `centerFrequency`: number (Hz, display center)
- `spanFrequency`: number (Hz, display width)
- `colormap`: string (display color scheme)
- `intensityRange`: { min: number, max: number } (dB range)
- `refreshRate`: number (Hz, display update rate)
- `historyDepth`: number (seconds, time depth)
- `enabled`: boolean (display active status)

## Entity Relationships

### SDR Device Management
- One `SDRDevice` has one `SDRCapabilities`
- One `SDRDevice` can have multiple `MonitoringConfiguration`
- One `MonitoringConfiguration` has multiple `FrequencyRange`

### Spectrum Monitoring
- One `SDRDevice` generates multiple `SpectrumData` records
- One `SpectrumData` contains multiple `SignalPeak`
- One `SignalPeak` may result in one `DecodedTransmission`

### Content Discovery
- One `DecodedTransmission` may create one `AutoDiscoveryCache` entry
- One `AutoDiscoveryCache` entry references one `SignalQuality`
- Multiple `AutoDiscoveryCache` entries can have same `sourceCallsign`

### Visualization
- One `SDRDevice` can have multiple `WaterfallDisplay` configurations
- One `WaterfallDisplay` consumes multiple `SpectrumData` records

## Enumerations

### SDRDeviceType
- `RTL_SDR`: RTL2832U-based dongles (2.4 MHz bandwidth)
- `HACKRF`: HackRF One (20 MHz bandwidth)
- `LIMESDR`: LimeSDR devices (61.44 MHz bandwidth)
- `PLUTOSDR`: Adalm Pluto (56 MHz bandwidth)
- `SDRPLAY`: RSP series (8 MHz bandwidth)

### ConnectionStatus
- `CONNECTED`: Device active and responding
- `DISCONNECTED`: Device not available
- `ERROR`: Device error state requiring reset

### AmateurRadioBand
- `40M`: 7.035-7.045 MHz range
- `20M`: 14.075-14.085 MHz range
- `80M`: 3.575-3.585 MHz range
- `15M`: 21.075-21.085 MHz range
- `30M`: 10.140-10.150 MHz range

### MonitoringPurpose
- `CONTENT_DISCOVERY`: Automatic chunk caching
- `EMERGENCY`: High-priority emergency monitoring
- `MESH_COORDINATION`: Network coordination traffic

### SignalType
- `QPSK`: HTTP-over-radio QPSK signals
- `CW`: Morse code transmissions
- `FM`: Frequency modulation
- `UNKNOWN`: Unidentified signal type

### ContentType
- `CHUNK`: Content chunk data
- `CQ_BEACON`: CQ beacon with routing information
- `ROUTE_UPDATE`: Mesh routing update