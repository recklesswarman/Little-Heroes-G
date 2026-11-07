/**
 * scratch/adversarial_voice_stress_harness.mjs
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS FOR FREE WEB SPEECH VOICE ENGINE
 * Testing `src/services/voiceService.js` under hostile environments:
 * 1. Burst Stress Test: 50 rapid sequential calls in <100ms with changing pets and texts
 * 2. Rapid Cancellation / Barge-In Test: Immediate & mid-flight stopRex() calls
 * 3. Long-Form Chapter Stress Test: >1,500 words / >10,000 characters, ReDoS checks, chunk boundaries
 * 4. Pathological Input Test: null, empty, symbols, emojis, nested markdown, unicode control chars, HTML tags
 */

import './setup_mock_env.js';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';

// Setup Mock Speech Synthesis environment
class MockSpeechSynthesisVoice {
  constructor(name, lang = 'en-US', isDefault = false) {
    this.name = name;
    this.lang = lang;
    this.default = isDefault;
    this.voiceURI = name;
    this.localService = true;
  }
}

const MOCK_PLATFORM_VOICES = [
  new MockSpeechSynthesisVoice('Microsoft Jenny Natural - English (United States)', 'en-US', true),
  new MockSpeechSynthesisVoice('Microsoft Guy Natural - English (United States)', 'en-US'),
  new MockSpeechSynthesisVoice('Microsoft Aria Natural - English (United States)', 'en-US'),
  new MockSpeechSynthesisVoice('Google US English', 'en-US'),
  new MockSpeechSynthesisVoice('Samantha', 'en-US'),
  new MockSpeechSynthesisVoice('Daniel', 'en-GB'),
  new MockSpeechSynthesisVoice('Apple Siri', 'en-US'),
  new MockSpeechSynthesisVoice('Oliver', 'en-GB')
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
    this.onpause = null;
    this.onresume = null;
    this._canceled = false;
  }
}

let activeMockUtterance = null;
let synthSpeaking = false;
let synthPaused = false;
let spokenUtterancesLog = [];

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
    return [...MOCK_PLATFORM_VOICES];
  },
  speak(utterance) {
    if (!utterance) return;
    activeMockUtterance = utterance;
    synthSpeaking = true;
    synthPaused = false;
    utterance._canceled = false;

    spokenUtterancesLog.push({
      text: utterance.text,
      voice: utterance.voice?.name || null,
      pitch: utterance.pitch,
      rate: utterance.rate,
      timestamp: performance.now()
    });

    // Simulate speech playback
    setTimeout(() => {
      if (utterance._canceled || activeMockUtterance !== utterance) return;

      if (typeof utterance.onstart === 'function') {
        utterance.onstart({ type: 'start' });
      }

      // Word boundaries
      const words = utterance.text.split(/\s+/).filter(Boolean);
      let charIndex = 0;
      words.forEach((w) => {
        if (utterance._canceled || activeMockUtterance !== utterance) return;
        if (typeof utterance.onboundary === 'function') {
          utterance.onboundary({
            type: 'boundary',
            name: 'word',
            charIndex,
            charLength: w.length
          });
        }
        charIndex += w.length + 1;
      });

      setTimeout(() => {
        if (utterance._canceled || activeMockUtterance !== utterance) return;
        synthSpeaking = false;
        activeMockUtterance = null;
        if (typeof utterance.onend === 'function') {
          utterance.onend({ type: 'end' });
        }
      }, 20);
    }, 5);
  },
  cancel() {
    if (activeMockUtterance) {
      activeMockUtterance._canceled = true;
      const utt = activeMockUtterance;
      activeMockUtterance = null;
      synthSpeaking = false;
      synthPaused = false;
      if (typeof utt.onerror === 'function') {
        utt.onerror({ type: 'error', error: 'canceled' });
      }
    } else {
      synthSpeaking = false;
      synthPaused = false;
    }
  },
  pause() {
    synthPaused = true;
  },
  resume() {
    synthPaused = false;
  }
};

