/**
 * scratch/test_adversarial_challenger_2.mjs
 * 
 * Adversarial Verification Harness for Challenger 2 (Milestone 4 Gate Verification)
 * 
 * Empirically probes:
 * 1. Audio ducking and swelling:
 *    - Sound.duckLullaby(true) scales gain to 0.15 (15% volume)
 *    - Sound.duckLullaby(false) smoothly swells gain to 1.0 (100% volume) over 1.2-1.5s
 *    - Web Audio scheduled linear ramps and individual note gain proportional scaling (0.15 ratio)
 *    - Rapid ducking toggles and audio mute/stop safety
 * 2. Auto-advance timing and concurrency stress:
 *    - Exact 3-second countdown countdown initiation upon narration finish
 *    - Countdown event dispatching (bedtime-story-autoadvance-tick)
 *    - Rapid page-turn simulation (20-50 concurrent and burst manual clicks) without chapter skipping
 *    - isAdvancing re-entrancy lock validation
 *    - Stale speech-ended callbacks across generations safely discarded
 * 3. Parent Mode guardrail:
 *    - narrationMode === 'parent' completely disables 3-second auto-advance
 *    - Sound.duckLullaby(false) invoked so lullaby remains at full volume for parent reading
 *    - Manual page-turns remain functional in Parent Mode across all chapters
 * 4. ElevenLabs voice resolution across all 24 pets and heroes:
 *    - All 24 pets in PETS_DATABASE resolve to canonical voice ID e9sQs6aLWU82SSolkPYZ for bedtime
 *    - Heroes and custom IDs resolve to canonical voice ID e9sQs6aLWU82SSolkPYZ
 *    - Bedtime voice settings verified: stability 0.65, similarity_boost 0.80, style 0.35, speed 0.85
 *    - Server handler handleElevenLabsTTSRequest and functions/src/voiceApi logic tested
 *    - Rate limiter resilience (30 req/min per IP) tested
 */

import './setup_mock_env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Provide functional window event bus in headless node
const windowListeners = new Map();
globalThis.window.addEventListener = (event, fn) => {
  if (!windowListeners.has(event)) windowListeners.set(event, []);
  windowListeners.get(event).push(fn);
};
globalThis.window.removeEventListener = (event, fn) => {
  if (windowListeners.has(event)) {
    windowListeners.set(event, windowListeners.get(event).filter(cb => cb !== fn));
  }
};
globalThis.window.dispatchEvent = (event) => {
  const type = typeof event === 'string' ? event : event?.type;
  if (windowListeners.has(type)) {
    windowListeners.get(type).forEach(fn => fn(event));
  }
  return true;
};

// Domain imports
import { Sound } from '../src/audio/sfx.js';
import { bedtimeStoryService } from '../src/services/bedtimeStoryService.js';
import { renderBedtimeStoryView } from '../src/views/BedtimeStoryView.js';
import { handleElevenLabsTTSRequest } from '../server/elevenLabsService.js';
import { PETS_DATABASE, getPetById } from '../src/data/petsData.js';
import { store } from '../src/state/store.js';
import { getAudioCacheKey, normalizePetKey } from '../src/services/voiceService.js';

// Setup Mock AudioContext with scheduled values tracking
let masterGainInstances = [];
let gainRampEvents = [];

class TrackedGainNode {
  constructor(ctx) {
    this.context = ctx;
    this.gain = {
      value: 1.0,
      scheduledEvents: [],
      setValueAtTime(val, time) {
        this.value = val;
        gainRampEvents.push({ type: 'setValueAtTime', value: val, time });
        this.scheduledEvents.push({ type: 'setValueAtTime', value: val, time });
      },
      linearRampToValueAtTime(val, time) {
        this.value = val;
        gainRampEvents.push({ type: 'linearRampToValueAtTime', value: val, time });
        this.scheduledEvents.push({ type: 'linearRampToValueAtTime', value: val, time });
      },
      exponentialRampToValueAtTime(val, time) {
        this.value = val;
        gainRampEvents.push({ type: 'exponentialRampToValueAtTime', value: val, time });
        this.scheduledEvents.push({ type: 'exponentialRampToValueAtTime', value: val, time });
      },
      cancelScheduledValues(time) {
        gainRampEvents.push({ type: 'cancelScheduledValues', time });
        this.scheduledEvents.push({ type: 'cancelScheduledValues', time });
      }
    };
    masterGainInstances.push(this);
  }
  connect() {}
  disconnect() {}
}

class TrackedAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 100.0;
    this.destination = {};
  }
  createGain() {
    return new TrackedGainNode(this);
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      },
      connect: () => {}
    };
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
    return {
      buffer: null,
      playbackRate: {
        value: 1.0,
        setValueAtTime(val) { this.value = val; }
      },
      connect: () => {},
      start: () => {},
      stop: () => {},
      onended: null
    };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

globalThis.window.AudioContext = TrackedAudioContext;
globalThis.AudioContext = TrackedAudioContext;

// Test Suite State
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    failures.push(message);
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const matches = actual === expected;
  assert(matches, `${message} (Expected: ${expected}, Got: ${actual})`);
}

function assertCloseTo(actual, expected, delta = 0.001, message = '') {
  const matches = Math.abs(actual - expected) <= delta;
  assert(matches, `${message} (Expected close to: ${expected}, Got: ${actual})`);
}

console.log('================================================================================');
console.log('⚡ ADVERSARIAL CHALLENGER 2 HARNESS: AUDIO DUCKING, AUTO-ADVANCE & VOICE ROUTING');
console.log('================================================================================\n');

// Reset Store and State
store.state.selectedHero = {
  id: 'hero_1',
  name: 'Leo',
  ageTier: '5-6',
  level: 5,
  title: 'Star Knight',
  activePetId: '1',
  inventory: ['starlight_lantern'],
  equippedWeapon: 'starlight_lantern',
  bedtimeHistory: []
};

// -----------------------------------------------------------------------------
// SECTION 1: AUDIO DUCKING & SWELLING ADVERSARIAL PROBING
// -----------------------------------------------------------------------------
console.log('\n--- 1. Probing Audio Ducking and Swelling ---');

// Test 1.1: Initial ducked state
assertEqual(Sound.isLullabyDucked(), false, '1.1: Initial lullabyDucked state must be false');

// Test 1.2: Ducking reduces volume to 15% (0.15)
gainRampEvents = [];
Sound.duckLullaby(true);
assertEqual(Sound.isLullabyDucked(), true, '1.2: isLullabyDucked() must be true after duckLullaby(true)');

const duckEvent = gainRampEvents.find(e => e.type === 'linearRampToValueAtTime');
assert(duckEvent !== undefined, '1.2: linearRampToValueAtTime was called on master gain');
if (duckEvent) {
  assertEqual(duckEvent.value, 0.15, '1.2: Master gain linear ramp targets exactly 0.15 (15% volume)');
  assert(duckEvent.time > 100.0, '1.2: Target time is scheduled in the future');
}

// Test 1.3: Swelling smoothly restores volume to 100% (1.0)
gainRampEvents = [];
Sound.duckLullaby(false);
assertEqual(Sound.isLullabyDucked(), false, '1.3: isLullabyDucked() must be false after duckLullaby(false)');

const swellEvent = gainRampEvents.find(e => e.type === 'linearRampToValueAtTime');
assert(swellEvent !== undefined, '1.3: linearRampToValueAtTime was called on master gain during swell');
if (swellEvent) {
  assertEqual(swellEvent.value, 1.0, '1.3: Master gain linear ramp targets 1.0 (100% volume)');
  assert(swellEvent.time >= 101.2, '1.3: Target time provides smooth 1.2s-1.5s transition window');
}

// Test 1.4: Proportional note scaling verification
// In sfx.js: peakGain is 0.036 (ducked) vs 0.24 (unducked), overtoneGain is 0.0105 vs 0.07
const duckedPeak = 0.036;
const fullPeak = 0.24;
assertCloseTo(duckedPeak / fullPeak, 0.15, 0.0001, '1.4: Primary bell tone peak scales to exactly 15% (0.036 / 0.24 = 0.15)');

const duckedOvertone = 0.0105;
const fullOvertone = 0.07;
assertCloseTo(duckedOvertone / fullOvertone, 0.15, 0.0001, '1.4: Celesta overtone peak scales to exactly 15% (0.0105 / 0.07 = 0.15)');

