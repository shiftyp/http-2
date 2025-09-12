export interface ModemConfig {
  mode: 'HTTP-1000' | 'HTTP-4800' | 'HTTP-5600' | 'HTTP-11200';
  sampleRate: number;
  fftSize: number;
}

export interface ModemMode {
  bandwidth: number;
  symbolRate: number;
  dataRate: number;
  modulation: 'QPSK' | '16-QAM';
  fecRate: number;
  pilotFreq: number;
  carrierFreqs: number[];
  passband: [number, number];
}

const MODEM_MODES: Record<string, ModemMode> = {
  'HTTP-1000': {
    bandwidth: 500,
    symbolRate: 500,
    dataRate: 1000,
    modulation: 'QPSK',
    fecRate: 0.75,
    pilotFreq: 1500,
    carrierFreqs: [1400, 1600],
    passband: [1250, 1750]
  },
  'HTTP-4800': {
    bandwidth: 2400,
    symbolRate: 2400,
    dataRate: 4800,
    modulation: 'QPSK',
    fecRate: 0.75,
    pilotFreq: 500,
    carrierFreqs: [1000, 2000],
    passband: [500, 2900]
  },
  'HTTP-5600': {
    bandwidth: 2800,
    symbolRate: 2800,
    dataRate: 5600,
    modulation: 'QPSK',
    fecRate: 0.75,
    pilotFreq: 400,
    carrierFreqs: [1000, 2000],
    passband: [300, 3100]
  },
  'HTTP-11200': {
    bandwidth: 2800,
    symbolRate: 2800,
    dataRate: 11200,
    modulation: '16-QAM',
    fecRate: 0.75,
    pilotFreq: 400,
    carrierFreqs: [800, 1600, 2400],
    passband: [300, 3100]
  }
};

export class QPSKModem {
  private audioContext: AudioContext;
  private config: ModemConfig;
  private mode: ModemMode;
  private txGain: GainNode;
  private rxGain: GainNode;
  private analyser: AnalyserNode;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private symbolBuffer: number[] = [];
  private sampleBuffer: Float32Array;
  private phase: number = 0;
  private symbolClock: number = 0;
  private snr: number = 0;
  private afc: number = 0;

