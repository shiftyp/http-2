# Research: Unlicensed Mode Implementation

**Date**: 2025-09-16
**Status**: Complete
**Scope**: Implementation research for unlicensed mode in HTTP-over-radio application

## Executive Summary

This research examines five critical aspects for implementing unlicensed mode in the HTTP-over-radio Progressive Web Application: certificate-based callsign validation, WebRTC/WebSocket permission controls, rate limiting and DDoS protection, message relay architectures with trust models, and amateur radio monitoring regulations. The findings provide clear implementation decisions and rationales based on current best practices and regulatory requirements.

---

## 1. Certificate-Based Callsign Validation Approaches

### Decision: ARRL LoTW-Compatible PKI System with Local Validation

**Rationale**: The Amateur Radio Relay League's Logbook of the World (LoTW) system provides the most established and widely-accepted PKI infrastructure for amateur radio callsign validation.

### Key Findings

#### Current Standard: ARRL LoTW System
- **Technology**: X.509-based digital certificates with ECDSA signatures
- **Authentication Process**: Physical address verification via postcard (US) or license documentation (international)
- **Certificate Lifecycle**: 1-year validity with 90-day renewal window
- **Security**: TQSL (Trusted QSL) software handles certificate management and signing

#### Implementation Pattern for PWA

```typescript
interface CallsignCertificate {
  callsign: string;
  publicKeyPem: string;
  issuer: 'ARRL' | 'Local' | 'Self-Signed';
  validFrom: Date;
  validUntil: Date;
  certificateHash: string;
  trusted: boolean;
}

interface ValidationResult {
  valid: boolean;
  licensed: boolean;
  trustLevel: 'high' | 'medium' | 'low' | 'untrusted';
  reason?: string;
}
```

#### Browser API Constraints
- **Web Crypto API**: Supports X.509 certificate verification natively
- **IndexedDB Storage**: Can securely store certificate chain and trust database
- **No Direct File Access**: Must use FileReader API for certificate imports
- **CORS Limitations**: External certificate validation requires proxy or local cache

#### Best Practices
1. **Hierarchical Trust Model**: ARRL certificates = high trust, self-signed = low trust
2. **Local Certificate Cache**: Store trusted certificates locally to reduce network dependency
3. **Graceful Degradation**: Allow operation with reduced features for unverified callsigns
4. **Certificate Pinning**: Cache known-good certificates to prevent MITM attacks

#### Alternatives Considered
- **QRZ.com API**: Rejected due to external dependency and no cryptographic proof
- **FCC ULS Database**: Rejected due to no authentication mechanism
- **Custom PKI**: Rejected due to lack of existing amateur radio adoption

---

## 2. WebRTC/WebSocket Permission Controls and Feature Flagging

### Decision: Browser Feature Flags with Graceful Permission Handling

**Rationale**: 2024-2025 browser implementations provide comprehensive feature flag controls for WebRTC/WebSocket while maintaining user privacy and security.

### Key Findings

#### WebRTC Permission Controls (2025 Updates)
- **Default Sink ID**: New `setDefaultSinkId()` method for audio output control
- **MediaStreamTrack Integration**: Enhanced WebSpeech API integration for transcription
- **STUN/TURN Policies**: Enterprise-configurable ICE candidate restrictions
- **IP Handling Policies**: Browser-level controls for local IP exposure

#### Browser-Specific Feature Flags

**Chrome Enterprise Policies (2024-2025)**:
```json
{
  "WebRTCUDPPortRange": "10000-20000",
  "WebRTCLocalIpsAllowedUrls": ["https://hamradio.example.com"],
  "WebRTCIPHandling": "default_public_interface_only"
}
```

