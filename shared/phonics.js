// Phonics pack: letter sounds, Dolch sight words, rhyme families, clap-it-out words and
// helpers that turn CMU Pronouncing Dictionary phonemes into kid-friendly sounds.
//
// Kaleb (Pre-K) starts with letter names and single letter sounds; Kayden (2nd grade) gets
// leveled sight words, rhymes, syllables and "sound it out" in tap-a-word stories.
//
// The word tables are hand-checked against the CMU dictionary in
// scratch/verify_phonics_pack.mjs (every rhyme really rhymes, every syllable count is right).
// The dictionary itself (cmu-pronouncing-dictionary, 134k words) only runs on the server:
// server/phonicsService.js. Everything here is pure and works offline.

// ── Letter sounds (Kaleb) ──────────────────────────────────────────────────────
// `say` is written for a text-to-speech voice: "A says ah, like apple".
export const LETTER_SOUNDS = Object.freeze([
  { letter: 'A', sound: '/a/', say: 'ah', word: 'apple', emoji: '🍎' },
  { letter: 'B', sound: '/b/', say: 'buh', word: 'ball', emoji: '⚽' },
  { letter: 'C', sound: '/k/', say: 'kuh', word: 'cat', emoji: '🐱' },
  { letter: 'D', sound: '/d/', say: 'duh', word: 'dog', emoji: '🐶' },
  { letter: 'E', sound: '/e/', say: 'eh', word: 'egg', emoji: '🥚' },
  { letter: 'F', sound: '/f/', say: 'fff', word: 'fish', emoji: '🐟' },
  { letter: 'G', sound: '/g/', say: 'guh', word: 'goat', emoji: '🐐' },
  { letter: 'H', sound: '/h/', say: 'huh', word: 'hat', emoji: '🎩' },
  { letter: 'I', sound: '/i/', say: 'ih', word: 'insect', emoji: '🐛' },
  { letter: 'J', sound: '/j/', say: 'juh', word: 'juice', emoji: '🧃' },
  { letter: 'K', sound: '/k/', say: 'kuh', word: 'kite', emoji: '🪁' },
  { letter: 'L', sound: '/l/', say: 'lll', word: 'lion', emoji: '🦁' },
  { letter: 'M', sound: '/m/', say: 'mmm', word: 'moon', emoji: '🌙' },
  { letter: 'N', sound: '/n/', say: 'nnn', word: 'nose', emoji: '👃' },
  { letter: 'O', sound: '/o/', say: 'ah', word: 'octopus', emoji: '🐙' },
  { letter: 'P', sound: '/p/', say: 'puh', word: 'pig', emoji: '🐷' },
  { letter: 'Q', sound: '/kw/', say: 'kwuh', word: 'queen', emoji: '👑' },
  { letter: 'R', sound: '/r/', say: 'rrr', word: 'rabbit', emoji: '🐰' },
  { letter: 'S', sound: '/s/', say: 'sss', word: 'sun', emoji: '☀️' },
  { letter: 'T', sound: '/t/', say: 'tuh', word: 'tiger', emoji: '🐯' },
  { letter: 'U', sound: '/u/', say: 'uh', word: 'umbrella', emoji: '☂️' },
  { letter: 'V', sound: '/v/', say: 'vvv', word: 'van', emoji: '🚐' },
  { letter: 'W', sound: '/w/', say: 'wuh', word: 'watermelon', emoji: '🍉' },
  { letter: 'X', sound: '/ks/', say: 'ks', word: 'fox', emoji: '🦊' },
  { letter: 'Y', sound: '/y/', say: 'yuh', word: 'yo-yo', emoji: '🪀' },
  { letter: 'Z', sound: '/z/', say: 'zzz', word: 'zebra', emoji: '🦓' }
]);

/** What Rex says for a letter card: "A. A says ah, like apple." */
export function letterSpeech(card) {
  if (!card) return '';
  return `${card.letter}. ${card.letter} says ${card.say}, like ${card.word}.`;
}

