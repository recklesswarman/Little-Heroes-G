// Local, offline AI services that run on the family Raspberry Pi.
//
//   PIPER_TTS_URL  e.g. http://127.0.0.1:5000   (Piper HTTP server, POST /synthesize -> WAV)
//   WHISPER_URL    e.g. http://127.0.0.1:8178   (whisper.cpp server, POST /inference -> {text})
//   NTFY_URL       e.g. http://127.0.0.1:8090   (ntfy server)
//   NTFY_TOPIC     e.g. pi-alerts               (topic parent alerts are published to)
//
// Every variable is optional. When one is not set (for example on Firebase Hosting or
// GitHub Pages) the matching route answers 503 and the client falls back to the
// browser's Web Speech API, so nothing breaks off the Pi.

const TTS_MAX_CHARS = 600;
const STT_MAX_BYTES = 5 * 1024 * 1024;
const NOTIFY_MAX_CHARS = 1000;
const UPSTREAM_TIMEOUT_MS = 30000;

function trimSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function getLocalAiConfig(env = process.env) {
  return {
    piperUrl: trimSlash(env.PIPER_TTS_URL),
    whisperUrl: trimSlash(env.WHISPER_URL),
    ntfyUrl: trimSlash(env.NTFY_URL),
    ntfyTopic: String(env.NTFY_TOPIC || 'pi-alerts').trim().replace(/[^A-Za-z0-9_-]/g, '') || 'pi-alerts'
  };
}

// The timer covers reading the body too (`read`), so a stalled upstream can't hang a request.
async function fetchWithTimeout(url, init = {}, timeoutMs = UPSTREAM_TIMEOUT_MS, fetchImpl = globalThis.fetch, read = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!read) return res;
    return { res, data: res.ok ? await read(res) : null };
  } finally {
    clearTimeout(timer);
  }
}

// These routes reach services on the family Pi, so only answer devices on the home
// network or the family Tailscale network. Uses the TCP peer address, never
// X-Forwarded-For, so it can't be spoofed with a header.
export function isFamilyNetworkAddress(address) {
  const ip = String(address || '').replace(/^::ffff:/i, '').trim();
  if (!ip) return false;
  if (ip === '::1' || ip.startsWith('127.')) return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip)) return true;
  const m = ip.match(/^(\d+)\.(\d+)\./);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]);
    if (a === 172 && b >= 16 && b <= 31) return true;   // private
    if (a === 100 && b >= 64 && b <= 127) return true;  // Tailscale CGNAT range
    if (a === 169 && b === 254) return true;            // link-local
    return false;
  }
  const lower = ip.toLowerCase();
  return lower.startsWith('fd') || lower.startsWith('fc') || lower.startsWith('fe80:'); // ULA (incl. Tailscale) / link-local
}

function rejectOutsideFamilyNetwork(req, res, env) {
  if (env.LOCAL_AI_ALLOW_ANY_NETWORK === 'true') return false;
  const peer = req.socket?.remoteAddress ?? req.connection?.remoteAddress;
  if (isFamilyNetworkAddress(peer)) return false;
  res.status(403).json({ error: 'Local Pi services are only available on the family network', fallback: 'web-speech' });
  return true;
}

