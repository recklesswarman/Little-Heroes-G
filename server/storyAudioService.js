// Kokoro bedtime voice on the family Pi: each story chapter is read ahead of time (as soon as its
// text exists) and kept on the Pi, so the bedtime story plays in a warm, natural voice with the
// words lighting up as they are read. Live Rex chat keeps using Piper.
//
//   POST /api/local/story-audio            {text}  -> {status:'ready', id, words, duration}
//                                                     or 202 {status:'rendering', id} (ask again soon)
//                                                     or {status:'failed'|'off'} (use Piper / browser voice)
//   GET  /api/local/story-audio/<id>.wav            the chapter audio
//
// The Kokoro service is scripts/pi/voice-extras/voice_extras.py (KOKORO_URL, default
// http://127.0.0.1:5010 on the Pi). Files live in STORY_AUDIO_DIR (default ~/apps/story-audio),
// newest 300 kept. Hosted servers relay these routes to the Pi (server/piRelayService.js).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isAllowedLocalCaller } from './localAiService.js';

export const STORY_AUDIO_MAX_CHARS = 6000;
const RENDER_TIMEOUT_MS = 6 * 60 * 1000; // a long chapter on a Pi 4 takes a minute or two
const FAILED_RETRY_MS = 10 * 60 * 1000;
const KEEP_FILES = 300;
const ID_RE = /^[a-f0-9]{24}$/;
const VOICE_RE = /^[a-z]{2}_[a-z]{1,20}$/;

const trimSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

/** Where Kokoro is, or '' when it is off (no Pi voice setup, or set to "off"). */
export function getStoryAudioConfig(env = process.env) {
  const onPi = Boolean(env.PIPER_URL || env.PIPER_TTS_URL || env.KOKORO_URL);
  const raw = env.KOKORO_URL === 'off' ? '' : trimSlash(env.KOKORO_URL || (onPi ? 'http://127.0.0.1:5010' : ''));
  return {
    kokoroUrl: /^https?:\/\//i.test(raw) ? raw : '',
    voice: VOICE_RE.test(env.KOKORO_VOICE || '') ? env.KOKORO_VOICE : 'af_heart',
    dir: env.STORY_AUDIO_DIR || path.join(os.homedir(), 'apps', 'story-audio')
  };
}

/** Text as it is read: control characters out, spaces squeezed. */
export function cleanStoryText(text) {
  return typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

export function storyAudioId(text, voice = 'af_heart') {
  return createHash('sha256').update(`kokoro1|${voice}|${cleanStoryText(text)}`).digest('hex').slice(0, 24);
}

/** Word timings from the Kokoro service, checked: [[word, start, end], ...] in order. */
export function cleanWordTimings(words) {
  if (!Array.isArray(words)) return [];
  const out = [];
  let last = 0;
  for (const w of words.slice(0, 3000)) {
    if (!Array.isArray(w) || typeof w[0] !== 'string') continue;
    const start = Number(w[1]);
    const end = Number(w[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < last - 0.01 || end < start) continue;
    out.push([w[0].slice(0, 40), Math.round(start * 1000) / 1000, Math.round(end * 1000) / 1000]);
    last = start;
  }
  return out;
}

export function createStoryAudioService({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const cfg = () => getStoryAudioConfig(env);
  const queue = [];
  const pending = new Set();
  const failed = new Map();
  let running = false;

  const files = (id) => {
    const { dir } = cfg();
    return { wav: path.join(dir, `${id}.wav`), json: path.join(dir, `${id}.json`) };
  };

  function readReady(id) {
    try {
      const { wav, json } = files(id);
      if (!fs.existsSync(wav)) return null;
      const meta = JSON.parse(fs.readFileSync(json, 'utf8'));
      return { status: 'ready', id, words: cleanWordTimings(meta.words), duration: Number(meta.duration) || 0 };
    } catch {
      return null;
    }
  }

  function prune() {
    try {
      const { dir } = cfg();
      const wavs = fs.readdirSync(dir).filter((f) => f.endsWith('.wav'))
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      for (const { f } of wavs.slice(KEEP_FILES)) {
        fs.rmSync(path.join(dir, f), { force: true });
        fs.rmSync(path.join(dir, f.replace(/\.wav$/, '.json')), { force: true });
      }
    } catch { /* best effort */ }
  }

  async function render(id, text) {
    const { kokoroUrl, voice, dir } = cfg();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${kokoroUrl}/kokoro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: 0.9 }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Kokoro returned ${res.status}`);
      const data = await res.json();
      const wav = Buffer.from(String(data?.wav || ''), 'base64');
      if (wav.length < 1000 || wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Kokoro sent no audio');
      fs.mkdirSync(dir, { recursive: true });
      const f = files(id);
      fs.writeFileSync(`${f.json}.tmp`, JSON.stringify({ words: cleanWordTimings(data.words), duration: Number(data.duration) || 0, createdAt: now() }));
      fs.writeFileSync(`${f.wav}.tmp`, wav);
      fs.renameSync(`${f.json}.tmp`, f.json);
      fs.renameSync(`${f.wav}.tmp`, f.wav);
      prune();
    } finally {
      clearTimeout(timer);
    }
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const { id, text } = queue.shift();
        try {
          await render(id, text);
        } catch (err) {
          failed.set(id, now());
          console.warn('Story audio not made:', err?.message || err);
        } finally {
          pending.delete(id);
        }
      }
    } finally {
      running = false;
    }
  }

  /** Ready audio, or start reading it in the background. Never throws. */
  function request(rawText) {
    const { kokoroUrl, voice } = cfg();
    if (!kokoroUrl) return { status: 'off' };
    const text = cleanStoryText(rawText);
    if (!text) return { status: 'bad' };
    const id = storyAudioId(text, voice);
    const ready = readReady(id);
    if (ready) return ready;
    if (pending.has(id)) return { status: 'rendering', id };
    const failedAt = failed.get(id);
    if (failedAt && now() - failedAt < FAILED_RETRY_MS) return { status: 'failed', id };
    failed.delete(id);
    pending.add(id);
    queue.push({ id, text });
    drain();
    return { status: 'rendering', id };
  }

  async function handleRequest(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!isAllowedLocalCaller(req, env)) return res.status(403).json({ status: 'off' });
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (text.length > STORY_AUDIO_MAX_CHARS) return res.status(413).json({ status: 'bad', error: 'Chapter is too long' });
    const out = request(text);
    if (out.status === 'bad') return res.status(400).json({ ...out, error: 'text is required' });
    return res.status(out.status === 'rendering' ? 202 : 200).json(out);
  }

  function handleAudio(req, res) {
    if (!isAllowedLocalCaller(req, env)) return res.status(403).json({ error: 'Family network only' });
    const id = String(req.params?.id || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad id' });
    const { wav } = files(id);
    if (!fs.existsSync(wav)) return res.status(404).json({ error: 'Not ready' });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(wav);
  }

  return { request, handleRequest, handleAudio, _queue: queue };
}

export const STORY_AUDIO_ID_RE = ID_RE;