// ── Dolch sight words (public domain), by level ────────────────────────────────
export const DOLCH = Object.freeze({
  prePrimer: ['a', 'and', 'away', 'big', 'blue', 'can', 'come', 'down', 'find', 'for', 'funny', 'go', 'help', 'here', 'I', 'in', 'is', 'it', 'jump', 'little', 'look', 'make', 'me', 'my', 'not', 'one', 'play', 'red', 'run', 'said', 'see', 'the', 'three', 'to', 'two', 'up', 'we', 'where', 'yellow', 'you'],
  primer: ['all', 'am', 'are', 'at', 'ate', 'be', 'black', 'brown', 'but', 'came', 'did', 'do', 'eat', 'four', 'get', 'good', 'have', 'he', 'into', 'like', 'must', 'new', 'no', 'now', 'on', 'our', 'out', 'please', 'pretty', 'ran', 'ride', 'saw', 'say', 'she', 'so', 'soon', 'that', 'there', 'they', 'this', 'too', 'under', 'want', 'was', 'well', 'went', 'what', 'white', 'who', 'will', 'with', 'yes'],
  first: ['after', 'again', 'an', 'any', 'as', 'ask', 'by', 'could', 'every', 'fly', 'from', 'give', 'going', 'had', 'has', 'her', 'him', 'his', 'how', 'just', 'know', 'let', 'live', 'may', 'of', 'old', 'once', 'open', 'over', 'put', 'round', 'some', 'stop', 'take', 'thank', 'them', 'then', 'think', 'walk', 'were', 'when'],
  second: ['always', 'around', 'because', 'been', 'before', 'best', 'both', 'buy', 'call', 'cold', 'does', "don't", 'fast', 'first', 'five', 'found', 'gave', 'goes', 'green', 'its', 'made', 'many', 'off', 'or', 'pull', 'read', 'right', 'sing', 'sit', 'sleep', 'tell', 'their', 'these', 'those', 'upon', 'us', 'use', 'very', 'wash', 'which', 'why', 'wish', 'work', 'would', 'write', 'your'],
  third: ['about', 'better', 'bring', 'carry', 'clean', 'cut', 'done', 'draw', 'drink', 'eight', 'fall', 'far', 'full', 'got', 'grow', 'hold', 'hot', 'hurt', 'if', 'keep', 'kind', 'laugh', 'light', 'long', 'much', 'myself', 'never', 'only', 'own', 'pick', 'seven', 'shall', 'show', 'six', 'small', 'start', 'ten', 'today', 'together', 'try', 'warm']
});

/** Sight word levels for each Word Wall difficulty. */
export const SIGHT_LEVELS = Object.freeze({ easy: ['prePrimer'], medium: ['primer', 'first'], hard: ['second', 'third'] });

// ── Rhyme families: [word, rhymes...]. Every rhyme is checked against CMU. ────────
export const RHYME_FAMILIES = Object.freeze({
  easy: [
    ['cat', 'hat', 'bat', 'mat'], ['frog', 'hog', 'jog', 'fog'], ['pig', 'wig', 'dig'], ['sun', 'run', 'fun', 'bun'],
    ['bed', 'red', 'sled'], ['hop', 'top', 'mop'], ['bug', 'rug', 'hug', 'mug'], ['pan', 'fan', 'man', 'van'], ['hen', 'ten', 'pen']
  ],
  medium: [
    ['cake', 'lake', 'snake', 'rake'], ['star', 'car', 'jar'], ['ring', 'king', 'sing'], ['boat', 'coat', 'goat'],
    ['tree', 'bee', 'three'], ['moon', 'spoon', 'soon'], ['mouse', 'house'], ['snow', 'grow', 'toe']
  ],
  hard: [
    ['light', 'kite', 'bite', 'night'], ['bear', 'chair', 'pear', 'hair'], ['phone', 'bone', 'cone'], ['brain', 'train', 'plane'],
    ['shoe', 'blue', 'glue', 'true'], ['bread', 'head', 'said'], ['eight', 'gate', 'plate'], ['school', 'pool', 'rule']
  ]
});

// ── Clap it out: [word, syllables]. Checked against CMU. ─────────────────────────
export const CLAP_WORDS = Object.freeze({
  medium: [['cat', 1], ['apple', 2], ['tiger', 2], ['rabbit', 2], ['banana', 3], ['dinosaur', 3], ['elephant', 3], ['pizza', 2]],
  hard: [['butterfly', 3], ['watermelon', 4], ['hamburger', 3], ['octopus', 3], ['caterpillar', 4], ['helicopter', 4], ['alligator', 4], ['umbrella', 3]]
});

