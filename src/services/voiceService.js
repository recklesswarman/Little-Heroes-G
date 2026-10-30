// Pet Companion & Rex the Dino Spoken Voice Guidance Service
// Architecture:
// 1. Primary: self-hosted Kokoro TTS microservice (/api/tts), with a distinct
//    voice per companion pet resolved centrally in that service (see
//    little-heroes-tts-service/voices.py)
// 2. Resilient Fallback: High-Fidelity Cartoon Speech Synthesis with device-native voice
// 3. Multi-Pet Pitch & Persona Tuning (24 companion pets)
// 4. Browser Autoplay & Gesture Pre-Unlock Engine

import { store } from '../state/store.js';
import { DINO_WORKOUTS } from '../data/petsData.js';

const KOKORO_TTS_ENDPOINT = '/api/tts';

// How long a normal (non-bedtime, non-instant) line waits for Kokoro before the
// browser voice takes over. Kokoro on CPU needs roughly 0.7s per second of speech.
export const KOKORO_DEFAULT_TIMEOUT_MS = 7000;

// Zero-latency client-side audio cache for gross-motor cadence cues and companion audio clips
export const workoutAudioClipCache = new Map();

/**
 * Normalizes a companion pet ID or numeric string to its canonical roster key
 */
export function normalizePetKey(petId) {
  if (!petId) return 'rex';
  const raw = String(petId).toLowerCase().trim();
  const idMap = {
    '1': 'rex',
    '2': 'raptor',
    '3': 'stego',
    '4': 'pterry',
    '5': 'chomper',
    '6': 'brachio',
    '7': 'dippy',
    '8': 'spino',
    '9': 'sparky',
    '10': 'aero',
    '11': 'blaze',
    '12': 'hydra',
    '13': 'luna',
    '14': 'kira',
    '15': 'boulder',
    '16': 'cosmo',
    '17': 'leo',
    '18': 'stripe',
    '19': 'fang',
    '20': 'scout',
    '21': 'gnasher',
    '22': 'shadow-sm',
    '23': 'barnaby',
    '24': 'ollie'
  };
  return idMap[raw] || raw;
}

/**
 * Generates cache key for workout and bedtime audio clips, with optional voiceStyle
 */
export function getAudioCacheKey(text, petId = 'rex', voiceStyle = 'default') {
  const clean = cleanDialogueText(text);
  const norm = normalizePetKey(petId);
  const style = voiceStyle && voiceStyle !== 'default' ? voiceStyle : 'default';
  return style !== 'default' ? `${norm}:${style}:${clean}` : `${norm}:${clean}`;
}

