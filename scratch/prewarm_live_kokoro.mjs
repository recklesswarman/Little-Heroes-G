import { DEFAULT_COMPANION_PHRASES } from '../src/data/companionPhrasesData.js';

const KOKORO_URL = 'https://little-heroes-tts-kokoro-592754457115.us-central1.run.app';

const CORE_GUIDANCE = [
  'Awesome job, Little Hero!',
  'Great work! Your parent will check your quest soon!',
  'Time to brush! Let us make those teeth sparkle!',
  'Let us read a magical bedtime story together.',
  'Yay! Quest complete!'
];

async function prewarm() {
  const healthRes = await fetch(`${KOKORO_URL}/health`);
  const health = await healthRes.json();
  console.log('Cloud Run /health:', JSON.stringify(health));

  const texts = [
    ...CORE_GUIDANCE,
    ...DEFAULT_COMPANION_PHRASES.map((p) => p.text.replace(/\{name\}/gi, 'Little Hero'))
  ];

  let ok = 0;
  const concurrency = 3;
  let idx = 0;

  async function worker() {
    while (idx < texts.length) {
      const current = idx++;
      const text = texts[current];
      const t0 = Date.now();
      const res = await fetch(`${KOKORO_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'am_puck', speed: 1.0 })
      });
      if (res.ok) {
        await res.json();
        ok++;
        console.log(`[${current + 1}/${texts.length}] OK (${Date.now() - t0}ms): ${text.slice(0, 48)}...`);
      } else {
        console.warn(`[${current + 1}/${texts.length}] HTTP ${res.status}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`Pre-warmed ${ok}/${texts.length} phrases into live Cloud Run RAM cache.`);
}

prewarm().catch((err) => {
  console.error(err);
  process.exit(1);
});
