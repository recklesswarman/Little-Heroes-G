// Phase 1 reading help: Read-Along matching, the three new quest games, tap-a-word meanings.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scoreReading, normalizeWords, wordsMatch, allowedMisses } from '../src/services/readAlongService.js';
import { GRADE_LEVEL_GAMES, STANDARD_DESCRIPTIONS } from '../src/data/gradeLevelSkillsData.js';
import { ADVENTURE_GAMES } from '../src/data/learningGamesData.js';
import { WORD_WALL_PATTERN_CHECKS } from '../src/data/wordWallData.js';
import { READ_ALONG_CHALLENGES } from '../src/data/readAlongData.js';
import { cleanWord, isBlockedWord, cleanDefinition, parseDictionaryEntry, cleanKidMeaning, defineWord, clearDictionaryCache } from '../server/dictionaryService.js';
import { wrapTappableWords } from '../src/services/wordHelperService.js';
import { renderReadAlongPanel } from '../src/views/readAlongPanel.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); }
}
const LEVELS = ['easy', 'medium', 'hard'];

console.log('🧪 Read-Along matching');

await test('normalizes punctuation, capitals, curly quotes and number digits', () => {
  assert.deepEqual(normalizeWords('Look at me!'), ['look', 'at', 'me']);
  assert.deepEqual(normalizeWords('The dog can’t run, 3 times.'), ['the', 'dog', "can't", 'run', 'three', 'times']);
  assert.deepEqual(normalizeWords(null), []);
});
await test('word matching allows homophones and one-letter slips on longer words only', () => {
  assert.equal(wordsMatch('two', 'too'), true);
  assert.equal(wordsMatch('night', 'knight'), true);
  assert.equal(wordsMatch('brown', 'browne'), true);
  assert.equal(wordsMatch('they', 'then'), false); // short-word slips are real mistakes
  assert.equal(wordsMatch('with', 'wish'), false);
  assert.equal(wordsMatch('cat', 'cut'), false); // a real reading mistake on a short word
  assert.equal(wordsMatch('dog', 'dig'), false);
});
await test('a perfect read passes and marks every word correct', () => {
  const r = scoreReading('I see a cat.', 'I see a cat');
  assert.equal(r.passed, true); assert.equal(r.correct, 4); assert.ok(r.words.every((w) => w.status === 'correct'));
});
await test('short sentences need every word; longer ones allow a miss or two', () => {
  assert.equal(allowedMisses(3), 0); assert.equal(allowedMisses(6), 1); assert.equal(allowedMisses(10), 2);
  assert.equal(scoreReading('I am big.', 'I am bag').passed, false);
  assert.equal(scoreReading('The cat sat on the mat.', 'the cat sat on the map').passed, true);
  assert.equal(scoreReading('The brave knight rode across the bridge.', 'the brave knight').passed, false);
});
await test('extra filler words are ignored and the missed words are the ones marked', () => {
  const r = scoreReading('We like to play.', 'um we like to um play');
  assert.equal(r.passed, true);
  const miss = scoreReading('My hat is red.', 'my is red');
  assert.deepEqual(miss.words.map((w) => w.status), ['correct', 'missed', 'correct', 'correct']);
});
await test('a word said once does not count twice, and silence fails with heardAnything false', () => {
  const r = scoreReading('The cat can run.', 'the the the the');
  assert.equal(r.correct, 1);
  const silent = scoreReading('I see a cat.', '');
  assert.equal(silent.passed, false); assert.equal(silent.heardAnything, false);
});
await test('every shipped sentence passes when read perfectly', () => {
  for (const lvl of LEVELS) for (const c of READ_ALONG_CHALLENGES[lvl]) {
    assert.equal(scoreReading(c.sentence, c.sentence).passed, true, c.sentence);
  }
});

console.log('🧪 New quest games');