// Per-pet voice tuning. `kokoroVoice` must match the pet->voice casting
// table centralized in little-heroes-tts-service/voices.py (the service
// resolves its own copy server-side from petId; this client-side field is
// only used by the device-native speechSynthesis fallback, which has no
// concept of Kokoro voice ids but still benefits from per-pet pitch/rate
// variety so pets sound different from each other even offline).
// `pitch`/`rate`/`preferredVoice` drive that browser fallback tier only.
const PET_VOICE_PROFILE_DATA = [
  { key: 'rex', id: '1', name: 'Rex the T-Rex', pitch: 1.25, rate: 0.95, kokoroVoice: 'am_puck' },
  { key: 'raptor', id: '2', name: 'Raptor the Velociraptor', pitch: 1.35, rate: 1.05, kokoroVoice: 'am_echo' },
  { key: 'stego', id: '3', name: 'Stego the Stegosaurus', pitch: 0.90, rate: 0.88, kokoroVoice: 'af_nicole' },
  { key: 'pterry', id: '4', name: 'Pterry the Pterodactyl', pitch: 1.40, rate: 1.02, kokoroVoice: 'af_sky' },
  { key: 'chomper', id: '5', name: 'Chomper the Compsognathus', pitch: 1.45, rate: 1.08, kokoroVoice: 'af_bella' },
  { key: 'brachio', id: '6', name: 'Brachio the Brachiosaurus', pitch: 0.85, rate: 0.85, kokoroVoice: 'am_fenrir' },
  { key: 'dippy', id: '7', name: 'Dippy the Diplodocus', pitch: 1.05, rate: 0.92, kokoroVoice: 'am_adam' },
  { key: 'spino', id: '8', name: 'Spino the Spinosaurus', pitch: 0.95, rate: 0.88, kokoroVoice: 'am_onyx' },
  { key: 'sparky', id: '9', name: 'Sparky the Dragon', pitch: 1.30, rate: 1.05, kokoroVoice: 'am_liam' },
  { key: 'aero', id: '10', name: 'Aero the Griffin', pitch: 1.20, rate: 1.00, kokoroVoice: 'af_aoede' },
  { key: 'blaze', id: '11', name: 'Blaze the Phoenix', pitch: 1.15, rate: 0.98, kokoroVoice: 'af_kore' },
  { key: 'hydra', id: '12', name: 'Hydra the Sea Serpent', pitch: 0.90, rate: 0.90, kokoroVoice: 'am_eric' },
  { key: 'luna', id: '13', name: 'Luna the Unicorn', pitch: 1.10, rate: 0.90, kokoroVoice: 'af_heart' },
  { key: 'kira', id: '14', name: 'Kira the Kirin', pitch: 1.25, rate: 1.00, kokoroVoice: 'af_nova' },
  { key: 'boulder', id: '15', name: 'Boulder the Crystal Golem', pitch: 0.80, rate: 0.82, kokoroVoice: 'am_onyx' },
  { key: 'cosmo', id: '16', name: 'Cosmo the Cyber Mech', pitch: 1.20, rate: 1.05, kokoroVoice: 'af_sky' },
  { key: 'leo', id: '17', name: 'Leo the Lion', pitch: 1.00, rate: 0.95, kokoroVoice: 'am_michael' },
  { key: 'stripe', id: '18', name: 'Stripe the Tiger', pitch: 1.30, rate: 1.05, kokoroVoice: 'af_bella' },
  { key: 'fang', id: '19', name: 'Fang the Wolf', pitch: 0.95, rate: 0.90, kokoroVoice: 'am_fenrir' },
  { key: 'scout', id: '20', name: 'Scout the Eagle', pitch: 1.15, rate: 1.00, kokoroVoice: 'af_nicole' },
  { key: 'gnasher', id: '21', name: 'Gnasher the Shark', pitch: 0.90, rate: 0.92, kokoroVoice: 'am_michael' },
  { key: 'shadow-sm', id: '22', name: 'Shadow the Panther', pitch: 1.05, rate: 0.95, kokoroVoice: 'am_echo' },
  { key: 'barnaby', id: '23', name: 'Barnaby the Bear', pitch: 0.85, rate: 0.90, kokoroVoice: 'am_adam' },
  { key: 'ollie', id: '24', name: 'Ollie the Otter', pitch: 1.30, rate: 1.05, kokoroVoice: 'af_river' },
  // Legacy/extra aliases referenced in older content, not part of the
  // numbered 24-pet roster but kept for backward compatibility.
  { key: 'aqua_drake', name: 'Aqua Drake', pitch: 1.05, rate: 0.92, kokoroVoice: 'am_eric' },
  { key: 'aqua', name: 'Aqua Drake', pitch: 1.05, rate: 0.92, kokoroVoice: 'am_eric' },
  { key: 'bella', name: 'Bella the Bunny', pitch: 1.45, rate: 1.05, kokoroVoice: 'af_bella' },
  { key: 'pip', name: 'Pip the Phoenix', pitch: 1.35, rate: 1.00, kokoroVoice: 'am_liam' },
  { key: 'bedtime_narrator', name: 'Bedtime Narrator', pitch: 1.00, rate: 0.85, kokoroVoice: 'af_heart' }
];

export const COMPANION_VOICE_PROFILES = PET_VOICE_PROFILE_DATA.reduce((acc, pet) => {
  const profile = { id: pet.id || pet.key, name: pet.name, pitch: pet.pitch, rate: pet.rate, volume: 1.0, kokoroVoice: pet.kokoroVoice, preferredVoice: 'daniel' };
  acc[pet.key] = profile;
  if (pet.id) acc[pet.id] = profile;
  return acc;
}, {});

let currentAudio = null;
let currentAudioSource = null;
let currentSyllableInterval = null;
let activeUtterance = null;
let hasUserInteracted = false;
let pendingUnlockSpeech = null;
let audioContextUnlocked = false;
let sharedAudioContext = null;

// Bumped at the start of every speakCompanion() call. Each call captures its
// own value and re-checks it after every await -- if a newer call has since
// started, this one abandons rather than committing to playback, so two
// speakCompanion() calls fired close together (a very real scenario in
// fast-paced contexts like the toothbrush battle, where multiple coaching
// lines can trigger within the same second) can never both end up audible
// at once ("speaking over itself").
let speechGeneration = 0;

function dispatchSpeechEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch {}
  }
}

/**
 * Clean stage-direction asterisks and sound action cues (*ROAR!*, *Splish splash!*)
 * so speech synthesizers speak natural, fluid words without reading punctuation aloud.
 */
export function cleanDialogueText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*.*?\*/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Track user gesture to pre-unlock Web Audio and SpeechSynthesis on mobile/WebKit
 */
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    hasUserInteracted = true;
    unlockVoiceAudio();

    // Play any queued speech blocked prior to first touch
    if (pendingUnlockSpeech) {
      const { text, petId, onEnded, options } = pendingUnlockSpeech;
      pendingUnlockSpeech = null;
      speakCompanion(text, petId, onEnded, options).catch(() => {});
    }
  };

  window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
  window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
  window.addEventListener('click', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });

  // Pre-load synthesis voices if available
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      // Voices loaded into browser cache
    };
  }
}

