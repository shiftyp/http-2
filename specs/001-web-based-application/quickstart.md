# Quickstart Guide: HTTP Over Ham Radio

## Overview
This guide walks through setting up and using the HTTP-over-radio web application for ham radio digital communication.

## Prerequisites
- Amateur radio license with digital privileges
- HF radio with CAT control and audio interface
- Computer with sound card or USB audio device
- Serial cable or USB-to-serial adapter for CAT control

## Initial Setup

### 1. Connect Radio Hardware
```bash
# Verify serial port for CAT control
ls /dev/tty* | grep -E '(USB|ACM)'

# Verify audio devices
arecord -l  # List recording devices
aplay -l    # List playback devices
```

### 2. Start the Application
```bash
# Install dependencies
npm install

# Start backend server
npm run backend:start

# In another terminal, start frontend
npm run frontend:start

# Open browser to http://localhost:3000
```

### 3. Configure Station
1. Navigate to Settings page
2. Enter your callsign
3. Select radio model from dropdown
4. Configure CAT control:
   - Select serial port
   - Set baud rate (check radio manual)
5. Configure audio:
   - Select input device (from radio)
   - Select output device (to radio)
   - Choose PTT method

### 4. Generate Station Certificate
```bash
# Generate via CLI
npm run cert:generate --callsign YOUR_CALL

# Or via web UI
# Navigate to Security → Generate Certificate
```

### 5. Test Radio Connection
```bash
# Test CAT control
npm run radio:test

# Expected output:
# ✓ Connected to IC-7300 on /dev/ttyUSB0
# ✓ Frequency: 14.074.000 MHz
# ✓ Mode: USB
```

## Basic Operations

### Hosting a Web Page

1. Create an HTML file:
```html
<!DOCTYPE html>
<html>
<head>
    <title>KA1ABC Ham Radio Page</title>
    <style>
        body { font-family: monospace; max-width: 600px; }
    </style>
</head>
<body>
    <h1>Welcome to KA1ABC</h1>
    <p>QTH: Grid Square FN31pr</p>
    <form method="POST" action="/contact">
        <label>Your Callsign: <input name="callsign" required></label>
        <label>Message: <textarea name="message"></textarea></label>
        <button type="submit">Send</button>
    </form>
</body>
</html>
```

2. Publish the page:
```bash
# Via CLI
npm run page:publish index.html --path /

# Via Web UI
# Navigate to Pages → Upload
# The page is now accessible at http://YOUR_CALL.radio/
```

### Browsing Remote Stations

1. Enter URL in browser bar:
   - Format: `http://CALLSIGN.radio/path`
   - Example: `http://KB2XYZ.radio/`

2. The request will be:
   - Queued for transmission
   - Sent when channel is clear
   - Forwarded through mesh if needed
   - Response displayed when received

### Monitoring Mesh Network

```bash
# View active nodes
npm run mesh:status

# Expected output:
# Active Nodes (Last 1 hour):
# KB2XYZ - 2 hops - LQ: 85% - Last: 5 min ago
# W1ABC  - 1 hop  - LQ: 92% - Last: 2 min ago
# N0DEF  - 3 hops - LQ: 71% - Last: 12 min ago
```

### Submitting Forms

When submitting an HTML form:
1. Form data is serialized
2. POST request queued for transmission
3. Bandwidth policy applied (compression, minification)
4. Response displayed when received

## Testing Scenarios

### Scenario 1: Direct Connection Test
```bash
# Terminal 1 - Start local server
npm run test:server --callsign TEST1

# Terminal 2 - Make request
curl http://TEST1.radio/
# Should return the hosted page
```

### Scenario 2: Mesh Forwarding Test
```bash
# Setup 3-node test network
npm run test:mesh --nodes 3

# Node 1 hosts page
npm run test:publish --node 1 --file test.html

# Node 3 requests from Node 1 (via Node 2)
npm run test:request --from 3 --url http://NODE1.radio/test.html

# Verify forwarding through Node 2
npm run test:verify --hops 2
```

### Scenario 3: Form Submission Test
```bash
# Host form page
npm run test:form --publish

# Submit form data
npm run test:submit --data "callsign=TEST&message=Hello"

# Verify POST processing
npm run test:verify --method POST
```

### Scenario 4: Bandwidth Limit Test
```bash
# Create large HTML file
npm run test:generate --size 10kb

# Attempt transmission (should fail)
npm run test:transmit --file large.html

# Expected: Error - File exceeds bandwidth policy

# Minify and compress
npm run test:optimize --file large.html

# Retry transmission (should succeed)
npm run test:transmit --file large.min.html.gz
```

## Performance Validation

### Bandwidth Usage
- Target: < 2.8 kHz bandwidth on HF
- Measure with spectrum analyzer or SDR
- Verify QPSK constellation

### Transmission Speed
- Typical HTML page (2KB): ~15-20 seconds
- Form submission: ~5-10 seconds
- Depends on band conditions

### Mesh Performance
- Route discovery: < 30 seconds
- Forwarding delay: ~5 seconds per hop
- Cache hit ratio: > 60% expected

## Troubleshooting

### Radio Not Connecting
1. Verify cable connections
2. Check radio CAT settings match app
3. Ensure radio in DATA mode
4. Try different baud rates

### No Audio Transmission
1. Check audio levels (not too high/low)
2. Verify PTT is triggering
3. Test with audio loopback first
4. Check radio is on correct frequency

### Mesh Network Issues
1. Verify certificates are valid
2. Check all nodes on same mesh version
3. Ensure proper frequency coordination
4. Monitor propagation conditions

### Form Submissions Failing
1. Check form action URL is correct
2. Verify bandwidth policy allows POST
3. Ensure form data is minimal
4. Check server-side handler exists

## Command Reference

```bash
# Radio Operations
npm run radio:connect      # Connect to radio
npm run radio:disconnect   # Disconnect from radio
npm run radio:status       # Show connection status

# Page Management  
npm run page:publish       # Publish HTML page
npm run page:list         # List hosted pages
npm run page:delete       # Remove page

# Mesh Operations
npm run mesh:join         # Join mesh network
npm run mesh:leave        # Leave mesh network
npm run mesh:routes       # Show routing table

# Testing
npm run test:all         # Run all tests
npm run test:integration  # Run integration tests
npm run test:radio       # Test radio hardware
```

## Security Notes

- All content transmitted in clear text (FCC requirement)
- Digital signatures verify station identity
- No encryption of user data permitted
- Certificate revocation via mesh broadcast

---
*For more details, see the full documentation*