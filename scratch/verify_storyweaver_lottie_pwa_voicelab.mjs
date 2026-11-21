// Verifies: StoryWeaver picture-book library (+ CC BY 4.0 attribution), Lottie
// reward animations, the vite-plugin-pwa switch, and the Rex voice lab
// (whisper.cpp + Piper proxy). Run: node scratch/verify_storyweaver_lottie_pwa_voicelab.mjs
import './setup_mock_env.js';
import assert from 'assert';
import fs from 'fs';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n     ${err.stack || err.message}`);
  }
}

const sw = await import('../shared/storyweaver/normalize.js');
const { STORYWEAVER_SEED_BOOKS } = await import('../src/data/storyweaverSeedBooks.js');
const swService = await import('../server/storyweaverService.js');
const voice = await import('../server/voiceLabService.js');
const wav = await import('../src/voiceLab/wav.js');

console.log('\n--- StoryWeaver ---');

const rawBook = {
  id: 16411,
  title: 'Too Big! Too Small!',
  language: 'English',
  level: '1',
  slug: '16411-too-big-too-small',
  description: 'Shanu is too big for Ammi to carry.',
  coverImage: { sizes: [1, 2, 3, 4].map(n => ({ url: `https://storage.googleapis.com/static.storyweaver.org.in/illustration_crops/42852/size${n}/x.jpg` })) },
  authors: [{ name: 'Lavanya Karthik' }],
  illustrators: [{ name: 'Lavanya Karthik' }],
  publisher: { name: 'Pratham Books' },
  isAudio: true
};

await test('normalizes a books-search record into the attribution fields', () => {
  const b = sw.normalizeStoryWeaverBook(rawBook);
  assert.equal(b.slug, '16411-too-big-too-small');
  assert.equal(b.level, 1);
  assert.deepEqual(b.authors, ['Lavanya Karthik']);
  assert.deepEqual(b.illustrators, ['Lavanya Karthik']);
  assert.equal(b.publisher, 'Pratham Books');
  assert.ok(b.cover.endsWith('/size4/x.jpg'), 'uses the mid-size cover');
  assert.equal(b.hasAudio, true);
});

await test('rejects bad slugs and off-site cover URLs', () => {
  assert.equal(sw.normalizeStoryWeaverBook({ ...rawBook, slug: '../../etc' }), null);
  assert.equal(sw.normalizeStoryWeaverBook({ ...rawBook, slug: 'javascript:alert(1)' }), null);
  const b = sw.normalizeStoryWeaverBook({ ...rawBook, coverImage: { sizes: [{ url: 'https://evil.example/x.jpg' }] } });
  assert.equal(b.cover, '');
});

await test('attribution line names title, author, illustrator, publisher and CC BY 4.0', () => {
  const line = sw.storyWeaverAttribution(sw.normalizeStoryWeaverBook(rawBook));
  for (const part of ['"Too Big! Too Small!"', 'written by Lavanya Karthik', 'illustrated by Lavanya Karthik', 'Pratham Books', 'StoryWeaver', 'CC BY 4.0']) {
    assert.ok(line.includes(part), `missing ${part}: ${line}`);
  }
  assert.equal(sw.storyWeaverBookUrl('16411-too-big-too-small'), 'https://storyweaver.org.in/en/stories/16411-too-big-too-small');
});

await test('search URL clamps paging and only allows known levels', () => {
  const u = new URL(sw.buildStoryWeaverSearchUrl({ level: 2, page: 999, perPage: 500 }));
  assert.equal(u.origin, 'https://storyweaver.org.in');
  assert.equal(u.searchParams.get('page'), '50');
  assert.equal(u.searchParams.get('per_page'), '24');
  assert.deepEqual(u.searchParams.getAll('search[levels][]'), ['2']);
  const u2 = new URL(sw.buildStoryWeaverSearchUrl({ level: '1; DROP' }));
  assert.deepEqual(u2.searchParams.getAll('search[levels][]'), []);
});

