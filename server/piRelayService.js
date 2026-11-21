// Relays Rex's offline voice (Piper TTS + whisper.cpp STT) from a hosted server
// (Firebase App Hosting) to the family Pi over Tailscale Funnel.
//
//   PI_RELAY_URL    e.g. https://meshlink.tail9d175a.ts.net/pi-voice
//                   (Funnel path mapped to the Pi's http://127.0.0.1:3000/api/local)
//   PI_RELAY_TOKEN  shared secret; the Pi checks it as LOCAL_AI_RELAY_TOKEN
//
// The browser only ever talks to this server; the token never reaches it. When the Pi
// is off or slow, every route answers so the client falls back to Web Speech.
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

export function createPiRelayHandlers({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cfg = () => getPiRelayConfig(env);

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
    try {
      const { res, data } = await relayFetch(c, '/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }, TTS_TIMEOUT_MS, (r) => r.arrayBuffer(), fetchImpl);
      return res.ok ? { status: 200, audio: Buffer.from(data) } : { status: 502 };
    } catch {
      return { status: 502 };
    }
  }

  async function stt(body, type) {
    const c = cfg();
    if (!c) return { status: 503 };
    try {
      const { res, data } = await relayFetch(c, '/stt', {
        method: 'POST',
        headers: { 'Content-Type': type },
        body
      }, STT_TIMEOUT_MS, (r) => r.json(), fetchImpl);
      return res.ok ? { status: 200, text: cleanText(data?.text) } : { status: 502 };
    } catch {
      return { status: 502 };
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

  return { handleLocalStatus, handleLocalTts, handleLocalStt, handleVoiceStatus, handleVoiceTts, handleVoiceStt };
}
