// Pet Companion & Rex the Dino Spoken Voice Guidance Service
// Architecture:
// 1. Primary: self-hosted Kokoro TTS microservice (/api/tts), with a distinct
//    voice per companion pet resolved centrally in that service (see
//    little-heroes-tts-service/voices.py)
// 2. Persistent IndexedDB + In-Memory Zero-Latency Audio Cache (`workoutAudioClipCache`)
// 3. Pipelined Multi-Sentence Streaming for AI Storybook (~1.2s time-to-first-word)
// 4. Resilient Fallback: High-Fidelity Cartoon Speech Synthesis with device-native voice
// 5. Browser Autoplay & Synchronous Gesture Pre-Unlock Engine

import { store } from '../state/store.js';
import { DINO_WORKOUTS } from '../data/petsData.js';

const KOKORO_TTS_ENDPOINT = '/api/tts';
const PROD_KOKORO_CLOUD_RUN_URL = 'https://little-heroes-tts-kokoro-592754457115.us-central1.run.app';

// How long a normal (non-bedtime, non-instant) line waits for Kokoro before the
// browser voice takes over. Must stay > 4500 and < 18000 per warmup contract.
export const KOKORO_DEFAULT_TIMEOUT_MS = 14000;

// Zero-latency client-side audio cache for gross-motor cadence cues, companion phrases, and bedtime clips
export const workoutAudioClipCache = new Map();

// Core app-wide voice guidance cues pre-warmed in background for 0ms response
export const CORE_APP_GUIDANCE_PHRASES = [
  '3, 2, 1, BRUSH!',
  'Great job! You found the right answer!',
  'Hooray! That is correct! You are a super hero!',
  'Awesome work! Your companion is so happy!',
  'You did it! Super hero power!',
  'Almost there! Give it another try!',
  "Oops! That button is just for grown-ups!",
  "3... 2... 1... FREEZE! Don't move a muscle!",
  'Perfect ice statue! You held so still! Bonus sparks earned!',
  'Unfreeze and dance! Shake those wiggles out!',
  'Time to floss, Little Hero! Clean between those teeth so the sugar villains have nowhere to hide!'
];

// ── Persistent IndexedDB Audio Cache (Browser-only, graceful no-op in Node) ──
const IDB_NAME = 'lh_kokoro_audio_cache_v1';
const IDB_STORE = 'clips';
const IDB_MAX_ENTRIES = 350;
let idbPromise = null;

function openAudioCacheDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

async function getAudioClipFromIdb(key) {
  if (typeof indexedDB === 'undefined' || !key) return null;
  const db = await openAudioCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function saveAudioClipToIdb(key, data) {
  if (typeof indexedDB === 'undefined' || !key || !data?.audio) return;
  openAudioCacheDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put({
        key,
        audio: data.audio,
        sampleRate: data.sampleRate || 24000,
        voice: data.voice || '',
        petId: data.petId || 'rex',
        savedAt: Date.now()
      });
      const countReq = objStore.count();
      countReq.onsuccess = () => {
        if (countReq.result > IDB_MAX_ENTRIES) {
          const cursorReq = objStore.openCursor();
          let deleted = 0;
          const toDelete = countReq.result - IDB_MAX_ENTRIES;
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor && deleted < toDelete) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    } catch {}
  }).catch(() => {});
}

async function hydrateAudioCacheFromIdb() {
  if (typeof indexedDB === 'undefined') return;
  const db = await openAudioCacheDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : [];
      for (const row of rows) {
        if (row?.key && row?.audio && !workoutAudioClipCache.has(row.key)) {
          workoutAudioClipCache.set(row.key, {
            success: true,
            audio: row.audio,
            sampleRate: row.sampleRate || 24000,
            voice: row.voice || '',
            petId: row.petId || 'rex'
          });
        }
      }
    };
  } catch {}
}

