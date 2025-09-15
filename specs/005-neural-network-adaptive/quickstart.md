# Quickstart: Neural Network Adaptive Demodulation

**Feature**: 005-neural-network-adaptive | **Time to Test**: ~10 minutes

## Prerequisites

1. **Development Environment**
   - Node.js 18+ and npm installed
   - Chrome/Edge/Firefox (latest version)
   - ~500MB free disk space for models

2. **Test Data**
   - Sample I/Q recordings (provided in `/test-data/`)
   - Or: SDR device for live testing

## Quick Setup

### 1. Install Dependencies
```bash
# From repository root
npm install @tensorflow/tfjs @tensorflow/tfjs-backend-webgl

# Download pre-trained models
npm run download-models
```

### 2. Load Test Page
```bash
# Start development server
npm run dev

# Open browser to
# http://localhost:5173/test/neural-demod
```

### 3. Verify Model Loading
```javascript
// In browser console
const demod = new NeuralDemodulator();
await demod.loadModel('v1.0.0');
console.log(demod.getStatus());
// Should show: { ready: true, model: 'v1.0.0', backend: 'webgl' }
```

## Test Scenarios

### Scenario 1: Good Signal Conditions (FR-001, AC-1)
**Given**: Radio signal with SNR > 10 dB
**When**: System receives QPSK modulated data
**Then**: Automatically selects optimal demodulation (64-QAM capable)

```javascript
// Test with high SNR signal
const testSignal = generateTestSignal('QPSK', { snr: 15 });
const result = await demod.process(testSignal);

// Verify
console.assert(result.strategy === 'dsp', 'Should use DSP for good SNR');
console.assert(result.confidence > 0.95, 'High confidence expected');
console.assert(result.modulationType === 'QPSK', 'Correct modulation detected');
```

### Scenario 2: Deteriorating Conditions (FR-003, AC-2)
**Given**: Signal quality degrades from 10dB to 0dB SNR
**When**: System detects performance degradation
**Then**: Switches to neural demodulation within 500ms

```javascript
// Start with good signal
let signal = generateTestSignal('QPSK', { snr: 10 });
let result = await demod.process(signal);
const startStrategy = result.strategy;

// Degrade signal
signal = generateTestSignal('QPSK', { snr: 0 });
const startTime = Date.now();
result = await demod.process(signal);
const switchTime = Date.now() - startTime;

// Verify
console.assert(result.strategy === 'neural', 'Should switch to neural');
console.assert(switchTime < 500, `Switch time ${switchTime}ms < 500ms`);
console.assert(result.ber < 0.001, 'BER within acceptable range');
```

### Scenario 3: Interference Adaptation (AC-3)
**Given**: Multiple signals on nearby frequencies
**When**: Interference detected
**Then**: System adapts demodulation approach

```javascript
// Create signal with interference
const signal = generateTestSignal('16-QAM', {
  snr: 8,
  interference: { freq: 1600, power: -10 }
});

const result = await demod.process(signal);

// Verify adaptation
console.assert(result.strategy === 'neural', 'Neural handles interference better');
console.assert(result.adaptations.includes('interference_mitigation'));
console.assert(result.successRate > 0.9, 'Maintains performance');
```

### Scenario 4: Unknown Modulation (AC-4)
**Given**: Transmission with unrecognized modulation
**When**: System receives unknown signal
**Then**: Attempts identification and adaptation

```javascript
// Test with each modulation type
const modulations = ['BPSK', 'QPSK', '8-PSK', '16-QAM', '64-QAM'];

for (const mod of modulations) {
  const signal = generateTestSignal(mod, { snr: 5 });
  const result = await demod.process(signal, { blind: true });

  console.assert(
    result.detectedModulation === mod,
    `Detected ${result.detectedModulation}, expected ${mod}`
  );
}
```

### Scenario 5: Manual Override (FR-011)
**Given**: Automatic selection active
**When**: User manually selects demodulation mode
**Then**: System uses manual selection

```javascript
// Enable manual override
demod.setManualMode('BPSK', 'dsp');

// Process signal that would normally use different mode
const signal = generateTestSignal('16-QAM', { snr: 20 });
const result = await demod.process(signal);

// Verify override
console.assert(result.strategy === 'dsp', 'Manual strategy used');
console.assert(result.forcedModulation === 'BPSK', 'Manual mode active');

// Restore automatic
demod.setAutomaticMode();
```

## Edge Case Tests

### Rapid Signal Changes
```javascript
// Test rapid SNR fluctuation
async function testRapidChanges() {
  const results = [];

  for (let i = 0; i < 10; i++) {
    const snr = Math.random() * 30 - 10; // -10 to +20 dB
    const signal = generateTestSignal('QPSK', { snr });
    results.push(await demod.process(signal));
  }

  // Verify no crashes or hung states
  const strategies = results.map(r => r.strategy);
  console.log('Strategy changes:', strategies);
  console.assert(results.every(r => r.complete), 'All completed');
}
```

