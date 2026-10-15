// Pet Companion & Rex the Dino Spoken Voice Guidance Service
// Architecture:
// 1. Primary: ElevenLabs voice, where a pet has one configured (/api/elevenlabs/tts)
// 2. Secondary: Realistic Human Kid-Friendly Voice via Gemini 3.1 Flash TTS (/api/gemini/tts)
// 3. Resilient Fallback: High-Fidelity Cartoon Speech Synthesis with device-native voice
// 4. Multi-Pet Pitch & Persona Tuning (Rex the Dino, Aqua Drake, Bella, Barnaby, Pip)
// 5. Browser Autoplay & Gesture Pre-Unlock Engine

import { store } from '../state/store.js';
import { DINO_WORKOUTS } from '../data/petsData.js';

const ELEVENLABS_TTS_ENDPOINT = '/api/elevenlabs/tts';
const TTS_ENDPOINT = '/api/gemini/tts';

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
    '8': 'spino'
  };
  return idMap[raw] || raw;
}

/**
 * Generates cache key for workout audio clips
 */
export function getAudioCacheKey(text, petId = 'rex') {
  const clean = cleanDialogueText(text);
  const norm = normalizePetKey(petId);
  return `${norm}:${clean}`;
}

export const COMPANION_VOICE_PROFILES = {
  rex: {
    id: 'rex',
    name: 'Rex the Dino',
    pitch: 1.25,
    rate: 0.95,
    volume: 1.0,
    geminiVoice: 'Puck',
    preferredVoice: 'daniel'
  },
  '1': {
    id: '1',
    name: 'Rex the Dino',
    pitch: 1.25,
    rate: 0.95,
    volume: 1.0,
    geminiVoice: 'Puck',
    preferredVoice: 'daniel'
  },
  raptor: {
    id: 'raptor',
    name: 'Raptor the Velociraptor',
    pitch: 1.35,
    rate: 1.05,
    volume: 1.0,
    geminiVoice: 'Zephyr',
    preferredVoice: 'daniel'
  },
  '2': {
    id: '2',
    name: 'Raptor the Velociraptor',
    pitch: 1.35,
    rate: 1.05,
    volume: 1.0,
    geminiVoice: 'Zephyr',
    preferredVoice: 'daniel'
  },
  stego: {
    id: 'stego',
    name: 'Stego the Stegosaurus',
    pitch: 0.90,
    rate: 0.88,
    volume: 1.0,
    geminiVoice: 'Fenrir',
    preferredVoice: 'daniel'
  },
  '3': {
    id: '3',
    name: 'Stego the Stegosaurus',
    pitch: 0.90,
    rate: 0.88,
    volume: 1.0,
    geminiVoice: 'Fenrir',
    preferredVoice: 'daniel'
  },
  pterry: {
    id: 'pterry',
    name: 'Pterry the Pterodactyl',
    pitch: 1.40,
    rate: 1.02,
    volume: 1.0,
    geminiVoice: 'Aoede',
    preferredVoice: 'daniel'
  },
  '4': {
    id: '4',
    name: 'Pterry the Pterodactyl',
    pitch: 1.40,
    rate: 1.02,
    volume: 1.0,
    geminiVoice: 'Aoede',
    preferredVoice: 'daniel'
  },
  chomper: {
    id: 'chomper',
    name: 'Chomper the Compsognathus',
    pitch: 1.45,
    rate: 1.08,
    volume: 1.0,
    geminiVoice: 'Puck',
    preferredVoice: 'daniel'
  },
  '5': {
    id: '5',
    name: 'Chomper the Compsognathus',
    pitch: 1.45,
    rate: 1.08,
    volume: 1.0,
    geminiVoice: 'Puck',
    preferredVoice: 'daniel'
  },
  brachio: {
    id: 'brachio',
    name: 'Brachio the Brachiosaurus',
    pitch: 0.85,
    rate: 0.85,
    volume: 1.0,
    geminiVoice: 'Charon',
    preferredVoice: 'daniel'
  },
  '6': {
    id: '6',
    name: 'Brachio the Brachiosaurus',
    pitch: 0.85,
    rate: 0.85,
    volume: 1.0,
    geminiVoice: 'Charon',
    preferredVoice: 'daniel'
  },
  dippy: {
    id: 'dippy',
    name: 'Dippy the Diplodocus',
    pitch: 1.05,
    rate: 0.92,
    volume: 1.0,
    geminiVoice: 'Charon',
    preferredVoice: 'daniel'
  },
  '7': {
    id: '7',
    name: 'Dippy the Diplodocus',
    pitch: 1.05,
    rate: 0.92,
    volume: 1.0,
    geminiVoice: 'Charon',
    preferredVoice: 'daniel'
  },
  spino: {
    id: 'spino',
    name: 'Spino the Spinosaurus',
    pitch: 0.95,
    rate: 0.88,
    volume: 1.0,
    geminiVoice: 'Fenrir',
    preferredVoice: 'daniel'
  },
  '8': {
    id: '8',
    name: 'Spino the Spinosaurus',
    pitch: 0.95,
    rate: 0.88,
    volume: 1.0,
    geminiVoice: 'Fenrir',
    preferredVoice: 'daniel'
  },
  aqua_drake: {
    id: 'aqua_drake',
    name: 'Aqua Drake',
    pitch: 1.05,
    rate: 0.92,
    volume: 1.0,
    geminiVoice: 'Charon',
    preferredVoice: 'daniel'
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua Drake',
    pitch: 1.05,
    rate: 0.92,
    volume: 1.0,
    geminiVoice: 'Charon',
    preferredVoice: 'daniel'
  },
  bella: {
    id: 'bella',
    name: 'Bella the Bunny',
    pitch: 1.45,
    rate: 1.05,
    volume: 1.0,
    geminiVoice: 'Aoede',
    preferredVoice: 'daniel'
  },
  barnaby: {
    id: 'barnaby',
    name: 'Barnaby the Bear',
    pitch: 0.85,
    rate: 0.90,
    volume: 1.0,
    geminiVoice: 'Fenrir',
    preferredVoice: 'daniel'
  },
  pip: {
    id: 'pip',
    name: 'Pip the Phoenix',
    pitch: 1.35,
    rate: 1.00,
    volume: 1.0,
    geminiVoice: 'Zephyr',
    preferredVoice: 'daniel'
  }
};

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
      const { text, petId, onEnded } = pendingUnlockSpeech;
      pendingUnlockSpeech = null;
      speakCompanion(text, petId, onEnded).catch(() => {});
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
function speakWithSpeechSynthesis(text, petId = 'rex', onEnded = null) {
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
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    const profile = getCompanionVoiceParams(petId);

    // Natural English voice selection prioritizing 'Daniel'
    const chosenVoice = selectPreferredVoice(profile.preferredVoice || 'daniel');
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.pitch = profile.pitch || 1.30;
    utterance.rate = profile.rate || 0.95;
    utterance.volume = profile.volume || 1.0;

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
 * Plays a base64 raw-PCM16 TTS response (shared shape returned by both the
 * ElevenLabs and Gemini TTS server routes) through the shared AudioContext,
 * wiring up the same speech-start/syllable/end events used for lip-sync.
 * Returns true if playback started.
 */
async function playPcmTtsResponse(data, cleanSpoken, petId, callback, myGeneration) {
  if (!data || (!data.audio && !data.audioBuffer)) return false;

  const AudioCtx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtx) return false;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
    } catch {
      return false;
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
 * Fetches a PCM TTS response from a server endpoint with a short timeout,
 * returning the parsed JSON on success or null on any failure/timeout/
 * non-2xx response (so callers can fall through to the next voice tier).
 */
async function fetchPcmTts(endpoint, cleanSpoken, petId, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanSpoken, petId }),
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

    // Try ElevenLabs first
    let data = await fetchPcmTts(ELEVENLABS_TTS_ENDPOINT, cleanSpoken, targetCoach, 3000);
    // If ElevenLabs fails or is unconfigured, fall back to Gemini TTS
    if (!data) {
      data = await fetchPcmTts(TTS_ENDPOINT, cleanSpoken, targetCoach, 4500);
    }

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
 * 2. Primary: ElevenLabs voice, where this pet has one configured (/api/elevenlabs/tts).
 * 3. Secondary: Realistic kid-friendly voice via Gemini 3.1 Flash TTS (/api/gemini/tts).
 * 4. Resilient Fallback: Cartoon Speech Synthesis with natural 'Daniel' voice if offline.
 */
