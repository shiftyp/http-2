# Decentralized Certificate Authority Model

## Overview
Licensed operators running servers can become intermediate Certificate Authorities (CAs), creating a hierarchical trust chain where each certificate includes its complete issuer lineage, verified against locally trusted roots.

## Certificate Chain Architecture

```
Root CA (Pre-trusted in PWA)
    ├── Intermediate CA (Server Operator A)
    │   ├── End User Certificate (Operator B)
    │   └── End User Certificate (Operator C)
    └── Intermediate CA (Server Operator D)
        ├── Sub-Intermediate CA (Operator E)
        │   └── End User Certificate (Operator F)
        └── End User Certificate (Operator G)
```

## Certificate Authority Capabilities

### Server Becomes CA
When a licensed operator with a valid certificate runs a server, they can:
1. Generate an intermediate CA certificate
2. Sign certificates for other operators
3. Maintain a certificate transparency log
4. Broadcast their CA capabilities via RF/mDNS

### CA Certificate Structure
```javascript
{
  // Standard X.509 fields
  subject: {
    CN: "W1AW",
    O: "Amateur Radio Intermediate CA",
    OU: "Server Node"
  },
  issuer: {
    CN: "KB2ABC",  // Parent CA that signed this cert
    O: "Amateur Radio Intermediate CA"
  },

  // CA-specific extensions
  extensions: {
    basicConstraints: {
      critical: true,
      cA: true,
      pathLenConstraint: 2  // How many sub-CAs allowed
    },
    keyUsage: {
      critical: true,
      keyCertSign: true,
      cRLSign: true
    },
    // Amateur radio extension
    amateurRadio: {
      callsign: "W1AW",
      licenseClass: "Extra",
      canIssueFor: ["Technician", "General", "Extra"],
      serverEndpoint: "https://w1aw.radio:8080/ca"
    }
  },

  // Full certificate chain
  certificateChain: [
    // This certificate
    "-----BEGIN CERTIFICATE-----...",
    // Issuer's certificate
    "-----BEGIN CERTIFICATE-----...",
    // Issuer's issuer certificate (if any)
    "-----BEGIN CERTIFICATE-----...",
    // Continue until root
  ]
}
```

## Certificate Issuance Process

### Server-Side CA Functions
```javascript
class IntermediateCA {
  constructor(serverCertificate, privateKey) {
    this.cert = serverCertificate;
    this.key = privateKey;
    this.issuedCerts = new Map();
  }

  async issueCertificate(request) {
    // Verify requester's identity (various methods)
    const identity = await this.verifyIdentity(request);

    // Check if operator is licensed
    if (!identity.isLicensed) {
      throw new Error("Only licensed operators can receive certificates");
    }

    // Generate certificate with full chain
    const newCert = await this.generateCertificate({
      subject: {
        CN: identity.callsign,
        O: "Amateur Radio Operator"
      },
      issuer: this.cert.subject,
      extensions: {
        amateurRadio: {
          callsign: identity.callsign,
          licenseClass: identity.licenseClass,
          issuedBy: this.cert.subject.CN,
          issuerChain: this.getIssuerChain()
        }
      }
    });

    // Sign with our private key
    const signedCert = await this.signCertificate(newCert, this.key);

    // Add to transparency log
    await this.logIssuance(signedCert);

    // Return certificate with full chain
    return {
      certificate: signedCert,
      chain: [signedCert, ...this.cert.certificateChain]
    };
  }

  getIssuerChain() {
    // Extract issuer lineage from our certificate
    const chain = [];
    let current = this.cert;

    while (current) {
      chain.push({
        callsign: current.subject.CN,
        fingerprint: current.fingerprint,
        validFrom: current.validFrom,
        validTo: current.validTo
      });
      current = current.issuer;
    }

    return chain;
  }
}
```

## Client-Side Verification

### Certificate Chain Validation
```javascript
class CertificateChainVerifier {
  constructor() {
    // Local database of trusted certificates
    this.trustedRoots = new Map();
    this.trustedIntermediates = new Map();
  }

  async verifyCertificateChain(certChain) {
    // Start from the end-entity certificate
    let current = certChain[0];

    // Walk up the chain
    for (let i = 1; i <= certChain.length; i++) {
      const issuer = certChain[i];

      // Verify current cert is signed by issuer
      const validSignature = await this.verifySignature(current, issuer);
      if (!validSignature) {
        return { valid: false, reason: `Invalid signature at level ${i}` };
      }

      // Check if we trust this issuer
      const trusted = await this.checkTrust(issuer);
      if (trusted) {
        // Found a trusted certificate in the chain
        return {
          valid: true,
          trustedAt: issuer.subject.CN,
          chainDepth: i
        };
      }

      // Move up the chain
      current = issuer;
    }

    // Reached end without finding trusted cert
    return { valid: false, reason: "No trusted issuer in chain" };
  }

  async checkTrust(cert) {
    // Check if this exact certificate is trusted
    if (this.trustedRoots.has(cert.fingerprint)) {
      return true;
    }

    // Check if it's a known intermediate
    if (this.trustedIntermediates.has(cert.fingerprint)) {
      return true;
    }

    // Check if it's signed by a trusted cert
    for (const [fingerprint, trustedCert] of this.trustedRoots) {
      if (await this.verifySignature(cert, trustedCert)) {
        // Cache as trusted intermediate
        this.trustedIntermediates.set(cert.fingerprint, cert);
        return true;
      }
    }

    return false;
  }

  async verifySignature(cert, issuerCert) {
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      issuerCert.publicKey,
      cert.signature,
      cert.tbsCertificate
    );
  }
}
```

## Trust Database Management

