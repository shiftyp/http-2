# Radio Setup Guide

## Supported Radio Models

### Icom Radios

#### IC-7300
- **Connection**: USB cable (built-in interface)
- **Baud Rate**: 19200 (default)
- **CI-V Address**: 0x94
- **Settings**:
  ```
  Menu → Set → Connectors → CI-V
  - CI-V Baud Rate: 19200
  - CI-V USB Port: Link to Remote
  - CI-V USB Echo Back: OFF
  ```

#### IC-9700
- **Connection**: USB cable
- **Baud Rate**: 19200
- **CI-V Address**: 0xA2
- **Special**: Supports 2m/70cm/23cm bands

#### IC-705
- **Connection**: USB-C cable
- **Baud Rate**: 19200
- **CI-V Address**: 0xA4
- **Power**: Can run on battery

### Yaesu Radios

#### FT-991A
- **Connection**: USB cable
- **Baud Rate**: 38400
- **CAT Settings**:
  ```
  Menu → 031 CAT RATE: 38400
  Menu → 032 CAT TOT: 100ms
  Menu → 033 CAT RTS: ENABLE
  ```

#### FTDX10
- **Connection**: USB cable
- **Baud Rate**: 38400
- **Enhanced CAT**: Supports extended commands

### Kenwood Radios

#### TS-890S
- **Connection**: USB cable
- **Baud Rate**: 115200
- **Protocol**: PC command set
- **Settings**: Menu 7-01 through 7-05

#### TS-590SG
- **Connection**: USB cable
- **Baud Rate**: 57600
- **Settings**: Menu 67-69

### Flex Radio

#### Flex-6400/6600
- **Connection**: Ethernet/WiFi
- **Protocol**: SmartSDR API
- **Discovery**: Automatic via mDNS
- **Port**: 4992 (default)

## Connection Instructions

### USB Connection

1. **Install Drivers**
   - Windows: Usually automatic
   - macOS: No drivers needed
   - Linux: Add user to dialout group:
     ```bash
     sudo usermod -a -G dialout $USER
     # Logout and login again
     ```

2. **Connect Cable**
   - Use quality USB cable
   - Connect directly to computer (avoid hubs)
   - Ensure radio is powered on

3. **Configure in Application**
   ```
   Settings → Radio → Connection
   1. Click "Connect Radio"
   2. Select serial port from list
   3. Choose baud rate
   4. Click "Connect"
   ```

### Web Serial API Setup

#### Chrome/Edge
- Enabled by default
- No special configuration needed

#### Firefox
- Not currently supported
- Use Chrome or Edge for radio control

#### Permissions
- Browser will prompt for serial port access
- Click "Allow" and select correct port
- Permission persists for the session

## Audio Interface Setup

### Built-in USB Audio

Most modern radios include USB audio:

1. **Windows**
   - Device appears as "USB Audio CODEC"
   - Set as default in Sound Settings

2. **macOS**
   - Select in System Preferences → Sound
   - Input: USB Audio CODEC
   - Output: USB Audio CODEC

3. **Linux**
   ```bash
   # List audio devices
   arecord -l
   aplay -l

   # Configure in PulseAudio
   pavucontrol
   ```

### External Interfaces

#### SignaLink USB
1. Set jumpers for your radio
2. Adjust TX/RX levels
3. Select in application audio settings

#### RigBlaster
1. Configure for your radio model
2. Set audio levels to 50%
3. Enable VOX or CAT PTT

### Audio Levels

#### Setting Input Level
1. Open Settings → Audio
2. Generate test tone from radio
3. Adjust until VU meter shows -6dB peaks
4. Avoid clipping (red zone)

#### Setting Output Level
1. Start with low output (20%)
2. Transmit test signal
3. Check ALC on radio (should barely move)
4. Increase gradually if needed

## Frequency Configuration

### Digital Mode Frequencies

#### 20 Meters (14 MHz)
```
14.070-14.095 MHz - Digital modes
14.070 MHz - PSK31
14.074 MHz - FT8
14.078 MHz - JS8
14.080 MHz - RTTY
14.230 MHz - SSTV
Suggested: 14.085 MHz for HTTP-over-Radio
```

#### 40 Meters (7 MHz)
```
7.070-7.125 MHz - Digital modes
7.040 MHz - PSK31
7.074 MHz - FT8
7.078 MHz - JS8
Suggested: 7.080 MHz for HTTP-over-Radio
```

