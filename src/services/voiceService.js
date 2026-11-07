// Pet Companion & Spoken Voice Guidance Service
// Architecture:
// 1. Primary: Enhanced Multi-Profile Client-Side Web Speech Synthesis API (`window.speechSynthesis`).
//    - $0.00 ongoing production cost, 0ms latency, 100% offline PWA capability.
//    - Zero external servers, zero API keys, zero quota limitations.
//    - Resilient platform voice cascading (iOS Apple Siri/Samantha, Android Google Natural/Speech, Windows Microsoft Natural).
//    - Toddler-friendly cartoon personas via dynamic acoustic shaping (pitch: 0.80 - 1.45, rate: 0.76 - 1.15).
//    - 24 companion pet profiles + bedtime_narrator with distinct acoustic matrix.
//    - Accurate facial lip-sync event dispatching (companion-speech-start, companion-speech-syllable, companion-speech-end).
// 2. Persistent IndexedDB + In-Memory Fast-Path Audio Cache (`workoutAudioClipCache`) for bundled audio assets.
// 3. Pipelined Multi-Sentence Streaming for AI Storybook with progressive bedtime calming rates (0.94 -> 0.76).
// 4. Chrome 15s pause bug prevention via sentence chunking, keepalive pulse, and garbage collection retention.
// 5. Browser Autoplay & Synchronous Gesture Pre-Unlock Engine.

import { store } from '../state/store.js';
import { DINO_WORKOUTS } from '../data/petsData.js';

// Default voice timeout contract
export const VOICE_DEFAULT_TIMEOUT_MS = 14000;

// Zero-latency client-side cache for gross-motor cadence cues, companion phrases, and bedtime chapters
export const workoutAudioClipCache = new Map();

// Core app-wide voice guidance cues pre-warmed for 0ms response
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
const IDB_NAME = 'lh_voice_audio_cache_v2';
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
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        return resolve(null);
      }
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
      if (!db.objectStoreNames.contains(IDB_STORE)) return;
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
    if (!db.objectStoreNames.contains(IDB_STORE)) return;
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

export const PET_VOICE_PROFILE_DATA = [
  { key: 'rex', id: '1', name: 'Rex the T-Rex', pitch: 1.25, rate: 1.02, preferred: ['daniel', 'google us english', 'oliver', 'guy', 'ryan'], voicePersona: 'upbeat_hero' },
  { key: 'raptor', id: '2', name: 'Raptor the Velociraptor', pitch: 1.35, rate: 1.10, preferred: ['oliver', 'daniel', 'junior', 'liam', 'google uk english male'], voicePersona: 'swift_sprinter' },
  { key: 'stego', id: '3', name: 'Stego the Stegosaurus', pitch: 0.90, rate: 0.88, preferred: ['samantha', 'karen', 'serena', 'aria', 'google uk english female'], voicePersona: 'calm_guardian' },
  { key: 'pterry', id: '4', name: 'Pterry the Pterodactyl', pitch: 1.40, rate: 1.02, preferred: ['karen', 'siri', 'sky', 'ana', 'jenny', 'google us english'], voicePersona: 'soaring_scout' },
  { key: 'chomper', id: '5', name: 'Chomper the Compsognathus', pitch: 1.45, rate: 1.10, preferred: ['junior', 'oliver', 'daniel', 'ana', 'google us english'], voicePersona: 'playful_pip' },
  { key: 'brachio', id: '6', name: 'Brachio the Brachiosaurus', pitch: 0.85, rate: 0.85, preferred: ['arthur', 'christopher', 'ryan', 'google uk english male', 'daniel'], voicePersona: 'gentle_giant' },
  { key: 'dippy', id: '7', name: 'Dippy the Diplodocus', pitch: 1.05, rate: 0.92, preferred: ['daniel', 'guy', 'ryan', 'google uk english male'], voicePersona: 'steady_explorer' },
  { key: 'spino', id: '8', name: 'Spino the Spinosaurus', pitch: 0.95, rate: 0.88, preferred: ['guy', 'arthur', 'christopher', 'google uk english male', 'daniel'], voicePersona: 'deep_titan' },
  { key: 'sparky', id: '9', name: 'Sparky the Dragon', pitch: 1.30, rate: 1.05, preferred: ['liam', 'daniel', 'oliver', 'guy', 'google us english'], voicePersona: 'fiery_adventurer' },
  { key: 'aero', id: '10', name: 'Aero the Griffin', pitch: 1.20, rate: 1.00, preferred: ['serena', 'karen', 'siri', 'sonia', 'google uk english female'], voicePersona: 'noble_skywing' },
  { key: 'blaze', id: '11', name: 'Blaze the Phoenix', pitch: 1.15, rate: 0.98, preferred: ['karen', 'samantha', 'serena', 'aria', 'google us english'], voicePersona: 'radiant_phoenix' },
  { key: 'hydra', id: '12', name: 'Hydra the Sea Serpent', pitch: 0.90, rate: 0.90, preferred: ['eric', 'daniel', 'arthur', 'christopher', 'google uk english male'], voicePersona: 'ocean_sage' },
  { key: 'luna', id: '13', name: 'Luna the Unicorn', pitch: 1.10, rate: 0.90, preferred: ['samantha', 'siri', 'serena', 'jenny', 'aria', 'google us english'], voicePersona: 'starlight_dreamer' },
  { key: 'kira', id: '14', name: 'Kira the Kirin', pitch: 1.25, rate: 1.00, preferred: ['siri', 'samantha', 'karen', 'aria', 'google uk english female'], voicePersona: 'mystic_breeze' },
  { key: 'boulder', id: '15', name: 'Boulder the Crystal Golem', pitch: 0.80, rate: 0.82, preferred: ['arthur', 'guy', 'christopher', 'google uk english male', 'daniel'], voicePersona: 'crystal_sentinel' },
  { key: 'cosmo', id: '16', name: 'Cosmo the Cyber Mech', pitch: 1.20, rate: 1.05, preferred: ['siri', 'daniel', 'oliver', 'ryan', 'google us english'], voicePersona: 'cosmic_navigator' },
  { key: 'leo', id: '17', name: 'Leo the Lion', pitch: 1.00, rate: 0.95, preferred: ['daniel', 'guy', 'arthur', 'christopher', 'google uk english male'], voicePersona: 'brave_heart' },
  { key: 'stripe', id: '18', name: 'Stripe the Tiger', pitch: 1.30, rate: 1.05, preferred: ['samantha', 'oliver', 'karen', 'jenny', 'google us english'], voicePersona: 'agile_pouncer' },
  { key: 'fang', id: '19', name: 'Fang the Wolf', pitch: 0.95, rate: 0.90, preferred: ['arthur', 'guy', 'ryan', 'google uk english male', 'daniel'], voicePersona: 'moonlit_tracker' },
  { key: 'scout', id: '20', name: 'Scout the Eagle', pitch: 1.15, rate: 1.00, preferred: ['karen', 'siri', 'serena', 'sonia', 'google us english'], voicePersona: 'horizon_watcher' },
  { key: 'gnasher', id: '21', name: 'Gnasher the Shark', pitch: 0.90, rate: 0.92, preferred: ['guy', 'arthur', 'daniel', 'christopher', 'google us english'], voicePersona: 'reef_champion' },
  { key: 'shadow-sm', id: '22', name: 'Shadow the Panther', pitch: 1.05, rate: 0.95, preferred: ['oliver', 'daniel', 'guy', 'ryan', 'google uk english male'], voicePersona: 'velvet_prowler' },
  { key: 'barnaby', id: '23', name: 'Barnaby the Bear', pitch: 0.85, rate: 0.90, preferred: ['daniel', 'arthur', 'guy', 'christopher', 'google uk english male'], voicePersona: 'cozy_protector' },
  { key: 'ollie', id: '24', name: 'Ollie the Otter', pitch: 1.30, rate: 1.05, preferred: ['siri', 'oliver', 'samantha', 'ana', 'jenny', 'google us english'], voicePersona: 'river_splasher' },
  { key: 'aqua_drake', name: 'Aqua Drake', pitch: 1.05, rate: 0.92, preferred: ['eric', 'daniel', 'arthur', 'ryan', 'google uk english male'], voicePersona: 'tidal_drake' },
  { key: 'aqua', name: 'Aqua Drake', pitch: 1.05, rate: 0.92, preferred: ['eric', 'daniel', 'arthur', 'ryan', 'google uk english male'], voicePersona: 'tidal_drake' },
  { key: 'bella', name: 'Bella the Bunny', pitch: 1.45, rate: 1.05, preferred: ['samantha', 'bella', 'junior', 'ana', 'jenny', 'google us english'], voicePersona: 'meadow_hopper' },
  { key: 'pip', name: 'Pip the Phoenix', pitch: 1.35, rate: 1.00, preferred: ['liam', 'daniel', 'oliver', 'guy', 'google us english'], voicePersona: 'ember_chirper' },
  { key: 'bedtime_narrator', name: 'Bedtime Narrator', pitch: 0.98, rate: 0.85, preferred: ['samantha', 'siri', 'serena', 'jenny', 'aria', 'sonia', 'google uk english female', 'google us english'], voicePersona: 'soothing_storyteller' }
];

