// Challenges for "Rex's Word Wall": sight words and phonics patterns, by grade level.
// Built from small hand-checked tables so every answer is verifiable (see
// scratch/verify_reading_help.mjs, which checks each pattern against its options).
//   easy   = Pre-K / Kindergarten start: sight words + sounding out CVC words
//   medium = Kindergarten stretch: more sight words, digraphs at the start/end of words
//   hard   = 2nd grade: vowel teams, r-controlled vowels, affixes, tricky spellings

const OPTION_ORDER = [1, 0, 2, 2, 0, 1]; // where the right answer sits, rotated to vary

/** Puts `correct` at a rotating position among the distractors. Returns { options, answer }. */
function arrange(correct, distractors, i) {
  const at = OPTION_ORDER[i % OPTION_ORDER.length];
  const options = [...distractors];
  options.splice(at, 0, correct);
  return { options, answer: at };
}

function make(standard, question, correct, distractors, hint, i) {
  return { standard, question, hint, ...arrange(correct, distractors, i) };
}

// ---- Sight words: [word, [look-alike, look-alike]] ----
const SIGHT_EASY = [
  ['the', ['she', 'them']], ['my', ['me', 'by']], ['to', ['do', 'too']], ['you', ['your', 'yes']],
  ['is', ['it', 'in']], ['are', ['air', 'ate']], ['go', ['no', 'do']], ['up', ['us', 'on']],
  ['we', ['me', 'be']], ['big', ['bag', 'dig']], ['red', ['rod', 'bed']], ['said', ['sad', 'say']]
];
const SIGHT_MEDIUM = [
  ['was', ['saw', 'as']], ['they', ['them', 'then']], ['have', ['hive', 'had']], ['with', ['wish', 'will']],
  ['what', ['that', 'when']], ['there', ['three', 'these']], ['want', ['went', 'wait']], ['were', ['where', 'wore']]
];

// ---- CVC words to sound out: [word, [same letters but a different vowel, x2]] ----
const CVC = [
  ['dog', ['dig', 'dug']], ['cat', ['cut', 'cot']], ['sun', ['sin', 'san']], ['pig', ['peg', 'pug']],
  ['hat', ['hit', 'hot']], ['bed', ['bad', 'bud']]
];

// ---- Medium: digraphs. start = word begins with the letters; end = word ends with them ----
const DIGRAPH_START = [
  ['sh', 'ship', ['sip', 'chip']], ['ch', 'chop', ['shop', 'hop']],
  ['th', 'thin', ['tin', 'fin']], ['wh', 'whale', ['wail', 'scale']]
];
const DIGRAPH_END = [
  ['ck', 'duck', ['dug', 'dud']], ['ng', 'ring', ['rim', 'rig']],
  ['sh', 'fish', ['fist', 'fit']], ['ch', 'much', ['must', 'mud']]
];

// ---- Hard: vowel teams and patterns. The pattern must appear in the right word only ----
const PATTERNS = [
  ['ai', 'mail', ['mall', 'mile'], 'RF.2.3.b'], ['ay', 'play', ['plan', 'plot'], 'RF.2.3.b'],
  ['ee', 'seed', ['send', 'said'], 'RF.2.3.b'], ['ea', 'beach', ['bench', 'bunch'], 'RF.2.3.b'],
  ['oa', 'boat', ['bolt', 'bat'], 'RF.2.3.b'], ['oo', 'moon', ['mean', 'mine'], 'RF.2.3.b'],
  ['igh', 'night', ['nest', 'nut'], 'RF.2.3.e'], ['ar', 'farm', ['fan', 'fun'], 'RF.2.3.e'],
  ['or', 'corn', ['can', 'cone'], 'RF.2.3.e'], ['ur', 'burn', ['bun', 'barn'], 'RF.2.3.e']
];
const AFFIXES = [
  ['What does the suffix "-ful" mean in "helpful"?', 'full of', ['without', 'again'], 'The suffix -ful means "full of". Helpful = full of help!'],
  ['What does the suffix "-er" mean in "teacher"?', 'one who does it', ['not', 'again'], 'A teacher is someone who teaches.'],
  ['What does the prefix "pre-" mean in "preview"?', 'before', ['after', 'not'], 'A preview is a look before the real thing.']
];
const SPELLINGS = [
  ['because', ['becuz', 'becase']], ['friend', ['frend', 'freind']], ['people', ['peeple', 'pepole']]
];

/** Exposed so the test can check every answer against its pattern. */
export const WORD_WALL_PATTERN_CHECKS = Object.freeze({ DIGRAPH_START, DIGRAPH_END, PATTERNS, CVC });

function sightWord([word, others], i) {
  return make('RF.K.3.c', `Find the word '${word}'.`, word, others, `Say it out loud: ${word.split('').join('-')}!`, i);
}

function build(difficulty) {
  let n = 0;
  const out = [];
  if (difficulty === 'easy') {
    SIGHT_EASY.slice(0, 10).forEach((w) => out.push(sightWord(w, n++)));
    CVC.forEach(([word, others]) => out.push(make('RF.K.2.c',
      `Sound it out: ${word.split('').join(' - ')}. Which word is it?`, word, others,
      `Blend the sounds together: ${word.split('').join(' ... ')}!`, n++)));
  } else if (difficulty === 'medium') {
    SIGHT_MEDIUM.forEach((w) => out.push(sightWord(w, n++)));
    DIGRAPH_START.forEach(([d, word, others]) => out.push(make('RF.1.3.a',
      `Which word starts with the letters '${d}'?`, word, others, `Look at the first two letters: ${d}.`, n++)));
    DIGRAPH_END.forEach(([d, word, others]) => out.push(make('RF.1.3.a',
      `Which word ends with the letters '${d}'?`, word, others, `Look at the last two letters: ${d}.`, n++)));
  } else {
    PATTERNS.forEach(([p, word, others, std]) => out.push(make(std,
      `Which word has '${p}' in it?`, word, others, `Look for the letters ${p} inside the word.`, n++)));
    AFFIXES.forEach(([q, right, others, hint]) => out.push(make('RF.2.3.d', q, right, others, hint, n++)));
    SPELLINGS.forEach(([word, others]) => out.push(make('RF.2.3.f',
      'Which word is spelled correctly?', word, others, `Say it slowly and look at each letter: ${word}.`, n++)));
  }
  return out;
}

export const WORD_WALL_CHALLENGES = Object.freeze({
  easy: build('easy'),
  medium: build('medium'),
  hard: build('hard')
});
