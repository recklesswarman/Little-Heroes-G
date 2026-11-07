/**
 * scratch/adversarial_voice_invariants_challenger_2.mjs
 * 
 * EMPIRICAL ADVERSARIAL CHALLENGER 2:
 * Invariant, Offline & Zero Network Leak Verification Harness for Little Hero Adventures.
 * 
 * CORE VERIFICATION INVARIANTS:
 * 1. Zero Network Leak Verification:
 *    - Monkey-patch global.fetch, globalThis.fetch, and Node http.request / https.request.
 *    - Intercept and fail any outbound HTTP request.
 *    - Run speech synthesis across all 24 pets and bedtime narrator.
 *    - Assert that ZERO network calls are attempted (zero calls to /api/tts, zero calls to Cloud Run, zero calls to third-party TTS APIs).
 * 2. Offline Invariant Verification:
 *    - Simulate offline PWA mode (window.navigator.onLine = false).
 *    - Confirm voice synthesis, companion lip-sync events, and callbacks fire successfully without internet connectivity.
 * 3. Pet Profile Exhaustive Coverage:
 *    - Iterate through every single pet ID in PETS_DATABASE (all 24 pets).
 *    - Assert that getCompanionVoiceParams(pet.id) returns valid, clamped pitch (0.80 - 1.45) and rate (0.76 - 1.15) with non-empty preferred voice cascades.
 *    - Test boundary handling for null, undefined, empty, numeric, and unknown IDs.
 * 4. Lip-Sync Event Invariant Verification:
 *    - Verify that companion-speech-start, companion-speech-syllable, and companion-speech-end fire in strict temporal sequence.
 *    - Assert correct event details (petId, text) on all events.
 *    - Verify multi-chunk bedtime narration does not prematurely end speech between chunks.
 *    - Verify cancellation with stopRex() halts events and settles to idle.
 */

import './setup_mock_env.js';
import http from 'node:http';
import https from 'node:https';
import { PETS_DATABASE } from '../src/data/petsData.js';
import {
  speakCompanion,
  stopRex,
  isRexSpeaking,
  getCompanionVoiceParams,
  selectPreferredVoice,
  splitIntoSpeechChunks,
  cleanDialogueText,
  normalizePetKey,
  prewarmPhrasesAudio,
  prewarmWorkoutAudio,
  prefetchCompanionAudio,
  warmUpVoiceEngine,
  isLegacyRoboticVoice,
  isNeuralNaturalVoice,
  getVoiceApiBaseUrl,
  COMPANION_VOICE_PROFILES
} from '../src/services/voiceService.js';
import { store } from '../src/state/store.js';

// ── 0. High-Fidelity Headless Environment & Event Target Setup ──

const windowEventListeners = new Map();
globalThis.window.addEventListener = (type, fn) => {
  if (!windowEventListeners.has(type)) windowEventListeners.set(type, new Set());
  windowEventListeners.get(type).add(fn);
};
globalThis.window.removeEventListener = (type, fn) => {
  if (windowEventListeners.has(type)) windowEventListeners.get(type).delete(fn);
};
globalThis.window.dispatchEvent = (event) => {
  if (!event || !event.type) return true;
  const set = windowEventListeners.get(event.type);
  if (set) {
    for (const fn of set) {
      try { fn(event); } catch (err) { console.error('Error in window event listener:', err); }
    }
  }
  return true;
};

if (typeof globalThis.CustomEvent === 'undefined' || typeof globalThis.window.CustomEvent === 'undefined') {
  class CustomEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.detail = params.detail || {};
      this.bubbles = Boolean(params.bubbles);
    }
  }
  globalThis.CustomEvent = CustomEvent;
  globalThis.window.CustomEvent = CustomEvent;
}

// Web Audio Polyfill
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 24000;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      copyToChannel: () => {},
      getChannelData: () => new Float32Array(length)
    };
  }
  createBufferSource() {
    let _onended = null;
    return {
      buffer: null,
      playbackRate: { value: 1.0, setValueAtTime: () => {} },
      detune: { value: 0, setValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
      get onended() { return _onended; },
      set onended(fn) { _onended = fn; }
    };
  }
}
globalThis.window.AudioContext = MockAudioContext;
globalThis.AudioContext = MockAudioContext;

