// Read-Along: checks what a child said against the sentence they were asked to read.
//
// The transcript comes from Whisper on the family Pi (see localVoiceService.js) or, when the
// Pi is unreachable, the browser's own speech recognition. Both are imperfect with young
// children, so matching is forgiving: punctuation and capitals are ignored, number digits
// become words, same-sounding words (to/too/two) count, one-letter slips on longer words
// count, extra filler words are ignored, and a small number of misses is allowed.
// Pure functions only (no DOM) so they can be tested under plain Node.

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

// Words that sound the same. Children can't choose the spelling a recognizer picks.
const HOMOPHONE_GROUPS = [
  ['to', 'too', 'two'], ['there', 'their', "they're"], ['see', 'sea'], ['no', 'know'], ['one', 'won'],
  ['for', 'four', 'fore'], ['be', 'bee'], ['here', 'hear'], ['sun', 'son'], ['by', 'buy', 'bye'],
  ['our', 'hour'], ['right', 'write'], ['red', 'read'], ['made', 'maid'], ['road', 'rode'], ['knight', 'night'],
  ['new', 'knew'], ['would', 'wood'], ['plain', 'plane'], ['sail', 'sale'], ['tale', 'tail']
];
const HOMOPHONE_INDEX = new Map();
HOMOPHONE_GROUPS.forEach((group, gi) => group.forEach((w) => HOMOPHONE_INDEX.set(w, gi)));

/** Lowercases, drops punctuation, turns digits into words. Returns an array of words. */
export function normalizeWords(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) && Number(w) <= 20 ? NUMBER_WORDS[Number(w)] : w));
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** True when a heard word should count as the target word. */
export function wordsMatch(target, heard) {
  if (target === heard) return true;
  const a = HOMOPHONE_INDEX.get(target);
  if (a !== undefined && a === HOMOPHONE_INDEX.get(heard)) return true;
  // One-letter slips only on words of 4+ letters: "cat" vs "cut" is a real reading mistake.
  return target.length >= 4 && heard.length >= 4 && editDistance(target, heard) <= 1;
}

/** How many words may be missed and still count as a successful read. */
export function allowedMisses(totalWords) {
  if (totalWords <= 3) return 0;
  if (totalWords <= 8) return 1;
  return 2;
}

/**
 * Compares the sentence with the transcript.
 * Returns { words: [{ word, status: 'correct' | 'missed' }], correct, total, passed, heardAnything }.
 * Matching keeps the sentence order (longest common subsequence), so a word said twice or in
 * the wrong place does not count twice.
 */
export function scoreReading(sentence, transcript) {
  const target = normalizeWords(sentence);
  const heard = normalizeWords(transcript);
  const rawTarget = String(sentence || '').split(/\s+/).filter(Boolean);
  const n = target.length;
  const m = heard.length;

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], wordsMatch(target[i - 1], heard[j - 1]) ? dp[i - 1][j - 1] + 1 : 0);
    }
  }
  const matched = Array(n).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (wordsMatch(target[i - 1], heard[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      matched[i - 1] = true;
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const correct = matched.filter(Boolean).length;
  return {
    words: target.map((word, idx) => ({
      word,
      display: rawTarget[idx] || word,
      status: matched[idx] ? 'correct' : 'missed'
    })),
    correct,
    total: n,
    passed: n > 0 && n - correct <= allowedMisses(n),
    heardAnything: m > 0
  };
}

/**
 * Browser speech recognition, used only when the Pi's Whisper is unavailable.
 * Returns { stop, result } like recordAndTranscribe: `result` resolves to the transcript,
 * '' if nothing was heard, or null if the browser can't do it.
 */
export function listenWithBrowserSpeech({ maxMs = 8000, lang = 'en-US' } = {}) {
  const Ctor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  if (!Ctor) return { stop() {}, result: Promise.resolve(null) };
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.continuous = false;
  let timer = null;
  const result = new Promise((resolve) => {
    let best = '';
    rec.onresult = (e) => {
      const alts = e.results?.[0];
      if (alts && alts[0]) best = alts[0].transcript || '';
    };
    rec.onerror = (e) => {
      clearTimeout(timer);
      resolve(e?.error === 'no-speech' ? '' : null);
    };
    rec.onend = () => { clearTimeout(timer); resolve(best); };
    try { rec.start(); } catch { resolve(null); }
    timer = setTimeout(() => { try { rec.stop(); } catch {} }, maxMs);
  });
  return { stop: () => { try { rec.stop(); } catch {} }, result };
}