if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  hydrateAudioCacheFromIdb().catch(() => {});
  window.addEventListener('companion-phrases-updated', (e) => {
    const phrases = e?.detail?.phrases;
    const petId = e?.detail?.petId || store?.getActivePet?.()?.id || 'rex';
    if (Array.isArray(phrases) && phrases.length > 0) {
      prewarmPhrasesAudio(phrases, petId).catch(() => {});
    }
  });
}

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
let currentSentenceChainTimer = null;
let activeUtterance = null;
let hasUserInteracted = false;
let pendingUnlockSpeech = null;
let audioContextUnlocked = false;
let sharedAudioContext = null;

// Bumped at the start of every speakCompanion() call for strict anti-collision
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
 * Splits multi-sentence text into natural sentence/clause segments so:
 * 1) Sentence 0 synthesizes in ~1.0-1.5s for instant Storybook start.
 * 2) Every segment stays safely below Kokoro's 510-token window.
 */
export function splitIntoSpeechChunks(text, firstMaxChars = 180, maxChars = 280) {
  const clean = cleanDialogueText(text);
  if (!clean) return [];
  const rawSentences = clean
    .split(/(?<=[.!?])\s+|(?<=[.!?]["'\u201d\u2019])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawSentences.length === 0) return [clean];

  const chunks = [];
  for (const sent of rawSentences) {
    const limit = chunks.length === 0 ? firstMaxChars : maxChars;
    if (sent.length <= limit) {
      chunks.push(sent);
      continue;
    }
    const clauses = sent.split(/(?<=[,;:\u2014])\s+/).map((c) => c.trim()).filter(Boolean);
    let buf = '';
    for (const clause of clauses) {
      const curLimit = chunks.length === 0 ? firstMaxChars : maxChars;
      const candidate = buf ? `${buf} ${clause}` : clause;
      if (candidate.length <= curLimit) {
        buf = candidate;
      } else {
        if (buf) chunks.push(buf);
        buf = clause;
      }
    }
    if (buf) chunks.push(buf);
  }
  return chunks;
}

/**
 * Synchronously initializes and triggers AudioContext.resume() while a transient
 * user gesture is still active (before any network await).
 */
function ensureSharedAudioContextReady() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      try {
        sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
      } catch {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    audioContextUnlocked = true;
  } catch {}
  return sharedAudioContext;
}

/**
 * Track user gesture to pre-unlock Web Audio and SpeechSynthesis on mobile/WebKit
 */
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    hasUserInteracted = true;
    unlockVoiceAudio();

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

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }
}

/**
 * Actively pre-unlocks browser audio pipelines on user tap/interaction
 */
export function unlockVoiceAudio() {
  if (typeof window === 'undefined') return;
  hasUserInteracted = true;

  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (!audioContextUnlocked) {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      }
    } catch {}
  }

  ensureSharedAudioContextReady();
}

/**
 * Stops all currently playing companion voice audio and speech synthesis
 */
export const stopRex = () => {
  if (currentSentenceChainTimer) {
    clearTimeout(currentSentenceChainTimer);
    currentSentenceChainTimer = null;
  }

  if (currentAudioSource) {
    try {
      currentAudioSource.onended = null;
      currentAudioSource.stop();
      currentAudioSource.disconnect();
    } catch {}
    currentAudioSource = null;
  }

  if (currentSyllableInterval) {
    clearInterval(currentSyllableInterval);
    currentSyllableInterval = null;
  }

  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }

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
  if (currentAudioSource || currentSentenceChainTimer) return true;
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

  let found = englishVoices.find((v) => v.name.toLowerCase().includes(target));
  if (found) return found;

  found = voices.find((v) => v.name.toLowerCase().includes(target));
  if (found) return found;

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
 * Used strictly as offline fallback when Kokoro TTS microservice is unreachable.
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

    activeUtterance = utterance;

    store.setLiveRexState({ isSpeaking: true, status: 'speaking' }, true);
    dispatchSpeechEvent('companion-speech-start', { text: cleanSpokenText, petId });

    utterance.onboundary = (e) => {
      dispatchSpeechEvent('companion-speech-syllable', { text: cleanSpokenText, petId, charIndex: e.charIndex });
    };

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

    const finishUtterance = () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      activeUtterance = null;
      store.setLiveRexState({ isSpeaking: false, status: 'idle' }, true);
      dispatchSpeechEvent('companion-speech-end', { petId });
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch (e) {
          console.error('Error in voice onEnded callback:', e);
        }
      }
    };

    utterance.onend = finishUtterance;
    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.debug('SpeechSynthesis notice:', e.error);
      }
      finishUtterance();
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

