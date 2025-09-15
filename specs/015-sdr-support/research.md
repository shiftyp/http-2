# SDR Support Research Findings

## WebUSB API for SDR Device Communication

**Decision**: Use WebUSB API as primary approach for SDR device communication
**Rationale**: Direct USB device control without drivers, supported by RTL-SDR, HackRF, and emerging devices
**Alternatives considered**: Web Serial API (more complex setup), native bridge applications (defeats browser-first architecture)

**Technical Details**:
- Browser Support: Chrome, Edge, Opera (76% coverage)
- Security: HTTPS only, user gesture required
- Device Support: RTL-SDR (0x0bda:0x2838), HackRF (native WebUSB), uSDR devices

## WebAssembly for Real-Time Signal Processing

**Decision**: Use PulseFFT.wasm with SIMD acceleration for FFT processing
**Rationale**: Near-native performance, SIMD support in all modern browsers, optimized for real-time use
**Alternatives considered**: Pure JavaScript (too slow), WebFFT metalibrary (overkill), PFFFT.wasm (smaller but less optimized)

**Technical Details**:
- Performance: WebAssembly + SIMD achieves 80-90% native performance
- Memory: SharedArrayBuffers for zero-copy data transfer
- Threading: WebWorkers for background FFT computation
- Chunk Size: 1024-4096 samples optimal for latency/resolution balance

## Web Audio API Integration

**Decision**: Use AudioWorklet + AnalyserNode for spectrum analysis and visualization
**Rationale**: Low-latency audio processing, hardware-accelerated rendering, integrates with existing QPSK modem
**Alternatives considered**: ScriptProcessor (deprecated), pure Canvas (no audio integration)

**Technical Details**:
- AudioWorklet: Replaces deprecated ScriptProcessor for low-latency processing
- AnalyserNode: Real-time frequency domain analysis
- Canvas Rendering: Hardware-accelerated waterfall displays at 30-60 FPS

## JavaScript SDR Libraries

**Decision**: Implement custom WebUSB control with IQEngine compatibility
**Rationale**: Existing libraries are incomplete, need integration with HTTP-over-radio protocol
**Alternatives considered**: Full IQEngine adoption (too heavy), pure device drivers (limited functionality)

**Technical Details**:
- RTL-SDR: WebUSB control transfers for frequency, gain, sample rate
- Device Detection: USB vendor/product ID matching with capability discovery
- Data Format: IQ samples compatible with existing QPSK demodulator

## Performance Optimization

**Decision**: Circular buffers + WebGL rendering + 50% FFT overlap
**Rationale**: Smooth real-time visualization while maintaining processing efficiency
**Alternatives considered**: Linear buffers (memory inefficient), CPU rendering (too slow), no overlap (choppy display)

**Technical Details**:
- Memory: Circular buffers for continuous data streaming
- Rendering: WebGL for GPU-accelerated waterfall displays
- Frame Rate: 30-60 FPS target with adaptive quality
- FFT Overlap: 50% overlap for smooth spectrograms

## Security and Browser Compatibility

**Decision**: Implement device allowlists with fallback to proxy servers for unsupported browsers
**Rationale**: Maximum compatibility while maintaining security
**Alternatives considered**: Chrome-only (limits user base), native app requirement (defeats PWA goal)

**Technical Details**:
- WebUSB Restrictions: Blocklisted devices excluded, protected interfaces restricted
- HTTPS Requirement: All WebUSB requires secure contexts
- Firefox Fallback: Native proxy server for browsers without WebUSB support
- Permissions: Device-specific allowlists with user consent

## Integration Architecture

**Decision**: Layered architecture with WebUSB → WebAssembly → Web Audio API → Canvas
**Rationale**: Clean separation of concerns, reusable components, optimal performance path
**Alternatives considered**: Monolithic approach (hard to test), external dependencies (browser compatibility issues)

**Technical Stack**:
1. **Hardware Interface**: WebUSB API for direct device control
2. **Signal Processing**: WebAssembly + SIMD for FFT/filtering
3. **Audio Integration**: Web Audio API for spectrum analysis
4. **Visualization**: Canvas + WebGL for real-time displays
5. **Application Logic**: TypeScript for control and mesh networking integration

## Project-Specific Considerations

**HTTP-over-Radio Integration**:
- Real-time channel analysis before transmission
- Signal quality assessment for adaptive QPSK
- Mesh network visualization showing active stations
- Protocol debugging with waveform visualization
- Content chunk discovery via spectrum monitoring

**Amateur Radio Compliance**:
- FCC Part 97 logging requirements for all decoded transmissions
- Frequency allocation monitoring (14.075-14.085 MHz ranges)
- Station identification integration with existing mesh protocol
- Emergency frequency prioritization capabilities