/**
 * Actively pre-unlocks browser audio pipelines on user tap/interaction
 */
export function unlockVoiceAudio() {
  if (typeof window === 'undefined') return;

  // 1. Resume SpeechSynthesis
  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Prime with silent utterance to activate iOS WebKit audio session
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch {
      // Ignore
    }
  }

  // 2. Unlock Web Audio Context
  if (!audioContextUnlocked) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
          sharedAudioContext = new AudioCtx();
        }
        if (sharedAudioContext.state === 'suspended') {
          sharedAudioContext.resume().catch(() => {});
        }
        audioContextUnlocked = true;
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Stops all currently playing companion voice audio and speech synthesis
 */
export const stopRex = () => {
  // 1. Stop Web Audio buffer source
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
    } catch {}
    currentAudioSource = null;
  }

  // 2. Clear syllable ticker interval
  if (currentSyllableInterval) {
    clearInterval(currentSyllableInterval);
    currentSyllableInterval = null;
  }

  // 3. Stop HTML5 audio element if any
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }

  // 4. Stop browser speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  activeUtterance = null;
  store.setLiveRexState({ isSpeaking: false, status: 'idle' }, true);
  dispatchSpeechEvent('companion-speech-end');
};

export const stopCompanionAudio = stopRex;

/**
 * Check if the companion is currently playing audio or speaking
 */
export const isRexSpeaking = () => {
  if (currentAudioSource) return true;
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
    return true;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
    return true;
  }
  return false;
};

export const isCompanionSpeaking = isRexSpeaking;

/**
 * Select preferred speech synthesis voice prioritizing 'Daniel'
 */
export function selectPreferredVoice(preferredName = 'daniel') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  const target = (preferredName || 'daniel').toLowerCase();

  // 1. Strict match for preferred voice name (e.g. Daniel, Microsoft Daniel, Apple Daniel)
  let found = englishVoices.find((v) => v.name.toLowerCase().includes(target));
  if (found) return found;

  found = voices.find((v) => v.name.toLowerCase().includes(target));
  if (found) return found;

  // 2. High-quality natural English fallbacks
  found = englishVoices.find((v) => {
    const name = v.name.toLowerCase();
    return (
      name.includes('natural') ||
      name.includes('google us') ||
      name.includes('samantha') ||
      name.includes('junior') ||
      name.includes('karen') ||
      name.includes('arthur')
    );
  });
  if (found) return found;

  // 3. First English voice or default voice
  return englishVoices[0] || voices[0] || null;
}

/**
 * Gets voice parameters for the given pet companion
 */
export function getCompanionVoiceParams(petId = 'rex') {
  const normId = String(petId || 'rex').toLowerCase().replace(/\s+/g, '_');
  return COMPANION_VOICE_PROFILES[normId] || COMPANION_VOICE_PROFILES.rex;
}

/**
 * Client-Side Cartoon Speech Synthesis with Daniel voice priority & pet tuning
 */
function speakWithSpeechSynthesis(text, petId = 'rex', onEnded = null, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (typeof onEnded === 'function') onEnded();
    return;
  }

  const cleanSpokenText = cleanDialogueText(text);
  if (!cleanSpokenText) {
    if (typeof onEnded === 'function') onEnded();
    return;
  }

  try {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
    if (!synth) return;
    synth.cancel();

    const UtteranceClass = (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
    if (!UtteranceClass) return;
    const utterance = new UtteranceClass(cleanSpokenText);
    const profile = getCompanionVoiceParams(petId);

    // Natural English voice selection prioritizing 'Daniel'
    const chosenVoice = selectPreferredVoice(profile.preferredVoice || 'daniel');
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    const rate = typeof options?.rate === 'number' && Number.isFinite(options.rate) && options.rate > 0
      ? options.rate
      : (profile.rate || 0.95);
    const pitch = typeof options?.pitch === 'number' && Number.isFinite(options.pitch) && options.pitch > 0
      ? options.pitch
      : (profile.pitch || 1.30);
    const volume = typeof options?.volume === 'number' && Number.isFinite(options.volume)
      ? Math.max(0, Math.min(1, options.volume))
      : (profile.volume || 1.0);

    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;

    // Retain module-level reference to prevent V8 GC from stopping speech mid-sentence
    activeUtterance = utterance;

    // Dispatch speech start for skeletal face lip-sync
    store.setLiveRexState({ isSpeaking: true, status: 'speaking' }, true);
    dispatchSpeechEvent('companion-speech-start', { text: cleanSpokenText, petId });

    // Syllable boundary event for real-time phoneme mouth sync
    utterance.onboundary = (e) => {
      dispatchSpeechEvent('companion-speech-syllable', { text: cleanSpokenText, petId, charIndex: e.charIndex });
    };

    utterance.onend = () => {
      activeUtterance = null;
      store.setLiveRexState({ isSpeaking: false }, true);
      dispatchSpeechEvent('companion-speech-end', { petId });
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch (e) {
          console.error('Error in voice onEnded callback:', e);
        }
      } else {
        const liveRex = store.getState().liveRex;
        if (!liveRex?.isListening && liveRex?.status !== 'listening') {
          store.setLiveRexState({ status: 'idle' }, true);
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.debug('SpeechSynthesis notice:', e.error);
      }
      activeUtterance = null;
      store.setLiveRexState({ isSpeaking: false }, true);
      dispatchSpeechEvent('companion-speech-end', { petId });
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch {}
      } else {
        const liveRex = store.getState().liveRex;
        if (!liveRex?.isListening && liveRex?.status !== 'listening') {
          store.setLiveRexState({ status: 'idle' }, true);
        }
      }
    };

    // Chromium SpeechSynthesis keepalive (prevents Chrome from freezing after ~15s)
    let keepAliveInterval = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      keepAliveInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        } else {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    }

    const originalOnEnd = utterance.onend;
    utterance.onend = () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      if (typeof originalOnEnd === 'function') originalOnEnd();
    };

    const originalOnError = utterance.onerror;
    utterance.onerror = (e) => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      if (typeof originalOnError === 'function') originalOnError(e);
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
    if (typeof onEnded === 'function') onEnded();
  }
}