function storeInClientAudioCache(cleanSpoken, petId, voiceStyle, data) {
  if (!data || (!data.audio && !data.audioBuffer)) return;
  const normKey = normalizePetKey(petId);
  const rawId = String(petId || 'rex').toLowerCase().trim();
  if (voiceStyle && voiceStyle !== 'default') {
    const styleKey = `${normKey}:${voiceStyle}:${cleanSpoken}`;
    workoutAudioClipCache.set(styleKey, data);
    workoutAudioClipCache.set(`${rawId}:${voiceStyle}:${cleanSpoken}`, data);
    saveAudioClipToIdb(styleKey, data);
  } else {
    const genericKey = `${normKey}:${cleanSpoken}`;
    workoutAudioClipCache.set(genericKey, data);
    workoutAudioClipCache.set(`${rawId}:${cleanSpoken}`, data);
    workoutAudioClipCache.set(cleanSpoken, data);
    saveAudioClipToIdb(genericKey, data);
  }
}

async function lookupClientAudioCache(cleanSpoken, petId, voiceStyle) {
  const normKey = normalizePetKey(petId);
  const rawId = String(petId || 'rex').toLowerCase().trim();
  const styleKey = `${normKey}:${voiceStyle}:${cleanSpoken}`;
  const rawStyleKey = `${rawId}:${voiceStyle}:${cleanSpoken}`;
  const genericKey = `${normKey}:${cleanSpoken}`;
  const rawKey = `${rawId}:${cleanSpoken}`;

  const memHit = (voiceStyle && voiceStyle !== 'default')
    ? (workoutAudioClipCache.get(styleKey) || workoutAudioClipCache.get(rawStyleKey))
    : (workoutAudioClipCache.get(genericKey) || workoutAudioClipCache.get(rawKey) || workoutAudioClipCache.get(cleanSpoken));

  if (memHit) return memHit;

  if (typeof indexedDB !== 'undefined') {
    const idbKey = (voiceStyle && voiceStyle !== 'default') ? styleKey : genericKey;
    const idbHit = await getAudioClipFromIdb(idbKey);
    if (idbHit && idbHit.audio) {
      workoutAudioClipCache.set(idbKey, idbHit);
      return idbHit;
    }
  }
  return null;
}

/**
 * Plays a base64 raw-PCM16 TTS response through the shared AudioContext,
 * wiring up speech-start/syllable/end events for facial lip-sync.
 */
