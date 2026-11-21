// App Hosting -> Pi voice relay (token-gated), the Pi's proxy detection, and the Umami loader.
import assert from 'node:assert/strict';
import { createPiRelayHandlers, getPiRelayConfig } from '../server/piRelayService.js';
import { createLocalAiHandlers, isFamilyNetworkRequest, hasValidRelayToken } from '../server/localAiService.js';
import { getUmamiConfig, initAnalytics } from '../src/services/analyticsService.js';

let failures = 0;
async function test(name, fn) { try { await fn(); console.log(`  ✅ ${name}`); } catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); } }
function mockRes() {
  return { statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    json(o) { this.body = o; return this; }, send(b) { this.body = b; return this; } };
}
const TOKEN = 'r'.repeat(40);
const RELAY_ENV = { PI_RELAY_URL: 'https://meshlink.example.ts.net/pi-voice/', PI_RELAY_TOKEN: TOKEN };
const ok = (body, extra = {}) => ({ ok: true, status: 200, json: async () => body, arrayBuffer: async () => new TextEncoder().encode('RIFFwav').buffer, ...extra });

console.log('🧪 Pi voice relay (App Hosting side)');

await test('relay config needs an https URL and a long token', () => {
  assert.equal(getPiRelayConfig({}), null);
  assert.equal(getPiRelayConfig({ PI_RELAY_URL: 'http://x', PI_RELAY_TOKEN: TOKEN }), null);
  assert.equal(getPiRelayConfig({ PI_RELAY_URL: 'https://x', PI_RELAY_TOKEN: 'short' }), null);
  assert.deepEqual(getPiRelayConfig(RELAY_ENV), { url: 'https://meshlink.example.ts.net/pi-voice', token: TOKEN });
});

await test('status, TTS and STT go to the Pi with the bearer token', async () => {
  const calls = [];
  const h = createPiRelayHandlers({ env: RELAY_ENV, fetchImpl: async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization, type: init.headers['Content-Type'] });
    if (url.endsWith('/status')) return ok({ tts: true, stt: true });
    if (url.endsWith('/stt')) return ok({ text: ' Hi Rex ' });
    return ok({});
  } });
  const st = mockRes(); await h.handleLocalStatus({}, st);
  const tts = mockRes(); await h.handleLocalTts({ body: { text: 'Roar!' } }, tts);
  const stt = mockRes(); await h.handleLocalStt({ body: Buffer.from('wav'), headers: { 'content-type': 'audio/wav' } }, stt);
  assert.deepEqual(st.body, { tts: true, stt: true });
  assert.equal(tts.headers['content-type'], 'audio/wav');
  assert.deepEqual(stt.body, { text: 'Hi Rex' });
  assert.deepEqual(calls.map((c) => c.url), [
    'https://meshlink.example.ts.net/pi-voice/status',
    'https://meshlink.example.ts.net/pi-voice/tts',
    'https://meshlink.example.ts.net/pi-voice/stt'
  ]);
  assert.ok(calls.every((c) => c.auth === `Bearer ${TOKEN}`));
  assert.equal(calls[2].type, 'audio/wav');
});

await test('Pi offline -> status false and voice routes answer with a Web Speech fallback', async () => {
  const h = createPiRelayHandlers({ env: RELAY_ENV, fetchImpl: async () => { throw new Error('offline'); } });
  const st = mockRes(); await h.handleLocalStatus({}, st);
  const tts = mockRes(); await h.handleLocalTts({ body: { text: 'hi' } }, tts);
  const lab = mockRes(); await h.handleVoiceStatus({}, lab);
  assert.deepEqual(st.body, { tts: false, stt: false });
  assert.equal(tts.statusCode, 502); assert.equal(tts.body.fallback, 'web-speech');
  assert.equal(lab.body.piper.reachable, false);
});

await test('voice lab routes keep their own response shape', async () => {
  const h = createPiRelayHandlers({ env: RELAY_ENV, fetchImpl: async (url) => (url.endsWith('/stt') ? ok({ text: 'hello' }) : ok({ tts: true, stt: false })) });
  const st = mockRes(); await h.handleVoiceStatus({}, st);
  const stt = mockRes(); await h.handleVoiceStt({ body: Buffer.from('wav'), headers: { 'content-type': 'audio/wav' } }, stt);
  assert.equal(st.body.ok, true); assert.equal(st.body.piper.reachable, true); assert.equal(st.body.whisper.reachable, false);
  assert.deepEqual(stt.body, { ok: true, text: 'hello' });
});