export const COMPANION_VOICE_PROFILES = PET_VOICE_PROFILE_DATA.reduce((acc, pet) => {
  const profile = {
    id: pet.id || pet.key,
    key: pet.key,
    name: pet.name,
    pitch: pet.pitch,
    rate: pet.rate,
    volume: 1.0,
    preferred: pet.preferred,
    preferredVoice: 'daniel',
    voicePersona: pet.voicePersona
  };
  acc[pet.key] = profile;
  if (pet.id) acc[pet.id] = profile;
  if (pet.key.includes('-')) {
    acc[pet.key.replace(/-/g, '_')] = profile;
  }
  return acc;
}, {});

let currentAudio = null;
let currentAudioSource = null;
let currentSyllableInterval = null;
let currentKeepAliveInterval = null;
let currentUtteranceWatchdog = null;
let currentSentenceChainTimer = null;
let activeUtterance = null;
let hasUserInteracted = false;
let pendingUnlockSpeech = null;
let audioContextUnlocked = false;
let sharedAudioContext = null;
let voicesColdStartTimedOut = false;
let voicesChangedWaiters = [];

// Bumped at the start of every speakCompanion() call for strict anti-collision
let speechGeneration = 0;

function dispatchSpeechEvent(eventName, detail = {}) {
  const win = typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : null);
  if (win && typeof win.dispatchEvent === 'function') {
    try {
      const CustomEventClass = (typeof window !== 'undefined' && window.CustomEvent)
        || (typeof globalThis !== 'undefined' && globalThis.CustomEvent)
        || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
      if (CustomEventClass) {
        win.dispatchEvent(new CustomEventClass(eventName, { detail }));
      }
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
    // Strip HTML/XML tags so speech synthesizers do not pronounce markup aloud
    .replace(/<[^>]*>/g, ' ')
    // 1. Strip unicode emoji glyphs so TTS synthesizers do not read symbol names
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]/gu, '')
    // 2. Strip bracketed stage cues like [smiles], [stage cue]
    .replace(/\[[^\]]*(?:\]|$)/g, (m) => (m.endsWith(']') ? ' ' : m))
    // 3. Preserve markdown bold words (**word** -> word)
    .replace(/\*\*([^*\r\n]+)\*\*/g, (m, p) => p)
    // 4. Strip stage directions in asterisks (*ROAR!*, *Splish splash!*, *Giggle*, *whispers*) while preserving italic words (*brave* -> brave)
    .replace(/\*([^*\r\n]+)\*/g, (m, p) => {
      const inner = p.trim();
      if (
        inner.includes('!') ||
        /^[A-Z0-9\s!_.-]+$/.test(inner) ||
        /^(?:whisper|whispers|giggle|giggles|laugh|laughs|chuckle|chuckles|sigh|sighs|gasp|gasps|yawn|yawns|snore|snores|pant|pants)$/i.test(inner)
      ) {
        return ' ';
      }
      return p;
    })
    // 5. Clean up any remaining formatting asterisks
    .replace(/\*+/g, ' ')
    // 6. Collapse whitespace and trim
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits multi-sentence text into natural sentence/clause/word segments for fluid streaming,
 * strictly enforcing `firstMaxChars` / `maxChars` even on unpunctuated run-on sentences.
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
  const pushBoundedSegment = (segment) => {
    const words = segment.split(/\s+/).filter(Boolean);
    let wordBuf = '';
    for (const word of words) {
      const limit = chunks.length === 0 ? firstMaxChars : maxChars;
      if (!wordBuf) {
        if (word.length <= limit) {
          wordBuf = word;
        } else {
          for (let offset = 0; offset < word.length; offset += limit) {
            const sliceLimit = chunks.length === 0 ? firstMaxChars : maxChars;
            const piece = word.slice(offset, offset + sliceLimit);
            if (offset + sliceLimit < word.length) {
              chunks.push(piece);
            } else {
              wordBuf = piece;
            }
          }
        }
      } else if (wordBuf.length + 1 + word.length <= limit) {
        wordBuf = `${wordBuf} ${word}`;
      } else {
        chunks.push(wordBuf);
        const nextLimit = chunks.length === 0 ? firstMaxChars : maxChars;
        if (word.length <= nextLimit) {
          wordBuf = word;
        } else {
          wordBuf = '';
          for (let offset = 0; offset < word.length; offset += nextLimit) {
            const piece = word.slice(offset, offset + nextLimit);
            if (offset + nextLimit < word.length) {
              chunks.push(piece);
            } else {
              wordBuf = piece;
            }
          }
        }
      }
    }
    if (wordBuf) chunks.push(wordBuf);
  };

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
        if (buf) {
          chunks.push(buf);
          buf = '';
        }
        const afterPushLimit = chunks.length === 0 ? firstMaxChars : maxChars;
        if (clause.length <= afterPushLimit) {
          buf = clause;
        } else {
          pushBoundedSegment(clause);
        }
      }
    }
    if (buf) chunks.push(buf);
  }
  return chunks;
}