function base64ToFloat32Array(base64Data) {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

/**
 * Plays a base64 raw-PCM16 TTS response (the shape returned by the Kokoro
 * TTS microservice) through the shared AudioContext, wiring up the same
 * speech-start/syllable/end events used for lip-sync.
 * Returns true if playback started.
 */
async function playPcmTtsResponse(data, cleanSpoken, petId, callback, myGeneration, options = {}) {
  if (!data || (!data.audio && !data.audioBuffer)) return false;

  const AudioCtx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtx) return false;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
    } catch {
      try {
        sharedAudioContext = new AudioCtx();
      } catch {
        return false;
      }
    }
  }
  if (sharedAudioContext.state === 'suspended') {
    await sharedAudioContext.resume().catch(() => {});
  }

  // A newer speakCompanion() call started while we were awaiting the
  // AudioContext resume above -- committing to play now would talk over it
  // (exactly the "speaking over itself" bug: two overlapping TTS fetches
  // that each resolve at an unpredictable time, with nothing stopping a
  // slow, stale one from starting playback after a faster, newer one
  // already began). Abandon silently; the newer call owns playback now.
  if (typeof myGeneration === 'number' && myGeneration !== speechGeneration) {
    return false;
  }

  // Anti-collision safeguard: ensure previous active audio source is cleanly stopped
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
    } catch {}
    currentAudioSource = null;
  }

  let audioBuffer = data.audioBuffer;
  if (!audioBuffer && data.audio) {
    try {
      const float32 = base64ToFloat32Array(data.audio);
      const sampleRate = data.sampleRate || 24000;
      audioBuffer = sharedAudioContext.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);
      data.audioBuffer = audioBuffer;
    } catch (e) {
      console.warn('Failed to decode PCM audio data:', e);
      return false;
    }
  }
  if (!audioBuffer) return false;

  const source = sharedAudioContext.createBufferSource();
  source.buffer = audioBuffer;

  // Apply playback rate scaling for soothing bedtime whisper cadence or custom rate
  const rate = typeof options?.rate === 'number' && Number.isFinite(options.rate) && options.rate > 0
    ? options.rate
    : 1.0;

  if (source.playbackRate && typeof source.playbackRate.setValueAtTime === 'function') {
    try {
      source.playbackRate.setValueAtTime(rate, sharedAudioContext.currentTime);
    } catch {
      source.playbackRate.value = rate;
    }
  } else if (source.playbackRate) {
    source.playbackRate.value = rate;
  }

  // AudioBufferSourceNode.playbackRate is a naive resample: slowing it down
  // (as the progressively hushed bedtime chapter cadence does) also drops the
  // pitch, since Web Audio has no built-in pitch-preserving time-stretch.
  // Without compensation, the later (slower) chapters end up sounding like a
  // noticeably different, deeper voice than the earlier ones even though the
  // same Kokoro voice is used throughout. Counteract that with `detune`
  // (in cents) so the net pitch stays consistent across every rate, then
  // layer the caller's own small deliberate `options.pitch` multiplier (e.g.
  // a touch sleepier for later chapters) on top of the now-neutral baseline.
  if (source.detune) {
    const callerPitch = typeof options?.pitch === 'number' && Number.isFinite(options.pitch) && options.pitch > 0
      ? options.pitch
      : 1.0;
    const detuneCents = (-1200 * Math.log2(rate)) + (1200 * Math.log2(callerPitch));
    try {
      if (typeof source.detune.setValueAtTime === 'function') {
        source.detune.setValueAtTime(detuneCents, sharedAudioContext.currentTime);
      } else {
        source.detune.value = detuneCents;
      }
    } catch {
      source.detune.value = detuneCents;
    }
  }

  source.connect(sharedAudioContext.destination);
  currentAudioSource = source;

  store.setLiveRexState({ isSpeaking: true, status: 'speaking' }, true);
  dispatchSpeechEvent('companion-speech-start', { text: cleanSpoken, petId, voice: data.voice });

  currentSyllableInterval = setInterval(() => {
    if (!currentAudioSource) {
      clearInterval(currentSyllableInterval);
      currentSyllableInterval = null;
      return;
    }
    dispatchSpeechEvent('companion-speech-syllable', { text: cleanSpoken, petId });
  }, 110);

  source.onended = () => {
    if (currentAudioSource === source) {
      currentAudioSource = null;
    }
    if (currentSyllableInterval) {
      clearInterval(currentSyllableInterval);
      currentSyllableInterval = null;
    }
    store.setLiveRexState({ isSpeaking: false }, true);
    dispatchSpeechEvent('companion-speech-end', { petId });
    if (typeof callback === 'function') {
      callback();
    } else {
      const liveRex = store.getState().liveRex;
      if (!liveRex?.isListening && liveRex?.status !== 'listening') {
        store.setLiveRexState({ status: 'idle' }, true);
      }
    }
  };

  source.start(0);
  return true;
}