export const speakCompanion = async (text, petIdOrOptions = 'rex', onEnded = null) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;

  let petId = 'rex';
  let callback = onEnded;
  let instant = false;

  if (typeof petIdOrOptions === 'string') {
    petId = petIdOrOptions;
  } else if (typeof petIdOrOptions === 'function') {
    callback = petIdOrOptions;
  } else if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    petId = petIdOrOptions.petId || 'rex';
    if (petIdOrOptions.onEnded) callback = petIdOrOptions.onEnded;
    instant = Boolean(petIdOrOptions.instant);
  }

  // If no explicit petId given or default rex, check active pet in store
  if (!petId || petId === 'rex') {
    try {
      const active = store?.getActivePet?.();
      if (active?.id) petId = active.id;
    } catch {}
  }

  const cleanSpoken = cleanDialogueText(text);
  if (!cleanSpoken) return;

  // Claim this as the newest call -- any earlier in-flight call (still
  // awaiting a fetch or an AudioContext resume) checks this after every
  // await and abandons rather than starting audio once it's no longer current.
  const myGeneration = ++speechGeneration;

  // Immediately stop any prior speech output (anti-collision & non-overlapping)
  stopRex();

  // If user has not interacted yet, queue speech so it fires on their first tap
  if (!hasUserInteracted) {
    pendingUnlockSpeech = { text: cleanSpoken, petId, onEnded: callback };
  }

  // --- Tier 0: Zero-Latency Client-Side Audio Cache ---
  const normKey = normalizePetKey(petId);
  const rawId = String(petId).toLowerCase().trim();
  const cachedData =
    workoutAudioClipCache.get(`${normKey}:${cleanSpoken}`) ||
    workoutAudioClipCache.get(`${rawId}:${cleanSpoken}`) ||
    workoutAudioClipCache.get(cleanSpoken);

  if (cachedData) {
    const played = await playPcmTtsResponse(cachedData, cleanSpoken, petId, callback, myGeneration);
    if (played) return;
    if (myGeneration !== speechGeneration) return;
    speakWithSpeechSynthesis(cleanSpoken, petId, callback);
    return;
  }

  if (instant) {
    const INSTANT_ELEVENLABS_TIMEOUT_MS = 700;
    const fastData = await fetchPcmTts(ELEVENLABS_TTS_ENDPOINT, cleanSpoken, petId, INSTANT_ELEVENLABS_TIMEOUT_MS);
    if (myGeneration !== speechGeneration) return;
    if (fastData) {
      workoutAudioClipCache.set(`${normKey}:${cleanSpoken}`, fastData);
      workoutAudioClipCache.set(cleanSpoken, fastData);
      const played = await playPcmTtsResponse(fastData, cleanSpoken, petId, callback, myGeneration);
      if (played) return;
      if (myGeneration !== speechGeneration) return;
    }
    speakWithSpeechSynthesis(cleanSpoken, petId, callback);
    return;
  }

  let ttsSucceeded = false;

  // 1. Primary: ElevenLabs voice (only pets with a configured voice get one;
  // the server responds 404 for anyone else, and we fall through below).
  const elevenLabsData = await fetchPcmTts(ELEVENLABS_TTS_ENDPOINT, cleanSpoken, petId);
  if (myGeneration !== speechGeneration) return;
  if (elevenLabsData) {
    workoutAudioClipCache.set(`${normKey}:${cleanSpoken}`, elevenLabsData);
    workoutAudioClipCache.set(cleanSpoken, elevenLabsData);
    ttsSucceeded = await playPcmTtsResponse(elevenLabsData, cleanSpoken, petId, callback, myGeneration);
  }

  // 2. Secondary: Server-Side Realistic Gemini TTS Engine (/api/gemini/tts)
  if (!ttsSucceeded) {
    if (myGeneration !== speechGeneration) return;
    const geminiData = await fetchPcmTts(TTS_ENDPOINT, cleanSpoken, petId);
    if (myGeneration !== speechGeneration) return;
    if (geminiData) {
      workoutAudioClipCache.set(`${normKey}:${cleanSpoken}`, geminiData);
      workoutAudioClipCache.set(cleanSpoken, geminiData);
      ttsSucceeded = await playPcmTtsResponse(geminiData, cleanSpoken, petId, callback, myGeneration);
    }
  }

  // 3. Resilient Client-Side Speech Synthesis Fallback (Daniel Voice)
  if (!ttsSucceeded) {
    if (myGeneration !== speechGeneration) return;
    speakWithSpeechSynthesis(cleanSpoken, petId, callback);
  }
};

/**
 * Flagship alias for backward compatibility across existing calls
 */
export const speakRex = async (text, onEnded = null) => {
  return speakCompanion(text, 'rex', onEnded);
};