await test('three new games are registered once, with 3 levels each', () => {
  for (const id of ['rex_read_along', 'rex_word_wall', 'rex_number_dash']) {
    assert.equal(ADVENTURE_GAMES.filter((g) => g.id === id).length, 1, id);
    const game = GRADE_LEVEL_GAMES.find((g) => g.id === id);
    for (const lvl of LEVELS) assert.ok(game.challengesByDifficulty[lvl].length >= 12, `${id} ${lvl}`);
  }
});
await test('every challenge has a known standard, valid answer index and unique options', () => {
  for (const id of ['rex_word_wall', 'rex_number_dash', 'rex_read_along']) {
    const game = GRADE_LEVEL_GAMES.find((g) => g.id === id);
    for (const lvl of LEVELS) for (const c of game.challengesByDifficulty[lvl]) {
      assert.ok(STANDARD_DESCRIPTIONS[c.standard], `${id} ${lvl}: unknown standard ${c.standard}`);
      assert.ok(typeof c.question === 'string' && c.question.length > 3);
      if (id === 'rex_read_along') { assert.ok(c.sentence); continue; }
      assert.equal(c.options.length, 3, c.question);
      assert.equal(new Set(c.options).size, 3, `${c.question} duplicate options`);
      assert.ok(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < 3, c.question);
    }
  }
});
await test('math answers are right', () => {
  const game = GRADE_LEVEL_GAMES.find((g) => g.id === 'rex_number_dash');
  for (const lvl of LEVELS) for (const c of game.challengesByDifficulty[lvl]) {
    let want;
    let m;
    if ((m = c.question.match(/^What is (\d+) plus (\d+)\?$/))) want = Number(m[1]) + Number(m[2]);
    else if ((m = c.question.match(/^What is (\d+) minus (\d+)\?$/))) want = Number(m[1]) - Number(m[2]);
    else if ((m = c.question.match(/^(\d+) plus what equals (\d+)\?$/))) want = Number(m[2]) - Number(m[1]);
    else if (c.question === 'How many dots are in the ten frame?') want = c.visual.a;
    else if ((m = c.question.match(/^There are (\d+) dots\. How many more make 10\?$/))) want = 10 - Number(m[1]);
    else if (c.question === 'What number do the blocks show?') want = c.visual.tens * 10 + c.visual.ones;
        else throw new Error(`unrecognised question: ${c.question}`);
    assert.equal(Number(c.options[c.answer]), want, c.question);
    assert.ok(c.options.every((o) => Number(o) >= 0), c.question);
    const limit = { easy: 5, medium: 10, hard: 20 }[lvl];
    const nums = (c.question.match(/\d+/g) || []).map(Number);
    assert.ok(nums.every((n) => n <= limit), `${lvl}: ${c.question} goes past ${limit}`);
  }
});
await test('word wall patterns: the right word has the pattern and no distractor does', () => {
  const { DIGRAPH_START, DIGRAPH_END, PATTERNS, CVC } = WORD_WALL_PATTERN_CHECKS;
  DIGRAPH_START.forEach(([d, word, others]) => {
    assert.ok(word.startsWith(d), word); others.forEach((o) => assert.ok(!o.startsWith(d), `${o} starts with ${d}`));
  });
  DIGRAPH_END.forEach(([d, word, others]) => {
    assert.ok(word.endsWith(d), word); others.forEach((o) => assert.ok(!o.endsWith(d), `${o} ends with ${d}`));
  });
  PATTERNS.forEach(([p, word, others]) => {
    assert.ok(word.includes(p), word); others.forEach((o) => assert.ok(!o.includes(p), `${o} contains ${p}`));
  });
  CVC.forEach(([word, others]) => { assert.equal(word.length, 3); others.forEach((o) => { assert.equal(o.length, 3); assert.notEqual(o, word); }); });
});
await test('the world adventure map lists the new games and has a read-along branch', () => {
  // The live mini-game list is every gradeAligned game (WorldAdventureMapView.js); QuestMapView.js is not routed.
  for (const id of ['rex_read_along', 'rex_word_wall', 'rex_number_dash']) {
    assert.equal(GRADE_LEVEL_GAMES.find((g) => g.id === id).gradeAligned, true, id);
  }
  const src = fs.readFileSync(new URL('../src/views/WorldAdventureMapView.js', import.meta.url), 'utf8');
  assert.ok(src.includes("activeMiniGame.mode === 'read-along'") && src.includes('attachReadAlongPanel') && src.includes('stopReadAlong'));
  assert.ok(src.includes('ADVENTURE_GAMES.filter(g => g.gradeAligned)'));
});
await test('the read-along panel renders each word as an escaped button', () => {
  const html = renderReadAlongPanel({ sentence: 'I see <b>a</b> cat.' }, 'easy');
  assert.equal((html.match(/data-ra-idx=/g) || []).length, 4); // I / see / <b>a</b> / cat.
  assert.ok(!html.includes('<b>a</b>') && html.includes('&lt;b&gt;'));
  assert.ok(html.includes('id="ra-record"') && html.includes('id="ra-hear"') && html.includes('id="ra-next"'));
});

