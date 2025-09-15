# Frequently Asked Questions (FAQ)

## General Questions

### What is HTTP Over Ham Radio?

HTTP Over Ham Radio is a Progressive Web Application that enables web content transmission over amateur radio frequencies using digital modes. It combines modern web technologies with ham radio to create a decentralized, offline-capable communication network.

### Do I need a ham radio license?

Yes, you need a valid amateur radio license to transmit. However, you can receive and decode signals without a license (SWL - Shortwave Listening).

### What equipment do I need?

**Minimum:**
- Computer with modern web browser
- Amateur radio transceiver
- Audio interface (can be as simple as cables)

**Recommended:**
- Radio with CAT control
- USB audio interface
- Good antenna system

### Which browsers are supported?

- ✅ Chrome 90+ (Full support)
- ✅ Edge 90+ (Full support)
- ⚠️ Firefox 88+ (No Web Serial API)
- ⚠️ Safari 14+ (Limited PWA support)

### Is this legal?

Yes, when used according to amateur radio regulations:
- No encryption of content (signatures are allowed)
- Station identification every 10 minutes
- Non-commercial use only
- Follow your country's band plans

## Technical Questions

### How fast can it transmit data?

Data rates depend on conditions:
- **QPSK-750**: 750 bps (poor conditions)
- **QPSK-1500**: 1500 bps (average)
- **QPSK-2800**: 2800 bps (good conditions)
- **Future**: 16-QAM modes up to 8400 bps

### How much compression is achieved?

Typical compression ratios:
- **Text**: 10-20x reduction
- **HTML**: 15-25x with JSX compilation
- **Images**: 5-10x with optimization
- **Average**: 15x reduction

### What's the maximum range?

Range depends on:
- **Frequency**: HF can go worldwide, VHF/UHF is line-of-sight
- **Power**: Higher power = greater range
- **Propagation**: Varies with solar conditions
- **Mode**: Lower data rates work at greater distances

### Can it work offline?

Yes! The PWA works completely offline:
- Install as PWA for offline access
- All features work without internet
- Data stored locally in IndexedDB
- Sync when connection available

### How does mesh networking work?

The app uses AODV routing:
- Automatic route discovery
- Multi-hop communication
- Self-healing network
- No central coordinator needed

## Setup Questions

### Why can't I connect to my radio?

Common issues:
1. **Wrong COM port**: Check device manager
2. **Baud rate mismatch**: Verify radio settings
3. **Drivers not installed**: Install manufacturer drivers
4. **Browser doesn't support Web Serial**: Use Chrome/Edge

### How do I set audio levels?

1. Start with low levels (20-30%)
2. Transmit test signal
3. Check ALC meter (should barely move)
4. Adjust for -6dB peaks on receive
5. Avoid clipping/distortion

### Which frequency should I use?

Recommended frequencies:
- **20m**: 14.085 MHz (USB)
- **40m**: 7.080 MHz (LSB)
- **2m**: 144.620 MHz (USB)

Always check if frequency is in use first!

### My radio isn't listed as supported

The app supports any radio with:
- CAT control (most modern radios)
- SSB capability
- Audio interface

Generic CAT commands work with most radios.

## Usage Questions

### How do I send my first message?

1. Create content in editor
2. Select data rate (start with QPSK-1500)
3. Click "Transmit"
4. Wait for acknowledgment

### What's the difference between modes?

- **QPSK-750**: Most robust, longest range, slowest
- **QPSK-1500**: Balanced performance
- **QPSK-2800**: Fast but needs good signals

### How do I join a mesh network?

1. Settings → Mesh Network
2. Enable mesh mode
3. Enter network name
4. Nodes auto-discover

### Can I transfer files?

Yes, through multiple methods:
- Embed in pages (auto-compressed)
- WebRTC P2P transfer (local network)
- Chunked transfer over radio

### How do I backup my data?

1. Settings → Backup
2. Select data to export
3. Save backup file
4. Store securely