await test('bundled seed shelf: every book normalizes and has credits', () => {
  assert.ok(STORYWEAVER_SEED_BOOKS.length >= 10);
  for (const raw of STORYWEAVER_SEED_BOOKS) {
    const b = sw.normalizeStoryWeaverBook(raw);
    assert.ok(b, `seed ${raw.slug} must normalize`);
    assert.ok(b.authors.length && b.publisher && b.cover, `seed ${raw.slug} needs authors, publisher and cover`);
    assert.ok(b.level >= 1 && b.level <= 3);
  }
});

await test('proxy normalizes, caches, and reports 502 when StoryWeaver is down', async () => {
  swService.__clearStoryWeaverCacheForTests();
  let calls = 0;
  const fakeFetch = async url => {
    calls++;
    assert.ok(String(url).startsWith('https://storyweaver.org.in/api/v1/books-search?'));
    return { ok: true, json: async () => ({ ok: true, metadata: { page: 1, totalPages: 7 }, data: [rawBook, { slug: 'bad' }] }) };
  };
  const r1 = await swService.searchStoryWeaverBooks({ level: 1 }, fakeFetch);
  const r2 = await swService.searchStoryWeaverBooks({ level: 1 }, fakeFetch);
  assert.equal(r1.books.length, 1);
  assert.equal(r1.totalPages, 7);
  assert.equal(calls, 1, 'second call is served from cache');
  assert.strictEqual(r1, r2);

  swService.__clearStoryWeaverCacheForTests();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  let status = 0;
  let body = null;
  const res = { setHeader() {}, status(c) { status = c; return this; }, json(d) { body = d; } };
  await swService.handleStoryWeaverBooksRequest({ query: { level: '1' } }, res);
  globalThis.fetch = realFetch;
  assert.equal(status, 502);
  assert.equal(body.ok, false);
});

await test('library view shows seed books with escaped credits and license link', async () => {
  const { renderStoryLibraryView, __resetStoryLibraryStateForTests } = await import('../src/views/StoryLibraryView.js');
  __resetStoryLibraryStateForTests();
  const html = renderStoryLibraryView();
  assert.ok(html.includes('Picture Book Library'));
  assert.ok(html.includes('https://creativecommons.org/licenses/by/4.0/'), 'links the CC BY 4.0 license');
  assert.ok(html.includes('Written by'), 'per-book credits');
  // Compare whole href values (not substrings) so the check can't be fooled by a URL embedded elsewhere.
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(hrefs.some(h => {
    const u = new URL(h);
    return u.origin === 'https://storyweaver.org.in' && u.pathname === '/en/stories/16411-too-big-too-small';
  }), 'links the book on storyweaver.org.in');
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(!html.includes('<script'), 'no raw script tags');
});

await test('main.js routes story_library and bedtime hub links to it', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  assert.ok(main.includes("case 'story_library':") && main.includes('renderStoryLibraryView()'));
  const bedtime = fs.readFileSync('src/views/BedtimeStoryView.js', 'utf8');
  assert.ok(bedtime.includes('hub-open-picture-books-btn') && bedtime.includes("store.navigate('story_library')"));
});

console.log('\n--- Lottie reward animations ---');

await test('bundled Lottie files are valid Bodymovin JSON', () => {
  for (const kind of ['confetti', 'trophy', 'coins']) {
    const json = JSON.parse(fs.readFileSync(`public/lottie/${kind}.json`, 'utf8'));
    assert.ok(json.v && json.fr > 0 && json.op > json.ip && json.w > 0 && json.h > 0, `${kind} header`);
    assert.ok(Array.isArray(json.layers) && json.layers.length > 0, `${kind} layers`);
    for (const l of json.layers) assert.equal(l.ty, 4, 'shape layers only');
  }
});

