// Static sites reach App Hosting's API: CORS allows only the family's origins,
// and the client builds absolute API URLs only when VITE_SERVER_API_BASE is https.
import assert from 'node:assert/strict';
import { createApiCors, getAllowedOrigins } from '../server/corsPolicy.js';
import { serverApiUrl, getServerApiBase } from '../src/services/serverApi.js';

let failures = 0;
async function test(name, fn) { try { await fn(); console.log(`  ✅ ${name}`); } catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); } }
function run(mw, req) {
  const res = { headers: {}, statusCode: 200, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, end() { this.ended = true; return this; } };
  let nexted = false; mw(req, res, () => { nexted = true; });
  return { res, nexted };
}

console.log('🧪 Static sites -> App Hosting API');
const cors = createApiCors({ env: {} });

await test('allows the GitHub Pages and Firebase Hosting origins', () => {
  for (const origin of ['https://recklesswarman.github.io', 'https://little-heroes-quest-8842.web.app', 'https://little-heroes-quest-8842.firebaseapp.com']) {
    const { res, nexted } = run(cors, { method: 'POST', headers: { origin } });
    assert.equal(res.headers['access-control-allow-origin'], origin); assert.equal(nexted, true);
  }
});
await test('answers preflight for allowed origins with 204', () => {
  const { res, nexted } = run(cors, { method: 'OPTIONS', headers: { origin: 'https://recklesswarman.github.io' } });
  assert.equal(res.statusCode, 204); assert.equal(nexted, false);
});
await test('gives other sites no CORS headers and rejects their preflight', () => {
  const evil = run(cors, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(evil.res.headers['access-control-allow-origin'], undefined);
  const pre = run(cors, { method: 'OPTIONS', headers: { origin: 'https://recklesswarman.github.io.evil.example' } });
  assert.equal(pre.res.statusCode, 403);
});
await test('same-origin requests pass straight through', () => {
  const { res, nexted } = run(cors, { method: 'POST', headers: {} });
  assert.equal(nexted, true); assert.equal(res.headers['access-control-allow-origin'], undefined);
});
await test('CORS_ALLOWED_ORIGINS overrides the list and drops non-https entries', () => {
  assert.deepEqual([...getAllowedOrigins({ CORS_ALLOWED_ORIGINS: 'https://a.example/, http://b.example, https://c.example/path' })], ['https://a.example']);
});
await test('client uses same-origin paths when no API base is built in', () => {
  assert.equal(getServerApiBase(), '');
  assert.equal(serverApiUrl('/api/gemini/chat'), '/api/gemini/chat');
  assert.equal(serverApiUrl('api/notify'), '/api/notify');
});

if (failures) { console.error(`\n❌ ${failures} check(s) failed`); process.exit(1); }
console.log('\n✅ All static-site API checks passed');