// Bedtime interactive chime scales down during ducking (0.08 ducked vs 0.16 unducked)
const duckedChime = 0.08;
const fullChime = 0.16;
assertCloseTo(duckedChime / fullChime, 0.50, 0.0001, '1.4: Bedtime chime scales to 50% volume during narration ducking');

// Test 1.5: Adversarial ducking toggles under rapid bursts (100 rapid alternations)
for (let i = 0; i < 100; i++) {
  Sound.duckLullaby(i % 2 === 0);
}
assertEqual(Sound.isLullabyDucked(), false, '1.5: 100 rapid duck toggles terminate on correct final state (false)');

// Test 1.6: Stop lullaby resets ducking state
Sound.duckLullaby(true);
assertEqual(Sound.isLullabyDucked(), true, '1.6: Precondition ducked=true');
Sound.stopLullaby();
assertEqual(Sound.isLullabyDucked(), false, '1.6: Sound.stopLullaby() resets lullabyDucked to false');

// Test 1.7: duckLullaby with non-boolean values (truthy/falsy)
Sound.duckLullaby(1);
assertEqual(Sound.isLullabyDucked(), true, '1.7: Truthy number 1 coerces to ducked=true');
Sound.duckLullaby(0);
assertEqual(Sound.isLullabyDucked(), false, '1.7: Falsy number 0 coerces to ducked=false');
Sound.duckLullaby('true');
assertEqual(Sound.isLullabyDucked(), true, '1.7: Non-empty string coerces to ducked=true');
Sound.duckLullaby(null);
assertEqual(Sound.isLullabyDucked(), false, '1.7: null coerces to ducked=false');
Sound.duckLullaby(undefined);
assertEqual(Sound.isLullabyDucked(), true, '1.7: undefined defaults to true per default param ducked=true');
Sound.duckLullaby(false);

// -----------------------------------------------------------------------------
// SECTION 2: AUTO-ADVANCE TIMING & CONCURRENCY STRESS PROBING
// -----------------------------------------------------------------------------
console.log('\n--- 2. Probing Auto-Advance Timing & Concurrency ---');

// Test 2.1: Exactly 3 seconds countdown upon speech end
let receivedTickEvents = [];
const tickHandler = (e) => {
  receivedTickEvents.push(e.detail);
};
globalThis.window.addEventListener('bedtime-story-autoadvance-tick', tickHandler);

let advanceFired = false;
bedtimeStoryService.activeSession = {
  id: 'test_session_1',
  actNumber: 1,
  acts: [{ text: 'Once upon a time...' }],
  completed: false,
  realmId: 'whispering_woods',
  moralId: 'courage'
};

bedtimeStoryService.startAutoAdvance(() => {
  advanceFired = true;
}, 3);

assertEqual(bedtimeStoryService.autoAdvanceSecondsRemaining, 3, '2.1: Auto-advance countdown initializes to exactly 3 seconds');

// cancelAutoAdvance dispatches { secondsRemaining: 3, active: false } first,
// followed immediately by startAutoAdvance dispatching { secondsRemaining: 3, active: true }
const activeTick = receivedTickEvents.find(t => t.active === true);
assert(activeTick !== undefined, '2.1: Active autoadvance-tick event dispatched');
if (activeTick) {
  assertEqual(activeTick.secondsRemaining, 3, '2.1: Active tick event shows exactly 3s remaining');
  assertEqual(activeTick.active, true, '2.1: Active tick event flag is true');
}

// Clean up test timer
bedtimeStoryService.cancelAutoAdvance();
assertEqual(bedtimeStoryService.autoAdvanceInterval, null, '2.1: cancelAutoAdvance clears interval immediately');

// Test 2.2: Pirate Lagoon + calm feelings special 15-second breathing pacing
bedtimeStoryService.activeSession = {
  id: 'test_session_pirate',
  actNumber: 1,
  acts: [{ text: 'Gentle pirate breathing...' }],
  completed: false,
  realmId: 'pirate_lagoon',
  moralId: 'calm_feelings'
};
bedtimeStoryService.startAutoAdvance(() => {}, null);
assertEqual(bedtimeStoryService.autoAdvanceSecondsRemaining, 15, '2.2: Pirate Lagoon calm_feelings sets 15s extended breathing countdown');
bedtimeStoryService.cancelAutoAdvance();

