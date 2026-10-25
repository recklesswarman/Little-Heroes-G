import assert from 'assert';
import { handleElevenLabsTTSRequest } from '../../../server/elevenLabsService.js';

console.log('--- Verifying ElevenLabs Voice Routing ---');

// Mock fetch to intercept the upstream request
let capturedRequest = null;
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  capturedRequest = { url, options, body: JSON.parse(options.body) };
  return {
    ok: true,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer
  };
};

// Set API key for test
process.env.ELEVENLABS_API_KEY = 'test_api_key';

const testPets = ['rex', 'stego', 'raptor', 'sparky', 'luna', 'unknown_dragon', null, undefined];

for (let i = 0; i < testPets.length; i++) {
  const petId = testPets[i];
  capturedRequest = null;
  const req = {
    body: {
      text: `Goodnight little hero, time to close your eyes. Chapter variation ${i}`,
      petId,
      voiceStyle: 'bedtime'
    }
  };

  let jsonResult = null;
  const res = {
    status: (code) => ({
      json: (data) => { jsonResult = { code, ...data }; }
    }),
    json: (data) => { jsonResult = data; }
  };

  await handleElevenLabsTTSRequest(req, res);

  assert(capturedRequest, `Upstream fetch was not called for petId ${petId}`);
  assert(
    capturedRequest.url.includes('e9sQs6aLWU82SSolkPYZ'),
    `Expected URL to route to e9sQs6aLWU82SSolkPYZ, got: ${capturedRequest.url}`
  );
  assert.strictEqual(
    capturedRequest.body.voice_settings.stability,
    0.65,
    'Bedtime stability setting should be 0.65'
  );
  assert.strictEqual(
    capturedRequest.body.voice_settings.similarity_boost,
    0.80,
    'Bedtime similarity_boost setting should be 0.80'
  );
  assert.strictEqual(
    capturedRequest.body.voice_settings.speed,
    0.85,
    'Bedtime speed setting should be 0.85'
  );
}

// Restore
global.fetch = originalFetch;
console.log('PASS: All pets and bedtime storytelling route genuinely to canonical voice e9sQs6aLWU82SSolkPYZ with calibrated bedtime settings.');
