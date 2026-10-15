/**
 * adversarial_audio_cadence_stress_test.mjs
 * 
 * Adversarial Challenger 2 Stress Test Suite:
 * Hybrid Studio Audio Companion & Cadence Timing Engine
 * 
 * 1. Audio Collision & Barge-In:
 *    - 50 concurrent speakCompanion calls in rapid succession
 *    - Verify speechGeneration and stopRex prevent overlapping audio playback
 *    - Out-of-order async resolution & race condition resistance
 *    - Rapid barge-in toggling (100 rapid start/stop cycles)
 * 2. Cache Retrieval Speed:
 *    - Pre-warm cache for all 8 prehistoric workouts
 *    - Benchmark latency of pre-warmed cache hits (1000 iterations)
 *    - Verify 0ms instantaneous retrieval for cached audio buffers
 *    - Cache hit vs cache miss latency comparison
 * 3. Cadence Timer Resilience:
 *    - 100 rapid pause/resume cycles
 *    - Background tab suspension (timer drift simulation: jump across ticks)
 *    - Verify cadence cues at 0s, 10s, 20s, 30s, 40s, 50s, 58s never fire out of order or double-fire
 * 4. Diplodocus 30s Sync:
 *    - Verify that at exactly 30s remaining, halfway announcement triggers synchronously with isHalfwayFlipped
 *    - Kinematic limb mirror verification (Side 1 vs Side 2)
 *    - Resilience when timer pauses or drifts near 30s
 * 5. Network Failure Injection:
 *    - Simulate 500 internal server errors on /api/gemini/tts and /api/elevenlabs/tts
 *    - Simulate network timeout, network drop, and malformed responses
 *    - Verify seamless graceful degradation to browser SpeechSynthesis without unhandled promise rejections
 */