/**
 * Fetches a PCM TTS response from a server endpoint with a configurable timeout,
 * returning the parsed JSON on success or null on any failure/timeout/
 * non-2xx response (so callers can fall through to the next voice tier).
 *
 * Defaults to 18000ms for bedtime chapters (or when voiceStyle === 'bedtime')
 * to prevent short-timeout aborts on long story chapters.
 */
export function getVoiceApiBaseUrl() {
  // Direct-to-service override, same pattern as VITE_AGY_REX_URL for the
  // AGY companion-chat microservice: when set, every build/host calls the
  // Kokoro Cloud Run service directly instead of relying on a same-origin
  // rewrite.
  const directUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_KOKORO_TTS_URL) || '';
  if (directUrl) return directUrl.replace(/\/+$/, '');

  if (typeof window === 'undefined') return '';
  const hostname = (typeof window !== 'undefined' && window.location?.hostname) || '';
  // When running on GitHub Pages (recklesswarman.github.io), proxy voice calls to live production Firebase backend,
  // whose firebase.json rewrite forwards /api/tts/** to the Kokoro Cloud Run service.
  if (hostname.includes('github.io')) {
    return 'https://little-heroes-quest-8842.web.app';
  }
  return '';
}

let kokoroWarmUpStarted = false;

/**
 * Wakes the (scale-to-zero) Kokoro Cloud Run instance and its model so the
 * first spoken line of a session doesn't hit a cold start and silently fall
 * back to the browser voice. Fire-and-forget, once per page load.
 */
export function warmUpKokoroTts() {
  if (kokoroWarmUpStarted || typeof fetch !== 'function') return;
  kokoroWarmUpStarted = true;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 90000) : null;
  fetch(`${getVoiceApiBaseUrl()}${KOKORO_TTS_ENDPOINT}/health`, controller ? { signal: controller.signal } : undefined)
    .catch(() => {})
    .finally(() => { if (timeoutId) clearTimeout(timeoutId); });
}

