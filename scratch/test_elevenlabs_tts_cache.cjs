const assert = require('assert');

console.log('🧪 Running ElevenLabs TTS Server-Side Cache Tests...');

// Config needed for handleElevenLabsTTSRequest to take the "configured"
// path instead of the silent 503 "not configured" short-circuit.
process.env.ELEVENLABS_API_KEY = 'test-fake-key';
process.env.ELEVENLABS_REX_VOICE_ID = 'test-voice-id';

function makeRes() {
  const res = { statusCode: 200 };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function makeReq(body) {
  return { body, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
}

function fakeUpstreamResponse(pcmByte = 0x42) {
  return {
    ok: true,
    arrayBuffer: async () => new Uint8Array([pcmByte, pcmByte, pcmByte, pcmByte]).buffer
  };
}

async function run() {
  const { handleElevenLabsTTSRequest } = await import('../server/elevenLabsService.js');

  console.log('\n--- 1. Cache miss on first request calls the upstream API ---');
  let fetchCallCount = 0;
  global.fetch = async () => {
    fetchCallCount++;
    return fakeUpstreamResponse(0x11);
  };

  const res1 = makeRes();
  await handleElevenLabsTTSRequest(makeReq({ text: 'Zone 1: Upper Right! Scrub round and round!', petId: 'rex' }), res1);
  assert.strictEqual(fetchCallCount, 1, 'First request for a new line must call the ElevenLabs upstream API');
  assert.strictEqual(res1.body.success, true, 'First response must succeed');
  assert.ok(!res1.body.cached, 'First response must not be marked cached');
  const firstAudio = res1.body.audio;
  console.log('  ✅ PASS: cache miss triggered exactly one upstream call');

  console.log('\n--- 2. Cache hit on identical repeat request skips the upstream API ---');
  const res2 = makeRes();
  await handleElevenLabsTTSRequest(makeReq({ text: 'Zone 1: Upper Right! Scrub round and round!', petId: 'rex' }), res2);
  assert.strictEqual(fetchCallCount, 1, 'Repeat request for the same line must NOT call the upstream API again');
  assert.strictEqual(res2.body.cached, true, 'Repeat response must be marked cached');
  assert.strictEqual(res2.body.audio, firstAudio, 'Cached response must return the exact same audio payload');
  console.log('  ✅ PASS: identical repeat request served from cache, no upstream call');

  console.log('\n--- 3. A different line is still a cache miss (keys are content-addressed) ---');
  const res3 = makeRes();
  await handleElevenLabsTTSRequest(makeReq({ text: 'Zone 2: Upper Left! Keep circling!', petId: 'rex' }), res3);
  assert.strictEqual(fetchCallCount, 2, 'A genuinely different line must trigger its own upstream call');
  assert.ok(!res3.body.cached, 'A new line\'s first response must not be marked cached');
  console.log('  ✅ PASS: distinct text is cached independently, not conflated with the first line');

  console.log('\n--- 4. Whitespace/formatting differences that clean to the same text still hit cache ---');
  const res4 = makeRes();
  await handleElevenLabsTTSRequest(makeReq({ text: '  Zone 1: Upper Right!   Scrub round and round!  ', petId: 'rex' }), res4);
  assert.strictEqual(fetchCallCount, 2, 'Text that cleans to an already-cached line must be served from cache');
  assert.strictEqual(res4.body.cached, true, 'Whitespace-only variant must be recognized as the same cached line');
  console.log('  ✅ PASS: text cleaning happens before the cache key is computed');

  console.log('\n🎉 ALL ELEVENLABS TTS CACHE TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exitCode = 1;
});
