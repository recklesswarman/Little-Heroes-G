// The Cloudflare image Worker and the server's illustration route, with no network.
// Why this exists: on 2026-11-20 Cloudflare retired three image models. The Worker's only fallback was one of
// them, so every picture failed, and the error shown was the fallback's, not the first model's.
import assert from 'node:assert';
import worker, { buildModelOrder, buildModelInput, resultToBytes } from '../cloudflare-worker/worker.js';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}
console.log('image worker');

const FLUX = '@cf/black-forest-labs/flux-1-schnell';
const LIGHTNING = '@cf/bytedance/stable-diffusion-xl-lightning';
const ORIGIN = 'https://little-heroes-quest-8842.web.app';
const jpeg = () => { const b = new Uint8Array(4000); b[0] = 0xff; b[1] = 0xd8; return b; };
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

function call(env, body, { origin = ORIGIN, method = 'POST' } = {}) {
  return worker.fetch(new Request('https://w.example/', {
    method, headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined
  }), env);
}
/** A fake Workers AI binding: `models` maps model id -> function(input) returning a result or throwing. */
function fakeAI(models, log = []) {
  return { run: async (model, input) => { log.push({ model, input }); const fn = models[model]; if (!fn) throw new Error(`5028: ${model} was deprecated on 2026-11-20`); return fn(input); } };
}