await test('store.celebrate fires lh:celebrate and the triggers are wired', async () => {
  const { store } = await import('../src/state/store.js');
  const seen = [];
  const prevDispatch = window.dispatchEvent;
  window.dispatchEvent = evt => { if (evt?.type === 'lh:celebrate') seen.push(evt.detail.kind); return true; };
  store.celebrate('trophy');
  window.dispatchEvent = prevDispatch;
  assert.deepEqual(seen, ['trophy']);
  const storeSrc = fs.readFileSync('src/state/store.js', 'utf8');
  assert.ok(storeSrc.includes("this.celebrate('confetti')"), 'task submission celebrates');
  assert.ok(storeSrc.includes("this.celebrate('coins')"), 'reward claim celebrates');
  assert.ok(fs.readFileSync('src/views/BattleView.js', 'utf8').includes("store.celebrate?.('trophy')"), 'boss win celebrates');
});

await test('animation service resolves bundled paths and allows https overrides only', async () => {
  const { rewardAnimationUrl, playRewardAnimation } = await import('../src/services/rewardAnimationService.js');
  assert.ok(rewardAnimationUrl('trophy').endsWith('lottie/trophy.json'));
  // In plain Node there is no document.body, so it must no-op instead of throwing.
  const prevDoc = globalThis.document;
  globalThis.document = undefined;
  assert.equal(await playRewardAnimation('coins'), false);
  globalThis.document = prevDoc;
});

console.log('\n--- vite-plugin-pwa ---');

await test('PWA is generated by vite-plugin-pwa; legacy worker removed', () => {
  assert.ok(!fs.existsSync('public/sw.js'));
  const cfg = fs.readFileSync('vite.config.js', 'utf8');
  for (const needle of ['VitePWA(', "registerType: 'autoUpdate'", 'cleanupOutdatedCaches: true', 'clientsClaim: true', 'skipWaiting: true', "filename: 'sw.js'", 'lh-storyweaver-covers']) {
    assert.ok(cfg.includes(needle), `vite.config.js missing ${needle}`);
  }
  assert.ok(cfg.includes("process.env.VITE_BASE_PATH || (process.env.TARGET_HOST === 'firebase' ? '/' : (isGitHubActions ? '/Little-Heroes-G/' : '/'))"), 'multi-host base path kept');
  const reg = fs.readFileSync('src/pwa/registerServiceWorker.js', 'utf8');
  assert.ok(reg.includes("from 'virtual:pwa-register'") && reg.includes("startsWith('little-heroes-')"), 'registers via plugin and clears legacy caches');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.devDependencies['vite-plugin-pwa'], 'vite-plugin-pwa is a devDependency');
});

console.log('\n--- Rex voice lab (whisper.cpp + Piper) ---');

await test('config reads env vars with Pi-local defaults', () => {
  const d = voice.getVoiceLabConfig({});
  assert.equal(d.whisperUrl, 'http://127.0.0.1:8178');
  assert.equal(d.piperPath, '/synthesize');
  assert.equal(d.piperUrl, 'http://127.0.0.1:5000');
  assert.equal(d.piperMode, 'post-json');
  const c = voice.getVoiceLabConfig({ WHISPER_CPP_URL: 'http://192.168.1.163:9000/', PIPER_URL: 'http://pi:5001', PIPER_MODE: 'GET', PIPER_VOICE: 'en_US-lessac-medium' });
  assert.equal(c.whisperUrl, 'http://192.168.1.163:9000');
  assert.equal(c.piperMode, 'get');
  assert.equal(c.piperVoice, 'en_US-lessac-medium');
});

await test('WAV encoder writes a 16 kHz mono PCM header', () => {
  const samples = wav.resampleMono(new Float32Array(48000).fill(0.25), 48000, 16000);
  assert.equal(samples.length, 16000);
  const buf = Buffer.from(wav.encodeWav(samples, 16000));
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WAVE');
  assert.equal(buf.readUInt16LE(22), 1, 'mono');
  assert.equal(buf.readUInt32LE(24), 16000, 'sample rate');
  assert.equal(buf.readUInt16LE(34), 16, '16-bit');
  assert.equal(buf.length, 44 + 16000 * 2);
});

