// Web Audio API Procedural Cartoon Sound Engine
// Distinct cartoon tactile sound effects for micro-interactions:
// - Buttons that "bloop" with bouncy rubbery resonance
// - Coins that chime musically in bright major arpeggios
// - Celebratory fanfares when marking tasks/habits complete
// - Springy "boings", fairy dust "sparkles", snack "crunches", and "rubber pops"

let audioCtx = null;
let isMuted = false;
let discoInterval = null;
let battleRhythmInterval = null;
let workoutBeatInterval = null;
let lullabyInterval = null;
let lullabyNoteIndex = 0;
let lullabyActive = false;
let lullabyDucked = false;
let lullabyMasterGain = null;
let battleBpm = 118;
let lastBattleRhythmOnBeat = null;
let lastBloopTime = 0;
let activeBattleMusicTrack = 'cosmic_pulse';

// BATTLE_MUSIC_TRACKS: selectable procedural note/instrumentation presets for
// startBattleRhythm(), unlocked via the Unlock Shop's "Music" category and
// equipped through hero.equippedGear.music. Each track reuses the same
// generative drum & bass engine (no new audio provider/files) but varies the
// bass/lead note sets and lead oscillator timbre for a genuinely distinct feel.
const BATTLE_MUSIC_TRACKS = {
  cosmic_pulse: {
    bassNotes: [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83],
    leadNotes: [440, 523.25, 587.33, 659.25, 523.25, 587.33, 659.25, 783.99],
    leadType: 'sine'
  },
  turbo_groove_track: {
    bassNotes: [98, 98, 123.47, 110, 98, 98, 146.83, 130.81],
    leadNotes: [392, 493.88, 523.25, 587.33, 493.88, 523.25, 587.33, 698.46],
    leadType: 'square'
  },
  starlight_serenade_track: {
    bassNotes: [130.81, 130.81, 164.81, 196, 130.81, 130.81, 174.61, 196],
    leadNotes: [523.25, 659.25, 783.99, 880, 659.25, 783.99, 880, 987.77],
    leadType: 'triangle'
  }
};

function setBattleMusicTrack(trackId) {
  activeBattleMusicTrack = BATTLE_MUSIC_TRACKS[trackId] ? trackId : 'cosmic_pulse';
}
let isSpeechDucked = false;

// Audio Mix Constants (R3 Normalized Headroom & Voice Ducking)
const MIX_DEFAULTS = {
  buses: {
    master: 0.85,
    bgm: 0.35,
    bgmDucked: 0.10,
    battleSfx: 0.55,
    battleSfxDucked: 0.25,
    uiSfx: 0.75,
    voice: 0.95
  },
  compressor: {
    threshold: -12,
    knee: 6,
    ratio: 10,
    attack: 0.003,
    release: 0.15
  },
  battleSfxGains: {
    laser: 0.08,
    hit: 0.14,
    foamHit: 0.12,
    foamSploosh: 0.11,
    shieldDeflect: 0.14,
    shieldShatter: 0.07,
    bossLunge: 0.12,
    bossSplat: 0.14
  },
  rhythmGains: {
    kick: 0.18,
    snare: 0.10,
    bass: 0.09,
    lead: 0.05
  },
  debouncesMs: {
    laser: 120,
    hit: 100,
    foamHit: 100,
    foamSploosh: 100,
    shieldShatter: 100,
    shieldDeflect: 100,
    bossLunge: 120,
    bossSplat: 100
  }
};

const sfxLastPlayedAt = {
  laser: 0,
  hit: 0,
  foamHit: 0,
  foamSploosh: 0,
  shieldShatter: 0,
  shieldDeflect: 0,
  bossLunge: 0,
  bossSplat: 0
};

const contextBusesMap = new WeakMap();

function canDebounceSfx(key, cooldownMs) {
  const nowMs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const prev = sfxLastPlayedAt[key] || 0;
  if (prev > 0 && (nowMs - prev) < cooldownMs) {
    return false;
  }
  sfxLastPlayedAt[key] = nowMs;
  return true;
}

function getAudioBuses(context) {
  if (!context) return null;
  if (contextBusesMap.has(context)) {
    return contextBusesMap.get(context);
  }
  if (typeof context.createGain !== 'function') {
    return null;
  }
  try {
    const now = context.currentTime || 0;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(isMuted ? 0 : MIX_DEFAULTS.buses.master, now);
    masterGain.connect(context.destination);

    let masterInput = masterGain;
    let masterCompressor = null;
    if (typeof context.createDynamicsCompressor === 'function') {
      masterCompressor = context.createDynamicsCompressor();
      if (masterCompressor.threshold?.setValueAtTime) {
        masterCompressor.threshold.setValueAtTime(MIX_DEFAULTS.compressor.threshold, now);
        masterCompressor.knee.setValueAtTime(MIX_DEFAULTS.compressor.knee, now);
        masterCompressor.ratio.setValueAtTime(MIX_DEFAULTS.compressor.ratio, now);
        masterCompressor.attack.setValueAtTime(MIX_DEFAULTS.compressor.attack, now);
        masterCompressor.release.setValueAtTime(MIX_DEFAULTS.compressor.release, now);
      }
      masterCompressor.connect(masterGain);
      masterInput = masterCompressor;
    }

    const bgmGain = context.createGain();
    bgmGain.gain.setValueAtTime(
      isSpeechDucked ? MIX_DEFAULTS.buses.bgmDucked : MIX_DEFAULTS.buses.bgm,
      now
    );
    bgmGain.connect(masterInput);

    const battleSfxGain = context.createGain();
    battleSfxGain.gain.setValueAtTime(
      isSpeechDucked ? MIX_DEFAULTS.buses.battleSfxDucked : MIX_DEFAULTS.buses.battleSfx,
      now
    );
    battleSfxGain.connect(masterInput);

    const uiSfxGain = context.createGain();
    uiSfxGain.gain.setValueAtTime(MIX_DEFAULTS.buses.uiSfx, now);
    uiSfxGain.connect(masterInput);

    const voiceGain = context.createGain();
    voiceGain.gain.setValueAtTime(MIX_DEFAULTS.buses.voice, now);
    voiceGain.connect(masterInput);

    const buses = {
      context,
      masterCompressor,
      masterGain,
      bgmGain,
      battleSfxGain,
      uiSfxGain,
      voiceGain
    };
    contextBusesMap.set(context, buses);
    return buses;
  } catch {
    return null;
  }
}

