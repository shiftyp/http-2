# Data Model: Neural Network Adaptive Demodulation

**Feature**: 005-neural-network-adaptive | **Date**: 2025-09-14

## Entity Definitions

### SignalMetrics
Real-time measurements of signal quality used for demodulation decisions.

```typescript
interface SignalMetrics {
  id: string;                    // UUID for tracking
  timestamp: number;              // Unix timestamp in ms
  snr: number;                   // Signal-to-noise ratio in dB
  ber: number;                   // Bit error rate (0-1)
  rssi: number;                  // Received signal strength in dBm
  frequencyOffset: number;       // Frequency offset in Hz
  symbolRate: number;            // Detected symbol rate
  sampleRate: number;            // ADC sample rate
  confidence: number;            // Detection confidence (0-1)
}
```

**Validation Rules**:
- SNR range: -20 to +50 dB
- BER range: 0 to 1
- RSSI range: -120 to 0 dBm
- Frequency offset: ±10 kHz max
- Confidence: 0 to 1

**State Transitions**:
- Created → Measuring → Complete
- Measuring → Error (on timeout)

### DemodulationStrategy
Configuration for a specific demodulation approach (ML or DSP).

```typescript
interface DemodulationStrategy {
  id: string;                    // Strategy identifier
  type: 'neural' | 'dsp' | 'hybrid';
  modulationType: ModulationType; // BPSK, QPSK, 8-PSK, 16-QAM, 64-QAM
  modelVersion?: string;         // ML model version if neural
  modelPath?: string;            // Path to TF.js model files
  confidenceThreshold: number;   // Min confidence to use this strategy
  snrRange: {                    // Optimal SNR range
    min: number;
    max: number;
  };
  priority: number;              // Selection priority (higher = preferred)
  enabled: boolean;              // Active/inactive flag
}

enum ModulationType {
  BPSK = 'BPSK',
  QPSK = 'QPSK',
  PSK8 = '8-PSK',
  QAM16 = '16-QAM',
  QAM64 = '64-QAM'
}
```

**Validation Rules**:
- Confidence threshold: 0.5 to 1.0
- SNR range: min < max, within -20 to +50 dB
- Priority: positive integer
- Model version follows semver format

### PerformanceHistory
Historical record of demodulation attempts for learning and analysis.

```typescript
interface PerformanceHistory {
  id: string;                    // Record ID
  timestamp: number;              // Unix timestamp in ms
  sessionId: string;             // Radio session identifier
  strategy: DemodulationStrategy; // Strategy used
  metrics: SignalMetrics;        // Signal conditions
  modulationType: ModulationType; // Detected modulation
  successRate: number;           // Successful symbols/total (0-1)
  errorCount: number;            // Number of errors detected
  dataProcessed: number;         // Bytes successfully decoded
  inferenceTime?: number;        // ML inference time in ms
  switchReason?: SwitchReason;   // Why strategy was selected
}

enum SwitchReason {
  SNR_CHANGE = 'snr_change',
  BER_THRESHOLD = 'ber_threshold',
  MANUAL_OVERRIDE = 'manual_override',
  CONFIDENCE_LOW = 'confidence_low',
  INITIAL_SELECTION = 'initial_selection'
}
```

**Validation Rules**:
- Success rate: 0 to 1
- Error count: non-negative integer
- Data processed: non-negative integer
- Inference time: 0 to 10000 ms

**Retention Policy**:
- Keep last 24 hours of records (FR-004)
- Aggregate older than 24h into hourly summaries
- Delete summaries older than 7 days

### ModulationProfile
Characteristics of a detected modulation scheme.

```typescript
interface ModulationProfile {
  type: ModulationType;
  constellation: ConstellationPoint[]; // I/Q constellation map
  symbolRate: number;            // Symbols per second
  bitsPerSymbol: number;         // Data bits per symbol
  bandwidth: number;             // Occupied bandwidth in Hz
  minSnr: number;                // Minimum usable SNR in dB
  fecRate: number;               // Forward error correction rate
  pilotTone?: number;            // Pilot tone frequency if present
}

interface ConstellationPoint {
  i: number;                     // In-phase component
  q: number;                     // Quadrature component
  symbol: number;                // Symbol value (0 to 2^bits-1)
}
```

**Validation Rules**:
- Symbol rate: 100 to 10000 symbols/sec
- Bits per symbol: 1 to 6
- Bandwidth: ≤ 2800 Hz (FR-009)
- Min SNR: -10 to +30 dB
- FEC rate: 0 to 1

### AdaptationRules
Conditions and thresholds that trigger demodulation strategy changes.