// ── CMU phonemes (ARPAbet) -> what a kid hears ──────────────────────────────────
export const PHONEME_SOUNDS = Object.freeze({
  AA: { kid: 'o', tip: 'short o, like hot' }, AE: { kid: 'a', tip: 'short a, like cat' }, AH: { kid: 'u', tip: 'short u, like up' },
  AO: { kid: 'aw', tip: 'aw, like saw' }, AW: { kid: 'ow', tip: 'ow, like cow' }, AY: { kid: 'ī', tip: 'long i, like kite' },
  EH: { kid: 'e', tip: 'short e, like bed' }, ER: { kid: 'er', tip: 'er, like her' }, EY: { kid: 'ā', tip: 'long a, like cake' },
  IH: { kid: 'i', tip: 'short i, like pig' }, IY: { kid: 'ē', tip: 'long e, like tree' }, OW: { kid: 'ō', tip: 'long o, like boat' },
  OY: { kid: 'oy', tip: 'oy, like toy' }, UH: { kid: 'oo', tip: 'oo, like book' }, UW: { kid: 'oo', tip: 'oo, like moon' },
  B: { kid: 'b' }, CH: { kid: 'ch' }, D: { kid: 'd' }, DH: { kid: 'th', tip: 'th, like this' }, F: { kid: 'f' }, G: { kid: 'g' },
  HH: { kid: 'h' }, JH: { kid: 'j' }, K: { kid: 'k' }, L: { kid: 'l' }, M: { kid: 'm' }, N: { kid: 'n' }, NG: { kid: 'ng' },
  P: { kid: 'p' }, R: { kid: 'r' }, S: { kid: 's' }, SH: { kid: 'sh' }, T: { kid: 't' }, TH: { kid: 'th', tip: 'th, like thin' },
  V: { kid: 'v' }, W: { kid: 'w' }, Y: { kid: 'y' }, Z: { kid: 'z' }, ZH: { kid: 'zh', tip: 'zh, like treasure' }
});

const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)[012]?$/;

/** "K AE1 T" -> ['K', 'AE1', 'T'] */
export function splitPhones(phones) {
  return String(phones || '').trim().split(/\s+/).filter(Boolean);
}

/** Number of syllables (vowel sounds) in a CMU pronunciation. */
export function countSyllables(phones) {
  return splitPhones(phones).filter((p) => VOWEL.test(p)).length;
}

/** The part that has to match for two words to rhyme: last stressed vowel to the end. */
export function rhymeKey(phones) {
  const list = splitPhones(phones);
  let at = -1;
  for (let i = list.length - 1; i >= 0; i--) if (/[12]$/.test(list[i])) { at = i; break; }
  if (at < 0) for (let i = list.length - 1; i >= 0; i--) if (VOWEL.test(list[i])) { at = i; break; }
  return at < 0 ? '' : list.slice(at).map((p) => p.replace(/\d/, '')).join(' ');
}

export function doesRhyme(phonesA, phonesB) {
  const a = rhymeKey(phonesA);
  return Boolean(a) && a === rhymeKey(phonesB);
}

// Letters that can spell each sound, longest first (used to line letters up with sounds).
const SPELLINGS = {
  AA: ['augh', 'ough', 'al', 'au', 'aw', 'o', 'a'], AE: ['au', 'a', 'ai'], AH: ['ou', 'oo', 'o', 'u', 'a', 'e', 'i', 'y'],
  AO: ['augh', 'ough', 'aw', 'au', 'al', 'oa', 'o', 'a'], AW: ['ough', 'ou', 'ow'], AY: ['igh', 'eye', 'ie', 'uy', 'y', 'i', 'ai'],
  EH: ['ea', 'ai', 'ie', 'ay', 'e', 'a'], ER: ['our', 'ear', 'er', 'ir', 'ur', 'or', 'ar', 're'], EY: ['eigh', 'aigh', 'ai', 'ay', 'ei', 'ey', 'ea', 'a'],
  IH: ['ui', 'ee', 'i', 'y', 'e', 'a', 'o', 'u'], IY: ['ee', 'ea', 'ie', 'ei', 'ey', 'e', 'y', 'i'], OW: ['ough', 'oa', 'ow', 'oe', 'ou', 'o'],
  OY: ['oy', 'oi'], UH: ['oo', 'ou', 'u', 'o'], UW: ['ough', 'ew', 'ue', 'oo', 'ou', 'ui', 'oe', 'u', 'o'],
  B: ['bb', 'b'], CH: ['tch', 'ch', 't'], D: ['dd', 'ed', 'd'], DH: ['th'], F: ['ph', 'ff', 'gh', 'f'], G: ['gg', 'gh', 'gu', 'g'],
  HH: ['wh', 'h'], JH: ['dge', 'ge', 'dg', 'j', 'g', 'd'], K: ['ck', 'cc', 'ch', 'qu', 'k', 'c', 'q', 'x'], L: ['ll', 'le', 'l'],
  M: ['mm', 'mb', 'm'], N: ['nn', 'kn', 'gn', 'n'], NG: ['ng', 'n'], P: ['pp', 'p'], R: ['rr', 'wr', 'r'], S: ['ss', 'ce', 'sc', 's', 'c', 'x'],
  SH: ['sh', 'ti', 'ci', 's', 'ch'], T: ['tt', 'ed', 't'], TH: ['th'], V: ['ve', 'v', 'f'], W: ['wh', 'w', 'u', 'o'],
  Y: ['y', 'i', 'j'], Z: ['zz', 'z', 's', 'x'], ZH: ['s', 'g', 'z']
};

