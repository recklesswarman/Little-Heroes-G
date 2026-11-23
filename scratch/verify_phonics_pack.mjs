// Phonics pack: letter sounds (Pre-K), Dolch sight words, rhymes and clap-it-out checked against
// the CMU Pronouncing Dictionary, "sound it out" in tap-a-word stories, the Letter Sounds screen
// and the Andika reading font.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dictionary as CMU } from 'cmu-pronouncing-dictionary';
import {
  LETTER_SOUNDS, letterSpeech, DOLCH, RHYME_FAMILIES, CLAP_WORDS, countSyllables, rhymeKey, doesRhyme, soundOut, kidSounds,
  letterSoundChallenges, letterNameChallenges, sightWordChallenges, rhymeChallenges, clapChallenges
} from '../shared/phonics.js';
import { buildWordWallChallenges } from '../src/data/wordWallData.js';
import { STANDARD_DESCRIPTIONS } from '../src/data/gradeLevelSkillsData.js';
import { phonicsForWord, handlePhonicsRequest } from '../server/phonicsService.js';
import { lookupPhonics } from '../src/services/wordHelperService.js';
import { renderLetterSoundsView } from '../src/views/LetterSoundsView.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}
const mockRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const firstPhone = (word) => CMU[word.toLowerCase().replace('-', '')]?.split(' ')[0]?.replace(/\d/, '');