**Progressive Enhancement Pattern**:
```typescript
interface FeatureAvailability {
  webrtc: {
    available: boolean;
    dataChannels: boolean;
    localDiscovery: boolean;
    restrictions: string[];
  };
  websocket: {
    available: boolean;
    secureOnly: boolean;
    originRestrictions: string[];
  };
}

async function detectCapabilities(): Promise<FeatureAvailability> {
  const webrtc = {
    available: 'RTCPeerConnection' in window,
    dataChannels: await testDataChannelSupport(),
    localDiscovery: await testSTUNAccess(),
    restrictions: getWebRTCRestrictions()
  };

  const websocket = {
    available: 'WebSocket' in window,
    secureOnly: location.protocol === 'https:',
    originRestrictions: getCSPWebSocketSources()
  };

  return { webrtc, websocket };
}
```

#### PWA Constraints
- **Secure Context Required**: WebRTC requires HTTPS for non-localhost connections
- **Permission API Integration**: Use `navigator.permissions.query()` for camera/microphone
- **Feature Detection**: Always check feature availability before attempting connection
- **Service Worker Limitations**: WebRTC connections must be established in main thread

#### Implementation Pattern
1. **Progressive Enhancement**: Start with basic WebSocket, upgrade to WebRTC when available
2. **Capability Detection**: Test actual functionality, not just API presence
3. **Fallback Strategies**: Maintain RF mode as ultimate fallback
4. **User Consent**: Clear UI indicators for permission requirements

#### Browser Security Evolution (2024-2025)
- **CSP Integration**: WebSocket origins must be explicitly allowed in Content Security Policy
- **Same-Site Enforcement**: Stricter enforcement of same-site policies for WebSocket connections
- **IP Disclosure Controls**: Enhanced protection against WebRTC IP leaks
- **Enterprise Controls**: More granular policy controls for organizational deployments

---

## 3. Rate Limiting and DDoS Protection Patterns

### Decision: Multi-Layer Rate Limiting with Express Middleware and Redis Store

**Rationale**: Express-rate-limit with Redis provides proven, scalable protection suitable for amateur radio applications with specific unlicensed user controls.

### Key Findings

#### Current Best Practices (2024-2025)

**Express-Rate-Limit Configuration**:
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// Unlicensed users - stricter limits
const unlicensedLimiter = rateLimit({
  store: new RedisStore({ /* Redis client */ }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 50, // 50 requests per window
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `unlicensed:${req.ip}:${req.user?.id || 'anonymous'}`,
  skip: (req) => req.user?.licensed === true
});

// Licensed users - relaxed limits
const licensedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200, // 200 requests per window
  keyGenerator: (req) => `licensed:${req.user.callsign}`,
  skip: (req) => req.user?.licensed !== true
});
```

#### Multi-Layer Protection Architecture

**Layer 1: Edge Protection (Cloudflare/AWS WAF)**
- DDoS protection at network level
- Geographic filtering
- Bot detection and mitigation
- SSL termination

**Layer 2: Application Gateway**
- Nginx rate limiting: `limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;`
- Request size limits: `client_max_body_size 2M;`
- Connection limits: `limit_conn_zone $binary_remote_addr zone=addr:10m;`

**Layer 3: Application Middleware**
- Express-rate-limit for API endpoints
- Express-slow-down for progressive degradation
- Custom rate limiting for amateur radio specific features

**Layer 4: Business Logic**
- Callsign-based limits for licensed users
- IP-based limits for unlicensed users
- Feature-specific rate limiting (WebRTC connections, mesh joins)

#### Amateur Radio Specific Patterns

```typescript
interface RateLimitConfig {
  // Unlicensed users
  unlicensed: {
    httpRequests: { window: '15m', limit: 50 };
    websocketConnections: { window: '1h', limit: 5 };
    webrtcOffers: { window: '5m', limit: 3 };
    contentRequests: { window: '1h', limit: 10 };
    messageRelay: 'forbidden';
  };

