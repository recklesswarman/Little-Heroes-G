// AI hero agent relay: server.js forwards /api/rex/* to the AGY Cloud Run service so
// every host (Pi, App Hosting, and the static sites through VITE_SERVER_API_BASE) works.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { createRexRelay, getRexRelayConfig, DEFAULT_AGY_REX_SERVICE_URL } from '../server/rexAgyRelay.js';
import { rexUrl } from '../src/services/serverApi.js';

let failures = 0;
async function test(name, fn) { try { await fn(); console.log(`  ✅ ${name}`); } catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); } }
function mockRes() {
  return { statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    json(o) { this.body = o; return this; }, send(b) { this.body = b; return this; } };
}
function mockReq(method, path, body, type = 'application/json') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  return Object.assign(req, { method, path, headers: { 'content-type': type } });
}
const upstreamOk = (obj) => ({ status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(obj) });

console.log('🧪 AI hero agent relay (/api/rex -> AGY Cloud Run)');

await test('config defaults to the deployed service, honours overrides and "off"', () => {
  assert.deepEqual(getRexRelayConfig({}), { url: DEFAULT_AGY_REX_SERVICE_URL });
  assert.deepEqual(getRexRelayConfig({ AGY_REX_SERVICE_URL: 'https://rex.example.run.app/' }), { url: 'https://rex.example.run.app' });
  assert.equal(getRexRelayConfig({ AGY_REX_SERVICE_URL: 'off' }), null);
  assert.equal(getRexRelayConfig({ AGY_REX_SERVICE_URL: 'http://insecure.example' }), null);
});

await test('chat JSON body is forwarded unchanged and the reply comes back', async () => {
  const calls = [];
  const relay = createRexRelay({ env: {}, fetchImpl: async (url, init) => { calls.push({ url, init }); return upstreamOk({ reply: 'Rawr!' }); } });
  const res = mockRes();
  await relay(mockReq('POST', '/chat', '{"message":"hi"}'), res, () => assert.fail('next() called'));
  assert.equal(calls[0].url, `${DEFAULT_AGY_REX_SERVICE_URL}/api/rex/chat`);
  assert.equal(calls[0].init.body.toString(), '{"message":"hi"}');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { reply: 'Rawr!' });
  assert.equal(res.headers['cache-control'], 'no-store');
});

await test('multipart audio passes through with its boundary', async () => {
  let seen;
  const relay = createRexRelay({ env: {}, fetchImpl: async (url, init) => { seen = { url, init }; return upstreamOk({ reply: 'heard you' }); } });
  const type = 'multipart/form-data; boundary=abc';
  await relay(mockReq('POST', '/audio', '--abc\r\nAUDIO\r\n--abc--', type), mockRes(), () => {});
  assert.ok(seen.url.endsWith('/api/rex/audio'));
  assert.equal(seen.init.headers['Content-Type'], type);
  assert.ok(seen.init.body.toString().includes('AUDIO'));
});

await test('bedtime-story and unknown paths fall through to the next handler', async () => {
  const relay = createRexRelay({ env: {}, fetchImpl: async () => assert.fail('should not fetch') });
  let nexts = 0;
  await relay(mockReq('POST', '/bedtime-story', '{}'), mockRes(), () => nexts++);
  await relay(mockReq('POST', '/agent', '{}'), mockRes(), () => nexts++);
  await relay(mockReq('GET', '/chat'), mockRes(), () => nexts++);
  assert.equal(nexts, 3);
});

await test('upstream down -> 502 JSON so the client uses its fallback', async () => {
  const relay = createRexRelay({ env: {}, fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  const res = mockRes();
  await relay(mockReq('POST', '/proactive', '{}'), res, () => {});
  assert.equal(res.statusCode, 502);
  assert.ok(res.body.error);
});

await test('relay off -> 503; wrong content type -> 415', async () => {
  const off = createRexRelay({ env: { AGY_REX_SERVICE_URL: 'off' }, fetchImpl: async () => assert.fail() });
  const r1 = mockRes(); await off(mockReq('POST', '/chat', '{}'), r1, () => {});
  assert.equal(r1.statusCode, 503);
  const on = createRexRelay({ env: {}, fetchImpl: async () => assert.fail() });
  const r2 = mockRes(); await on(mockReq('POST', '/chat', 'x', 'text/plain'), r2, () => {});
  assert.equal(r2.statusCode, 415);
});

await test('client builds /api/rex URLs through the server API helper', () => {
  assert.equal(rexUrl('/api/rex/chat'), '/api/rex/chat');
  const src = readFileSync(new URL('../src/services/heroAgentService.js', import.meta.url), 'utf8');
  assert.ok(!/:\s*'\/api\/rex\//.test(src), 'heroAgentService still has a hard-coded relative /api/rex path');
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(server.indexOf("app.use('/api/rex'") < server.indexOf('app.use(express.json'), 'relay must mount before express.json');
});

if (failures) { console.error(`\n❌ ${failures} rex relay test(s) failed`); process.exit(1); }
console.log('\n✅ AI hero agent relay tests passed');
