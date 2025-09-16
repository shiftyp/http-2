# Amateur Radio Certificate Specification

## Overview
Digital certificates provide cryptographic proof of amateur radio licensing, enabling secure verification without external API dependencies.

## Certificate Format

### X.509 v3 Certificate Structure
```asn1
Certificate ::= SEQUENCE {
    tbsCertificate       TBSCertificate,
    signatureAlgorithm   AlgorithmIdentifier,
    signatureValue       BIT STRING
}

TBSCertificate ::= SEQUENCE {
    version         [0] Version DEFAULT v3,
    serialNumber    CertificateSerialNumber,
    signature       AlgorithmIdentifier,
    issuer          Name,
    validity        Validity,
    subject         Name,
    subjectPublicKeyInfo SubjectPublicKeyInfo,
    extensions      [3] Extensions OPTIONAL
}
```

### Required Certificate Fields

#### Subject Distinguished Name
```
CN = [CALLSIGN]           # e.g., CN=W1AW
O = [License Authority]   # e.g., O=Federal Communications Commission
C = [Country Code]        # e.g., C=US
```

#### Certificate Extensions
```javascript
// Amateur Radio Extension OID: 1.3.6.1.4.1.12348.1
{
  criticial: false,
  oid: "1.3.6.1.4.1.12348.1",
  value: {
    callsign: "W1AW",
    licenseClass: "Extra",     // Technician|General|Extra
    validFrom: "2024-01-01",
    validTo: "2034-01-01",
    privileges: {
      bands: ["160m", "80m", "40m", "20m", "15m", "10m", "6m", "2m", "70cm"],
      modes: ["CW", "SSB", "Digital", "Image"],
      power: 1500  // watts
    }
  }
}
```

## Trusted Certificate Authorities

### Primary Authorities
1. **ARRL Logbook of The World (LoTW)**
   - Most widely adopted
   - Existing infrastructure
   - Free certificates

2. **National Amateur Radio Societies**
   - RSGB (UK)
   - RAC (Canada)
   - DARC (Germany)
   - JARL (Japan)

3. **Amateur Radio Digital Trust**
   - Open source CA
   - Community operated
   - Web of trust model

## Certificate Generation Process

### For Certificate Authorities
```bash
# Generate root CA key
openssl genrsa -out ca.key 4096

# Create root certificate
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/C=US/O=Amateur Radio CA/CN=Amateur Radio Root CA"

# Sign user certificate
openssl x509 -req -days 3650 -in user.csr -CA ca.crt -CAkey ca.key \
  -set_serial 1001 -out user.crt \
  -extfile amateur_radio_extensions.conf
```

### For Licensed Operators
```bash
# Generate private key
openssl genrsa -out my_callsign.key 2048

# Create certificate request
openssl req -new -key my_callsign.key -out my_callsign.csr \
  -subj "/C=US/O=Amateur Radio/CN=W1AW"

# Submit CSR to Certificate Authority
# Receive signed certificate
```

## Certificate Verification in PWA

### Using Web Crypto API
```javascript
async function verifyCertificate(certPEM) {
  // Convert PEM to ArrayBuffer
  const certDER = pemToDer(certPEM);

  // Import certificate
  const cert = await crypto.subtle.importKey(
    "spki",
    certDER,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["verify"]
  );

  // Verify against trusted roots
  const trustedRoots = await loadTrustedRoots();

  for (const root of trustedRoots) {
    try {
      const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        root.publicKey,
        cert.signature,
        cert.tbsCertificate
      );

      if (valid) {
        return extractCallsign(cert);
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}
```

### Certificate Storage
```javascript
// Store in IndexedDB for offline use
async function storeCertificate(cert) {
  const db = await openDB('certificates', 1);

  await db.put('certs', {
    callsign: cert.subject.CN,
    certificate: cert.raw,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    licenseClass: cert.extensions.licenseClass,
    timestamp: Date.now()
  });
}
```

## Certificate Lifecycle

### Initial Setup
1. Operator obtains certificate from trusted CA
2. Uploads certificate to PWA
3. PWA verifies certificate chain
4. Certificate stored locally

### Ongoing Verification
1. PWA checks certificate on each server start
2. Validates expiration date
3. Confirms against trusted roots
4. Updates if renewed certificate provided

### Revocation Handling
```javascript
// Check certificate revocation
async function checkRevocation(cert) {
  // Option 1: OCSP (Online Certificate Status Protocol)
  if (navigator.onLine) {
    const ocspResponse = await checkOCSP(cert.serialNumber);
    return ocspResponse.status === 'good';
  }

  // Option 2: Local CRL (Certificate Revocation List)
  const crl = await loadCachedCRL();
  return !crl.includes(cert.serialNumber);
}
```

## Implementation Examples

### LOTW Certificate Integration
```javascript
class LOTWCertificate {
  static async import(p12File, password) {
    // Parse PKCS#12 file
    const p12 = await parsePKCS12(p12File, password);

    // Extract certificate and private key
    const cert = p12.certificate;
    const privateKey = p12.privateKey;

    // Verify LOTW signature
    const lotwRoot = await loadLOTWRoot();
    const valid = await verifyCertChain(cert, lotwRoot);

    if (!valid) {
      throw new Error('Invalid LOTW certificate');
    }

    // Extract callsign from certificate
    const callsign = cert.subject.CN;

    return { callsign, cert, privateKey };
  }
}
```

### Self-Signed with Web of Trust
```javascript
class WebOfTrustCertificate {
  static async verify(cert, endorsements) {
    // Need at least 3 endorsements from trusted operators
    const MIN_ENDORSEMENTS = 3;

    const validEndorsements = [];

    for (const endorsement of endorsements) {
      // Verify endorser's certificate
      const endorserValid = await verifyCertificate(endorsement.cert);

      if (endorserValid) {
        // Verify endorsement signature
        const sigValid = await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          endorsement.publicKey,
          endorsement.signature,
          cert.raw
        );

        if (sigValid) {
          validEndorsements.push(endorsement);
        }
      }
    }

    return validEndorsements.length >= MIN_ENDORSEMENTS;
  }
}
```

## Security Considerations

### Certificate Protection
- Store private keys in secure browser storage
- Never transmit private keys
- Use hardware tokens when available
- Implement key rotation policies

### Trust Model
- Embed trusted root certificates in PWA
- Regular updates for new CAs
- Community governance for trust decisions
- Transparency logs for certificate issuance

### Privacy
- Certificates contain callsign (public info)
- No personal information in certificates
- Optional privacy mode (hide callsign in UI)
- Local verification (no tracking)

## Future Enhancements

### Hardware Security Module Support
```javascript
// Use Web Authentication API for hardware keys
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: randomChallenge,
    rp: { name: "Ham Radio Server" },
    user: {
      id: callsignToBytes("W1AW"),
      name: "W1AW",
      displayName: "W1AW"
    },
    pubKeyCredParams: [{alg: -7, type: "public-key"}],
    authenticatorSelection: {
      authenticatorAttachment: "cross-platform"
    }
  }
});
```

### Distributed Certificate Authority
- Blockchain-based certificate registry
- Peer-to-peer certificate validation
- Decentralized revocation
- Community consensus model