console.log('🧪 Tap-a-word meanings');

await test('only a single plain word is accepted; grown-up words get no definition', () => {
  assert.equal(cleanWord(' Turtle '), 'turtle'); assert.equal(cleanWord("don’t"), "don't");
  for (const bad of ['two words', 'a1', '', 'x'.repeat(30), '../etc', ['cat'], null, undefined, { a: 1 }]) assert.equal(cleanWord(bad), '', String(bad));
  assert.equal(isBlockedWord('Hell'), true); assert.equal(isBlockedWord('turtle'), false);
});
await test('Wiktionary-style senses are cleaned and the odd ones skipped', () => {
  assert.deepEqual(cleanDefinition('n\t(zoology, US) A slow reptile with a shell.'), { partOfSpeech: 'noun', definition: 'A slow reptile with a shell.' });
  assert.equal(cleanDefinition('n\t(slang) A silly person.'), null);
  assert.equal(cleanDefinition('v\tPlural of cat.'), null);
  assert.equal(cleanDefinition('adj\t(obsolete) Old word.'), null);
  const entry = parseDictionaryEntry('cat', [{ word: 'cat', defs: ['n\t(vulgar) rude.', 'n\tA small furry pet.', 'n\tA small furry pet.', 'v\tTo hoist an anchor.', 'n\tAnother.'] }]);
  assert.deepEqual(entry.meanings.map((m) => m.definition), ['A small furry pet.', 'To hoist an anchor.']);
  assert.equal(parseDictionaryEntry('cat', [{ word: 'dog', defs: ['n\tx'] }]), null);
});
await test('Gemini meanings are cleaned: no markup, no NONE, no essays', () => {
  assert.equal(cleanKidMeaning('**A turtle** is a slow animal with a shell.'), 'A turtle is a slow animal with a shell.');
  assert.equal(cleanKidMeaning('NONE'), ''); assert.equal(cleanKidMeaning('x'.repeat(200)), ''); assert.equal(cleanKidMeaning(''), '');
});
await test('definitions come from Gemini first, fall back to the dictionary, and are cached', async () => {
  clearDictionaryCache();
  let geminiCalls = 0;
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => [{ word: 'turtle', defs: ['n\tA reptile with a shell.'] }] });
  const first = await defineWord('turtle', { generate: async () => { geminiCalls++; return 'A turtle is a slow animal with a shell.'; }, fetchImpl });
  assert.equal(first.entry.meanings[0].definition, 'A turtle is a slow animal with a shell.'); assert.equal(first.entry.source, '');
  await defineWord('turtle', { generate: async () => { geminiCalls++; return 'again'; }, fetchImpl });
  assert.equal(geminiCalls, 1);
  clearDictionaryCache();
  const fallback = await defineWord('turtle', { generate: async () => { throw new Error('quota'); }, fetchImpl });
  assert.equal(fallback.entry.source, 'Wiktionary'); assert.equal(fallback.entry.meanings[0].definition, 'A reptile with a shell.');
  clearDictionaryCache();
  const down = await defineWord('turtle', { generate: async () => '', fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(down.status, 502);
});
await test('story words are wrapped as safe tappable spans', () => {
  const html = wrapTappableWords(`Rex said, "Don't <b>run</b>!" & left.`);
  assert.ok(html.includes('data-word="Don&#39;t"') || html.includes("data-word=\"Don't\"") || html.includes('data-word="Don&#039;t"'));
  assert.ok(!html.includes('<b>') && !html.includes('</b>') && html.includes('&lt;'));
  assert.equal((html.match(/lh-tap-word/g) || []).length, 7); // Rex said Don't b run b left
  assert.ok(html.includes('&amp;'));
  assert.equal(wrapTappableWords(''), '');
});
await test('the server registers the dictionary route and the story view uses tappable words', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(server.includes("app.get('/api/dictionary/define'"));
  const view = fs.readFileSync(new URL('../src/views/BedtimeStoryView.js', import.meta.url), 'utf8');
  assert.ok(view.includes('wrapTappableWords(') && view.includes('attachWordHelper('));
});

if (failures) { console.error(`\n❌ ${failures} reading-help check(s) failed`); process.exit(1); }
console.log('\n✅ All reading-help checks passed');
process.exit(0);
