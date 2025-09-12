# Winlink-Style Registration System

## Overview
Similar to Winlink's gateway registration process, new amateur radio operators submit registration requests that are queued for manual verification by trusted coordinators. The system operates on a first-come, first-verified basis with multiple verification tiers.

## Registration Queue System

### Queue Structure
```
┌─────────────────────────────────────────┐
│         REGISTRATION QUEUE               │
├─────────────────────────────────────────┤
│ Position | Callsign | Submitted  | Status│
├─────────────────────────────────────────┤
│ 001      | N0NEW    | 2024-01-15 | PEND  │
│ 002      | KB2XYZ   | 2024-01-15 | VERIF │
│ 003      | W3ABC    | 2024-01-16 | PEND  │
│ 004      | K4DEF    | 2024-01-16 | HOLD  │
└─────────────────────────────────────────┘

PEND  = Pending verification
VERIF = Being verified
HOLD  = On hold (missing info)
APPR  = Approved
REJ   = Rejected
```

## Registration Workflow

### 1. Initial Registration Request
```mermaid
[New Operator] --> [Submit Request] --> [Queue Position Assigned]
                                            |
                                            v
                                    [Email Confirmation]
                                    "Your request #001 is pending"
```

### 2. Verification Process
```
Queue Entry (FIFO)
    ↓
Coordinator Claims Entry
    ↓
Verification Steps:
├── Check FCC Database (or equivalent)
├── Verify Identity Documents
├── Cross-reference with existing operators
└── Optional: Voice/Video verification
    ↓
Decision:
├── APPROVED → Add to next signing list batch
├── NEEDS INFO → Return to queue as HOLD
└── REJECTED → Remove with reason
```

### 3. Coordinator Roles

#### Regional Coordinators (like Winlink RMSs)
- Assigned geographic regions
- Can verify operators in their region
- Must be in official signing list
- Can process 10 verifications per day

#### Assistant Coordinators
- Can pre-screen applications
- Mark applications as "ready for verification"
- Cannot give final approval
- Help with document collection

## Database Schema

```sql
-- Registration queue table
CREATE TABLE registration_queue (
  queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER UNIQUE NOT NULL,
  callsign TEXT UNIQUE NOT NULL,
  operator_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL,
  state TEXT,
  city TEXT,
  public_key TEXT NOT NULL,
  
  -- Queue management
  submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'PENDING',
  claimed_by TEXT, -- Coordinator callsign
  claimed_date TIMESTAMP,
  
  -- Verification data
  verification_method TEXT,
  verification_notes TEXT,
  fcc_verified BOOLEAN DEFAULT FALSE,
  identity_verified BOOLEAN DEFAULT FALSE,
  
  -- Decision
  decision TEXT, -- APPROVED, REJECTED, HOLD
  decision_date TIMESTAMP,
  decision_by TEXT, -- Coordinator callsign
  rejection_reason TEXT,
  
  -- Tracking
  reminder_sent BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coordinator assignments
CREATE TABLE coordinators (
  callsign TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  region TEXT NOT NULL, -- e.g., "US-Northeast", "EU-Central"
  coordinator_level TEXT DEFAULT 'ASSISTANT', -- REGIONAL, ASSISTANT
  max_daily_verifications INTEGER DEFAULT 10,
  verifications_today INTEGER DEFAULT 0,
  last_verification_date DATE,
  active BOOLEAN DEFAULT TRUE,
  appointed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification history
CREATE TABLE verification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id INTEGER NOT NULL,
  coordinator_callsign TEXT NOT NULL,
  action TEXT NOT NULL, -- CLAIMED, VERIFIED, APPROVED, REJECTED, RELEASED
  notes TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (queue_id) REFERENCES registration_queue(queue_id),
  FOREIGN KEY (coordinator_callsign) REFERENCES coordinators(callsign)
);

-- Regional assignment
CREATE TABLE regional_assignments (
  country TEXT NOT NULL,
  state TEXT,
  coordinator_callsign TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (coordinator_callsign) REFERENCES coordinators(callsign)
);
```

## API Endpoints

### For Applicants
```yaml
/api/registration/submit:
  POST:
    description: Submit registration request
    returns: Queue position and confirmation

/api/registration/status/{callsign}:
  GET:
    description: Check registration status
    returns: Position, status, estimated time

/api/registration/update/{callsign}:
  PUT:
    description: Update registration info
    requires: Confirmation token
```

### For Coordinators
```yaml
/api/coordinator/queue:
  GET:
    description: View registration queue
    parameters:
      region: optional filter by region
      status: optional filter by status
    returns: Paginated queue entries

/api/coordinator/claim/{queue_id}:
  POST:
    description: Claim entry for verification
    returns: Full registration details

/api/coordinator/verify/{queue_id}:
  POST:
    description: Submit verification decision
    body:
      decision: APPROVED|REJECTED|HOLD
      notes: string
      verification_method: string

/api/coordinator/release/{queue_id}:
  POST:
    description: Release claimed entry back to queue
```

