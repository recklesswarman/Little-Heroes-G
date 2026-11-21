// Rex's everyday offline voice on the family Raspberry Pi (/api/local/*).
//
//   PIPER_URL / PIPER_TTS_URL       Piper HTTP server, POST /synthesize -> WAV
//   WHISPER_CPP_URL / WHISPER_URL   whisper.cpp server, POST /inference -> {text}
//
// Shares PIPER_URL / WHISPER_CPP_URL with the voice lab (server/voiceLabService.js).
// When neither is set (Firebase, GitHub Pages) the routes answer 503 and the client
// keeps using the browser's Web Speech API. Parent alerts live in server/ntfyService.js.

const TTS_MAX_CHARS = 600;
const STT_MAX_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30000;
// Recording formats browsers produce, mapped to the file extension whisper/ffmpeg expects.
const STT_CONTENT_TYPES = Object.freeze({
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'application/octet-stream': 'webm'
});

function trimSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function getLocalAiConfig(env = process.env) {
  return {
    piperUrl: trimSlash(env.PIPER_TTS_URL || env.PIPER_URL),
    whisperUrl: trimSlash(env.WHISPER_URL || env.WHISPER_CPP_URL)
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

// A request is from the family network when its TCP peer is a home/Tailscale address
// and it did not arrive through a public tunnel or proxy (Cloudflare Tunnel connects
// from 127.0.0.1 but always adds CF-Connecting-IP).
export function isFamilyNetworkRequest(req) {
  const headers = req.headers || {};
  if (headers['cf-connecting-ip'] || headers['cf-ray']) return false;
  return isFamilyNetworkAddress(req.socket?.remoteAddress ?? req.connection?.remoteAddress);
}

function rejectOutsideFamilyNetwork(req, res, env) {
  if (env.LOCAL_AI_ALLOW_ANY_NETWORK === 'true') return false;
  if (isFamilyNetworkRequest(req)) return false;
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
    if (env.LOCAL_AI_ALLOW_ANY_NETWORK !== 'true' && !isFamilyNetworkRequest(req)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ tts: false, stt: false });
    }
    const { piperUrl, whisperUrl } = cfg();
    const [tts, stt] = await Promise.all([
      probe(piperUrl && `${piperUrl}/voices`, { method: 'GET' }, fetchImpl),
      probe(whisperUrl && `${whisperUrl}/`, { method: 'GET' }, fetchImpl)
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ tts, stt });
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

    const rawType = req.headers?.['content-type'];
    const requested = typeof rawType === 'string' ? rawType.split(';')[0].trim().toLowerCase() : '';
    const contentType = Object.hasOwn(STT_CONTENT_TYPES, requested) ? requested : 'audio/webm';
    const ext = STT_CONTENT_TYPES[contentType];
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


  return { handleStatus, handleTts, handleStt, STT_MAX_BYTES };
}
