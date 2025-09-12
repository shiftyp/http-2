# Amateur Station Registration Process

## Overview
While the official signing list is distributed securely out-of-band, the application supports local registration of new amateur radio operators. These registrations can be collected and submitted to trusted publishers for inclusion in future signing list versions.

## Registration Workflow

### 1. Local Registration (Self-Service)
Operators can register themselves in the application:

```
1. Generate Key Pair
   └── Application creates RSA key pair locally
   
2. Create Registration Request
   ├── Callsign (verified format)
   ├── Operator Name
   ├── Location (Country/State/City)
   ├── Public Key
   └── Self-Signature

3. Local Storage
   ├── Pending registrations (not yet trusted)
   └── Can operate with limited privileges
```

### 2. Endorsement System
Registered stations can endorse each other (web of trust):

```
Station A (registered) ──endorses──> Station B (pending)
Station C (registered) ──endorses──> Station B (pending)
                            ↓
                   Station B becomes locally trusted
```

### 3. Export for Submission
Collected registrations can be exported for official inclusion:

```json
{
  "registrationBatch": {
    "collectorCallsign": "KA1ABC",
    "collectionDate": "2024-01-15",
    "submissions": [
      {
        "callsign": "N0NEW",
        "operatorName": "Jane Smith",
        "location": { "country": "US", "state": "CA", "city": "Sacramento" },
        "publicKey": "-----BEGIN PUBLIC KEY-----...",
        "selfSignature": "...",
        "endorsements": [
          { "callsign": "KA1ABC", "signature": "...", "date": "2024-01-10" },
          { "callsign": "W2OLD", "signature": "...", "date": "2024-01-12" }
        ],
        "registrationProof": {
          "method": "in-person|video|document",
          "verifier": "KA1ABC",
          "date": "2024-01-10",
          "notes": "Verified at local ham club meeting"
        }
      }
    ],
    "batchSignature": "..."
  }
}
```

## Implementation Details

### Registration Levels

1. **Pending**: Newly registered, no endorsements
   - Can receive but not originate traffic
   - Cannot relay for others
   - Marked clearly as "unverified"

2. **Locally Trusted**: Has local endorsements
   - Can originate and receive traffic
   - Can relay with restrictions
   - Still marked as "provisional"

3. **Fully Trusted**: In official signing list
   - Full network privileges
   - Can endorse others
   - Can relay without restrictions

### Registration API Endpoints

```yaml
/api/registration/create:
  POST:
    description: Create new registration request
    body:
      callsign: string
      operatorName: string
      location: object
      publicKey: string

/api/registration/endorse:
  POST:
    description: Endorse another station
    body:
      targetCallsign: string
      endorserCallsign: string
      signature: string

/api/registration/export:
  GET:
    description: Export pending registrations for submission
    returns: Registration batch JSON

/api/registration/status/{callsign}:
  GET:
    description: Check registration status
    returns: pending|locally_trusted|fully_trusted
```

### Local Registration Database

```sql
CREATE TABLE local_registrations (
  callsign TEXT PRIMARY KEY,
  operator_name TEXT NOT NULL,
  country TEXT NOT NULL,
  state TEXT,
  city TEXT,
  public_key TEXT NOT NULL,
  self_signature TEXT NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trust_level INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE endorsements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_callsign TEXT NOT NULL,
  endorser_callsign TEXT NOT NULL,
  signature TEXT NOT NULL,
  endorsement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (target_callsign) REFERENCES local_registrations(callsign)
);

CREATE TABLE registration_proofs (
  callsign TEXT PRIMARY KEY,
  verification_method TEXT NOT NULL,
  verifier_callsign TEXT NOT NULL,
  verification_date TIMESTAMP NOT NULL,
  proof_data TEXT,
  notes TEXT,
  FOREIGN KEY (callsign) REFERENCES local_registrations(callsign)
);
```

## Security Considerations

### Verification Methods
1. **In-Person**: Best - physical meeting at hamfest/club
2. **Video Call**: Good - visual verification of license
3. **Document**: Acceptable - scanned license copy
4. **Self-Declaration**: Minimal - requires multiple endorsements

### Anti-Abuse Measures
- Rate limiting on registrations (max 10 per day)
- Require valid callsign format
- Check against known revoked list
- Minimum endorsements for trust elevation
- Automatic expiry of unendorsed registrations

### Privacy Protection
- Public keys are public
- Personal information requires consent
- Location can be generalized (state only)
- Export requires explicit permission

## User Interface Flow

### Registration Screen
```
┌─────────────────────────────────────┐
│     Register Your Station           │
├─────────────────────────────────────┤
│ Callsign: [________]                │
│ Name:     [________]                │
│ Country:  [▼ USA   ]                │
│ State:    [▼ MA    ]                │
│ City:     [________] (optional)     │
│                                     │
│ [Generate Key Pair]                 │
│                                     │
│ Public Key:                         │
│ ┌─────────────────────────────┐    │
│ │ -----BEGIN PUBLIC KEY-----  │    │
│ │ MIIBIjANBgkqhkiG9w0...     │    │
│ │ -----END PUBLIC KEY-----    │    │
│ └─────────────────────────────┘    │
│                                     │
│ □ I certify I am a licensed amateur │
│                                     │
│ [Register] [Cancel]                 │
└─────────────────────────────────────┘
```

### Endorsement Screen
```
┌─────────────────────────────────────┐
│     Endorse Station                 │
├─────────────────────────────────────┤
│ Station: N0NEW                      │
│ Name: Jane Smith                    │
│ Location: Sacramento, CA, USA       │
│                                     │
│ Current Endorsements: 1 of 3        │
│ • KA1ABC (2024-01-10)              │
│                                     │
│ Verification Method:                │
│ ○ Met in person                    │
│ ○ Video verification                │
│ ○ Document review                   │
│ ○ Known operator                    │
│                                     │
│ Notes: [_____________________]      │
│                                     │
│ ⚠️ By endorsing, you vouch for     │
│    this operator's identity         │
│                                     │
│ [Endorse] [Cancel]                  │
└─────────────────────────────────────┘
```

## Batch Submission Process

### For Club Officers / Coordinators
1. Collect registrations at club meetings
2. Verify licenses in person
3. Export registration batch
4. Submit to official publishers via:
   - Secure upload portal
   - Email with PGP encryption
   - Physical media at conventions

### For Publishers
1. Receive registration batches
2. Verify submitter authority
3. Validate all signatures
4. Cross-check with FCC database
5. Include in next signing list version

## Integration with Operations

### Display Trust Levels
```
[KA1ABC] ✓ Fully Trusted (Official List)
[N1NEW]  ⚠ Locally Trusted (2 endorsements)  
[N2XYZ]  ⚡ Pending (Awaiting endorsements)
```

### Operational Restrictions by Trust Level
| Operation | Pending | Locally Trusted | Fully Trusted |
|-----------|---------|-----------------|---------------|
| Receive traffic | ✓ | ✓ | ✓ |
| Send traffic | Limited | ✓ | ✓ |
| Relay traffic | ✗ | Limited | ✓ |
| Endorse others | ✗ | ✗ | ✓ |
| Priority routing | ✗ | ✗ | ✓ |

---
*This registration system maintains security while allowing organic network growth.*