// Web Speech Synthesis Polyfill
class MockSpeechSynthesisVoice {
  constructor(name, lang = 'en-US', isDefault = false) {
    this.name = name;
    this.lang = lang;
    this.default = isDefault;
    this.voiceURI = name;
    this.localService = true;
  }
}

const MOCK_VOICES = [
  new MockSpeechSynthesisVoice('Microsoft Jenny Natural - English (United States)', 'en-US', true),
  new MockSpeechSynthesisVoice('Microsoft Guy Natural - English (United States)', 'en-US'),
  new MockSpeechSynthesisVoice('Google US English', 'en-US'),
  new MockSpeechSynthesisVoice('Samantha', 'en-US'),
  new MockSpeechSynthesisVoice('Daniel', 'en-GB'),
  new MockSpeechSynthesisVoice('Apple Siri', 'en-US'),
  new MockSpeechSynthesisVoice('Oliver', 'en-GB'),
  new MockSpeechSynthesisVoice('Junior', 'en-US'),
  new MockSpeechSynthesisVoice('Karen', 'en-AU'),
  new MockSpeechSynthesisVoice('Serena', 'en-GB'),
  new MockSpeechSynthesisVoice('Arthur', 'en-GB'),
  new MockSpeechSynthesisVoice('Liam', 'en-US')
];

class MockSpeechSynthesisUtterance {
  constructor(text = '') {
    this.text = String(text);
    this.voice = null;
    this.pitch = 1.0;
    this.rate = 1.0;
    this.volume = 1.0;
    this.lang = 'en-US';
    this.onstart = null;
    this.onboundary = null;
    this.onend = null;
    this.onerror = null;
    this._canceled = false;
  }
}
globalThis.window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

let activeUtteranceMock = null;
let synthSpeaking = false;
let synthPaused = false;
const speechLog = [];

const mockSpeechSynthesis = {
  get speaking() {
    return synthSpeaking;
  },
  get paused() {
    return synthPaused;
  },
  get pending() {
    return false;
  },
  getVoices() {
    return [...MOCK_VOICES];
  },
  speak(utterance) {
    if (!utterance) return;
    activeUtteranceMock = utterance;
    synthSpeaking = true;
    synthPaused = false;
    utterance._canceled = false;

    speechLog.push({
      text: utterance.text,
      voice: utterance.voice?.name || null,
      pitch: utterance.pitch,
      rate: utterance.rate,
      volume: utterance.volume,
      time: Date.now()
    });

    // Simulate async speech lifecycle
    setTimeout(() => {
      if (utterance._canceled || activeUtteranceMock !== utterance) return;

      if (typeof utterance.onstart === 'function') {
        utterance.onstart({ type: 'start' });
      }

      // Simulate word boundary events
      const words = utterance.text.split(/\s+/).filter(Boolean);
      let charIndex = 0;
      for (const w of words) {
        if (utterance._canceled || activeUtteranceMock !== utterance) return;
        if (typeof utterance.onboundary === 'function') {
          utterance.onboundary({
            type: 'boundary',
            name: 'word',
            charIndex,
            charLength: w.length
          });
        }
        charIndex += w.length + 1;
      }

      // Complete utterance after short delay
      setTimeout(() => {
        if (utterance._canceled || activeUtteranceMock !== utterance) return;
        synthSpeaking = false;
        activeUtteranceMock = null;
        if (typeof utterance.onend === 'function') {
          utterance.onend({ type: 'end' });
        }
      }, 15);
    }, 10);
  },
  cancel() {
    if (activeUtteranceMock) {
      activeUtteranceMock._canceled = true;
      activeUtteranceMock = null;
    }
    synthSpeaking = false;
    synthPaused = false;
  },
  pause() {
    synthPaused = true;
  },
  resume() {
    synthPaused = false;
  }
};
globalThis.window.speechSynthesis = mockSpeechSynthesis;
globalThis.speechSynthesis = mockSpeechSynthesis;

// ── Test Runner Infrastructure ──

let totalProbes = 0;
let passedProbes = 0;
let failedProbes = 0;
const failureDetails = [];

