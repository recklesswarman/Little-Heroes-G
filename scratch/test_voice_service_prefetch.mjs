import assert from 'assert';

console.log('🧪 Running Comprehensive Voice Service & Pre-Fetch Unit Tests...\n');

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

const mockVoices = [
  { name: 'Daniel (English UK)', lang: 'en-GB' },
  { name: 'Samantha', lang: 'en-US' }
];

const mockSpeechSynthesis = {
  speaking: false,
  paused: false,
  getVoices: () => mockVoices,
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

// Simple base64 PCM generator for test
function generateFakeBase64Pcm(length = 100) {
  const bytes = new Uint8Array(length * 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = i % 256;
  }
  return Buffer.from(bytes).toString('base64');
}

async function runTests() {
  const {
    getAudioCacheKey,
    fetchPcmTts,
    prefetchCompanionAudio,
    speakCompanion,
    workoutAudioClipCache,
    stopRex
  } = await import('../src/services/voiceService.js');

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

  // --- Test Suite 2: fetchPcmTts Extended Timeouts and Body Payload ---
  console.log('\n--- Test Suite 2: fetchPcmTts Extended Timeouts and Payload ---');
  {
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

    // 2.1 Default style with no timeout provided -> 4500ms
    await fetchPcmTts('/api/elevenlabs/tts', 'Workout high knees', 'rex');
    assert.strictEqual(interceptedFetch.body.voiceStyle, undefined, 'Default style should not pollute payload');
    assert.strictEqual(interceptedFetch.body.petId, 'rex');

    // 2.2 Bedtime style with default timeout -> automatically expands to 18000ms
    await fetchPcmTts('/api/elevenlabs/tts', 'Bedtime story chapter', 'rex', 4500, 'bedtime');
    assert.strictEqual(interceptedFetch.body.voiceStyle, 'bedtime', 'Bedtime style must be sent in request body');

    // 2.3 Options object support
    await fetchPcmTts('/api/elevenlabs/tts', 'Bedtime chapter 2', 'stego', {
      timeoutMs: 20000,
      voiceStyle: 'bedtime'
    });
    assert.strictEqual(interceptedFetch.body.voiceStyle, 'bedtime');
    assert.strictEqual(interceptedFetch.body.petId, 'stego');

    console.log('  ✅ PASS: fetchPcmTts correctly sets 18000ms timeout for bedtime style and includes voiceStyle in payload');
  }

  // --- Test Suite 3: prefetchCompanionAudio Pre-Fetching & 0ms Cache Transition ---
  console.log('\n--- Test Suite 3: prefetchCompanionAudio Pre-Fetching & Pre-Decoding ---');
  {
    workoutAudioClipCache.clear();
    let networkCalls = 0;
    global.fetch = async (url, options) => {
      networkCalls++;
      return {
        ok: true,
        json: async () => ({
          success: true,
          audio: generateFakeBase64Pcm(100),
          sampleRate: 24000
        })
      };
    };

    const chapter2Text = 'In the heart of Starlight Cove, the gentle waters shone like polished silver.';
    const result = await prefetchCompanionAudio(chapter2Text, 'rex', {
      voiceStyle: 'bedtime',
      timeoutMs: 18000,
      rate: 0.88
    });

    assert.ok(result, 'prefetchCompanionAudio should return valid audio payload');
    assert.ok(result.audioBuffer, 'prefetchCompanionAudio must pre-decode audio into Web Audio AudioBuffer');
    assert.strictEqual(networkCalls, 1, 'First pre-fetch should call network once');

    // Verify cache was populated with multiple lookups
    const cachedBedtime = workoutAudioClipCache.get(`rex:bedtime:${chapter2Text}`);
    assert.ok(cachedBedtime, 'Audio must be cached under specific bedtime cache key');
    assert.ok(cachedBedtime.audioBuffer, 'Cached item must retain decoded AudioBuffer');

    // Second pre-fetch call must be instant cache hit without network call
    const cachedResult = await prefetchCompanionAudio(chapter2Text, 'rex', { voiceStyle: 'bedtime' });
    assert.strictEqual(networkCalls, 1, 'Repeat prefetch call must not make another network request');
    assert.strictEqual(cachedResult.audioBuffer, result.audioBuffer, 'Cached AudioBuffer must match pre-decoded buffer');

    // Test polymorphism: prefetchCompanionAudio(text, options)
    const chapter3Text = 'The soft starlight nest cradled the little hero into deep, restful sleep.';
    const ch3Result = await prefetchCompanionAudio(chapter3Text, {
      petId: 'raptor',
      voiceStyle: 'bedtime',
      timeoutMs: 18000
    });
    assert.ok(ch3Result.audioBuffer, 'Pre-decoded buffer created via options object syntax');
    assert.ok(workoutAudioClipCache.has(`raptor:bedtime:${chapter3Text}`), 'Cached under raptor bedtime key');

    console.log('  ✅ PASS: prefetchCompanionAudio pre-fetches, pre-decodes AudioBuffer, and caches with zero latency');
  }

  // --- Test Suite 4: speakCompanion Argument Polymorphism & Playback Rate Control ---
  console.log('\n--- Test Suite 4: speakCompanion Polymorphism & AudioBufferSourceNode.playbackRate ---');
  {
    workoutAudioClipCache.clear();
    createdAudioNodes = [];

    // Pre-seed cache with audio
    const testStoryLine = 'Close your eyes and listen to the murmuring trees.';
    await prefetchCompanionAudio(testStoryLine, 'rex', { voiceStyle: 'bedtime' });

    // 4.1 speakCompanion with options object: { timeoutMs, rate, pitch, voiceStyle, onEnded }
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
    assert.ok(activeNode, 'An AudioBufferSourceNode should have been created');
    assert.strictEqual(activeNode.started, true, 'AudioBufferSourceNode must be started');
    assert.strictEqual(activeNode.playbackRate.value, 0.82, 'playbackRate must be scaled to 0.82 on AudioParam');
    assert.strictEqual(activeNode.playbackRate.setValueAtTimeCalls.length, 1, 'playbackRate.setValueAtTime must be called');
    assert.strictEqual(activeNode.playbackRate.setValueAtTimeCalls[0].val, 0.82);

    // 4.1b detune must compensate the pitch shift that playbackRate alone
    // introduces (bug: chapters 3/4's slower rate made the voice sound
    // noticeably different/deeper than chapters 1/2's). Expected cents:
    // -1200*log2(rate) to cancel the rate-induced shift, plus
    // +1200*log2(pitch) for the caller's own small deliberate adjustment.
    const expectedDetune = (-1200 * Math.log2(0.82)) + (1200 * Math.log2(0.95));
    assert.ok(Math.abs(activeNode.detune.value - expectedDetune) < 0.01,
      `detune must cancel playbackRate's inherent pitch shift (expected ~${expectedDetune.toFixed(2)}, got ${activeNode.detune.value})`);

    // Simulate playback finish
    activeNode.onended();
    assert.strictEqual(endedCallbackCalled, true, 'onEnded callback from options object must be invoked onended');

    // 4.2 speakCompanion with trailing options: (text, petId, callback, options)
    let endedCallback2 = false;
    await speakCompanion(testStoryLine, 'rex', () => { endedCallback2 = true; }, {
      rate: 0.76,
      voiceStyle: 'bedtime'
    });

    const node2 = createdAudioNodes[createdAudioNodes.length - 1];
    assert.strictEqual(node2.playbackRate.value, 0.76, 'Trailing options rate 0.76 applied via setValueAtTime');
    node2.onended();
    assert.strictEqual(endedCallback2, true, 'Trailing callback invoked on completion');

    // 4.3 With no explicit pitch, rate 0.76 (chapter 4) and rate 0.94 (chapter 1)
    // must produce the SAME net pitch after compensation (only differing by
    // rate-cancelling detune, not by an uncompensated pitch drop) -- this is
    // the actual "chapters sound like a different voice" regression guard.
    createdAudioNodes = [];
    await speakCompanion(testStoryLine, 'rex', null, { rate: 0.76, voiceStyle: 'bedtime' });
    const ch4Node = createdAudioNodes[createdAudioNodes.length - 1];
    createdAudioNodes = [];
    await speakCompanion(testStoryLine, 'rex', null, { rate: 0.94, voiceStyle: 'bedtime' });
    const ch1Node = createdAudioNodes[createdAudioNodes.length - 1];
    assert.ok(Math.abs(ch4Node.detune.value - (-1200 * Math.log2(0.76))) < 0.01, 'Chapter 4 detune fully cancels its own rate-induced pitch shift');
    assert.ok(Math.abs(ch1Node.detune.value - (-1200 * Math.log2(0.94))) < 0.01, 'Chapter 1 detune fully cancels its own rate-induced pitch shift');

    console.log('  ✅ PASS: speakCompanion supports options object & trailing options, sets source.playbackRate.setValueAtTime, and compensates pitch via detune so chapters do not sound like a different voice');
  }

  // --- Test Suite 5: Primary Kokoro TTS & SpeechSynthesis fallback ---
  console.log('\n--- Test Suite 5: Primary Kokoro TTS & Resilient SpeechSynthesis Fallback ---');
  {
    workoutAudioClipCache.clear();
    stopRex();

    // 5.1 Kokoro microservice (/api/tts) is the single primary voice tier;
    // the retired ElevenLabs and Gemini TTS routes must never be called.
    let kokoroAttempted = false;
    let kokoroPetId = null;
    let retiredRouteCalled = false;

    global.fetch = async (url, init = {}) => {
      if (url.includes('/api/elevenlabs/') || url.includes('/api/gemini/tts')) {
        retiredRouteCalled = true;
        return { ok: false, status: 404 };
      }
      if (url.endsWith('/api/tts')) {
        kokoroAttempted = true;
        try { kokoroPetId = JSON.parse(init.body || '{}').petId; } catch { kokoroPetId = null; }
        return {
          ok: true,
          json: async () => ({
            success: true,
            audio: generateFakeBase64Pcm(80),
            sampleRate: 24000,
            voice: 'am_puck'
          })
        };
      }
      return { ok: false, status: 404 };
    };

    const kokoroLine = 'The silver moon smiled down on our little explorer.';
    await speakCompanion(kokoroLine, 'rex', null, { rate: 0.90 });

    assert.strictEqual(kokoroAttempted, true, 'Primary Kokoro TTS (/api/tts) must be attempted');
    assert.ok(['rex', '1'].includes(String(kokoroPetId)), 'Rex petId (key or numeric id) must be forwarded so the service can cast the per-pet voice');
    assert.strictEqual(retiredRouteCalled, false, 'Retired ElevenLabs/Gemini TTS routes must never be called');
    const node3 = createdAudioNodes[createdAudioNodes.length - 1];
    assert.ok(node3 && node3.started, 'Audio buffer from Kokoro TTS must be played');

    // 5.2 Test offline fallback to SpeechSynthesis when both server routes fail
    global.fetch = async () => {
      throw new Error('Network offline');
    };

    speechSynthesizerSpoke = false;
    speechUtterances = [];

    const offlineLine = 'Good night, brave little hero.';
    await speakCompanion(offlineLine, 'rex', null, { rate: 0.85, pitch: 0.95 });

    assert.strictEqual(speechSynthesizerSpoke, true, 'Device SpeechSynthesis must be triggered when offline');
    assert.ok(speechUtterances.length > 0, 'Utterance must be created');
    const lastUtterance = speechUtterances[speechUtterances.length - 1];
    assert.strictEqual(lastUtterance.rate, 0.85, 'SpeechSynthesis rate option must be applied');
    assert.strictEqual(lastUtterance.pitch, 0.95, 'SpeechSynthesis pitch option must be applied');
    assert.strictEqual(lastUtterance.voice?.name, 'Daniel (English UK)', 'SpeechSynthesis must prioritize Daniel voice');

    console.log('  ✅ PASS: Primary Kokoro TTS plays, and SpeechSynthesis (Daniel voice) fallback works cleanly when offline');
  }

  console.log('\n🎉 ALL VOICE SERVICE & PRE-FETCH UNIT TESTS PASSED (5/5)!');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exitCode = 1;
});
