# Amateur Radio Encryption Compliance Audit

## Executive Summary
This audit reviews all encryption usage in the HTTP Over Ham Radio codebase to ensure compliance with amateur radio regulations (FCC Part 97), which prohibit encryption of message content but allow authentication and signatures.

## Findings

### 1. COMPLIANCE ISSUE: Crypto Library Contains Encryption Methods
**Location**: `/src/lib/crypto/index.ts` (lines 226-359)
**Issue**: The CryptoManager class includes `encryptData()` and `decryptData()` methods using AES-GCM encryption
**Risk**: HIGH - These methods could encrypt content for radio transmission
**Recommendation**: Remove or clearly mark these methods as NOT for radio transmission

### 2. COMPLIANCE ISSUE: WebRTC Transfer Spec Requires Encryption
**Location**: `/specs/002-a-feature-whereby/spec.md` (lines 80-81)
**Issue**: FR-015 and FR-016 require encryption for data transfer
**Risk**: MEDIUM - Only applies to local network transfers, not radio
**Recommendation**: Clarify that encryption is ONLY for local network WebRTC transfers, never for radio

### 3. COMPLIANT: Digital Signatures Only
**Location**: `/src/lib/crypto/index.ts` (lines 135-224, 369-426)
**Status**: COMPLIANT - ECDSA signatures for authentication are allowed
**Note**: Properly implements signing/verification without encrypting content

### 4. COMPLIANT: Mesh Networking
**Location**: `/src/lib/mesh-networking/index.ts`
**Status**: COMPLIANT - No encryption found in mesh routing
**Note**: All packet routing is done in plaintext

### 5. COMPLIANT: Ham Server
**Location**: `/src/lib/ham-server/index.ts`
**Status**: COMPLIANT - No encryption of HTTP content
**Note**: Server supports signatures but doesn't encrypt payloads

## Detailed Analysis

### Crypto Library (`/src/lib/crypto/index.ts`)
The library contains both compliant and non-compliant functionality:

**Compliant Features:**
- ECDSA key generation (lines 34-66)
- Request signing (lines 135-175)
- Signature verification (lines 177-224)
- Key management and storage

**Non-Compliant Features:**
- `encryptData()` method (lines 226-294) - Uses ECDH + AES-GCM encryption
- `decryptData()` method (lines 296-359) - Decrypts AES-GCM encrypted data

### WebRTC Transfer Specification
The spec includes requirements that could violate amateur radio rules if misapplied:
- FR-015: "System MUST encrypt all transferred data using public key encryption"
- FR-016: "System MUST verify recipient identity through public key exchange"

These requirements are intended for local network transfers only, but the distinction isn't clear.

## Recommendations

### Immediate Actions Required

1. **Modify Crypto Library**
   - Add clear documentation that `encryptData()` and `decryptData()` are ONLY for local network use
   - Consider moving these methods to a separate `transfer-crypto` module
   - Add runtime checks to prevent encrypted data from being sent over radio

2. **Update WebRTC Transfer Spec**
   - Clarify that encryption is ONLY for local network WebRTC connections
   - Add explicit prohibition against using encryption for radio transmission
   - Document the separation between radio and local network protocols

3. **Add Compliance Checks**
   - Implement runtime validation to ensure encrypted data never reaches radio transmission
   - Add unit tests to verify compliance boundaries
   - Create clear separation between radio and non-radio data paths

### Code Changes Needed

1. Add header comments to encryption methods:
```typescript
/**
 * WARNING: This method uses encryption and MUST NOT be used for data
 * transmitted over amateur radio frequencies. This is ONLY for local
 * network WebRTC transfers as per FCC Part 97 regulations.
 */
```

2. Consider adding runtime guards:
```typescript
if (isRadioTransmission && isEncrypted(data)) {
  throw new Error('Encrypted content cannot be transmitted over amateur radio');
}
```

3. Move encryption to dedicated module:
- Create `/src/lib/transfer-crypto/` for WebRTC-only encryption
- Keep `/src/lib/crypto/` for signatures only
- Clear architectural separation between radio and local network paths

## Compliance Statement
The codebase is MOSTLY COMPLIANT with amateur radio regulations, but requires immediate attention to:
1. Clearly separate encryption methods from radio transmission paths
2. Add documentation and runtime safeguards
3. Ensure developers understand the compliance boundaries

The presence of encryption methods in the crypto library poses a risk if misused, even though current implementations (ham-server, mesh-networking) don't use these methods for radio transmission.