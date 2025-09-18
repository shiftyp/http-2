# Quickstart Guide: Certificate Management

**Date**: 2025-09-18
**Feature**: Certificate Management for Amateur Radio HTTP Communication

## Overview

This guide walks you through the essential certificate management operations for amateur radio HTTP communication. Follow these steps to set up certificates, request server approval, and manage trust relationships.

## Prerequisites

- Amateur radio license with valid callsign
- Progressive Web App installed and running
- For LoTW certificates: PKCS#12 (.p12) file and password
- Internet connection for initial setup and approvals

## Quick Start Scenarios

### Scenario 1: Generate Self-Signed Certificate

Generate a basic self-signed certificate for immediate use.

```bash
# 1. Open Certificate Manager in PWA
# Navigate to Settings > Certificate Management

# 2. Generate new certificate
Click "Generate Certificate"
Enter callsign: "KA1ABC"
Select license class: "General"
Enter grid square: "FN31pr"
Click "Generate"

# 3. Verify certificate
# Certificate should appear in local certificate list
# Status: "Self-signed" with Trust Level 1
```

**Expected Result**:
- New certificate in local storage
- Available for signing requests immediately
- Can be used for server connections (pending approval)

### Scenario 2: Upload LoTW Certificate

Import an existing LoTW certificate for highest trust level.

```bash
# 1. Obtain LoTW certificate
# Download .p12 file from ARRL LoTW website
# Note the password provided during download

# 2. Upload certificate
Navigate to Certificate Management
Click "Import Certificate"
Select "LoTW PKCS#12"
Choose .p12 file from computer
Enter certificate password
Click "Import"

# 3. Verify import
# Certificate appears with type "LoTW"
# Trust Level: 3 (highest)
# Includes license class and grid square from LoTW
```

**Expected Result**:
- LoTW certificate imported and parsed
- Highest trust level assigned
- Ready for server approval process

### Scenario 3: Request Server Approval

Connect to a server and complete the approval process.

```bash
# 1. Connect to server
Enter server URL: "https://ka2xyz.radio/"
Select certificate: "KA1ABC (LoTW)"
Click "Connect"

# 2. Solve CAPTCHA challenge
# Server presents challenge: "What is 14 + 23?"
Enter answer: "37"
Click "Submit Solution"

# 3. Wait for approval
# Request appears in server operator's queue
# Check status: Certificate Management > Pending Requests
# Status: "Pending Approval"

# 4. Receive approval notification
# Server operator approves request
# Status changes to "Approved"
# Can now access server with full privileges
```

**Expected Result**:
- Certificate request submitted successfully
- CAPTCHA solution signed and stored
- Server approval received
- Full access to server resources granted

### Scenario 4: Handle CAPTCHA Challenge

Solve various types of CAPTCHA challenges.

```bash
# Math Challenge
Question: "What is 15 × 3?"
Answer: "45"

# Ham Knowledge Challenge
Question: "What frequency band is 21.205 MHz?"
Answer: "15 meters"

# Pattern Challenge
Question: "Next in sequence: 2, 4, 8, 16, ?"
Answer: "32"

# Geography Challenge
Question: "What grid square contains Denver, Colorado?"
Answer: "DM79"

# Multiple Choice Challenge
Question: "What is the maximum power for Technician class on 2 meters?"
Options: ["5 watts", "50 watts", "200 watts", "1500 watts"]
Answer: "1500 watts"
```

**Tips**:
- Take time to read questions carefully
- Ham knowledge questions are basic license material
- Pattern questions follow simple mathematical sequences
- Geography questions focus on major cities and grid squares

## Step-by-Step Procedures

### A. Certificate Generation

**For Self-Signed Certificates:**

1. **Open Certificate Manager**
   ```
   PWA → Settings → Certificate Management → Generate Certificate
   ```

2. **Enter Station Information**
   ```
   Callsign: [Your callsign, e.g., "W1AW"]
   License Class: [Extra|Advanced|General|Technician]
   Grid Square: [6-character grid, e.g., "FN31pr"]
   Validity Period: [365 days default]
   ```

3. **Generate and Store**
   ```
   Click "Generate Certificate"
   Certificate created with Web Crypto API
   Private key stored in IndexedDB (encrypted)
   Public certificate available for sharing
   ```

4. **Verify Generation**
   ```
   Check certificate list
   Verify callsign and details
   Test signing functionality
   Export public certificate if needed
   ```

### B. PKCS#12 Import (LoTW/ARRL)

1. **Prepare Certificate File**
   ```
   Download .p12 file from LoTW or ARRL
   Note the certificate password
   Ensure file is not corrupted
   ```

2. **Import Process**
   ```
   Certificate Management → Import Certificate
   Select "PKCS#12 (.p12)" format
   Choose file from device storage
   Enter certificate password
   ```

3. **Parse and Validate**
   ```
   System parses PKCS#12 structure
   Extracts X.509 certificate and private key
   Validates certificate chain
   Imports using Web Crypto API
   ```

4. **Confirm Import**
   ```
   Certificate appears in list
   Type shows "LoTW" or "ARRL"
   Trust level set to 2 (ARRL) or 3 (LoTW)
   License information extracted from certificate
   ```

### C. Server Connection and Approval

1. **Initial Connection**
   ```
   Enter server URL or select from bookmarks
   Choose certificate from available list
   System generates connection request
   ```

