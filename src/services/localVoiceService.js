// Client side of the family Raspberry Pi's offline AI (see server/localAiService.js).
//
// When the app is served by server.js on the Pi, these routes reach:
//   /api/local/tts     -> Piper text-to-speech (WAV)
//   /api/local/stt     -> whisper.cpp speech-to-text ({ text })
// Anywhere else (GitHub Pages, Firebase) the status check reports everything as
// unavailable and callers keep using the browser's Web Speech API.
import { serverApiUrl } from './serverApi.js';

const STATUS_TTL_MS = 60 * 1000;
const STATUS_TIMEOUT_MS = 3000;
const PREF_KEY = 'lh_local_voice';

let statusCache = null;
let statusCheckedAt = 0;
let statusPromise = null;

const OFFLINE_STATUS = Object.freeze({ tts: false, stt: false });

function apiUrl(path) {
  return serverApiUrl(path);
}

// The timeout also covers reading the body (`read`), so a stalled response can't hang.
async function fetchWithTimeout(url, init = {}, timeoutMs = 20000, read = null) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, controller ? { ...init, signal: controller.signal } : init);
    if (!read) return res;
    return { res, data: res.ok ? await read(res) : null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Which local services the Pi currently offers. Cached for a minute. */
export async function getLocalAiStatus({ force = false } = {}) {
  if (typeof fetch !== 'function') return OFFLINE_STATUS;
  if (!force && statusCache && Date.now() - statusCheckedAt < STATUS_TTL_MS) return statusCache;
  if (statusPromise) return statusPromise;
  statusPromise = (async () => {
    try {
      const { res, data } = await fetchWithTimeout(apiUrl('/api/local/status'), { cache: 'no-store' }, STATUS_TIMEOUT_MS,
        (r) => ((r.headers?.get?.('content-type') || '').includes('json') ? r.json() : null));
      if (!res.ok || !data) return OFFLINE_STATUS;
      return { tts: data?.tts === true, stt: data?.stt === true };
    } catch {
      return OFFLINE_STATUS;
    }
  })().then((status) => {
    statusCache = status;
    statusCheckedAt = Date.now();
    statusPromise = null;
    return status;
  });
  return statusPromise;
}

export function resetLocalAiStatusCache() {
  statusCache = null;
  statusCheckedAt = 0;
  statusPromise = null;
}

/** Parents can switch Rex's Pi voice off ('0') or back on ('1'). On by default. */
export function isLocalVoicePreferred() {
  try {
    return globalThis.localStorage?.getItem(PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setLocalVoicePreferred(enabled) {
  try {
    globalThis.localStorage?.setItem(PREF_KEY, enabled ? '1' : '0');
  } catch {}
}

export async function isLocalVoiceAvailable() {
  if (!isLocalVoicePreferred()) return false;
  const status = await getLocalAiStatus();
  return status.tts === true;
}

/**
 * Asks Piper to speak `text`. Returns an object URL for the WAV, or null when the
 * Pi voice is unavailable (the caller should fall back to Web Speech).
 */
export async function fetchLocalSpeechUrl(text, { lengthScale } = {}) {
  const clean = String(text || '').trim().slice(0, 600);
  if (!clean || typeof URL?.createObjectURL !== 'function') return null;
  try {
    const body = { text: clean };
    if (Number.isFinite(lengthScale)) body.length_scale = lengthScale;
    const { res, data: blob } = await fetchWithTimeout(apiUrl('/api/local/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 20000, (r) => r.blob());
    if (!res.ok) {
      if (res.status === 503 || res.status === 403) resetLocalAiStatusCache();
      return null;
    }
    return blob && blob.size > 44 ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/** Sends a recorded clip to whisper.cpp. Resolves to the transcript ('' if nothing heard), or null on failure. */
export async function transcribeWithLocalWhisper(audioBlob) {
  if (!audioBlob || !audioBlob.size) return null;
  try {
    const { res, data } = await fetchWithTimeout(apiUrl('/api/local/stt'), {
      method: 'POST',
      headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
      body: audioBlob
    }, 45000, (r) => r.json());
    if (!res.ok) return null;
    return typeof data?.text === 'string' ? data.text.trim() : '';
  } catch {
    return null;
  }
}

/**
 * Records from the microphone until `stop()` is called or `maxMs` passes, then
 * transcribes on the Pi. Keep clips short: whisper is tuned for ~10 seconds.
 * Returns { stop, cancel, result } where `result` resolves to the transcript or null.
 */
export function recordAndTranscribe({ maxMs = 8000 } = {}) {
  let recorder = null;
  let stream = null;
  let timer = null;
  let stopRequested = false;
  let cancelled = false;
  const releaseMic = () => { try { stream?.getTracks().forEach((track) => track.stop()); } catch {} };
  const stop = () => {
    stopRequested = true;
    if (timer) clearTimeout(timer);
    if (recorder && recorder.state === 'recording') recorder.stop();
  };
  // cancel(): stop recording, free the microphone, and never upload what was captured.
  const cancel = () => { cancelled = true; stop(); releaseMic(); };
  const result = (async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return null;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return null;
    }
    if (stopRequested || cancelled) { releaseMic(); return null; }
    const chunks = [];
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
      .find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
    let done;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      done = new Promise((resolve) => {
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.onstop = resolve;
        recorder.onerror = resolve;
      });
      recorder.start();
    } catch {
      releaseMic();
      return null;
    }
    timer = setTimeout(stop, maxMs);
    await done;
    releaseMic();
    if (cancelled) return null;
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
    return transcribeWithLocalWhisper(blob);
  })();
  return { stop, cancel, result };
}