  // Licensed users
  licensed: {
    httpRequests: { window: '15m', limit: 200 };
    websocketConnections: { window: '1h', limit: 20 };
    webrtcOffers: { window: '5m', limit: 10 };
    contentRequests: { window: '1h', limit: 100 };
    messageRelay: { window: '10m', limit: 50 };
  };
}
```

#### Implementation Considerations
- **Redis for Persistence**: Avoids memory leaks and supports distributed deployment
- **Sliding Window**: More accurate than fixed windows for burst protection
- **Custom Headers**: RateLimit-Remaining, RateLimit-Reset for client feedback
- **Monitoring Integration**: Export metrics to Prometheus/Grafana for monitoring

#### Browser-Side Considerations
- **Local Rate Limiting**: Implement client-side limits to reduce server load
- **Exponential Backoff**: Retry failed requests with increasing delays
- **Queue Management**: Buffer requests during rate limit periods
- **User Feedback**: Clear UI indicators when rate limited

---

## 4. Message Relay Architectures and Trust Models

### Decision: Licensed-Station-Only Relay with Certificate-Based Trust

**Rationale**: Amateur radio regulations require licensed operators for message relay, while distributed systems research shows certificate-based trust models provide the best security-scalability balance.

### Key Findings

#### Amateur Radio Regulatory Requirements

**FCC Part 97 Third-Party Traffic Rules**:
- Control operator must be present and continuously monitor third-party participation
- Only licensed operators can relay messages
- All relay activity must be logged for compliance
- International relay requires third-party operating agreements

**Implementation Pattern**:
```typescript
interface RelayNode {
  callsign: string;
  certificate: CallsignCertificate;
  relayCapabilities: {
    internetToRF: boolean;
    rfToInternet: boolean;
    storeAndForward: boolean;
    emergencyRelay: boolean;
  };
  trustMetrics: {
    uptime: number;
    messageSuccess: number;
    lastSeen: Date;
    peerReputations: Map<string, number>;
  };
}

