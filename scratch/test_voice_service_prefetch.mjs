import assert from 'assert';

console.log('🧪 Running Comprehensive Voice Service, Pre-Warming & Neural Voice Unit Tests...\n');

// 1. Mock DOM and Web Audio APIs for Node environment
let createdAudioNodes = [];
let audioContextResumeCalled = false;

class MockAudioParam {
  constructor(defaultValue = 1.0) {
    this.value = defaultValue;
    this.setValueAtTimeCalls = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.setValueAtTimeCalls.push({ val, time });
  }
}

class MockAudioBufferSourceNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffer = null;
    this.playbackRate = new MockAudioParam(1.0);
    this.detune = new MockAudioParam(0);
    this.onended = null;
    this.started = false;
    this.stopped = false;
    createdAudioNodes.push(this);
  }
  connect(dest) {
    this.destination = dest;
  }
  disconnect() {}
  start(when = 0) {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = [new Float32Array(length)];
  }
  copyToChannel(source, channelNumber) {
    this.channels[channelNumber].set(source);
  }
}

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.currentTime = 12.34;
    this.state = 'running';
    this.destination = { type: 'destination' };
  }
  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }
  async resume() {
    audioContextResumeCalled = true;
    this.state = 'running';
  }
}

let speechUtterances = [];
let speechSynthesizerSpoke = false;

class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.pitch = 1.0;
    this.rate = 1.0;
    this.volume = 1.0;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
    speechUtterances.push(this);
  }
}

let currentMockVoices = [
  { name: 'Daniel (English UK)', lang: 'en-GB' },
  { name: 'Samantha', lang: 'en-US' }
];

const mockSpeechSynthesis = {
  speaking: false,
  paused: false,
  onvoiceschanged: null,
  getVoices: () => currentMockVoices,
  cancel: () => {
    speechUtterances = [];
  },
  speak: (utterance) => {
    speechSynthesizerSpoke = true;
    if (utterance.onend) {
      setTimeout(() => utterance.onend(), 5);
    }
  }
};

global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
global.speechSynthesis = mockSpeechSynthesis;
global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext,
  speechSynthesis: mockSpeechSynthesis,
  SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Simple base64 PCM generator for explicit bundled-PCM tests
function generateFakeBase64Pcm(length = 100) {
  const bytes = new Uint8Array(length * 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = (i % 200) + 1;
  }
  return Buffer.from(bytes).toString('base64');
}

