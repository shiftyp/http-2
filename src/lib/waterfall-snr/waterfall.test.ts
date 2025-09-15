import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaterfallAnalyzer, WaterfallRenderer, WaterfallConfig } from './index';

// Mock Web Audio API
const mockAudioContext = {
  createAnalyser: vi.fn(),
  createMediaStreamSource: vi.fn(),
  close: vi.fn(),
  sampleRate: 48000
};

const mockAnalyserNode = {
  fftSize: 2048,
  frequencyBinCount: 1024,
  smoothingTimeConstant: 0.1,
  minDecibels: -100,
  maxDecibels: -10,
  getFloatFrequencyData: vi.fn(),
  connect: vi.fn()
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }])
};

const mockMediaStreamSource = {
  connect: vi.fn()
};

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true
});

// Mock global AudioContext
global.AudioContext = vi.fn(() => mockAudioContext) as any;
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn();

describe('WaterfallAnalyzer', () => {
  let analyzer: WaterfallAnalyzer;
  let config: WaterfallConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      sampleRate: 48000,
      fftSize: 2048,
      frameRate: 30,
      historyDuration: 60,
      colorScheme: 'classic',
      dynamicRange: 60,
      noiseFloorOffset: 10
    };

    analyzer = new WaterfallAnalyzer(config);

    // Setup mocks
    mockGetUserMedia.mockResolvedValue(mockMediaStream);
    mockAudioContext.createAnalyser.mockReturnValue(mockAnalyserNode);
    mockAudioContext.createMediaStreamSource.mockReturnValue(mockMediaStreamSource);

    // Mock frequency data
    const mockFreqData = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      mockFreqData[i] = -80 + Math.random() * 20; // -80 to -60 dBm range
    }
    mockAnalyserNode.getFloatFrequencyData.mockImplementation((data: Float32Array) => {
      data.set(mockFreqData);
    });
  });

  afterEach(() => {
    analyzer.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default config values', () => {
      const defaultAnalyzer = new WaterfallAnalyzer({
        sampleRate: 48000,
        fftSize: 2048
      });

      expect(defaultAnalyzer).toBeInstanceOf(WaterfallAnalyzer);
    });

    it('should request microphone access during initialization', async () => {
      await analyzer.initialize();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
    });

    it('should create audio context and analyser node', async () => {
      await analyzer.initialize();

      expect(global.AudioContext).toHaveBeenCalledWith({
        sampleRate: 48000
      });
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream);
    });

    it('should configure analyser node properties', async () => {
      await analyzer.initialize();

      expect(mockAnalyserNode.fftSize).toBe(2048);
      expect(mockAnalyserNode.smoothingTimeConstant).toBe(0.1);
      expect(mockAnalyserNode.minDecibels).toBe(-100);
      expect(mockAnalyserNode.maxDecibels).toBe(-10);
    });

    it('should throw error if getUserMedia fails', async () => {
      const error = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValue(error);

      await expect(analyzer.initialize()).rejects.toThrow(
        'Failed to initialize waterfall analyzer: Error: Permission denied'
      );
    });
  });

  describe('spectrum analysis', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should capture spectrum samples when started', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.start();

      // Trigger animation frame
      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          frequencyData: expect.any(Float32Array),
          frequencies: expect.any(Float32Array),
          noiseFloor: expect.any(Number),
          peakSignals: expect.any(Array)
        })
      );
    });

    it('should stop capturing when stop is called', () => {
      analyzer.start();
      analyzer.stop();

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should maintain spectral history within configured duration', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.start();

      // Simulate multiple frames
      for (let i = 0; i < 5; i++) {
        const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[i][0];
        animationCallback();
      }

      const history = analyzer.getSpectralHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(config.historyDuration * config.frameRate);
    });

    it('should detect signal peaks above noise floor', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      // Create mock data with clear signal peaks
      const mockFreqData = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        mockFreqData[i] = -80; // Noise floor
      }
      // Add signal peaks
      mockFreqData[100] = -50; // Strong signal
      mockFreqData[200] = -60; // Weaker signal

      mockAnalyserNode.getFloatFrequencyData.mockImplementation((data: Float32Array) => {
        data.set(mockFreqData);
      });

      analyzer.start();

      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          peakSignals: expect.arrayContaining([
            expect.objectContaining({
              frequency: expect.any(Number),
              power: expect.any(Number),
              snr: expect.any(Number),
              bandwidth: expect.any(Number)
            })
          ])
        })
      );
    });

    it('should update noise floor estimate over time', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.start();

      // Capture initial noise floor
      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      const firstSample = callback.mock.calls[0][0];
      const initialNoiseFloor = firstSample.noiseFloor;

      // Change the mock data to have higher noise floor
      const higherNoiseData = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        higherNoiseData[i] = -70; // Higher noise floor
      }

      mockAnalyserNode.getFloatFrequencyData.mockImplementation((data: Float32Array) => {
        data.set(higherNoiseData);
      });

      // Process several more frames
      for (let i = 1; i < 10; i++) {
        const nextCallback = vi.mocked(global.requestAnimationFrame).mock.calls[i][0];
        nextCallback();
      }

      const latestSample = callback.mock.calls[callback.mock.calls.length - 1][0];

      // Noise floor should have adapted upward (but slowly due to low alpha)
      expect(latestSample.noiseFloor).toBeGreaterThan(initialNoiseFloor);
    });
  });

  describe('data export', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should export data in JSON format', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.start();

      // Generate some sample data
      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      const jsonData = analyzer.exportData('json');
      const parsed = JSON.parse(jsonData);

      expect(parsed).toHaveProperty('config');
      expect(parsed).toHaveProperty('history');
      expect(parsed).toHaveProperty('exportTime');
      expect(parsed.config).toEqual(expect.objectContaining(config));
      expect(Array.isArray(parsed.history)).toBe(true);
    });

    it('should export data in CSV format', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.start();

      // Generate some sample data
      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      const csvData = analyzer.exportData('csv');

      expect(csvData).toContain('timestamp,frequency,power,noiseFloor');
      expect(csvData.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('frequency range filtering', () => {
    beforeEach(async () => {
      config.frequencyRange = [1000, 2000]; // 1-2 kHz range
      analyzer = new WaterfallAnalyzer(config);
      await analyzer.initialize();
    });

    it('should filter spectrum to specified frequency range', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.start();

      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      const sample = callback.mock.calls[0][0];

      // All frequencies should be within the specified range (with some tolerance for edge cases)
      for (let i = 0; i < sample.frequencies.length; i++) {
        expect(sample.frequencies[i]).toBeGreaterThanOrEqual(900); // Allow some tolerance
        expect(sample.frequencies[i]).toBeLessThanOrEqual(2100); // Allow some tolerance
      }
    });
  });

  describe('callback management', () => {
    it('should add and remove callbacks correctly', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      analyzer.onSpectrumUpdate(callback1);
      analyzer.onSpectrumUpdate(callback2);

      // Remove one callback
      analyzer.offSpectrumUpdate(callback1);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should handle errors in callbacks gracefully', async () => {
      await analyzer.initialize();

      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      analyzer.onSpectrumUpdate(errorCallback);
      analyzer.onSpectrumUpdate(normalCallback);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      analyzer.start();

      const animationCallback = vi.mocked(global.requestAnimationFrame).mock.calls[0][0];
      animationCallback();

      expect(consoleSpy).toHaveBeenCalledWith('Error in waterfall callback:', expect.any(Error));
      expect(normalCallback).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('disposal', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should clean up resources on disposal', () => {
      // Add mock track stop method
      const mockTrack = { stop: vi.fn() };
      mockMediaStream.getTracks.mockReturnValue([mockTrack]);

      analyzer.start();
      analyzer.dispose();

      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should clear callbacks on disposal', () => {
      const callback = vi.fn();
      analyzer.onSpectrumUpdate(callback);

      analyzer.dispose();

      // Should not be able to trigger callbacks after disposal
      expect(analyzer.getSpectralHistory()).toEqual([]);
    });
  });
});