## Verification Interface

### Coordinator Dashboard
```
┌──────────────────────────────────────────────────┐
│        COORDINATOR DASHBOARD - W5ABC              │
├──────────────────────────────────────────────────┤
│ Region: US-South | Today: 3/10 verifications     │
├──────────────────────────────────────────────────┤
│                                                  │
│ Queue Entries (Your Region):                    │
│ ┌──────────────────────────────────────────┐   │
│ │ □ #015 N5NEW  - Texas      - 2 days ago  │   │
│ │ □ #018 KE5ABC - Louisiana  - 3 days ago  │   │
│ │ □ #022 W5XYZ  - Oklahoma   - 4 days ago  │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ Currently Verifying:                            │
│ ┌──────────────────────────────────────────┐   │
│ │ #012 AD5DEF - Arkansas                   │   │
│ │ [View Details] [Approve] [Reject] [Hold] │   │
│ └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Verification Screen
```
┌──────────────────────────────────────────────────┐
│         VERIFY REGISTRATION #015                  │
├──────────────────────────────────────────────────┤
│ Callsign: N5NEW                                  │
│ Name: John Smith                                 │
│ Email: n5new@email.com                          │
│ Location: Houston, TX, USA                       │
│                                                  │
│ Verification Checklist:                         │
│ ☑ FCC Database Match                            │
│ ☑ Valid Amateur Extra License                   │
│ ☐ Identity Document Verified                    │
│ ☐ Email Verified                                │
│                                                  │
│ Public Key:                                      │
│ ┌──────────────────────────────────────────┐   │
│ │ -----BEGIN PUBLIC KEY-----                │   │
│ │ MIIBIjANBgkqhkiG9w0BAQEFA...            │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ Supporting Documents:                           │
│ • License.pdf [View]                           │
│ • ID.jpg [View]                                │
│                                                  │
│ Verification Method:                            │
│ ○ Document Review                               │
│ ○ Video Call                                   │
│ ○ In-Person Meeting                            │
│                                                  │
│ Notes: [_________________________________]      │
│                                                  │
│ [Approve] [Request Info] [Reject] [Release]     │
└──────────────────────────────────────────────────┘
```

## Automated Assistance

### FCC Database Integration
```python
async def verify_fcc_license(callsign: str) -> dict:
    """
    Query FCC ULS database for license verification
    """
    # Check FCC database
    # Return license class, status, expiry
    pass

async def check_vanity_eligibility(callsign: str) -> bool:
    """
    Verify if callsign format matches license class
    """
    # Extra: 1x2, 2x1, 2x2 formats
    # Advanced/General: restrictions apply
    pass
```

### Queue Management
```python
async def assign_queue_position() -> int:
    """
    FIFO queue assignment
    """
    # Get next available position
    # Send confirmation email
    # Start 30-day timer
    pass

async def process_stale_entries():
    """
    Daily job to handle old entries
    """
    # Find entries > 30 days old
    # Send reminder
    # Mark for removal after 45 days
    pass
```

## Notification System

### Email Templates
```
Subject: Registration Request #001 Received

Dear [CALLSIGN],

Your registration request has been received and assigned 
queue position #001.

Current estimated processing time: 3-5 business days

You will receive another email when a coordinator begins
reviewing your application.

73,
Ham Radio HTTP Registration System
```

## Trust Levels After Verification

### Immediate Trust (Post-Approval)
- Added to "pending inclusion" list
- Can operate with "provisional" status
- Full privileges after next signing list update

### Signing List Inclusion Timeline
```
Day 1-15: Collect approved registrations
Day 16-20: Batch review and signatures
Day 21: New signing list published
Day 22+: Full network privileges
```

## Statistics and Metrics

### Queue Analytics
- Average wait time: 3-5 days
- Approval rate: ~95%
- Common rejection reasons:
  - Invalid/expired license (40%)
  - Incomplete documentation (35%)
  - Failed identity verification (25%)

### Coordinator Performance
- Average verifications per day: 7
- Time per verification: 10-15 minutes
- Regional coverage: 85%

## Integration with Radio Operations

### Status Display
```
Connecting to N5NEW...
Status: PROVISIONAL (Verified 2024-01-20)
Trust: Awaiting signing list inclusion
Note: Full privileges granted provisionally
```

### Operational Rights
| Status | Transmit | Receive | Relay | Gateway |
|--------|----------|---------|-------|---------|
| Pending | No | Yes | No | No |
| Verified | Yes | Yes | Limited | No |
| In List | Yes | Yes | Yes | Yes |

---
*This system ensures proper vetting while maintaining efficient processing.*