async function playPcmTtsResponse(data, cleanSpoken, petId, callback, myGeneration, options = {}) {
  if (!data || (!data.audio && !data.audioBuffer)) return false;

  const ctx = ensureSharedAudioContextReady();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }

  if (typeof myGeneration === 'number' && myGeneration !== speechGeneration) {
    return false;
  }

  if (currentAudioSource) {
    try {
      currentAudioSource.onended = null;
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
      audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);
      data.audioBuffer = audioBuffer;
    } catch (e) {
      console.warn('Failed to decode PCM audio data:', e);
      return false;
    }
  }
  if (!audioBuffer) return false;

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const rate = typeof options?.rate === 'number' && Number.isFinite(options.rate) && options.rate > 0
    ? options.rate
    : 1.0;

  if (source.playbackRate && typeof source.playbackRate.setValueAtTime === 'function') {
    try {
      source.playbackRate.setValueAtTime(rate, ctx.currentTime);
    } catch {
      source.playbackRate.value = rate;
    }
  } else if (source.playbackRate) {
    source.playbackRate.value = rate;
  }

  if (source.detune) {
    const callerPitch = typeof options?.pitch === 'number' && Number.isFinite(options.pitch) && options.pitch > 0
      ? options.pitch
      : 1.0;
    const detuneCents = (-1200 * Math.log2(rate)) + (1200 * Math.log2(callerPitch));
    try {
      if (typeof source.detune.setValueAtTime === 'function') {
        source.detune.setValueAtTime(detuneCents, ctx.currentTime);
      } else {
        source.detune.value = detuneCents;
      }
    } catch {
      source.detune.value = detuneCents;
    }
  }

  source.connect(ctx.destination);
  currentAudioSource = source;

  if (!options.isContinuationChunk) {
    store.setLiveRexState({ isSpeaking: true, status: 'speaking' }, true);
    dispatchSpeechEvent('companion-speech-start', { text: cleanSpoken, petId, voice: data.voice });
  }

  if (currentSyllableInterval) {
    clearInterval(currentSyllableInterval);
  }
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
    if (options.isIntermediateChunk) {
      if (typeof callback === 'function') callback();
      return;
    }
    store.setLiveRexState({ isSpeaking: false, status: 'idle' }, true);
    dispatchSpeechEvent('companion-speech-end', { petId });
    if (typeof callback === 'function') {
      callback();
    }
  };

  source.start(0);
  return true;
}

/**
 * Resolves the Kokoro TTS API base URL:
 * 1. Explicit VITE_KOKORO_TTS_URL build override
 * 2. Direct Cloud Run URL on all live production web hosts (bypassing proxy hops)
 * 3. Relative '' in Node unit tests and local dev server
 */
export function getVoiceApiBaseUrl() {
  const directUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_KOKORO_TTS_URL) || '';
  if (directUrl) return directUrl.replace(/\/+$/, '');

  if (typeof window === 'undefined') return '';
  const hostname = (typeof window !== 'undefined' && window.location?.hostname) || '';
  if (
    hostname.includes('github.io') ||
    hostname.includes('web.app') ||
    hostname.includes('firebaseapp.com') ||
    hostname.includes('hosted.app')
  ) {
    return PROD_KOKORO_CLOUD_RUN_URL;
  }
  return '';
}

let kokoroWarmUpStarted = false;

/**
 * Wakes the Kokoro Cloud Run instance and triggers background pre-caching of
 * companion phrases and core guidance cues once per page load.
 */