export async function fetchPcmTts(endpoint, cleanSpoken, petId, timeoutMsOrOptions = KOKORO_DEFAULT_TIMEOUT_MS, voiceStyle = 'default') {
  const fullEndpoint = (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
    ? endpoint
    : `${getVoiceApiBaseUrl()}${endpoint}`;
  let timeoutMs = KOKORO_DEFAULT_TIMEOUT_MS;
  let style = voiceStyle || 'default';

  if (timeoutMsOrOptions && typeof timeoutMsOrOptions === 'object') {
    if (typeof timeoutMsOrOptions.timeoutMs === 'number') {
      timeoutMs = timeoutMsOrOptions.timeoutMs;
    }
    if (timeoutMsOrOptions.voiceStyle) {
      style = timeoutMsOrOptions.voiceStyle;
    }
  } else if (typeof timeoutMsOrOptions === 'number' && timeoutMsOrOptions > 0) {
    timeoutMs = timeoutMsOrOptions;
  }

  // If bedtime style, default to 25000ms unless a custom timeout was explicitly specified (other than the default)
  if (style === 'bedtime') {
    if (timeoutMs === KOKORO_DEFAULT_TIMEOUT_MS || !timeoutMs) {
      timeoutMs = 25000;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const bodyPayload = {
      text: cleanSpoken,
      petId
    };
    if (style && style !== 'default') {
      bodyPayload.voiceStyle = style;
    }

    const response = await fetch(fullEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data && data.audio ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Pre-fetches and pre-renders cadence audio clips for the active workout routine
 * into the zero-latency client-side audio cache (`workoutAudioClipCache`).
 * Ensures all cadence cues (0s, 10s, 20s, 30s, 40s, 50s, 58s/end) and intro/cheers
 * trigger with 0ms latency during exercise.
 */
export async function prewarmWorkoutAudio(workoutId, coachId = null) {
  let workout = null;
  if (workoutId && typeof workoutId === 'object' && workoutId.cadenceTimeline) {
    workout = workoutId;
  } else if (typeof workoutId === 'string' && Array.isArray(DINO_WORKOUTS)) {
    workout = DINO_WORKOUTS.find((w) => w.id === workoutId);
  }
  if (!workout) return;

  const targetCoach = coachId || workout.coachId || 'rex';
  const normKey = normalizePetKey(targetCoach);
  const rawId = String(targetCoach).toLowerCase().trim();

  const cuesToPrewarm = new Set();
  if (Array.isArray(workout.cadenceTimeline)) {
    for (const item of workout.cadenceTimeline) {
      if (item?.cue) cuesToPrewarm.add(item.cue);
    }
  }
  if (workout.audioCues) {
    if (workout.audioCues.intro) cuesToPrewarm.add(workout.audioCues.intro);
    if (workout.audioCues.halfway) cuesToPrewarm.add(workout.audioCues.halfway);
    if (workout.audioCues.finalCheer) cuesToPrewarm.add(workout.audioCues.finalCheer);
  }

  const tasks = Array.from(cuesToPrewarm).map(async (cueText) => {
    const cleanSpoken = cleanDialogueText(cueText);
    if (!cleanSpoken) return;

    const cacheKey = `${normKey}:${cleanSpoken}`;
    if (workoutAudioClipCache.has(cacheKey) || workoutAudioClipCache.has(`${rawId}:${cleanSpoken}`)) {
      return;
    }

    const data = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, targetCoach, KOKORO_DEFAULT_TIMEOUT_MS);

    if (data && data.audio) {
      // Pre-decode into AudioBuffer if AudioContext is available
      const AudioCtx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (AudioCtx) {
        try {
          if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
            sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
          }
          if (sharedAudioContext) {
            const float32 = base64ToFloat32Array(data.audio);
            const sampleRate = data.sampleRate || 24000;
            const buffer = sharedAudioContext.createBuffer(1, float32.length, sampleRate);
            buffer.copyToChannel(float32, 0);
            data.audioBuffer = buffer;
          }
        } catch {}
      }

      workoutAudioClipCache.set(cacheKey, data);
      workoutAudioClipCache.set(`${rawId}:${cleanSpoken}`, data);
      workoutAudioClipCache.set(cleanSpoken, data);
    }
  });

  await Promise.allSettled(tasks);
}

/**
 * Unified Spoken Voice Entrypoint for Pet Companions
 * 0. Zero-Latency Client-Side Cache Check (`workoutAudioClipCache`).
 * 1. Prepares dialogue text by stripping asterisks/stage directions.
 * 2. Primary: self-hosted Kokoro TTS microservice (/api/tts), voice resolved per pet.
 * 3. Resilient Fallback: Cartoon Speech Synthesis with natural 'Daniel' voice if offline.
 */
/**
 * Pre-fetches and pre-decodes audio for an upcoming dialogue or bedtime chapter
 * into `workoutAudioClipCache` so it triggers with 0ms latency when requested.
 *
 * @param {string} text - Raw text to clean and synthesize.
 * @param {string|number|Object} [petIdOrOptions='rex'] - Active companion pet id, or options object.
 * @param {Object} [options={}] - { timeoutMs: 18000, voiceStyle: 'bedtime', rate: 0.88 }
 * @returns {Promise<AudioBuffer|Object|null>} Decoded audio buffer/payload or null on failure.
 */
export async function prefetchCompanionAudio(text, petIdOrOptions = 'rex', options = {}) {
  const cleanSpoken = cleanDialogueText(text);
  if (!cleanSpoken) return null;

  let petId = 'rex';
  let opts = {};

  if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    opts = { ...petIdOrOptions };
    petId = petIdOrOptions.petId || 'rex';
  } else if (typeof petIdOrOptions === 'string' || typeof petIdOrOptions === 'number') {
    petId = String(petIdOrOptions);
    if (options && typeof options === 'object') {
      opts = { ...options };
    }
  } else if (options && typeof options === 'object') {
    opts = { ...options };
  }

  const normKey = normalizePetKey(petId);
  const rawId = String(petId || 'rex').toLowerCase().trim();
  const voiceStyle = opts.voiceStyle || 'default';
  const timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0
    ? opts.timeoutMs
    : (voiceStyle === 'bedtime' ? 18000 : KOKORO_DEFAULT_TIMEOUT_MS);

  const styleKey = `${normKey}:${voiceStyle}:${cleanSpoken}`;
  const rawStyleKey = `${rawId}:${voiceStyle}:${cleanSpoken}`;
  const genericKey = `${normKey}:${cleanSpoken}`;
  const rawKey = `${rawId}:${cleanSpoken}`;

  // 1. Check if already cached
  const existing =
    (voiceStyle && voiceStyle !== 'default' ? workoutAudioClipCache.get(styleKey) : null) ||
    (voiceStyle && voiceStyle !== 'default' ? workoutAudioClipCache.get(rawStyleKey) : null) ||
    workoutAudioClipCache.get(genericKey) ||
    workoutAudioClipCache.get(rawKey) ||
    workoutAudioClipCache.get(cleanSpoken);

  if (existing) {
    const res = existing.audioBuffer || existing;
    if (res && existing.audioBuffer) {
      res.audio = existing.audio;
      res.sampleRate = existing.sampleRate;
      res.audioBuffer = existing.audioBuffer;
    }
    return res;
  }

  // 2. Background fetch via the Kokoro TTS microservice
  const data = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, petId, timeoutMs, voiceStyle);

  if (!data || !data.audio) return null;

  // 3. Pre-decode into Web Audio AudioBuffer if AudioContext is accessible
  const AudioCtx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (AudioCtx) {
    try {
      if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        try {
          sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
        } catch {
          sharedAudioContext = new AudioCtx();
        }
      }
      if (sharedAudioContext) {
        const float32 = base64ToFloat32Array(data.audio);
        const sampleRate = data.sampleRate || 24000;
        const buffer = sharedAudioContext.createBuffer(1, float32.length, sampleRate);
        buffer.copyToChannel(float32, 0);
        data.audioBuffer = buffer;
      }
    } catch (e) {
      console.warn('Audio prefetch decode notice:', e);
    }
  }

  // 4. Save into client cache
  if (voiceStyle && voiceStyle !== 'default') {
    workoutAudioClipCache.set(styleKey, data);
    workoutAudioClipCache.set(rawStyleKey, data);
  }
  workoutAudioClipCache.set(genericKey, data);
  workoutAudioClipCache.set(rawKey, data);
  workoutAudioClipCache.set(cleanSpoken, data);

  const result = data.audioBuffer || data;
  if (result && data.audioBuffer) {
    result.audio = data.audio;
    result.sampleRate = data.sampleRate;
    result.audioBuffer = data.audioBuffer;
  }
  return result;
}