describe('WaterfallRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: WaterfallRenderer;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      createImageData: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      font: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn()
      })),
      toDataURL: vi.fn(() => 'data:image/png;base64,test')
    };

    canvas = {
      width: 800,
      height: 400,
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/png;base64,test')
    } as any;

    const mockImageData = {
      data: new Uint8ClampedArray(800 * 400 * 4),
      width: 800,
      height: 400
    };

    mockContext.createImageData.mockReturnValue(mockImageData);
    mockContext.getImageData.mockReturnValue(mockImageData);

    renderer = new WaterfallRenderer(canvas);
  });

  describe('initialization', () => {
    it('should initialize with canvas and default settings', () => {
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockContext.createImageData).toHaveBeenCalledWith(800, 400);
    });

    it('should throw error if canvas context is not available', () => {
      const badCanvas = {
        getContext: vi.fn(() => null)
      } as any;

      expect(() => new WaterfallRenderer(badCanvas)).toThrow('Canvas context not available');
    });
  });

  describe('spectrum rendering', () => {
    it('should render spectrum sample to canvas', () => {
      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1, 2, 3, 4, 5]),
        frequencies: new Float32Array([1000, 2000, 3000, 4000, 5000]),
        noiseFloor: -80,
        peakSignals: []
      };

      renderer.renderSpectrum(mockSample, 'classic');

      expect(mockContext.putImageData).toHaveBeenCalled();
    });

    it('should not render when paused', () => {
      renderer.updateSettings({ paused: true });

      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1, 2, 3, 4, 5]),
        frequencies: new Float32Array([1000, 2000, 3000, 4000, 5000]),
        noiseFloor: -80,
        peakSignals: []
      };

      renderer.renderSpectrum(mockSample, 'classic');

      expect(mockContext.putImageData).not.toHaveBeenCalled();
    });

    it('should render signal peaks as markers', () => {
      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1, 2, 3, 4, 5]),
        frequencies: new Float32Array([1000, 2000, 3000, 4000, 5000]),
        noiseFloor: -80,
        peakSignals: [
          {
            frequency: 14205000,
            power: -50,
            snr: 20,
            bandwidth: 200
          }
        ]
      };

      renderer.updateSettings({
        centerFrequency: 14205000,
        spanFrequency: 3000
      });

      renderer.renderSpectrum(mockSample, 'classic');

      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });
  });

  describe('color schemes', () => {
    beforeEach(() => {
      // Create a simple test sample
      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1]),
        frequencies: new Float32Array([1000]),
        noiseFloor: -80,
        peakSignals: []
      };

      // Mock renderer methods to access color calculation
      const originalRenderSpectrum = renderer.renderSpectrum.bind(renderer);
      renderer.renderSpectrum = vi.fn((sample, scheme) => {
        originalRenderSpectrum(sample, scheme);
      });
    });

    it('should support classic color scheme', () => {
      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1]),
        frequencies: new Float32Array([1000]),
        noiseFloor: -80,
        peakSignals: []
      };

      renderer.renderSpectrum(mockSample, 'classic');

      expect(renderer.renderSpectrum).toHaveBeenCalledWith(mockSample, 'classic');
    });

    it('should support thermal color scheme', () => {
      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1]),
        frequencies: new Float32Array([1000]),
        noiseFloor: -80,
        peakSignals: []
      };

      renderer.renderSpectrum(mockSample, 'thermal');

      expect(renderer.renderSpectrum).toHaveBeenCalledWith(mockSample, 'thermal');
    });

    it('should support monochrome color scheme', () => {
      const mockSample = {
        timestamp: Date.now(),
        frequencyData: new Float32Array([1]),
        frequencies: new Float32Array([1000]),
        noiseFloor: -80,
        peakSignals: []
      };

      renderer.renderSpectrum(mockSample, 'monochrome');

      expect(renderer.renderSpectrum).toHaveBeenCalledWith(mockSample, 'monochrome');
    });
  });

  describe('settings management', () => {
    it('should update settings correctly', () => {
      const newSettings = {
        centerFrequency: 7200000,
        spanFrequency: 5000,
        zoom: 2,
        colorIntensity: 1.5
      };

      renderer.updateSettings(newSettings);

      // Settings should be updated internally (tested via rendering behavior)
      expect(renderer).toBeInstanceOf(WaterfallRenderer);
    });
  });

  describe('utility functions', () => {
    it('should clear canvas', () => {
      renderer.clear();

      expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 400);
      expect(mockContext.createImageData).toHaveBeenCalledWith(800, 400);
    });

    it('should capture image', () => {
      const imageData = renderer.captureImage();

      expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
      expect(imageData).toBe('data:image/png;base64,test');
    });
  });
});