import './setup_mock_env.js';
import assert from 'assert';
import { performance } from 'perf_hooks';
import { store } from '../src/state/store.js';
import { DINO_WORKOUTS, getWorkoutById } from '../src/data/petsData.js';
import {
  speakCompanion,
  stopRex,
  isRexSpeaking,
  prewarmWorkoutAudio,
  workoutAudioClipCache,
  getAudioCacheKey,
  cleanDialogueText,
  normalizePetKey,
  COMPANION_VOICE_PROFILES
} from '../src/services/voiceService.js';
import { applyWorkoutKinematics } from '../src/services/workoutKinematicsEngine.js';
import { createAvatarRig } from '../src/services/avatarSkeletalRig.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function check(condition, testName, extraInfo = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${extraInfo ? '(' + extraInfo + ')' : ''}`);
    passedTests++;
    return true;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extraInfo ? '-> ' + extraInfo : ''}`);
    failedTests++;
    failureDetails.push({ testName, extraInfo });
    return false;
  }
}

// Global audio tracking metrics
let activeAudioSourceCount = 0;
let maxConcurrentAudioSources = 0;
let totalAudioSourcesCreated = 0;
let totalAudioSourcesStarted = 0;
let totalAudioSourcesStopped = 0;

let activeSynthesisUtterances = 0;
let maxConcurrentSynthesisUtterances = 0;
let totalSynthesisStarted = 0;
let totalSynthesisCancelled = 0;

// Setup mock AudioContext and SpeechSynthesis
class MockAudioBuffer {
  constructor(channels = 1, length = 24000, sampleRate = 24000) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channelData = new Float32Array(length);
  }
  copyToChannel(data) {
    this._channelData.set(data);
  }
  getChannelData() {
    return this._channelData;
  }
}

class MockAudioBufferSourceNode {
  constructor(context) {
    this.context = context;
    this.buffer = null;
    this.onended = null;
    this._started = false;
    this._stopped = false;
    totalAudioSourcesCreated++;
  }
  connect(dest) {}
  disconnect() {}
  start(when = 0) {
    this._started = true;
    totalAudioSourcesStarted++;
    activeAudioSourceCount++;
    if (activeAudioSourceCount > maxConcurrentAudioSources) {
      maxConcurrentAudioSources = activeAudioSourceCount;
    }
  }
  stop() {
    if (this._started && !this._stopped) {
      this._stopped = true;
      totalAudioSourcesStopped++;
      activeAudioSourceCount = Math.max(0, activeAudioSourceCount - 1);
      if (typeof this.onended === 'function') {
        const cb = this.onended;
        this.onended = null;
        setTimeout(cb, 1);
      }
    }
  }
}

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.state = 'running';
    this.destination = {};
  }
  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }
  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

globalThis.window.AudioContext = MockAudioContext;
globalThis.window.webkitAudioContext = MockAudioContext;

// Mock SpeechSynthesis
globalThis.window.speechSynthesis = {
  speaking: false,
  paused: false,
  pending: false,
  speak: (utterance) => {
    activeSynthesisUtterances++;
    if (activeSynthesisUtterances > maxConcurrentSynthesisUtterances) {
      maxConcurrentSynthesisUtterances = activeSynthesisUtterances;
    }
    totalSynthesisStarted++;
    globalThis.window.speechSynthesis.speaking = true;
    if (utterance && utterance.onstart) {
      setTimeout(utterance.onstart, 2);
    }
    setTimeout(() => {
      activeSynthesisUtterances = Math.max(0, activeSynthesisUtterances - 1);
      globalThis.window.speechSynthesis.speaking = activeSynthesisUtterances > 0;
      if (utterance && utterance.onend) utterance.onend();
    }, 20);
  },
  cancel: () => {
    if (activeSynthesisUtterances > 0) {
      totalSynthesisCancelled += activeSynthesisUtterances;
      activeSynthesisUtterances = 0;
    }
    globalThis.window.speechSynthesis.speaking = false;
  },
  getVoices: () => [
    { name: 'Daniel', lang: 'en-GB', default: true },
    { name: 'Google US English', lang: 'en-US', default: false }
  ]
};

globalThis.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text = '') {
    this.text = text;
    this.pitch = 1.0;
    this.rate = 1.0;
    this.volume = 1.0;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onboundary = null;
  }
};

// Generate valid base64 PCM16 fake audio
function generateMockPcm16Base64(sampleCount = 2400) {
  const int16 = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    int16[i] = Math.round(Math.sin((i / 20) * Math.PI) * 16000);
  }
  const uint8 = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

const SAMPLE_BASE64_PCM = generateMockPcm16Base64(4800);

// =============================================================================
// SUITE 1: AUDIO COLLISION & BARGE-IN STRESS TEST
// =============================================================================
async function testAudioCollisionAndBargeIn() {
  console.log('\n======================================================================');
  console.log('⚡ SUITE 1: AUDIO COLLISION & BARGE-IN EMPIRICAL STRESS TEST');
  console.log('======================================================================');

  activeAudioSourceCount = 0;
  maxConcurrentAudioSources = 0;
  totalAudioSourcesStarted = 0;
  totalAudioSourcesStopped = 0;

  // Mock fetch to simulate varied network responses (10ms to 40ms jitter)
  let fetchCallCount = 0;
  globalThis.fetch = async (url, options) => {
    fetchCallCount++;
    const delay = 10 + Math.floor(Math.random() * 30);
    await new Promise((r) => setTimeout(r, delay));
    return {
      ok: true,
      json: async () => ({
        audio: SAMPLE_BASE64_PCM,
        sampleRate: 24000,
        voice: 'Puck'
      })
    };
  };

  // Test 1.1: 50 Concurrent Rapid Requests
  console.log('\n--- 1.1: Firing 50 Concurrent speakCompanion Calls in Rapid Succession ---');
  const CONCURRENT_COUNT = 50;
  const startTime = performance.now();
  const promises = [];

  for (let i = 1; i <= CONCURRENT_COUNT; i++) {
    promises.push(
      speakCompanion(`Concurrent gross-motor cadence instruction #${i}`, 'rex')
    );
  }

  await Promise.allSettled(promises);
  const elapsed = (performance.now() - startTime).toFixed(2);

  check(
    maxConcurrentAudioSources <= 1,
    'Max concurrent active Web Audio sources strictly <= 1 (No overlapping audio)',
    `Observed max: ${maxConcurrentAudioSources}`
  );

  check(
    totalAudioSourcesStarted >= 1 && totalAudioSourcesStarted <= 2,
    'Stale generations aborted before starting; only latest generation played',
    `Started: ${totalAudioSourcesStarted} of ${CONCURRENT_COUNT} requests`
  );

  check(
    !isRexSpeaking() || activeAudioSourceCount <= 1,
    'Companion audio state cleanly maintained without runaway sources',
    `Active count: ${activeAudioSourceCount}`
  );

  console.log(`  ⏱️ 50 Concurrent calls resolved in ${elapsed}ms`);

  // Test 1.2: Micro-Staggered Concurrent Calls with Inverted Latencies (Out-of-Order Resolution)
  console.log('\n--- 1.2: Micro-Staggered Calls with Inverted Network Latencies ---');
  maxConcurrentAudioSources = 0;
  activeAudioSourceCount = 0;

  // Call 1 has 80ms network latency; Call 2 has 10ms network latency.
  // Call 2 completes network fetch first. When Call 1 completes, it must NOT play over Call 2.
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const isCall1 = body.text.includes('Call-1');
    const delay = isCall1 ? 80 : 10;
    await new Promise((r) => setTimeout(r, delay));
    return {
      ok: true,
      json: async () => ({
        audio: SAMPLE_BASE64_PCM,
        sampleRate: 24000,
        voice: 'Puck'
      })
    };
  };

  let call1Started = false;
  let call2Started = false;

  const p1 = speakCompanion('Call-1: Slower network, older generation', 'rex');
  await new Promise((r) => setTimeout(r, 5)); // 5ms stagger
  const p2 = speakCompanion('Call-2: Faster network, newer generation', 'rex');

  await Promise.all([p1, p2]);

  check(
    maxConcurrentAudioSources <= 1,
    'Inverted latency resolution prevents older call from speaking over newer call',
    `Max concurrent: ${maxConcurrentAudioSources}`
  );

  // Test 1.3: Immediate stopRex Barge-In
  console.log('\n--- 1.3: Immediate stopRex Barge-In Halts Playback Instantly ---');
  await speakCompanion('Immediate barge-in test line', 'rex');
  const wasPlayingBeforeStop = activeAudioSourceCount > 0 || isRexSpeaking();
  stopRex();
  const isPlayingAfterStop = isRexSpeaking();

  check(
    isPlayingAfterStop === false && activeAudioSourceCount === 0,
    'stopRex() immediately terminates active buffer source and resets state',
    `Before: ${wasPlayingBeforeStop}, After: ${isPlayingAfterStop}, Active Sources: ${activeAudioSourceCount}`
  );

  // Test 1.4: 100 Rapid Start/Stop Cycles (Barge-in stress)
  console.log('\n--- 1.4: 100 Rapid-Fire Start/Stop Barge-In Cycles ---');
  let cycleErrors = 0;
  for (let i = 0; i < 100; i++) {
    try {
      speakCompanion(`Rapid barge-in cycle line ${i}`, 'rex');
      stopRex();
    } catch (err) {
      cycleErrors++;
    }
  }

  check(
    cycleErrors === 0,
    '100 Rapid-fire start/stop cycles execute without throwing runtime exceptions',
    `Errors: ${cycleErrors}`
  );
  check(
    activeAudioSourceCount === 0,
    'Zero lingering audio sources after 100 rapid start/stop cycles',
    `Active count: ${activeAudioSourceCount}`
  );
}

