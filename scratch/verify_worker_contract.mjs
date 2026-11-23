// Worker contract for the 3D Studio features: "Change it" edits, background cutout, Phoenix, /health features.
// No network: Workers AI and the Images binding are faked.
import assert from 'node:assert';
import worker, { parseEditImage, buildEditPrompt, buildPhoenixInput, cutoutBytes } from '../cloudflare-worker/worker.js';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}
console.log('worker contract');

const K4 = '@cf/black-forest-labs/flux-2-klein-4b';
const K9 = '@cf/black-forest-labs/flux-2-klein-9b';
const PHOENIX = '@cf/leonardo/phoenix-1.0';
const ORIGIN = 'https://little-heroes-quest-8842.web.app';
const png = (n = 4000) => { const b = new Uint8Array(n); b[0] = 0x89; b[1] = 0x50; return b; };
const dataUri = (bytes, type = 'image/png') => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const call = (env, body, path = '/') => worker.fetch(new Request(`https://w.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify(body)
}), env);
const fakeAI = (models, log = []) => ({ run: async (model, input) => { log.push({ model, input }); const fn = models[model]; if (!fn) throw new Error('no such model'); return fn(input); } });
const fakeImages = (outBytes, fail = false) => ({ input: () => ({ transform: () => ({ output: async () => { if (fail) throw new Error('boom'); return { response: () => new Response(outBytes) }; } }) }) });

await check('parseEditImage accepts a PNG data URI and rejects junk / oversize', () => {
  assert.ok(parseEditImage(dataUri(png())));
  assert.strictEqual(parseEditImage('not a data uri'), null);
  assert.strictEqual(parseEditImage(dataUri(png(10))), null);
  assert.strictEqual(parseEditImage(dataUri(png(2 * 1024 * 1024 + 10))), null);
});

await check('edit prompt keeps the object, framing and clay style', () => {
  const p = buildEditPrompt('make it blue');
  assert.ok(p.startsWith('Edit this picture: make it blue'));
  assert.ok(/same object, framing, plain background and soft 3D clay toy style/.test(p));
});

await check('phoenix input is JSON with prompt, guidance, size and steps', () => {
  const i = buildPhoenixInput({ prompt: 'a sign that says GO', seed: 7, negative_prompt: 'scary' });
  assert.strictEqual(i.prompt, 'a sign that says GO');
  assert.ok(i.guidance && i.num_steps && i.width && i.height);
});

await check('/health lists features; cutout only when the Images binding exists', async () => {
  const get = (env) => worker.fetch(new Request('https://w.example/health', { headers: { Origin: ORIGIN } }), env).then(r => r.json());
  const without = await get({});
  assert.ok(without.features.includes('edit') && !without.features.includes('cutout'));
  const withImg = await get({ IMAGES: fakeImages(png()) });
  assert.ok(withImg.features.includes('cutout'));
});

await check('edit with quality=high uses klein 9B first and sends the picture', async () => {
  const log = [];
  const env = { AI: fakeAI({ [K9]: () => png() }, log) };
  const res = await call(env, { prompt: 'make it blue', mode: 'edit', image: dataUri(png()), quality: 'high', format: 'json' });
  assert.strictEqual(res.status, 200);
  const j = await res.json();
  assert.strictEqual(j.model, K9);
  assert.strictEqual(j.edited, true);
  assert.deepStrictEqual(log.map(l => l.model), [K9]);
});

await check('edit falls back from 9B to 4B', async () => {
  const log = [];
  const env = { AI: fakeAI({ [K4]: () => png() }, log) };
  const j = await (await call(env, { prompt: 'add stars', mode: 'edit', image: dataUri(png()), quality: 'high', format: 'json' })).json();
  assert.strictEqual(j.model, K4);
  assert.deepStrictEqual(log.map(l => l.model), [K9, K4]);
  assert.ok(j.fallbackFrom && j.fallbackFrom[0].model === K9);
});

await check('edit never falls back to text-only generation: 502 with attempts', async () => {
  const log = [];
  const env = { AI: fakeAI({ '@cf/black-forest-labs/flux-1-schnell': () => png() }, log) };
  const res = await call(env, { prompt: 'x', mode: 'edit', image: dataUri(png()), format: 'json' });
  assert.strictEqual(res.status, 502);
  const j = await res.json();
  assert.ok(Array.isArray(j.attempts) && j.attempts.length >= 1);
  assert.ok(!log.some(l => l.model.includes('flux-1-schnell')));
});

await check('edit without a usable image is a 400', async () => {
  const res = await call({ AI: fakeAI({}) }, { prompt: 'x', mode: 'edit' });
  assert.strictEqual(res.status, 400);
});

await check('cutout:true returns a webp with cutout:true; failure keeps the original with cutout:false', async () => {
  const cut = png(3000);
  const ok = await (await call({ AI: fakeAI({ [K4]: () => png() }), IMAGES: fakeImages(cut) },
    { prompt: 'x', mode: 'edit', image: dataUri(png()), cutout: true, format: 'json' })).json();
  assert.strictEqual(ok.cutout, true);
  assert.strictEqual(ok.mimeType, 'image/webp');
  const bad = await (await call({ AI: fakeAI({ [K4]: () => png() }), IMAGES: fakeImages(cut, true) },
    { prompt: 'x', mode: 'edit', image: dataUri(png()), cutout: true, format: 'json' })).json();
  assert.strictEqual(bad.cutout, false);
  assert.notStrictEqual(bad.mimeType, 'image/webp');
});

await check('POST /cutout works, and degrades to the original with no binding', async () => {
  const j = await (await call({ IMAGES: fakeImages(png(3000)) }, { image: dataUri(png()) }, '/cutout')).json();
  assert.strictEqual(j.cutout, true);
  const k = await (await call({}, { image: dataUri(png()) }, '/cutout')).json();
  assert.strictEqual(k.cutout, false);
  const r = await cutoutBytes({}, png());
  assert.strictEqual(r.cutout, false);
});

await check('phoenix is an allowed model and gets the JSON input', async () => {
  const log = [];
  const env = { AI: fakeAI({ [PHOENIX]: () => png() }, log) };
  const res = await call(env, { prompt: 'a sign that says GO', model: PHOENIX, format: 'json' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(log[0].model, PHOENIX);
  assert.ok(log[0].input.num_steps);
});

await check('/cutout from a disallowed origin is refused', async () => {
  const res = await worker.fetch(new Request('https://w.example/cutout', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), {});
  assert.strictEqual(res.status, 403);
});

if (failed) { console.error(`${failed} worker contract check(s) failed`); process.exit(1); }
console.log('worker contract: all passed');