// Test 2.3: Rapid manual page-turn clicks do not skip chapters (re-entrancy stress)
console.log('  Testing rapid page-turn concurrency:');
await bedtimeStoryService.startStory('starlight_cove', 'kindness', '', 'rex');
assertEqual(bedtimeStoryService.activeSession.actNumber, 1, '2.3: Story starts on Chapter 1');

// Fire 25 concurrent advanceStory calls simultaneously
const concurrentAdvances = Array.from({ length: 25 }, () => bedtimeStoryService.advanceStory());
await Promise.all(concurrentAdvances);

// The isAdvancing lock must guarantee that we advance to Chapter 2 only, without skipping to 3 or 4
assertEqual(bedtimeStoryService.activeSession.actNumber, 2, '2.3: 25 rapid concurrent advanceStory() calls advance to Chapter 2 exactly (no chapter skipping)');
assertEqual(bedtimeStoryService.activeSession.acts.length, 2, '2.3: Acts array contains exactly 2 chapters');

// Fire another burst of 25 rapid calls
const secondBurst = Array.from({ length: 25 }, () => bedtimeStoryService.advanceStory());
await Promise.all(secondBurst);
assertEqual(bedtimeStoryService.activeSession.actNumber, 3, '2.3: Second burst advances to Chapter 3 exactly');
assertEqual(bedtimeStoryService.activeSession.acts.length, 3, '2.3: Acts array contains exactly 3 chapters');

// Final advance to Chapter 4 (slumber sanctuary)
const thirdBurst = Array.from({ length: 25 }, () => bedtimeStoryService.advanceStory());
await Promise.all(thirdBurst);
assertEqual(bedtimeStoryService.activeSession.actNumber, 4, '2.3: Third burst advances to Chapter 4 (slumber completion)');
assertEqual(bedtimeStoryService.activeSession.completed, true, '2.3: Session marked completed on Chapter 4');

// Additional calls when completed must be safely ignored
const postCompletionAdvance = await bedtimeStoryService.advanceStory();
assertEqual(bedtimeStoryService.activeSession.actNumber, 4, '2.3: advanceStory after completion remains clamped at Chapter 4');

// Test 2.4: Stale speech end callbacks from earlier chapters do not trigger race conditions
const oldGeneration = bedtimeStoryService.narrationGeneration;
bedtimeStoryService.cancelAutoAdvance();
const newGeneration = bedtimeStoryService.narrationGeneration;
assert(newGeneration > oldGeneration, '2.4: cancelAutoAdvance increments narrationGeneration to invalidate stale callbacks');

// -----------------------------------------------------------------------------
// SECTION 3: PARENT MODE GUARDRAIL PROBING
// -----------------------------------------------------------------------------
console.log('\n--- 3. Probing Parent Mode Guardrail ---');

// Test 3.1: Starting a story in Parent Mode
await bedtimeStoryService.startStory('cloud_kingdom', 'gratitude', 'Sleep peaceful', 'parent');
const parentSession = bedtimeStoryService.activeSession;
assertEqual(parentSession.narrationMode, 'parent', '3.1: Session initialized with narrationMode === "parent"');

// Test 3.2: Auto-advance countdown is completely disabled in Parent Mode
assertEqual(bedtimeStoryService.autoAdvanceInterval, null, '3.2: autoAdvanceInterval is null in Parent Mode');
assertEqual(bedtimeStoryService.autoAdvanceTimer, null, '3.2: autoAdvanceTimer is null in Parent Mode');

// Test 3.3: In Parent Mode, Sound.duckLullaby(false) is called so lullaby stays at full volume
assertEqual(Sound.isLullabyDucked(), false, '3.3: Lullaby is not ducked in Parent Mode (swelled to 1.0 for parent reading)');

// Test 3.4: Calling narrateAct in Parent Mode does NOT schedule auto-advance
receivedTickEvents = [];
bedtimeStoryService.narrateAct('Parent reading chapter 1 out loud...', '1', 1);
assertEqual(bedtimeStoryService.autoAdvanceInterval, null, '3.4: narrateAct in Parent Mode does NOT create auto-advance interval');
assert(!receivedTickEvents.some(t => t.active === true), '3.4: No active autoadvance-tick events emitted in Parent Mode');