```typescript
interface AdaptationRules {
  id: string;
  name: string;                   // Rule description
  enabled: boolean;
  condition: RuleCondition;       // Trigger condition
  action: RuleAction;             // Action to take
  hysteresis: number;            // Hysteresis value to prevent flapping
  cooldown: number;              // Min time between triggers (ms)
  priority: number;              // Rule evaluation order
}

interface RuleCondition {
  metric: 'snr' | 'ber' | 'confidence' | 'errors';
  operator: '<' | '>' | '<=' | '>=' | '==';
  threshold: number;
  duration?: number;             // How long condition must persist (ms)
}

interface RuleAction {
  type: 'switch_strategy' | 'fallback' | 'alert';
  targetStrategy?: string;       // Strategy ID to switch to
  targetModulation?: ModulationType;
  notifyUser?: boolean;
}
```

**Validation Rules**:
- Hysteresis: 0 to 10 (dB for SNR, absolute for others)
- Cooldown: 100 to 10000 ms
- Duration: 0 to 60000 ms
- Priority: positive integer

### NeuralModel
Metadata for TensorFlow.js models used in demodulation.

```typescript
interface NeuralModel {
  id: string;
  version: string;               // Semantic version
  type: 'classifier' | 'demodulator';
  architecture: string;          // Model architecture description
  inputShape: number[];          // Expected input tensor shape
  outputShape: number[];         // Output tensor shape
  classes: ModulationType[];     // Supported modulation types
  metrics: ModelMetrics;         // Performance metrics
  size: number;                  // Model size in bytes
  quantized: boolean;            // Whether model is quantized
  createdAt: number;            // Training timestamp
  validatedAt?: number;          // Last validation timestamp
}

interface ModelMetrics {
  accuracy: number;              // Overall accuracy (0-1)
  precision: Record<ModulationType, number>;
  recall: Record<ModulationType, number>;
  f1Score: Record<ModulationType, number>;
  inferenceTime: {              // Benchmark results
    mean: number;               // Mean inference time (ms)
    p95: number;                // 95th percentile (ms)
    p99: number;                // 99th percentile (ms)
  };
  snrPerformance: {             // Accuracy by SNR range
    low: number;                // -20 to 0 dB
    medium: number;             // 0 to 10 dB
    high: number;               // >10 dB
  };
}
```

**Validation Rules**:
- Version follows semantic versioning
- Input shape matches preprocessing output
- Size < 10MB (constraint)
- All metrics between 0 and 1
- Inference times < 1000ms

## Relationships

### Entity Relationships
```
SignalMetrics ──┬──> DemodulationStrategy (current)
                └──> PerformanceHistory (recorded)

DemodulationStrategy ──> ModulationProfile (supports)
                    └──> NeuralModel (uses, if type='neural')

PerformanceHistory ──> DemodulationStrategy (used)
                  └──> SignalMetrics (conditions)

AdaptationRules ──> DemodulationStrategy (triggers switch to)

NeuralModel ──> ModulationType[] (classifies)
```

### Data Flow
1. **Signal Reception**: SignalMetrics created from radio input
2. **Strategy Selection**: AdaptationRules evaluate metrics, select DemodulationStrategy
3. **Demodulation**: Strategy applied using ModulationProfile parameters
4. **Recording**: PerformanceHistory entry created with results
5. **Learning**: History analyzed to update AdaptationRules thresholds

## Storage Schema

### IndexedDB Stores
```typescript
interface DemodulationDB {
  signalMetrics: {
    keyPath: 'id',
    indexes: ['timestamp', 'snr']
  };
  strategies: {
    keyPath: 'id',
    indexes: ['type', 'priority', 'enabled']
  };
  performanceHistory: {
    keyPath: 'id',
    indexes: ['timestamp', 'sessionId', 'successRate']
  };
  adaptationRules: {
    keyPath: 'id',
    indexes: ['priority', 'enabled']
  };
  neuralModels: {
    keyPath: 'id',
    indexes: ['version', 'type']
  };
}
```

### Cache Strategy
- SignalMetrics: Keep last 1000 entries in memory
- Strategies: All in memory (small dataset)
- PerformanceHistory: Last 100 in memory, rest in IndexedDB
- AdaptationRules: All in memory (small dataset)
- NeuralModels: Metadata in memory, weights lazy-loaded

## Access Patterns

### Common Queries
1. **Get current strategy**: By SNR and confidence level
2. **Performance lookup**: Last N entries for modulation type
3. **Rule evaluation**: All enabled rules by priority
4. **Model selection**: Best model for current conditions
5. **History analysis**: Success rate over time window

### Update Patterns
1. **Metrics update**: Every 100ms during reception
2. **Strategy switch**: On rule trigger (min 500ms cooldown)
3. **History write**: After each transmission/reception
4. **Model update**: On user command or scheduled check

## Migration & Versioning

### Schema Version
Current: 1.0.0

### Migration Strategy
1. New fields: Add with defaults for backward compatibility
2. Field removal: Deprecate first, remove in major version
3. Type changes: Create new field, migrate data, remove old
4. Index changes: Can be done without migration

### Backward Compatibility
- All entities include version field
- Unknown fields preserved but not validated
- Graceful degradation for missing neural models

---
*Data model defined for TDD implementation*