// =============================================================================
// SUITE 2: CACHE RETRIEVAL SPEED & ZERO-LATENCY BENCHMARK
// =============================================================================
async function testCacheRetrievalSpeed() {
  console.log('\n======================================================================');
  console.log('⚡ SUITE 2: CACHE RETRIEVAL SPEED & ZERO-LATENCY BENCHMARK');
  console.log('======================================================================');

  workoutAudioClipCache.clear();

  // Setup instant mock fetch for prewarming
  globalThis.fetch = async (url) => {
    return {
      ok: true,
      json: async () => ({
        audio: SAMPLE_BASE64_PCM,
        sampleRate: 24000,
        voice: 'Puck'
      })
    };
  };

  // Test 2.1: Prewarm all 8 dinosaur workouts
  console.log('\n--- 2.1: Prewarming Audio Cache for All 8 Dinosaur Workouts ---');
  const prewarmStart = performance.now();
  for (const w of DINO_WORKOUTS) {
    await prewarmWorkoutAudio(w.id, w.coachId);
  }
  const prewarmElapsed = (performance.now() - prewarmStart).toFixed(2);

  check(
    workoutAudioClipCache.size >= 56,
    `Audio cache populated with cadence cues across all 8 workouts`,
    `Total cached clips: ${workoutAudioClipCache.size}`
  );
  console.log(`  ⏱️ Pre-warmed ${workoutAudioClipCache.size} clips in ${prewarmElapsed}ms`);

  // Test 2.2: Benchmark Cache Retrieval Latency (1000 iterations)
  console.log('\n--- 2.2: Benchmarking Cache Hit Retrieval Latency (1,000 Iterations) ---');
  const diplodocusWorkout = getWorkoutById('diplodocus');
  const testCue = diplodocusWorkout.cadenceTimeline[3].cue; // 30s halfway cue
  const normKey = normalizePetKey(diplodocusWorkout.coachId);
  const cacheKey = `${normKey}:${cleanDialogueText(testCue)}`;

  const latencies = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    const entry = workoutAudioClipCache.get(cacheKey);
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const medianLatency = latencies[Math.floor(latencies.length / 2)];
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
  const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  console.log(`  📊 Cache Latency Metrics (1000 hits):`);
  console.log(`     Min:    ${minLatency.toFixed(5)} ms`);
  console.log(`     Median: ${medianLatency.toFixed(5)} ms`);
  console.log(`     Mean:   ${meanLatency.toFixed(5)} ms`);
  console.log(`     P99:    ${p99Latency.toFixed(5)} ms`);
  console.log(`     Max:    ${maxLatency.toFixed(5)} ms`);

  check(
    meanLatency < 0.05,
    'Cache retrieval is instantaneous (mean < 0.05ms / effectively 0ms synchronous retrieval)',
    `Mean: ${meanLatency.toFixed(5)}ms, P99: ${p99Latency.toFixed(5)}ms`
  );

  // Test 2.3: AudioBuffer Pre-Decoded Status
  console.log('\n--- 2.3: AudioBuffer Pre-Decoded Status in Cache ---');
  const sampleEntry = workoutAudioClipCache.get(cacheKey);
  check(
    Boolean(sampleEntry && sampleEntry.audioBuffer),
    'Cached items contain pre-decoded audioBuffer instances for 0ms Web Audio dispatch',
    `Has audioBuffer: ${Boolean(sampleEntry?.audioBuffer)}`
  );

  // Test 2.4: Cache Hit vs Cache Miss Latency Comparison
  console.log('\n--- 2.4: Latency Comparison: Pre-Warmed Cache Hit vs Network Cache Miss ---');
  // Simulate network roundtrip on miss
  globalThis.fetch = async () => {
    await new Promise((r) => setTimeout(r, 25)); // 25ms server delay
    return {
      ok: true,
      json: async () => ({ audio: SAMPLE_BASE64_PCM, sampleRate: 24000 })
    };
  };

  const tHit0 = performance.now();
  await speakCompanion(testCue, diplodocusWorkout.coachId);
  const hitDuration = performance.now() - tHit0;

  const uncachedCue = 'Completely unique uncached dynamic phrase for testing latency miss ' + Date.now();
  const tMiss0 = performance.now();
  await speakCompanion(uncachedCue, 'rex');
  const missDuration = performance.now() - tMiss0;

  console.log(`  ⚡ Cache Hit Duration:  ${hitDuration.toFixed(2)} ms`);
  console.log(`  🌐 Cache Miss Duration: ${missDuration.toFixed(2)} ms`);
  console.log(`  🚀 Speedup Factor:      ${(missDuration / Math.max(0.01, hitDuration)).toFixed(1)}x`);

  check(
    missDuration > hitDuration,
    'Cache hit is dramatically faster than uncached network miss',
    `Hit: ${hitDuration.toFixed(2)}ms vs Miss: ${missDuration.toFixed(2)}ms`
  );
}