/**
 * Lines a word's letters up with its sounds for "sound it out":
 * soundOut('ship', 'SH IH1 P') -> [{ letters: 'sh', sound: 'sh' }, { letters: 'i', sound: 'i' }, { letters: 'p', sound: 'p' }]
 * A silent final e is joined to the letter before it ("cake" -> c, a, ke). Returns [] when the
 * letters can't be lined up (unusual spellings); callers then show only the sounds.
 */
export function soundOut(word, phones) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  const ph = splitPhones(phones).map((p) => p.replace(/\d/, ''));
  if (!w || !ph.length) return [];
  const memo = new Map();
  function go(i, j) {
    const key = `${i},${j}`;
    if (memo.has(key)) return memo.get(key);
    let out = null;
    if (j === ph.length) {
      // Only silent letters may be left: a final e (cake), or a doubled/silent tail.
      const rest = w.slice(i);
      out = rest === '' ? [] : (/^(e|ue|h|gh)$/.test(rest) ? [{ letters: rest, sound: '', silent: true }] : null);
    } else if (i < w.length) {
      for (const spell of SPELLINGS[ph[j]] || []) {
        if (!w.startsWith(spell, i)) continue;
        const next = go(i + spell.length, j + 1);
        if (next) { out = [{ letters: spell, sound: PHONEME_SOUNDS[ph[j]]?.kid || ph[j].toLowerCase() }, ...next]; break; }
      }
      // A silent letter inside a word (the k in knot is covered by 'kn'; this covers e.g. "w" in "two").
      if (!out && i > 0 && /[ehw]/.test(w[i])) {
        const next = go(i + 1, j);
        if (next) out = [{ letters: w[i], sound: '', silent: true }, ...next];
      }
    }
    memo.set(key, out);
    return out;
  }
  const parts = go(0, 0) || [];
  // Join a silent letter onto the part before it so kids see "ke" in "cake", not a lone "e".
  const joined = [];
  for (const p of parts) {
    if (p.silent && joined.length) joined[joined.length - 1] = { ...joined[joined.length - 1], letters: joined[joined.length - 1].letters + p.letters };
    else joined.push({ letters: p.letters, sound: p.sound });
  }
  return joined;
}

/** Kid-friendly sounds for a pronunciation: 'K AE1 T' -> ['k', 'a', 't']. */
export function kidSounds(phones) {
  return splitPhones(phones).map((p) => PHONEME_SOUNDS[p.replace(/\d/, '')]?.kid || p.toLowerCase());
}

// ── Word Wall challenges ─────────────────────────────────────────────────────────
const ORDER = [1, 0, 2, 2, 0, 1];
function arrange(correct, distractors, i) {
  const at = ORDER[i % ORDER.length];
  const options = [...distractors];
  options.splice(at, 0, correct);
  return { options, answer: at };
}

/** Rotate a list by `offset` so each day starts somewhere new. */
function rotate(list, offset) {
  const n = list.length;
  if (!n) return [];
  const k = ((offset % n) + n) % n;
  return [...list.slice(k), ...list.slice(0, k)];
}