function getBusDestination(context, busName = 'uiSfxGain') {
  const buses = getAudioBuses(context);
  if (buses && buses[busName]) return buses[busName];
  return context?.destination || null;
}

function applyMasterMuteGain(muted) {
  if (!audioCtx) return;
  const buses = contextBusesMap.get(audioCtx) || getAudioBuses(audioCtx);
  if (!buses?.masterGain?.gain) return;
  try {
    const now = audioCtx.currentTime || 0;
    const target = muted ? 0 : MIX_DEFAULTS.buses.master;
    buses.masterGain.gain.cancelScheduledValues?.(now);
    buses.masterGain.gain.setValueAtTime(target, now);
  } catch {}
}

function applySpeechDucking(ducked) {
  isSpeechDucked = Boolean(ducked);
  if (!audioCtx) return;
  const buses = contextBusesMap.get(audioCtx) || getAudioBuses(audioCtx);
  if (!buses) return;
  try {
    const now = audioCtx.currentTime || 0;
    const bgmTarget = isSpeechDucked ? MIX_DEFAULTS.buses.bgmDucked : MIX_DEFAULTS.buses.bgm;
    const sfxTarget = isSpeechDucked ? MIX_DEFAULTS.buses.battleSfxDucked : MIX_DEFAULTS.buses.battleSfx;

    if (buses.bgmGain?.gain) {
      buses.bgmGain.gain.cancelScheduledValues?.(now);
      buses.bgmGain.gain.setValueAtTime(buses.bgmGain.gain.value ?? bgmTarget, now);
      buses.bgmGain.gain.linearRampToValueAtTime(bgmTarget, now + (isSpeechDucked ? 0.12 : 0.4));
    }
    if (buses.battleSfxGain?.gain) {
      buses.battleSfxGain.gain.cancelScheduledValues?.(now);
      buses.battleSfxGain.gain.setValueAtTime(buses.battleSfxGain.gain.value ?? sfxTarget, now);
      buses.battleSfxGain.gain.linearRampToValueAtTime(sfxTarget, now + (isSpeechDucked ? 0.12 : 0.4));
    }
  } catch {}
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  if (window._lhSoundSpeechStartHandler && typeof window.removeEventListener === 'function') {
    window.removeEventListener('companion-speech-start', window._lhSoundSpeechStartHandler);
  }
  if (window._lhSoundSpeechEndHandler && typeof window.removeEventListener === 'function') {
    window.removeEventListener('companion-speech-end', window._lhSoundSpeechEndHandler);
  }
  window._lhSoundSpeechStartHandler = () => applySpeechDucking(true);
  window._lhSoundSpeechEndHandler = () => applySpeechDucking(false);
  window.addEventListener('companion-speech-start', window._lhSoundSpeechStartHandler);
  window.addEventListener('companion-speech-end', window._lhSoundSpeechEndHandler);
}

function getLullabyMasterGain(context) {
  if (!context) return null;
  if (!lullabyMasterGain || lullabyMasterGain.context !== context) {
    try {
      lullabyMasterGain = context.createGain();
      lullabyMasterGain.gain.setValueAtTime(lullabyDucked ? 0.15 : 1.0, context.currentTime);
      lullabyMasterGain.connect(getBusDestination(context, 'masterGain'));
    } catch {
      return null;
    }
  }
  return lullabyMasterGain;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (audioCtx) {
    getAudioBuses(audioCtx);
  }
  return audioCtx;
}

// Recorded sample layer: small sound clips by Kenney (kenney.nl), taken from
// Kenney's official Starter Kit repos (MIT licence, see
// public/assets/audio/kenney/LICENSE.md). Samples are fetched and decoded
// lazily on first use and cached per AudioContext. Every sample call falls
// back to the procedural synth sound if the file can't be loaded (offline,
// old browser, or test env), so nothing ever goes silent.
const SAMPLE_FILES = {
  correct: 'match.mp3',
  coin: 'coin.mp3',
  oops: 'fall.mp3',
  select: 'swap.mp3',
  place: 'place.mp3',
  bounce: 'jump.mp3'
};
const sampleBuffers = new Map();
const sampleLoads = new Map();

function resolveSampleUrl(file) {
  let base = '/';
  try {
    base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
  } catch {}
  if (!base.endsWith('/')) base += '/';
  return `${base}assets/audio/kenney/${file}`;
}

function loadSample(ctx, name) {
  const file = SAMPLE_FILES[name];
  if (!ctx || !file || typeof fetch !== 'function' || typeof ctx.decodeAudioData !== 'function') {
    return Promise.resolve(null);
  }
  if (sampleBuffers.has(name)) return Promise.resolve(sampleBuffers.get(name));
  if (!sampleLoads.has(name)) {
    const p = fetch(resolveSampleUrl(file))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((ab) => (ab ? new Promise((res, rej) => {
        const out = ctx.decodeAudioData(ab, res, rej);
        if (out && typeof out.then === 'function') out.then(res, rej);
      }) : null))
      .then((buf) => {
        if (buf) sampleBuffers.set(name, buf);
        return buf;
      })
      .catch(() => null);
    sampleLoads.set(name, p);
  }
  return sampleLoads.get(name);
}

// Plays a decoded sample on the UI SFX bus. Returns true when it played, false
// when the caller should use its procedural fallback instead.
function playSampleNow(ctx, name, volume = 0.8, rate = 1) {
  const buf = sampleBuffers.get(name);
  if (!ctx || !buf || typeof ctx.createBufferSource !== 'function') return false;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (src.playbackRate?.setValueAtTime) src.playbackRate.setValueAtTime(rate, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    src.connect(gain);
    gain.connect(getBusDestination(ctx, 'uiSfxGain'));
    src.start();
    return true;
  } catch {
    return false;
  }
}