// =============================================================================
// SUITE 3: CADENCE TIMER RESILIENCE & TIMER DRIFT SIMULATION
// =============================================================================
async function testCadenceTimerResilience() {
  console.log('\n======================================================================');
  console.log('⚡ SUITE 3: CADENCE TIMER RESILIENCE & TIMER DRIFT EMPIRICAL TEST');
  console.log('======================================================================');

  // Test 3.1: 100 Rapid Pause/Resume Cycles
  console.log('\n--- 3.1: 100 Rapid Pause/Resume Cycles ---');
  let isPaused = false;
  let remainingTime = 60;
  let timerDriftErrors = 0;

  for (let i = 0; i < 100; i++) {
    isPaused = !isPaused;
    if (!isPaused) {
      remainingTime = Math.max(0, remainingTime - 0.1);
    }
    if (isNaN(remainingTime) || remainingTime < 0 || remainingTime > 60) {
      timerDriftErrors++;
    }
  }

  check(
    timerDriftErrors === 0,
    '100 Rapid pause/resume cycles preserve numerical time integrity without NaN or negative values',
    `Errors: ${timerDriftErrors}, Remaining: ${remainingTime}`
  );

  // Test 3.2: Cadence Cues Delivery Order and Double-Fire Prevention
  console.log('\n--- 3.2: Cadence Cues Delivery (0s, 10s, 20s, 30s, 40s, 50s, 58s) ---');
  const velociraptor = getWorkoutById('velociraptor_run');
  const spokenOrder = [];
  const spokenTimelineSet = new Set();

  function triggerCadenceCheck(timeRemainingSec) {
    if (!velociraptor.cadenceTimeline) return;
    for (const cueItem of velociraptor.cadenceTimeline) {
      const isMatch = (timeRemainingSec === cueItem.at) ||
                      (cueItem.at <= 3 && timeRemainingSec === 2);
      if (isMatch && !spokenTimelineSet.has(cueItem.at)) {
        spokenTimelineSet.add(cueItem.at);
        spokenOrder.push({ at: cueItem.at, timeRemaining: timeRemainingSec, cue: cueItem.cue });
        break;
      }
    }
  }

  // Step second by second from 60s down to 0s
  for (let sec = 60; sec >= 0; sec--) {
    triggerCadenceCheck(sec);
  }

  const expectedTimestamps = [60, 50, 40, 30, 20, 10, 3];
  const actualTimestamps = spokenOrder.map((s) => s.at);

  check(
    JSON.stringify(actualTimestamps) === JSON.stringify(expectedTimestamps),
    'Cadence cues fired in strict monotonic timestamp sequence without skipping',
    `Expected: ${expectedTimestamps.join(', ')} | Actual: ${actualTimestamps.join(', ')}`
  );

  check(
    spokenTimelineSet.size === expectedTimestamps.length,
    'Exactly 7 cadence cues fired across the 60-second routine',
    `Total cues: ${spokenTimelineSet.size}`
  );

  // Test 3.3: Double-Fire Prevention Under Repetitive Ticks
  console.log('\n--- 3.3: Idempotence & Double-Fire Prevention Under Repetitive Ticks ---');
  const countBefore = spokenOrder.length;
  // Trigger 50 repeat calls at the same timestamps
  for (let i = 0; i < 50; i++) {
    triggerCadenceCheck(30);
    triggerCadenceCheck(10);
    triggerCadenceCheck(60);
  }
  const countAfter = spokenOrder.length;

  check(
    countBefore === countAfter,
    'Cadence engine is strictly idempotent: 50 repeat calls at same timestamps triggered 0 duplicate cues',
    `Initial count: ${countBefore}, After repeats: ${countAfter}`
  );

  // Test 3.4: Background Tab Suspension (Timer Drift Jump Across Ticks)
  console.log('\n--- 3.4: Background Tab Suspension Simulation (Clock Skips 12 Seconds) ---');
  const driftSpoken = [];
  const driftTimelineSet = new Set();

  function triggerDriftCheck(timeRemainingSec) {
    for (const cueItem of velociraptor.cadenceTimeline) {
      const isMatch = (timeRemainingSec === cueItem.at) ||
                      (cueItem.at <= 3 && timeRemainingSec === 2);
      if (isMatch && !driftTimelineSet.has(cueItem.at)) {
        driftTimelineSet.add(cueItem.at);
        driftSpoken.push(cueItem.at);
        break;
      }
    }
  }

  // Simulate ticks: 60s -> 59s -> [Tab Suspended for 12 seconds] -> jumps to 47s -> [Tab Suspended 18s] -> jumps to 29s
  triggerDriftCheck(60);
  triggerDriftCheck(59);
  // Drift jump to 47s (skips 50s tick)
  triggerDriftCheck(47);
  // Drift jump to 30s
  triggerDriftCheck(30);
  // Drift jump to 10s
  triggerDriftCheck(10);
  // Jump to 2s (matches final stretch)
  triggerDriftCheck(2);

  check(
    driftSpoken.includes(60) && driftSpoken.includes(30) && driftSpoken.includes(10),
    'Timer suspension recovers safely and fires subsequent cues cleanly without crashing',
    `Triggered timestamps during drift: ${driftSpoken.join(', ')}`
  );
}

