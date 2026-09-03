// Web Audio API Procedural Cartoon Sound Engine
// Distinct cartoon tactile sound effects for micro-interactions:
// - Buttons that "bloop" with bouncy rubbery resonance
// - Coins that chime musically in bright major arpeggios
// - Celebratory fanfares when marking tasks/habits complete
// - Springy "boings", fairy dust "sparkles", snack "crunches", and "rubber pops"

let audioCtx = null;
let isMuted = false;
let discoInterval = null;
let lastBloopTime = 0;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const Sound = {
  isMuted() {
    return isMuted;
  },

  toggleMute() {
    isMuted = !isMuted;
    if (isMuted && discoInterval) {
      this.stopDisco();
    }
    return isMuted;
  },

  setMute(mute) {
    isMuted = mute;
    if (isMuted && discoInterval) {
      this.stopDisco();
    }
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

      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

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

        gain.gain.setValueAtTime(0.24, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);

        overtoneGain.gain.setValueAtTime(0.08, start);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

        osc.connect(gain);
        overtone.connect(overtoneGain);
        gain.connect(ctx.destination);
        overtoneGain.connect(ctx.destination);

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

        // Warm brass timbre: triangle + slight sawtooth warmth
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, start);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(n.f * 2, start);

        gain.gain.setValueAtTime(0.28, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

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

        sGain.gain.setValueAtTime(0.12, start);
        sGain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        sOsc.connect(sGain);
        sGain.connect(ctx.destination);
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

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

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
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

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
      const sparkleNotes = [1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96]; // G6, A6, C7, D7, E7, G7
      sparkleNotes.forEach((freq, i) => {
        const start = now + i * 0.03;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.28);
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
      gain.connect(ctx.destination);

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
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 15. AR BATTLE LASER ATTACK
  laser() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {
      console.debug('Audio error', e);
    }
  },

  // 16. BOSS HIT / IMPACT
  hit() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
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
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNotes[step % 4], now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
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
          leadGain.connect(ctx.destination);
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