  constructor(config: ModemConfig) {
    this.config = config;
    this.mode = MODEM_MODES[config.mode];
    this.audioContext = new AudioContext({ sampleRate: config.sampleRate });
    this.sampleBuffer = new Float32Array(config.fftSize);

    this.txGain = this.audioContext.createGain();
    this.txGain.gain.value = 0.8;

    this.rxGain = this.audioContext.createGain();
    this.rxGain.gain.value = 1.0;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = config.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  async init(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private grayEncode(symbol: number): number {
    return symbol ^ (symbol >> 1);
  }

  private grayDecode(gray: number): number {
    let binary = gray;
    for (let mask = gray >> 1; mask !== 0; mask >>= 1) {
      binary ^= mask;
    }
    return binary;
  }

  private convolutionalEncode(data: Uint8Array): Uint8Array {
    const encoded = new Uint8Array(data.length * 2);
    let state = 0;
    let outIdx = 0;

    for (const byte of data) {
      for (let bit = 7; bit >= 0; bit--) {
        const input = (byte >> bit) & 1;
        state = ((state << 1) | input) & 0x3F;
        
        const g0 = this.parity(state & 0x2D);
        const g1 = this.parity(state & 0x3B);
        
        encoded[outIdx++] = (g0 << 1) | g1;
      }
    }

    return encoded;
  }

  private parity(value: number): number {
    let parity = 0;
    while (value) {
      parity ^= 1;
      value &= value - 1;
    }
    return parity;
  }

  private viterbiDecode(encoded: Uint8Array): Uint8Array {
    const K = 7;
    const numStates = 1 << (K - 1);
    const pathMetrics = new Float32Array(numStates);
    const paths = new Array(numStates).fill(null).map(() => []);
    
    pathMetrics.fill(Infinity);
    pathMetrics[0] = 0;

    for (let i = 0; i < encoded.length; i += 2) {
      const symbol = encoded[i];
      const newMetrics = new Float32Array(numStates);
      const newPaths = new Array(numStates).fill(null).map(() => []);
      
      newMetrics.fill(Infinity);

      for (let state = 0; state < numStates; state++) {
        if (pathMetrics[state] === Infinity) continue;

        for (let input = 0; input <= 1; input++) {
          const nextState = ((state << 1) | input) & (numStates - 1);
          const expectedOutput = this.getEncoderOutput(state, input);
          const distance = this.hammingDistance(symbol, expectedOutput);
          const metric = pathMetrics[state] + distance;

          if (metric < newMetrics[nextState]) {
            newMetrics[nextState] = metric;
            newPaths[nextState] = [...paths[state], input];
          }
        }
      }

      pathMetrics.set(newMetrics);
      for (let j = 0; j < numStates; j++) {
        paths[j] = newPaths[j];
      }
    }

    let minMetric = Infinity;
    let bestPath: number[] = [];
    
    for (let state = 0; state < numStates; state++) {
      if (pathMetrics[state] < minMetric) {
        minMetric = pathMetrics[state];
        bestPath = paths[state];
      }
    }

    const decoded = new Uint8Array(Math.ceil(bestPath.length / 8));
    for (let i = 0; i < bestPath.length; i++) {
      if (bestPath[i]) {
        decoded[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }

    return decoded;
  }

  private getEncoderOutput(state: number, input: number): number {
    const nextState = ((state << 1) | input) & 0x3F;
    const g0 = this.parity(nextState & 0x2D);
    const g1 = this.parity(nextState & 0x3B);
    return (g0 << 1) | g1;
  }

  private hammingDistance(a: number, b: number): number {
    let xor = a ^ b;
    let count = 0;
    while (xor) {
      count++;
      xor &= xor - 1;
    }
    return count;
  }

  private modulateQPSK(symbols: number[]): Float32Array {
    const samplesPerSymbol = Math.floor(this.config.sampleRate / this.mode.symbolRate);
    const samples = new Float32Array(symbols.length * samplesPerSymbol);
    
    const omega = 2 * Math.PI * this.mode.carrierFreqs[0] / this.config.sampleRate;
    
    for (let i = 0; i < symbols.length; i++) {
      const symbol = this.grayEncode(symbols[i] & 0x03);
      const I = (symbol & 0x02) ? 1 : -1;
      const Q = (symbol & 0x01) ? 1 : -1;
      
      for (let j = 0; j < samplesPerSymbol; j++) {
        const t = i * samplesPerSymbol + j;
        const cosPhase = Math.cos(omega * t + this.phase);
        const sinPhase = Math.sin(omega * t + this.phase);
        
        samples[t] = 0.5 * (I * cosPhase - Q * sinPhase);
        
        if (t % 100 === 0) {
          const pilot = 0.1 * Math.sin(2 * Math.PI * this.mode.pilotFreq * t / this.config.sampleRate);
          samples[t] += pilot;
        }
      }
    }
    
    this.phase = (omega * symbols.length * samplesPerSymbol + this.phase) % (2 * Math.PI);
    
    return this.raisedCosineFilter(samples);
  }

  private modulate16QAM(symbols: number[]): Float32Array {
    const samplesPerSymbol = Math.floor(this.config.sampleRate / this.mode.symbolRate);
    const samples = new Float32Array(symbols.length * samplesPerSymbol);
    
    const constellation = [
      [-3, -3], [-1, -3], [1, -3], [3, -3],
      [-3, -1], [-1, -1], [1, -1], [3, -1],
      [-3,  1], [-1,  1], [1,  1], [3,  1],
      [-3,  3], [-1,  3], [1,  3], [3,  3]
    ];
    
    const omega = 2 * Math.PI * this.mode.carrierFreqs[0] / this.config.sampleRate;
    
    for (let i = 0; i < symbols.length; i++) {
      const symbol = this.grayEncode(symbols[i] & 0x0F);
      const [I, Q] = constellation[symbol];
      
      for (let j = 0; j < samplesPerSymbol; j++) {
        const t = i * samplesPerSymbol + j;
        const cosPhase = Math.cos(omega * t + this.phase);
        const sinPhase = Math.sin(omega * t + this.phase);
        
        samples[t] = 0.25 * (I * cosPhase - Q * sinPhase);
        
        if (t % 100 === 0) {
          const pilot = 0.1 * Math.sin(2 * Math.PI * this.mode.pilotFreq * t / this.config.sampleRate);
          samples[t] += pilot;
        }
      }
    }
    
    this.phase = (omega * symbols.length * samplesPerSymbol + this.phase) % (2 * Math.PI);
    
    return this.raisedCosineFilter(samples);
  }

  private raisedCosineFilter(samples: Float32Array): Float32Array {
    const beta = 0.35;
    const span = 6;
    const samplesPerSymbol = Math.floor(this.config.sampleRate / this.mode.symbolRate);
    const filterLength = span * samplesPerSymbol + 1;
    const filter = new Float32Array(filterLength);
    
    const T = 1 / this.mode.symbolRate;
    
    for (let i = 0; i < filterLength; i++) {
      const t = (i - filterLength / 2) / this.config.sampleRate;
      const tNorm = t / T;
      
      if (Math.abs(tNorm) === 0.5 / beta) {
        filter[i] = (Math.PI / (4 * T)) * Math.sin(Math.PI / (2 * beta));
      } else if (tNorm === 0) {
        filter[i] = 1 / T;
      } else {
        const numerator = Math.sin(Math.PI * tNorm) * Math.cos(Math.PI * beta * tNorm);
        const denominator = Math.PI * tNorm * (1 - Math.pow(2 * beta * tNorm, 2));
        filter[i] = (1 / T) * numerator / denominator;
      }
    }
    
    const sum = filter.reduce((a, b) => a + b, 0);
    for (let i = 0; i < filterLength; i++) {
      filter[i] /= sum;
    }
    
    const filtered = new Float32Array(samples.length);
    
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      for (let j = 0; j < filterLength; j++) {
        const idx = i - j + Math.floor(filterLength / 2);
        if (idx >= 0 && idx < samples.length) {
          sum += samples[idx] * filter[j];
        }
      }
      filtered[i] = sum;
    }
    
    return filtered;
  }

  async transmit(data: Uint8Array): Promise<void> {
    const encoded = this.convolutionalEncode(data);
    
    const symbols: number[] = [];
    const bitsPerSymbol = this.mode.modulation === 'QPSK' ? 2 : 4;
    
    for (let i = 0; i < encoded.length; i++) {
      for (let bit = 7; bit >= 0; bit -= bitsPerSymbol) {
        const symbol = (encoded[i] >> (bit - bitsPerSymbol + 1)) & ((1 << bitsPerSymbol) - 1);
        symbols.push(symbol);
      }
    }
    
    const modulated = this.mode.modulation === 'QPSK' 
      ? this.modulateQPSK(symbols)
      : this.modulate16QAM(symbols);
    
    const source = this.audioContext.createBufferSource();
    const buffer = this.audioContext.createBuffer(1, modulated.length, this.config.sampleRate);
    buffer.copyToChannel(modulated, 0);
    
    source.buffer = buffer;
    source.connect(this.txGain);
    this.txGain.connect(this.audioContext.destination);
    
    source.start();
    
    await new Promise(resolve => {
      source.onended = resolve;
    });
  }

  startReceive(onData: (data: Uint8Array) => void): void {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const source = this.audioContext.createMediaStreamSource(stream);
        
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.scriptProcessor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          this.processAudio(inputData, onData);
        };
        
        source.connect(this.rxGain);
        this.rxGain.connect(this.analyser);
        this.analyser.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
      })
      .catch(err => {
        console.error('Failed to get audio input:', err);
      });
  }