/**
 * Synchronously initializes and triggers AudioContext.resume() while a transient
 * user gesture is still active (before any async call).
 */
function ensureSharedAudioContextReady() {
  const win = typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : null);
  if (!win) return null;
  const AudioCtx = win.AudioContext || win.webkitAudioContext;
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
      sharedAudioContext.resume().then(() => {
        if (sharedAudioContext && sharedAudioContext.state === 'running') {
          audioContextUnlocked = true;
        }
      }).catch(() => {});
    } else if (sharedAudioContext && sharedAudioContext.state === 'running') {
      audioContextUnlocked = true;
    }
  } catch {}
  return sharedAudioContext;
}

function getSpeechSynthesisInstance() {
  return (typeof window !== 'undefined' && window.speechSynthesis)
    || (typeof globalThis !== 'undefined' && globalThis.speechSynthesis)
    || (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
}

function notifyVoicesChanged() {
  voicesColdStartTimedOut = false;
  if (voicesChangedWaiters.length > 0) {
    const waiters = voicesChangedWaiters.splice(0, voicesChangedWaiters.length);
    for (const resolve of waiters) {
      try { resolve(); } catch {}
    }
  }
}

/**
 * Waits briefly on Chromium cold-start when `speechSynthesis.getVoices()` initially
 * returns `[]` until `voiceschanged` fires, avoiding fallback to robotic OS defaults.
 */
async function ensureVoicesReady(synth, maxWaitMs = 90) {
  if (!synth || typeof synth.getVoices !== 'function') return [];
  const initial = synth.getVoices() || [];
  if (initial.length > 0) {
    voicesColdStartTimedOut = false;
    return initial;
  }
  if (voicesColdStartTimedOut) {
    return initial;
  }
  if (!('onvoiceschanged' in synth) && typeof synth.addEventListener !== 'function' && typeof synth.onvoiceschanged === 'undefined') {
    voicesColdStartTimedOut = true;
    return initial;
  }

  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(() => {
      const afterWait = synth.getVoices() || [];
      if (afterWait.length === 0) {
        voicesColdStartTimedOut = true;
      }
      finish();
    }, maxWaitMs);
    voicesChangedWaiters.push(() => {
      clearTimeout(timer);
      finish();
    });
    try {
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', notifyVoicesChanged, { once: true });
      }
      if (synth.onvoiceschanged !== notifyVoicesChanged && !synth.onvoiceschanged?.__lhWrapped) {
        const prev = synth.onvoiceschanged;
        const wrapped = (ev) => {
          if (typeof prev === 'function') {
            try { prev(ev); } catch {}
          }
          notifyVoicesChanged();
        };
        wrapped.__lhWrapped = true;
        synth.onvoiceschanged = wrapped;
      }
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
  return synth.getVoices() || [];
}

/**
 * Track first real user gesture to unlock Web Audio and replay any autoplay-blocked speech
 */
if (typeof window !== 'undefined') {
  const detachFirstInteractionListeners = () => {
    try {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    } catch {}
  };

  function handleFirstInteraction() {
    detachFirstInteractionListeners();
    hasUserInteracted = true;
    unlockVoiceAudio();

    if (pendingUnlockSpeech) {
      const { text, petId, onEnded, options } = pendingUnlockSpeech;
      pendingUnlockSpeech = null;
      if (!isRexSpeaking()) {
        speakCompanion(text, petId, onEnded, options).catch(() => {});
      }
    }
  }

  window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
  window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
  window.addEventListener('click', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });

  if ('speechSynthesis' in window && window.speechSynthesis) {
    try {
      window.speechSynthesis.onvoiceschanged = notifyVoicesChanged;
      if (typeof window.speechSynthesis.getVoices === 'function') {
        window.speechSynthesis.getVoices();
      }
    } catch {}
  }
}

/**
 * Actively pre-unlocks browser audio pipelines on user tap/interaction
 */