async function probe(url, init, fetchImpl) {
  if (!url) return false;
  try {
    const res = await fetchWithTimeout(url, init, 2500, fetchImpl);
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Builds the Express handlers. `fetchImpl` and `env` are injectable for tests. */
export function createLocalAiHandlers({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cfg = () => getLocalAiConfig(env);

  async function handleStatus(req, res) {
    if (env.LOCAL_AI_ALLOW_ANY_NETWORK !== 'true' && !isFamilyNetworkAddress(req.socket?.remoteAddress ?? req.connection?.remoteAddress)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ tts: false, stt: false, notify: false });
    }
    const { piperUrl, whisperUrl, ntfyUrl } = cfg();
    const [tts, stt, notify] = await Promise.all([
      probe(piperUrl && `${piperUrl}/voices`, { method: 'GET' }, fetchImpl),
      probe(whisperUrl && `${whisperUrl}/`, { method: 'GET' }, fetchImpl),
      probe(ntfyUrl && `${ntfyUrl}/v1/health`, { method: 'GET' }, fetchImpl)
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ tts, stt, notify });
  }

  async function handleTts(req, res) {
    if (rejectOutsideFamilyNetwork(req, res, env)) return;
    const { piperUrl } = cfg();
    if (!piperUrl) return res.status(503).json({ error: 'Local voice is not configured', fallback: 'web-speech' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (text.length > TTS_MAX_CHARS) return res.status(413).json({ error: `text must be ${TTS_MAX_CHARS} characters or fewer` });

    const payload = { text };
    if (typeof req.body?.voice === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(req.body.voice)) payload.voice = req.body.voice;
    const lengthScale = Number(req.body?.length_scale);
    if (Number.isFinite(lengthScale) && lengthScale >= 0.5 && lengthScale <= 2) payload.length_scale = lengthScale;

    try {
      const { res: upstream, data } = await fetchWithTimeout(`${piperUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, UPSTREAM_TIMEOUT_MS, fetchImpl, (r) => r.arrayBuffer());
      if (!upstream.ok) return res.status(502).json({ error: `Piper returned ${upstream.status}`, fallback: 'web-speech' });
      const audio = Buffer.from(data);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(audio);
    } catch (err) {
      return res.status(502).json({ error: 'Local voice is unavailable', fallback: 'web-speech' });
    }
  }

  async function handleStt(req, res) {
    if (rejectOutsideFamilyNetwork(req, res, env)) return;
    const { whisperUrl } = cfg();
    if (!whisperUrl) return res.status(503).json({ error: 'Local speech recognition is not configured', fallback: 'web-speech' });
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'Send the recorded audio as the request body' });
    if (body.length > STT_MAX_BYTES) return res.status(413).json({ error: 'Recording is too long' });

    const contentType = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
    const ext = (contentType.split('/')[1] || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm';
    const form = new FormData();
    form.append('file', new Blob([body], { type: contentType }), `speech.${ext}`);
    form.append('response_format', 'json');
    form.append('temperature', '0.0');

    try {
      const { res: upstream, data } = await fetchWithTimeout(`${whisperUrl}/inference`, { method: 'POST', body: form },
        UPSTREAM_TIMEOUT_MS, fetchImpl, (r) => r.json().catch(() => ({})));
      if (!upstream.ok) return res.status(502).json({ error: `Whisper returned ${upstream.status}`, fallback: 'web-speech' });
      const text = String(data?.text || '').replace(/\s+/g, ' ').trim();
      return res.json({ text });
    } catch (err) {
      return res.status(502).json({ error: 'Local speech recognition is unavailable', fallback: 'web-speech' });
    }
  }

  async function handleNotify(req, res) {
    if (rejectOutsideFamilyNetwork(req, res, env)) return;
    const { ntfyUrl, ntfyTopic } = cfg();
    if (!ntfyUrl) return res.status(503).json({ error: 'Family alerts are not configured' });
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'message is required' });
    const clean = (value, max) => String(value || '').replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7E]/g, '').slice(0, max).trim();
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    const title = clean(req.body?.title, 120);
    const tags = clean(req.body?.tags, 80).replace(/[^A-Za-z0-9_,-]/g, '');
    if (title) headers.Title = title;
    if (tags) headers.Tags = tags;

    try {
      const upstream = await fetchWithTimeout(`${ntfyUrl}/${ntfyTopic}`, {
        method: 'POST',
        headers,
        body: message.slice(0, NOTIFY_MAX_CHARS)
      }, 10000, fetchImpl);
      if (!upstream.ok) return res.status(502).json({ error: `ntfy returned ${upstream.status}` });
      return res.json({ ok: true });
    } catch {
      return res.status(502).json({ error: 'Family alerts are unavailable' });
    }
  }

  return { handleStatus, handleTts, handleStt, handleNotify, STT_MAX_BYTES };
}
