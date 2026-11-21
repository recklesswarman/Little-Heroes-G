// Verifies the family-Pi offline AI proxy (server/localAiService.js) and its client helper.
import assert from 'node:assert/strict';
import { createLocalAiHandlers, getLocalAiConfig, isFamilyNetworkAddress } from '../server/localAiService.js';

const LAN = { remoteAddress: '::ffff:192.168.1.50' };

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    json(obj) { this.body = obj; return this; },
    send(buf) { this.body = buf; return this; }
  };
}

function okResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => new TextEncoder().encode(String(body)).buffer,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body)
  };
}

const PI_ENV = {
  PIPER_TTS_URL: 'http://pi:5000/',
  WHISPER_URL: 'http://pi:8178',
  NTFY_URL: 'http://pi:8090',
  NTFY_TOPIC: 'pi-alerts'
};

console.log('🧪 Local Pi AI routes');

await test('config trims trailing slashes and sanitises the topic', () => {
  const cfg = getLocalAiConfig({ ...PI_ENV, NTFY_TOPIC: 'pi alerts/../x' });
  assert.equal(cfg.piperUrl, 'http://pi:5000');
  assert.equal(cfg.ntfyTopic, 'pialertsx');
});

await test('every route answers 503 with a fallback when nothing is configured', async () => {
  const h = createLocalAiHandlers({ env: {}, fetchImpl: async () => { throw new Error('should not fetch'); } });
  const tts = mockRes(); await h.handleTts({ socket: LAN, body: { text: 'hi' } }, tts);
  const stt = mockRes(); await h.handleStt({ socket: LAN, body: Buffer.from('x'), headers: {} }, stt);
  const ntf = mockRes(); await h.handleNotify({ socket: LAN, body: { message: 'hi' } }, ntf);
  assert.equal(tts.statusCode, 503); assert.equal(tts.body.fallback, 'web-speech');
  assert.equal(stt.statusCode, 503);
  assert.equal(ntf.statusCode, 503);
});

await test('status reports each service from its health probe', async () => {
  const h = createLocalAiHandlers({
    env: PI_ENV,
    fetchImpl: async (url) => {
      if (url.startsWith('http://pi:8178')) throw new Error('down');
      return okResponse('{}');
    }
  });
  const res = mockRes(); await h.handleStatus({ socket: LAN }, res);
  assert.deepEqual(res.body, { tts: true, stt: false, notify: true });
});

await test('TTS forwards text to Piper /synthesize and returns WAV', async () => {
  let seen;
  const h = createLocalAiHandlers({
    env: PI_ENV,
    fetchImpl: async (url, init) => { seen = { url, init }; return okResponse('RIFFwavdata'); }
  });
  const res = mockRes();
  await h.handleTts({ socket: LAN, body: { text: '  Roar! Ready? ', voice: 'en_US-lessac-medium', length_scale: 1.1 } }, res);
  assert.equal(seen.url, 'http://pi:5000/synthesize');
  assert.deepEqual(JSON.parse(seen.init.body), { text: 'Roar! Ready?', voice: 'en_US-lessac-medium', length_scale: 1.1 });
  assert.equal(res.headers['content-type'], 'audio/wav');
  assert.ok(Buffer.isBuffer(res.body));
});

await test('TTS rejects empty and overly long text, and drops unsafe voice names', async () => {
  let body;
  const h = createLocalAiHandlers({ env: PI_ENV, fetchImpl: async (u, init) => { body = JSON.parse(init.body); return okResponse('RIFF'); } });
  const empty = mockRes(); await h.handleTts({ socket: LAN, body: { text: '   ' } }, empty);
  const long = mockRes(); await h.handleTts({ socket: LAN, body: { text: 'a'.repeat(601) } }, long);
  const unsafe = mockRes(); await h.handleTts({ socket: LAN, body: { text: 'hi', voice: '../../etc/passwd' } }, unsafe);
  assert.equal(empty.statusCode, 400);
  assert.equal(long.statusCode, 413);
  assert.equal(body.voice, undefined);
});

await test('TTS upstream failure becomes 502 with fallback', async () => {
  const h = createLocalAiHandlers({ env: PI_ENV, fetchImpl: async () => okResponse('', { status: 500 }) });
  const res = mockRes(); await h.handleTts({ socket: LAN, body: { text: 'hi' } }, res);
  assert.equal(res.statusCode, 502); assert.equal(res.body.fallback, 'web-speech');
});

