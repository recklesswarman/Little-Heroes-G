// Offline Rex voice chat (test page: /voice-lab.html).
//
//   mic -> 16 kHz mono WAV (encoded in the browser)
//       -> POST /api/voice/stt  -> whisper.cpp `whisper-server`  (speech to text)
//       -> POST /api/gemini/chat (existing Rex chat)               (reply text)
//       -> POST /api/voice/tts  -> Piper HTTP server               (text to speech WAV)
//
// whisper.cpp and Piper run on the family Raspberry Pi, so the browser never
// talks to them directly: this server forwards to them. Configure with env vars:
// Defaults match the family Pi (192.168.1.163), where this server also runs:
//   WHISPER_CPP_URL   base URL of whisper-server (base.en model)   (default http://127.0.0.1:8178)
//   WHISPER_LANGUAGE  language hint for whisper                     (default en)
//   PIPER_URL         base URL of the Piper HTTP server            (default http://127.0.0.1:5000)
//   PIPER_PATH        Piper endpoint path                          (default /synthesize)
//   PIPER_MODE        "post-json" (POST <path> {"text"}, the Pi's setup)
//                     or "get" (older piper http_server, GET <path>?text=...)   (default post-json)
//   PIPER_VOICE       optional voice/model name passed to Piper as "voice" (the Pi uses en_US-lessac-medium)

const DEFAULT_WHISPER_URL = 'http://127.0.0.1:8178';
const DEFAULT_PIPER_URL = 'http://127.0.0.1:5000';
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~4 minutes of 16 kHz mono PCM
export const MAX_TTS_CHARS = 600;

function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

export function getVoiceLabConfig(env = process.env) {
  const piperMode = String(env.PIPER_MODE || 'post-json').toLowerCase() === 'get' ? 'get' : 'post-json';
  return {
    whisperUrl: trimSlash(env.WHISPER_CPP_URL || DEFAULT_WHISPER_URL),
    whisperLanguage: String(env.WHISPER_LANGUAGE || 'en'),
    piperUrl: trimSlash(env.PIPER_URL || DEFAULT_PIPER_URL),
    piperPath: '/' + String(env.PIPER_PATH ?? '/synthesize').replace(/^\/+/, ''),
    piperMode,
    piperVoice: env.PIPER_VOICE ? String(env.PIPER_VOICE) : ''
  };
}

async function withTimeout(ms, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeWav(buf) {
  // Request bodies are untrusted: only a real Buffer (never an array or string) can pass.
  if (typeof buf === 'string' || Array.isArray(buf) || !Buffer.isBuffer(buf)) return false;
  return buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
}

/** Send a WAV buffer to whisper.cpp and return the transcript text. */
export async function transcribeWithWhisper(wavBuffer, { config = getVoiceLabConfig(), fetchImpl = globalThis.fetch } = {}) {
  if (!looksLikeWav(wavBuffer)) {
    const err = new Error('Expected a WAV recording.');
    err.status = 400;
    throw err;
  }
  if (wavBuffer.length > MAX_AUDIO_BYTES) {
    const err = new Error('Recording is too long.');
    err.status = 413;
    throw err;
  }
  const form = new FormData();
  form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'speech.wav');
  form.append('response_format', 'json');
  form.append('temperature', '0.0');
  if (config.whisperLanguage) form.append('language', config.whisperLanguage);

  const resp = await withTimeout(60_000, signal => fetchImpl(`${config.whisperUrl}/inference`, { method: 'POST', body: form, signal }));
  if (!resp.ok) {
    const err = new Error(`whisper.cpp responded ${resp.status}`);
    err.status = 502;
    throw err;
  }
  const json = await resp.json().catch(() => ({}));
  // whisper.cpp marks silence as "[BLANK_AUDIO]"; treat that as nothing heard.
  return String(json?.text || '').replace(/\[BLANK_AUDIO\]/gi, '').replace(/\s+/g, ' ').trim();
}

/** Ask Piper to speak `text`; returns a WAV Buffer. */
export async function synthesizeWithPiper(text, { config = getVoiceLabConfig(), fetchImpl = globalThis.fetch } = {}) {
  if (typeof text !== 'string') text = '';
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TTS_CHARS);
  if (!clean) {
    const err = new Error('Text is required.');
    err.status = 400;
    throw err;
  }
  const resp = await withTimeout(60_000, signal => {
    if (config.piperMode === 'get') {
      const u = new URL(`${config.piperUrl}${config.piperPath}`);
      u.searchParams.set('text', clean);
      return fetchImpl(u.toString(), { signal });
    }
    const body = { text: clean };
    if (config.piperVoice) body.voice = config.piperVoice;
    return fetchImpl(`${config.piperUrl}${config.piperPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
  });
  if (!resp.ok) {
    const err = new Error(`Piper responded ${resp.status}`);
    err.status = 502;
    throw err;
  }
  return Buffer.from(await resp.arrayBuffer());
}

/** Quick reachability check for the test page's status lights. */
export async function checkVoiceLabStatus({ config = getVoiceLabConfig(), fetchImpl = globalThis.fetch } = {}) {
  const ping = async url => {
    try {
      const r = await withTimeout(2500, signal => fetchImpl(url, { signal }));
      return { reachable: true, status: r.status };
    } catch (e) {
      return { reachable: false, error: String(e?.message || e) };
    }
  };
  const [whisper, piper] = await Promise.all([ping(`${config.whisperUrl}/`), ping(`${config.piperUrl}/`)]);
  return {
    whisper: { url: config.whisperUrl, ...whisper },
    piper: { url: `${config.piperUrl}${config.piperPath}`, mode: config.piperMode, voice: config.piperVoice || null, ...piper }
  };
}

function sendError(res, err) {
  const status = err?.status || (err?.name === 'AbortError' ? 504 : 502);
  return res.status(status).json({ ok: false, error: String(err?.message || err) });
}

// ---- Express handlers (the Vite middleware shim gives res.status/res.json and a Buffer req.body) ----

export async function handleVoiceSttRequest(req, res) {
  try {
    if (typeof req.body === 'string' || Array.isArray(req.body) || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ ok: false, error: 'Expected a WAV recording.' });
    }
    const text = await transcribeWithWhisper(req.body);
    return res.status(200).json({ ok: true, text });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function handleVoiceTtsRequest(req, res) {
  try {
    const text = req.body?.text;
    if (typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'Text is required.' });
    }
    const wav = await synthesizeWithPiper(text);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    return res.end(wav);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function handleVoiceStatusRequest(req, res) {
  return res.status(200).json({ ok: true, ...(await checkVoiceLabStatus()) });
}
