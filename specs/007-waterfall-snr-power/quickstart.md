# Quickstart: Waterfall SNR Power Visualization

## Prerequisites
- Ham radio with audio output connected to computer
- Web Serial API compatible browser (Chrome, Edge)
- Radio CAT control connected via USB

## Quick Test (5 minutes)

### 1. Connect Radio
```bash
# Connect radio audio to computer audio input
# Connect CAT control via USB
# Start the application
npm run dev
```

### 2. Open Waterfall Display
1. Navigate to Radio Operations page
2. Click "Waterfall" tab
3. Display should start immediately showing spectrum

### 3. Verify Basic Functionality
```javascript
// In browser console, verify audio input
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('Audio input ready'))
  .catch(err => console.error('Audio input error:', err));
```

### 4. Test Signal Detection
1. Tune radio to active frequency (e.g., 14.074 MHz for FT8)
2. Observe signals appearing as colored bands
3. Click on a signal to see frequency and SNR
4. Verify SNR calculation shows reasonable values (0-30 dB typical)

### 5. Test Configuration
1. Click Settings icon
2. Change color scheme to "High Contrast"
3. Adjust frequency span to 500 Hz
4. Verify display updates immediately

## Integration Test Scenario

### Scenario: Monitor FT8 Activity
```gherkin
Given the radio is tuned to 14.074 MHz USB
And the waterfall display is open
When FT8 signals are present on the band
Then the display shows signals every 15 seconds
And each signal shows bandwidth of approximately 50 Hz
And SNR values range from -20 to +20 dB
And clicking on a signal displays its exact frequency
```

### Scenario: Export Waterfall Data
```gherkin
Given the waterfall has been running for 2 minutes
When the user clicks "Export" and selects "PNG"
Then a PNG image is downloaded with the waterfall display
And the image contains metadata with frequency and time information
```

## Performance Validation

### Test 1: CPU Usage
```javascript
// Monitor performance
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });

// Measure FFT processing
performance.mark('fft-start');
// ... FFT processing ...
performance.mark('fft-end');
performance.measure('FFT Processing', 'fft-start', 'fft-end');
```

Expected: FFT processing < 10ms per frame

### Test 2: Memory Usage
```javascript
// Check memory usage
if (performance.memory) {
  console.log('Used JS Heap:',
    (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');
}
```

Expected: < 50MB for 60 seconds of history

### Test 3: Frame Rate
```javascript
// Monitor frame rate
let frameCount = 0;
let lastTime = performance.now();

function measureFPS() {
  frameCount++;
  const currentTime = performance.now();
  if (currentTime >= lastTime + 1000) {
    console.log('FPS:', frameCount);
    frameCount = 0;
    lastTime = currentTime;
  }
  requestAnimationFrame(measureFPS);
}
measureFPS();
```

Expected: Consistent 30 FPS

## Common Issues

### No Display
- Check audio input permissions
- Verify audio input device selected
- Check browser console for errors

### Poor Performance
- Reduce update rate to 10Hz
- Decrease history depth to 30 seconds
- Close other resource-intensive applications

### Inaccurate SNR
- Ensure audio levels are not clipping
- Adjust audio input gain
- Wait for noise floor calibration (10 seconds)

## API Testing

### Get Current Spectrum
```bash
# In browser console
fetch('/api/waterfall/spectrum')
  .then(r => r.json())
  .then(data => console.log('Current spectrum:', data));
```

### Update Configuration
```javascript
fetch('/api/waterfall/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    updateRate: 30,
    colorScheme: { name: 'viridis' },
    historyDepth: 60
  })
});
```

### Export Data
```javascript
fetch('/api/waterfall/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    format: 'csv',
    timeRange: {
      start: Date.now() - 60000,
      end: Date.now()
    }
  })
}).then(r => r.text())
  .then(csv => console.log('Exported CSV:', csv));
```

## Success Criteria
- [ ] Waterfall displays within 2 seconds of opening
- [ ] Signals visible with correct frequency alignment
- [ ] SNR calculations match S-meter readings (±3dB)
- [ ] 30 FPS maintained with <50% CPU usage
- [ ] Configuration changes apply immediately
- [ ] Export produces valid PNG/CSV files
- [ ] No memory leaks over 10 minute run