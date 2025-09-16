# License Requirements for Distributed Server Operation

## Overview
Only licensed amateur radio operators with valid certificates can run server components, ensuring compliance with FCC Part 97 regulations and maintaining the integrity of the amateur radio service.

## License Verification Process

### 1. Certificate-Based Validation
```
PWA → Request Certificate Upload → Verify Certificate → Enable Server Download
```

**Certificate Requirements:**
- Must be cryptographically signed by trusted authority
- Contains callsign and license class information
- Has valid expiration date
- Can be verified offline without external API calls

### 2. Primary Verification Method: Digital Certificate

#### Certificate Upload Flow
1. User uploads their amateur radio certificate file (`.p12`, `.pem`, or `.crt`)
2. PWA verifies certificate signature against trusted root certificates
3. Extracts callsign and license class from certificate
4. Validates certificate hasn't expired
5. Stores certificate locally for future verification

#### Supported Certificate Types
- **ARRL LOTW Certificates**: Already widely used, trusted infrastructure
- **National Society Certificates**: RSGB, RAC, DARC, JARL, etc.
- **Self-Signed with Web of Trust**: Verified by other licensed operators
- **X.509 Certificates**: Standard PKI format with amateur radio extensions

### 3. Server Binary Access Control

```javascript
// Certificate-based server download gate
async function enableServerDownload(certificateFile) {
  // Parse and verify certificate
  const cert = await parseCertificate(certificateFile);

  // Verify certificate signature
  const isValid = await verifyCertificateChain(cert);

  if (!isValid) {
    showMessage("Valid amateur radio certificate required");
    return false;
  }

  // Extract callsign from certificate
  const callsign = cert.subject.callsign;
  const licenseClass = cert.extensions.licenseClass;

  // Check certificate expiration
  if (cert.validTo < Date.now()) {
    showMessage("Certificate has expired");
    return false;
  }

  // Enable download buttons
  enablePlatformBinaries();

  // Store certificate for future verification
  await storeCertificate(cert);

  return true;
}
```

## Server Capabilities by License Class

### Technician Class
- Run local HTTP server
- Participate in VHF/UHF mesh networks
- Limited HF privileges (10m, 15m, 40m, 80m portions)

### General Class
- All Technician privileges
- Full HF band access for wider mesh participation
- Can relay between VHF and HF networks

### Extra Class
- All General privileges
- Access to exclusive sub-bands for priority traffic
- Can operate experimental mesh protocols

## Compliance Features

### Automatic Station Identification
- Server includes callsign in HTTP headers
- Periodic CW ID on RF transmissions
- Beacon messages include operator callsign

### Content Restrictions
- No encryption of content (signing allowed)
- No commercial traffic
- Third-party traffic rules enforced
- Automatic filtering of prohibited content

### Logging Requirements
- All server operations logged with timestamp
- RF transmissions logged to QSO logbook
- Content transfers recorded with callsigns
- Logs exportable for FCC inspection

## Client vs Server Modes

### Unlicensed Users (Client Mode)
- Can install and use PWA
- Browse content from servers
- Receive RF transmissions (listening only)
- Cannot run server component
- Cannot transmit on RF

### Licensed Operators (Server Mode)
- Full PWA capabilities
- Download and run server binary
- Transmit on amateur frequencies
- Host content for others
- Participate in mesh routing

## Implementation Notes

### PWA Behavior
1. On first launch, ask "Are you a licensed amateur radio operator?"
2. If yes → Begin license verification flow
3. If no → Enable client-only mode
4. Store license status in secure storage

### Server Binary Distribution
- Binaries included in PWA's `/assets/servers/` directory
- Download enabled only after license verification
- Each binary signed with developer certificate
- Platform detection for appropriate binary:
  - `ham-server-windows-x64.exe`
  - `ham-server-darwin-x64`
  - `ham-server-darwin-arm64`
  - `ham-server-linux-x64`

### Grace Period
- 30-day cache of license validation
- Re-verification required after expiry
- Offline validation using stored certificate
- Server stops if license expires

## Security Considerations

### Binary Integrity
- SHA-256 hash verification
- Code signing certificates
- Deterministic builds for verification
- No auto-execution (user must manually run)

### Network Security
- Server binds to localhost by default
- Optional LAN exposure with user consent
- Rate limiting to prevent abuse
- Callsign-based access control lists

### RF Gateway Protection
- Server only bridges authorized content
- No internet traffic relay without consent
- Bandwidth limiting for RF transmission
- Priority queuing for emergency traffic

## Future Enhancements

### Federated Trust Network
- Amateur radio clubs issue certificates
- Web of trust model
- Peer vouching system
- Reputation-based privileges

### Automatic License Renewal Check
- Periodic FCC database queries
- License expiration warnings
- Graceful degradation to client mode
- Renewal reminder notifications

### International Support
- CEPT license recognition
- Country-specific validation APIs
- Reciprocal operating agreements
- Multi-language certificate support