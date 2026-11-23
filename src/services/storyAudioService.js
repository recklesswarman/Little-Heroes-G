// Kokoro bedtime voice (server/storyAudioService.js on the family Pi, relayed by App Hosting).
// Each chapter is sent to the Pi as soon as its text exists; the Pi reads it ahead of time.
// When the chapter is read aloud and its audio is ready, it plays in the Kokoro voice and each
// word lights up as it is read ('bedtime-story-word' events). Otherwise the usual voice
// (Piper or the browser's) reads it, exactly as before.
import { serverApiUrl } from './serverApi.js';
import { speakCompanion, stopCompanionAudio } from './voiceService.js';

const POLL_MS = 10000;
const POLL_FOR_MS = 6 * 60 * 1000;
const entries = new Map(); // text -> { status, id, words, duration }
const pollers = new Map();
let playing = null;

const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

async function ask(text, fetchImpl) {
  const res = await fetchImpl(serverApiUrl('/api/local/story-audio'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000)
  });
  const type = res.headers?.get?.('content-type') || '';
  if (!type.includes('json')) return { status: 'off' };
  const data = await res.json();
  return data && typeof data === 'object' ? data : { status: 'off' };
}

/**
 * Asks the Pi to read this chapter ahead of time, and keeps checking until it is ready
 * (or gives up). Safe to call many times. Resolves to the latest status.
 */
export function prepareStoryAudio(rawText, { fetchImpl = globalThis.fetch, pollMs = POLL_MS, pollForMs = POLL_FOR_MS, now = Date.now } = {}) {
  const text = clean(rawText);
  if (!text || typeof fetchImpl !== 'function') return Promise.resolve({ status: 'off' });
  const known = entries.get(text);
  if (known && known.status !== 'rendering') return Promise.resolve(known);
  if (pollers.has(text)) return pollers.get(text);
  const started = now();
  const job = (async () => {
    try {
      for (;;) {
        let out;
        try { out = await ask(text, fetchImpl); } catch { out = { status: 'off' }; }
        entries.set(text, out);
        if (out.status !== 'rendering' || now() - started > pollForMs) return out;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    } finally {
      pollers.delete(text);
    }
  })();
  pollers.set(text, job);
  return job;
}

/** The ready Kokoro audio for this text, or null. */
export function readyStoryAudio(rawText) {
  const e = entries.get(clean(rawText));
  return e && e.status === 'ready' && e.id ? e : null;
}

/** Index of the word being read at `seconds` (-1 before the first). */
export function wordIndexAt(words, seconds) {
  let lo = 0;
  let hi = (words?.length || 0) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid][1] <= seconds) { found = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return found;
}

/**
 * Which word on screen is being read: the next span (from `cursor`, looking a few ahead) whose
 * word matches. Screen text can differ a little from the read text (titles, cues), so a word
 * that is not found is skipped. Returns the span index or -1.
 */
export function matchSpokenWord(screenWords, cursor, word, lookahead = 8) {
  const want = String(word || '').toLowerCase().replace(/\u2019/g, "'");
  if (!want) return -1;
  const end = Math.min(screenWords.length, Math.max(0, cursor) + lookahead);
  for (let k = Math.max(0, cursor); k < end; k++) {
    if (String(screenWords[k] || '').toLowerCase().replace(/\u2019/g, "'") === want) return k;
  }
  return -1;
}

export function stopStoryAudio() {
  const p = playing;
  playing = null;
  if (!p) return;
  try { p.audio.pause(); } catch { /* already stopped */ }
  p.finish(false);
}

function emitWord(index, word) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('bedtime-story-word', { detail: { index, word } }));
}

/**
 * Plays the chapter in the Kokoro voice. Returns false (and plays nothing) when its audio is
 * not ready, so the caller can use the usual voice.
 */
export function playStoryAudio(rawText, { onEnded = null, rate = 0.94 } = {}) {
  const ready = readyStoryAudio(rawText);
  if (!ready || typeof Audio === 'undefined') return false;
  stopStoryAudio();
  stopCompanionAudio();
  const audio = new Audio(serverApiUrl(`/api/local/story-audio/${ready.id}.wav`));
  audio.preservesPitch = true;
  audio.playbackRate = Math.min(1, Math.max(0.8, rate / 0.94));
  let last = -1;
  let done = false;
  const me = {
    audio,
    finish(natural) {
      if (done) return;
      done = true;
      emitWord(-1, '');
      if (playing === me) playing = null;
      if (natural && typeof onEnded === 'function') onEnded();
    }
  };
  audio.addEventListener('timeupdate', () => {
    const i = wordIndexAt(ready.words, audio.currentTime);
    if (i !== last && i >= 0) {
      last = i;
      emitWord(i, ready.words[i][0]);
    }
  });
  audio.addEventListener('ended', () => me.finish(true));
  audio.addEventListener('error', () => me.finish(true));
  playing = me;
  const started = audio.play();
  if (started && typeof started.catch === 'function') started.catch(() => me.finish(true));
  return true;
}

/** Reads a chapter: Kokoro when the Pi has it ready, else the usual companion voice. */
export function speakStoryChapter(text, petId, onEnded, options = {}) {
  if (playStoryAudio(text, { onEnded, rate: options.rate })) return 'kokoro';
  prepareStoryAudio(text); // so a replay (or the next night's reread) can use it
  speakCompanion(text, petId, onEnded, options);
  return 'voice';
}

/** For tests. */
export function _resetStoryAudio() {
  entries.clear();
  pollers.clear();
  playing = null;
}