export function warmUpKokoroTts() {
  if (kokoroWarmUpStarted || typeof fetch !== 'function') return;
  kokoroWarmUpStarted = true;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 90000) : null;
  fetch(`${getVoiceApiBaseUrl()}${KOKORO_TTS_ENDPOINT}/health`, controller ? { signal: controller.signal } : undefined)
    .then(() => {
      if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
        setTimeout(() => {
          try {
            const activePetId = store?.getActivePet?.()?.id || 'rex';
            const phrases = (store?.getCompanionPhrases?.() || []).map((p) => p.text).filter(Boolean);
            prewarmPhrasesAudio([...CORE_APP_GUIDANCE_PHRASES, ...phrases], activePetId).catch(() => {});
          } catch {}
        }, 800);
      }
    })
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

  if (style === 'bedtime') {
    if (timeoutMs === KOKORO_DEFAULT_TIMEOUT_MS || timeoutMs <= 4500 || !timeoutMs) {
      timeoutMs = 18000;
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
 * Pre-fetches and caches an array of companion phrases or guidance cues in small
 * background batches (concurrency 2) so tapping the companion or triggering
 * routine cues plays Kokoro voice in 0ms.
 */
export async function prewarmPhrasesAudio(phrases = [], petId = null, options = {}) {
  if (!Array.isArray(phrases) || phrases.length === 0 || typeof fetch !== 'function') return 0;
  const targetPet = petId || store?.getActivePet?.()?.id || 'rex';
  const voiceStyle = options.voiceStyle || 'default';
  const uniqueTexts = Array.from(new Set(phrases.map((p) => cleanDialogueText(typeof p === 'string' ? p : p?.text)).filter(Boolean)));
  if (uniqueTexts.length === 0) return 0;

  let warmed = 0;
  const concurrency = Math.max(1, Math.min(2, Number(options.concurrency) || 1));
  let cursor = 0;

  const worker = async () => {
    while (cursor < uniqueTexts.length) {
      if (isSpeaking) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      const idx = cursor++;
      const line = uniqueTexts[idx];
      const existing = await lookupClientAudioCache(line, targetPet, voiceStyle);
      if (existing) {
        warmed++;
        continue;
      }
      const res = await prefetchCompanionAudio(line, targetPet, {
        voiceStyle,
        timeoutMs: options.timeoutMs || 16000
      });
      if (res) warmed++;
    }
  };

  await Promise.allSettled(Array.from({ length: Math.min(concurrency, uniqueTexts.length) }, () => worker()));
  return warmed;
}

/**
 * Pre-fetches and pre-renders cadence audio clips for the active workout routine
 * into `workoutAudioClipCache`.
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
      const ctx = ensureSharedAudioContextReady();
      if (ctx) {
        try {
          const float32 = base64ToFloat32Array(data.audio);
          const sampleRate = data.sampleRate || 24000;
          const buffer = ctx.createBuffer(1, float32.length, sampleRate);
          buffer.copyToChannel(float32, 0);
          data.audioBuffer = buffer;
        } catch {}
      }
      storeInClientAudioCache(cleanSpoken, targetCoach, 'default', data);
    }
  });

  await Promise.allSettled(tasks);
}

/**
 * Pre-fetches and pre-decodes audio for an upcoming dialogue or bedtime chapter
 * into `workoutAudioClipCache` so it triggers with 0ms latency when requested.
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
    : (voiceStyle === 'bedtime' ? 25000 : KOKORO_DEFAULT_TIMEOUT_MS);

  const styleKey = `${normKey}:${voiceStyle}:${cleanSpoken}`;
  const rawStyleKey = `${rawId}:${voiceStyle}:${cleanSpoken}`;
  const genericKey = `${normKey}:${cleanSpoken}`;
  const rawKey = `${rawId}:${cleanSpoken}`;

  // 1. Check in-memory or IndexedDB cache
  const existing =
    (voiceStyle && voiceStyle !== 'default' ? workoutAudioClipCache.get(styleKey) : null) ||
    (voiceStyle && voiceStyle !== 'default' ? workoutAudioClipCache.get(rawStyleKey) : null) ||
    workoutAudioClipCache.get(genericKey) ||
    workoutAudioClipCache.get(rawKey) ||
    workoutAudioClipCache.get(cleanSpoken) ||
    await lookupClientAudioCache(cleanSpoken, petId, voiceStyle);

  if (existing) {
    if (!existing.audioBuffer && existing.audio) {
      const ctx = ensureSharedAudioContextReady();
      if (ctx) {
        try {
          const float32 = base64ToFloat32Array(existing.audio);
          const buffer = ctx.createBuffer(1, float32.length, existing.sampleRate || 24000);
          buffer.copyToChannel(float32, 0);
          existing.audioBuffer = buffer;
        } catch {}
      }
    }
    const res = existing.audioBuffer || existing;
    if (res && existing.audioBuffer) {
      res.audio = existing.audio;
      res.sampleRate = existing.sampleRate;
      res.audioBuffer = existing.audioBuffer;
    }
    return res;
  }

  // 2. If prefetching a multi-sentence bedtime chapter, pre-fetch sentences individually too
  // so pipelined sentence playback starts in 0ms when the chapter opens!
  if (opts.pipelined && voiceStyle === 'bedtime') {
    const chunks = splitIntoSpeechChunks(cleanSpoken);
    if (chunks.length > 1) {
      let firstRes = null;
      for (let i = 0; i < chunks.length; i++) {
        const cRes = await prefetchCompanionAudio(chunks[i], petId, {
          ...opts,
          pipelined: false,
          timeoutMs: 20000
        });
        if (i === 0) firstRes = cRes;
      }
      return firstRes;
    }
  }

  // 3. Background fetch via the Kokoro TTS microservice
  const data = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, petId, timeoutMs, voiceStyle);
  if (!data || !data.audio) return null;

  // 4. Pre-decode into Web Audio AudioBuffer if AudioContext is accessible
  const ctx = ensureSharedAudioContextReady();
  if (ctx) {
    try {
      const float32 = base64ToFloat32Array(data.audio);
      const sampleRate = data.sampleRate || 24000;
      const buffer = ctx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);
      data.audioBuffer = buffer;
    } catch (e) {
      console.warn('Audio prefetch decode notice:', e);
    }
  }

  // 5. Save into client cache + IndexedDB
  if (voiceStyle && voiceStyle !== 'default') {
    workoutAudioClipCache.set(styleKey, data);
    workoutAudioClipCache.set(rawStyleKey, data);
    saveAudioClipToIdb(styleKey, data);
  }
  workoutAudioClipCache.set(genericKey, data);
  workoutAudioClipCache.set(rawKey, data);
  workoutAudioClipCache.set(cleanSpoken, data);
  if (!voiceStyle || voiceStyle === 'default') {
    saveAudioClipToIdb(genericKey, data);
  }

  const result = data.audioBuffer || data;
  if (result && data.audioBuffer) {
    result.audio = data.audio;
    result.sampleRate = data.sampleRate;
    result.audioBuffer = data.audioBuffer;
  }
  return result;
}

/**
 * Pipelined sentence-by-sentence playback for multi-sentence passages & AI Storybook.
 * Synthesizes Sentence 0 immediately (~1.1-1.6s) and starts playback while concurrently
 * pre-fetching Sentences 1..N into Web Audio buffers for seamless gapless reading.
 */
async function speakPipelinedChunks(chunks, cleanSpoken, petId, callback, myGeneration, opts) {
  const voiceStyle = opts.voiceStyle || 'default';
  const perChunkTimeoutMs = Math.min(25000, Math.max(12000, opts.timeoutMs || 18000));

  // Fetch chunk 0 with top priority so Kokoro starts speaking immediately
  let chunk0Data = await lookupClientAudioCache(chunks[0], petId, voiceStyle);
  if (!chunk0Data) {
    chunk0Data = await fetchPcmTts(KOKORO_TTS_ENDPOINT, chunks[0], petId, perChunkTimeoutMs, voiceStyle);
    if (chunk0Data) {
      storeInClientAudioCache(chunks[0], petId, voiceStyle, chunk0Data);
    }
  }
  if (myGeneration !== speechGeneration) return true;

  // If Kokoro is completely unreachable offline, fall back once cleanly for the full passage
  if (!chunk0Data) {
    speakWithSpeechSynthesis(cleanSpoken, petId, callback, opts);
    return true;
  }

  // Pre-fetch remaining chunks in background (sequentially so chunk i+1 is always ready first)
  const chunkPromises = new Array(chunks.length);
  chunkPromises[0] = Promise.resolve(chunk0Data);

  (async () => {
    for (let i = 1; i < chunks.length; i++) {
      if (myGeneration !== speechGeneration) break;
      const p = (async () => {
        const cached = await lookupClientAudioCache(chunks[i], petId, voiceStyle);
        if (cached) return cached;
        const fetched = await fetchPcmTts(KOKORO_TTS_ENDPOINT, chunks[i], petId, perChunkTimeoutMs, voiceStyle);
        if (fetched) {
          const ctx = ensureSharedAudioContextReady();
          if (ctx && !fetched.audioBuffer) {
            try {
              const f32 = base64ToFloat32Array(fetched.audio);
              const buf = ctx.createBuffer(1, f32.length, fetched.sampleRate || 24000);
              buf.copyToChannel(f32, 0);
              fetched.audioBuffer = buf;
            } catch {}
          }
          storeInClientAudioCache(chunks[i], petId, voiceStyle, fetched);
        }
        return fetched;
      })();
      chunkPromises[i] = p;
      await p;
    }
  })().catch(() => {});

  const playChunkIndex = async (idx) => {
    if (myGeneration !== speechGeneration) return false;
    let cData = chunkPromises[idx] ? await chunkPromises[idx] : null;
    if (!cData && myGeneration === speechGeneration) {
      cData = await lookupClientAudioCache(chunks[idx], petId, voiceStyle) ||
        await fetchPcmTts(KOKORO_TTS_ENDPOINT, chunks[idx], petId, perChunkTimeoutMs, voiceStyle);
      if (cData) storeInClientAudioCache(chunks[idx], petId, voiceStyle, cData);
    }
    if (myGeneration !== speechGeneration) return false;

    const isLast = idx >= chunks.length - 1;
    if (!cData) {
      const remainingText = chunks.slice(idx).join(' ');
      speakWithSpeechSynthesis(remainingText, petId, callback, opts);
      return true;
    }

    const onChunkEnd = isLast
      ? callback
      : () => {
          if (myGeneration !== speechGeneration) return;
          currentSentenceChainTimer = setTimeout(() => {
            currentSentenceChainTimer = null;
            playChunkIndex(idx + 1).catch(() => {});
          }, 160);
        };

    const started = await playPcmTtsResponse(cData, chunks[idx], petId, onChunkEnd, myGeneration, {
      ...opts,
      isContinuationChunk: idx > 0,
      isIntermediateChunk: !isLast
    });

    if (!started && myGeneration === speechGeneration) {
      const remainingText = chunks.slice(idx).join(' ');
      speakWithSpeechSynthesis(remainingText, petId, callback, opts);
    }
    return started;
  };

  return playChunkIndex(0);
}

/**
 * Unified Spoken Voice Entrypoint for Pet Companions
 * 0. Synchronous AudioContext gesture unlock + Zero-Latency Cache (`workoutAudioClipCache` + IndexedDB).
 * 1. Pipelined sentence streaming for multi-sentence bedtime chapters & long guidance.
 * 2. Primary: self-hosted Kokoro TTS microservice (/api/tts), voice resolved per pet.
 * 3. Resilient Fallback: Cartoon Speech Synthesis with natural 'Daniel' voice ONLY when offline.
 */
export const speakCompanion = async (text, petIdOrOptions = 'rex', onEndedOrOptions = null, options = {}) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;

  // Unlock & resume AudioContext synchronously while user tap gesture is still active
  ensureSharedAudioContextReady();

  let petId = 'rex';
  let callback = null;
  let opts = {
    timeoutMs: KOKORO_DEFAULT_TIMEOUT_MS,
    rate: 1.0,
    pitch: 1.0,
    voiceStyle: 'default',
    instant: false,
    pipelined: undefined
  };

  if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    opts = { ...opts, ...petIdOrOptions };
    if (petIdOrOptions.petId) petId = petIdOrOptions.petId;
    if (typeof petIdOrOptions.onEnded === 'function') callback = petIdOrOptions.onEnded;
  } else if (typeof petIdOrOptions === 'function') {
    callback = petIdOrOptions;
  } else if (petIdOrOptions !== undefined && petIdOrOptions !== null) {
    petId = String(petIdOrOptions);
  }

  if (typeof onEndedOrOptions === 'function') {
    callback = onEndedOrOptions;
  } else if (onEndedOrOptions && typeof onEndedOrOptions === 'object') {
    opts = { ...opts, ...onEndedOrOptions };
    if (typeof onEndedOrOptions.onEnded === 'function') callback = onEndedOrOptions.onEnded;
    if (onEndedOrOptions.petId && (!petId || petId === 'rex')) petId = onEndedOrOptions.petId;
  }

  if (options && typeof options === 'object') {
    opts = { ...opts, ...options };
    if (typeof options.onEnded === 'function' && !callback) callback = options.onEnded;
    if (options.petId && (!petId || petId === 'rex')) petId = options.petId;
  }

  if (opts.voiceStyle === 'bedtime' && (!opts.timeoutMs || opts.timeoutMs === KOKORO_DEFAULT_TIMEOUT_MS)) {
    opts.timeoutMs = 35000;
  }

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

  const myGeneration = ++speechGeneration;
  stopRex();

  if (!hasUserInteracted && typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    pendingUnlockSpeech = { text: cleanSpoken, petId, onEnded: callback, options: opts };
  }

  const voiceStyle = opts.voiceStyle || 'default';

  // --- Tier 0: Zero-Latency Client-Side & IndexedDB Audio Cache ---
  const cachedData = await lookupClientAudioCache(cleanSpoken, petId, voiceStyle);
  if (myGeneration !== speechGeneration) return;

  if (cachedData) {
    const played = await playPcmTtsResponse(cachedData, cleanSpoken, petId, callback, myGeneration, opts);
    if (played) return;
    if (myGeneration !== speechGeneration) return;
    speakWithSpeechSynthesis(cleanSpoken, petId, callback, opts);
    return;
  }

  // --- Tier 1: Pipelined Sentence Streaming for AI Storybook & Long Multi-Sentence Passages ---
  const chunks = splitIntoSpeechChunks(cleanSpoken);
  const shouldPipeline = opts.pipelined === true ||
    (opts.pipelined !== false && chunks.length > 1 && (voiceStyle === 'bedtime' || cleanSpoken.length > 130));

  if (shouldPipeline && chunks.length > 1) {
    await speakPipelinedChunks(chunks, cleanSpoken, petId, callback, myGeneration, opts);
    return;
  }

  // --- Tier 2: Fast Single-Line Kokoro TTS Synthesis ---
  if (opts.instant) {
    const INSTANT_KOKORO_TIMEOUT_MS = 14000;
    const fastData = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, petId, INSTANT_KOKORO_TIMEOUT_MS, voiceStyle);
    if (myGeneration !== speechGeneration) return;
    if (fastData) {
      storeInClientAudioCache(cleanSpoken, petId, voiceStyle, fastData);
      const played = await playPcmTtsResponse(fastData, cleanSpoken, petId, callback, myGeneration, opts);
      if (played) return;
      if (myGeneration !== speechGeneration) return;
    }
    speakWithSpeechSynthesis(cleanSpoken, petId, callback, opts);
    return;
  }

  let ttsSucceeded = false;
  const timeoutMs = opts.timeoutMs || (voiceStyle === 'bedtime' ? 35000 : KOKORO_DEFAULT_TIMEOUT_MS);

  const kokoroData = await fetchPcmTts(KOKORO_TTS_ENDPOINT, cleanSpoken, petId, timeoutMs, voiceStyle);
  if (myGeneration !== speechGeneration) return;
  if (kokoroData) {
    storeInClientAudioCache(cleanSpoken, petId, voiceStyle, kokoroData);
    ttsSucceeded = await playPcmTtsResponse(kokoroData, cleanSpoken, petId, callback, myGeneration, opts);
  }

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