export function unlockVoiceAudio() {
  hasUserInteracted = true;
  const synth = getSpeechSynthesisInstance();

  if (synth) {
    try {
      if (synth.paused) {
        synth.resume();
      }
      if (typeof synth.getVoices === 'function') {
        synth.getVoices();
      }
    } catch {}
  }

  ensureSharedAudioContextReady();
}

/**
 * Stops all currently playing companion voice audio and speech synthesis
 */
export const stopRex = () => {
  speechGeneration = (speechGeneration || 0) + 1;
  pendingUnlockSpeech = null;

  if (currentSentenceChainTimer) {
    clearTimeout(currentSentenceChainTimer);
    currentSentenceChainTimer = null;
  }

  if (currentUtteranceWatchdog) {
    clearTimeout(currentUtteranceWatchdog);
    currentUtteranceWatchdog = null;
  }

  if (currentKeepAliveInterval) {
    clearInterval(currentKeepAliveInterval);
    currentKeepAliveInterval = null;
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

  const synth = getSpeechSynthesisInstance();

  if (synth) {
    try {
      synth.cancel();
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
  const synth = getSpeechSynthesisInstance();

  if (synth && (synth.speaking || synth.pending)) {
    return true;
  }
  return false;
};

export const isCompanionSpeaking = isRexSpeaking;

/**
 * Detects legacy robotic desktop SAPI5 / eSpeak / MacinTalk novelty voices so
 * natural neural voices (or clean compact voices) are always preferred ahead of them.
 */
export function isLegacyRoboticVoice(voice) {
  const name = String(voice?.name || '').toLowerCase().trim();
  if (!name) return false;
  if (/\b(espeak|festival|flite)\b/i.test(name)) return true;
  if (/\b(natural|neural|online|premium|enhanced|siri)\b/i.test(name)) return false;
  if (/\bmicrosoft\s+(david|zira|mark|hazel|george|susan|richard|linda|james|catherine|sean|eva|heera|ravi)\b/i.test(name)) {
    return true;
  }
  if (/^(albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|jester|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox)(\s|\(|$)/i.test(name)) {
    return true;
  }
  return false;
}

/**
 * Detects high-fidelity neural / natural platform voices (Edge Online Natural,
 * Apple Siri / Premium / Enhanced, Google Chrome / Android Neural Speech).
 */
export function isNeuralNaturalVoice(voice) {
  const name = String(voice?.name || '').toLowerCase();
  const uri = String(voice?.voiceURI || '').toLowerCase();
  if (!name) return false;
  if (isLegacyRoboticVoice(voice)) return false;
  return (
    /\b(natural|neural|online|premium|enhanced|siri)\b/i.test(name) ||
    /google\s+(us|uk)\s+english/i.test(name) ||
    /google\s+speech/i.test(name) ||
    /\b(natural|neural|premium|enhanced|siri)\b/i.test(uri)
  );
}

/**
 * Select preferred speech synthesis voice with neural-first quality scoring,
 * target English locale weighting, and platform-specific cascading. Always ranks
 * Online (Natural), (Premium), (Enhanced), Siri, and Google US/UK English ahead
 * of legacy robotic SAPI5 or novelty voices.
 */
export function selectPreferredVoice(voicesOrPreferred = 'daniel', maybePreferred = undefined) {
  let voices;
  let preferredList;

  const isExplicitVoicePool = Array.isArray(voicesOrPreferred) && (
    maybePreferred !== undefined ||
    (voicesOrPreferred.length > 0 && typeof voicesOrPreferred[0] === 'object' && voicesOrPreferred[0] !== null)
  );

  if (isExplicitVoicePool) {
    voices = voicesOrPreferred;
    preferredList = maybePreferred !== undefined ? maybePreferred : 'daniel';
  } else {
    const synth = getSpeechSynthesisInstance();
    if (!synth || typeof synth.getVoices !== 'function') return null;
    voices = synth.getVoices() || [];
    preferredList = voicesOrPreferred;
  }

  if (!voices || voices.length === 0) return null;

  const candidateList = Array.isArray(preferredList)
    ? preferredList.map((p) => String(p).toLowerCase().trim()).filter(Boolean)
    : [String(preferredList || 'daniel').toLowerCase().trim()].filter(Boolean);

  const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  const voicePool = englishVoices.length > 0 ? englishVoices : voices;

  const platformFallbackKeywords = [
    'ava', 'aria', 'jenny', 'andrew', 'guy', 'siri', 'samantha', 'daniel',
    'ryan', 'sonia', 'google us english', 'google uk english female',
    'google uk english male', 'google speech', 'oliver', 'karen', 'serena',
    'arthur', 'ana', 'emma', 'brian'
  ];

  const scoreVoice = (v) => {
    const name = String(v?.name || '').toLowerCase();
    const lang = String(v?.lang || '').toLowerCase().replace('_', '-');
    if (!name) return -1000;

    const robotic = isLegacyRoboticVoice(v);
    let matchScore = 0;
    const cIdx = candidateList.findIndex((target) => name.includes(target));
    if (cIdx !== -1) {
      matchScore = robotic
        ? Math.max(2, 15 - cIdx * 2)
        : Math.max(30, 100 - cIdx * 8);
    }

    let qualityScore = 20;
    if (robotic) {
      qualityScore = -80;
    } else if (/online\s*\(natural\)|\(premium\)/i.test(name)) {
      qualityScore = 75;
    } else if (/\b(natural|neural)\b|\(enhanced\)|\bsiri\b/i.test(name)) {
      qualityScore = 65;
    } else if (/google\s+(us|uk)\s+english|google\s+speech/i.test(name)) {
      qualityScore = 55;
    }

    let localeBonus = 0;
    if (!robotic) {
      if (lang === 'en-us' || lang === 'en-gb') {
        localeBonus = 8;
      } else if (lang === 'en-ca' || lang === 'en-au' || lang === 'en-ie' || lang === 'en-nz' || lang === 'en') {
        localeBonus = 4;
      }
    }

    let platformBonus = 0;
    if (!robotic) {
      const pIdx = platformFallbackKeywords.findIndex((kw) => name.includes(kw));
      if (pIdx !== -1) {
        platformBonus = Math.max(1, 22 - pIdx);
      }
    }

    return matchScore + qualityScore + localeBonus + platformBonus;
  };

  let bestVoice = null;
  let bestScore = -Infinity;

  for (const v of voicePool) {
    const score = scoreVoice(v);
    if (score > bestScore) {
      bestScore = score;
      bestVoice = v;
    }
  }

  // If English pool had no candidate match and non-English voices exist with an exact non-robotic candidate match
  if (englishVoices.length > 0 && voices.length > englishVoices.length) {
    const hasPoolCandidateMatch = voicePool.some((v) => {
      const n = String(v?.name || '').toLowerCase();
      return !isLegacyRoboticVoice(v) && candidateList.some((t) => n.includes(t));
    });
    if (!hasPoolCandidateMatch) {
      for (const v of voices) {
        const n = String(v?.name || '').toLowerCase();
        if (!isLegacyRoboticVoice(v) && candidateList.some((t) => n.includes(t))) {
          return v;
        }
      }
    }
  }

  return bestVoice || englishVoices[0] || voices[0] || null;
}

/**
 * Gets voice parameters for the given pet companion
 */
export function getCompanionVoiceParams(petId = 'rex') {
  const raw = String(petId || 'rex').toLowerCase().trim();
  const normId = raw.replace(/\s+/g, '_');
  const canonicalKey = normalizePetKey(normId);
  return COMPANION_VOICE_PROFILES[normId]
    || COMPANION_VOICE_PROFILES[canonicalKey]
    || COMPANION_VOICE_PROFILES.rex;
}

/**
 * High-Fidelity Client-Side Web Speech Synthesis Engine
 * Zero external network calls, zero cost, 0ms time-to-first-word latency.
 */
function speakWithSpeechSynthesis(text, petId = 'rex', onEnded = null, options = {}) {
  const synth = getSpeechSynthesisInstance();

  if (!synth || typeof synth.speak !== 'function') {
    if (typeof onEnded === 'function') {
      setTimeout(() => {
        try { onEnded(); } catch (e) { console.error('Error in voice onEnded callback:', e); }
      }, 5);
    }
    return;
  }

  const cleanSpokenText = cleanDialogueText(text);
  if (!cleanSpokenText) {
    if (typeof onEnded === 'function') {
      setTimeout(() => onEnded(), 5);
    }
    return;
  }

  try {
    if (!options.isContinuationChunk || synth.speaking || synth.pending) {
      synth.cancel();
    }

    const UtteranceClass = (typeof window !== 'undefined' && window.SpeechSynthesisUtterance)
      || (typeof globalThis !== 'undefined' && globalThis.SpeechSynthesisUtterance)
      || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);

    if (!UtteranceClass) {
      if (typeof onEnded === 'function') setTimeout(() => onEnded(), 5);
      return;
    }

    const utterance = new UtteranceClass(cleanSpokenText);
    const profile = getCompanionVoiceParams(petId);

    const chosenVoice = selectPreferredVoice(profile.preferred || profile.preferredVoice || 'daniel');
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    const rate = typeof options?.rate === 'number' && Number.isFinite(options.rate) && options.rate > 0
      ? options.rate
      : (profile.rate || 1.0);
    const hasExplicitPitch = typeof options?.pitch === 'number' && Number.isFinite(options.pitch) && options.pitch > 0;
    let pitch = hasExplicitPitch
      ? options.pitch
      : (profile.pitch || 1.0);
    if (!hasExplicitPitch && chosenVoice && isNeuralNaturalVoice(chosenVoice)) {
      // Keep default persona pitch shifts natural on neural vocoders so speech never sounds metallic
      const shaped = 1.0 + (pitch - 1.0) * 0.4;
      pitch = Math.max(0.88, Math.min(1.18, Number(shaped.toFixed(2))));
    }
    const volume = typeof options?.volume === 'number' && Number.isFinite(options.volume)
      ? Math.max(0, Math.min(1, options.volume))
      : (profile.volume || 1.0);

    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;

    // Retain module-level reference to prevent Chromium garbage collection bug
    activeUtterance = utterance;

    store.setLiveRexState({ isSpeaking: true, status: 'speaking' }, true);
    if (!options.isContinuationChunk) {
      dispatchSpeechEvent('companion-speech-start', {
        text: cleanSpokenText,
        petId,
        voice: chosenVoice?.name || ''
      });
    }

    // Native boundary event for lip sync
    utterance.onboundary = (e) => {
      dispatchSpeechEvent('companion-speech-syllable', {
        text: cleanSpokenText,
        petId,
        charIndex: e.charIndex,
        name: e.name
      });
    };

    // Continuous rhythmic jaw/syllable trigger (110ms) while speaking
    if (currentSyllableInterval) {
      clearInterval(currentSyllableInterval);
    }
    currentSyllableInterval = setInterval(() => {
      if (!synth || (!synth.speaking && !synth.pending)) {
        clearInterval(currentSyllableInterval);
        currentSyllableInterval = null;
        return;
      }
      dispatchSpeechEvent('companion-speech-syllable', { text: cleanSpokenText, petId });
    }, 110);
    if (currentSyllableInterval && typeof currentSyllableInterval.unref === 'function') {
      currentSyllableInterval.unref();
    }

    // Keepalive pulse every 9s to prevent desktop Chromium 15s pause bug.
    // Skipped on Android/iOS where speechSynthesis.pause() freezes native TTS drivers.
    if (currentKeepAliveInterval) {
      clearInterval(currentKeepAliveInterval);
      currentKeepAliveInterval = null;
    }
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const isMobileSpeechEngine = /Android|iPhone|iPad|iPod/i.test(ua);
    if (!isMobileSpeechEngine) {
      currentKeepAliveInterval = setInterval(() => {
        if (!synth || !synth.speaking) {
          clearInterval(currentKeepAliveInterval);
          currentKeepAliveInterval = null;
        } else {
          try {
            synth.pause();
            synth.resume();
          } catch {}
        }
      }, 9000);
      if (currentKeepAliveInterval && typeof currentKeepAliveInterval.unref === 'function') {
        currentKeepAliveInterval.unref();
      }
    }

    let finished = false;
    const clearUtteranceTimers = () => {
      if (currentKeepAliveInterval) {
        clearInterval(currentKeepAliveInterval);
        currentKeepAliveInterval = null;
      }
      if (currentUtteranceWatchdog) {
        clearTimeout(currentUtteranceWatchdog);
        currentUtteranceWatchdog = null;
      }
      if (currentSyllableInterval) {
        clearInterval(currentSyllableInterval);
        currentSyllableInterval = null;
      }
    };

    const finishUtterance = () => {
      if (finished) return;
      finished = true;

      clearUtteranceTimers();
      pendingUnlockSpeech = null;
      activeUtterance = null;

      if (options.isIntermediateChunk) {
        if (typeof onEnded === 'function') onEnded();
        return;
      }

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

    // Safety watchdog for iOS WebKit / Chromium dropped-onend edge cases so pipelined chapters never hang
    const customWatchdogMs = typeof options?.watchdogMs === 'number' && options.watchdogMs > 0
      ? options.watchdogMs
      : null;
    const watchdogMs = customWatchdogMs
      || Math.max(4000, Math.ceil((cleanSpokenText.length * 110) / Math.max(0.5, rate)) + 2500);
    currentUtteranceWatchdog = setTimeout(() => {
      currentUtteranceWatchdog = null;
      if (!finished && (!synth || (!synth.speaking && !synth.pending))) {
        finishUtterance();
      }
    }, watchdogMs);
    if (!customWatchdogMs && currentUtteranceWatchdog && typeof currentUtteranceWatchdog.unref === 'function') {
      currentUtteranceWatchdog.unref();
    }

    utterance.onstart = () => {
      pendingUnlockSpeech = null;
    };
    utterance.onend = finishUtterance;
    utterance.onerror = (e) => {
      if (e && (e.error === 'canceled' || e.error === 'interrupted')) {
        clearUtteranceTimers();
        activeUtterance = null;
        finished = true;
        return;
      }
      const blockedBeforeGesture = !hasUserInteracted && e && (e.error === 'not-allowed' || e.error === 'audio-busy');
      if (e && e.error !== 'canceled' && e.error !== 'interrupted') {
        console.debug('SpeechSynthesis notice:', e.error);
      }
      finishUtterance();
      if (blockedBeforeGesture) {
        pendingUnlockSpeech = {
          text: options._fullPendingText || cleanSpokenText,
          petId,
          onEnded: null,
          options
        };
      }
    };

    synth.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
    if (typeof onEnded === 'function') onEnded();
  }
}

function base64ToFloat32Array(base64Data) {
  const binaryString = typeof atob === 'function' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
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
  pendingUnlockSpeech = null;

  if (!options.isContinuationChunk) {
    store.setLiveRexState({ isSpeaking: true, status: 'speaking' }, true);
    dispatchSpeechEvent('companion-speech-start', { text: cleanSpoken, petId, voice: data.voice || '' });
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
  if (currentSyllableInterval && typeof currentSyllableInterval.unref === 'function') {
    currentSyllableInterval.unref();
  }

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
 * Resolves the Voice API base URL (empty string for zero-cost client-side engine)
 */
export function getVoiceApiBaseUrl() {
  return '';
}

/**
 * Lightweight voice initialization hook.
 * Pre-populates browser synthesis voices without spoofing a user interaction gesture.
 */
export function warmUpVoiceEngine() {
  voicesColdStartTimedOut = false;
  const synth = getSpeechSynthesisInstance();

  if (synth && typeof synth.getVoices === 'function') {
    try {
      synth.getVoices();
    } catch {}
  }
}

/**
 * Backward-compatible PCM TTS fetch helper.
 * If an explicit endpoint is passed, executes fetch; otherwise resolves null
 * without making network requests.
 */
export async function fetchPcmTts(endpoint, cleanSpoken, petId, timeoutMsOrOptions = VOICE_DEFAULT_TIMEOUT_MS, voiceStyle = 'default') {
  if (!endpoint) {
    return null;
  }

  let timeoutMs = VOICE_DEFAULT_TIMEOUT_MS;
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
    if (timeoutMs === VOICE_DEFAULT_TIMEOUT_MS || timeoutMs <= 4500 || !timeoutMs) {
      timeoutMs = 18000;
    }
  }

  if (typeof fetch !== 'function') return null;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const bodyPayload = {
      text: cleanSpoken,
      petId
    };
    if (style && style !== 'default') {
      bodyPayload.voiceStyle = style;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller?.signal
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data && (data.audio || data.audioBuffer) ? data : null;
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Pre-warms an array of companion phrases in memory with zero network calls
 */
export async function prewarmPhrasesAudio(phrases = [], petId = null, options = {}) {
  if (!Array.isArray(phrases) || phrases.length === 0) return 0;
  const targetPet = petId || store?.getActivePet?.()?.id || 'rex';
  const normKey = normalizePetKey(targetPet);
  const rawId = String(targetPet).toLowerCase().trim();
  const voiceStyle = options?.voiceStyle || 'default';
  const uniqueTexts = Array.from(new Set(phrases.map((p) => cleanDialogueText(typeof p === 'string' ? p : p?.text)).filter(Boolean)));
  if (uniqueTexts.length === 0) return 0;

  warmUpVoiceEngine();
  const profile = getCompanionVoiceParams(targetPet);
  const chosenVoice = selectPreferredVoice(profile.preferred || profile.preferredVoice || 'daniel');

  for (const cleanText of uniqueTexts) {
    const cacheKey = (voiceStyle && voiceStyle !== 'default')
      ? `${normKey}:${voiceStyle}:${cleanText}`
      : `${normKey}:${cleanText}`;
    if (!workoutAudioClipCache.has(cacheKey)) {
      const entry = {
        success: true,
        prewarmed: true,
        text: cleanText,
        chunks: splitIntoSpeechChunks(cleanText),
        petId: normKey,
        voiceStyle,
        voice: chosenVoice?.name || 'native'
      };
      if (voiceStyle && voiceStyle !== 'default') {
        workoutAudioClipCache.set(cacheKey, entry);
        workoutAudioClipCache.set(`${rawId}:${voiceStyle}:${cleanText}`, entry);
      } else {
        workoutAudioClipCache.set(cacheKey, entry);
        workoutAudioClipCache.set(`${rawId}:${cleanText}`, entry);
        workoutAudioClipCache.set(cleanText, entry);
      }
    }
  }
  return uniqueTexts.length;
}

/**
 * Pre-warms cadence dialogue cues and sentence chunks for the active workout routine
 * into `workoutAudioClipCache` with zero network requests and zero silent AudioBuffers.
 */
export async function prewarmWorkoutAudio(workoutId, coachId = null, options = {}) {
  if (Array.isArray(workoutId)) {
    return prewarmPhrasesAudio(workoutId, coachId, options);
  }

  let workout = null;
  if (workoutId && typeof workoutId === 'object' && workoutId.cadenceTimeline) {
    workout = workoutId;
  } else if (typeof workoutId === 'string' && Array.isArray(DINO_WORKOUTS)) {
    const normWorkout = workoutId.toLowerCase().trim();
    workout = DINO_WORKOUTS.find((w) => {
      const wId = String(w.id || '').toLowerCase();
      const wCoach = String(w.coachName || '').toLowerCase();
      return wId === normWorkout || wId.startsWith(`${normWorkout}_`) || wCoach === normWorkout;
    });
  }
  if (!workout) return 0;

  warmUpVoiceEngine();

  const targetCoach = coachId || workout.coachId || 'rex';
  const normKey = normalizePetKey(targetCoach);
  const rawId = String(targetCoach).toLowerCase().trim();
  const voiceStyle = options?.voiceStyle || 'default';
  const profile = getCompanionVoiceParams(targetCoach);
  const chosenVoice = selectPreferredVoice(profile.preferred || profile.preferredVoice || 'daniel');

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

  let prewarmedCount = 0;
  for (const cueText of cuesToPrewarm) {
    const cleanSpoken = cleanDialogueText(cueText);
    if (!cleanSpoken) continue;

    const cacheKey = (voiceStyle && voiceStyle !== 'default')
      ? `${normKey}:${voiceStyle}:${cleanSpoken}`
      : `${normKey}:${cleanSpoken}`;
    const rawKey = (voiceStyle && voiceStyle !== 'default')
      ? `${rawId}:${voiceStyle}:${cleanSpoken}`
      : `${rawId}:${cleanSpoken}`;

    if (workoutAudioClipCache.has(cacheKey) || workoutAudioClipCache.has(rawKey)) {
      prewarmedCount++;
      continue;
    }

    const entry = {
      success: true,
      prewarmed: true,
      text: cleanSpoken,
      chunks: splitIntoSpeechChunks(cleanSpoken),
      petId: normKey,
      voiceStyle,
      voice: chosenVoice?.name || 'native'
    };

    if (voiceStyle && voiceStyle !== 'default') {
      workoutAudioClipCache.set(cacheKey, entry);
      workoutAudioClipCache.set(rawKey, entry);
    } else {
      workoutAudioClipCache.set(cacheKey, entry);
      workoutAudioClipCache.set(rawKey, entry);
      workoutAudioClipCache.set(cleanSpoken, entry);
    }
    prewarmedCount++;
  }
  return prewarmedCount;
}

/**
 * Pre-warms upcoming dialogue or bedtime chapter text and sentence chunks into
 * `workoutAudioClipCache` with zero network calls and zero silent fake AudioBuffers.
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

  const styleKey = `${normKey}:${voiceStyle}:${cleanSpoken}`;
  const rawStyleKey = `${rawId}:${voiceStyle}:${cleanSpoken}`;
  const genericKey = `${normKey}:${cleanSpoken}`;
  const rawKey = `${rawId}:${cleanSpoken}`;

  // 1. Check in-memory or IndexedDB cache
  const existing =
    (voiceStyle && voiceStyle !== 'default'
      ? (workoutAudioClipCache.get(styleKey) || workoutAudioClipCache.get(rawStyleKey))
      : (workoutAudioClipCache.get(genericKey) || workoutAudioClipCache.get(rawKey) || workoutAudioClipCache.get(cleanSpoken))) ||
    await lookupClientAudioCache(cleanSpoken, petId, voiceStyle);

  if (existing) {
    if (!existing.prewarmed && !existing.audioBuffer && existing.audio) {
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
    if (!existing.prewarmed && existing.audioBuffer) {
      const res = existing.audioBuffer;
      res.audio = existing.audio;
      res.sampleRate = existing.sampleRate;
      res.audioBuffer = existing.audioBuffer;
      return res;
    }
    return existing;
  }

  warmUpVoiceEngine();
  const chunks = splitIntoSpeechChunks(cleanSpoken);
  const profile = getCompanionVoiceParams(petId);
  const chosenVoice = selectPreferredVoice(profile.preferred || profile.preferredVoice || 'daniel');

  // 2. If pipelined bedtime chapter, also pre-warm individual sentence chunks
  if (opts.pipelined && voiceStyle === 'bedtime' && chunks.length > 1) {
    for (let i = 0; i < chunks.length; i++) {
      await prefetchCompanionAudio(chunks[i], petId, {
        ...opts,
        pipelined: false
      });
    }
  }

  const entry = {
    success: true,
    prewarmed: true,
    text: cleanSpoken,
    chunks,
    petId: normKey,
    voiceStyle,
    voice: chosenVoice?.name || 'native'
  };

  if (voiceStyle && voiceStyle !== 'default') {
    workoutAudioClipCache.set(styleKey, entry);
    workoutAudioClipCache.set(rawStyleKey, entry);
  } else {
    workoutAudioClipCache.set(genericKey, entry);
    workoutAudioClipCache.set(rawKey, entry);
    workoutAudioClipCache.set(cleanSpoken, entry);
  }

  return entry;
}

/**
 * Pipelined sentence-by-sentence playback for multi-sentence passages & AI Storybook.
 * Synthesizes Sentence 0 immediately and triggers subsequent chunks with natural storytelling cadence.
 */
async function speakPipelinedChunks(chunks, cleanSpoken, petId, callback, myGeneration, opts) {
  if (!chunks || chunks.length === 0) {
    if (typeof callback === 'function') callback();
    return true;
  }

  const playChunkIndex = (idx) => {
    if (myGeneration !== speechGeneration) return;

    const isLast = idx >= chunks.length - 1;
    const chunkText = chunks[idx];

    const onChunkEnded = () => {
      if (myGeneration !== speechGeneration) return;
      if (isLast) {
        if (typeof callback === 'function') {
          try { callback(); } catch (e) { console.error('Error in callback:', e); }
        }
      } else {
        currentSentenceChainTimer = setTimeout(() => {
          currentSentenceChainTimer = null;
          playChunkIndex(idx + 1);
        }, 160);
      }
    };

    speakWithSpeechSynthesis(chunkText, petId, onChunkEnded, {
      ...opts,
      _fullPendingText: cleanSpoken,
      isContinuationChunk: idx > 0,
      isIntermediateChunk: !isLast
    });
  };

  playChunkIndex(0);
  return true;
}

/**
 * Unified Spoken Voice Entrypoint for Pet Companions
 * 0. Synchronous AudioContext gesture unlock + Zero-Latency Cache lookup.
 * 1. Pipelined sentence streaming for multi-sentence bedtime chapters & long guidance.
 * 2. Primary: Enhanced Multi-Profile Client-Side Web Speech Synthesis API.
 */
export const speakCompanion = async (text, petIdOrOptions = null, onEndedOrOptions = null, options = {}) => {
  // Unlock & resume AudioContext synchronously while user tap gesture is still active
  ensureSharedAudioContextReady();

  let petId = null;
  let callback = null;
  let opts = {
    timeoutMs: VOICE_DEFAULT_TIMEOUT_MS,
    rate: undefined,
    pitch: undefined,
    voiceStyle: 'default',
    instant: false,
    pipelined: undefined
  };

  if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    opts = { ...opts, ...petIdOrOptions };
    if (petIdOrOptions.petId) petId = String(petIdOrOptions.petId);
    if (typeof petIdOrOptions.onEnded === 'function') callback = petIdOrOptions.onEnded;
  } else if (typeof petIdOrOptions === 'function') {
    callback = petIdOrOptions;
  } else if (petIdOrOptions !== undefined && petIdOrOptions !== null && String(petIdOrOptions).trim() !== '') {
    petId = String(petIdOrOptions);
  }

  if (typeof onEndedOrOptions === 'function') {
    callback = onEndedOrOptions;
  } else if (onEndedOrOptions && typeof onEndedOrOptions === 'object') {
    opts = { ...opts, ...onEndedOrOptions };
    if (typeof onEndedOrOptions.onEnded === 'function') callback = onEndedOrOptions.onEnded;
    if (onEndedOrOptions.petId && !petId) petId = String(onEndedOrOptions.petId);
  }

  if (options && typeof options === 'object') {
    opts = { ...opts, ...options };
    if (typeof options.onEnded === 'function' && !callback) callback = options.onEnded;
    if (options.petId && !petId) petId = String(options.petId);
  }

  // If text is null, undefined, not a string, empty, or whitespace-only, invoke callback and return immediately
  if (!text || typeof text !== 'string' || !text.trim()) {
    if (typeof callback === 'function') callback();
    return true;
  }

  if (!petId) {
    try {
      const active = store?.getActivePet?.();
      if (active?.id) petId = String(active.id);
    } catch {}
  }
  if (!petId) {
    petId = 'rex';
  }

  const cleanSpoken = cleanDialogueText(text);
  if (!cleanSpoken) {
    if (typeof callback === 'function') callback();
    return true;
  }

  stopRex();
  const myGeneration = ++speechGeneration;

  if (!hasUserInteracted && typeof window !== 'undefined') {
    pendingUnlockSpeech = { text: cleanSpoken, petId, onEnded: null, options: opts };
  }

  const voiceStyle = opts.voiceStyle || 'default';

  // --- Fast Path: Bundled PCM AudioBuffer Cache (only for genuine non-prewarmed PCM clips) ---
  const cachedData = await lookupClientAudioCache(cleanSpoken, petId, voiceStyle);
  if (myGeneration !== speechGeneration) return;

  if (cachedData && !cachedData.prewarmed && (cachedData.audio || cachedData.audioBuffer)) {
    const played = await playPcmTtsResponse(cachedData, cleanSpoken, petId, callback, myGeneration, opts);
    if (played) return;
    if (myGeneration !== speechGeneration) return;
  }

  // Ensure Chromium cold-start voices are populated before selecting a voice
  const synth = getSpeechSynthesisInstance();
  if (synth && typeof synth.getVoices === 'function' && (synth.getVoices() || []).length === 0 && !voicesColdStartTimedOut) {
    await ensureVoicesReady(synth, 90);
    if (myGeneration !== speechGeneration) return;
  }

  // --- Primary Engine: Enhanced Multi-Profile Client-Side Speech Synthesis ---
  const chunks = (Array.isArray(cachedData?.chunks) && cachedData.chunks.length > 0)
    ? cachedData.chunks
    : splitIntoSpeechChunks(cleanSpoken);
  const shouldPipeline = opts.pipelined === true ||
    (opts.pipelined !== false && chunks.length > 1 && (voiceStyle === 'bedtime' || cleanSpoken.length > 130));

  if (shouldPipeline && chunks.length > 1) {
    await speakPipelinedChunks(chunks, cleanSpoken, petId, callback, myGeneration, opts);
    return;
  }

  speakWithSpeechSynthesis(cleanSpoken, petId, callback, { ...opts, _fullPendingText: cleanSpoken });
};

/**
 * Flagship alias for backward compatibility across existing calls
 */
export const speakRex = async (text, onEnded = null) => {
  return speakCompanion(text, null, onEnded);
};

