// Pi voice extras: Kokoro reads bedtime chapters ahead of time (with word timings) and Moonshine
// checks Read-Along reading. Piper, Whisper and the browser voice stay as fallbacks.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { createStoryAudioService, getStoryAudioConfig, storyAudioId, cleanWordTimings } from '../server/storyAudioService.js';
import { createLocalAiHandlers, getLocalAiConfig } from '../server/localAiService.js';
import { createPiRelayHandlers } from '../server/piRelayService.js';
import { prepareStoryAudio, readyStoryAudio, wordIndexAt, matchSpokenWord, _resetStoryAudio } from '../src/services/storyAudioService.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}
const wav = () => Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVE'), Buffer.alloc(2000)]).toString('base64');
const fakeRes = () => {
  const r = { statusCode: 200, headers: {}, body: null, file: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.sendFile = (f) => { r.file = f; return r; };
  return r;
};
const lanReq = (extra = {}) => ({ socket: { remoteAddress: '192.168.1.20' }, headers: {}, ...extra });
const tick = () => new Promise((r) => setTimeout(r, 20));

await test('Kokoro is on only on the Pi, and can be turned off', () => {
  assert.equal(getStoryAudioConfig({}).kokoroUrl, '', 'hosted / static: off');
  assert.equal(getStoryAudioConfig({ PIPER_URL: 'http://127.0.0.1:5000' }).kokoroUrl, 'http://127.0.0.1:5010');
  assert.equal(getStoryAudioConfig({ PIPER_URL: 'x', KOKORO_URL: 'off' }).kokoroUrl, '');
  assert.equal(getStoryAudioConfig({ KOKORO_VOICE: '../bad' }).voice, 'af_heart');
  assert.equal(getLocalAiConfig({ PIPER_URL: 'http://p' }).moonshineUrl, 'http://127.0.0.1:5010');
  assert.equal(getLocalAiConfig({}).moonshineUrl, '');
  assert.equal(storyAudioId('Hello  there.'), storyAudioId('Hello there.'));
  assert.match(storyAudioId('x'), /^[a-f0-9]{24}$/);
});

await test('word timings are checked', () => {
  assert.deepEqual(cleanWordTimings([['Once', 0.1, 0.4], ['bad'], ['upon', 0.4, 0.7], ['back', 0.2, 0.3], [5, 1, 2], ['a', 0.8, 0.9]]),
    [['Once', 0.1, 0.4], ['upon', 0.4, 0.7], ['a', 0.8, 0.9]]);
  assert.deepEqual(cleanWordTimings('nope'), []);
});

await test('chapters are read in the background, kept on the Pi and served to the family', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-audio-'));
  const calls = [];
  let fail = false;
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (fail) return { ok: false, status: 500 };
    return { ok: true, json: async () => ({ wav: wav(), words: [['Once', 0.1, 0.3], ['upon', 0.3, 0.6]], duration: 0.8 }) };
  };
  let t = 1000;
  const env = { PIPER_URL: 'http://127.0.0.1:5000', STORY_AUDIO_DIR: dir };
  const svc = createStoryAudioService({ env, fetchImpl, now: () => t });
  let res = fakeRes();
  await svc.handleRequest(lanReq({ body: { text: 'Once upon a time.' } }), res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.status, 'rendering');
  const id = res.body.id;
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:5010/kokoro');
  assert.equal(calls[0].body.voice, 'af_heart');
  res = fakeRes();
  await svc.handleRequest(lanReq({ body: { text: 'Once upon a time.' } }), res);
  assert.deepEqual(res.body, { status: 'ready', id, words: [['Once', 0.1, 0.3], ['upon', 0.3, 0.6]], duration: 0.8 });
  assert.equal(calls.length, 1, 'read once');
  res = fakeRes();
  svc.handleAudio(lanReq({ params: { id } }), res);
  assert.equal(res.file, path.join(dir, `${id}.wav`));
  assert.equal(res.headers['content-type'], 'audio/wav');
  res = fakeRes();
  svc.handleAudio(lanReq({ params: { id: '../../etc' } }), res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await svc.handleRequest({ socket: { remoteAddress: '8.8.8.8' }, headers: {}, body: { text: 'x' } }, res);
  assert.equal(res.statusCode, 403, 'family network only');
  fail = true;
  assert.equal(svc.request('A different chapter.').status, 'rendering');
  await tick();
  assert.equal(svc.request('A different chapter.').status, 'failed', 'then Piper / browser voice');
  t += 11 * 60 * 1000;
  assert.equal(svc.request('A different chapter.').status, 'rendering', 'tries again later');
  assert.equal(createStoryAudioService({ env: {} }).request('hi').status, 'off');
});

