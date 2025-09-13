# Quickstart: WebRTC Local Data Transfer

**Feature**: Station Data Transfer via WebRTC
**Version**: 1.0.0

## Overview

Transfer your complete ham radio station data (logbooks, messages, configurations, and keys) to another device on your local network using WebRTC peer-to-peer connections. No internet required!

## Prerequisites

- Two devices on the same local network
- Modern web browser with WebRTC support
- Ham radio PWA installed on both devices

## Quick Transfer Guide

### Scenario 1: Complete Station Migration

Transfer everything from old device to new device.

**On the OLD device (sender):**

1. Open the ham radio PWA
2. Navigate to Settings → Transfer Data
3. Select "Send Station Data"
4. Choose what to transfer:
   - ✅ Logbook entries
   - ✅ Messages
   - ✅ Contacts
   - ✅ Configuration
   - ✅ Private keys (requires confirmation)
5. Click "Generate Transfer Code"
6. Display QR code on screen

**On the NEW device (receiver):**

1. Open the ham radio PWA
2. Navigate to Settings → Transfer Data
3. Select "Receive Station Data"
4. Scan the QR code (or enter the 6-character code)
5. Review data preview:
   ```
   Incoming Transfer:
   - 1,543 logbook entries
   - 89 messages
   - 156 contacts
   - Radio configurations
   - Identity keys (CONFIRM REQUIRED)

   Total size: ~2.3 MB
   ```
6. Click "Accept Transfer"
7. Watch progress indicator
8. Review merge results

**Expected Result:**
- New device has all data from old device
- Duplicates intelligently merged
- Can continue operating with same identity

### Scenario 2: Selective Logbook Backup

Share specific contest logs with another operator.

**Sender:**
1. Settings → Transfer Data → Send
2. Select only "Logbook" data type
3. Filter: "Contest: Field Day 2024"
4. Generate shortcode: `FD2024`
5. Share code verbally or via radio

**Receiver:**
1. Settings → Transfer Data → Receive
2. Enter shortcode: `FD2024`
3. Preview shows "256 Field Day QSOs"
4. Accept transfer
5. Choose merge strategy: "Add New Only"

**Expected Result:**
- Only Field Day logs transferred
- No duplicates created
- Original logs unchanged

### Scenario 3: Emergency Backup

Quick backup before field operation.

**Field Laptop:**
1. Transfer → Send → Select All
2. Generate QR code
3. Leave displayed

**Backup Device:**
1. Transfer → Receive
2. Scan QR code
3. Accept all data
4. Store as backup profile

**Recovery (if needed):**
1. Reverse the process
2. Field laptop receives from backup
3. Choose "Replace All" merge strategy

## Testing the Transfer

### Test Case 1: Basic Transfer

```bash
# Terminal 1 (Sender)
1. Open browser to https://localhost:3000
2. Create 5 test QSO entries
3. Settings → Transfer → Send
4. Select "Logbook"
5. Generate QR code

# Terminal 2 (Receiver)
1. Open browser to https://localhost:3000
2. Settings → Transfer → Receive
3. Manually enter shortcode shown below QR
4. Verify preview shows "5 entries"
5. Accept transfer
6. Check logbook has 5 new entries
```

### Test Case 2: Encryption Verification

```bash
1. Start transfer with private keys
2. Note fingerprint on sender: "ABC123..."
3. Verify same fingerprint on receiver
4. Accept only if match
5. Check network inspector:
   - Data channel shows encrypted
   - No plaintext visible
```

### Test Case 3: Network Interruption

```bash
1. Start large transfer (>100 entries)
2. At 50% progress, disconnect WiFi
3. See "Transfer Interrupted" message
4. Reconnect WiFi
5. Click "Restart Transfer"
6. Verify transfer completes
7. Check no duplicates created
```

### Test Case 4: Code Expiration

```bash
1. Generate transfer code
2. Wait 6 minutes
3. Try to connect
4. See "Code Expired" error
5. Generate new code
6. Connect within 5 minutes
7. Transfer succeeds
```

## Validation Checklist

After transfer, verify:

- [ ] Logbook entry count matches expected
- [ ] Messages preserved with attachments
- [ ] Configuration applied correctly
- [ ] Private keys work for signing
- [ ] No data corruption
- [ ] Transfer log created
- [ ] Performance metrics logged

## Performance Expectations

| Data Type | Size | Transfer Time |
|-----------|------|---------------|
| 1000 QSOs | ~500KB | <2 seconds |
| 10000 QSOs | ~5MB | <10 seconds |
| Full station | ~20MB | <30 seconds |
| With images | ~100MB | <2 minutes |

## Troubleshooting

### "Cannot establish connection"
- Verify both devices on same network
- Check firewall allows WebRTC
- Try shortcode instead of QR

### "Transfer failed"
- Check available storage space
- Verify data format compatibility
- Review error in transfer log

### "Merge conflicts detected"
- Review conflict list
- Choose resolution strategy
- Manual review if needed

### "Code expired"
- Generate new code
- Complete connection within 5 minutes
- Consider extending timeout in settings

## Security Notes

- Transfers use end-to-end encryption
- Public key fingerprints displayed for verification
- No data leaves local network
- Private keys require explicit confirmation
- All transfers logged for audit

## Integration Points

This feature integrates with:
- **Logbook**: Merge QSO entries
- **Messages**: Import/export messages
- **Crypto Manager**: Key exchange and encryption
- **IndexedDB**: Data persistence
- **Service Worker**: Background processing

## Success Criteria

Transfer is successful when:
1. ✅ Connection established < 1 second
2. ✅ Data transferred at > 1MB/s
3. ✅ Zero data corruption
4. ✅ Intelligent merge completed
5. ✅ Audit log created
6. ✅ User notified of completion

---
*For development details, see contracts/*.json and data-model.md*