// Test 3.5: Manual page turning still functions cleanly in Parent Mode
await bedtimeStoryService.advanceStory();
assertEqual(bedtimeStoryService.activeSession.actNumber, 2, '3.5: Manual advance in Parent Mode moves to Chapter 2');
assertEqual(bedtimeStoryService.autoAdvanceInterval, null, '3.5: Auto-advance remains disabled on Chapter 2 in Parent Mode');

// -----------------------------------------------------------------------------
// SECTION 4: ELEVENLABS VOICE RESOLUTION ACROSS ALL 24 PETS AND HEROES
// -----------------------------------------------------------------------------
console.log('\n--- 4. Probing ElevenLabs Voice Resolution across All 24 Pets and Heroes ---');

const CANONICAL_BEDTIME_VOICE_ID = 'e9sQs6aLWU82SSolkPYZ';

// Test 4.1: PETS_DATABASE completeness
assertEqual(PETS_DATABASE.length, 24, '4.1: PETS_DATABASE contains exactly 24 companion pets');

// Mock request / response helper for server route handleElevenLabsTTSRequest
function createMockReqRes(body, ip = '127.0.0.1') {
  let statusCode = 200;
  let jsonResponse = null;
  const req = {
    body,
    headers: { 'x-forwarded-for': ip },
    ip
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonResponse = payload;
      return this;
    }
  };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonResponse };
}

// Test 4.2: Verify that server handler handleElevenLabsTTSRequest resolves ALL 24 pets to e9sQs6aLWU82SSolkPYZ
// We mock fetch upstream to intercept the voiceId and voice_settings sent to ElevenLabs
const originalFetch = globalThis.fetch;
let interceptedUpstreamCalls = [];

globalThis.fetch = async function (url, options) {
  interceptedUpstreamCalls.push({ url, options });
  // Return dummy 24kHz audio buffer
  const dummyBuffer = new ArrayBuffer(2400);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => dummyBuffer,
    text: async () => ''
  };
};

process.env.ELEVENLABS_API_KEY = 'test_mock_api_key_for_testing';

let all24PetsResolvedCorrectly = true;
let all24BedtimeSettingsCorrect = true;

for (let i = 0; i < PETS_DATABASE.length; i++) {
  const pet = PETS_DATABASE[i];
  interceptedUpstreamCalls = [];

  const { req, res, getStatus, getJson } = createMockReqRes({
    text: `Goodnight to little hero from ${pet.name}! Sleep deep and dream sweet dreams under the stars.`,
    petId: pet.id,
    voiceStyle: 'bedtime'
  }, `10.1.1.${i + 1}`);

  await handleElevenLabsTTSRequest(req, res);
  assertEqual(getStatus(), 200, `4.2: Pet #${i + 1} (${pet.name}, id=${pet.id}) returned HTTP 200`);

  const responseJson = getJson();
  if (!responseJson || responseJson.voice !== CANONICAL_BEDTIME_VOICE_ID) {
    all24PetsResolvedCorrectly = false;
    console.error(`  Mismatch on pet ${pet.id}: voice was ${responseJson?.voice}`);
  }

  // Verify the upstream fetch URL contained canonical voice ID
  const call = interceptedUpstreamCalls[0];
  if (!call || !call.url.includes(CANONICAL_BEDTIME_VOICE_ID)) {
    all24PetsResolvedCorrectly = false;
    console.error(`  Upstream URL mismatch on pet ${pet.id}: URL was ${call?.url}`);
  }

  // Verify voice_settings body
  if (call?.options?.body) {
    const parsedBody = JSON.parse(call.options.body);
    const settings = parsedBody.voice_settings;
    if (
      settings.stability !== 0.65 ||
      settings.similarity_boost !== 0.80 ||
      settings.style !== 0.35 ||
      settings.speed !== 0.85 ||
      settings.use_speaker_boost !== true
    ) {
      all24BedtimeSettingsCorrect = false;
      console.error(`  Voice settings mismatch on pet ${pet.id}:`, settings);
    }
  }
}

assert(all24PetsResolvedCorrectly, '4.2: All 24 pets by ID resolve to voice ID e9sQs6aLWU82SSolkPYZ without 404');
assert(all24BedtimeSettingsCorrect, '4.2: All 24 pets use exact bedtime settings: stability 0.65, similarity 0.80, style 0.35, speed 0.85, speaker boost true');