/** Letter-sound questions: "Which letter says mmm, like moon? 🌙" */
export function letterSoundChallenges(count = 10, offset = 0) {
  return rotate(LETTER_SOUNDS, offset).slice(0, count).map((card, i) => {
    const idx = LETTER_SOUNDS.indexOf(card);
    // Distractors: letters that look and sound different (skip C/K, the same sound).
    const others = [LETTER_SOUNDS[(idx + 7) % 26], LETTER_SOUNDS[(idx + 15) % 26]].map((c) => `${c.letter} ${c.letter.toLowerCase()}`);
    return {
      standard: 'RF.K.3.a',
      question: `Which letter says "${card.say}", like ${card.emoji} ${card.word}?`,
      hint: `${card.word} starts with ${card.letter}. ${card.letter} says ${card.say}!`,
      ...arrange(`${card.letter} ${card.letter.toLowerCase()}`, others, i)
    };
  });
}

/** "Find the letter M" with upper and lower case look-alikes. */
export function letterNameChallenges(count = 4, offset = 0) {
  const lookAlike = { b: ['d', 'p'], d: ['b', 'q'], p: ['q', 'b'], q: ['p', 'g'], m: ['n', 'w'], n: ['m', 'h'], w: ['m', 'v'] };
  return rotate(LETTER_SOUNDS, offset + 3).slice(0, count).map((card, i) => {
    const lower = card.letter.toLowerCase();
    const idx = LETTER_SOUNDS.indexOf(card);
    const others = lookAlike[lower] || [LETTER_SOUNDS[(idx + 5) % 26].letter.toLowerCase(), LETTER_SOUNDS[(idx + 11) % 26].letter.toLowerCase()];
    return { standard: 'RF.K.1.d', question: `Find the little letter ${lower} (big ${card.letter}).`, hint: `Big ${card.letter}, little ${lower}.`, ...arrange(lower, others, i) };
  });
}

function sightWordsFor(difficulty) {
  return SIGHT_LEVELS[difficulty].flatMap((k) => DOLCH[k]).filter((w) => /^[a-z]{2,}$/.test(w));
}

/** "Find the word 'look'", with two look-alikes from the same level. */
export function sightWordChallenges(difficulty, count = 6, offset = 0) {
  const pool = sightWordsFor(difficulty);
  return rotate(pool, offset * 5).slice(0, count).map((word, i) => {
    const near = pool
      .filter((w) => w !== word)
      .map((w) => ({ w, score: (w[0] === word[0] ? 0 : 2) + Math.abs(w.length - word.length) + (w.at(-1) === word.at(-1) ? 0 : 1) }))
      .sort((a, b) => a.score - b.score || a.w.localeCompare(b.w))
      .slice(0, 2)
      .map((x) => x.w);
    return { standard: difficulty === 'hard' ? 'RF.2.3.f' : 'RF.K.3.c', question: `Find the word '${word}'.`, hint: `Say it slowly: ${word.split('').join('-')}.`, ...arrange(word, near, i) };
  });
}

/** "Which word rhymes with cat?" Distractors come from other rhyme families. */
export function rhymeChallenges(difficulty, count = 4, offset = 0) {
  const fams = RHYME_FAMILIES[difficulty] || RHYME_FAMILIES.easy;
  return rotate(fams, offset).slice(0, count).map((fam, i) => {
    const fi = fams.indexOf(fam);
    const right = fam[1 + (offset + i) % (fam.length - 1)];
    const others = [fams[(fi + 1) % fams.length][1], fams[(fi + 3) % fams.length][0]];
    return { standard: difficulty === 'hard' ? 'RF.2.3.a' : 'RF.K.2.a', question: `Which word rhymes with '${fam[0]}'?`, hint: `Rhymes sound the same at the end: ${fam[0]}, ${right}!`, ...arrange(right, others, i) };
  });
}

/** "Clap it out! How many beats in 'dinosaur'?" */
export function clapChallenges(difficulty, count = 3, offset = 0) {
  const list = CLAP_WORDS[difficulty] || [];
  return rotate(list, offset).slice(0, count).map(([word, n], i) => {
    const opts = [n - 1, n + 1].filter((x) => x >= 1);
    while (opts.length < 2) opts.push(n + opts.length + 1);
    return { standard: 'RF.K.2.b', question: `Clap it out! How many beats in '${word}'?`, hint: `Clap each part: ${word}.`, ...arrange(String(n), opts.map(String), i) };
  });
}

/** Day number used to rotate the questions so each day starts on new letters and words. */
export function dayOffset(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