await test('relay rejects empty, non-buffer and oversized audio before calling the Pi', async () => {
  let called = false;
  const h = createPiRelayHandlers({ env: RELAY_ENV, fetchImpl: async () => { called = true; return ok({}); } });
  const a = mockRes(); await h.handleLocalStt({ body: 'text', headers: {} }, a);
  const b = mockRes(); await h.handleLocalStt({ body: Buffer.alloc(9 * 1024 * 1024), headers: {} }, b);
  const c = mockRes(); await h.handleLocalTts({ body: { text: 'x'.repeat(601) } }, c);
  assert.equal(a.statusCode, 400); assert.equal(b.statusCode, 413); assert.equal(c.statusCode, 413); assert.equal(called, false);
});

await test('relay caps concurrent and hourly Pi work, then falls back', async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  let t = 0;
  const h = createPiRelayHandlers({ env: RELAY_ENV, now: () => t, fetchImpl: async () => { await slow; return ok({}); } });
  const a = mockRes(); const b = mockRes(); const c = mockRes();
  const pa = h.handleLocalTts({ body: { text: 'one' } }, a);
  const pb = h.handleLocalTts({ body: { text: 'two' } }, b);
  await h.handleLocalTts({ body: { text: 'three' } }, c);
  assert.equal(c.statusCode, 429); assert.equal(c.body.fallback, 'web-speech');
  release(); await pa; await pb;
  assert.equal(a.statusCode, 200); assert.equal(b.statusCode, 200);
});

console.log('🧪 Pi side: Funnel traffic needs the relay token');

await test('requests through Funnel/Serve or any proxy are not treated as the family LAN', () => {
  const loop = { remoteAddress: '127.0.0.1' };
  assert.equal(isFamilyNetworkRequest({ socket: loop, headers: {} }), true);
  assert.equal(isFamilyNetworkRequest({ socket: loop, headers: { 'tailscale-funnel-request': '?1' } }), false);
  assert.equal(isFamilyNetworkRequest({ socket: loop, headers: { 'x-forwarded-for': '203.0.113.5' } }), false);
});

await test('the relay token unlocks Pi routes for Funnel traffic; a wrong one does not', async () => {
  const env = { PIPER_URL: 'http://pi:5000', LOCAL_AI_RELAY_TOKEN: TOKEN };
  const h = createLocalAiHandlers({ env, fetchImpl: async () => ok({}) });
  const funnel = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'tailscale-funnel-request': '?1' } };
  const good = mockRes(); await h.handleTts({ ...funnel, headers: { ...funnel.headers, authorization: `Bearer ${TOKEN}` }, body: { text: 'hi' } }, good);
  const bad = mockRes(); await h.handleTts({ ...funnel, headers: { ...funnel.headers, authorization: 'Bearer wrong' }, body: { text: 'hi' } }, bad);
  const none = mockRes(); await h.handleTts({ ...funnel, body: { text: 'hi' } }, none);
  assert.equal(good.statusCode, 200); assert.equal(bad.statusCode, 403); assert.equal(none.statusCode, 403);
  assert.equal(hasValidRelayToken({ headers: { authorization: `Bearer ${TOKEN}` } }, { LOCAL_AI_RELAY_TOKEN: 'short' }), false);
});

console.log('🧪 Umami loader');

await test('loads only with an https host and a website id, once', () => {
  assert.equal(getUmamiConfig({ VITE_UMAMI_HOST: 'https://x/umami' }), null);
  assert.equal(getUmamiConfig({ VITE_UMAMI_HOST: 'http://x/umami', VITE_UMAMI_WEBSITE_ID: '0f8a7c2e-1b2c-4d5e-8f90-123456789abc' }), null);
  const cfg = getUmamiConfig({ VITE_UMAMI_HOST: 'https://x.ts.net/umami/', VITE_UMAMI_WEBSITE_ID: '0f8a7c2e-1b2c-4d5e-8f90-123456789abc' });
  const appended = [];
  const doc = { head: { appendChild: (el) => appended.push(el) }, getElementById: () => (appended.length ? appended[0] : null),
    createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }) };
  assert.equal(initAnalytics(cfg, doc), true);
  assert.equal(initAnalytics(cfg, doc), false);
  assert.equal(appended[0].src, 'https://x.ts.net/umami/script.js');
  assert.equal(appended[0].attrs['data-host-url'], 'https://x.ts.net/umami');
  assert.equal(appended[0].attrs['data-do-not-track'], 'true');
  assert.equal(initAnalytics(null, doc), false);
});

if (failures) { console.error(`\n❌ ${failures} check(s) failed`); process.exit(1); }
console.log('\n✅ All Pi relay and analytics checks passed');