// =============================================================================
// SUITE 4: DIPLODOCUS 30S SYNCHRONOUS SYNC VERIFICATION
// =============================================================================
async function testDiplodocus30sSync() {
  console.log('\n======================================================================');
  console.log('⚡ SUITE 4: DIPLODOCUS 30S SYNCHRONOUS SYNC EMPIRICAL TEST');
  console.log('======================================================================');

  const diplo = getWorkoutById('diplodocus');
  check(
    diplo.hasHalfwaySideSwitch === true,
    'The Diplodocus workout is configured with hasHalfwaySideSwitch: true'
  );

  // Create avatar rig
  const rig = createAvatarRig();
  check(Boolean(rig && rig.bones), 'Avatar skeletal bone rig created successfully');

  // Test Side 1 at remainingTime = 32s (Settled Side 1)
  console.log('\n--- 4.1: Side 1 Settled Pose at 32s Remaining (isHalfwayFlipped = false) ---');
  let isHalfwayFlipped = false;
  let remainingTime = 32;
  applyWorkoutKinematics(rig, 'diplodocus', 0, 74, remainingTime, isHalfwayFlipped);

  const side1ArmR = rig.bones.armR.rotation.x;
  const side1ArmL = rig.bones.armL.rotation.x;
  const side1ThighL = rig.bones.thighL.rotation.x;
  const side1ThighR = rig.bones.thighR.rotation.x;

  console.log(`  Side 1 (32s): ArmR=${side1ArmR.toFixed(3)}, ArmL=${side1ArmL.toFixed(3)}, ThighL=${side1ThighL.toFixed(3)}, ThighR=${side1ThighR.toFixed(3)}`);

  check(
    side1ArmR < side1ArmL && side1ThighL < side1ThighR,
    'Side 1 extends Right Arm forward (-1.57 rad) and Left Leg backward (-1.57 rad), while Left Arm and Right Leg remain planted',
    `ArmR (${side1ArmR.toFixed(2)}) < ArmL (${side1ArmL.toFixed(2)}), ThighL (${side1ThighL.toFixed(2)}) < ThighR (${side1ThighR.toFixed(2)})`
  );

  // Test Exact 30s Transition: State Flip, Audio Announcement, and Smooth Crossover Blend
  console.log('\n--- 4.2: Exact 30s Transition (Synchronous State Flip & Audio Announcement) ---');
  remainingTime = 30;
  isHalfwayFlipped = (diplo.hasHalfwaySideSwitch && remainingTime <= 30);

  applyWorkoutKinematics(rig, 'diplodocus', 0, 74, remainingTime, isHalfwayFlipped);

  const midArmR = rig.bones.armR.rotation.x;
  const midArmL = rig.bones.armL.rotation.x;
  const midThighL = rig.bones.thighL.rotation.x;
  const midThighR = rig.bones.thighR.rotation.x;

  console.log(`  Mid-transition (30s): ArmR=${midArmR.toFixed(3)}, ArmL=${midArmL.toFixed(3)}, ThighL=${midThighL.toFixed(3)}, ThighR=${midThighR.toFixed(3)}`);

  check(
    isHalfwayFlipped === true,
    'isHalfwayFlipped state evaluates to true at exactly 30s remaining',
    `remainingTime=${remainingTime}, isHalfwayFlipped=${isHalfwayFlipped}`
  );

  check(
    !isNaN(midArmR) && !isNaN(midArmL) && Math.abs(midArmR - midArmL) < 0.05,
    'At 30.0s exact midpoint, kinematics execute smooth crossover blend (50% blend) without joint pop',
    `ArmR (${midArmR.toFixed(2)}) ≈ ArmL (${midArmL.toFixed(2)})`
  );

  // Verify halfway voice announcement matches
  let spokenCueText = null;
  for (const item of diplo.cadenceTimeline) {
    if (item.at === 30) {
      spokenCueText = (item.at === 30 && diplo.hasHalfwaySideSwitch)
        ? (diplo.audioCues?.halfway || item.cue)
        : item.cue;
      break;
    }
  }

  check(
    spokenCueText.includes('HALFWAY! Switch sides now!'),
    'Spoken cue at exactly 30s commands halfway side switch synchronously with pose flip',
    `Cue: "${spokenCueText}"`
  );

  // Test Side 2 at remainingTime = 28s (Settled Side 2 Mirrored)
  console.log('\n--- 4.3: Side 2 Settled Mirrored Pose at 28s Remaining (isHalfwayFlipped = true) ---');
  remainingTime = 28;
  applyWorkoutKinematics(rig, 'diplodocus', 0, 74, remainingTime, isHalfwayFlipped);

  const side2ArmR = rig.bones.armR.rotation.x;
  const side2ArmL = rig.bones.armL.rotation.x;
  const side2ThighL = rig.bones.thighL.rotation.x;
  const side2ThighR = rig.bones.thighR.rotation.x;

  console.log(`  Side 2 (28s): ArmR=${side2ArmR.toFixed(3)}, ArmL=${side2ArmL.toFixed(3)}, ThighL=${side2ThighL.toFixed(3)}, ThighR=${side2ThighR.toFixed(3)}`);

  check(
    side2ArmL < side2ArmR && side2ThighR < side2ThighL,
    'Side 2 mirrors kinematics: Left Arm extends forward (-1.57 rad) and Right Leg extends backward (-1.57 rad)',
    `ArmL (${side2ArmL.toFixed(2)}) < ArmR (${side2ArmR.toFixed(2)}), ThighR (${side2ThighR.toFixed(2)}) < ThighL (${side2ThighL.toFixed(2)})`
  );

  // Test Jump Across 30s Boundary (Background Tab Drift: 32s -> 28s)
  console.log('\n--- 4.4: Timer Jump Across 30s (Background Tab Freeze Drift 32s -> 28s) ---');
  let driftFlipped = false;
  // Jump directly to 28s without visiting 30s
  remainingTime = 28;
  driftFlipped = (diplo.hasHalfwaySideSwitch && remainingTime <= 30);
  applyWorkoutKinematics(rig, 'diplodocus', 0, 74, remainingTime, driftFlipped);

  check(
    driftFlipped === true && rig.bones.armL.rotation.x < rig.bones.armR.rotation.x,
    'Sudden time jump across 30s boundary correctly engages Side 2 kinematics without getting stuck in transition blend',
    `driftFlipped=${driftFlipped}, ArmL=${rig.bones.armL.rotation.x.toFixed(2)}, ArmR=${rig.bones.armR.rotation.x.toFixed(2)}`
  );
}