interface RelayMessage {
  messageId: string;
  originCallsign: string;
  targetCallsign: string;
  relayPath: string[];
  content: EncryptedContent;
  timestamp: Date;
  signature: string;
  requiresLicensedRelay: boolean;
}
```

#### Trust Model Architecture

**Multi-Level Trust Hierarchy**:
1. **ARRL Certificate Trust**: Highest trust level for LoTW-verified stations
2. **Peer Reputation**: Dynamic trust based on successful relay history
3. **Network Consensus**: Distributed validation of relay node behavior
4. **Emergency Override**: Special trust elevation for emergency communications

#### Distributed Systems Research (2024-2025)

**Blockchain-Based Trust Models**:
- Hyperledger Fabric provides reliable performance for trust management
- Immutable audit trails improve accountability in relay operations
- Smart contracts can automate trust scoring and relay permissions

**Message Queue Architecture**:
```typescript
interface RelayQueue {
  priority: 'emergency' | 'health-welfare' | 'routine';
  licensedNodes: RelayNode[];
  unlicensedSources: Map<string, UnlicensedUser>;
  messageBuffer: RelayMessage[];
  routingTable: Map<string, RelayNode[]>;
}
```

#### Trust Verification Pattern

```typescript
async function verifyRelayTrust(node: RelayNode): Promise<TrustLevel> {
  // 1. Certificate validation
  const certValid = await validateCertificate(node.certificate);
  if (!certValid) return TrustLevel.UNTRUSTED;

  // 2. Peer reputation check
  const reputation = calculateReputation(node.trustMetrics);

  // 3. Network consensus
  const consensus = await queryPeerOpinions(node.callsign);

  // 4. Historical performance
  const history = await getRelayHistory(node.callsign);

  return combineMetrics(reputation, consensus, history);
}
```

#### Unlicensed User Integration

**Content Creation Model**:
- Unlicensed users create content for licensed relay (similar to third-party traffic)
- Licensed stations review and relay content at their discretion
- All relay decisions logged for FCC compliance
- Content attribution maintained through relay chain

**Trust Propagation**:
- Unlicensed users build trust through successful content submissions
- Licensed relays rate unlicensed user content quality
- Trust scores influence relay priority and acceptance rates

#### Security Considerations
- **Message Integrity**: Digital signatures for all relay messages
- **Replay Protection**: Timestamp and nonce validation
- **DoS Protection**: Rate limiting and trust-based prioritization
- **Privacy Balance**: Public amateur radio standards vs. user privacy

---

## 5. Amateur Radio Monitoring Regulations and Technical Capabilities

### Decision: Full-Spectrum Monitoring with Legal Compliance Framework

**Rationale**: Amateur radio regulations explicitly allow monitoring (no license required for receiving), while SDR technology provides comprehensive technical capabilities for implementing monitoring features.

### Key Findings

#### Legal Framework (2024-2025)

**FCC Part 97 Key Points**:
- **No License Required for Receiving**: Anyone can legally monitor amateur radio frequencies
- **Transmit License Required**: Amateur radio license required for any transmission
- **Frequency Sharing**: All amateur frequencies are shared, no exclusive assignments
- **Recent Updates**: Baud rate limitations removed, bandwidth limitations added (2025)

**Regulatory Compliance**:
```typescript
interface MonitoringCompliance {
  receiveOnly: true; // No transmission capabilities for unlicensed users
  frequencyRange: {
    hf: { min: 1800, max: 29700 }, // kHz
    vhf: { min: 144000, max: 148000 }, // kHz
    uhf: { min: 420000, max: 450000 } // kHz
  };
  logging: {
    required: true;
    retention: '2 years';
    contents: ['frequency', 'timestamp', 'mode', 'callsign'];
  };
  restrictions: {
    transmit: 'forbidden',
    relay: 'forbidden',
    decrypt: 'forbidden' // Part 97 prohibits encrypted content
  };
}
```

#### Technical Capabilities (SDR Integration)

**Popular SDR Hardware (2024-2025)**:
- **RTL-SDR**: $30 USB dongles, 500 kHz - 1.75 GHz, receive-only
- **HackRF One**: Bi-directional, 1 MHz - 6 GHz, ~$300
- **SDRPlay RSP1A**: Enhanced receiver, improved performance
- **ADALM Pluto**: Education-focused SDR platform

**WebUSB Integration Pattern**:
```typescript
interface SDRDevice {
  deviceInfo: {
    vendor: string;
    product: string;
    frequencyRange: [number, number];
    sampleRate: number;
    capabilities: ('receive' | 'transmit')[];
  };

  connect(): Promise<void>;
  tune(frequency: number): Promise<void>;
  startSampling(): AsyncIterator<Float32Array>;
  stopSampling(): Promise<void>;

  // Monitoring-specific methods
  scanSpectrum(start: number, end: number): Promise<SpectrumData>;
  decodeSignal(samples: Float32Array, mode: string): Promise<DecodedData>;
}

// Browser WebUSB access
async function requestSDRDevice(): Promise<SDRDevice> {
  const device = await navigator.usb.requestDevice({
    filters: [
      { vendorId: 0x0bda, productId: 0x2838 }, // RTL-SDR
      { vendorId: 0x1d50, productId: 0x6089 }  // HackRF
    ]
  });

  return new SDRDevice(device);
}
```

#### PWA Implementation Constraints

**Browser API Limitations**:
- **WebUSB**: Requires HTTPS and user gesture for device access
- **Processing Power**: JavaScript FFT operations limited compared to native SDR software
- **Real-time Constraints**: Web Audio API provides real-time processing capabilities
- **Storage Limits**: IndexedDB for signal recordings and spectrum data

**Monitoring Feature Implementation**:
```typescript
interface MonitoringFeatures {
  spectrumAnalyzer: {
    realTime: boolean;
    resolution: number; // Hz
    updateRate: number; // Hz
    waterfall: boolean;
  };

  signalDecoding: {
    supportedModes: ['CW', 'SSB', 'FM', 'APRS', 'PSK31', 'FT8'];
    realTimeDecoding: boolean;
    recordingCapability: boolean;
  };