function playSampleOr(name, fallback, volume, rate) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (playSampleNow(ctx, name, volume, rate)) return;
  // Not loaded yet: use the synth sound now, and warm the cache for next time.
  loadSample(ctx, name);
  if (typeof fallback === 'function') fallback();
}

export const SAMPLE_SFX_FILES = { ...SAMPLE_FILES };

export const Sound = {
  isMuted() {
    return isMuted;
  },

  // Preload the recorded samples (call once after the first user tap).
  preloadSamples() {
    const ctx = getAudioContext();
    if (!ctx) return Promise.resolve([]);
    return Promise.all(Object.keys(SAMPLE_FILES).map((n) => loadSample(ctx, n)));
  },

  // Learning-quest answer feedback (recorded samples, synth fallback).
  correctAnswer() {
    playSampleOr('correct', () => this.fanfare(), 0.85);
    setTimeout(() => playSampleOr('coin', null, 0.55), 140);
  },

  wrongAnswer() {
    // Gentle "oops", never a harsh buzzer, for little learners.
    playSampleOr('oops', () => this.boing(), 0.6);
  },

  answerSelect() {
    playSampleOr('select', () => this.tap(), 0.5);
  },

  sampleCoin() {
    playSampleOr('coin', () => this.coin(), 0.7);
  },

  samplePlace() {
    playSampleOr('place', () => this.placeFurniture(), 0.7);
  },

  sampleBounce() {
    playSampleOr('bounce', () => this.boing(), 0.6);
  },

  getAudioContext() {
    return getAudioContext();
  },

  setBattleSpeechDucking(ducked = true) {
    applySpeechDucking(ducked);
    return isSpeechDucked;
  },

  getVoiceGainNode(ctx = null) {
    const targetCtx = ctx || getAudioContext();
    const buses = getAudioBuses(targetCtx);
    return buses?.voiceGain || null;
  },

  getAudioMixConfig() {
    const activeBuses = audioCtx ? (contextBusesMap.get(audioCtx) || null) : null;
    return {
      buses: { ...MIX_DEFAULTS.buses },
      compressor: { ...MIX_DEFAULTS.compressor },
      battleSfxGains: { ...MIX_DEFAULTS.battleSfxGains },
      rhythmGains: { ...MIX_DEFAULTS.rhythmGains },
      debouncesMs: { ...MIX_DEFAULTS.debouncesMs },
      isSpeechDucked,
      liveBusValues: activeBuses ? {
        master: activeBuses.masterGain?.gain?.value,
        bgm: activeBuses.bgmGain?.gain?.value,
        battleSfx: activeBuses.battleSfxGain?.gain?.value,
        uiSfx: activeBuses.uiSfxGain?.gain?.value,
        voice: activeBuses.voiceGain?.gain?.value,
        hasCompressor: Boolean(activeBuses.masterCompressor)
      } : null
    };
  },

  toggleMute() {
    isMuted = !isMuted;
    applyMasterMuteGain(isMuted);
    if (isMuted) {
      this.stopDisco();
      this.stopBattleRhythm();
      this.stopWorkoutBeat();
      this.stopLullaby();
      applySpeechDucking(false);
    }
    return isMuted;
  },

  setMute(mute) {
    isMuted = Boolean(mute);
    applyMasterMuteGain(isMuted);
    if (isMuted) {
      this.stopDisco();
      this.stopBattleRhythm();
      this.stopWorkoutBeat();
      this.stopLullaby();
      applySpeechDucking(false);
    }
  },

  tap() {
    this.bloop();
  },

  // 1. CARTOON BUTTON BLOOP (Tactile juicy rubbery pop for buttons, tabs, micro-interactions)
  bloop() {
    if (isMuted) return;
    const nowMs = performance.now();
    if (nowMs - lastBloopTime < 45) return; // Debounce rapid micro-triggers
    lastBloopTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Sine with pitch bounce (starts 340Hz, glides to 680Hz, settles around 410Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.03);
      osc.frequency.exponentialRampToValueAtTime(410, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getBusDestination(ctx, 'uiSfxGain'));

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // Alias click() to bloop() for app-wide tactile feedback
  click() {
    this.bloop();
  },

  // 2. MUSICAL COIN CHIME (Bright multi-tone major arpeggio E6 -> G#6 -> B6 -> E7 with bell ring)
  coin() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      // High bright sparkling chime notes
      const notes = [1318.51, 1661.22, 1975.53, 2637.02]; // E6, G#6, B6, E7
      notes.forEach((freq, i) => {
        const start = now + i * 0.038;

        // Fundamental bell tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.18);

        // Harmonic shimmer overtone
        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(freq * 2.04, start);

        gain.gain.setValueAtTime(0.20, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);

        overtoneGain.gain.setValueAtTime(0.07, start);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

        osc.connect(gain);
        overtone.connect(overtoneGain);
        gain.connect(dest);
        overtoneGain.connect(dest);

        osc.start(start);
        overtone.start(start);
        osc.stop(start + 0.32);
        overtone.stop(start + 0.16);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  musicalChime() {
    this.coin();
  },

  // 3. CELEBRATORY TASK COMPLETE FANFARE (Joyous cartoon brass herald C5 -> E5 -> G5 -> C6 burst)
  taskCompleteFanfare() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      // 4-note ascending triumph fanfare followed by celebratory sustained chord
      const fanfareNotes = [
        { f: 523.25, time: 0, dur: 0.12 },    // C5
        { f: 659.25, time: 0.10, dur: 0.12 }, // E5
        { f: 783.99, time: 0.20, dur: 0.14 }, // G5
        { f: 1046.50, time: 0.32, dur: 0.48 } // High C6 (sustained)
      ];

      fanfareNotes.forEach((n) => {
        const start = now + n.time;
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Warm brass timbre: triangle + slight sine warmth
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, start);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(n.f * 2, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(dest);

        osc.start(start);
        osc2.start(start);
        osc.stop(start + n.dur);
        osc2.stop(start + n.dur);
      });

      // Shimmer chord on final note (adds magical fairy dust to task completion)
      const chordNotes = [659.25, 783.99, 1318.51, 1567.98];
      chordNotes.forEach((f, idx) => {
        const start = now + 0.34 + idx * 0.02;
        const sOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(f, start);

        sGain.gain.setValueAtTime(0.07, start);
        sGain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        sOsc.connect(sGain);
        sGain.connect(dest);
        sOsc.start(start);
        sOsc.stop(start + 0.45);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // Standard victory fanfare (kept for compatibility)
  fanfare() {
    this.taskCompleteFanfare();
  },

  // 4. CARTOON SPRING BOING (Playful rubber wobble for pet interactions & bounces)
  boing() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch sweeps upward while wobbling rapidly
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.18);

      // Fast pitch vibrato
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 24; // 24Hz wobble
      lfoGain.gain.setValueAtTime(45, now);
      lfoGain.gain.exponentialRampToValueAtTime(1, now + 0.35);

      lfo.connect(osc.frequency);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(getBusDestination(ctx, 'uiSfxGain'));

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + 0.38);
      osc.stop(now + 0.38);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 5. CARTOON WHOOSH / SWOOP (Air swoosh for navigation tabs, modals, card transitions)
  whoosh() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.22;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + duration * 0.45);
      filter.frequency.exponentialRampToValueAtTime(320, now + duration);
      filter.Q.value = 1.9;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(getBusDestination(ctx, 'uiSfxGain'));

      noise.start(now);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6. FAIRY SPARKLE (Glittering cascading bells for rewards, badges, and equipping gear)
  sparkle() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const sparkleNotes = [1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96]; // G6, A6, C7, D7, E7, G7
      sparkleNotes.forEach((freq, i) => {
        const start = now + i * 0.03;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.10, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6b. CAMERA SNAP (Quick mechanical shutter sound for chore photo proofs)
  camera() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      // Click 1 (shutter open)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(160, now + 0.04);
      gain1.gain.setValueAtTime(0.24, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(dest);
      osc1.start(now);
      osc1.stop(now + 0.04);

      // Click 2 (shutter close)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, now + 0.07);
      osc2.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain2.gain.setValueAtTime(0.20, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc2.connect(gain2);
      gain2.connect(dest);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.12);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6c. PICNIC CHIME (Warm cheerful melody when tossing treats at the sanctuary picnic)
  picnicChime() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6c2. QUADPACER ZONE CHIME (Gentle distinct chime on 30-second toothbrush zone switches)
  zoneChime() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const notes = [659.25, 987.77, 1318.51]; // E5 -> B5 -> E6
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6c3. STREAK TICK (Bright ascending ping at brush-streak milestones, e.g. every +5 combo)
  streakTick() {
    if (isMuted) return;
    if (!canDebounceSfx('streakTick', 300)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'battleSfxGain');
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6c4. MINI-CHALLENGE START (Quick two-note alert cueing a timed mini-challenge)
  miniChallengeStart() {
    if (isMuted) return;
    if (!canDebounceSfx('miniChallengeStart', 200)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const notes = [740, 988];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6c5. MINI-CHALLENGE COMPLETE (Triumphant short fanfare on win)
  miniChallengeComplete() {
    if (isMuted) return;
    if (!canDebounceSfx('miniChallengeComplete', 200)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6d. EVOLUTION ASCENT (Epic rising harmonic sweep and major chord for evolution ceremony)
  evolutionAscent() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Rising energy sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 1.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(3600, now + 1.2);
      filter.Q.value = 4.0;

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.3);

      // Climax sparkling bells at 1.1s
      const bells = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6
      bells.forEach((f, i) => {
        const bStart = now + 1.1 + i * 0.05;
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(f, bStart);
        bGain.gain.setValueAtTime(0.25, bStart);
        bGain.gain.exponentialRampToValueAtTime(0.001, bStart + 0.4);
        bOsc.connect(bGain);
        bGain.connect(ctx.destination);
        bOsc.start(bStart);
        bOsc.stop(bStart + 0.4);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 6e. SNACK MUNCH (Cute cartoon double-crunch when feeding companion treats)
  snackMunch() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.09].forEach((offset) => {
        const start = now + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, start);
        osc.frequency.exponentialRampToValueAtTime(140, start + 0.06);
        gain.gain.setValueAtTime(0.28, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.06);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 7. RUBBER POP / SUCTION PLOP (Satisfying tactile pop for habit/task checkboxes & switches)
  rubberPop() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.045);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 8. CARTOON SNACK CRUNCH (Cute multi-crunch eating sound when feeding pet)
  crunch() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.07, 0.14].forEach((delay) => {
        const start = now + delay;
        const duration = 0.05;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800 + Math.random() * 600, start);
        filter.Q.value = 3;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.24, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(start);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 9. CARTOON UH-OH / DENY (Springy cartoon negative buzz when tokens/conditions not met)
  deny() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.2);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 10. BUBBLE POP
  pop() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600 + Math.random() * 400, now);
      osc.frequency.exponentialRampToValueAtTime(1200 + Math.random() * 600, now + 0.08);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(getBusDestination(ctx, 'uiSfxGain'));

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 11. SOAP BUBBLE BLOOP
  bubble() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const baseFreq = 420 + Math.random() * 240;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.4, now + 0.12);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 12. BLOW DRYER WARM WIND
  wind() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const duration = 0.45;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + duration);
      filter.Q.value = 1.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 13. WATER SPLASH
  splash() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.2);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 14. LEVEL UP ARPEGGIO
  levelUp() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(getBusDestination(ctx, 'uiSfxGain'));

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 15. AR BATTLE LASER ATTACK (Normalized gain, softened with lowpass filter, 120ms debounce)
  laser() {
    if (isMuted) return;
    if (!canDebounceSfx('laser', MIX_DEFAULTS.debouncesMs.laser)) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const now = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(500, now + 0.18);

      gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.laser, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));

      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 16. BOSS HIT / IMPACT (Normalized gain, softened timbre, 100ms debounce)
  hit() {
    if (isMuted) return;
    if (!canDebounceSfx('hit', MIX_DEFAULTS.debouncesMs.hit)) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const now = ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);

      gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.hit, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));

      osc.start(now);
      osc.stop(now + 0.17);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 17. CUTE PET CHIRP
  chirp() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.08);
      osc.frequency.linearRampToValueAtTime(900, now + 0.16);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 18. DANCE PARTY DISCO GROOVE LOOP
  startDisco(onBeat) {
    this.stopLullaby();
    if (discoInterval) clearInterval(discoInterval);
    const ctx = getAudioContext();
    if (!ctx) return;

    let step = 0;
    const bassNotes = [110, 110, 130.81, 146.83];
    const synthNotes = [440, 523.25, 659.25, 587.33];

    discoInterval = setInterval(() => {
      if (isMuted) return;
      try {
        const now = ctx.currentTime;

        // Kick / Bass
        const bgmDest = getBusDestination(ctx, 'bgmGain');
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNotes[step % 4], now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(bgmDest);
        osc.start(now);
        osc.stop(now + 0.15);

        // Synth Arp
        if (step % 2 === 1) {
          const lead = ctx.createOscillator();
          const leadGain = ctx.createGain();
          lead.type = 'sine';
          lead.frequency.setValueAtTime(synthNotes[step % 4], now);
          leadGain.gain.setValueAtTime(0.12, now);
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          lead.connect(leadGain);
          leadGain.connect(bgmDest);
          lead.start(now);
          lead.stop(now + 0.18);
        }

        if (onBeat) onBeat(step);
        step++;
      } catch (e) {}
    }, 280);
  },

  stopDisco() {
    if (discoInterval) {
      clearInterval(discoInterval);
      discoInterval = null;
    }
  },

  // Selects which Unlock Shop battle-music track preset startBattleRhythm() uses next.
  setBattleMusicTrack(trackId) {
    setBattleMusicTrack(trackId);
  },

  // 17. HEROIC TOOTHBRUSH BATTLE RHYTHM (Procedural energetic chiptune drum & bass groove, routed via bgmGain)
  startBattleRhythm(onBeat = lastBattleRhythmOnBeat) {
    lastBattleRhythmOnBeat = typeof onBeat === 'function' ? onBeat : null;
    if (isMuted) return;
    this.stopLullaby();
    // Preserve current battleBpm (e.g. 142 during Q5 finale) and active speech ducking across tempo restarts
    this.stopBattleRhythm(false);
    const ctx = getAudioContext();
    if (!ctx) return;

    let step = 0;
    const trackPreset = BATTLE_MUSIC_TRACKS[activeBattleMusicTrack] || BATTLE_MUSIC_TRACKS.cosmic_pulse;
    const bassNotes = trackPreset.bassNotes;
    const leadNotes = trackPreset.leadNotes;
    const leadOscType = trackPreset.leadType || 'sine';

    const intervalMs = Math.round(60000 / (battleBpm * 2));

    battleRhythmInterval = setInterval(() => {
      if (isMuted) return;
      try {
        const now = ctx.currentTime;
        const bgmDest = getBusDestination(ctx, 'bgmGain');

        // Kick on beats 0, 4
        if (step % 4 === 0) {
          const kick = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kick.frequency.setValueAtTime(140, now);
          kick.frequency.exponentialRampToValueAtTime(38, now + 0.08);
          kickGain.gain.setValueAtTime(MIX_DEFAULTS.rhythmGains.kick, now);
          kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
          kick.connect(kickGain);
          kickGain.connect(bgmDest);
          kick.start(now);
          kick.stop(now + 0.09);
        }

        // Snare on beat 2
        if (step % 4 === 2) {
          const snareFilter = ctx.createBiquadFilter();
          snareFilter.type = 'highpass';
          snareFilter.frequency.setValueAtTime(800, now);
          const snare = ctx.createOscillator();
          const snareGain = ctx.createGain();
          snare.type = 'triangle';
          snare.frequency.setValueAtTime(220, now);
          snare.frequency.exponentialRampToValueAtTime(60, now + 0.07);
          snareGain.gain.setValueAtTime(MIX_DEFAULTS.rhythmGains.snare, now);
          snareGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          snare.connect(snareFilter);
          snareFilter.connect(snareGain);
          snareGain.connect(bgmDest);
          snare.start(now);
          snare.stop(now + 0.08);
        }

        // Bass groove
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = 'sawtooth';
        const note = bassNotes[step % bassNotes.length];
        bass.frequency.setValueAtTime(note, now);
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(420, now);
        bassGain.gain.setValueAtTime(MIX_DEFAULTS.rhythmGains.bass, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        bass.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(bgmDest);
        bass.start(now);
        bass.stop(now + 0.12);

        // Chiptune lead sparkle on upbeat
        if (step % 2 === 1) {
          const lead = ctx.createOscillator();
          const leadGain = ctx.createGain();
          lead.type = leadOscType;
          lead.frequency.setValueAtTime(leadNotes[step % leadNotes.length], now);
          leadGain.gain.setValueAtTime(MIX_DEFAULTS.rhythmGains.lead, now);
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          lead.connect(leadGain);
          leadGain.connect(bgmDest);
          lead.start(now);
          lead.stop(now + 0.1);
        }

        if (lastBattleRhythmOnBeat) lastBattleRhythmOnBeat(step);
        step++;
      } catch (e) {}
    }, intervalMs);
  },

  stopBattleRhythm(resetTempoAndDucking = true) {
    if (battleRhythmInterval) {
      clearInterval(battleRhythmInterval);
      battleRhythmInterval = null;
    }
    if (resetTempoAndDucking) {
      battleBpm = 118;
      lastBattleRhythmOnBeat = null;
      applySpeechDucking(false);
    }
  },

  speedUpBattleRhythm(isUrgent = true) {
    battleBpm = isUrgent ? 142 : 118;
    if (battleRhythmInterval) {
      this.startBattleRhythm(lastBattleRhythmOnBeat);
    }
  },

  // 17b. HIGH-ENERGY DINO HERO WORKOUT BEAT (Procedural upbeat chiptune groove with dynamic BPM)
  startWorkoutBeat(bpm = 126, onBeat) {
    if (isMuted) return;
    this.stopLullaby();
    this.stopBattleRhythm();
    this.stopDisco();
    this.stopWorkoutBeat();
    const ctx = getAudioContext();
    if (!ctx) return;

    let step = 0;
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    const synthNotes = [440, 523.25, 587.33, 659.25, 523.25, 587.33, 659.25, 783.99];
    const intervalMs = Math.max(120, Math.round(60000 / (bpm * 2)));

    workoutBeatInterval = setInterval(() => {
      if (isMuted) return;
      try {
        const now = ctx.currentTime;
        const bgmDest = getBusDestination(ctx, 'bgmGain');
        // Kick on downbeats (0, 4)
        if (step % 4 === 0) {
          const kick = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kick.frequency.setValueAtTime(145, now);
          kick.frequency.exponentialRampToValueAtTime(36, now + 0.09);
          kickGain.gain.setValueAtTime(0.24, now);
          kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          kick.connect(kickGain);
          kickGain.connect(bgmDest);
          kick.start(now);
          kick.stop(now + 0.1);
        }
        // Snare / clap on backbeat (2, 6)
        if (step % 4 === 2) {
          const snareFilter = ctx.createBiquadFilter();
          snareFilter.type = 'highpass';
          snareFilter.frequency.setValueAtTime(900, now);
          const snare = ctx.createOscillator();
          const snareGain = ctx.createGain();
          snare.type = 'triangle';
          snare.frequency.setValueAtTime(240, now);
          snare.frequency.exponentialRampToValueAtTime(55, now + 0.07);
          snareGain.gain.setValueAtTime(0.14, now);
          snareGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
          snare.connect(snareFilter);
          snareFilter.connect(snareGain);
          snareGain.connect(bgmDest);
          snare.start(now);
          snare.stop(now + 0.08);
        }
        // Bass groove
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(bassNotes[step % bassNotes.length], now);
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(450, now);
        bassGain.gain.setValueAtTime(0.12, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
        bass.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(bgmDest);
        bass.start(now);
        bass.stop(now + 0.11);

        // Cheerful melodic synth
        if (step % 2 === 1) {
          const lead = ctx.createOscillator();
          const leadGain = ctx.createGain();
          lead.type = 'sine';
          lead.frequency.setValueAtTime(synthNotes[step % synthNotes.length], now);
          leadGain.gain.setValueAtTime(0.07, now);
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          lead.connect(leadGain);
          leadGain.connect(bgmDest);
          lead.start(now);
          lead.stop(now + 0.09);
        }

        if (onBeat) onBeat(step);
        step++;
      } catch (e) {}
    }, intervalMs);
  },

  stopWorkoutBeat() {
    if (workoutBeatInterval) {
      clearInterval(workoutBeatInterval);
      workoutBeatInterval = null;
    }
  },

  isWorkoutBeatActive() {
    return !!workoutBeatInterval;
  },

  // 18. SHIELD DEFLECT (Metallic bubble bounce when Hero Shield blocks cavity slime, 100ms debounce)
  shieldDeflect() {
    if (isMuted) return;
    if (!canDebounceSfx('shieldDeflect', MIX_DEFAULTS.debouncesMs.shieldDeflect)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.15);
      gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.shieldDeflect, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
      osc.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  },

  // 19. FOAM SPLOOSH (Bubbly foamy splash for toothpaste cannons)
  foamSploosh() {
    if (isMuted) return;
    if (!canDebounceSfx('foamSploosh', MIX_DEFAULTS.debouncesMs.foamSploosh)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
      gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.foamSploosh, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.14);
      osc.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {}
  },

  // 21. LIGHT SWITCH (Crisp dual-tone click for starlight lamps and lamps)
  lightSwitch() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(800, now + 0.025);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(600, now + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(300, now + 0.06);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);

      osc1.start(now);
      osc1.stop(now + 0.03);
      osc2.start(now + 0.02);
      osc2.stop(now + 0.07);
    } catch (e) {}
  },

  // 23. SNORE (Gentle rhythmic cartoon slumber purr)
  snore() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.linearRampToValueAtTime(125, now + 0.2);
      osc.frequency.linearRampToValueAtTime(75, now + 0.4);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.2);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.43);
    } catch (e) {}
  },

  // 24. HOLOGRAM (Shimmering sci-fi hologram sweep)
  hologram() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freqs = [520, 780, 1040, 1560];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.03);
        osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + idx * 0.03 + 0.15);
        gain.gain.setValueAtTime(0.12, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.03 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.19);
      });
    } catch (e) {}
  },

  // 25. PLACE FURNITURE (Satisfying tactile thud & sparkle chime)
  placeFurniture() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);

      // Chime sparkle
      setTimeout(() => {
        if (!isMuted && typeof Sound.sparkle === 'function') {
          Sound.sparkle();
        }
      }, 70);
    } catch (e) {}
  },

  // 26. BOSS 3D LUNGE (Deep charging whoosh with softened lowpass filter, 120ms debounce)
  bossLunge() {
    if (isMuted) return;
    if (!canDebounceSfx('bossLunge', MIX_DEFAULTS.debouncesMs.bossLunge)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.22);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.38);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);

      gain.gain.setValueAtTime(0.005, now);
      gain.gain.linearRampToValueAtTime(MIX_DEFAULTS.battleSfxGains.bossLunge, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.39);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  },

  // 27. BOSS SLIME SPLAT (Squishy wet caramel/biofilm slap on mirror teeth, 100ms debounce)
  bossSplat() {
    if (isMuted) return;
    if (!canDebounceSfx('bossSplat', MIX_DEFAULTS.debouncesMs.bossSplat)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

      gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.bossSplat, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

      osc.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));
      osc.start(now);
      osc.stop(now + 0.17);
    } catch (e) {}
  },

  // 28. FOAM HIT (Crisp fizzy toothpaste bubble blast against 3D boss, 100ms debounce)
  foamHit() {
    if (isMuted) return;
    if (!canDebounceSfx('foamHit', MIX_DEFAULTS.debouncesMs.foamHit)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);

      gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.foamHit, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.1);

      osc.connect(gain);
      gain.connect(getBusDestination(ctx, 'battleSfxGain'));
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (e) {}
  },

  // 29. DIZZY STARS (Cartoon twinkling chime arpeggio)
  dizzyStars() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'uiSfxGain');
      const notes = [880, 1174, 1318, 1760];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.10, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.18);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.19);
      });
    } catch (e) {}
  },

  // 30. SHIELD SHATTER (Single deduplicated definition, softened via lowpass 2400 Hz, 100ms debounce)
  shieldShatter() {
    if (isMuted) return;
    if (!canDebounceSfx('shieldShatter', MIX_DEFAULTS.debouncesMs.shieldShatter)) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dest = getBusDestination(ctx, 'battleSfxGain');
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.connect(dest);

      const freqs = [1600, 2100, 2900, 3800];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.02);
        osc.frequency.exponentialRampToValueAtTime(f * 0.4, now + idx * 0.02 + 0.2);

        gain.gain.setValueAtTime(MIX_DEFAULTS.battleSfxGains.shieldShatter, now + idx * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.02 + 0.22);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(now + idx * 0.02);
        osc.stop(now + idx * 0.02 + 0.23);
      });
    } catch (e) {}
  },

  // 31. RECORD SCRATCH (Classic funny DJ vinyl scratch for sudden freeze pauses)
  recordScratch() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.14);
      osc.frequency.setValueAtTime(800, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.26);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.27);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch (e) {}
  },

  // 32. FREEZE CHIME (Crystalline frost sound when freezing into an ice statue)
  freezeChime() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freqs = [1900, 2300, 2800, 3400];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.03);
        osc.frequency.exponentialRampToValueAtTime(f * 1.15, now + idx * 0.03 + 0.25);

        gain.gain.setValueAtTime(0.12, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.002, now + idx * 0.03 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.29);
      });
    } catch (e) {}
  },

  // 33. FEVER HORN (Celebratory funky party brass horn for Rainbow Fever Mode)
  feverHorn() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.50];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      });
    } catch (e) {}
  },

  // 34. CAMERA SHUTTER (Mechanical dual click + quick flash charge tone)
  cameraShutter() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // First click
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(120, now + 0.035);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.045);

      // Second mechanical latch click (60ms later)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(900, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.11);
      gain2.gain.setValueAtTime(0.25, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.13);

      // High sparkle flash tone
      const flashOsc = ctx.createOscillator();
      const flashGain = ctx.createGain();
      flashOsc.type = 'sine';
      flashOsc.frequency.setValueAtTime(2400, now + 0.02);
      flashOsc.frequency.exponentialRampToValueAtTime(3200, now + 0.18);
      flashGain.gain.setValueAtTime(0.12, now + 0.02);
      flashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      flashOsc.connect(flashGain);
      flashGain.connect(ctx.destination);
      flashOsc.start(now + 0.02);
      flashOsc.stop(now + 0.23);
    } catch (e) {}
  },

  // 35. CROWD CHEER (Catwalk audience celebration, clapping resonance & whoops)
  crowdCheer() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freqs = [330, 392, 523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        const startDelay = idx * 0.04;
        osc.frequency.setValueAtTime(freq * 0.95, now + startDelay);
        osc.frequency.linearRampToValueAtTime(freq * 1.08, now + startDelay + 0.35);
        osc.frequency.exponentialRampToValueAtTime(freq, now + startDelay + 0.7);

        gain.gain.setValueAtTime(0.01, now + startDelay);
        gain.gain.linearRampToValueAtTime(0.12, now + startDelay + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + 0.85);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startDelay);
        osc.stop(now + startDelay + 0.9);
      });

      for (let i = 0; i < 6; i++) {
        const t = now + 0.08 * i + (Math.random() * 0.03);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180 + Math.random() * 80, t);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      }
    } catch (e) {}
  },

  // 36. CAPE WHOOSH (Airy flutter and gust of wind)
  capeWhoosh() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.32);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.linearRampToValueAtTime(1200, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.32);
      filter.Q.setValueAtTime(2.5, now);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  },

  // 37. GEAR SNAP (Satisfying magnetic lock-in click when equipping items)
  gearSnap() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1200, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 0.04);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.06);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(240, now + 0.015);
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.09);
      gain2.gain.setValueAtTime(0.24, now + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.015);
      osc2.stop(now + 0.12);
    } catch (e) {}
  },

  // 38. PROCEDURAL BEDTIME LULLABY MUSIC BOX
  // Gentle, soothing celesta/sine chimes playing pentatonic melodies for bedtime relaxation
  startLullaby(onNote = null) {
    if (isMuted) return;
    this.stopLullaby();
    this.stopDisco();
    this.stopBattleRhythm();
    lullabyActive = true;
    const ctx = getAudioContext();
    if (!ctx) return;

    // Soothing celesta / music box pentatonic lullaby sequence
    const LULLABY_NOTES = [
      261.63, // C4
      329.63, // E4
      392.00, // G4
      440.00, // A4
      392.00, // G4
      329.63, // E4
      293.66, // D4
      261.63, // C4
      329.63, // E4
      392.00, // G4
      523.25, // C5
      493.88, // B4
      440.00, // A4
      392.00, // G4
      329.63, // E4
      261.63  // C4
    ];

    lullabyNoteIndex = 0;

    const playNextNote = () => {
      if (isMuted || !lullabyActive) {
        this.stopLullaby();
        return;
      }
      try {
        const context = getAudioContext();
        if (!context) return;
        if (context.state === 'suspended') {
          context.resume().catch(() => {});
        }
        const now = context.currentTime;
        const freq = LULLABY_NOTES[lullabyNoteIndex % LULLABY_NOTES.length];
        lullabyNoteIndex++;

        // Warm pure sine bell chime
        const osc = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Subtle soft overtone (celesta chime sparkle)
        const osc2 = context.createOscillator();
        const gain2 = context.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600, now);
        filter.frequency.exponentialRampToValueAtTime(900, now + 0.9);

        // Clear, soothing volume designed for bedtime listening (scaled by ducking to 15%)
        const peakGain = lullabyDucked ? 0.036 : 0.24;
        const overtoneGain = lullabyDucked ? 0.0105 : 0.07;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peakGain, now + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.linearRampToValueAtTime(overtoneGain, now + 0.025);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

        // Route osc through gain and osc2 through gain2, then through lowpass filter to master gain
        osc.connect(gain);
        gain.connect(filter);
        osc2.connect(gain2);
        gain2.connect(filter);

        const masterGain = getLullabyMasterGain(context);
        if (masterGain) {
          filter.connect(masterGain);
        } else {
          filter.connect(context.destination);
        }

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 1.2);
        osc2.stop(now + 0.6);

        if (typeof onNote === 'function') {
          onNote(freq, lullabyNoteIndex);
        }
      } catch (e) {
        console.debug('Lullaby audio error', e);
      }
    };

    const startNoteLoop = () => {
      if (!lullabyActive) return;
      playNextNote();
      if (!lullabyInterval && lullabyActive) {
        lullabyInterval = setInterval(playNextNote, 1150);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (!lullabyActive) return;
        startNoteLoop();
      }).catch(() => {
        if (!lullabyActive) return;
        startNoteLoop();
      });
    } else {
      startNoteLoop();
    }
  },

  duckLullaby(ducked = true) {
    lullabyDucked = Boolean(ducked);
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const master = getLullabyMasterGain(ctx);
      if (master) {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        if (lullabyDucked) {
          // Ramps gain to 0.15 (15% volume) over 0.6–0.8s during speech
          master.gain.linearRampToValueAtTime(0.15, now + 0.7);
        } else {
          // Smoothly swells gain from 0.15 back to 1.0 (100% volume) over 1.2–1.5s on chapter transitions
          master.gain.linearRampToValueAtTime(1.0, now + 1.3);
        }
      }
    } catch (e) {
      // AudioContext state handling
    }
  },

  isLullabyDucked() {
    return lullabyDucked;
  },

  // Soft single celesta chime note when tapping interactive elements during bedtime stories
  playBedtimeChime(customFreq = null) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const CHIME_PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
      const freq = customFreq || CHIME_PENTATONIC[Math.floor(Math.random() * CHIME_PENTATONIC.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(1100, now + 0.7);

      const peak = lullabyDucked ? 0.08 : 0.16;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch (e) {}
  },

  stopLullaby() {
    lullabyActive = false;
    lullabyDucked = false;
    if (lullabyInterval) {
      clearInterval(lullabyInterval);
      lullabyInterval = null;
    }
    lullabyNoteIndex = 0;
    if (lullabyMasterGain) {
      try {
        const ctx = getAudioContext();
        if (ctx) {
          lullabyMasterGain.gain.cancelScheduledValues(ctx.currentTime);
          lullabyMasterGain.gain.setValueAtTime(1.0, ctx.currentTime);
        }
      } catch (e) {}
    }
  },

  isLullabyPlaying() {
    return lullabyActive && lullabyInterval !== null;
  }
};

