import assert from 'node:assert';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import worker from '../cloudflare-worker/worker.js';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}

const ALLOWED = 'https://little-heroes-quest-8842.web.app';
const aiCalls = [];
const env = {
  AI: { run: async (model, opts) => { aiCalls.push({ model, opts }); return new Uint8Array([0xff, 0xd8, 0xff]); } }
};

const post = (body, headers = {}, e = env) => worker.fetch(new Request('https://w.example/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
}), e);

console.log('cloudflare worker origin access control');

await check('allowed origin works with no Authorization header', async () => {
  const res = await post({ prompt: 'a cozy star' }, { Origin: ALLOWED });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), ALLOWED);
});
await check('missing origin is rejected', async () => {
  const before = aiCalls.length;
  const res = await post({ prompt: 'a cozy star' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(aiCalls.length, before);
});
await check('disallowed origin is rejected and gets no CORS grant', async () => {
  const res = await post({ prompt: 'x' }, { Origin: 'https://evil.example' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), null);
});
await check('CORS never returns *', async () => {
  const pre = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: ALLOWED } }), env);
  assert.strictEqual(pre.status, 204);
  assert.notStrictEqual(pre.headers.get('Access-Control-Allow-Origin'), '*');
  const bad = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.strictEqual(bad.status, 403);
});
await check('old clients sending an Authorization header still work', async () => {
  const res = await post({ prompt: 'a cozy star' }, { Origin: ALLOWED, Authorization: 'Bearer anything' });
  assert.strictEqual(res.status, 200);
});
await check('unknown model and oversized prompt are rejected', async () => {
  assert.strictEqual((await post({ prompt: 'x', model: '@cf/evil/model' }, { Origin: ALLOWED })).status, 400);
  assert.strictEqual((await post({ prompt: 'x'.repeat(4001) }, { Origin: ALLOWED })).status, 400);
});
await check('ALLOWED_ORIGINS env overrides the defaults', async () => {
  const custom = { ...env, ALLOWED_ORIGINS: 'https://only.example' };
  assert.strictEqual((await post({ prompt: 'x' }, { Origin: 'https://only.example' }, custom)).status, 200);
  assert.strictEqual((await post({ prompt: 'x' }, { Origin: ALLOWED }, custom)).status, 403);
});
await check('rate limiter binding returns 429 when exceeded', async () => {
  const limited = { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await post({ prompt: 'x' }, { Origin: ALLOWED }, limited);
  assert.strictEqual(res.status, 429);
});

await check('no committed source contains the old shared key', () => {
  const skip = new Set(['node_modules', '.git', 'dist', 'lib']);
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.size < 2_000_000 && !p.endsWith('verify_cloudflare_worker_origin.mjs')) {
        if (readFileSync(p, 'utf8').includes('little-heroes-secret' + '-key')) hits.push(p);
      }
    }
  };
  walk('.');
  assert.deepStrictEqual(hits, []);
});
await check('built bundle (if present) does not contain the old key', () => {
  if (!existsSync('dist')) return;
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|json)$/.test(p) && readFileSync(p, 'utf8').includes('little-heroes-secret' + '-key')) hits.push(p);
    }
  };
  walk('dist');
  assert.deepStrictEqual(hits, []);
});

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all passed');
