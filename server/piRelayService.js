// Relays Rex's offline voice (Piper TTS + whisper.cpp STT) from a hosted server
// (Firebase App Hosting) to the family Pi over Tailscale Funnel.
//
//   PI_RELAY_URL    e.g. https://meshlink.tail9d175a.ts.net/pi-voice
//                   (Funnel path mapped to the Pi's http://127.0.0.1:3000/api/local)
//   PI_RELAY_TOKEN  shared secret; the Pi checks it as LOCAL_AI_RELAY_TOKEN
//
// The browser only ever talks to this server; the token never reaches it. When the Pi
// is off or slow, every route answers so the client falls back to Web Speech.
import { STORY_AUDIO_ID_RE, STORY_AUDIO_MAX_CHARS } from './storyAudioService.js';

const STATUS_TIMEOUT_MS = 4000;
const TTS_TIMEOUT_MS = 30000;
const STT_TIMEOUT_MS = 45000;
const MAX_TTS_CHARS = 600;
export const RELAY_MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const STT_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'video/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'application/octet-stream']);

export function getPiRelayConfig(env = process.env) {
  const url = String(env.PI_RELAY_URL || '').trim().replace(/\/+$/, '');
  const token = String(env.PI_RELAY_TOKEN || '').trim();
  if (!/^https:\/\//i.test(url) || token.length < 24) return null;
  return { url, token };
}

async function relayFetch(cfg, path, init, timeoutMs, read, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.url}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${cfg.token}` },
      signal: controller.signal
    });
    return { res, data: res.ok ? await read(res) : null };
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function audioBody(req) {
  const body = req.body;
  if (typeof body === 'string' || Array.isArray(body) || !Buffer.isBuffer(body) || body.length === 0) return null;
  return body.length > RELAY_MAX_AUDIO_BYTES ? 'too-big' : body;
}

function audioType(req) {
  const raw = req.headers?.['content-type'];
  const type = typeof raw === 'string' ? raw.split(';')[0].trim().toLowerCase() : '';
  return STT_TYPES.has(type) ? type : 'audio/webm';
}

// The Pi is small, so cap how much relayed speech work one server instance can ask
// of it, on top of the per-IP limit in server.js.
const RELAY_BUDGET_PER_HOUR = 300;
const RELAY_MAX_CONCURRENT = 2;

export function createPiRelayHandlers({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const cfg = () => getPiRelayConfig(env);
  let windowStart = now();
  let usedThisHour = 0;
  let inFlight = 0;
  function takeSlot() {
    if (now() - windowStart > 3600000) { windowStart = now(); usedThisHour = 0; }
    if (usedThisHour >= RELAY_BUDGET_PER_HOUR || inFlight >= RELAY_MAX_CONCURRENT) return false;
    usedThisHour++; inFlight++;
    return true;
  }
  const releaseSlot = () => { inFlight = Math.max(0, inFlight - 1); };

  async function status() {
    const c = cfg();
    if (!c) return { tts: false, stt: false };
    try {
      const { res, data } = await relayFetch(c, '/status', { method: 'GET' }, STATUS_TIMEOUT_MS, (r) => r.json(), fetchImpl);
      if (!res.ok || !data) return { tts: false, stt: false };
      return { tts: data.tts === true, stt: data.stt === true };
    } catch {
      return { tts: false, stt: false };
    }
  }

  async function tts(text) {
    const c = cfg();
    if (!c) return { status: 503 };
    if (!takeSlot()) return { status: 429 };
    try {
      const { res, data } = await relayFetch(c, '/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }, TTS_TIMEOUT_MS, (r) => r.arrayBuffer(), fetchImpl);
      return res.ok ? { status: 200, audio: Buffer.from(data) } : { status: 502 };
    } catch {
      return { status: 502 };
    } finally {
      releaseSlot();
    }
  }

  async function stt(body, type, route = '/stt') {
    const c = cfg();
    if (!c) return { status: 503 };
    if (!takeSlot()) return { status: 429 };
    try {
      const { res, data } = await relayFetch(c, route, {
        method: 'POST',
        headers: { 'Content-Type': type },
        body
      }, STT_TIMEOUT_MS, (r) => r.json(), fetchImpl);
      return res.ok ? { status: 200, text: cleanText(data?.text) } : { status: 502 };
    } catch {
      return { status: 502 };
    } finally {
      releaseSlot();
    }
  }

  // ---- Rex's everyday voice (same shapes as server/localAiService.js) ----
  async function handleLocalStatus(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await status());
  }

  async function handleLocalTts(req, res) {
    const text = cleanText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (text.length > MAX_TTS_CHARS) return res.status(413).json({ error: `text must be ${MAX_TTS_CHARS} characters or fewer` });
    const out = await tts(text);
    if (out.status !== 200) return res.status(out.status).json({ error: 'Pi voice is unavailable', fallback: 'web-speech' });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(out.audio);
  }

  // Read-Along reading check (Moonshine on the Pi, Whisper as its fallback there).
  async function handleLocalSttFast(req, res) {
    const body = audioBody(req);
    if (body === 'too-big') return res.status(413).json({ error: 'Recording is too long' });
    if (!body) return res.status(400).json({ error: 'Send the recorded audio as the request body' });
    const out = await stt(body, audioType(req), '/stt-fast');
    if (out.status !== 200) return res.status(out.status).json({ error: 'Pi speech recognition is unavailable', fallback: 'web-speech' });
    return res.json({ text: out.text });
  }

  // Kokoro bedtime story audio (server/storyAudioService.js on the Pi). Asking is cheap (no slot);
  // fetching the audio file takes one.
  async function handleStoryAudio(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const c = cfg();
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!c) return res.json({ status: 'off' });
    if (!text.trim() || text.length > STORY_AUDIO_MAX_CHARS) return res.status(400).json({ status: 'bad' });
    try {
      const { res: up, data } = await relayFetch(c, '/story-audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
      }, STATUS_TIMEOUT_MS * 3, (r) => r.json(), fetchImpl);
      if (!up.ok && up.status !== 202) return res.json({ status: 'off' });
      const out = data && typeof data === 'object' ? data : {};
      const status = ['ready', 'rendering', 'failed', 'off'].includes(out.status) ? out.status : 'off';
      const id = typeof out.id === 'string' && STORY_AUDIO_ID_RE.test(out.id) ? out.id : undefined;
      return res.status(status === 'rendering' ? 202 : 200).json({ status, id, words: Array.isArray(out.words) ? out.words : undefined, duration: Number(out.duration) || undefined });
    } catch {
      return res.json({ status: 'off' });
    }
  }

  async function handleStoryAudioFile(req, res) {
    const c = cfg();
    const id = String(req.params?.id || '');
    if (!c) return res.status(503).json({ error: 'Pi is not linked' });
    if (!STORY_AUDIO_ID_RE.test(id)) return res.status(400).json({ error: 'Bad id' });
    if (!takeSlot()) return res.status(429).json({ error: 'Busy' });
    try {
      const { res: up, data } = await relayFetch(c, `/story-audio/${id}.wav`, { method: 'GET' }, TTS_TIMEOUT_MS * 2, (r) => r.arrayBuffer(), fetchImpl);
      if (!up.ok) return res.status(up.status === 404 ? 404 : 502).json({ error: 'Not available' });
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.send(Buffer.from(data));
    } catch {
      return res.status(502).json({ error: 'Not available' });
    } finally {
      releaseSlot();
    }
  }

  async function handleLocalStt(req, res) {
    const body = audioBody(req);
    if (body === 'too-big') return res.status(413).json({ error: 'Recording is too long' });
    if (!body) return res.status(400).json({ error: 'Send the recorded audio as the request body' });
    const out = await stt(body, audioType(req));
    if (out.status !== 200) return res.status(out.status).json({ error: 'Pi speech recognition is unavailable', fallback: 'web-speech' });
    return res.json({ text: out.text });
  }

  // ---- Voice lab page (same shapes as server/voiceLabService.js) ----
  async function handleVoiceStatus(req, res) {
    const s = await status();
    return res.json({
      ok: true,
      whisper: { url: 'family Pi (relay)', reachable: s.stt },
      piper: { url: 'family Pi (relay)', reachable: s.tts }
    });
  }

  async function handleVoiceTts(req, res) {
    const text = cleanText(req.body?.text);
    if (!text) return res.status(400).json({ ok: false, error: 'Text is required.' });
    if (text.length > MAX_TTS_CHARS) return res.status(413).json({ ok: false, error: 'Text is too long.' });
    const out = await tts(text);
    if (out.status !== 200) return res.status(out.status).json({ ok: false, error: 'The Pi voice is unavailable right now.' });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(out.audio);
  }

  async function handleVoiceStt(req, res) {
    const body = audioBody(req);
    if (body === 'too-big') return res.status(413).json({ ok: false, error: 'Recording is too long.' });
    if (!body) return res.status(400).json({ ok: false, error: 'Expected a WAV recording.' });
    const out = await stt(body, audioType(req));
    if (out.status !== 200) return res.status(out.status).json({ ok: false, error: 'Pi speech recognition is unavailable right now.' });
    return res.json({ ok: true, text: out.text });
  }

  return { handleLocalStatus, handleLocalTts, handleLocalStt, handleLocalSttFast, handleStoryAudio, handleStoryAudioFile, handleVoiceStatus, handleVoiceTts, handleVoiceStt };
}
