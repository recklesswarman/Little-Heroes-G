/**
 * scratch/verify_kokoro_warmup.mjs
 *
 * The Kokoro TTS service scales to zero, so the client pings
 * {base}/api/tts/health once per page load to wake it before the first spoken
 * line. Verifies the ping targets the right URL, only fires once, and never
 * throws when the network is down.
 */
import './setup_mock_env.js';
import assert from 'node:assert';

let passed = 0;
let failed = 0;

async function check(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc} -> ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('🧪 Kokoro TTS Warm-Up Verification\n');

  // Other imports (Firebase anon auth) also call fetch, so only record TTS URLs.
  const urls = [];
  globalThis.fetch = (url) => {
    if (String(url).includes('/api/tts')) urls.push(String(url));
    return Promise.reject(new Error('network down'));
  };

  const { warmUpKokoroTts, KOKORO_DEFAULT_TIMEOUT_MS } = await import('../src/services/voiceService.js');

  await check('warmUpKokoroTts pings /api/tts/health and swallows network errors', async () => {
    warmUpKokoroTts();
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(urls.length, 1);
    assert.ok(urls[0].endsWith('/api/tts/health'), `unexpected URL: ${urls[0]}`);
  });

  await check('warmUpKokoroTts only fires once per page load', async () => {
    warmUpKokoroTts();
    warmUpKokoroTts();
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(urls.length, 1);
  });

  await check('normal lines wait longer than 4.5s for Kokoro but less than the bedtime budget', () => {
    assert.ok(KOKORO_DEFAULT_TIMEOUT_MS > 4500, `timeout ${KOKORO_DEFAULT_TIMEOUT_MS} should exceed 4500ms`);
    assert.ok(KOKORO_DEFAULT_TIMEOUT_MS < 18000, 'normal lines must time out sooner than bedtime chapters');
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('❌ Test suite crashed:', err);
  process.exit(1);
});