/**
 * Global Tactile Sound Engine Auto-Connector
 * Automatically binds cartoon sound effects to EVERY SINGLE micro-interaction in the app!
 */
export function initTactileSoundEngine() {
  if (typeof window === 'undefined') return;

  // 1. Gesture Unlock for Browser Audio Context
  const unlockAudio = () => {
    getAudioContext();
    // Warm the recorded sample cache so the first quiz answer already uses them.
    try { Sound.preloadSamples(); } catch {}
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });

  // 2. Global Event Delegate for Micro-Interactions
  document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!target || !(target instanceof Element)) return;

    if (Sound.isMuted()) return;

    // Explicit custom sound override via data-sfx="name"
    const sfxEl = target.closest('[data-sfx]');
    if (sfxEl) {
      const sfx = sfxEl.getAttribute('data-sfx');
      if (sfx && typeof Sound[sfx] === 'function') {
        Sound[sfx]();
        return;
      }
    }

    // Task & Habit Checkboxes / Toggles
    if (target.closest('.tactile-check-btn, .habit-check-btn, .task-check-btn, .tactile-check-ready, .tactile-check-approved')) {
      Sound.rubberPop();
      return;
    }

    // Bottom Navigation Tabs
    if (target.closest('.nav-tab-btn')) {
      Sound.whoosh();
      return;
    }

    // Coins, Tokens, Buying, or Redeeming
    if (target.closest('.buy-gear-btn, .redeem-reward-btn, [data-buy-gear-id], [data-redeem-id]')) {
      Sound.coin();
      return;
    }

    // Pet Pen Petting & Interactions
    if (target.closest('#pen-pet-character, #pen-play-btn')) {
      Sound.boing();
      return;
    }

    // Modal Close buttons
    if (target.closest('#reward-modal-cool-btn, #parent-modal-close, #link-modal-close-btn, [data-modal-close]')) {
      Sound.pop();
      return;
    }

    // General Buttons, Links, Inputs, Cards, and Clickables
    const buttonOrInteractive = target.closest(
      'button, a, input[type="radio"], input[type="checkbox"], select, .chunky-btn, .chunky-btn-sm, [role="button"], .card-interactive, .gear-card-item, .habit-card-item, .task-card-item'
    );
    if (buttonOrInteractive) {
      Sound.bloop();
    }
  }, { passive: true });
}