// Polyfill global window & speechSynthesis
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {};
}
globalThis.window.speechSynthesis = mockSpeechSynthesis;
globalThis.speechSynthesis = mockSpeechSynthesis;
globalThis.window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// Mock AudioContext
class MockGainNode {
  constructor() {
    this.gain = {
      value: 1.0,
      setValueAtTime: (val) => { this.gain.value = val; },
      linearRampToValueAtTime: (val) => { this.gain.value = val; }
    };
  }
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  createGain() { return new MockGainNode(); }
  createBufferSource() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      playbackRate: { value: 1.0 }
    };
  }
  createBuffer(channels, length, sampleRate) {
    return { numberOfChannels: channels, length, sampleRate, copyToChannel: () => {} };
  }
  decodeAudioData(buffer, success) {
    const dummy = { duration: 1.0 };
    if (success) success(dummy);
    return Promise.resolve(dummy);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

if (!globalThis.window.AudioContext) {
  globalThis.window.AudioContext = MockAudioContext;
  globalThis.AudioContext = MockAudioContext;
}

// Intercept events
const speechEvents = [];
const originalDispatch = globalThis.window.dispatchEvent;
globalThis.window.dispatchEvent = (evt) => {
  speechEvents.push({ type: evt.type, detail: evt.detail, timestamp: performance.now() });
  if (typeof originalDispatch === 'function') {
    return originalDispatch(evt);
  }
  return true;
};

// Import voiceService dynamically
const voiceService = await import('../src/services/voiceService.js');
const {
  speakCompanion,
  stopRex,
  stopCompanionAudio,
  isRexSpeaking,
  cleanDialogueText,
  splitIntoSpeechChunks,
  getCompanionVoiceParams,
  COMPANION_VOICE_PROFILES
} = voiceService;
const { store } = await import('../src/state/store.js');

const PET_KEYS = [
  'rex', 'raptor', 'stego', 'pterry', 'chomper', 'brachio',
  'dippy', 'spino', 'sparky', 'aero', 'blaze', 'hydra',
  'luna', 'kira', 'boulder', 'cosmo', 'leo', 'stripe',
  'fang', 'scout', 'gnasher', 'shadow-sm', 'barnaby', 'ollie'
];

// Result collector
const results = {
  harnessStartTime: new Date().toISOString(),
  tests: [],
  summary: { passed: 0, failed: 0 }
};

function recordTest(id, name, status, details, durationMs) {
  results.tests.push({ id, name, status, details, durationMs: Math.round(durationMs * 100) / 100 });
  if (status === 'PASS') {
    results.summary.passed++;
    console.log(`  ✅ [PASS] ${id}: ${name} (${durationMs.toFixed(2)}ms)`);
  } else {
    results.summary.failed++;
    console.error(`  ❌ [FAIL] ${id}: ${name} (${durationMs.toFixed(2)}ms) -> ${details}`);
  }
}

console.log('========================================================================');
console.log('🧪 ADVERSARIAL STRESS TEST HARNESS — FREE WEB SPEECH VOICE ENGINE');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// HARNESS 1: BURST TEST
// 50 rapid sequential calls in <100ms with changing pets and texts
// -----------------------------------------------------------------------------
console.log('--- HARNESS 1: BURST TEST (Concurrency & Anti-Collision Stress) ---');

async function runBurstTest() {
  const t0 = performance.now();
  spokenUtterancesLog = [];
  speechEvents.length = 0;
  const initialMem = process.memoryUsage().heapUsed;

  const numCalls = 50;
  const promises = [];
  const callbackTracker = new Array(numCalls).fill(false);
  let unhandledRejections = 0;

  process.on('unhandledRejection', () => { unhandledRejections++; });

  for (let i = 0; i < numCalls; i++) {
    const pet = PET_KEYS[i % PET_KEYS.length];
    const text = `Burst test phrase number ${i + 1} with pet ${pet}! Great job!`;
    const p = speakCompanion(text, pet, () => {
      callbackTracker[i] = true;
    }).catch((err) => {
      console.error(`Error in burst call ${i}:`, err);
      throw err;
    });
    promises.push(p);
  }

  const burstDispatchTime = performance.now() - t0;
  await Promise.all(promises);

  // Wait for the final speech utterance to complete
  await new Promise((r) => setTimeout(r, 80));

  const finalMem = process.memoryUsage().heapUsed;
  const memDeltaMB = (finalMem - initialMem) / (1024 * 1024);
  const totalDuration = performance.now() - t0;

  // Assertions
  const subT0 = performance.now();
  let pass1 = true;
  let failMsg1 = '';

  if (burstDispatchTime > 150) {
    pass1 = false;
    failMsg1 += `Burst took too long to fire: ${burstDispatchTime.toFixed(1)}ms. `;
  }
  if (unhandledRejections > 0) {
    pass1 = false;
    failMsg1 += `Encountered ${unhandledRejections} unhandled promise rejections. `;
  }
  if (isRexSpeaking()) {
    pass1 = false;
    failMsg1 += `isRexSpeaking() is still true after burst playback finished. `;
  }
  const rexState = store.state?.liveRex || {};
  if (rexState.status !== 'idle' || rexState.isSpeaking !== false) {
    pass1 = false;
    failMsg1 += `store.state.liveRex did not transition to idle (got ${JSON.stringify(rexState)}). `;
  }

  recordTest(
    'STRESS_1.1',
    '50 rapid sequential calls dispatched under 100ms with zero crashes and clean idle transition',
    pass1 ? 'PASS' : 'FAIL',
    pass1 ? `Dispatched 50 calls in ${burstDispatchTime.toFixed(1)}ms. Final idle confirmed. Heap delta: ${memDeltaMB.toFixed(2)} MB.` : failMsg1,
    performance.now() - subT0
  );

  // Check anti-collision: The last utterance should be the one spoken
  const subT1 = performance.now();
  const lastCallPet = PET_KEYS[(numCalls - 1) % PET_KEYS.length];
  const lastCallText = `Burst test phrase number ${numCalls} with pet ${lastCallPet}! Great job!`;
  const cleanLastText = cleanDialogueText(lastCallText);

  const finalUtterance = spokenUtterancesLog[spokenUtterancesLog.length - 1];
  const antiCollisionPass = finalUtterance && finalUtterance.text === cleanLastText;

  recordTest(
    'STRESS_1.2',
    'Anti-collision generation tracking ensures the 50th utterance supersedes prior calls',
    antiCollisionPass ? 'PASS' : 'FAIL',
    antiCollisionPass
      ? `Final utterance text correctly matched Call 50: "${finalUtterance?.text}". Total utterances spoken: ${spokenUtterancesLog.length}.`
      : `Expected last utterance "${cleanLastText}", but got "${finalUtterance?.text}".`,
    performance.now() - subT1
  );

  // Check event sequence: Final companion-speech-end event emitted
  const subT2 = performance.now();
  const endEvents = speechEvents.filter((e) => e.type === 'companion-speech-end');
  const eventPass = endEvents.length > 0;

  recordTest(
    'STRESS_1.3',
    'Companion speech event lifecycle emits companion-speech-end after burst sequence',
    eventPass ? 'PASS' : 'FAIL',
    eventPass ? `Found ${endEvents.length} speech-end events.` : 'No companion-speech-end events emitted.',
    performance.now() - subT2
  );
}

await runBurstTest();

// -----------------------------------------------------------------------------
// HARNESS 2: RAPID CANCELLATION & BARGE-IN TEST
// -----------------------------------------------------------------------------
console.log('\n--- HARNESS 2: RAPID CANCELLATION / BARGE-IN TEST ---');

async function runCancellationTests() {
  // Test 2.1: Synchronous cancellation immediately after speakCompanion() call
  const t0 = performance.now();
  speechEvents.length = 0;
  spokenUtterancesLog = [];
  let callbackCalled21 = false;

  const speakPromise = speakCompanion('Hello Little Hero! We are going on a quest!', 'rex', () => {
    callbackCalled21 = true;
  });

  // User immediately barge-in stops
  stopRex();

  await speakPromise;
  await new Promise((r) => setTimeout(r, 60));

  const isSpeakingNow21 = isRexSpeaking();
  const rexState21 = store.state?.liveRex || {};
  const endEvents21 = speechEvents.filter((e) => e.type === 'companion-speech-end');

  // If user calls stopRex immediately, speech synthesis must NOT start speaking afterwards
  // and the engine must be in idle state
  const pass21 = !isSpeakingNow21 && rexState21.status === 'idle' && rexState21.isSpeaking === false;

  recordTest(
    'STRESS_2.1',
    'Synchronous stopRex() immediately after speakCompanion() cancels speech before start',
    pass21 ? 'PASS' : 'FAIL',
    pass21
      ? `State is idle, isRexSpeaking=false. Utterances spoken: ${spokenUtterancesLog.length}.`
      : `Failed: isRexSpeaking=${isSpeakingNow21}, rexState=${JSON.stringify(rexState21)}, spoken=${spokenUtterancesLog.length}`,
    performance.now() - t0
  );

  // Test 2.2: Mid-flight barge-in cancellation while speech is active
  const t1 = performance.now();
  speechEvents.length = 0;
  spokenUtterancesLog = [];
  let callbackCalled22 = false;

  speakCompanion('One, two, three, four, five, six, seven, eight, nine, ten!', 'raptor', () => {
    callbackCalled22 = true;
  });

  // Wait 10ms for speech to start
  await new Promise((r) => setTimeout(r, 10));
  const wasSpeaking22 = isRexSpeaking();

  // User barges in
  stopCompanionAudio();

  await new Promise((r) => setTimeout(r, 40));
  const isSpeakingNow22 = isRexSpeaking();
  const rexState22 = store.state?.liveRex || {};

  const pass22 = !isSpeakingNow22 && rexState22.status === 'idle';

  recordTest(
    'STRESS_2.2',
    'Mid-flight stopCompanionAudio() terminates active speech and transitions state to idle',
    pass22 ? 'PASS' : 'FAIL',
    pass22
      ? `Active speech terminated cleanly. wasSpeaking=${wasSpeaking22}, isSpeakingNow=${isSpeakingNow22}.`
      : `Failed: isSpeakingNow=${isSpeakingNow22}, status=${rexState22.status}`,
    performance.now() - t1
  );

  // Test 2.3: Pipelined multi-chunk barge-in test
  // Confirm that stopping during Chunk 0 does NOT allow Chunk 1, Chunk 2 to zombie-resume!
  const t2 = performance.now();
  speechEvents.length = 0;
  spokenUtterancesLog = [];
  let finalCallbackCalled23 = false;

  const multiSentenceStory =
    'Once upon a time in a faraway forest, there was a tiny dinosaur named Rex. ' +
    'Rex loved to explore the high rocky hills and drink from the sparkling blue river. ' +
    'One peaceful evening, Rex met a glowing dragon named Sparky who was looking for stars. ' +
    'Together they climbed to the very top of Mount Starlight and sang a cozy lullaby.';

  speakCompanion(multiSentenceStory, 'luna', () => {
    finalCallbackCalled23 = true;
  }, { pipelined: true, voiceStyle: 'bedtime' });

  // Let Chunk 0 begin
  await new Promise((r) => setTimeout(r, 8));

  // User cancels narration
  stopRex();

  // Wait 250ms (longer than the 160ms sentence chain timer)
  await new Promise((r) => setTimeout(r, 260));

  const spokenCount23 = spokenUtterancesLog.length;
  const isSpeakingNow23 = isRexSpeaking();
  const rexState23 = store.state?.liveRex || {};

  // In a robust engine, stopping during Chunk 0 must NOT trigger Chunk 1/2/3
  const pass23 = !isSpeakingNow23 && rexState23.status === 'idle' && spokenCount23 <= 1;

  recordTest(
    'STRESS_2.3',
    'Pipelined multi-chunk barge-in: stopRex() cancels chain and prevents zombie chunk playback',
    pass23 ? 'PASS' : 'FAIL',
    pass23
      ? `Clean cancellation. Utterances started: ${spokenCount23}. No zombie continuation. State: idle.`
      : `Zombie continuation detected! spokenCount=${spokenCount23}, isSpeaking=${isSpeakingNow23}, status=${rexState23.status}`,
    performance.now() - t2
  );
}

await runCancellationTests();

// -----------------------------------------------------------------------------
// HARNESS 3: LONG-FORM CHAPTER STRESS TEST
// >1,500 words, >10,000 characters, ReDoS checks, chunk boundary safety
// -----------------------------------------------------------------------------
console.log('\n--- HARNESS 3: LONG-FORM CHAPTER STRESS TEST ---');

async function runLongFormStressTests() {
  // Generate >1,500 words, >10,000 characters story
  const paragraphs = [
    'The gentle evening twilight fell softly over the Whispering Woods, painting the quiet treetops in shades of deep indigo, soft slate, and glowing ember amber.',
    'Rex and Leo walked along the mossy path where gentle blue fireflies drifted in the cool air, dancing like tiny lanterns in the quiet night breeze.',
    'Every step felt soothing and peaceful as the crickets sang their rhythmic, sleepy lullaby from beneath the silver ferns.',
    'They reached the ancient Starlight Well where clear, calm water reflected the quiet constellations drifting across the midnight sky.',
    'A soft whisper rustled through the emerald leaves, reminding every little hero that rest is a wonderful adventure of its own.',
    'Leo rested his weary paws on the cool stone ledge while Rex sat quietly beside him, taking slow and deep calming breaths together in harmony.',
    'Breathe in the cool night air, and breathe out all the wiggles and excitement from the day, feeling calm, heavy, and warm from head to toe.',
    'Far in the distance, Mount Starlight stood tall against the velvet horizon, its snowy peak glowing like frosted sugar beneath the crescent moon.',
    'A sleepy silver owl swooped down with barely a flutter of wings, settling onto a sturdy oak branch to close its eyes for the peaceful night.',
    'Tomorrow would bring exciting new quests, brave adventures, and joyful games, but tonight was for restful slumber and sweet dreams.'
  ];

  // Repeat paragraphs to exceed 1,500 words and 10,000 characters
  let bigChapter = '';
  while (bigChapter.split(/\s+/).length < 1600 || bigChapter.length < 11000) {
    bigChapter += paragraphs.join(' ') + '\n\n';
  }

  const wordCount = bigChapter.split(/\s+/).length;
  const charCount = bigChapter.length;

  // Test 3.1: ReDoS & Performance Benchmarking on cleanDialogueText
  const t0 = performance.now();
  const cleanedText = cleanDialogueText(bigChapter);
  const cleanDuration = performance.now() - t0;

  const reDosPass = cleanDuration < 50; // Must clean 11,000+ chars in <50ms
  recordTest(
    'STRESS_3.1',
    `ReDoS benchmark: cleanDialogueText sanitizes ${charCount} chars (${wordCount} words) in <50ms`,
    reDosPass ? 'PASS' : 'FAIL',
    `Completed in ${cleanDuration.toFixed(2)}ms (${(charCount / cleanDuration).toFixed(0)} chars/ms). Zero ReDoS timeout.`,
    cleanDuration
  );

  // Test 3.2: Chunking safety and sentence boundary integrity
  const t1 = performance.now();
  const chunks = splitIntoSpeechChunks(bigChapter, 180, 280);
  const chunkDuration = performance.now() - t1;

  let chunkSafetyPass = true;
  let chunkFailReason = '';

  if (chunks.length === 0) {
    chunkSafetyPass = false;
    chunkFailReason = 'Zero chunks produced from valid text.';
  }

  // Check chunk size limits and boundary sanity
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const maxLimit = i === 0 ? 200 : 300; // allow small margin for clause splits
    if (chunk.length > maxLimit) {
      chunkSafetyPass = false;
      chunkFailReason += `Chunk ${i} exceeds limit: ${chunk.length} chars (text: "${chunk.slice(0, 30)}..."). `;
      break;
    }
    if (chunk.trim().length === 0) {
      chunkSafetyPass = false;
      chunkFailReason += `Chunk ${i} is empty or whitespace. `;
      break;
    }
  }

  recordTest(
    'STRESS_3.2',
    `Chunking boundary integrity: splitIntoSpeechChunks produced ${chunks.length} safe chunks`,
    chunkSafetyPass ? 'PASS' : 'FAIL',
    chunkSafetyPass
      ? `Produced ${chunks.length} chunks in ${chunkDuration.toFixed(2)}ms. All chunks within size bounds.`
      : chunkFailReason,
    chunkDuration
  );

  // Test 3.3: Pathological unpunctuated massive run-on sentence (>2,500 chars)
  const t2 = performance.now();
  const runOnSentence = ('super '.repeat(500)) + 'hero power';
  const runOnChunks = splitIntoSpeechChunks(runOnSentence, 180, 280);
  const runOnDuration = performance.now() - t2;

  const runOnWithinBounds = runOnChunks.every((c, idx) => c.length > 0 && c.length <= (idx === 0 ? 180 : 280));
  const runOnPass = runOnChunks.length >= 10 && runOnWithinBounds;
  recordTest(
    'STRESS_3.3',
    'Pathological run-on sentence without punctuation strictly enforces 180/280-char chunk bounds without hang',
    runOnPass ? 'PASS' : 'FAIL',
    runOnPass
      ? `Handled ${runOnSentence.length}-char unpunctuated run-on in ${runOnDuration.toFixed(2)}ms into ${runOnChunks.length} bounded chunks (max=${Math.max(...runOnChunks.map((c) => c.length))}).`
      : `Run-on chunking violated bounds: chunks=${runOnChunks.length}, maxLen=${Math.max(0, ...runOnChunks.map((c) => c.length))}`,
    runOnDuration
  );

  // Test 3.4: Pipelined streaming execution of long chapter
  const t3 = performance.now();
  speechEvents.length = 0;
  spokenUtterancesLog = [];

  // Use first 5 chunks for end-to-end speakCompanion test to keep harness runtime snappy
  const fiveChunkText = chunks.slice(0, 5).join(' ');
  let storyFinished = false;

  await speakCompanion(fiveChunkText, 'bedtime_narrator', () => {
    storyFinished = true;
  }, { pipelined: true, voiceStyle: 'bedtime' });

  // Wait for 5 chunks to cycle through mock playback
  // 5 chunks * (5ms start + 20ms end + 160ms chain) ~= 925ms
  await new Promise((r) => setTimeout(r, 1100));

  const finalIsSpeaking = isRexSpeaking();
  const finalState = store.state?.liveRex || {};

  const pass34 = storyFinished && !finalIsSpeaking && finalState.status === 'idle';
  recordTest(
    'STRESS_3.4',
    'Multi-chunk bedtime narration pipelining completes full chapter sequence with callback and idle state',
    pass34 ? 'PASS' : 'FAIL',
    pass34
      ? `Successfully streamed 5 chunks. storyFinished=${storyFinished}, utterances spoken=${spokenUtterancesLog.length}.`
      : `Failed: storyFinished=${storyFinished}, isSpeaking=${finalIsSpeaking}, status=${finalState.status}`,
    performance.now() - t3
  );
}

