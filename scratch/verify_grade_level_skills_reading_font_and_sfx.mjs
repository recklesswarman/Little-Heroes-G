import './setup_mock_env.js';
import fs from 'fs';
import { store } from '../src/state/store.js';
import { ADVENTURE_GAMES, getGameChallenges } from '../src/data/learningGamesData.js';
import { GRADE_LEVEL_GAMES, STANDARD_DESCRIPTIONS, GRADE_LEVEL_LABELS } from '../src/data/gradeLevelSkillsData.js';
import { renderQuestMapView } from '../src/views/QuestMapView.js';
import { Sound, SAMPLE_SFX_FILES } from '../src/audio/sfx.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

console.log('\n--- 1. Grade-level skill quests are registered and well-formed ---');
for (const g of GRADE_LEVEL_GAMES) {
  assert(ADVENTURE_GAMES.some((a) => a.id === g.id), `${g.id} is in ADVENTURE_GAMES`);
  for (const diff of ['easy', 'medium', 'hard']) {
    const cs = getGameChallenges(g, diff);
    assert(cs.length >= 10, `${g.id} ${diff} has >= 10 challenges (${cs.length})`);
    const badAnswer = cs.filter((c) => !(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < c.options.length));
    assert(badAnswer.length === 0, `${g.id} ${diff}: every answer index points at a real option`);
    const untagged = cs.filter((c) => !c.standard || !STANDARD_DESCRIPTIONS[c.standard]);
    assert(untagged.length === 0, `${g.id} ${diff}: every challenge is tagged with a described standard`);
    const dupOpts = cs.filter((c) => new Set(c.options).size !== c.options.length);
    assert(dupOpts.length === 0, `${g.id} ${diff}: no duplicate options`);
  }
  const easyCodes = getGameChallenges(g, 'easy').map((c) => c.standard);
  const hardCodes = getGameChallenges(g, 'hard').map((c) => c.standard);
  assert(easyCodes.every((c) => /\.K\.|^K\./.test(c)), `${g.id} easy set uses only Kindergarten standards`);
  assert(hardCodes.every((c) => /\.2\.|^2\./.test(c)), `${g.id} hard set uses only Grade 2 standards`);
  const answerSpread = new Set(getGameChallenges(g, 'easy').map((c) => c.answer));
  assert(answerSpread.size > 1, `${g.id} easy answers are not always in the same position`);
}
assert(GRADE_LEVEL_LABELS.easy.includes('Kindergarten') && GRADE_LEVEL_LABELS.hard === '2nd Grade', 'Difficulty labels name the grades');

console.log('\n--- 2. Quest map shows the new stops and the skill badge ---');
store.state.heroes = [{ id: 'hero_1', name: 'Kid', gameDifficulty: 'hard', coins: 0, pets: [] }];
store.state.selectedHero = { ...store.state.selectedHero, ...store.state.heroes[0] };
store.state.activeView = 'quest_map';
const mapHtml = renderQuestMapView();
assert(mapHtml.includes('data-map-game-id="rex_reading_rocket"'), 'Quest map has a Reading Rocket stop');
assert(mapHtml.includes('data-map-game-id="rex_math_mountain"'), 'Quest map has a Math Mountain stop');

console.log('\n--- 3. Easy-reading font toggle is per kid ---');
store.state.heroes = [
  { id: 'k1', name: 'Little', gameDifficulty: 'easy' },
  { id: 'k2', name: 'Big', gameDifficulty: 'hard' }
];
store.state.selectedHero = { ...store.state.selectedHero, id: 'k1', name: 'Little' };
store.setKidReadingFont('k1', true);
assert(store.state.heroes[0].readingFont === true, 'Kid 1 reading font is on');
assert(!store.state.heroes[1].readingFont, 'Kid 2 reading font is unchanged');
assert(store.state.selectedHero.readingFont === true, 'Selected hero picks up the setting');
store.setKidReadingFont('k1', false);
assert(store.state.heroes[0].readingFont === false, 'Kid 1 reading font can be turned off');
const css = fs.readFileSync('src/styles/index.css', 'utf8');
assert(css.includes('html.reading-font-mode') && css.includes('Atkinson Hyperlegible'), 'CSS defines the reading-font-mode override');
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('family=Atkinson+Hyperlegible'), 'index.html loads Atkinson Hyperlegible from Google Fonts');

console.log('\n--- 4. Recorded sound samples exist and fall back safely ---');
for (const file of Object.values(SAMPLE_SFX_FILES)) {
  const p = `public/assets/audio/kenney/${file}`;
  assert(fs.existsSync(p) && fs.statSync(p).size > 500, `${p} exists`);
}
assert(fs.existsSync('public/assets/audio/kenney/LICENSE.md'), 'Kenney license notice is shipped with the sounds');
let threw = false;
try { Sound.correctAnswer(); Sound.wrongAnswer(); Sound.answerSelect(); } catch (e) { threw = e; }
assert(!threw, 'Answer sounds never throw when no audio/fetch is available');

console.log(`\n=============================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`=============================================\n`);
process.exit(failed > 0 ? 1 : 0);