await test('the routes work through Express (including the .wav path)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-audio-'));
  const env = { PIPER_URL: 'x', STORY_AUDIO_DIR: dir, LOCAL_AI_ALLOW_ANY_NETWORK: 'true' };
  const svc = createStoryAudioService({ env, fetchImpl: async () => ({ ok: true, json: async () => ({ wav: wav(), words: [], duration: 1 }) }) });
  const app = express();
  app.use(express.json());
  app.post('/api/local/story-audio', svc.handleRequest);
  app.get('/api/local/story-audio/:id.wav', svc.handleAudio);
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = () => fetch(`${base}/api/local/story-audio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'The moon smiled.' }) }).then((r) => r.json());
    const first = await post();
    await tick();
    const second = await post();
    assert.equal(second.status, 'ready');
    const audio = await fetch(`${base}/api/local/story-audio/${first.id}.wav`);
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get('content-type'), 'audio/wav');
  } finally {
    server.close();
  }
});

await test('Read-Along: Moonshine first, Whisper when Moonshine is missing', async () => {
  const urls = [];
  let moonshineUp = true;
  const fetchImpl = async (url) => {
    urls.push(url);
    if (url.endsWith('/moonshine')) return moonshineUp ? { ok: true, json: async () => ({ text: ' the cat  sat ' }) } : { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, json: async () => ({ text: 'the cat sat' }) };
  };
  const h = createLocalAiHandlers({ env: { PIPER_URL: 'http://p', WHISPER_CPP_URL: 'http://w' }, fetchImpl });
  const req = () => lanReq({ body: Buffer.from('audio-bytes'), headers: { 'content-type': 'audio/webm' } });
  let res = fakeRes();
  await h.handleSttFast(req(), res);
  assert.deepEqual(res.body, { text: 'the cat sat', engine: 'moonshine' });
  moonshineUp = false;
  res = fakeRes();
  await h.handleSttFast(req(), res);
  assert.deepEqual(res.body, { text: 'the cat sat' });
  assert.ok(urls.at(-1).endsWith('/inference'), 'whisper took over');
  urls.length = 0;
  res = fakeRes();
  await h.handleStt(req(), res, () => {});
  assert.ok(!urls.some((u) => u.endsWith('/moonshine')), 'Rex chat keeps Whisper');
});

await test('App Hosting relays story audio and the fast reading check to the Pi', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, auth: init.headers.Authorization });
    if (url.endsWith('/story-audio')) return { ok: true, status: 200, json: async () => ({ status: 'ready', id: 'a'.repeat(24), words: [['Hi', 0, 0.2]], duration: 0.3 }) };
    if (url.endsWith('.wav')) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer };
    if (url.endsWith('/stt-fast')) return { ok: true, status: 200, json: async () => ({ text: 'hi' }) };
    return { ok: false, status: 404 };
  };
  const relay = createPiRelayHandlers({ env: { PI_RELAY_URL: 'https://pi.example/pi-voice', PI_RELAY_TOKEN: 't'.repeat(32) }, fetchImpl });
  let res = fakeRes();
  await relay.handleStoryAudio({ body: { text: 'Hi.' } }, res);
  assert.equal(res.body.status, 'ready');
  assert.equal(seen[0].url, 'https://pi.example/pi-voice/story-audio');
  assert.equal(seen[0].auth, `Bearer ${'t'.repeat(32)}`);
  res = fakeRes();
  await relay.handleStoryAudioFile({ params: { id: 'a'.repeat(24) } }, res);
  assert.equal(res.headers['content-type'], 'audio/wav');
  res = fakeRes();
  await relay.handleStoryAudioFile({ params: { id: 'nope' } }, res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await relay.handleLocalSttFast({ body: Buffer.from('x'), headers: { 'content-type': 'audio/webm' } }, res);
  assert.deepEqual(res.body, { text: 'hi' });
  res = fakeRes();
  await createPiRelayHandlers({ env: {} }).handleStoryAudio({ body: { text: 'x' } }, res);
  assert.equal(res.body.status, 'off');
});

await test('browser: asks the Pi early, follows the words, falls back when not ready', async () => {
  _resetStoryAudio();
  let n = 0;
  const fetchImpl = async () => {
    n++;
    const body = n < 3 ? { status: 'rendering', id: 'b'.repeat(24) } : { status: 'ready', id: 'b'.repeat(24), words: [['Once', 0.1, 0.3], ['upon', 0.3, 0.6], ['a', 0.6, 0.7]], duration: 1 };
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => body };
  };
  assert.equal(readyStoryAudio('Once upon a'), null);
  const out = await prepareStoryAudio('Once upon a', { fetchImpl, pollMs: 1 });
  assert.equal(out.status, 'ready');
  assert.equal(n, 3, 'kept checking until ready');
  assert.equal(readyStoryAudio('Once  upon a').id, 'b'.repeat(24));
  assert.equal(wordIndexAt(out.words, 0), -1);
  assert.equal(wordIndexAt(out.words, 0.35), 1);
  assert.equal(wordIndexAt(out.words, 5), 2);
  assert.equal(matchSpokenWord(['Chapter', 'One', 'Once', 'upon'], 0, 'once'), 2, 'skips the title');
  assert.equal(matchSpokenWord(['Once', 'upon'], 2, 'once'), -1);
  assert.equal(matchSpokenWord(["Rex's", 'hat'], 0, 'Rex’s'), 0);
  _resetStoryAudio();
  assert.equal((await prepareStoryAudio('x', { fetchImpl: async () => { throw new Error('offline'); } })).status, 'off');
  const story = fs.readFileSync(new URL('../src/services/bedtimeStoryService.js', import.meta.url), 'utf8');
  assert.ok(story.includes('speakStoryChapter(text, narratorPetId') && story.includes('prepareStoryAudio('));
  const view = fs.readFileSync(new URL('../src/views/BedtimeStoryView.js', import.meta.url), 'utf8');
  assert.equal((view.match(/speakStoryChapter\(textToRead/g) || []).length, 2);
  assert.ok(view.includes('bedtime-story-word') && view.includes('data-story-words'));
  const panel = fs.readFileSync(new URL('../src/views/readAlongPanel.js', import.meta.url), 'utf8');
  assert.ok(panel.includes('recordAndTranscribe({ maxMs, fast: true })'));
});

await test('Pi service: word timings from Kokoro (stub models), setup and service files', () => {
  const out = execFileSync('python3', ['-I', 'scratch/fixtures/check_voice_extras.py'], { encoding: 'utf8' });
  assert.ok(out.includes('"ok": true'));
  const setup = fs.readFileSync('scripts/pi/setup-voice-extras.sh', 'utf8');
  assert.ok(setup.includes('kokoro-v1.0.onnx') && setup.includes('useful-moonshine-onnx') && setup.includes('little-heroes-voice-extras.service'));
  const unit = fs.readFileSync('scripts/pi/little-heroes-voice-extras.service', 'utf8');
  assert.ok(unit.includes('voice_extras.py') && unit.includes('MemoryMax'));
  const install = fs.readFileSync('scripts/pi/install-extras.sh', 'utf8');
  assert.ok(install.includes('setup-voice-extras.sh'));
  const server = fs.readFileSync('server.js', 'utf8');
  for (const route of ["'/api/local/stt-fast'", "'/api/local/story-audio'", "'/api/local/story-audio/:id.wav'"]) {
    assert.equal(server.split(route).length - 1, 2, `${route} on the Pi and on the relay`);
  }
});

try { fs.rmSync('scratch/fixtures/__pycache__', { recursive: true, force: true }); fs.rmSync('scratch/fixtures/voice_extras_stubs/__pycache__', { recursive: true, force: true }); fs.rmSync('scripts/pi/voice-extras/__pycache__', { recursive: true, force: true }); } catch {}

if (failures) {
  console.error(`\n❌ ${failures} Pi voice extras check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Pi voice extras checks passed');
process.exit(0);
