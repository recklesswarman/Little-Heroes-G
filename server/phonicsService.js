// "Sound it out" for tap-a-word stories: the CMU Pronouncing Dictionary (134k words, BSD-style
// license, npm cmu-pronouncing-dictionary) turned into kid sounds by shared/phonics.js.
//
//   GET /api/phonics/word?word=ship
//   -> { ok: true, word: 'ship', syllables: 1, sounds: ['sh', 'i', 'p'],
//        parts: [{ letters: 'sh', sound: 'sh' }, { letters: 'i', sound: 'i' }, { letters: 'p', sound: 'p' }] }
//
// The dictionary (about 3 MB) stays on the server, loaded on first use; the browser only gets
// the one word it asked about. Works on the Pi and App Hosting (the static sites call App Hosting).
import { cleanWord } from './dictionaryService.js';
import { isRateLimited, getRequestIp } from './geminiService.js';
import { countSyllables, kidSounds, soundOut } from '../shared/phonics.js';

let dictPromise = null;
export function loadCmuDictionary() {
  if (!dictPromise) dictPromise = import('cmu-pronouncing-dictionary').then((m) => m.dictionary || m.default?.dictionary || {});
  return dictPromise;
}

/** Phonics for one word, or null when the dictionary doesn't know it. */
export async function phonicsForWord(raw, { dictionary = null } = {}) {
  const word = cleanWord(raw);
  if (!word) return null;
  const dict = dictionary || await loadCmuDictionary();
  const phones = dict[word];
  if (!phones) return null;
  return { word, syllables: countSyllables(phones), sounds: kidSounds(phones), parts: soundOut(word, phones) };
}

export async function handlePhonicsRequest(req, res) {
  const word = cleanWord(req.query?.word);
  if (!word) return res.status(400).json({ ok: false, error: 'Send one plain word.' });
  if (isRateLimited(`phonics:${getRequestIp(req)}`, 120, 60_000)) return res.status(429).json({ ok: false, error: 'Too many lookups.' });
  try {
    const out = await phonicsForWord(word);
    if (!out) return res.status(404).json({ ok: false, error: 'Not in the dictionary.' });
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.json({ ok: true, ...out });
  } catch (err) {
    console.warn('Phonics lookup failed:', err?.message || err);
    return res.status(503).json({ ok: false, error: 'Phonics is resting.' });
  }
}