console.log('\n🔤 Letter sounds');
await test('26 letters, each example word starts with its letter and its sound (CMU)', () => {
  assert.equal(LETTER_SOUNDS.length, 26);
  assert.deepEqual(LETTER_SOUNDS.map((c) => c.letter).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const expect = { A: 'AE', B: 'B', C: 'K', D: 'D', E: 'EH', F: 'F', G: 'G', H: 'HH', I: 'IH', J: 'JH', K: 'K', L: 'L', M: 'M', N: 'N', O: 'AA', P: 'P', Q: 'K', R: 'R', S: 'S', T: 'T', U: 'AH', V: 'V', W: 'W', Y: 'Y', Z: 'Z' };
  for (const c of LETTER_SOUNDS) {
    if (c.letter === 'X') { assert.ok(CMU[c.word].endsWith('K S'), 'fox ends in /ks/'); continue; }
    assert.ok(c.word.toUpperCase().startsWith(c.letter), c.word);
    assert.equal(firstPhone(c.word === 'yo-yo' ? 'yoyo' : c.word), expect[c.letter], `${c.word} should start with ${expect[c.letter]}`);
    assert.ok(c.emoji && c.say, c.letter);
  }
  assert.equal(letterSpeech(LETTER_SOUNDS[12]), 'M. M says mmm, like moon.');
});
await test('letter questions: right answer is the letter, distractors make a different sound', () => {
  const sound = (l) => LETTER_SOUNDS.find((c) => c.letter === l[0]).sound;
  for (let day = 0; day < 26; day++) {
    for (const q of letterSoundChallenges(10, day)) {
      const want = LETTER_SOUNDS.find((c) => q.question.includes(`like ${c.emoji} ${c.word}?`));
      assert.equal(q.options[q.answer], `${want.letter} ${want.letter.toLowerCase()}`);
      q.options.filter((_, i) => i !== q.answer).forEach((o) => assert.notEqual(sound(o), want.sound, `${o} vs ${want.letter}`));
    }
    for (const q of letterNameChallenges(3, day)) {
      assert.match(q.question, new RegExp(`little letter ${q.options[q.answer]} `));
      assert.equal(new Set(q.options).size, 3);
    }
  }
});

console.log('\n📚 Sight words, rhymes, syllables');
await test('Dolch lists have their standard sizes (220 words)', () => {
  assert.deepEqual(Object.values(DOLCH).map((l) => l.length), [40, 52, 41, 46, 41]);
  assert.equal(new Set(Object.values(DOLCH).flat().map((w) => w.toLowerCase())).size, 220);
});
await test('every rhyme family really rhymes, and families don\'t rhyme with each other', () => {
  for (const [lvl, fams] of Object.entries(RHYME_FAMILIES)) {
    for (const fam of fams) {
      for (const w of fam) assert.ok(CMU[w], `${w} not in CMU`);
      for (const w of fam.slice(1)) assert.ok(doesRhyme(CMU[fam[0]], CMU[w]), `${lvl}: ${w} should rhyme with ${fam[0]}`);
    }
    const keys = fams.map((f) => rhymeKey(CMU[f[0]]));
    assert.equal(new Set(keys).size, keys.length, `${lvl}: two families share a rhyme`);
  }
  assert.equal(rhymeKey('B AH1 T ER0 F L AY2'), 'AY');
  assert.equal(rhymeKey('K AE1 T'), 'AE T');
});
await test('clap-it-out counts match CMU', () => {
  for (const list of Object.values(CLAP_WORDS)) for (const [w, n] of list) assert.equal(countSyllables(CMU[w]), n, w);
});
await test('rhyme and clap questions: the right option rhymes / counts, the others don\'t', () => {
  for (let day = 0; day < 10; day++) for (const lvl of ['easy', 'medium', 'hard']) {
    for (const q of rhymeChallenges(lvl, 4, day)) {
      const target = q.question.match(/rhymes with '(\w+)'/)[1];
      q.options.forEach((o, i) => assert.equal(doesRhyme(CMU[target], CMU[o]), i === q.answer, `${target}/${o}`));
    }
    if (lvl !== 'easy') for (const q of clapChallenges(lvl, 3, day)) {
      const w = q.question.match(/in '(\w+)'/)[1];
      assert.equal(Number(q.options[q.answer]), countSyllables(CMU[w]));
      assert.equal(new Set(q.options).size, 3);
    }
  }
});
await test('sight word questions use real Dolch words for the level', () => {
  for (const [lvl, levels] of [['medium', ['primer', 'first']], ['hard', ['second', 'third']]]) {
    const pool = new Set(levels.flatMap((k) => DOLCH[k]));
    for (const q of sightWordChallenges(lvl, 6, 3)) {
      assert.equal(q.question, `Find the word '${q.options[q.answer]}'.`);
      q.options.forEach((o) => assert.ok(pool.has(o), o));
      assert.equal(new Set(q.options).size, 3);
    }
  }
});
await test('Word Wall: Pre-K level is letters and rhymes; every level stays valid on any day', () => {
  for (const day of [0, 7, 20000, 20415]) {
    const ww = buildWordWallChallenges(day);
    assert.ok(ww.easy.filter((c) => c.standard === 'RF.K.3.a').length >= 10);
    assert.ok(!ww.easy.some((c) => /Find the word/.test(c.question)), 'no sight words yet for Pre-K');
    for (const lvl of ['easy', 'medium', 'hard']) {
      assert.ok(ww[lvl].length >= 12 && ww[lvl].length <= 25, `${lvl} has ${ww[lvl].length}`);
      for (const c of ww[lvl]) {
        assert.ok(STANDARD_DESCRIPTIONS[c.standard], c.standard);
        assert.equal(c.options.length, 3);
        assert.equal(new Set(c.options).size, 3, c.question);
        assert.ok(c.answer >= 0 && c.answer < 3);
        assert.doesNotMatch(c.question + c.options.join(''), /[<>]/, 'plain text only (rendered as HTML)');
      }
    }
  }
});

console.log('\n🗣️ Sound it out');
await test('letters line up with sounds, silent e rides along', () => {
  const show = (w) => soundOut(w, CMU[w]).map((p) => `${p.letters}:${p.sound}`).join(' ');
  assert.equal(show('ship'), 'sh:sh i:i p:p');
  assert.equal(show('cake'), 'c:k a:ā ke:k');
  assert.equal(show('night'), 'n:n igh:ī t:t');
  assert.equal(show('knight'), 'kn:n igh:ī t:t');
  assert.equal(show('phone'), 'ph:f o:ō ne:n');
  assert.equal(show('laugh'), 'l:l au:a gh:f');
  assert.deepEqual(kidSounds(CMU.cat), ['k', 'a', 't']);
  for (const w of [...DOLCH.prePrimer, ...DOLCH.primer].map((x) => x.toLowerCase()).filter((x) => CMU[x])) {
    const parts = soundOut(w, CMU[w]);
    if (parts.length) assert.equal(parts.map((p) => p.letters).join(''), w, w);
  }
  assert.deepEqual(soundOut('cat', ''), []);
});
await test('server /api/phonics/word answers from CMU and refuses junk', async () => {
  const p = await phonicsForWord('Butterfly');
  assert.deepEqual([p.word, p.syllables], ['butterfly', 3]);
  assert.equal(p.parts.map((x) => x.letters).join(''), 'butterfly');
  assert.equal(await phonicsForWord('zzqqx'), null);
  let res = mockRes();
  await handlePhonicsRequest({ query: { word: 'ship' }, headers: {}, socket: {} }, res);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.sounds, ['sh', 'i', 'p']);
  res = mockRes();
  await handlePhonicsRequest({ query: { word: 'two words' }, headers: {}, socket: {} }, res);
  assert.equal(res.code, 400);
  res = mockRes();
  await handlePhonicsRequest({ query: { word: 'qwxzz' }, headers: {}, socket: {} }, res);
  assert.equal(res.code, 404);
});
await test('tap-a-word card fetches phonics (and shrugs off failures)', async () => {
  let url = '';
  const ok = await lookupPhonics('Ship', async (u) => { url = u; return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, syllables: 1, sounds: ['sh', 'i', 'p'], parts: [{ letters: 'sh', sound: 'sh' }] }) }; });
  assert.match(url, /\/api\/phonics\/word\?word=ship$/);
  assert.equal(ok.parts[0].letters, 'sh');
  assert.equal(await lookupPhonics('nope', async () => { throw new Error('offline'); }), null);
  const src = fs.readFileSync(new URL('../src/services/wordHelperService.js', import.meta.url), 'utf8');
  assert.ok(src.includes('data-word-phonics') && !/innerHTML/.test(src), 'chips are built with textContent');
});

console.log('\n🖼️ Screens and font');
await test('Letter Sounds screen shows 26 cards and is routed', () => {
  const html = renderLetterSoundsView();
  assert.equal((html.match(/data-letter="/g) || []).length, 26);
  assert.ok(html.includes('data-letters-quiz'));
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("case 'letters':") && main.includes('renderLetterSoundsView'));
  assert.ok(fs.readFileSync(new URL('../src/views/DashboardView.js', import.meta.url), 'utf8').includes('dashboard-goto-letters-btn'));
});
await test('Andika is self-hosted and used for reading text', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("@fontsource/andika/latin-400.css") && main.includes("@fontsource/andika/latin-700.css"));
  const css = fs.readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');
  assert.match(css, /html \.kid-read[\s\S]*'Andika'/);
  assert.ok(css.includes('html .lh-tap-word') && css.includes('html .ra-word'));
  assert.ok(fs.readFileSync(new URL('../src/views/WorldAdventureMapView.js', import.meta.url), 'utf8').includes('kid-read'));
});

if (failures) {
  console.error(`\n❌ ${failures} phonics pack check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Phonics pack checks passed');
process.exit(0);