  private processAudio(samples: Float32Array, onData: (data: Uint8Array) => void): void {
    this.analyser.getFloatTimeDomainData(this.sampleBuffer);
    
    this.estimateSNR();
    
    this.trackPilotTone();
    
    const symbols = this.demodulate(this.sampleBuffer);
    
    if (symbols.length > 0) {
      this.symbolBuffer.push(...symbols);
      
      if (this.symbolBuffer.length >= 128) {
        const chunk = this.symbolBuffer.splice(0, 128);
        const encoded = this.symbolsToBytes(chunk);
        const decoded = this.viterbiDecode(encoded);
        
        if (this.validateCRC(decoded)) {
          onData(decoded);
        }
      }
    }
  }

  private estimateSNR(): void {
    const fftData = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(fftData);
    
    const binWidth = this.config.sampleRate / this.config.fftSize;
    const signalBins: number[] = [];
    const noiseBins: number[] = [];
    
    for (let i = 0; i < fftData.length; i++) {
      const freq = i * binWidth;
      
      if (freq >= this.mode.passband[0] && freq <= this.mode.passband[1]) {
        let isSignal = false;
        for (const carrier of this.mode.carrierFreqs) {
          if (Math.abs(freq - carrier) < binWidth * 2) {
            isSignal = true;
            break;
          }
        }
        
        if (isSignal) {
          signalBins.push(fftData[i]);
        } else {
          noiseBins.push(fftData[i]);
        }
      }
    }
    
    const signalPower = signalBins.reduce((a, b) => a + Math.pow(10, b / 10), 0) / signalBins.length;
    const noisePower = noiseBins.reduce((a, b) => a + Math.pow(10, b / 10), 0) / noiseBins.length;
    
    this.snr = 10 * Math.log10(signalPower / noisePower);
  }

