// -------------------------------------------------------------
// Procedural Web Audio Synthesizer for Hero Movement Routines
// Zero external mp3 dependencies - 100% offline & instantaneous
// -------------------------------------------------------------

class MovementAudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.activeTheme = null;
    this.isPlayingMusic = false;
    this.isFrozen = false;
    this.timerId = null;
    this.currentStep = 0;
    this.bpm = 120;
    this.volume = 0.4;
  }

  _initContext() {
    if (this.audioCtx) return true;
    try {
      const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioContextClass) return false;
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
      return true;
    } catch (e) {
      console.warn('Web Audio API not supported or mocked in this environment:', e.message);
      return false;
    }
  }

  startMusic(theme = 'sunshine_funk', bpm = 120) {
    if (!this._initContext()) return;
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.stopMusic();
    this.activeTheme = theme;
    this.bpm = bpm;
    this.isPlayingMusic = true;
    this.isFrozen = false;
    this.currentStep = 0;

    const intervalMs = (60 / this.bpm / 2) * 1000; // 8th notes
    this.timerId = setInterval(() => {
      if (!this.isPlayingMusic || this.isFrozen) return;
      this._playStep(this.activeTheme, this.currentStep);
      this.currentStep = (this.currentStep + 1) % 16;
    }, intervalMs);
  }

  stopMusic() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isPlayingMusic = false;
    this.isFrozen = false;
    this.currentStep = 0;
  }

  freezeMusic() {
    this.isFrozen = true;
    this.playFreezeChime();
  }

  unfreezeMusic() {
    this.isFrozen = false;
    this.playUnfreezeChime();
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  // --- Procedural Sequencers per Theme ---

  _playStep(theme, step) {
    if (!this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;

    switch (theme) {
      case 'sunshine_funk':
        this._stepSunshineFunk(step, now);
        break;
      case 'jungle_bop':
        this._stepJungleBop(step, now);
        break;
      case 'bedtime_lullaby':
        this._stepBedtimeLullaby(step, now);
        break;
      case 'cosmic_disco':
      default:
        this._stepCosmicDisco(step, now);
        break;
    }
  }

  // 1. Sunshine Funk (Bright, bouncy, upbeat bassline + brass ticks)
  _stepSunshineFunk(step, now) {
    const bassNotes = [130.81, 146.83, 164.81, 174.61, 196.00]; // C3, D3, E3, F3, G3
    if (step === 0 || step === 8) {
      this._playSynthBass(bassNotes[0], now, 0.25);
      this._playKick(now);
    } else if (step === 3 || step === 11) {
      this._playSynthBass(bassNotes[2], now, 0.2);
    } else if (step === 6 || step === 14) {
      this._playSynthBass(bassNotes[3], now, 0.25);
    }

    if (step === 4 || step === 12) {
      this._playSnare(now);
    }

    if (step % 2 === 0) {
      this._playHiHat(now, step % 4 === 2 ? 0.08 : 0.04);
    }

    if (step === 2 || step === 10) {
      this._playTone(523.25, 'triangle', now, 0.15, 0.1);
      this._playTone(659.25, 'triangle', now, 0.15, 0.1);
    }
  }

  // 2. Jungle Bop (Marimba tones + energetic percussion)
  _stepJungleBop(step, now) {
    const marimbaScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    if (step % 2 === 0) {
      const note = marimbaScale[(step / 2) % marimbaScale.length];
      this._playMarimba(note, now);
    }
    if (step === 0 || step === 6 || step === 10) {
      this._playKick(now);
    }
    if (step === 4 || step === 12) {
      this._playWoodblock(now);
    }
  }

  // 3. Bedtime Lullaby (Gentle, warm sine chimes & soft waves)
  _stepBedtimeLullaby(step, now) {
    const lullabyNotes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 349.23];
    if (step % 2 === 0) {
      const idx = (step / 2) % lullabyNotes.length;
      this._playTone(lullabyNotes[idx], 'sine', now, 0.6, 0.08);
    }
  }

  // 4. Cosmic Disco (Synth bassline, disco beat, arpeggiated lead)
  _stepCosmicDisco(step, now) {
    if (step % 4 === 0) {
      this._playKick(now);
    }
    if (step === 4 || step === 12) {
      this._playSnare(now);
    }
    if (step % 2 === 1) {
      this._playHiHat(now, 0.1);
    }
    const bassRoot = 110;
    const freq = (step % 4 === 2) ? bassRoot * 2 : bassRoot;
    this._playSynthBass(freq, now, 0.18);
  }

  // --- Core Sound Synthesis Primitives ---

  _playTone(freq, type, startTime, duration, gainLevel = 0.15) {
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(gainLevel, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {}
  }

  _playSynthBass(freq, startTime, duration) {
    try {
      const osc = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, startTime);
      filter.frequency.exponentialRampToValueAtTime(100, startTime + duration);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {}
  }

  _playMarimba(freq, startTime) {
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    } catch (e) {}
  }

  _playKick(startTime) {
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, startTime);
      osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.12);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    } catch (e) {}
  }

  _playSnare(startTime) {
    try {
      const bufferSize = this.audioCtx.sampleRate * 0.12;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, startTime);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(startTime);
    } catch (e) {}
  }

  _playHiHat(startTime, duration = 0.05) {
    try {
      const bufferSize = this.audioCtx.sampleRate * duration;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(5000, startTime);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(startTime);
    } catch (e) {}
  }

  _playWoodblock(startTime) {
    this._playTone(800, 'triangle', startTime, 0.08, 0.18);
  }

  // --- Specialized FX for Freeze Dance & Fever Burst ---

  playFreezeChime() {
    if (!this._initContext()) return;
    const now = this.audioCtx.currentTime;
    [659.25, 523.25, 415.30, 329.63].forEach((freq, idx) => {
      this._playTone(freq, 'sine', now + idx * 0.08, 0.3, 0.2);
    });
  }

  playUnfreezeChime() {
    if (!this._initContext()) return;
    const now = this.audioCtx.currentTime;
    [329.63, 440.00, 554.37, 659.25].forEach((freq, idx) => {
      this._playTone(freq, 'triangle', now + idx * 0.07, 0.25, 0.2);
    });
  }

  playFeverFanfare() {
    if (!this._initContext()) return;
    const now = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this._playTone(freq, 'sawtooth', now + idx * 0.1, 0.4, 0.25);
      this._playTone(freq * 0.5, 'triangle', now + idx * 0.1, 0.4, 0.2);
    });
  }
}

export const movementSynth = new MovementAudioSynthesizer();