function assert(condition, testName, message = '') {
  totalProbes++;
  if (condition) {
    passedProbes++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedProbes++;
    const errMsg = `FAILED: ${testName} - ${message}`;
    console.error(`  [FAIL] ${testName}: ${message}`);
    failureDetails.push(errMsg);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── ADVERSARIAL TEST SUITE EXECUTION ──

async function runAdversarialChallenge() {
  console.log('========================================================================');
  console.log('CHALLENGER 2: ADVERSARIAL NETWORK, OFFLINE & INVARIANT VERIFICATION');
  console.log('Target: Kokoro Replacement & Native Web Speech Synthesis Engine');
  console.log('========================================================================\n');

  // =====================================================================
  // SECTION 1: ZERO NETWORK LEAK VERIFICATION
  // =====================================================================
  console.log('--- SECTION 1: ZERO NETWORK LEAK VERIFICATION ---');
  
  const interceptedNetworkRequests = [];
  const recordAndTrapNetworkCall = (protocol, urlOrOpts) => {
    const info = {
      protocol,
      target: typeof urlOrOpts === 'string' ? urlOrOpts : JSON.stringify(urlOrOpts),
      stack: new Error().stack,
      time: Date.now()
    };
    interceptedNetworkRequests.push(info);
    throw new Error(`ADVERSARIAL_TRAP: Outbound ${protocol} network request attempted to: ${info.target}`);
  };

  // 1. Trap globalThis.fetch and global.fetch
  const originalFetch = globalThis.fetch;
  const originalNodeHttp = http.request;
  const originalNodeHttpGet = http.get;
  const originalNodeHttps = https.request;
  const originalNodeHttpsGet = https.get;

  globalThis.fetch = async (input, init) => {
    const urlStr = typeof input === 'string' ? input : input?.url || String(input);
    recordAndTrapNetworkCall('fetch', urlStr);
  };
  if (typeof global !== 'undefined') {
    global.fetch = globalThis.fetch;
  }

  // 2. Trap Node http and https requests
  http.request = function (...args) {
    recordAndTrapNetworkCall('http.request', args[0]);
  };
  http.get = function (...args) {
    recordAndTrapNetworkCall('http.get', args[0]);
  };
  https.request = function (...args) {
    recordAndTrapNetworkCall('https.request', args[0]);
  };
  https.get = function (...args) {
    recordAndTrapNetworkCall('https.get', args[0]);
  };

  // Check voice api base url is empty
  assert(getVoiceApiBaseUrl() === '', 'ZNL.1: getVoiceApiBaseUrl returns empty string (zero external endpoint)');

  let networkTrapTripped = false;
  try {
    // Speak across all 24 pets in PETS_DATABASE
    for (const pet of PETS_DATABASE) {
      await new Promise((resolve) => {
        speakCompanion(`Roar! I am ${pet.name}! Let us run and play!`, pet.id, () => {
          resolve();
        });
      });
    }

    // Speak as bedtime narrator with calming rates & pipelining
    await new Promise((resolve) => {
      speakCompanion(
        'The moon is rising high over the primeval valley. It is time for sleep.',
        'bedtime_narrator',
        () => resolve(),
        { voiceStyle: 'bedtime', rate: 0.85, pitch: 0.98, pipelined: true }
      );
    });

    // Speak with pet key strings
    await new Promise((resolve) => {
      speakCompanion('Stego stomps through the ancient fern forest.', 'stego', () => resolve());
    });
    await new Promise((resolve) => {
      speakCompanion('Luna gallops across the starlit sky.', 'luna', () => resolve());
    });
    await new Promise((resolve) => {
      speakCompanion('Shadow prowls stealthily through the night.', 'shadow-sm', () => resolve());
    });

    // Prewarm phrases, workout routines, and bedtime chapters with zero network requests
    const phraseCount = await prewarmPhrasesAudio(['3, 2, 1, BRUSH!', 'Great job!'], 'rex');
    assert(phraseCount === 2, 'ZNL.1a: prewarmPhrasesAudio populates 2 phrase descriptors');
    const workoutCountExact = await prewarmWorkoutAudio('trex_run', '1');
    const workoutCountAlias = await prewarmWorkoutAudio('trex', 'rex');
    assert(
      workoutCountExact > 0 && workoutCountAlias > 0,
      'ZNL.1a2: prewarmWorkoutAudio populates real Dino Workout cues for both canonical id (trex_run) and coach shorthand (trex)'
    );
    const prefetchedChapter = 'The crystal lanterns shone brightly over the sleepy lagoon.';
    await prefetchCompanionAudio(prefetchedChapter, 'luna', { voiceStyle: 'bedtime' });

    // Speaking a prefetched chapter must genuinely invoke speechSynthesis.speak (not play a silent fake buffer)
    const logLenBefore = speechLog.length;
    await new Promise((resolve) => {
      speakCompanion(prefetchedChapter, 'luna', () => resolve(), { voiceStyle: 'bedtime' });
    });
    assert(
      speechLog.length > logLenBefore && speechLog[speechLog.length - 1].text === prefetchedChapter,
      'ZNL.1b: speakCompanion after prefetchCompanionAudio invokes real speechSynthesis.speak (zero silent AudioBuffer bypass)'
    );

    // Voice engine init hook
    warmUpVoiceEngine();

  } catch (err) {
    networkTrapTripped = true;
    console.error('Network trap triggered exception:', err.message);
  }

  assert(
    !networkTrapTripped && interceptedNetworkRequests.length === 0,
    'ZNL.2: Zero outbound network requests attempted across all 24 pets, bedtime narrator, workout prewarm, and chapter prefetch',
    `Intercepted ${interceptedNetworkRequests.length} requests: ${JSON.stringify(interceptedNetworkRequests)}`
  );

  const kokoroOrCloudRunCalls = interceptedNetworkRequests.filter(r => 
    r.target.includes('/api/tts') || r.target.includes('run.app') || r.target.includes('kokoro')
  );
  assert(
    kokoroOrCloudRunCalls.length === 0,
    'ZNL.3: Zero calls to /api/tts, Cloud Run, or Kokoro endpoints',
    `Found Kokoro calls: ${JSON.stringify(kokoroOrCloudRunCalls)}`
  );

  // Restore network originals for subsequent tests
  globalThis.fetch = originalFetch;
  if (typeof global !== 'undefined') global.fetch = originalFetch;
  http.request = originalNodeHttp;
  http.get = originalNodeHttpGet;
  https.request = originalNodeHttps;
  https.get = originalNodeHttpsGet;

  console.log('');

  // =====================================================================
  // SECTION 2: OFFLINE INVARIANT VERIFICATION
  // =====================================================================
  console.log('--- SECTION 2: OFFLINE INVARIANT VERIFICATION ---');

  // Simulate offline PWA mode
  globalThis.window.navigator.onLine = false;
  if (typeof globalThis.navigator !== 'undefined') {
    globalThis.navigator.onLine = false;
  }
  // Stub fetch to reject immediately simulating total network severance
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch: browser is completely offline');
  };

  let offlineCallbackFired = false;
  let offlineEvents = [];
  const offlineListener = (e) => offlineEvents.push({ type: e.type, detail: e.detail });
  globalThis.window.addEventListener('companion-speech-start', offlineListener);
  globalThis.window.addEventListener('companion-speech-syllable', offlineListener);
  globalThis.window.addEventListener('companion-speech-end', offlineListener);

  await new Promise((resolve) => {
    speakCompanion('Offline hero mode active! Zero internet required for companion voice.', 'luna', () => {
      offlineCallbackFired = true;
      resolve();
    });
  });

  assert(offlineCallbackFired, 'OFFLINE.1: speakCompanion onEnded callback resolves when navigator.onLine is false');
  assert(
    offlineEvents.some(e => e.type === 'companion-speech-start'),
    'OFFLINE.2: companion-speech-start fires in offline PWA mode'
  );
  assert(
    offlineEvents.some(e => e.type === 'companion-speech-syllable'),
    'OFFLINE.3: companion-speech-syllable fires in offline PWA mode'
  );
  assert(
    offlineEvents.some(e => e.type === 'companion-speech-end'),
    'OFFLINE.4: companion-speech-end fires in offline PWA mode'
  );
  assert(
    !isRexSpeaking(),
    'OFFLINE.5: isRexSpeaking() returns false upon speech completion in offline mode'
  );

  // Test multi-chunk bedtime story in offline mode
  let offlineBedtimeEnded = false;
  let offlineBedtimeEvents = [];
  const bedtimeListener = (e) => offlineBedtimeEvents.push(e.type);
  globalThis.window.addEventListener('companion-speech-start', bedtimeListener);
  globalThis.window.addEventListener('companion-speech-end', bedtimeListener);

  await new Promise((resolve) => {
    speakCompanion(
      'The stars twinkle in the dark night sky. The moon glows gently over the sleepy forest. Rest your eyes little hero.',
      'bedtime_narrator',
      () => {
        offlineBedtimeEnded = true;
        resolve();
      },
      { voiceStyle: 'bedtime', pipelined: true }
    );
  });

  assert(offlineBedtimeEnded, 'OFFLINE.6: Multi-chunk bedtime narration completes successfully in offline mode');
  assert(
    offlineBedtimeEvents.includes('companion-speech-start') && offlineBedtimeEvents.includes('companion-speech-end'),
    'OFFLINE.7: Bedtime narration starts and ends cleanly with lip-sync events in offline mode'
  );

  // Clean up offline listeners
  globalThis.window.removeEventListener('companion-speech-start', offlineListener);
  globalThis.window.removeEventListener('companion-speech-syllable', offlineListener);
  globalThis.window.removeEventListener('companion-speech-end', offlineListener);
  globalThis.window.removeEventListener('companion-speech-start', bedtimeListener);
  globalThis.window.removeEventListener('companion-speech-end', bedtimeListener);

  // Restore online state
  globalThis.window.navigator.onLine = true;
  if (typeof globalThis.navigator !== 'undefined') globalThis.navigator.onLine = true;

  console.log('');

  // =====================================================================
  // SECTION 3: PET PROFILE EXHAUSTIVE COVERAGE
  // =====================================================================
  console.log('--- SECTION 3: PET PROFILE EXHAUSTIVE COVERAGE ---');

  assert(PETS_DATABASE.length === 24, 'PET.0: PETS_DATABASE contains exactly 24 companion pets', `Found ${PETS_DATABASE.length}`);

  for (const pet of PETS_DATABASE) {
    const profileById = getCompanionVoiceParams(pet.id);
    const profileByKey = getCompanionVoiceParams(pet.key);
    const profileByNum = getCompanionVoiceParams(Number(pet.id));

    // 1. Existence and identification
    assert(
      profileById && typeof profileById === 'object',
      `PET.ID.${pet.id}: Voice profile exists for ID '${pet.id}' (${pet.name})`
    );
    assert(
      profileByKey && typeof profileByKey === 'object',
      `PET.KEY.${pet.key}: Voice profile exists for key '${pet.key}'`
    );

    // 2. Pitch clamping [0.80, 1.45]
    const pitchValid = typeof profileById.pitch === 'number' &&
      Number.isFinite(profileById.pitch) &&
      profileById.pitch >= 0.80 &&
      profileById.pitch <= 1.45;
    assert(
      pitchValid,
      `PET.PITCH.${pet.id}: Pitch ${profileById.pitch} clamped within toddler range [0.80, 1.45]`,
      `Pitch was ${profileById.pitch}`
    );

    // 3. Rate clamping [0.76, 1.15]
    const rateValid = typeof profileById.rate === 'number' &&
      Number.isFinite(profileById.rate) &&
      profileById.rate >= 0.76 &&
      profileById.rate <= 1.15;
    assert(
      rateValid,
      `PET.RATE.${pet.id}: Rate ${profileById.rate} clamped within toddler range [0.76, 1.15]`,
      `Rate was ${profileById.rate}`
    );

    // 4. Preferred voice cascades non-empty array
    const preferredValid = Array.isArray(profileById.preferred) &&
      profileById.preferred.length >= 1 &&
      profileById.preferred.every(p => typeof p === 'string' && p.trim().length > 0);
    assert(
      preferredValid,
      `PET.PREF.${pet.id}: Preferred voice cascade is non-empty array of valid strings [${profileById.preferred?.join(', ')}]`,
      `Preferred was ${JSON.stringify(profileById.preferred)}`
    );

    // 5. Parity between ID, key, and numeric lookups
    assert(
      profileById.pitch === profileByKey.pitch && profileById.rate === profileByKey.rate,
      `PET.PARITY.${pet.id}: ID '${pet.id}' and Key '${pet.key}' resolve to matching acoustic parameters`
    );
    assert(
      profileById.pitch === profileByNum.pitch && profileById.rate === profileByNum.rate,
      `PET.PARITY_NUM.${pet.id}: Numeric ID ${pet.id} resolves to matching acoustic parameters`
    );
  }

  // Bedtime narrator persona verification
  const bedtimeProfile = getCompanionVoiceParams('bedtime_narrator');
  assert(
    bedtimeProfile && typeof bedtimeProfile === 'object',
    'PET.BEDTIME.1: Profile for bedtime_narrator is present'
  );
  assert(
    bedtimeProfile.pitch >= 0.80 && bedtimeProfile.pitch <= 1.45,
    `PET.BEDTIME.2: Bedtime narrator pitch (${bedtimeProfile.pitch}) clamped in [0.80, 1.45]`
  );
  assert(
    bedtimeProfile.rate >= 0.76 && bedtimeProfile.rate <= 1.15,
    `PET.BEDTIME.3: Bedtime narrator rate (${bedtimeProfile.rate}) clamped in [0.76, 1.15]`
  );
  assert(
    Array.isArray(bedtimeProfile.preferred) && bedtimeProfile.preferred.length >= 1,
    `PET.BEDTIME.4: Bedtime narrator has non-empty preferred cascade [${bedtimeProfile.preferred?.join(', ')}]`
  );

  // Boundary condition tests: null, undefined, empty, invalid strings, whitespace
  const nullProfile = getCompanionVoiceParams(null);
  assert(
    nullProfile && nullProfile.pitch >= 0.80 && nullProfile.pitch <= 1.45 && nullProfile.rate >= 0.76 && nullProfile.rate <= 1.15,
    'PET.BOUNDARY.1: null petId gracefully falls back to valid clamped profile'
  );
  const undefProfile = getCompanionVoiceParams(undefined);
  assert(
    undefProfile && undefProfile.pitch >= 0.80 && undefProfile.pitch <= 1.45,
    'PET.BOUNDARY.2: undefined petId gracefully falls back to valid clamped profile'
  );
  const unknownProfile = getCompanionVoiceParams('mythical_griffin_9999');
  assert(
    unknownProfile && unknownProfile.pitch >= 0.80 && unknownProfile.pitch <= 1.45,
    'PET.BOUNDARY.3: Unknown string petId gracefully falls back to valid default profile'
  );
  const spacedProfile = getCompanionVoiceParams('  rex  ');
  assert(
    spacedProfile && spacedProfile.key === 'rex',
    'PET.BOUNDARY.4: Whitespace-padded petId normalized correctly'
  );
  const dashedProfile = getCompanionVoiceParams('shadow-sm');
  assert(
    dashedProfile && dashedProfile.pitch === 1.05 && dashedProfile.rate === 0.95,
    'PET.BOUNDARY.5: Hyphenated petId shadow-sm resolves correctly'
  );
  const underscoreProfile = getCompanionVoiceParams('shadow_sm');
  assert(
    underscoreProfile && underscoreProfile.pitch === 1.05 && underscoreProfile.rate === 0.95,
    'PET.BOUNDARY.6: Underscore petId shadow_sm resolves to identical parameters'
  );

  // Neural/Natural vs Legacy Robotic SAPI5 Scoring Verification
  const origGetVoices = mockSpeechSynthesis.getVoices;
  try {
    mockSpeechSynthesis.getVoices = () => [
      new MockSpeechSynthesisVoice('Microsoft David - English (United States)', 'en-US', true),
      new MockSpeechSynthesisVoice('Microsoft Mark - English (United States)', 'en-US'),
      new MockSpeechSynthesisVoice('Microsoft Zira - English (United States)', 'en-US'),
      new MockSpeechSynthesisVoice('Google US English', 'en-US'),
      new MockSpeechSynthesisVoice('Microsoft Jenny Online (Natural) - English (United States)', 'en-US')
    ];
    assert(isLegacyRoboticVoice({ name: 'Microsoft David - English (United States)' }), 'VOICE.1: Microsoft David flagged as legacy robotic SAPI5');
    assert(isNeuralNaturalVoice({ name: 'Microsoft Jenny Online (Natural) - English (United States)' }), 'VOICE.2: Microsoft Jenny Online (Natural) recognized as neural');
    const chosenDespiteMark = selectPreferredVoice(['mark', 'david']);
    assert(
      chosenDespiteMark && !isLegacyRoboticVoice(chosenDespiteMark),
      `VOICE.3: Neural voice (${chosenDespiteMark?.name}) prioritized over legacy SAPI5 Mark/David even when requested`
    );
  } finally {
    mockSpeechSynthesis.getVoices = origGetVoices;
  }

  console.log('');

  // =====================================================================
  // SECTION 4: LIP-SYNC EVENT INVARIANT VERIFICATION
  // =====================================================================
  console.log('--- SECTION 4: LIP-SYNC EVENT INVARIANT VERIFICATION ---');

  const capturedEvents = [];
  const eventCaptureListener = (e) => {
    capturedEvents.push({
      type: e.type,
      detail: e.detail,
      time: performance.now()
    });
  };

  globalThis.window.addEventListener('companion-speech-start', eventCaptureListener);
  globalThis.window.addEventListener('companion-speech-syllable', eventCaptureListener);
  globalThis.window.addEventListener('companion-speech-end', eventCaptureListener);

  // Test 4.1: Single clean utterance sequence & payloads for specific pet (Stego)
  capturedEvents.length = 0;
  const testPhrase = 'Stego loves to solar-charge and stomps with heavy plates!';
  const targetPet = 'stego';

  await new Promise((resolve) => {
    speakCompanion(testPhrase, targetPet, () => {
      resolve();
    });
  });

  // Verify events of this utterance (from speech-start to speech-end)
  const types = capturedEvents.map(e => e.type);
  const startIdx = types.indexOf('companion-speech-start');
  const firstSyllableIdx = types.indexOf('companion-speech-syllable');
  const endIdx = types.lastIndexOf('companion-speech-end');

  assert(startIdx !== -1, 'LIP.1: companion-speech-start event was dispatched');
  assert(endIdx !== -1, 'LIP.2: companion-speech-end event was dispatched');
  assert(startIdx < endIdx, 'LIP.3: companion-speech-start strictly precedes companion-speech-end');
  assert(
    firstSyllableIdx !== -1 && startIdx < firstSyllableIdx && firstSyllableIdx < endIdx,
    'LIP.4: companion-speech-syllable events occur between start and end'
  );

  // Filter events within the active utterance window [startIdx, endIdx]
  const utteranceEvents = capturedEvents.slice(startIdx, endIdx + 1);
  assert(utteranceEvents.length >= 3, 'LIP.5: Active utterance contains start, syllable(s), and end');

  // Verify timestamps within utterance window are monotonically non-decreasing
  let timestampsOrdered = true;
  for (let i = 1; i < utteranceEvents.length; i++) {
    if (utteranceEvents[i].time < utteranceEvents[i - 1].time) {
      timestampsOrdered = false;
      break;
    }
  }
  assert(timestampsOrdered, 'LIP.6: Utterance event timestamps are monotonically non-decreasing');

  // Verify event detail payloads
  const startEvent = utteranceEvents[0];
  assert(
    normalizePetKey(startEvent.detail.petId) === normalizePetKey(targetPet),
    `LIP.7: Start event detail.petId matches '${targetPet}' (got: '${startEvent.detail.petId}')`
  );
  assert(
    startEvent.detail.text === testPhrase,
    `LIP.8: Start event detail.text matches clean dialogue (got: '${startEvent.detail.text}')`
  );

  const syllableEvents = utteranceEvents.filter(e => e.type === 'companion-speech-syllable');
  assert(
    syllableEvents.length > 0 && syllableEvents.every(e => normalizePetKey(e.detail.petId) === normalizePetKey(targetPet)),
    `LIP.9: All ${syllableEvents.length} syllable events carry matching petId '${targetPet}'`
  );

  const endEvent = utteranceEvents[utteranceEvents.length - 1];
  assert(
    normalizePetKey(endEvent.detail.petId) === normalizePetKey(targetPet),
    `LIP.10: End event detail.petId matches '${targetPet}' (got: '${endEvent.detail.petId}')`
  );

  // Test 4.2: Rex persona event detail verification (verifying petId normalization with active pet)
  capturedEvents.length = 0;
  await new Promise((resolve) => {
    speakCompanion('Rex roars loud and proud!', 'rex', () => resolve());
  });
  const rexStart = capturedEvents.find(e => e.type === 'companion-speech-start');
  const rexEnd = capturedEvents.findLast(e => e.type === 'companion-speech-end');
  assert(
    normalizePetKey(rexStart.detail.petId) === 'rex',
    `LIP.11: Rex start event resolves to canonical key 'rex' (petId was '${rexStart.detail.petId}')`
  );
  assert(
    normalizePetKey(rexEnd.detail.petId) === 'rex',
    `LIP.12: Rex end event resolves to canonical key 'rex'`
  );

  // Test 4.3: Multi-chunk Bedtime Pipelining Sequence Invariant
  capturedEvents.length = 0;
  const multiChunkText = 'The soft night wind rustles the jungle leaves. Tiny fireflies light up the mossy path. Close your eyes and dream of big adventures.';
  
  await new Promise((resolve) => {
    speakCompanion(
      multiChunkText,
      'bedtime_narrator',
      () => resolve(),
      { voiceStyle: 'bedtime', pipelined: true }
    );
  });

  const bedtimeStartIdx = capturedEvents.findIndex(e => e.type === 'companion-speech-start');
  const bedtimeUtteranceEvents = capturedEvents.slice(bedtimeStartIdx);

  const activeBedtimeStarts = bedtimeUtteranceEvents.filter(e => e.type === 'companion-speech-start');
  const activeBedtimeEnds = bedtimeUtteranceEvents.filter(e => e.type === 'companion-speech-end');
  const activeBedtimeSyllables = bedtimeUtteranceEvents.filter(e => e.type === 'companion-speech-syllable');

  assert(
    activeBedtimeStarts.length === 1,
    `LIP.13: Multi-chunk bedtime speech emits companion-speech-start exactly once at beginning (count: ${activeBedtimeStarts.length})`
  );
  assert(
    activeBedtimeEnds.length === 1,
    `LIP.14: Multi-chunk bedtime speech emits companion-speech-end exactly once at very end (count: ${activeBedtimeEnds.length})`
  );
  assert(
    activeBedtimeSyllables.length >= 3,
    `LIP.15: Syllable events continuously dispatched across chunks (count: ${activeBedtimeSyllables.length})`
  );

  // Test 4.4: Mid-speech Cancellation with stopRex()
  capturedEvents.length = 0;
  speakCompanion('This is an active sentence that will be stopped mid-stride by our challenger harness.', 'stego');
  await sleep(12); // Allow start event to fire
  assert(isRexSpeaking(), 'LIP.16: isRexSpeaking() is true while speech is active');
  
  stopRex();
  await sleep(30);

  assert(!isRexSpeaking(), 'LIP.17: isRexSpeaking() is immediately false after stopRex()');
  assert(store?.state?.liveRex?.isSpeaking === false, 'LIP.18: store.state.liveRex.isSpeaking reset to false');
  
  const eventsAfterStop = capturedEvents.length;
  await sleep(50);
  assert(
    capturedEvents.length === eventsAfterStop,
    'LIP.19: No delayed or orphaned speech events dispatched after stopRex()'
  );

  // Clean up
  globalThis.window.removeEventListener('companion-speech-start', eventCaptureListener);
  globalThis.window.removeEventListener('companion-speech-syllable', eventCaptureListener);
  globalThis.window.removeEventListener('companion-speech-end', eventCaptureListener);

  console.log('\n========================================================================');
  console.log('ADVERSARIAL VERIFICATION SUMMARY');
  console.log('========================================================================');
  console.log(`Total Probes Run: ${totalProbes}`);
  console.log(`Passed Probes:     ${passedProbes}`);
  console.log(`Failed Probes:     ${failedProbes}`);

  if (failedProbes > 0) {
    console.error('\nFAILED PROBE BREAKDOWN:');
    failureDetails.forEach(f => console.error(`  - ${f}`));
    console.error('\nOVERALL VERDICT: FAILED');
    process.exit(1);
  } else {
    console.log('\nOVERALL VERDICT: CONFIRMED');
    console.log('ALL INVARIANTS METRICALLY AND EMPIRICALLY CONFIRMED.');
    process.exit(0);
  }
}

runAdversarialChallenge().catch((err) => {
  console.error('Fatal unhandled error in adversarial test harness:', err);
  process.exit(1);
});
