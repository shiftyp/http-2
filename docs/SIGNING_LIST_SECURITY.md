# Signing List Security Model

## Overview
The signing list is a critical security component that authenticates ham radio operators in the network. It functions similarly to DMR ID databases but with enhanced security for HTTP-over-radio operations.

## Security Principles

### 1. No Over-Air Synchronization
**CRITICAL**: The signing list must NEVER be synchronized over radio because:
- FCC Part 97 prohibits encryption over amateur radio
- Unencrypted sync would allow malicious actors to inject false entries
- Man-in-the-middle attacks would be trivial
- Integrity cannot be guaranteed without encryption

### 2. Pre-Distribution Only
The signing list must be distributed through secure out-of-band channels:
- **HTTPS**: Downloaded from trusted servers with certificate pinning
- **Physical Media**: USB drives exchanged at hamfests or club meetings
- **Direct Transfer**: Secure file transfer between trusted operators
- **Never**: Via radio, email attachments, or untrusted sources

### 3. Cryptographic Verification
Every signing list must be cryptographically signed:
```
signing-list.json       # The actual list data
signing-list.json.sig   # Detached signature file
```

Verification process:
1. Check signature against trusted publisher's public key
2. Verify checksum matches
3. Ensure version hasn't regressed
4. Validate all entries have proper signatures

### 4. Read-Only During Operation
Once imported and verified, the signing list is:
- Mounted read-only during radio operations
- Never modified by radio traffic
- Only updated through manual import process
- Backed up before any updates

## Implementation

### Import Process
```bash
# 1. Download new signing list (secure channel only)
wget https://trusted-server.org/signing-list-v2.0.0.json
wget https://trusted-server.org/signing-list-v2.0.0.json.sig

# 2. Verify signature
gpg --verify signing-list-v2.0.0.json.sig signing-list-v2.0.0.json

# 3. Backup current list
cp data/signing-list.json data/signing-list.backup.$(date +%Y%m%d)

# 4. Import new list
npm run signing:import --file signing-list-v2.0.0.json

# 5. Restart application to load new list
```

### Trust Model
```
[Trusted Publisher] --signs--> [Signing List]
        |                            |
        v                            v
[Public Key (pre-installed)] --> [Verification]
                                     |
                                     v
                              [Local Storage]
                                     |
                                     v
                              [Read-Only Use]
```

### Entry Structure
Each entry in the signing list contains:
- Callsign (unique identifier)
- Operator name and location
- Public key for message verification
- Trust level based on endorsements
- Revocation status

### Revocation Handling
Revoked entries are handled through:
1. New signing list versions with revoked flags
2. Out-of-band revocation notices (not via radio)
3. Automatic expiry after non-use period

## Best Practices

### For Operators
1. **Verify Source**: Only import lists from trusted sources
2. **Check Signatures**: Always verify cryptographic signatures
3. **Regular Updates**: Check for updates monthly via secure channels
4. **Backup**: Keep multiple versions for recovery
5. **Report Issues**: Report suspicious entries to publishers

### For Developers
1. **Fail Secure**: Reject unsigned or invalid lists
2. **Version Control**: Never allow version regression
3. **Audit Log**: Log all import attempts
4. **Integrity Checks**: Verify on startup and periodically
5. **Clear Errors**: Provide clear security error messages

## Example Signing List Entry
```json
{
  "callsign": "KA1ABC",
  "operatorName": "John Doe",
  "country": "US",
  "state": "MA",
  "city": "Boston",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "addedDate": "2024-01-15T00:00:00Z",
  "trustLevel": 85,
  "endorsements": ["W1XYZ", "N2DEF", "K3GHI"],
  "revoked": false
}
```

## Security Incident Response
If a security issue is discovered:
1. Immediately cease radio operations
2. Download latest signing list via secure channel
3. Verify no unauthorized modifications
4. Report incident to community
5. Wait for updated list before resuming

## Compliance
This security model ensures:
- **FCC Part 97**: No encryption over radio
- **Authentication**: Verified operator identities
- **Integrity**: Tamper-proof signing list
- **Availability**: Offline operation capability
- **Non-repudiation**: Cryptographic signatures

---
*Remember: The signing list is your trust anchor. Protect it accordingly.*