### Local Trust Store
```javascript
class TrustStore {
  async initialize() {
    // Load pre-trusted root certificates
    this.roots = await this.loadBuiltInRoots();

    // Load user-added trusted certificates
    this.userTrusted = await this.loadUserTrusted();

    // Load discovered intermediate CAs
    this.intermediates = await this.loadIntermediates();
  }

  async addTrustedCertificate(cert, trustLevel = 'intermediate') {
    // Verify certificate is valid
    const valid = await this.verifyCertificate(cert);
    if (!valid) throw new Error("Cannot trust invalid certificate");

    // Store in appropriate trust level
    const db = await openDB('trustStore', 1);
    await db.put('certificates', {
      fingerprint: cert.fingerprint,
      certificate: cert,
      trustLevel,
      addedAt: Date.now(),
      addedBy: 'user',
      issuerChain: cert.extensions.amateurRadio.issuerChain
    });

    // Update in-memory cache
    if (trustLevel === 'root') {
      this.roots.set(cert.fingerprint, cert);
    } else {
      this.intermediates.set(cert.fingerprint, cert);
    }
  }

  async discoverCAs() {
    // Find servers advertising CA capabilities
    const servers = await this.mdnsService.findServers();

    for (const server of servers) {
      if (server.capabilities.includes('ca')) {
        const caCert = await this.fetchCACertificate(server.endpoint);

        // Verify against our trust chain
        const trusted = await this.verifyChain(caCert.chain);

        if (trusted) {
          await this.addTrustedCertificate(caCert, 'intermediate');
        }
      }
    }
  }
}
```

## Certificate Issuance UI

### In-PWA Certificate Request
```javascript
class CertificateRequestUI {
  async requestCertificate() {
    // Find available CAs
    const availableCAs = await this.findAvailableCAs();

    // Let user choose CA
    const selectedCA = await this.showCASelector(availableCAs);

    // Generate key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    // Create certificate request
    const csr = await this.createCSR({
      callsign: this.userCallsign,
      publicKey: keyPair.publicKey
    });

    // Submit to selected CA
    const response = await fetch(`${selectedCA.endpoint}/issue`, {
      method: 'POST',
      body: JSON.stringify({
        csr,
        proofOfLicense: await this.getProofOfLicense()
      })
    });

    const { certificate, chain } = await response.json();

    // Verify the received certificate
    const valid = await this.verifyChain(chain);
    if (!valid) {
      throw new Error("Received invalid certificate chain");
    }

    // Store certificate and private key
    await this.storeCertificate(certificate, keyPair.privateKey, chain);
  }
}
```

## Network Discovery Protocol

### CA Advertisement
```javascript
// Servers broadcast their CA capabilities
class CAAdvertisement {
  broadcast() {
    // via mDNS
    this.mdns.advertise({
      name: `${this.callsign}._hamradio-ca._tcp.local`,
      port: 8080,
      txt: {
        callsign: this.callsign,
        capabilities: ['ca', 'server'],
        chainDepth: this.certificateChain.length,
        trustRoots: this.getTrustRootFingerprints(),
        endpoint: `https://${this.callsign}.local:8080/ca`
      }
    });

    // via RF beacon
    this.rf.beacon({
      type: 'CA_ANNOUNCE',
      callsign: this.callsign,
      chainDepth: this.certificateChain.length,
      fingerprint: this.certificate.fingerprint
    });
  }
}
```

## Security Policies

### Issuance Restrictions
```javascript
class IssuancePolicy {
  canIssue(issuerCert, requestedClass) {
    // Can only issue for same or lower license class
    const classHierarchy = ['Technician', 'General', 'Extra'];
    const issuerLevel = classHierarchy.indexOf(issuerCert.licenseClass);
    const requestedLevel = classHierarchy.indexOf(requestedClass);

    return requestedLevel <= issuerLevel;
  }

  maxChainDepth() {
    // Prevent infinite delegation
    return 5;
  }

  certificateValidity() {
    // Certificates valid for 1 year
    return 365 * 24 * 60 * 60 * 1000;
  }
}
```

### Revocation Support
```javascript
class RevocationManager {
  async revokeCertificate(cert, reason) {
    // Add to local CRL
    await this.addToCRL(cert.serialNumber, reason);

    // Broadcast revocation
    await this.broadcastRevocation(cert);

    // Notify peers
    await this.notifyPeers(cert);
  }

  async checkRevocation(cert) {
    // Check local CRL
    if (await this.isInLocalCRL(cert)) return true;

    // Check issuer's CRL if available
    if (cert.issuerEndpoint) {
      const issuerCRL = await this.fetchCRL(cert.issuerEndpoint);
      if (issuerCRL.includes(cert.serialNumber)) return true;
    }

    return false;
  }
}
```

## Benefits of This Model

1. **No Central Authority**: Network continues functioning even if root CAs are unavailable
2. **Local Trust Decisions**: Each operator controls their trust store
3. **Gradual Trust Building**: Trust relationships develop organically through the network
4. **Resilient**: Multiple paths to establish trust
5. **Transparent**: All certificates include full issuer chain
6. **Offline Capable**: Once trust is established, no external connectivity needed

## Implementation Phases

### Phase 1: Basic Chain Verification
- Implement certificate chain parsing
- Basic signature verification
- Local trust store

### Phase 2: CA Functionality
- Enable servers to issue certificates
- Certificate request/response protocol
- Chain building and validation

### Phase 3: Discovery and Trust
- mDNS CA advertisement
- RF beacon integration
- Dynamic trust establishment

### Phase 4: Advanced Features
- Revocation support
- Certificate transparency logs
- Web of trust visualization
- Cross-certification between CAs