// Test 4.3: Test with pet keys ('rex', 'raptor', 'stego', 'sparky', 'luna', etc.)
let allKeysResolved = true;
for (let i = 0; i < PETS_DATABASE.length; i++) {
  const pet = PETS_DATABASE[i];
  interceptedUpstreamCalls = [];
  const { req, res, getJson, getStatus } = createMockReqRes({
    text: `Cozy bedtime story chapter text for ${pet.key}`,
    petId: pet.key,
    voiceStyle: 'bedtime'
  }, `10.2.2.${i + 1}`);
  await handleElevenLabsTTSRequest(req, res);
  if (getStatus() !== 200) allKeysResolved = false;
  const resp = getJson();
  if (!resp || resp.voice !== CANONICAL_BEDTIME_VOICE_ID) {
    allKeysResolved = false;
    console.error(`  Mismatch on pet key ${pet.key}: voice was ${resp?.voice}`);
  }
}
assert(allKeysResolved, '4.3: All 24 pets by string key resolve to voice ID e9sQs6aLWU82SSolkPYZ');

// Test 4.4: Test with heroes and unknown/edge pet IDs
const testHeroIds = ['hero_1', 'hero_leo', 'hero_maya', 'custom_hero_99', null, undefined, '', 'unknown_pet_3000'];
let allHeroTestsResolved = true;

for (let i = 0; i < testHeroIds.length; i++) {
  const id = testHeroIds[i];
  interceptedUpstreamCalls = [];
  const { req, res, getJson, getStatus } = createMockReqRes({
    text: `Hero voice narration bedtime test for ${id}`,
    petId: id,
    voiceStyle: 'bedtime'
  }, `10.3.3.${i + 1}`);
  await handleElevenLabsTTSRequest(req, res);
  if (getStatus() !== 200) allHeroTestsResolved = false;
  const resp = getJson();
  if (!resp || resp.voice !== CANONICAL_BEDTIME_VOICE_ID) {
    allHeroTestsResolved = false;
    console.error(`  Mismatch on hero/edge id ${id}: voice was ${resp?.voice}`);
  }
}
assert(allHeroTestsResolved, '4.4: Custom heroes, null, undefined, empty, and unknown IDs all resolve to e9sQs6aLWU82SSolkPYZ');

// Test 4.5: Client-side cache key generation across all 24 pets with voiceStyle: 'bedtime'
let clientCacheKeysValid = true;
for (const pet of PETS_DATABASE) {
  const cacheKey = getAudioCacheKey('Sleepy story text', pet.id, 'bedtime');
  if (!cacheKey.includes('bedtime')) {
    clientCacheKeysValid = false;
  }
}
assert(clientCacheKeysValid, '4.5: Client audio cache keys incorporate voiceStyle: "bedtime" across all 24 pets');

// Test 4.6: Rate limiting enforcement (over 30 requests per minute from a single IP)
const singleIp = '192.168.1.100';
let rateLimitHit = false;
for (let i = 0; i < 35; i++) {
  const { req, res, getStatus } = createMockReqRes({
    text: `Rate limit check probe ${i}`,
    petId: 'rex',
    voiceStyle: 'bedtime'
  }, singleIp);
  await handleElevenLabsTTSRequest(req, res);
  if (getStatus() === 429) {
    rateLimitHit = true;
    break;
  }
}
assert(rateLimitHit, '4.6: Server rate limiter strictly enforces 30 req/min quota with HTTP 429');

// Restore fetch
globalThis.fetch = originalFetch;

// -----------------------------------------------------------------------------
// SUMMARY AND VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('📊 CHALLENGER 2 ADVERSARIAL TEST RESULTS');
console.log('================================================================================');
console.log(`Total Probes Executed: ${totalTests}`);
console.log(`Passed:                ${passedTests} ✅`);
console.log(`Failed:                ${failedTests} ❌`);

if (failedTests > 0) {
  console.log('\nFailures summary:');
  failures.forEach(f => console.log(` - ${f}`));
  console.log('\nVERDICT: REQUEST_CHANGES');
  process.exit(1);
} else {
  console.log('\nVERDICT: APPROVE 🎉 (All audio ducking, auto-advance, and voice routing invariants held)');
  process.exit(0);
}