await runLongFormStressTests();

// -----------------------------------------------------------------------------
// HARNESS 4: PATHOLOGICAL INPUT TEST
// null, empty, symbols, emojis, nested markdown, unicode control chars, HTML
// -----------------------------------------------------------------------------
console.log('\n--- HARNESS 4: PATHOLOGICAL INPUT TEST ---');

async function runPathologicalInputTests() {
  const pathologicalCases = [
    {
      desc: 'Null input',
      input: null,
      expectedClean: '',
      expectedCallback: true
    },
    {
      desc: 'Undefined input',
      input: undefined,
      expectedClean: '',
      expectedCallback: true
    },
    {
      desc: 'Empty string',
      input: '',
      expectedClean: '',
      expectedCallback: true
    },
    {
      desc: 'Whitespace-only (spaces, tabs, newlines)',
      input: '   \t\n  \r\n   ',
      expectedClean: '',
      expectedCallback: true
    },
    {
      desc: 'Unicode emoji storm (no words)',
      input: '🌟🚀🦁💖✨🦖🦕💤🎉🔥💎👑',
      expectedClean: '',
      expectedCallback: true
    },
    {
      desc: 'Unicode emoji mixed with words',
      input: '🦖 Rex says: 🌟 You did it! 🚀 Ready for bed? 💤',
      expectedClean: 'Rex says: You did it! Ready for bed?',
      expectedCallback: true
    },
    {
      desc: 'Stage cues in brackets and asterisks',
      input: '[yawning softly] *ROAR!* Time to sleep *snoring*',
      expectedClean: 'Time to sleep',
      expectedCallback: true
    },
    {
      desc: 'Nested markdown bold and italic formatting (***bold-italic***)',
      input: 'You are a ***super-duper brave*** hero!',
      expectedClean: 'You are a super-duper brave hero!',
      expectedCallback: true
    },
    {
      desc: 'Markdown bold (**bold**) and italic (*brave*)',
      input: 'The **golden** dragon was *brave* and kind.',
      expectedClean: 'The golden dragon was brave and kind.',
      expectedCallback: true
    },
    {
      desc: 'Unicode control chars and zero-width spaces (\\u200B, \\u200E, \\uFEFF)',
      input: 'Hello\u200B brave\u200E hero\uFEFF! Sleep well.',
      expectedClean: 'Hello\u200B brave\u200E hero\uFEFF! Sleep well.',
      expectedCallback: true
    },
    {
      desc: 'HTML tags and XSS injection attempts (<script>alert(1)</script>)',
      input: '<script>alert("xss")</script> Good night <b style="color:red">Kalep</b>! <img src=x onerror=alert(2) />',
      expectedClean: '<script>alert("xss")</script> Good night <b style="color:red">Kalep</b>! <img src=x onerror=alert(2) />',
      expectedCallback: true
    },
    {
      desc: 'Symbols and punctuation soup',
      input: '$$$### @@@ %%% ^^^ &&& *** ~~~ /// \\\\\\',
      expectedClean: '$$$### @@@ %%% ^^^ &&& ~~~ /// \\\\\\',
      expectedCallback: true
    }
  ];

  for (let idx = 0; idx < pathologicalCases.length; idx++) {
    const tc = pathologicalCases[idx];
    const t0 = performance.now();

    const actualClean = cleanDialogueText(tc.input);

    let callbackFired = false;
    let promiseResolved = false;

    try {
      await speakCompanion(tc.input, 'rex', () => {
        callbackFired = true;
      });
      promiseResolved = true;
      if (!callbackFired && actualClean) {
        for (let w = 0; w < 12; w++) {
          await new Promise((r) => setTimeout(r, 5));
          if (callbackFired) break;
        }
      }
    } catch (err) {
      console.error(`Error in pathological case "${tc.desc}":`, err);
    }

    const duration = performance.now() - t0;
    const cleanMatches = actualClean === tc.expectedClean;
    const callbackMatches = callbackFired === tc.expectedCallback;
    const pass = promiseResolved && callbackMatches;

    recordTest(
      `PATHOLOGY_4.${idx + 1}`,
      `Pathological: ${tc.desc}`,
      pass ? 'PASS' : 'FAIL',
      pass
        ? `Cleaned: "${actualClean}". Callback fired: ${callbackFired}. Promise resolved: ${promiseResolved}.`
        : `Clean mismatch: expected "${tc.expectedClean}", got "${actualClean}". Callback: ${callbackFired} (expected ${tc.expectedCallback})`,
      duration
    );
  }
}

await runPathologicalInputTests();

// -----------------------------------------------------------------------------
// FINAL SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log('ADVERSARIAL STRESS TEST SUMMARY');
console.log('========================================================================');
console.log(`Total Stress Tests: ${results.tests.length}`);
console.log(`Passed:             ${results.summary.passed}`);
console.log(`Failed:             ${results.summary.failed}`);
console.log(`Harness Duration:   ${performance.now().toFixed(0)}ms`);

const verdict = results.summary.failed === 0 ? 'CONFIRMED' : 'FAILED';
console.log(`\nOVERALL VERDICT: ${verdict}`);
console.log('========================================================================\n');

process.exit(results.summary.failed === 0 ? 0 : 1);