await check('the requested model goes first, then the rest of the chain, once each; the old FLUX spelling is mapped', () => {
  const order = buildModelOrder(LIGHTNING);
  assert.strictEqual(order[0], LIGHTNING);
  assert.strictEqual(new Set(order).size, order.length);
  assert.ok(order.includes(FLUX));
  assert.strictEqual(buildModelOrder('@cf/blackforestlabs/flux-1-schnell')[0], FLUX);
});
await check('FLUX gets the long prompt and steps only; the SDXL family gets the short prompt, seed and negatives', () => {
  const args = { prompt: 'LONG '.repeat(600), shortPrompt: 'short one', seed: 9, negative_prompt: 'bad' };
  const f = buildModelInput(FLUX, args);
  assert.deepStrictEqual(Object.keys(f).sort(), ['prompt', 'steps']);
  assert.ok(f.prompt.length <= 2000 && f.steps >= 1 && f.steps <= 8);
  const x = buildModelInput(LIGHTNING, args);
  assert.deepStrictEqual([x.prompt, x.seed, x.negative_prompt], ['short one', 9, 'bad']);
  assert.strictEqual(buildModelInput(LIGHTNING, { prompt: 'only long', seed: 1, negative_prompt: 'n' }).prompt, 'only long');
});
await check('model output is read both ways: FLUX JSON with base64, and a binary stream', async () => {
  const bytes = jpeg();
  assert.strictEqual((await resultToBytes({ image: b64(bytes) })).byteLength, 4000);
  assert.strictEqual((await resultToBytes(new Response(bytes).body)).byteLength, 4000);
});
await check('a working first model: a JSON data URI that names the model, no fallback noted', async () => {
  const log = [];
  const res = await call({ AI: fakeAI({ [FLUX]: () => ({ image: b64(jpeg()) }) }, log) }, { prompt: 'a long detailed prompt', model: FLUX, format: 'base64' });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(body.dataUri.startsWith('data:image/jpeg;base64,'));
  assert.strictEqual(body.model, FLUX);
  assert.strictEqual(body.fallbackFrom, undefined);
  assert.strictEqual(log.length, 1);
});
await check('a retired requested model falls back to the next one and the response says what happened', async () => {
  const log = [];
  const res = await call({ AI: fakeAI({ [FLUX]: () => ({ image: b64(jpeg()) }) }, log) }, { prompt: 'p', shortPrompt: 's', model: LIGHTNING, format: 'base64' });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.model, FLUX);
  assert.strictEqual(body.fallbackFrom[0].model, LIGHTNING);
  assert.ok(/deprecated/.test(body.fallbackFrom[0].error));
  assert.deepStrictEqual(log.map(l => l.model), [LIGHTNING, FLUX]);
});
await check('every model failing returns 502 and lists what EACH model said (not only the last fallback)', async () => {
  const res = await call({ AI: fakeAI({}) }, { prompt: 'p', model: FLUX, format: 'base64' });
  const body = await res.json();
  assert.strictEqual(res.status, 502);
  assert.ok(body.attempts.length >= 4);
  assert.strictEqual(body.attempts[0].model, FLUX);
  for (const a of body.attempts) assert.ok(body.details.includes(a.model), `details mention ${a.model}`);
});
await check('a model that returns almost nothing counts as a failure and the next model is tried', async () => {
  const res = await call({ AI: fakeAI({ [FLUX]: () => ({ image: b64(new Uint8Array(10)) }), [LIGHTNING]: () => new Response(jpeg()).body }) }, { prompt: 'p', model: FLUX, format: 'base64' });
  const body = await res.json();
  assert.strictEqual(body.model, LIGHTNING);
});
await check('raw image format returns bytes with the real type and the model in a header', async () => {
  const res = await call({ AI: fakeAI({ [FLUX]: () => ({ image: b64(jpeg()) }) }) }, { prompt: 'p', model: FLUX, format: 'image' });
  assert.strictEqual(res.headers.get('Content-Type'), 'image/jpeg');
  assert.strictEqual(res.headers.get('X-Image-Model'), FLUX);
  assert.strictEqual((await res.arrayBuffer()).byteLength, 4000);
});
await check('access rules are unchanged: only allowed origins, valid prompt and model, rate limit', async () => {
  const ai = { AI: fakeAI({ [FLUX]: () => ({ image: b64(jpeg()) }) }) };
  assert.strictEqual((await call(ai, { prompt: 'p', model: FLUX }, { origin: 'https://evil.example' })).status, 403);
  assert.strictEqual((await call(ai, { prompt: 'p', model: FLUX }, { origin: null })).status, 403);
  assert.strictEqual((await call(ai, { model: FLUX })).status, 400);
  assert.strictEqual((await call(ai, { prompt: 'x'.repeat(4001), model: FLUX })).status, 400);
  assert.strictEqual((await call(ai, { prompt: 'p', model: '@cf/some/other-model' })).status, 400);
  assert.strictEqual((await call({ ...ai, RATE_LIMITER: { limit: async () => ({ success: false }) } }, { prompt: 'p', model: FLUX })).status, 429);
  assert.strictEqual((await call({}, { prompt: 'p', model: FLUX })).status, 500);
  const health = await call(ai, null, { method: 'GET' });
  assert.deepStrictEqual((await health.json()).models[0], FLUX);
});
await check('the server route: the two scenes of a chapter are separate pictures (the cache key includes the scene)', async () => {
  const { handleStoryIllustrationRequest } = await import('../server/imageGenService.js');
  const realFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ dataUri: `data:image/jpeg;base64,${b64(jpeg())}` }) }; };
  const run = async (extra) => { let out; await handleStoryIllustrationRequest({ body: { sessionId: 's1', chapterIndex: 0, chapterText: 'The child and the dino walked along the glowing hill. They found a lantern under the silver bridge.', realmName: 'Starlight Woods', heroName: 'Ada', petName: 'Rex', format: 'base64', ...extra } }, { json: (o) => { out = o; return o; }, status: () => ({ json: (o) => { out = o; } }) }); return out; };
  try {
    const a = await run({ sceneType: 'scene_a' });
    const b = await run({ sceneType: 'scene_b' });
    const a2 = await run({ sceneType: 'scene_a' });
    assert.ok(a.success && b.success);
    assert.strictEqual(a.cached, undefined, 'first request is generated');
    assert.strictEqual(b.cached, undefined, 'scene B is NOT served scene A\'s cached picture');
    assert.strictEqual(a2.cached, true, 'asking for scene A again is cached');
    assert.strictEqual(sent.length, 2);
    assert.notStrictEqual(sent[0].prompt, sent[1].prompt, 'different prompts for the two scenes');
    assert.strictEqual(sent[0].model, FLUX);
    assert.ok(sent[0].prompt.split(/\s+/).length >= 110, 'the built-in prompt is detailed');
    assert.ok(sent[0].shortPrompt && sent[0].shortPrompt.split(/\s+/).length < 40, 'and a compact one rides along');
    assert.ok(!/\b(pink|purple)\b/i.test(sent[0].prompt), 'no colour is named to be avoided');
  } finally { globalThis.fetch = realFetch; }
});

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all passed');
process.exit(0);
