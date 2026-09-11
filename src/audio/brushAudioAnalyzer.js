// -------------------------------------------------------------
// Acoustic Microphone Toothbrush Scrubbing Analyzer
// Analyzes high-frequency bristle-to-enamel friction (1.8 - 4.5 kHz)
// 100% Client-side & Private - Zero audio is stored or transmitted
// -------------------------------------------------------------

class BrushAudioAnalyzer {
  constructor() {
    this.audioCtx = null;
    this.stream = null;
    this.source = null;
    this.filter = null;
    this.analyser = null;
    this.isListeningActive = false;
    this.cadenceInterval = null;
    this.cadenceScore = 0; // 0 to 100%
    this.isScrubbing = false;
    this.recentEnergies = [];
    this.onCadenceCallback = null;
  }

  async startListening(onCadenceUpdate = null) {
    this.onCadenceCallback = onCadenceUpdate;
    if (this.isListeningActive) return true;

    try {
      if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
        console.warn('Microphone access not supported in this environment.');
        return false;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;

      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.source = this.audioCtx.createMediaStreamSource(this.stream);

      // Bandpass filter centered at 2800 Hz to isolate bristle scrubbing friction
      this.filter = this.audioCtx.createBiquadFilter();
      this.filter.type = 'bandpass';
      this.filter.frequency.setValueAtTime(2800, this.audioCtx.currentTime);
      this.filter.Q.setValueAtTime(2.5, this.audioCtx.currentTime);

      // Analyser Node
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      this.source.connect(this.filter);
      this.filter.connect(this.analyser);

      this.isListeningActive = true;
      this.recentEnergies = [];

      // Analysis Loop: 20 times per second
      const buffer = new Float32Array(this.analyser.fftSize);
      this.cadenceInterval = setInterval(() => {
        if (!this.isListeningActive || !this.analyser) return;

        this.analyser.getFloatTimeDomainData(buffer);
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
          sumSq += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sumSq / buffer.length);

        this.recentEnergies.push(rms);
        if (this.recentEnergies.length > 10) {
          this.recentEnergies.shift();
        }

        const avgEnergy = this.recentEnergies.reduce((a, b) => a + b, 0) / this.recentEnergies.length;
        const threshold = 0.012;
        this.isScrubbing = avgEnergy > threshold;

        if (this.isScrubbing) {
          this.cadenceScore = Math.min(100, this.cadenceScore + 8);
        } else {
          this.cadenceScore = Math.max(0, this.cadenceScore - 4);
        }

        if (typeof this.onCadenceCallback === 'function') {
          this.onCadenceCallback({
            isScrubbing: this.isScrubbing,
            cadenceScore: Math.round(this.cadenceScore),
            rmsEnergy: rms
          });
        }
      }, 50);

      return true;
    } catch (err) {
      console.warn('Microphone audio brushing analyzer unavailable:', err.message);
      this.stopListening();
      return false;
    }
  }

  stopListening() {
    this.isListeningActive = false;
    if (this.cadenceInterval) {
      clearInterval(this.cadenceInterval);
      this.cadenceInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.filter) {
      this.filter.disconnect();
      this.filter = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }
    this.cadenceScore = 0;
    this.isScrubbing = false;
    this.recentEnergies = [];
  }

  getCadence() {
    return {
      isScrubbing: this.isScrubbing,
      cadenceScore: Math.round(this.cadenceScore),
      isListening: this.isListeningActive
    };
  }

  isListening() {
    return this.isListeningActive;
  }
}

export const brushAudioAnalyzer = new BrushAudioAnalyzer();