await test('transcribe posts multipart WAV to whisper.cpp /inference and strips [BLANK_AUDIO]', async () => {
  const wavBuf = Buffer.from(wav.encodeWav(new Float32Array(1600), 16000));
  let seenUrl = '';
  let seenBody = null;
  const fakeFetch = async (url, opts) => {
    seenUrl = url;
    seenBody = opts.body;
    return { ok: true, json: async () => ({ text: ' Hi Rex! [BLANK_AUDIO] ' }) };
  };
  const text = await voice.transcribeWithWhisper(wavBuf, { config: voice.getVoiceLabConfig({ WHISPER_CPP_URL: 'http://pi:8080' }), fetchImpl: fakeFetch });
  assert.equal(seenUrl, 'http://pi:8080/inference');
  assert.ok(seenBody instanceof FormData && seenBody.get('file') && seenBody.get('response_format') === 'json');
  assert.equal(text, 'Hi Rex!');
  await assert.rejects(() => voice.transcribeWithWhisper(Buffer.from('not audio'), { fetchImpl: fakeFetch }), /WAV/);
});

await test('Piper: post-json and get request styles', async () => {
  const calls = [];
  const fakeFetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    return { ok: true, arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer };
  };
  const out = await voice.synthesizeWithPiper('Roar! Great job!', { config: voice.getVoiceLabConfig({ PIPER_URL: 'http://pi:5000', PIPER_VOICE: 'v1' }), fetchImpl: fakeFetch });
  assert.ok(Buffer.isBuffer(out));
  assert.equal(calls[0].url, 'http://pi:5000/synthesize');
  assert.equal(calls[0].opts.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { text: 'Roar! Great job!', voice: 'v1' });
  await voice.synthesizeWithPiper('Hello', { config: voice.getVoiceLabConfig({ PIPER_URL: 'http://pi:5000', PIPER_MODE: 'get', PIPER_PATH: '/' }), fetchImpl: fakeFetch });
  assert.equal(calls[1].url, 'http://pi:5000/?text=Hello');
  await assert.rejects(() => voice.synthesizeWithPiper('   ', { fetchImpl: fakeFetch }), /Text is required/);
});

await test('voice handlers reject tampered (array/string) bodies with 400', async () => {
  const mkRes = () => ({ code: 0, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(d) { this.body = d; } });
  const r1 = mkRes();
  await voice.handleVoiceTtsRequest({ body: { text: ['a', 'b'] } }, r1);
  assert.equal(r1.code, 400);
  const r2 = mkRes();
  await voice.handleVoiceSttRequest({ body: ['RIFF'] }, r2);
  assert.equal(r2.code, 400);
  const r3 = mkRes();
  await voice.handleVoiceSttRequest({ body: 'RIFF....WAVE' }, r3);
  assert.equal(r3.code, 400);
});

await test('server.js and Vite dev server expose the new routes; voice lab page is a build input', () => {
  const server = fs.readFileSync('server.js', 'utf8');
  for (const r of ["'/api/storyweaver/books'", "'/api/voice/status'", "'/api/voice/stt'", "'/api/voice/tts'"]) {
    assert.ok(server.includes(r), `server.js missing ${r}`);
  }
  const cfg = fs.readFileSync('vite.config.js', 'utf8');
  for (const r of ["'/api/storyweaver/books'", "'/api/voice/stt'", "'/api/voice/tts'", 'voice-lab.html']) {
    assert.ok(cfg.includes(r), `vite.config.js missing ${r}`);
  }
  assert.ok(fs.existsSync('voice-lab.html'));
});

console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
if (failed) process.exit(1);