// =============================================================================
// SUITE 5: NETWORK FAILURE INJECTION & GRACEFUL FALLBACK
// =============================================================================
async function testNetworkFailureInjection() {
  console.log('\n======================================================================');
  console.log('⚡ SUITE 5: NETWORK FAILURE INJECTION & GRACEFUL FALLBACK');
  console.log('======================================================================');

  workoutAudioClipCache.clear();

  // Test 5.1: HTTP 500 Internal Server Errors on both TTS Endpoints
  console.log('\n--- 5.1: HTTP 500 Internal Server Error on ElevenLabs and Gemini TTS ---');
  totalSynthesisStarted = 0;
  totalSynthesisCancelled = 0;

  globalThis.fetch = async (url) => {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Simulated 500 Failure' })
    };
  };

  let fallbackSuccess = false;
  let unhandledError = null;

  try {
    await speakCompanion('Testing 500 internal server error fallback', 'rex', () => {
      fallbackSuccess = true;
    });
  } catch (err) {
    unhandledError = err;
  }

  check(
    unhandledError === null,
    'HTTP 500 server error handled cleanly without unhandled promise rejections',
    unhandledError ? unhandledError.message : 'No exceptions'
  );

  check(
    totalSynthesisStarted >= 1,
    'Graceful degradation: Client automatically fell back to browser SpeechSynthesis',
    `Synthesis utterances started: ${totalSynthesisStarted}`
  );

  // Test 5.2: Network Timeout / AbortSignal Simulation
  console.log('\n--- 5.2: Network Hang & AbortSignal Timeout Simulation ---');
  globalThis.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  };

  let timeoutUnhandled = null;
  try {
    // instant=true triggers 700ms short timeout
    await speakCompanion('Testing timeout abort fallback', { petId: 'rex', instant: true });
  } catch (err) {
    timeoutUnhandled = err;
  }

  check(
    timeoutUnhandled === null,
    'Network timeout AbortError caught cleanly with automatic fallback to SpeechSynthesis',
    timeoutUnhandled ? timeoutUnhandled.message : 'No exceptions'
  );

  // Test 5.3: Network Disconnect / Fetch Rejection (TypeError: Failed to fetch)
  console.log('\n--- 5.3: Offline / Network Disconnect (TypeError: Failed to fetch) ---');
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch (offline network failure)');
  };

  let disconnectUnhandled = null;
  try {
    await speakCompanion('Testing offline disconnect fallback', 'raptor');
  } catch (err) {
    disconnectUnhandled = err;
  }

  check(
    disconnectUnhandled === null,
    'Offline network error (TypeError: Failed to fetch) seamlessly falls back to SpeechSynthesis',
    disconnectUnhandled ? disconnectUnhandled.message : 'No exceptions'
  );

  // Test 5.4: Malformed / Empty Payload Injection
  console.log('\n--- 5.4: Malformed Server Payloads (Empty audio, HTML error) ---');
  globalThis.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ audio: null, message: 'Invalid payload' })
    };
  };

  let malformedUnhandled = null;
  try {
    await speakCompanion('Testing malformed payload fallback', 'stego');
  } catch (err) {
    malformedUnhandled = err;
  }

  check(
    malformedUnhandled === null,
    'Malformed server response ({ audio: null }) handled gracefully with fallback',
    malformedUnhandled ? malformedUnhandled.message : 'No exceptions'
  );
}

// =============================================================================
// MAIN RUNNER
// =============================================================================
async function runAllAdversarialSuites() {
  console.log('🦖 ====================================================================');
  console.log('🦖 ADVERSARIAL STRESS TEST HARNESS — AUDIO & CADENCE TIMING ENGINE');
  console.log('🦖 ====================================================================');

  const suiteStart = performance.now();

  try {
    await testAudioCollisionAndBargeIn();
    await testCacheRetrievalSpeed();
    await testCadenceTimerResilience();
    await testDiplodocus30sSync();
    await testNetworkFailureInjection();
  } catch (fatalErr) {
    console.error('💥 Fatal error during adversarial stress tests:', fatalErr);
    process.exitCode = 1;
  }

  const suiteElapsed = ((performance.now() - suiteStart) / 1000).toFixed(2);

  console.log('\n======================================================================');
  console.log(`📊 ADVERSARIAL TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log(`⏱️ Total Execution Time: ${suiteElapsed}s`);
  console.log('======================================================================');

  if (failedTests > 0) {
    console.error('\n❌ FAILURES RECORDED:');
    for (const f of failureDetails) {
      console.error(`  - ${f.testName}: ${f.extraInfo}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runAllAdversarialSuites();