await test('STT sends the clip to whisper /inference as multipart and returns clean text', async () => {
  let seen;
  const h = createLocalAiHandlers({
    env: PI_ENV,
    fetchImpl: async (url, init) => { seen = { url, init }; return okResponse({ text: ' Hi,   Rex!\n' }); }
  });
  const res = mockRes();
  await h.handleStt({ socket: LAN, body: Buffer.from('fakeaudio'), headers: { 'content-type': 'audio/webm;codecs=opus' } }, res);
  assert.equal(seen.url, 'http://pi:8178/inference');
  assert.ok(seen.init.body instanceof FormData);
  const file = seen.init.body.get('file');
  assert.equal(file.type, 'audio/webm');
  assert.equal(file.name, 'speech.webm');
  assert.deepEqual(res.body, { text: 'Hi, Rex!' });
});

await test('STT rejects a missing body', async () => {
  const h = createLocalAiHandlers({ env: PI_ENV, fetchImpl: async () => okResponse({}) });
  const res = mockRes(); await h.handleStt({ socket: LAN, body: {}, headers: {} }, res);
  assert.equal(res.statusCode, 400);
});

await test('notify posts to the ntfy topic with header-safe title and tags', async () => {
  let seen;
  const h = createLocalAiHandlers({ env: PI_ENV, fetchImpl: async (url, init) => { seen = { url, init }; return okResponse('{}'); } });
  const res = mockRes();
  await h.handleNotify({ socket: LAN, body: { title: 'Star earned!\r\nX-Evil: 1', message: 'Mia finished brushing 🦷', tags: 'tada, star;rm' } }, res);
  assert.equal(seen.url, 'http://pi:8090/pi-alerts');
  assert.equal(seen.init.headers.Title, 'Star earned! X-Evil: 1');
  assert.equal(seen.init.headers.Tags, 'tada,starrm');
  assert.equal(seen.init.body, 'Mia finished brushing 🦷');
  assert.deepEqual(res.body, { ok: true });
});

await test('family-network check accepts home and Tailscale addresses only', () => {
  for (const ip of ['127.0.0.1', '::1', '::ffff:192.168.1.20', '10.0.0.5', '172.20.1.1', '100.101.102.103', 'fd7a:115c:a1e0::1']) {
    assert.equal(isFamilyNetworkAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '::ffff:203.0.113.9', '172.32.0.1', '100.128.0.1', '2001:db8::1', '', undefined]) {
    assert.equal(isFamilyNetworkAddress(ip), false, String(ip));
  }
});

await test('requests from outside the family network are refused, even with a spoofed X-Forwarded-For', async () => {
  const h = createLocalAiHandlers({ env: PI_ENV, fetchImpl: async () => { throw new Error('should not fetch'); } });
  const outside = { remoteAddress: '203.0.113.9' };
  const xff = { 'x-forwarded-for': '192.168.1.5' };
  const tts = mockRes(); await h.handleTts({ socket: outside, headers: xff, body: { text: 'hi' } }, tts);
  const ntf = mockRes(); await h.handleNotify({ socket: outside, headers: xff, body: { message: 'spam' } }, ntf);
  const st = mockRes(); await h.handleStatus({ socket: outside, headers: xff }, st);
  assert.equal(tts.statusCode, 403);
  assert.equal(ntf.statusCode, 403);
  assert.deepEqual(st.body, { tts: false, stt: false, notify: false });
});

console.log('🧪 Client helper (off the Pi)');

await test('client reports the Pi as unavailable when the status route serves HTML', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => ({}) });
  const mod = await import('../src/services/localVoiceService.js');
  mod.resetLocalAiStatusCache();
  const status = await mod.getLocalAiStatus({ force: true });
  assert.deepEqual({ ...status }, { tts: false, stt: false, notify: false });
  assert.equal(await mod.isLocalVoiceAvailable(), false);
});

await test('client uses the Pi voice when status says TTS is up, unless the parent turned it off', async () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ tts: true, stt: true, notify: true }) });
  const mod = await import('../src/services/localVoiceService.js');
  mod.resetLocalAiStatusCache();
  assert.equal(await mod.isLocalVoiceAvailable(), true);
  mod.setLocalVoicePreferred(false);
  assert.equal(await mod.isLocalVoiceAvailable(), false);
  mod.setLocalVoicePreferred(true);
  assert.equal(await mod.isLocalVoiceAvailable(), true);
});

if (failures > 0) {
  console.error(`\n❌ ${failures} local Pi AI check(s) failed`);
  process.exit(1);
}
console.log('\n✅ All local Pi AI checks passed');
