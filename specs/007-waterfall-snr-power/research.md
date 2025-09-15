# Research: Waterfall SNR Power Visualization

## Technical Decisions

### 1. Display Update Rate
**Decision**: 30Hz (33ms update interval)
**Rationale**:
- Balances smooth visual updates with CPU/GPU efficiency
- Human perception threshold for smooth motion is ~24Hz
- Provides headroom for processing without overwhelming browser
**Alternatives Considered**:
- 10Hz: Too choppy for real-time signal tracking
- 60Hz: Unnecessary for spectrum display, increases CPU load

### 2. FFT Size and Resolution
**Decision**: 2048-point FFT with configurable window functions
**Rationale**:
- Already used in existing qpsk-modem implementation
- Provides ~23Hz frequency resolution at 48kHz sample rate
- Good balance between frequency and time resolution
**Alternatives Considered**:
- 1024-point: Insufficient frequency resolution
- 4096-point: Too much latency for real-time display

### 3. History Buffer Duration
**Decision**: 60 seconds scrolling history with configurable depth
**Rationale**:
- Sufficient to observe propagation patterns
- Manageable memory footprint (~14MB at 30Hz update rate)
- Allows pattern recognition without overwhelming storage
**Alternatives Considered**:
- 30 seconds: Too short for band condition analysis
- 5 minutes: Excessive memory usage for browser environment

### 4. Canvas Rendering Strategy
**Decision**: Dual canvas approach - offscreen for FFT rendering, onscreen for display
**Rationale**:
- Leverages Web Workers for FFT computation
- Prevents UI blocking during intensive calculations
- Enables smooth scrolling without recalculation
**Alternatives Considered**:
- WebGL: Overkill for 2D waterfall, adds complexity
- SVG: Poor performance for pixel-level manipulation

### 5. Color Mapping
**Decision**: Configurable color maps with HSL interpolation
**Rationale**:
- HSL provides intuitive color gradients
- Multiple presets for different viewing conditions
- Preserves signal detail across dynamic range
**Alternatives Considered**:
- Fixed RGB mapping: Less flexible for user preferences
- Grayscale only: Loses important signal distinction

### 6. Audio Sample Rate Support
**Decision**: 48kHz primary, with 44.1kHz and 96kHz fallback
**Rationale**:
- 48kHz is standard for audio interfaces
- Matches existing modem implementation
- Provides adequate bandwidth for HF spectrum
**Alternatives Considered**:
- 192kHz: Unnecessary for HF bands, increases processing load
- 22.05kHz: Insufficient for wideband monitoring

### 7. Data Export Format
**Decision**: PNG image export with embedded metadata, CSV for raw data
**Rationale**:
- PNG preserves visual representation for sharing
- CSV enables further analysis in external tools
- Metadata in PNG comments preserves context
**Alternatives Considered**:
- Binary format: Not human-readable, requires custom tools
- JSON only: Large file sizes for spectrum data

### 8. Performance Optimization
**Decision**: RequestAnimationFrame with frame skipping
**Rationale**:
- Browser-optimized rendering pipeline
- Automatic throttling when tab not visible
- Graceful degradation under load
**Alternatives Considered**:
- setInterval: Less efficient, no browser optimization
- setTimeout loop: Inconsistent timing

### 9. SNR Calculation Method
**Decision**: Noise floor estimation using minimum statistics
**Rationale**:
- Adaptive to changing band conditions
- No prior calibration required
- Works across different signal types
**Alternatives Considered**:
- Fixed noise floor: Inaccurate with changing conditions
- ML-based: Unnecessary complexity for basic SNR

### 10. Browser Compatibility
**Decision**: Target modern browsers with Web Audio API support
**Rationale**:
- All target browsers support required APIs
- Progressive enhancement for older browsers
- Aligns with PWA requirements
**Alternatives Considered**:
- Polyfills for older browsers: Maintenance burden
- Native app: Against PWA architecture principle

## Integration Points

### Existing Libraries to Leverage
1. **qpsk-modem**: FFT implementation and signal processing
2. **radio-control**: Frequency and mode information
3. **database**: User preference storage
4. **compression**: Efficient data storage for history

### New Components Required
1. **WaterfallDisplay**: Main visualization component
2. **SpectrumAnalyzer**: FFT processing and analysis
3. **SignalDetector**: Peak detection and SNR calculation
4. **ColorMapper**: Dynamic color gradient generation

## Performance Considerations

### Memory Budget
- FFT buffer: 16KB (2048 points × 4 bytes × 2 for I/Q)
- History buffer: 14MB (60 seconds × 30Hz × 2048 points × 4 bytes)
- Canvas buffers: 8MB (1920×1080 × 4 bytes for RGBA)
- Total: ~38MB typical, 50MB maximum

### CPU Usage Targets
- FFT computation: <10ms per frame
- Canvas rendering: <5ms per frame
- Total frame budget: <33ms (30Hz target)
- Idle CPU usage: <5%

### Optimization Strategies
1. Web Worker for FFT computation
2. Offscreen canvas for rendering
3. Typed arrays for efficient memory access
4. Frame skipping under load
5. Adaptive quality based on performance

## Testing Approach

### Unit Tests
- FFT accuracy validation
- SNR calculation correctness
- Color mapping functions
- Signal detection algorithms

### Integration Tests
- Audio input pipeline
- Canvas rendering pipeline
- User interaction handling
- Preference persistence

### Performance Tests
- Frame rate consistency
- Memory leak detection
- CPU usage profiling
- Stress testing with multiple signals

## Resolved Clarifications

All NEEDS CLARIFICATION items from the specification have been resolved:
- Update rate: 30Hz
- Minimum frequency span: 100Hz
- History duration: 60 seconds
- Export formats: PNG and CSV
- Sample rates: 48kHz primary, 44.1/96kHz supported