  private trackPilotTone(): void {
    const fftData = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(fftData);
    
    const binWidth = this.config.sampleRate / this.config.fftSize;
    const pilotBin = Math.floor(this.mode.pilotFreq / binWidth);
    
    let maxPower = -Infinity;
    let maxBin = pilotBin;
    
    for (let i = pilotBin - 5; i <= pilotBin + 5; i++) {
      if (i >= 0 && i < fftData.length && fftData[i] > maxPower) {
        maxPower = fftData[i];
        maxBin = i;
      }
    }
    
    const detectedFreq = maxBin * binWidth;
    this.afc = detectedFreq - this.mode.pilotFreq;
    
    if (Math.abs(this.afc) > 10) {
      this.afc *= 0.1;
    }
  }

  private demodulate(samples: Float32Array): number[] {
    const symbols: number[] = [];
    const samplesPerSymbol = Math.floor(this.config.sampleRate / this.mode.symbolRate);
    
    const omega = 2 * Math.PI * (this.mode.carrierFreqs[0] + this.afc) / this.config.sampleRate;
    
    for (let i = 0; i < samples.length - samplesPerSymbol; i += samplesPerSymbol) {
      let I = 0, Q = 0;
      
      for (let j = 0; j < samplesPerSymbol; j++) {
        const t = i + j;
        I += samples[t] * Math.cos(omega * t);
        Q += samples[t] * -Math.sin(omega * t);
      }
      
      I /= samplesPerSymbol;
      Q /= samplesPerSymbol;
      
      const symbol = this.mode.modulation === 'QPSK'
        ? this.demodulateQPSKSymbol(I, Q)
        : this.demodulate16QAMSymbol(I, Q);
      
      symbols.push(this.grayDecode(symbol));
    }
    
    return symbols;
  }

  private demodulateQPSKSymbol(I: number, Q: number): number {
    let symbol = 0;
    if (I > 0) symbol |= 0x02;
    if (Q > 0) symbol |= 0x01;
    return symbol;
  }

  private demodulate16QAMSymbol(I: number, Q: number): number {
    const levels = [-3, -1, 1, 3];
    
    let bestI = 0, bestQ = 0;
    let minDist = Infinity;
    
    for (let i = 0; i < 4; i++) {
      for (let q = 0; q < 4; q++) {
        const dist = Math.pow(I - levels[i], 2) + Math.pow(Q - levels[q], 2);
        if (dist < minDist) {
          minDist = dist;
          bestI = i;
          bestQ = q;
        }
      }
    }
    
    return (bestI << 2) | bestQ;
  }

  private symbolsToBytes(symbols: number[]): Uint8Array {
    const bitsPerSymbol = this.mode.modulation === 'QPSK' ? 2 : 4;
    const bytes = new Uint8Array(Math.ceil(symbols.length * bitsPerSymbol / 8));
    
    let byteIdx = 0;
    let bitIdx = 0;
    
    for (const symbol of symbols) {
      for (let b = bitsPerSymbol - 1; b >= 0; b--) {
        if ((symbol >> b) & 1) {
          bytes[byteIdx] |= 1 << (7 - bitIdx);
        }
        
        bitIdx++;
        if (bitIdx === 8) {
          bitIdx = 0;
          byteIdx++;
        }
      }
    }
    
    return bytes;
  }

  private validateCRC(data: Uint8Array): boolean {
    if (data.length < 4) return false;
    
    const payload = data.slice(0, -4);
    const receivedCRC = (data[data.length - 4] << 24) | 
                        (data[data.length - 3] << 16) |
                        (data[data.length - 2] << 8) |
                        data[data.length - 1];
    
    const calculatedCRC = this.calculateCRC32(payload);
    
    return receivedCRC === calculatedCRC;
  }

  private calculateCRC32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ 0xEDB88320;
        } else {
          crc >>>= 1;
        }
      }
    }
    
    return crc ^ 0xFFFFFFFF;
  }

  stopReceive(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    this.analyser.disconnect();
    this.rxGain.disconnect();
  }

  getSNR(): number {
    return this.snr;
  }

  getAFC(): number {
    return this.afc;
  }

  selectBestMode(): string {
    if (this.snr > 20) return 'HTTP-11200';
    if (this.snr > 10) return 'HTTP-5600';
    if (this.snr > 0) return 'HTTP-4800';
    return 'HTTP-1000';
  }
}