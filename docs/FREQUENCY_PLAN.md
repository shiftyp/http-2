# Frequency Plan for HTTP-over-Radio

## Table of Contents

1. [Overview](#overview)
2. [Band Allocations](#band-allocations)
3. [Mode Specifications](#mode-specifications)
4. [Channel Plans](#channel-plans)
5. [Regulatory Compliance](#regulatory-compliance)
6. [Operating Procedures](#operating-procedures)
7. [International Band Plans](#international-band-plans)
8. [Emergency Communications](#emergency-communications)

## Overview

HTTP-over-Radio operates on amateur radio frequencies using advanced digital modes optimized for web content transmission. Following the 2024 FCC rule changes that removed symbol rate restrictions, the protocol can achieve data rates up to 11.2 kbps within the 2.8 kHz bandwidth limit.

### Key Features
- **Adaptive Modulation**: Automatic selection between QPSK and 16-QAM
- **Bandwidth Efficient**: Maximum 2.8 kHz on HF, scalable for VHF/UHF
- **FCC Compliant**: Full compliance with Part 97 regulations
- **Global Compatible**: Designed for international operation

## Band Allocations

### HF Bands (3-30 MHz)

#### 80 Meters (3.5-4.0 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 3.575 MHz | HTTP-750 | 750 bps | 500 Hz | QRP/Weak Signal |
| 3.580 MHz | HTTP-1000 | 1 kbps | 750 Hz | Standard |
| 3.585 MHz | HTTP-2000 | 2 kbps | 1.5 kHz | Regional |
| 3.590 MHz | HTTP-4800 | 4.8 kbps | 2.8 kHz | High Speed |
| 3.595 MHz | HTTP-5600 | 5.6 kbps | 2.8 kHz | Maximum QPSK |

**Propagation**: Best at night, NVIS during day, 500-2000 mile range

#### 40 Meters (7.0-7.3 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 7.071 MHz | HTTP-750 | 750 bps | 500 Hz | DX Window |
| 7.073 MHz | HTTP-1000 | 1 kbps | 750 Hz | Standard |
| 7.076 MHz | HTTP-2000 | 2 kbps | 1.5 kHz | Regional |
| 7.080 MHz | HTTP-4800 | 4.8 kbps | 2.8 kHz | High Speed |
| 7.085 MHz | HTTP-8400 | 8.4 kbps | 2.8 kHz | 16-QAM |
| 7.090 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Maximum |

**Propagation**: 24-hour band, 1000-3000 mile range typical

#### 20 Meters (14.0-14.35 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 14.071 MHz | HTTP-750 | 750 bps | 500 Hz | DX Window |
| 14.073 MHz | HTTP-1000 | 1 kbps | 750 Hz | Standard |
| 14.076 MHz | HTTP-2000 | 2 kbps | 1.5 kHz | Regional |
| 14.078 MHz | HTTP-4800 | 4.8 kbps | 2.8 kHz | High Speed |
| 14.082 MHz | HTTP-8400 | 8.4 kbps | 2.8 kHz | 16-QAM |
| 14.085 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Maximum |
| 14.090 MHz | MESH | Variable | 2.8 kHz | Mesh Network |

**Propagation**: Daylight band, worldwide coverage possible

#### 17 Meters (18.068-18.168 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 18.103 MHz | HTTP-2000 | 2 kbps | 1.5 kHz | Standard |
| 18.106 MHz | HTTP-4800 | 4.8 kbps | 2.8 kHz | High Speed |

**Propagation**: Daylight band, low noise, good for DX

#### 15 Meters (21.0-21.45 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 21.071 MHz | HTTP-2000 | 2 kbps | 1.5 kHz | Standard |
| 21.075 MHz | HTTP-4800 | 4.8 kbps | 2.8 kHz | High Speed |
| 21.080 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Maximum |

**Propagation**: Daylight band, excellent for DX during solar maximum

### VHF/UHF Bands

#### 6 Meters (50-54 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 50.295 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Primary |
| 50.620 MHz | MESH | Variable | 10 kHz | Mesh Network |

**Propagation**: Sporadic E, meteor scatter, occasional F2

#### 2 Meters (144-148 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 144.950 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Simplex |
| 145.550 MHz | MESH | Variable | 10 kHz | Mesh Primary |
| 145.560 MHz | MESH | Variable | 10 kHz | Mesh Alt 1 |
| 145.570 MHz | MESH | Variable | 10 kHz | Mesh Alt 2 |

**Propagation**: Line of sight, 50-100 mile typical

#### 70 Centimeters (420-450 MHz)

| Frequency | Mode | Data Rate | Bandwidth | Purpose |
|-----------|------|-----------|-----------|---------|
| 433.150 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Simplex |
| 433.550 MHz | MESH | Variable | 25 kHz | Mesh Primary |
| 446.000 MHz | HTTP-11200 | 11.2 kbps | 2.8 kHz | Alt Simplex |

**Propagation**: Line of sight, building penetration

## Mode Specifications

### QPSK Modes

#### HTTP-750 (Minimum Rate)
```
Modulation: QPSK
Symbol Rate: 375 baud
Bits/Symbol: 2
Data Rate: 750 bps
Bandwidth: 500 Hz
FEC: RS(223,255) + Interleaving
SNR Required: 3 dB
Range: Maximum
```

#### HTTP-1000 (QRP Standard)
```
Modulation: QPSK
Symbol Rate: 500 baud
Bits/Symbol: 2
Data Rate: 1000 bps
Bandwidth: 750 Hz
FEC: RS(223,255) + Interleaving
SNR Required: 4 dB
Range: Excellent
```

#### HTTP-2000 (Standard)
```
Modulation: QPSK
Symbol Rate: 1000 baud
Bits/Symbol: 2
Data Rate: 2000 bps
Bandwidth: 1.5 kHz
FEC: RS(223,255) + Interleaving
SNR Required: 5 dB
Range: Good
```

#### HTTP-4800 (High Speed)
```
Modulation: QPSK
Symbol Rate: 2400 baud
Bits/Symbol: 2
Data Rate: 4800 bps
Bandwidth: 2.8 kHz
FEC: RS(223,255) + Interleaving
SNR Required: 7 dB
Range: Regional
```

#### HTTP-5600 (Maximum QPSK)
```
Modulation: QPSK
Symbol Rate: 2800 baud
Bits/Symbol: 2
Data Rate: 5600 bps
Bandwidth: 2.8 kHz
FEC: RS(223,255) + Interleaving
SNR Required: 8 dB
Range: Local/Regional
```

### 16-QAM Modes

#### HTTP-8400 (Enhanced)
```
Modulation: 16-QAM
Symbol Rate: 2100 baud
Bits/Symbol: 4
Data Rate: 8400 bps
Bandwidth: 2.8 kHz
FEC: RS(223,255) + Interleaving
SNR Required: 12 dB
Range: Local
```

#### HTTP-11200 (Maximum)
```
Modulation: 16-QAM
Symbol Rate: 2800 baud
Bits/Symbol: 4
Data Rate: 11200 bps
Bandwidth: 2.8 kHz
FEC: RS(223,255) + Interleaving
SNR Required: 15 dB
Range: Local/LOS
```

## Channel Plans

### HF Channel Structure

```
┌──────────────────────────────────┐
│         Channel Layout            │
├──────────────────────────────────┤
│  Guard  │   Signal   │   Guard   │
│  200 Hz │  2.6 kHz   │   200 Hz  │
│         │            │           │
│         ← 2.8 kHz Total →        │
└──────────────────────────────────┘
```

### Channel Spacing Guidelines

| Band | Minimum Spacing | Recommended | Notes |
|------|----------------|-------------|--------|
| HF | 3 kHz | 5 kHz | Avoid overlap |
| 6m | 5 kHz | 10 kHz | FM compatible |
| 2m | 5 kHz | 12.5 kHz | Narrowband |
| 70cm | 12.5 kHz | 25 kHz | Wide spacing |

## Regulatory Compliance

### FCC Part 97 (United States)

#### Current Rules (2024)
- **Symbol Rate**: No limit (removed in 2024)
- **Bandwidth**: 2.8 kHz maximum below 29 MHz
- **Emissions**: J2D (data), J2E (image)
- **Power**: 1500W PEP maximum
- **ID**: Every 10 minutes, end of transmission

#### Prohibited Practices
- ❌ Encryption of message content
- ❌ Commercial use
- ❌ Broadcasting
- ❌ Music transmission
- ❌ Obscene/indecent language

#### Allowed Practices
- ✅ Authentication signatures
- ✅ Compression
- ✅ Error correction
- ✅ Third-party traffic (restrictions apply)
- ✅ Emergency communications

### Canadian Regulations (ISED)
- Similar to FCC with minor variations
- Symbol rate: No specific limit
- Bandwidth: 6 kHz below 28 MHz
- French language content allowed

### European (CEPT)
- Varies by country
- Generally 2.7 kHz bandwidth limit
- Check local regulations

## Operating Procedures

### Channel Access Protocol

1. **Listen Before Transmit (LBT)**
   - Monitor for 30 seconds minimum
   - Check ±5 kHz for QRM
   - Send "QRL?" if unsure

2. **Station Identification**
   ```
   Format: "DE [CALLSIGN] HTTP"
   Example: "DE KJ4ABC HTTP"
   Interval: Every 10 minutes
   ```

3. **Calling Procedure**
   ```
   CQ HTTP CQ HTTP CQ HTTP
   DE [CALLSIGN] [CALLSIGN]
   HTTP [MODE] [GRID] K
   ```

### Frequency Coordination

#### Net Operations
- **Monday**: 7.080 MHz @ 0100 UTC
- **Wednesday**: 14.078 MHz @ 1900 UTC
- **Saturday**: 3.590 MHz @ 0000 UTC

#### Mesh Network Beacons
- Beacon every 10 minutes
- Rotate through designated frequencies
- Include grid square and capabilities

## International Band Plans

### ITU Region 1 (Europe, Africa, Middle East)

| Band | Digital Segment | Notes |
|------|----------------|--------|
| 80m | 3.500-3.510, 3.580-3.600 MHz | Narrow segments |
| 40m | 7.040-7.060 MHz | Differs from Region 2 |
| 20m | 14.070-14.089 MHz | Similar to Region 2 |

### ITU Region 2 (Americas)

| Band | Digital Segment | Notes |
|------|----------------|--------|
| 80m | 3.570-3.600 MHz | Wide digital window |
| 40m | 7.025-7.125 MHz | Includes CW portion |
| 20m | 14.070-14.095 MHz | Standard allocation |

### ITU Region 3 (Asia, Pacific)

| Band | Digital Segment | Notes |
|------|----------------|--------|
| 80m | 3.500-3.510, 3.535-3.540 MHz | Limited space |
| 40m | 7.025-7.100 MHz | Varies by country |
| 20m | 14.070-14.112 MHz | Extended range |

## Emergency Communications

### Emergency Frequencies

| Band | Frequency | Mode | Purpose |
|------|-----------|------|---------|
| 80m | 3.965 MHz | HTTP-1000 | Regional Emergency |
| 40m | 7.265 MHz | HTTP-2000 | National Emergency |
| 20m | 14.265 MHz | HTTP-2000 | International |
| 2m | 146.550 MHz | HTTP-11200 | Local Emergency |

### Priority Handling

1. **Emergency Traffic**: Absolute priority
2. **Priority Traffic**: Health and welfare
3. **Routine Traffic**: Normal operations

### Emergency Protocols

```
Format: EMERGENCY EMERGENCY EMERGENCY
        DE [CALLSIGN]
        [LOCATION] [NATURE OF EMERGENCY]
        HTTP EMERGENCY TRAFFIC K
```

## Best Practices

### Power Management
- Start with 5-25W
- Increase only as needed
- Maximum 100W for most operations
- Legal limit: 1500W PEP

### Interference Mitigation
- Use directional antennas when possible
- Implement ALC (Automatic Level Control)
- Frequency agility for QRM avoidance
- Notch filters for strong local signals

### Band Selection Guide

| Condition | Recommended Band | Mode |
|-----------|-----------------|------|
| Local (<50 mi) | 2m/70cm | HTTP-11200 |
| Regional (50-500 mi) | 80m/40m | HTTP-2000 |
| National (500-2000 mi) | 40m/20m | HTTP-4800 |
| International (>2000 mi) | 20m/17m/15m | HTTP-1000 |
| Weak Signal | Any HF | HTTP-750 |

---

*Document Version: 1.0.0*  
*Last Updated: 2024*  
*Status: Production Ready*