2. **CAPTCHA Challenge**
   ```
   Server sends CAPTCHA challenge
   Review question and type carefully
   Submit answer through form
   System signs solution with certificate
   ```

3. **Request Submission**
   ```
   Complete certificate request created
   Includes station info and signed CAPTCHA
   Submitted to server approval queue
   Request ID provided for tracking
   ```

4. **Await Approval**
   ```
   Server operator reviews request
   Check status in Certificate Management
   Receive WebSocket notification when approved
   Certificate marked as server-approved
   ```

### D. Trust Chain Management

1. **View Trust Relationships**
   ```
   Certificate Management → Trust Chains
   Select certificate to view relationships
   See servers that have approved certificate
   View trust chain depth and score
   ```

2. **Update Trust Information**
   ```
   System automatically updates trust chains
   New approvals refresh trust scores
   Expired relationships are marked
   Consensus status shown for federated trust
   ```

3. **Manual Trust Verification**
   ```
   Right-click certificate → Verify Trust
   System checks trust chain validity
   Validates all intermediate certificates
   Shows detailed trust path information
   ```

## Common Operations

### Certificate Export

Export certificates for backup or transfer:

```bash
# Export public certificate (PEM format)
Certificate → Export → PEM Format
# Downloads .pem file with public certificate

# Export full certificate (includes private key)
Certificate → Export → PKCS#12 Format
Enter export password
# Downloads .p12 file (password protected)

# Export certificate chain
Certificate → Export → Chain (PEM)
# Downloads .pem with full trust chain
```

### Certificate Switching

Switch between multiple certificates:

```bash
# View available certificates
Certificate Management → Certificate List

# Set primary certificate
Select certificate → Set as Primary
# Used as default for new connections

# Switch during session
Connection Settings → Change Certificate
Select different certificate
# Starts new session with selected certificate
```

### Rate Limit Management

Handle CAPTCHA rate limiting:

```bash
# Check rate limit status
Certificate Management → CAPTCHA Status
# Shows remaining attempts and reset time

# If rate limited
Wait for reset time (shown in status)
Try different server (rate limits are per-server)
Use different certificate if available

# Rate limit resets
3 attempts per hour per callsign per server
Successful solve resets the counter
Multiple certificates = separate limits
```

### Approval Status Tracking

Monitor certificate approval status:

```bash
# View pending requests
Certificate Management → Pending Requests
# Shows all submitted requests awaiting approval

# Check specific request
Click request ID for details
# Shows submission time, CAPTCHA status, server info

# Handle rejected requests
Review rejection reason
Fix issues (invalid CAPTCHA, bad info)
Resubmit with corrections
```

## Error Handling

### Common Issues and Solutions

**Certificate Import Fails:**
```
Error: "Invalid PKCS#12 file"
Solution: Verify file integrity, check password

Error: "Unsupported certificate format"
Solution: Ensure file is .p12 format, not .pem

Error: "Certificate expired"
Solution: Obtain new certificate from issuer
```

**CAPTCHA Problems:**
```
Error: "CAPTCHA expired"
Solution: Request new challenge, solve within time limit

Error: "Rate limit exceeded"
Solution: Wait for reset time, use different server

Error: "Invalid signature"
Solution: Check certificate validity, regenerate if needed
```

**Server Connection Issues:**
```
Error: "Certificate not approved"
Solution: Complete approval process, wait for operator

Error: "Trust chain validation failed"
Solution: Check certificate chain, verify trust relationships

Error: "Server unreachable"
Solution: Verify URL, check internet connection
```

### Troubleshooting Steps

1. **Check Certificate Validity**
   ```
   Verify expiration date
   Confirm certificate type matches requirements
   Test certificate signing functionality
   ```

2. **Verify Network Connection**
   ```
   Test internet connectivity
   Check server availability
   Verify WebSocket connection for real-time updates
   ```

3. **Review Approval Status**
   ```
   Check if server operator is available
   Verify CAPTCHA was solved correctly
   Confirm all required information provided
   ```

4. **Reset if Necessary**
   ```
   Clear certificate cache if corrupted
   Regenerate self-signed certificate
   Re-import LoTW certificate with fresh download
   ```

## Best Practices

### Security
- Keep private keys secure (never share)
- Use strong passwords for PKCS#12 exports
- Regularly update certificates before expiration
- Monitor approval notifications for unauthorized requests

### Performance
- Set primary certificate for fastest connections
- Keep certificate list manageable (< 10 active)
- Cache trust chains to avoid repeated validation
- Use LoTW certificates for best server acceptance

### Network Etiquette
- Don't spam CAPTCHA attempts
- Provide accurate station information
- Respect server operator approval times
- Follow band plan and power limitations

## Next Steps

After completing this quickstart:

1. **Explore Advanced Features**
   - Trust chain federation
   - Custom CAPTCHA pools (server operators)
   - Certificate revocation and appeals
   - Bulk trust operations

2. **Set Up Server Operations**
   - Configure approval workflow
   - Customize CAPTCHA challenges
   - Set up trust federation
   - Monitor certificate requests

3. **Integration with Applications**
   - Use certificates for page signing
   - Implement message authentication
   - Set up automated trust verification
   - Configure emergency communication protocols

For detailed technical information, see:
- `data-model.md` - Complete data structures
- `contracts/` - API specifications
- `research.md` - Technical implementation details