## Troubleshooting

### Poor decode rate

Try these solutions:
1. Reduce data rate
2. Adjust audio levels
3. Improve antenna
4. Check for RFI
5. Enable FEC

### High CPU usage

Reduce load:
1. Disable waterfall display
2. Close unused tabs
3. Reduce FFT size
4. Use hardware acceleration

### Messages not getting through

Check:
1. Both stations on same frequency
2. Matching data modes
3. Good signal strength
4. Correct network settings

### Radio keeps keying up

Possible causes:
1. VOX too sensitive
2. Audio feedback
3. RFI into computer
4. Software bug (report it!)

## Privacy & Security

### Is my data encrypted?

- **Over radio**: No encryption (illegal)
- **Local storage**: Encrypted with Web Crypto
- **P2P transfers**: Optional encryption
- **Signatures**: Always used for authentication

### Who can see my transmissions?

Anyone with:
- Amateur radio receiver
- Correct frequency
- Appropriate software

Assume all transmissions are public.

### How are identities verified?

- ECDSA digital signatures
- Public key infrastructure
- Callsign verification
- Web of trust model

### Can I use this for emergency communication?

Yes, with considerations:
- Practice before emergencies
- Have backup power
- Test equipment regularly
- Follow ARES/RACES procedures

## Development Questions

### Is this open source?

Yes! MIT licensed with additional terms:
- Source on GitHub
- Contributions welcome
- Fork for your needs
- Share improvements

### Can I add features?

Absolutely! We welcome:
- Bug reports
- Feature requests
- Pull requests
- Documentation improvements

### How do I run tests?

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Where's the documentation?

- **User docs**: `/docs` folder
- **API docs**: In-code JSDoc
- **Examples**: `/examples` folder
- **Wiki**: GitHub Wiki

## Community

### Is there a user group?

Yes! Multiple ways to connect:
- GitHub Discussions
- Thursday night net (14.230 MHz)
- Local ham radio clubs
- Online forums

### How can I contribute?

Many ways to help:
- Test and report bugs
- Write documentation
- Translate UI
- Share configurations
- Promote the project

### Where do I report bugs?

GitHub Issues:
1. Search existing issues
2. Create detailed report
3. Include steps to reproduce
4. Attach logs if relevant

### Can I use this commercially?

No, per amateur radio regulations:
- Non-commercial use only
- No business communications
- No compensation for operation
- Educational/personal use OK

## Advanced Topics

### Can I remote control my station?

Yes, with considerations:
- Follow remote operation rules
- Ensure control link security
- Monitor operation
- Have emergency shutdown

### Does it support digital voice?

Not currently, but:
- Architecture supports it
- Could add Codec2
- Bandwidth permitting
- Community interest?

### Can I bridge to internet?

Technically yes, but:
- Check local regulations
- No commercial traffic
- Maintain amateur nature
- Consider security

### What about satellite operation?

Possible with adjustments:
- Doppler correction needed
- Timing considerations
- Power limitations
- Shorter messages

## Comparison

### How does this compare to JS8?

| Feature | HTTP/Radio | JS8 |
|---------|------------|-----|
| Protocol | HTTP-like | Custom |
| Speed | 750-2800 bps | 6-40 wpm |
| Mesh | Yes | Yes |
| Web UI | Yes | No |
| Compression | 10-20x | None |

### Why not use Winlink?

Different purposes:
- **Winlink**: Email gateway
- **HTTP/Radio**: Web content
- Both valuable for different needs

### What about packet radio?

Advantages over packet:
- Modern protocols
- Better compression
- Mesh networking
- Web integration
- Active development

## Getting More Help

### Still have questions?

1. Check documentation in `/docs`
2. Search GitHub issues
3. Ask in Discussions
4. Join Thursday net
5. Email support

### Want personal help?

- Find an Elmer (mentor)
- Join local club
- Attend hamfest
- Take online course

---

*Question not answered? Open an issue on GitHub!*

**73!** 📻