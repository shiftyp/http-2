# Amateur Radio Compliance Guide - Cryptography Module

## Overview
This module provides cryptographic functions for the HTTP Over Ham Radio project. It contains both **COMPLIANT** and **NON-COMPLIANT** methods for amateur radio use.

## FCC Part 97 Regulations
Amateur radio operators are prohibited from transmitting encrypted content over radio frequencies. However, digital signatures for authentication are allowed.

## Compliant Functions (Allowed on Radio)

### Digital Signatures
These functions are **ALLOWED** for amateur radio transmission:
- `generateKeyPair()` - Generate ECDSA key pairs for signing
- `signRequest()` - Sign HTTP requests for authentication
- `verifyRequest()` - Verify signed requests
- `sign()` - Generic data signing
- `verify()` - Generic signature verification

These use ECDSA signatures which authenticate the sender but do not encrypt the content.

### Example: Signing for Radio Transmission
```typescript
import { cryptoManager, RADIO_TRANSMISSION_MODE } from './crypto';

// Enable radio mode
RADIO_TRANSMISSION_MODE.setRadioMode(true);

// Generate key pair (allowed)
const keyPair = await cryptoManager.generateKeyPair('KA1ABC');

// Sign a request (allowed)
const signedRequest = await cryptoManager.signRequest(
  'GET',
  '/logbook',
  { 'X-Callsign': 'KA1ABC' }
);

// Content remains readable, only signature is added
```

## Non-Compliant Functions (FORBIDDEN on Radio)

### Encryption Methods
These functions **MUST NOT** be used for amateur radio transmission:
- `encryptData()` - AES-GCM encryption
- `decryptData()` - AES-GCM decryption

These methods are **ONLY** for local network WebRTC transfers between devices.

### Runtime Protection
The module includes runtime guards to prevent accidental encryption over radio:

```typescript
// Enable radio mode (prevents encryption)
RADIO_TRANSMISSION_MODE.setRadioMode(true);

// This will throw a COMPLIANCE VIOLATION error
await cryptoManager.encryptData(data, publicKey); // ❌ THROWS ERROR

// Disable radio mode for local transfers
RADIO_TRANSMISSION_MODE.setRadioMode(false);

// Now encryption works for local network only
await cryptoManager.encryptData(data, publicKey); // ✅ OK for local network
```

## Architecture Separation

### Current State
- Radio transmission code: Uses only signing methods
- Local network transfers: Can use encryption methods
- Runtime flag: `RADIO_TRANSMISSION_MODE` prevents misuse

### Future Migration
The encryption methods will be moved to a separate `transfer-crypto` module to create clearer architectural boundaries:

```
src/lib/
├── crypto/              # Radio-compliant signatures only
│   ├── index.ts        # ECDSA signing/verification
│   └── COMPLIANCE.md   # This file
└── transfer-crypto/     # Local network encryption (future)
    └── index.ts        # AES-GCM for WebRTC transfers
```

## Testing Compliance

### Unit Tests
The test suite includes compliance checks:
```typescript
it('should REJECT encryption when in radio mode', async () => {
  RADIO_TRANSMISSION_MODE.setRadioMode(true);
  await expect(cryptoManager.encryptData(data, key))
    .rejects.toThrow('COMPLIANCE VIOLATION');
});
```

### Integration Testing
When testing features that involve radio transmission:
1. Always set `RADIO_TRANSMISSION_MODE.setRadioMode(true)`
2. Verify only signatures are used, never encryption
3. Check that content remains human-readable

## Best Practices

### DO ✅
- Use signatures for authentication over radio
- Use encryption ONLY for local network transfers
- Set radio mode appropriately before operations
- Document whether functions are radio-compliant

### DON'T ❌
- Never encrypt content for radio transmission
- Don't bypass the runtime guards
- Don't mix radio and local network data paths
- Never store encrypted data that might be transmitted

## Compliance Checklist

Before deploying or modifying crypto functionality:

- [ ] All radio transmission paths use ONLY signatures
- [ ] Encryption methods have clear warnings
- [ ] Runtime guards are in place and tested
- [ ] Documentation clearly states compliance status
- [ ] Tests verify compliance boundaries
- [ ] Local network and radio paths are separated

## References
- [FCC Part 97 Regulations](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97)
- [ARRL Guidelines on Encryption](http://www.arrl.org/encryption)
- Project Compliance Audit: `/ENCRYPTION_COMPLIANCE_AUDIT.md`

## Questions?
If unsure about compliance, always err on the side of caution:
1. When in doubt, don't encrypt
2. Ask experienced operators
3. Review FCC Part 97.113 and 97.117
4. Use signatures instead of encryption