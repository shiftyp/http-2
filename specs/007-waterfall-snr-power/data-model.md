# Data Model: Waterfall SNR Power Visualization

## Core Entities

### SpectrumSample
Represents a single FFT analysis result from audio input.

**Fields**:
- `timestamp: number` - Unix timestamp in milliseconds
- `frequencyBins: Float32Array` - Power values for each frequency bin (2048 points)
- `sampleRate: number` - Audio sample rate (48000, 44100, or 96000)
- `centerFrequency: number` - Radio center frequency in Hz
- `bandwidth: number` - Displayed bandwidth in Hz
- `noiseFloor: number` - Calculated noise floor in dBm

**Validation**:
- frequencyBins.length must equal FFT size (2048)
- sampleRate must be supported value
- centerFrequency must be within amateur bands
- bandwidth must be between 100Hz and 2800Hz

**State Transitions**:
- Created → Processed → Displayed → Archived

### WaterfallConfiguration
User-configurable display settings persisted across sessions.

**Fields**:
- `id: string` - Unique configuration ID
- `name: string` - User-defined preset name
- `colorScheme: ColorScheme` - Selected color mapping
- `updateRate: number` - Display refresh rate in Hz (10-60)
- `historyDepth: number` - Seconds of history to maintain (30-300)
- `frequencyRange: FrequencyRange` - Min/max frequency bounds
- `dynamicRange: DynamicRange` - Min/max dB display range
- `gridEnabled: boolean` - Show frequency/time grid
- `peakHold: boolean` - Enable peak detection display
- `averaging: number` - Number of samples to average (1-10)

**Validation**:
- updateRate must be between 10 and 60
- historyDepth must be between 30 and 300
- frequencyRange must be within radio capabilities
- dynamicRange typically -120dB to 0dB

### SignalDetection
Identified signal within the spectrum.

**Fields**:
- `id: string` - Unique detection ID
- `timestamp: number` - When detected
- `frequency: number` - Center frequency in Hz
- `bandwidth: number` - Signal bandwidth in Hz
- `power: number` - Peak power in dBm
- `snr: number` - Signal-to-noise ratio in dB
- `modulation?: string` - Detected modulation type if identified
- `confidence: number` - Detection confidence (0-1)

**Validation**:
- frequency must be within displayed range
- power must be above noise floor
- snr must be positive for valid detection
- confidence between 0 and 1

**State Transitions**:
- Detected → Tracking → Lost

### NoiseProfile
Background noise characterization for SNR calculations.

**Fields**:
- `timestamp: number` - Profile creation time
- `method: 'minimum' | 'percentile' | 'quiet'` - Estimation method
- `floorLevel: number` - Noise floor in dBm
- `variance: number` - Noise variance across band
- `frequencyProfile: Float32Array` - Noise level per frequency bin
- `updateInterval: number` - How often to recalculate (seconds)

**Validation**:
- floorLevel typically between -120dBm and -60dBm
- variance must be positive
- frequencyProfile.length must match FFT size

### DisplayBuffer
Circular buffer maintaining waterfall history.

**Fields**:
- `samples: SpectrumSample[]` - Array of spectrum samples
- `maxSamples: number` - Maximum samples to retain
- `currentIndex: number` - Current write position
- `wrapped: boolean` - Whether buffer has wrapped

**Validation**:
- maxSamples = updateRate × historyDepth
- currentIndex must be < maxSamples
- samples.length <= maxSamples

**State Transitions**:
- Empty → Filling → Full → Wrapping

## Supporting Types

### ColorScheme
```typescript
type ColorScheme = {
  name: string;
  colors: ColorStop[];
  background: string;
  grid: string;
  text: string;
};

type ColorStop = {
  position: number; // 0-1
  color: string; // CSS color
};
```

### FrequencyRange
```typescript
type FrequencyRange = {
  min: number; // Hz
  max: number; // Hz
  center: number; // Calculated
  span: number; // Calculated
};
```

### DynamicRange
```typescript
type DynamicRange = {
  min: number; // dBm
  max: number; // dBm
  reference: number; // 0 dBm reference level
};
```

## Relationships

```
WaterfallConfiguration 1 ---> * ColorScheme
WaterfallConfiguration 1 ---> 1 FrequencyRange
WaterfallConfiguration 1 ---> 1 DynamicRange

DisplayBuffer 1 ---> * SpectrumSample
SpectrumSample 1 ---> * SignalDetection
SpectrumSample 1 ---> 1 NoiseProfile

SignalDetection * ---> 1 SpectrumSample
NoiseProfile 1 ---> * SpectrumSample
```

## Data Flow

1. **Audio Input** → SpectrumSample creation (30Hz)
2. **SpectrumSample** → NoiseProfile update (1Hz)
3. **SpectrumSample** → SignalDetection analysis
4. **SpectrumSample** → DisplayBuffer insertion
5. **DisplayBuffer** → Canvas rendering
6. **WaterfallConfiguration** → Display parameters
7. **User interaction** → Configuration updates

## Storage Requirements

### Runtime Memory
- SpectrumSample: 8KB each
- DisplayBuffer (60s @ 30Hz): ~14MB
- NoiseProfile: 8KB
- SignalDetection: ~100 bytes each
- Total: ~15-20MB typical

### Persistent Storage (IndexedDB)
- WaterfallConfiguration: ~1KB per preset
- Saved waterfall sessions: ~1MB per minute
- Maximum storage: 50MB allocated

## Performance Constraints

- SpectrumSample creation: <10ms
- SignalDetection processing: <5ms
- NoiseProfile update: <20ms
- DisplayBuffer insertion: O(1)
- Canvas rendering: <15ms per frame