#### 2 Meters (144 MHz)
```
144.600-144.650 MHz - Digital modes
145.550 MHz - Packet radio
Suggested: 144.620 MHz for HTTP-over-Radio
```

### Band Plan Compliance

Always follow your country's band plan:
- **USA**: ARRL Band Plan
- **Europe**: IARU Region 1
- **Asia**: IARU Region 3
- **Check**: Local regulations

## CAT Control Commands

### Basic Commands

| Function | Icom | Yaesu | Kenwood |
|----------|------|--------|---------|
| Frequency | FE FE 94 E0 03 FD | FA; | FA; |
| Mode | FE FE 94 E0 04 FD | MD; | MD; |
| PTT On | FE FE 94 E0 1C 00 01 FD | TX1; | TX; |
| PTT Off | FE FE 94 E0 1C 00 00 FD | RX; | RX; |

### Testing CAT Control

1. **Verify Connection**
   ```
   Settings → Radio → Diagnostics
   - Click "Test Connection"
   - Should show "Connected"
   ```

2. **Test Commands**
   - Read frequency
   - Change frequency
   - Toggle PTT
   - Read S-meter

3. **Troubleshooting**
   - Check cable connection
   - Verify baud rate
   - Ensure CAT enabled in radio
   - Try different USB port

## Troubleshooting

### Common Issues

#### "Port not found"
- Check USB cable connection
- Verify drivers installed
- Try different USB port
- Restart radio

#### "Permission denied"
- Linux: Add user to dialout group
- Windows: Run as administrator
- macOS: Grant permission in Security settings

#### "Invalid baud rate"
- Check radio menu settings
- Match application settings
- Try auto-detect feature

#### "No audio"
- Verify audio device selection
- Check cable connections
- Adjust audio levels
- Disable radio AGC

### Radio-Specific Issues

#### Icom: CI-V Echo
- Disable echo in radio settings
- Can cause command loops

#### Yaesu: CAT RTS
- Must be enabled for flow control
- Check Menu 033 on FT-991A

#### Kenwood: IF Output
- Some models need IF output enabled
- Check extended menu settings

## Best Practices

### RF Safety
1. Use minimum power necessary
2. Keep antennas away from people
3. Check RF exposure calculator
4. Follow FCC OET Bulletin 65

### Station Setup
1. **Grounding**
   - Proper RF ground
   - Station ground bus
   - Lightning protection

2. **RFI Prevention**
   - Ferrite cores on cables
   - Shielded audio cables
   - Keep RF away from computer

3. **Antenna Considerations**
   - Resonant antenna preferred
   - Low SWR (<2:1)
   - Appropriate for band/mode

### Operating Procedures

1. **Before Transmitting**
   - Listen first
   - Check frequency is clear
   - Identify with callsign

2. **During Operation**
   - Monitor ALC levels
   - Watch for overheating
   - ID every 10 minutes

3. **After Operating**
   - Log contacts
   - QSL if requested
   - Update logbook

## Advanced Configuration

### Multiple Radios

Configure multiple radios:
```javascript
// config.json
{
  "radios": [
    {
      "name": "IC-7300",
      "port": "COM3",
      "baud": 19200,
      "type": "icom"
    },
    {
      "name": "FT-991A",
      "port": "COM4",
      "baud": 38400,
      "type": "yaesu"
    }
  ]
}
```

### Remote Operation

Control radio over network:
1. Use remote desktop software
2. Configure port forwarding
3. Ensure low latency connection
4. Follow remote operation rules

### Automated Operation

Set up for automatic operation:
1. Configure beacon mode
2. Set operating schedule
3. Enable auto-QSY
4. Configure power limits

## Resources

### Manuals & Documentation
- [Icom CI-V Reference](http://www.icom.co.jp/world/support/)
- [Yaesu CAT Commands](https://www.yaesu.com/)
- [Kenwood PC Command](https://www.kenwood.com/)
- [Flex SmartSDR API](https://www.flexradio.com/)

### Software Tools
- **OmniRig**: Windows CAT control
- **Hamlib**: Cross-platform radio control
- **FLRig**: Universal radio control

### Communities
- **/r/amateurradio**: Reddit community
- **QRZ Forums**: Equipment discussions
- **eHam Reviews**: Radio reviews

---

*For radio-specific questions, consult your radio's manual or manufacturer support.*