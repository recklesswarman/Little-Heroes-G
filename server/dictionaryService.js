// Kid-friendly word lookups for "tap a word to hear it" in stories.
//
//   GET /api/dictionary/define?word=turtle
//   -> { ok: true, word, phonetic: '', source: 'Wiktionary', meanings: [{ partOfSpeech, definition }] }
//
// Meanings come first from Gemini (server-side key, one short child-level sentence, cached), and
// otherwise from Datamuse (api.datamuse.com, free, no key), whose definitions are Wiktionary's
// (CC BY-SA 4.0, credited in the card). The server is a filter in between: it
// accepts only a single plain word, refuses a list of grown-up words (the app still speaks
// the word, it just shows no definition), skips slang/obsolete/vulgar senses and "plural of"
// style entries, keeps definitions short, and caches answers. If the upstream is down the
// client falls back to just saying the word.
import { isRateLimited, getRequestIp, getGeminiClient } from './geminiService.js';

const API_BASE = 'https://api.datamuse.com/words';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const TIMEOUT_MS = 4000;
const MAX_DEFINITION_CHARS = 110;
const MAX_MEANINGS = 2;

// Words we won't define for a child (profanity, sexual or drug terms, weapons, graphic violence).
const BLOCKED_WORDS = new Set([
  'damn', 'hell', 'crap', 'sex', 'sexy', 'porn', 'nude', 'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'weed',
  'beer', 'wine', 'vodka', 'whiskey', 'alcohol', 'drunk', 'gun', 'guns', 'rifle', 'pistol', 'kill', 'murder',
  'suicide', 'rape', 'bitch', 'bastard', 'shit', 'fuck', 'fucking', 'ass', 'piss', 'slut', 'whore', 'dick',
  'cock', 'pussy', 'boob', 'boobs', 'tits', 'penis', 'vagina'
]);

const cache = new Map();

/** Returns a lowercase single word, or '' when the input isn't one. */
export function cleanWord(raw) {
  if (typeof raw !== 'string') return '';
  const word = raw.trim().toLowerCase().replace(/[‘’]/g, "'");
  return /^[a-z]{1,24}(?:'[a-z]{1,3})?$/.test(word) ? word : '';
}

export function isBlockedWord(word) {
  return BLOCKED_WORDS.has(String(word || '').toLowerCase());
}

const POS_NAMES = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
// Senses we don't show a child: informal/offensive/old labels, and pure inflection entries.
const SKIP_LABELS = /\b(vulgar|offensive|derogatory|slang|obsolete|archaic|dated|rare|euphemistic|taboo|ethnic slur|nonstandard)\b/i;
const SKIP_STARTS = /^(alternative|plural of|simple past|past participle|present participle|third-person|misspelling|obsolete|initialism|abbreviation|contraction|eye dialect|nonstandard|superseded)/i;

function shorten(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_DEFINITION_CHARS) return clean;
  const cut = clean.slice(0, MAX_DEFINITION_CHARS);
  const at = cut.lastIndexOf(' ');
  return `${cut.slice(0, at > 40 ? at : MAX_DEFINITION_CHARS).replace(/[\s,;:.]+$/, '')}...`;
}

/** One Datamuse "pos<TAB>definition" string -> { partOfSpeech, definition } or null if unsuitable. */
export function cleanDefinition(raw) {
  if (typeof raw !== 'string') return null;
  const [pos = '', ...rest] = raw.split('	');
  let text = rest.join(' ').trim();
  if (!text) return null;
  const label = text.match(/^\(([^)]*)\)\s*/);
  if (label) {
    if (SKIP_LABELS.test(label[1])) return null;
    text = text.slice(label[0].length); // drop the "(zoology, US)" style tag
  }
  if (!text || SKIP_STARTS.test(text) || SKIP_LABELS.test(text.slice(0, 40))) return null;
  return { partOfSpeech: POS_NAMES[pos] || '', definition: shorten(text.replace(/\s*\[[^\]]*\]\s*/g, ' ')) };
}

/** Turns the upstream response into the small shape the app shows. Returns null if unusable. */
export function parseDictionaryEntry(word, data) {
  const entry = Array.isArray(data) ? data.find((e) => e && e.word === word) : null;
  if (!entry || !Array.isArray(entry.defs)) return null;
  const meanings = [];
  for (const raw of entry.defs) {
    const m = cleanDefinition(raw);
    if (m && !meanings.some((x) => x.definition === m.definition)) meanings.push(m);
    if (meanings.length >= MAX_MEANINGS) break;
  }
  if (meanings.length === 0) return null;
  return { word, phonetic: '', source: 'Wiktionary', meanings };
}

const KID_MEANING_PROMPT = 'You explain words to children ages 4 to 8. Reply with ONE short, simple, friendly sentence '
  + '(at most 14 words) saying what the word means, with no examples about anything scary, violent, or '
  + 'grown-up. If the word is not suitable for young children or is not a real English word, reply with exactly: NONE';
const GEMINI_DEFINE_MODEL = 'gemini-3.1-flash-lite';

/** Cleans a model's answer into one safe line, or '' when it should not be shown. */
export function cleanKidMeaning(text) {
  let out = String(text || '').replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim();
  out = out.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  if (!out || /^none\b/i.test(out) || out.length > 160) return '';
  return out;
}

async function geminiMeaning(word) {
  if (!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)) return '';
  const ai = getGeminiClient();
  if (!ai?.models?.generateContent) return '';
  const response = await ai.models.generateContent({
    model: GEMINI_DEFINE_MODEL,
    contents: `Word: ${word}`,
    config: { systemInstruction: KID_MEANING_PROMPT, maxOutputTokens: 80, temperature: 0.3 }
  });
  return cleanKidMeaning(response?.text);
}

export async function defineWord(word, { fetchImpl = globalThis.fetch, now = Date.now, generate = geminiMeaning } = {}) {
  const cached = cache.get(word);
  if (cached && now() - cached.at < CACHE_TTL_MS) return cached.value;

  let value = null;
  try {
    const meaning = await Promise.race([
      generate(word),
      new Promise((resolve) => setTimeout(() => resolve(''), TIMEOUT_MS * 2))
    ]);
    if (meaning) value = { status: 200, entry: { word, phonetic: '', source: '', meanings: [{ partOfSpeech: '', definition: meaning }] } };
  } catch {
    value = null; // fall through to the dictionary
  }

  if (!value) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${API_BASE}?sp=${encodeURIComponent(word)}&md=d&max=1`, { signal: controller.signal });
      if (!res.ok) return { status: 502 };
      const parsed = parseDictionaryEntry(word, await res.json());
      value = parsed ? { status: 200, entry: parsed } : { status: 404 };
    } catch {
      return { status: 502 };
    } finally {
      clearTimeout(timer);
    }
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(word, { at: now(), value });
  return value;
}

export async function handleDictionaryRequest(req, res) {
  const word = cleanWord(req.query?.word);
  if (!word) return res.status(400).json({ ok: false, error: 'Send one plain word.' });
  if (isRateLimited(`dict:${getRequestIp(req)}`, 60, 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many lookups. Try again in a minute.' });
  }
  if (isBlockedWord(word)) return res.status(404).json({ ok: false, error: 'No definition for that word.' });
  const out = await defineWord(word);
  if (out.status !== 200) {
    return res.status(out.status).json({ ok: false, error: out.status === 404 ? 'No definition found.' : 'The dictionary is resting.' });
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.json({ ok: true, ...out.entry });
}

export function clearDictionaryCache() {
  cache.clear();
}