/**
 * Unified Spoken Voice Entrypoint for Pet Companions
 * 0. Zero-Latency Client-Side Cache Check (`workoutAudioClipCache`).
 * 1. Prepares dialogue text by stripping asterisks/stage directions.
 * 2. Primary: self-hosted Kokoro TTS microservice (/api/tts), voice resolved per pet.
 * 3. Resilient Fallback: Cartoon Speech Synthesis with natural 'Daniel' voice if offline.
 */
export const speakCompanion = async (text, petIdOrOptions = 'rex', onEndedOrOptions = null, options = {}) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;

  let petId = 'rex';
  let callback = null;
  let opts = {
    timeoutMs: KOKORO_DEFAULT_TIMEOUT_MS,
    rate: 1.0,
    pitch: 1.0,
    voiceStyle: 'default',
    instant: false
  };

  // Case 1: 2nd argument is an options object
  if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    opts = { ...opts, ...petIdOrOptions };
    if (petIdOrOptions.petId) {
      petId = petIdOrOptions.petId;
    }
    if (typeof petIdOrOptions.onEnded === 'function') {
      callback = petIdOrOptions.onEnded;
    }
  }
  // Case 2: 2nd argument is a callback function
  else if (typeof petIdOrOptions === 'function') {
    callback = petIdOrOptions;
  }
  // Case 3: 2nd argument is a petId string/number
  else if (petIdOrOptions !== undefined && petIdOrOptions !== null) {
    petId = String(petIdOrOptions);
  }

  // Case 4: 3rd argument is a callback function
  if (typeof onEndedOrOptions === 'function') {
    callback = onEndedOrOptions;
  }
  // Case 5: 3rd argument is an options object
  else if (onEndedOrOptions && typeof onEndedOrOptions === 'object') {
    opts = { ...opts, ...onEndedOrOptions };
    if (typeof onEndedOrOptions.onEnded === 'function') {
      callback = onEndedOrOptions.onEnded;
    }
    if (onEndedOrOptions.petId && (!petId || petId === 'rex')) {
      petId = onEndedOrOptions.petId;
    }
  }

  // Case 6: 4th argument trailing options
  if (options && typeof options === 'object') {
    opts = { ...opts, ...options };
    if (typeof options.onEnded === 'function' && !callback) {
      callback = options.onEnded;
    }
    if (options.petId && (!petId || petId === 'rex')) {
      petId = options.petId;
    }
  }

  // If voiceStyle is 'bedtime' and timeoutMs wasn't explicitly changed from the default, default to 18000ms
  if (opts.voiceStyle === 'bedtime' && (!opts.timeoutMs || opts.timeoutMs === KOKORO_DEFAULT_TIMEOUT_MS)) {
    opts.timeoutMs = 18000;
  }

  // If no explicit petId given or default rex, check active pet in store
  if (!petId || petId === 'rex') {
    try {
      const active = store?.getActivePet?.();
      if (active?.id) petId = active.id;
    } catch {}
  }

  const cleanSpoken = cleanDialogueText(text);
  if (!cleanSpoken) {
    if (typeof callback === 'function') callback();
    return;
  }

  // Claim this as the newest call -- any earlier in-flight call (still
  // awaiting a fetch or an AudioContext resume) checks this after every
  // await and abandons rather than starting audio once it's no longer current.
  const myGeneration = ++speechGeneration;

  // Immediately stop any prior speech output (anti-collision & non-overlapping)
  stopRex();

  // If user has not interacted yet, queue speech so it fires on their first tap
  if (!hasUserInteracted) {
    pendingUnlockSpeech = { text: cleanSpoken, petId, onEnded: callback, options: opts };
  }

  // --- Tier 0: Zero-Latency Client-Side Audio Cache ---
  const normKey = normalizePetKey(petId);
  const rawId = String(petId).toLowerCase().trim();
  const voiceStyle = opts.voiceStyle || 'default';

  const cachedData =
    (voiceStyle && voiceStyle !== 'default' ? workoutAudioClipCache.get(`${normKey}:${voiceStyle}:${cleanSpoken}`) : null) ||
    (voiceStyle && voiceStyle !== 'default' ? workoutAudioClipCache.get(`${rawId}:${voiceStyle}:${cleanSpoken}`) : null) ||
    workoutAudioClipCache.get(`${normKey}:${cleanSpoken}`) ||
    workoutAudioClipCache.get(`${rawId}:${cleanSpoken}`) ||
    workoutAudioClipCache.get(cleanSpoken);

  if (cachedData) {
    const played = await playPcmTtsResponse(cachedData, cleanSpoken, petId, callback, myGeneration, opts);
    if (played) return;
    if (myGeneration !== speechGeneration) return;
    speakWithSpeechSynthesis(cleanSpoken, petId, callback, opts);
    return;
  }

  if (opts.instant) {
    const INSTANT_KOKORO_TIMEOUT_MS = 1800;
    const fastData = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, petId, INSTANT_KOKORO_TIMEOUT_MS, voiceStyle);
    if (myGeneration !== speechGeneration) return;
    if (fastData) {
      if (voiceStyle && voiceStyle !== 'default') {
        workoutAudioClipCache.set(`${normKey}:${voiceStyle}:${cleanSpoken}`, fastData);
        workoutAudioClipCache.set(`${rawId}:${voiceStyle}:${cleanSpoken}`, fastData);
      }
      workoutAudioClipCache.set(`${normKey}:${cleanSpoken}`, fastData);
      workoutAudioClipCache.set(cleanSpoken, fastData);
      const played = await playPcmTtsResponse(fastData, cleanSpoken, petId, callback, myGeneration, opts);
      if (played) return;
      if (myGeneration !== speechGeneration) return;
    }
    speakWithSpeechSynthesis(cleanSpoken, petId, callback, opts);
    return;
  }

  let ttsSucceeded = false;
  const timeoutMs = opts.timeoutMs || (voiceStyle === 'bedtime' ? 45000 : 4500);

  // 1. Primary: self-hosted Kokoro TTS microservice.
  const kokoroData = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, petId, timeoutMs, voiceStyle);
  if (myGeneration !== speechGeneration) return;
  if (kokoroData) {
    if (voiceStyle && voiceStyle !== 'default') {
      workoutAudioClipCache.set(`${normKey}:${voiceStyle}:${cleanSpoken}`, kokoroData);
      workoutAudioClipCache.set(`${rawId}:${voiceStyle}:${cleanSpoken}`, kokoroData);
    }
    workoutAudioClipCache.set(`${normKey}:${cleanSpoken}`, kokoroData);
    workoutAudioClipCache.set(cleanSpoken, kokoroData);
    ttsSucceeded = await playPcmTtsResponse(kokoroData, cleanSpoken, petId, callback, myGeneration, opts);
  }

  // 2. Resilient Client-Side Speech Synthesis Fallback (Daniel Voice)
  if (!ttsSucceeded) {
    if (myGeneration !== speechGeneration) return;
    speakWithSpeechSynthesis(cleanSpoken, petId, callback, opts);
  }
};

/**
 * Flagship alias for backward compatibility across existing calls
 */
export const speakRex = async (text, onEnded = null) => {
  return speakCompanion(text, 'rex', onEnded);
};
