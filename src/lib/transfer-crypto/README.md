# Transfer Crypto Module

## Purpose
This module handles encryption for **LOCAL NETWORK TRANSFERS ONLY**. It is specifically designed for WebRTC peer-to-peer data transfers between devices on the same network.

## ⚠️ CRITICAL WARNING
**THIS MODULE MUST NEVER BE USED FOR AMATEUR RADIO TRANSMISSION**

Encryption over amateur radio frequencies violates FCC Part 97 regulations and can result in:
- Loss of amateur radio license
- Federal penalties
- Legal action

## Usage

### For Local Network Transfers (Allowed)
```typescript
import { transferCrypto } from './transfer-crypto';
import { RADIO_TRANSMISSION_MODE } from '../crypto';

// Ensure we're in local network mode
RADIO_TRANSMISSION_MODE.setRadioMode(false);

// Encrypt data for WebRTC transfer
const encrypted = await transferCrypto.encryptForTransfer(
  data,
  recipientPublicKey
);

// Send via WebRTC data channel (NOT radio!)
webrtcChannel.send(encrypted);
```

### For Radio Transmission (Forbidden)
```typescript
// NEVER DO THIS!
RADIO_TRANSMISSION_MODE.setRadioMode(true);
const encrypted = await transferCrypto.encryptForTransfer(data, key);
// ❌ This will throw a COMPLIANCE VIOLATION error
```

## Architecture

This module is intentionally separated from the main crypto module to create a clear boundary:

- `/lib/crypto/` - Radio-compliant cryptography (signatures only)
- `/lib/transfer-crypto/` - Local network encryption (WebRTC only)

## Functions

### `encryptForTransfer(data, recipientPublicKey)`
Encrypts data for local network transfer using:
- ECDH key agreement for shared secret derivation
- AES-GCM for symmetric encryption
- Ephemeral keys for forward secrecy

### `decryptFromTransfer(encryptedPackage, privateKey)`
Decrypts data received from local network transfer.

## Runtime Protection

The module includes runtime guards that prevent usage in radio mode:
```typescript
if (RADIO_TRANSMISSION_MODE.isRadio) {
  throw new Error('COMPLIANCE VIOLATION');
}
```

## Testing

Always test with appropriate mode settings:
```typescript
describe('Transfer Crypto', () => {
  beforeEach(() => {
    // Explicitly set local network mode
    RADIO_TRANSMISSION_MODE.setRadioMode(false);
  });

  it('should reject encryption in radio mode', () => {
    RADIO_TRANSMISSION_MODE.setRadioMode(true);
    expect(() => transferCrypto.encryptForTransfer(data, key))
      .toThrow('COMPLIANCE VIOLATION');
  });
});
```

## Migration Status

This module is part of a compliance improvement initiative. Current status:
- [x] Module created with runtime guards
- [x] Documentation added
- [ ] Migrate encryptData/decryptData from main crypto module
- [ ] Update all WebRTC transfer code to use this module
- [ ] Remove deprecated methods from main crypto module

## References
- FCC Part 97.113 - Prohibited transmissions
- FCC Part 97.117 - International communications
- Project Compliance Audit: `/ENCRYPTION_COMPLIANCE_AUDIT.md`