async function runTests() {
  const {
    getAudioCacheKey,
    fetchPcmTts,
    prefetchCompanionAudio,
    prewarmWorkoutAudio,
    speakCompanion,
    selectPreferredVoice,
    isLegacyRoboticVoice,
    isNeuralNaturalVoice,
    splitIntoSpeechChunks,
    cleanDialogueText,
    workoutAudioClipCache,
    stopRex
  } = await import('../src/services/voiceService.js');
  const { DINO_WORKOUTS } = await import('../src/data/petsData.js');
  const { store } = await import('../src/state/store.js');

  // --- Test Suite 1: getAudioCacheKey & voiceStyle ---
  console.log('--- Test Suite 1: getAudioCacheKey and voiceStyle ---');
  {
    const defaultKey = getAudioCacheKey('Once upon a starry night', 'rex');
    assert.strictEqual(defaultKey, 'rex:Once upon a starry night', 'Default style should omit style tag for backward compatibility');

    const bedtimeKey = getAudioCacheKey('Once upon a starry night', 'rex', 'bedtime');
    assert.strictEqual(bedtimeKey, 'rex:bedtime:Once upon a starry night', 'Bedtime style key should include :bedtime: tag');

    const petIdBedtimeKey = getAudioCacheKey('Time for sleep', '2', 'bedtime');
    assert.strictEqual(petIdBedtimeKey, 'raptor:bedtime:Time for sleep', 'Numeric petId should normalize to canonical pet key');
    console.log('  ✅ PASS: getAudioCacheKey correctly handles defaults, bedtime style, and pet ID normalization');
  }

  // --- Test Suite 2: fetchPcmTts Extended Timeouts and Payload ---
  console.log('\n--- Test Suite 2: fetchPcmTts Explicit Endpoint Helper ---');
  {
    // 2.0 Empty endpoint makes zero network calls
    let emptyEndpointCalled = false;
    global.fetch = async () => {
      emptyEndpointCalled = true;
      throw new Error('Should not call fetch when endpoint is empty');
    };
    const nullResult = await fetchPcmTts('', 'Test text', 'rex');
    assert.strictEqual(nullResult, null, 'Empty endpoint must resolve null immediately');
    assert.strictEqual(emptyEndpointCalled, false, 'Empty endpoint must never call fetch');

    let interceptedFetch = null;
    global.fetch = async (url, options) => {
      interceptedFetch = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          success: true,
          audio: generateFakeBase64Pcm(50),
          sampleRate: 24000
        })
      };
    };

    await fetchPcmTts('/custom/test-pcm', 'Workout high knees', 'rex');
    assert.strictEqual(interceptedFetch.body.voiceStyle, undefined, 'Default style should not pollute payload');
    assert.strictEqual(interceptedFetch.body.petId, 'rex');

    await fetchPcmTts('/custom/test-pcm', 'Bedtime story chapter', 'rex', 4500, 'bedtime');
    assert.strictEqual(interceptedFetch.body.voiceStyle, 'bedtime', 'Bedtime style must be sent in request body');

    await fetchPcmTts('/custom/test-pcm', 'Bedtime chapter 2', 'stego', {
      timeoutMs: 20000,
      voiceStyle: 'bedtime'
    });
    assert.strictEqual(interceptedFetch.body.voiceStyle, 'bedtime');
    assert.strictEqual(interceptedFetch.body.petId, 'stego');

    console.log('  ✅ PASS: fetchPcmTts skips network when endpoint is empty and supports bedtime options when explicit');
  }

  // --- Test Suite 3: Zero-Network Web Speech Pre-Warming & Real Speech Execution ---
  console.log('\n--- Test Suite 3: Zero-Network Web Speech Pre-Warming & Real Speech Execution ---');
  {
    workoutAudioClipCache.clear();
    createdAudioNodes = [];
    let networkCalls = 0;
    global.fetch = async (url) => {
      networkCalls++;
      throw new Error(`Unexpected network fetch to "${url}" during zero-cost Web Speech pre-warming!`);
    };

    // 3.1 prefetchCompanionAudio pre-warms text & sentence chunks with ZERO network calls and ZERO fake AudioBuffers
    const chapter2Text = 'In the heart of Starlight Cove, the gentle waters shone like polished silver.';
    const result = await prefetchCompanionAudio(chapter2Text, 'rex', {
      voiceStyle: 'bedtime',
      timeoutMs: 18000,
      rate: 0.88
    });

    assert.ok(result && result.prewarmed === true, 'prefetchCompanionAudio must return prewarmed Web Speech descriptor');
    assert.strictEqual(result.audioBuffer, undefined, 'prefetchCompanionAudio must NOT create a silent fake AudioBuffer');
    assert.strictEqual(networkCalls, 0, 'prefetchCompanionAudio must make strictly ZERO network calls');
    assert.ok(Array.isArray(result.chunks) && result.chunks.length >= 1, 'Prewarmed descriptor must contain pre-split speech chunks');

    const cachedBedtime = workoutAudioClipCache.get(`rex:bedtime:${chapter2Text}`);
    assert.ok(cachedBedtime && cachedBedtime.prewarmed === true, 'Entry cached under specific bedtime cache key');

    const cachedResult = await prefetchCompanionAudio(chapter2Text, 'rex', { voiceStyle: 'bedtime' });
    assert.strictEqual(cachedResult, result, 'Repeat prefetch call returns exact cached descriptor at 0ms');
    assert.strictEqual(networkCalls, 0, 'Still zero network calls on cache hit');

    // 3.2 Speaking AFTER prefetchCompanionAudio MUST invoke real speechSynthesis.speak (NOT play a 50ms silent buffer!)
    speechSynthesizerSpoke = false;
    speechUtterances = [];
    createdAudioNodes = [];
    let chapter2Ended = false;

    await speakCompanion(chapter2Text, 'rex', () => { chapter2Ended = true; }, {
      voiceStyle: 'bedtime',
      rate: 0.88
    });
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(createdAudioNodes.length, 0, 'No silent AudioBufferSourceNode should be created for Web Speech prewarmed text');
    assert.strictEqual(speechSynthesizerSpoke, true, 'speechSynthesis.speak MUST be called after prefetchCompanionAudio');
    assert.ok(speechUtterances.length >= 1, 'SpeechSynthesisUtterance must be created with real chapter text');
    assert.strictEqual(speechUtterances[0].text, chapter2Text, 'Utterance text must match prefetched chapter');
    assert.strictEqual(speechUtterances[0].rate, 0.88, 'Utterance rate 0.88 must be applied');
    assert.strictEqual(chapter2Ended, true, 'onEnded callback must fire cleanly after speech finishes');

    // 3.3 prewarmWorkoutAudio pre-warms Dino Workout cues with ZERO network calls and speaks via speechSynthesis.speak
    const trexWorkout = DINO_WORKOUTS.find((w) => w.id === 'trex_run') || DINO_WORKOUTS[0];
    const realTrexCue = cleanDialogueText(trexWorkout.cadenceTimeline[0].cue);

    workoutAudioClipCache.clear();
    const aliasPrewarmCount = await prewarmWorkoutAudio('trex', 'rex');
    assert.ok(aliasPrewarmCount > 0, 'prewarmWorkoutAudio("trex", "rex") must resolve trex_run and cache >0 cues');
    assert.ok(workoutAudioClipCache.has(`rex:${realTrexCue}`), 'workoutAudioClipCache must contain prewarmed cue under rex:<cue>');

    workoutAudioClipCache.clear();
    const exactPrewarmCount = await prewarmWorkoutAudio('trex_run', '1');
    assert.ok(exactPrewarmCount > 0, 'prewarmWorkoutAudio("trex_run", "1") must cache >0 cues');
    assert.strictEqual(networkCalls, 0, 'prewarmWorkoutAudio must make strictly ZERO network calls');
    assert.ok(workoutAudioClipCache.has(`rex:${realTrexCue}`), 'workoutAudioClipCache must contain prewarmed cue after trex_run warmup');

    speechSynthesizerSpoke = false;
    speechUtterances = [];
    await new Promise((resolve) => {
      speakCompanion(trexWorkout.cadenceTimeline[0].cue, 'rex', resolve);
    });
    assert.strictEqual(createdAudioNodes.length, 0, 'Pre-warmed workout cache hit must NOT play a silent fake AudioBuffer');
    assert.strictEqual(speechSynthesizerSpoke, true, 'Pre-warmed workout cache hit MUST speak aloud via speechSynthesis.speak');
    assert.strictEqual(
      speechUtterances.map((u) => u.text).join(' '),
      realTrexCue,
      'Spoken workout chunks must reconstruct the full cleaned pre-warmed cue'
    );

    // 3.4 Polymorphism: prefetchCompanionAudio(text, options)
    const chapter3Text = 'The soft starlight nest cradled the little hero into deep, restful sleep.';
    const ch3Result = await prefetchCompanionAudio(chapter3Text, {
      petId: 'raptor',
      voiceStyle: 'bedtime'
    });
    assert.ok(ch3Result && ch3Result.prewarmed === true, 'Polymorphic options object syntax supported');
    assert.ok(workoutAudioClipCache.has(`raptor:bedtime:${chapter3Text}`), 'Cached under raptor bedtime key');

    console.log('  ✅ PASS: prefetchCompanionAudio & prewarmWorkoutAudio make 0 network calls, populate real cache hits, create 0 silent AudioBuffers, and speak via speechSynthesis.speak');
  }

  // --- Test Suite 4: Bundled PCM AudioBuffer Playback Rate & Pitch Compensation ---
  console.log('\n--- Test Suite 4: Bundled PCM AudioBuffer Playback Rate & Pitch Compensation ---');
  {
    workoutAudioClipCache.clear();
    createdAudioNodes = [];

    // Explicitly seed genuine PCM audio clip into cache to verify playPcmTtsResponse detune math
    const testStoryLine = 'Close your eyes and listen to the murmuring trees.';
    workoutAudioClipCache.set(`rex:bedtime:${testStoryLine}`, {
      success: true,
      audio: generateFakeBase64Pcm(120),
      sampleRate: 24000,
      petId: 'rex',
      voice: 'bundled'
    });

    let endedCallbackCalled = false;
    await speakCompanion(testStoryLine, {
      rate: 0.82,
      pitch: 0.95,
      voiceStyle: 'bedtime',
      onEnded: () => {
        endedCallbackCalled = true;
      }
    });

    const activeNode = createdAudioNodes[createdAudioNodes.length - 1];
    assert.ok(activeNode, 'An AudioBufferSourceNode should be created for genuine bundled PCM audio');
    assert.strictEqual(activeNode.started, true, 'AudioBufferSourceNode must be started');
    assert.strictEqual(activeNode.playbackRate.value, 0.82, 'playbackRate must be scaled to 0.82 on AudioParam');

    const expectedDetune = (-1200 * Math.log2(0.82)) + (1200 * Math.log2(0.95));
    assert.ok(Math.abs(activeNode.detune.value - expectedDetune) < 0.01,
      `detune must cancel playbackRate pitch shift (expected ~${expectedDetune.toFixed(2)}, got ${activeNode.detune.value})`);

    activeNode.onended();
    assert.strictEqual(endedCallbackCalled, true, 'onEnded callback from options object must be invoked onended');

    console.log('  ✅ PASS: Genuine bundled PCM clips apply playbackRate and pitch-preserving detune compensation');
  }

  // --- Test Suite 5: Neural/Natural Voice Prioritization over Robotic SAPI5 & Offline Speech ---
  console.log('\n--- Test Suite 5: Neural Voice Prioritization over SAPI5 & Direct Web Speech ---');
  {
    workoutAudioClipCache.clear();
    stopRex();

    // 5.1 Standard Daniel/Samantha voice selection
    currentMockVoices = [
      { name: 'Daniel (English UK)', lang: 'en-GB' },
      { name: 'Samantha', lang: 'en-US' }
    ];
    global.fetch = async () => {
      throw new Error('Network offline');
    };

    speechSynthesizerSpoke = false;
    speechUtterances = [];

    const offlineLine = 'Good night, brave little hero.';
    await speakCompanion(offlineLine, 'rex', null, { rate: 0.85, pitch: 0.95 });

    assert.strictEqual(speechSynthesizerSpoke, true, 'Device SpeechSynthesis must be triggered when offline');
    const lastUtterance = speechUtterances[speechUtterances.length - 1];
    assert.strictEqual(lastUtterance.rate, 0.85, 'SpeechSynthesis rate option must be applied');
    assert.strictEqual(lastUtterance.pitch, 0.95, 'SpeechSynthesis pitch option must be applied');
    assert.strictEqual(lastUtterance.voice?.name, 'Daniel (English UK)', 'SpeechSynthesis must prioritize Daniel voice');

    // 5.2 Windows SAPI5 robotic voices (David, Mark, Zira) must lose to neural voices (Online Natural, Google US English, Enhanced)
    currentMockVoices = [
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Mark - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' },
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' }
    ];

    assert.strictEqual(isLegacyRoboticVoice(currentMockVoices[0]), true, 'Microsoft David detected as legacy robotic SAPI5');
    assert.strictEqual(isLegacyRoboticVoice(currentMockVoices[1]), true, 'Microsoft Mark detected as legacy robotic SAPI5');
    assert.strictEqual(isLegacyRoboticVoice(currentMockVoices[2]), true, 'Microsoft Zira detected as legacy robotic SAPI5');
    assert.strictEqual(isNeuralNaturalVoice(currentMockVoices[3]), true, 'Google US English detected as neural/natural');
    assert.strictEqual(isNeuralNaturalVoice(currentMockVoices[4]), true, 'Microsoft Guy Online (Natural) detected as neural/natural');

    const chosenForMark = selectPreferredVoice(['mark', 'david']);
    assert.ok(
      chosenForMark && !isLegacyRoboticVoice(chosenForMark),
      `Neural voice (${chosenForMark?.name}) must be selected ahead of robotic Microsoft Mark/David`
    );

    // 5.3 Enhanced/Premium Apple voice beats compact duplicate of the same name
    currentMockVoices = [
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Samantha (Enhanced)', lang: 'en-US' }
    ];
    const chosenSamantha = selectPreferredVoice(['samantha']);
    assert.strictEqual(chosenSamantha?.name, 'Samantha (Enhanced)', 'Enhanced neural voice must beat compact voice of same name');

    // 5.4 Natural pitch shaping keeps neural voices free of extreme metallic pitch distortion
    currentMockVoices = [
      { name: 'Microsoft Ana Online (Natural) - English (United States)', lang: 'en-US' }
    ];
    speechUtterances = [];
    await speakCompanion('Chomper loves happy snacks!', 'chomper'); // chomper default profile pitch is 1.45
    const neuralUtterance = speechUtterances[speechUtterances.length - 1];
    assert.ok(
      neuralUtterance.pitch > 1.0 && neuralUtterance.pitch <= 1.18,
      `Neural voice default pitch should be gently shaped (${neuralUtterance.pitch}) to avoid metallic distortion`
    );

    // 5.5 Windows 11 Edge regional pool: en-US natural voice (Ava/Aria/Jenny) beats alphabetical Abeo [en-NG], and macOS novelty voices are rejected
    const edgeRegionalPool = [
      { name: 'Microsoft Abeo Online (Natural) - English (Nigeria)', lang: 'en-NG' },
      { name: 'Microsoft Ava Online (Natural) - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' }
    ];
    const edgeFallbackPick = selectPreferredVoice(edgeRegionalPool, ['daniel']);
    assert.strictEqual(edgeFallbackPick?.lang, 'en-US', `Expected en-US neural voice over alphabetical en-NG Abeo, got ${edgeFallbackPick?.name}`);

    const macNoveltyPool = [
      { name: 'Albert', lang: 'en-US' },
      { name: 'Zarvox', lang: 'en-US' },
      { name: 'Fred', lang: 'en-US' },
      { name: 'Samantha', lang: 'en-US' }
    ];
    assert.strictEqual(isLegacyRoboticVoice(macNoveltyPool[0]), true, 'macOS Albert novelty voice flagged as robotic');
    assert.strictEqual(isLegacyRoboticVoice(macNoveltyPool[1]), true, 'macOS Zarvox novelty voice flagged as robotic');
    assert.strictEqual(isLegacyRoboticVoice(macNoveltyPool[2]), true, 'macOS Fred MacinTalk voice flagged as robotic');
    assert.strictEqual(selectPreferredVoice(macNoveltyPool, ['daniel'])?.name, 'Samantha', 'Samantha beats macOS novelty voices');

    // 5.6 Explicit 'rex' petId is preserved even when store.getActivePet() is another pet ('stego')
    const origGetActivePet = store.getActivePet;
    store.getActivePet = () => ({ id: '3', key: 'stego', name: 'Stego' });
    try {
      currentMockVoices = [
        { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Christopher Online (Natural) - English (United States)', lang: 'en-US' }
      ];
      speechUtterances = [];
      await speakCompanion('Explicit Rex roar!', 'rex');
      assert.strictEqual(
        speechUtterances[speechUtterances.length - 1]?.voice?.name,
        'Microsoft Guy Online (Natural) - English (United States)',
        'Explicit petId="rex" must use Rex voice rather than being overwritten by active pet Stego'
      );
    } finally {
      store.getActivePet = origGetActivePet;
    }

    // 5.7 Unpunctuated run-on sentences strictly obey chunk character bounds
    const runOnChunks = splitIntoSpeechChunks(('brave '.repeat(400)) + 'hero', 180, 280);
    assert.ok(runOnChunks.length >= 8, 'Run-on sentence must split into multiple word-bounded chunks');
    assert.ok(runOnChunks.every((c, idx) => c.length <= (idx === 0 ? 180 : 280)), 'Every chunk must obey maxChars limit');

    console.log('  ✅ PASS: Neural/natural voices, Edge en-US locale preference, macOS novelty filtering, explicit rex preservation, and run-on bounds verified');
  }

  console.log('\n🎉 ALL VOICE SERVICE, PRE-WARMING & NEURAL VOICE UNIT TESTS PASSED (5/5)!');
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