### Signal Loss Recovery
```javascript
// Test complete signal loss
async function testSignalLoss() {
  // Good signal
  let signal = generateTestSignal('QPSK', { snr: 10 });
  let result = await demod.process(signal);

  // Complete loss (noise only)
  signal = generateNoise();
  result = await demod.process(signal);

  // Verify graceful handling
  console.assert(result.signalLost === true, 'Signal loss detected');
  console.assert(result.strategy === 'fallback', 'Using fallback');

  // Signal returns
  signal = generateTestSignal('QPSK', { snr: 10 });
  result = await demod.process(signal);
  console.assert(result.recovered === true, 'Recovery detected');
}
```

### Confidence Score Validation (FR-012)
```javascript
// Test confidence scoring
async function testConfidence() {
  const snrLevels = [-5, 0, 5, 10, 15, 20];

  for (const snr of snrLevels) {
    const signal = generateTestSignal('QPSK', { snr });
    const result = await demod.process(signal);

    console.log(`SNR: ${snr}dB, Confidence: ${result.confidence}`);

    // Higher SNR should give higher confidence
    if (snr > 10) {
      console.assert(result.confidence > 0.8, 'High confidence for good SNR');
    } else if (snr < 0) {
      console.assert(result.confidence < 0.6, 'Lower confidence for poor SNR');
    }
  }
}
```

## Performance Validation

### Inference Time Test
```javascript
async function benchmarkInference() {
  const signal = generateTestSignal('16-QAM', { snr: 5, samples: 128 });

  // Warm up
  await demod.process(signal);

  // Benchmark
  const times = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await demod.process(signal);
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const p95 = times.sort()[Math.floor(times.length * 0.95)];

  console.log(`Average: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms`);
  console.assert(avg < 50, 'Average inference < 50ms');
  console.assert(p95 < 100, 'P95 inference < 100ms');
}
```

### Memory Usage Test
```javascript
async function testMemoryUsage() {
  if (!performance.memory) {
    console.log('Memory API not available');
    return;
  }

  const before = performance.memory.usedJSHeapSize;

  // Load model and process
  const demod = new NeuralDemodulator();
  await demod.loadModel('v1.0.0');

  // Process 1000 signals
  for (let i = 0; i < 1000; i++) {
    const signal = generateTestSignal('QPSK', { snr: 5 });
    await demod.process(signal);
  }

  const after = performance.memory.usedJSHeapSize;
  const used = (after - before) / 1024 / 1024;

  console.log(`Memory used: ${used.toFixed(2)}MB`);
  console.assert(used < 50, 'Memory usage < 50MB');
}
```

## Live Radio Test

### Setup
1. Connect radio via CAT control
2. Tune to active digital signal
3. Enable neural demodulation

### Test Steps
```javascript
// Initialize with live radio
const radio = new RadioInterface('/dev/ttyUSB0');
await radio.connect();

const demod = new NeuralDemodulator();
await demod.loadModel('v1.0.0');

// Start demodulation
radio.onData = async (iqSamples) => {
  const result = await demod.process(iqSamples);

  console.log({
    modulation: result.modulationType,
    snr: result.metrics.snr,
    ber: result.metrics.ber,
    strategy: result.strategy,
    confidence: result.confidence
  });

  // Display decoded data
  if (result.decoded) {
    displayDecodedData(result.data);
  }
};

// Monitor for 60 seconds
setTimeout(() => {
  radio.stop();
  console.log(demod.getPerformanceStats());
}, 60000);
```

## Validation Checklist

- [ ] Model loads successfully in < 2 seconds
- [ ] Inference time < 50ms average
- [ ] Memory usage < 50MB
- [ ] Correct modulation detection > 90% (SNR > 0dB)
- [ ] Strategy switching < 500ms
- [ ] BER < 10^-3 at minimum SNR for each mode
- [ ] Confidence scores correlate with SNR
- [ ] Manual override works correctly
- [ ] Performance history saved to IndexedDB
- [ ] No UI blocking during inference
- [ ] Graceful degradation without WebGL
- [ ] All test scenarios pass

## Troubleshooting

### Model Won't Load
```javascript
// Check TensorFlow.js backend
console.log(tf.getBackend()); // Should be 'webgl'

// Fallback to CPU if needed
await tf.setBackend('cpu');
```

### Poor Performance
```javascript
// Enable profiling
tf.env().set('DEBUG', true);

// Check for memory leaks
tf.memory(); // Check numTensors
```

### Incorrect Detection
```javascript
// Increase preprocessing window
demod.setWindowSize(256); // Default 128

// Adjust confidence threshold
demod.setConfidenceThreshold(0.9); // Default 0.8
```

## Success Criteria

The feature is ready when:
1. All acceptance scenarios pass
2. Performance targets met (<50ms inference)
3. Memory usage acceptable (<50MB)
4. Live radio test successful
5. No regressions in existing modem functionality

---
*Run all tests with: `npm run test:neural-demod`*