  bandPlan: {
    visual: boolean;
    interactive: boolean;
    regulatory: 'FCC' | 'ITU' | 'Local';
  };

  logging: {
    automated: boolean;
    export: ('ADIF' | 'CSV' | 'JSON')[];
    retention: number; // days
  };
}
```

#### Content Discovery via Monitoring

**Passive Content Detection**:
- Monitor CQ beacons for content availability announcements
- Decode APRS packets for mesh network topology
- Analyze signal strength for optimal relay selection
- Build automatic frequency coordination for interference avoidance

**Integration with Mesh Protocol**:
- Use monitoring data to optimize mesh routing
- Detect interference and automatically adjust frequencies
- Provide spectrum usage analytics for licensed operators
- Support emergency frequency monitoring during disasters

#### 2025 Software Developments

**Current SDR Software Evolution**:
- **SkyRoof**: New satellite tracking and SDR integration
- **SDR Console**: Continuous updates with new modulation support
- **GNU Radio**: Enhanced browser/WebAssembly integration in development
- **RTL-SDR.com**: New RTL-SDR V4 with improved performance expected 2025

---

## Implementation Recommendations

### Architecture Decisions

1. **Certificate-Based Authentication**: Implement LoTW-compatible certificate validation with local caching and graceful degradation for unlicensed users.

2. **Permission-Based Feature Gating**: Use browser feature detection and progressive enhancement to handle WebRTC/WebSocket availability with clear user feedback.

3. **Multi-Layer Rate Limiting**: Deploy edge protection, application gateway limits, middleware rate limiting, and business logic controls with different tiers for licensed vs unlicensed users.

4. **Licensed-Only Message Relay**: Restrict message relay functions to licensed users with certificate validation, while allowing unlicensed users to create content for licensed relay.

5. **Comprehensive Monitoring Support**: Implement full-spectrum monitoring capabilities using WebUSB SDR integration with strict receive-only enforcement for unlicensed users.

### Technical Implementation

```typescript
// Main application configuration
interface UnlicensedModeConfig {
  authentication: {
    certificateValidation: 'strict' | 'relaxed' | 'development';
    trustStore: 'arrl' | 'local' | 'hybrid';
    unlicensedFallback: boolean;
  };

  rateLimiting: {
    store: 'redis' | 'memory';
    unlicensedLimits: RateLimitTier;
    licensedLimits: RateLimitTier;
    ddosProtection: boolean;
  };

  relay: {
    unlicensedRelay: false;
    contentCreation: true;
    trustModel: 'certificate' | 'reputation' | 'hybrid';
  };

  monitoring: {
    sdrIntegration: boolean;
    spectrumAnalysis: boolean;
    signalDecoding: string[];
    complianceLogging: boolean;
  };

  webrtc: {
    fallbackMode: 'websocket' | 'rf';
    permissionHandling: 'graceful' | 'strict';
    featureDetection: boolean;
  };
}
```

### Compliance Framework

**Regulatory Compliance Checklist**:
- [ ] FCC Part 97 third-party traffic compliance for relay operations
- [ ] No transmission capabilities for unlicensed users
- [ ] Certificate-based station identification
- [ ] Activity logging for regulatory audit
- [ ] Emergency communication priority handling
- [ ] International third-party operating agreement compliance

**Privacy and Security**:
- [ ] No content encryption (amateur radio regulatory requirement)
- [ ] Message integrity through digital signatures
- [ ] Rate limiting to prevent abuse
- [ ] Trust-based relay filtering
- [ ] Local data storage for offline operation

### Future Evolution

The implementation should support future developments in:
- Enhanced SDR integration as WebAssembly capabilities improve
- Blockchain-based trust models for distributed relay networks
- Advanced AI-based signal processing for better decoding
- International amateur radio digital mode standardization
- Emergency communication protocol enhancements

---

**Research Complete**: 2025-09-16
**Implementation Ready**: All technical decisions documented with clear rationales and implementation patterns.