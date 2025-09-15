# WebAssembly Workers for SDR Support

This directory contains WebAssembly modules and worker scripts for real-time SDR signal processing.

## Files

### PulseFFT.wasm (To be downloaded)
- **Purpose**: High-performance FFT processing with SIMD acceleration
- **Source**: https://github.com/mmomtchev/pulse-fft
- **License**: MIT
- **Usage**: Real-time spectrum analysis and waterfall displays

### Configuration
- **FFT Size**: 1024-4096 samples (configurable)
- **Window**: Hamming window for spectral analysis
- **Overlap**: 50% overlap for smooth visualization
- **Performance**: 80-90% native performance with SIMD

## Installation

Download PulseFFT.wasm when first implementing T033:
```bash
# This will be done in T004 setup task
curl -L https://github.com/mmomtchev/pulse-fft/releases/latest/download/pulse-fft.wasm -o PulseFFT.wasm
```

## Security Notes
- WebAssembly modules run in sandboxed environment
- No direct system access beyond Web APIs
- Memory isolated from main thread via SharedArrayBuffers